import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Reveal } from './Reveal';
import { SITE } from '../data/site';
import { useT } from '../i18n';

// Groene call-to-action-banner. Standaard linkt hij naar het reserveerformulier.
// Interne links (bv. /contact) gaan via de router; externe via een nieuw tabblad.
export function CTA({ title, text, btn, href }: { title: string; text: string; btn: string; href?: string }) {
  const t = useT();
  const target = href || SITE.reserveUrl;
  const intern = target.startsWith('/') && !target.startsWith('//');
  const label = btn || t.common.reserveerNu;
  const btnCls = 'relative mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-green hover:bg-white/90 transition-colors';
  return (
    <section className="py-16 sm:py-20">
      <div className="container-x">
        <Reveal>
          <div className="relative overflow-hidden rounded-xl3 bg-green px-6 py-14 sm:px-14 text-center text-white shadow-lift">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" aria-hidden="true" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-black/10" aria-hidden="true" />
            <h2 className="relative font-head text-3xl sm:text-4xl font-bold">{title}</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/90 text-lg">{text}</p>
            {intern ? (
              <Link to={target} className={btnCls}>{label} <ArrowRight className="h-5 w-5" aria-hidden="true" /></Link>
            ) : (
              <a href={target} target="_blank" rel="noopener" className={btnCls}>{label} <ArrowRight className="h-5 w-5" aria-hidden="true" /></a>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
