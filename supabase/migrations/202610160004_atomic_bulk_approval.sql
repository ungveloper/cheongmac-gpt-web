-- Run after 202610160001, 002, 003. No existing knowledge or proposal is deleted.
-- Every selected independent fact creates its OWN approved knowledge item.
-- A failed or stale selection raises an exception and rolls the whole batch back.
create or replace function public.resolve_atomic_proposals_bulk(
 p_actor uuid, p_proposals uuid[]
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 v_id uuid;
 v_result jsonb;
 v_results jsonb := '[]'::jsonb;
 v_count integer;
begin
 if not exists (select 1 from public.members where id=p_actor
    and approved and active and role in ('admin','super_admin')) then
   raise exception 'not authorized';
 end if;
 if p_proposals is null or cardinality(p_proposals)<1
    or exists (select 1 from unnest(p_proposals) id where id is null)
    or (select count(distinct id) from unnest(p_proposals) id)<>cardinality(p_proposals) then
   raise exception 'invalid or duplicate proposal selection';
 end if;
 -- Lock the entire selection in a consistent order to prevent partial approval.
 perform 1 from public.knowledge_proposals
  where id=any(p_proposals) order by id for update;
 get diagnostics v_count=row_count;
 if v_count<>cardinality(p_proposals) then
  raise exception 'selection contains unavailable proposals';
 end if;
 if exists (
  select 1 from public.knowledge_proposals p where p.id=any(p_proposals)
    and (p.status<>'pending' or jsonb_array_length(p.changes)<>1
       or coalesce(p.source_manifest->>'review_mode','')<>'atomic_fact')
 ) then
  raise exception 'selection contains non-atomic or already reviewed proposals';
 end if;
 for v_id in select id from unnest(p_proposals) id order by id loop
  -- Reuse existing guarded, versioned, audited atomic approval procedure.
  v_result:=public.resolve_knowledge_proposal_selected(v_id,p_actor,array[0]::integer[]);
  v_results:=v_results||v_result;
 end loop;
 insert into public.audit_events(actor_id,event,detail)
  values(p_actor,'learning.atomic_bulk_approved',
   jsonb_build_object('count',cardinality(p_proposals),'proposal_ids',to_jsonb(p_proposals)));
 return jsonb_build_object('approved',cardinality(p_proposals),'changes',v_results);
end $$;
revoke execute on function public.resolve_atomic_proposals_bulk(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.resolve_atomic_proposals_bulk(uuid,uuid[]) to service_role;
notify pgrst,'reload schema';
