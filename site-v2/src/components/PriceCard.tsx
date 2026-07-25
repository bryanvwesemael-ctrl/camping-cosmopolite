import { Icon } from './Icon';
import { useT } from '../i18n';
import type { PriceItem } from '../types';

// Premium prijskaart i.p.v. een kale tabel. Uitgelichte items (verblijf)
// krijgen een groen accent.
export function PriceCard({ item }: { item: PriceItem }) {
  const t = useT();
  const gratis = /gratis|gratuit/i.test(item.price);
  return (
    <div className={`flex items-center gap-4 rounded-xl2 bg-white p-5 ring-1 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card ${item.highlight ? 'ring-green/25 shadow-card' : 'ring-hairline/70'}`}>
      <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.highlight ? 'bg-green text-white' : 'bg-green-soft text-green'}`}>
        <Icon name={item.icon} className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink">{item.label}</div>
        <div className="text-xs text-muted">{t.common.perNacht}</div>
      </div>
      <div className={`shrink-0 font-head text-xl font-bold ${gratis ? 'text-green' : 'text-ink'}`}>{item.price}</div>
    </div>
  );
}
