import { useT } from '../i18n';
import { Seo } from '../components/Seo';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { RentalCard } from '../components/ImageCard';
import { CTA } from '../components/CTA';

export default function Huuropties() {
  const t = useT();
  const h = t.huuropties;
  return (
    <>
      <Seo metaKey="huuropties" path="/huuropties" />
      <PageHeader eyebrow={h.eyebrow} title={h.title} intro={h.intro} />
      <Section>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {h.items.map((it, i) => (<Reveal key={it.id} delay={i * 0.05}><RentalCard item={it} /></Reveal>))}
        </div>
      </Section>
      <CTA title={h.ctaTitle} text={h.ctaText} btn={t.common.reserveerNu} />
    </>
  );
}
