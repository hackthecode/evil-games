// Evil Empires: the empire logic (resources, construction, troops, determinism).
import { test, ok, eq, throws } from './harness.js';
import * as E from '../js/games/empires/engine.js';

const H = 3600000;
const fresh = (race = 'humans') => E.newGame(race, 'Test', 0, 42);

test('empire: a new game for every race', () => {
  for (const race of ['humans', 'undead', 'orcs', 'vesheri']) {
    const s = fresh(race);
    eq(s.cities.length, 1, race);
    ok(E.score(s) >= 0);
  }
  throws(() => E.newGame('elves', 'X', 0, 1), /Unknown race/);
});

test('empire: resources grow over time and don\'t exceed the storage', () => {
  const s = fresh();
  const c = s.cities[0];
  const before = { ...c.res };
  E.advance(s, 2 * H);
  ok(c.res.wood > before.wood && c.res.food > before.food, 'they grow');
  E.advance(s, 2000 * H);
  for (const k of ['wood', 'stone', 'gold']) ok(c.res[k] <= E.capOf(c, k) + 1e-6, `${k} above the storage`);
});

test('empire: one long step = many short ones (lazy time)', () => {
  const a = fresh(), b = fresh();
  E.advance(a, 5 * H);
  for (let t = 60000; t <= 5 * H; t += 60000) E.advance(b, t);
  for (const k of ['wood', 'stone', 'gold', 'food']) ok(Math.abs(a.cities[0].res[k] - b.cities[0].res[k]) < 0.5, `${k}: ${a.cities[0].res[k]} ≠ ${b.cities[0].res[k]}`);
});

test('empire: construction – payment, queue and completion', () => {
  const s = fresh();
  const c = s.cities[0];
  const lvl = E.lv(c, 'lumber');
  const wood = c.res.wood;
  E.perform(s, 1000, null, 'build', ['c1', 'lumber']);
  eq(c.queue.length, 1);
  ok(c.res.wood < wood, 'paid');
  E.advance(s, 24 * H);
  eq(E.lv(c, 'lumber'), lvl + 1, 'new level');
  eq(c.queue.length, 0);
});

test('empire: refusal without resources and unknown actions', () => {
  const s = fresh();
  const c = s.cities[0];
  for (const k of Object.keys(c.res)) c.res[k] = 0;
  throws(() => E.perform(s, 1000, null, 'build', ['c1', 'lumber']));
  throws(() => E.perform(s, 1000, null, 'hack', []), /Unknown action/);
  throws(() => E.perform(s, 1000, null, 'build', ['c1', '__proto__']));
});

test('empire: training troops', () => {
  const s = fresh();
  const c = s.cities[0];
  Object.assign(c.res, { food: 5000, gold: 5000, wood: 5000, stone: 5000 });
  Object.assign(c.b, { barracks: 1, farm: 5, houses: 3 });
  throws(() => E.perform(s, 1000, null, 'train', ['c1', 'catapult', 1]), null, 'catapult without the technology');
  const n0 = c.units.warrior || 0;
  E.perform(s, 1000, null, 'train', ['c1', 'warrior', 3]);
  E.advance(s, 3 * H);
  eq((c.units.warrior || 0) - n0, 3);
});

test('empire: the state is plain JSON (the server keeps it in the database)', () => {
  const s = fresh();
  E.advance(s, 30 * H);
  const copy = JSON.parse(JSON.stringify(s));
  E.advance(s, 40 * H);
  E.advance(copy, 40 * H);
  eq(JSON.stringify(copy.cities[0].res), JSON.stringify(s.cities[0].res));
});
