-- ============================================================================
-- 020_bookings_uitgecheckt_at.sql
-- Voegt een expliciet uitcheck-tijdstip toe aan bookings, zodat het nieuwe
-- dashboard (/dashboard-nieuw/) een fiche bewust naar de map "Vertrokken" kan
-- verplaatsen — los van de vertrekdatum. Het oude systeem gebruikt deze kolom
-- niet en blijft ongewijzigd werken (nullable, geen default-gedrag gewijzigd).
--
-- Rollback: 020_bookings_uitgecheckt_at_rollback.sql
-- ============================================================================
alter table bookings add column if not exists uitgecheckt_at timestamptz;
