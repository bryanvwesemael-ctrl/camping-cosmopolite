// Vorm van de CMS-data zoals Karen ze in het dashboard samenstelt
// (tabel website_paginas). Blokken zijn losjes getypeerd: elk blok heeft een
// type en verder vrije, tweetalige velden (…_nl / …_fr).
export interface CmsBlock {
  type: string;
  [key: string]: unknown;
}
export interface CmsPagina {
  slug: string;
  titel_nl: string;
  titel_fr: string;
  volgorde: number;
  blokken: CmsBlock[];
  zichtbaar: boolean;
}
export interface Prices {
  tent?: number; camper?: number; volwassene?: number; kind?: number; baby?: number;
  hond?: number; extraAuto?: number; elektriciteit?: number; afvalPer6?: number; toeristentaks?: number;
}
export interface AccType { id: string; naam: string; emoji?: string; prijs?: number; }
