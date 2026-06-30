-- ROLLBACK voor 007_booking_idempotency.sql
drop index if exists bookings_idempotency_key_idx;
alter table bookings drop column if exists idempotency_key;
