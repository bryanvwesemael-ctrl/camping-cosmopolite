-- ============================================================================
-- 006_audit_logs.sql  (Fase 1 — DB-fundament)
-- Append-only auditlog voor privacygevoelige en wettelijke gebeurtenissen
-- (sectie 19). Niemand mag bestaande logregels wijzigen of verwijderen:
-- er zijn bewust GEEN update/delete-policies. Enkel service_role (retention)
-- kan opruimen.
--
-- Rollback: 006_audit_logs_rollback.sql
-- ============================================================================

create table if not exists audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor         uuid,         -- auth.users id (null = systeem of anon-formulier)
  actor_email   text,
  actie         text not null,-- bv 'ai_verwerking_gestart','document_geopend','hoofdgast_gewijzigd'
  entiteit      text,         -- 'booking' | 'gast' | 'document'
  entiteit_id   uuid,
  booking_id    uuid,
  oude_waarde   jsonb,
  nieuwe_waarde jsonb,
  reden         text,
  bron          text,         -- 'formulier' | 'ai' | 'medewerker'
  created_at    timestamptz not null default now()
);

create index if not exists audit_logs_booking_idx on audit_logs(booking_id);
create index if not exists audit_logs_created_idx  on audit_logs(created_at desc);
create index if not exists audit_logs_entiteit_idx on audit_logs(entiteit, entiteit_id);

alter table audit_logs enable row level security;

-- Ingelogde medewerkers mogen lezen en toevoegen.
create policy auth_read_audit   on audit_logs for select to authenticated using (true);
create policy auth_insert_audit on audit_logs for insert to authenticated with check (true);
-- BEWUST geen update/delete-policy => append-only voor alle gewone gebruikers.
