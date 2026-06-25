# Verwerkersovereenkomst
**conform GDPR Art. 28 — Verordening (EU) 2016/679**

---

## Partijen

**Verwerkingsverantwoordelijke (de Klant):**
Naam: ___________________________
Rechtsvorm: ___________________________
BTW-nummer: ___________________________
Adres: ___________________________
E-mail: ___________________________
Vertegenwoordigd door: ___________________________

**Verwerker:**
Naam: Bryan Van Wesemael (handelend als eenmanszaak / freelancer)
BTW-nummer: ___________________________
Adres: ___________________________
E-mail: bryan.v.wesemael@gmail.com
KBO-nummer: ___________________________

---

## Artikel 1 — Voorwerp en duur

1.1 De Klant stelt Bryan Van Wesemael aan als Verwerker voor het verlenen van de dienst **Camping Cosmopolite — reservatiebeheer software** (hierna "de Dienst").

1.2 De Verwerker verwerkt persoonsgegevens uitsluitend ten behoeve van de uitvoering van de Dienst en enkel op schriftelijke instructie van de Klant.

1.3 Deze overeenkomst treedt in werking op de datum van ondertekening en loopt voor de duur van de dienstverleningsovereenkomst.

---

## Artikel 2 — Aard van de verwerking

De Verwerker verwerkt de volgende categorieën persoonsgegevens van gasten van de Klant:

| Categorie | Gegevens |
|-----------|----------|
| Identificatiegegevens | Naam, voornaam |
| Contactgegevens | E-mailadres, telefoonnummer |
| Verblijfsgegevens | Aankomst- en vertrekdatum, plaatsnummer, type verblijf |
| Financiële gegevens | Betaald bedrag, OGM-referentie, betalingsstatus |
| Technische gegevens | IP-adres bij online reservatie (via Supabase) |

Bijzondere categorieën persoonsgegevens (art. 9 GDPR) worden **niet** verwerkt.

**Doeleinden van de verwerking:**
- Beheer van campingreservaties
- Verwerking van betalingen via Mollie
- Versturen van reservatiebevestigingen via Resend
- Bijhouden van het register toeristenverblijf
- QR-code check-in

---

## Artikel 3 — Verplichtingen van de Verwerker

De Verwerker verbindt zich ertoe:

3.1 **Vertrouwelijkheid** — Persoonsgegevens uitsluitend te verwerken op instructie van de Verwerkingsverantwoordelijke en te zorgen voor een passend vertrouwelijkheidsniveau bij alle betrokken medewerkers.

3.2 **Beveiliging** — Passende technische en organisatorische maatregelen te nemen conform art. 32 GDPR, waaronder:
- Versleutelde gegevensopslag via Supabase (AES-256 at rest)
- HTTPS-verbindingen (TLS 1.2+) voor alle datatransfers
- Authenticatie met wachtwoord + tweefactorauthenticatie mogelijk
- Row-Level Security (RLS) op alle databasetabellen

3.3 **Sub-verwerkers** — De Klant machtigt het gebruik van volgende sub-verwerkers:

| Sub-verwerker | Dienst | Land | Privacybeleid |
|---------------|--------|------|---------------|
| Supabase Inc. | Database, authenticatie, opslag | EU (Frankfurt, AWS eu-central-1) | supabase.com/privacy |
| Netlify Inc. | Webhosting | VS (met EU SCCs) | netlify.com/privacy |
| Mollie B.V. | Betalingsverwerking | NL (EU) | mollie.com/nl/privacy |
| Resend Inc. | Transactionele e-mail | VS (met EU SCCs) | resend.com/privacy |

De Verwerker informeert de Klant vooraf bij wijziging van sub-verwerkers.

3.4 **Datalek** — De Verwerker meldt elk vastgesteld of vermoed datalek aan de Klant binnen **72 uur** na kennisname, conform art. 33 GDPR.

3.5 **Verwijdering** — Bij beëindiging van de overeenkomst worden alle persoonsgegevens, op verzoek van de Klant, verwijderd of teruggegeven binnen 30 kalenderdagen.

3.6 **Audits** — De Verwerker stelt alle nodige informatie ter beschikking om de naleving van art. 28 GDPR aan te tonen en staat audits toe op redelijk verzoek.

3.7 **Rechten van betrokkenen** — De Verwerker verleent medewerking zodat de Klant kan voldoen aan verzoeken tot inzage, rectificatie, verwijdering of overdraagbaarheid van persoonsgegevens.

---

## Artikel 4 — Verplichtingen van de Verwerkingsverantwoordelijke

4.1 De Klant is verantwoordelijk voor de rechtmatigheid van de verwerking en beschikt over een geldige rechtsgrond (art. 6 GDPR) voor het verwerken van gastgegevens.

4.2 De Klant informeert gasten over de verwerking via een privacyverklaring op de reservatiepagina.

4.3 De Klant beheert zelf de toegangsrechten van medewerkers binnen het platform.

---

## Artikel 5 — Aansprakelijkheid

5.1 De Verwerker is aansprakelijk voor schade die rechtstreeks voortvloeit uit het niet naleven van de verplichtingen uit deze overeenkomst of de GDPR die specifiek op de Verwerker rusten.

5.2 De Verwerker is niet aansprakelijk voor schade voortvloeiend uit instructies van de Verwerkingsverantwoordelijke die strijdig zijn met de GDPR.

---

## Artikel 6 — Toepasselijk recht

Deze overeenkomst wordt beheerst door het Belgisch recht. Geschillen vallen onder de exclusieve bevoegdheid van de rechtbanken van het arrondissement _________________.

---

## Artikel 7 — Ondertekening

| | Verwerkingsverantwoordelijke | Verwerker |
|--|--|--|
| **Naam** | | Bryan Van Wesemael |
| **Datum** | | |
| **Handtekening** | | |

---

*Opgesteld conform Verordening (EU) 2016/679 (AVG/GDPR) en de Belgische wet van 30 juli 2018 betreffende de bescherming van natuurlijke personen met betrekking tot de verwerking van persoonsgegevens.*
