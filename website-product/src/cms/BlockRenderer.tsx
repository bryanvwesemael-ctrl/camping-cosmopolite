import { ArrowRight, MapPin, Phone, Mail, Instagram } from 'lucide-react';
import { useSite, loc } from './SiteProvider';
import { Reveal } from '../components/Reveal';
import type { WbBlock } from './types';

// Rendert één klant-blok premium. Tekstvelden zijn taal-gecodeerd (Loc).
export function BlockRenderer({ block }: { block: WbBlock }) {
  const { site, lang } = useSite();
  const b = block as Record<string, unknown>;
  const L = (v: unknown) => loc(v as Record<string, string>, lang);

  const inner = (() => {
    switch (block.type) {
      case 'kop':
        return (
          <header className="relative overflow-hidden rounded-xl3 px-6 py-20 sm:py-28 text-center text-white shadow-lift bg-brand"
            style={b.foto ? { backgroundImage: `linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.52)),url(${b.foto as string})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
            <h1 className="font-head text-4xl sm:text-6xl font-bold tracking-tight">{L(b.titel)}</h1>
            {L(b.ondertitel) && <p className="mx-auto mt-4 max-w-2xl text-lg sm:text-xl text-white/90">{L(b.ondertitel)}</p>}
          </header>
        );
      case 'titel':
        return <h2 className="h-display text-3xl sm:text-4xl">{L(b.tekst)}</h2>;
      case 'tekst':
        return <div className="max-w-3xl text-lg leading-relaxed text-muted [&_a]:text-brand [&_a]:font-semibold [&_h3]:text-ink [&_h3]:font-head [&_h3]:text-xl [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6" dangerouslySetInnerHTML={{ __html: L(b.html) }} />;
      case 'foto':
        return b.url ? <figure className="overflow-hidden rounded-xl3 shadow-lift"><img src={b.url as string} alt={L(b.bijschrift)} loading="lazy" className="w-full object-cover" />{L(b.bijschrift) && <figcaption className="mt-2 text-center text-sm text-muted">{L(b.bijschrift)}</figcaption>}</figure> : null;
      case 'galerij':
        return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">{((b.urls as string[]) || []).map((u, i) => (<div key={i} className="overflow-hidden rounded-xl2" style={{ background: 'var(--brand-soft)' }}><img src={u} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform duration-700 hover:scale-105" /></div>))}</div>;
      case 'kaarten':
        return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{((b.items as Record<string, unknown>[]) || []).map((it, i) => (
          <div key={i} className="rounded-xl2 bg-white p-7 shadow-card ring-1 ring-hairline/60">
            <div className="mb-3 text-3xl">{(it.emoji as string) || '•'}</div>
            <h3 className="font-head text-lg font-semibold">{L(it.titel)}</h3>
            <p className="mt-2 text-muted leading-relaxed">{L(it.tekst)}</p>
          </div>))}</div>;
      case 'knop':
        return <div className="text-center"><a href={(b.url as string) || site?.reserveer_url || '#'} target={((b.url as string) || '').startsWith('http') ? '_blank' : undefined} rel="noopener"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-4 text-base font-semibold text-white hover:bg-brand-dark transition-colors shadow-card">{L(b.tekst)} <ArrowRight className="h-5 w-5" aria-hidden="true" /></a></div>;
      case 'contact': {
        const c = site?.contact || {};
        const rows = [
          c.adres && { icon: MapPin, v: c.adres, href: c.maps_query ? `https://www.google.com/maps/search/?api=1&query=${c.maps_query}` : undefined },
          c.tel && { icon: Phone, v: c.tel, href: `tel:${c.tel.replace(/\s/g, '')}` },
          c.email && { icon: Mail, v: c.email, href: `mailto:${c.email}` },
          c.instagram && { icon: Instagram, v: `@${c.instagram}`, href: `https://instagram.com/${c.instagram}` },
        ].filter(Boolean) as { icon: typeof MapPin; v: string; href?: string }[];
        return <div className="grid gap-4 sm:grid-cols-2">{rows.map((r, i) => (
          <a key={i} href={r.href} target={r.href?.startsWith('http') ? '_blank' : undefined} rel="noopener" className="flex items-center gap-4 rounded-xl2 bg-white p-5 ring-1 ring-hairline/60 shadow-card hover:shadow-lift transition-shadow">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-brand" style={{ background: 'var(--brand-soft)' }}><r.icon className="h-5 w-5" aria-hidden="true" /></span>
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
  return <Reveal className="container-x">{flush ? inner : <div className="mx-auto max-w-content">{inner}</div>}</Reveal>;
}

export function BlockList({ blokken }: { blokken: WbBlock[] }) {
  return <div className="flex flex-col gap-10 sm:gap-14 py-10 sm:py-14">{(blokken || []).map((b, i) => <BlockRenderer key={i} block={b} />)}</div>;
}
