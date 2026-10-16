import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Manual learning mode and confirmation are absent from the header and request routing',()=>{
 const ui=read('components/workspace.tsx');
 assert.doesNotMatch(ui,/forceEdit|setForceEdit|aria-pressed=\{forceEdit\}|학습 모드<\/span>/);
 assert.doesNotMatch(ui,/isKnowledgeChangeRequest\(text\)/);
 assert.match(ui,/post\('\/api\/admin\/learning-intent'/);
});

test('AI detects intent from recent conversation before file upload or proposal mutation',()=>{
 const ui=read('components/workspace.tsx');
 const send=ui.slice(ui.indexOf(' async function send(){'),ui.indexOf(' async function decide('));
 const classify=send.indexOf("post('/api/admin/learning-intent'");
 const upload=send.indexOf('await uploadChatFiles(pendingFiles)');
 const propose=send.indexOf("post('/api/admin/assist'");
 assert.ok(classify>0 && classify<upload && upload<propose);
 assert.match(send,/history:history\.slice\(-8\)\.map/);
 assert.match(send,/analyze=intent.intent==='learn'/);
 assert.doesNotMatch(send,/setLearningOffer|confirmed/);
});

test('Authorized learning intent continues automatically but publishing remains separately approved',()=>{
 const ui=read('components/workspace.tsx');
 assert.doesNotMatch(ui,/학습하시겠습니까|send\(true\)|learningOffer/);
 const send=ui.slice(ui.indexOf(' async function send(){'),ui.indexOf(' async function decide('));
 assert.match(send,/analyze=intent.intent==='learn'/);
 assert.match(send,/if\(analyze\)\{/);
 assert.match(send,/post\('\/api\/admin\/assist',\{message:text,attachments:attachmentIds\}\)/);
 assert.match(send,/if\(completed\)\{[\s\S]*setChatFiles\(\[\]\)/);
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
