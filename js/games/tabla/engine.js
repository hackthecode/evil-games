// Backgammon (regular): rules, move generation and AI.
//
// State: pts[0..23] – positive = the player's checkers (0), negative = the computer's (1).
// The player moves from 23 to 0 and bears off from 0..5. The computer – mirrored (from 0 to 23).
// bar[p], off[p] – checkers on the bar and borne off, p = 0 player, 1 computer.

export const OFF = -1; // target "bear off"
export const BAR = 24; // source "bar"

export function initialState() {
  const pts = new Array(24).fill(0);
  pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5;
  pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5;
  return { pts, bar: [0, 0], off: [0, 0] };
}

export const cloneState = (s) => ({ pts: s.pts.slice(), bar: s.bar.slice(), off: s.off.slice() });

// Index in player p's perspective (0..23, home is 0..5) -> real index.
const real = (p, i) => (p === 0 ? i : 23 - i);
const mine = (s, p, i) => (p === 0 ? Math.max(s.pts[real(p, i)], 0) : Math.max(-s.pts[real(p, i)], 0));
const theirs = (s, p, i) => (p === 0 ? Math.max(-s.pts[real(p, i)], 0) : Math.max(s.pts[real(p, i)], 0));

function allHome(s, p) {
  if (s.bar[p]) return false;
  for (let i = 6; i < 24; i++) if (mine(s, p, i)) return false;
  return true;
}

// Single moves with a given die. from/to are in perspective (BAR = 24, OFF = -1).
function singleMoves(s, p, die) {
  const res = [];
  if (s.bar[p]) {
    const to = 24 - die;
    if (theirs(s, p, to) < 2) res.push({ from: BAR, to, die });
    return res;
  }
  const home = allHome(s, p);
  let highest = -1;
  if (home) for (let i = 5; i >= 0; i--) if (mine(s, p, i)) { highest = i; break; }
  for (let i = 0; i < 24; i++) {
    if (!mine(s, p, i)) continue;
    const to = i - die;
    if (to >= 0) {
      if (theirs(s, p, to) < 2) res.push({ from: i, to, die });
    } else if (home && (to === -1 || i === highest)) {
      res.push({ from: i, to: OFF, die });
    }
  }
  return res;
}

// Applies a single move (in perspective) to a copy of the state.
export function applySingle(s, p, m) {
  const n = cloneState(s);
  const sign = p === 0 ? 1 : -1;
  let hit = false;
  if (m.from === BAR) n.bar[p]--;
  else n.pts[real(p, m.from)] -= sign;
  if (m.to === OFF) n.off[p]++;
  else {
    const r = real(p, m.to);
    if (n.pts[r] === -sign) {
      n.pts[r] = 0;
      n.bar[1 - p]++;
      hit = true;
    }
    n.pts[r] += sign;
  }
  return { state: n, hit };
}

// All legal full sequences for the roll (with the maximum-use rule).
export function legalSequences(s, p, dice) {
  const seqs = [];
  const dieOrders = dice[0] === dice[1] ? [[dice[0], dice[0], dice[0], dice[0]]] : [[dice[0], dice[1]], [dice[1], dice[0]]];
  for (const order of dieOrders) {
    const rec = (st, idx, path) => {
      if (idx === order.length) {
        seqs.push({ moves: path, state: st });
        return;
      }
      const ms = singleMoves(st, p, order[idx]);
      if (!ms.length) {
        seqs.push({ moves: path, state: st });
        return;
      }
      for (const m of ms) {
        const { state, hit } = applySingle(st, p, m);
        rec(state, idx + 1, [...path, { ...m, hit }]);
      }
    };
    rec(s, 0, []);
  }
  const maxLen = Math.max(0, ...seqs.map((q) => q.moves.length));
  let valid = seqs.filter((q) => q.moves.length === maxLen);
  if (maxLen === 1 && dice[0] !== dice[1]) {
    const big = Math.max(...dice);
    if (valid.some((q) => q.moves[0].die === big)) valid = valid.filter((q) => q.moves[0].die === big);
  }
  // removing duplicate end positions
  const seen = new Set();
  return valid.filter((q) => {
    const k = q.state.pts.join(',') + '|' + q.state.bar + '|' + q.state.off + '|' + q.moves.map((m) => m.from + '>' + m.to).join(' ');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Converts a move from perspective to real coordinates (for rendering).
export function toReal(p, m) {
  return {
    from: m.from === BAR ? 'bar' : real(p, m.from),
    to: m.to === OFF ? 'off' : real(p, m.to),
    die: m.die,
    hit: m.hit,
  };
}

export function pipCount(s, p) {
  let n = s.bar[p] * 25;
  for (let i = 0; i < 24; i++) n += mine(s, p, i) * (i + 1);
  return n;
}

export function winner(s) {
  if (s.off[0] === 15) return 0;
  if (s.off[1] === 15) return 1;
  return -1;
}

// 1 = single, 2 = gammon (the loser has not borne off), 3 = backgammon (the loser has a checker on the bar/in the winner's home).
export function winPoints(s, w) {
  const l = 1 - w;
  if (s.off[l] > 0) return 1;
  let inWinnerHome = s.bar[l] > 0;
  for (let i = 18; i < 24; i++) if (mine(s, l, i)) inWinnerHome = true;
  return inWinnerHome ? 3 : 2;
}

// ---------- AI ----------
// Probability of a checker being hit from distance d (a rough approximation by combinations out of 36).
const HIT_ODDS = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1];

function evaluate(s, p) {
  const o = 1 - p;
  let score = 0;
  const myPip = pipCount(s, p), opPip = pipCount(s, o);
  score += (opPip - myPip) * 1.0;
  score += s.off[p] * 6 - s.off[o] * 6;
  score -= s.bar[p] * 18;
  score += s.bar[o] * 14;

  // opposing checkers in p's perspective: are the ones in front at higher indexes? The opponent comes from 0 to 23 in our perspective.
  const oppPositions = [];
  for (let i = 0; i < 24; i++) if (theirs(s, p, i)) oppPositions.push(i);
  const oppBar = s.bar[o] > 0;
  const contact = oppPositions.some((oi) => [...Array(24).keys()].some((i) => mine(s, p, i) && i > oi)) || oppBar;

  let blots = 0;
  let madePoints = 0;
  let prime = 0, run = 0;
  for (let i = 0; i < 24; i++) {
    const c = mine(s, p, i);
    if (c >= 2) {
      madePoints++;
      run++;
      prime = Math.max(prime, run);
      if (i < 6) score += 5; // a point in the home
      else if (i < 12) score += 2.5;
      if (c > 4) score -= (c - 4) * 1.2;
    } else run = 0;
    if (c === 1 && contact) {
      // how many opposing checkers can hit (they come from below in our perspective = index < i)
      let odds = 0;
      for (const oi of oppPositions) if (oi < i) odds = Math.max(odds, HIT_ODDS[Math.min(24, i - oi)] || 0);
      if (oppBar) odds = Math.max(odds, HIT_ODDS[Math.min(24, i + 1)] || 0);
      const danger = (24 - i) / 24 + 0.5; // it's more dangerous close to the opponent's home
      blots += odds * danger;
    }
  }
  score -= blots * 1.6;
  score += prime >= 3 ? prime * prime * 1.5 : 0;
  score += madePoints * 1.5;
  if (!contact) score = (opPip - myPip) * 2 + s.off[p] * 10 - s.off[o] * 10;
  return score;
}

export function chooseSequence(s, p, dice, level = 'medium') {
  const seqs = legalSequences(s, p, dice);
  if (seqs.length <= 1) return seqs[0] || { moves: [], state: s };
  const noise = level === 'easy' ? 25 : level === 'medium' ? 4 : 0;
  let best = null, bestScore = -Infinity;
  for (const q of seqs) {
    const sc = evaluate(q.state, p) + (Math.random() * 2 - 1) * noise;
    if (sc > bestScore) {
      bestScore = sc;
      best = q;
    }
  }
  return best;
}

export function rollDice() {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return [(a[0] % 6) + 1, (a[1] % 6) + 1];
}
