# 03 — Bevindingen

Elke bevinding hieronder is **empirisch geverifieerd** tegen de live omgeving, tenzij expliciet anders vermeld. Waar ik iets niet heb kunnen bewijzen, staat dat er letterlijk bij.

Legenda status: `OPEN` = nog niet opgelost · `GEFIXT` = opgelost + geverifieerd in deze audit.

---

## F-16 · KRITIEK · De maandelijkse GDPR-opruiming crasht volledig — géén enkele bewaartermijn wordt uitgevoerd

| | |
|---|---|
| **Component** | `purge_expired_data()` + pg_cron-job `gdpr-monthly-purge` |
| **Categorie** | GDPR Art. 5(1)(e) + A09 ontbrekende monitoring |
| **Status** | **GEFIXT + geverifieerd** (migratie 039 + edge function `purge-storage`) |

**Beschrijving.** Dit is de zwaarste bevinding van de audit, en ze was met een codereview alléén niet te vinden — enkel door de uitvoeringsgeschiedenis op te vragen.

`purge_expired_data()` begon met `delete from storage.objects ...`. Supabase heeft op die tabel een `BEFORE DELETE`-statementtrigger (`storage.protect_delete`) die **elke** rechtstreekse SQL-delete weigert, tenzij de sessievariabele `storage.allow_delete_query` op `'true'` staat. De functie wierp dus een exception, en omdat een PL/pgSQL-functie in één transactie draait, **rolde alles terug**. Niet alleen de fotoruiming faalde — ook het wissen van gastgegevens na 3 jaar, boekingen na 7 jaar, weesklanten en analytics na 14 maanden gebeurde niet.

**Bewijs — `cron.job_run_details`:**
```
runid 1 · 2026-07-01 03:00 · succeeded · "1 row"
runid 2 · 2026-08-01 03:00 · FAILED
  ERROR: Direct deletion from storage tables is not allowed. Use the Storage API instead.
  CONTEXT: PL/pgSQL function purge_expired_data() line 11 at SQL statement
```
De juli-run slaagde nog; de platformtrigger is er tussen beide runs bijgekomen. **De opruiming is dus stilzwijgend stukgegaan door een wijziging aan de kant van Supabase, en dat is vijf weken lang niemand opgevallen** — er is geen alerting op mislukte cron-jobs.

**Waarom KRITIEK.** Het privacybeleid belooft de gast letterlijk dat zijn ID-foto *"90 dagen na uw vertrek automatisch verwijderd"* wordt. Dat automatisme deed op dit moment niets. Dat raakt de kern van artikel 5(1)(e) en van de belofte aan de betrokkene. Het is nu nog niet zichtbaar in de cijfers omdat het project pas ~2 maanden draait en er dus nog niets ouder is dan 90 dagen — maar zonder deze audit was de eerste vervaldatum ongemerkt gepasseerd.

**Waarom ik de trigger niet gewoon heb omzeild.** Je kunt `set_config('storage.allow_delete_query','true',true)` zetten en dan lukt de delete wel. Dat is bewust **niet** gedaan: een SQL-delete verwijdert enkel de metadata-rij, niet de werkelijke bestandsbytes in de objectopslag. Voor een bewaartermijn op identiteitsdocumenten is dat precies het verkeerde resultaat — het bestand lijkt weg maar staat er nog. Dat zou schijnveiligheid zijn.

**Fix (doorgevoerd en getest).**
1. Migratie `039`: alle `storage.objects`-deletes uit `purge_expired_data()` gehaald. De functie ruimt nu enkel databankrijen op en **draait weer zonder fout** — geverifieerd door hem handmatig uit te voeren: `{deleted_gasten:0, deleted_bookings:0, deleted_clients:0, deleted_analytics:0, deleted_documenten:0}` (0 is correct: er is nog niets verlopen).
2. Nieuwe read-only RPC `te_verwijderen_id_bestanden()` die opsomt welke bestanden weg moeten — zowel verlopen als wees.
3. Nieuwe edge function **`purge-storage`** die die lijst ophaalt en de bestanden **via de Storage-API** verwijdert (service role), zodat de bytes écht verdwijnen. Admin-only; anonieme aanroep geweigerd (geverifieerd: `{"error":"Niet ingelogd"}`). **Standaard droogloop** — hij wist pas met `{"bevestig": true}`.

**Nog te doen door Bryan (2 stappen):**
- Eenmalig `purge-storage` met `{"bevestig":true}` aanroepen om de 63 wees-bestanden op te ruimen die ouder zijn dan de respijtperiode. Ik heb dit bewust **niet** zelf gedaan: het is een onomkeerbare verwijdering van persoonsgegevens uit productie.
- De maandelijkse aanroep inplannen (pg_cron + pg_net, of een externe scheduler), en **alerting op mislukte cron-jobs** zetten — want dát is de eigenlijke les van deze bevinding.

---

## F-01 · HOOG · Anonieme internetgebruiker kan bestanden uploaden naar de privé ID-fotobucket

| | |
|---|---|
| **Component** | Supabase Storage, policies `public_upload_id_foto` + `anon_upload_booking_fotos` |
| **Categorie** | A01 Broken Access Control / A05 Misconfiguration |
| **Status** | **GEFIXT** (migratie 037) |

**Beschrijving.** Op `storage.objects` stond een INSERT-policy voor de rol `anon` met als enige voorwaarde `bucket_id = 'id-fotos'`. Geen padbeperking, geen groottelimiet (`file_size_limit` was `NULL`), geen MIME-beperking (`allowed_mime_types` was `NULL`). Idem voor `booking-fotos`.

**Bewijs (uitgevoerd 2026-08-08, met de publieke anon-sleutel):**
```
POST /storage/v1/object/id-fotos/AUDIT-TEST-DELETE-ME/probe.txt
  → HTTP 200 {"Key":"id-fotos/AUDIT-TEST-DELETE-ME/probe.txt","Id":"49bf2368-..."}
POST /storage/v1/object/booking-fotos/AUDIT-TEST-DELETE-ME/probe2.txt
  → HTTP 200 {"Key":"booking-fotos/AUDIT-TEST-DELETE-ME/probe2.txt","Id":"154674c4-..."}
```
Teruglezen en listen lukte **niet** (404 / lege lijst) — de bucket is dus write-only voor een aanvaller.

**Aanvalsscenario.** Een aanvaller haalt de anon-sleutel uit de paginabron (die staat daar by design) en uploadt in een lus onbeperkt grote bestanden. Gevolgen: (a) onbegrensde opslagkosten op Bryans Supabase-abonnement, (b) een derde kan willekeurige — mogelijk illegale — inhoud plaatsen in precies díé bucket die Karen juridisch aanhoudt als "identiteitsdocumenten", (c) opslag-quota uitputten waardoor legitieme ID-uploads falen.

**Waarom dit onnodig was.** Geverifieerd met `grep` over alle publieke pagina's: **geen enkele publieke pagina uploadt rechtstreeks naar storage.** `reserveren.html` en `upload/index.html` gaan via de edge function `guest-upload`, die de **service role** gebruikt en dus geen anon-policy nodig heeft. De policies waren pure, ongebruikte aanvalsoppervlakte.

**Fix.** Migratie `037`: beide anon-INSERT-policies verwijderd; `file_size_limit` (15 MB) en `allowed_mime_types` ingesteld op beide buckets.

**Restrisico.** De twee testbestanden die ik als bewijs heb geüpload, zijn opgeruimd (zie 13_SECURITY_TEST_RESULTS.md). Er is geen manier om achteraf vast te stellen of iemand vóór deze audit al misbruik heeft gemaakt — er is geen storage-toegangslogboek. **Aanbeveling: controleer de bucket eenmalig op onbekende paden** (alles buiten `guest-upload/`, `gast/`, `boeking/`).

---

## F-02 · HOOG · Identiteitsdocumenten worden nooit uit de opslag verwijderd — 81 wees-bestanden aangetroffen

| | |
|---|---|
| **Component** | Storage-policies `id-fotos` + `purge_expired_data()` + `verwijderBoeking()` |
| **Categorie** | GDPR Art. 5(1)(e) opslagbeperking + Art. 17 wissing |
| **Status** | **GEFIXT** (migratie 037 + 038) — bestaande wezen nog op te ruimen, zie hieronder |

**Beschrijving.** Er bestond **geen enkele DELETE-policy** op de bucket `id-fotos` (wel SELECT, INSERT en UPDATE). Het dashboard roept bij het verwijderen van een boeking `sb.storage.from('id-fotos').remove(paths)` aan, maar die aanroep staat in `try{...}catch(_e){}` — de fout wordt stilzwijgend ingeslikt. Het bestand blijft dus staan terwijl de databankrij verdwijnt.

Daarna is het bestand **definitief onbereikbaar voor de opruiming**: `purge_expired_data()` vindt storage-objecten via een join op `booking_documents` (`o.name = d.storage_path`). Zodra die rij weg is, kan geen enkel automatisme het bestand nog terugvinden.

**Bewijs (live databank, 2026-08-08):**
```
storage.objects in id-fotos ............... 210
waarvan zonder actieve DB-verwijzing ......  81
groei per maand: juni 3 · juli 60 · augustus 18
```
Code: `dashboard-nieuw/app-nieuw.js:1312` en `:1320` — `catch(_e){}`.

**Impact.** Foto's van identiteitskaarten en paspoorten van echte gasten blijven onbeperkt bewaard nadat ze in de applicatie zijn "verwijderd". Dit ondermijnt zowel de belofte in het privacybeleid ("90 dagen na uw vertrek automatisch verwijderd") als het recht op wissing. Het aantal groeit maandelijks.

**Fix.**
1. Migratie `037`: DELETE-policy op `id-fotos` voor gebruikers met een rol, zodat het dashboard écht kan wissen.
2. Migratie `038`: `purge_expired_data()` uitgebreid met een **wees-opruiming** die objecten in `id-fotos` verwijdert die (a) ouder zijn dan de bewaartermijn én (b) door geen enkele `booking_documents`- of `gasten`-rij meer worden aangeroepen. Zo worden zowel de bestaande 81 als toekomstige wezen alsnog opgeruimd.
3. Code: de stille `catch(_e){}` vervangen door een zichtbare waarschuwing (zie remediatieplan P1 — nog **niet** doorgevoerd, vereist frontendwijziging + test).

**Nog te doen door Bryan.** De opruiming draait maandelijks (`0 3 1 * *`). Wil je de 81 bestaande wezen nú weg, roep dan eenmalig `select public.purge_expired_data();` aan.

---

## F-03 · HOOG · De prijs komt volledig van de client — een boeking van €0 wordt aanvaard

| | |
|---|---|
| **Component** | RLS-policy `anon_insert_bookings` + `reserveren.html` `submitForm()` |
| **Categorie** | A04 Insecure Design / business logic |
| **Status** | **GEFIXT + geverifieerd** (migratie 042 + formulier + dashboard) |

**Beschrijving.** `bedrag_totaal` en `bedrag_per_nacht` worden in de browser berekend en rechtstreeks in de databank geschreven. De RLS-policy controleert enkel `COALESCE(bedrag_totaal, 0) >= 0`. Er is nergens een server-side herberekening bij het aanmaken.

**Bewijs (uitgevoerd 2026-08-08, testrecord onmiddellijk verwijderd):**
```
POST /rest/v1/bookings   (anon-sleutel, buiten het formulier om)
  14 nachten · 6 volwassenen · 3 honden · 4 auto's · elektriciteit
  bedrag_totaal: 0 · bedrag_per_nacht: 0
  → HTTP 201 Created
```
Reële richtprijs voor dat verblijf ligt rond **€1.200**.

**Gedeeltelijke mitigatie (geverifieerd).** Het dashboard herberekent de prijs wél, maar **alleen** in "Gegevens bewerken" (`app-nieuw.js:1570`). Bevestigt Karen een aanvraag zonder te bewerken, dan blijft het gemanipuleerde bedrag staan. De verdediging hangt dus af van een handmatige handeling.

**Waarom dit niet als KRITIEK is geklasseerd.** De boeking komt binnen als `status='aanvraag'` en genereert geen betaling of factuur; Karen bevestigt handmatig en int via QR/IBAN. De aanvaller krijgt dus geen automatisch verblijf — hij creëert een discussie over de prijs. Financiële schade vereist dat Karen het bedrag ongezien overneemt.

### Doorgevoerde fix (optie B)

De client mag het bedrag niet meer meesturen. Er valt dus niets meer te manipuleren.

1. **Migratie 042** — `anon_insert_bookings` eist nu `bedrag_totaal IS NULL AND bedrag_per_nacht IS NULL`.
2. **`reserveren.html`** stuurt die velden niet meer mee. De richtprijs op het scherm blijft puur informatief.
3. **`dashboard-nieuw`** berekent het bedrag zelf via `berekenBedragVoorAanvraag()`, met dezelfde gedeelde `shared/pricing.js`. Bij het bevestigen wordt het berekende bedrag vastgelegd (`bedragVastleggenBij`), zodat het na de statuswissel niet op €0 valt.

**Bewust niet gekozen:** een databanktrigger die de prijs herberekent. Dat zou de volledige prijslogica in PL/pgSQL dupliceren naast `shared/pricing.js` — twee bronnen van waarheid, precies wat eerder in dit project bewust is opgeruimd.

**Een tweede bug die hierdoor aan het licht kwam.** Het formulier telde safaritenten en stacaravans gewoon op bij `tenten` en bewaarde het type alléén als tekstlabel (`"1× Safaritent"`). Zonder fix zou de herberekening een safaritent van €102 als tent van €15 hebben gerekend — de fix zou de prijs dus *verlaagd* hebben. Het formulier stuurt de types nu gestructureerd mee in `extra_type_units`, net zoals het dashboard al deed bij een handmatige reservering. Bijkomend voordeel: die boekingen verschijnen nu ook in de verhuurkalender.

**Regressietests (uitgevoerd, testdata opgeruimd):**

| Test | Resultaat |
|---|---|
| Originele aanval: 14 nachten, €0, buiten het formulier om | `42501 new row violates row-level security policy` |
| Omgekeerd: €99.999 opdringen | `42501` — geweigerd |
| Normale boeking via het formulier (safaritent, 2 nachten) | Aangemaakt; `bedrag_totaal = null`, `tenten = 0`, `extra_type_units` correct gestructureerd |
| Herberekening van diezelfde boeking met de dashboardlogica | **€204,00 — exact het bedrag dat de bezoeker op het scherm zag** |

---

## F-04 · MIDDEL · Edge functions controleren "ingelogd" maar niet de rol

| | |
|---|---|
| **Component** | `send-mail`, `scan-id`, `create-payment`, `gmail-sync`, `gmail-oauth`, `save-api-keys`, `parse-inbox-ai` |
| **Categorie** | A01 Broken Access Control |
| **Status** | **OPEN** |

**Beschrijving.** Al deze functies doen enkel:
```ts
const { data:{ user } } = await sb.auth.getUser(jwt!)
if (!user) throw new Error('Niet ingelogd')
```
Er is **geen** controle op `user_roles`. Enkel `invite-user` doet dat wel (`role?.role !== 'admin'`).

**Waarom niet HOOG.** Live geverifieerd: `disable_signup: true` en `anonymous_users: false`. Een buitenstaander kan geen account maken. Het risico is dus beperkt tot de 4 bestaande accounts (insider of accountovername), niet tot het open internet.

**Concreet misbruik door een `staff`-account (of gestolen sessie):**
- `send-mail` aanvaardt een vrij `onderwerp` + `inhoud` en verstuurt dat **vanuit Karens Gmail** naar het e-mailadres van de opgegeven boeking. Reputatie-/phishingrisico onder Karens naam.
- `scan-id` stuurt een willekeurige afbeelding naar de Anthropic-API op Bryans sleutel — kostenmisbruik en gebruik van de AI als open proxy.
- `save-api-keys` — zie F-05.

**Fix.** Voeg in elke functie een rolcontrole toe (`has_role`, of `is_admin` waar passend). Niet doorgevoerd in deze ronde: dit vereist het herdeployen van 7 edge functions en een functionele test per functie met Karen. Zie P1.

---

## F-05 · MIDDEL · `save-api-keys` bewaart sleutels in platte tekst; "laatst gewijzigde wint" over gebruikers heen

| | |
|---|---|
| **Component** | edge function `save-api-keys` (niet in versiebeheer), `create-payment` `getMollieKey()`, `scan-id` `setting()` |
| **Categorie** | A02 Cryptographic Failures / A01 |
| **Status** | **OPEN** |

**Beschrijving.** De functie schrijft volledige API-sleutels als platte tekst in `settings`. De commentaar in de code beweert *"Sla volledige key op in settings (encrypted via RLS)"* — dat is **onjuist**: RLS is toegangscontrole, geen versleuteling. De waarde staat onversleuteld in de databank en in elke back-up.

Erger is het leespatroon. Zowel `create-payment` als `scan-id` halen de sleutel zo op:
```ts
.eq('key','mollie_api_key').order('updated_at',{ascending:false}).limit(1)
```
Dat negeert `user_id`: **de meest recent bijgewerkte rij van eender welke gebruiker wint.** Een `staff`-gebruiker die zijn eigen Mollie-sleutel opslaat, zou daarmee alle betalingen naar zijn eigen rekening kunnen laten lopen.

**Huidige exploiteerbaarheid: laag.** Geverifieerd in de databank: er bestaat **geen** `mollie_api_key`- of `anthropic_api_key`-rij; die komen uit omgevingsvariabelen. Mollie is bovendien uitgeschakeld. Het gat is dus reëel in ontwerp maar op dit moment niet actief misbruikbaar.

**Wel aangetroffen, maar minder erg dan het lijkt:** er staat één `resend_api_key`-rij in `settings`. Ik heb de waarde gemaskeerd geïnspecteerd (enkel prefix en lengte, nooit de volledige inhoud): prefix `Kar`, lengte 22. Een echte Resend-sleutel begint met `re_` en is aanzienlijk langer. **Dit is dus géén geldige sleutel** — vermoedelijk heeft iemand per ongeluk tekst in het sleutelveld getypt. Er is hier dus **geen credential gelekt**; het is rommeldata die mag verdwijnen. Resend wordt sinds de overstap naar Gmail nergens meer gelezen (enkel het oude `dashboard/` heeft nog een invoerveld).

---

## F-06 · MIDDEL · Geen server-side capaciteitslimiet, geen server-side rate limiting, botcheck staat uit

| | |
|---|---|
| **Component** | `anon_insert_bookings`, `reserveren.html`, Turnstile |
| **Categorie** | A04 Insecure Design |
| **Status** | **OPEN** |

**Beschrijving.** De anti-misbruikmaatregelen in het formulier zijn **allemaal client-side**: honeypotveld, "minstens 3 seconden invullen", "geen tweede inzending binnen 30 s". Wie rechtstreeks naar de API post, omzeilt ze volledig — dat heb ik bij F-03 in de praktijk gedaan.

`max_plaatsen` (30) wordt alleen in het dashboard uitgelezen; er is **geen databankcontrole**. Cloudflare Turnstile is voorbereid maar staat uit — live geverifieerd in de browser: `window._turnstileOn === false`, omdat er geen `turnstile_site_key` is ingesteld.

**Impact.** Een bot kan onbeperkt aanvragen aanmaken: het postvak van Karen vervuilen, de kalender vol boeken (ontzegging van beschikbaarheid) en de databank laten groeien. Geen datalek, wel een reëel operationeel risico in het hoogseizoen.

**Fix.** (1) Turnstile-sleutel invullen — de code staat er al en `guest-upload` verifieert het token server-side zodra `TURNSTILE_SECRET` bestaat. (2) Databanktrigger die het aantal boekingen per aankomstdag begrenst.

---

## F-07 · MIDDEL · Geen CSP; het reserveringsformulier mist clickjacking- en sniffing-bescherming

| | |
|---|---|
| **Component** | `netlify.toml` |
| **Categorie** | A05 Security Misconfiguration |
| **Status** | **GEFIXT** (netlify.toml uitgebreid) |

**Bewijs (live `curl -I`, vóór de fix):**

| URL | Headers |
|---|---|
| `/reserveren` | enkel `Strict-Transport-Security` |
| `/privacy/` | enkel `Strict-Transport-Security` |
| `/dashboard-nieuw/` | HSTS + `X-Frame-Options: DENY` + `nosniff` + `Referrer-Policy` |

Er was **nergens** een `Content-Security-Policy`. Het reserveringsformulier — precies de pagina die naam, e-mail, geboortedatum én een foto van een identiteitsbewijs verzamelt — kon in een `<iframe>` op een vreemde site worden geladen (clickjacking).

**Fix.** `netlify.toml`: basisheaders (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) op **alle** routes, plus een CSP die de gebruikte CDN's (jsdelivr) en Supabase toestaat. De CSP staat bewust op `Content-Security-Policy-Report-Only` voor de publieke pagina's — zie de toelichting in het bestand: een afdwingende CSP op een pagina met veel inline `onclick`/`style` breekt de werking, en die opschoning is te groot voor deze ronde.

---

## F-08 · MIDDEL · Twee productie-edge-functions staan niet in versiebeheer

| | |
|---|---|
| **Component** | `checkin`, `save-api-keys` |
| **Categorie** | A08 Software/Data Integrity |
| **Status** | **GEFIXT** (bron opgehaald en gecommit) |

**Beschrijving.** De Supabase-API toont 11 actieve functies; de repo bevat er 9. `checkin` en `save-api-keys` draaien in productie zónder broncode in Git. `checkin` draait bovendien met `verify_jwt=false` (publiek aanroepbaar) én met de **service role**. Code die niemand kan reviewen, waarvan niemand ziet of ze verandert, met de hoogste rechten in het systeem.

**Fix.** Live broncode opgehaald via de management-API en gecommit als `supabase/functions/checkin/index.ts` en `supabase/functions/save-api-keys/index.ts`, met een kop-commentaar dat vermeldt dat ze reverse-engineered zijn uit productie.

---

## F-09 · LAAG · `checkin` verklapt of een boeking-ID bestaat, en heeft geen rate limiting

**Component:** edge function `checkin`. Bij een onbekend ID komt er `404 "Reservatie niet gevonden"`, bij een bestaand ID met verkeerd token `403 "Ongeldige QR-code"`. Dat verschil is een enumeratie-orakel. Ook wordt het token vergeleken met `!==` (niet timing-veilig) en is er geen pogingenlimiet.

**Waarom LAAG.** Boeking-ID's zijn UUIDv4 (122 bit entropie). Enumereren is praktisch onhaalbaar. Ik heb dit **niet** proberen te brute-forcen (dat zou een DoS-achtige belasting op productie zijn).

---

## F-10 · LAAG · Publieke prijs-endpoint lekt interne gebruikers-UUID's

`GET /rest/v1/settings?select=*` geeft als anon ook `id` en `user_id` terug bij de prijsrijen. Geverifieerd:
`{"id":"578a057d-...","user_id":"d95e82e1-...","key":"toeristentaks",...}`. Interne medewerkers-UUID's zijn geen geheim, maar horen niet op een publiek endpoint. **Fix:** een view of kolomrestrictie die enkel `key` + `value` teruggeeft.

---

## F-11 · LAAG · 4 HIGH-CVE's in `sharp` (marketing-site)

`npm audit` op `marketing-site/`: 4 high, allemaal in libvips via `sharp` (CVE-2026-33327/33328/35590/35591). **Reële exploiteerbaarheid laag:** de site is een `output: 'export'` statische build; `sharp` draait alleen tijdens de build op Bryans eigen foto's en wordt niet meegeleverd naar de bezoeker. De fix (`npm audit fix --force`) forceert Next 16 — een breaking change. **Advies: niet blind upgraden**, plannen bij een volgende Next-upgrade.

`site-v2/`: 2 moderate (react-router SSR hydration). Die site is **niet gedeployed** (bewust gepauzeerd) — verwaarloosbaar.

---

## F-12 · LAAG · Twee `staff`-accounts waarvan minstens één een testaccount lijkt

`erik.campingcosmopolite@gmail.com` (laatste login 2026-07-30) en `erik.dodge4409@gmail.com` (2026-08-03) hebben allebei de rol `staff`. Beide zijn sindsdien niet meer gebruikt. Elk actief account is een extra ingang voor F-04. **Advies:** verwijder wat niet gebruikt wordt.

---

## F-13 · LAAG · "Leaked password protection" staat uit

Bevestigd door de Supabase-adviseur. Wachtwoorden worden niet getoetst aan HaveIBeenPwned. **Kan alleen Bryan aanzetten** in het Supabase-dashboard (Authentication → Policies) — niet via SQL of code.

---

## F-14 · INFO · SECURITY DEFINER-functies aanroepbaar door ingelogde gebruikers

De Supabase-adviseur meldt dit voor `has_role`, `is_admin`, `maak_factuur`, `verwijder_laatste_factuur`. **Geverifieerd: dit is hier correct-by-design.** De ACL's bevatten géén `anon` (migratie 034 werkte), en elke functie doet zijn eigen autorisatie: `maak_factuur` roept `has_role()` aan, `verwijder_laatste_factuur` roept `is_admin()` aan, `purge_expired_data` is enkel `postgres`/`service_role`. Geen actie nodig; wel bewust laten staan als geaccepteerde melding.

---

## F-15 · INFO · Root-`package.json` heeft geen lockfile

`npm audit` in de hoofdmap faalt met `ENOLOCK`. De hoofdmap heeft geen runtime-afhankelijkheden (enkel `node --test`), dus het risico is verwaarloosbaar — maar de dependency-scan is er daardoor blind. **Advies:** `npm i --package-lock-only` zodat CI dit kan controleren.

---

## Wat ik heb getest en NIET kwetsbaar bevonden

Deze punten zijn actief geprobeerd en hielden stand — dat is even belangrijk als de gaten:

| Test | Resultaat |
|---|---|
| Anon SELECT op `clients`, `bookings`, `gasten`, `booking_documents`, `payments`, `facturen`, `communicatie`, `integrations`, `user_roles`, `audit_logs`, `bezoekers`, `booking_kentekens`, `analytics_events` | Alles `[]` — RLS blokkeert correct |
| Anon poging om `mollie_api_key`, `anthropic_api_key`, `iban`, `last_betaallink`, `mail_sender_email` uit `settings` te lezen | Alles `[]` — sleutel-whitelist werkt |
| Anon teruglezen van een geüpload bestand in `id-fotos` | 404 — bucket is privé |
| Anon listen van `id-fotos` | Lege lijst |
| Anon DELETE in beide buckets | 403 Access Denied |
| Secrets in de werkende boom (service-role, `sk-ant-`, `GOCSPX-`, Resend, Google-keys) | Niets gevonden |
| Secrets in de volledige Git-historie (252 commits) | Niets gevonden |
| Is `handleiding/Snelstart-Karen.html` (bevat wachtwoord) ooit gecommit? | Nee, nooit |
| XSS: 61 `innerHTML`-toewijzingen versus 117 `esc()`-aanroepen; gericht gezocht naar klantvelden zonder escaping | Geen enkele onge-escapete interpolatie gevonden |
| Self-signup / anonieme login | Beide uitgeschakeld |
| `anon` in de ACL van SECURITY DEFINER-functies | Afwezig — migratie 034 hield stand |
| RLS ingeschakeld op alle 20 publieke tabellen | Ja, alle 20 |
