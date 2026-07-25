import { Suspense, type ReactNode } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

// Vaste schil rond elke pagina: navbar boven, footer onder, met een nette
// laadstatus terwijl lazy-geladen pagina's binnenkomen.
function Loader() {
  return <div className="min-h-[60vh] grid place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-green/20 border-t-green" aria-label="Laden" /></div>;
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1"><Suspense fallback={<Loader />}>{children}</Suspense></main>
      <Footer />
    </div>
  );
}
