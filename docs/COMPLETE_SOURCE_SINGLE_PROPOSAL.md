# MacGPT: 원문 전체를 하나의 학습 변경안으로 검토하기 (2026-10-16)

이 패치는 문서 학습을 최대 12개로 잘라 승인 항목을 누락시키던 문제를 수정합니다.

1. 장문 직접 붙여넣기(4,000자 초과), 또는 PDF·TXT·MD 첨부로 학습 요청할 때 **원문 텍스트를 그대로, 빠짐없이** 저장합니다. 목차·진료 분야·의료진·장비 소제목을 찾아 항목으로 나누고, 식별하지 못한 부분도 `표지·목차 및 서문` 또는 원문 구간에 보존합니다. 따라서 12개를 초과해도 한 변경안에 모두 저장합니다.
2. 원문의 SHA-256, 원문 글자 수, 실제 반영 글자 수, 범위 인덱스를 `knowledge_proposals.source_manifest`에 기록합니다. 항목별 분할본을 다시 이어 붙였을 때 원문과 동일하지 않으면 생성 자체를 중단합니다.
3. 검색·펼치기·개별 X 제외·전체 중 선택 승인은 **하나의 검토안** 안에서 동작합니다. SQL 함수가 검토안의 전체 길이를 검증하고 선택한 인덱스만 처리합니다. 원본 변경안, 승인·거절 기록은 유지됩니다.
4. **파일 텍스트 추출 및 원문 분할의 완전성**과 **사실 검증**은 다릅니다. 문서에 오류·오래된 의료진 정보가 있으면 관리자 확인이 필요합니다. PDF의 이미지·로고·도표는 텍스트 추출에 포함되지 않을 수 있습니다. DOCX/XLSX/이미지 파일은 원문 누락 없음을 보장할 수 없으므로 완전학습 경로와 함께 보내면 오류로 안내합니다.
5. 임의의 12건 제한은 제거했지만 메모리·DB·서버 요청 크기의 실제 한계는 존재합니다. 현재 학습 요청은 붙여넣기 80,000자, 합산 추출 텍스트 200,000자, 본문 항목당 11,800자로 분할하도록 처리합니다. 용량 초과 시 **일부만 저장하는 대신 명확한 오류**를 반환합니다. 일반 질문의 AI 답변 생성에는 별도의 모델 한계가 있습니다.

## 필수 Supabase SQL

`supabase/migrations/202610160002_complete_source_single_proposal.sql`을 SQL Editor에서 실행하세요. 이 SQL은 선택 승인 함수의 12건 제한을 제거하고 `source_manifest` 컬럼을 추가합니다. 기존 마이그레이션 `202610160001_selected_proposal_approval.sql`이 먼저 실행된 환경에 적용하십시오.

### 확인 SQL

```sql
select to_regprocedure('public.resolve_knowledge_proposal_selected(uuid,uuid,integer[])') as selected_approval_function;
select column_name from information_schema.columns where table_schema='public' and table_name='knowledge_proposals' and column_name='source_manifest';
select pg_get_functiondef('public.resolve_knowledge_proposal_selected(uuid,uuid,integer[])'::regprocedure);
```

마지막 함수 정의에 `proposal_size>12`가 없어야 합니다.

## 설치 및 안전성

압축을 해제하고 `apply.command`를 실행합니다. 깨끗한 main 브랜치와 Git Blob 해시 검사를 거친 뒤 수정 적용 → 테스트 → TypeScript → ESLint → Next.js 빌드 → `git diff --cached --check`가 통과하면 커밋·푸시합니다. 실패 시 이번에 적용한 파일만 원복하며 새 파일 스테이징도 정리합니다. `.env.local` 및 운영 DB는 자동으로 변경하지 않습니다.
