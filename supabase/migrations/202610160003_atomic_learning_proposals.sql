-- MacGPT atomic knowledge learning. Apply after 202610160002_complete_source_single_proposal.sql.
-- Previous knowledge, decisions, proposals and audit log are NOT changed.
create table if not exists public.knowledge_learning_sources (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.members(id),
 sha256 text not null,
 source_text text not null,
 source_names jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.knowledge_learning_sources enable row level security;
revoke all on public.knowledge_learning_sources from public,anon,authenticated;
grant select,insert,update,delete on public.knowledge_learning_sources to service_role;

create or replace function public.create_atomic_learning_proposals(
 p_actor uuid, p_source_text text, p_sha256 text, p_sources jsonb, p_facts jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 v_source uuid;
 v_fact jsonb;
 v_change jsonb;
 v_title text;
 v_body text;
 v_index integer := 0;
 v_evidence text;
 v_start integer;
 v_end integer;
 v_new uuid;
begin
 if not exists(select 1 from public.members where id=p_actor and approved and active and role in('admin','super_admin')) then
  raise exception 'not authorized';
 end if;
 if p_source_text is null or length(p_source_text)<2 or length(p_source_text)>200000 or p_sha256 is null or length(p_sha256)<>64
    or jsonb_typeof(p_facts)<>'array' or jsonb_array_length(p_facts)<1 then
  raise exception 'invalid source';
 end if;
 if p_sources is null or jsonb_typeof(p_sources)<>'array' then raise exception 'invalid source names'; end if;
 insert into public.knowledge_learning_sources(owner_id,sha256,source_text,source_names)
  values(p_actor,p_sha256,p_source_text,p_sources) returning id into v_source;
 for v_fact in select value from jsonb_array_elements(p_facts) loop
  v_change := v_fact->'change';
  v_title := v_change->>'title';
  v_body := v_change->>'body';
  v_evidence := v_fact->>'evidence';
  v_start := (v_fact->>'start')::integer;
  v_end := (v_fact->>'end')::integer;
  if v_change is null or v_change->>'operation'<>'create'
   or v_change->>'item_id' is not null or v_change->>'expected_version' is not null
   or (v_change->>'visibility' is null or v_change->>'visibility' not in('internal','public','restricted'))
   or v_title is null or length(v_title)<2 or length(v_title)>200
   or v_body is null or length(v_body)<2 or length(v_body)>12000
   or v_evidence is null or length(v_evidence)<2
   or v_start is null or v_start<0 or v_end is null or v_end<=v_start
   or v_end>length(p_source_text)*2 then
    raise exception 'invalid individual fact at %',v_index;
  end if;
  insert into public.knowledge_proposals(request_text,summary,changes,requested_by,source_manifest)
  values(
    '개별 사실 검토 요청 (원문 SHA256: '||p_sha256||', 순번: '||(v_index+1)||')',
    '원문 기반 단일 사실 #'||(v_index+1)||' — 하나씩 승인하거나 거절하세요.',
    jsonb_build_array(v_change),p_actor,
    jsonb_build_object('source_id',v_source,'source_sha256',p_sha256,
      'atomic_index',v_index,'evidence',v_evidence,'context',coalesce(v_fact->>'context',''),
      'start',v_start,'end',v_end,'review_mode','atomic_fact')
  ) returning id into v_new;
  v_index:=v_index+1;
 end loop;
 insert into public.audit_events(actor_id,event,detail)
 values(p_actor,'learning.atomic_proposals_created',jsonb_build_object('source',v_source,'count',v_index,'sha256',p_sha256));
 return jsonb_build_object('source_id',v_source,'created',v_index);
end $$;
revoke execute on function public.create_atomic_learning_proposals(uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_atomic_learning_proposals(uuid,text,text,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
