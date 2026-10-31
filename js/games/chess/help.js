// Chess help for beginners: how each piece moves, which of your pieces are in danger,
// a warning before a move that loses material (or allows a mate in one) and a suggested move.
import { txt, lang } from '../../i18n.js';
import { legalMoves, makeMove, inCheck, isAttacked, sqName, colorOf } from './engine.js';
import { search, LEVELS } from './ai.js';

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const val = (p) => VAL[p.toLowerCase()];
const other = (c) => (c === 'w' ? 'b' : 'w');

// the piece names clash with card and Evil Empires words ("King" = a playing card), so they are chosen here
const NAME = lang === 'bg'
  ? { k: 'Цар', q: 'Царица', r: 'Топ', b: 'Офицер', n: 'Кон', p: 'Пешка' }
  : { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };

export const PIECES = {
  k: { name: NAME.k, moves: txt('Moves one square in any direction. It must never stay in check – protect it!') },
  q: { name: NAME.q, moves: txt('The strongest piece: moves any number of squares in a straight line or diagonally. Worth 9.') },
  r: { name: NAME.r, moves: txt('Moves any number of squares in a straight line – along a row or a column. Worth 5.') },
  b: { name: NAME.b, moves: txt('Moves any number of squares diagonally and always stays on its colour. Worth 3.') },
  n: { name: NAME.n, moves: txt('Moves in an "L": two squares one way and one to the side. The only piece that can jump over others. Worth 3.') },
  p: { name: NAME.p, moves: txt('Moves one square forward (two from its starting square) and captures diagonally. On the last row it becomes a queen. Worth 1.') },
};
export const pieceName = (p) => PIECES[p.toLowerCase()].name;

/** The opponent's captures in position st if it were their move (to see what they attack). */
function capturesBy(st, color) {
  return legalMoves({ ...st, turn: color, ep: -1 }).filter((m) => m.captured);
}

/** My pieces in danger: attacked and not defended, or attacked by a cheaper piece. */
export function threats(st, color) {
  const out = new Map();
  for (const m of capturesBy(st, other(color))) {
    const victim = st.board[m.to];
    if (!victim || colorOf(victim) !== color || victim.toLowerCase() === 'k') continue;
    const defended = isAttacked(st.board, m.to, color);
    if (!defended || val(m.piece) < val(victim)) out.set(m.to, { sq: m.to, piece: victim, by: m.piece });
  }
  return [...out.values()];
}

/**
 * What can go wrong after my move m: { kind: 'mate' } | { kind: 'loss', piece, sq, by } | null.
 * Looks one reply ahead: a mate in one, or a capture that wins material for the opponent.
 */
export function blunder(st, m) {
  const me = st.turn;
  const after = makeMove(st, m);
  const replies = legalMoves(after);
  for (const r of replies) {
    const s2 = makeMove(after, r);
    if (inCheck(s2) && legalMoves(s2).length === 0) return { kind: 'mate' };
  }
  const gotNow = m.captured ? val(m.captured) : 0;
  let worst = null;
  for (const r of replies) {
    if (!r.captured || r.captured.toLowerCase() === 'k') continue;
    const defended = isAttacked(makeMove(after, r).board, r.to, me);
    const gain = val(r.captured) - (defended ? val(r.piece) : 0) - gotNow;
    if (gain >= 2 && (!worst || gain > worst.gain)) worst = { kind: 'loss', piece: r.captured, sq: r.to, by: r.piece, gain };
  }
  return worst;
}

export function blunderText(b) {
  if (b.kind === 'mate') return txt('After this move the opponent can checkmate you in one move!');
  return txt('After this move the opponent can take your {0} on {1} with their {2} – you lose material.', pieceName(b.piece), sqName(b.sq), pieceName(b.by).toLowerCase());
}

/** A good move for the player to move (a short search) and a sentence about it. */
export function suggest(st) {
  const m = search(st, LEVELS.medium);
  if (!m) return null;
  const after = makeMove(st, m);
  let why;
  if (inCheck(after) && legalMoves(after).length === 0) why = txt('checkmate!');
  else if (m.captured) why = txt('it takes the {0}', pieceName(m.captured).toLowerCase());
  else if (inCheck(after)) why = txt('it gives check');
  else if (m.promo) why = txt('the pawn becomes a queen');
  else if (threats(st, st.turn).some((t) => t.sq === m.from)) why = txt('it saves a piece that was in danger');
  else why = txt('it improves your position');
  return { move: m, text: txt('{0} from {1} to {2} – {3}.', pieceName(m.piece), sqName(m.from), sqName(m.to), why) };
}
