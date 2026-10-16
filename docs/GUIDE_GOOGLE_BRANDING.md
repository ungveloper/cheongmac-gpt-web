# Google OAuth 이름과 인증 도메인

- Google Cloud Console → Google Auth Platform → Branding에서 `MacGPT` 앱 이름, 지원 이메일, 홈페이지, 개인정보처리방침을 검토합니다. 외부 공개 앱의 이름/로고를 신뢰 가능하게 표시하려면 Google 브랜드 인증이 필요할 수 있습니다.
- Google에서 보낸 계정 접근 알림의 임의 `*.supabase.co` 주소는 Supabase 프로젝트 기본 인증 도메인입니다. 앱 이름을 바꾸는 것만으로 반드시 바뀌지 않습니다.
- 도메인 자체를 병원 브랜드로 표시하려면 Supabase의 유료 Custom Domains 기능을 검토합니다. 변경 시 OAuth 클라이언트의 redirect URI, Supabase 프로젝트 도메인 설정, 앱 환경변수를 함께 업데이트해야 합니다.
- 작동하는 로컬 인증 URL/키를 임의로 변경하지 마세요. 운영 도메인을 정한 후 단계적으로 전환하고, 사전 테스트가 필요합니다.

참고: https://supabase.com/docs/guides/platform/custom-domains 및 https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
