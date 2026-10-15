# MacGPT v1.0 최초 배포 준비

## 1. Supabase 독립 프로젝트 생성

청맥병원 용도로 Supabase 프로젝트를 하나 생성합니다. 다른 고객사는 프로젝트·Auth·Storage·API 키·Vercel 배포를 따로 생성합니다. PostgreSQL 리전은 가능한 한국 리전을 선택합니다.

SQL Editor에서 `supabase/migrations/202610150001_macgpt_initial.sql`을 실행합니다. 아직 기존 데이터가 없는 신규 프로젝트를 전제로 합니다. `extensions` 스키마 및 vector/pg_trgm 확장 사용 권한을 확인합니다.

Storage 메뉴에서 **비공개** Bucket 이름 `macgpt-documents`를 생성하고 최대 파일 크기를 50MB로 지정합니다. Public Bucket으로 만들면 안 됩니다. 파일 업로드 토큰은 서버가 발급합니다.

## 2. Google 로그인

Supabase Auth → Providers → Google을 활성화합니다. Google Cloud에서 Web OAuth Client ID와 Secret을 생성해 Supabase에 등록합니다. Google OAuth 리디렉션 URI는 Supabase가 제공하는 callback URL을 사용합니다. Supabase Auth URL Configuration에 로컬과 배포 도메인의 `/auth/callback`을 허용합니다. 도메인 설정이 완료되기 전에는 외부에 서비스를 공개하지 마세요.

## 3. Vercel / 환경변수

`.env.example`을 `.env.local`에 복사해 각 항목을 설정합니다. Vercel에는 환경별 비밀값을 **서버 환경변수로만** 설정합니다. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`에 `NEXT_PUBLIC_`을 붙이지 않습니다. Supabase URL과 publishable/anon key는 브라우저에서 사용 가능합니다.

배포 환경별 (development/staging/production) DB를 분리합니다. SQL 마이그레이션 후 `npm run lint`, `npm run typecheck`, `npm run build`를 통과시켜야 합니다.

## 4. 최초 최종관리자 (필수)

`/login`에서 최종관리자로 사용할 Google 계정으로 한 번 로그인합니다. 처음에는 '승인 대기'가 정상입니다. Supabase SQL Editor에서 본인 확인을 한 후 **정확한 이메일을 대입**하여 다음 SQL을 1회 실행합니다.

```sql
update public.members
set approved = true, role = 'super_admin', active = true
where id = (select id from auth.users where email = '본인이_검증한_Google_이메일');
```

이 작업에 API 엔드포인트를 만들지 않습니다. 이후 직원들은 최종관리자가 앱의 회원 관리 화면에서 승인합니다. 최초 최종관리자 변경 이력은 수동 계정 발급 내역으로 별도 보관해야 합니다.

## 5. 최초 지식 등록과 파일

관리자로 로그인해 채팅창에 '새 규정: ... 내용을 원내 지식으로 등록해줘'라고 입력합니다. 변경안을 확인하고 명시적으로 승인합니다. 승인된 지식만 검색됩니다. 원본 파일은 파일 보관함에 업로드하고 지식 항목 ID로 연결해야 다운로드할 수 있습니다. PDF/DOCX/XLSX 자동 텍스트 추출은 아직 구현되지 않았습니다.

## 6. 병원 홈페이지 연동

최종관리자 API 화면에서 `public` 앱 키를 발급합니다. 이 키는 **홈페이지 서버의 환경변수**에만 저장합니다. 홈페이지 브라우저에서는 서버측 프록시로 요청해야 하며, 키를 자바스크립트 번들에 포함하면 안 됩니다.

홈페이지 서버에서 다음과 같은 요청을 MacGPT로 보냅니다:

```bash
curl -N -X POST 'https://YOUR_MACGPT_HOST/api/v1/chat/stream' \
  -H 'Content-Type: application/json' \
  -H 'x-macgpt-key: macgpt_REPLACE_WITH_SERVER_SECRET' \
  -d '{"message":"병원 진료시간이 어떻게 되나요?","history":[]}'
```

SSE 이벤트는 `sources`, `delta`, `done`, `error`를 지원합니다. 운영 Swagger UI는 관리자 인증 시 `/api-docs`에서 열립니다. 일반 홈페이지에서는 Swagger와 관리자 API를 직접 호출하지 않습니다.

## 7. 보안 점검 (운영 공개 전 필수)

- 공개 API로 원내·제한 지식 조회를 시도하여 거부되는지 확인합니다.
- 승인하지 않은 계정의 직원 API 조회가 거부되는지 확인합니다.
- 활성 중인 계정을 정지한 뒤 기존 브라우저에서 내부 API를 다시 호출해 차단되는지 확인합니다.
- 지식 신규/수정/폐기 시 승인 전까지 구버전이 유지되고 승인 후에만 최신 버전으로 답변되는지 검증합니다.
- 원본 파일 접근 권한, 60초 만료 다운로드 URL, 백업·복구 정책을 시험합니다.
- 증분 동기화 시 제한 지식 이벤트가 공개 앱에 노출되지 않으며, 공개에서 비공개로 변경 시 기존 캐시를 폐기할 수 있는지 확인합니다.
- 실제 보험 및 의학 정보는 담당자의 검증을 거쳐 공개합니다.

## 운영상 유의사항

- Supabase 세션 로그아웃만으로 발행된 액세스 토큰이 즉시 만료되는 것은 아닙니다. MacGPT 내부 API는 요청마다 DB의 활성·승인 상태를 추가 검사합니다.
- 서비스 롤은 RLS를 우회할 수 있으므로 모든 `adminDb()` 사용 시 서버 권한 필터가 필수입니다.
- SSE는 문서에 이벤트 규격만 제공하며 Swagger UI가 스트리밍 조각을 실시간으로 표시하는 테스트 도구는 아닙니다.
- API 호출 제한은 현재 앱별 30회/분, 직원별 60회/분의 DB 기반 제한이며 실제 운영 트래픽 시험 후 조정합니다.
- Storage 파일·Auth·PostgreSQL은 별도의 백업 및 복구 정책이 필요합니다.
- 현재 코드는 MVP 초기 패치입니다. 의료기관의 개인정보·정보보호 정책 확인과 실데이터 테스트 전 외부 공개하지 마세요.
