-- ============================================================================
-- 015_club_settings.sql  (Punt 2 — Betaal-QR)
-- Nieuwe tabel voor CLUB-brede instellingen (niet per medewerker), te
-- onderscheiden van de bestaande 'settings' tabel die per user_id werkt
-- (kbo/btw/tarieven). Bankgegevens horen bij de club, niet bij één account —
-- anders zou Karen en Bryan elk apart hun eigen IBAN moeten invullen en zou
-- wie het laatst inlogt bepalen welke waarde ergens gebruikt wordt.
--
-- Admin-only via de bestaande is_admin()-helper (migratie 010). Geen anon-
-- toegang: bankgegevens hoeven nooit door het publieke formulier gelezen te
-- worden, enkel getoond door een ingelogde medewerker aan een gast.
--
-- Rollback: 015_club_settings_rollback.sql
-- ============================================================================
create table if not exists club_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table club_settings enable row level security;

create policy admin_all_club_settings on club_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop trigger if exists trg_club_settings_updated_at on club_settings;
create trigger trg_club_settings_updated_at before update on club_settings
  for each row execute function public.set_updated_at();
