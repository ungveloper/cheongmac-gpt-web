import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { adminDb } from './supabase';
import { bucket } from './config';
import { ChatFileError, hasExpectedFileSignature, MAX_CHAT_FILE_BYTES, type ChatAttachment } from './chat-attachments';

const MAX_LEARNING_CHARS = 85000;
// Preserves the approved-file ownership check from loadChatFiles(); never accept a user-provided storage path.
export async function extractLearningPdfText(files: ChatAttachment[]): Promise<{context:string;totalPages:number}> {
  const chunks: string[] = [];
  let totalPages = 0;
  let totalChars = 0;
  for (const file of files) {
    if (file.content_type !== 'application/pdf') throw new ChatFileError('INVALID_PDF','PDF가 아닌 파일입니다.',400);
    const {data,error} = await adminDb().storage.from(bucket).download(file.storage_path);
    if (error || !data) throw new ChatFileError('PDF_UNAVAILABLE','첨부 PDF를 읽지 못했습니다.',410);
    const bytes = Buffer.from(await data.arrayBuffer());
    if (bytes.length !== file.byte_size || bytes.length > MAX_CHAT_FILE_BYTES || !hasExpectedFileSignature(bytes,file.content_type)) {
      throw new ChatFileError('PDF_INVALID','PDF 파일의 크기나 형식이 올바르지 않습니다.',422);
    }
    let result: {text:string;numpages:number};
    try { result = await pdfParse(bytes); }
    catch (error) {
      console.warn('learning PDF text extraction failed',{fileId:file.id,errorType:error instanceof Error?error.name:'unknown'});
      throw new ChatFileError('PDF_PARSE_FAILED','PDF 본문을 추출하지 못했습니다. 파일이 암호화되거나 손상되었는지 확인해 주세요.',422);
    }
    const text = result.text.replace(/\u0000/g,'').trim();
    if (text.length < 80) {
      throw new ChatFileError('PDF_NO_TEXT','문서에서 분석할 텍스트를 찾지 못했습니다. 이미지로 스캔한 PDF는 텍스트 PDF로 변환해 주세요.',422);
    }
    totalChars += text.length;
    if (totalChars > MAX_LEARNING_CHARS) {
      throw new ChatFileError('PDF_TOO_LONG','PDF 텍스트가 많아 한 번에 분석하기 어렵습니다. 문서를 나누거나 주제별로 학습해 주세요.',413);
    }
    totalPages += result.numpages;
    chunks.push(`\n[파일: ${file.original_name} | ${result.numpages}페이지 | 텍스트 추출본; 그림·로고·색상 정보는 별도 검토 필요]\n${text}\n[파일 끝]`);
  }
  return {context:chunks.join('\n'),totalPages};
}
