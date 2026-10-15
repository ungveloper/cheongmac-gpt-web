export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('YOUR_PROJECT')) return null;
  return { url, key };
}
export function getServerConfig() {
  const pub = getSupabaseConfig();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pub || !service || service.startsWith('YOUR_')) return null;
  return { ...pub, service };
}
export const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'macgpt-documents';
export function isConfigured() {
  return Boolean(getServerConfig() && process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('YOUR_'));
}
