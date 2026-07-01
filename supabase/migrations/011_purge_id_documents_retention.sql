-- ============================================================================
-- 011_purge_id_documents_retention.sql  (Fase 7 — privacy/bewaartermijn)
-- Werkt purge_expired_data() bij zodat:
--  (a) de ID-scans (booking_documents) + hun storage-objecten worden verwijderd
--      X dagen na vertrek — instelbaar via settings-key 'id_bewaartermijn_dagen'
--      (default 90). Bewust NIET standaard 7 jaar (sectie 18: originele
--      ID-kopieën mogen niet automatisch even lang bewaard worden als het
--      register zonder aparte rechtsgrond).
--  (b) booking_documents vóór bookings worden verwijderd in het 7-jaar-blok
--      (latente FK-fout: booking_documents verwijst naar bookings).
--
-- Blijft SECURITY DEFINER, draait via de bestaande pg_cron-job (als postgres).
-- Rollback: 011_purge_id_documents_retention_rollback.sql (herstelt 001-versie
-- zonder document-opruiming — enkel voor noodgeval).
-- ============================================================================
create or replace function public.purge_expired_data()
returns table(deleted_gasten integer, deleted_bookings integer, deleted_clients integer, deleted_analytics integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  g int; b int; c int; a int; retention_days int;
begin
  -- 0. Instelbare bewaartermijn voor ORIGINELE ID-afbeeldingen (default 90 dagen).
  select coalesce(
    (select value::int from settings
       where key='id_bewaartermijn_dagen' and value ~ '^[0-9]+$'
       order by updated_at desc limit 1), 90)
  into retention_days;

  -- 0a. Storage-objecten van verlopen ID-documenten verwijderen.
  delete from storage.objects o
  using booking_documents d, bookings bk
  where o.bucket_id='id-fotos' and o.name = d.storage_path
    and d.booking_id = bk.id
    and bk.vertrek < current_date - (retention_days || ' days')::interval;

  -- 0b. De documentrecords zelf verwijderen.
  delete from booking_documents d
  using bookings bk
  where d.booking_id = bk.id
    and bk.vertrek < current_date - (retention_days || ' days')::interval;

  -- 1. Reizigersregister: persoonsgegevens van gasten na 3 jaar wissen.
  with del as (
    delete from gasten gs using bookings bk
    where gs.booking_id = bk.id and bk.vertrek < (current_date - interval '3 years')
    returning gs.id
  ) select count(*) into g from del;

  -- 2. Volledige boekingen + afhankelijke records na 7 jaar (kindrecords eerst).
  delete from booking_documents where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from gasten        where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from communicatie  where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from payments      where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from booking_fotos where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  with del as (
    delete from bookings where vertrek < current_date - interval '7 years' returning id
  ) select count(*) into b from del;

  -- 3. Wees-klanten opruimen.
  with del as (
    delete from clients cl
    where not exists (select 1 from bookings bk where bk.client_id = cl.id)
      and cl.created_at < current_date - interval '7 years'
    returning cl.id
  ) select count(*) into c from del;

  -- 4. Analytics na 14 maanden.
  with del as (
    delete from analytics_events where created_at < now() - interval '14 months' returning id
  ) select count(*) into a from del;

  return query select g, b, c, a;
end;
$function$;
