import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Manual learning mode is absent from the header, state and request routing',()=>{
 const ui=read('components/workspace.tsx');
 assert.doesNotMatch(ui,/forceEdit|setForceEdit|aria-pressed=\{forceEdit\}|학습 모드<\/span>/);
 assert.doesNotMatch(ui,/isKnowledgeChangeRequest\(text\)/);
 assert.match(ui,/post\('\/api\/admin\/learning-intent'/);
});

test('AI detects intent from recent conversation before file upload or proposal mutation',()=>{
 const ui=read('components/workspace.tsx');
 const send=ui.slice(ui.indexOf(' async function send(confirmed=false){'),ui.indexOf(' async function decide('));
 const classify=send.indexOf("post('/api/admin/learning-intent'");
 const upload=send.indexOf('await uploadChatFiles(pendingFiles)');
 const propose=send.indexOf("post('/api/admin/assist'");
 assert.ok(classify>0 && classify<upload && upload<propose);
 assert.match(send,/history:history\.slice\(-8\)\.map/);
 assert.match(send,/if\(intent\.intent==='learn'\)/);
 assert.match(send,/setLearningOffer\(\{message:text\}\)/);
 assert.match(send,/const analyze=confirmed;/);
});

test('Proposal generation follows explicit confirmation; cancel preserves attachments',()=>{
 const ui=read('components/workspace.tsx');
 assert.match(ui,/학습하시겠습니까\?/);
 assert.match(ui,/onClick=\{\(\)=>void send\(true\)\}/);
 assert.match(ui,/setLearningOffer\(null\);updateAssistant\(\{content:'학습 요청을 취소했습니다\. 기존 대화와 첨부파일은 유지됩니다\.'/);
 assert.match(ui,/if\(confirmed\)\{/);
 assert.match(ui,/if\(completed\)\{[\s\S]*setChatFiles\(\[\]\)/);
});

test('Intent classifier is admin-only, context-aware, schema-checked and has no DB writes',()=>{
 const route=read('app/api/admin/learning-intent/route.ts');
 assert.match(route,/requireMember\('admin'\)/);
 assert.match(route,/history:z\.array/);
 assert.match(route,/responses\.create/);
 assert.match(route,/store:false/);
 assert.match(route,/json_schema/);
 assert.match(route,/safeParse\(JSON\.parse/);
 assert.doesNotMatch(route,/adminDb\(|\.from\(|\.rpc\(/);
});
