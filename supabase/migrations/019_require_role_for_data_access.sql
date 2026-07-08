-- ============================================================================
-- 019_require_role_for_data_access.sql
-- KRITIEKE FIX: Supabase security advisor + Bryan's vraag ("kan iedereen dan
-- inloggen?") legden bloot dat de kern-tabellen (bookings, clients, gasten,
-- communicatie, payments, booking_fotos) een RLS-policy hadden van
-- `to authenticated using (true)` — d.w.z. ELKE ingelogde account (ongeacht of
-- die uberhaupt een rij in user_roles heeft) kreeg volledige lees/schrijf-
-- toegang tot alle boekingen, gastgegevens en betalingen. De admin/staff-check
-- (applyRoleVisibility) verborg enkel nav-tabbladen client-side — dat is geen
-- toegangscontrole, dat is alleen UI-cosmetica.
--
-- Karen wil wel via de app nieuwe gebruikers kunnen toevoegen (invite-user,
-- al admin-gated) als gewone staff-gebruiker — dus deze fix mag STAFF niet
-- uitsluiten, enkel bare authenticated-accounts zonder rol in user_roles
-- (bv. als zelfregistratie ooit per ongeluk aan zou staan, of een lek van een
-- invite-link naar iemand die nooit een rol kreeg toegewezen).
--
-- FIX: nieuwe helper public.has_role() (SECURITY DEFINER, zelfde patroon als
-- is_admin() uit migratie 010) — true zodra er OM HET EVEN welke rij in
-- user_roles bestaat voor de ingelogde gebruiker (staff of admin). Vervangt
-- `using (true)` door `using (public.has_role())` op de tabellen die eerder
-- open stonden voor élke authenticated gebruiker.
--
-- Bewust NIET aangeraakt: bezoekers, booking_documents, club_settings,
-- user_roles — die staan al correct op is_admin() en blijven admin-only.
--
-- Rollback: 019_require_role_for_data_access_rollback.sql
-- ============================================================================

create or replace function public.has_role(uid uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (select 1 from user_roles where user_id = uid);
$$;
revoke all on function public.has_role(uuid) from public;
grant execute on function public.has_role(uuid) to authenticated;

drop policy if exists authenticated_full_bookings on bookings;
create policy authenticated_full_bookings on bookings
  for all to authenticated using (public.has_role()) with check (public.has_role());

drop policy if exists authenticated_full_clients on clients;
create policy authenticated_full_clients on clients
  for all to authenticated using (public.has_role()) with check (public.has_role());

drop policy if exists auth_all_gasten on gasten;
create policy auth_all_gasten on gasten
  for all to authenticated using (public.has_role()) with check (public.has_role());

drop policy if exists authenticated_full_communicatie on communicatie;
create policy authenticated_full_communicatie on communicatie
  for all to authenticated using (public.has_role()) with check (public.has_role());

drop policy if exists auth_all_payments on payments;
create policy auth_all_payments on payments
  for all to authenticated using (public.has_role()) with check (public.has_role());

drop policy if exists auth_all_fotos on booking_fotos;
create policy auth_all_fotos on booking_fotos
  for all to authenticated using (public.has_role()) with check (public.has_role());

drop policy if exists auth_read_analytics on analytics_events;
create policy auth_read_analytics on analytics_events
  for select to authenticated using (public.has_role());

drop policy if exists auth_read_audit on audit_logs;
create policy auth_read_audit on audit_logs
  for select to authenticated using (public.has_role());

-- Storage: dezelfde open-voor-elke-authenticated-account-gat op de
-- booking-fotos bucket (id-fotos was al admin-only via migratie 011).
drop policy if exists auth_read_booking_fotos on storage.objects;
create policy auth_read_booking_fotos on storage.objects
  for select to authenticated using (bucket_id = 'booking-fotos' and public.has_role());

drop policy if exists auth_del_booking_fotos on storage.objects;
create policy auth_del_booking_fotos on storage.objects
  for delete to authenticated using (bucket_id = 'booking-fotos' and public.has_role());
