# 20 — Naleving Belgisch & EU-recht + eindbeslissing productie

**Datum:** 2026-08-17 · **Vervolg op:** audit 2026-08-08 (F-01 t/m F-16, dossiers 00–19)
**Aard:** technisch/compliance-assessment, **geen juridisch advies**. Eindvalidatie van juridische
conclusies hoort bij een Belgische jurist. Elke conclusie is gemarkeerd als GEVERIFIEERD /
AFGELEID / ONBEKEND.

---

## 1. Herverificatie kernbeveiliging (live getest 2026-08-17)

| Controle | Resultaat | Status |
|---|---|---|
| RLS aan op alle 21 public-tabellen | Ja — allemaal `relrowsecurity=true`; `systeem_storing_bevestigd` bewust 0 policies (deny-all, enkel via SECURITY DEFINER) | GEVERIFIEERD |
| Anonieme REST-toegang tot gevoelige tabellen (gasten, clients, bookings, payments, facturen, audit_logs, user_roles, integrations, booking_documents) | Allemaal leeg `[]` — RLS filtert | GEVERIFIEERD |
| `settings?select=*` als anon | `42501 permission denied` (F-10-fix intact; enkel key,value leesbaar) | GEVERIFIEERD |
| Private storage bucket `id-fotos` als anon | `Bucket not found` — bestaan wordt niet eens bevestigd | GEVERIFIEERD |
| Edge functions zonder auth-header | `UNAUTHORIZED_NO_AUTH_HEADER` op gateway-niveau (send-mail, scan-id getest) | GEVERIFIEERD |
| Security headers live (HSTS preload, X-Frame DENY, nosniff, Referrer-Policy, Permissions-Policy, CSP-Report-Only met frame-ancestors 'none') | Aanwezig op productie | GEVERIFIEERD |
| CDN-scripts (4 stuks, jsdelivr) | Versie-gepind **en** allemaal met SRI `integrity`-attribuut | GEVERIFIEERD |
| npm-dependencies | Geen — vanilla JS, geen node_modules in productie; supply-chain beperkt tot de 4 SRI-gepinde CDN-scripts | GEVERIFIEERD |
| Supabase security advisors | 0 errors. 7 warnings: SECURITY DEFINER-functies aanroepbaar door `authenticated` — allemaal bewust (elk doet intern `has_role()`-check); 1 info over deny-all-tabel | GEVERIFIEERD |
| AI-uitlezing ID-documenten | Server-side uitgeschakeld (`AI_SCAN_ENABLED=false` in scan-id) | GEVERIFIEERD |
| Prijsmanipulatie publiek formulier (F-03) | anon-policy vereist `bedrag_totaal IS NULL` | GEVERIFIEERD (2026-08-08, end-to-end) |

## 2. Verwerkingsregister (art. 30 AVG — verantwoordelijke: Club Cosmopolite VZW)

| Gegeven | Doel | Rechtsgrond | Bewaartermijn | Locatie | Verwerker |
|---|---|---|---|---|---|
| Naam, e-mail, telefoon, adres hoofdboeker | Reservatie uitvoeren | Art. 6(1)(b) contract | 7 jaar na vertrek | Supabase EU (Parijs) | Bryan Van Wesemael (Project Atlas) |
| Naam medereizigers | Gastenregister | Art. 6(1)(c) wettelijke plicht (KB 27/04/2007 — toepasselijkheid op campings AFGELEID, zie dossier 19) | 3 jaar | Supabase EU | idem |
| Geboortedatum, -plaats, nationaliteit, documentnr./type | Gastenregister | Art. 6(1)(c) | 7 jaar (registerdata) | Supabase EU | idem |
| **Foto ID-document hoofdboeker** | Register staven / controle | Gemengd: 6(1)(c) voor de registratie; de foto zelf: 6(1)(f) gerechtvaardigd belang — **zwakste schakel**, zie dossier 19 | 7 jaar na vertrek (automatisch, migratie 047), verlengbaar per dossier met gedocumenteerde reden (`data_hold`) | Supabase EU, private bucket, signed URLs | idem |
| Kenteken | Slagboomtoegang | Art. 6(1)(f) | Tot einde verblijf | Supabase EU | idem |
| Betaalreferentie/OGM, bedragen | Facturatie | Art. 6(1)(c) boekhoudwet | 7 jaar | Supabase EU | idem |
| IP/technische events | Misbruikpreventie formulier | Art. 6(1)(f) | 14 maanden | Supabase EU | idem |

Bijzondere categorieën (art. 9): **niet verwerkt** — ID-voorzijde bevat geen gezondheids-/biometrische
verwerking (de foto wordt niet biometrisch vergeleken; rijksregisternummer wordt bewust nooit
uitgelezen). GEVERIFIEERD in code (scan-id prompt verbiedt RRN; functie staat bovendien uit).

## 3. Derde-partijenregister

| Partij | Dienst | Gegevens | Land | DPA | Mechanisme | Risico |
|---|---|---|---|---|---|---|
| Supabase Inc. | DB, auth, storage | Alles incl. ID-foto's | **EU (eu-west-3, Parijs)** | Standaard-DPA in ToS — **ondertekening/archivering nog te bevestigen door Bryan** | Geen doorgifte (EU-hosting) | Laag |
| Netlify Inc. | Statische hosting | Geen persoonsdata at rest; verkeer passeert CDN | VS-onderneming, wereldwijd CDN | Standaard-DPA — idem te bevestigen | SCC's (Netlify standaard) | Laag |
| Cloudflare (Turnstile) | Botdetectie | Technische verificatie, geen ID-inhoud | VS/wereldwijd | Standaard | SCC's/DPF | Laag |
| Google Ireland | Gmail-mailbox camping | Mailverkeer met gasten | EU/VS | Google Workspace-voorwaarden | SCC's/DPF | Laag-midden |
| ~~Mollie~~ | Niet in gebruik | — | — | — | — | n.v.t. |
| ~~Anthropic~~ | Uitgeschakeld (scan-id én in praktijk parse-inbox-ai niet gebruikt) | — | — | — | — | n.v.t. |

## 4. Belgische wetgeving

| Wet | Van toepassing? | Status |
|---|---|---|
| AVG + Wet 30/07/2018 | Ja | Grotendeels op orde: register (boven), privacyverklaring live en accuraat, DPA opgesteld (nog te ondertekenen), datalekprocedure in DPA art. 8 (48u intern melden; GBA-melding binnen 72u is verantwoordelijkheid van de VZW). GEVERIFIEERD dat privacyverklaring en werkelijk gedrag overeenkomen na correcties van 12–13/08. |
| Boek VI WER (consumentenbescherming, verkoop op afstand) | Ja (B2C-boekingen) | Identiteit uitbater + KBO/BTW in footer GEVERIFIEERD; prijs vooraf getoond incl. detail. Herroepingsrecht: accommodatie met bepaalde datum valt onder de uitzondering van art. VI.53, 12° WER — geen herroepingsrecht vereist, wel aan te raden dit expliciet in de boekingsvoorwaarden van de camping te vermelden. AFGELEID — tekstcheck door jurist aanbevolen. |
| ePrivacy/cookies (art. 129 WEC) | Ja | Enkel functionele localStorage (`cc_cookie_consent`, `cc_lang`) + noodzakelijke sessie. Geen tracking, geen marketing, geen analytics-cookies van derden. Cookiebanner aanwezig (conservatief; strikt genomen niet eens vereist voor enkel-functioneel). GEVERIFIEERD. |
| Identiteitsregistratie logies (KB 27/04/2007) | Waarschijnlijk | Zie dossier 19 — regionale Waalse plicht afgeschaft 07/2025, federale basis blijft; camping-dekking AFGELEID, niet 100% bevestigd. Vraag ligt klaar voor advocaat. |
| Peppol e-facturatie (sinds 01/2026, B2B) | Ja — voor **Bryans facturen aan de VZW** | Vastgesteld 13/08: factuur 2026-001 moet via Peppol (gratis in Accountable), niet als PDF-bijlage. Actie bij Bryan. GEVERIFIEERD (VZW is btw-plichtig volgens KBO). |

## 5. EU-wetgeving (toepasselijkheidsmatrix)

| Regeling | Van toepassing? | Waarom | Actie |
|---|---|---|---|
| **NIS2** (BE-omzetting: wet 26/04/2024) | **Nee** | Dubbele toets faalt beide kanten: (1) sector — camping/kleinschalige SaaS-leverancier valt niet onder de bijlage-I/II-sectoren; (2) omvang — zowel de VZW als de eenmanszaak zijn micro-entiteiten, ver onder de 50 werknemers/€10M-drempel, en geen van de uitzonderingscategorieën (DNS, telecom, overheids-kritiek) geldt. AFGELEID uit de sectorlijsten; grensgevallen bestaan hier niet realistisch. | Geen. Zinvolle NIS2-praktijken die tóch al toegepast zijn: incidentdetectie (storingsbanner), auditlogs, backups (Supabase PITR), leveranciersinventaris (dit dossier). |
| **AI Act** | Nee (huidige staat) | Alle AI-functies staan uit of worden niet gebruikt. Zou scan-id ooit heraangezet worden: tekst-uitlezing van een document is geen verboden praktijk en geen bijlage-III-hoogrisicotoepassing (geen biometrische identificatie, geen besluitvorming met rechtsgevolg — een mens controleert alles). AFGELEID. | Bij heractivering: transparantie (melden dat AI meeleest) volstaat vermoedelijk; herbeoordelen op dat moment. |
| **DSA** | Nee | Geen tussenhandelsdienst: de site host geen content van derden voor het publiek; gasten uploaden enkel eigen documenten in een privéproces. | Geen. |
| **DMA** | Nee | Geen poortwachter, triviaal buiten scope. | Geen. |
| **Data Act** | Nee | Geen connected products/IoT-data. (Slagboom is handmatige invoer, geen sensor-dataproduct.) | Geen. |
| **Cyber Resilience Act** | Nee (waarschijnlijk) | CRA dekt "producten met digitale elementen" op de markt; pure SaaS/webdiensten vallen buiten de kern-scope. AFGELEID — CRA-guidance evolueert; herbekijken als Project Atlas ooit als installeerbaar product verkocht wordt. | Volgen bij productisering. |
| **European Accessibility Act** (van kracht 06/2025) | Formeel ja (e-commercedienst B2C), **maar micro-ondernemingsvrijstelling** | Dienstverleners die micro-onderneming zijn (<10 FTE en <€2M omzet) zijn vrijgesteld van de dienstenverplichtingen — geldt voor de VZW. AFGELEID. | Vrijstelling geldt, maar basistoegankelijkheid (contrast, labels, toetsenbord) is al deels aanwezig en blijft goede praktijk; meenemen bij de nieuwe marketingsite. |
| **ePrivacy-richtlijn** | Ja | Zie Belgische tabel — op orde. | Geen. |

## 6. Openstaande punten voor de gate (ongewijzigd + nieuw)

| # | Punt | Zwaarte | Eigenaar |
|---|---|---|---|
| 1 | "Leaked password protection" aanzetten in Supabase Auth-instellingen | Midden | Bryan (alleen via dashboard-UI) |
| 2 | DPA's Supabase/Netlify formeel bevestigen/archiveren | Midden (papierwerk, geen techniek) | Bryan |
| 3 | Contractpakket + DPA laten ondertekenen door Karen (en jurist-check) | Midden | Bryan/Karen |
| 4 | CSP op publieke pagina's nog Report-Only (dashboard-nieuw wél enforced) | Laag-midden | Bryan (vergt eerst inline-onclick-refactor `reserveren.html`) |
| 5 | `checkin`-functie: timing-safe vergelijking + rate limiting (F-09) | Laag | Bryan |
| 6 | MFA op Karens admin-account niet afgedwongen | Midden | Bryan/Karen |
| 7 | Twee ongebruikte staff-accounts (erik.*) — verwijderen of bevestigen | Laag | Karen |
| 8 | Externe alerting bij gefaalde cronjobs (banner werkt, maar enkel zichtbaar bij inloggen) | Laag | Bryan |
| 9 | Factuur 2026-001 via Peppol versturen (niet PDF-mail) | Midden (wettelijk) | Bryan |

Geen van deze is CRITICAL of HIGH. Punten 1, 6 en 9 zou ik binnen 7 dagen doen.

## 7. Eindbeslissing

| Dimensie | Status |
|---|---|
| **Security** | 🟡 — geen gekende critical/high binnen scope; punten 1/4/5/6 open als hardening |
| **Privacy** | 🟡 — techniek en documentatie consistent; ID-foto-rechtsgrond blijft het zwakste punt (bewust, gedocumenteerd, wacht op jurist) |
| **Legal/compliance BE-EU** | 🟡 — geen toepasselijke wet waar tegen gezondigd wordt binnen wat verifieerbaar was; DPA-ondertekening en Peppol zijn de twee concrete acties |
| **PRODUCTIEBESLISSING** | **GO — met de 9 gekende punten als opvolgingslijst.** De applicatie draait al in productie; niets van het bovenstaande rechtvaardigt offline halen. |

Formulering conform de opdracht: *binnen de scope van deze audit zijn geen critical/high-bevindingen
geïdentificeerd*. Dat is geen absolute veiligheidsgarantie.

---
*Alle "GEVERIFIEERD"-regels zijn op 2026-08-17 live tegen productie getest (REST, storage, edge
functions, headers, advisors, pg_class/pg_policies). Juridische conclusies: bronnen en datums in
dossiers 19 en de DPA; jurist-validatie blijft de aanbevolen laatste stap.*
