-- ROLLBACK voor 030_anon_insert_booking_kentekens.sql
drop policy if exists anon_insert_booking_kentekens on booking_kentekens;
