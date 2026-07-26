-- ============================================================================
-- 029_booking_kentekens.sql
-- Nummerplaten van een boeking apart bijhouden, los van het bestaande
-- enkelvoudige clients.nummerplaten-veld (dat blijft ongewijzigd werken voor
-- het snelle/eerste kenteken bij aanmaken/bewerken).
--
-- Doel (Bryan): een manier om per kenteken aan te duiden of het al is
-- ingegeven in de slagboom — een apart systeem zonder koppelingsmogelijkheid,
-- dus dit is een handmatige "afgevinkt"-status, geen automatische doorgave.
-- Meerdere kentekens per boeking mogelijk (bv. bij meerdere auto's).
--
-- Rollback: 029_booking_kentekens_rollback.sql
-- ============================================================================
create table if not exists booking_kentekens (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references bookings(id) on delete cascade,
  plaat                 text not null,
  slagboom_ingegeven    boolean not null default false,
  slagboom_ingegeven_at timestamptz,
  created_at            timestamptz not null default now()
);
create index if not exists booking_kentekens_booking_idx on booking_kentekens(booking_id);

alter table booking_kentekens enable row level security;

-- Zelfde toegangspatroon als de andere boekingsgebonden tabellen
-- (payments, communicatie, ...): elke ingelogde medewerker mag alles.
create policy auth_all_booking_kentekens on booking_kentekens
  for all to authenticated using (public.has_role()) with check (public.has_role());
