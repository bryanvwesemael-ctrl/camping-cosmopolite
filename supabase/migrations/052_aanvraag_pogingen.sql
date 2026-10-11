-- Hercontrole 2026-10-11, punt 3: teller voor de server-side rate limiting
-- van de create-booking edge function. Bewaart enkel HMAC-hashes van IP en
-- e-mail (geen ruwe persoonsgegevens) en de functie ruimt rijen ouder dan
-- 2 dagen zelf op. RLS aan zonder policies + geen grants: enkel service_role
-- (de edge function) kan erbij.
create table if not exists public.aanvraag_pogingen (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  email_hash  text not null,
  created_at  timestamptz not null default now()
);
create index if not exists aanvraag_pogingen_ip_idx    on public.aanvraag_pogingen (ip_hash, created_at);
create index if not exists aanvraag_pogingen_email_idx on public.aanvraag_pogingen (email_hash, created_at);
create index if not exists aanvraag_pogingen_tijd_idx  on public.aanvraag_pogingen (created_at);

alter table public.aanvraag_pogingen enable row level security;
revoke all on table public.aanvraag_pogingen from anon, authenticated;
