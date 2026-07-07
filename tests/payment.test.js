'use strict';
const test = require('node:test');
const assert = require('node:assert');
const P = require('../shared/payment.js');

test('belgianOgm produces +++xxx/xxxx/xxxxx+++ with correct mod-97 check digits', () => {
  const ref = P.belgianOgm(1234);
  assert.match(ref, /^\+\+\+\d{3}\/\d{4}\/\d{5}\+\+\+$/);
  // base = 0000001234, 1234 % 97 = 70 (12*97=1164, 1234-1164=70), so check = 70
  assert.strictEqual(ref, '+++000/0001/23470+++');
});

test('belgianOgm: check digit becomes 97 when remainder is 0', () => {
  // Find a volgnummer whose base mod 97 === 0: base 0000000097 -> 97 % 97 = 0 -> check=97
  const ref = P.belgianOgm(97);
  assert.strictEqual(ref, '+++000/0000/09797+++');
});

test('isValidIban: known-valid reference IBAN (Wikipedia example) passes', () => {
  assert.strictEqual(P.isValidIban('BE68 5390 0754 7034'), true);
});

test('isValidIban: rejects a corrupted IBAN (one digit changed)', () => {
  assert.strictEqual(P.isValidIban('BE68 5390 0754 7035'), false);
});

test('isValidIban: rejects garbage input', () => {
  assert.strictEqual(P.isValidIban('not an iban'), false);
  assert.strictEqual(P.isValidIban(''), false);
  assert.strictEqual(P.isValidIban(null), false);
});

test('formatIban groups into blocks of 4', () => {
  assert.strictEqual(P.formatIban('BE68539007547034'), 'BE68 5390 0754 7034');
});

test('buildEpcQrPayload: correct EPC069-12 structure', () => {
  const payload = P.buildEpcQrPayload({
    iban: 'BE68 5390 0754 7034', name: 'Club Cosmopolite VZW',
    amount: 102, reference: '+++000/0001/23470+++',
  });
  const lines = payload.split('\n');
  assert.strictEqual(lines[0], 'BCD');
  assert.strictEqual(lines[1], '002');
  assert.strictEqual(lines[2], '1');
  assert.strictEqual(lines[3], 'SCT');
  assert.strictEqual(lines[4], ''); // BIC leeg toegelaten
  assert.strictEqual(lines[5], 'Club Cosmopolite VZW');
  assert.strictEqual(lines[6], 'BE68539007547034'); // geen spaties
  assert.strictEqual(lines[7], 'EUR102.00');
  assert.strictEqual(lines[9], '+++000/0001/23470+++');
});

test('buildEpcQrPayload: amount always 2 decimals', () => {
  const payload = P.buildEpcQrPayload({ iban: 'BE68539007547034', name: 'X', amount: 44 });
  assert.ok(payload.includes('EUR44.00'));
});
