// Vaste site-configuratie. De reserveerknoppen wijzen naar het bestaande
// externe reserveringsformulier — deze site verwerkt zelf GEEN reservaties.
export const SITE = {
  reserveUrl: 'https://camping-cosmopolite.netlify.app/reserveren',
  baseUrl: 'https://camping-cosmopolite.netlify.app',
  tel: '+32 474 95 19 06',
  telHref: 'tel:+32474951906',
  email: 'karen.campingcosmopolite@gmail.com',
  instagram: 'domein_cosmopolite_',
  instagramUrl: 'https://instagram.com/domein_cosmopolite_',
  adres: 'Rue Vecpré 66A, 6980 La Roche-en-Ardenne, België',
  mapsQuery: 'Rue+Vecpr%C3%A9+66A,+6980+La+Roche-en-Ardenne,+Belgi%C3%AB',
};

// Routes centraal — makkelijk uit te breiden (blog, evenementen, ... later).
export const ROUTES = [
  { path: '/', key: 'home' },
  { path: '/activiteiten', key: 'activiteiten' },
  { path: '/huuropties', key: 'huuropties' },
  { path: '/scoutsweide', key: 'scoutsweide' },
  { path: '/tarieven', key: 'tarieven' },
  { path: '/contact', key: 'contact' },
  { path: '/over-ons', key: 'overons' },
] as const;
