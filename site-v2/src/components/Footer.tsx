import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Instagram } from 'lucide-react';
import { useT } from '../i18n';
import { ROUTES, SITE } from '../data/site';

export function Footer() {
  const t = useT();
  const jaar = new Date().getFullYear();
  return (
    <footer className="bg-green-dark text-white/80">
      <div className="container-x py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="font-head font-bold text-white text-lg mb-3">🏕️ Camping Cosmopolite</div>
          <p className="text-sm leading-relaxed text-white/70">{t.footer.tagline}</p>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">{t.footer.colNav}</h3>
          <ul className="space-y-2 text-sm">
            {ROUTES.map((r) => (
              <li key={r.path}><Link to={r.path} className="hover:text-white transition-colors">{t.nav[r.key as keyof typeof t.nav]}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">{t.footer.colInfo}</h3>
          <ul className="space-y-2 text-sm">
            <li><a href={SITE.reserveUrl} target="_blank" rel="noopener" className="hover:text-white transition-colors">{t.nav.reserveer}</a></li>
            <li><Link to="/tarieven" className="hover:text-white transition-colors">{t.nav.tarieven}</Link></li>
            <li><Link to="/huuropties" className="hover:text-white transition-colors">{t.nav.huuropties}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">{t.footer.colSocial}</h3>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /><span>{SITE.adres}</span></li>
            <li className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0" /><a href={SITE.telHref} className="hover:text-white">{SITE.tel}</a></li>
            <li className="flex items-center gap-2"><Mail className="w-4 h-4 shrink-0" /><a href={`mailto:${SITE.email}`} className="hover:text-white break-all">{SITE.email}</a></li>
            <li className="flex items-center gap-2"><Instagram className="w-4 h-4 shrink-0" /><a href={SITE.instagramUrl} target="_blank" rel="noopener" className="hover:text-white">@{SITE.instagram}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/60">
          <span>© {jaar} Camping Cosmopolite. {t.footer.rights}</span>
          <a href={`${SITE.baseUrl}/privacy/`} target="_blank" rel="noopener" className="hover:text-white underline">{t.footer.privacy}</a>
        </div>
      </div>
    </footer>
  );
}
