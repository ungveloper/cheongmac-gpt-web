import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewSourceSections} from '../lib/source-review.mjs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const src=['청맥 브랜드북','[목차]','1-1. 병원 개요','1-5. 진료과목','1-6. 의료진 소개','1-7. 시설',...Array.from({length:9},(_,i)=>`기본 자료 항목 ${i+1} `+'안내 '.repeat(30)),'1. 청맥병원 기본 정보','1-1. 병원 개요','설립 목적과 기본 정보 '.repeat(65),'1-5. 진료과목 및 특화진료','✔️ 하지정맥류','하지정맥류 원문 정보 '.repeat(65),'✔️ 당뇨발','당뇨발 원문 정보 '.repeat(65),'1-6. 의료진 소개','박용범 원장님 | 혈관외과 전문의','학회와 진료 경력 '.repeat(65),'전진원 원장님 | 혈관외과 전문의','자격 및 경력 '.repeat(65),'장지란 원장님 | 혈관외과 전문의','경력 정보 '.repeat(65),'변승재 원장님 | 혈관외과 전문의','학술 정보 '.repeat(65),'배병호 원장님 | 영상의학과 전문의','진료 경력 '.repeat(65),'김병주 원장님 | 마취통증의학과 전문의','전공 및 경력 '.repeat(65),'1-7. 주요 장비 및 시설',...Array.from({length:10},(_,i)=>`${i+1}. 장비 ${i+1}\n`+'장비 기능 설명 '.repeat(50)),'1-8. 지원 서비스',...Array.from({length:5},(_,i)=>`${i+1}. 편의 ${i+1}\n`+'편의 사항 '.repeat(25)),'1-9. 협력 네트워크','학술 교류와 운영 '.repeat(20),'---','위 내용을 학습해줘.'].join('\n');

test('Long, structured brandbook preserves every character, no item truncation',()=>{
 const sections=reviewSourceSections(src,{maxBodyChars:11800});
 assert.ok(sections.length>12,sections.length);
 assert.equal(sections.map(s=>s.body).join(''),src);
 assert.equal(sections.reduce((sum,s)=>sum+s.body.length,0),src.length);
 assert.equal(sections[0].start,0);assert.equal(sections.at(-1).end,src.length);
 assert.ok(sections.every(s=>s.body.length<=11800&&s.title.length<=200));
 const titles=sections.map(s=>s.title).join(' ');
 for(const name of ['하지정맥류','당뇨발','박용범','전진원','장지란','변승재','배병호','김병주'])assert.ok(titles.includes(name),name);
 assert.equal(createHash('sha256').update(sections.map(s=>s.body).join('')).digest('hex'),createHash('sha256').update(src).digest('hex'));
});
test('Unstructured prose and overlong paragraphs are also fully preserved in bounded body chunks',()=>{
 const raw='가'.repeat(45678)+'\n'+'나'.repeat(345);
 const parts=reviewSourceSections(raw);
 assert.equal(parts.map(p=>p.body).join(''),raw);
 assert.ok(parts.every(p=>p.body.length<=11800));
 assert.ok(parts.length>3);
});
test('One source yields one proposal; no 12-item group or slice, and manifests record full coverage',()=>{
 const api=read('app/api/admin/assist/route.ts');
 assert.match(api,/reviewSourceSections\(source\)/);
 assert.match(api,/source_manifest:manifest/);
 assert.match(api,/coverage_complete:true/);
 assert.match(api,/createHash\('sha256'\)/);
 assert.match(api,/\.insert\(\{request_text:/);
 assert.match(api,/\.select\('id,changes,summary,status,source_manifest'\)\.single\(\)/);
 assert.doesNotMatch(api,/unique\.slice\(0,12\)/);
 assert.doesNotMatch(api,/TOO_MANY_CHANGES/);
});
test('Unlimited selection validation requires SQL migration, maintains atomic lock and audit, no stale 12 bound',()=>{
 const route=read('app/api/admin/proposals/approve/route.ts');
 const sql=read('supabase/migrations/202610160002_complete_source_single_proposal.sql');
 assert.match(route,/\.min\(0\)\)\.min\(1\)\.refine/);
 assert.doesNotMatch(route,/\.max\(11\)|\.max\(12\)/);
 assert.match(sql,/for update/);
 assert.match(sql,/s=any\(p_selected\)/);
 assert.match(sql,/approved_change_indices=/);
 assert.match(sql,/excluded_indices/);
 assert.doesNotMatch(sql,/proposal_size>12/);
 assert.match(sql,/revoke execute on function public\.resolve_knowledge_proposal_selected/);
});
test('Full review provides searchable entries, selected indices and an audit-friendly coverage banner',()=>{
 const ui=read('components/proposal-review.tsx');
 const workspace=read('components/workspace.tsx');
 assert.match(ui,/변경안 항목 검색/);
 assert.match(ui,/filtered\.map/);
 assert.match(ui,/covered_chars/);
 assert.match(read('app/api/admin/proposals/route.ts'),/approved_change_indices,source_manifest/);
 assert.match(workspace,/selected_indices:includedIndices\(p\)/);
 assert.match(workspace,/MacGPT 홈으로 이동하고 대화 초기화/);
});
