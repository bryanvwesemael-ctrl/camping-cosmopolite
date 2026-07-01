-- ROLLBACK voor 011_purge_id_documents_retention.sql
-- Herstelt de vorige purge-versie ZONDER document-opruiming. Let op: hierdoor
-- worden ID-scans niet meer automatisch verwijderd en keert de latente FK-fout
-- terug bij 7-jaar-oude boekingen met documenten. Enkel voor noodgeval.
create or replace function public.purge_expired_data()
returns table(deleted_gasten integer, deleted_bookings integer, deleted_clients integer, deleted_analytics integer)
language plpgsql security definer set search_path to 'public' as $function$
declare g int; b int; c int; a int;
begin
  with del as (delete from gasten gs using bookings bk
    where gs.booking_id = bk.id and bk.vertrek < (current_date - interval '3 years') returning gs.id
  ) select count(*) into g from del;
  delete from gasten        where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from communicatie  where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from payments      where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  delete from booking_fotos where booking_id in (select id from bookings where vertrek < current_date - interval '7 years');
  with del as (delete from bookings where vertrek < current_date - interval '7 years' returning id) select count(*) into b from del;
  with del as (delete from clients cl where not exists (select 1 from bookings bk where bk.client_id = cl.id)
      and cl.created_at < current_date - interval '7 years' returning cl.id) select count(*) into c from del;
  with del as (delete from analytics_events where created_at < now() - interval '14 months' returning id) select count(*) into a from del;
  return query select g, b, c, a;
end;
$function$;
