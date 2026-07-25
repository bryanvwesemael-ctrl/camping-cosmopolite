import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SiteLayout } from './layouts/SiteLayout';
import { ScrollToTop } from './components/ScrollToTop';

// Code-splitting: elke pagina wordt lui geladen (React.lazy + Suspense in de
// layout) → kleinere initiële bundel, betere Lighthouse-score.
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
        <Route path="/" element={<Home />} />
        <Route path="/activiteiten" element={<Activiteiten />} />
        <Route path="/huuropties" element={<Huuropties />} />
        <Route path="/scoutsweide" element={<Scoutsweide />} />
        <Route path="/tarieven" element={<Tarieven />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/over-ons" element={<OverOns />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SiteLayout>
  );
}
