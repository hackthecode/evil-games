// Шахматен AI: негамакс с алфа-бета, итеративно задълбочаване и quiescence търсене.
import { legalMoves, makeMove, inCheck, colorOf } from './engine.js';

const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };

// Таблици позиция-фигура (от гледна точка на белите, индекс 0 = a8).
const PST = {
  P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  KE: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
};

const MATE = 100000;

function evaluate(st) {
  const b = st.board;
  let nonPawn = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p && p !== 'P' && p !== 'p' && p !== 'K' && p !== 'k') nonPawn += VAL[p.toUpperCase()];
  }
  const endgame = nonPawn <= 2600;
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const white = p < 'a';
    const t = p.toUpperCase();
    const idx = white ? i : i ^ 56;
    const table = t === 'K' && endgame ? PST.KE : PST[t];
    const v = VAL[t] + table[idx];
    score += white ? v : -v;
  }
  return st.turn === 'w' ? score : -score;
}

function orderScore(m) {
  let s = 0;
  if (m.captured) s += 10 * VAL[m.captured.toUpperCase()] - VAL[m.piece.toUpperCase()] + 1000;
  if (m.promo) s += 800;
  return s;
}

const sameMove = (a, b) => a && b && a.from === b.from && a.to === b.to && a.promo === b.promo;

export function search(st, { maxDepth = 4, timeMs = 1500, noise = 0 } = {}) {
  const deadline = Date.now() + timeMs;
  let nodes = 0;
  let stop = false;

  function quiesce(s, alpha, beta, qdepth) {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
    const stand = evaluate(s);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;
    if (qdepth > 6) return alpha;
    const caps = legalMoves(s).filter((m) => m.captured || m.promo).sort((a, b) => orderScore(b) - orderScore(a));
    for (const m of caps) {
      const score = -quiesce(makeMove(s, m), -beta, -alpha, qdepth + 1);
      if (stop) return alpha;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(s, depth, alpha, beta, ply) {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
    const moves = legalMoves(s);
    if (moves.length === 0) return inCheck(s) ? -MATE + ply : 0;
    if (s.half >= 100) return 0;
    if (depth <= 0) return quiesce(s, alpha, beta, 0);
    moves.sort((a, b) => orderScore(b) - orderScore(a));
    let best = -Infinity;
    for (const m of moves) {
      const score = -negamax(makeMove(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (stop) return best === -Infinity ? 0 : best;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  const rootMoves = legalMoves(st);
  if (rootMoves.length === 1) return rootMoves[0];
  let bestMove = rootMoves[0];
  let prevBest = null;

  for (let depth = 1; depth <= maxDepth; depth++) {
    const ordered = rootMoves.slice().sort((a, b) =>
      (sameMove(b, prevBest) ? 1e6 : orderScore(b)) - (sameMove(a, prevBest) ? 1e6 : orderScore(a)));
    let alpha = -Infinity;
    let iterBest = null;
    const scored = [];
    for (const m of ordered) {
      const raw = -negamax(makeMove(st, m), depth - 1, -Infinity, -alpha + (noise ? noise : 0), 1);
      if (stop) break;
      const score = raw + (noise ? (Math.random() * 2 - 1) * noise : 0);
      scored.push([m, score]);
      if (score > alpha) {
        alpha = score;
        iterBest = m;
      }
    }
    if (stop && !iterBest) break;
    if (iterBest) bestMove = prevBest = iterBest;
    if (stop || alpha > MATE - 100) break;
  }
  return bestMove;
}

export const LEVELS = {
  easy: { maxDepth: 2, timeMs: 400, noise: 120 },
  medium: { maxDepth: 3, timeMs: 900, noise: 25 },
  hard: { maxDepth: 6, timeMs: 2200, noise: 0 },
};

export { colorOf };
