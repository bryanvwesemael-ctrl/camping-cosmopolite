# Oplevering — ID-flow, register, kalender & realtime

Branch: `feature/id-booking-register-calendar-integration`
Supabase-project: `whubbowuqhjdkdequbmb` · Datum: 2026-07-01

Gefaseerde herwerking (8 fases) van het reservatiesysteem: ID-upload zonder
handmatige gastnamen, bewuste AI-uitlezing, gekoppeld register/"Wie is er?"/
kalender, realtime samenwerking, rol-beveiliging en bewaartermijnen.

---

## 1. Architectuuroverzicht

**Stack:** vanilla JS + Supabase (Postgres, Auth, Storage, Edge Functions) · Netlify hosting.

```
PUBLIEK FORMULIER (index.html)
  submitForm → clients (upsert, idempotent) → bookings (idempotency_key)
             → guest-upload (anon, token) → booking_documents (+ storage id-fotos)
  Prijs via shared/pricing.js  ·  Validatie via shared/upload.js  ·  GEEN AI

DASHBOARD (dashboard/app.js)
  loadData → in-memory bookings → renderCalendar(_monthView) / renderWieIsEr /
             renderRegister — allemaal via shared/guests.js (interval-logica)
  Gasten & ID-tab → booking_documents → bewuste AI (scan-id) → controle →
             bevestigd → gasten (gekoppeld, gast_id op document)
  Realtime: bookings + gasten + booking_documents  ·  optimistic locking (version)

BETALING: create-payment → Mollie → mollie-webhook (service_role)
```

**Gedeelde bronmodules (één bron van waarheid):**
- `shared/pricing.js` — alle tarieven/berekening (formulier + dashboard + herprijzing)
- `shared/guests.js` — placeholder-marker, aanwezigheid/interval, presenceCategory, maskId
- `shared/upload.js` — signatuur-sniff, validatie, groottes

## 2. Gevonden fouten (en opgelost)
- **Register-lek:** niet-uitgelezen foto-uploads (`__pending_guest_upload__`) verschenen als nep-gasten in het politieregister/CSV/print. → gefilterd.
- **Register dubbeltelling:** contactnaam-rij *én* gasten-rijen samen. → bevestigde gasten of één voorlopige rij.
- **"Wie is er?" fout gekoppeld** aan `status=ingecheckt||betaald` (mengde betaling met aanwezigheid). → datuminterval verwacht/ingecheckt.
- **Purge FK-bug:** `booking_documents` werd niet vóór `bookings` verwijderd (7-jaar-sweep zou falen). → gefixt.
- **ID-scans nooit opgeruimd** (GDPR-gat). → instelbare bewaartermijn + storage-cleanup.
- **Storage-drift:** `authenticated_read_id_fotos` liet élke ingelogde gebruiker ID-scans lezen. → verwijderd, admin-only.
- **Elektriciteit-label "eenmalig"** vs per-nacht berekening (vorige audit). → per nacht.

## 3. Database-migraties
| # | Inhoud |
|---|---|
| 004 | audit/locking-kolommen (updated_at, version, deleted_at, created/updated_by) + triggers, drift `gasten.id_consent`, max-1-hoofdgast index, `vertrek>aankomst` |
| 005 | `booking_documents` + `id_proces_status` enum + per-boeking hash-unique |
| 006 | append-only `audit_logs` |
| 007 | `bookings.idempotency_key` (unique) |
| 008 | `gasten.geboorteplaats` + `documenttype` |
| 009 | realtime-publicatie: gasten + booking_documents |
| 010 | `is_admin()` + booking_documents/id-fotos **admin-only**, alle users → rol |
| 011 | purge: ID-scans + storage opruimen (instelbaar), FK-fix |
| 012 | backfill bestaande boekingen → hoofdgast + voorlopige gasten |

Elke migratie heeft een `*_rollback.sql`. Alle toegepast na dry-run (data schoon).

## 4. Rollback
Voer het bijbehorende `NNN_..._rollback.sql` in omgekeerde volgorde uit
(012 → 004). 010/012-rollbacks zijn best-effort (rol-toekenning en data-backfill
zijn bewust niet destructief teruggedraaid). Zie de kop van elk rollback-bestand.

## 5. Gewijzigde bestanden (kern)
`index.html` (documentplaatsen + bulk-upload) · `dashboard/app.js` (AI-gate,
register, wie-is-er, kalender, realtime, herprijzing, RLS-UI) · `dashboard/index.html`
(tabs, filters, retentie-UI) · `shared/{pricing,guests,upload}.js` ·
`supabase/functions/{guest-upload,scan-id}/index.ts` · `supabase/migrations/004-012` ·
`tests/{pricing,guests,upload}.test.js`.

## 6. Screenshots
Niet automatisch vastgelegd — de preview-harness bleef hangen op de pdf.js-worker
en cachete `app.js`. Functionele verificatie gebeurde via `preview_eval`
(module-loads, dedup, maskering, presence) en de live DB. Manueel te maken na deploy.

## 7. Testresultaten
`npm test` → **32/32 groen** (node:test, zero-dependency): pricing (15),
guests/presence/masking (8), upload-validatie (9). CI: `.github/workflows/tests.yml`.

## 8. Bewijs: geen automatische AI-kosten
`scan-id` wordt uitsluitend aangeroepen vanuit `aiScanSelected`/`rescanDoc` na een
expliciete klik + `confirm()`. `guest-upload` bevat géén AI-aanroep. Upload, submit,
dashboard-load en refresh raken `scan-id` nooit. Dedup via SHA-256 (client + DB-unique)
voorkomt dubbele uitlezing.

## 9. Bewijs: één databron voor kalender/register/"Wie is er?"
Alle drie gebruiken dezelfde in-memory `bookings` + `shared/guests.js`
(`isPresentOn`, `presenceCategory`, interval `aankomst ≤ d < vertrek`) en dezelfde
`gasten`-query (pending gefilterd). Datumwijziging roept `loadData()` → alle
weergaven hertekenen uit dezelfde bron.

## 10. RLS-overzicht
- `bookings/clients/gasten/communicatie/payments/booking_fotos`: authenticated volledig (dagelijkse werking); anon enkel insert (formulier).
- `booking_documents`: **admin-only** (ALL). Edge functions via service_role.
- storage `id-fotos`: read+update **admin-only**; insert authenticated/anon; edge via service_role.
- `audit_logs`: authenticated read+insert, **geen** update/delete (append-only).
- `settings/integrations`: eigen rijen. `user_roles`: zelf lezen, admin beheert.
- `purge_expired_data()`: enkel `postgres`/`service_role` (vorige audit).

**Bekende beperking:** kolom-niveau maskering (staff ziet boeking maar niet het
volledige ID-*nummer* in `gasten`) kan RLS niet afdwingen — vraagt een aparte view.
Frontend maskeert bij weergave; de ID-*beelden* zijn wél hard admin-only.

## 11. Bewaartermijnen
- Register-persoonsgegevens (`gasten`): 3 jaar · volledige boeking + afhankelijke records: 7 jaar · analytics: 14 maanden.
- **Originele ID-afbeeldingen**: instelbaar (`id_bewaartermijn_dagen`, default **90 dagen** na vertrek) via Instellingen → Juridisch, met juridische waarschuwing. Purge verwijdert record + storage-object.

## 12. Resterende aandachtspunten
- **Echte pixel-drag** op de kalender is niet gebouwd; datumwijziging/verlenging loopt via de herprijzing-modal (niet-stilzwijgend, met doorstroom).
- **HEIC**: aanvaard + bewaard, maar geen browser-thumbnail; AI-uitlezing van HEIC vraagt evt. server-side conversie.
- **PDF-splitsing** via pdf.js is niet met een echt bestand end-to-end getest (preview-harness).
- Kolom-maskering voor staff (zie §10).
- **Anthropic-sleutel** staat nog plaintext in `settings` — roteren + als Edge-secret zetten (openstaand uit vorige audit).
- Cloudflare Turnstile (bot-check) niet toegevoegd; huidige bescherming = honeypot + tijdslot + rate limit.

## 13-15. Deploy & rollback → zie onderaan de PR-omschrijving.
