-- ============================================================================
-- 027_website_product.sql
-- FUNDAMENT van het losstaande, verkoopbare website-product ("website-product").
-- Multi-site vanaf dag 1: één codebase, elke klant = een rij in wb_sites met
-- eigen branding, talen en inhoud. Bewust in aparte wb_*-tabellen zodat dit
-- product volledig losstaat van de camping en later naar een eigen Supabase-
-- project kan verhuizen.
--
-- Talen zijn per site instelbaar (wb_sites.talen). Blok-tekstvelden worden
-- taal-gecodeerd bewaard als jsonb-object, bv. {"nl":"...","fr":"..."} — zo
-- werkt om het even welke talenset zonder schemawijziging.
--
-- Rollback: 027_website_product_rollback.sql
-- ============================================================================

create table if not exists wb_sites (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,             -- interne identificatie / subdomein
  naam         text not null default '',
  talen        text[] not null default '{nl}',   -- bv. {nl,fr,en}
  default_taal text not null default 'nl',
  branding     jsonb not null default '{
    "primary":"#1B8A5B","dark":"#0D5035","accent":"#C77A11",
    "bg":"#FAFAF7","ink":"#202124","font_head":"Poppins","font_body":"Inter",
    "logo_url":"","favicon":"🌐"
  }',
  contact      jsonb not null default '{}',      -- {adres,tel,email,instagram,maps_query}
  reserveer_url text,                            -- optionele externe boekings-/actielink
  gepubliceerd boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists wb_paginas (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references wb_sites(id) on delete cascade,
  slug       text not null,                      -- pagina binnen de site (home, over, ...)
  titel      jsonb not null default '{}',        -- {"nl":"Home","fr":"Accueil"}
  volgorde   int not null default 0,
  blokken    jsonb not null default '[]',
  zichtbaar  boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (site_id, slug)
);
create index if not exists wb_paginas_site_idx on wb_paginas(site_id);

alter table wb_sites   enable row level security;
alter table wb_paginas enable row level security;

-- Publiek: iedereen mag gepubliceerde sites en hun zichtbare pagina's lezen.
create policy wb_public_read_sites on wb_sites
  for select to anon using (gepubliceerd = true);
create policy wb_public_read_paginas on wb_paginas
  for select to anon using (
    zichtbaar = true and site_id in (select id from wb_sites where gepubliceerd = true)
  );

-- Ingelogde medewerkers mogen alles lezen (ook concepten) — nodig voor de bouwer.
create policy wb_staff_read_sites on wb_sites for select to authenticated using (true);
create policy wb_staff_read_paginas on wb_paginas for select to authenticated using (true);

-- Schrijven: voorlopig admin-only (jij zet klanten op). Per-klant login volgt
-- in een latere fase; dan wordt dit vervangen door een site-gebonden check.
create policy wb_admin_all_sites on wb_sites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy wb_admin_all_paginas on wb_paginas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop trigger if exists trg_wb_sites_updated_at on wb_sites;
create trigger trg_wb_sites_updated_at before update on wb_sites
  for each row execute function public.set_updated_at();
drop trigger if exists trg_wb_paginas_updated_at on wb_paginas;
create trigger trg_wb_paginas_updated_at before update on wb_paginas
  for each row execute function public.set_updated_at();
