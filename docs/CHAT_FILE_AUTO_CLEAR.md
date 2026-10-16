# MacGPT 메시지 전송 후 첨부파일 자동 정리

현재 GitHub main `cff0ef9f791f7cb2e8aad14465c70a951ad7d54b`의 `components/workspace.tsx`를 기준으로 한 단일 기능 개선 패치입니다.

- AI 답변 스트림이 `done`으로 완료된 후, 전송한 임시 첨부파일을 입력창에서 제거하고 `/api/chat/attachments/delete`로 Supabase 임시 파일까지 삭제 요청합니다.
- 관리자 학습 변경안이 정상 생성된 때도 동일하게 정리합니다. **공식 지식 및 승인 요청 기록은 삭제하지 않습니다.**
- 응답/업로드/학습 실패 때에는 첨부파일을 유지해 재시도할 수 있습니다.
- 사용자 메시지에 표시한 파일 이름은 대화 기록에 계속 표시합니다. 파일 바이너리 데이터는 기록으로 보관하지 않습니다.
- 이번 변경에는 신규 npm 패키지 또는 Supabase SQL 실행이 필요하지 않습니다.

## 설치

ZIP을 ~/Downloads 에 저장한 뒤:

```bash
unzip -o ~/Downloads/cheongmac-gpt-chat-file-auto-clear-20261016.zip -d ~/Downloads && bash ~/Downloads/cheongmac-gpt-chat-file-auto-clear-20261016/apply.command
```

프로젝트가 실행 중이면 Ctrl+C 로 개발 서버를 종료한 후 적용하세요. 검증 통과 시에만 commit/push 합니다.

## 확인

1. `/chat`에서 PDF를 첨부하고 질문합니다.
2. 응답이 완료되면 입력창에 PDF 칩이 사라졌는지 확인합니다.
3. 직전 사용자 메시지에는 파일명 칩이 남아 있어야 합니다.
4. 새 메시지를 파일 없이 보내 정상 응답되는지 확인합니다.
5. 학습 모드 ON에서 변경안 생성 후에도 입력창 칩이 사라지는지 확인합니다.
