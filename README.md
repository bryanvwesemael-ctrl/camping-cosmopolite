# Camping Cosmopolite — Reservatiebeheer

Reservatie- en beheersysteem voor een camping. Publiek reservatieformulier,
beheerdashboard, QR-check-in, wettelijk gastenregister, mailtemplates,
betalingen (Mollie) en analytics.

## Architectuur

| Laag | Technologie |
|------|-------------|
| Frontend | Vanilla JS + HTML/CSS (geen build-stap) |
| Backend | Supabase (Postgres, Auth, RLS, Edge Functions, Storage) |
| Hosting | Netlify |
| Betalingen | Mollie | 
| E-mail | Resend (versturen) + Gmail-sync (inkomend) |

**Tenancy-model:** één Supabase-project **per camping** (single-tenant).
Alle ingelogde medewerkers van die camping delen dezelfde data. Voor een
multi-tenant SaaS (meerdere campings in één project) is een `org_id`-herwerk
nodig op elke tabel + RLS per organisatie — nog niet aanwezig.

## Mappen

```
index.html              Publiek reservatieformulier (anon-key)
dashboard/              Beheerdashboard (login vereist)
check-in/               QR-check-in pagina voor gasten
privacy/                Privacybeleid (GDPR)
legal/                  Verwerkersovereenkomst (DPA, GDPR art. 28)
supabase/migrations/    Database-schema (bron van waarheid)
supabase/functions/     Edge functions
```

## Edge functions

In de repo: `gmail-oauth`, `gmail-sync`.

**Nog niet in de repo** (wel gedeployed in productie — toevoegen vóór een
nieuwe install werkt):
- `send-mail` — verstuurt mails via Resend (aangeroepen vanuit dashboard)
- `checkin` — QR-check-in (valideert `checkin_token`, zet status op ingecheckt)
- Mollie: betaling aanmaken + webhook die `payments` bijwerkt
  → **De webhook MOET de `service_role`-sleutel gebruiken** (omzeilt RLS).
  Anon heeft bewust geen update-recht op `payments` (anders fraude mogelijk).

## Nieuwe camping opzetten (onboarding-checklist)

1. **Supabase-project** aanmaken (regio EU, bv. eu-west-3 Parijs).
2. **Schema draaien**: `supabase/migrations/001_init.sql` in de SQL Editor.
3. **Edge functions deployen**: `gmail-oauth`, `gmail-sync`, `send-mail`,
   `checkin`, Mollie-functies. Secrets zetten (Resend key, Mollie key,
   Google client id/secret, `SERVICE_ROLE_KEY`).
4. **Eerste gebruiker** aanmaken via Supabase Auth; rij in `user_roles`
   met `role='admin'`.
5. **Keys invullen** in het dashboard (Instellingen → Mollie / Resend).
6. **Frontend config**: `SUPABASE_URL` en anon-key aanpassen in
   `index.html`, `dashboard/app.js`, `check-in/index.html`.
7. **Netlify** site koppelen + domein.
8. **Juridisch invullen** (verplicht vóór live):
   - `privacy/index.html` — `[naam]`, `[BTW]`, `[adres]`, `[email]`
   - `legal/verwerkersovereenkomst.md` — partijgegevens + ondertekening
9. **Auth-hardening**: in Supabase → Authentication → "Leaked password
   protection" aanzetten.
10. **Testboeking** via het publieke formulier; controleer dashboard,
    gastenregister en check-in.

## Bekende aandachtspunten / TODO

- [ ] **Bewaartermijnen** (3/7 jaar) worden gedocumenteerd maar niet
      automatisch afgedwongen — auto-verwijdering of opkuisfunctie bouwen.
- [ ] **Rate limiting** op anonieme inserts (formulier) ontbreekt — abuse-risico.
- [ ] **Toeristentaks** is per gemeente instelbaar maken (varieert lokaal).
- [ ] **Multi-tenant** (`org_id`) als je naar SaaS-model wil.
- [ ] **Tests + foutmonitoring** ontbreken.
- [ ] Edge functions (`send-mail`, `checkin`, Mollie) in versiebeheer brengen.

## Beveiliging — kernregels

- De **anon-key** staat publiek in de frontend (correct). Bescherming komt
  volledig van **RLS**: anon mag enkel `insert` op formuliertabellen + tarieven
  lezen. Nooit `select`/`update`/`delete` voor anon op privédata.
- De **service_role-sleutel** mag NOOIT in frontend-code staan — enkel in
  edge functions (server-side).
