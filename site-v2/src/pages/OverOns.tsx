import { Target, Eye } from 'lucide-react';
import { useT } from '../i18n';
import { Seo } from '../components/Seo';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { Gallery } from '../components/Gallery';
import { CTA } from '../components/CTA';
import { IMG } from '../data/images';

export default function OverOns() {
  const t = useT();
  const o = t.overons;
  return (
    <>
      <Seo metaKey="overons" path="/over-ons" />
      <PageHeader eyebrow={o.eyebrow} title={o.title} intro={o.intro} />

      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal><div className="overflow-hidden rounded-xl3 shadow-lift"><img src={IMG.about1} alt="" loading="lazy" className="w-full object-cover aspect-[4/3]" /></div></Reveal>
          <Reveal delay={0.1}><p className="text-xl leading-relaxed text-ink/90">{o.lead}</p></Reveal>
        </div>
      </Section>

      <Section className="bg-green-soft/40 !pt-0">
        <div className="grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-xl2 bg-white p-8 shadow-card ring-1 ring-hairline/60">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-green text-white"><Target className="h-6 w-6" aria-hidden="true" /></span>
              <h2 className="mt-4 h-display text-2xl">{o.missionTitle}</h2>
              <p className="mt-2 text-muted leading-relaxed">{o.missionText}</p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="h-full rounded-xl2 bg-white p-8 shadow-card ring-1 ring-hairline/60">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber text-white"><Eye className="h-6 w-6" aria-hidden="true" /></span>
              <h2 className="mt-4 h-display text-2xl">{o.visionTitle}</h2>
              <p className="mt-2 text-muted leading-relaxed">{o.visionText}</p>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section eyebrow={o.eyebrow} title={o.timelineTitle} center>
        <div className="grid gap-5 sm:grid-cols-3">
          {o.timeline.map((it, i) => (
            <Reveal key={it.title} delay={i * 0.06}>
              <div className="h-full rounded-xl2 bg-white p-6 text-center shadow-card ring-1 ring-hairline/60">
                <div className="text-sm font-semibold uppercase tracking-wide text-green">{it.year}</div>
                <div className="mt-1 font-head text-lg font-semibold">{it.title}</div>
                <p className="mt-2 text-muted">{it.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-12"><Gallery /></div>
      </Section>

      <CTA title={t.home.ctaTitle} text={t.home.ctaText} btn={t.home.ctaBtn} />
    </>
  );
}
