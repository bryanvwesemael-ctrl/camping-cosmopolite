import { Tent } from 'lucide-react';
import { useT } from '../i18n';
import { Seo } from '../components/Seo';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { CTA } from '../components/CTA';
import { IMG } from '../data/images';

export default function Scoutsweide() {
  const t = useT();
  const s = t.scoutsweide;
  return (
    <>
      <Seo metaKey="scoutsweide" path="/scoutsweide" />
      <PageHeader eyebrow={s.eyebrow} title={s.title} intro={s.intro} />
      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal><div className="overflow-hidden rounded-xl3 shadow-lift"><img src={IMG.scouts} alt="" loading="lazy" className="w-full object-cover aspect-[4/3]" /></div></Reveal>
          <Reveal delay={0.1}>
            <h2 className="h-display text-2xl sm:text-3xl">{s.groupsTitle}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {s.groups.map((g) => (
                <span key={g} className="inline-flex items-center gap-2 rounded-full bg-green-soft px-4 py-2 text-sm font-semibold text-green"><Tent className="h-4 w-4" aria-hidden="true" />{g}</span>
              ))}
            </div>
            <p className="mt-6 text-lg text-muted leading-relaxed">{s.text}</p>
          </Reveal>
        </div>
      </Section>
      <CTA title={s.ctaTitle} text={s.ctaText} btn={t.common.contacteerOns} href="/contact" />
    </>
  );
}
