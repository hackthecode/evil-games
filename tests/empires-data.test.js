// Evil Empires: the data is linked correctly (technologies, units, buildings, races).
import { test, ok, eq } from './harness.js';
import { BUILDINGS, UNITS, TECHS, FIGHTERS, UNIT_ORDER, RACES, PLOTS, FORMATION, MOVES, CLS_NAMES, EPOCHS } from '../js/games/empires/data.js';

test('data: every technology requires existing technologies from the same or an earlier age', () => {
  for (const [id, t] of Object.entries(TECHS)) {
    for (const r of t.req || []) {
      ok(TECHS[r], `${id} requires the unknown ${r}`);
      ok(TECHS[r].epoch <= t.epoch, `${id} requires ${r} from a later age`);
    }
  }
});

test('data: units have a valid technology, class and cost', () => {
  for (const [id, u] of Object.entries(UNITS)) {
    if (u.tech) ok(TECHS[u.tech], `${id}: unknown technology ${u.tech}`);
    ok(CLS_NAMES[u.cls], `${id}: unknown class ${u.cls}`);
    ok(u.hp > 0 && u.speed > 0 && u.time > 0, `${id}: hp/speed/time`);
    ok(Object.values(u.cost).every((v) => v > 0), `${id}: cost`);
    ok(u.epoch >= 1 && u.epoch <= EPOCHS.length, `${id}: age`);
  }
  for (const id of [...UNIT_ORDER, ...FIGHTERS]) ok(UNITS[id], `${id} is missing from UNITS`);
});

test('data: siege units and noblemen exist', () => {
  eq(UNITS.catapult.cls, 'siege');
  eq(UNITS.noble.cls, 'noble');
  ok(FIGHTERS.includes('catapult') && FIGHTERS.includes('noble'));
  for (const cls of ['siege', 'noble']) { ok(FORMATION[cls]); ok(MOVES[cls] >= 1); }
});

test('data: every race has names for all units', () => {
  for (const [race, r] of Object.entries(RACES)) {
    ok(r.name && r.perks?.length, `${race}: name/perks`);
    for (const u of UNIT_ORDER) ok(r.units?.[u] || UNITS[u], `${race}: ${u}`);
  }
});

test('data: plots point to existing buildings', () => {
  for (const id of Object.keys(PLOTS)) ok(BUILDINGS[id], `plot for an unknown building ${id}`);
  for (const [id, b] of Object.entries(BUILDINGS)) ok(Object.values(b.cost).every((v) => v > 0), `${id}: cost`);
});
