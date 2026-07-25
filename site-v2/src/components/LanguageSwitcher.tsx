import { useI18n } from '../i18n';
import type { Lang } from '../types';

// Compacte NL/FR-wisselaar. Toont beide talen; de actieve is gemarkeerd.
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const opt = (l: Lang, label: string) => (
    <button
      type="button"
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      aria-label={l === 'nl' ? 'Nederlands' : 'Français'}
      className={`px-2.5 py-1 text-xs font-bold rounded-full transition-colors ${lang === l ? 'bg-green text-white' : 'text-muted hover:text-ink'}`}
    >{label}</button>
  );
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-full bg-black/5 p-0.5 ${className}`}>
      {opt('nl', 'NL')}{opt('fr', 'FR')}
    </div>
  );
}
