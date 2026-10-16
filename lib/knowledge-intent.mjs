/**
 * Client-side routing hint; never grants permission or performs an edit by itself.
 * Explicit learning requests on attached files must reach the guarded admin proposal API.
 */
export function isKnowledgeChangeRequest(message) {
  const text = message.trim();
  if (!text) return false;
  const target = /(지식|원내|사내|규정|정책|매뉴얼|문서|공지|안내|보험|청구|진료시간|진료비|업무|운영|브랜드북|브랜드|파일|첨부|자료|가이드)/;
  const action = /(등록|추가|생성|수정|정정|고쳐|변경|업데이트|갱신|삭제|폐기|비활성화|복구|복원|학습|익혀|기억|반영)/;
  const request = /(해\s*줘|해\s*주세요|해\s*주실|해\s*보자|하고\s*싶|해달라|하자|처리해|반영해|바꿔\s*줘|부탁|하려고|해\s*줄|해\s*볼|시켜\s*줘|시켜\s*주세요)/;
  return target.test(text) && action.test(text) && request.test(text);
}
