-- ============================================================================
-- 010_rls_roles_id_documents.sql  (Fase 7 — security)
-- Dwingt rol-toegang af op de GEVOELIGSTE data (de ID-scans), i.p.v. enkel
-- knoppen te verbergen. De brede using(true)-policies voor de dagelijkse
-- werking (bookings/gasten/...) blijven, want staff heeft die nodig voor
-- check-in en "Wie is er?". Enkel de ID-afbeeldingen worden admin-only.
--
-- VEILIGHEID: vóór het afdwingen krijgen ALLE bestaande auth-gebruikers zonder
-- rol de admin-rol (nu enkel bryan; karen is al admin) → niemand wordt
-- buitengesloten. Er zijn momenteel geen staff-only accounts.
--
-- Rollback: 010_rls_roles_id_documents_rollback.sql
-- ============================================================================

-- 1. Geen enkele bestaande gebruiker zonder rol achterlaten.
insert into user_roles (user_id, role)
select u.id, 'admin' from auth.users u
where not exists (select 1 from user_roles r where r.user_id = u.id)
on conflict (user_id) do nothing;

-- 2. Admin-helper (SECURITY DEFINER → leest user_roles zonder RLS-recursie).
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role = 'admin');
$$;
revoke execute on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

-- 3. booking_documents: ID-scans enkel voor admins (edge functions gebruiken
--    service_role en omzeilen RLS voor de upload/scan).
drop policy if exists auth_all_booking_documents on booking_documents;
create policy admin_all_booking_documents on booking_documents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 4. Storage id-fotos: enkel admins mogen de bestanden lezen/wijzigen (signed URLs).
--    Anon-upload blijft (publiek formulier), edge functions via service_role.
--    Let op: er stond productie-drift (extra policy authenticated_read_id_fotos)
--    die álle ingelogde gebruikers liet lezen — die wordt hier verwijderd.
drop policy if exists auth_read_id_fotos on storage.objects;
drop policy if exists authenticated_read_id_fotos on storage.objects;
drop policy if exists auth_update_id_fotos on storage.objects;
create policy admin_read_id_fotos on storage.objects
  for select to authenticated using (bucket_id = 'id-fotos' and public.is_admin());
create policy admin_update_id_fotos on storage.objects
  for update to authenticated using (bucket_id = 'id-fotos' and public.is_admin())
  with check (bucket_id = 'id-fotos' and public.is_admin());
