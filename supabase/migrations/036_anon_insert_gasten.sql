-- ============================================================================
-- 036_anon_insert_gasten.sql
-- Het publieke reserveringsformulier laat bezoekers voortaan de naam van
-- elke reisgenoot invullen (niet enkel de hoofdboeker), zodat die meteen als
-- gasten-rij bestaat i.p.v. te wachten op AI-scan/handmatige invoer door
-- Karen. Daarvoor heeft de anon-rol nog geen INSERT-recht op "gasten" —
-- enkel "authenticated" (has_role()) kon hier ooit iets invoegen.
--
-- Zelfde patroon/voorzichtigheid als de bestaande anon_insert_clients/
-- anon_insert_bookings-policies: lengtelimieten op vrije tekstvelden,
-- foto_url/deleted_at moeten leeg blijven (foto's lopen uitsluitend via de
-- guest-upload edge function, nooit rechtstreeks via de gasten-tabel).
--
-- Rollback: 036_anon_insert_gasten_rollback.sql
-- ============================================================================
create policy anon_insert_gasten on gasten for insert to anon
  with check (
    length(btrim(naam)) >= 1 and length(btrim(naam)) <= 120
    and foto_url is null
    and deleted_at is null
    and id_consent = false
    and length(coalesce(nationaliteit,'')) <= 80
    and length(coalesce(id_nummer,'')) <= 40
    and length(coalesce(nummerplaat,'')) <= 30
    and length(coalesce(geboorteplaats,'')) <= 80
    and length(coalesce(documenttype,'')) <= 40
  );
