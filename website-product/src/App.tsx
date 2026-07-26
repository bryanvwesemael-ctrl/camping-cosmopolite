import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useSite, loc } from './cms/SiteProvider';
import { BlockList } from './cms/BlockRenderer';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import type { WbPagina } from './cms/types';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function PageView({ pagina }: { pagina: WbPagina }) {
  const { site, lang } = useSite();
  return (
    <>
      <Helmet><title>{loc(pagina.titel, lang)} — {site?.naam}</title></Helmet>
      <div className="pt-20 sm:pt-24"><BlockList blokken={pagina.blokken} /></div>
    </>
  );
}

export default function App() {
  const { site, paginas, loading, error } = useSite();

  if (loading) return <div className="min-h-screen grid place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand/20 border-t-brand" aria-label="Laden" /></div>;
  if (error || !site) return <div className="min-h-screen grid place-items-center p-6 text-center"><div><p className="font-head text-2xl font-bold text-ink">Website niet gevonden</p><p className="mt-2 text-muted">{error || 'Onbekende fout'}</p></div></div>;

  const home = paginas.find((p) => p.slug === 'home') || paginas[0];
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollTop />
      <Navbar />
      <main className="flex-1">
        <Routes>
          {home && <Route path="/" element={<PageView pagina={home} />} />}
          {paginas.filter((p) => p.slug !== 'home').map((p) => (
            <Route key={p.slug} path={'/' + p.slug} element={<PageView pagina={p} />} />
          ))}
          <Route path="*" element={home ? <PageView pagina={home} /> : null} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
