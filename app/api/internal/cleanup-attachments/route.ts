import { timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/supabase';
import { bucket } from '@/lib/config';
export const runtime = 'nodejs';
// Set CRON_SECRET in Vercel; this endpoint must never be accessible without it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const actual = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!secret || actual.length !== secret.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(secret))) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const db = adminDb();
  const { data, error } = await db.from('chat_attachments').select('id,storage_path')
    .lte('expires_at', new Date().toISOString()).order('expires_at').limit(100);
  if (error) return Response.json({ error: 'LOOKUP_FAILED' }, { status: 503 });
  if (!data?.length) return Response.json({ removed: 0 });
  const files = await db.storage.from(bucket).remove(data.map(f => f.storage_path));
  if (files.error) return Response.json({ error: 'STORAGE_CLEANUP_FAILED' }, { status: 503 });
  const { error: removed } = await db.from('chat_attachments').delete().in('id', data.map(f => f.id));
  if (removed) return Response.json({ error: 'METADATA_CLEANUP_FAILED' }, { status: 503 });
  return Response.json({ removed: data.length });
}
