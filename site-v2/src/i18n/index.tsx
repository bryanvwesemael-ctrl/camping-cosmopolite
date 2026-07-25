import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { nl, type Dict } from './nl';
import { fr } from './fr';
import type { Lang } from '../types';

const DICTS: Record<Lang, Dict> = { nl, fr };

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: Dict; }
const LangContext = createContext<Ctx | null>(null);

function initialLang(): Lang {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('cc_lang') : null;
  if (saved === 'nl' || saved === 'fr') return saved;
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'nl';
  return nav.startsWith('fr') ? 'fr' : 'nl';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('cc_lang', l); } catch { /* ignore */ } };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return <LangContext.Provider value={{ lang, setLang, t: DICTS[lang] }}>{children}</LangContext.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(LangContext);
  if (!c) throw new Error('useI18n moet binnen LanguageProvider gebruikt worden');
  return c;
}
// Kort alias om enkel de vertaalset op te halen.
export function useT(): Dict { return useI18n().t; }
