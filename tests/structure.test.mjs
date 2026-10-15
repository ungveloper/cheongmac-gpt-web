import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const load=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('Supabase SSR and service role are distinct',()=>{
 assert.match(load('lib/supabase.ts'),/createServerClient/);
 assert.match(load('lib/supabase.ts'),/persistSession: false/);
 assert.doesNotMatch(load('components/workspace.tsx'),/SUPABASE_SERVICE_ROLE_KEY/);
});
test('API enforces auth and scoped knowledge',()=>{
 for(const f of ['app/api/v1/chat/route.ts','app/api/v1/chat/stream/route.ts','app/api/v1/knowledge/export/route.ts'])assert.match(load(f),/authorize\(req\)/);
 assert.match(load('app/api/v1/knowledge/export/route.ts'),/allowedScopes\(actor.scope\)/);
 assert.match(load('app/api/v1/knowledge/changes/route.ts'),/previous_visibility/);
});
test('DB approval is guarded and atomic',()=>{
 const sql=load('supabase/migrations/202610150001_macgpt_initial.sql');
 assert.match(sql,/for update;/i);
 assert.match(sql,/current_row.current_version/);
 assert.match(sql,/revoke execute on function public.resolve_knowledge_proposal/);
 assert.match(sql,/row level security/);
});
test('Swagger and setup docs exist',()=>{
 for(const p of ['app/api-docs/page.tsx','app/api/openapi.json/route.ts','docs/SETUP.md','.env.example'])assert.ok(existsSync(new URL(`../${p}`,import.meta.url)));
});
