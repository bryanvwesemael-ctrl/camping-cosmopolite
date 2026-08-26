-- ============================================================================
-- 050_foto_90dagen_namen_7jaar.sql
-- Beslissing van Karen (26/08/2026, na feedback op de Verwerkersovereenkomst):
-- ze wil voortaan het ID zoveel mogelijk gewoon tonen en de gegevens zelf
-- overtypen — een foto blijft mogelijk maar wordt de uitzondering. Als er
-- toch een foto genomen wordt, wil ze die NIET 7 jaar bewaren. De namen
-- (register: naam, geboortedatum, nationaliteit, documentnummer) moeten wél
-- 7 jaar bewaard blijven, zoals de rest van het boekingsdossier.
--
-- Dit splitst voor het eerst de bewaring van de FOTO los van de bewaring van
-- de GASTEN-RIJ zelf (die voorheen samen bewaard/verwijderd werden):
--   - id_bewaartermijn_dagen: 2555 (7 jaar) -> 90 dagen. Deze instelling
--     stuurt zowel de vroege opruiming van booking_documents (publieke-
--     formulier-uploads) als, vanaf nu, het loskoppelen van gasten.foto_url.
--   - purge_expired_data(): de aparte "gasten na 3 jaar"-vroege-verwijdering
--     vervalt. De gasten-rij (namen/registergegevens) blijft nu gewoon staan
--     tot de bestaande, algemene 7-jaartermijn verderop in de functie —
--     exact wat Karen vraagt. In plaats daarvan wordt, binnen dezelfde
--     90-dagenlogica als booking_documents, enkel gasten.foto_url losgekoppeld
--     (geneutraliseerd naar NULL); de rest van de gasten-rij blijft intact.
--   - te_verwijderen_id_bestanden(): extra tak die ook gasten.foto_url-paden
--     rapporteert die de 90-dagentermijn overschreden hebben, zodat het
--     onderliggende bestand via purge-storage (nog steeds enkel handmatig,
--     met bevestig:true) opgeruimd kan worden. Bestanden die al wees zijn
--     (bv. omdat foto_url intussen al losgekoppeld is) worden sowieso al
--     gevangen door de bestaande wees-detectie in dezelfde functie.
--
-- Rollback: 050_foto_90dagen_namen_7jaar_rollback.sql
-- ============================================================================

update settings      set value = '90', updated_at = now() where key = 'id_bewaartermijn_dagen';
update club_settings set value = '90', updated_at = now() where key = 'id_bewaartermijn_dagen';

drop function if exists public.purge_expired_data();

create function public.purge_expired_data()
returns table(deleted_gasten integer, deleted_bookings integer, deleted_clients integer, deleted_analytics integer, deleted_documenten integer, deleted_fotos integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  g int; b int; c int; a int; dd int := 0; fd int := 0; retention_days int;
begin
  select coalesce(
    (select value::int from settings
       where key='id_bewaartermijn_dagen' and value ~ '^[0-9]+$'
       order by updated_at desc limit 1), 90)
  into retention_days;

  if retention_days > 0 then
    with del as (
      delete from booking_documents d
      using bookings bk
      where d.booking_id = bk.id
        and bk.vertrek < current_date - (retention_days || ' days')::interval
        and coalesce(bk.data_hold, false) = false
      returning d.id
    ) select count(*) into dd from del;

    -- Enkel de foto loskoppelen — de gasten-rij (naam/geboortedatum/
    -- nationaliteit/documentnummer) blijft staan tot de 7-jaartermijn
    -- verderop. Karen wil de namen wél 7 jaar bewaren, de foto niet.
    with del as (
      update gasten gs set foto_url = null
      from bookings bk
      where gs.booking_id = bk.id
        and gs.foto_url is not null
        and bk.vertrek < current_date - (retention_days || ' days')::interval
        and coalesce(bk.data_hold, false) = false
      returning gs.id
    ) select count(*) into fd from del;
  end if;

  -- Gasten-rij (namen/registergegevens) volgt voortaan dezelfde 7-jaartermijn
  -- als de rest van het dossier, niet langer een aparte, kortere termijn.
  delete from booking_documents where booking_id in (select id from bookings where vertrek < current_date - interval '7 years' and coalesce(data_hold,false) = false);
  delete from gasten        where booking_id in (select id from bookings where vertrek < current_date - interval '7 years' and coalesce(data_hold,false) = false);
  delete from communicatie  where booking_id in (select id from bookings where vertrek < current_date - interval '7 years' and coalesce(data_hold,false) = false);
  delete from payments      where booking_id in (select id from bookings where vertrek < current_date - interval '7 years' and coalesce(data_hold,false) = false);
  delete from booking_fotos where booking_id in (select id from bookings where vertrek < current_date - interval '7 years' and coalesce(data_hold,false) = false);
  with del as (
    delete from bookings where vertrek < current_date - interval '7 years' and coalesce(data_hold,false) = false returning id
  ) select count(*) into b from del;

  with del as (
    delete from clients cl
    where not exists (select 1 from bookings bk where bk.client_id = cl.id)
      and cl.created_at < current_date - interval '7 years'
    returning cl.id
  ) select count(*) into c from del;

  with del as (
    delete from analytics_events where created_at < now() - interval '14 months' returning id
  ) select count(*) into a from del;

  g := 0; -- geen vroege gasten-rij-verwijdering meer; "deleted_gasten" telt hier voortaan enkel de 7-jaarsopruiming (b hierboven telt bookings, gasten volgt automatisch mee via de FK)
  return query select g, b, c, a, dd, fd;
end;
$function$;

create or replace function public.te_verwijderen_id_bestanden(p_respijt_dagen int default 7, p_incl_wezen boolean default true)
returns table(pad text, reden text)
language sql
security definer
set search_path to 'public'
as $function$
  select d.storage_path, 'bewaartermijn_verstreken'
    from booking_documents d
    join bookings bk on bk.id = d.booking_id
   where (select coalesce((select value::int from settings
                            where key='id_bewaartermijn_dagen' and value ~ '^[0-9]+$'
                            order by updated_at desc limit 1), 90)) > 0
     and bk.vertrek < current_date - (
           coalesce((select value::int from settings
                      where key='id_bewaartermijn_dagen' and value ~ '^[0-9]+$'
                      order by updated_at desc limit 1), 90) || ' days')::interval
     and coalesce(bk.data_hold, false) = false
  union
  select gs.foto_url, 'bewaartermijn_verstreken'
    from gasten gs
    join bookings bk on bk.id = gs.booking_id
   where gs.foto_url is not null
     and (select coalesce((select value::int from settings
                            where key='id_bewaartermijn_dagen' and value ~ '^[0-9]+$'
                            order by updated_at desc limit 1), 90)) > 0
     and bk.vertrek < current_date - (
           coalesce((select value::int from settings
                      where key='id_bewaartermijn_dagen' and value ~ '^[0-9]+$'
                      order by updated_at desc limit 1), 90) || ' days')::interval
     and coalesce(bk.data_hold, false) = false
  union
  select o.name, 'wees_zonder_verwijzing'
    from storage.objects o
   where p_incl_wezen
     and o.bucket_id = 'id-fotos'
     and o.created_at < now() - (p_respijt_dagen || ' days')::interval
     and not exists (select 1 from booking_documents d
                      where d.storage_path = o.name and d.deleted_at is null)
     and not exists (select 1 from gasten g
                      where g.foto_url = o.name and g.deleted_at is null);
$function$;
