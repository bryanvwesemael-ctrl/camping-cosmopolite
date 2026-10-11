-- Hercontrole 2026-10-11, punt 3: het publieke formulier schrijft sinds deze
-- ronde via de create-booking edge function (server-side validatie + rate
-- limiting). De rechtstreekse anonieme INSERT-rechten zijn daardoor overbodig
-- en waren net het gat: wie de API rechtstreeks aansprak, omzeilde de
-- bot-bescherming van het formulier en kon onbeperkt nepaanvragen en
-- conceptmails met eigen tekst aanmaken.
--
-- PAS TOEPASSEN NADAT de nieuwe reserveren.html live staat — anders breekt
-- het formulier voor bezoekers met de oude versie.
drop policy if exists anon_insert_bookings          on public.bookings;
drop policy if exists anon_insert_clients           on public.clients;
drop policy if exists anon_insert_booking_kentekens on public.booking_kentekens;
drop policy if exists anon_insert_communicatie      on public.communicatie;
drop policy if exists anon_insert_gasten_v2         on public.gasten;

revoke insert on public.bookings, public.clients, public.booking_kentekens,
                 public.communicatie, public.gasten from anon;

-- analytics_events behoudt bewust zijn anon-INSERT (enkel vaste eventnamen,
-- geen persoonsgegevens, beperkte lengte).
