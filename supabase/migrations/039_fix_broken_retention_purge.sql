-- ============================================================================
-- 039_fix_broken_retention_purge.sql
-- Beveiligingsaudit 2026-08-08 — bevinding F-16 (KRITIEK voor GDPR).
--
-- WAT ER MIS WAS
-- purge_expired_data() begon met `delete from storage.objects ...`. Supabase
-- heeft op storage.objects een BEFORE DELETE-statementtrigger
-- (storage.protect_delete) die élke rechtstreekse SQL-delete weigert tenzij de
-- sessievariabele storage.allow_delete_query op 'true' staat.
--
-- Gevolg: de functie wierp een exception en de HELE transactie rolde terug.
-- Niet alleen de storage-opruiming faalde — ook het wissen van gastgegevens na
-- 3 jaar, boekingen na 7 jaar en analytics na 14 maanden gebeurde niet.
--
-- Bewijs uit cron.job_run_details:
--   runid 1 · 2026-07-01 · succeeded
--   runid 2 · 2026-08-01 · FAILED · "Direct deletion from storage tables is
--            not allowed" · CONTEXT: purge_expired_data() line 11
-- (Juli slaagde nog; de platformtrigger is er tussen beide runs bijgekomen.)
--
-- WAAROM WE DE TRIGGER NIET GEWOON OMZEILEN
-- Je kunt set_config('storage.allow_delete_query','true',true) zetten en dan
-- lukt de delete wel. Dat is bewust NIET gedaan: een SQL-delete verwijdert
-- enkel de metadata-rij, niet de werkelijke bestandsbytes in de objectopslag.
-- Voor een AVG-bewaartermijn op foto's van identiteitskaarten is dat precies
-- het verkeerde resultaat: het bestand lijkt weg maar staat er nog. Daarom
-- verwijdert deze functie voortaan uitsluitend DATABANKRIJEN, en gebeurt de
-- echte bestandsverwijdering via de Storage-API in de edge function
-- `purge-storage` (die de service role gebruikt).
--
-- Rollback: 039_fix_broken_retention_purge_rollback.sql
-- ============================================================================

-- Read-only tegenhanger: geeft terug WELKE bestanden weg moeten. De edge
-- function leest dit en verwijdert ze via de Storage-API. Bewust geen delete
-- meer in SQL (zie hierboven).
create or replace function public.te_verwijderen_id_bestanden(p_respijt_dagen int default 7)
returns table(pad text, reden text)
language sql
security definer
set search_path to 'public'
as $function$
  -- (a) Verlopen: bewaartermijn na vertrek verstreken.
  select d.storage_path, 'bewaartermijn_verstreken'
    from booking_documents d
    join bookings bk on bk.id = d.booking_id
   where bk.vertrek < current_date - (
           coalesce((select value::int from settings
                      where key='id_bewaartermijn_dagen' and value ~ '^[0-9]+$'
                      order by updated_at desc limit 1), 90) || ' days')::interval
  union
  -- (b) Wees: bestand zonder enige actieve verwijzing. De respijtperiode
  --     voorkomt dat een net geüpload bestand wordt gewist in het venster
  --     tussen de storage-upload en de booking_documents-insert in
  --     guest-upload.
  select o.name, 'wees_zonder_verwijzing'
    from storage.objects o
   where o.bucket_id = 'id-fotos'
     and o.created_at < now() - (p_respijt_dagen || ' days')::interval
     and not exists (select 1 from booking_documents d
                      where d.storage_path = o.name and d.deleted_at is null)
     and not exists (select 1 from gasten g
                      where g.foto_url = o.name and g.deleted_at is null);
$function$;

revoke execute on function public.te_verwijderen_id_bestanden(int) from public;
revoke execute on function public.te_verwijderen_id_bestanden(int) from anon;
revoke execute on function public.te_verwijderen_id_bestanden(int) from authenticated;

-- De mislukte SQL-delete-variant uit 038 weer weghalen.
drop function if exists public.purge_orphan_id_documents(int);

-- purge_expired_data() zonder enige storage.objects-delete, zodat de
-- databankopruiming weer slaagt in plaats van elke maand terug te rollen.
create or replace function public.purge_expired_data()
returns table(deleted_gasten integer, deleted_bookings integer, deleted_clients integer, deleted_analytics integer, deleted_documenten integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  g int; b int; c int; a int; dd int; retention_days int;
begin
  select coalesce(
    (select value::int from settings
       where key='id_bewaartermijn_dagen' and value ~ '^[0-9]+$'
       order by updated_at desc limit 1), 90)
  into retention_days;

  -- 1. Documentrecords na de bewaartermijn. De BESTANDEN zelf worden
  --    opgeruimd door de edge function purge-storage via de Storage-API.
  with del as (
    delete from booking_documents d
    using bookings bk
    where d.booking_id = bk.id
      and bk.vertrek < current_date - (retention_days || ' days')::interval
    returning d.id
  ) select count(*) into dd from del;

  -- 2. Reizigersregister: persoonsgegevens van gasten na 3 jaar.
  with del as (
    delete from gasten gs using bookings bk
    where gs.booking_id = bk.id and bk.vertrek < (current_date - interval '3 years')
    returning gs.id
  ) select count(*) into g from del;

  -- 3. Volledige boekingen + afhankelijke records na 7 jaar (kindrecords eerst).
  delete from booking_documents where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from gasten        where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from communicatie  where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from payments      where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from booking_fotos where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  with del as (
    delete from bookings where vertrek < current_date - interval '7 years' returning id
  ) select count(*) into b from del;

  -- 4. Wees-klanten.
  with del as (
    delete from clients cl
    where not exists (select 1 from bookings bk where bk.client_id = cl.id)
      and cl.created_at < current_date - interval '7 years'
    returning cl.id
  ) select count(*) into c from del;

  -- 5. Analytics na 14 maanden.
  with del as (
    delete from analytics_events where created_at < now() - interval '14 months' returning id
  ) select count(*) into a from del;

  return query select g, b, c, a, dd;
end;
$function$;
