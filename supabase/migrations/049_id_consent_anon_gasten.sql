-- ============================================================================
-- 049_id_consent_anon_gasten.sql
-- Naar aanleiding van GBA-dossier INF-2026-01267: het fotograferen/scannen
-- van het identiteitsdocument mag enkel met de vrije, specifieke toestemming
-- van de gast (art. 6 §4 wet 19 juli 1991) — nooit als voorwaarde om te
-- kunnen boeken. Het publieke reserveringsformulier maakt de ID-foto daarom
-- optioneel en toestemmingsgebaseerd (nieuwe schakelaar, apart van de
-- algemene GDPR-verwerkingstoestemming).
--
-- gasten.id_consent bestaat al sinds migratie 004, maar anon_insert_gasten
-- (036) dwong id_consent altijd op false — een bezoeker kon dus nooit
-- effectief "ja" registreren. Enige wijziging hier: id_consent mag nu ook
-- true zijn, maar uitsluitend op de hoofdgast-rij (is_hoofdgast=true) — een
-- medereiziger heeft op dit formulier nooit een foto, dus mag nooit
-- toestemming claimen. Alle overige checks uit 036 blijven ongewijzigd.
--
-- Rollback: 049_id_consent_anon_gasten_rollback.sql
-- ============================================================================
drop policy if exists anon_insert_gasten on gasten;
create policy anon_insert_gasten on gasten for insert to anon
  with check (
    length(btrim(naam)) >= 1 and length(btrim(naam)) <= 120
    and foto_url is null
    and deleted_at is null
    and (id_consent = false or is_hoofdgast = true)
    and length(coalesce(nationaliteit,'')) <= 80
    and length(coalesce(id_nummer,'')) <= 40
    and length(coalesce(nummerplaat,'')) <= 30
    and length(coalesce(geboorteplaats,'')) <= 80
    and length(coalesce(documenttype,'')) <= 40
  );
