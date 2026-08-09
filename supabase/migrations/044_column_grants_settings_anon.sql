-- ============================================================================
-- 044_column_grants_settings_anon.sql
-- Auditbevinding F-10 (LAAG): GET /rest/v1/settings?select=* gaf als anon ook
-- id en user_id mee bij de prijsrijen — interne medewerkers-UUID's, geen
-- geheim maar hoort niet op een publiek endpoint.
--
-- RLS is rij-niveau, geen kolom-niveau. PostgreSQL kent wél kolom-privileges,
-- los van RLS — dit lost het probleem daar op, zonder de bestaande policy of
-- de app-code te wijzigen. De app vraagt sowieso altijd al expliciet
-- select('key,value'), nooit select('*').
--
-- Rollback: 044_column_grants_settings_anon_rollback.sql
-- ============================================================================
revoke select on table public.settings from anon;
grant  select (key, value) on table public.settings to anon;

revoke select on table public.club_settings from anon;
grant  select (key, value) on table public.club_settings to anon;
