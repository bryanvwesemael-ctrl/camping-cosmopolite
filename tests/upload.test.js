'use strict';
const test = require('node:test');
const assert = require('node:assert');
const U = require('../shared/upload.js');

const bytes = (...arr) => Uint8Array.from(arr);

test('sniffMime herkent JPEG/PNG/PDF/HEIC aan signatuur', () => {
  assert.strictEqual(U.sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.strictEqual(U.sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png');
  assert.strictEqual(U.sniffMime(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31)), 'application/pdf');
  const heic = bytes(0,0,0,0x18, 0x66,0x74,0x79,0x70, 0x68,0x65,0x69,0x63);
  assert.strictEqual(U.sniffMime(heic), 'image/heic');
});

test('sniffMime weigert onbekende/foute signatuur (verkeerde extensie-aanval)', () => {
  // .jpg-bestand dat eigenlijk een uitvoerbaar/zip is (PK\x03\x04)
  assert.strictEqual(U.sniffMime(bytes(0x50, 0x4b, 0x03, 0x04)), null);
  assert.strictEqual(U.sniffMime(bytes(0x00, 0x01, 0x02, 0x03)), null);
  assert.strictEqual(U.sniffMime(bytes(0x01)), null);
});

test('validateFile: leeg bestand wordt geweigerd', () => {
  const r = U.validateFile(500, 'image/jpeg');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'leeg_of_corrupt');
});

test('validateFile: te groot bestand wordt geweigerd', () => {
  const r = U.validateFile(U.MAX_FILE_BYTES + 1, 'image/jpeg');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'te_groot');
});

test('validateFile: niet-toegelaten type wordt geweigerd', () => {
  const r = U.validateFile(50000, 'image/gif');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'type_niet_toegelaten');
});

test('validateFile: onbekend type (geen signatuur) wordt geweigerd', () => {
  const r = U.validateFile(50000, null);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'onbekend_type');
});

test('validateFile: geldige JPEG/PNG/PDF/HEIC slagen', () => {
  ['image/jpeg', 'image/png', 'application/pdf', 'image/heic'].forEach(m => {
    assert.strictEqual(U.validateFile(200000, m).ok, true, m);
  });
});

test('humanSize formatteert leesbaar', () => {
  assert.strictEqual(U.humanSize(512), '512 B');
  assert.strictEqual(U.humanSize(2048), '2 KB');
  assert.strictEqual(U.humanSize(3 * 1024 * 1024), '3.0 MB');
});

test('helpers isPdf/isHeic/isAllowed', () => {
  assert.ok(U.isPdf('application/pdf'));
  assert.ok(U.isHeic('image/heif'));
  assert.ok(U.isAllowed('image/png'));
  assert.ok(!U.isAllowed('image/gif'));
});
