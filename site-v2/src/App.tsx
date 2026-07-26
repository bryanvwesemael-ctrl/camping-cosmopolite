import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SiteLayout } from './layouts/SiteLayout';
import { ScrollToTop } from './components/ScrollToTop';
import { CmsPage } from './cms/CmsPage';

// Elke pagina wordt lui geladen (code-splitting). De CmsPage-wrapper toont
// Karens CMS-blokken indien aanwezig, en valt anders terug op het handgemaakte
// premium ontwerp — zo is de site altijd mooi én volledig door Karen bewerkbaar.
const Home = lazy(() => import('./pages/Home'));
const Activiteiten = lazy(() => import('./pages/Activiteiten'));
const Huuropties = lazy(() => import('./pages/Huuropties'));
const Scoutsweide = lazy(() => import('./pages/Scoutsweide'));
const Tarieven = lazy(() => import('./pages/Tarieven'));
const Contact = lazy(() => import('./pages/Contact'));
const OverOns = lazy(() => import('./pages/OverOns'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <SiteLayout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<CmsPage slug="home" metaKey="home" path="/" fallback={<Home />} />} />
        <Route path="/activiteiten" element={<CmsPage slug="activiteiten" metaKey="activiteiten" path="/activiteiten" fallback={<Activiteiten />} />} />
        <Route path="/huuropties" element={<CmsPage slug="huuropties" metaKey="huuropties" path="/huuropties" fallback={<Huuropties />} />} />
        <Route path="/scoutsweide" element={<CmsPage slug="scoutsweide" metaKey="scoutsweide" path="/scoutsweide" fallback={<Scoutsweide />} />} />
        <Route path="/tarieven" element={<CmsPage slug="tarieven" metaKey="tarieven" path="/tarieven" fallback={<Tarieven />} />} />
        <Route path="/contact" element={<CmsPage slug="contact" metaKey="contact" path="/contact" fallback={<Contact />} />} />
        <Route path="/over-ons" element={<CmsPage slug="overons" metaKey="overons" path="/over-ons" fallback={<OverOns />} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SiteLayout>
  );
}
