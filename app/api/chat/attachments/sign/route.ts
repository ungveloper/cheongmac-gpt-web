import { randomUUID } from 'node:crypto';
import { requireMember } from '@/lib/auth';
import { adminDb } from '@/lib/supabase';
import { bucket } from '@/lib/config';
import { CHAT_FILE_TTL_MINUTES, fileSignSchema, fileTypeFor } from '@/lib/chat-attachments';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  const identity = await requireMember();
  if (!identity) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  const result = fileSignSchema.safeParse(await req.json().catch(() => null));
  if (!result.success) return Response.json({ error: 'INVALID_FILE', message: '파일당 최대 10MB입니다.' }, { status: 400 });
  const { name, size, type } = result.data;
  const contentType = fileTypeFor(name, type);
  if (!contentType) return Response.json({ error: 'UNSUPPORTED_FILE', message: '지원하지 않는 첨부파일 형식입니다.' }, { status: 400 });
  const db = adminDb();
  const { count, error: countError } = await db.from('chat_attachments')
    .select('id', { head: true, count: 'exact' }).eq('owner_id', identity.member.id)
    .eq('status', 'pending').gt('expires_at', new Date().toISOString());
  if (countError) return Response.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 });
  if ((count ?? 0) >= 10) return Response.json({ error: 'PENDING_LIMIT', message: '완료되지 않은 업로드가 너무 많습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
  const path = `chat/${identity.member.id}/${randomUUID()}`;
  const expires = new Date(Date.now() + CHAT_FILE_TTL_MINUTES * 60_000).toISOString();
  const { data, error } = await db.from('chat_attachments').insert({
    owner_id: identity.member.id, storage_path: path, original_name: name, content_type: contentType,
    byte_size: size, expires_at: expires,
  }).select('id').single();
  if (error || !data) return Response.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 });
  const signed = await db.storage.from(bucket).createSignedUploadUrl(path);
  if (signed.error || !signed.data) {
    await db.from('chat_attachments').delete().eq('id', data.id);
    return Response.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 });
  }
  return Response.json({ id: data.id, path, token: signed.data.token, bucket, contentType, expires_at: expires }, { headers: { 'Cache-Control': 'no-store' } });
}
