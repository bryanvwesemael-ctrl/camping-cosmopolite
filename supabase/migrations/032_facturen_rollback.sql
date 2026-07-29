-- ROLLBACK voor 032_facturen.sql
-- LET OP: dit verwijdert alle bewaarde facturen. Exporteer ze eerst als er al
-- echte facturen zijn uitgereikt — die moeten 7 jaar bijgehouden worden.
drop function if exists public.maak_factuur(uuid, jsonb, numeric, numeric, numeric, numeric, boolean, uuid);
drop policy if exists facturen_select on facturen;
drop table if exists facturen;
