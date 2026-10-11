-- Rollback van 053: herstelt de anonieme INSERT-policies zoals ze stonden
-- vóór 2026-10-11 (definities uit pg_policies op die datum).
grant insert on public.bookings, public.clients, public.booking_kentekens,
                public.communicatie, public.gasten to anon;

create policy anon_insert_bookings on public.bookings for insert to anon with check (
  (status = 'aanvraag'::booking_status) AND (bron = 'website'::booking_bron) AND (ai_draft = false)
  AND (ingecheckt_at IS NULL) AND (uitgecheckt_at IS NULL) AND (waarborg_ontvangen_at IS NULL)
  AND (waarborg_teruggegeven_at IS NULL) AND (deleted_at IS NULL) AND (created_by IS NULL)
  AND (controle_id = false) AND (controle_kenteken = false) AND (controle_personen = false)
  AND (bedrag_totaal IS NULL) AND (bedrag_per_nacht IS NULL)
  AND (length(COALESCE((extra_type_units)::text, ''::text)) <= 4000) AND (vertrek > aankomst)
  AND (aankomst >= (CURRENT_DATE - 7)) AND (aankomst <= (CURRENT_DATE + 1095))
  AND ((((volwassenen + kinderen) + baby) >= 1) AND (((volwassenen + kinderen) + baby) <= 60))
  AND ((tenten >= 0) AND (tenten <= 50)) AND ((campers >= 0) AND (campers <= 50))
  AND ((honden >= 0) AND (honden <= 20)) AND ((autos >= 0) AND (autos <= 50))
  AND (length(COALESCE(nota, ''::text)) <= 2000));

create policy anon_insert_clients on public.clients for insert to anon with check (
  ((length(btrim(naam)) >= 1) AND (length(btrim(naam)) <= 120))
  AND ((length(btrim(email)) >= 3) AND (length(btrim(email)) <= 160)) AND (email ~~ '%@%'::text)
  AND (id_foto_url IS NULL) AND (length(COALESCE(telefoon, ''::text)) <= 40)
  AND (length(COALESCE(id_nummer, ''::text)) <= 40) AND (length(COALESCE(nummerplaten, ''::text)) <= 200)
  AND (length(COALESCE(nationaliteit, ''::text)) <= 80) AND (length(COALESCE(woonplaats, ''::text)) <= 160));

create policy anon_insert_booking_kentekens on public.booking_kentekens for insert to anon with check (
  (slagboom_ingegeven = false) AND (slagboom_ingegeven_at IS NULL)
  AND ((length(btrim(plaat)) >= 1) AND (length(btrim(plaat)) <= 15)));

create policy anon_insert_communicatie on public.communicatie for insert to anon with check (
  (richting = 'uitgaand'::comm_richting) AND (status = 'concept'::comm_status) AND (verzonden_at IS NULL)
  AND (gmail_message_id IS NULL) AND (gmail_thread_id IS NULL)
  AND (length(COALESCE(onderwerp, ''::text)) <= 300) AND (length(COALESCE(inhoud, ''::text)) <= 5000));

create policy anon_insert_gasten_v2 on public.gasten for insert to anon with check (
  (length(btrim(naam)) >= 1) AND (length(btrim(naam)) <= 120) AND (foto_url IS NULL) AND (deleted_at IS NULL)
  AND ((id_consent = false) OR (is_hoofdgast = true)) AND (length(COALESCE(nationaliteit, ''::text)) <= 80)
  AND (length(COALESCE(id_nummer, ''::text)) <= 40) AND (length(COALESCE(nummerplaat, ''::text)) <= 30)
  AND (length(COALESCE(geboorteplaats, ''::text)) <= 80) AND (length(COALESCE(documenttype, ''::text)) <= 40));
