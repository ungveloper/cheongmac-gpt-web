/**
 * Conservative client-side routing hint. The server still validates all edits;
 * only an explicit operator request can enter the proposal workflow.
 * A manual edit-mode button is available for ambiguous wording.
 */
export function isKnowledgeChangeRequest(message) {
  const text = message.trim();
  if (!text) return false;
  const target = /(지식|원내|사내|규정|정책|매뉴얼|문서|공지|안내|보험|청구|진료시간|진료비|업무|운영)/;
  const action = /(등록|추가|생성|수정|정정|고쳐|변경|업데이트|갱신|삭제|폐기|비활성화|복구|복원)/;
  const request = /(해\s*줘|해\s*주세요|해\s*주실|해\s*보자|하고\s*싶|해달라|하자|처리해|반영해|바꿔\s*줘|부탁|하려고|해\s*줄|해\s*볼)/;
  // "등록된 지식이 무엇인가요?" is a query, not an edit request.
  return target.test(text) && action.test(text) && request.test(text);
}
