import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Side navigation is actual Next.js page routes and direct URLs are authorized',()=>{
 const ui=read('components/workspace.tsx');
 assert.match(ui,/import Link from 'next\/link'/);
 assert.match(ui,/href=\{n\.id==='api'\?'\/api-management':`\/\$\{n\.id\}`\}/);
 assert.doesNotMatch(ui,/setTab\(/);
 const routes=['chat','knowledge','proposals','files','members','api-management'];
 for(const route of routes){
  assert.ok(existsSync(new URL(`../app/${route}/page.tsx`,import.meta.url)),`missing ${route}`);
  assert.match(read(`app/${route}/page.tsx`),/renderWorkspaceRoute\(/);
 }
 const auth=read('lib/workspace-route.tsx');
 assert.match(auth,/currentMember\(/);
 assert.match(auth,/role==='staff'/);
 assert.match(auth,/role!=='super_admin'/);
 assert.match(read('app/page.tsx'),/redirect\('\/chat'\)/);
});

test('Larger chat message and composer text, separate review component',()=>{
 const ui=read('components/workspace.tsx');
 assert.match(ui,/text-flow text-base leading-7/);
 assert.match(ui,/chat-composer-textarea[^\n]+text-base/);
 assert.match(ui,/<ProposalReview proposal=\{suggestion\}/);
 assert.match(ui,/tab==='proposals'.*<Heading title="변경안 승인"/s);
});

test('Rejected proposals have a separate read-only view',()=>{
 const ui=read('components/workspace.tsx');
 const api=read('app/api/admin/proposals/route.ts');
 assert.match(ui,/proposalView,setProposalView/);
 assert.match(ui,/proposals\.filter\(p=>p\.status===proposalView\)/);
 assert.match(ui,/거절됨/);
 assert.match(api,/\.eq\('status',input\.data\)/);
 assert.match(api,/approved_change_indices/);
});

test('X excludes item only from approval selection; changes remain auditable',()=>{
 const ui=read('components/workspace.tsx');
 const review=read('components/proposal-review.tsx');
 const approve=read('app/api/admin/proposals/approve/route.ts');
 const sql=read('supabase/migrations/202610160001_selected_proposal_approval.sql');
 assert.match(review,/학습 제외/);
 assert.match(review,/제외한 .*건 되돌리기/);
 assert.match(ui,/selected_indices:includedIndices\(p\)/);
 assert.match(approve,/\.min\(1\)\.max\(12\)\.refine/);
 assert.match(approve,/resolve_knowledge_proposal_selected/);
 assert.match(approve,/MIGRATION_REQUIRED/);
 assert.match(sql,/for update/);
 assert.match(sql,/s=any\(p_selected\)/);
 assert.match(sql,/approved_change_indices=/);
 assert.match(sql,/excluded_indices/);
 assert.match(sql,/revoke execute on function public\.resolve_knowledge_proposal_selected/);
 assert.doesNotMatch(approve,/\.update\(\{changes:/);
});
