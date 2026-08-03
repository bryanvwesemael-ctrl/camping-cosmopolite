-- 1) De INSERT-policy op audit_logs liet elke ingelogde gebruiker een
--    audit-rij invoegen met eender welke actor/inhoud (WITH CHECK true) —
--    dat ondermijnt net de betrouwbaarheid van het logboek dat bedoeld is om
--    betalings-/factuurcorrecties te kunnen natrekken. Verplicht voortaan
--    dat de opgegeven "actor" overeenkomt met de effectief ingelogde
--    gebruiker, zodat niemand een logregel kan invoegen namens iemand anders.
drop policy if exists auth_insert_audit on audit_logs;
create policy auth_insert_audit on audit_logs for insert to authenticated
  with check (actor = auth.uid());

-- 2) Publieke buckets serveren bestanden via hun publieke URL sowieso zonder
--    RLS-check nodig — deze SELECT-policy was enkel nodig als iets de bucket
--    moet kunnen "listen" (alle bestandsnamen opvragen), wat nergens in de
--    code gebeurt. Verwijderen sluit die onnodige listing-mogelijkheid,
--    zonder de bestaande logo/afbeeldings-URL's te breken (geverifieerd:
--    het bestaande logo blijft gewoon publiek laadbaar).
drop policy if exists public_read_website_media on storage.objects;
