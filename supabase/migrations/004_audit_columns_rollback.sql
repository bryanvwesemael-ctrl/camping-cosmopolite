-- ROLLBACK voor 004_audit_columns.sql
-- Verwijdert triggers, constraints, indexes en kolommen in omgekeerde volgorde.
-- Laat gasten.id_consent staan (bestond al vóór deze migratie in productie).

drop trigger if exists trg_bookings_touch on bookings;
drop trigger if exists trg_gasten_updated_at on gasten;

alter table bookings drop constraint if exists bookings_vertrek_na_aankomst;
drop index if exists gasten_one_hoofdgast_per_booking;

alter table gasten   drop column if exists deleted_at;
alter table gasten   drop column if exists updated_at;

alter table bookings drop column if exists updated_by;
alter table bookings drop column if exists created_by;
alter table bookings drop column if exists deleted_at;
alter table bookings drop column if exists version;
alter table bookings drop column if exists updated_at;

drop function if exists public.touch_booking();
drop function if exists public.set_updated_at();
