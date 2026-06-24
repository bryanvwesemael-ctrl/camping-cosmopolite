-- Gmail integratie tokens per authenticated user
create table if not exists integrations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null default 'gmail',
  email         text,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(user_id, provider)
);

alter table integrations enable row level security;

create policy "owner_all_integrations" on integrations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Voeg gmail_message_id toe aan communicatie om duplicaten te vermijden
alter table communicatie
  add column if not exists gmail_message_id text unique,
  add column if not exists gmail_thread_id  text;
