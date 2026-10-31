// AUTO-GENERATED FILE – do not edit by hand.
// Source: the modules in js/ (see tools/build-referee.py).
// @ts-nocheck
/* eslint-disable */
const __m = {};
__m['js/i18n/tk.js'] = (() => {
// Translatable text for code that also runs on the server (game logic, Supabase Edge Functions).
// tk('English text {0}', arg) returns a compact token; the browser turns it into the player's
// language when it is displayed (see js/i18n.js → decode). Arguments may be tokens themselves.
const T_OPEN = '\u0001', T_SEP = '\u001f', T_CLOSE = '\u0002';

function tk(key, ...args) {
  return T_OPEN + key + args.map((a) => T_SEP + String(a ?? '')).join('') + T_CLOSE;
}

return { T_OPEN, tk };
})();

__m['js/store/hash.js'] = (() => {
// Password hashing: PBKDF2 (Web Crypto) when available.
// Web Crypto requires a "secure context" (https or localhost). When accessed via
// a local IP (e.g. from a phone on the same network) we use a fallback SHA-256.
const { tk } = __m['js/i18n/tk.js'];

const enc = new TextEncoder();

function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  (globalThis.crypto || {}).getRandomValues
    ? crypto.getRandomValues(a)
    : a.forEach((_, i) => (a[i] = (Math.random() * 256) | 0));
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' },
      key,
      256,
    );
    return 'pbkdf2$' + toHex(new Uint8Array(bits));
  }
  let h = salt + ':' + password;
  for (let i = 0; i < 2000; i++) h = sha256(h);
  return 'sha$' + h;
}

async function verifyPassword(password, salt, stored) {
  if (stored.startsWith('sha$')) {
    let h = salt + ':' + password;
    for (let i = 0; i < 2000; i++) h = sha256(h);
    return 'sha$' + h === stored;
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error(tk('This account was created on a secure address (localhost/https). Open the portal from there to log in.'));
  }
  return (await hashPassword(password, salt)) === stored;
}

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// A compact SHA-256 implementation (fallback).
function sha256(str) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bytes = enc.encode(str);
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, len * 8);
  view.setUint32(padded.length - 8, Math.floor((len * 8) / 2 ** 32));
  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H = H.map((v, i) => (v + [a, b, c, d, e, f, g, h][i]) | 0);
  }
  return H.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

return { randomHex, hashPassword, verifyPassword, sha256 };
})();

__m['js/net/rng.js'] = (() => {
// Deterministic random number generator for online games: all clients
// get the same dice/shuffles from the match's shared seed.
const { sha256 } = __m['js/store/hash.js'];

// sfc32, seeded with SHA-256(seed | label). Returns a function → [0, 1).
function seededRng(seed, label) {
  const h = sha256(`${seed}|${label}`);
  let [a, b, c, d] = [0, 8, 16, 24].map((i) => parseInt(h.slice(i, i + 8), 16) >>> 0);
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const r = (t + d) | 0;
    c = (c + r) | 0;
    return (r >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}

// A cryptographically random number – for games against the computer.
function cryptoRng() {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] / 4294967296;
}

return { seededRng, cryptoRng };
})();

__m['js/games/cards/suits.js'] = (() => {
// Vector suit symbols (viewBox 0 0 100 100) – they look the same on all devices.
const { tk } = __m['js/i18n/tk.js'];
const SUIT_PATHS = {
  H: '<path d="M50 90C22 66 4 49 4 29 4 14 15 4 29 4c10 0 17 6 21 14 4-8 11-14 21-14 14 0 25 10 25 25 0 20-18 37-46 61z"/>',
  D: '<path d="M50 3c10 17 24 33 40 47-16 14-30 30-40 47C40 80 26 64 10 50 26 36 40 20 50 3z"/>',
  S: '<path d="M50 4C62 24 94 38 94 61c0 14-10 22-22 22-8 0-14-4-18-10 1 10 6 18 14 23H32c8-5 13-13 14-23-4 6-10 10-18 10-12 0-22-8-22-22C6 38 38 24 50 4z"/>',
  C: '<circle cx="50" cy="28" r="20"/><circle cx="26" cy="58" r="20"/><circle cx="74" cy="58" r="20"/><path d="M44 50h12v8c1 15 6 27 14 38H30c8-11 13-23 14-38z"/>',
};

const SUIT_NAMES = { C: tk('Clubs'), D: tk('Diamonds'), H: tk('Hearts'), S: tk('Spades') };
const isRed = (s) => s === 'H' || s === 'D';

function suitSvg(s, cls = 'suit') {
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${SUIT_PATHS[s]}</svg>`;
}

return { SUIT_PATHS, SUIT_NAMES, isRed, suitSvg };
})();

__m['js/games/cards/cards.js'] = (() => {
// Shared functions for card games: rendering, deck, shuffling.
const { suitSvg, isRed } = __m['js/games/cards/suits.js'];
const { cryptoRng } = __m['js/net/rng.js'];

const SUITS = ['C', 'D', 'H', 'S'];

function makeDeck(ranks) {
  const deck = [];
  for (const s of SUITS) for (const r of ranks) deck.push({ s, r, id: r + s });
  return deck;
}

// rnd: function → [0, 1); in online games it's the match's shared generator.
function shuffle(arr, rnd = cryptoRng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PIPS = {
  2: [[50, 12], [50, 88]],
  3: [[50, 12], [50, 50], [50, 88]],
  4: [[25, 12], [75, 12], [25, 88], [75, 88]],
  5: [[25, 12], [75, 12], [50, 50], [25, 88], [75, 88]],
  6: [[25, 12], [75, 12], [25, 50], [75, 50], [25, 88], [75, 88]],
  7: [[25, 12], [75, 12], [50, 31], [25, 50], [75, 50], [25, 88], [75, 88]],
  8: [[25, 12], [75, 12], [50, 31], [25, 50], [75, 50], [50, 69], [25, 88], [75, 88]],
  9: [[25, 12], [75, 12], [25, 37], [75, 37], [50, 50], [25, 63], [75, 63], [25, 88], [75, 88]],
  10: [[25, 12], [75, 12], [50, 25], [25, 37], [75, 37], [25, 63], [75, 63], [50, 75], [25, 88], [75, 88]],
};

function centerHtml(c) {
  if (PIPS[c.r]) {
    return `<div class="pips">${PIPS[c.r]
      .map(([x, y]) => `<span class="pip${y > 55 ? ' flip' : ''}" style="left:${x}%;top:${y}%">${suitSvg(c.s)}</span>`)
      .join('')}</div>`;
  }
  return `<div class="ace">${suitSvg(c.s)}</div>`;
}

// Face cards (jack, queen, king): English pattern illustrations by Dmitry Fomin (CC0),
// recoloured in the portal's palette. Preloaded so there is no flicker.
const COURT = new Set(['J', 'Q', 'K']);
const courtSrc = (c) => `assets/cards/${c.r}${c.s}.svg`;
if (typeof Image !== 'undefined') for (const s of SUITS) for (const r of COURT) new Image().src = courtSrc({ r, s });

function cardEl(card, { faceDown = false, cls = '' } = {}) {
  const el = document.createElement('div');
  if (faceDown || !card) {
    el.className = `card back ${cls}`;
    el.innerHTML = '<div class="card-back"></div>';
    return el;
  }
  el.className = `card ${isRed(card.s) ? 'red' : 'black'} ${cls}`;
  el.dataset.id = card.id;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', card.r + ' ' + card.s);
  const idx = `<span class="cr">${card.r}</span>${suitSvg(card.s)}`;
  const center = COURT.has(card.r)
    ? `<img class="court-art" src="${courtSrc(card)}" alt="" draggable="false" decoding="async">`
    : `<div class="cc">${centerHtml(card)}</div>`;
  if (COURT.has(card.r)) el.classList.add('court');
  el.innerHTML = `<div class="card-face">
      ${center}
      <div class="ci tl">${idx}</div>
      <div class="ci br">${idx}</div>
    </div>`;
  return el;
}

// Sorts a hand by suit (alternating colours) and strength.
function sortHand(hand, rankOrder, suitOrder = ['S', 'H', 'C', 'D']) {
  return hand.slice().sort((a, b) => {
    const sa = suitOrder.indexOf(a.s), sb = suitOrder.indexOf(b.s);
    if (sa !== sb) return sa - sb;
    return rankOrder(a) - rankOrder(b);
  });
}

// Lays out the cards in the hand as a fan.
function layoutFan(container, { spreadDeg = 5, lift = 0.6 } = {}) {
  const cards = [...container.children];
  const n = cards.length;
  cards.forEach((el, i) => {
    const t = i - (n - 1) / 2;
    el.style.setProperty('--rot', `${t * spreadDeg * (n > 6 ? 6 / n : 1)}deg`);
    el.style.setProperty('--lift', `${Math.abs(t) * Math.abs(t) * lift}px`);
    el.style.zIndex = i + 1;
  });
}

return { SUITS, makeDeck, shuffle, cardEl, sortHand, layoutFan };
})();

__m['js/games/belot/engine.js'] = (() => {
// Bulgarian belot: rules, declarations, scoring and AI.
// Players: 0 = South (you), 1 = East, 2 = North (partner), 3 = West. Turns go counter-clockwise: 0→1→2→3.
// Teams: 0 = players 0 and 2, 1 = players 1 and 3.
const { tk } = __m['js/i18n/tk.js'];

const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const CONTRACTS = ['C', 'D', 'H', 'S', 'NT', 'AT'];
const CONTRACT_NAMES = { C: tk('Clubs'), D: tk('Diamonds'), H: tk('Hearts'), S: tk('Spades'), NT: tk('No trumps'), AT: tk('All trumps') };

const NT_ORDER = { 7: 0, 8: 1, 9: 2, J: 3, Q: 4, K: 5, 10: 6, A: 7 };
const TR_ORDER = { 7: 0, 8: 1, Q: 2, K: 3, 10: 4, A: 5, 9: 6, J: 7 };
const NT_PTS = { 7: 0, 8: 0, 9: 0, J: 2, Q: 3, K: 4, 10: 10, A: 11 };
const TR_PTS = { 7: 0, 8: 0, 9: 14, J: 20, Q: 3, K: 4, 10: 10, A: 11 };
const SEQ_IDX = { 7: 0, 8: 1, 9: 2, 10: 3, J: 4, Q: 5, K: 6, A: 7 };

const teamOf = (p) => p % 2;
const partnerOf = (p) => (p + 2) % 4;
const isSuitContract = (c) => c.length === 1;

const isTrump = (card, contract) => contract === 'AT' || card.s === contract;
const order = (card, contract) => (isTrump(card, contract) ? TR_ORDER : NT_ORDER)[card.r];
const cardPoints = (card, contract) => (contract === 'NT' ? NT_PTS : isTrump(card, contract) ? TR_PTS : NT_PTS)[card.r];
const handOrder = (contract) => (c) => order(c, contract) + (isTrump(c, contract) && contract !== 'AT' ? 100 : 0);

// ---------- trick ----------
function trickWinner(trick, contract) {
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

function legalCards(hand, trick, contract, me) {
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

// ---------- declarations ----------
function findDeclarations(hand, contract) {
  if (contract === 'NT') return [];
  const res = [];
  const used = new Set();
  for (const r of ['J', '9', 'A', '10', 'K', 'Q']) {
    const cards = hand.filter((c) => c.r === r);
    if (cards.length === 4) {
      res.push({ type: 'carre', rank: r, points: r === 'J' ? 200 : r === '9' ? 150 : 100, name: tk('Four of a kind {0}', r) });
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
          name: take === 3 ? tk('Tierce') : take === 4 ? tk('Quarte') : tk('Quint'),
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

// Which declarations count: sequences only for the team with the highest one.
function resolveDeclarations(declsByPlayer) {
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

// Belot: when playing the queen/king of trumps while the other card is in the hand.
function isBelot(card, hand, trick, contract) {
  if (contract === 'NT' || (card.r !== 'K' && card.r !== 'Q')) return false;
  if (!isTrump(card, contract)) return false;
  if (contract === 'AT' && trick.length && trick[0].card.s !== card.s) return false;
  const other = card.r === 'K' ? 'Q' : 'K';
  return hand.some((c) => c.s === card.s && c.r === other);
}

// ---------- scoring ----------
const roundGP = (x, contract) => {
  const th = isSuitContract(contract) ? 7 : 5;
  return Math.floor(x / 10) + (x % 10 >= th ? 1 : 0);
};

// tricksWon: [{team, points}] ; declPts, belotPts: [a, b] ; mult 1/2/4
function scoreDeal({ contract, bidTeam, mult, tricks, declPts, belotPts, hanging }) {
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
  // hanging points from the previous deal go to the winner of this one
  if (hanging > 0 && outcome !== 'hanging') {
    const w = gp[0] > gp[1] ? 0 : gp[1] > gp[0] ? 1 : -1;
    if (w >= 0) gp[w] += hanging;
    else newHanging += hanging;
  } else if (hanging > 0) newHanging += hanging;
  return { cardPts, total, gp, outcome, capot, hanging: newHanging };
}

// ---------- bidding ----------
function legalBids(bidding, player) {
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

// Returns true if the bidding is over.
function applyBid(bidding, player, bid) {
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

function aiBid(hand, bidding, player, aggression = 1) {
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

// Computes whether the card is the "highest remaining" in its suit.
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
const aiPlay = (k) => aiChoose(k).card;

/**
 * The card to play and why (for the beginners' hint): { card, why }.
 * why: only | lead-trump | lead-master | lead-low | smear | partner-unsafe | win-last | win-master |
 *      win-points | cheap-win | lose-low
 */
function aiChoose({ hand, trick, contract, me, played, bidTeam }) {
  const legal = legalCards(hand, trick, contract, me);
  if (legal.length === 1) return { card: legal[0], why: 'only' };
  const seen = new Set(played);
  hand.forEach((c) => seen.add(c.id));
  const pts = (c) => cardPoints(c, contract);
  const trumpLike = (c) => isSuitContract(contract) && c.s === contract;
  const low = (cards) => cards.slice().sort((a, b) => pts(a) - pts(b) || trumpLike(a) - trumpLike(b) || order(a, contract) - order(b, contract))[0];
  const high = (cards) => cards.slice().sort((a, b) => pts(b) - pts(a) || order(b, contract) - order(a, contract))[0];

  if (!trick.length) {
    // leading
    if (isSuitContract(contract) && teamOf(me) === bidTeam) {
      const myTrumps = legal.filter((c) => c.s === contract);
      const outstanding = RANKS.filter((r) => !seen.has(r + contract)).length;
      if (myTrumps.length && outstanding > 0) {
        const master = myTrumps.find((c) => isMaster(c, contract, seen));
        if (master) return { card: master, why: 'lead-trump' };
      }
    }
    const masters = legal.filter((c) => isMaster(c, contract, seen) && !(trumpLike(c) && teamOf(me) !== bidTeam));
    if (masters.length) return { card: high(masters), why: 'lead-master' };
    // a low card from the longest non-trump suit, without leading tens/aces
    const nonTrump = legal.filter((c) => !trumpLike(c));
    const pool = nonTrump.length ? nonTrump : legal;
    const bySuit = {};
    for (const c of pool) (bySuit[c.s] ||= []).push(c);
    const longest = Object.values(bySuit).sort((a, b) => b.length - a.length)[0];
    return { card: low(longest), why: 'lead-low' };
  }

  const winner = trickWinner(trick, contract);
  const partnerWins = teamOf(winner.p) === teamOf(me);
  const last = trick.length === 3;
  const beats = legal.filter((c) => trickWinner([...trick, { p: me, card: c }], contract).p === me);
  const trickPts = trick.reduce((a, t) => a + pts(t.card), 0);

  if (partnerWins) {
    // Is the trick surely ours? Last to play – yes. Otherwise the partner's card must be the
    // highest one left, and nobody after me should be able to trump it.
    const led = trick[0].card.s;
    const unseenLed = RANKS.filter((r) => !seen.has(r + led)).length;
    const canBeTrumped = isSuitContract(contract) && led !== contract && winner.card.s !== contract && unseenLed < 2;
    const safe = last || (isMaster(winner.card, contract, seen) && !canBeTrumped);
    if (safe) {
      // give points ("smear"), but keep trumps and cards that can win a trick of their own
      const keep = (c) => trumpLike(c) || (isMaster(c, contract, seen) && c.s !== led);
      const give = legal.filter((c) => !keep(c));
      const pool = give.length ? give : legal.filter((c) => !trumpLike(c)).length ? legal.filter((c) => !trumpLike(c)) : legal;
      const best = high(pool);
      if (pts(best) > 0) return { card: best, why: 'smear' };
    }
    return { card: low(legal), why: safe ? 'smear' : 'partner-unsafe' };
  }
  if (beats.length) {
    if (last) return { card: low(beats), why: 'win-last' };
    const masterBeats = beats.filter((c) => isMaster(c, contract, seen));
    if (masterBeats.length && (trickPts >= 10 || !trumpLike(masterBeats[0]))) return { card: low(masterBeats), why: 'win-master' };
    if (trickPts >= 10) return { card: low(beats), why: 'win-points' };
    const cheap = beats.filter((c) => pts(c) === 0 && !trumpLike(c));
    if (cheap.length) return { card: low(cheap), why: 'cheap-win' };
  }
  return { card: low(legal), why: 'lose-low' };
}

return { RANKS, CONTRACTS, CONTRACT_NAMES, teamOf, partnerOf, isTrump, order, cardPoints, handOrder, trickWinner, legalCards, findDeclarations, resolveDeclarations, isBelot, scoreDeal, legalBids, applyBid, aiBid, aiPlay, aiChoose };
})();

__m['js/games/belot/referee.js'] = (() => {
// Belot for the referee server: the hands of the four players are only here. Declarations and "belot"
// are computed by the referee and announced publicly in the move in which they are declared.
const { makeDeck, shuffle, sortHand } = __m['js/games/cards/cards.js'];
const { seededRng } = __m['js/net/rng.js'];
const { RANKS, teamOf, legalCards, trickWinner, findDeclarations, resolveDeclarations, isBelot, scoreDeal, legalBids, applyBid, aiBid, aiPlay, cardPoints, handOrder } = __m['js/games/belot/engine.js'];
const { tk } = __m['js/i18n/tk.js'];

const sortFor = (hand, contract) => (contract
  ? sortHand(hand, handOrder(contract))
  : sortHand(hand, (c) => RANKS.indexOf(c.r)));

const __default = {
  init({ opts, seed }) {
    return {
      seed, target: Number(opts.target) || 151, score: [0, 0], hanging: 0,
      dealer: Math.floor(seededRng(seed, 'dealer')() * 4), dealNo: 0, phase: 'deal', h: null, last: null,
    };
  },

  next(S) {
    const h = S.h;
    switch (S.phase) {
      case 'deal': return { seat: -1, type: 'deal' };
      case 'bid': return { seat: h.turn, type: 'bid' };
      case 'deal2': return { seat: -1, type: 'deal2' };
      case 'play': return { seat: h.turn, type: 'card' };
      case 'score': return { seat: -1, type: 'score' };
      default: return null;
    }
  },

  validate(S, p, type, data) {
    const h = S.h;
    if (type === 'bid') return legalBids(h.bidding, p).includes(data);
    if (type === 'card') return legalCards(h.hands[p], h.trick, h.contract, p).some((c) => c.id === data);
    return false;
  },

  apply(S, p, type, data) {
    const h = S.h;
    if (type === 'deal') {
      S.dealNo++;
      const deck = shuffle(makeDeck(RANKS), seededRng(S.seed, `deal:${S.dealNo}`));
      S.h = {
        deck, k: 0, hands: [[], [], [], []], bidding: { current: null, passes: 0, history: [] },
        contract: null, turn: (S.dealer + 1) % 4, trick: [], t: 0, tricks: [], tricksWon: [0, 0],
        played: [], decls: [[], [], [], []], belot: [0, 0],
      };
      dealRound(S.h, S.dealer, [3, 2]);
      S.phase = 'bid';
      return { dealNo: S.dealNo, dealer: S.dealer };
    }
    if (type === 'bid') {
      const done = applyBid(h.bidding, p, data);
      h.turn = (p + 1) % 4;
      if (done) {
        if (!h.bidding.current) {
          // everyone passed – a new deal with the next dealer
          S.dealer = (S.dealer + 1) % 4;
          S.phase = 'deal';
          return { bid: data, redeal: true };
        }
        h.contract = h.bidding.current.contract;
        S.phase = 'deal2';
      }
      return { bid: data };
    }
    if (type === 'deal2') {
      dealRound(h, S.dealer, [3]);
      h.turn = (S.dealer + 1) % 4;
      S.phase = 'play';
      return { contract: h.contract, mult: h.bidding.current.mult, bidder: h.bidding.current.player };
    }
    if (type === 'card') {
      const hand = h.hands[p];
      const card = hand.find((c) => c.id === data);
      const notes = [];
      let decl;
      if (h.t === 0) {
        const ds = findDeclarations(hand, h.contract);
        h.decls[p] = ds;
        notes.push(...ds.map((d) => d.name));
        // the declarations are public – the players' counters add them up
        decl = ds.map(({ type, len, high, rank, points }) => ({ type, len, high, rank, points }));
      }
      const belot = isBelot(card, hand, h.trick, h.contract);
      if (belot) {
        h.belot[teamOf(p)] += 20;
        notes.push(tk('Belot'));
      }
      h.hands[p] = hand.filter((c) => c !== card);
      h.trick.push({ p, card });
      h.played.push(card.id);
      const pub = { card, notes, decl, belot: belot || undefined };
      if (h.trick.length < 4) {
        h.turn = (p + 1) % 4;
        return pub;
      }
      const w = trickWinner(h.trick, h.contract);
      const pts = h.trick.reduce((a, x) => a + cardPoints(x.card, h.contract), 0);
      h.tricks.push({ team: teamOf(w.p), points: pts });
      h.tricksWon[teamOf(w.p)]++;
      h.trick = [];
      h.t++;
      h.turn = w.p;
      if (h.t === 8) S.phase = 'score';
      return { ...pub, trick: { winner: w.p } };
    }
    if (type === 'score') {
      const cur = h.bidding.current;
      const decl = resolveDeclarations(h.decls);
      const res = scoreDeal({
        contract: h.contract, bidTeam: teamOf(cur.player), mult: cur.mult,
        tricks: h.tricks, declPts: decl.pts, belotPts: h.belot, hanging: S.hanging,
      });
      S.score[0] += res.gp[0];
      S.score[1] += res.gp[1];
      S.hanging = res.hanging;
      S.last = {
        res, decl: decl.pts, contract: h.contract, mult: cur.mult, bidder: cur.player,
        belot: h.belot.slice(), tricksWon: h.tricksWon.slice(), dealNo: S.dealNo,
      };
      const max = Math.max(...S.score);
      if (max >= S.target && S.score[0] !== S.score[1]) S.phase = 'over';
      else {
        S.dealer = (S.dealer + 1) % 4;
        S.phase = 'deal';
      }
      return { ...S.last, score: S.score.slice(), hanging: S.hanging };
    }
    return null;
  },

  view(S, p) {
    const h = S.h;
    const v = { seat: p, score: S.score.slice(), hanging: S.hanging, dealer: S.dealer, dealNo: S.dealNo, phase: S.phase, last: S.last, target: S.target };
    if (!h) return v;
    const turn = S.phase === 'bid' || S.phase === 'play' ? h.turn : -1;
    let decision = null;
    if (turn === p && S.phase === 'bid') decision = { type: 'bid', legal: legalBids(h.bidding, p) };
    if (turn === p && S.phase === 'play') decision = { type: 'card', legal: legalCards(h.hands[p], h.trick, h.contract, p).map((c) => c.id) };
    return {
      ...v,
      hand: sortFor(h.hands[p], h.contract),
      counts: h.hands.map((x) => x.length),
      bidding: { current: h.bidding.current, history: h.bidding.history },
      contract: h.contract,
      trick: h.trick,
      tricksWon: h.tricksWon.slice(),
      turn,
      decision,
    };
  },

  ai(S, p, type) {
    const h = S.h;
    if (type === 'bid') return aiBid(h.hands[p], h.bidding, p);
    return aiPlay({
      hand: h.hands[p], trick: h.trick, contract: h.contract, me: p,
      played: new Set(h.played), bidTeam: teamOf(h.bidding.current.player),
    }).id;
  },

  result(S) {
    const w = S.score[0] > S.score[1] ? 0 : 1;
    return { winners: [w, w + 2], score: S.score.slice() };
  },
};

function dealRound(h, dealer, counts) {
  for (const cnt of counts) {
    for (let i = 1; i <= 4; i++) {
      const p = (dealer + i) % 4;
      for (let j = 0; j < cnt; j++) h.hands[p].push(h.deck[h.k++]);
    }
  }
}

return { default: __default };
})();

__m['js/games/santase/engine.js'] = (() => {
// Santase (66): rules and AI. Players: 0 = you, 1 = computer.

const RANKS = ['9', 'J', 'Q', 'K', '10', 'A'];
const ORDER = { 9: 0, J: 1, Q: 2, K: 3, 10: 4, A: 5 };
const PTS = { 9: 0, J: 2, Q: 3, K: 4, 10: 10, A: 11 };
const order = (c) => ORDER[c.r];

function newDeal(deck, dealer) {
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

const isStrict = (d) => d.closedBy >= 0 || d.stock.length === 0;

function legalCards(d, p) {
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

function beats(lead, resp, trump) {
  if (resp.s === lead.s) return order(resp) > order(lead);
  return resp.s === trump;
}

function marriageFor(d, p, card) {
  if (d.lead || (card.r !== 'K' && card.r !== 'Q')) return 0;
  const other = card.r === 'K' ? 'Q' : 'K';
  if (!d.hands[p].some((c) => c.s === card.s && c.r === other)) return 0;
  return card.s === d.trump ? 40 : 20;
}

const canExchange = (d, p) =>
  !d.lead && d.leader === p && d.closedBy < 0 && d.stock.length > 2 && d.tricks[p] > 0 &&
  d.hands[p].some((c) => c.s === d.trump && c.r === '9');

const canClose = (d, p) => !d.lead && d.leader === p && d.closedBy < 0 && d.stock.length > 2;

function exchange(d, p) {
  const i = d.hands[p].findIndex((c) => c.s === d.trump && c.r === '9');
  const nine = d.hands[p][i];
  d.hands[p][i] = d.stock[0];
  d.stock[0] = nine;
}

const total = (d, p) => d.points[p] + (d.tricks[p] > 0 ? d.pending[p] : 0);
const scoreOf = total;

// Plays a card. Returns an event {type: 'lead'|'trick', marriage, trickWinner, ...}.
function play(d, p, card) {
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
function dealResult(d) {
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

function aiDecideAction(d, p, seen) {
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

const aiPlay = (d, p, seenIds) => aiChoose(d, p, seenIds).card;

/**
 * The card to play and why (for the beginners' hint): { card, why }.
 * why: only | marriage | lead-trump-master | lead-master | lead-low | strict-win | strict-lose |
 *      take-points | take-cheap | trump-take | throw
 */
function aiChoose(d, p, seenIds) {
  const legal = legalCards(d, p);
  if (legal.length === 1) return { card: legal[0], why: 'only' };
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
      return { card: marriages[0], why: 'marriage' };
    }
    if (isStrict(d)) {
      const masters = legal.filter((c) => !unseenHigher(c, d, p, seen));
      const trumpMasters = masters.filter((c) => c.s === trump);
      if (trumpMasters.length) return { card: trumpMasters.sort((a, b) => order(b) - order(a))[0], why: 'lead-trump-master' };
      if (masters.length) return { card: masters.sort((a, b) => PTS[b.r] - PTS[a.r])[0], why: 'lead-master' };
      return { card: lowest(legal), why: 'lead-low' };
    }
    const nonTrump = legal.filter((c) => c.s !== trump && !inMarriage(c));
    return { card: lowest(nonTrump.length ? nonTrump : legal), why: 'lead-low' };
  }

  const L = d.lead.card;
  const winning = legal.filter((c) => beats(L, c, trump));
  const lpts = PTS[L.r];
  if (isStrict(d)) {
    if (winning.length) return { card: winning.sort((a, b) => val(a) - val(b))[0], why: 'strict-win' };
    return { card: lowest(legal), why: 'strict-lose' };
  }
  const sameSuitWins = winning.filter((c) => c.s === L.s);
  if (sameSuitWins.length) {
    const best = sameSuitWins.sort((a, b) => val(b) - val(a))[0]; // take with the strongest (10 or ace bring points)
    const cheap = sameSuitWins.sort((a, b) => val(a) - val(b))[0];
    if (PTS[best.r] >= 10) return { card: best, why: 'take-points' };
    return { card: cheap, why: 'take-cheap' };
  }
  const trumpWins = winning.filter((c) => c.s === trump && !inMarriage(c));
  if (trumpWins.length && (lpts >= 10 || total(d, p) + lpts >= 50)) {
    return { card: trumpWins.sort((a, b) => order(a) - order(b))[0], why: 'trump-take' };
  }
  const throwAway = legal.filter((c) => c.s !== trump && !inMarriage(c));
  return { card: lowest(throwAway.length ? throwAway : legal), why: 'throw' };
}

return { RANKS, PTS, order, newDeal, isStrict, legalCards, beats, marriageFor, canExchange, canClose, exchange, scoreOf, play, dealResult, aiDecideAction, aiPlay, aiChoose };
})();

__m['js/games/santase/referee.js'] = (() => {
// Santase for the referee server: the full state (with both players' cards) is only here,
// each player gets a view with their own cards.
const { makeDeck, shuffle } = __m['js/games/cards/cards.js'];
const { seededRng } = __m['js/net/rng.js'];
const { RANKS, newDeal, legalCards, play, canClose, canExchange, exchange, scoreOf, dealResult, aiPlay, aiDecideAction } = __m['js/games/santase/engine.js'];

const TARGET = 11;

const __default = {
  init({ seats, opts = {}, seed }) {
    return {
      seed, seats: seats.length, level: opts.level || 'normal', score: [0, 0], dealNo: 0, phase: 'deal',
      dealer: seededRng(seed, 'dealer')() < 0.5 ? 0 : 1,
      d: null, seen: [], last: null,
    };
  },

  next(S) {
    if (S.phase === 'deal') return { seat: -1, type: 'deal' };
    if (S.phase === 'score') return { seat: -1, type: 'score' };
    if (S.phase === 'play') return { seat: S.d.lead ? 1 - S.d.lead.p : S.d.leader, type: 'act' };
    return null;
  },

  validate(S, p, type, a) {
    const d = S.d;
    if (type !== 'act' || !a) return false;
    if (a.kind === 'exchange') return canExchange(d, p);
    if (a.kind === 'close') return canClose(d, p);
    return a.kind === 'card' && legalCards(d, p).some((c) => c.id === a.card);
  },

  apply(S, p, type, a) {
    if (type === 'deal') {
      S.dealNo++;
      S.d = newDeal(shuffle(makeDeck(RANKS), seededRng(S.seed, `deal:${S.dealNo}`)), S.dealer);
      S.seen = [];
      S.phase = 'play';
      return { dealNo: S.dealNo, dealer: S.dealer, leader: S.d.leader, trump: S.d.stock[0] };
    }
    if (type === 'score') {
      const r = dealResult(S.d);
      S.score[r.winner] += r.gp;
      S.last = { ...r, points: [scoreOf(S.d, 0), scoreOf(S.d, 1)], tricks: S.d.tricks.slice() };
      S.phase = S.score[0] >= TARGET || S.score[1] >= TARGET ? 'over' : 'deal';
      if (S.phase === 'deal') S.dealer = 1 - S.dealer;
      return { ...S.last, score: S.score.slice() };
    }
    const d = S.d;
    if (a.kind === 'exchange') {
      const nine = d.hands[p].find((c) => c.s === d.trump && c.r === '9');
      const old = d.stock[0];
      exchange(d, p);
      return { kind: 'exchange', nine, trumpCard: old };
    }
    if (a.kind === 'close') {
      d.closedBy = p;
      return { kind: 'close' };
    }
    const card = d.hands[p].find((c) => c.id === a.card);
    const stockBefore = d.stock.length;
    const ev = play(d, p, card);
    S.seen.push(card.id);
    if (d.winner >= 0) S.phase = 'score';
    return {
      kind: 'card', card, marriage: ev.marriage || 0,
      trick: ev.type === 'trick' ? { winner: ev.winner } : null,
      // the drawn cards are secret; it's public only whether the last one was the face-up trump
      drew: ev.drew ? { lastTrump: stockBefore === 2 } : null,
    };
  },

  view(S, p) {
    const d = S.d;
    const v = { seat: p, score: S.score.slice(), dealNo: S.dealNo, dealer: S.dealer, phase: S.phase, last: S.last };
    if (!d) return v;
    const my = S.phase === 'play' && (d.lead ? 1 - d.lead.p : d.leader) === p;
    return {
      ...v,
      hand: d.hands[p].slice(),
      oppCount: d.hands[1 - p].length,
      stock: d.stock.length,
      trumpCard: d.stock[0] || null,
      trump: d.trump,
      closedBy: d.closedBy,
      lead: d.lead,
      points: [scoreOf(d, 0), scoreOf(d, 1)],
      pending: d.pending.slice(),
      tricks: d.tricks.slice(),
      turn: S.phase === 'play' ? (d.lead ? 1 - d.lead.p : d.leader) : -1,
      decision: my ? { type: 'act', legal: legalCards(d, p).map((c) => c.id), canExchange: canExchange(d, p), canClose: canClose(d, p) } : null,
    };
  },

  ai(S, p) {
    const d = S.d;
    if (S.level === 'easy' && Math.random() < 0.4) {
      const legal = legalCards(d, p);
      return { kind: 'card', card: legal[Math.floor(Math.random() * legal.length)].id };
    }
    if (!d.lead && S.level !== 'easy') {
      for (const a of aiDecideAction(d, p, new Set(S.seen))) {
        if (a === 'exchange' && canExchange(d, p)) return { kind: 'exchange' };
        if (a === 'close' && canClose(d, p)) return { kind: 'close' };
      }
    }
    return { kind: 'card', card: aiPlay(d, p, new Set(S.seen)).id };
  },

  result(S) {
    const w = S.score[0] > S.score[1] ? 0 : 1;
    return { winners: [w], score: S.score.slice() };
  },
};

return { TARGET, default: __default };
})();

__m['js/games/blato/engine.js'] = (() => {
// Blato (3-5-8): three players, 52 cards, 16 cards each and 4 in the "swamp".
// The dealer must take 8 tricks, the next player 5, the third 3.
// Play goes counter-clockwise: next player = (p + 1) % 3.

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['C', 'D', 'H', 'S'];
const power = (c) => RANKS.indexOf(c.r);
const next = (p) => (p + 1) % 3;

// Goal for each player relative to the dealer.
const targetOf = (p, dealer) => [8, 5, 3][(p - dealer + 3) % 3];

function deal(deck) {
  return { hands: [deck.slice(0, 16), deck.slice(16, 32), deck.slice(32, 48)], kitty: deck.slice(48) };
}

function legalCards(hand, trick) {
  if (!trick.length) return hand;
  const led = trick[0].card.s;
  const same = hand.filter((c) => c.s === led);
  return same.length ? same : hand;
}

function trickWinner(trick, trump) {
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
function exchangePlan(diff, dealer) {
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
function returnCards(hand, received) {
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

function aiTrump(hand) {
  return [...SUITS].sort((a, b) => suitScore(hand, b) - suitScore(hand, a))[0];
}

// Gives away the weakest cards (keeps aces, kings and trumps if known).
function aiGive(hand, count, trump = null) {
  return [...hand]
    .sort((a, b) => (a.s === trump) - (b.s === trump) || power(a) - power(b))
    .slice(0, count);
}

// Discards 4 cards: the weakest non-trumps, preferring to leave short suits empty.
function aiDiscard(hand, trump) {
  const count = (s) => hand.filter((c) => c.s === s).length;
  return [...hand]
    .filter((c) => c.s !== trump)
    .sort((a, b) => power(a) - power(b) + (count(a.s) - count(b.s)) * 0.6)
    .slice(0, 4);
}

const aiPlay = (k) => aiChoose(k).card;

/** The card to play and why (for the beginners' hint): { card, why }: only | lead-sure | lead-low | win-last | win-high | win-cheap | lose-low. */
function aiChoose({ hand, trick, trump, played }) {
  const legal = legalCards(hand, trick);
  const byPow = (a, b) => power(a) - power(b);
  if (legal.length === 1) return { card: legal[0], why: 'only' };
  if (!trick.length) {
    // leads with the highest safe card (no higher unplayed card in the suit), otherwise with the lowest
    const sure = legal.filter((c) => RANKS.slice(power(c) + 1).every((r) => played.has(r + c.s) || hand.some((x) => x.s === c.s && x.r === r)));
    const nonTrumpSure = sure.filter((c) => c.s !== trump);
    if (nonTrumpSure.length) return { card: nonTrumpSure.sort(byPow).pop(), why: 'lead-sure' };
    if (sure.length) return { card: sure.sort(byPow).pop(), why: 'lead-sure' };
    const nonTrump = legal.filter((c) => c.s !== trump);
    return { card: (nonTrump.length ? nonTrump : legal).sort(byPow)[0], why: 'lead-low' };
  }
  const winsWith = (c) => trickWinner([...trick, { p: -1, card: c }], trump) === -1;
  const winning = legal.filter(winsWith).sort(byPow);
  if (winning.length) {
    // last player or a sure win – takes with the cheapest winning card
    if (trick.length === 2) return { card: winning[0], why: 'win-last' };
    const top = winning[winning.length - 1];
    return top.s === trump ? { card: winning[0], why: 'win-cheap' } : { card: top, why: 'win-high' };
  }
  return { card: legal.sort(byPow)[0], why: 'lose-low' };
}

return { RANKS, SUITS, power, next, targetOf, deal, legalCards, trickWinner, exchangePlan, returnCards, aiTrump, aiGive, aiDiscard, aiPlay, aiChoose };
})();

__m['js/games/blato/referee.js'] = (() => {
// Blato for the referee server: the hands, the swamp and the exchanged cards are secret.
const { makeDeck, shuffle, sortHand } = __m['js/games/cards/cards.js'];
const { seededRng } = __m['js/net/rng.js'];
const { RANKS, SUITS, power, next, targetOf, deal, legalCards, trickWinner, exchangePlan, returnCards, aiTrump, aiGive, aiDiscard, aiPlay } = __m['js/games/blato/engine.js'];

const ORDER = ['S', 'H', 'C', 'D'];
const sortFor = (hand, trump) => sortHand(hand, power, trump ? [trump, ...ORDER.filter((s) => s !== trump)] : ORDER);

const __default = {
  init({ opts, seed }) {
    return {
      seed, target: Number(opts.target) || 10, score: [0, 0, 0], diff: [0, 0, 0],
      dealer: Math.floor(seededRng(seed, 'dealer')() * 3), dealNo: 0, phase: 'deal', h: null, last: null,
    };
  },

  next(S) {
    const h = S.h;
    switch (S.phase) {
      case 'deal': return { seat: -1, type: 'deal' };
      case 'give': return { seat: h.plan[h.pi].from, type: 'give' };
      case 'take': return { seat: -1, type: 'take' };
      case 'trump': return { seat: S.dealer, type: 'trump' };
      case 'discard': return { seat: S.dealer, type: 'discard' };
      case 'play': return { seat: h.turn, type: 'card' };
      case 'score': return { seat: -1, type: 'score' };
      default: return null;
    }
  },

  validate(S, p, type, data) {
    const h = S.h;
    const own = (ids, n) => Array.isArray(ids) && ids.length === n && new Set(ids).size === n && ids.every((id) => h.hands[p].some((c) => c.id === id));
    if (type === 'give') return own(data, h.plan[h.pi].count);
    if (type === 'discard') return own(data, 4);
    if (type === 'trump') return SUITS.includes(data);
    if (type === 'card') return legalCards(h.hands[p], h.trick).some((c) => c.id === data);
    return false;
  },

  apply(S, p, type, data) {
    const h = S.h;
    if (type === 'deal') {
      S.dealNo++;
      const d = deal(shuffle(makeDeck(RANKS), seededRng(S.seed, `deal:${S.dealNo}`)));
      S.h = {
        hands: d.hands, kitty: d.kitty, trump: null, plan: exchangePlan(S.diff, S.dealer), pi: 0,
        exchanged: [[], [], []], tricks: [0, 0, 0], trick: [], t: 0, turn: -1, played: [],
      };
      S.phase = S.h.plan.length ? 'give' : 'take';
      return { dealNo: S.dealNo, dealer: S.dealer, plan: S.h.plan };
    }
    if (type === 'give') {
      const { from, to, count } = h.plan[h.pi];
      const give = data.map((id) => h.hands[from].find((c) => c.id === id));
      h.hands[from] = h.hands[from].filter((c) => !give.includes(c));
      const back = returnCards(h.hands[to], give);
      h.hands[to] = [...h.hands[to], ...give].filter((c) => !back.includes(c));
      h.hands[from].push(...back);
      // each participant sees what they gave and what they received
      h.exchanged[from].push({ with: to, gave: give, got: back });
      h.exchanged[to].push({ with: from, gave: back, got: give });
      h.pi++;
      if (h.pi >= h.plan.length) S.phase = 'take';
      return { from, to, count };
    }
    if (type === 'take') {
      h.hands[S.dealer].push(...h.kitty);
      h.kitty = [];
      S.phase = 'trump';
      return { dealer: S.dealer };
    }
    if (type === 'trump') {
      h.trump = data;
      S.phase = 'discard';
      return { trump: data };
    }
    if (type === 'discard') {
      h.hands[p] = h.hands[p].filter((c) => !data.includes(c.id));
      h.turn = next(S.dealer);
      S.phase = 'play';
      return {};
    }
    if (type === 'card') {
      const card = h.hands[p].find((c) => c.id === data);
      h.hands[p] = h.hands[p].filter((c) => c !== card);
      h.trick.push({ p, card });
      h.played.push(card.id);
      if (h.trick.length < 3) {
        h.turn = next(p);
        return { card };
      }
      const w = trickWinner(h.trick, h.trump);
      h.tricks[w]++;
      h.trick = [];
      h.t++;
      h.turn = w;
      if (h.t === 16) S.phase = 'score';
      return { card, trick: { winner: w } };
    }
    if (type === 'score') {
      S.diff = [0, 1, 2].map((q) => h.tricks[q] - targetOf(q, S.dealer));
      S.diff.forEach((x, q) => (S.score[q] += x));
      S.last = { tricks: h.tricks.slice(), diff: S.diff.slice(), dealer: S.dealer, dealNo: S.dealNo };
      const best = Math.max(...S.score);
      if (best >= S.target && S.score.filter((x) => x === best).length === 1) S.phase = 'over';
      else {
        S.dealer = next(S.dealer);
        S.phase = 'deal';
      }
      return { ...S.last, score: S.score.slice() };
    }
    return null;
  },

  view(S, p) {
    const h = S.h;
    const v = { seat: p, score: S.score.slice(), dealer: S.dealer, dealNo: S.dealNo, phase: S.phase, last: S.last, target: S.target };
    if (!h) return v;
    const nx = this.next(S);
    let decision = null;
    if (nx && nx.seat === p) {
      if (nx.type === 'give') decision = { type: 'give', count: h.plan[h.pi].count, to: h.plan[h.pi].to };
      else if (nx.type === 'card') decision = { type: 'card', legal: legalCards(h.hands[p], h.trick).map((c) => c.id) };
      else decision = { type: nx.type };
    }
    return {
      ...v,
      hand: sortFor(h.hands[p], h.trump),
      counts: h.hands.map((x) => x.length),
      kitty: h.kitty.length,
      trump: h.trump,
      trick: h.trick,
      tricks: h.tricks.slice(),
      targets: [0, 1, 2].map((q) => targetOf(q, S.dealer)),
      exchanged: h.exchanged[p],
      turn: nx && nx.seat >= 0 ? nx.seat : -1,
      decision,
    };
  },

  ai(S, p, type) {
    const h = S.h;
    if (type === 'give') return aiGive(h.hands[p], h.plan[h.pi].count).map((c) => c.id);
    if (type === 'trump') return aiTrump(h.hands[p]);
    if (type === 'discard') return aiDiscard(h.hands[p], h.trump).map((c) => c.id);
    return aiPlay({ hand: h.hands[p], trick: h.trick, trump: h.trump, played: new Set(h.played) }).id;
  },

  result(S) {
    const best = Math.max(...S.score);
    return { winners: [S.score.indexOf(best)], score: S.score.slice() };
  },
};

return { default: __default };
})();

__m['js/net/referee/core.js'] = (() => {
// Referee server: runs the game authoritatively. Holds the deck and all hands,
// checks every decision, plays for the bots and the "system" steps
// (dealing, scoring), and gives each player a view with only their own cards.
//
// The same code runs: in the browser (game against the computer), in a SharedWorker
// (local online test, emulates a server) and in a Supabase Edge Function (real server).
// The state is plain JSON so the server can keep it in the database.
//
// Game reducer (js/games/<game>/referee.js):
//   init({ seats, opts, seed }) → S          seats: [{ bot: bool, name }]
//   next(S) → { seat, type } | null          seat -1 = system step; null = end
//   validate(S, seat, type, data) → bool
//   apply(S, seat, type, data) → pub         public data for the log
//   view(S, seat) → the player's view (cards, whose turn, possible decisions…)
//   ai(S, seat, type) → data                 a bot's decision
//   result(S) → { winners: [seat], ... }     at the end
const { tk } = __m['js/i18n/tk.js'];

function createMatch(reducer, { seats, opts = {}, seed }) {
  return wrap(reducer, { S: reducer.init({ seats, opts, seed }), seats, log: [] });
}

function restoreMatch(reducer, saved) {
  return wrap(reducer, saved);
}

function wrap(reducer, M) {
  const humans = () => M.seats.map((s, i) => (s.bot ? -1 : i)).filter((i) => i >= 0);

  function step(seat, type, data) {
    const pub = reducer.apply(M.S, seat, type, data);
    const e = { n: M.log.length, seat, type, pub: pub ?? null };
    M.log.push(e);
    // the views are made right away – every player sees the state after this step
    const views = {};
    for (const h of humans()) views[h] = reducer.view(M.S, h);
    return { ...e, views };
  }

  // Runs the system steps and bot moves until a human decision or the end.
  function advance() {
    const out = [];
    for (let guard = 0; guard < 2000; guard++) {
      const nx = reducer.next(M.S);
      if (!nx) break;
      if (nx.seat === -1) out.push(step(-1, nx.type, null));
      else if (M.seats[nx.seat].bot) out.push(step(nx.seat, nx.type, reducer.ai(M.S, nx.seat, nx.type)));
      else break;
    }
    return out;
  }

  return {
    get log() { return M.log; },
    get seats() { return M.seats; },
    pending: () => reducer.next(M.S),
    over: () => !reducer.next(M.S),
    result: () => reducer.result(M.S),
    start: () => (M.log.length ? [] : advance()),
    submit(seat, type, data) {
      const nx = reducer.next(M.S);
      if (!nx || nx.seat !== seat || nx.type !== type) throw new Error(tk('It\'s not your turn.'));
      if (!reducer.validate(M.S, seat, type, data)) throw new Error(tk('Invalid move.'));
      return [step(seat, type, data), ...advance()];
    },
    // disconnected player → bot (their decisions are made automatically)
    takeover(seat) {
      if (!M.seats[seat] || M.seats[seat].bot) return [];
      M.seats[seat] = { ...M.seats[seat], bot: true };
      return advance();
    },
    view: (seat) => reducer.view(M.S, seat),
    snapshot: (seat) => ({ n: M.log.length, view: reducer.view(M.S, seat), log: M.log }),
    save: () => JSON.parse(JSON.stringify(M)),
  };
}

// The steps for a specific player: the public part + their view.
const forSeat = (entries, seat) => entries.map(({ views, ...e }) => ({ ...e, view: views[seat] }));

return { createMatch, restoreMatch, forSeat };
})();

export const { createMatch, restoreMatch, forSeat } = __m['js/net/referee/core.js'];
export const REDUCERS = {belot: __m['js/games/belot/referee.js'].default, santase: __m['js/games/santase/referee.js'].default, blato: __m['js/games/blato/referee.js'].default};