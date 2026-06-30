-- ============================================================================
-- 003_security_revoke_purge.sql
-- Audit-fix: purge_expired_data() is een SECURITY DEFINER functie die DATA WIST.
-- Ze was uitvoerbaar door 'anon' en 'authenticated' via de publieke REST-API
-- (/rest/v1/rpc/purge_expired_data). Iedereen kon dus dataverwijdering triggeren.
--
-- De maandelijkse pg_cron-job draait als 'postgres' (superuser) en blijft werken.
-- We trekken enkel het publieke/uitgenodigde uitvoerrecht in.
--
-- Rollback:  GRANT EXECUTE ON FUNCTION public.purge_expired_data() TO anon, authenticated;
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.purge_expired_data() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_expired_data() FROM anon;
REVOKE EXECUTE ON FUNCTION public.purge_expired_data() FROM authenticated;

-- Behoud expliciet voor de cron-eigenaar / service-role.
GRANT EXECUTE ON FUNCTION public.purge_expired_data() TO postgres, service_role;
