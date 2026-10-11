-- Hercontrole 2026-10-11: purge_expired_data() (SECURITY DEFINER, wist
-- gegevens volgens de bewaartermijnen) was uitvoerbaar door iedereen via
-- de PUBLIC-grant, dus ook door niet-ingelogde bezoekers met de publieke
-- anon-sleutel (POST /rest/v1/rpc/purge_expired_data).
--
-- Enkel de maandelijkse cron-taak 'gdpr-monthly-purge' roept deze functie
-- aan, en die draait als postgres (de eigenaar) — die behoudt zijn recht.
-- service_role blijft behouden voor eventueel handmatig/edge-gebruik.
revoke execute on function public.purge_expired_data() from public;
revoke execute on function public.purge_expired_data() from anon;
revoke execute on function public.purge_expired_data() from authenticated;
grant execute on function public.purge_expired_data() to service_role;
