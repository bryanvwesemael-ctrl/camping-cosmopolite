-- ============================================================
-- Camping Cosmopolite — Supabase initiële schema
-- Voer dit uit in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. CLIENTS
create table if not exists clients (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  naam             text not null,
  email            text not null,
  telefoon         text,
  id_nummer        text,
  nummerplaten     text,
  geboortedatum    date,
  nationaliteit    text,
  woonplaats       text,
  id_foto_url      text
);

-- 2. BOOKINGS
create sequence if not exists bookings_volgnummer_seq start 1001;

create table if not exists bookings (
  id               uuid primary key default gen_random_uuid(),
  volgnummer       bigint not null default nextval('bookings_volgnummer_seq'),
  created_at       timestamptz not null default now(),
  client_id        uuid not null references clients(id),
  aankomst         date not null,
  vertrek          date not null,
  tenten           int not null default 0,
  campers          int not null default 0,
  volwassenen      int not null default 1,
  kinderen         int not null default 0,
  baby             int not null default 0,
  honden           int not null default 0,
  autos            int not null default 1,
  elektriciteit    boolean not null default false,
  bedrag_per_nacht numeric(8,2),
  bedrag_totaal    numeric(8,2),
  bedrag_betaald   numeric(8,2) not null default 0,
  ogm_referentie   text,
  nota             text,
  bron             text not null default 'website',
  status           text not null default 'aanvraag'
    check (status in ('aanvraag','bevestigd','aanwezig','vertrokken','geannuleerd'))
);

create unique index if not exists bookings_volgnummer_idx on bookings(volgnummer);

-- 3. COMMUNICATIE
create table if not exists communicatie (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  booking_id       uuid references bookings(id),
  richting         text not null check (richting in ('inkomend','uitgaand')),
  status           text not null default 'concept' check (status in ('concept','verzonden','ontvangen')),
  template_key     text,
  onderwerp        text,
  inhoud           text
);

-- 4. STORAGE BUCKET voor ID-foto's
insert into storage.buckets (id, name, public)
values ('id-fotos', 'id-fotos', false)
on conflict (id) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table clients enable row level security;
alter table bookings enable row level security;
alter table communicatie enable row level security;

-- Anonieme bezoekers: enkel INSERT op clients en bookings (reservatieformulier)
create policy "anon_insert_clients" on clients
  for insert to anon with check (true);

create policy "anon_insert_bookings" on bookings
  for insert to anon with check (true);

create policy "anon_insert_communicatie" on communicatie
  for insert to anon with check (true);

create policy "anon_update_clients_foto" on clients
  for update to anon using (true) with check (true);

create policy "anon_update_bookings_ogm" on bookings
  for update to anon using (true) with check (true);

-- Ingelogde gebruikers (dashboard): volledige toegang
create policy "auth_all_clients" on clients
  for all to authenticated using (true) with check (true);

create policy "auth_all_bookings" on bookings
  for all to authenticated using (true) with check (true);

create policy "auth_all_communicatie" on communicatie
  for all to authenticated using (true) with check (true);

-- Storage: alleen ingelogd lezen, anon mag uploaden
create policy "anon_upload_id_fotos" on storage.objects
  for insert to anon with check (bucket_id = 'id-fotos');

create policy "auth_read_id_fotos" on storage.objects
  for select to authenticated using (bucket_id = 'id-fotos');
