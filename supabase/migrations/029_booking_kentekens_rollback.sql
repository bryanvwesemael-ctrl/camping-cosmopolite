-- ROLLBACK voor 029_booking_kentekens.sql
drop policy if exists auth_all_booking_kentekens on booking_kentekens;
drop table if exists booking_kentekens;
