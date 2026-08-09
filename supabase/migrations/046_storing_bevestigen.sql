-- ============================================================================
-- 046_storing_bevestigen.sql
-- Vervolg op F-16 / 045.
--
-- Aanleiding: de storing van 1 augustus is al maanden geleden inhoudelijk
-- opgelost (migratie 039), maar de eerstvolgende taak-run is pas op
-- 1 september. Tot dan bleef de banner op het dashboard staan, want de
-- enige manier om hem te laten verdwijnen was "wacht op een geslaagde run".
--
-- Er wordt bewust GEEN data verwijderd en GEEN taak handmatig vooruit
-- gedraaid om dit op te lossen — dat is een aparte, expliciete beslissing
-- die Karen zelf moet goedkeuren. In plaats daarvan komt er een echte
-- bevestig-knop: een medewerker kan een gekende, nagekeken storing wegklikken.
-- Dat wordt gelogd (wie, wanneer, welke run) zodat het geen stille
-- onderdrukking is maar een bewuste, herleidbare actie.
--
-- Rollback: 046_storing_bevestigen_rollback.sql
-- ============================================================================

create table if not exists public.systeem_storing_bevestigd (
  jobid bigint not null,
  runid bigint not null,
  bevestigd_op timestamptz not null default now(),
  bevestigd_door uuid references auth.users(id),
  primary key (jobid, runid)
);

alter table public.systeem_storing_bevestigd enable row level security;
revoke all on public.systeem_storing_bevestigd from public, anon, authenticated;

-- Alleen leesbaar/schrijfbaar via de SECURITY DEFINER-functies hieronder.

create or replace function public.bevestig_storing(p_jobid bigint, p_runid bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not has_role() then
    raise exception 'Geen toegang';
  end if;

  insert into public.systeem_storing_bevestigd(jobid, runid, bevestigd_door)
  values (p_jobid, p_runid, auth.uid())
  on conflict (jobid, runid) do nothing;
end;
$function$;

revoke execute on function public.bevestig_storing(bigint, bigint) from public;
revoke execute on function public.bevestig_storing(bigint, bigint) from anon;
grant  execute on function public.bevestig_storing(bigint, bigint) to authenticated;

-- Retourtype wijzigt (jobid/runid erbij) — Postgres staat dat niet toe via
-- CREATE OR REPLACE, dus eerst droppen.
drop function if exists public.systeem_storingen(int);

create function public.systeem_storingen(p_dagen int default 90)
returns table(jobid bigint, runid bigint, taak text, wanneer timestamptz, melding text)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not has_role() then
    raise exception 'Geen toegang';
  end if;

  return query
    select d.jobid,
           d.runid,
           coalesce(j.jobname, 'job ' || d.jobid::text),
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
       and not exists (
         select 1 from public.systeem_storing_bevestigd ack
          where ack.jobid = d.jobid and ack.runid = d.runid
       )
     order by d.start_time desc
     limit 20;
end;
$function$;

revoke execute on function public.systeem_storingen(int) from public;
revoke execute on function public.systeem_storingen(int) from anon;
grant  execute on function public.systeem_storingen(int) to authenticated;
