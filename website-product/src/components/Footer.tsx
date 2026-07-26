import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Instagram } from 'lucide-react';
import { useSite, loc } from '../cms/SiteProvider';

const pathFor = (slug: string) => (slug === 'home' ? '/' : '/' + slug);

export function Footer() {
  const { site, paginas, lang } = useSite();
  if (!site) return null;
  const c = site.contact || {};
  const jaar = new Date().getFullYear();
  return (
    <footer className="bg-brand-dark text-white/80 mt-8">
      <div className="container-x py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="font-head font-bold text-white text-lg mb-3">{site.naam}</div>
          {c.adres && <p className="text-sm text-white/70">{c.adres}</p>}
        </div>
        <div>
          <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">{lang === 'fr' ? 'Navigation' : 'Navigatie'}</h3>
          <ul className="space-y-2 text-sm">{paginas.map((p) => (<li key={p.slug}><Link to={pathFor(p.slug)} className="hover:text-white transition-colors">{loc(p.titel, lang) || p.slug}</Link></li>))}</ul>
        </div>
        <div>
          <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Contact</h3>
          <ul className="space-y-2.5 text-sm">
            {c.adres && <li className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /><span>{c.adres}</span></li>}
            {c.tel && <li className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0" /><a href={`tel:${c.tel.replace(/\s/g, '')}`} className="hover:text-white">{c.tel}</a></li>}
            {c.email && <li className="flex items-center gap-2"><Mail className="w-4 h-4 shrink-0" /><a href={`mailto:${c.email}`} className="hover:text-white break-all">{c.email}</a></li>}
            {c.instagram && <li className="flex items-center gap-2"><Instagram className="w-4 h-4 shrink-0" /><a href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noopener" className="hover:text-white">@{c.instagram}</a></li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10"><div className="container-x py-4 text-xs text-white/60">© {jaar} {site.naam}</div></div>
    </footer>
  );
}
