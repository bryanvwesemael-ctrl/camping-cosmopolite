-- ROLLBACK voor 010_rls_roles_id_documents.sql
-- Zet de brede authenticated-toegang terug. (De toegevoegde admin-rollen
-- blijven staan; die verwijderen is niet nodig en risicovol.)

drop policy if exists admin_all_booking_documents on booking_documents;
create policy auth_all_booking_documents on booking_documents
  for all to authenticated using (true) with check (true);

drop policy if exists admin_read_id_fotos on storage.objects;
drop policy if exists admin_update_id_fotos on storage.objects;
create policy authenticated_read_id_fotos on storage.objects
  for select to authenticated using (bucket_id = 'id-fotos');
create policy auth_update_id_fotos on storage.objects
  for update to authenticated using (bucket_id = 'id-fotos') with check (bucket_id = 'id-fotos');

drop function if exists public.is_admin(uuid);
