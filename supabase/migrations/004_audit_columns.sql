-- ============================================================================
-- 004_audit_columns.sql  (Fase 1 — DB-fundament)
-- Voegt audit-/locking-kolommen + updated_at-triggers toe en legt de bestaande
-- productie-drift vast (kolom gasten.id_consent bestond live maar niet in 001).
--
-- Volledig additief en idempotent (IF NOT EXISTS). Geen dataverlies.
-- Dry-run (2026-06-30): 6 boekingen, 7 gasten, 0 dubbele hoofdgasten,
-- 0 verweesde gasten -> de partial unique index breekt geen bestaande data.
--
-- Rollback: 004_audit_columns_rollback.sql
-- ============================================================================

-- 0. Drift vastleggen: kolom die live al bestaat maar niet in 001 stond.
alter table gasten add column if not exists id_consent boolean not null default false;

-- 1. Gedeelde updated_at-functie.
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 2. Functie die updated_at zet én version ophoogt (voor optimistic locking, fase 6).
create or replace function public.touch_booking() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  new.version    = coalesce(old.version, 1) + 1;
  return new;
end $$;

-- 3. BOOKINGS: audit + locking-kolommen.
alter table bookings add column if not exists updated_at timestamptz not null default now();
alter table bookings add column if not exists version    integer     not null default 1;
alter table bookings add column if not exists deleted_at timestamptz;
alter table bookings add column if not exists created_by uuid;
alter table bookings add column if not exists updated_by uuid;

drop trigger if exists trg_bookings_touch on bookings;
create trigger trg_bookings_touch before update on bookings
  for each row execute function public.touch_booking();

-- 4. GASTEN: audit-kolommen.
alter table gasten add column if not exists updated_at timestamptz not null default now();
alter table gasten add column if not exists deleted_at timestamptz;

drop trigger if exists trg_gasten_updated_at on gasten;
create trigger trg_gasten_updated_at before update on gasten
  for each row execute function public.set_updated_at();

-- 5. Maximaal één hoofdgast per boeking (data is schoon volgens dry-run).
create unique index if not exists gasten_one_hoofdgast_per_booking
  on gasten(booking_id) where is_hoofdgast = true;

-- 6. Vertrek moet na aankomst liggen (geen negatieve verblijven).
do $$ begin
  alter table bookings add constraint bookings_vertrek_na_aankomst check (vertrek > aankomst);
exception when duplicate_object then null; end $$;
