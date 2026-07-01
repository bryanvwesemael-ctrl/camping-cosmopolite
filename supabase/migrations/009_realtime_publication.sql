-- ============================================================================
-- 009_realtime_publication.sql  (Fase 6)
-- Zet gasten en booking_documents in de Realtime-publicatie zodat het dashboard
-- live bijwerkt wanneer een collega gasten bevestigt of documenten verwerkt.
-- bookings zit er al in. Idempotent via de foutafhandeling.
--
-- Rollback: 009_realtime_publication_rollback.sql
-- ============================================================================
do $$ begin
  alter publication supabase_realtime add table gasten;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table booking_documents;
exception when duplicate_object then null; end $$;
