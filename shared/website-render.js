/* ============================================================================
 * Camping Cosmopolite — WEBSITE-RENDERER (gedeeld)
 * ----------------------------------------------------------------------------
 * Zet een lijst "blokken" (widgets) om naar HTML. Bewust dependency-loos en
 * puur (geen DOM-toegang), zodat exact dezelfde functie zowel de PUBLIEKE
 * website als de LIVE PREVIEW in Karens bouwer aanstuurt — één bron, dus de
 * preview kan nooit afwijken van wat de bezoeker ziet.
 *
 * Elk blok is tweetalig: tekstvelden bestaan als <veld>_nl en <veld>_fr.
 * lang = 'nl' | 'fr' bepaalt welke getoond wordt (met NL als terugval).
 *
 * ctx (optioneel) levert dynamische data:
 *   ctx.prices     — tarievenobject (zelfde vorm als CampingPricing) voor het
 *                    'tarieven'-blok
 *   ctx.accTypes   — eigen verblijfstypes voor het 'tarieven'-blok
 * ========================================================================== */
(function (root) {
  'use strict';

  var CONTACT = {
    adres: 'Rue Vecpré 66A, 6980 La Roche-en-Ardenne',
    tel: '+32 474 95 19 06',
    email: 'karen.campingcosmopolite@gmail.com',
    instagram: 'domein_cosmopolite_'
  };

  var I18N = {
    nl: { tarief: 'Tarief', per_nacht: 'per nacht', tent: 'Tent', camper: 'Camper / Caravan',
      volwassene: 'Volwassene', kind: 'Kind (3–11 j)', baby: 'Baby (<3 j)', hond: 'Hond',
      extra_auto: 'Extra auto', elektriciteit: 'Elektriciteit', afval: 'Afvalbijdrage',
      toeristentaks: 'Toeristentaks', gratis: 'gratis', bel: 'Bel', mail: 'Mail', volg: 'Volg ons' },
    fr: { tarief: 'Tarif', per_nacht: 'par nuit', tent: 'Tente', camper: 'Camping-car / Caravane',
      volwassene: 'Adulte', kind: 'Enfant (3–11 a)', baby: 'Bébé (<3 a)', hond: 'Chien',
      extra_auto: 'Voiture suppl.', elektriciteit: 'Électricité', afval: 'Contribution déchets',
      toeristentaks: 'Taxe de séjour', gratis: 'gratuit', bel: 'Appeler', mail: 'E-mail', volg: 'Suivez-nous' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Tweetalig tekstveld ophalen, met NL als terugval zodat een nog niet
  // vertaald FR-veld toch iets toont i.p.v. leeg.
  function tv(b, veld, lang) { return b[veld + '_' + lang] || b[veld + '_nl'] || ''; }
  function money(n) { return '€ ' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ','); }

  function tarievenTabel(lang, ctx) {
    var L = I18N[lang] || I18N.nl;
    var p = (ctx && ctx.prices) || {};
    var rows = [
      ['🏕️', L.tent, p.tent], ['🚐', L.camper, p.camper],
      ['🧑', L.volwassene, p.volwassene], ['🧒', L.kind, p.kind],
      ['👶', L.baby, p.baby], ['🐕', L.hond, p.hond],
      ['🚗', L.extra_auto, p.extraAuto], ['⚡', L.elektriciteit, p.elektriciteit],
      ['♻️', L.afval, p.afvalPer6], ['🏛️', L.toeristentaks, p.toeristentaks]
    ];
    (ctx && ctx.accTypes ? ctx.accTypes : []).forEach(function (t) {
      if (t && t.naam) rows.push([t.emoji || '🏕️', t.naam, t.prijs]);
    });
    var body = rows.map(function (r) {
      var prijs = (r[2] === 0 || r[2] === '0') ? L.gratis : money(r[2]);
      return '<tr><td class="cw-tar-l">' + esc(r[0]) + ' ' + esc(r[1]) + '</td>' +
        '<td class="cw-tar-r">' + prijs + '</td></tr>';
    }).join('');
    return '<div class="cw-tarieven"><table><thead><tr><th>' + esc(L.tarief) +
      '</th><th>' + esc(L.per_nacht) + '</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function renderBlok(b, lang, ctx) {
    if (!b || !b.type) return '';
    switch (b.type) {
      case 'kop': {
        var stijl = b.foto ? ' style="background-image:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.45)),url(' + esc(b.foto) + ')"' : '';
        return '<header class="cw-hero' + (b.foto ? ' cw-hero-foto' : '') + '"' + stijl + '>' +
          '<h1>' + esc(tv(b, 'titel', lang)) + '</h1>' +
          (tv(b, 'ondertitel', lang) ? '<p>' + esc(tv(b, 'ondertitel', lang)) + '</p>' : '') +
          '</header>';
      }
      case 'titel':
        return '<h2 class="cw-titel">' + esc(tv(b, 'tekst', lang)) + '</h2>';
      case 'tekst':
        // Door de admin geschreven rijke tekst — bewust als HTML gerenderd.
        return '<div class="cw-tekst">' + (tv(b, 'html', lang) || '') + '</div>';
      case 'foto':
        return b.url ? '<figure class="cw-foto"><img src="' + esc(b.url) + '" alt="' + esc(tv(b, 'bijschrift', lang)) + '" loading="lazy">' +
          (tv(b, 'bijschrift', lang) ? '<figcaption>' + esc(tv(b, 'bijschrift', lang)) + '</figcaption>' : '') + '</figure>' : '';
      case 'galerij':
        return '<div class="cw-galerij">' + (b.urls || []).map(function (u) {
          return '<img src="' + esc(u) + '" alt="" loading="lazy">';
        }).join('') + '</div>';
      case 'kaarten':
        return '<div class="cw-kaarten">' + (b.items || []).map(function (it) {
          return '<div class="cw-kaart"><div class="cw-kaart-emoji">' + esc(it.emoji || '•') + '</div>' +
            '<div class="cw-kaart-titel">' + esc(tv(it, 'titel', lang)) + '</div>' +
            '<div class="cw-kaart-tekst">' + esc(tv(it, 'tekst', lang)) + '</div></div>';
        }).join('') + '</div>';
      case 'knop':
        return '<div class="cw-knop-wrap"><a class="cw-knop" href="' + esc(b.url || '#') + '">' + esc(tv(b, 'tekst', lang)) + '</a></div>';
      case 'tarieven':
        return tarievenTabel(lang, ctx);
      case 'nieuws':
        return '<div class="cw-nieuws">' + (b.items || []).map(function (it) {
          return '<div class="cw-nieuws-item">' + (it.datum ? '<div class="cw-nieuws-datum">' + esc(it.datum) + '</div>' : '') +
            '<div class="cw-nieuws-titel">' + esc(tv(it, 'titel', lang)) + '</div>' +
            '<div class="cw-nieuws-tekst">' + esc(tv(it, 'tekst', lang)) + '</div></div>';
        }).join('') + '</div>';
      case 'contact': {
        var L = I18N[lang] || I18N.nl;
        var adres = b.adres || CONTACT.adres, tel = b.tel || CONTACT.tel,
          email = b.email || CONTACT.email, insta = b.instagram || CONTACT.instagram;
        return '<div class="cw-contact">' +
          '<div class="cw-contact-rij">📍 <span>' + esc(adres) + '</span></div>' +
          '<div class="cw-contact-rij">📞 <a href="tel:' + esc(tel.replace(/\s/g, '')) + '">' + esc(tel) + '</a></div>' +
          '<div class="cw-contact-rij">✉️ <a href="mailto:' + esc(email) + '">' + esc(email) + '</a></div>' +
          (insta ? '<div class="cw-contact-rij">📷 <a href="https://instagram.com/' + esc(insta) + '" target="_blank" rel="noopener">@' + esc(insta) + '</a></div>' : '') +
          '</div>';
      }
      case 'ruimte':
        return '<div class="cw-ruimte"></div>';
      default:
        return '';
    }
  }

  function renderPagina(blokken, lang, ctx) {
    return (blokken || []).map(function (b) { return renderBlok(b, lang, ctx); }).join('');
  }

  root.CampingWebsite = { renderBlok: renderBlok, renderPagina: renderPagina, CONTACT: CONTACT, I18N: I18N };
})(typeof window !== 'undefined' ? window : globalThis);
