import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useT } from '../i18n';
import { ROUTES, SITE } from '../data/site';
import { LanguageSwitcher } from './LanguageSwitcher';

// Sticky navbar met transparante hero-staat, actieve link-markering,
// hamburgermenu op mobiel en een opvallende reserveer-knop.
export function Navbar() {
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);

  const links = ROUTES.map((r) => ({ to: r.path, label: t.nav[r.key as keyof typeof t.nav] }));

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,.06)]' : 'bg-transparent'}`}>
      <nav className="container-x flex items-center gap-4 h-16 sm:h-20" aria-label="Hoofdnavigatie">
        <Link to="/" className={`font-head font-bold text-lg shrink-0 ${scrolled ? 'text-green' : 'text-white drop-shadow'}`}>
          🏕️ Cosmopolite
        </Link>

        <div className="hidden lg:flex items-center gap-1 mx-auto">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              className={({ isActive }) => `px-3.5 py-2 rounded-full text-[15px] font-medium transition-colors ${isActive ? 'bg-green-soft text-green' : scrolled ? 'text-muted hover:text-ink hover:bg-black/5' : 'text-white/90 hover:text-white hover:bg-white/10'}`}>
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3 ml-auto lg:ml-0">
          <LanguageSwitcher />
          <a href={SITE.reserveUrl} target="_blank" rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-full bg-green text-white px-5 py-2.5 text-sm font-semibold hover:bg-green-dark transition-colors shadow-soft">
            {t.nav.reserveer} <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>

        <button type="button" onClick={() => setOpen(true)} aria-label="Menu openen"
          className={`lg:hidden ml-auto p-2 rounded-lg ${scrolled ? 'text-ink' : 'text-white'}`}>
          <Menu className="w-6 h-6" />
        </button>
      </nav>

      {/* Mobiel menu */}
      <div className={`lg:hidden fixed inset-0 z-50 transition ${open ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={() => setOpen(false)} />
        <div className={`absolute right-0 top-0 h-full w-[82%] max-w-sm bg-white shadow-xl p-6 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between mb-6">
            <span className="font-head font-bold text-green text-lg">🏕️ Cosmopolite</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Menu sluiten" className="p-2 -mr-2"><X className="w-6 h-6" /></button>
          </div>
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={() => setOpen(false)}
                className={({ isActive }) => `px-4 py-3 rounded-xl text-base font-medium ${isActive ? 'bg-green-soft text-green' : 'text-ink hover:bg-black/5'}`}>
                {l.label}
              </NavLink>
            ))}
          </div>
          <a href={SITE.reserveUrl} target="_blank" rel="noopener" onClick={() => setOpen(false)}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-green text-white px-6 py-3.5 font-semibold">
            {t.nav.reserveer} <ArrowRight className="w-4 h-4" />
          </a>
          <div className="mt-6"><LanguageSwitcher /></div>
        </div>
      </div>
    </header>
  );
}
