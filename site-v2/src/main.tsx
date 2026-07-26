import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { LanguageProvider } from './i18n';
import { CmsProvider } from './cms/CmsProvider';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <LanguageProvider>
        <CmsProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </CmsProvider>
      </LanguageProvider>
    </HelmetProvider>
  </StrictMode>,
);
