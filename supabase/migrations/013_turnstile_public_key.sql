-- ============================================================================
-- 013_turnstile_public_key.sql
-- Laat het publieke formulier de Turnstile-site-key lezen (publieke sleutel,
-- geen geheim). De secret-key hoort als Edge-secret TURNSTILE_SECRET (nooit in
-- de DB/frontend). Herbouwt de bestaande public_read_prices-policy met de extra
-- toegelaten sleutel.
--
-- Rollback: 013_turnstile_public_key_rollback.sql
-- ============================================================================
drop policy if exists public_read_prices on settings;
create policy public_read_prices on settings for select to anon using (
  key = any (array[
    'prijs_tent','prijs_camper','prijs_volwassene','prijs_kind','prijs_baby',
    'prijs_hond','prijs_extra_auto','prijs_elektriciteit','prijs_afval_per_6',
    'toeristentaks','prijs_waarborg','extra_tarieven','accommodatie_types',
    'kbo','btw_nummer','adres','gemeente','turnstile_site_key'
  ])
);
