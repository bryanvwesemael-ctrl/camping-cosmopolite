-- Rollback voor 046_storing_bevestigen.sql

revoke execute on function public.bevestig_storing(bigint, bigint) from authenticated;
drop function if exists public.bevestig_storing(bigint, bigint);
drop table if exists public.systeem_storing_bevestigd;

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
