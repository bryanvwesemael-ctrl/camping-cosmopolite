# 07 — Verwerkerskaart

| Verwerker | Dienst | Welke persoonsgegevens | Locatie | Doorgifte buiten EER | DPA |
|---|---|---|---|---|---|
| **Supabase Inc.** | Databank, auth, opslag | Alles: NAW, register, ID-foto's, e-mailinhoud, OAuth-tokens | EU — Frankfurt | Nee (EU-regio) | Standaard-DPA beschikbaar, **ondertekening niet aantoonbaar** |
| **Netlify Inc.** | Statische hosting | Geen opslag; wel verkeer/IP in logs | VS | Ja — SCC's | **Niet aantoonbaar** |
| **Anthropic PBC** | AI: ID-uitlezen (`scan-id`) + e-mailintake (`parse-inbox-ai`) | **Afbeelding van identiteitsdocument** + volledige e-mailinhoud | VS | Ja — SCC's | **Open vraag — belangrijkste juridische leemte** |
| **Google Ireland Ltd.** | Gmail API, verzenden/ontvangen | E-mailadressen, berichtinhoud | EU/VS | Ja | Via Karens Google-account |
| **Cloudflare** | Turnstile bot-check | IP, browser-fingerprint | Wereldwijd | Ja | **Niet actief** — geen gegevens stromen |
| **Mollie** | Betalingen | — | EU | — | **Uitgeschakeld** (`410`-stub) |

## Aandachtspunten

1. **Anthropic is de scherpste kant.** Er gaan foto's van identiteitsdocumenten naar een verwerker in de VS. Het privacybeleid vermeldt dit correct, maar de verwerkersovereenkomst en de rechtsgrond voor de doorgifte zijn niet geverifieerd.
2. Het bestand `legal/verwerkersovereenkomst.md` bestaat, maar er is geen bewijs van ondertekening door enige partij. Dit komt overeen met openstaande taak #77 in het project.
3. Het privacybeleid noemt alle vier de actieve verwerkers correct en met de juiste dienstomschrijving — dat is beter dan gemiddeld.
