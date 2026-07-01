/* ============================================================================
 * shared/guests.js — centrale logica rond gasten, documenten en aanwezigheid.
 * Eén bron van waarheid voor zowel de browser (dashboard) als de Node-tests.
 * IIFE-patroon (werkt in browser én via require), net als shared/pricing.js.
 * ==========================================================================*/
(function (root) {
  'use strict';

  // Placeholder-naam waarmee een nog niet uitgelezen ID-upload tijdelijk in de
  // gasten-tabel staat. Mag NOOIT in het wettelijke register of een export
  // verschijnen. (Wordt in fase 2/3 vervangen door booking_documents.)
  var PENDING_MARKER = '__pending_guest_upload__';

  function isPendingDoc(g) {
    return !!g && g.naam === PENDING_MARKER;
  }
  // Een "echte" geregistreerde gast: geen placeholder en niet soft-deleted.
  function isRealGuest(g) {
    return !!g && !isPendingDoc(g) && !g.deleted_at;
  }

  // --- Datumlogica voor verblijf/register ---------------------------------
  // Interval: aankomst <= datum < vertrek. De vertrekdag telt NIET als
  // overnachting (sectie 16 van de opdracht).
  function isPresentOn(booking, dateStr) {
    if (!booking || !dateStr) return false;
    if (booking.status === 'geannuleerd') return false;
    if (booking.deleted_at) return false;
    return booking.aankomst <= dateStr && booking.vertrek > dateStr;
  }
  function isArrival(booking, dateStr) {
    return !!booking && booking.status !== 'geannuleerd' && booking.aankomst === dateStr;
  }
  function isDeparture(booking, dateStr) {
    return !!booking && booking.status !== 'geannuleerd' && booking.vertrek === dateStr;
  }

  // "Wie is er?"-classificatie op een gekozen datum (sectie 15):
  //  - 'ingecheckt' : verblijfsstatus ingecheckt én datum binnen verblijf
  //  - 'verwacht'   : bevestigd/aanvraag/betaald, datum binnen verblijf, nog niet ingecheckt
  //  - null         : niet aanwezig (geannuleerd, uitgecheckt, buiten periode)
  function presenceCategory(booking, dateStr) {
    if (!isPresentOn(booking, dateStr)) return null;
    if (booking.status === 'ingecheckt') return 'ingecheckt';
    // Enkel bevestigde/aangevraagde/betaalde boekingen tellen als 'verwacht'.
    // wachtlijst/geannuleerd/uitgecheckt → niet aanwezig.
    if (['aanvraag', 'bevestigd', 'betaald'].indexOf(booking.status) !== -1) return 'verwacht';
    return null;
  }

  // Maskeer een gevoelig nummer: toon enkel de laatste 4 tekens (sectie 15).
  function maskId(nr) {
    var s = String(nr || '').replace(/\s+/g, '');
    if (!s) return '';
    if (s.length <= 4) return s;
    return '******' + s.slice(-4);
  }

  var api = {
    PENDING_MARKER: PENDING_MARKER,
    isPendingDoc: isPendingDoc,
    isRealGuest: isRealGuest,
    isPresentOn: isPresentOn,
    isArrival: isArrival,
    isDeparture: isDeparture,
    presenceCategory: presenceCategory,
    maskId: maskId,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CampingGuests = api;
})(typeof self !== 'undefined' ? self : this);
