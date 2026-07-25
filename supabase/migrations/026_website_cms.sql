-- ============================================================================
-- 026_website_cms.sql
-- Nieuwe publieke website voor Camping Cosmopolite, zelf te beheren door Karen
-- vanuit haar bestaande dashboard (Beheer → Website). Blok-gebaseerde
-- paginabouwer: elke pagina bevat een geordende lijst "blokken" (widgets),
-- elk tweetalig (NL + FR). De publieke site rendert deze inhoud; enkel admins
-- kunnen ze wijzigen.
--
-- Ontwerpkeuze (besproken met Bryan): één rij per pagina met de blokken als
-- jsonb-array. Opslaan = één upsert, herordenen = de array herschikken —
-- atomair en simpel, geen losse blok-rijen te synchroniseren.
--
-- Rollback: 026_website_cms_rollback.sql
-- ============================================================================

create table if not exists website_paginas (
  slug        text primary key,
  titel_nl    text not null default '',
  titel_fr    text not null default '',
  volgorde    int  not null default 0,       -- volgorde in de navigatie
  blokken     jsonb not null default '[]',   -- [{type, ...nl/fr-velden}]
  zichtbaar   boolean not null default true, -- in de nav + publiek zichtbaar
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table website_paginas enable row level security;

-- Iedereen (ook niet-ingelogde bezoekers) mag zichtbare pagina's lezen —
-- dit is publieke website-inhoud, geen privégegevens.
create policy public_read_website on website_paginas
  for select to anon using (zichtbaar = true);

-- Ingelogde medewerkers/admins mogen alles lezen (ook verborgen concepten).
create policy staff_read_website on website_paginas
  for select to authenticated using (true);

-- Enkel admins mogen de website bewerken.
create policy admin_write_website on website_paginas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop trigger if exists trg_website_paginas_updated_at on website_paginas;
create trigger trg_website_paginas_updated_at before update on website_paginas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Publieke opslag-bucket voor website-foto's (los van de private id-fotos /
-- booking-fotos buckets — website-beelden mogen net wél publiek leesbaar zijn).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('website-media','website-media', true)
  on conflict (id) do nothing;

drop policy if exists public_read_website_media on storage.objects;
create policy public_read_website_media on storage.objects
  for select to anon using (bucket_id = 'website-media');

drop policy if exists admin_write_website_media on storage.objects;
create policy admin_write_website_media on storage.objects
  for all to authenticated
  using (bucket_id = 'website-media' and public.is_admin())
  with check (bucket_id = 'website-media' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Starterinhoud (tweetalig) op basis van de bestaande Google Site. Bedoeld als
-- vertrekpunt — Karen verfijnt alles in de bouwer. De FR-teksten zijn een
-- eerste vertaling en mogen door haar nagelezen worden.
-- ---------------------------------------------------------------------------
insert into website_paginas (slug, titel_nl, titel_fr, volgorde, blokken) values
('home','Home','Accueil',1,'[
  {"type":"kop","titel_nl":"Camping Cosmopolite","titel_fr":"Camping Cosmopolite","ondertitel_nl":"Kamperen aan de oevers van de Ourthe in La Roche-en-Ardenne","ondertitel_fr":"Camping au bord de l''Ourthe à La Roche-en-Ardenne","foto":""},
  {"type":"tekst","html_nl":"<p>Welkom op Camping Cosmopolite. Bij ons vind je volop ruimte om te ontspannen met je gezin, pal aan de oevers van de Ourthe. We verwelkomen tenten, caravans en campers in een ontspannen sfeer met voldoende plaats voor iedereen.</p>","html_fr":"<p>Bienvenue au Camping Cosmopolite. Chez nous, vous trouverez de l''espace pour vous détendre en famille, directement au bord de l''Ourthe. Nous accueillons tentes, caravanes et camping-cars dans une ambiance détendue avec de la place pour tous.</p>"},
  {"type":"kaarten","items":[
    {"emoji":"⚡","titel_nl":"Elektriciteit","titel_fr":"Électricité","tekst_nl":"Elektrische aansluitingen beschikbaar op de plaatsen.","tekst_fr":"Raccordements électriques disponibles sur les emplacements."},
    {"emoji":"🔥","titel_nl":"Kampvuur","titel_fr":"Feu de camp","tekst_nl":"Kampvuur toegelaten in een eigen vuurkorf.","tekst_fr":"Feu de camp autorisé dans un brasero personnel."},
    {"emoji":"🐕","titel_nl":"Huisdieren welkom","titel_fr":"Animaux bienvenus","tekst_nl":"Je viervoeter is welkom op de camping.","tekst_fr":"Votre animal est le bienvenu au camping."},
    {"emoji":"🏞️","titel_nl":"Aan de rivier","titel_fr":"Au bord de la rivière","tekst_nl":"Zwemmen en vissen in de Ourthe (visverlof vereist).","tekst_fr":"Baignade et pêche dans l''Ourthe (permis requis)."}
  ]},
  {"type":"knop","tekst_nl":"Reserveer je plaats","tekst_fr":"Réservez votre emplacement","url":"/reserveren/"}
]'),
('activiteiten','Activiteiten','Activités',2,'[
  {"type":"titel","tekst_nl":"Activiteiten","tekst_fr":"Activités"},
  {"type":"tekst","html_nl":"<p>In en rond de camping is er van alles te beleven.</p>","html_fr":"<p>Il y a beaucoup à faire au camping et dans les environs.</p>"},
  {"type":"kaarten","items":[
    {"emoji":"🏊","titel_nl":"Zwemmen","titel_fr":"Baignade","tekst_nl":"Verkoeling in de Ourthe, vlak bij de camping.","tekst_fr":"Rafraîchissez-vous dans l''Ourthe, tout près du camping."},
    {"emoji":"🥾","titel_nl":"Wandelen & fietsen","titel_fr":"Randonnée & vélo","tekst_nl":"Talrijke wandel- en fietsroutes in de Ardennen.","tekst_fr":"Nombreux itinéraires de randonnée et de vélo en Ardenne."},
    {"emoji":"🛶","titel_nl":"Kajak","titel_fr":"Kayak","tekst_nl":"Kajaktochten op de Ourthe.","tekst_fr":"Descentes en kayak sur l''Ourthe."},
    {"emoji":"🎣","titel_nl":"Vissen","titel_fr":"Pêche","tekst_nl":"Vissen in de rivier (visverlof vereist).","tekst_fr":"Pêche dans la rivière (permis requis)."}
  ]}
]'),
('huuropties','Huuropties','Locations',3,'[
  {"type":"titel","tekst_nl":"Huuropties","tekst_fr":"Locations"},
  {"type":"tekst","html_nl":"<p>Ruime staanplaatsen en huurmogelijkheden beschikbaar. Neem contact op voor de details.</p>","html_fr":"<p>Emplacements spacieux et options de location disponibles. Contactez-nous pour plus de détails.</p>"}
]'),
('scoutsweide','Scoutsweide','Prairie scouts',4,'[
  {"type":"titel","tekst_nl":"Scoutsweide","tekst_fr":"Prairie scouts"},
  {"type":"tekst","html_nl":"<p>Een aparte weide voor groepen en scouts. Contacteer ons voor de mogelijkheden en beschikbaarheid.</p>","html_fr":"<p>Une prairie séparée pour les groupes et les scouts. Contactez-nous pour les possibilités et la disponibilité.</p>"}
]'),
('tarieven','Tarieven & Reserveren','Tarifs & Réservation',5,'[
  {"type":"titel","tekst_nl":"Tarieven","tekst_fr":"Tarifs"},
  {"type":"tarieven"},
  {"type":"knop","tekst_nl":"Reserveer nu","tekst_fr":"Réservez maintenant","url":"/reserveren/"}
]'),
('contact','Contact','Contact',6,'[
  {"type":"titel","tekst_nl":"Contact","tekst_fr":"Contact"},
  {"type":"contact"}
]'),
('overons','Over ons','À propos',7,'[
  {"type":"titel","tekst_nl":"Over ons","tekst_fr":"À propos"},
  {"type":"tekst","html_nl":"<p>Camping Cosmopolite ligt op wandelafstand van het centrum van La Roche-en-Ardenne, aan de oevers van de Ourthe.</p>","html_fr":"<p>Le Camping Cosmopolite se situe à distance de marche du centre de La Roche-en-Ardenne, au bord de l''Ourthe.</p>"}
]')
on conflict (slug) do nothing;
