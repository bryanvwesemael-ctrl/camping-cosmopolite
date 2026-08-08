# 16 — Beveiligingsbeleid

Vastgelegd zoals het systeem er ná deze audit uitziet. Bedoeld als toetssteen bij toekomstige wijzigingen.

## Authenticatie
- Zelfregistratie staat **uit** en blijft uit. Nieuwe medewerkers uitsluitend via `invite-user` (admin-only).
- Anonieme login staat uit.
- E-mailbevestiging verplicht (`mailer_autoconfirm: false`).
- Nog te doen: leaked-password-protection aanzetten.

## Autorisatie
- Elke tabel heeft RLS. Nieuwe tabellen krijgen RLS **voordat** er data in gaat.
- `anon` krijgt uitsluitend INSERT met expliciete veldbeperkingen, of SELECT op een sleutel-whitelist. Nooit een ongefilterde SELECT.
- Elke bevoorrechte edge function controleert `has_role()` of `is_admin()` — niet enkel "is ingelogd". *(Nog niet overal doorgevoerd, zie F-04.)*
- Autorisatie hoort server- of databankzijde. Een verborgen knop is geen beveiliging.

## Geheimen
- API-sleutels uitsluitend als Supabase edge-secret of Netlify-omgevingsvariabele. **Nooit** in de databank, nooit in de repo.
- De service-role-sleutel komt nooit buiten een edge function.
- De anon-sleutel is publiek en dat is correct — de beveiliging zit in RLS, niet in geheimhouding van die sleutel.

## Persoonsgegevens
- Identiteitsdocumenten: privébucket, signed URL's met korte geldigheid, nooit als mailbijlage, nooit publiek.
- Het rijksregisternummer wordt nooit uitgelezen of opgeslagen.
- AI draait niet automatisch op geüploade documenten — enkel op expliciet verzoek van een medewerker.
- Bewaartermijnen worden automatisch afgedwongen **én de uitvoering wordt gecontroleerd.**

## Verwijderen
- Bestanden verwijder je **altijd** via de Storage-API, nooit met SQL op `storage.objects`. Een SQL-delete wist enkel de metadata-rij en laat de werkelijke bytes staan — dat is schijnveiligheid.
- Een mislukte verwijdering mag **nooit** stil zijn. Geen lege `catch`-blokken rond wisacties.

## Opslag
- Buckets hebben altijd een groottelimiet en een MIME-whitelist.
- `anon` krijgt nooit schrijfrechten op een bucket met persoonsgegevens. Publieke uploads lopen via een edge function die valideert.

## Logging
- Bevoorrechte handelingen (factuur verwijderen, opruiming) komen in `audit_logs`.
- Logs bevatten nooit wachtwoorden, tokens, paden naar ID-documenten of onnodige persoonsgegevens.
- De INSERT-policy dwingt `actor = auth.uid()` af, zodat niemand een logregel namens iemand anders kan schrijven.

## Afhankelijkheden
- Externe scripts worden gepind én voorzien van SRI.
- Kwetsbaarheden worden beoordeeld op exploiteerbaarheid, niet blind geüpgraded.

## Incidenten
1. Bereik bepalen: welke gegevens, hoeveel betrokkenen.
2. Bij persoonsgegevens: meldplicht binnen 72 uur bij de Gegevensbeschermingsautoriteit beoordelen.
3. Betrokken sleutels roteren.
4. Bewijs vastleggen vóór herstel.
5. Achteraf altijd de vraag stellen: waarom heeft monitoring dit niet opgemerkt?

## Wijzigingsbeheer
- Alle productiecode staat in versiebeheer. Een edge function deployen zonder commit is niet toegestaan — dit ging tweemaal mis (F-08).
- Migraties hebben altijd een rollback-bestand.
- Geplande taken hebben alerting op falen. Dit is de kernles van F-16: de storing zelf was klein, het feit dat ze vijf weken onopgemerkt bleef was het echte probleem.
