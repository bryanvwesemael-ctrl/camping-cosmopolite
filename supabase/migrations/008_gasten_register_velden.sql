-- ============================================================================
-- 008_gasten_register_velden.sql  (Fase 3)
-- Extra wettelijke registervelden op gasten die de AI uitleest en Karen bevestigt.
-- documentnummer wordt opgeslagen in de bestaande kolom id_nummer (= kaartnummer,
-- NOOIT het rijksregisternummer). Additief.
--
-- Rollback: 008_gasten_register_velden_rollback.sql
-- ============================================================================
alter table gasten add column if not exists geboorteplaats text;
alter table gasten add column if not exists documenttype  text;
