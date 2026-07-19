'use strict';
const test = require('node:test');
const assert = require('node:assert');
const P = require('../shared/pricing.js');

// Standaardtarieven zoals in de DB (settings):
// tent/camper 15, volwassene 7, kind 5, baby 0, hond 3, extraAuto 2,
// elektriciteit 6, afvalPer6 2, toeristentaks 1.
const base = (o) => Object.assign({ units: [{ prijs: 15, count: 1, allIn: false }] }, o);

test('nightsBetween: vertrekdag telt niet mee', () => {
  assert.equal(P.nightsBetween('2026-07-01', '2026-07-04'), 3);
  assert.equal(P.nightsBetween('2026-07-01', '2026-07-02'), 1);
});

test('nightsBetween: vertrek = aankomst → 0 nachten', () => {
  assert.equal(P.nightsBetween('2026-07-01', '2026-07-01'), 0);
});

test('nightsBetween: vertrek vóór aankomst → 0 (geen negatieve nachten)', () => {
  assert.equal(P.nightsBetween('2026-07-05', '2026-07-01'), 0);
});

test('standaardboeking 2 volw, 1 nacht, tent', () => {
  const r = P.calc(base({ volwassenen: 2, kinderen: 0, baby: 0, autos: 1, nights: 1 }));
  // tent 15 + 2×7 (volw) + afval 2 = 31 diensten/nacht ; taks 2×1 = 2
  // totaal = 31 + 2 = 33
  assert.equal(r.totaal, 33);
  assert.equal(r.taks_totaal, 2);
  assert.equal(r.afval, 2);
});

test('boeking met kinderen', () => {
  const r = P.calc(base({ volwassenen: 2, kinderen: 1, autos: 1, nights: 1 }));
  // tent 15 + 14 volw + 5 kind + afval 2 = 36 ; taks 2 → 38
  assert.equal(r.totaal, 38);
});

test('baby is gratis', () => {
  const r = P.calc(base({ volwassenen: 2, baby: 1, autos: 1, nights: 1 }));
  // baby voegt 0 toe aan persoonskost, maar telt WEL mee voor afval (3 pers ≤ 6 → 2)
  // tent 15 + 14 + afval 2 = 31 ; taks 2 → 33
  assert.equal(r.totaal, 33);
});

test('hond per nacht', () => {
  const r = P.calc(base({ volwassenen: 2, honden: 2, autos: 1, nights: 2 }));
  // per nacht: 15 + 14 + hond 6 + afval 2 = 37 ; ×2 = 74 ; taks 2×1×2 = 4 → 78
  assert.equal(r.hondKost, 6);
  assert.equal(r.totaal, 78);
});

test('eerste auto gratis, extra auto per nacht', () => {
  const r = P.calc(base({ volwassenen: 2, autos: 3, nights: 1 }));
  // extra autos = 2 × 2 = 4 ; 15 + 14 + 4 + afval 2 = 35 ; taks 2 → 37
  assert.equal(r.extraAutos, 2);
  assert.equal(r.extraAutoKost, 4);
  assert.equal(r.totaal, 37);
});

test('elektriciteit wordt PER NACHT aangerekend (niet eenmalig)', () => {
  const r1 = P.calc(base({ volwassenen: 2, autos: 1, elektriciteit: true, nights: 1 }));
  const r3 = P.calc(base({ volwassenen: 2, autos: 1, elektriciteit: true, nights: 3 }));
  assert.equal(r1.elek, 6);
  assert.equal(r3.elek, 18); // 6 × 3 nachten — bewijst per-nacht, niet eenmalig
});

test('afval getrapt per personenaantal (0-6/7-10/11-15/16-20/+5)', () => {
  const afvalVoor = (n) => P.calc(base({ volwassenen: n, autos: 1, nights: 1 })).afvalDag;
  assert.equal(afvalVoor(6), 2);   // 0-6 → €2
  assert.equal(afvalVoor(7), 4);   // 7-10 → €4
  assert.equal(afvalVoor(10), 4);
  assert.equal(afvalVoor(11), 6);  // 11-15 → €6
  assert.equal(afvalVoor(15), 6);
  assert.equal(afvalVoor(16), 8);  // 16-20 → €8
  assert.equal(afvalVoor(20), 8);
  assert.equal(afvalVoor(21), 10); // 21-25 → €10 (en zo verder, +€2 per schijf van 5)
  assert.equal(afvalVoor(25), 10);
  assert.equal(afvalVoor(26), 12);
});

test('volwassene = persoonsprijs €7 + toeristentaks €1 (= €8 effectief)', () => {
  const r = P.calc(base({ volwassenen: 1, autos: 1, nights: 1 }));
  // tent 15 + 7 + afval 2 = 24 diensten ; taks 1 → 25
  assert.equal(r.persoonsKost, 7);
  assert.equal(r.taksPerNacht, 1);
  assert.equal(r.totaal, 25);
});

test('BTW 12% wordt geëxtraheerd, niet bovenop', () => {
  const r = P.calc(base({ volwassenen: 2, autos: 1, nights: 1 }));
  // diensten 31 ; btw = 31×12/112 = 3.32 ; totaal blijft 33 (taks 2)
  assert.equal(r.btw, 3.32);
  assert.equal(r.totaal, 33);
});

test('all-in eenheid (backpacker): geen aparte persoons-/afvalkost', () => {
  const r = P.calc({
    units: [{ prijs: 20, count: 1, allIn: true }],
    volwassenen: 2, autos: 1, nights: 2,
  });
  // 20/nacht ×2 = 40 ; geen persoonskost, geen afval ; taks 2×1×2 = 4 → 44
  assert.equal(r.allInMode, true);
  assert.equal(r.persoonsKost, 0);
  assert.equal(r.afval, 0);
  assert.equal(r.totaal, 44);
});

test('meerdere nachten schalen lineair (eenmalige kosten niet)', () => {
  const extra = [{ naam: 'Schoonmaak', prijs: 25, categorie: 'extra', perNacht: false }];
  const r = P.calc(base({ volwassenen: 2, autos: 1, nights: 3, extraTarieven: extra }));
  // diensten/nacht = 15 + 14 + afval 2 = 31 ; ×3 = 93 ; + eenmalig 25 = 118
  // taks 2×1×3 = 6 → 124
  assert.equal(r.extraEenmalig, 25);
  assert.equal(r.totaal, 124);
});

test('extra dag toevoegen: verschil = exact één nacht diensten + taks', () => {
  const drie = P.calc(base({ volwassenen: 2, autos: 1, elektriciteit: true, nights: 3 }));
  const vier = P.calc(base({ volwassenen: 2, autos: 1, elektriciteit: true, nights: 4 }));
  const verschil = P.round2(vier.totaal - drie.totaal);
  // één nacht: 15 + 14 + afval 2 + elek 6 = 37 diensten + taks 2 = 39
  assert.equal(verschil, 39);
});

test('afronding altijd op 2 decimalen', () => {
  const r = P.calc(base({ volwassenen: 3, autos: 1, nights: 1 }));
  assert.equal(r.totaal, P.round2(r.totaal));
  assert.equal(Number.isInteger(Math.round(r.totaal * 100)), true);
});
