-- Rollback van 037. Let op: dit HERSTELT een bewezen kwetsbaarheid (anonieme
-- upload naar de ID-fotobucket). Enkel gebruiken als 037 aantoonbaar iets breekt.
drop policy if exists staff_delete_id_fotos on storage.objects;

create policy public_upload_id_foto on storage.objects for insert to anon
  with check (bucket_id = 'id-fotos');
create policy anon_upload_booking_fotos on storage.objects for insert to anon
  with check (bucket_id = 'booking-fotos');

update storage.buckets set file_size_limit = null, allowed_mime_types = null
 where id in ('id-fotos','booking-fotos','website-media');
