# 18 — Productiepoort

## Oordeel: 🟡 **GEEL**

**Motivering.** Er blijven na deze ronde géén bekende kritieke risico's open: F-16 (kapotte AVG-opruiming) en F-01 (anonieme upload naar de ID-bucket) zijn opgelost én met een regressietest bevestigd, en F-02 (wees-documenten) heeft een werkende oplossing die enkel nog uitgevoerd moet worden. Maar geel en niet groen, om vier redenen:

1. **F-03 staat nog open** en is bewezen exploiteerbaar: een boeking van €0 wordt aanvaard. De enige verdediging is dat Karen het bedrag handmatig opmerkt.
2. **63 identiteitsdocumenten die er niet meer hoorden te staan, staan er nog.** De opruiming is klaar maar bewust niet door mij uitgevoerd.
3. **Zeven edge functions controleren geen rol** (F-04). Beperkt risico dankzij uitgeschakelde zelfregistratie, maar één gecompromitteerd `staff`-account volstaat om mail te versturen vanuit Karens mailbox.
4. **Juridische review is niet gebeurd** op de kernvraag of het bewaren van ID-kopieën rechtmatig is, en er is geen ondertekende verwerkersovereenkomst aantoonbaar.

Geen groen, omdat "het werkt en er zijn geen bekende gaten meer" niet hetzelfde is als aantoonbaar productieklaar. Geen rood, omdat er na vandaag geen bekend kritiek of hoog-en-onopgelost technisch risico meer is dat een aanvaller vanaf het open internet kan misbruiken.

## Poortcriteria

| Criterium | Status |
|---|---|
| Geen kritieke bevindingen open | ✅ (F-16 opgelost + geverifieerd) |
| Geen hoge bevindingen open | ❌ F-03 open |
| RLS aan en getest op alle tabellen | ✅ 20/20, 13 live getest als anon |
| Geen geheimen in code of geschiedenis | ✅ 252 commits schoon |
| Opslag niet publiek schrijfbaar | ✅ na migratie 037, regressietest geslaagd |
| Bewaartermijnen werken aantoonbaar | ⚠️ mechanisme hersteld en getest; achterstand nog niet weggewerkt |
| Beveiligingsheaders op alle routes | ✅ na aanpassing `netlify.toml` (CSP publiek nog Report-Only) |
| Alle productiecode in versiebeheer | ✅ na toevoegen `checkin` + `save-api-keys` |
| Rolcontrole op alle bevoorrechte endpoints | ❌ 7 edge functions |
| Monitoring/alerting op storingen | ❌ cron-falen bleef 5 weken onopgemerkt |
| Back-up- en herstelprocedure getest | ❓ niet beoordeeld |
| Juridische review AVG | ❌ niet gebeurd |

## Naar groen

Minimaal nodig: F-03 dichtzetten, de 63 wezen wissen, rolcontrole in de edge functions, alerting op mislukte geplande taken, en een juridisch oordeel over het bewaren van ID-kopieën. Dat is realistisch werk voor één gerichte sessie plus een afspraak met een privacyjurist.
