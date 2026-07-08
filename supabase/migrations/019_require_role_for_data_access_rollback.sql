-- ROLLBACK voor 019_require_role_for_data_access.sql
-- Let op: dit herstelt de OPEN (elke authenticated account, ongeacht rol)
-- policies — enkel gebruiken als de nieuwe versie onverwacht problemen geeft.

drop policy if exists authenticated_full_bookings on bookings;
create policy authenticated_full_bookings on bookings for all to authenticated using (true) with check (true);

drop policy if exists authenticated_full_clients on clients;
create policy authenticated_full_clients on clients for all to authenticated using (true) with check (true);

drop policy if exists auth_all_gasten on gasten;
create policy auth_all_gasten on gasten for all to authenticated using (true) with check (true);

drop policy if exists authenticated_full_communicatie on communicatie;
create policy authenticated_full_communicatie on communicatie for all to authenticated using (true) with check (true);

drop policy if exists auth_all_payments on payments;
create policy auth_all_payments on payments for all to authenticated using (true);

drop policy if exists auth_all_fotos on booking_fotos;
create policy auth_all_fotos on booking_fotos for all to authenticated using (true) with check (true);

drop policy if exists auth_read_analytics on analytics_events;
create policy auth_read_analytics on analytics_events for select to authenticated using (true);

drop policy if exists auth_read_audit on audit_logs;
create policy auth_read_audit on audit_logs for select to authenticated using (true);

drop policy if exists auth_read_booking_fotos on storage.objects;
create policy auth_read_booking_fotos on storage.objects for select to authenticated using (bucket_id = 'booking-fotos');

drop policy if exists auth_del_booking_fotos on storage.objects;
create policy auth_del_booking_fotos on storage.objects for delete to authenticated using (bucket_id = 'booking-fotos');

drop function if exists public.has_role(uuid);
