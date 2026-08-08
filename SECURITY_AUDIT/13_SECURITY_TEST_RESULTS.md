# 13 — Uitgevoerde tests

Alles hieronder is werkelijk uitgevoerd op 2026-08-08 tegen **productie**. Bij elke test staat wat er is opgeruimd.

## Databanktoegang als anonieme bezoeker

```bash
ANON=$(grep -o "eyJ...[publieke anon-sleutel uit reserveren.html]" reserveren.html)
for t in clients bookings gasten booking_documents booking_fotos booking_attachments \
         payments facturen communicatie integrations user_roles audit_logs bezoekers \
         settings club_settings analytics_events booking_kentekens \
         website_paginas wb_sites wb_paginas; do
  curl -s "$URL/$t?select=*&limit=2" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
done
```
**Resultaat:** 13 gevoelige tabellen gaven `[]`. Enkel `settings`/`club_settings` (prijs-whitelist) en de gepubliceerde websitetabellen gaven data — zoals bedoeld.

## Kan anon de geheimen uit `settings` halen?

```bash
for k in mollie_api_key anthropic_api_key iban last_betaallink mail_sender_email; do
  curl -s "$URL/settings?select=key,value&key=eq.$k" -H "apikey: $ANON" ...
done
```
**Resultaat:** alle vijf `[]`. De sleutel-whitelist in de policy werkt.

## Opslag — vóór de fix

```bash
curl -X POST "$BASE/object/id-fotos/AUDIT-TEST-DELETE-ME/probe.txt" -H "apikey: $ANON" ...
  → HTTP 200  {"Key":"id-fotos/AUDIT-TEST-DELETE-ME/probe.txt", ...}
curl -X POST "$BASE/object/booking-fotos/AUDIT-TEST-DELETE-ME/probe2.txt" ...
  → HTTP 200
```
Teruglezen → 404. Listen → `[]`. Verwijderen → 403. **Write-only lek bevestigd.**

## Opslag — na migratie 037 (regressietest)

```bash
# met text/plain
→ 415 invalid_mime_type            (MIME-laag)
# met een geldig JPEG (magic bytes ff d8 ff e0)
→ 403 "new row violates row-level security policy"   (autorisatielaag)
```
Bewust beide getest: dat de MIME-filter iets tegenhoudt, bewijst niet dat de autorisatie klopt. Pas de tweede test toont aan dat de policy zelf blokkeert.

Legitieme weg blijft werken:
```bash
curl -X POST ".../functions/v1/guest-upload" -d '{"token":"000...","documents":[]}'
  → {"error":"Geen documenten ontvangen"}      # functionele fout, geen permissiefout
```

## Prijsmanipulatie

```bash
POST /rest/v1/clients   {"naam":"ZZZ AUDIT PRIJSTEST", ...}          → 201
POST /rest/v1/bookings  {aankomst 2026-09-01, vertrek 2026-09-15,
                         volwassenen 6, honden 3, autos 4,
                         elektriciteit true, bedrag_totaal 0}        → 201
```
14 nachten voor €0 aanvaard. **Opgeruimd:** beide records verwijderd, geverifieerd met `select count(*) → 0`.

## GDPR-opruiming

```sql
select runid, status, return_message from cron.job_run_details order by start_time desc;
-- runid 2 · 2026-08-01 · FAILED · "Direct deletion from storage tables is not allowed"
```
Na migratie 039:
```sql
select * from public.purge_expired_data();
-- {deleted_gasten:0, deleted_bookings:0, deleted_clients:0, deleted_analytics:0, deleted_documenten:0}
```
Draait nu zonder exception. 0 verwijderingen is correct: er is nog niets ouder dan de bewaartermijn.

```sql
select reden, count(*) from public.te_verwijderen_id_bestanden(7) group by reden;
-- wees_zonder_verwijzing | 63
```

## Wees-analyse identiteitsdocumenten

```sql
-- 210 objecten in id-fotos, 81 zonder actieve verwijzing
-- per maand: juni 3 · juli 60 · augustus 18
```

## Autorisatie nieuwe edge function

```bash
curl -X POST ".../functions/v1/purge-storage" -H "apikey: $ANON" -d '{}'
  → {"error":"Niet ingelogd"}
```

## Secrets

```bash
grep -rInE "service_role|sk-ant-|GOCSPX-|re_[A-Za-z0-9]{20,}|AIza..." --include=...
  → enkel documentatie die het wóórd "service_role" noemt, geen sleutelmateriaal
git grep -InE "sk-ant-api|GOCSPX-|..." $(git rev-list --all)     # 252 commits
  → niets
git log --all -- handleiding/Snelstart-Karen.html .env .env.local
  → leeg (nooit gecommit)
```

## Headers (live, vóór de fix)

| URL | Aanwezige headers |
|---|---|
| `/reserveren` | enkel HSTS |
| `/privacy/` | enkel HSTS |
| `/dashboard-nieuw/` | HSTS, X-Frame-Options, nosniff, Referrer-Policy |

## XSS

```bash
grep -c "innerHTML *(\+)?=" dashboard-nieuw/app-nieuw.js   → 61
grep -oE "\besc\(" dashboard-nieuw/app-nieuw.js | wc -l    → 117
grep -nE '\$\{[^}]*\b(naam|email|nota|onderwerp|inhoud|plaat|...)\b[^}]*\}' \
  dashboard-nieuw/app-nieuw.js | grep -v "esc("            → geen treffers
```

## Dependencies

`marketing-site`: 4 high (sharp/libvips) · `site-v2`: 2 moderate (react-router) · hoofdmap: `ENOLOCK`.

---

## Opgeruimde testdata

| Wat | Status |
|---|---|
| `clients`/`bookings` "ZZZ AUDIT PRIJSTEST" | Verwijderd, geverifieerd 0 |
| `clients`/`bookings`/`gasten` met `@example.com`/`@example.invalid` uit eerdere functionele tests | Verwijderd |
| `id-fotos/AUDIT-TEST-DELETE-ME/probe.txt` | **Nog aanwezig** — zie hieronder |
| `booking-fotos/AUDIT-TEST-DELETE-ME/probe2.txt` | **Nog aanwezig** — zie hieronder |

**Eerlijk gemeld:** de twee bewijsbestanden uit de F-01-test staan er nog. Anon mag (terecht) niet verwijderen, ik heb geen ingelogde adminsessie, en een directe SQL-delete wordt door de storage-trigger geblokkeerd. Ze bevatten enkel de tekst `audit probe` (11 bytes) en zijn onschadelijk. Ze verdwijnen vanzelf bij de volgende `purge-storage`-run (ze zijn wezen), of je verwijdert ze nu handmatig in het Supabase-dashboard → Storage.

---

## Niet getest, en waarom

| Onderwerp | Reden |
|---|---|
| Brute force op login of `checkin`-token | Zou een DoS-achtige belasting op productie zijn en echte accounts kunnen blokkeren |
| Grote-bestand-upload (opslag uitputten) | Zou werkelijke kosten en mogelijk quota-uitputting veroorzaken |
| Misbruik van `send-mail` door een staff-account | Zou een echte e-mail vanuit Karens mailbox versturen naar een echte gast |
| Herstel uit back-up (RPO/RTO) | Geen zicht op de Supabase-back-upinstellingen vanuit deze omgeving |
| Netlify-account, DNS, 2FA op de beheerdersaccounts | Buiten de repo en buiten mijn toegang |
| Gedrag van de Anthropic- en Google-verwerkers | Externe partijen, niet auditeerbaar van hieruit |
| Penetratietest door een mens | Deze audit is geautomatiseerd; hij vervangt geen professionele pentest |
| Of er vóór deze audit al misbruik is gemaakt van F-01 | Er is geen storage-toegangslogboek — niet achteraf vast te stellen |
