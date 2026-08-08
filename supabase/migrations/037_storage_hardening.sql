-- ============================================================================
-- 037_storage_hardening.sql
-- Naar aanleiding van de beveiligingsaudit van 2026-08-08 (F-01 en F-02).
--
-- (1) F-01 — Anonieme bezoekers konden ONBEPERKT bestanden uploaden naar de
--     privé-bucket 'id-fotos' (en 'booking-fotos'). De policy stelde als enige
--     voorwaarde bucket_id = 'id-fotos': geen padbeperking, geen groottelimiet,
--     geen bestandstypecontrole. Bewezen tijdens de audit: een POST met enkel
--     de publieke anon-sleutel gaf HTTP 200 en maakte het object aan.
--
--     Deze policies zijn niet nodig: geen enkele publieke pagina uploadt
--     rechtstreeks naar storage. reserveren.html en upload/index.html gaan via
--     de edge function guest-upload, die de service role gebruikt en dus geen
--     RLS-policy nodig heeft. Het was dus puur overbodig aanvalsoppervlak.
--
-- (2) F-02 — Er bestond GEEN DELETE-policy op 'id-fotos'. Het dashboard roept
--     storage.remove() aan bij het verwijderen van een boeking, maar die
--     aanroep faalde stil (staat in een lege catch). Gevolg: 81 wees-bestanden
--     met identiteitsdocumenten die door niets meer worden opgeruimd, omdat
--     purge_expired_data() ze via booking_documents zoekt en die rij weg is.
--
-- (3) Buckets kregen een groottelimiet en een lijst toegelaten bestandstypes,
--     zodat een fout of misbruik niet meteen onbeperkt opslag kan verbruiken.
--     15 MB komt overeen met MAX_FILE_BYTES in guest-upload/index.ts.
--
-- Rollback: 037_storage_hardening_rollback.sql
-- ============================================================================

-- 1. Overbodige anonieme upload-policies verwijderen.
drop policy if exists public_upload_id_foto on storage.objects;
drop policy if exists anon_upload_booking_fotos on storage.objects;

-- 2. Medewerkers moeten ID-documenten daadwerkelijk kunnen verwijderen —
--    zonder deze policy is het recht op wissing technisch onuitvoerbaar.
drop policy if exists staff_delete_id_fotos on storage.objects;
create policy staff_delete_id_fotos on storage.objects for delete to authenticated
  using (bucket_id = 'id-fotos' and has_role());

-- 3. Grenzen op de buckets zelf (waren allebei NULL = onbeperkt).
update storage.buckets
   set file_size_limit = 15728640,  -- 15 MB, gelijk aan guest-upload
       allowed_mime_types = array['image/jpeg','image/png','image/heic','image/heif','application/pdf']
 where id in ('id-fotos','booking-fotos');

update storage.buckets
   set file_size_limit = 10485760,  -- 10 MB volstaat ruim voor websitebeelden
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/svg+xml','image/gif']
 where id = 'website-media';
