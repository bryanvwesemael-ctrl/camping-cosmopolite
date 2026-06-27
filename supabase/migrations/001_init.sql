-- ============================================================
-- Camping Cosmopolite — Volledig schema (bron van waarheid)
-- Reproduceert de productie-database voor een nieuwe installatie.
-- Voer uit in: Supabase Dashboard > SQL Editor (of via CLI migraties)
--
-- Model: ÉÉN Supabase-project per camping (single-tenant).
-- Alle ingelogde medewerkers van die camping delen dezelfde data.
-- Voor een multi-tenant SaaS is een org_id-herwerk nodig (zie README).
-- ============================================================

-- ---------- ENUM TYPES ----------
do $$ begin
  create type booking_status as enum ('aanvraag','bevestigd','ingecheckt','betaald','geannuleerd','wachtlijst');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_bron as enum ('website','mail','telefoon');
exception when duplicate_object then null; end $$;

do $$ begin
  create type comm_richting as enum ('inkomend','uitgaand');
exception when duplicate_object then null; end $$;

do $$ begin
  create type comm_status as enum ('concept','verzonden','mislukt');
exception when duplicate_object then null; end $$;

-- ---------- 1. CLIENTS ----------
create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  naam          text not null,
  email         text not null,
  telefoon      text,
  id_nummer     text,
  id_foto_url   text,
  geboortedatum date,
  nationaliteit text,
  woonplaats    text,
  nummerplaten  text,
  created_at    timestamptz not null default now()
);

-- ---------- 2. BOOKINGS ----------
create sequence if not exists bookings_volgnummer_seq start 1001;

create table if not exists bookings (
  id               uuid primary key default gen_random_uuid(),
  volgnummer       int not null default nextval('bookings_volgnummer_seq'),
  client_id        uuid not null references clients(id),
  aankomst         date not null,
  vertrek          date not null,
  tenten           int not null default 0,
  campers          int not null default 0,
  verblijfstype    text,
  extra_type_units jsonb,
  volwassenen      int not null default 1,
  kinderen         int not null default 0,
  baby             int not null default 0,
  honden           int not null default 0,
  autos            int not null default 1,
  elektriciteit    boolean not null default false,
  status           booking_status not null default 'aanvraag',
  bron             booking_bron not null default 'website',
  bedrag_per_nacht numeric,
  bedrag_totaal    numeric,
  ogm_referentie   text,
  nota             text,
  checkin_token    text,
  ingecheckt_at    timestamptz,
  controle_id       boolean not null default false,
  controle_kenteken boolean not null default false,
  controle_personen boolean not null default false,
  created_at       timestamptz not null default now()
);
create unique index if not exists bookings_volgnummer_idx on bookings(volgnummer);

-- ---------- 3. GASTEN (wettelijk reizigersregister KB 27/04/2007) ----------
create table if not exists gasten (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references bookings(id),
  naam          text not null,
  geboortedatum date,
  nationaliteit text,
  id_nummer     text,
  nummerplaat   text,
  foto_url      text,
  is_hoofdgast  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------- 4. COMMUNICATIE ----------
create table if not exists communicatie (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid references bookings(id),
  richting         comm_richting not null default 'uitgaand',
  status           comm_status not null default 'concept',
  onderwerp        text,
  inhoud           text,
  template_key     text,
  verzonden_at     timestamptz,
  gmail_message_id text unique,
  gmail_thread_id  text,
  created_at       timestamptz not null default now()
);

-- ---------- 5. PAYMENTS (Mollie) ----------
create table if not exists payments (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid references bookings(id),
  mollie_id    text unique,
  bedrag       numeric not null,
  status       text not null default 'open',
  checkout_url text,
  betaald_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------- 6. BOOKING_FOTOS ----------
create table if not exists booking_fotos (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id),
  url        text not null,
  label      text,
  created_at timestamptz not null default now()
);

-- ---------- 7. SETTINGS (per medewerker/gebruiker) ----------
create table if not exists settings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id),
  key        text not null,
  value      text,
  updated_at timestamptz not null default now(),
  unique(user_id, key)
);

-- ---------- 8. USER_ROLES ----------
create table if not exists user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id),
  role       text not null default 'staff',
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- 9. ANALYTICS_EVENTS ----------
create table if not exists analytics_events (
  id         uuid primary key default gen_random_uuid(),
  event      text not null,
  session_id text,
  data       jsonb,
  created_at timestamptz not null default now()
);

-- ---------- 10. INTEGRATIONS (Gmail OAuth) ----------
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

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public)
values ('id-fotos', 'id-fotos', false)
on conflict (id) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table clients          enable row level security;
alter table bookings         enable row level security;
alter table gasten           enable row level security;
alter table communicatie     enable row level security;
alter table payments         enable row level security;
alter table booking_fotos    enable row level security;
alter table settings         enable row level security;
alter table user_roles       enable row level security;
alter table analytics_events enable row level security;
alter table integrations     enable row level security;

-- --- Publiek reservatieformulier (anon): ENKEL toevoegen, nooit lezen/wijzigen ---
create policy anon_insert_clients      on clients      for insert to anon with check (true);
create policy anon_insert_bookings     on bookings     for insert to anon with check (true);
create policy anon_insert_gasten       on gasten       for insert to anon with check (true);
create policy anon_insert_communicatie on communicatie for insert to anon with check (true);
create policy anon_insert_fotos        on booking_fotos for insert to anon with check (true);
create policy anon_insert_analytics    on analytics_events for insert to anon with check (true);

-- Publiek formulier mag de tarieven lezen (alleen prijs-/configkeys, geen privédata)
create policy public_read_prices on settings for select to anon using (
  key = any (array[
    'prijs_tent','prijs_camper','prijs_volwassene','prijs_kind','prijs_baby',
    'prijs_hond','prijs_extra_auto','prijs_elektriciteit','prijs_afval_per_6',
    'toeristentaks','prijs_waarborg','extra_tarieven','accommodatie_types',
    'kbo','btw_nummer','adres','gemeente'
  ])
);

-- LET OP: payments heeft BEWUST GEEN anon-policy.
-- De Mollie-webhook werkt betalingen bij via de service_role-sleutel (omzeilt RLS).
-- Geef anon hier NOOIT update-rechten: dat laat fraude toe (zelf op 'betaald' zetten).

-- --- Dashboard (authenticated): volledige toegang binnen dit ene camping-project ---
create policy authenticated_full_clients      on clients      for all to authenticated using (true) with check (true);
create policy authenticated_full_bookings     on bookings     for all to authenticated using (true) with check (true);
create policy auth_all_gasten                 on gasten       for all to authenticated using (true) with check (true);
create policy authenticated_full_communicatie on communicatie for all to authenticated using (true) with check (true);
create policy auth_all_payments               on payments     for all to authenticated using (true) with check (true);
create policy auth_all_fotos                  on booking_fotos for all to authenticated using (true) with check (true);
create policy auth_read_analytics             on analytics_events for select to authenticated using (true);

-- Settings + integraties: enkel je eigen rijen
create policy owner_settings      on settings     for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy owner_all_integrations on integrations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Rollen: zelf lezen, admins beheren
create policy self_read_role on user_roles for select to authenticated using (user_id = auth.uid());
create policy admin_all_roles on user_roles for all to authenticated
  using (auth.uid() in (select user_id from user_roles where role = 'admin'))
  with check (auth.uid() in (select user_id from user_roles where role = 'admin'));

-- --- Storage: anon mag uploaden, ingelogd mag lezen ---
create policy anon_upload_id_fotos on storage.objects for insert to anon with check (bucket_id = 'id-fotos');
create policy auth_read_id_fotos   on storage.objects for select to authenticated using (bucket_id = 'id-fotos');
