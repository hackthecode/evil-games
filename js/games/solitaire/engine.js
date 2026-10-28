// Klondike solitaire: rules, moves, hints and automatic finishing.
// Card: { s, r, id, up }. Places: { t: 'stock' | 'waste' | 'found' | 'tab', i, k }.

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const rankOf = (c) => RANKS.indexOf(c.r) + 1;
const red = (c) => c.s === 'H' || c.s === 'D';

export function newGame(deck, draw = 1) {
  const cards = deck.map((c) => ({ ...c, up: false }));
  const tab = [[], [], [], [], [], [], []];
  let k = 0;
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j <= i; j++) tab[i].push(cards[k++]);
    tab[i][i].up = true;
  }
  return { stock: cards.slice(k), waste: [], found: [[], [], [], []], tab, draw, moves: 0, passes: 0 };
}

export const clone = (st) => ({
  ...st,
  stock: st.stock.map((c) => ({ ...c })),
  waste: st.waste.map((c) => ({ ...c })),
  found: st.found.map((f) => f.map((c) => ({ ...c }))),
  tab: st.tab.map((p) => p.map((c) => ({ ...c }))),
});

export const top = (a) => a[a.length - 1];
export const foundCount = (st) => st.found.reduce((a, f) => a + f.length, 0);
export const isWon = (st) => foundCount(st) === 52;

export function canFound(card, f) {
  const t = top(f);
  return t ? t.s === card.s && rankOf(card) === rankOf(t) + 1 : card.r === 'A';
}

export function canTab(card, pile) {
  const t = top(pile);
  return t ? t.up && red(t) !== red(card) && rankOf(card) === rankOf(t) - 1 : card.r === 'K';
}

// The cards that move from a given place (in a column – from card k to the end).
export function picked(st, from) {
  if (from.t === 'waste') return st.waste.length ? [top(st.waste)] : [];
  if (from.t === 'found') return st.found[from.i].length ? [top(st.found[from.i])] : [];
  if (from.t === 'tab') {
    const p = st.tab[from.i];
    if (from.k < 0 || from.k >= p.length || !p[from.k].up) return [];
    return p.slice(from.k);
  }
  return [];
}

export function canMove(st, from, to) {
  const cards = picked(st, from);
  if (!cards.length) return false;
  if (to.t === 'found') return cards.length === 1 && from.t !== 'found' && canFound(cards[0], st.found[to.i]);
  if (to.t === 'tab') return !(from.t === 'tab' && from.i === to.i) && canTab(cards[0], st.tab[to.i]);
  return false;
}

// Applies a move (without checking) and turns up the new top card in the column.
export function applyMove(st, from, to) {
  const n = clone(st);
  let cards;
  if (from.t === 'waste') cards = [n.waste.pop()];
  else if (from.t === 'found') cards = [n.found[from.i].pop()];
  else cards = n.tab[from.i].splice(from.k);
  (to.t === 'found' ? n.found[to.i] : n.tab[to.i]).push(...cards);
  if (from.t === 'tab') {
    const t = top(n.tab[from.i]);
    if (t && !t.up) t.up = true;
  }
  n.moves++;
  return n;
}

// Draws from the stock (1 or 3 cards); empty stock → turns the waste back over.
export function drawCards(st) {
  const n = clone(st);
  if (!n.stock.length) {
    if (!n.waste.length) return n;
    n.stock = n.waste.reverse().map((c) => ({ ...c, up: false }));
    n.waste = [];
    n.passes++;
  } else {
    for (let i = 0; i < n.draw && n.stock.length; i++) n.waste.push({ ...n.stock.pop(), up: true });
  }
  n.moves++;
  return n;
}

// The best target for the card on tap: foundation, then a column with cards, then an empty column.
export function smartTarget(st, from) {
  const cards = picked(st, from);
  if (!cards.length) return null;
  if (cards.length === 1 && from.t !== 'found') {
    for (let i = 0; i < 4; i++) if (canFound(cards[0], st.found[i])) return { t: 'found', i };
  }
  const order = [...Array(7).keys()].sort((a, b) => (st.tab[a].length ? 0 : 1) - (st.tab[b].length ? 0 : 1));
  for (const i of order) {
    // a king from an empty column to another empty column is a pointless move
    if (!st.tab[i].length && from.t === 'tab' && from.k === 0) continue;
    if (canMove(st, from, { t: 'tab', i })) return { t: 'tab', i };
  }
  return null;
}

// Useful moves for a hint (without pointless back-and-forth moves).
export function hints(st) {
  const res = [];
  const add = (from, to) => res.push({ from, to });
  for (let i = 0; i < 7; i++) {
    const p = st.tab[i];
    if (!p.length) continue;
    const t = { t: 'tab', i, k: p.length - 1 };
    for (let f = 0; f < 4; f++) if (canMove(st, t, { t: 'found', i: f })) add(t, { t: 'found', i: f });
  }
  if (st.waste.length) {
    const w = { t: 'waste' };
    for (let f = 0; f < 4; f++) if (canMove(st, w, { t: 'found', i: f })) add(w, { t: 'found', i: f });
  }
  for (let i = 0; i < 7; i++) {
    const p = st.tab[i];
    const k = p.findIndex((c) => c.up);
    if (k < 0) continue;
    // we move the whole face-up part only if it uncovers a card or frees a column for a king
    if (k === 0 && p[0].r === 'K') continue;
    for (let j = 0; j < 7; j++) if (canMove(st, { t: 'tab', i, k }, { t: 'tab', i: j })) add({ t: 'tab', i, k }, { t: 'tab', i: j });
  }
  if (st.waste.length) {
    for (let j = 0; j < 7; j++) if (canMove(st, { t: 'waste' }, { t: 'tab', i: j })) add({ t: 'waste' }, { t: 'tab', i: j });
  }
  return res;
}

// Automatic finishing is possible when all cards in the columns are face up.
export const canAutoFinish = (st) => !isWon(st) && st.tab.every((p) => p.every((c) => c.up));

// The next move in automatic finishing: a card to the foundation or a draw.
export function autoStep(st) {
  for (let i = 0; i < 7; i++) {
    const p = st.tab[i];
    if (!p.length) continue;
    for (let f = 0; f < 4; f++) {
      if (canFound(top(p), st.found[f])) return { from: { t: 'tab', i, k: p.length - 1 }, to: { t: 'found', i: f } };
    }
  }
  if (st.waste.length) {
    for (let f = 0; f < 4; f++) if (canFound(top(st.waste), st.found[f])) return { from: { t: 'waste' }, to: { t: 'found', i: f } };
  }
  if (st.stock.length || st.waste.length) return { draw: true };
  return null;
}
