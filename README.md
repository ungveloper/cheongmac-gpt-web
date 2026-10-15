# MacGPT · 청맥병원 AI 지식 플랫폼

Next.js App Router · Supabase Auth/Database/Storage · OpenAI API · Swagger(OpenAPI 3.1)

**본 저장소는 코드이며 병원 운영 환경은 별도로 구성해야 합니다.** Supabase 프로젝트, Google OAuth, OpenAI 키를 연결하지 않으면 AI 답변은 동작하지 않습니다.

## 시작하기

1. `docs/SETUP.md`의 지침에 따라 Supabase 프로젝트를 생성하고 SQL 마이그레이션을 실행합니다.
2. `cp .env.example .env.local` 후 비밀값을 설정합니다. `.env.local`은 절대 Git에 올리지 마세요.
3. `npm install && npm run dev` 실행 후 `/login`에서 Google로 로그인합니다.
4. Supabase SQL Editor에서 검증된 계정을 `super_admin`으로 수동 승인합니다.
5. 관리자 채팅으로 새 지식을 입력하고, 변경 카드를 승인한 뒤 질의응답을 테스트합니다.
6. 최종관리자 API 관리 페이지에서 공개 앱 키를 발급하고 **홈페이지 서버**에만 보관합니다.
7. 관리자 페이지 `/api-docs`에서 Swagger를 확인합니다.

## 구현 범위

- Google OAuth 및 최종관리자 회원 승인·권한 변경, 비활성화 검증
- 공개 / 원내 / 제한 지식의 승인형 등록·수정·폐기 및 버전 이력
- 자연어 관리자 변경 제안, 유사 지식 후보, 관리자 승인 후 즉시 게시
- Supabase pgvector + 키워드 기반 검색과 접근 수준 필터
- 대화형 직원 UI (현재 탭 내 대화 유지), JSON 및 SSE 질문 API
- 등록 지식 JSON 페이지 내보내기 및 변경 커서 동기화
- Supabase Storage 관리자 원본 업로드, 승인 지식에 연결한 파일 다운로드
- 앱별 API 키 발급·비활성화, 호출량 제한, Swagger API 문서

## v1 첫 패치에서 아직 구현하지 않은 항목

- PDF/Word/Excel 본문 자동 추출 및 지식 제안 자동 변환 (원본 저장만 가능)
- 직원 대화의 장기 저장·과거 검색·직원 공지 필독 확인
- 첨부파일 버전관리·악성 파일 검사·다운로드 완전 감사, 데이터 백업 자동화
- 원내 지식 외부 앱 전용 독립 사용자 세션 위임, 정교한 고객사별 예산 설정
- 고가용성 큐/비동기 인덱싱 및 의료 전문 인력의 실데이터 검증

이 기능들은 출시 전 추가 단계에서 보완해야 합니다. **임상 서비스에 바로 공개하지 말고 내부 테스트부터 수행하세요.**

## 구조

- `app/` 직원용 채팅·관리 및 REST API·Swagger
- `lib/` Supabase, Auth, OpenAI, 권한, 검색
- `supabase/migrations/` DB 및 검색 SQL
- `docs/SETUP.md` 필수 외부 서비스 설정 및 보안 검증 안내

## 보안 원칙

Supabase `service_role`과 OpenAI 키는 오직 서버 환경변수에만 넣습니다. 외부 홈페이지에서는 앱 비밀키를 브라우저에 전달하지 않고 자체 백엔드에서 MacGPT API를 프록시해야 합니다. 공개 저장소이므로 `.env.local` 및 실제 병원 지식/환자 데이터를 커밋하지 마세요.
