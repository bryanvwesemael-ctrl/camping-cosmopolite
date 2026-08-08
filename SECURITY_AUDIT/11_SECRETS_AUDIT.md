# 11 — Secrets-audit

**Uitkomst: schoon.** Geen enkel echt credential aangetroffen in code, configuratie of geschiedenis.

## Wat er gescand is

```bash
# Werkende boom
grep -rInE "service_role|SERVICE_ROLE_KEY *= *['\"]eyJ|sk-ant-|sk_live_|
            live_[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|GOCSPX-" \
  --include="*.js" --include="*.ts" --include="*.html" --include="*.json" \
  --include="*.md" --include="*.toml" .
→ enkel documentatie die het wóórd "service_role" gebruikt; geen sleutelmateriaal

# Volledige Git-geschiedenis — 252 commits
git grep -InE "sk-ant-api|GOCSPX-|service_role.*eyJ|re_[A-Za-z0-9]{25,}" $(git rev-list --all)
→ niets

# Is het credentialbestand ooit gecommit?
git log --all -- handleiding/Snelstart-Karen.html handleiding/Snelstart-Karen.pdf .env .env.local
→ leeg
```

## Beoordeling per secret

| Secret | Waar het hoort | Werkelijke situatie |
|---|---|---|
| Supabase **anon key** | Publiek, by design | Staat in de paginabron — correct, dat hoort zo |
| Supabase **service role** | Enkel Supabase-secrets | Nergens in de repo of geschiedenis |
| `ANTHROPIC_API_KEY` | Edge-secret | Via `Deno.env.get`, geen databankrij aanwezig |
| `GOOGLE_CLIENT_SECRET` | Edge-secret | Via `Deno.env.get` |
| `MOLLIE_API_KEY` | Edge-secret | Geen databankrij; Mollie uitgeschakeld |
| `TURNSTILE_SECRET` | Edge-secret | Niet ingesteld (Turnstile staat uit) |
| Karens dashboardwachtwoord | Nergens in versiebeheer | `Snelstart-Karen.html` staat in `.gitignore` en is nooit gecommit |

## Eén aandachtspunt, gemaskeerd onderzocht

In `settings` staat een rij `resend_api_key`. Ik heb **enkel de prefix en de lengte** opgevraagd, nooit de volledige waarde: prefix `Kar`, lengte 22. Een geldige Resend-sleutel begint met `re_` en is aanzienlijk langer.

**Conclusie: dit is geen sleutel maar per ongeluk ingetypte tekst.** Er is hier niets gelekt. Wel opruimen (P2), want het patroon eromheen — `save-api-keys` bewaart echte sleutels wél in platte tekst — is een reëel ontwerpprobleem (F-05).

## Aanbeveling

Ook al is deze scan schoon: overweeg `gitleaks` of `trufflehog` in CI, zodat dit niet afhangt van een handmatige audit.
