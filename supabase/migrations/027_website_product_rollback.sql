-- ROLLBACK voor 027_website_product.sql
-- Verwijdert het volledige website-product-datamodel (incl. alle klant-sites
-- en hun pagina's). Onomkeerbaar dataverlies — enkel gebruiken bij terugdraaien.
drop table if exists wb_paginas;
drop table if exists wb_sites;
