-- MacGPT 2026-10-15. Run ONCE after 202610150001_macgpt_initial.sql.
-- Temporary, employee-owned chat attachments, independent of approved knowledge and source_files.
create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.members(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  status text not null default 'pending' check (status in ('pending','uploaded')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists chat_attachments_owner_expiry on public.chat_attachments(owner_id, expires_at);
create index if not exists chat_attachments_expiry on public.chat_attachments(expires_at);
alter table public.chat_attachments enable row level security;
-- Service-role access only. Employees reach files through permission-checked MacGPT API routes.
revoke all on public.chat_attachments from anon, authenticated;
grant select,insert,update,delete on public.chat_attachments to service_role;
