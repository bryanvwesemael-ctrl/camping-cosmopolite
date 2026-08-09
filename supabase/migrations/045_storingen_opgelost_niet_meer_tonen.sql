-- ============================================================================
-- 045_storingen_opgelost_niet_meer_tonen.sql
-- Vervolg op F-16 (043_alerting_geplande_taken.sql).
--
-- systeem_storingen() toonde elke mislukte run binnen de laatste 90 dagen,
-- ook als de oorzaak al lang gefixt was en de taak nadien gewoon weer
-- succesvol draaide. De storing van 1 augustus (storage.protect_delete-fout,
-- opgelost via migratie 039) bleef daardoor tot eind oktober als actieve
-- waarschuwing op het dashboard staan, terwijl er niets meer aan de hand was.
--
-- Fix: een mislukte run wordt alleen nog getoond als er voor diezelfde job
-- NOG GEEN latere geslaagde run is geweest. Zodra de taak één keer opnieuw
-- slaagt, verdwijnt de oude waarschuwing vanzelf.
--
-- Rollback: 045_storingen_opgelost_niet_meer_tonen_rollback.sql
-- ============================================================================
create or replace function public.systeem_storingen(p_dagen int default 90)
returns table(taak text, wanneer timestamptz, melding text)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not has_role() then
    raise exception 'Geen toegang';
  end if;

  return query
    select coalesce(j.jobname, 'job ' || d.jobid::text),
           d.start_time,
           left(coalesce(d.return_message, 'onbekende fout'), 500)
      from cron.job_run_details d
      left join cron.job j on j.jobid = d.jobid
     where d.status <> 'succeeded'
       and d.start_time > now() - (p_dagen || ' days')::interval
       and not exists (
         select 1 from cron.job_run_details later
          where later.jobid = d.jobid
            and later.status = 'succeeded'
            and later.start_time > d.start_time
       )
     order by d.start_time desc
     limit 20;
end;
$function$;
