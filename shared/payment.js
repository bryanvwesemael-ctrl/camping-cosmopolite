/* ============================================================================
 * shared/payment.js — Belgische OGM-referentie, IBAN-validatie en EPC/SEPA
 * "Scan to Pay"-QR payload. Pure functies, gedeeld door dashboard en tests.
 * ==========================================================================*/
(function (root) {
  'use strict';

  // Klassieke Belgische gestructureerde mededeling uit het boekingsnummer.
  // +++070/1234/56789+++ — 10 cijfers + modulo-97 controlegetal.
  function belgianOgm(volgnummer) {
    var base = String(volgnummer).padStart(10, '0');
    var check = parseInt(base, 10) % 97;
    if (check === 0) check = 97;
    var full = base + String(check).padStart(2, '0');
    return '+++' + full.slice(0, 3) + '/' + full.slice(3, 7) + '/' + full.slice(7, 12) + '+++';
  }

  // ISO 7064 mod-97-10 op een (mogelijk zeer lange) numerieke string, chunk-gewijs.
  function _mod97(numStr) {
    var remainder = numStr;
    while (remainder.length > 9) {
      var chunk = remainder.slice(0, 9);
      var rem = parseInt(chunk, 10) % 97;
      remainder = rem + remainder.slice(chunk.length);
    }
    return parseInt(remainder, 10) % 97;
  }

  // Standaard IBAN-checksum (verplaats eerste 4 tekens naar achter, letters -> cijfers A=10..Z=35, mod 97 === 1).
  function isValidIban(iban) {
    var clean = String(iban || '').replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(clean)) return false;
    var rearranged = clean.slice(4) + clean.slice(0, 4);
    var numeric = '';
    for (var i = 0; i < rearranged.length; i++) {
      var c = rearranged.charAt(i);
      numeric += /[0-9]/.test(c) ? c : String(c.charCodeAt(0) - 55);
    }
    return _mod97(numeric) === 1;
  }

  function formatIban(iban) {
    var clean = String(iban || '').replace(/\s+/g, '').toUpperCase();
    return (clean.match(/.{1,4}/g) || []).join(' ');
  }

  // Bouwt de payload voor een EPC/SEPA-betaal-QR (EPC069-12 "Scan to Pay"),
  // scanbaar met vrijwel elke Europese bankapp. BIC mag leeg blijven (SEPA/EER).
  // De structured reference gebruikt de Belgische OGM — dat is de gangbare
  // praktijk op Belgische facturen/QR-codes en wordt door BE-bankapps herkend.
  function buildEpcQrPayload(opts) {
    opts = opts || {};
    var ibanClean = String(opts.iban || '').replace(/\s+/g, '').toUpperCase();
    var amt = 'EUR' + (Math.round((Number(opts.amount) || 0) * 100) / 100).toFixed(2);
    var lines = [
      'BCD', '002', '1', 'SCT',
      opts.bic ? String(opts.bic).replace(/\s+/g, '').toUpperCase() : '',
      String(opts.name || '').slice(0, 70),
      ibanClean,
      amt,
      '',
      String(opts.reference || '').slice(0, 140),
      '',
    ];
    return lines.join('\n');
  }

  var api = { belgianOgm: belgianOgm, isValidIban: isValidIban, formatIban: formatIban, buildEpcQrPayload: buildEpcQrPayload };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CampingPayment = api;
})(typeof self !== 'undefined' ? self : this);
