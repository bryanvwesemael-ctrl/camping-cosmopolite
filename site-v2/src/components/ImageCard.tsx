import { Check } from 'lucide-react';
import { Icon } from './Icon';
import { useT } from '../i18n';
import type { Activity, RentalOption } from '../types';

// Foto-kaart met inzoom-effect op hover. Twee varianten: activiteit en huuroptie.
function Frame({ image, children }: { image: string; children: React.ReactNode }) {
  return (
    <div className="group h-full overflow-hidden rounded-xl2 bg-white shadow-card ring-1 ring-hairline/60 transition-all duration-300 hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-green-soft">
        <img src={image} alt="" loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
      </div>
      {children}
    </div>
  );
}

export function ActivityCard({ item }: { item: Activity }) {
  return (
    <Frame image={item.image}>
      <div className="p-6">
        <div className="mb-2 inline-flex items-center gap-2 text-green">
          <Icon name={item.icon} className="h-5 w-5" />
          <h3 className="font-head text-lg font-semibold text-ink">{item.title}</h3>
        </div>
        <p className="text-muted leading-relaxed">{item.text}</p>
      </div>
    </Frame>
  );
}

export function RentalCard({ item }: { item: RentalOption }) {
  const t = useT();
  return (
    <Frame image={item.image}>
      <div className="p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-head text-lg font-semibold text-ink">{item.name}</h3>
          {item.price && <span className="shrink-0 rounded-full bg-green-soft px-3 py-1 text-sm font-bold text-green">{item.price}<span className="font-medium text-green/70"> / {t.common.perNacht}</span></span>}
        </div>
        <p className="mt-2 text-muted leading-relaxed">{item.text}</p>
        <ul className="mt-4 space-y-1.5">
          {item.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-ink/80"><Check className="h-4 w-4 text-green shrink-0" aria-hidden="true" />{f}</li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}
