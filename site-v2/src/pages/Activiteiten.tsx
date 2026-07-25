import { useT } from '../i18n';
import { Seo } from '../components/Seo';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { ActivityCard } from '../components/ImageCard';
import { CTA } from '../components/CTA';

export default function Activiteiten() {
  const t = useT();
  const a = t.activiteiten;
  return (
    <>
      <Seo metaKey="activiteiten" path="/activiteiten" />
      <PageHeader eyebrow={a.eyebrow} title={a.title} intro={a.intro} />
      <Section>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {a.items.map((it, i) => (<Reveal key={it.title} delay={i * 0.05}><ActivityCard item={it} /></Reveal>))}
        </div>
      </Section>
      <CTA title={t.home.ctaTitle} text={t.home.ctaText} btn={t.home.ctaBtn} />
    </>
  );
}
