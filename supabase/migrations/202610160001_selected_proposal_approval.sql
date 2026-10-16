-- Install ONCE after 202610150001_macgpt_initial.sql. No existing proposals are deleted.
-- NULL means a legacy approval that approved all of its original changes.
alter table public.knowledge_proposals
  add column if not exists approved_change_indices integer[];

-- Atomic, validated partial approval. Original proposal remains unchanged for review/audit.
create or replace function public.resolve_knowledge_proposal_selected(
 p_proposal uuid, p_actor uuid, p_selected integer[]
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 proposal record;
 item jsonb;
 current_row record;
 v integer;
 target uuid;
 op text;
 visibility_value text;
 previous_visibility text;
 title_value text;
 body_value text;
 i integer;
 proposal_size integer;
 excluded integer[];
 results jsonb := '[]'::jsonb;
begin
 if not exists(select 1 from public.members where id=p_actor and approved and active and role in ('admin','super_admin')) then
   raise exception 'not authorized';
 end if;
 select * into proposal from public.knowledge_proposals where id=p_proposal for update;
 if not found or proposal.status<>'pending' then raise exception 'proposal is not pending'; end if;
 proposal_size := jsonb_array_length(proposal.changes);
 if proposal_size<1 or proposal_size>12 or p_selected is null
   or cardinality(p_selected)<1 or cardinality(p_selected)>proposal_size then
   raise exception 'invalid approval selection';
 end if;
 if exists(select 1 from unnest(p_selected) s where s is null or s<0 or s>=proposal_size)
   or (select count(distinct s) from unnest(p_selected) s)<>cardinality(p_selected) then
   raise exception 'invalid approval indices';
 end if;
 -- Use the original document order, not browser-supplied order.
 for i in select s from generate_series(0,proposal_size-1) s where s=any(p_selected) order by s loop
   item:=proposal.changes->i;
   op:=item->>'operation';
   title_value:=item->>'title';
   body_value:=item->>'body';
   visibility_value:=item->>'visibility';
   previous_visibility:=null;
   if op not in ('create','update','archive') or title_value is null
     or length(title_value)<2 or length(title_value)>200
     or body_value is null or length(body_value)>12000
     or visibility_value is null or visibility_value not in ('public','internal','restricted') then
     raise exception 'invalid proposal change';
   end if;
   if op='create' then
     if length(body_value)<1 or item->>'item_id' is not null or item->>'expected_version' is not null then
       raise exception 'invalid create item';
     end if;
     insert into public.knowledge_items(title,body,visibility,updated_by)
       values(title_value,body_value,visibility_value,p_actor)
       returning id,current_version into target,v;
   else
     target:=(item->>'item_id')::uuid;
     select * into current_row from public.knowledge_items where id=target for update;
     if not found or current_row.status<>'published' or current_row.current_version<>((item->>'expected_version')::integer) then
       raise exception 'stale or missing knowledge version %',target;
     end if;
     v:=current_row.current_version+1;
     previous_visibility:=current_row.visibility;
     if op='archive' then
       title_value:=current_row.title;
       body_value:=current_row.body;
       visibility_value:=current_row.visibility;
     end if;
     update public.knowledge_items set title=title_value,body=body_value,visibility=visibility_value,
       status=(case when op='archive' then 'archived' else 'published' end),
       current_version=v,updated_at=now(),updated_by=p_actor where id=target;
   end if;
   insert into public.knowledge_versions(knowledge_id,version,title,body,visibility,status,changed_by)
     values(target,v,title_value,body_value,visibility_value,
       (case when op='archive' then 'archived' else 'published' end),p_actor);
   insert into public.knowledge_events(knowledge_id,action,visibility,previous_visibility,version)
     values(target,(case when op='archive' then 'archive' else 'upsert' end),visibility_value,previous_visibility,v);
   results:=results||jsonb_build_array(jsonb_build_object('id',target,'version',v,'status',op));
 end loop;
 select coalesce(array_agg(s order by s),'{}'::integer[]) into excluded
  from generate_series(0,proposal_size-1) s where not(s=any(p_selected));
 update public.knowledge_proposals
    set status='approved',approved_by=p_actor,resolved_at=now(),
        approved_change_indices=(select array_agg(s order by s) from unnest(p_selected) s)
  where id=p_proposal;
 insert into public.audit_events(actor_id,event,detail)
   values(p_actor,'proposal.approved',jsonb_build_object('proposal',p_proposal,
     'approved_indices',p_selected,'excluded_indices',excluded,'results',results));
 return results;
end $$;

revoke execute on function public.resolve_knowledge_proposal_selected(uuid,uuid,integer[]) from public,anon,authenticated;
grant execute on function public.resolve_knowledge_proposal_selected(uuid,uuid,integer[]) to service_role;
