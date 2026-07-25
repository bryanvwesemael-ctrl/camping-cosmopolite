import { Icon } from './Icon';
import type { Feature } from '../types';

// Generieke info-kaart (feature) met icoon, titel en tekst.
export function Card({ item }: { item: Feature }) {
  return (
    <div className="group h-full rounded-xl2 bg-white p-7 shadow-card ring-1 ring-hairline/60 transition-all duration-300 hover:shadow-lift hover:-translate-y-1">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-green-soft text-green transition-colors group-hover:bg-green group-hover:text-white">
        <Icon name={item.icon} className="h-6 w-6" />
      </div>
      <h3 className="font-head text-lg font-semibold text-ink">{item.title}</h3>
      <p className="mt-2 text-muted leading-relaxed">{item.text}</p>
    </div>
  );
}
