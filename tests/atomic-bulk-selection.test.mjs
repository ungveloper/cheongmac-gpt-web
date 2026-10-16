import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('Atomic splitter does not define an unused section variable',()=>{
 const s=read('lib/atomic-knowledge.mjs');
 assert.doesNotMatch(s,/let context='',section=''/);
 assert.doesNotMatch(s,/section='medical'/);
 assert.doesNotMatch(s,/section='clinical'/);
});
test('Every independent fact has an accessible controlled checkbox and page-independent count',()=>{
 const component=read('components/proposal-review.tsx');
 const workspace=read('components/workspace.tsx');
 assert.match(component,/type="checkbox"/);
 assert.match(component,/checked=\{checked\} onChange=\{onToggle\}/);
 assert.match(workspace,/setCheckedAtomicIds\(e\.target\.checked\?new Set\(atomicPendingIds\):new Set\(\)\)/);
 assert.match(workspace,/전체 \{atomicPendingIds\.length\.toLocaleString/);
 assert.match(workspace,/\{checkedAtomicIds\.size\.toLocaleString/);
 assert.match(workspace,/checked=\{checkedAtomicIds\.has\(p\.id\)\}/);
 assert.match(workspace,/전체 해제/);
});
test('Bulk endpoint uses one guarded SQL transaction for chosen IDs only',()=>{
 const route=read('app/api/admin/proposals/approve-bulk/route.ts');
 const sql=read('supabase/migrations/202610160004_atomic_bulk_approval.sql');
 assert.match(route,/requireMember\('admin'\)/);
 assert.match(route,/schema\.safeParse/);
 assert.match(route,/\.rpc\('resolve_atomic_proposals_bulk'/);
 assert.match(route,/p_proposals:input\.data\.ids/);
 assert.doesNotMatch(route,/\bPromise\.all\(.*approve/i);
 assert.match(sql,/for update/);
 assert.match(sql,/status<>'pending'/);
 assert.match(sql,/review_mode',''\)<>'atomic_fact'/);
 assert.match(sql,/resolve_knowledge_proposal_selected\(v_id,p_actor,array\[0\]/);
 assert.match(sql,/revoke execute on function public\.resolve_atomic_proposals_bulk/);
 assert.match(sql,/grant execute on function public\.resolve_atomic_proposals_bulk.*service_role/);
});
test('Selectable IDs include all pending atomic facts across paginated results, without sending their content',()=>{
 const route=read('app/api/admin/proposals/route.ts');
 assert.match(route,/ids_only/);
 assert.match(route,/offset\+=1000/);
 assert.match(route,/\.select\('id'\)/);
 assert.match(route,/\.eq\('status','pending'\)/);
 assert.match(route,/\.eq\('source_manifest->>review_mode','atomic_fact'\)/);
});
