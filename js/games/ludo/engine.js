// Ludo: an 11×11 board, 40 squares in a ring, 4 pieces per player.
// Piece position (in steps from its own start): -1 = in the yard, 0..39 = on the track,
// 40..43 = in the home row.

export const START = [0, 10, 20, 30];
export const TRACK = [
  [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0],
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [10, 5],
  [10, 6], [9, 6], [8, 6], [7, 6], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [5, 10],
  [4, 10], [4, 9], [4, 8], [4, 7], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 5],
];
export const LANES = [
  [[1, 5], [2, 5], [3, 5], [4, 5]],
  [[5, 1], [5, 2], [5, 3], [5, 4]],
  [[9, 5], [8, 5], [7, 5], [6, 5]],
  [[5, 9], [5, 8], [5, 7], [5, 6]],
];
// The yards are in the middle of the 4×4 corner zones (fractional coordinates – for drawing only).
export const ZONES = [[0, 0], [7, 0], [7, 7], [0, 7]];
export const YARDS = ZONES.map(([x, y]) => [[x + 0.9, y + 0.9], [x + 2.1, y + 0.9], [x + 0.9, y + 2.1], [x + 2.1, y + 2.1]]);

export const newGame = (active) => ({ pos: [0, 1, 2, 3].map(() => [-1, -1, -1, -1]), active });
export const clone = (st) => ({ pos: st.pos.map((a) => a.slice()), active: st.active.slice() });

// The board square for piece t of player p.
export const cell = (st, p, t) => cellAt(p, st.pos[p][t], t);
export function cellAt(p, s, t = 0) {
  if (s < 0) return YARDS[p][t];
  if (s < 40) return TRACK[(START[p] + s) % 40];
  return LANES[p][s - 40];
}
const trackIndex = (p, s) => (START[p] + s) % 40;

// Which piece stands on the track square (absolute index): [player, piece] or null.
function occupant(st, idx) {
  for (const p of st.active) {
    for (let t = 0; t < 4; t++) {
      const s = st.pos[p][t];
      if (s >= 0 && s < 40 && trackIndex(p, s) === idx) return [p, t];
    }
  }
  return null;
}

export const onTrack = (st, p) => st.pos[p].some((s) => s >= 0 && s < 40);
export const won = (st, p) => st.pos[p].every((s) => s >= 40);

export function moves(st, p, d) {
  const res = [];
  const mine = st.pos[p];
  for (let t = 0; t < 4; t++) {
    const s = mine[t];
    if (s < 0) {
      if (d !== 6) continue;
      const occ = occupant(st, START[p]);
      if (occ && occ[0] === p) continue;
      res.push({ t, from: -1, to: 0, capture: occ });
      continue;
    }
    const to = s + d;
    if (to > 43) continue;
    if (to >= 40) {
      // in the home row you can't jump over your own pieces
      let blocked = false;
      for (let x = Math.max(40, s + 1); x <= to; x++) if (mine.includes(x)) blocked = true;
      if (!blocked) res.push({ t, from: s, to, capture: null });
      continue;
    }
    const occ = occupant(st, trackIndex(p, to));
    if (occ && occ[0] === p) continue;
    res.push({ t, from: s, to, capture: occ });
  }
  // with a six bringing out a piece is mandatory if possible
  const enter = res.filter((m) => m.from === -1);
  if (enter.length) return enter.slice(0, 1);
  // the start square must be cleared while there are pieces in the yard
  if (mine.includes(-1)) {
    const fromStart = res.filter((m) => m.from === 0);
    if (fromStart.length) return fromStart;
  }
  return res;
}

export function apply(st, p, m) {
  const n = clone(st);
  n.pos[p][m.t] = m.to;
  if (m.capture) n.pos[m.capture[0]][m.capture[1]] = -1;
  return n;
}

// How many steps the nearest opposing piece is behind the square (for the risk of being captured).
function threat(st, p, idx) {
  let best = 0;
  for (const q of st.active) {
    if (q === p) continue;
    for (const s of st.pos[q]) {
      if (s < 0 || s >= 40) continue;
      const dist = (idx - trackIndex(q, s) + 40) % 40;
      if (dist >= 1 && dist <= 6 && 40 - s > dist) best = Math.max(best, 7 - dist);
    }
  }
  return best;
}

export function aiChoose(st, p, d, list, level = 'normal') {
  if (list.length <= 1) return list[0];
  const score = (m) => {
    let v = 0;
    if (m.capture) v += 40 + st.pos[m.capture[0]][m.capture[1]];
    if (m.from === -1) v += 30;
    if (m.to >= 40 && m.from < 40) v += 25;
    if (m.to < 40) {
      v -= threat(apply(st, p, m), p, trackIndex(p, m.to)) * 4;
      if (m.from >= 0 && m.from < 40) v += threat(st, p, trackIndex(p, m.from)) * 3;
    }
    v += m.to * 0.3;
    if (level === 'easy') v += Math.random() * 30;
    return v;
  };
  return [...list].sort((a, b) => score(b) - score(a))[0];
}
