// Alle beeld-URL's centraal — zo kan Karen/Bryan ze later in één bestand
// vervangen door echte camping-foto's (of, na CMS-koppeling, uit Supabase).
// Voorlopig deterministische placeholders (picsum) die altijd laden en al
// een natuur/rivier-sfeer geven.
const P = (seed: string, w = 1200, h = 800) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const IMG = {
  hero: P('cosmopolite-ardennen-rivier', 1920, 1080),
  domein: P('cosmopolite-domein-weide', 1200, 900),
  scouts: P('cosmopolite-groepsweide', 1400, 900),
  about1: P('cosmopolite-ourthe-ochtend', 1200, 900),
  about2: P('cosmopolite-kampvuur-avond', 1000, 800),
  rentals: {
    tent: P('cosmopolite-tent', 900, 700),
    caravan: P('cosmopolite-caravan', 900, 700),
    camper: P('cosmopolite-camper', 900, 700),
    safaritent: P('cosmopolite-safaritent', 900, 700),
    stacaravan: P('cosmopolite-stacaravan', 900, 700),
  },
  activiteiten: {
    zwemmen: P('cosmopolite-zwemmen-rivier', 900, 700),
    wandelen: P('cosmopolite-wandelen-bos', 900, 700),
    fietsen: P('cosmopolite-fietsen-ardennen', 900, 700),
    kajak: P('cosmopolite-kajak-ourthe', 900, 700),
    vissen: P('cosmopolite-vissen', 900, 700),
  },
  gallery: [
    P('cosmopolite-g1', 800, 600), P('cosmopolite-g2', 800, 600),
    P('cosmopolite-g3', 800, 600), P('cosmopolite-g4', 800, 600),
    P('cosmopolite-g5', 800, 600), P('cosmopolite-g6', 800, 600),
  ],
};
