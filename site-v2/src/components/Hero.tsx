import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { SITE } from '../data/site';
import { IMG } from '../data/images';

// Volledig-scherm hero met achtergrondfoto, donkere overlay en subtiele
// parallax/inzoom. Twee CTA's + scroll-indicator.
export function Hero() {
  const t = useT();
  const reduce = useReducedMotion();
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${IMG.hero})` }}
        initial={reduce ? undefined : { scale: 1.12 }}
        animate={reduce ? undefined : { scale: 1 }}
        transition={{ duration: 1.6, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/60" aria-hidden="true" />

      <div className="relative container-x text-center text-white pt-24 pb-28">
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="uppercase tracking-[0.2em] text-white/80 text-xs sm:text-sm font-semibold mb-4">
          La Roche-en-Ardenne · België
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }}
          className="font-head font-bold tracking-tight text-4xl sm:text-6xl lg:text-7xl drop-shadow-sm">
          {t.hero.title}
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-5 mx-auto max-w-2xl text-lg sm:text-2xl text-white/90 font-light">
          {t.hero.subtitle}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href={SITE.reserveUrl} target="_blank" rel="noopener"
            className="inline-flex items-center gap-2 rounded-full bg-green px-8 py-4 text-base font-semibold text-white hover:bg-green-dark transition-colors shadow-lift">
            {t.hero.ctaPrimary} <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
          <Link to="/huuropties"
            className="inline-flex items-center gap-2 rounded-full bg-white/95 px-8 py-4 text-base font-semibold text-green hover:bg-white transition-colors">
            {t.hero.ctaSecondary}
          </Link>
        </motion.div>
      </div>

      <a href="#intro" aria-label={t.hero.scroll}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 hover:text-white">
        <ChevronDown className="w-7 h-7 animate-bounce" aria-hidden="true" />
      </a>
    </section>
  );
}
