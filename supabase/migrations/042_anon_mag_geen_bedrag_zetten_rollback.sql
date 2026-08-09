-- Rollback van 042. LET OP: dit herstelt een bewezen kwetsbaarheid — de client
-- mag dan opnieuw zelf het bedrag bepalen en een boeking van €0 indienen.
drop policy if exists anon_insert_bookings on bookings;
create policy anon_insert_bookings on bookings for insert to anon
  with check (
    status = 'aanvraag'::booking_status and bron = 'website'::booking_bron
    and ai_draft = false and ingecheckt_at is null and uitgecheckt_at is null
    and waarborg_ontvangen_at is null and waarborg_teruggegeven_at is null
    and deleted_at is null and created_by is null
    and controle_id = false and controle_kenteken = false and controle_personen = false
    and coalesce(bedrag_totaal,0) >= 0 and coalesce(bedrag_per_nacht,0) >= 0
    and vertrek > aankomst
    and aankomst >= (current_date - 7) and aankomst <= (current_date + 1095)
    and ((volwassenen + kinderen + baby) >= 1 and (volwassenen + kinderen + baby) <= 60)
    and (tenten >= 0 and tenten <= 50) and (campers >= 0 and campers <= 50)
    and (honden >= 0 and honden <= 20) and (autos >= 0 and autos <= 50)
    and length(coalesce(nota,'')) <= 2000
  );
