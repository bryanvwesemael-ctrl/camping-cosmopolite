-- ROLLBACK voor 022_staff_read_id_fotos.sql
drop policy if exists staff_read_id_fotos on storage.objects;
create policy admin_read_id_fotos on storage.objects
  for select to authenticated using (bucket_id = 'id-fotos' and is_admin());
