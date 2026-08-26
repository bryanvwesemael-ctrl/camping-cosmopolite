-- Rollback voor 049_id_consent_anon_gasten.sql
-- Herstelt de exacte policy uit migratie 036 (id_consent altijd false op anon-insert).
drop policy if exists anon_insert_gasten on gasten;
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
