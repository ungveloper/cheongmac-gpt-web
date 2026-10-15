import { requireMember } from '@/lib/auth';
import { adminDb } from '@/lib/supabase';
import { bucket } from '@/lib/config';
import { idsSchema } from '@/lib/chat-attachments';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  const actor = await requireMember();
  if (!actor) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  const input = idsSchema.safeParse((await req.json().catch(() => null))?.ids);
  if (!input.success) return Response.json({ error: 'BAD_REQUEST' }, { status: 400 });
  const db = adminDb();
  const { data, error } = await db.from('chat_attachments').select('id,storage_path')
    .eq('owner_id', actor.member.id).in('id', input.data);
  if (error) return Response.json({ error: 'DELETE_FAILED' }, { status: 503 });
  if (!data?.length) return Response.json({ deleted: 0 });
  const removed = await db.storage.from(bucket).remove(data.map(f => f.storage_path));
  if (removed.error) return Response.json({ error: 'DELETE_FAILED' }, { status: 503 });
  const { error: deleteError } = await db.from('chat_attachments').delete()
    .eq('owner_id', actor.member.id).in('id', data.map(f => f.id));
  if (deleteError) return Response.json({ error: 'DELETE_FAILED' }, { status: 503 });
  return Response.json({ deleted: data.length });
}
