import { createClient } from '@supabase/supabase-js';

// Voorlopig hetzelfde Supabase-project als de camping (aparte wb_*-tabellen).
// Later af te splitsen naar een eigen project per het verkoopbare product.
const SUPABASE_URL = 'https://whubbowuqhjdkdequbmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodWJib3d1cWhqZGtkZXF1Ym1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjM3NTYsImV4cCI6MjA5Nzc5OTc1Nn0.1S-eme0sMmC_25H-XnZ9r3AMKFSSxnpRx3-GRefSyzs';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Welke klant-site tonen we? Bepaald door (in volgorde):
//  1. ?site=<slug> in de URL (handig om demo's te bekijken),
//  2. VITE_SITE_SLUG build-variabele (per-klant deploy),
//  3. 'demo-bistro' als terugval.
export function currentSiteSlug(): string {
  const q = new URLSearchParams(window.location.search).get('site');
  if (q) return q;
  const env = (import.meta as { env?: Record<string, string> }).env?.VITE_SITE_SLUG;
  return env || 'demo-bistro';
}
