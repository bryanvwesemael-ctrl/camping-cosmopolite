import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

interface Props {
  children: ReactNode; id?: string; className?: string; container?: boolean;
  eyebrow?: string; title?: string; sub?: string; center?: boolean;
}

// Sectie-wrapper met optionele kopregel (eyebrow + titel + subtitel).
export function Section({ children, id, className = '', container = true, eyebrow, title, sub, center }: Props) {
  const head = (eyebrow || title || sub) && (
    <Reveal className={`mb-10 ${center ? 'text-center mx-auto max-w-2xl' : 'max-w-2xl'}`}>
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      {title && <h2 className="h-display text-3xl sm:text-4xl leading-tight">{title}</h2>}
      {sub && <p className="mt-3 text-muted text-lg">{sub}</p>}
    </Reveal>
  );
  return (
    <section id={id} className={`py-16 sm:py-24 ${className}`}>
      {container ? <div className="container-x">{head}{children}</div> : <>{head}{children}</>}
    </section>
  );
}
