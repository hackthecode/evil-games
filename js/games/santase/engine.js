// Santase (66): rules and AI. Players: 0 = you, 1 = computer.

export const RANKS = ['9', 'J', 'Q', 'K', '10', 'A'];
const ORDER = { 9: 0, J: 1, Q: 2, K: 3, 10: 4, A: 5 };
export const PTS = { 9: 0, J: 2, Q: 3, K: 4, 10: 10, A: 11 };
export const order = (c) => ORDER[c.r];

export function newDeal(deck, dealer) {
  const leader = 1 - dealer;
  const hands = [[], []];
  let k = 0;
  for (const cnt of [3, 3]) {
    for (const p of [leader, dealer]) for (let i = 0; i < cnt; i++) hands[p].push(deck[k++]);
  }
  const rest = deck.slice(k); // 12 cards; the first is the face-up trump (at the bottom)
  const trumpCard = rest[0];
  return {
    hands,
    stock: rest, // stock[0] = the face-up trump, drawing from the end
    trump: trumpCard.s,
    closedBy: -1,
    leader,
    lead: null, // the first card played in the current trick
    points: [0, 0],
    pending: [0, 0], // 20/40 declared before the first trick taken
    tricks: [0, 0],
    marriages: [[], []],
    lastWinner: -1,
    winner: -1,
  };
}

export const isStrict = (d) => d.closedBy >= 0 || d.stock.length === 0;

export function legalCards(d, p) {
  const hand = d.hands[p];
  if (!d.lead || !isStrict(d)) return hand.slice();
  const L = d.lead.card;
  const same = hand.filter((c) => c.s === L.s);
  if (same.length) {
    const higher = same.filter((c) => order(c) > order(L));
    return higher.length ? higher : same;
  }
  const trumps = hand.filter((c) => c.s === d.trump);
  return trumps.length ? trumps : hand.slice();
}

export function beats(lead, resp, trump) {
  if (resp.s === lead.s) return order(resp) > order(lead);
  return resp.s === trump;
}

export function marriageFor(d, p, card) {
  if (d.lead || (card.r !== 'K' && card.r !== 'Q')) return 0;
  const other = card.r === 'K' ? 'Q' : 'K';
  if (!d.hands[p].some((c) => c.s === card.s && c.r === other)) return 0;
  return card.s === d.trump ? 40 : 20;
}

export const canExchange = (d, p) =>
  !d.lead && d.leader === p && d.closedBy < 0 && d.stock.length > 2 && d.tricks[p] > 0 &&
  d.hands[p].some((c) => c.s === d.trump && c.r === '9');

export const canClose = (d, p) => !d.lead && d.leader === p && d.closedBy < 0 && d.stock.length > 2;

export function exchange(d, p) {
  const i = d.hands[p].findIndex((c) => c.s === d.trump && c.r === '9');
  const nine = d.hands[p][i];
  d.hands[p][i] = d.stock[0];
  d.stock[0] = nine;
}

const total = (d, p) => d.points[p] + (d.tricks[p] > 0 ? d.pending[p] : 0);
export const scoreOf = total;

// Plays a card. Returns an event {type: 'lead'|'trick', marriage, trickWinner, ...}.
export function play(d, p, card) {
  d.hands[p] = d.hands[p].filter((c) => c.id !== card.id);
  if (!d.lead) {
    const m = marriageFor(d, p, card);
    if (m) {
      d.marriages[p].push(card.s);
      if (d.tricks[p] > 0) d.points[p] += m;
      else d.pending[p] += m;
    }
    d.lead = { p, card };
    if (m && d.tricks[p] > 0 && total(d, p) >= 66) d.winner = p;
    return { type: 'lead', marriage: m };
  }
  const lead = d.lead;
  const w = beats(lead.card, card, d.trump) ? p : lead.p;
  d.points[w] += PTS[lead.card.r] + PTS[card.r];
  d.tricks[w]++;
  if (d.pending[w]) {
    d.points[w] += d.pending[w];
    d.pending[w] = 0;
  }
  d.lead = null;
  d.leader = w;
  d.lastWinner = w;
  let drew = null;
  if (d.closedBy < 0 && d.stock.length) {
    const a = d.stock.pop();
    const b = d.stock.pop();
    d.hands[w].push(a);
    d.hands[1 - w].push(b);
    drew = [a, b];
  }
  if (total(d, w) >= 66) d.winner = w;
  else if (!d.hands[0].length && !d.hands[1].length) d.winner = d.closedBy >= 0 ? 1 - d.closedBy : w;
  return { type: 'trick', winner: w, cards: [lead.card, card], drew };
}

// Match points at the end of the deal.
export function dealResult(d) {
  const w = d.winner;
  const l = 1 - w;
  if (d.closedBy === l) return { winner: w, gp: 3, reason: 'closedFail' };
  if (d.closedBy === w && total(d, w) < 66) return { winner: l, gp: 3, reason: 'closedFail' };
  const lp = total(d, l);
  const gp = d.tricks[l] === 0 ? 3 : lp < 33 ? 2 : 1;
  return { winner: w, gp, reason: total(d, w) >= 66 ? '66' : 'last' };
}

// ---------- AI ----------
function unseenHigher(card, d, p, seen) {
  // is there an unseen higher card of the same suit
  for (const r of RANKS) {
    if (ORDER[r] <= ORDER[card.r]) continue;
    const id = r + card.s;
    if (!seen.has(id)) return true;
  }
  return false;
}

export function aiDecideAction(d, p, seen) {
  // actions before leading: exchanging the 9 and closing
  const acts = [];
  if (canExchange(d, p)) acts.push('exchange');
  if (canClose(d, p)) {
    const hand = d.hands[p];
    const s = new Set(seen);
    hand.forEach((c) => s.add(c.id));
    let sure = total(d, p) + d.pending[p] * (d.tricks[p] ? 0 : 1);
    for (const c of hand) {
      if (c.s === d.trump && !unseenHigher(c, d, p, s)) sure += PTS[c.r] + 4;
      else if (c.s !== d.trump && c.r === 'A') sure += 11;
    }
    for (const s2 of ['C', 'D', 'H', 'S']) {
      if (hand.some((c) => c.s === s2 && c.r === 'K') && hand.some((c) => c.s === s2 && c.r === 'Q') && d.tricks[p] > 0) sure += s2 === d.trump ? 40 : 20;
    }
    if (sure >= 70 && d.tricks[p] > 0) acts.push('close');
  }
  return acts;
}

export function aiPlay(d, p, seenIds) {
  const legal = legalCards(d, p);
  if (legal.length === 1) return legal[0];
  const seen = new Set(seenIds);
  d.hands[p].forEach((c) => seen.add(c.id));
  const trump = d.trump;
  const inMarriage = (c) => (c.r === 'K' || c.r === 'Q') &&
    d.hands[p].some((x) => x.s === c.s && x.r === (c.r === 'K' ? 'Q' : 'K'));
  const val = (c) => PTS[c.r] + (c.s === trump ? 12 : 0) + (inMarriage(c) ? 15 : 0);
  const lowest = (cards) => cards.slice().sort((a, b) => val(a) - val(b))[0];

  if (!d.lead) {
    // declare 20/40 if possible
    const marriages = legal.filter((c) => marriageFor(d, p, c));
    if (marriages.length) {
      marriages.sort((a, b) => (b.s === trump) - (a.s === trump) || (a.r === 'Q' ? -1 : 1));
      return marriages[0];
    }
    if (isStrict(d)) {
      const masters = legal.filter((c) => !unseenHigher(c, d, p, seen));
      const trumpMasters = masters.filter((c) => c.s === trump);
      if (trumpMasters.length) return trumpMasters.sort((a, b) => order(b) - order(a))[0];
      if (masters.length) return masters.sort((a, b) => PTS[b.r] - PTS[a.r])[0];
      return lowest(legal);
    }
    const nonTrump = legal.filter((c) => c.s !== trump && !inMarriage(c));
    return lowest(nonTrump.length ? nonTrump : legal);
  }

  const L = d.lead.card;
  const winning = legal.filter((c) => beats(L, c, trump));
  const lpts = PTS[L.r];
  if (isStrict(d)) {
    if (winning.length) return winning.sort((a, b) => val(a) - val(b))[0];
    return lowest(legal);
  }
  const sameSuitWins = winning.filter((c) => c.s === L.s);
  if (sameSuitWins.length) {
    const best = sameSuitWins.sort((a, b) => val(b) - val(a))[0]; // take with the strongest (10 or ace bring points)
    const cheap = sameSuitWins.sort((a, b) => val(a) - val(b))[0];
    return lpts >= 10 || PTS[best.r] >= 10 ? (PTS[best.r] >= 10 ? best : cheap) : cheap;
  }
  const trumpWins = winning.filter((c) => c.s === trump && !inMarriage(c));
  if (trumpWins.length && (lpts >= 10 || total(d, p) + lpts >= 50)) {
    return trumpWins.sort((a, b) => order(a) - order(b))[0];
  }
  const throwAway = legal.filter((c) => c.s !== trump && !inMarriage(c));
  return lowest(throwAway.length ? throwAway : legal);
}
