-- ROLLBACK voor 023_prijzen_club_settings.sql
-- Let op: dit verwijdert de leesrechten en de geconsolideerde tarieven uit
-- club_settings. De oude per-gebruiker rijen in `settings` zijn nooit
-- verwijderd door de originele migratie en blijven dus intact.
drop policy if exists staff_read_prices_club on club_settings;
drop policy if exists public_read_prices_club on club_settings;
delete from club_settings where key in (
  'prijs_tent','prijs_camper','prijs_volwassene','prijs_kind','prijs_baby',
  'prijs_hond','prijs_extra_auto','prijs_elektriciteit','prijs_afval_per_6',
  'toeristentaks','max_plaatsen','extra_tarieven','accommodatie_types'
);
