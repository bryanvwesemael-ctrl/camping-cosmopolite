-- ============================================================================
-- 038_purge_orphan_id_documents.sql
-- Beveiligingsaudit 2026-08-08, bevinding F-02.
--
-- Het probleem: purge_expired_data() zoekt te verwijderen storage-objecten via
-- een JOIN op booking_documents (o.name = d.storage_path). Wanneer het
-- dashboard een boeking verwijdert, gaat die DB-rij weg terwijl het bestand
-- blijft staan (de storage.remove()-aanroep faalde stil omdat er geen
-- DELETE-policy was — zie 037). Vanaf dat moment is het bestand voor élk
-- automatisme onvindbaar: er is geen rij meer om op te joinen.
--
-- Gemeten op 2026-08-08: 210 objecten in id-fotos, waarvan 81 zonder enige
-- actieve verwijzing. Dat zijn foto's van identiteitskaarten en paspoorten van
-- echte gasten die volgens het privacybeleid al verwijderd hadden moeten zijn.
--
-- Deze migratie voegt een expliciete wees-opruiming toe en hangt die in de
-- bestaande maandelijkse pg_cron-job.
--
-- BEWUSTE KEUZE — respijtperiode van 7 dagen: guest-upload schrijft eerst het
-- bestand naar storage en pas daarna de booking_documents-rij. Zonder respijt
-- zou een opruiming die precies tussen die twee stappen valt een net geüpload,
-- volkomen geldig document wissen. 7 dagen is ruim genoeg om die race
-- onmogelijk te maken, en kort genoeg om wezen niet te laten liggen.
--
-- Rollback: 038_purge_orphan_id_documents_rollback.sql
-- ============================================================================

create or replace function public.purge_orphan_id_documents(p_respijt_dagen int default 7)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n int;
begin
  with weg as (
    delete from storage.objects o
    where o.bucket_id = 'id-fotos'
      and o.created_at < now() - (p_respijt_dagen || ' days')::interval
      and not exists (
        select 1 from booking_documents d
         where d.storage_path = o.name and d.deleted_at is null)
      and not exists (
        select 1 from gasten g
         where g.foto_url = o.name and g.deleted_at is null)
    returning o.id
  ) select count(*) into n from weg;
  return n;
end;
$function$;

-- Enkel de geplande job (postgres) en de backend mogen dit aanroepen.
revoke execute on function public.purge_orphan_id_documents(int) from public;
revoke execute on function public.purge_orphan_id_documents(int) from anon;
revoke execute on function public.purge_orphan_id_documents(int) from authenticated;

-- Aanhaken in de bestaande maandelijkse GDPR-opruiming, zodat wezen die
-- ontstaan door een verwijderde boeking voortaan vanzelf verdwijnen.
create or replace function public.purge_expired_data()
returns table(deleted_gasten integer, deleted_bookings integer, deleted_clients integer, deleted_analytics integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  g int; b int; c int; a int; retention_days int;
begin
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

  -- 0c. NIEUW (audit F-02): wees-bestanden zonder enige DB-verwijzing.
  --     Moet ná 0a/0b staan: die twee maken zelf ook wezen aan.
  perform public.purge_orphan_id_documents(7);

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
