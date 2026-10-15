# MacGPT 채팅 및 지식 변경안 문제 해결

## 이번 변경

- 관리자라도 **일반 질문**은 `/api/v1/chat/stream`으로 바로 전달합니다.
- **명시적 지식 등록·수정·폐기 요청**은 `/api/admin/assist`로 전달합니다.
- 애매한 표현은 입력창 아래 **지식 변경 모드**를 켜고 전송할 수 있습니다.
- 응답 대기 중 `지식 검색 중 → 답변 작성 중` 단계와 스트리밍 문자가 표시됩니다.
- 오류가 발생하면 해당 대화에 오류 이유와 재입력 버튼이 표시됩니다.

## 문제를 확인하는 순서

1. 터미널에서 `npm run dev`를 실행해 둡니다.
2. `현재 등록된 지식은 무엇인가요?`를 입력합니다. 지식 분석 API가 아닌 일반 답변 경로로 연결됩니다.
3. 문제가 발생하면 브라우저 DevTools의 Network에서 `/api/v1/chat/stream` 응답 상태를 확인합니다.
4. 관리자 변경안을 검증할 때는 `새로운 원내 지식을 등록해줘. 제목: ... 내용: ...`처럼 명시적으로 요청합니다.
5. 변경안 분석 실패 시 개발 서버의 `admin assist AI failure` (OpenAI API) 또는 `admin assist search failure` (Supabase DB)를 확인합니다.

### 메시지별 원인

| 코드 | 가능한 원인 | 조치 |
| --- | --- | --- |
| `OPENAI_AUTH_FAILED` | OpenAI API 키 인증 실패 | `.env.local`의 키 검증 후 서버 재시작 |
| `OPENAI_QUOTA` | API 사용 잔액 부족·한도 초과 | OpenAI API 플랫폼의 Billing·Limits 확인 |
| `OPENAI_RATE_LIMIT` | 요청 제한 | 잠시 후 재시도 |
| `OPENAI_MODEL_UNAVAILABLE` | 잘못된 모델명·접근 불가 | `OPENAI_ADMIN_MODEL` 및 사용 가능한 모델 확인 |
| `KNOWLEDGE_SEARCH_FAILED` | Supabase RPC 또는 권한 실패 | DB 검색 함수·service role 권한 확인 |
| `PROPOSAL_SAVE_FAILED` | 지식 변경안 DB 저장 실패 | 테이블 권한·오류 로그 확인 |
| `SEARCH_UNAVAILABLE` | 질문 답변용 지식 검색 실패 | Supabase 연결·검색 함수 확인 |
| `AI_UNAVAILABLE` | 그 외 OpenAI/네트워크 오류 | 터미널 로그 확인 |

> **보안:** OpenAI API 키, Supabase secret/service_role 키, 실제 환자·직원 정보는 로그 캡처로 공유하지 마세요.
>
> 이 수정은 UI와 오류 처리를 개선합니다. OpenAI 결제, API 키, 모델 접근 제한이 실제 원인인 경우에는 해당 외부 설정이 별도로 해결되어야 합니다.
