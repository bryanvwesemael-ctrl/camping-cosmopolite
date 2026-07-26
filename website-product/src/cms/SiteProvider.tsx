import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { sb, currentSiteSlug } from '../data/supabase';
import type { WbSite, WbPagina } from './types';

interface SiteState {
  site: WbSite | null; paginas: WbPagina[]; lang: string;
  setLang: (l: string) => void; loading: boolean; error: string | null;
}
const Ctx = createContext<SiteState | null>(null);

// Laadt de Google Font(s) van de klant dynamisch in.
function loadFont(family: string) {
  if (!family) return;
  const id = 'font-' + family.replace(/\s+/g, '-');
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id; link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

function applyBranding(site: WbSite) {
  const b = site.branding || ({} as WbSite['branding']);
  const r = document.documentElement.style;
  const set = (k: string, v?: string) => { if (v) r.setProperty(k, v); };
  set('--brand-primary', b.primary); set('--brand-dark', b.dark); set('--brand-accent', b.accent);
  set('--brand-bg', b.bg); set('--brand-ink', b.ink);
  if (b.font_head) { set('--font-head', `'${b.font_head}', system-ui, sans-serif`); loadFont(b.font_head); }
  if (b.font_body) { set('--font-body', `'${b.font_body}', system-ui, sans-serif`); loadFont(b.font_body); }
  document.title = site.naam || 'Website';
  if (b.favicon) {
    const link = (document.querySelector('link[rel="icon"]') as HTMLLinkElement) || document.createElement('link');
    link.rel = 'icon';
    link.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${encodeURIComponent(b.favicon)}</text></svg>`;
    document.head.appendChild(link);
  }
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SiteState>({ site: null, paginas: [], lang: 'nl', setLang: () => {}, loading: true, error: null });

  const setLang = (l: string) => setState((s) => {
    try { localStorage.setItem('wb_lang_' + (s.site?.slug || ''), l); } catch { /* ignore */ }
    return { ...s, lang: l };
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const slug = currentSiteSlug();
      const { data: site, error } = await sb.from('wb_sites').select('*').eq('slug', slug).eq('gepubliceerd', true).maybeSingle();
      if (!alive) return;
      if (error || !site) { setState((s) => ({ ...s, loading: false, error: error?.message || 'Site niet gevonden' })); return; }
      applyBranding(site as WbSite);
      const { data: pag } = await sb.from('wb_paginas').select('*').eq('site_id', (site as WbSite).id).eq('zichtbaar', true).order('volgorde');
      if (!alive) return;
      const talen = (site as WbSite).talen || ['nl'];
      let lang = (site as WbSite).default_taal || talen[0] || 'nl';
      try { const saved = localStorage.getItem('wb_lang_' + slug); if (saved && talen.includes(saved)) lang = saved; } catch { /* ignore */ }
      document.documentElement.lang = lang;
      setState({ site: site as WbSite, paginas: (pag || []) as WbPagina[], lang, setLang, loading: false, error: null });
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (state.site) document.documentElement.lang = state.lang; }, [state.lang, state.site]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useSite(): SiteState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSite binnen SiteProvider gebruiken');
  return c;
}
// Taal-gecodeerd veld ophalen met terugval op de eerste beschikbare taal.
export function loc(obj: Record<string, string> | undefined, lang: string): string {
  if (!obj) return '';
  return obj[lang] || obj.nl || Object.values(obj)[0] || '';
}
