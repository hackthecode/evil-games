// Evil Empires: данните са свързани правилно (технологии, единици, сгради, раси).
import { test, ok, eq } from './harness.js';
import { BUILDINGS, UNITS, TECHS, FIGHTERS, UNIT_ORDER, RACES, PLOTS, FORMATION, MOVES, CLS_NAMES, EPOCHS } from '../js/games/empires/data.js';

test('данни: всяка технология изисква съществуващи технологии от същата или по-ранна епоха', () => {
  for (const [id, t] of Object.entries(TECHS)) {
    for (const r of t.req || []) {
      ok(TECHS[r], `${id} изисква непознатата ${r}`);
      ok(TECHS[r].epoch <= t.epoch, `${id} изисква ${r} от по-късна епоха`);
    }
  }
});

test('данни: единиците имат валидни технология, клас и цена', () => {
  for (const [id, u] of Object.entries(UNITS)) {
    if (u.tech) ok(TECHS[u.tech], `${id}: непозната технология ${u.tech}`);
    ok(CLS_NAMES[u.cls], `${id}: непознат клас ${u.cls}`);
    ok(u.hp > 0 && u.speed > 0 && u.time > 0, `${id}: hp/speed/time`);
    ok(Object.values(u.cost).every((v) => v > 0), `${id}: цена`);
    ok(u.epoch >= 1 && u.epoch <= EPOCHS.length, `${id}: епоха`);
  }
  for (const id of [...UNIT_ORDER, ...FIGHTERS]) ok(UNITS[id], `${id} липсва в UNITS`);
});

test('данни: обсадните единици и благородниците съществуват', () => {
  eq(UNITS.catapult.cls, 'siege');
  eq(UNITS.noble.cls, 'noble');
  ok(FIGHTERS.includes('catapult') && FIGHTERS.includes('noble'));
  for (const cls of ['siege', 'noble']) { ok(FORMATION[cls]); ok(MOVES[cls] >= 1); }
});

test('данни: всяка раса има имена за всички единици', () => {
  for (const [race, r] of Object.entries(RACES)) {
    ok(r.name && r.perks?.length, `${race}: име/предимства`);
    for (const u of UNIT_ORDER) ok(r.units?.[u] || UNITS[u], `${race}: ${u}`);
  }
});

test('данни: парцелите сочат към съществуващи сгради', () => {
  for (const id of Object.keys(PLOTS)) ok(BUILDINGS[id], `парцел за непозната сграда ${id}`);
  for (const [id, b] of Object.entries(BUILDINGS)) ok(Object.values(b.cost).every((v) => v > 0), `${id}: цена`);
});
