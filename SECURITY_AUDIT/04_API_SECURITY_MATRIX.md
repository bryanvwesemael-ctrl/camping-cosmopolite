# 04 — API-beveiligingsmatrix

## Edge functions (11 live)

| Functie | JWT | Rolcontrole | Invoervalidatie | Rate limit | Gevoelige data | Oordeel |
|---|---|---|---|---|---|---|
| `guest-upload` | ❌ (bewust) | n.v.t. — `checkin_token` | ✅ **sterk**: magic-byte sniffing, 1 KB–15 MB, SHA-256 dedup, max 20 docs/boeking, optionele Turnstile | Per boeking (20 docs) | ID-documenten | **Goed** — beste gevalideerde functie van het project |
| `checkin` | ❌ (bewust) | n.v.t. — `checkin_token` | Minimaal | ❌ | Naam + e-mail gast | F-09: enumeratie-orakel, timing-onveilige vergelijking |
| `mollie-webhook` | ❌ | n.v.t. | n.v.t. | n.v.t. | Geen | Stub `410` — correct uitgeschakeld |
| `send-mail` | ✅ | ❌ | Beperkt | ❌ | Verstuurt vanuit Karens Gmail | **F-04** — vrij onderwerp/inhoud |
| `scan-id` | ✅ | ❌ | Beperkt | ❌ | ID-afbeelding → Anthropic | **F-04** — kostenmisbruik mogelijk |
| `create-payment` | ✅ | ❌ | Beperkt | ❌ | Bedragen | **F-04** + **F-05** (sleutel "laatst gewijzigde wint") |
| `gmail-sync` | ✅ | ❌ | n.v.t. | ❌ | Volledige e-mailinhoud | F-04, maar leest enkel de eigen integratie (`eq user_id`) |
| `gmail-oauth` | ✅ | ❌ | Beperkt | ❌ | OAuth-tokens | F-04; schrijft naar eigen `user_id` |
| `save-api-keys` | ✅ | ❌ | ❌ | ❌ | API-sleutels **in platte tekst** | **F-05** — aanbevolen te verwijderen |
| `parse-inbox-ai` | ✅ | ❌ | ✅ `valideerExtractie()` + system/user-scheiding tegen prompt-injectie | ❌ | E-mailinhoud → Anthropic | F-04; injectieverdediging is degelijk |
| `purge-storage` *(nieuw)* | ✅ | ✅ **admin** | ✅ | n.v.t. | Verwijdert ID-bestanden | **Goed** — droogloop standaard |

## PostgREST — anonieme rechten

| Tabel | Toegestaan voor anon | Beoordeling |
|---|---|---|
| `clients` | INSERT (lengtegrenzen, e-mail bevat `@`, `id_foto_url` moet NULL) | Redelijk |
| `bookings` | INSERT (uitgebreide veldcontrole, datumvenster −7 d/+1095 d, personen 1–60) | **Gat: bedrag ≥ 0 → F-03** |
| `gasten` | INSERT (naam 1–120, `foto_url` NULL, `id_consent` false) | Goed |
| `booking_kentekens` | INSERT (plaat 1–15, slagboomvlag geforceerd false) | Goed |
| `communicatie` | INSERT (enkel concept/uitgaand, geen gmail-id's) | Goed |
| `analytics_events` | INSERT (event uit vaste lijst) | Goed |
| `settings` / `club_settings` | SELECT op sleutel-whitelist | Goed — maar lekt `user_id` (F-10) |
| `website_paginas`, `wb_sites`, `wb_paginas` | SELECT enkel gepubliceerd | Goed |
| **Alle overige tabellen** | Niets | ✅ live geverifieerd |

## RPC's

| Functie | Aanroepbaar door | Interne controle |
|---|---|---|
| `has_role(uuid)` | authenticated | n.v.t. (is zelf de controle) |
| `is_admin(uuid)` | authenticated | n.v.t. |
| `maak_factuur(...)` | authenticated | ✅ `has_role()` |
| `verwijder_laatste_factuur(...)` | authenticated | ✅ `is_admin()` + enkel laatste volgnr + reden verplicht + audit-log |
| `purge_expired_data()` | **enkel** postgres/service_role | ✅ |
| `te_verwijderen_id_bestanden()` *(nieuw)* | **enkel** postgres/service_role | ✅ read-only |

`anon` komt in geen enkele ACL voor — geverifieerd.
