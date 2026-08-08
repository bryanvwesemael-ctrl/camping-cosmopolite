# 08 — Business logic

Getest op de vraag "wat kan een kwaadwillende hier feitelijk mee?", niet enkel op technische kwetsbaarheden.

| Scenario | Mogelijk? | Bewijs / toelichting |
|---|---|---|
| **Prijs manipuleren** | ✅ **JA** | 14 nachten/6 pers./3 honden/4 auto's voor €0 aangemaakt (F-03). Verwijderd na de test |
| Andermans boeking bekijken | ❌ | RLS blokkeert; `checkin` vereist het UUID-token |
| Andermans gegevens wijzigen | ❌ | Geen anon UPDATE-policy op enige tabel |
| Betaling omzeilen / "betaald" zetten | ❌ | Geen anon-toegang tot `payments`; Mollie-webhook is een stub |
| Onbeperkt boekingen aanmaken | ✅ JA | Geen server-side rate limit of capaciteitsgrens (F-06) |
| Capaciteit (30 plaatsen) overschrijden | ✅ JA | `max_plaatsen` wordt enkel client-side gelezen |
| Datums manipuleren | ⚠️ beperkt | Policy dwingt `vertrek > aankomst` en venster −7 d/+1095 d af |
| Personenaantallen opblazen | ⚠️ beperkt | Policy begrenst op 1–60 personen, 50 tenten, 20 honden |
| Factuur vervalsen | ❌ | `maak_factuur` is de enige INSERT-weg, `has_role()`-gecontroleerd, snapshot bevroren, volgnummer via advisory lock |
| Factuur verwijderen om een gat te maken | ❌ | Enkel de laatste van het jaar, admin-only, reden verplicht, audit-log |
| Dubbele boeking bij dubbelklik | ❌ | `idempotency_key` met unique constraint; 23505 wordt correct afgehandeld |
| Safaritent/stacaravan dubbel boeken | ❌ | `vulEenhedenIn()` controleert overlappende eenheden bij aanmaken én bewerken |
| Race condition op factuurnummer | ❌ | `pg_advisory_xact_lock` per jaar |

## Sterke punten

De factuurarchitectuur is de best doordachte laag van het project: onveranderlijke snapshots, sequentiële nummering met advisory lock, geen UPDATE/DELETE-policies, verwijderen enkel van de laatste met verplichte reden en audit-spoor. Ook de overboekingsbescherming per fysieke eenheid en de idempotency-sleutel zijn degelijk.

## Zwakke punt

De prijsberekening is de uitzondering: één bron van waarheid in `shared/pricing.js`, maar die draait aan de kant van de client en het resultaat wordt ongecontroleerd vertrouwd. Dat het bedrag "maar" een richtprijs is en Karen handmatig bevestigt, is een organisatorische mitigatie — geen technische.
