# 05 — Databankbeveiliging

## RLS-dekking

**20 van 20 publieke tabellen hebben RLS ingeschakeld.** Geen enkele uitzondering. `relforcerowsecurity` staat overal op `false`, wat correct is: de service role moet RLS kunnen omzeilen voor de edge functions.

## Verificatie in de praktijk, niet op papier

De opdracht was expliciet: ga niet af op het bestaan van een policy, maar test wat ze toelaat. Uitgevoerd met de echte publieke sleutel tegen productie:

```
clients [] · bookings [] · gasten [] · booking_documents [] · booking_fotos []
booking_attachments [] · payments [] · facturen [] · communicatie [] ·
integrations [] · user_roles [] · audit_logs [] · bezoekers [] ·
analytics_events [] · booking_kentekens []
```

Alle vijftien geven een lege lijst. Enkel `settings`/`club_settings` (whitelist) en de gepubliceerde websitetabellen geven data terug — zoals bedoeld.

**Gerichte poging tot uitlezen van geheimen:**
`mollie_api_key`, `anthropic_api_key`, `iban`, `last_betaallink`, `mail_sender_email` → alle vijf `[]`. De whitelist in `public_read_prices` filtert correct op sleutelnaam en is niet te omzeilen met een `key=eq.`-filter.

## Opslag

| Bucket | Publiek | Groottelimiet | MIME-lijst | Beoordeling |
|---|---|---|---|---|
| `id-fotos` | Nee | 15 MB *(nieuw)* | 5 types *(nieuw)* | Was: onbeperkt + anon schrijfbaar |
| `booking-fotos` | Nee | 15 MB *(nieuw)* | 5 types *(nieuw)* | Idem |
| `website-media` | **Ja** | 10 MB *(nieuw)* | 5 types *(nieuw)* | Publiek by design (logo's) |

**Policies na migratie 037:**

| Policy | Actie | Rol | Voorwaarde |
|---|---|---|---|
| `staff_read_id_fotos` | SELECT | authenticated | `has_role()` |
| `auth_upload_id_fotos` | INSERT | authenticated | bucket — *geen rolcontrole, zie restrisico* |
| `admin_update_id_fotos` | UPDATE | authenticated | `is_admin()` |
| `staff_delete_id_fotos` *(nieuw)* | DELETE | authenticated | `has_role()` |
| `auth_read/del_booking_fotos` | SELECT/DELETE | authenticated | `has_role()` |
| `admin_write_website_media` | ALL | authenticated | `is_admin()` |

**Restrisico:** `auth_upload_id_fotos` controleert enkel de bucket, niet de rol, en geen enkele policy beperkt het *pad*. Een ingelogde gebruiker zonder rol kan dus uploaden, en een medewerker kan buiten "zijn" mappen schrijven. Laag risico gezien de vier bekende accounts; opgenomen als P3.

## De storage-beschermingstrigger

`storage.protect_delete()` weigert elke rechtstreekse SQL-delete op `storage.objects` tenzij `storage.allow_delete_query = 'true'`. Dit brak `purge_expired_data()` (F-16).

Belangrijk om te onthouden voor toekomstige migraties: **verwijder nooit storage-objecten via SQL.** Zelfs mét de vlag gezet wist je alleen de metadata-rij; de werkelijke bytes blijven in de objectopslag staan. Gebruik altijd de Storage-API vanuit een edge function met de service role — dat is wat `purge-storage` nu doet.

## Geplande taken

| Job | Schema | Laatste run |
|---|---|---|
| `gdpr-monthly-purge` | `0 3 1 * *` | 2026-08-01 **FAILED** → hersteld en handmatig succesvol getest |

Er is **geen alerting** op mislukte jobs. Dat is de structurele oorzaak achter F-16.
