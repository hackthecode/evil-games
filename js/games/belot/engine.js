// Български белот: правила, анонси, точкуване и AI.
// Играчи: 0 = Юг (вие), 1 = Изток, 2 = Север (партньор), 3 = Запад. Ход обратно на часовниковата стрелка: 0→1→2→3.
// Отбори: 0 = играчи 0 и 2, 1 = играчи 1 и 3.

export const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const CONTRACTS = ['C', 'D', 'H', 'S', 'NT', 'AT'];
export const CONTRACT_NAMES = { C: 'Спатия', D: 'Каро', H: 'Купа', S: 'Пика', NT: 'Без коз', AT: 'Всичко коз' };

const NT_ORDER = { 7: 0, 8: 1, 9: 2, J: 3, Q: 4, K: 5, 10: 6, A: 7 };
const TR_ORDER = { 7: 0, 8: 1, Q: 2, K: 3, 10: 4, A: 5, 9: 6, J: 7 };
const NT_PTS = { 7: 0, 8: 0, 9: 0, J: 2, Q: 3, K: 4, 10: 10, A: 11 };
const TR_PTS = { 7: 0, 8: 0, 9: 14, J: 20, Q: 3, K: 4, 10: 10, A: 11 };
const SEQ_IDX = { 7: 0, 8: 1, 9: 2, 10: 3, J: 4, Q: 5, K: 6, A: 7 };

export const teamOf = (p) => p % 2;
export const partnerOf = (p) => (p + 2) % 4;
const isSuitContract = (c) => c.length === 1;

export const isTrump = (card, contract) => contract === 'AT' || card.s === contract;
export const order = (card, contract) => (isTrump(card, contract) ? TR_ORDER : NT_ORDER)[card.r];
export const cardPoints = (card, contract) => (contract === 'NT' ? NT_PTS : isTrump(card, contract) ? TR_PTS : NT_PTS)[card.r];
export const handOrder = (contract) => (c) => order(c, contract) + (isTrump(c, contract) && contract !== 'AT' ? 100 : 0);

// ---------- ръка (взятка) ----------
export function trickWinner(trick, contract) {
  const led = trick[0].card.s;
  let best = trick[0];
  for (const t of trick.slice(1)) {
    const c = t.card, b = best.card;
    const cT = isSuitContract(contract) && c.s === contract;
    const bT = isSuitContract(contract) && b.s === contract;
    if (cT && !bT) best = t;
    else if (cT === bT && c.s === b.s && order(c, contract) > order(b, contract)) best = t;
    else if (!cT && !bT && c.s === led && b.s !== led) best = t;
  }
  return best;
}

export function legalCards(hand, trick, contract, me) {
  if (!trick.length) return hand.slice();
  const led = trick[0].card.s;
  const follow = hand.filter((c) => c.s === led);
  if (follow.length) {
    if (contract === 'AT' || led === contract) {
      const bestLed = trick.filter((t) => t.card.s === led).reduce((a, t) => Math.max(a, order(t.card, contract)), -1);
      const higher = follow.filter((c) => order(c, contract) > bestLed);
      return higher.length ? higher : follow;
    }
    return follow;
  }
  if (isSuitContract(contract)) {
    const winner = trickWinner(trick, contract);
    if (teamOf(winner.p) === teamOf(me)) return hand.slice();
    const trumps = hand.filter((c) => c.s === contract);
    if (trumps.length) {
      const trickTrumps = trick.filter((t) => t.card.s === contract);
      if (trickTrumps.length) {
        const best = Math.max(...trickTrumps.map((t) => order(t.card, contract)));
        const higher = trumps.filter((c) => order(c, contract) > best);
        return higher.length ? higher : hand.slice();
      }
      return trumps;
    }
  }
  return hand.slice();
}

// ---------- анонси ----------
export function findDeclarations(hand, contract) {
  if (contract === 'NT') return [];
  const res = [];
  const used = new Set();
  for (const r of ['J', '9', 'A', '10', 'K', 'Q']) {
    const cards = hand.filter((c) => c.r === r);
    if (cards.length === 4) {
      res.push({ type: 'carre', rank: r, points: r === 'J' ? 200 : r === '9' ? 150 : 100, name: `Каре ${r}` });
      cards.forEach((c) => used.add(c.id));
    }
  }
  for (const s of ['C', 'D', 'H', 'S']) {
    const idxs = hand.filter((c) => c.s === s && !used.has(c.id)).map((c) => SEQ_IDX[c.r]).sort((a, b) => a - b);
    let run = [];
    const flush = () => {
      let len = run.length;
      let top = run[run.length - 1];
      while (len >= 3) {
        const take = Math.min(5, len);
        res.push({
          type: 'seq', len: take, high: top, suit: s,
          points: take === 3 ? 20 : take === 4 ? 50 : 100,
          name: take === 3 ? 'Терца' : take === 4 ? 'Кварта' : 'Квинта',
        });
        len -= take;
        top -= take;
      }
    };
    for (const i of idxs) {
      if (run.length && i !== run[run.length - 1] + 1) {
        flush();
        run = [];
      }
      run.push(i);
    }
    flush();
  }
  return res;
}

const seqKey = (d) => d.len * 10 + d.high;

// Кои анонси се зачитат: последователностите само за отбора с най-високата.
export function resolveDeclarations(declsByPlayer) {
  const pts = [0, 0];
  const bestSeq = [-1, -1];
  for (let p = 0; p < 4; p++) {
    for (const d of declsByPlayer[p] || []) if (d.type === 'seq') bestSeq[teamOf(p)] = Math.max(bestSeq[teamOf(p)], seqKey(d));
  }
  const seqTeam = bestSeq[0] > bestSeq[1] ? 0 : bestSeq[1] > bestSeq[0] ? 1 : -1;
  for (let p = 0; p < 4; p++) {
    for (const d of declsByPlayer[p] || []) {
      if (d.type === 'carre') pts[teamOf(p)] += d.points;
      else if (teamOf(p) === seqTeam) pts[teamOf(p)] += d.points;
    }
  }
  return { pts, seqTeam };
}

// Белот: при изиграване на дама/поп коз, когато другата карта е в ръката.
export function isBelot(card, hand, trick, contract) {
  if (contract === 'NT' || (card.r !== 'K' && card.r !== 'Q')) return false;
  if (!isTrump(card, contract)) return false;
  if (contract === 'AT' && trick.length && trick[0].card.s !== card.s) return false;
  const other = card.r === 'K' ? 'Q' : 'K';
  return hand.some((c) => c.s === card.s && c.r === other);
}

// ---------- точкуване ----------
const roundGP = (x, contract) => {
  const th = isSuitContract(contract) ? 7 : 5;
  return Math.floor(x / 10) + (x % 10 >= th ? 1 : 0);
};

// tricksWon: [{team, points}] ; declPts, belotPts: [a, b] ; mult 1/2/4
export function scoreDeal({ contract, bidTeam, mult, tricks, declPts, belotPts, hanging }) {
  const cardPts = [0, 0];
  const count = [0, 0];
  for (const t of tricks) {
    cardPts[t.team] += t.points;
    count[t.team]++;
  }
  cardPts[tricks[tricks.length - 1].team] += 10;
  if (contract === 'NT') {
    cardPts[0] *= 2;
    cardPts[1] *= 2;
  }
  const capot = count[0] === 8 ? 0 : count[1] === 8 ? 1 : -1;
  const total = [0, 1].map((t) => cardPts[t] + (contract === 'NT' ? 0 : declPts[t] + belotPts[t]) + (capot === t ? 90 : 0));
  const defTeam = 1 - bidTeam;
  let raw = total.slice();
  let outcome = 'made';
  let newHanging = 0;

  if (mult > 1) {
    const w = total[bidTeam] > total[defTeam] ? bidTeam : defTeam;
    raw = [0, 0];
    raw[w] = (total[0] + total[1]) * mult;
    outcome = w === bidTeam ? 'made' : 'inside';
  } else if (total[bidTeam] < total[defTeam]) {
    raw = [0, 0];
    raw[defTeam] = total[0] + total[1];
    outcome = 'inside';
  } else if (total[bidTeam] === total[defTeam]) {
    raw[bidTeam] = 0;
    outcome = 'hanging';
  }
  const gp = raw.map((x) => roundGP(x, contract));
  if (outcome === 'hanging') newHanging = roundGP(total[bidTeam], contract);
  // висящи точки от предишното раздаване отиват при победителя в това
  if (hanging > 0 && outcome !== 'hanging') {
    const w = gp[0] > gp[1] ? 0 : gp[1] > gp[0] ? 1 : -1;
    if (w >= 0) gp[w] += hanging;
    else newHanging += hanging;
  } else if (hanging > 0) newHanging += hanging;
  return { cardPts, total, gp, outcome, capot, hanging: newHanging };
}

// ---------- обявяване ----------
export function legalBids(bidding, player) {
  const cur = bidding.current; // {contract, player, mult}
  const res = ['pass'];
  const idx = cur ? CONTRACTS.indexOf(cur.contract) : -1;
  for (let i = idx + 1; i < CONTRACTS.length; i++) res.push(CONTRACTS[i]);
  if (cur && teamOf(cur.player) !== teamOf(player)) {
    if (cur.mult === 1) res.push('double');
  }
  if (cur && teamOf(cur.player) === teamOf(player) && cur.mult === 2) res.push('redouble');
  return res;
}

// Връща true ако обявяването е приключило.
export function applyBid(bidding, player, bid) {
  bidding.history.push({ player, bid });
  if (bid === 'pass') bidding.passes++;
  else {
    bidding.passes = 0;
    if (bid === 'double') bidding.current.mult = 2;
    else if (bid === 'redouble') bidding.current.mult = 4;
    else bidding.current = { contract: bid, player, mult: 1 };
  }
  if (!bidding.current) return bidding.passes >= 4;
  return bidding.passes >= 3;
}

// ---------- AI ----------
function suitStrength(hand, s) {
  let v = 0;
  const has = (r) => hand.some((c) => c.s === s && c.r === r);
  const n = hand.filter((c) => c.s === s).length;
  if (has('J')) v += 3;
  if (has('9')) v += has('J') ? 2.2 : 1.2;
  if (has('A')) v += 1;
  if (has('10')) v += 0.7;
  v += Math.max(0, n - (has('J') + has('9') + has('A') + has('10'))) * 0.5;
  for (const o of ['C', 'D', 'H', 'S']) {
    if (o === s) continue;
    if (hand.some((c) => c.s === o && c.r === 'A')) v += 0.9;
    if (hand.some((c) => c.s === o && c.r === '10') && hand.some((c) => c.s === o && c.r === 'A')) v += 0.4;
  }
  return v;
}

function allTrumpStrength(hand) {
  let v = 0;
  for (const s of ['C', 'D', 'H', 'S']) {
    const J = hand.some((c) => c.s === s && c.r === 'J');
    const N = hand.some((c) => c.s === s && c.r === '9');
    if (J) v += 2.5;
    if (N) v += J ? 1.6 : 0.7;
    if (hand.some((c) => c.s === s && c.r === 'A') && J) v += 0.5;
  }
  return v;
}

function noTrumpStrength(hand) {
  let v = 0;
  for (const s of ['C', 'D', 'H', 'S']) {
    const A = hand.some((c) => c.s === s && c.r === 'A');
    const T = hand.some((c) => c.s === s && c.r === '10');
    if (A) v += 2.2;
    if (T) v += A ? 1.3 : 0.4;
    if (A && T && hand.some((c) => c.s === s && c.r === 'K')) v += 0.4;
  }
  return v;
}

export function aiBid(hand, bidding, player, aggression = 1) {
  const legal = legalBids(bidding, player);
  const cur = bidding.current;
  const partnerBid = cur && teamOf(cur.player) === teamOf(player);
  const options = [];
  for (const c of CONTRACTS) {
    if (!legal.includes(c)) continue;
    let v, th;
    if (c === 'AT') { v = allTrumpStrength(hand); th = 5.3; }
    else if (c === 'NT') { v = noTrumpStrength(hand); th = 5.6; }
    else { v = suitStrength(hand, c); th = 4.3; }
    if (partnerBid) th += 1.2;
    v *= aggression;
    if (v >= th) options.push({ c, margin: v - th + (c === 'AT' ? 0.3 : c === 'NT' ? 0.2 : 0) });
  }
  if (options.length) {
    options.sort((a, b) => b.margin - a.margin);
    return options[0].c;
  }
  if (legal.includes('double') && cur) {
    const s = cur.contract;
    const v = s === 'AT' ? allTrumpStrength(hand) : s === 'NT' ? noTrumpStrength(hand) : suitStrength(hand, s);
    if (v >= 7.5) return 'double';
  }
  return 'pass';
}

// Изчислява дали картата е „най-силната останала“ в боята си.
function isMaster(card, contract, seen) {
  for (const r of RANKS) {
    const id = r + card.s;
    if (id === card.id || seen.has(id)) continue;
    const other = { r, s: card.s };
    if (order(other, contract) > order(card, contract)) return false;
  }
  return true;
}

// knowledge: { played: Set(id), hand, me, contract, bidTeam }
export function aiPlay({ hand, trick, contract, me, played, bidTeam }) {
  const legal = legalCards(hand, trick, contract, me);
  if (legal.length === 1) return legal[0];
  const seen = new Set(played);
  hand.forEach((c) => seen.add(c.id));
  const pts = (c) => cardPoints(c, contract);
  const trumpLike = (c) => isSuitContract(contract) && c.s === contract;
  const low = (cards) => cards.slice().sort((a, b) => pts(a) - pts(b) || trumpLike(a) - trumpLike(b) || order(a, contract) - order(b, contract))[0];
  const high = (cards) => cards.slice().sort((a, b) => pts(b) - pts(a) || order(b, contract) - order(a, contract))[0];

  if (!trick.length) {
    // извеждане
    if (isSuitContract(contract) && teamOf(me) === bidTeam) {
      const myTrumps = legal.filter((c) => c.s === contract);
      const outstanding = RANKS.filter((r) => !seen.has(r + contract)).length;
      if (myTrumps.length && outstanding > 0) {
        const master = myTrumps.find((c) => isMaster(c, contract, seen));
        if (master) return master;
      }
    }
    const masters = legal.filter((c) => isMaster(c, contract, seen) && !(trumpLike(c) && teamOf(me) !== bidTeam));
    if (masters.length) return high(masters);
    // ниска карта от най-дългата некозова боя, без да се извеждат десетки/аса
    const nonTrump = legal.filter((c) => !trumpLike(c));
    const pool = nonTrump.length ? nonTrump : legal;
    const bySuit = {};
    for (const c of pool) (bySuit[c.s] ||= []).push(c);
    const longest = Object.values(bySuit).sort((a, b) => b.length - a.length)[0];
    return low(longest);
  }

  const winner = trickWinner(trick, contract);
  const partnerWins = teamOf(winner.p) === teamOf(me);
  const last = trick.length === 3;
  const beats = legal.filter((c) => trickWinner([...trick, { p: me, card: c }], contract).p === me);
  const trickPts = trick.reduce((a, t) => a + pts(t.card), 0);

  if (partnerWins) {
    const secure = last || isMaster(winner.card, contract, seen) && !(isSuitContract(contract) && winner.card.s !== contract && trick.length === 1);
    if (secure) {
      const nonMasters = legal.filter((c) => !trumpLike(c) && !(isMaster(c, contract, seen) && c.s !== trick[0].card.s));
      return high(nonMasters.length ? nonMasters : legal.filter((c) => !trumpLike(c)).length ? legal.filter((c) => !trumpLike(c)) : legal);
    }
    return low(legal);
  }
  if (beats.length) {
    if (last) return low(beats);
    const masterBeats = beats.filter((c) => isMaster(c, contract, seen));
    if (masterBeats.length && (trickPts >= 10 || !trumpLike(masterBeats[0]))) return low(masterBeats);
    if (trickPts >= 10) return low(beats);
  }
  return low(legal);
}
