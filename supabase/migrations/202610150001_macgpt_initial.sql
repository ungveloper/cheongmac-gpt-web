-- MacGPT: apply once in the Supabase SQL editor. Each customer uses its OWN Supabase project.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'staff' check(role in ('staff','admin','super_admin')),
  approved boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create or replace function public.on_auth_user_created() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.members(id,email,display_name) values(new.id,coalesce(new.email,''),new.raw_user_meta_data->>'full_name')
  on conflict(id) do nothing;
  return new;
end $$;
create trigger macgpt_new_user after insert on auth.users for each row execute procedure public.on_auth_user_created();

create table public.source_files (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  original_name text not null,
  content_type text not null,
  byte_size bigint not null check(byte_size between 1 and 52428800),
  upload_status text not null default 'pending' check(upload_status in ('pending','uploaded')),
  knowledge_id uuid,
  uploaded_by uuid not null references public.members(id),
  created_at timestamptz not null default now()
);
create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  visibility text not null check(visibility in ('public','internal','restricted')),
  status text not null default 'published' check(status in ('published','archived')),
  current_version integer not null default 1,
  updated_by uuid references public.members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.source_files add constraint source_files_knowledge_id_fkey foreign key(knowledge_id) references public.knowledge_items(id);
create table public.knowledge_versions (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null references public.knowledge_items(id) on delete cascade,
  version integer not null,
  title text not null,
  body text not null,
  visibility text not null,
  status text not null,
  changed_by uuid references public.members(id),
  created_at timestamptz not null default now(),
  unique(knowledge_id,version)
);
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null references public.knowledge_items(id) on delete cascade,
  version integer not null,
  content text not null,
  embedding extensions.vector(1536),
  unique(knowledge_id,version)
);
create index knowledge_search_trgm on public.knowledge_items using gin (body extensions.gin_trgm_ops);
create index knowledge_title_trgm on public.knowledge_items using gin (title extensions.gin_trgm_ops);
create index knowledge_chunks_vector on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

create table public.knowledge_proposals (
  id uuid primary key default gen_random_uuid(),
  request_text text not null,
  summary text not null,
  changes jsonb not null check(jsonb_typeof(changes)='array'),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  requested_by uuid not null references public.members(id),
  approved_by uuid references public.members(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create table public.api_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_hash text not null unique,
  scope text not null check(scope in ('public','internal')),
  disabled boolean not null default false,
  expires_at timestamptz,
  created_by uuid references public.members(id),
  created_at timestamptz not null default now()
);
create table public.api_request_buckets (
  identity text not null,
  bucket_start timestamptz not null,
  hits integer not null default 1,
  primary key(identity,bucket_start)
);
create table public.knowledge_events (
  seq bigint generated always as identity primary key,
  knowledge_id uuid not null,
  action text not null check(action in ('upsert','archive')),
  visibility text not null,
  previous_visibility text,
  version integer not null,
  created_at timestamptz not null default now()
);
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  event text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- All tables are private by default. Only explicit single-member SELECT is available to user JWTs.
alter table public.members enable row level security;
create policy member_read_self on public.members for select to authenticated using (auth.uid()=id);
alter table public.source_files enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.knowledge_versions enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_proposals enable row level security;
alter table public.api_clients enable row level security;
alter table public.api_request_buckets enable row level security;
alter table public.knowledge_events enable row level security;
alter table public.audit_events enable row level security;

-- Server-side service role only; never call these RPCs directly from the browser.
create or replace function public.consume_api_quota(p_identity text,p_limit integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  if length(p_identity)>200 or p_limit<1 or p_limit>1000 then return false; end if;
  insert into public.api_request_buckets(identity,bucket_start,hits)
  values(p_identity,date_trunc('minute',clock_timestamp()),1)
  on conflict(identity,bucket_start) do update set hits=public.api_request_buckets.hits+1
  returning hits into n;
  return n<=p_limit;
end $$;

create or replace function public.search_published_knowledge(
  p_query text,p_embedding extensions.vector(1536),p_scopes text[],p_limit integer default 6
) returns table (id uuid,title text,body text,visibility text,current_version integer,updated_at timestamptz)
language sql stable security definer set search_path=public,extensions as $$
 select k.id,k.title,k.body,k.visibility,k.current_version,k.updated_at
 from public.knowledge_items k
 left join lateral (
   select max(1-(c.embedding <=> p_embedding)) as similarity
   from public.knowledge_chunks c
   where c.knowledge_id=k.id and c.version=k.current_version and c.embedding is not null and p_embedding is not null
 ) v on true
 where k.status='published' and k.visibility=any(p_scopes)
   and (k.title ilike '%'||p_query||'%' or k.body ilike '%'||p_query||'%'
        or (p_embedding is not null and coalesce(v.similarity,0)>0.34))
 order by ((case when k.title ilike '%'||p_query||'%' then 2 else 0 end)+
           (case when k.body ilike '%'||p_query||'%' then 0.75 else 0 end)+
           coalesce(v.similarity,0)) desc,k.updated_at desc
 limit least(greatest(p_limit,1),20);
$$;

-- One transaction; approval locks the proposal and checks expected versions before mutating anything.
create or replace function public.resolve_knowledge_proposal(p_proposal uuid,p_actor uuid,p_action text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  proposal record; item jsonb; current_row record; v integer; target uuid; op text;
  visibility_value text; previous_visibility text; title_value text; body_value text; results jsonb := '[]'::jsonb;
begin
  if not exists(select 1 from public.members where id=p_actor and approved and active and role in ('admin','super_admin')) then
    raise exception 'not authorized';
  end if;
  select * into proposal from public.knowledge_proposals where id=p_proposal for update;
  if not found or proposal.status<>'pending' then raise exception 'proposal is not pending'; end if;
  if p_action='reject' then
    update public.knowledge_proposals set status='rejected',approved_by=p_actor,resolved_at=now() where id=p_proposal;
    insert into public.audit_events(actor_id,event,detail) values(p_actor,'proposal.rejected',jsonb_build_object('proposal',p_proposal));
    return '[]'::jsonb;
  end if;
  if p_action<>'approve' then raise exception 'unsupported action'; end if;
  if jsonb_array_length(proposal.changes)=0 or jsonb_array_length(proposal.changes)>12 then raise exception 'invalid change count'; end if;
  for item in select value from jsonb_array_elements(proposal.changes) loop
    op:=item->>'operation'; title_value:=item->>'title'; body_value:=item->>'body'; visibility_value:=item->>'visibility'; previous_visibility:=null;
    if op not in ('create','update','archive') or length(title_value)<2 or length(title_value)>200
      or length(body_value)>12000 or visibility_value not in ('public','internal','restricted') then raise exception 'invalid proposal change'; end if;
    if op='create' then
      if length(body_value)<1 then raise exception 'empty new knowledge'; end if;
      insert into public.knowledge_items(title,body,visibility,updated_by)
      values(title_value,body_value,visibility_value,p_actor) returning id,current_version into target,v;
    else
      target:=(item->>'item_id')::uuid;
      select * into current_row from public.knowledge_items where id=target for update;
      if not found or current_row.status<>'published' or current_row.current_version<>((item->>'expected_version')::integer) then
        raise exception 'stale or missing knowledge version %',target;
      end if;
      v:=current_row.current_version+1; previous_visibility:=current_row.visibility;
      if op='archive' then
        title_value:=current_row.title;body_value:=current_row.body;visibility_value:=current_row.visibility;
      end if;
      update public.knowledge_items set title=title_value,body=body_value,visibility=visibility_value,
        status=(case when op='archive' then 'archived' else 'published' end),current_version=v,updated_at=now(),updated_by=p_actor where id=target;
    end if;
    insert into public.knowledge_versions(knowledge_id,version,title,body,visibility,status,changed_by)
      values(target,v,title_value,body_value,visibility_value,(case when op='archive' then 'archived' else 'published' end),p_actor);
    insert into public.knowledge_events(knowledge_id,action,visibility,previous_visibility,version)
      values(target,(case when op='archive' then 'archive' else 'upsert' end),visibility_value,previous_visibility,v);
    results:=results||jsonb_build_array(jsonb_build_object('id',target,'version',v,'status',op));
  end loop;
  update public.knowledge_proposals set status='approved',approved_by=p_actor,resolved_at=now() where id=p_proposal;
  insert into public.audit_events(actor_id,event,detail) values(p_actor,'proposal.approved',jsonb_build_object('proposal',p_proposal,'results',results));
  return results;
end $$;

revoke execute on function public.consume_api_quota(text,integer) from public,anon,authenticated;
revoke execute on function public.search_published_knowledge(text,extensions.vector(1536),text[],integer) from public,anon,authenticated;
revoke execute on function public.resolve_knowledge_proposal(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.consume_api_quota(text,integer) to service_role;
grant execute on function public.search_published_knowledge(text,extensions.vector(1536),text[],integer) to service_role;
grant execute on function public.resolve_knowledge_proposal(uuid,uuid,text) to service_role;

-- Create private macgpt-documents bucket in Storage UI (50MB file-size limit).
-- After FIRST Google sign-in, manually approve and elevate ONLY your verified email:
-- update public.members set approved=true,role='super_admin' where email='YOUR_VERIFIED_EMAIL';
