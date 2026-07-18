-- ============================================================================
-- 023_prijzen_club_settings.sql
-- Bryan: "als ik tarieven wijzig moet dit doorgevoerd worden op de nieuwe-
-- reservering-tab EN op het publieke reserveringsformulier."
--
-- ROOT CAUSE (bevestigd live): tarieven stonden in `settings`, een PER-
-- GEBRUIKER tabel. Zowel Bryan als Karen hadden elk hun eigen rij voor
-- dezelfde sleutel (bv. accommodatie_types) — twee verschillende, botsende
-- configuraties tegelijk in de database. Het publieke formulier las deze
-- tabel zonder user_id-filter of ORDER BY, dus welke versie een gast te zien
-- kreeg was PURE TOEVAL (afhankelijk van niet-gedefinieerde rijvolgorde).
-- Precies dezelfde klasse bug als de eerdere IBAN/mail-afzender-problemen
-- die club_settings al oploste voor die instellingen.
--
-- FIX: tarieven verhuizen naar club_settings — één rij per sleutel, geen
-- ambiguïteit meer mogelijk. Karens bestaande configuratie (10 juli, met
-- Safaritent + Stacaravan) is de bevestigde, echte versie en wordt hier als
-- enige waarheid overgenomen (bevestigd met Bryan, niet zomaar gekozen).
--
-- Nieuw: publieke + staff-leesrechten op club_settings, beperkt tot de
-- prijs-/config-sleutels (geen IBAN/mail_sender_email — die blijven enkel
-- voor admins leesbaar via de bestaande admin_all_club_settings-policy).
--
-- Rollback: 023_prijzen_club_settings_rollback.sql
-- ============================================================================

insert into club_settings(key,value) values
  ('prijs_tent','15'),
  ('prijs_camper','15'),
  ('prijs_volwassene','7'),
  ('prijs_kind','5'),
  ('prijs_baby','0'),
  ('prijs_hond','3'),
  ('prijs_extra_auto','2'),
  ('prijs_elektriciteit','6'),
  ('prijs_afval_per_6','2'),
  ('toeristentaks','1'),
  ('max_plaatsen','0'),
  ('extra_tarieven','[]'),
  ('accommodatie_types','[{"id":"custom_1783422746075","naam":"Safaritent","emoji":"🏕️","prijs":102,"maxPersonen":6,"waarborgBedrag":100,"allIn":false,"beschrijving":"Inclusief afvalbijdrage"},{"id":"custom_1783677484395","naam":"Stacaravan te huur","emoji":"🏕️","prijs":100,"maxPersonen":4,"waarborgBedrag":150,"allIn":false,"beschrijving":""}]')
on conflict (key) do update set value=excluded.value, updated_at=now();

-- Publiek reserveringsformulier mag prijzen lezen (geen privédata) — zelfde
-- patroon als de bestaande public_read_prices-policy op de oude settings-tabel.
create policy public_read_prices_club on club_settings
  for select to anon using (
    key = any (array[
      'prijs_tent','prijs_camper','prijs_volwassene','prijs_kind','prijs_baby',
      'prijs_hond','prijs_extra_auto','prijs_elektriciteit','prijs_afval_per_6',
      'toeristentaks','max_plaatsen','extra_tarieven','accommodatie_types'
    ])
  );

-- Elke ingelogde medewerker (niet enkel admin) mag deze prijzen lezen — nodig
-- voor "Nieuwe reservering" in het dashboard. Schrijven blijft admin-only via
-- de bestaande admin_all_club_settings-policy.
create policy staff_read_prices_club on club_settings
  for select to authenticated using (
    public.has_role() and key = any (array[
      'prijs_tent','prijs_camper','prijs_volwassene','prijs_kind','prijs_baby',
      'prijs_hond','prijs_extra_auto','prijs_elektriciteit','prijs_afval_per_6',
      'toeristentaks','max_plaatsen','extra_tarieven','accommodatie_types'
    ])
  );
