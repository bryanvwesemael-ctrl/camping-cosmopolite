import { Info } from 'lucide-react';
import { useT } from '../i18n';
import { Seo } from '../components/Seo';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { PriceCard } from '../components/PriceCard';
import { CTA } from '../components/CTA';

export default function Tarieven() {
  const t = useT();
  const p = t.tarieven;
  const verblijf = p.items.filter((i) => i.highlight);
  const personen = p.items.filter((i) => /volwassene|kind|baby|adulte|enfant|b[ée]b/i.test(i.label));
  const extra = p.items.filter((i) => !i.highlight && !personen.includes(i));

  const groep = (titel: string, items: typeof p.items) => (
    <div className="mb-10">
      <h2 className="h-display text-xl mb-4">{titel}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((it, i) => (<Reveal key={it.label} delay={i * 0.04}><PriceCard item={it} /></Reveal>))}
      </div>
    </div>
  );

  return (
    <>
      <Seo metaKey="tarieven" path="/tarieven" />
      <PageHeader eyebrow={p.eyebrow} title={p.title} intro={p.intro} />
      <Section>
        {groep(p.sectieVerblijf, verblijf)}
        {groep(p.sectiePersonen, personen)}
        {groep(p.sectieExtra, extra)}
        <div className="mx-auto mt-2 flex max-w-3xl items-start gap-2 rounded-xl2 bg-green-soft/60 p-4 text-sm text-muted">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-green" aria-hidden="true" />
          <span>{p.note}</span>
        </div>
      </Section>
      <CTA title={p.ctaTitle} text={p.ctaText} btn={t.common.reserveerNu} />
    </>
  );
}
