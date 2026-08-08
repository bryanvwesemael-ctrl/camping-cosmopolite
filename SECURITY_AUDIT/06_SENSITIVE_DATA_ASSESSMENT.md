# 06 — Beoordeling identiteitsdocumenten

De opdracht vroeg hier expliciet niet automatisch te concluderen dat het bewaren van ID-documenten rechtmatig is omdat er een operationele reden voor bestaat. Dat doe ik dan ook niet.

## De zestien vragen

| # | Vraag | Antwoord |
|---|---|---|
| 1 | Waarom wordt het bewaard? | Om het wettelijke logiesregister correct in te vullen en te kunnen staven bij politie/brandweer |
| 2 | Is dat doel noodzakelijk? | Het *register* is wettelijk verplicht. Of de *foto* noodzakelijk is: **juridische vraag, niet beantwoord** |
| 3 | Is het volledige document nodig? | Technisch niet — de AI leest de velden uit; daarna zou de foto weg kunnen |
| 4 | Bestaat er een minder ingrijpend alternatief? | **Ja**: gegevens overnemen, foto direct wissen na controle. Dit project is deze week al één stap die richting uit gegaan (medereizigers hoeven geen document meer) |
| 5 | Wie heeft toegang? | Elke ingelogde gebruiker met een rol (4 accounts). Lezen via `staff_read_id_fotos` |
| 6 | Wordt toegang gelogd? | **Nee.** Geen storage-toegangslogboek. Niet vast te stellen wie wanneer welk document bekeek |
| 7 | Hoe lang bewaard? | Beleid: 90 dagen na vertrek. **Feitelijk: onbeperkt tot deze audit** (F-02, F-16) |
| 8 | Hoe wordt het verwijderd? | Nu: `purge-storage` via de Storage-API. Vóór vandaag: helemaal niet |
| 9 | Versleuteld tijdens transport? | Ja — HTTPS/TLS overal, HSTS met preload |
| 10 | Is de opslag privé? | Ja, `public: false`, geverifieerd: anon kan niet teruglezen |
| 11 | Kunnen URL's toegang lekken? | Signed URL's met 120–3600 s geldigheid. Redelijk, maar 3600 s is ruim voor een ID-document |
| 12 | Kunnen beheerders erbij? | Ja, by design |
| 13 | Kunnen derden erbij? | Anthropic ontvangt de afbeelding tijdens een scan. Supabase host ze. Nooit als mailbijlage |
| 14 | Blijven ze in back-ups? | **Waarschijnlijk ja** — Supabase-back-ups niet beoordeeld. Verwijdering propageert niet naar back-ups |
| 15 | Is een DPIA gepast? | **Waarschijnlijk wel** — schaal + gevoeligheid + AI. Laten beoordelen |
| 16 | Juridische review nodig? | **Ja, op vraag 2 en 15** |

## Feitelijke toestand

- 210 objecten in `id-fotos`, oudste 2026-06-29
- Daarvan **81 zonder enige databankverwijzing** — onbereikbaar voor de applicatie, maar wel aanwezig
- Groei van wezen: juni 3 → juli 60 → augustus 18

## Oordeel

Technisch is de bescherming *tijdens* het bewaren behoorlijk: privébucket, signed URL's met korte geldigheid, geen rijksregisternummer, AI enkel op verzoek, nooit per mail. Waar het misging is het *einde* van de levenscyclus — de belofte "90 dagen en dan weg" werd niet nagekomen. Dat is nu technisch opgelost, maar de achterstand moet nog weggewerkt en de kernvraag of de foto überhaupt bewaard mag worden, blijft juridisch open.
