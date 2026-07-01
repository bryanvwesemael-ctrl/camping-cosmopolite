-- ROLLBACK voor 008_gasten_register_velden.sql
alter table gasten drop column if exists documenttype;
alter table gasten drop column if exists geboorteplaats;
