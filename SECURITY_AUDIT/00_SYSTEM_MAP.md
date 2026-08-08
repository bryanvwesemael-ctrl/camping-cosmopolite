# 00 — Systeemkaart

**Datum:** 2026-08-08 · **Auditor:** Claude Opus 5 (geautomatiseerde audit, geen menselijke pentester)
**Scope:** repository `camping-cosmopolite` + het live Supabase-project `whubbowuqhjdkdequbmb` + de live Netlify-site.

> **Testomgeving:** er bestaat **geen staging**. Alle live-verificatie is uitgevoerd tegen **productie met echte klantgegevens**, uitsluitend read-only of met onmiddellijk opgeruimde testrecords. Er zijn géén destructieve tests, geen brute force, geen DoS-tests uitgevoerd.

## Stack

| Laag | Technologie |
|---|---|
| Frontend publiek | Vanilla HTML/JS, één bestand per pagina (`reserveren.html`, `check-in/`, `upload/`, `betaald/`, `privacy/`) |
| Frontend beheer | Vanilla JS SPA — `dashboard-nieuw/` (actief), `dashboard/` (oud, nog bereikbaar) |
| Gedeelde logica | `shared/pricing.js`, `shared/upload.js`, `shared/guests.js`, `shared/payment.js` |
| Marketingsite | Next.js 15 static export (`marketing-site/`) — aparte Netlify-site |
| Backend | Supabase (PostgreSQL + PostgREST + Auth + Storage) |
| Serverlogica | 11 Supabase Edge Functions (Deno) |
| Hosting | Netlify (`camping-cosmopolite.netlify.app`) |
| CI | GitHub Actions — 1 workflow (`tests.yml`), enkel unit tests |
| AI | Anthropic API (ID-scan + e-mailintake) |
| Mail | Gmail API via OAuth (Karens mailbox) |
| Betaling | QR/IBAN (Mollie uitgeschakeld) |

## Vertrouwensgrenzen

```
INTERNET (onvertrouwd)
   │
   ├─► Netlify statische bestanden ─────────── publieke HTML/JS, bevat anon-key (by design)
   │
   ├─► PostgREST met anon-key ──────────────── GRENS 1: RLS-policies
   │       INSERT: clients, bookings, gasten, booking_kentekens, communicatie, analytics_events
   │       SELECT: enkel prijs-/publieke keys + gepubliceerde websitepagina's
   │
   ├─► Storage API met anon-key ────────────── GRENS 2: storage-policies  ⚠️ ZWAK (zie F-01)
   │       INSERT toegestaan op id-fotos + booking-fotos zonder enige beperking
   │
   ├─► Edge functions verify_jwt=false ─────── GRENS 3: eigen tokencontrole
   │       guest-upload (checkin_token), checkin (checkin_token), mollie-webhook (410-stub)
   │
   └─► Edge functions verify_jwt=true ──────── GRENS 4: Supabase-JWT
           ⚠️ Meeste checken enkel "ingelogd", niet de rol (zie F-04)

INGELOGDE MEDEWERKER (semi-vertrouwd: 4 accounts, self-signup UIT)
   └─► PostgREST met user-JWT ──────────────── has_role() / is_admin() in RLS

SERVICE ROLE (volledig vertrouwd) ─────────── enkel binnen edge functions, omzeilt alle RLS
```

## Rollen (geverifieerd in `auth.users` + `user_roles`)

| E-mail | Rol | Laatste login |
|---|---|---|
| bryan.v.wesemael@gmail.com | admin | 2026-07-29 |
| karen.campingcosmopolite@gmail.com | admin | 2026-08-07 |
| erik.campingcosmopolite@gmail.com | staff | 2026-07-30 |
| erik.dodge4409@gmail.com | staff | 2026-08-03 |

**Kritiek mitigerend feit (geverifieerd):** `GET /auth/v1/settings` geeft `"disable_signup": true` en `"anonymous_users": false`. Een buitenstaander kan zichzelf **geen** account aanmaken. Daardoor zakken alle "authenticated maar geen rolcontrole"-bevindingen van kritiek naar medium (insider-/accountovername-risico i.p.v. internetrisico).

## Persoonsgegevens (waar staat wat)

| Tabel/bucket | Gegevens | Gevoeligheid |
|---|---|---|
| `clients` | naam, e-mail, telefoon, geboortedatum, nationaliteit, woonplaats, ID-nummer, nummerplaten | Hoog |
| `gasten` | naam, geboortedatum, geboorteplaats, nationaliteit, documentnummer, documenttype | Hoog (wettelijk reizigersregister) |
| `booking_documents` | verwijzing naar ID-scan + hash | Hoog |
| **storage `id-fotos`** | **210 objecten: foto's van identiteitskaarten/paspoorten** | **Zeer hoog** |
| `bookings` | verblijfsgegevens, bedragen, nota's | Middel |
| `communicatie` | volledige e-mailinhoud met klanten | Middel-hoog |
| `booking_kentekens` | nummerplaten | Middel |
| `facturen` | bevroren jsonb-snapshot met NAW + bedragen | Middel-hoog |
| `analytics_events` | session_id, geen naam/IP | Laag |
| `integrations` | Gmail OAuth refresh/access tokens | Zeer hoog |
| `settings` | o.a. verouderde `resend_api_key` in platte tekst | Hoog |

## Instappunten (volledige lijst)

**Publiek, zonder auth:** `/reserveren` (form-insert), `/check-in/` (→ `checkin` fn), `/upload/` (→ `guest-upload` fn), `/betaald/`, `/privacy/`, PostgREST anon-endpoints, Storage anon-INSERT, edge fns `guest-upload`, `checkin`, `mollie-webhook`.

**Na login:** `/dashboard-nieuw/`, `/dashboard/` (oud, nog live), alle PostgREST-tabellen via RLS, edge fns `send-mail`, `scan-id`, `create-payment`, `gmail-oauth`, `gmail-sync`, `parse-inbox-ai`, `invite-user`, `save-api-keys`, RPC's `maak_factuur` / `verwijder_laatste_factuur` / `has_role` / `is_admin`.

## Externe verwerkers

Supabase (EU-Frankfurt) · Netlify (VS) · Anthropic (VS) · Google/Gmail (EU-VS) · Cloudflare Turnstile (aanwezig maar **niet actief** — live geverifieerd: `window._turnstileOn === false`) · Mollie (uitgeschakeld).
