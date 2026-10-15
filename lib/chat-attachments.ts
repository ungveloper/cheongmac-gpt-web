import { z } from 'zod';
import { adminDb } from './supabase';
import { bucket } from './config';

// Temporary conversation context. NOT published knowledge or a permanent document archive.
export const MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_CHAT_FILES = 3;
export const MAX_CHAT_TOTAL_BYTES = 20 * 1024 * 1024;
export const CHAT_FILE_TTL_MINUTES = 120;

export const chatFileTypes: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  md: 'text/markdown',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};
export const idsSchema = z.array(z.string().uuid()).max(MAX_CHAT_FILES).refine(
  (ids) => new Set(ids).size === ids.length, 'Duplicate attachment IDs',
);
export const fileSignSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.string().trim(),
  size: z.number().int().min(1).max(MAX_CHAT_FILE_BYTES),
});

export function fileTypeFor(name: string, type: string): string | null {
  const extension = name.toLowerCase().split('.').at(-1) ?? '';
  const expected = chatFileTypes[extension];
  if (!expected) return null;
  // Browser-specific MIME may be blank, but a contradictory MIME is rejected.
  if (type && type !== expected && !(extension === 'md' && type === 'text/plain')) return null;
  return expected;
}

export function hasExpectedFileSignature(bytes: Buffer, type: string): boolean {
  if (type === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type.includes('officedocument.')) return bytes[0] === 0x50 && bytes[1] === 0x4b;
  return !bytes.includes(0); // text files should not contain embedded null bytes
}

export type ChatAttachment = {
  id: string;
  storage_path: string;
  original_name: string;
  content_type: string;
  byte_size: number;
};

export class ChatFileError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export async function loadChatFiles(ids: string[], memberId: string): Promise<ChatAttachment[]> {
  if (!ids.length) return [];
  const db = adminDb();
  const { data, error } = await db.from('chat_attachments')
    .select('id,storage_path,original_name,content_type,byte_size')
    .eq('owner_id', memberId)
    .eq('status', 'uploaded')
    .gt('expires_at', new Date().toISOString())
    .in('id', ids);
  if (error) throw new ChatFileError('ATTACHMENTS_UNAVAILABLE', '첨부파일 조회에 실패했습니다.', 503);
  if (!data || data.length !== ids.length) {
    throw new ChatFileError('ATTACHMENT_EXPIRED', '첨부파일이 만료됐거나 권한이 없습니다. 다시 첨부해 주세요.', 410);
  }
  const byId = new Map(data.map((file) => [file.id, file]));
  const ordered = ids.map((id) => byId.get(id)!);
  if (ordered.reduce((n, file) => n + file.byte_size, 0) > MAX_CHAT_TOTAL_BYTES) {
    throw new ChatFileError('ATTACHMENT_TOO_LARGE', '첨부파일 합계는 20MB 이하여야 합니다.', 413);
  }
  return ordered;
}

export async function makeFileParts(files: ChatAttachment[]) {
  const parts: Array<
    { type: 'input_file'; filename: string; file_data: string } |
    { type: 'input_image'; image_url: string; detail: 'low' }
  > = [];
  for (const file of files) {
    const { data, error } = await adminDb().storage.from(bucket).download(file.storage_path);
    if (error || !data) throw new ChatFileError('ATTACHMENT_MISSING', '첨부파일을 읽을 수 없습니다. 다시 첨부해 주세요.', 410);
    const bytes = Buffer.from(await data.arrayBuffer());
    if (bytes.length !== file.byte_size || bytes.length > MAX_CHAT_FILE_BYTES || !hasExpectedFileSignature(bytes, file.content_type)) {
      throw new ChatFileError('ATTACHMENT_INVALID', '첨부파일의 크기가 올바르지 않습니다.', 409);
    }
    const uri = `data:${file.content_type};base64,${bytes.toString('base64')}`;
    if (file.content_type.startsWith('image/')) {
      parts.push({ type: 'input_image', image_url: uri, detail: 'low' });
    } else {
      parts.push({ type: 'input_file', filename: file.original_name, file_data: uri });
    }
  }
  return parts;
}
