-- Laat toe om ENKEL de allerlaatste factuur van een jaar te verwijderen
-- (nooit een factuur "uit het midden" van de reeks) — zo kan een test- of
-- foutieve factuur ongedaan gemaakt worden zonder ooit een gat te laten
-- vallen in de doorlopende nummering (wettelijk vereist voor facturen).
-- Enkel beheerders mogen dit, en elke verwijdering wordt gelogd in
-- audit_logs (wie, wanneer, welke factuur, met welke reden) — net het
-- spoor dat er tot nu toe ontbrak bij betalingscorrecties.
create or replace function public.verwijder_laatste_factuur(p_factuur_id uuid, p_reden text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row facturen;
  v_max_volgnr int;
begin
  if not public.is_admin() then
    raise exception 'Enkel beheerders kunnen een factuur verwijderen' using errcode = '42501';
  end if;
  if p_reden is null or length(trim(p_reden)) < 3 then
    raise exception 'Geef een reden op (minstens enkele woorden)';
  end if;

  select * into v_row from facturen where id = p_factuur_id;
  if v_row.id is null then
    raise exception 'Factuur niet gevonden';
  end if;

  perform pg_advisory_xact_lock(hashtext('factuur_' || v_row.jaar));
  select max(volgnr) into v_max_volgnr from facturen where jaar = v_row.jaar;

  if v_row.volgnr <> v_max_volgnr then
    raise exception 'Enkel de laatste factuur van % kan verwijderd worden (dit is niet de laatste — dat zou een gat in de nummering laten)', v_row.jaar;
  end if;

  insert into audit_logs (actor, actor_email, actie, entiteit, entiteit_id, booking_id, oude_waarde, reden, bron)
  select auth.uid(), u.email, 'factuur_verwijderd', 'facturen', v_row.id, v_row.booking_id,
         jsonb_build_object('factuurnummer', v_row.factuurnummer, 'bedrag_incl', v_row.bedrag_incl, 'snapshot', v_row.snapshot),
         p_reden, 'dashboard-nieuw'
  from auth.users u where u.id = auth.uid();

  delete from facturen where id = p_factuur_id;
end $$;

revoke all on function public.verwijder_laatste_factuur(uuid, text) from public;
grant execute on function public.verwijder_laatste_factuur(uuid, text) to authenticated;

-- Bijvangst: maak_factuur stond nog open voor PUBLIC (elke rol, ook anon) —
-- de functie checkt zelf has_role() dus een anonieme aanroeper werd al
-- geweigerd, maar dit sluit ook de onnodige brede grant (bekend, nog
-- openstaand puntje van de eerdere security-audit).
revoke all on function public.maak_factuur(uuid, jsonb, numeric, numeric, numeric, numeric, boolean, uuid) from public;
grant execute on function public.maak_factuur(uuid, jsonb, numeric, numeric, numeric, numeric, boolean, uuid) to authenticated;
