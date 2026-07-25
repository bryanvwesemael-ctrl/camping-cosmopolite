import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Bij elke paginawissel terug naar boven scrollen (behalve bij anker-links).
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [pathname, hash]);
  return null;
}
