# 18 — Productiepoort

## Oordeel: 🟡 **GEEL** *(bijgewerkt 2026-08-08 na de F-03-fix)*

**Motivering.** Er blijven na deze ronde géén bekende kritieke risico's open: F-16 (kapotte AVG-opruiming) en F-01 (anonieme upload naar de ID-bucket) zijn opgelost én met een regressietest bevestigd, en F-02 (wees-documenten) heeft een werkende oplossing die enkel nog uitgevoerd moet worden. Maar geel en niet groen, om drie redenen:

1. **Zeven edge functions controleren geen rol** (F-04). Beperkt risico dankzij uitgeschakelde zelfregistratie, maar één gecompromitteerd `staff`-account volstaat om mail te versturen vanuit Karens mailbox.
2. **Geen alerting op storingen.** F-16 bleef vijf weken onopgemerkt; dat kan opnieuw gebeuren met een andere stille fout.
3. **Juridische review is niet gebeurd** op de kernvraag of het bewaren van ID-kopieën rechtmatig is, en er is geen ondertekende verwerkersovereenkomst aantoonbaar.

Geen groen, omdat "het werkt en er zijn geen bekende gaten meer" niet hetzelfde is als aantoonbaar productieklaar. Geen rood, omdat er na vandaag geen bekend kritiek of hoog-en-onopgelost technisch risico meer is dat een aanvaller vanaf het open internet kan misbruiken.

## Poortcriteria

| Criterium | Status |
|---|---|
| Geen kritieke bevindingen open | ✅ (F-16 opgelost + geverifieerd) |
| Geen hoge bevindingen open | ✅ F-03 gefixt + geverifieerd |
| RLS aan en getest op alle tabellen | ✅ 20/20, 13 live getest als anon |
| Geen geheimen in code of geschiedenis | ✅ 252 commits schoon |
| Opslag niet publiek schrijfbaar | ✅ na migratie 037, regressietest geslaagd |
| Bewaartermijnen werken aantoonbaar | ⚠️ mechanisme hersteld en getest; ID-foto's bewust uitgezonderd (beleid aangepast), rechtsgrond nog te toetsen |
| Beveiligingsheaders op alle routes | ✅ na aanpassing `netlify.toml` (CSP publiek nog Report-Only) |
| Alle productiecode in versiebeheer | ✅ na toevoegen `checkin` + `save-api-keys` |
| Rolcontrole op alle bevoorrechte endpoints | ✅ alle 7 edge functions, geverifieerd |
| Monitoring/alerting op storingen | ⚠️ waarschuwingsbalk in het dashboard bij mislukte taken; geen externe/push-alerting |
| Back-up- en herstelprocedure getest | ❓ niet beoordeeld |
| Juridische review AVG | ❌ niet gebeurd |

## Naar groen

Minimaal nodig: extern/proactief alerting-kanaal naast de dashboardbalk (bv. een wekelijkse controle), en een juridisch oordeel over het bewaren van ID-kopieën (zie 19_JURIDISCHE_ANALYSE_ID_BEWARING.md — dit onderzoek bracht bovendien aan het licht dat de oude regionale rechtsgrond voor de identiteitsfiche zelf is opgeheven sinds 1 juli 2025). Dat is realistisch werk voor één gerichte sessie plus een afspraak met een privacyjurist.
