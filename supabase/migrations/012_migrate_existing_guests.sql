-- ============================================================================
-- 012_migrate_existing_guests.sql  (Fase 8 — migratie bestaande boekingen)
-- Backfill zodat bestaande boekingen naadloos in de nieuwe register-flow passen.
-- Dry-run (2026-07-01): 6 boekingen — 3 zonder gasten, 1 met gasten zonder
-- hoofdgast, 7 echte gasten, 0 pending, 0 documenten. Puur additief:
--  - markeert een hoofdgast waar er nog geen is (oudste gast van de boeking);
--  - maakt een VOORLOPIGE gast (is_hoofdgast, id_consent=false) uit de
--    contactgegevens voor boekingen zonder enige gast.
-- Geen boekingen/betalingen worden gewijzigd; geen bedragen herberekend.
--
-- Rollback: 012_migrate_existing_guests_rollback.sql (best effort).
-- ============================================================================

-- 1. Hoofdgast markeren waar er gasten zijn maar nog geen hoofdgast.
update gasten g set is_hoofdgast = true
where g.id in (
  select distinct on (g2.booking_id) g2.id
  from gasten g2
  where g2.naam <> '__pending_guest_upload__'
    and not exists (
      select 1 from gasten h
      where h.booking_id = g2.booking_id and h.is_hoofdgast
        and h.naam <> '__pending_guest_upload__'
    )
  order by g2.booking_id, g2.created_at asc
);

-- 2. Voorlopige hoofdgast uit de contactgegevens voor boekingen zonder gast.
--    id_consent=false → duidelijk dat dit niet via de nieuwe (ID-)flow bevestigd is.
insert into gasten (booking_id, naam, geboortedatum, nationaliteit, id_nummer, nummerplaat, is_hoofdgast, id_consent)
select b.id, c.naam, c.geboortedatum, c.nationaliteit, c.id_nummer, c.nummerplaten, true, false
from bookings b
join clients c on c.id = b.client_id
where c.naam is not null and c.naam <> ''
  and not exists (
    select 1 from gasten g
    where g.booking_id = b.id and g.naam <> '__pending_guest_upload__'
  );
