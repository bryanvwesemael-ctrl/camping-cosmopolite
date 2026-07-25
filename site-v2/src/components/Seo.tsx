import { Helmet } from 'react-helmet-async';
import { useI18n } from '../i18n';
import { SITE } from '../data/site';
import { IMG } from '../data/images';

// Per-pagina SEO: title, description, canonical, hreflang, Open Graph, Twitter
// en Schema.org LocalBusiness. Eén component, hergebruikt op elke pagina.
export function Seo({ metaKey, path }: { metaKey: keyof ReturnType<typeof useI18n>['t']['meta']; path: string }) {
  const { t, lang } = useI18n();
  const meta = t.meta[metaKey];
  const url = SITE.baseUrl + path;
  const schema = {
    '@context': 'https://schema.org', '@type': 'Campground',
    name: 'Camping Cosmopolite',
    description: meta.description,
    address: { '@type': 'PostalAddress', streetAddress: 'Rue Vecpré 66A', postalCode: '6980', addressLocality: 'La Roche-en-Ardenne', addressCountry: 'BE' },
    telephone: SITE.tel, email: SITE.email, url: SITE.baseUrl,
    image: IMG.hero, priceRange: '€€',
    sameAs: [SITE.instagramUrl],
  };
  return (
    <Helmet>
      <html lang={lang} />
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Camping Cosmopolite" />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={IMG.hero} />
      <meta property="og:locale" content={lang === 'fr' ? 'fr_BE' : 'nl_BE'} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={IMG.hero} />
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}
