# MacGPT 회원 승인 및 Swagger 수정 (2026-10-15)

## 회원 관리

- 최종관리자 전용 화면 위쪽에 `승인 요청` 대기 회원 목록을 별도 표시합니다.
- 하단 `전체 회원`은 대기 회원을 포함해 검색(이름·이메일), 정렬, 10명 단위 페이지 조회를 지원합니다.
- 조회는 DB 서버에서 수행합니다. 회원 수가 500명을 넘어도 이전 구현의 500명 제한으로 누락되지 않습니다.
- 회원 상태 뱃지: 대기(황색), 승인(초록색), 정지(빨간색).
- 사이드바 `승인 대기`는 지식 변경안 중 `status='pending'`, `회원 관리`는 `approved=false AND active=true`인 계정 수를 표시합니다.
- 계정 수는 로그인 시, 해당 메뉴 진입 시, 승인 처리 후, 브라우저 재활성화 시 및 활성 화면에서 1분마다 갱신됩니다.
- 일반 직원은 관리 API에 접근할 수 없으며, 회원 목록·회원 승인 건수는 최종관리자에게만 제공됩니다.

## Swagger

- Next.js 16 Turbopack과 `swagger-ui-react`의 ESM 의존성 충돌을 피하기 위해 `swagger-ui-dist@5.33.0`의 독립 브라우저 번들을 사용합니다.
- `npm install`(또는 `npm ci`)의 postinstall 단계에서 `/public/vendor/swagger/`에 두 개의 정적 파일을 복사합니다.
- 정적 파일은 Git으로 관리하지 않습니다. Vercel도 의존성 설치 시 동일한 postinstall을 실행해야 합니다.
- Swagger UI 진입점은 기존 `/api-docs`, 명세는 기존의 관리자 인증이 필요한 `/api/openapi.json`입니다.
- Script는 CDN에 의존하지 않습니다. 이 변경은 API 인증 정책이나 API 명세를 수정하지 않습니다.
- `/api-docs`가 빈 화면이라면 브라우저 개발자 도구 Network에서 `/vendor/swagger/swagger-ui-bundle.js`, `/vendor/swagger/swagger-ui.css`, `/api/openapi.json`의 상태를 확인합니다.

## 검증 순서

1. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
2. 최종관리자 계정 로그인 후 회원 관리에서 대기 1명 승인.
3. `회원 관리` 대기 숫자 및 상단 대기 목록이 감소하는지 확인.
4. 지식 변경안 생성·승인 후 `승인 대기` 카운트가 감소하는지 확인.
5. 사용자 11명 이상으로 테스트 시 페이지 1·2 이동, 이름 검색, 이메일 검색 및 가입일 정렬을 점검.
6. `/api-docs`에서 OpenAPI 3.1 명세가 정상 표시되는지 확인.

의료기관 운영 전에는 계정·역할·비활성화 관련 접근 제어 통합 테스트가 별도로 필요합니다.
