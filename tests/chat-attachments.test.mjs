import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Chat attachment database is scoped, private and time-limited', () => {
  const sql = file('supabase/migrations/202610150002_chat_attachments.sql');
  assert.match(sql, /owner_id uuid not null/);
  assert.match(sql, /row level security/);
  assert.match(sql, /revoke all .* anon, authenticated/);
  assert.match(sql, /expires_at timestamptz not null/);
});
test('Chat endpoints require approved staff and verify upload', () => {
  for (const route of ['sign', 'complete', 'delete']) assert.match(file(`app/api/chat/attachments/${route}/route.ts`), /requireMember\(/);
  assert.match(file('app/api/chat/attachments/complete/route.ts'), /\.info\(file.storage_path\)/);
  assert.match(file('app/api/chat/attachments/delete/route.ts'), /\.eq\('owner_id', actor.member.id\)/);
});
test('Public API cannot use chat attachments', () => {
  const stream = file('app/api/v1/chat/stream/route.ts');
  assert.match(stream, /!actor.member \|\| actor.clientId/);
  assert.match(stream, /loadChatFiles\(input.attachments, actor.member!.id\)/);
  assert.match(stream, /store: false/);
  assert.match(file('app/api/v1/chat/route.ts'), /ATTACHMENTS_STREAM_ONLY/);
});
test('File format handling is limited and per-object size checked', () => {
  const files = file('lib/chat-attachments.ts');
  assert.match(files, /MAX_CHAT_FILE_BYTES = 10 \* 1024 \* 1024/);
  assert.match(files, /MAX_CHAT_TOTAL_BYTES = 20 \* 1024 \* 1024/);
  assert.match(files, /\.eq\('owner_id', memberId\)/);
  assert.match(files, /type: 'input_file'/);
  assert.match(files, /type: 'input_image'/);
});
test('Typing feedback uses unobtrusive dots; file chip can be removed', () => {
  const ui = file('components/workspace.tsx');
  assert.match(ui, /chat-typing/);
  assert.doesNotMatch(ui, /\{phaseLabel\[phase\]\}<\/span>/);
  assert.match(ui, /removeChatFile/);
  assert.match(ui, /uploadChatFiles/);
  assert.match(ui, /fileInput\.current\?\.click\(\)/);
});
test('Temporary files have a scheduled and authenticated cleanup', () => {
  assert.match(file('vercel.json'), /cleanup-attachments/);
  const route=file('app/api/internal/cleanup-attachments/route.ts');
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /\.remove\(/);
});
