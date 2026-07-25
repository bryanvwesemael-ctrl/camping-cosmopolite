import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'white';
const STYLES: Record<Variant, string> = {
  primary: 'bg-green text-white hover:bg-green-dark shadow-soft',
  secondary: 'bg-white text-green ring-1 ring-green/20 hover:ring-green/40',
  ghost: 'bg-transparent text-ink hover:bg-black/5',
  white: 'bg-white/95 text-green hover:bg-white',
};
const base = 'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold transition-all duration-200 active:scale-[.98] focus-visible:outline-none';

interface Props { children: ReactNode; variant?: Variant; to?: string; href?: string; className?: string; onClick?: () => void; }

// Eén knop-component voor interne links (to), externe links (href) en acties.
export function Button({ children, variant = 'primary', to, href, className = '', onClick }: Props) {
  const cls = `${base} ${STYLES[variant]} ${className}`;
  if (href) return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener" className={cls} onClick={onClick}>{children}</a>;
  if (to) return <Link to={to} className={cls} onClick={onClick}>{children}</Link>;
  return <button type="button" className={cls} onClick={onClick}>{children}</button>;
}
