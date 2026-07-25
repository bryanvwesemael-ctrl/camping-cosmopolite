import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useT } from '../i18n';
import { IMG } from '../data/images';
import { Seo } from '../components/Seo';
import { Hero } from '../components/Hero';
import { Section } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { Card } from '../components/Card';
import { ActivityCard, RentalCard } from '../components/ImageCard';
import { ReviewCard } from '../components/ReviewCard';
import { FAQ } from '../components/FAQ';
import { CTA } from '../components/CTA';
import { Button } from '../components/Button';

export default function Home() {
  const t = useT();
  const h = t.home;
  return (
    <>
      <Seo metaKey="home" path="/" />
      <Hero />

      {/* Intro */}
      <Section id="intro" className="!pt-20">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="eyebrow mb-3">{h.introEyebrow}</p>
          <h2 className="h-display text-3xl sm:text-4xl leading-tight">{h.introTitle}</h2>
          <p className="mt-5 text-lg text-muted leading-relaxed">{h.introText}</p>
        </Reveal>
      </Section>

      {/* Waarom */}
      <Section className="!pt-0" eyebrow={h.whyEyebrow} title={h.whyTitle} sub={h.whySub} center>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {h.features.map((f, i) => (<Reveal key={f.title} delay={i * 0.05}><Card item={f} /></Reveal>))}
        </div>
      </Section>

      {/* Domein */}
      <Section className="bg-green-soft/40">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal><div className="overflow-hidden rounded-xl3 shadow-lift"><img src={IMG.domein} alt="" loading="lazy" className="w-full h-full object-cover aspect-[4/3]" /></div></Reveal>
          <Reveal delay={0.1}>
            <p className="eyebrow mb-2">{h.domeinEyebrow}</p>
            <h2 className="h-display text-3xl sm:text-4xl leading-tight">{h.domeinTitle}</h2>
            <p className="mt-4 text-lg text-muted leading-relaxed">{h.domeinText}</p>
            <ul className="mt-6 space-y-3">
              {h.domeinPoints.map((p) => (<li key={p} className="flex items-center gap-3"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green text-white shrink-0"><Check className="h-4 w-4" /></span><span className="text-ink">{p}</span></li>))}
            </ul>
          </Reveal>
        </div>
      </Section>

      {/* Huuropties preview */}
      <Section eyebrow={h.rentalsEyebrow} title={h.rentalsTitle} sub={h.rentalsSub} center>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.huuropties.items.slice(0, 3).map((r, i) => (<Reveal key={r.id} delay={i * 0.05}><RentalCard item={r} /></Reveal>))}
        </div>
        <div className="mt-9 text-center"><Button to="/huuropties" variant="secondary">{t.common.alleHuuropties} <ArrowRight className="h-4 w-4" /></Button></div>
      </Section>

      {/* Activiteiten highlight */}
      <Section className="bg-green-soft/40" eyebrow={h.activitiesEyebrow} title={h.activitiesTitle} sub={h.activitiesSub} center>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.activiteiten.items.slice(0, 3).map((a, i) => (<Reveal key={a.title} delay={i * 0.05}><ActivityCard item={a} /></Reveal>))}
        </div>
        <div className="mt-9 text-center"><Button to="/activiteiten" variant="secondary">{t.common.alleActiviteiten} <ArrowRight className="h-4 w-4" /></Button></div>
      </Section>

      {/* Reviews */}
      <Section eyebrow={h.reviewsEyebrow} title={h.reviewsTitle} sub={h.reviewsSub} center>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {h.reviews.map((r, i) => (<Reveal key={r.name} delay={i * 0.04}><ReviewCard item={r} /></Reveal>))}
        </div>
      </Section>

      {/* FAQ */}
      <Section className="bg-green-soft/40" eyebrow={h.faqEyebrow} title={h.faqTitle} sub={h.faqSub} center>
        <FAQ items={h.faq} />
        <p className="mt-6 text-center text-muted">{h.faqSub} <Link to="/contact" className="font-semibold text-green underline">{t.common.contacteerOns}</Link></p>
      </Section>

      <CTA title={h.ctaTitle} text={h.ctaText} btn={h.ctaBtn} />
    </>
  );
}
