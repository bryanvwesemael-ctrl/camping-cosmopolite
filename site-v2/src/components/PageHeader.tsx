import { Reveal } from './Reveal';

// Compacte pagina-kop voor de binnenpagina's (onder de vaste navbar).
export function PageHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <section className="bg-green-soft/50 pt-28 sm:pt-36 pb-14">
      <div className="container-x">
        <Reveal className="max-w-3xl">
          <p className="eyebrow mb-2">{eyebrow}</p>
          <h1 className="h-display text-4xl sm:text-5xl leading-tight">{title}</h1>
          <p className="mt-4 text-lg text-muted">{intro}</p>
        </Reveal>
      </div>
    </section>
  );
}
