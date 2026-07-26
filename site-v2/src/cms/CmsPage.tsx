import type { ReactNode } from 'react';
import { useCms, useCmsPagina } from './CmsProvider';
import { BlockList } from './BlockRenderer';
import { Seo } from '../components/Seo';
import type { useI18n } from '../i18n';

// Rendert een pagina uit de CMS (Karens sleep-blokken), premium gestyled.
// Zolang de CMS laadt: spinner. Heeft de pagina nog geen blokken (of is de
// CMS onbereikbaar): val terug op het handgemaakte premium ontwerp, zodat de
// site nooit leeg of stuk oogt.
type MetaKey = keyof ReturnType<typeof useI18n>['t']['meta'];

export function CmsPage({ slug, metaKey, path, fallback }: { slug: string; metaKey: MetaKey; path: string; fallback: ReactNode }) {
  const { loading, ready } = useCms();
  const pagina = useCmsPagina(slug);

  if (loading) {
    return <div className="min-h-[70vh] grid place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-green/20 border-t-green" aria-label="Laden" /></div>;
  }
  // CMS bereikbaar én pagina heeft inhoud → toon Karens blokken.
  if (ready && pagina && Array.isArray(pagina.blokken) && pagina.blokken.length > 0) {
    return (
      <>
        <Seo metaKey={metaKey} path={path} />
        <div className="pt-24 pb-16 sm:pt-28">
          <BlockList blokken={pagina.blokken} />
        </div>
      </>
    );
  }
  // Anders: het handgemaakte premium ontwerp.
  return <>{fallback}</>;
}
