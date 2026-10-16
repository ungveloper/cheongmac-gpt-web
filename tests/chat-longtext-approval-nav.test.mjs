import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {splitLearningContext} from '../lib/learning-chunks.mjs';
const source=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Chat composer has no fixed two-hour disclaimer',()=>{
 const ui=source('components/workspace.tsx');
 assert.doesNotMatch(ui,/파일은 최대 2시간 동안 참고합니다/);
});
test('Member role controls reserve arrow space without inheriting .input width 100%',()=>{
 const ui=source('components/workspace.tsx');
 const css=source('app/globals.css');
 assert.equal((ui.match(/className="member-role-select appearance-none/g)||[]).length,2);
 assert.equal((ui.match(/pointer-events-none absolute right-2.5 text-slate-500/g)||[]).length,2);
 assert.match(css,/\.member-role-select\{appearance:none;-webkit-appearance:none;min-width:132px/);
 assert.doesNotMatch(ui,/className="input !w-auto text-xs"/);
});
test('Approval-request group is shown only when authorized actionable counts exist',()=>{
 const ui=source('components/workspace.tsx');
 assert.match(ui,/outstandingRequests>0/);
 assert.match(ui,/pendingCounts\.proposals>0&&<Link href="\/proposals"/);
 assert.match(ui,/isSuper&&pendingCounts\.members>0&&<Link href="\/members"/);
 assert.match(ui,/href="\/proposals" className="btn btn-secondary">승인·거절 이력/);
 assert.doesNotMatch(ui,/n\.id==='proposals'&&pendingCounts/);
});
test('A pasted 45k character brandbook stays in source order and is chunked',()=>{
 const sourceText=Array.from({length:180},(_,i)=>`학습 자료 ${i+1}: `+'청맥병원 혈관질환 의료진 교육 연구 사회공헌 병원 가치 '.repeat(5)).join('\n');
 assert.ok(sourceText.length>4000&&sourceText.length<80000);
 const chunks=splitLearningContext(sourceText,{maxChars:8000,maxChunks:12});
 assert.ok(chunks.length>1&&chunks.length<=12);
 assert.equal(chunks.join('\n').replace(/\s+/g,' ').trim(),sourceText.replace(/\s+/g,' ').trim());
 const api=source('app/api/admin/assist/route.ts');
 assert.match(api,/MAX_LEARNING_MESSAGE_CHARS=80000/);
 assert.match(api,/isPastedDocument=message\.length>4000/);
 assert.match(api,/splitLearningContext\(message,\{maxChars:8000,maxChunks:12\}\)/);
 assert.match(api,/관리자 요청: \$\{shortRequest\}/);
 assert.match(api,/searchKnowledge\(isPastedDocument\?/);
 assert.match(api,/LEARNING_TEXT_TOO_LONG/);
 assert.match(api,/extractAtomicFacts\(source\)/);
 assert.doesNotMatch(api,/TOO_MANY_CHANGES/);
 assert.match(api,/if\(\(!fileNames.length&&!isPastedDocument\)\|\|scopeSpecified/);
 assert.doesNotMatch(api,/\.slice\(0,12\);/);
});
