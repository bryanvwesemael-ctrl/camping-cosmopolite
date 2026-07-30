# Audit beveiliging & wettelijke normen — 30 juli 2026

Onderzocht op de live database en de repo, niet op basis van aannames.
Wat geverifieerd is, staat als geverifieerd; wat ingeschat is, staat als inschatting.

> Ik ben geen jurist. Het juridische deel beschrijft de structuur van het probleem en
> wat feitelijk vastgesteld is. De punten met ⚖️ horen langs een jurist of boekhouder.

---

## Samenvatting

| | Aantal |
|---|---|
| 🔴 Moet opgelost vóór je factureert of verkoopt | 6 |
| 🟠 Belangrijk, binnen enkele weken | 9 |
| 🟢 Al goed geregeld | 8 |

De twee dringendste zijn **geen** databankproblemen: het zijn de ontbrekende
integriteitscontrole op externe scripts, en een privacyverklaring die feitelijk
onjuist is.

---

# Deel 1 — Beveiliging

## 🔴 B1. Externe scripts zonder integriteitscontrole

**Vastgesteld:** vier scripts worden van een CDN geladen, geen enkele met een
`integrity`-hash:

```
@supabase/supabase-js@2        ← zwevende versie, geen vaste release
pdfjs-dist@3.11.174
qrcode-generator@1.4.4
sortablejs@1.15.6
```

**Waarom dit het zwaarste punt is.** Deze scripts draaien op het publieke
reservatieformulier én in het dashboard — pagina's waar paspoortfoto's, ID-nummers en
betaalgegevens passeren. Wordt het CDN of het pakket gecompromitteerd, dan draait er
vreemde code met volledige toegang tot die gegevens. Bij `supabase-js@2` komt daar nog
bij dat de versie *zwevend* is: jsDelivr levert wat op dat moment de nieuwste v2 is, dus
de code onder je applicatie kan wijzigen zonder dat er één commit in je repo verandert.

**Oplossing:** versies vastzetten en `integrity="sha384-…"` + `crossorigin="anonymous"`
toevoegen. Of, robuuster: de vier bestanden lokaal meeleveren en mee versioneren.

## 🔴 B2. Publieke pagina's hebben geen enkele beveiligingsheader

**Vastgesteld:** in `netlify.toml` gelden `X-Frame-Options`, `X-Content-Type-Options` en
`Referrer-Policy` uitsluitend voor `/dashboard/*` en `/dashboard-nieuw/*`.

Niet gedekt: **`/reserveren.html`**, **`/upload/`**, **`/check-in/`** — precies de pagina's
waar gasten hun identiteitsdocumenten uploaden. Die kunnen dus in een iframe gezet worden
(clickjacking).

Verder ontbreken op de héle site: `Content-Security-Policy`, `Strict-Transport-Security`
en `Permissions-Policy`. Een CSP is bovendien de beste tweede verdedigingslinie tegen B1.

## 🟠 B3. `revoke` op SECURITY DEFINER-functies werkte niet

**Vastgesteld met `has_function_privilege`:**

| Functie | anon mag uitvoeren |
|---|---|
| `has_role()` | ja |
| `is_admin()` | ja |
| `maak_factuur()` | **ja** |
| `purge_expired_data()` | nee (correct) |

In migratie 032 stond `revoke execute … from anon`. Dat werkt niet: in PostgreSQL heeft
`PUBLIC` standaard EXECUTE, en `anon` erft dat. Je moet intrekken van `PUBLIC` en daarna
gericht toekennen:

```sql
revoke execute on function public.maak_factuur(...) from public;
grant  execute on function public.maak_factuur(...) to authenticated;
```

**Impact nu:** beperkt. `maak_factuur()` weigert zelf anonieme oproepen via `has_role()`.
Maar de extra laag die er hoorde te zijn, ontbreekt. `has_role`/`is_admin` laten een
anonieme bezoeker wel aftasten of een bepaalde gebruikers-id een rol heeft.

## 🟠 B4. Auditlog is vervalsbaar

`audit_logs` heeft een INSERT-policy met `with check (true)` voor `authenticated`. Elke
ingelogde medewerker kan dus willekeurige auditregels schrijven. Een auditspoor dat
vervalst kan worden, is als bewijsmiddel weinig waard — en dat is net waarvoor het dient.

## 🟠 B5. Overige databankpunten

- `website-media` is een publieke bucket die **listing** toestaat: iedereen kan alle
  bestandsnamen opvragen. Bevat marketingbeelden en je factuurlogo — geen
  persoonsgegevens, dus beperkte impact, maar onnodig.
- **Leaked password protection staat uit.** Eén schakelaar in het Supabase-dashboard;
  blokkeert wachtwoorden die in bekende datalekken voorkomen.

## 🟠 B6. CORS staat overal open

Alle zeven edge functions sturen `Access-Control-Allow-Origin: *`. Elke website kan ze
dus aanroepen. Voor de publieke functies is dat deels bewust, maar beperken tot je eigen
domein kost niets en verkleint het misbruikoppervlak.

## 🟠 B7. Configuratie staat niet in versiebeheer

Er is geen `supabase/config.toml`. De `verify_jwt`-instelling per edge function leeft dus
alleen in het dashboard. Zet iemand die per ongeluk om, dan merkt niemand het en toont
geen enkele diff het. Voor `mollie-webhook` en `checkin` (bewust zonder JWT) is dat een
reëel risico.

## 🟠 B8. Geen end-to-end tests op geld- en identiteitsstromen

42 unittests dekken de prijslogica en de bestandsvalidatie. Er is geen enkele test die de
keten *boeking → betaling → factuur* doorloopt. Eén ontwikkelaar, geen review, geen
staging-omgeving. In het hoogseizoen legt één regressie de camping op een piekdag plat.

## 🟢 Wat wél goed zit

- **Geen secrets in de repo of in de git-historiek.** Nagekeken op service-role-sleutels,
  API-keys en `.env`-bestanden. `.gitignore` dekt `.env` én het handleidingsbestand met
  Karens wachtwoord — dat is nooit gecommit geweest.
- **`guest-upload` is degelijk beveiligd:** Turnstile-verificatie, tokenvalidatie, maximaal
  20 documenten per boeking, minimum- en maximumbestandsgrootte, en MIME-sniffing op de
  bytesignatuur (dus een `.jpg` die eigenlijk iets anders is, wordt geweigerd).
- **Tokens zijn UUID v4** (122 bits) — niet raadbaar.
- **Anon heeft nergens leesrechten** op klant-, boekings- of gastgegevens.
- **Anon-schrijfrechten zijn dichtgezet** (migratie 031): status en bron liggen vast,
  bedragen kunnen niet negatief, personeelstijdstempels moeten leeg zijn.
- **ID-foto's staan in een privébucket**, enkel bereikbaar via signed URLs van één uur.
- **Facturen zijn onveranderlijk** op databaseniveau (migratie 032).
- **Cookietoestemming werkt**: analytics vuurt enkel na akkoord.

---

# Deel 2 — Wettelijke normen

## 🔴 W1. De privacyverklaring klopt niet

**Vastgesteld — vermeld als verwerker:** Supabase, Mollie, Resend, Netlify.

| Vermeld | Realiteit |
|---|---|
| Supabase | ✅ wordt gebruikt |
| Netlify | ✅ wordt gebruikt |
| Mollie | ❌ **wordt niet gebruikt** |
| Resend | ❌ **wordt niet gebruikt** (vervangen door Gmail) |
| — | ❌ **Anthropic ontbreekt** — ontvangt de paspoortfoto's en de gastmails |
| — | ❌ **Google ontbreekt** — leest en verstuurt via Karens mailbox |

Je somt dus twee partijen op die niets verwerken, en verzwijgt de twee die het meest
gevoelige verwerken. Voor een gast die vraagt "wie krijgt mijn identiteitskaart te zien?"
staat het antwoord er niet. Dit is de goedkoopste ernstige fout om recht te zetten.

Ook onjuist: de rechtsgrond vermeldt "Betalingsverwerking via Mollie", en de
bewaartermijnen noemen ID-**foto's** niet als aparte categorie.

## 🔴 W2. Je eigen database zegt "geen toestemming" bij elke gast

**Vastgesteld:** van 40 gasten staat `id_consent` op `false` bij **alle 40**. Nul op `true`.

Oorzaak: enkel het oude, uitgeschakelde dashboard zette dat veld. Het nieuwe dashboard
zet het nooit. Je bewaart 38 identiteitskaartafbeeldingen terwijl je eigen systeem
registreert dat daar geen toestemming voor is — bij een klacht is dat je eigen
bewijsmateriaal tegen jezelf, en het is feitelijk waarschijnlijk onjuist.

## 🔴 W3. De bewaartermijn van ID-foto's werkt niet

**Vastgesteld:** 98 bestanden in `id-fotos`, gekoppeld via `gasten.foto_url`. De
opruimfunctie ruimt op via `booking_documents.storage_path`, en die tabel bevat **0 rijen**.
Er wordt dus nooit iets verwijderd. Ook na drie jaar verdwijnt enkel de databankrij; het
bestand blijft als wees achter.

Nog geen overtreding — de eerste boeking is van 19 juli, dus niets is 90 dagen na vertrek.
**Rond half oktober wordt dit er wel een**, stilzwijgend.

⚖️ Extra aandachtspunt: de Belgische Gegevensbeschermingsautoriteit is streng over het
bewaren van kopieën van identiteitskaarten. De registerplicht schrijft de **gegevens**
voor, niet de afbeeldingen. Karen wíl ze — dat is een geldige zakelijke reden, maar het is
geen wettelijke verplichting, en dat onderscheid bepaalt hoe streng je termijn moet zijn.

## 🔴 W4. Het wettelijke gastenregister is zo goed als leeg

**Vastgesteld** (40 gasten, exclusief verwijderde):

| Veld | Ingevuld |
|---|---|
| Naam | 40 |
| Geboortedatum | **0** |
| Nationaliteit | **0** |
| Identiteitsdocumentnummer | **0** |
| Foto van het document | 38 |

Dit is precies omgekeerd aan wat zou moeten. Het register is wat je aan politie of
brandweer voorlegt; de foto's zijn juridisch het zwaarst om te bewaren. Nu dragen de
foto's de volledige bewijslast.

Oorzaak is geen bug: in `saveNewGuest()` is enkel `naam` verplicht, en niets herinnert aan
de rest.

## 🔴 W5. Verwerkersovereenkomst niet ondertekend

Het sjabloon in `legal/verwerkersovereenkomst.md` is degelijk, maar de velden staan leeg
en er staat geen handtekening onder. Artikel 28 AVG vereist die overeenkomst. Zonder
handtekening zijn jij én Karen in overtreding — en jij verwerkt haar gastendata al maanden.

**Dit kan en moet los van je KBO.** Het gaat over gegevens, niet over geld.

## 🔴 W6. Geen ondernemingsnummer

⚖️ Zonder KBO-inschrijving kan je geen commerciële factuur sturen voor terugkerende
dienstverlening. Dit blokkeert het volledige verdienmodel.

## 🟠 W7. Factuur toont de BTW-uitsplitsing niet

De factuur vermeldt "Prijzen incl. 12% BTW" maar splitst niet uit. Een Belgische factuur
hoort het bedrag exclusief, het BTW-tarief en het BTW-bedrag te tonen. In de nieuwe
`facturen`-tabel staan `bedrag_excl` en `btw_bedrag` bewust leeg — de splitsing vereist het
afzonderen van de BTW-vrije toeristentaks, en dat wilde ik niet gokken.

⚖️ Laat je boekhouder bevestigen hoe de taks precies afgesplitst hoort te worden.

## 🟠 W8. Gegevensbeschermingseffectbeoordeling (DPIA) niet uitgevoerd

⚖️ Je verwerkt op systematische schaal identiteitsdocumenten van bezoekers, met
geautomatiseerde uitlezing door AI. Dat combineert twee criteria uit de lijst van de
Gegevensbeschermingsautoriteit. Of een volwaardige DPIA verplicht is, moet iemand met
kennis van zaken beoordelen — maar het is minstens het overwegen waard, en het kost
weinig om de afweging schriftelijk vast te leggen.

## 🟠 W9. Overige

- **Geen beroepsaansprakelijkheidsverzekering.** Bij een datalek met paspoortscans is een
  contractueel plafond je papieren bescherming; een verzekering je echte.
- **Geen gedocumenteerd proces voor rechten van betrokkenen.** De privacyverklaring belooft
  inzage, correctie en verwijdering, maar er is geen procedure of knop.
- **Geen algemene voorwaarden** bij het publieke reservatieformulier (annulering,
  no-show, waarborg).

---

# Volgorde van aanpak

## Deze week

| | Waarom eerst |
|---|---|
| **W1** privacyverklaring corrigeren | Grootste fout, kleinste moeite. Anthropic en Google toevoegen, Mollie en Resend schrappen, ID-foto's als bewaarcategorie opnemen |
| **W5** verwerkersovereenkomst invullen en tekenen | Half uur, haalt je grootste papieren risico weg, kan zonder KBO |
| **B1** SRI + vaste versies op de CDN-scripts | Enkele uren, dicht je zwaarste technische risico |
| **W6** KBO aanvragen | Heeft doorlooptijd, start dus nu |

## Binnen twee weken

**W2** toestemming effectief registreren · **W3** opruiming van ID-foto's repareren
(vóór half oktober) · **W4** registervelden afdwingen · **B2** beveiligingsheaders op de
publieke pagina's, inclusief CSP

## Binnen de maand

**B3** revoke van `PUBLIC` · **B4** auditlog dichtzetten · **B5** bucket-listing en
leaked-password · **B6** CORS beperken · **B7** `config.toml` toevoegen · **W7** BTW-splitsing
· **W8** DPIA-afweging vastleggen

## Vóór je aan een tweede klant begint

**B8** end-to-end tests op de keten boeking → betaling → factuur, en een staging-omgeving.
Zolang je de enige ontwikkelaar bent zonder testomgeving, ben jij het enige vangnet.
