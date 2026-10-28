// Blato (3-5-8): three players, 52 cards, 16 cards each and 4 in the "swamp".
// The dealer must take 8 tricks, the next player 5, the third 3.
// Play goes counter-clockwise: next player = (p + 1) % 3.

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['C', 'D', 'H', 'S'];
export const power = (c) => RANKS.indexOf(c.r);
export const next = (p) => (p + 1) % 3;

// Goal for each player relative to the dealer.
export const targetOf = (p, dealer) => [8, 5, 3][(p - dealer + 3) % 3];

export function deal(deck) {
  return { hands: [deck.slice(0, 16), deck.slice(16, 32), deck.slice(32, 48)], kitty: deck.slice(48) };
}

export function legalCards(hand, trick) {
  if (!trick.length) return hand;
  const led = trick[0].card.s;
  const same = hand.filter((c) => c.s === led);
  return same.length ? same : hand;
}

export function trickWinner(trick, trump) {
  let best = trick[0];
  for (const t of trick.slice(1)) {
    const b = best.card, c = t.card;
    if (c.s === b.s ? power(c) > power(b) : c.s === trump) best = t;
  }
  return best.p;
}

/**
 * Exchange at the start of a deal based on the previous one: a player who took more than their goal
 * gives as many cards as they took in excess to those who fell short, and they return
 * their strongest card of the same suit (or the same card if they have no other of that suit).
 * Returns a list { from, to, count } in execution order.
 */
export function exchangePlan(diff, dealer) {
  const ups = [0, 1, 2].filter((p) => diff[p] > 0);
  const downs = [0, 1, 2].filter((p) => diff[p] < 0);
  const plan = [];
  if (ups.length === 1) {
    // one ahead: gives each player who fell short as many cards as they lacked
    for (const d of downs) plan.push({ from: ups[0], to: d, count: -diff[d] });
  } else if (ups.length === 2) {
    // two ahead: first the one with the higher goal for the new deal
    ups.sort((a, b) => targetOf(b, dealer) - targetOf(a, dealer));
    for (const u of ups) plan.push({ from: u, to: downs[0], count: diff[u] });
  }
  return plan.filter((x) => x.count > 0);
}

// What the receiver returns for each received card: the strongest of the same suit.
export function returnCards(hand, received) {
  const h = [...hand, ...received];
  const back = [];
  for (const c of received) {
    const same = h.filter((x) => x.s === c.s && !back.includes(x));
    same.sort((a, b) => power(b) - power(a));
    back.push(same[0] || c);
  }
  return back;
}

// ---------- AI ----------
const suitScore = (hand, s) => {
  const cs = hand.filter((c) => c.s === s);
  return cs.length * 2 + cs.reduce((a, c) => a + Math.max(0, power(c) - 7) * 0.8, 0);
};

export function aiTrump(hand) {
  return [...SUITS].sort((a, b) => suitScore(hand, b) - suitScore(hand, a))[0];
}

// Gives away the weakest cards (keeps aces, kings and trumps if known).
export function aiGive(hand, count, trump = null) {
  return [...hand]
    .sort((a, b) => (a.s === trump) - (b.s === trump) || power(a) - power(b))
    .slice(0, count);
}

// Discards 4 cards: the weakest non-trumps, preferring to leave short suits empty.
export function aiDiscard(hand, trump) {
  const count = (s) => hand.filter((c) => c.s === s).length;
  return [...hand]
    .filter((c) => c.s !== trump)
    .sort((a, b) => power(a) - power(b) + (count(a.s) - count(b.s)) * 0.6)
    .slice(0, 4);
}

export function aiPlay({ hand, trick, trump, played }) {
  const legal = legalCards(hand, trick);
  const byPow = (a, b) => power(a) - power(b);
  if (!trick.length) {
    // leads with the highest safe card (no higher unplayed card in the suit), otherwise with the lowest
    const sure = legal.filter((c) => RANKS.slice(power(c) + 1).every((r) => played.has(r + c.s) || hand.some((x) => x.s === c.s && x.r === r)));
    const nonTrumpSure = sure.filter((c) => c.s !== trump);
    if (nonTrumpSure.length) return nonTrumpSure.sort(byPow).pop();
    if (sure.length) return sure.sort(byPow).pop();
    const nonTrump = legal.filter((c) => c.s !== trump);
    return (nonTrump.length ? nonTrump : legal).sort(byPow)[0];
  }
  const winsWith = (c) => trickWinner([...trick, { p: -1, card: c }], trump) === -1;
  const winning = legal.filter(winsWith).sort(byPow);
  if (winning.length) {
    // last player or a sure win – takes with the cheapest winning card
    return trick.length === 2 ? winning[0] : winning[winning.length - 1].s === trump ? winning[0] : winning[winning.length - 1];
  }
  return legal.sort(byPow)[0];
}
