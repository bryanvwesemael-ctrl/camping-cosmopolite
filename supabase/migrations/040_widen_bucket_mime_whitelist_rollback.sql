-- Rollback van 040: terug naar de engere lijst uit 037.
update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png','image/heic','image/heif','application/pdf']
 where id in ('id-fotos','booking-fotos');
