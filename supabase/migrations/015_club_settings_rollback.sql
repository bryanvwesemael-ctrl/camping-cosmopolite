-- ROLLBACK voor 015_club_settings.sql
drop trigger if exists trg_club_settings_updated_at on club_settings;
drop table if exists club_settings;
