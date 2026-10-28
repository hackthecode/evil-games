// Табла: правилата и ботът – пуловете не изчезват, играта винаги свършва.
import { test, ok, eq } from './harness.js';
import { initialState, legalSequences, chooseSequence, winner } from '../js/games/tabla/engine.js';

const count = (s, p) => s.bar[p] + s.off[p] + s.pts.reduce((a, v) => a + (p === 0 ? (v > 0 ? v : 0) : (v < 0 ? -v : 0)), 0);
let seed = 12345;
const die = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return 1 + (seed % 6); };

test('табла: 40 игри бот срещу бот без загубени пулове', () => {
  for (let g = 0; g < 40; g++) {
    let s = initialState(), p = g % 2, turns = 0;
    while (winner(s) < 0 && turns < 1000) {
      s = chooseSequence(s, p, [die(), die()], p === 0 ? 'hard' : 'easy').state;
      eq([count(s, 0), count(s, 1)], [15, 15], `игра ${g}, ход ${turns}`);
      p = 1 - p;
      turns++;
    }
    ok(winner(s) >= 0, 'играта свършва');
  }
});

test('табла: начални ходове и блокиран бар', () => {
  ok(legalSequences(initialState(), 0, [6, 5]).length > 0);
  const s = { pts: new Array(24).fill(0), bar: [1, 0], off: [0, 0] };
  s.pts[0] = 14;
  for (const i of [18, 19, 20, 21, 22, 23]) s.pts[i] = -2;
  ok(legalSequences(s, 0, [3, 4]).every((q) => q.moves.length === 0), 'няма ход при затворен дом');
});
