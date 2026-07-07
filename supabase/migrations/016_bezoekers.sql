-- ============================================================================
-- 016_bezoekers.sql  (Punt 3 — Bezoeker-concept)
-- Dagbezoekers (bv. picknickers) zijn GEEN wettelijk reizigersregister-geval
-- (dat geldt enkel voor overnachtende gasten, KB 27/04/2007) — dit is een
-- operationeel hulpmiddel om te weten wie er op het terrein is, los van
-- boekingen. Daarom een eigen, lichtgewicht tabel i.p.v. hergebruik van
-- 'gasten'/'bookings'.
--
-- Rollback: 016_bezoekers_rollback.sql
-- ============================================================================
create table if not exists bezoekers (
  id                      uuid primary key default gen_random_uuid(),
  naam                    text,
  notitie                 text,
  foto_storage_path       text,               -- optionele ID-foto, private bucket 'id-fotos'
  ingecheckt_at           timestamptz not null default now(),
  uitgecheckt_at          timestamptz,
  omgezet_naar_booking_id uuid references bookings(id),
  created_by              uuid,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists bezoekers_open_idx on bezoekers(uitgecheckt_at) where uitgecheckt_at is null;

alter table bezoekers enable row level security;

-- Admin-only, zelfde niveau als de andere privacygevoelige tabellen (booking_documents).
create policy admin_all_bezoekers on bezoekers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop trigger if exists trg_bezoekers_updated_at on bezoekers;
create trigger trg_bezoekers_updated_at before update on bezoekers
  for each row execute function public.set_updated_at();

-- Live meetellen tussen medewerkers, net als bookings/gasten/booking_documents.
do $$ begin
  alter publication supabase_realtime add table bezoekers;
exception when duplicate_object then null; end $$;
