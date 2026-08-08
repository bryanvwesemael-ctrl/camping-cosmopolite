-- ============================================================================
-- 040_widen_bucket_mime_whitelist.sql
-- Correctie op 037 — voorkomt een regressie die ik bij de impactcontrole vond.
--
-- 037 zette op id-fotos/booking-fotos een MIME-whitelist van jpeg, png, heic,
-- heif en pdf. Dat is precies wat de edge function guest-upload zelf al
-- afdwingt, dus voor de publieke weg verandert er niets.
--
-- MAAR: het dashboard uploadt RECHTSTREEKS naar storage met
-- contentType: file.type, en de bestandskiezers staan op accept="image/*".
-- Een medewerker die een webp-, avif-, gif- of bmp-screenshot kiest, zou
-- vanaf 037 een onbegrijpelijke foutmelding krijgen op iets dat gisteren nog
-- werkte. Dat is geen beveiligingswinst maar een gebruiksregressie.
--
-- Daarom hier verruimd naar alle gangbare RASTER-formaten. Bewust NIET
-- toegevoegd: image/svg+xml op de ID-buckets — een SVG is XML en kan script
-- bevatten, en die hoort sowieso nooit een identiteitsdocument te zijn. Het
-- eigenlijke doel van de whitelist (geen html, geen scripts, geen
-- uitvoerbare bestanden in een bucket met persoonsgegevens) blijft overeind.
--
-- Rollback: 040_widen_bucket_mime_whitelist_rollback.sql
-- ============================================================================
update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg','image/jpg','image/png','image/heic','image/heif',
         'image/webp','image/avif','image/gif','image/bmp','image/tiff',
         'application/pdf'
       ]
 where id in ('id-fotos','booking-fotos');
