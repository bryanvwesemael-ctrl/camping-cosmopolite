-- ROLLBACK voor 021_mail_ai_intake.sql
drop policy if exists auth_all_booking_attachments on booking_attachments;
drop table if exists booking_attachments;
alter table bookings drop column if exists ai_parsed;
alter table bookings drop column if exists ai_draft;
