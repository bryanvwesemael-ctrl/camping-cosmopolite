-- ============================================================================
-- 021_mail_ai_intake.sql
-- Fase 4 van het nieuwe-dashboard-bouwplan: het enige stuk dat écht nieuw is
-- (bestaat nergens in het oude systeem). Ondersteunt de flow uit de
-- masterprompt: nieuwe reservatie-mail -> AI leest uit -> conceptboeking in
-- Postvak -> Karen controleert -> 1 klik bevestigen.
--
-- ai_draft:  markeert een boeking als "door AI aangemaakt, nog niet door een
--            mens bevestigd" — apart van status='aanvraag' (dat kan ook een
--            telefonische aanvraag zijn). De fiche toont de oranje
--            "automatisch ingelezen"-banner enkel wanneer dit true is.
-- ai_parsed: de ruwe AI-extractie (JSON) zodat Karen kan zien wat de AI zag,
--            ook als ze nadien velden aanpast.
-- booking_attachments: originele mailbijlagen (bv. een pdf-bevestiging van
--            een ander platform) gekoppeld aan de boeking. Bewust een NIEUWE,
--            aparte tabel i.p.v. hergebruik van booking_documents — die tabel
--            is semantisch gekoppeld aan het ID-scanproces (het status-enum
--            heeft waarden als 'ai_uitgelezen_controle_nodig',
--            'document_afgekeurd', puur ID-document-taal) en dat verder
--            overladen met "willekeurige e-mailbijlage" zou precies het soort
--            begripsvermenging zijn die dit hele herontwerp probeert weg te
--            werken.
--
-- Rollback: 021_mail_ai_intake_rollback.sql
-- ============================================================================
alter table bookings add column if not exists ai_draft boolean not null default false;
alter table bookings add column if not exists ai_parsed jsonb;

create table if not exists booking_attachments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  storage_path text not null,
  media_type text,
  original_filename text,
  created_at timestamptz not null default now()
);
alter table booking_attachments enable row level security;

-- Zelfde gevoeligheidsklasse als bookings/communicatie: staff + admin (niet
-- enkel admin zoals booking_documents/id-fotos, want dit zijn bijlagen bij
-- de reservering zelf, geen identiteitsdocumenten).
create policy auth_all_booking_attachments on booking_attachments
  for all to authenticated using (public.has_role()) with check (public.has_role());
