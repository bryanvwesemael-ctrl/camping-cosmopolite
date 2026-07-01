-- ============================================================================
-- 005_booking_documents.sql  (Fase 1 — DB-fundament)
-- Aparte tabel voor geüploade identiteitsdocumenten, los van de gasten-tabel.
-- Nu worden foto's als nep-gast ('__pending_guest_upload__') in 'gasten' gezet;
-- dat vervuilt het wettelijke register. Documenten horen in een eigen tabel,
-- en worden pas NA controle door Karen aan een echte gast gekoppeld (gast_id).
--
-- Deze migratie maakt enkel de structuur. De cutover van guest-upload/scan naar
-- deze tabel gebeurt in fase 2/3. Additief, geen dataverlies.
--
-- Rollback: 005_booking_documents_rollback.sql
-- ============================================================================

-- ID-verwerkingsstatussen (sectie 9 van de opdracht).
do $$ begin
  create type id_proces_status as enum (
    'geen_documenten','upload_bezig','documenten_ontvangen','klaar_voor_ai',
    'ai_bezig','ai_uitgelezen_controle_nodig','gedeeltelijk_verwerkt',
    'gegevens_bevestigd','document_onleesbaar','document_afgekeurd',
    'document_vervangen','bronafbeelding_verwijderd','fout_bij_verwerking'
  );
exception when duplicate_object then null; end $$;

create table if not exists booking_documents (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references bookings(id),
  gast_id        uuid references gasten(id),          -- gekoppeld na controle
  slot_index     int,                                  -- documentplaats binnen de boeking
  storage_path   text not null,                        -- pad in private bucket id-fotos
  media_type     text,
  file_size      bigint,
  page_index     int not null default 0,               -- voor PDF-splitsing
  content_hash   text,                                 -- SHA-256, voor dedup + AI-kostbesparing
  status         id_proces_status not null default 'documenten_ontvangen',
  ai_result      jsonb,                                -- ruwe AI-output (blijft concept tot bevestiging)
  ai_verwerkt_at timestamptz,
  fout_melding   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index if not exists booking_documents_booking_idx on booking_documents(booking_id);
create index if not exists booking_documents_gast_idx    on booking_documents(gast_id);

-- Geen dubbele documenthash binnen dezelfde boeking (sectie 34).
create unique index if not exists booking_documents_hash_per_booking
  on booking_documents(booking_id, content_hash)
  where content_hash is not null and deleted_at is null;

alter table booking_documents enable row level security;

-- Dashboard (ingelogd) volledige toegang binnen dit ene camping-project.
-- Edge functions (guest-upload/scan) gebruiken service_role en omzeilen RLS.
-- Anon krijgt BEWUST geen directe policy: uploaden loopt via de edge function.
create policy auth_all_booking_documents on booking_documents
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_booking_documents_updated_at on booking_documents;
create trigger trg_booking_documents_updated_at before update on booking_documents
  for each row execute function public.set_updated_at();
