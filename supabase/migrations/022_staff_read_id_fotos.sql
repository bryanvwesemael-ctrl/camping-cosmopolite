-- ============================================================================
-- 022_staff_read_id_fotos.sql
-- Bryan: "medewerkers mogen dit ook zien" — de ID-thumbnails in de fiche
-- (Gasten & ID-tab, nieuw dashboard) waren enkel zichtbaar voor admins omdat
-- de id-fotos-opslag sinds een eerdere fase van het oude systeem admin-only
-- was. Dat was destijds bedoeld voor het bredere, doorzoekbare ID-archief —
-- maar "wie hoort bij deze boeking" tijdens het dagelijkse werk is iets wat
-- elke medewerker moet kunnen zien, niet enkel Karen.
--
-- FIX: lezen (SELECT) van de id-fotos-bucket vereist voortaan has_role()
-- (staff of admin) i.p.v. is_admin(). Bewerken/vervangen (UPDATE) blijft
-- wél admin-only — dat is een correctie-actie, geen dagelijkse taak.
-- Het bredere ID-archief (Beheer, doorzoekbaar over alle boekingen) blijft
-- ongewijzigd admin-only in de UI — dit raakt enkel het zien van ID-foto's
-- van gasten BINNEN een specifieke, al geopende boeking.
--
-- Rollback: 022_staff_read_id_fotos_rollback.sql
-- ============================================================================
drop policy if exists admin_read_id_fotos on storage.objects;
create policy staff_read_id_fotos on storage.objects
  for select to authenticated using (bucket_id = 'id-fotos' and public.has_role());
