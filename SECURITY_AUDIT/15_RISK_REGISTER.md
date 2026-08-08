# 15 — Risicoregister

Gesorteerd op ernst. "Status" weerspiegelt de toestand **na** de remediatie in deze auditronde.

| ID | Ernst | Titel | Bewezen? | Status |
|---|---|---|---|---|
| F-16 | **KRITIEK** | Maandelijkse GDPR-opruiming crasht volledig — geen enkele bewaartermijn wordt uitgevoerd | Ja — `cron.job_run_details` toont `failed` op 2026-08-01 | **GEFIXT + geverifieerd** |
| F-01 | **HOOG** | Anonieme upload naar de privé ID-fotobucket, zonder groottelimiet | Ja — HTTP 200 met enkel de publieke sleutel | **GEFIXT + regressietest** |
| F-02 | **HOOG** | ID-documenten worden nooit uit opslag gewist; 81 wees-bestanden | Ja — 210 objecten, 81 zonder verwijzing | **GEFIXT** (opruiming klaar, uitvoering wacht op akkoord) |
| F-03 | **HOOG** | Prijs komt van de client; boeking van €0 aanvaard | Ja — 14 nachten/6 pers. voor €0 aangemaakt | **OPEN** — keuze nodig |
| F-04 | MIDDEL | Edge functions checken "ingelogd", niet de rol | Codeanalyse; misbruik niet uitgevoerd | **OPEN** |
| F-05 | MIDDEL | API-sleutels in platte tekst + "laatst gewijzigde wint" over gebruikers heen | Codeanalyse; nu niet exploiteerbaar | **OPEN** |
| F-06 | MIDDEL | Geen server-side capaciteitslimiet of rate limiting; botcheck uit | Ja — anti-bot omzeild bij F-03-test | **OPEN** |
| F-07 | MIDDEL | Geen CSP; formulier miste clickjacking-bescherming | Ja — live headers gecontroleerd | **GEFIXT** |
| F-08 | MIDDEL | Twee productiefuncties niet in versiebeheer | Ja — 11 live vs. 9 in repo | **GEFIXT** |
| F-09 | LAAG | `checkin` verklapt bestaan van boeking-id; geen pogingenlimiet | Codeanalyse; niet gebrute-forced | **OPEN** |
| F-10 | LAAG | Publiek prijs-endpoint lekt interne gebruikers-UUID's | Ja — live response | **OPEN** |
| F-11 | LAAG | 4 HIGH-CVE's in `sharp` (enkel build-time) | Ja — `npm audit` | **OPEN, bewust** |
| F-12 | LAAG | Twee ongebruikte `staff`-accounts | Ja — `auth.users` | **OPEN** |
| F-13 | LAAG | Leaked-password-protection uit | Ja — Supabase-adviseur | **OPEN — enkel Bryan kan dit** |
| F-14 | INFO | SECURITY DEFINER-functies aanroepbaar door ingelogden | Geverifieerd correct-by-design | **GEACCEPTEERD** |
| F-15 | INFO | Root zonder lockfile → geen dependency-scan | Ja | **OPEN** |

## Scorekaart

Scores zijn een oordeel op basis van wat effectief getest is, niet op basis van de aanwezigheid van code die er veilig uitziet. Elke score verwijst naar het bewijs.

| Categorie | Score | Onderbouwing |
|---|---|---|
| Authenticatie | 80/100 | Self-signup uit, anonieme login uit, e-mailbevestiging aan (alle drie live geverifieerd). Aftrek: leaked-password-protection uit (F-13), twee ongebruikte accounts (F-12). |
| Autorisatie (databank) | 85/100 | RLS aan op alle 20 tabellen; 13 tabellen getest met de echte anon-sleutel, alle geblokkeerd; secretsleutels afgeschermd. Aftrek: F-03 (policy laat €0 toe). |
| Autorisatie (opslag) | 70/100 | Was 25 vóór de fix (anonieme schrijftoegang tot ID-bucket). Nu: anon geblokkeerd, groottelimiet en MIME-lijst actief, DELETE-policy hersteld. Aftrek: geen padbeperking per boeking. |
| API / edge functions | 55/100 | Alle functies vereisen een JWT of een token, en `guest-upload` doet degelijke validatie (magic bytes, dedup, groottegrens). Aftrek: 7 functies zonder rolcontrole (F-04), 2 stonden niet in versiebeheer (F-08). |
| Frontend | 75/100 | Geen enkele onge-escapete klantwaarde gevonden bij gerichte controle (61 innerHTML vs. 117 esc()). Aftrek: CSP staat op Report-Only voor publieke pagina's wegens inline handlers. |
| Infrastructuur / headers | 75/100 | HSTS met preload stond al goed. Na fix: basisheaders overal, afdwingende CSP op het dashboard. Aftrek: publieke CSP nog niet afdwingend. |
| Dependencies | 65/100 | 4 HIGH in `sharp`, maar build-time-only en niet meegeleverd. Aftrek ook voor het ontbreken van een lockfile in de hoofdmap. |
| Secretsbeheer | 80/100 | Volledige Git-historie (252 commits) schoon; geen sleutelmateriaal in de werkende boom; credentialbestand nooit gecommit. Aftrek: `save-api-keys` schrijft platte tekst (F-05). |
| Business logic | 45/100 | Overboekingsbescherming en factuurnummering zijn degelijk. Aftrek: prijsmanipulatie bewezen (F-03), geen capaciteitsgrens server-side (F-06). |
| GDPR — techniek | 50/100 | Was 25: alle bewaartermijnen faalden stilzwijgend. Nu hersteld en getest, maar de 81 bestaande wezen staan er nog en de wisfunctie is nog niet in productie uitgevoerd. |
| Privacy by design | 65/100 | Buckets privé, signed URL's met korte geldigheid, geen rijksregisternummer uitgelezen, AI enkel op verzoek. Aftrek: bewaartermijn werkte in de praktijk niet. |
| Logging & monitoring | 40/100 | `audit_logs` bestaat, INSERT-policy is aangescherpt tot `actor = auth.uid()`. Aftrek: geen storage-toegangslogboek, geen alerting, cron-falen bleef 5 weken onopgemerkt. |
| Testdekking | 35/100 | Er zijn unit tests voor prijsberekening/upload/gasten. Aftrek: geen enkele beveiligingstest, geen e2e, CI draait geen `npm audit`. |
| Back-up & herstel | ?/100 | **Niet beoordeeld** — geen zicht op de Supabase-back-upinstellingen vanuit deze omgeving. Zie "niet getest". |

**Gewogen totaal: 63/100.** Dat cijfer is een hulpmiddel, geen keurmerk — lees de bevindingen zelf.
