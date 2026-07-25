import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { FaqItem } from '../types';

// Toegankelijke accordion (button + aria-expanded), met soepele hoogte-animatie.
export function FAQ({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl divide-y divide-hairline rounded-xl2 bg-white ring-1 ring-hairline/60">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
              <span className="font-medium text-ink">{it.q}</span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-green transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: 'easeInOut' }} className="overflow-hidden">
                  <p className="px-5 pb-5 text-muted leading-relaxed">{it.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
