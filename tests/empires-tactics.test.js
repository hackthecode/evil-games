// Evil Empires: tactical battles are deterministic and the server can verify them.
import { test, ok, eq } from './harness.js';
import * as T from '../js/games/empires/tactics.js';
import { UNITS } from '../js/games/empires/data.js';

const grp = (key, n) => ({ key, n, cls: UNITS[key].cls, hp: UNITS[key].hp, atk: UNITS[key].atk, def: UNITS[key].def });
const ATT = [grp('warrior', 40), grp('slinger', 20)];
const DEF = [grp('warrior', 30), grp('slinger', 12)];

test('tactics: the same seed and moves → the same result', () => {
  const a = T.replay({ seed: 's1', att: ATT, def: DEF, opts: {} }, []);
  const b = T.replay({ seed: 's1', att: ATT, def: DEF, opts: {} }, []);
  eq(a, b);
  ok(a.win === 'att' || a.win === 'def');
});

test('tactics: the battle always ends and the counts never go negative', () => {
  for (let i = 0; i < 25; i++) {
    const st = T.createBattle(`seed${i}`, ATT, DEF);
    T.autoFinish(st);
    ok(st.over, 'it ends');
    for (const u of st.units) ok(u.n >= 0 && u.n <= u.start, 'counts');
  }
});

test('tactics: invalid moves are rejected', () => {
  const st = T.createBattle('x', ATT, DEF);
  const enemy = st.units.find((u) => u.side === 'D');
  ok(!T.applyMove(st, { m: [enemy.id, 0, 0] }), 'enemy unit');
  ok(!T.applyMove(st, { m: [999, 1, 1] }), 'nonexistent');
  ok(!T.applyMove(st, null));
});

test('tactics: formation – archers at the back, infantry in front', () => {
  const st = T.createBattle('f', ATT, DEF);
  const a = (k) => st.units.find((u) => u.side === 'A' && u.key === k);
  ok(a('slinger').q < a('warrior').q, 'archers behind the infantry');
  const st2 = T.createBattle('f', ATT, DEF, { formA: { ranged: 'front', inf: 'back' } });
  const b = (k) => st2.units.find((u) => u.side === 'A' && u.key === k);
  ok(b('slinger').q > b('warrior').q, 'swapped by formation');
});

test('tactics: replaying recorded moves gives the same ending', () => {
  const st = T.createBattle('rec', ATT, DEF);
  const moves = [];
  for (let k = 0; k < 6 && !st.over; k++) { moves.push({ end: 1 }); T.applyMove(st, { end: 1 }); }
  const r1 = T.replay({ seed: 'rec', att: ATT, def: DEF, opts: {} }, moves);
  const r2 = T.replay({ seed: 'rec', att: ATT, def: DEF, opts: {} }, moves);
  eq(r1, r2);
});
