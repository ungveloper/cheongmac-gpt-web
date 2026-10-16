import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isKnowledgeChangeRequest} from '../lib/knowledge-intent.mjs';
const read=(name)=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');

test('normal employee/admin questions bypass expensive knowledge-change analysis',()=>{
 for(const question of ['현재 등록된 지식은 무엇인가요?', '원내 규정 관련 도움을 받고 싶어요', '병원 진료시간을 알려줘', '지식을 등록하는 방법을 알려줘']){
  assert.equal(isKnowledgeChangeRequest(question),false,question);
 }
});
test('explicit administrator knowledge edits require proposal review',()=>{
 for(const prompt of ['새로운 원내 지식을 등록해줘.', '기존 지식을 수정해 줘', '청구 매뉴얼 내용을 업데이트해 주세요', '해당 규정을 폐기해줘', '진료시간을 6시로 변경해줘']){
  assert.equal(isKnowledgeChangeRequest(prompt),true,prompt);
 }
});
test('chat UI exposes progress state, streaming and direct contextual learning',()=>{
 const file=read('components/workspace.tsx');
 assert.match(file,/post\('\/api\/admin\/learning-intent'/);
 assert.match(file,/setPhase\('searching'\)/);
 assert.match(file,/setPhase\('writing'\)/);
 assert.match(file,/role="status"/);
 assert.doesNotMatch(file,/학습하시겠습니까/);
 assert.match(file,/analyze=intent.intent==='learn'/);
 assert.doesNotMatch(file,/aria-pressed=\{forceEdit\}/);
 assert.match(file,/finished=true/);
 assert.match(file,/질문 다시 입력/);
});
test('admin route exposes actionable safe error codes',()=>{
 const file=read('app/api/admin/assist/route.ts');
 assert.match(file,/OPENAI_QUOTA/);
 assert.match(file,/OPENAI_AUTH_FAILED/);
 assert.match(file,/OPENAI_MODEL_UNAVAILABLE/);
 assert.match(file,/KNOWLEDGE_SEARCH_FAILED/);
 assert.match(file,/PROPOSAL_SAVE_FAILED/);
});
