# 01 — Repository-inventaris

Doorzocht: **alle** bestanden, niet enkel `src/`. Uitgesloten: `node_modules`, `.next`, `dist`, `out`, `.git` interne objecten.

| Categorie | Aantal / omvang |
|---|---|
| JS-bestanden | 224 (incl. gebouwde bundels) |
| SQL-migraties | 65 bestanden (001 → 039, met rollbacks) |
| TSX/TS | 57 / 36 (marketing-site + site-v2) |
| HTML | 41 |
| Edge functions | 11 live · 11 nu in repo (2 toegevoegd tijdens deze audit) |
| Tests | 4 bestanden (`pricing`, `payment`, `upload`, `guests`) — geen beveiligingstests |
| Grootste bronbestanden | `dashboard/app.js` 4499 · `dashboard-nieuw/app-nieuw.js` 2938 · `reserveren.html` 1282 |

## Deelprojecten

| Map | Status | Gedeployed? |
|---|---|---|
| `/` (root) | Actief — publiek formulier + statische pagina's | Ja, Netlify `camping-cosmopolite` |
| `dashboard-nieuw/` | Actief beheerdashboard | Ja |
| `dashboard/` | **Uitgefaseerd maar nog bereikbaar** via `/dashboard` | Ja — verdubbelt aanvalsoppervlak, zie remediatie P2 |
| `marketing-site/` | Next.js 15 static export | Ja, **aparte** Netlify-site |
| `site-v2/` | Bewust gepauzeerd | Nee |
| `website-product/` | Experimenteel multi-site product | Deels (`wb_*`-tabellen bestaan) |
| `strix_runs/` | Output van een eerdere Strix-pentest | Nee — **niet in `.gitignore`**, staat wel untracked |

## Gezocht naar achterdeurtjes en resten

| Patroon | Resultaat |
|---|---|
| `TODO` / `FIXME` / `HACK` | Geen beveiligingsrelevante treffers |
| Uitgeschakelde authenticatie / uitgecommentarieerde autorisatie | Geen |
| Hardgecodeerde wachtwoorden, tokens, private keys | Geen (zie 11_SECRETS_AUDIT.md) |
| Debug-modus / verbose errors in productie | Geen; edge functions geven korte NL-foutmeldingen zonder stacktrace |
| Bewust verzwakte controles | Eén: `mollie-webhook` is een `410`-stub — bewuste, gedocumenteerde uitschakeling |

## `.gitignore` — beoordeeld

Correct afgeschermd: `.env`, `.env.local`, `node_modules/`, `.netlify`, `.claude/`, en expliciet `handleiding/Snelstart-Karen.html|pdf` met de commentaar "Bevat inloggegevens — nooit naar versiebeheer". **Geverifieerd dat die bestanden ook werkelijk nooit gecommit zijn.**

Niet genegeerd maar wel untracked: `strix_runs/` (pentest-output — kan gevoelige bevindingen bevatten; overweeg toevoegen aan `.gitignore`).
