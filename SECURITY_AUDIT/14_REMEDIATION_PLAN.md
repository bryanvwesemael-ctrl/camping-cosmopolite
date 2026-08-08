# 14 — Remediatieplan

## Al doorgevoerd in deze auditronde (P0)

| # | Actie | Bewijs dat het werkt |
|---|---|---|
| 1 | Migratie **037** — anon-uploadpolicies verwijderd van `id-fotos` + `booking-fotos`; DELETE-policy voor medewerkers toegevoegd; groottelimiet 15 MB en MIME-whitelist op de buckets | Anon-upload met geldig JPEG-mimetype → `403 new row violates row-level security policy`. Legitieme weg via `guest-upload` geeft nog steeds een functionele foutmelding, geen permissiefout. |
| 2 | Migratie **039** — `purge_expired_data()` ontdaan van de SQL-deletes op storage; nieuwe read-only RPC `te_verwijderen_id_bestanden()` | Handmatige uitvoering slaagt: `{0,0,0,0,0}`. Vóór de fix: exception + volledige rollback. |
| 3 | Edge function **`purge-storage`** — verwijdert ID-bestanden via de Storage-API, admin-only, standaard droogloop | Anonieme aanroep → `{"error":"Niet ingelogd"}`. |
| 4 | **`netlify.toml`** — basis-beveiligingsheaders op alle routes; afdwingende CSP op het dashboard, Report-Only op publieke pagina's | Te verifiëren na deploy (zie hieronder). |
| 5 | **`checkin`** en **`save-api-keys`** alsnog in versiebeheer gezet, met een kop die eerlijk vermeldt dat ze uit productie zijn opgehaald en welke gebreken ze hebben | Bestanden aanwezig in `supabase/functions/`. |

## P1 — vóór het volgende hoogseizoen

**1. Prijsmanipulatie dichtzetten (F-03).** Twee opties, mijn advies is B:

- **A.** Databanktrigger die bij `bron='website'` het bedrag altijd zelf herberekent. Nadeel: de prijslogica moet in PL/pgSQL worden gedupliceerd naast `shared/pricing.js` — twee bronnen van waarheid, precies wat eerder in dit project bewust is opgeruimd.
- **B (aanbevolen).** De anon-policy dwingt `bedrag_totaal IS NULL` af, en het dashboard berekent het bedrag altijd zelf zodra Karen een aanvraag opent. De richtprijs die de bezoeker ziet, blijft puur informatief in de browser. Eén bron van waarheid, geen duplicatie, en de manipulatie is per definitie onmogelijk omdat de client het veld niet meer mag vullen.

**2. Rolcontrole in de edge functions (F-04).** Voeg in `send-mail`, `scan-id`, `create-payment`, `gmail-sync`, `parse-inbox-ai` een `has_role()`-controle toe (en `is_admin()` in `save-api-keys`). Vereist 5–6 herdeployments plus een functionele test per functie samen met Karen.

**3. Stille fouten bij het wissen wegwerken (F-02, restant).** `dashboard-nieuw/app-nieuw.js:1312` en `:1320`: vervang `catch(_e){}` door een zichtbare waarschuwing. Een mislukte verwijdering van een identiteitsdocument mag nooit stil zijn — dat is exact hoe deze bevinding is ontstaan.

**4. Alerting op mislukte cron-jobs.** De eigenlijke les van F-16 is niet de trigger, maar dat het vijf weken onopgemerkt bleef. Minimaal: een wekelijkse controle op `cron.job_run_details where status='failed'`.

**5. Turnstile aanzetten (F-06).** De code staat er al aan beide kanten; er ontbreekt enkel een `turnstile_site_key` in de instellingen en `TURNSTILE_SECRET` als edge-secret.

**6. Leaked-password-protection aanzetten (F-13).** Supabase-dashboard → Authentication. Kan alleen jij doen.

**7. Ongebruikte accounts opruimen (F-12).**

## P2 — belangrijk, niet dringend

- Capaciteitsgrens (`max_plaatsen`) afdwingen met een databanktrigger (F-06).
- Publieke CSP van Report-Only naar afdwingend, na het vervangen van inline `onclick`/`style` in `reserveren.html` (F-07).
- `save-api-keys` verwijderen; sleutels uitsluitend als Supabase-secret (F-05). Meteen de rommelrij `resend_api_key` opruimen.
- Prijs-endpoint beperken tot `key` + `value` zodat interne UUID's niet meelekken (F-10).
- `checkin`: identieke foutmelding voor onbekend id en fout token, plus een pogingenlimiet (F-09).
- Lockfile in de hoofdmap + `npm audit` in CI (F-15).
- Het oude `dashboard/` uitschakelen — het draait nog, deelt dezelfde backend en verdubbelt het aanvalsoppervlak zonder dat iemand het nog gebruikt.

## P3 — verbetering

- Beveiligingstests in CI (de tests uit 13_SECURITY_TEST_RESULTS.md automatiseren als regressiesuite).
- `sharp` bijwerken tijdens een geplande Next-upgrade (F-11).
- Padbeperking per boeking op de storage-policies, zodat een medewerker niet buiten "zijn" mappen kan.
