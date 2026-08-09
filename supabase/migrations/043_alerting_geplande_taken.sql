-- ============================================================================
-- 043_alerting_geplande_taken.sql
-- Auditbevinding F-16, structurele les.
--
-- De maandelijkse AVG-opruiming crashte op 1 augustus 2026 en dat bleef vijf
-- weken onopgemerkt. De storing zelf was klein en snel te herstellen; het
-- echte probleem was dat NIEMAND het zag. Zonder signaal kan precies hetzelfde
-- morgen met een andere stille fout opnieuw gebeuren.
--
-- Bewuste keuze voor de eenvoudigste betrouwbare oplossing: het dashboard
-- toont een waarschuwingsbalk zodra een geplande taak faalde. Geen e-mail —
-- dat zou afhangen van de Gmail-koppeling, en die kan zelf net de storing zijn
-- (dat is deze zomer ook echt gebeurd). Karen opent het dashboard elke dag;
-- een balk daar wordt gezien.
--
-- cron.job_run_details is niet leesbaar voor gewone gebruikers, vandaar een
-- SECURITY DEFINER-functie die enkel het strikt noodzakelijke teruggeeft:
-- welke taak, wanneer, en de foutmelding. Geen persoonsgegevens.
--
-- Rollback: 043_alerting_geplande_taken_rollback.sql
-- ============================================================================
create or replace function public.systeem_storingen(p_dagen int default 90)
returns table(taak text, wanneer timestamptz, melding text)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Alleen medewerkers mogen dit zien; het bevat interne foutmeldingen.
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

revoke execute on function public.systeem_storingen(int) from public;
revoke execute on function public.systeem_storingen(int) from anon;
grant  execute on function public.systeem_storingen(int) to authenticated;
