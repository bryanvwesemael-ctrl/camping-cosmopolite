-- ============================================================================
-- 042_anon_mag_geen_bedrag_zetten.sql
-- Beveiligingsaudit 2026-08-08, bevinding F-03 (HOOG).
--
-- HET PROBLEEM
-- bedrag_totaal en bedrag_per_nacht werden in de browser berekend en
-- rechtstreeks weggeschreven. De policy controleerde enkel ">= 0". Tijdens de
-- audit is buiten het formulier om een boeking aangemaakt van 14 nachten voor
-- 6 volwassenen, 3 honden, 4 auto's en elektriciteit — voor €0. Reële
-- richtprijs ongeveer €1.200. (Testrecord meteen verwijderd.)
--
-- DE OPLOSSING
-- De client mag het bedrag niet langer meesturen: beide velden MOETEN NULL
-- zijn bij een anon-insert. Het dashboard berekent het bedrag zelf met
-- dezelfde gedeelde logica (shared/pricing.js) zodra de aanvraag getoond
-- wordt. Zo blijft er één bron van waarheid en is manipulatie per definitie
-- onmogelijk — er valt niets meer te manipuleren.
--
-- Bewust NIET gekozen: een databanktrigger die de prijs herberekent. Dat zou
-- de volledige prijslogica in PL/pgSQL dupliceren naast shared/pricing.js, en
-- twee bronnen van waarheid zijn precies wat eerder in dit project bewust is
-- opgeruimd.
--
-- EXTRA IN DEZELFDE POLICY: extra_type_units toegelaten en begrensd.
-- Het formulier telde safaritenten en stacaravans vroeger gewoon op bij
-- 'tenten' en bewaarde het type enkel als tekstlabel. Daardoor kon het
-- dashboard niet correct herberekenen (een safaritent van €100 zou als tent
-- van €15 tellen) en zag de verhuurkalender die boekingen niet. Het formulier
-- stuurt de types nu gestructureerd mee, net als het dashboard al deed bij een
-- handmatige reservering. De lengtegrens houdt de invoer begrensd.
--
-- Rollback: 042_anon_mag_geen_bedrag_zetten_rollback.sql
-- ============================================================================
drop policy if exists anon_insert_bookings on bookings;

create policy anon_insert_bookings on bookings for insert to anon
  with check (
    status = 'aanvraag'::booking_status
    and bron = 'website'::booking_bron
    and ai_draft = false
    and ingecheckt_at is null
    and uitgecheckt_at is null
    and waarborg_ontvangen_at is null
    and waarborg_teruggegeven_at is null
    and deleted_at is null
    and created_by is null
    and controle_id = false
    and controle_kenteken = false
    and controle_personen = false
    -- F-03: het bedrag komt NIET van de client.
    and bedrag_totaal is null
    and bedrag_per_nacht is null
    -- Gestructureerde verblijfstypes toegelaten, maar begrensd.
    and length(coalesce(extra_type_units::text, '')) <= 4000
    and vertrek > aankomst
    and aankomst >= (current_date - 7)
    and aankomst <= (current_date + 1095)
    and ((volwassenen + kinderen + baby) >= 1 and (volwassenen + kinderen + baby) <= 60)
    and (tenten >= 0 and tenten <= 50)
    and (campers >= 0 and campers <= 50)
    and (honden >= 0 and honden <= 20)
    and (autos >= 0 and autos <= 50)
    and length(coalesce(nota, '')) <= 2000
  );
