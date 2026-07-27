-- ============================================================================
-- 031_harden_anon_insert_policies.sql
-- De anon-INSERT-policies stonden allemaal op `with check (true)`: een
-- anonieme bezoeker met de publieke anon-key kon dus wíllekeurige rijen
-- schrijven. Concreet misbruik dat vandaag mogelijk is:
--   * een boeking aanmaken met status 'betaald' en bedrag 0 → gratis verblijf;
--   * ingecheckt_at / waarborg_ontvangen_at invullen → fiche ziet er in het
--     dashboard afgehandeld uit terwijl er niets gebeurd is;
--   * valse INKOMENDE berichten in communicatie injecteren die Karen als
--     echte gastmail leest;
--   * een kenteken al als "in de slagboom ingegeven" aanleveren.
--
-- Deze migratie beperkt elke anon-policy tot exact wat het publieke
-- reserveringsformulier (reserveren.html) nodig heeft. Anon had en houdt
-- GEEN select/update/delete op deze tabellen — er was dus geen leeslek.
--
-- Rollback: 031_harden_anon_insert_policies_rollback.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ongebruikte anon-policies volledig verwijderen.
--    Het publieke formulier schrijft enkel naar clients, bookings,
--    booking_kentekens, communicatie en analytics_events. Gasten en foto's
--    lopen uitsluitend via Edge Functions op de service-role key (die RLS
--    sowieso omzeilt). Deze twee policies zijn dus puur aanvalsoppervlak.
-- ---------------------------------------------------------------------------
drop policy if exists anon_insert_gasten on gasten;
drop policy if exists anon_insert_fotos  on booking_fotos;

-- ---------------------------------------------------------------------------
-- 2. bookings — de belangrijkste. Een aanvraag van de website is altijd een
--    nieuwe, onbetaalde, niet-ingecheckte aanvraag.
-- ---------------------------------------------------------------------------
drop policy if exists anon_insert_bookings on bookings;
create policy anon_insert_bookings on bookings for insert to anon
with check (
      status   = 'aanvraag'::booking_status
  and bron     = 'website'::booking_bron
  and ai_draft = false
  and ingecheckt_at            is null
  and uitgecheckt_at           is null
  and waarborg_ontvangen_at    is null
  and waarborg_teruggegeven_at is null
  and deleted_at               is null
  and created_by               is null
  and controle_id       = false
  and controle_kenteken = false
  and controle_personen = false
  and coalesce(bedrag_totaal,    0) >= 0
  and coalesce(bedrag_per_nacht, 0) >= 0
  and vertrek  > aankomst
  and aankomst >= current_date - 7      -- geen boekingen ver in het verleden
  and aankomst <= current_date + 1095   -- en niet meer dan ~3 jaar vooruit
  and (volwassenen + kinderen + baby) between 1 and 60
  and tenten  between 0 and 50
  and campers between 0 and 50
  and honden  between 0 and 20
  and autos   between 0 and 50
  and length(coalesce(nota, '')) <= 2000
);

-- ---------------------------------------------------------------------------
-- 3. communicatie — anon mag enkel een UITGAAND CONCEPT bij een boeking
--    zetten (de bevestigingsmail-draft). Nooit 'inkomend', nooit 'verzonden'.
-- ---------------------------------------------------------------------------
drop policy if exists anon_insert_communicatie on communicatie;
create policy anon_insert_communicatie on communicatie for insert to anon
with check (
      richting = 'uitgaand'::comm_richting
  and status   = 'concept'::comm_status
  and verzonden_at     is null
  and gmail_message_id is null
  and gmail_thread_id  is null
  and length(coalesce(onderwerp, '')) <= 300
  and length(coalesce(inhoud,    '')) <= 5000
);

-- ---------------------------------------------------------------------------
-- 4. booking_kentekens — een kenteken dat de gast zelf opgeeft staat per
--    definitie nog NIET in de slagboom; dat vinkje zet enkel het personeel.
-- ---------------------------------------------------------------------------
drop policy if exists anon_insert_booking_kentekens on booking_kentekens;
create policy anon_insert_booking_kentekens on booking_kentekens for insert to anon
with check (
      slagboom_ingegeven = false
  and slagboom_ingegeven_at is null
  and length(btrim(plaat)) between 1 and 15
);

-- ---------------------------------------------------------------------------
-- 5. clients — plausibele invoer afdwingen (en geen id_foto_url laten zetten;
--    foto's lopen enkel via de guest-upload Edge Function).
-- ---------------------------------------------------------------------------
drop policy if exists anon_insert_clients on clients;
create policy anon_insert_clients on clients for insert to anon
with check (
      length(btrim(naam))  between 1 and 120
  and length(btrim(email)) between 3 and 160
  and email like '%@%'
  and id_foto_url is null
  and length(coalesce(telefoon,      '')) <= 40
  and length(coalesce(id_nummer,     '')) <= 40
  and length(coalesce(nummerplaten,  '')) <= 200
  and length(coalesce(nationaliteit, '')) <= 80
  and length(coalesce(woonplaats,    '')) <= 160
);

-- ---------------------------------------------------------------------------
-- 6. analytics_events — enkel de vier events die het formulier verstuurt.
-- ---------------------------------------------------------------------------
drop policy if exists anon_insert_analytics on analytics_events;
create policy anon_insert_analytics on analytics_events for insert to anon
with check (
      event in ('form_start', 'field_focus', 'submit', 'abandon')
  and length(coalesce(session_id, '')) <= 64
);
