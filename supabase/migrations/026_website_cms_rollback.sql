-- ROLLBACK voor 026_website_cms.sql
-- Let op: verwijdert de volledige website-inhoud en de media-bucket-policies.
-- De bucket zelf en geüploade bestanden worden NIET automatisch verwijderd
-- (om dataverlies te vermijden) — verwijder die desnoods handmatig.
drop policy if exists admin_write_website_media on storage.objects;
drop policy if exists public_read_website_media on storage.objects;
drop table if exists website_paginas;
