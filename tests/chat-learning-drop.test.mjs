import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isKnowledgeChangeRequest} from '../lib/knowledge-intent.mjs';
const source = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('explicit document learning is a proposal intent; ordinary questions are not',()=>{
  assert.equal(isKnowledgeChangeRequest('이 브랜드북 내용을 학습해줘.'),true);
  assert.equal(isKnowledgeChangeRequest('첨부한 파일의 규정을 등록해 주세요.'),true);
  assert.equal(isKnowledgeChangeRequest('브랜드북을 요약해줘.'),false);
  assert.equal(isKnowledgeChangeRequest('현재 등록된 지식은 무엇인가요?'),false);
});
test('whole chat area accepts and intercepts file drops',()=>{
  const ui=source('components/workspace.tsx');
  assert.match(ui,/ref=\{chatDropRef\}.*onDragEnter=\{onChatDragEnter\}/);
  assert.match(ui,/ref=\{chatDropRef\}.*onDragOver=\{onChatDragOver\}/);
  assert.match(ui,/ref=\{chatDropRef\}.*onDragLeave=\{onChatDragLeave\}/);
  assert.match(ui,/ref=\{chatDropRef\}.*onDrop=\{onChatDrop\}/);
  assert.match(ui,/event\.preventDefault\(\);event\.stopPropagation\(\);setDragDepth\(0\)/);
  assert.match(ui,/selectChatFiles\(event\.dataTransfer\.files\)/);
  assert.match(ui,/role="status" aria-live="polite"/);
  assert.match(ui,/pointer-events-none absolute inset-0/);
  assert.match(ui,/onClick=\{\(\)=>fileInput\.current\?\.click\(\)\}/);
});
test('AI intent detection starts guarded proposals without a manual confirmation',()=>{
  const ui=source('components/workspace.tsx');
  assert.doesNotMatch(ui,/<span>학습 모드<\/span>/);
  assert.doesNotMatch(ui,/학습 변경안 만들기/);
  assert.doesNotMatch(ui,/학습하시겠습니까/);
  assert.match(ui,/analyze=intent.intent==='learn'/);
  assert.doesNotMatch(ui,/<span>지식 변경 모드<\/span>/);
  assert.match(ui,/const added=await uploadChatFiles\(pendingFiles\)/);
  assert.match(ui,/post\('\/api\/admin\/assist',\{message:text,attachments:attachmentIds\}\)/);
  assert.doesNotMatch(ui,/채팅 첨부파일은 임시 참고자료이며 지식 변경안에 자동 반영되지 않습니다/);
  assert.match(ui,/승인 전에는 학습된 것이 아닙니다/);
});
test('admin assist checks role, file ownership, format, and approval boundary',()=>{
  const api=source('app/api/admin/assist/route.ts');
  assert.match(api,/requireMember\('admin'\)/);
  assert.match(api,/attachments:idsSchema\.default\(\[\]\)/);
  assert.match(api,/loadChatFiles\(attachments,member\.member\.id\)/);
  assert.match(api,/extractLearningPdfText\(pdfs\)/);
  assert.match(api,/type:'input_text'/);
  assert.match(api,/\.from\('knowledge_proposals'\)\.insert/);
  assert.doesNotMatch(api,/resolve_knowledge_proposal/);
  assert.match(api,/store:false/);
});
