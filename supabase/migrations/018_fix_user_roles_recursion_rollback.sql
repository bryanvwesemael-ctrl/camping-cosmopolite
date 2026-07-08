-- ROLLBACK voor 018_fix_user_roles_recursion.sql
-- Let op: dit herstelt de KAPOTTE (recursieve) policy — enkel gebruiken als
-- de nieuwe versie onverwacht problemen geeft.
drop policy if exists admin_all_roles on user_roles;
create policy admin_all_roles on user_roles
  for all to authenticated
  using (auth.uid() in (select user_id from user_roles where role = 'admin'))
  with check (auth.uid() in (select user_id from user_roles where role = 'admin'));
