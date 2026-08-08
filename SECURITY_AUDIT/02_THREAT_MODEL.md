# 02 — Dreigingsmodel

## Wat er te beschermen valt

| Bezit | Waarde | Ergste geval |
|---|---|---|
| Foto's van identiteitsdocumenten (210 objecten) | **Hoogst** | Datalek van identiteitsbewijzen → meldplicht, reputatieschade, identiteitsfraude bij gasten |
| Reizigersregister (`gasten`) | Hoog | Wettelijke plicht niet naleefbaar + persoonsgegevenslek |
| Klantgegevens (`clients`) | Hoog | Lek van NAW, geboortedata, nummerplaten |
| Gmail OAuth-tokens (`integrations`) | Hoog | Volledige toegang tot Karens zakelijke mailbox |
| Facturen | Middel-hoog | Fiscale onbetrouwbaarheid |
| Beschikbaarheid van het boekingssysteem | Middel | Omzetverlies in het hoogseizoen |
| Supabase-opslagbudget | Laag-middel | Kostenexplosie |

## Dreigingsactoren en wat ze werkelijk kunnen

| Actor | Mogelijkheden | Realiteit na deze audit |
|---|---|---|
| **Anonieme internetaanvaller** | Publieke sleutel, alle publieke endpoints | Kan lezen: niets gevoeligs (13 tabellen getest). Kon schrijven: bestanden naar de ID-bucket (**gedicht**) en boekingen met valse prijs (**nog open**) |
| **Bot / scraper** | Massale aanvragen | Kan het postvak en de kalender vervuilen — client-side anti-bot is te omzeilen, Turnstile staat uit |
| **Kwaadwillende gast** | Eigen QR-link, eigen boeking-id | Kan enkel zijn eigen boeking zien/inchecken. Token is UUIDv4. |
| **Medewerker (`staff`)** | Geldige JWT | Kan mail versturen vanuit Karens mailbox, AI-kosten maken, alle klantgegevens lezen. **Grootste resterende risico.** |
| **Overgenomen account** | Idem als medewerker | Zelfde als hierboven; geen 2FA-afdwinging gecontroleerd |
| **Gecompromitteerde derde** (Supabase/Netlify/Anthropic) | Buiten controle | Beperkt door bewuste keuze om ID-foto's nooit als mailbijlage te versturen |
| **Onbedoelde ontwikkelaarsfout** | Volledig | Historisch de grootste bron: F-01, F-02 en F-16 zijn alle drie ontstaan door een fout of een stille platformwijziging, niet door een aanvaller |

## Aanvalsoppervlak

**Zonder inloggen:** `/reserveren` · `/check-in/` · `/upload/` · `/betaald/` · `/privacy/` · PostgREST anon · Storage anon · edge fns `guest-upload`, `checkin`, `mollie-webhook` (410).

**Na inloggen:** `/dashboard-nieuw/` · `/dashboard/` (oud, nog live) · alle tabellen via RLS · 8 edge functions · 4 RPC's.

## De belangrijkste inzichten uit dit model

1. **Zelfregistratie uitschakelen is hier de belangrijkste enkele beveiligingsmaatregel.** Het reduceert het "authenticated"-aanvalsoppervlak van "de hele wereld" naar vier bekende personen. Alle bevindingen rond ontbrekende rolcontroles hangen daaraan; zet dit nooit aan zonder eerst F-04 op te lossen.
2. **Het grootste resterende risico is intern, niet extern.** Een `staff`-account kan meer dan het zou mogen.
3. **De gevaarlijkste storingen waren stil.** Twee van de drie zwaarste bevindingen (F-02, F-16) waren geen aanval maar een fout die niemand opmerkte omdat er geen alerting is.
