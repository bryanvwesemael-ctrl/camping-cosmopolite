# 10 — Dependency-audit

| Project | Commando | Resultaat |
|---|---|---|
| hoofdmap | `npm audit --omit=dev` | **ENOLOCK** — geen lockfile. De hoofdmap heeft geen runtime-afhankelijkheden (enkel `node --test`), dus verwaarloosbaar risico, maar de scan is er blind (F-15) |
| `marketing-site/` | `npm audit --omit=dev` | **4 high** — `sharp` → libvips: CVE-2026-33327, -33328, -35590, -35591 |
| `site-v2/` | `npm audit --omit=dev` | **2 moderate** — react-router: arbitrary constructor injection via `deserializeErrors()` bij SSR-hydratie |

## Beoordeling per bevinding, niet blind upgraden

**`sharp` (4 high).** De opdracht was uitdrukkelijk om exploiteerbaarheid te beoordelen in plaats van blind te upgraden:

- `marketing-site` gebruikt `output: 'export'` — een volledig statische build.
- `sharp` is een **build-time** afhankelijkheid voor beeldoptimalisatie. Er draait geen `sharp` op een server; er ís geen server.
- De invoer van die build zijn Bryans eigen foto's uit een lokale map, geen door gebruikers geüploade bestanden.
- Misbruik zou vereisen dat een aanvaller eerst een kwaadaardige afbeelding in de repo krijgt én een build triggert.

**Conclusie: hoge CVE-score, lage reële exploiteerbaarheid.** `npm audit fix --force` forceert Next 16 — een breaking change op een site die vorige week live ging. **Advies: nu niet doen**, meenemen bij een geplande Next-upgrade.

**`react-router` (2 moderate).** `site-v2` is bewust gepauzeerd en **niet gedeployed**. De kwetsbaarheid betreft SSR-hydratie; deze site doet geen SSR. Verwaarloosbaar.

## Supply chain

| Controle | Resultaat |
|---|---|
| CDN-scripts met SRI? | Ja — `reserveren.html` gebruikt `integrity=` + `crossorigin` op zowel supabase-js als pdf.js |
| Vastgepinde versies? | Ja — `@supabase/supabase-js@2.111.0`, `pdfjs-dist@3.11.174` |
| `referrerpolicy="no-referrer"` op CDN's? | Ja |
| Postinstall-scripts in afhankelijkheden | Niet afzonderlijk beoordeeld |
| Lockfiles aanwezig | `marketing-site` ja · `site-v2` ja · hoofdmap nee |

De SRI-discipline op de publieke pagina is opvallend goed en verdient vermelding: een gecompromitteerde CDN kan geen gewijzigd script binnensmokkelen.
