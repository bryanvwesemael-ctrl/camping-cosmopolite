// Taal-gecodeerde tekst: { nl: "...", fr: "...", ... }
export type Loc = Record<string, string>;

export interface Branding {
  primary: string; dark: string; accent: string; bg: string; ink: string;
  font_head: string; font_body: string; logo_url?: string; favicon?: string;
}
export interface Contact {
  adres?: string; tel?: string; email?: string; instagram?: string; maps_query?: string;
}
export interface WbSite {
  id: string; slug: string; naam: string; talen: string[]; default_taal: string;
  branding: Branding; contact: Contact; reserveer_url?: string | null; gepubliceerd: boolean;
}
export interface WbBlock { type: string; [key: string]: unknown; }
export interface WbPagina {
  id: string; site_id: string; slug: string; titel: Loc; volgorde: number;
  blokken: WbBlock[]; zichtbaar: boolean;
}
