# Audit Camping Cosmopolite — `audit/full-platform-integration`

Datum: 2026-06-30 · Branch: `audit/full-platform-integration`
Scope: volledige end-to-end controle van publiek formulier + dashboard + Supabase.

> **Eerlijke afbakening.** Dit is een zeer grote opdracht (22 secties). In deze ronde zijn
> de **hoogste-impact, veilig uitvoerbare** zaken effectief geïmplementeerd, getest en
> (waar veilig) op productie toegepast. De grotere structurele migraties die een
> productie-risico of een productbeslissing dragen, zijn **precies** gedocumenteerd met
> de exacte fix — zie §Roadmap. Niets is met een schijnoplossing "afgevinkt".

---

## 0. Architectuur (feitelijk, uit live DB + code)

**Frontend:** vanilla HTML/CSS/JS, geen build-step. Supabase-js via CDN.
- `index.html` — publiek reservatieformulier
- `dashboard/index.html` + `dashboard/app.js` — beheerdashboard (SPA-achtig)
- `upload/index.html` — gast-foto-upload (via `checkin_token`)
- `privacy/`, `legal/` — juridische pagina's
- **NIEUW:** `shared/pricing.js` — centrale prijsberekening (single source of truth)

**Hosting:** Netlify (`netlify.toml`). **Backend:** Supabase (project `whubbowuqhjdkdequbmb`).

**Supabase-tabellen (10):** `clients`, `bookings`, `gasten`, `payments`, `communicatie`,
`settings`, `user_roles`, `analytics_events`, `booking_fotos`, `integrations`.

**Edge Functions (10):** `create-payment`, `mollie-webhook` (verify_jwt=false), `send-mail`,
`scan-id`, `guest-upload`, `checkin` (verify_jwt=false), `gmail-oauth`, `gmail-sync`,
`save-api-keys`, `invite-user`.

**Storage:** privébucket `id-fotos` (signed URLs, 1u). **Cron:** `purge_expired_data()` maandelijks.

### Waar elk gegeven leeft
| Gegeven | Locatie |
|---|---|
| Hoofdboeker (naam, e-mail, tel, ID-nr, geboortedatum, nationaliteit, woonplaats, nummerplaten, id_foto_url) | `clients` |
| Individuele gasten (naam, geboortedatum, nationaliteit, id_nummer, nummerplaat, foto_url, is_hoofdgast, id_consent) | `gasten` (FK → bookings) |
| Aankomst/vertrek, verblijfstype, volw/kind/baby/honden/auto's, elektriciteit, nota, bedrag_per_nacht, bedrag_totaal, ogm_referentie, status, bron, checkin_token, ingecheckt_at, controle_* | `bookings` |
| Aantal nachten | **afgeleid** (`vertrek − aankomst`), niet opgeslagen |
| Betaling (mollie_id, bedrag, status, betaald_at, checkout_url) | `payments` (FK → bookings) |
| Openstaand bedrag | **afgeleid** (`bedrag_totaal − Σ paid`), niet opgeslagen |
| Tarieven | `settings` (key/value) — gedeeld met publiek via RLS-policy `public_read_prices` |
| Mails / communicatie | `communicatie` |
| Rollen | `user_roles` |

---

## A. Bevindingen (naar ernst)

### 🔴 KRITIEK

**A1. `purge_expired_data()` was publiek aanroepbaar — dataverwijdering door anon.**
`SECURITY DEFINER`-functie die data wist, uitvoerbaar door `anon`/`authenticated` via
`/rest/v1/rpc/purge_expired_data`. Iedereen kon dataverwijdering triggeren.
- **Oorzaak:** standaard `EXECUTE` aan `PUBLIC`.
- **Impact:** verlies van gastgegevens / boekingen.
- **✅ OPGELOST + toegepast op productie:** `REVOKE EXECUTE … FROM anon, authenticated, PUBLIC` —
  cron draait als `postgres` en blijft werken. Migratie `003_security_revoke_purge.sql`.
  Geverifieerd: exec-rollen nu enkel `{service_role, postgres}`.

**A2. Anthropic API-sleutel staat in plaintext in de DB (`settings.anthropic_api_key`).**
- **Oorzaak:** `save-api-keys` schrijft de sleutel als gewone settings-waarde.
- **Impact:** zichtbaar voor de eigenaar-sessie en voor service-role/DB-toegang; de sleutel
  is bovendien eerder in een chat geplakt → moet sowieso geroteerd worden.
- **Anon kan hem NIET lezen** (RLS `public_read_prices` whitelистt enkel prijs-keys) — daarom
  🔴-maar-niet-catastrofaal.
- **AANBEVELING (jij, handmatig):** (1) roteer de sleutel op console.anthropic.com; (2) zet de
  nieuwe sleutel als **Edge Function secret** (`ANTHROPIC_API_KEY` via `Deno.env`), niet in `settings`;
  (3) verwijder de rij uit `settings`. *Niet automatisch uitgevoerd — vereist jouw nieuwe sleutel.*

**A3. Eén `status`-enum mengt boeking-, verblijf- én betaalstatus.**
`booking_status = {aanvraag, bevestigd, ingecheckt, betaald, geannuleerd, wachtlijst}`.
Een boeking kan niet tegelijk "ingecheckt" én "betaald" zijn → statussen overschrijven elkaar.
- **Concreet bug-gevolg (A4).**
- **Roadmap:** splits in `booking_status` / `stay_status` / `payment_status` (zie Roadmap R1).

**A4. Mollie-webhook markeerde elke betaling als volledig "betaald" en overschreef de lifecycle.**
- **Oorzaak:** `bookings.update({status:'betaald'})` werd op *elke* `paid`-webhook gezet, ook bij
  een **gedeeltelijke bijbetaling**, en overschreef `ingecheckt`.
- **Impact:** een deelbetaling toonde "volledig betaald"; check-in-status ging verloren.
- **✅ OPGELOST in code (`supabase/functions/mollie-webhook/index.ts`):** betaalstatus wordt nu
  **afgeleid** (`Σ paid ≥ totaal`); enkel bij volledige betaling wordt `betaald` gezet en
  `ingecheckt`/`geannuleerd` blijft behouden; neveneffecten (mail/communicatie) zijn nu
  **idempotent** (geen dubbele records bij herhaalde webhook).
  ⚠️ **Nog te deployen** (payment-kritisch) — deploy na 1 Mollie-testbetaling. Zie §F.

### 🟠 HOOG

**A5. Prijslogica was volledig gedupliceerd** in `index.html` én `dashboard/app.js` (twee `PRICES`-objecten,
twee berekeningen). Wiskundig liepen ze gelijk, maar dat moest handmatig in sync blijven → drift-risico.
- **✅ OPGELOST:** centrale `shared/pricing.js`. Beide frontends bouwen genormaliseerde input en
  roepen `CampingPricing.calc()` aan. Bewezen met 16 unit-tests.

**A6. Foutieve prijslabels (geen rekenfout, wel misleidend).**
- Dashboard "Nieuwe boeking": elektriciteit toonde `+€6 eenmalig` terwijl de berekening **per nacht** rekent. **✅ gefixt** → `+€6/nacht`.
- Publiek + dashboard: "€7 incl. toeristentaks" terwijl €7 + €1 taks = €8 effectief. **✅ verduidelijkt** in dashboardlabel (`€7/nacht + €1 taks`). *Publiek formulier: zie open punt O1.*

**A7. RLS dwingt het verschil staff/admin NIET af.**
`authenticated_full_bookings`/`_clients`/`_communicatie`/`_gasten`/`_payments` = `ALL USING(true)`.
Rolbeperking zit **alleen in frontend-JS** (`applyRoleVisibility`). Een staff-gebruiker kan via
directe API-calls alles doen (ook analytics, betalingen, ID-data).
- **Roadmap R2** (vereist policy-herontwerp + test om Karen niet buiten te sluiten).

**A8. Geen `updated_at` / optimistic locking op `bookings`.** Twee tabbladen die tegelijk bewerken →
"last write wins", stille overschrijving. **Roadmap R3.**

**A9. Geen audit-log, geen betalings-grootboek, geen refunds-tabel, geen booking_items/tariefsnapshot.**
Bestaande boekingen bewaren geen prijsopbouw → een latere tariefwijziging "herberekent" impliciet.
**Roadmap R1/R4.**

### 🟡 MIDDEL / LAAG
- **A10.** `anon` mag in `communicatie` INSERT'en (`WITH CHECK true`) — niet nodig voor het publieke formulier; beperk tot `bookings/clients/gasten`. (Supabase advisor WARN.)
- **A11.** `mollie-webhook` `catch` retourneert altijd `ok` en logt enkel → bij DB-fout denkt Mollie dat het lukte (geen retry). Aanbeveling: 500 teruggeven bij echte verwerkingfout.
- **A12.** Webhook behandelt enkel `paid` — `failed/expired/canceled/refunded/chargeback` worden genegeerd. (Roadmap R4.)
- **A13.** Leaked-password-protection staat uit (Supabase Auth). 1 klik in dashboard-instellingen.
- **A14.** `send-mail` (Resend) vs Gmail-sync: afzender = `onboarding@resend.dev` (testdomein) → mails komen mogelijk in spam. Verifieer een eigen domein in Resend.
- **A15.** Tijdzone: nachten worden datum-only berekend (✅ geen drift); maar `created_at`/cron gebruiken UTC. Voor rapporten met "vandaag" → forceer `Europe/Brussels` in queries. (Roadmap.)

---

## B. Koppelingenoverzicht (synchronisatie)

| Actie | Database | Boekingen | Register | Wie is er | Kalender | Betaling | Mail |
|---|---|---|---|---|---|---|---|
| Publiek formulier verzenden | ✅ clients+bookings+gasten | ✅ | ✅ | ✅ | ✅ | n.v.t. | ⚠️ geen auto-bevestiging¹ |
| Nieuwe boeking (dashboard) | ✅ | ✅ | ✅ | ✅ | ✅ | optioneel |
| Boeking bewerken | ✅ | ✅ | ✅ realtime | ✅ realtime | ✅ | herberekent² |
| Datum wijzigen | ✅ | ✅ | ✅ | ✅ (full reload listener) | ✅ | ⚠️ handmatig nieuwe link |
| Status wijzigen | ✅ | ✅ | ✅ | ✅ | — | optioneel |
| Betaling (Mollie paid) | ✅ payments | ✅ status³ | — | — | — | ✅ team-notif |
| Bijbetaling | ✅ extra payment-rij | ✅³ | — | — | — | ✅ |
| Annuleren | ✅ status=geannuleerd | ✅ | ✅ verdwijnt | ✅ verdwijnt | ✅ | optioneel |
| Tarief wijzigen | ✅ settings | bestaande: bedrag blijft⁴ | — | — | — | — |

¹ Publiek formulier maakt enkel de boeking (`status='aanvraag'`); bevestigingsmail stuurt Karen
handmatig of bij "Bevestigen". ² Bewerken herberekent via dezelfde centrale module.
³ Na fix A4 correct afgeleid. ⁴ `bedrag_totaal` blijft staan; er is (nog) geen tariefsnapshot/
expliciete "herbereken"-knop met preview — Roadmap R1.

---

## C. Tarievenmatrix

Bron voor **alle** tarieven: tabel `settings` (key/value). Defaults-vangnet: `shared/pricing.js`.

| Tarief | Bedrag | Per | Eenheid | BTW | Toeristentaks | Publiek label | Dashboard label |
|---|---|---|---|---|---|---|---|
| Tent | €15 | nacht | standplaats | 12% incl | — | €15/nacht | €15/nacht |
| Camper/Caravan | €15 | nacht | standplaats | 12% incl | — | €15/nacht | €15/nacht |
| Volwassene | €7 | nacht | persoon | 12% incl | + €1 apart | €7/nacht (+taks) | €7/nacht + €1 taks |
| Kind 3–11 | €5 | nacht | persoon | 12% incl | — | €5/nacht | €5/nacht |
| Baby <3 | €0 | — | persoon | — | — | Gratis | gratis |
| Hond | €3 | nacht | dier | 12% incl | — | €3/nacht | €3/hond/nacht |
| Extra auto (na 1e) | €2 | nacht | voertuig | 12% incl | — | €2/nacht | 1e gratis, +€2/extra/nacht |
| Elektriciteit | €6 | **nacht** | boeking | 12% incl | — | €6/nacht | €6/nacht ✅(was "eenmalig") |
| Afval | €2 | nacht | per schijf 6 pers | 12% incl | — | €2/nacht | in opbouw |
| Toeristentaks | €1 | nacht | volwassene | **BTW-vrij** | zelf | BTW-vrij | BTW-vrij |
| Safaritent | €15 | nacht | standplaats | 12% incl | + persoonskost | dynamisch | dynamisch |
| Waarborg | €100 | eenmalig | boeking | — | cash, terugbetaalbaar | apart getoond | — |

---

## D. Testresultaten

`npm test` (Node built-in test runner, 0 dependencies) — **16/16 geslaagd.**

| Test | Resultaat |
|---|---|
| nachten = vertrek − aankomst (vertrekdag telt niet) | ✅ |
| vertrek = aankomst → 0 nachten | ✅ |
| vertrek < aankomst → 0 (geen negatieve nachten) | ✅ |
| standaardboeking 2 volw / 1 nacht / tent = €33 | ✅ |
| boeking met kind | ✅ |
| baby gratis (telt wel voor afval) | ✅ |
| hond per nacht | ✅ |
| 1e auto gratis, extra auto per nacht | ✅ |
| elektriciteit PER NACHT (6→18 bij 3 nachten) | ✅ |
| afval per schijf van 6 (6→€2, 7→€4, 9→€6) | ✅ |
| volwassene €7 + €1 taks = €8 effectief | ✅ |
| BTW 12% geëxtraheerd (niet bovenop) | ✅ |
| all-in (backpacker): geen persoons-/afvalkost | ✅ |
| meerdere nachten lineair, eenmalig niet | ✅ |
| extra dag = exact 1 nacht diensten + taks | ✅ |
| afronding op 2 decimalen | ✅ |

Bewijs: `tests/pricing.test.js`. CI: `.github/workflows/tests.yml` draait dit bij elke PR/push.

---

## E. Codewijzigingen
- `shared/pricing.js` — **nieuw**: centrale `CampingPricing.calc()` + defaults + `nightsBetween`.
- `index.html` — gebruikt `shared/pricing.js`; live-preview én opslaan via centrale calc; labels.
- `dashboard/index.html` — laadt `../shared/pricing.js`.
- `dashboard/app.js` — `calcPrice()` delegeert naar centrale module; defaults uit module; labelfixes (elektriciteit/auto/taks).
- `supabase/functions/mollie-webhook/index.ts` — afgeleide betaalstatus + idempotente neveneffecten + lifecycle-behoud.
- `supabase/migrations/003_security_revoke_purge.sql` — **toegepast op prod**.
- `tests/pricing.test.js`, `package.json`, `.github/workflows/tests.yml` — **nieuw**.

---

## F. PR / deploy

**Vereiste env (Edge Function secrets):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`MOLLIE_API_KEY`, `RESEND_API_KEY`, `SITE_URL`, **nieuw aanbevolen** `ANTHROPIC_API_KEY` (i.p.v. settings).

**Deploystappen:**
1. Frontend (Netlify): merge → auto-deploy. `shared/pricing.js` moet mee gepubliceerd worden (staat in repo-root, relatieve paden gecontroleerd).
2. DB: `003_security_revoke_purge.sql` is al toegepast (idempotent — herdraaien is veilig).
3. Edge function: `supabase functions deploy mollie-webhook` **pas na 1 Mollie test-mode betaling** (volledig + gedeeltelijk) verifiëren.

**Rollback:**
- DB: `GRANT EXECUTE ON FUNCTION public.purge_expired_data() TO anon, authenticated;`
- Webhook: vorige versie herdeployen (git revert van het bestand).
- Frontend: git revert van de branch.

**Bekende beperkingen (deze ronde niet geïmplementeerd):** zie Roadmap.

---

## Roadmap (gedocumenteerd, nog te doen — met exacte aanpak)

| # | Item | Waarom uitgesteld | Aanpak |
|---|---|---|---|
| R1 | Status splitsen + tariefsnapshot/booking_items + "herbereken met preview" | Riskante prod-migratie + productbeslissing | Migratie: `payment_status`, `stay_status` kolommen + backfill uit huidige enum; `booking_items` met bevroren prijsregels; UI-knop "herbereken" met diff-preview vóór opslaan |
| R2 | RLS staff/admin echt afdwingen | Mag Karen niet buitensluiten; vereist auth-test | Per-tabel policies o.b.v. `user_roles.role`; analytics/payments enkel admin; testen met staff- én admin-token vóór toepassen |
| R3 | `updated_at` + optimistic locking | Vereist UI-conflictafhandeling | `updated_at` kolom + trigger; client stuurt `If-Match`/versie; toon "nieuwere data beschikbaar" |
| R4 | Refunds + webhook failed/expired/refunded + idempotency_key | Externe Mollie-test nodig | `refunds`-tabel; webhook-branches; idempotency-kolom op payments |
| R5 | `audit_logs` + tijdlijn in boekingsdetail | Omvang | Tabel + triggers op bookings/payments; tijdlijn-render |
| R6 | Playwright e2e (publiek + dashboard + autorisatie) | Vereist test-Supabase/CI-secrets om prod niet te raken | Playwright-config + flows; mock Mollie/Resend |
| R7 | Storage-retentie: `purge_expired_data` wist DB-rijen maar niet de bestanden in `id-fotos` | — | Storage-cleanup via Edge Function op schema |
| R8 | Resend eigen domein + Anthropic-key naar secret | Vereist accounttoegang/sleutel | Domein verifiëren; key roteren + verplaatsen |

## Open punt voor Karen (O1)
Het publieke formulier toont volwassene als "€7 incl. toeristentaks", maar er wordt €7 + €1 taks
= €8 gerekend (dat is normaal in België). **Bevestig de gewenste formulering**: "€7/nacht +
€1 toeristentaks" (transparant) of het €7-tarief écht inclusief maken (dan rekent het systeem
€6 + €1). De berekening is nu correct; enkel de tekst moet matchen met jouw keuze.
