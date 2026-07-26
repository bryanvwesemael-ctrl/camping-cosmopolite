import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { SiteProvider } from './cms/SiteProvider';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <SiteProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SiteProvider>
    </HelmetProvider>
  </StrictMode>,
);
