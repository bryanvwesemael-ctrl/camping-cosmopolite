-- ============================================================================
-- 024_waarborg_ontvangen.sql
-- Punt 4: "elke waarborg is verplicht cash." Waarborg (deposito) is geen
-- omzet en moet dus nooit via de gewone prijs/payments-stroom lopen (die ook
-- overschrijving/QR toelaat). Aparte, cash-only status per boeking.
--
-- Het bedrag zelf wordt NIET hier opgeslagen: het staat al, per accType,
-- vastgezet in bookings.extra_type_units op het moment van aanmaken
-- (elk element bevat waarborgBedrag + count). Enkel de twee tijdstippen
-- moeten bijgehouden worden.
--
-- Rollback: 024_waarborg_ontvangen_rollback.sql
-- ============================================================================
alter table bookings add column if not exists waarborg_ontvangen_at timestamptz;
alter table bookings add column if not exists waarborg_teruggegeven_at timestamptz;
