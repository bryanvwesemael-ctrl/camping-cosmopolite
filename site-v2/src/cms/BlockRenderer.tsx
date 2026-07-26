import { ArrowRight, MapPin, Phone, Mail, Instagram } from 'lucide-react';
import { useI18n } from '../i18n';
import { useCms } from './CmsProvider';
import { Reveal } from '../components/Reveal';
import { SITE } from '../data/site';
import type { CmsBlock, Prices, AccType } from './types';

// Rendert één CMS-blok (widget) met premium opmaak. Tweetalig: velden bestaan
// als …_nl / …_fr; we tonen de actieve taal met NL als terugval.
function useTv() {
  const { lang } = useI18n();
  return (b: Record<string, unknown>, veld: string) =>
    (b[`${veld}_${lang}`] as string) || (b[`${veld}_nl`] as string) || '';
}

function money(n?: number) {
  if (n == null || isNaN(n)) return '';
  return '€ ' + (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
}

function Tarieven({ prices, accTypes }: { prices: Prices; accTypes: AccType[] }) {
  const { t } = useI18n();
  const rows: { emoji: string; label: string; val?: number; free?: boolean }[] = [
    { emoji: '🏕️', label: t.tarieven.items[0].label, val: prices.tent },
    { emoji: '🚐', label: t.tarieven.items[1].label, val: prices.camper },
    { emoji: '🧑', label: t.tarieven.items[4].label, val: prices.volwassene },
    { emoji: '🧒', label: t.tarieven.items[5].label, val: prices.kind },
    { emoji: '👶', label: t.tarieven.items[6].label, free: true },
    { emoji: '🐕', label: t.tarieven.items[7].label, val: prices.hond },
    { emoji: '🚗', label: t.tarieven.items[8].label, val: prices.extraAuto },
    { emoji: '⚡', label: t.tarieven.items[9].label, val: prices.elektriciteit },
    { emoji: '♻️', label: t.tarieven.items[10].label, val: prices.afvalPer6 },
    { emoji: '🏛️', label: t.tarieven.items[11].label, val: prices.toeristentaks },
  ];
  accTypes.forEach((a) => { if (a?.naam) rows.push({ emoji: a.emoji || '🏕️', label: a.naam, val: a.prijs }); });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl2 bg-white p-5 ring-1 ring-hairline/70 shadow-card">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-soft text-xl">{r.emoji}</div>
          <div className="min-w-0 flex-1"><div className="font-medium text-ink">{r.label}</div><div className="text-xs text-muted">{t.common.perNacht}</div></div>
          <div className="shrink-0 font-head text-lg font-bold text-ink">{r.free ? t.common.gratis : money(r.val)}</div>
        </div>
      ))}
    </div>
  );
}

export function BlockRenderer({ block }: { block: CmsBlock }) {
  const tv = useTv();
  const { lang } = useI18n();
  const { prices, accTypes } = useCms();
  const b = block as Record<string, unknown>;

  const inner = (() => {
    switch (block.type) {
      case 'kop':
        return (
          <header className="relative overflow-hidden rounded-xl3 px-6 py-16 sm:py-24 text-center text-white shadow-lift bg-green"
            style={b.foto ? { backgroundImage: `linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.5)),url(${b.foto as string})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
            <h1 className="font-head text-4xl sm:text-5xl font-bold">{tv(b, 'titel')}</h1>
            {tv(b, 'ondertitel') && <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">{tv(b, 'ondertitel')}</p>}
          </header>
        );
      case 'titel':
        return <h2 className="h-display text-3xl sm:text-4xl">{tv(b, 'tekst')}</h2>;
      case 'tekst':
        return <div className="prose-cms max-w-3xl text-lg leading-relaxed text-muted [&_a]:text-green [&_a]:font-semibold [&_h3]:text-ink [&_h3]:font-head [&_h3]:text-xl [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_p]:mb-3" dangerouslySetInnerHTML={{ __html: (b[`html_${lang}`] as string) || (b.html_nl as string) || '' }} />;
      case 'foto':
        return b.url ? (
          <figure className="overflow-hidden rounded-xl3 shadow-lift"><img src={b.url as string} alt={tv(b, 'bijschrift')} loading="lazy" className="w-full object-cover" />
            {tv(b, 'bijschrift') && <figcaption className="mt-2 text-center text-sm text-muted">{tv(b, 'bijschrift')}</figcaption>}</figure>
        ) : null;
      case 'galerij':
        return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">{((b.urls as string[]) || []).map((u, i) => (
          <div key={i} className="overflow-hidden rounded-xl2 bg-green-soft"><img src={u} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform duration-700 hover:scale-105" /></div>))}</div>;
      case 'kaarten':
        return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{((b.items as Record<string, unknown>[]) || []).map((it, i) => (
          <div key={i} className="rounded-xl2 bg-white p-7 shadow-card ring-1 ring-hairline/60">
            <div className="mb-3 text-3xl">{(it.emoji as string) || '•'}</div>
            <h3 className="font-head text-lg font-semibold">{tv(it, 'titel')}</h3>
            <p className="mt-2 text-muted leading-relaxed">{tv(it, 'tekst')}</p>
          </div>))}</div>;
      case 'nieuws':
        return <div className="grid gap-4">{((b.items as Record<string, unknown>[]) || []).map((it, i) => (
          <div key={i} className="rounded-xl2 border-l-4 border-amber bg-white p-5 shadow-card ring-1 ring-hairline/60">
            {it.datum ? <div className="text-xs font-bold uppercase tracking-wide text-amber">{it.datum as string}</div> : null}
            <div className="mt-0.5 font-head text-lg font-semibold">{tv(it, 'titel')}</div>
            <p className="mt-1 text-muted">{tv(it, 'tekst')}</p>
          </div>))}</div>;
      case 'knop':
        return <div className="text-center"><a href={(b.url as string) || SITE.reserveUrl} target={((b.url as string) || '').startsWith('http') ? '_blank' : undefined} rel="noopener"
          className="inline-flex items-center gap-2 rounded-full bg-green px-8 py-4 text-base font-semibold text-white hover:bg-green-dark transition-colors shadow-soft">{tv(b, 'tekst')} <ArrowRight className="h-5 w-5" aria-hidden="true" /></a></div>;
      case 'tarieven':
        return <Tarieven prices={prices} accTypes={accTypes} />;
      case 'contact': {
        const adres = (b.adres as string) || SITE.adres, tel = (b.tel as string) || SITE.tel,
          email = (b.email as string) || SITE.email, insta = (b.instagram as string) || SITE.instagram;
        const rows = [
          { icon: MapPin, v: adres, href: `https://www.google.com/maps/search/?api=1&query=${SITE.mapsQuery}` },
          { icon: Phone, v: tel, href: `tel:${tel.replace(/\s/g, '')}` },
          { icon: Mail, v: email, href: `mailto:${email}` },
          { icon: Instagram, v: `@${insta}`, href: `https://instagram.com/${insta}` },
        ];
        return <div className="grid gap-4 sm:grid-cols-2">{rows.map((r, i) => (
          <a key={i} href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noopener" className="flex items-center gap-4 rounded-xl2 bg-white p-5 ring-1 ring-hairline/60 shadow-card hover:shadow-lift transition-shadow">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-soft text-green"><r.icon className="h-5 w-5" aria-hidden="true" /></span>
            <span className="min-w-0 font-medium text-ink break-words">{r.v}</span></a>))}</div>;
      }
      case 'ruimte':
        return <div className="h-6" />;
      default:
        return null;
    }
  })();

  if (inner == null) return null;
  const flush = block.type === 'kop';
  return <Reveal className={flush ? '' : 'container-x'}>{flush ? inner : <div className="mx-auto max-w-content">{inner}</div>}</Reveal>;
}

export function BlockList({ blokken }: { blokken: CmsBlock[] }) {
  return (
    <div className="flex flex-col gap-10 sm:gap-14">
      {(blokken || []).map((b, i) => <BlockRenderer key={i} block={b} />)}
    </div>
  );
}
