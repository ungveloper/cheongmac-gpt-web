import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {splitLearningContext} from '../lib/learning-chunks.mjs';
const source=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('PDF chunks preserve source order and all words without truncation',()=>{
 const original=Array.from({length:30},(_,i)=>`Section ${i+1}: ${'hospital source evidence '.repeat(14)}`).join('\n');
 const pieces=splitLearningContext(original,{maxChars:800,maxChunks:20});
 assert.ok(pieces.length>1);
 assert.equal(pieces.join('\n').replace(/\s+/g,' ').trim(),original.replace(/\s+/g,' ').trim());
 assert.ok(pieces.every(p=>p.length<=800));
});
test('PDF chunks reject excess material instead of silent truncation',()=>{
 assert.throws(()=>splitLearningContext('a'.repeat(3000),{maxChars:500,maxChunks:2}),/LEARNING_DOCUMENT_TOO_LONG/);
});
test('File drop listeners only live on right chat pane and overlay stays inside it',()=>{
 const s=source('components/workspace.tsx');
 assert.match(s,/ref=\{chatDropRef\}.*onDragEnter=\{onChatDragEnter\}/);
 assert.match(s,/onDropCapture=\{tab==='chat'\?onOutsideChatDrop:undefined\}/);
 assert.match(s,/chatDropRef\.current\?\.contains\(event\.target as Node\)/);
 assert.match(s,/pointer-events-none absolute inset-0/);
 assert.doesNotMatch(s,/pointer-events-none fixed inset-0/);
});
test('PDF proposal generation uses bounded requests, fallback and safe OpenAI diagnostics',()=>{
 const s=source('app/api/admin/assist/route.ts');
 assert.match(s,/splitLearningContext\(pdfContext,/);
 assert.match(s,/max_output_tokens:pdfContext\?3500:6000/);
 assert.match(s,/first\.status!==400/);
 assert.match(s,/retrying minimal request/);
 assert.match(s,/code\/param/);
 assert.match(s,/request_id:problem\?\.request_id/);
 assert.match(s,/return Response\.json\(\{kind:'proposal',proposal:data/);
 assert.match(s,/\.from\('knowledge_proposals'\)\.insert/);
 assert.doesNotMatch(s,/resolve_knowledge_proposal/);
});
