-- ROLLBACK voor 020_bookings_uitgecheckt_at.sql
alter table bookings drop column if exists uitgecheckt_at;
