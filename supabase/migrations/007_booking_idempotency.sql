-- ============================================================================
-- 007_booking_idempotency.sql  (Fase 2)
-- Idempotency key op bookings: het publieke formulier genereert één sleutel per
-- pagina-load. Een dubbele inzending (dubbelklik, retry) met dezelfde sleutel
-- botst op de unique index en maakt dus GEEN tweede boeking.
--
-- Rollback: 007_booking_idempotency_rollback.sql
-- ============================================================================
alter table bookings add column if not exists idempotency_key text;

create unique index if not exists bookings_idempotency_key_idx
  on bookings(idempotency_key)
  where idempotency_key is not null;
