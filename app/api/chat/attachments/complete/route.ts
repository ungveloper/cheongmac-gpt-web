import { z } from 'zod';
import { requireMember } from '@/lib/auth';
import { adminDb } from '@/lib/supabase';
import { bucket } from '@/lib/config';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  const actor = await requireMember();
  if (!actor) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  const input = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!input.success) return Response.json({ error: 'BAD_REQUEST' }, { status: 400 });
  const db = adminDb();
  const { data: file } = await db.from('chat_attachments').select('*').eq('id', input.data.id)
    .eq('owner_id', actor.member.id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!file) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  const { data: stored, error } = await db.storage.from(bucket).info(file.storage_path);
  if (error || !stored || Number(stored.size) !== Number(file.byte_size)) {
    return Response.json({ error: 'UPLOAD_NOT_VERIFIED' }, { status: 409 });
  }
  const { error: updateError } = await db.from('chat_attachments').update({ status: 'uploaded' })
    .eq('id', file.id).eq('owner_id', actor.member.id);
  if (updateError) return Response.json({ error: 'SAVE_FAILED' }, { status: 503 });
  return Response.json({ id: file.id, name: file.original_name, size: file.byte_size, expires_at: file.expires_at });
}
