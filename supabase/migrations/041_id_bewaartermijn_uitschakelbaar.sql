-- ============================================================================
-- 041_id_bewaartermijn_uitschakelbaar.sql
--
-- Bewuste keuze van de uitbater (2026-08-08): de foto's van
-- identiteitsdocumenten blijven bewaard; er komt geen automatische
-- verwijdering na 90 dagen. Het privacybeleid is in dezelfde wijziging
-- aangepast zodat het beschrijft wat er werkelijk gebeurt — dat is het
-- belangrijkste punt: je mag een gast niet iets beloven wat je niet doet.
--
-- Implementatie: de bestaande instelling 'id_bewaartermijn_dagen' krijgt een
-- afspraak erbij — de waarde 0 betekent "niet automatisch verwijderen".
-- Zo blijft het mechanisme intact en volstaat het later een getal in te
-- vullen om het weer aan te zetten, zonder codewijziging.
--
-- Wat NIET verandert: de overige bewaartermijnen blijven gewoon draaien —
-- gastgegevens na 3 jaar, volledige boekingen na 7 jaar, analytics na 14
-- maanden. Enkel de ID-afbeeldingen worden uitgezonderd.
--
-- Let op bij een eventuele juridische toetsing: onbeperkt bewaren is de
-- moeilijkst te verdedigen positie onder het beginsel van opslagbeperking
-- (AVG art. 5(1)(e)). Een termijn die aansluit bij het reizigersregister
-- (3 jaar) of de boekhouding (7 jaar) is aanzienlijk beter te onderbouwen.
-- Dat is een keuze voor de verwerkingsverantwoordelijke, niet voor de
-- ontwikkelaar — vandaar dat de knop hier blijft bestaan.
--
-- Rollback: 041_id_bewaartermijn_uitschakelbaar_rollback.sql
-- ============================================================================

-- 1. Instelling op 0 = geen automatische verwijdering van ID-afbeeldingen.
insert into club_settings (key, value)
values ('id_bewaartermijn_dagen', '0')
on conflict (key) do update set value = '0', updated_at = now();

update settings set value = '0', updated_at = now()
 where key = 'id_bewaartermijn_dagen';

-- 2. purge_expired_data(): documentrijen enkel opruimen als er een termijn
--    > 0 is ingesteld.
create or replace function public.purge_expired_data()
returns table(deleted_gasten integer, deleted_bookings integer, deleted_clients integer, deleted_analytics integer, deleted_documenten integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  g int; b int; c int; a int; dd int := 0; retention_days int;
begin
  select coalesce(
    (select value::int from settings
       where key='id_bewaartermijn_dagen' and value ~ '^[0-9]+$'
       order by updated_at desc limit 1), 90)
  into retention_days;

  -- 0 = bewust uitgeschakeld: ID-documenten blijven bewaard.
  if retention_days > 0 then
    with del as (
      delete from booking_documents d
      using bookings bk
      where d.booking_id = bk.id
        and bk.vertrek < current_date - (retention_days || ' days')::interval
      returning d.id
    ) select count(*) into dd from del;
  end if;

  -- De overige bewaartermijnen blijven onverkort gelden.
  with del as (
    delete from gasten gs using bookings bk
    where gs.booking_id = bk.id and bk.vertrek < (current_date - interval '3 years')
    returning gs.id
  ) select count(*) into g from del;

  delete from booking_documents where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from gasten        where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from communicatie  where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from payments      where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from booking_fotos where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  with del as (
    delete from bookings where vertrek < current_date - interval '7 years' returning id
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

  return query select g, b, c, a, dd;
end;
$function$;

-- 3. Ook de opsomming van te wissen bestanden respecteert de uitschakeling,
--    zodat purge-storage niets aanbiedt wat bewaard moet blijven. De
--    wees-opruiming blijft wél actief: bestanden zonder enige verwijzing zijn
--    onbereikbaar voor de applicatie en horen sowieso niet te blijven staan.
--    (Zet p_incl_wezen op false om ook die te behouden.)
create or replace function public.te_verwijderen_id_bestanden(
  p_respijt_dagen int default 7,
  p_incl_wezen boolean default true
)
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

revoke execute on function public.te_verwijderen_id_bestanden(int, boolean) from public;
revoke execute on function public.te_verwijderen_id_bestanden(int, boolean) from anon;
revoke execute on function public.te_verwijderen_id_bestanden(int, boolean) from authenticated;
