import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useSite, loc } from '../cms/SiteProvider';

const pathFor = (slug: string) => (slug === 'home' ? '/' : '/' + slug);

export function Navbar() {
  const { site, paginas, lang, setLang } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 16);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);
  if (!site) return null;
  const talen = site.talen || [];

  const brand = site.branding?.logo_url
    ? <img src={site.branding.logo_url} alt={site.naam} className="h-8 w-auto" />
    : <span className={`font-head font-bold text-lg ${scrolled ? 'text-brand' : 'text-white drop-shadow'}`}>{site.naam}</span>;

  const langSwitch = talen.length > 1 && (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-black/5 p-0.5">
      {talen.map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`px-2.5 py-1 text-xs font-bold rounded-full transition-colors ${lang === l ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}>{l.toUpperCase()}</button>
      ))}
    </div>
  );

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,.06)]' : 'bg-transparent'}`}>
      <nav className="container-x flex items-center gap-4 h-16 sm:h-20" aria-label="Navigatie">
        <Link to="/" className="shrink-0">{brand}</Link>
        <div className="hidden lg:flex items-center gap-1 mx-auto">
          {paginas.map((p) => (
            <NavLink key={p.slug} to={pathFor(p.slug)} end={p.slug === 'home'}
              className={({ isActive }) => `px-3.5 py-2 rounded-full text-[15px] font-medium transition-colors ${isActive ? 'text-brand' : scrolled ? 'text-muted hover:text-ink hover:bg-black/5' : 'text-white/90 hover:text-white hover:bg-white/10'}`}
              style={({ isActive }) => isActive ? { background: 'var(--brand-soft)' } : undefined}>
              {loc(p.titel, lang) || p.slug}
            </NavLink>
          ))}
        </div>
        <div className="hidden lg:flex items-center gap-3 ml-auto lg:ml-0">
          {langSwitch}
          {site.reserveer_url && <a href={site.reserveer_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full bg-brand text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-dark transition-colors shadow-card">{lang === 'fr' ? 'Réserver' : 'Reserveer'} <ArrowRight className="w-4 h-4" aria-hidden="true" /></a>}
        </div>
        <button onClick={() => setOpen(true)} aria-label="Menu" className={`lg:hidden ml-auto p-2 rounded-lg ${scrolled ? 'text-ink' : 'text-white'}`}><Menu className="w-6 h-6" /></button>
      </nav>

      <div className={`lg:hidden fixed inset-0 z-50 transition ${open ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={() => setOpen(false)} />
        <div className={`absolute right-0 top-0 h-full w-[82%] max-w-sm bg-white shadow-xl p-6 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between mb-6"><span className="font-head font-bold text-brand text-lg">{site.naam}</span><button onClick={() => setOpen(false)} aria-label="Sluiten" className="p-2 -mr-2"><X className="w-6 h-6" /></button></div>
          <div className="flex flex-col gap-1">
            {paginas.map((p) => (
              <NavLink key={p.slug} to={pathFor(p.slug)} end={p.slug === 'home'} onClick={() => setOpen(false)}
                className={({ isActive }) => `px-4 py-3 rounded-xl text-base font-medium ${isActive ? 'text-brand' : 'text-ink hover:bg-black/5'}`}
                style={({ isActive }) => isActive ? { background: 'var(--brand-soft)' } : undefined}>{loc(p.titel, lang) || p.slug}</NavLink>
            ))}
          </div>
          {site.reserveer_url && <a href={site.reserveer_url} target="_blank" rel="noopener" onClick={() => setOpen(false)} className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand text-white px-6 py-3.5 font-semibold">{lang === 'fr' ? 'Réserver' : 'Reserveer'} <ArrowRight className="w-4 h-4" /></a>}
          <div className="mt-6">{langSwitch}</div>
        </div>
      </div>
    </header>
  );
}
