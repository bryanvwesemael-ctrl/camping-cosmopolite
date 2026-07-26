-- ============================================================================
-- 030_anon_insert_booking_kentekens.sql
-- Het publieke reserveringsformulier (reserveren.html) mag vanaf nu de
-- kentekens die de gast opgeeft rechtstreeks in booking_kentekens zetten
-- (naast het bestaande clients.nummerplaten-veld), zodat ze meteen in de
-- slagboom-tracker staan. Zelfde patroon als anon_insert_bookings/_clients
-- uit 001_init.sql: anon mag enkel INSERTEN, geen select/update/delete.
--
-- Rollback: 030_anon_insert_booking_kentekens_rollback.sql
-- ============================================================================
create policy anon_insert_booking_kentekens on booking_kentekens
  for insert to anon with check (true);
