-- Rollback voor 045_storingen_opgelost_niet_meer_tonen.sql
-- Herstelt de vorige versie van systeem_storingen() (uit 043), zonder de
-- "is later opgelost"-filter.
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
     order by d.start_time desc
     limit 20;
end;
$function$;
