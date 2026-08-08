# 12 — CI/CD-beveiliging

Er is één workflow: `.github/workflows/tests.yml` — checkout, Node 20, `npm test`.

## Beoordeling

| Controle | Status | Toelichting |
|---|---|---|
| Gebruikt `pull_request_target`? | Nee | Het gevaarlijkste patroon (secrets blootstellen aan PR-code) is afwezig |
| Secrets in de workflow? | Geen | De workflow gebruikt er geen |
| `permissions` expliciet beperkt? | **Nee** | Erft de standaardrechten van de repo. Voeg `permissions: contents: read` toe |
| Third-party actions | Enkel officiële `actions/*` | Op major tag (`@v4`), niet op SHA gepind — acceptabel voor officiële actions |
| Dependency-installatie | Geen `npm ci` | Er is geen lockfile in de hoofdmap (F-15) |
| Draait `npm audit`? | **Nee** | Aanbevolen toe te voegen |
| Draait beveiligingstests? | **Nee** | Enkel unit tests voor prijsberekening, upload en gasten |
| Deploy via CI? | Nee | Netlify deployt rechtstreeks vanaf `master` via zijn eigen GitHub-koppeling |
| Deploy-credentials in de repo? | Nee | Netlify beheert dit aan zijn kant |

## Grootste tekortkoming

De keten van `git push` naar productie kent **geen enkele beveiligingspoort**. Een push naar `master` gaat rechtstreeks live: geen verplichte review, geen dependency-scan, geen secrets-scan, geen beveiligingstest.

Dat is relevant voor deze audit: F-01 (anonieme upload-policy) en F-02 (ontbrekende DELETE-policy) zijn beide via een migratie in productie beland zonder dat iets ze tegenhield. Een geautomatiseerde poort had ze kunnen opmerken.

## Aanbevelingen

1. `permissions: contents: read` op jobniveau.
2. Lockfile in de hoofdmap, dan `npm ci` + `npm audit --audit-level=high` in CI.
3. Een secrets-scanner (`gitleaks`) als extra stap.
4. De tests uit `13_SECURITY_TEST_RESULTS.md` automatiseren als regressiesuite bij elke push — met name de anon-toegangstests op alle tabellen en de storage-uploadtest. Dat zijn precies de controles die vandaag met de hand zijn gedaan.
