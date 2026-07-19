-- ROLLBACK voor 024_waarborg_ontvangen.sql
alter table bookings drop column if exists waarborg_teruggegeven_at;
alter table bookings drop column if exists waarborg_ontvangen_at;
