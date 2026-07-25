import { MapPin, Phone, Mail, Instagram } from 'lucide-react';
import { useT } from '../i18n';
import { SITE } from '../data/site';

// Contactkaarten (adres/telefoon/mail/instagram) — alles klikbaar.
export function ContactCard() {
  const t = useT();
  const rows = [
    { icon: MapPin, label: t.contact.adresLabel, value: t.contact.adres.join(', '), href: `https://www.google.com/maps/search/?api=1&query=${SITE.mapsQuery}` },
    { icon: Phone, label: t.contact.telLabel, value: SITE.tel, href: SITE.telHref },
    { icon: Mail, label: t.contact.emailLabel, value: SITE.email, href: `mailto:${SITE.email}` },
    { icon: Instagram, label: t.contact.instaLabel, value: `@${SITE.instagram}`, href: SITE.instagramUrl },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((r) => (
        <a key={r.label} href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noopener"
          className="group flex items-start gap-4 rounded-xl2 bg-white p-5 ring-1 ring-hairline/60 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-soft text-green group-hover:bg-green group-hover:text-white transition-colors">
            <r.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{r.label}</span>
            <span className="block font-medium text-ink break-words">{r.value}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
