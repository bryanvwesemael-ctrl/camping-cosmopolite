import { useT } from '../i18n';
import { Seo } from '../components/Seo';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { ContactCard } from '../components/ContactCard';
import { SITE } from '../data/site';

export default function Contact() {
  const t = useT();
  const c = t.contact;
  return (
    <>
      <Seo metaKey="contact" path="/contact" />
      <PageHeader eyebrow={c.eyebrow} title={c.title} intro={c.intro} />
      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal><ContactCard /></Reveal>
          <Reveal delay={0.1}>
            <h2 className="h-display text-xl mb-4">{c.mapTitle}</h2>
            <div className="overflow-hidden rounded-xl3 shadow-lift ring-1 ring-hairline">
              <iframe
                title={c.mapTitle}
                src={`https://www.google.com/maps?q=${SITE.mapsQuery}&output=embed`}
                className="h-[380px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
