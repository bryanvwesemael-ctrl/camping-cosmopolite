# 09 — Technische AVG-beoordeling

> **Ik ben geen jurist.** Wat hieronder staat is een *technische* beoordeling: werkt wat het privacybeleid belooft, en is het technisch uitvoerbaar? Waar een juridisch oordeel nodig is, staat dat expliciet als open vraag. Verklaar op basis van dit document nergens "AVG-conform".

## Inventaris persoonsgegevens

| Categorie | Waar | Doel | Ogenschijnlijke grondslag | Bewaartermijn (beleid) | Werkt dat technisch? |
|---|---|---|---|---|---|
| NAW + contact | `clients` | Uitvoering reservatie | Art. 6(1)(b) overeenkomst | 7 jaar (boekhouding) | Ja — code aanwezig, nooit getriggerd (project 2 mnd oud) |
| Reizigersregister (naam, geboortedatum, nationaliteit, documentnummer) | `gasten` | Wettelijk logiesregister | Art. 6(1)(c) wettelijke plicht | 3 jaar | Ja, na fix F-16 |
| **Foto identiteitsdocument** | **storage `id-fotos`** | Register correct invullen + staven | Art. 6(1)(c) — **zie open vraag 1** | **90 dagen na vertrek** | **NEE vóór deze audit — zie hieronder** |
| Nummerplaten | `clients`, `booking_kentekens` | Slagboomtoegang | Art. 6(1)(f) gerechtvaardigd belang | tot einde verblijf | **Niet geïmplementeerd** — geen automatisme dat kentekens wist |
| E-mailinhoud | `communicatie` | Klantcommunicatie | Art. 6(1)(b) | niet gedefinieerd | **Geen bewaartermijn** — enkel via de 7-jaarsopruiming van de boeking |
| Facturen (jsonb-snapshot met NAW) | `facturen` | Fiscale plicht | Art. 6(1)(c) | 7 jaar | Onveranderlijk by design; geen opruiming |
| Analytics | `analytics_events` | Formulieroptimalisatie | Art. 6(1)(a) toestemming (cookiebanner) | 14 maanden | Ja, na fix F-16 |
| Gmail OAuth-tokens | `integrations` | Mail versturen | Art. 6(1)(b) | tot ontkoppeling | Handmatig |

## Het centrale probleem: de bewaartermijn werkte niet

Dit is de belangrijkste AVG-bevinding en ze is hard bewezen (zie F-16 en F-02):

1. De maandelijkse opruimjob **crashte volledig** op 1 augustus 2026 en rolde alles terug. Geen enkele bewaartermijn — niet de 90 dagen voor ID-foto's, niet de 3 jaar voor het register, niet de 14 maanden voor analytics — werd uitgevoerd.
2. Los daarvan werden ID-foto's **nooit** uit de opslag verwijderd wanneer een boeking in het dashboard werd gewist: er was geen DELETE-policy, en de code slikte de fout stil in. Resultaat: **81 wees-bestanden met identiteitsdocumenten**, groeiend van 3 in juni naar 60 in juli naar 18 in de eerste week van augustus.

Het privacybeleid belooft de gast letterlijk: *"De foto wordt 90 dagen na uw vertrek automatisch verwijderd."* Die belofte werd technisch niet nagekomen. Dat is geen theoretisch risico maar een feitelijk verschil tussen wat er staat en wat er gebeurt.

**Beide oorzaken zijn in deze ronde opgelost en de fix is geverifieerd.**

## Beleidswijziging 2026-08-08 — ID-foto's blijven bewaard

Na presentatie van bovenstaande bevindingen heeft de uitbater besloten de foto's van identiteitsdocumenten **niet** automatisch te laten verwijderen. Dat is een legitieme keuze van de verwerkingsverantwoordelijke, maar ze verplaatst het risico: de belofte in het privacybeleid moest mee veranderen, want *iets beloven aan de betrokkene en het niet doen* is het eigenlijke probleem — niet het bewaren op zich.

**Wat er is aangepast (migratie 041):**
- `id_bewaartermijn_dagen` staat op `0`, met de afspraak dat 0 betekent "niet automatisch verwijderen". Het mechanisme blijft intact; één getal invullen zet het weer aan.
- `purge_expired_data()` slaat het documentblok over bij waarde 0. **De overige bewaartermijnen blijven onverkort draaien**: gastgegevens na 3 jaar, volledige boekingen na 7 jaar, analytics na 14 maanden.
- `te_verwijderen_id_bestanden()` biedt geen verlopen documenten meer aan. Geverifieerd: enkel de 63 wezen worden nog gerapporteerd, en er wordt niets automatisch verwijderd.
- De keuzelijst in het oude dashboard stond standaard op "90 dagen" — die is omgezet naar "niet automatisch verwijderen", zodat per ongeluk opslaan de verwijdering niet heropstart.

**Wat het privacybeleid nu zegt (en wat waar is):** de foto wordt bewaard *zolang het reservatiedossier bestaat, uiterlijk 7 jaar* — dat is feitelijk juist, want de 7-jaarsopruiming verwijdert `booking_documents` mee. Daarbij staat expliciet dat de gast op elk moment vroegere verwijdering kan vragen; dat is nu ook technisch uitvoerbaar dankzij de DELETE-policy uit migratie 037.

**Wat hier juridisch aan vastzit — expliciet als open punt:** een bewaartermijn van 7 jaar voor een *kopie van een identiteitsbewijs* is aanmerkelijk moeilijker te verdedigen dan 90 dagen. De boekhoudkundige bewaarplicht geldt voor de boekhouding, niet vanzelfsprekend voor identiteitskopieën. Dit hoort bij open vraag 1 hieronder en verdient een uitdrukkelijk juridisch oordeel vóór het volgende seizoen.

Wat resteert: de 63 wees-bestanden staan er nog (bewust, niets wordt automatisch verwijderd), en de maandelijkse aanroep van `purge-storage` is nog niet ingepland.

## Rechten van betrokkenen — technische uitvoerbaarheid

| Recht | Uitvoerbaar? | Toelichting |
|---|---|---|
| Inzage (15) | Deels | Alle gegevens zijn opvraagbaar via het dashboard, maar er is geen exportknop "alles over deze persoon". Nu handwerk. |
| Rectificatie (16) | Ja | Dashboard kan alle velden bewerken. |
| Wissing (17) | **Nu pas** | Vóór deze audit bleef de ID-foto achter na verwijdering. Na migratie 037 kan het dashboard écht wissen. |
| Beperking (18) | Nee | Geen mechanisme om verwerking te bevriezen zonder te verwijderen. |
| Overdraagbaarheid (20) | Nee | Geen machineleesbare export per betrokkene. |
| Bezwaar (21) | N.v.t. voor de meeste verwerkingen (wettelijke plicht / overeenkomst) | Wel relevant voor analytics — daar is een cookiebanner met weigeroptie. |

## Verwerkers

| Partij | Dienst | Locatie | DPA |
|---|---|---|---|
| Supabase | Databank + opslag | EU (Frankfurt) | Standaard-DPA, **niet aantoonbaar ondertekend** |
| Netlify | Hosting | VS | SCC's, **niet aantoonbaar ondertekend** |
| Anthropic | AI: ID-uitlezen + e-mailintake | VS | **Open vraag 3** |
| Google (Gmail API) | Mail | EU/VS | Via Karens Google-account |
| Cloudflare | Turnstile | — | Niet actief |

Het bestand `legal/verwerkersovereenkomst.md` bestaat in de repo, maar er is geen bewijs van ondertekening. Openstaande taak #77 in dit project bevestigt dat.

## Open vragen die een jurist moet beantwoorden

1. **Mag de foto van het identiteitsdocument überhaupt bewaard worden?** Het Belgische logiesregister verplicht bepaalde *gegevens* te registreren — het is een aparte vraag of dat het bewaren van een *kopie van het document* rechtvaardigt. Het privacybeleid noemt "om het te kunnen staven wanneer politie of brandweer erom vraagt". Of dat volstaat als grondslag onder art. 6(1)(c), en of 90 dagen proportioneel is, is een juridisch oordeel dat ik niet kan geven. Een minder ingrijpend alternatief (enkel de gegevens overnemen, foto direct wissen na controle) bestaat technisch.
2. **Is een DPIA vereist?** Er worden op grote schaal identiteitsdocumenten van gasten verwerkt, met AI-uitlezing. Dat raakt aan meerdere DPIA-criteria (gevoelige gegevens, geautomatiseerde verwerking, kwetsbare betrokkenen twijfelachtig). Laten beoordelen.
3. **AI-verwerking en internationale doorgifte.** ID-documenten en e-mailinhoud gaan naar Anthropic (VS). Het privacybeleid vermeldt dit, maar de rechtmatigheid van de doorgifte en de status van de verwerkersovereenkomst met Anthropic zijn niet geverifieerd.
4. **Toestemming voor de ID-foto.** Er is een `id_consent`-kolom op `gasten` die standaard `false` is en die de anon-insert verplicht op `false` houdt. Er is geen flow die die op `true` zet. Als de grondslag toestemming zou zijn, wordt die momenteel niet vastgelegd.
5. **Kentekens.** Beleid zegt "tot het einde van uw verblijf", maar er is geen automatisme dat ze wist. Ze blijven staan zolang de boeking bestaat (7 jaar).
6. **E-mailinhoud in `communicatie`** heeft geen eigen bewaartermijn en kan gevoelige informatie bevatten.

## Wat technisch wél goed zit

- Buckets zijn privé; toegang uitsluitend via signed URL's met korte geldigheid (120–3600 s).
- De AI-prompt instrueert expliciet om **nooit** het rijksregisternummer uit te lezen.
- AI draait niet automatisch op uploads — enkel wanneer een medewerker er bewust om vraagt.
- Documentnummer wordt opgeslagen in `id_nummer` met de expliciete afspraak dat dat het kaartnummer is, niet het rijksregisternummer.
- De cookiebanner plaatst geen tracking; analytics vuurt alleen na akkoord (`_cookieOk()`).
- Er is een audit-logboek, en de INSERT-policy is aangescherpt zodat niemand een logregel namens iemand anders kan schrijven.
- Er is een dataminimalisatie-keuze zichtbaar: sinds deze week volstaat voor medereizigers een naam in plaats van een ID-document. Dat is een reële verbetering ten opzichte van "een document per persoon".
