-- ============================================================================
-- 018_fix_user_roles_recursion.sql
-- KRITIEKE FIX: de policy 'admin_all_roles' (uit 001_init.sql) verwijst in haar
-- eigen USING-clausule naar 'user_roles' zelf (om te checken of de aanvrager
-- admin is) — een klassieke RLS-zelfrecursie. Dit deed Postgres een
-- "infinite recursion detected in policy for relation user_roles"-fout gooien,
-- die als HTTP 500 terugkwam op elke lees-aanvraag naar user_roles.
--
-- Concreet gevolg: applyRoleVisibility() in het dashboard kon de rol van de
-- ingelogde gebruiker niet ophalen (kreeg de 500, ving de fout op, viel terug
-- op 'staff'), waardoor Analytics EN het nieuwe ID-archief nooit zichtbaar
-- werden voor Karen of Bryan, ook al staat hun rol correct op 'admin'.
--
-- Bevestigd in de live logs: GET /rest/v1/user_roles?select=role&user_id=...
-- -> status_code 500, voor bryan.v.wesemael@gmail.com.
--
-- FIX: gebruik de bestaande SECURITY DEFINER-helper public.is_admin()
-- (migratie 010) — die omzeilt RLS intern en veroorzaakt geen recursie.
--
-- Rollback: 018_fix_user_roles_recursion_rollback.sql
-- ============================================================================
drop policy if exists admin_all_roles on user_roles;
create policy admin_all_roles on user_roles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
