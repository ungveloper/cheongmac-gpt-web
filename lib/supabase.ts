import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getServerConfig, getSupabaseConfig } from './config';

export async function sessionDb() {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch { /* During server-component rendering, cookie refresh is read-only. */ }
      },
    },
  });
}

export function adminDb() {
  const cfg = getServerConfig();
  if (!cfg) throw new Error('Supabase server configuration missing');
  return createClient(cfg.url, cfg.service, { auth: { persistSession: false, autoRefreshToken: false } });
}
