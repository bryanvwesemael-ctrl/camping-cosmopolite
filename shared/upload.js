/* ============================================================================
 * shared/upload.js — kosteloze, AI-vrije validatie van geüploade documenten.
 * Pure functies (geen DOM), gedeeld door browser en Node-tests.
 * Gebruikt voor de client-side check én (logisch identiek) server-side check.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per document
  var MIN_FILE_BYTES = 1024;             // < 1 KB => leeg/corrupt
  var MIN_IMAGE_PX   = 400;              // kleinste lange zijde voor leesbaarheid

  var ALLOWED = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'];

  // Herken het ECHTE bestandstype aan de magische bytes (signatuur), niet aan
  // de extensie. 'bytes' is een Uint8Array (eerste ~16 bytes volstaan).
  function sniffMime(bytes) {
    if (!bytes || bytes.length < 4) return null;
    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
    // PDF: 25 50 44 46  (%PDF)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf';
    // HEIC/HEIF (ISO-BMFF): bytes 4..7 == 'ftyp', merk 8..11 in heic/heif/mif1/msf1
    if (bytes.length >= 12 &&
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      var brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      if (['heic', 'heix', 'heif', 'mif1', 'msf1', 'hevc'].indexOf(brand) !== -1) return 'image/heic';
    }
    return null;
  }

  function isAllowed(mime) { return ALLOWED.indexOf(mime) !== -1; }
  function isPdf(mime)     { return mime === 'application/pdf'; }
  function isHeic(mime)    { return mime === 'image/heic' || mime === 'image/heif'; }

  // Beoordeel een bestand op grootte + signatuur. Retourneert {ok, mime, reason}.
  // 'declaredType' is file.type (mag leeg/onbetrouwbaar zijn); 'sniffed' wint.
  function validateFile(sizeBytes, sniffedMime) {
    if (sizeBytes != null && sizeBytes < MIN_FILE_BYTES)
      return { ok: false, mime: sniffedMime, reason: 'leeg_of_corrupt' };
    if (sizeBytes != null && sizeBytes > MAX_FILE_BYTES)
      return { ok: false, mime: sniffedMime, reason: 'te_groot' };
    if (!sniffedMime)
      return { ok: false, mime: null, reason: 'onbekend_type' };
    if (!isAllowed(sniffedMime))
      return { ok: false, mime: sniffedMime, reason: 'type_niet_toegelaten' };
    return { ok: true, mime: sniffedMime, reason: '' };
  }

  function humanSize(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  var reasonText = {
    leeg_of_corrupt: 'Bestand is leeg of beschadigd',
    te_groot: 'Bestand is te groot (max 15 MB)',
    onbekend_type: 'Onbekend bestandstype',
    type_niet_toegelaten: 'Alleen JPG, PNG, HEIC of PDF toegelaten',
    lage_resolutie: 'Lage resolutie — mogelijk onleesbaar',
    duplicaat: 'Dit document is al toegevoegd',
    pdf_beveiligd: 'PDF is met wachtwoord beveiligd',
  };

  var api = {
    MAX_FILE_BYTES: MAX_FILE_BYTES, MIN_FILE_BYTES: MIN_FILE_BYTES, MIN_IMAGE_PX: MIN_IMAGE_PX,
    ALLOWED: ALLOWED, sniffMime: sniffMime, isAllowed: isAllowed, isPdf: isPdf, isHeic: isHeic,
    validateFile: validateFile, humanSize: humanSize, reasonText: reasonText,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CampingUpload = api;
})(typeof self !== 'undefined' ? self : this);
