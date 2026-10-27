// Шахматни правила: генериране на ходове, проверка за шах/мат/пат/реми, SAN нотация.
// Полета: 0 = a8 ... 63 = h1. ред = sq >> 3 (0 е 8-ми ред), колона = sq & 7.
// Фигури: 'PNBRQK' бели, 'pnbrqk' черни, null празно.

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export const colorOf = (p) => (p ? (p < 'a' ? 'w' : 'b') : null);
export const sqName = (sq) => 'abcdefgh'[sq & 7] + (8 - (sq >> 3));
export const sqFromName = (n) => (8 - Number(n[1])) * 8 + 'abcdefgh'.indexOf(n[0]);
const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function fromFEN(fen) {
  const [placement, turn, castle, ep, half, full] = fen.split(' ');
  const board = [];
  for (const ch of placement.replace(/\//g, '')) {
    if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) board.push(null);
    else board.push(ch);
  }
  return {
    board,
    turn,
    castle: castle === '-' ? '' : castle,
    ep: ep === '-' ? -1 : sqFromName(ep),
    half: Number(half) || 0,
    full: Number(full) || 1,
  };
}

export function toFEN(st) {
  let s = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = st.board[r * 8 + c];
      if (!p) empty++;
      else {
        if (empty) s += empty;
        empty = 0;
        s += p;
      }
    }
    if (empty) s += empty;
    if (r < 7) s += '/';
  }
  return `${s} ${st.turn} ${st.castle || '-'} ${st.ep >= 0 ? sqName(st.ep) : '-'} ${st.half} ${st.full}`;
}

export function positionKey(st) {
  return st.board.map((p) => p || '.').join('') + st.turn + st.castle + st.ep;
}

export function isAttacked(board, sq, by) {
  const r = sq >> 3, c = sq & 7;
  const white = by === 'w';
  // пешки
  const pr = white ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    if (onBoard(pr, c + dc) && board[pr * 8 + c + dc] === (white ? 'P' : 'p')) return true;
  }
  for (const [dr, dc] of KNIGHT) {
    if (onBoard(r + dr, c + dc) && board[(r + dr) * 8 + c + dc] === (white ? 'N' : 'n')) return true;
  }
  for (const [dr, dc] of KING) {
    if (onBoard(r + dr, c + dc) && board[(r + dr) * 8 + c + dc] === (white ? 'K' : 'k')) return true;
  }
  const slide = (dirs, a, b) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (onBoard(rr, cc)) {
        const p = board[rr * 8 + cc];
        if (p) {
          if (p === a || p === b) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
    return false;
  };
  return white ? slide(DIAG, 'B', 'Q') || slide(ORTH, 'R', 'Q') : slide(DIAG, 'b', 'q') || slide(ORTH, 'r', 'q');
}

export function kingSquare(board, color) {
  return board.indexOf(color === 'w' ? 'K' : 'k');
}

export function inCheck(st, color = st.turn) {
  return isAttacked(st.board, kingSquare(st.board, color), color === 'w' ? 'b' : 'w');
}

function pseudoMoves(st) {
  const { board, turn } = st;
  const moves = [];
  const enemy = turn === 'w' ? 'b' : 'w';
  const add = (from, to, extra) => moves.push({ from, to, piece: board[from], captured: board[to], ...extra });

  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p || colorOf(p) !== turn) continue;
    const r = sq >> 3, c = sq & 7;
    const t = p.toUpperCase();

    if (t === 'P') {
      const dir = turn === 'w' ? -1 : 1;
      const startRow = turn === 'w' ? 6 : 1;
      const promoRow = turn === 'w' ? 0 : 7;
      const push = (to, extra = {}) => {
        if (to >> 3 === promoRow) for (const promo of 'qrbn') add(sq, to, { ...extra, promo });
        else add(sq, to, extra);
      };
      const one = (r + dir) * 8 + c;
      if (onBoard(r + dir, c) && !board[one]) {
        push(one);
        const two = (r + 2 * dir) * 8 + c;
        if (r === startRow && !board[two]) add(sq, two, { flag: 'double' });
      }
      for (const dc of [-1, 1]) {
        if (!onBoard(r + dir, c + dc)) continue;
        const to = (r + dir) * 8 + c + dc;
        if (board[to] && colorOf(board[to]) === enemy) push(to);
        else if (to === st.ep) add(sq, to, { flag: 'ep', captured: turn === 'w' ? 'p' : 'P' });
      }
    } else if (t === 'N' || t === 'K') {
      for (const [dr, dc] of t === 'N' ? KNIGHT : KING) {
        if (!onBoard(r + dr, c + dc)) continue;
        const to = (r + dr) * 8 + c + dc;
        if (!board[to] || colorOf(board[to]) === enemy) add(sq, to);
      }
      if (t === 'K') {
        const home = turn === 'w' ? 60 : 4;
        if (sq === home && !isAttacked(board, home, enemy)) {
          const [kSide, qSide] = turn === 'w' ? ['K', 'Q'] : ['k', 'q'];
          if (st.castle.includes(kSide) && !board[home + 1] && !board[home + 2] &&
              board[home + 3] === (turn === 'w' ? 'R' : 'r') &&
              !isAttacked(board, home + 1, enemy) && !isAttacked(board, home + 2, enemy)) {
            add(sq, home + 2, { flag: 'castleK' });
          }
          if (st.castle.includes(qSide) && !board[home - 1] && !board[home - 2] && !board[home - 3] &&
              board[home - 4] === (turn === 'w' ? 'R' : 'r') &&
              !isAttacked(board, home - 1, enemy) && !isAttacked(board, home - 2, enemy)) {
            add(sq, home - 2, { flag: 'castleQ' });
          }
        }
      }
    } else {
      const dirs = t === 'B' ? DIAG : t === 'R' ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (onBoard(rr, cc)) {
          const to = rr * 8 + cc;
          if (board[to]) {
            if (colorOf(board[to]) === enemy) add(sq, to);
            break;
          }
          add(sq, to);
          rr += dr;
          cc += dc;
        }
      }
    }
  }
  return moves;
}

const CORNER_RIGHTS = { 63: 'K', 56: 'Q', 7: 'k', 0: 'q' };

export function makeMove(st, m) {
  const board = st.board.slice();
  const white = st.turn === 'w';
  board[m.to] = m.promo ? (white ? m.promo.toUpperCase() : m.promo) : board[m.from];
  board[m.from] = null;
  if (m.flag === 'ep') board[m.to + (white ? 8 : -8)] = null;
  if (m.flag === 'castleK') {
    board[m.to - 1] = board[m.to + 1];
    board[m.to + 1] = null;
  } else if (m.flag === 'castleQ') {
    board[m.to + 1] = board[m.to - 2];
    board[m.to - 2] = null;
  }
  let castle = st.castle;
  if (castle) {
    if (m.piece === 'K') castle = castle.replace(/[KQ]/g, '');
    if (m.piece === 'k') castle = castle.replace(/[kq]/g, '');
    for (const sq of [m.from, m.to]) if (CORNER_RIGHTS[sq]) castle = castle.replace(CORNER_RIGHTS[sq], '');
  }
  const isPawn = m.piece === 'P' || m.piece === 'p';
  return {
    board,
    turn: white ? 'b' : 'w',
    castle,
    ep: m.flag === 'double' ? (m.from + m.to) / 2 : -1,
    half: isPawn || m.captured ? 0 : st.half + 1,
    full: white ? st.full : st.full + 1,
  };
}

export function legalMoves(st) {
  return pseudoMoves(st).filter((m) => {
    const next = makeMove(st, m);
    return !isAttacked(next.board, kingSquare(next.board, st.turn), next.turn);
  });
}

export function insufficientMaterial(board) {
  const pieces = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (p && p.toUpperCase() !== 'K') pieces.push({ p: p.toUpperCase(), sq });
  }
  if (pieces.length === 0) return true;
  if (pieces.length === 1 && (pieces[0].p === 'B' || pieces[0].p === 'N')) return true;
  if (pieces.every((x) => x.p === 'B')) {
    const shade = (sq) => ((sq >> 3) + (sq & 7)) % 2;
    return pieces.every((x) => shade(x.sq) === shade(pieces[0].sq));
  }
  return false;
}

// Състояние на играта: null ако продължава.
export function gameStatus(st, repetitionCount = 1) {
  const moves = legalMoves(st);
  if (moves.length === 0) {
    return inCheck(st) ? { over: true, reason: 'checkmate', winner: st.turn === 'w' ? 'b' : 'w' } : { over: true, reason: 'stalemate' };
  }
  if (st.half >= 100) return { over: true, reason: 'fifty' };
  if (repetitionCount >= 3) return { over: true, reason: 'repetition' };
  if (insufficientMaterial(st.board)) return { over: true, reason: 'material' };
  return null;
}

export function toSAN(st, m, legal = legalMoves(st)) {
  let san;
  if (m.flag === 'castleK') san = 'O-O';
  else if (m.flag === 'castleQ') san = 'O-O-O';
  else {
    const t = m.piece.toUpperCase();
    const capture = !!m.captured;
    if (t === 'P') {
      san = (capture ? 'abcdefgh'[m.from & 7] + 'x' : '') + sqName(m.to);
      if (m.promo) san += '=' + m.promo.toUpperCase();
    } else {
      const rivals = legal.filter((x) => x.piece === m.piece && x.to === m.to && x.from !== m.from);
      let dis = '';
      if (rivals.length) {
        const sameFile = rivals.some((x) => (x.from & 7) === (m.from & 7));
        const sameRank = rivals.some((x) => x.from >> 3 === m.from >> 3);
        if (!sameFile) dis = 'abcdefgh'[m.from & 7];
        else if (!sameRank) dis = String(8 - (m.from >> 3));
        else dis = sqName(m.from);
      }
      san = t + dis + (capture ? 'x' : '') + sqName(m.to);
    }
  }
  const next = makeMove(st, m);
  if (inCheck(next)) san += legalMoves(next).length === 0 ? '#' : '+';
  return san;
}
