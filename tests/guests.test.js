'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('../shared/guests.js');

test('pending placeholder wordt herkend en uitgesloten als echte gast', () => {
  const pending = { naam: G.PENDING_MARKER, foto_url: 'x.jpg' };
  const echt = { naam: 'Jan Janssen' };
  assert.strictEqual(G.isPendingDoc(pending), true);
  assert.strictEqual(G.isRealGuest(pending), false);
  assert.strictEqual(G.isRealGuest(echt), true);
});

test('soft-deleted gast telt niet als echte gast', () => {
  assert.strictEqual(G.isRealGuest({ naam: 'Jan', deleted_at: '2026-01-01' }), false);
});

test('isPresentOn: aankomst <= datum < vertrek (vertrekdag telt niet)', () => {
  const b = { aankomst: '2026-07-10', vertrek: '2026-07-13', status: 'bevestigd' };
  assert.strictEqual(G.isPresentOn(b, '2026-07-09'), false); // dag voor aankomst
  assert.strictEqual(G.isPresentOn(b, '2026-07-10'), true);  // aankomstdag
  assert.strictEqual(G.isPresentOn(b, '2026-07-12'), true);  // laatste overnachting
  assert.strictEqual(G.isPresentOn(b, '2026-07-13'), false); // vertrekdag telt niet
  assert.strictEqual(G.isPresentOn(b, '2026-07-14'), false);
});

test('geannuleerde boeking is nooit aanwezig', () => {
  const b = { aankomst: '2026-07-10', vertrek: '2026-07-13', status: 'geannuleerd' };
  assert.strictEqual(G.isPresentOn(b, '2026-07-11'), false);
  assert.strictEqual(G.presenceCategory(b, '2026-07-11'), null);
});

test('arrival/departure markers', () => {
  const b = { aankomst: '2026-07-10', vertrek: '2026-07-13', status: 'bevestigd' };
  assert.strictEqual(G.isArrival(b, '2026-07-10'), true);
  assert.strictEqual(G.isArrival(b, '2026-07-11'), false);
  assert.strictEqual(G.isDeparture(b, '2026-07-13'), true);
  assert.strictEqual(G.isDeparture(b, '2026-07-12'), false);
});

test('presenceCategory: verwacht vs ingecheckt', () => {
  const datum = '2026-07-11';
  assert.strictEqual(G.presenceCategory({ aankomst: '2026-07-10', vertrek: '2026-07-13', status: 'bevestigd' }, datum), 'verwacht');
  assert.strictEqual(G.presenceCategory({ aankomst: '2026-07-10', vertrek: '2026-07-13', status: 'aanvraag' }, datum), 'verwacht');
  assert.strictEqual(G.presenceCategory({ aankomst: '2026-07-10', vertrek: '2026-07-13', status: 'betaald' }, datum), 'verwacht');
  assert.strictEqual(G.presenceCategory({ aankomst: '2026-07-10', vertrek: '2026-07-13', status: 'ingecheckt' }, datum), 'ingecheckt');
  assert.strictEqual(G.presenceCategory({ aankomst: '2026-07-10', vertrek: '2026-07-13', status: 'uitgecheckt' }, datum), null);
  assert.strictEqual(G.presenceCategory({ aankomst: '2026-07-10', vertrek: '2026-07-13', status: 'wachtlijst' }, datum), null);
});

test('maskId toont enkel laatste 4 tekens', () => {
  assert.strictEqual(G.maskId('590123456789'), '******6789');
  assert.strictEqual(G.maskId('1234'), '1234');
  assert.strictEqual(G.maskId(''), '');
  assert.strictEqual(G.maskId(null), '');
});
