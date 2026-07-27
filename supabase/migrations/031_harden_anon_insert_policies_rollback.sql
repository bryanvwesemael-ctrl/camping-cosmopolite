-- ROLLBACK voor 031_harden_anon_insert_policies.sql
-- Zet de oude, volledig permissieve anon-INSERT-policies terug.
-- LET OP: hierna kan een anonieme bezoeker opnieuw willekeurige rijen
-- schrijven (o.a. een boeking met status 'betaald' en bedrag 0).
drop policy if exists anon_insert_bookings          on bookings;
drop policy if exists anon_insert_communicatie      on communicatie;
drop policy if exists anon_insert_booking_kentekens on booking_kentekens;
drop policy if exists anon_insert_clients           on clients;
drop policy if exists anon_insert_analytics         on analytics_events;

create policy anon_insert_clients           on clients           for insert to anon with check (true);
create policy anon_insert_bookings          on bookings          for insert to anon with check (true);
create policy anon_insert_gasten            on gasten            for insert to anon with check (true);
create policy anon_insert_communicatie      on communicatie      for insert to anon with check (true);
create policy anon_insert_fotos             on booking_fotos     for insert to anon with check (true);
create policy anon_insert_analytics         on analytics_events  for insert to anon with check (true);
create policy anon_insert_booking_kentekens on booking_kentekens for insert to anon with check (true);
