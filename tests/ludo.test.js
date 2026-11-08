// Ludo: the player chooses which piece to move; captures, the home row and whole games.
import { test, ok, eq } from './harness.js';
import { newGame, moves, apply, won, aiChoose } from '../js/games/ludo/engine.js';

test('ludo: with a six the player may bring a piece out or move one on the track', () => {
  const st = newGame([0, 2]);
  st.pos[0] = [5, -1, -1, -1];
  const list = moves(st, 0, 6);
  eq(list.length, 2, 'two choices');
  ok(list.some((m) => m.from === -1), 'bringing a piece out');
  ok(list.some((m) => m.t === 0 && m.to === 11), 'moving the piece on the track');
});

test('ludo: every piece on the track can be chosen', () => {
  const st = newGame([0, 2]);
  st.pos[0] = [0, 7, 15, -1];
  eq(moves(st, 0, 3).map((m) => m.t), [0, 1, 2]);
});

test('ludo: landing on an opponent captures it; own pieces block', () => {
  const st = newGame([0, 2]);
  st.pos[0] = [2, 4, -1, -1];
  st.pos[2] = [-1, -1, -1, -1];
  // player 2 starts at track square 20; their step 3 is square 23 = player 0's step 23
  st.pos[2][0] = 3;
  st.pos[0][0] = 21;
  const cap = moves(st, 0, 2).find((m) => m.t === 0);
  eq(cap.capture, [2, 0]);
  const after = apply(st, 0, cap);
  eq(after.pos[2][0], -1, 'back to the yard');
  st.pos[0] = [2, 4, -1, -1];
  ok(!moves(st, 0, 2).some((m) => m.t === 0), 'cannot land on its own piece');
});

test('ludo: the home row needs an exact roll', () => {
  const st = newGame([0, 2]);
  st.pos[0] = [-1, -1, -1, 39];
  ok(!moves(st, 0, 5).some((m) => m.t === 3), 'too far');
  ok(moves(st, 0, 4).some((m) => m.t === 3 && m.to === 43), 'exactly to the last square');
  st.pos[0] = [41, -1, -1, 39];
  ok(!moves(st, 0, 4).some((m) => m.t === 3), 'cannot jump its own piece in the home row');
});

// mulberry32 – the low bits of a plain LCG never give a six
let seed = 99;
const die = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return 1 + Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * 6);
};
test('ludo: 30 games between bots always end', () => {
  for (let g = 0; g < 30; g++) {
    const active = g % 3 === 0 ? [0, 2] : [0, 1, 2, 3];
    let st = newGame(active), i = 0, turns = 0;
    while (!active.some((p) => won(st, p)) && turns < 5000) {
      const p = active[i % active.length], d = die();
      const list = moves(st, p, d);
      if (list.length) st = apply(st, p, aiChoose(st, p, d, list, g % 2 ? 'easy' : 'normal'));
      for (const q of active) eq(st.pos[q].length, 4);
      if (d !== 6) i++;
      turns++;
    }
    ok(active.some((p) => won(st, p)), `game ${g} ends`);
  }
});
