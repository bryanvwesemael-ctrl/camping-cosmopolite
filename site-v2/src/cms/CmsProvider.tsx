import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { sb } from '../data/supabase';
import type { CmsPagina, Prices, AccType } from './types';

// Haalt éénmalig de door Karen beheerde website-inhoud + de actuele tarieven op
// uit Supabase. De premium site rendert deze data; Karen bewerkt ze via haar
// dashboard (Beheer → Website, met vrij sleepbare blokken).
interface CmsState { paginas: CmsPagina[]; prices: Prices; accTypes: AccType[]; loading: boolean; ready: boolean; }
const Ctx = createContext<CmsState>({ paginas: [], prices: {}, accTypes: [], loading: true, ready: false });

const PRICE_MAP: Record<string, keyof Prices> = {
  prijs_tent: 'tent', prijs_camper: 'camper', prijs_volwassene: 'volwassene', prijs_kind: 'kind',
  prijs_baby: 'baby', prijs_hond: 'hond', prijs_extra_auto: 'extraAuto', prijs_elektriciteit: 'elektriciteit',
  prijs_afval_per_6: 'afvalPer6', toeristentaks: 'toeristentaks',
};

export function CmsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CmsState>({ paginas: [], prices: {}, accTypes: [], loading: true, ready: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pag, cfg] = await Promise.all([
          sb.from('website_paginas').select('*').eq('zichtbaar', true).order('volgorde'),
          sb.from('club_settings').select('key,value').in('key', [...Object.keys(PRICE_MAP), 'accommodatie_types']),
        ]);
        if (!alive) return;
        const prices: Prices = {};
        const cfgRows = (cfg.data || []) as { key: string; value: string }[];
        cfgRows.forEach((r) => { const k = PRICE_MAP[r.key]; if (k) prices[k] = parseFloat(r.value); });
        let accTypes: AccType[] = [];
        const at = cfgRows.find((r) => r.key === 'accommodatie_types');
        if (at) { try { accTypes = JSON.parse(at.value) || []; } catch { /* ignore */ } }
        setState({ paginas: (pag.data || []) as CmsPagina[], prices, accTypes, loading: false, ready: true });
      } catch {
        if (alive) setState((s) => ({ ...s, loading: false, ready: false }));
      }
    })();
    return () => { alive = false; };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useCms(): CmsState { return useContext(Ctx); }
export function useCmsPagina(slug: string): CmsPagina | undefined {
  return useCms().paginas.find((p) => p.slug === slug);
}
