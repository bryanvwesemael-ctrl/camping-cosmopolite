import { Star } from 'lucide-react';
import type { Review } from '../types';

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${n} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < n ? 'fill-amber text-amber' : 'text-hairline'}`} aria-hidden="true" />
      ))}
    </div>
  );
}

export function ReviewCard({ item }: { item: Review }) {
  const initials = item.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <figure className="h-full rounded-xl2 bg-white p-6 shadow-card ring-1 ring-hairline/60">
      <Stars n={item.rating} />
      <blockquote className="mt-3 text-ink/90 leading-relaxed">“{item.text}”</blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-soft text-green font-semibold text-sm">{initials}</span>
        <span><span className="block font-semibold text-ink text-sm">{item.name}</span><span className="block text-xs text-muted">{item.location}</span></span>
      </figcaption>
    </figure>
  );
}
