-- ============================================================================
-- 032_facturen.sql
-- Facturen werden tot nu toe NIET bewaard: openFactuur() rendert live uit de
-- boeking en drukt af. Dat geeft drie problemen:
--   1. De factuur verandert achteraf. De datum is "vandaag" (dus anders bij
--      elke afdruk), en omdat "Extra dagen"/"Extra geld" het totaalbedrag
--      aanpassen kan ook het BEDRAG op een al uitgereikte factuur wijzigen.
--   2. "FACT-<volgnummer>" is het boekingsnummer, geen factuurnummer. Niet
--      gefactureerde boekingen maken gaten in de reeks; twee facturen voor
--      één boeking hergebruiken hetzelfde nummer.
--   3. Er wordt niets bijgehouden, terwijl facturen 7 jaar bewaard moeten
--      blijven.
--
-- Een factuur is een MOMENTOPNAME, geen weergave. Deze tabel bevriest ze.
-- Corrigeren doe je met een creditnota (negatief bedrag), nooit door een
-- bestaande factuur aan te passen — vandaar dat er bewust GEEN update- of
-- delete-policy bestaat.
--
-- Rollback: 032_facturen_rollback.sql
-- ============================================================================

create table if not exists facturen (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references bookings(id) on delete restrict,
  factuurnummer  text not null unique,          -- bv. 2026-0001
  jaar           int  not null,
  volgnr         int  not null,
  factuurdatum   date not null default current_date,
  is_creditnota  boolean not null default false,
  corrigeert_id  uuid references facturen(id),  -- bij creditnota: welke factuur
  bedrag_incl    numeric(10,2) not null,        -- gefactureerd totaal (leidend)
  btw_percent    numeric(5,2),
  btw_bedrag     numeric(10,2),
  bedrag_excl    numeric(10,2),
  snapshot       jsonb not null,                -- volledige factuur op moment van uitgifte
  created_at     timestamptz not null default now(),
  created_by     uuid,
  unique (jaar, volgnr)
);

create index if not exists facturen_booking_idx on facturen(booking_id);
create index if not exists facturen_datum_idx   on facturen(factuurdatum desc);

alter table facturen enable row level security;

-- Lezen mag iedereen met een rol. Schrijven kan ALLEEN via maak_factuur()
-- hieronder (security definer): er is bewust geen insert/update/delete-policy,
-- zodat de onveranderlijkheid door de database wordt afgedwongen en niet enkel
-- door de interface.
create policy facturen_select on facturen
  for select to authenticated using (public.has_role());

-- ---------------------------------------------------------------------------
-- Nummering + aanmaak in één transactie. De advisory lock voorkomt dat twee
-- gelijktijdige facturen hetzelfde volgnummer krijgen; het nummer toekennen en
-- de rij wegschrijven gebeurt hier samen, zodat er geen gat kan ontstaan
-- tussen "nummer opvragen" en "factuur bewaren".
-- ---------------------------------------------------------------------------
create or replace function public.maak_factuur(
  p_booking_id    uuid,
  p_snapshot      jsonb,
  p_bedrag_incl   numeric,
  p_btw_percent   numeric default null,
  p_btw_bedrag    numeric default null,
  p_bedrag_excl   numeric default null,
  p_is_creditnota boolean default false,
  p_corrigeert_id uuid    default null
) returns facturen
language plpgsql security definer set search_path = public as $$
declare
  v_jaar int := extract(year from current_date)::int;
  v_nr   int;
  v_row  facturen;
begin
  if not public.has_role() then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if p_bedrag_incl is null then
    raise exception 'Bedrag ontbreekt';
  end if;

  perform pg_advisory_xact_lock(hashtext('factuur_' || v_jaar));
  select coalesce(max(volgnr), 0) + 1 into v_nr from facturen where jaar = v_jaar;

  insert into facturen (booking_id, factuurnummer, jaar, volgnr, is_creditnota,
                        corrigeert_id, bedrag_incl, btw_percent, btw_bedrag,
                        bedrag_excl, snapshot, created_by)
  values (p_booking_id,
          v_jaar || '-' || lpad(v_nr::text, 4, '0'),
          v_jaar, v_nr, p_is_creditnota, p_corrigeert_id,
          p_bedrag_incl, p_btw_percent, p_btw_bedrag, p_bedrag_excl,
          p_snapshot, auth.uid())
  returning * into v_row;

  return v_row;
end $$;

revoke execute on function public.maak_factuur(uuid, jsonb, numeric, numeric, numeric, numeric, boolean, uuid) from anon;
