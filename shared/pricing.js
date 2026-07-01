/* ============================================================================
 * Camping Cosmopolite — CENTRALE PRIJSBEREKENING (single source of truth)
 * ----------------------------------------------------------------------------
 * Dit bestand is de ENIGE plek waar de prijslogica leeft. Zowel het publieke
 * reservatieformulier (index.html) als het beheerdashboard (dashboard/app.js)
 * gebruiken exact deze functie. Zo kan de berekening nooit meer uiteenlopen.
 *
 * Werkt zowel in de browser (window.CampingPricing) als in Node (module.exports)
 * zodat er unit-tests op kunnen draaien.
 *
 * Belangrijke regels (bevestigd met bestaande implementatie):
 *  - Prijzen zijn INCLUSIEF 12% BTW op campingdiensten → BTW wordt geëxtraheerd
 *    (×12/112), niet bovenop gerekend.
 *  - Toeristentaks is BTW-vrij en komt apart bovenop (€1 / volwassene / nacht).
 *  - Volwassene = persoonsprijs (€7) + toeristentaks (€1) = €8 effectief/nacht.
 *  - Elektriciteit en afval worden PER NACHT aangerekend.
 *  - Afval: t/m 6 personen €2/nacht, daarna +€2/nacht per begonnen schijf van 2.
 *  - 1e auto gratis, elke volgende auto €2/nacht.
 *  - Baby's zijn gratis (tenzij prijs_baby > 0).
 *  - All-in eenheden (bv. backpacker): typeprijs dekt personen + afval.
 *  - Aantal nachten = vertrekdatum − aankomstdatum (vertrekdag telt niet mee).
 * ========================================================================== */
(function (root) {
  'use strict';

  // Standaardtarieven — fallback wanneer de DB (settings) nog niet geladen is.
  // De ACTUELE tarieven worden altijd uit Supabase (tabel settings) gehaald en
  // over deze defaults gekopieerd; deze waarden zijn enkel een vangnet.
  var DEFAULTS = {
    tent: 15,
    camper: 15,
    volwassene: 7,
    kind: 5,
    baby: 0,
    hond: 3,
    extraAuto: 2,
    elektriciteit: 6,
    afvalPer6: 2,
    toeristentaks: 1,
    waarborg: 0,
  };

  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function nightsBetween(aankomst, vertrek) {
    if (!aankomst || !vertrek) return 0;
    // Datum-only parsing (geen tijdzone-drift): we vergelijken kalenderdagen.
    var a = new Date(aankomst + 'T00:00:00');
    var v = new Date(vertrek + 'T00:00:00');
    if (isNaN(a) || isNaN(v)) return 0;
    var diff = Math.round((v - a) / 86400000);
    return diff > 0 ? diff : 0;
  }

  /**
   * Centrale berekening.
   * @param {Object} input
   *   prices         {Object}  actuele tarieven (defaults als ontbreekt)
   *   units          {Array}   [{prijs, count, allIn}]  alle standplaatsen/types
   *   volwassenen    {number}
   *   kinderen       {number}  (3–11 jaar)
   *   baby           {number}  (<3 jaar)
   *   honden         {number}
   *   autos          {number}  totaal aantal auto's (1e gratis)
   *   elektriciteit  {boolean}
   *   nights         {number}  aantal nachten (of geef aankomst+vertrek)
   *   aankomst       {string}  YYYY-MM-DD (optioneel, ipv nights)
   *   vertrek        {string}  YYYY-MM-DD (optioneel, ipv nights)
   *   extraTarieven  {Array}   vrije kostenposten [{naam,prijs,categorie,perNacht}]
   * @returns {Object} volledige, afgeronde prijsopbouw
   */
  function calc(input) {
    input = input || {};
    var P = Object.assign({}, DEFAULTS, input.prices || {});

    var nights = input.nights != null
      ? Math.max(parseInt(input.nights, 10) || 0, 0)
      : nightsBetween(input.aankomst, input.vertrek);

    var units = Array.isArray(input.units) ? input.units : [];
    var eenheden = units.reduce(function (s, u) { return s + (u.count || 0); }, 0);
    var basis = units.reduce(function (s, u) { return s + (u.count || 0) * (parseFloat(u.prijs) || 0); }, 0);

    var allInCount = units.filter(function (u) { return u.allIn; })
      .reduce(function (s, u) { return s + (u.count || 0); }, 0);
    var normaalCount = units.filter(function (u) { return !u.allIn; })
      .reduce(function (s, u) { return s + (u.count || 0); }, 0);
    var allInMode = allInCount > 0 && normaalCount === 0;

    var volw = Math.max(parseInt(input.volwassenen, 10) || 0, 0);
    var kind = Math.max(parseInt(input.kinderen, 10) || 0, 0);
    var baby = Math.max(parseInt(input.baby, 10) || 0, 0);
    var personen = volw + kind + baby;
    var honden = Math.max(parseInt(input.honden, 10) || 0, 0);
    var extraAutos = Math.max((parseInt(input.autos, 10) || 1) - 1, 0);

    // Afval per nacht, per schijf van 6 personen
    var _p6 = Math.max(personen, 1);
    var afvalDag = allInMode ? 0
      : (_p6 <= 6 ? P.afvalPer6 : P.afvalPer6 * (1 + Math.ceil((_p6 - 6) / 2)));
    var afval = afvalDag * nights;

    // Elektriciteit per nacht
    var elekDag = input.elektriciteit ? P.elektriciteit : 0;
    var elek = elekDag * nights;

    // Toeristentaks (BTW-vrij) — apart bovenop
    var taksPerNacht = volw * P.toeristentaks;
    var taksTotaal = taksPerNacht * nights;

    var persoonsKost = allInMode ? 0
      : (volw * P.volwassene + kind * P.kind + baby * (P.baby || 0));
    var hondKost = honden * P.hond;
    var extraAutoKost = extraAutos * P.extraAuto;

    // Vrije kostenposten
    var extraPerNacht = 0, extraEenmalig = 0;
    var extraLines = [];
    (input.extraTarieven || []).forEach(function (t) {
      if (!t || !t.naam || !(parseFloat(t.prijs) > 0)) return;
      var p = parseFloat(t.prijs);
      var cat = t.categorie || 'extra';
      var plaatsen = Math.max(eenheden, 1);
      var pers = Math.max(personen, 1);
      var perUnit = cat === 'standplaats' ? p * plaatsen
        : cat === 'personen' ? p * pers : p;
      if (t.perNacht) {
        extraPerNacht += perUnit;
        extraLines.push([t.naam + ' × ' + nights + 'n', round2(perUnit * nights)]);
      } else {
        extraEenmalig += perUnit;
        extraLines.push([t.naam, round2(perUnit)]);
      }
    });

    // Diensten per nacht (INCL verbruik) — gebruikt door publieke "per nacht"-regel
    var dienstenPerNacht = basis + persoonsKost + hondKost + extraAutoKost
      + extraPerNacht + afvalDag + elekDag;
    // Diensten per nacht (EXCL verbruik) — dashboard toont verbruik apart
    var dienstenPerNachtExclVerbruik = basis + persoonsKost + hondKost
      + extraAutoKost + extraPerNacht;

    var dienstenTotaal = dienstenPerNacht * nights + extraEenmalig;
    var btw = round2(dienstenTotaal * 12 / 112);          // geëxtraheerd
    var totaal = round2(dienstenTotaal + taksTotaal);     // taks BTW-vrij bovenop
    var perNacht = dienstenPerNacht + taksPerNacht;        // incl verbruik + taks

    return {
      nights: nights,
      allInMode: allInMode,
      personen: personen,
      eenheden: eenheden,
      honden: honden,
      extraAutos: extraAutos,
      basis: round2(basis),
      persoonsKost: round2(persoonsKost),
      hondKost: round2(hondKost),
      extraAutoKost: round2(extraAutoKost),
      afvalDag: round2(afvalDag),
      afval: round2(afval),
      elekDag: round2(elekDag),
      elek: round2(elek),
      taksPerNacht: round2(taksPerNacht),
      taks: round2(taksPerNacht),       // alias (compat dashboard)
      taks_totaal: round2(taksTotaal),
      extraPerNacht: round2(extraPerNacht),
      extraEenmalig: round2(extraEenmalig),
      extraLines: extraLines,
      dienstenPerNacht: round2(dienstenPerNacht),
      dienstenPerNachtExclVerbruik: round2(dienstenPerNachtExclVerbruik),
      diensten_totaal: round2(dienstenTotaal),
      btw: btw,
      perNacht: round2(perNacht),
      totaal: totaal,
    };
  }

  var api = { DEFAULTS: DEFAULTS, calc: calc, round2: round2, nightsBetween: nightsBetween };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;          // Node (tests)
  }
  root.CampingPricing = api;       // Browser
})(typeof self !== 'undefined' ? self : this);
