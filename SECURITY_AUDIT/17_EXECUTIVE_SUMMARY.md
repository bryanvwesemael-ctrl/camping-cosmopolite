# 17 — Managementsamenvatting

**Project Atlas / Camping Cosmopolite · audit 2026-08-08 · Claude Opus 5**

## In één alinea

Het fundament van dit systeem is beter dan gemiddeld: rij-beveiliging staat aan op alle twintig tabellen en houdt stand bij een echte aanval met de publieke sleutel, er staan nergens geheimen in de code of in 252 commits geschiedenis, en zelfregistratie is uitgeschakeld waardoor een buitenstaander geen voet aan de grond krijgt. Maar de audit legde vier reële gaten bloot die niet met een codereview alleen te vinden waren: **de maandelijkse AVG-opruiming crashte al vijf weken volledig zonder dat iemand het merkte**, **iedereen op het internet kon bestanden schrijven in de bucket met identiteitsdocumenten**, **81 ID-foto's van echte gasten waren nooit verwijderd hoewel het privacybeleid dat belooft**, en **een boeking van veertien nachten kon voor €0 worden ingediend**. Drie daarvan zijn tijdens deze ronde opgelost en de fixes zijn geverifieerd; de vierde vraagt een ontwerpkeuze van jou.

## De vier dingen die er echt toe doen

**1. De AVG-opruiming deed al vijf weken niets (KRITIEK, opgelost).**
Supabase heeft ergens tussen 1 juli en 1 augustus een beveiliging toegevoegd die SQL-deletes op de bestandsopslag blokkeert. Daardoor wierp de opruimfunctie een fout, en omdat alles in één transactie draait, rolde de héle opruiming terug — ook het wissen van gastgegevens na drie jaar en analytics na veertien maanden. Het logboek van de geplande taak toont zwart-op-wit `failed` op 1 augustus. Dit was alleen te vinden door de uitvoeringsgeschiedenis op te vragen; de code zag er prima uit. De echte les zit niet in de trigger maar in het feit dat een stille storing vijf weken lang niemand opviel.

**2. Iedereen kon uploaden naar de ID-fotobucket (HOOG, opgelost).**
Met alleen de publieke sleutel uit de paginabron kon ik bestanden in de privébucket met identiteitsdocumenten schrijven — geen groottelimiet, geen bestandstypecontrole. Teruglezen kon niet, dus het was geen datalek, maar wel: onbeperkte opslagkosten, en de mogelijkheid dat een derde willekeurige inhoud plaatst in precies díé map die Karen juridisch aanhoudt als identiteitsbewijzen. De policy was bovendien volstrekt overbodig — alle echte uploads lopen via een serverfunctie.

**3. 81 identiteitsdocumenten waren nooit gewist (HOOG, opgelost).**
Het dashboard probeerde ze wel te verwijderen, maar die poging faalde stil in een lege `catch`. Databankrij weg, bestand blijft. En zodra de rij weg is, kan geen enkel automatisme het bestand nog terugvinden. Het aantal groeide van 3 in juni naar 60 in juli.

**4. Een boeking van €0 wordt aanvaard (HOOG, nog open).**
De prijs wordt in de browser berekend en rechtstreeks weggeschreven; de databank controleert alleen "groter dan of gelijk aan nul". Ik heb veertien nachten voor zes personen met drie honden voor €0 aangemaakt (en meteen verwijderd). De schade blijft beperkt omdat Karen elke aanvraag handmatig bevestigt en int — maar de bescherming hangt nu af van of zij het bedrag opmerkt.

## Is het veilig genoeg?

| Vraag | Antwoord |
|---|---|
| Veilig genoeg voor ontwikkeling? | **Ja.** |
| Veilig genoeg voor staging? | **Ja** — al bestaat er geen staging, wat op zich een tekortkoming is: alle tests moesten tegen productie. |
| Veilig genoeg voor productie? | **Het dráait al in productie, met echte klantgegevens.** Na de fixes van vandaag is het risico aanzienlijk lager dan vanochtend, maar er blijven punten open die vóór het volgende hoogseizoen aangepakt moeten worden. Zie de productiepoort hieronder. |

## Wat jij moet doen — in volgorde

1. **De 63 wees-ID-documenten wissen.** Roep `purge-storage` aan met `{"bevestig":true}`. Ik heb dit bewust niet zelf gedaan: het verwijdert onomkeerbaar persoonsgegevens uit productie.
2. **Alerting op mislukte geplande taken.** Dit is de belangrijkste structurele les van deze audit.
3. **De €0-boeking dichtzetten.** Mijn advies staat in het remediatieplan (optie B: de client mag het bedrag niet meer meesturen).
4. **Leaked-password-protection aanzetten** in het Supabase-dashboard — dat kan alleen jij.
5. **Turnstile activeren** — de code staat er al, er ontbreekt enkel een sleutel.

## Wat juridisch nagekeken moet worden

1. Mag je überhaupt een *kopie* van het identiteitsdocument bewaren, of volstaat het overnemen van de gegevens? Het register verplicht gegevens, niet noodzakelijk een foto.
2. Is een DPIA vereist? Er worden op schaal identiteitsdocumenten verwerkt, met AI.
3. Verwerkersovereenkomsten met Supabase, Netlify en vooral Anthropic zijn niet aantoonbaar ondertekend.

## Wat ik niet kan garanderen

Deze audit is geautomatiseerd en vervangt geen menselijke penetratietest. Ik heb niet gebrute-forced, geen belastingtests gedaan, geen back-upherstel getest, en geen toegang gehad tot de Netlify- en Google-accountinstellingen. Of iemand vóór vandaag al misbruik heeft gemaakt van het uploadlek is **niet achteraf vast te stellen** — er is geen toegangslogboek op de opslag. Dat het systeem vandaag geen bekende kritieke gaten meer heeft, betekent niet dat het onkwetsbaar is.
