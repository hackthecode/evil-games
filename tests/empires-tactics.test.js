// Evil Empires: тактическите битки са детерминирани и сървърът може да ги провери.
import { test, ok, eq } from './harness.js';
import * as T from '../js/games/empires/tactics.js';
import { UNITS } from '../js/games/empires/data.js';

const grp = (key, n) => ({ key, n, cls: UNITS[key].cls, hp: UNITS[key].hp, atk: UNITS[key].atk, def: UNITS[key].def });
const ATT = [grp('warrior', 40), grp('slinger', 20)];
const DEF = [grp('warrior', 30), grp('slinger', 12)];

test('тактика: същото семе и ходове → същият резултат', () => {
  const a = T.replay({ seed: 's1', att: ATT, def: DEF, opts: {} }, []);
  const b = T.replay({ seed: 's1', att: ATT, def: DEF, opts: {} }, []);
  eq(a, b);
  ok(a.win === 'att' || a.win === 'def');
});

test('тактика: битката винаги свършва и бройките не стават отрицателни', () => {
  for (let i = 0; i < 25; i++) {
    const st = T.createBattle(`seed${i}`, ATT, DEF);
    T.autoFinish(st);
    ok(st.over, 'свършва');
    for (const u of st.units) ok(u.n >= 0 && u.n <= u.start, 'бройки');
  }
});

test('тактика: невалидните ходове се отхвърлят', () => {
  const st = T.createBattle('x', ATT, DEF);
  const enemy = st.units.find((u) => u.side === 'D');
  ok(!T.applyMove(st, { m: [enemy.id, 0, 0] }), 'чужда единица');
  ok(!T.applyMove(st, { m: [999, 1, 1] }), 'несъществуваща');
  ok(!T.applyMove(st, null));
});

test('тактика: подредбата – стрелците отзад, пехотата отпред', () => {
  const st = T.createBattle('f', ATT, DEF);
  const a = (k) => st.units.find((u) => u.side === 'A' && u.key === k);
  ok(a('slinger').q < a('warrior').q, 'стрелците зад пехотата');
  const st2 = T.createBattle('f', ATT, DEF, { formA: { ranged: 'front', inf: 'back' } });
  const b = (k) => st2.units.find((u) => u.side === 'A' && u.key === k);
  ok(b('slinger').q > b('warrior').q, 'размяна по формация');
});

test('тактика: преиграване на записани ходове дава същия край', () => {
  const st = T.createBattle('rec', ATT, DEF);
  const moves = [];
  for (let k = 0; k < 6 && !st.over; k++) { moves.push({ end: 1 }); T.applyMove(st, { end: 1 }); }
  const r1 = T.replay({ seed: 'rec', att: ATT, def: DEF, opts: {} }, moves);
  const r2 = T.replay({ seed: 'rec', att: ATT, def: DEF, opts: {} }, moves);
  eq(r1, r2);
});
