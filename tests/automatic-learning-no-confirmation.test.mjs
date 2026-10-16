import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Authorized admin learns directly after AI intent, no extra confirmation or mode switch',()=>{
 const ui=read('components/workspace.tsx');
 const send=ui.slice(ui.indexOf(' async function send(){'),ui.indexOf(' async function decide('));
 assert.match(send,/if\(isAdmin\)\{/);
 assert.match(send,/post\('\/api\/admin\/learning-intent'/);
 assert.match(send,/history:history\.slice\(-8\)\.map/);
 assert.match(send,/analyze=intent\.intent==='learn'/);
 assert.match(send,/if\(analyze\)\{/);
 assert.match(send,/post\('\/api\/admin\/assist',\{message:text,attachments:attachmentIds\}\)/);
 assert.ok(send.indexOf("post('/api/admin/learning-intent'")<send.indexOf("post('/api/admin/assist'"));
 assert.doesNotMatch(ui,/learningOffer|forceEdit|학습하시겠습니까|학습 변경안 만들기/);
});

test('Ordinary employee messages continue directly; failures retain attachments',()=>{
 const ui=read('components/workspace.tsx');
 const send=ui.slice(ui.indexOf(' async function send(){'),ui.indexOf(' async function decide('));
 assert.match(send,/await stream\(text,history,attachmentIds\)/);
 assert.match(send,/if\(completed\)\{[\s\S]*setPendingFiles\(\[\]\);[\s\S]*setChatFiles\(\[\]\)/);
 assert.match(send,/setChat\(items=>\[\.\.\.items,\{role:'user'/);
 assert.match(send,/updateAssistant\(\{content:`요청을 완료하지 못했습니다/);
});

test('Intent and proposal endpoints independently check admin rights, SQL repair is bundled',()=>{
 const classify=read('app/api/admin/learning-intent/route.ts');
 const proposal=read('app/api/admin/assist/route.ts');
 assert.match(classify,/requireMember\('admin'\)/);
 assert.match(proposal,/requireMember\('admin'\)/);
 assert.match(proposal,/create_atomic_learning_proposals/);
 assert.match(read('supabase/migrations/202610160003_atomic_learning_proposals.sql'),/create or replace function public\.create_atomic_learning_proposals/);
});
