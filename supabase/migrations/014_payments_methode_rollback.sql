-- ROLLBACK voor 014_payments_methode.sql
alter table payments drop column if exists methode;
