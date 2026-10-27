// АВТОМАТИЧНО ГЕНЕРИРАН ФАЙЛ – не редактирайте ръчно.
// Източник: модулите в js/ (виж tools/build-referee.py).
// @ts-nocheck
/* eslint-disable */
const __m = {};
__m['js/store/hash.js'] = (() => {
// Хеширане на пароли: PBKDF2 (Web Crypto) когато е налично.
// Web Crypto изисква "secure context" (https или localhost). При достъп по
// локален IP (напр. от телефон в същата мрежа) ползваме резервен SHA-256.

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
    throw new Error('Този акаунт е създаден на защитен адрес (localhost/https). Отворете портала оттам, за да влезете.');
  }
  return (await hashPassword(password, salt)) === stored;
}

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Компактна реализация на SHA-256 (резервен вариант).
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
// Детерминиран генератор на случайни числа за онлайн игрите: всички клиенти
// получават едни и същи зарове/разбърквания от общия seed на мача.
const { sha256 } = __m['js/store/hash.js'];

// sfc32, инициализиран с SHA-256(seed | етикет). Връща функция → [0, 1).
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

// Криптографски случайно число – за игри срещу компютъра.
function cryptoRng() {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] / 4294967296;
}

return { seededRng, cryptoRng };
})();

__m['js/games/cards/suits.js'] = (() => {
// Векторни символи на боите (viewBox 0 0 100 100) – изглеждат еднакво на всички устройства.
const SUIT_PATHS = {
  H: '<path d="M50 90C22 66 4 49 4 29 4 14 15 4 29 4c10 0 17 6 21 14 4-8 11-14 21-14 14 0 25 10 25 25 0 20-18 37-46 61z"/>',
  D: '<path d="M50 3c10 17 24 33 40 47-16 14-30 30-40 47C40 80 26 64 10 50 26 36 40 20 50 3z"/>',
  S: '<path d="M50 4C62 24 94 38 94 61c0 14-10 22-22 22-8 0-14-4-18-10 1 10 6 18 14 23H32c8-5 13-13 14-23-4 6-10 10-18 10-12 0-22-8-22-22C6 38 38 24 50 4z"/>',
  C: '<circle cx="50" cy="28" r="20"/><circle cx="26" cy="58" r="20"/><circle cx="74" cy="58" r="20"/><path d="M44 50h12v8c1 15 6 27 14 38H30c8-11 13-23 14-38z"/>',
};

const SUIT_NAMES = { C: 'Спатия', D: 'Каро', H: 'Купа', S: 'Пика' };
const isRed = (s) => s === 'H' || s === 'D';

function suitSvg(s, cls = 'suit') {
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${SUIT_PATHS[s]}</svg>`;
}

return { SUIT_PATHS, SUIT_NAMES, isRed, suitSvg };
})();

__m['js/games/cards/cards.js'] = (() => {
// Общи функции за игри с карти: рендиране, тесте, разбъркване.
const { suitSvg, isRed } = __m['js/games/cards/suits.js'];
const { cryptoRng } = __m['js/net/rng.js'];

const SUITS = ['C', 'D', 'H', 'S'];

function makeDeck(ranks) {
  const deck = [];
  for (const s of SUITS) for (const r of ranks) deck.push({ s, r, id: r + s });
  return deck;
}

// rnd: функция → [0, 1); в онлайн игрите е общият генератор на мача.
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

// Фигури (вале, дама, поп): илюстрации English pattern от Dmitry Fomin (CC0),
// префиоцветени в палитрата на портала. Зареждат се предварително, за да няма примигване.
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

// Сортира ръка по боя (редуващи се цветове) и сила.
function sortHand(hand, rankOrder, suitOrder = ['S', 'H', 'C', 'D']) {
  return hand.slice().sort((a, b) => {
    const sa = suitOrder.indexOf(a.s), sb = suitOrder.indexOf(b.s);
    if (sa !== sb) return sa - sb;
    return rankOrder(a) - rankOrder(b);
  });
}

// Подрежда картите в ръката като ветрило.
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
// Български белот: правила, анонси, точкуване и AI.
// Играчи: 0 = Юг (вие), 1 = Изток, 2 = Север (партньор), 3 = Запад. Ход обратно на часовниковата стрелка: 0→1→2→3.
// Отбори: 0 = играчи 0 и 2, 1 = играчи 1 и 3.

const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const CONTRACTS = ['C', 'D', 'H', 'S', 'NT', 'AT'];
const CONTRACT_NAMES = { C: 'Спатия', D: 'Каро', H: 'Купа', S: 'Пика', NT: 'Без коз', AT: 'Всичко коз' };

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

// ---------- ръка (взятка) ----------
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

// ---------- анонси ----------
function findDeclarations(hand, contract) {
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

// Белот: при изиграване на дама/поп коз, когато другата карта е в ръката.
function isBelot(card, hand, trick, contract) {
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
  // висящи точки от предишното раздаване отиват при победителя в това
  if (hanging > 0 && outcome !== 'hanging') {
    const w = gp[0] > gp[1] ? 0 : gp[1] > gp[0] ? 1 : -1;
    if (w >= 0) gp[w] += hanging;
    else newHanging += hanging;
  } else if (hanging > 0) newHanging += hanging;
  return { cardPts, total, gp, outcome, capot, hanging: newHanging };
}

// ---------- обявяване ----------
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

// Връща true ако обявяването е приключило.
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
function aiPlay({ hand, trick, contract, me, played, bidTeam }) {
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

return { RANKS, CONTRACTS, CONTRACT_NAMES, teamOf, partnerOf, isTrump, order, cardPoints, handOrder, trickWinner, legalCards, findDeclarations, resolveDeclarations, isBelot, scoreDeal, legalBids, applyBid, aiBid, aiPlay };
})();

__m['js/games/belot/referee.js'] = (() => {
// Белот за сървъра-съдия: ръцете на четиримата са само тук. Анонсите и „белот“
// се изчисляват от съдията и се съобщават публично в хода, в който се обявяват.
const { makeDeck, shuffle, sortHand } = __m['js/games/cards/cards.js'];
const { seededRng } = __m['js/net/rng.js'];
const { RANKS, teamOf, legalCards, trickWinner, findDeclarations, resolveDeclarations, isBelot, scoreDeal, legalBids, applyBid, aiBid, aiPlay, cardPoints, handOrder } = __m['js/games/belot/engine.js'];

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
          // всички пасуваха – ново раздаване със следващия раздаващ
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
      if (h.t === 0) {
        const ds = findDeclarations(hand, h.contract);
        h.decls[p] = ds;
        notes.push(...ds.map((d) => d.name));
      }
      const belot = isBelot(card, hand, h.trick, h.contract);
      if (belot) {
        h.belot[teamOf(p)] += 20;
        notes.push('Белот');
      }
      h.hands[p] = hand.filter((c) => c !== card);
      h.trick.push({ p, card });
      h.played.push(card.id);
      const pub = { card, notes };
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
// Сантасе (66): правила и AI. Играчи: 0 = вие, 1 = компютър.

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
  const rest = deck.slice(k); // 12 карти; първата е открития коз (най-отдолу)
  const trumpCard = rest[0];
  return {
    hands,
    stock: rest, // stock[0] = открития коз, теглене от края
    trump: trumpCard.s,
    closedBy: -1,
    leader,
    lead: null, // изиграна първа карта в текущата ръка
    points: [0, 0],
    pending: [0, 0], // обявени 20/40 преди първа взета ръка
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

// Изиграва карта. Връща събитие {type: 'lead'|'trick', marriage, trickWinner, ...}.
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

// Точки за мача при край на раздаването.
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
  // има ли невидяна по-силна карта от същата боя
  for (const r of RANKS) {
    if (ORDER[r] <= ORDER[card.r]) continue;
    const id = r + card.s;
    if (!seen.has(id)) return true;
  }
  return false;
}

function aiDecideAction(d, p, seen) {
  // действия преди извеждане: смяна на 9 и затваряне
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

function aiPlay(d, p, seenIds) {
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
    // обяви 20/40, ако е възможно
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
    const best = sameSuitWins.sort((a, b) => val(b) - val(a))[0]; // вземи с най-силната (10 или асо носят точки)
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

return { RANKS, PTS, order, newDeal, isStrict, legalCards, beats, marriageFor, canExchange, canClose, exchange, scoreOf, play, dealResult, aiDecideAction, aiPlay };
})();

__m['js/games/santase/referee.js'] = (() => {
// Сантасе за сървъра-съдия: пълното състояние (с картите на двамата) е само тук,
// всеки играч получава изглед със своите карти.
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
      // изтеглените карти са тайни; публично е само дали последната е била откритият коз
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
// Блато (3-5-8): трима играчи, 52 карти, по 16 карти и 4 в „блатото“.
// Раздаващият трябва да вземе 8 ръце, следващият – 5, третият – 3.
// Играе се обратно на часовниковата стрелка: следващ играч = (p + 1) % 3.

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['C', 'D', 'H', 'S'];
const power = (c) => RANKS.indexOf(c.r);
const next = (p) => (p + 1) % 3;

// Цел за всеки играч спрямо раздаващия.
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
 * Размяна в началото на раздаването според предишното: играч, взел повече от целта си,
 * дава толкова карти, колкото е взел в повече, на изоставащите, а те връщат
 * най-силната си карта от същата боя (или същата карта, ако нямат друга от боята).
 * Връща списък { from, to, count } в реда на изпълнение.
 */
function exchangePlan(diff, dealer) {
  const ups = [0, 1, 2].filter((p) => diff[p] > 0);
  const downs = [0, 1, 2].filter((p) => diff[p] < 0);
  const plan = [];
  if (ups.length === 1) {
    // един напред: дава на всеки изоставащ толкова карти, колкото той не е взел
    for (const d of downs) plan.push({ from: ups[0], to: d, count: -diff[d] });
  } else if (ups.length === 2) {
    // двама напред: първо този с по-високата цел за новото раздаване
    ups.sort((a, b) => targetOf(b, dealer) - targetOf(a, dealer));
    for (const u of ups) plan.push({ from: u, to: downs[0], count: diff[u] });
  }
  return plan.filter((x) => x.count > 0);
}

// Какво връща получателят за всяка получена карта: най-силната от същата боя.
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

// Подарява най-слабите карти (пази асата, поповете и коза, ако е известен).
function aiGive(hand, count, trump = null) {
  return [...hand]
    .sort((a, b) => (a.s === trump) - (b.s === trump) || power(a) - power(b))
    .slice(0, count);
}

// Сваля 4 карти: най-слабите некозове, като предпочита да остави къси бои празни.
function aiDiscard(hand, trump) {
  const count = (s) => hand.filter((c) => c.s === s).length;
  return [...hand]
    .filter((c) => c.s !== trump)
    .sort((a, b) => power(a) - power(b) + (count(a.s) - count(b.s)) * 0.6)
    .slice(0, 4);
}

function aiPlay({ hand, trick, trump, played }) {
  const legal = legalCards(hand, trick);
  const byPow = (a, b) => power(a) - power(b);
  if (!trick.length) {
    // води с най-високата сигурна карта (няма по-висока неизиграна в боята), иначе с най-ниската
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
    // последен играч или сигурна победа – взема с най-евтината печеливша карта
    return trick.length === 2 ? winning[0] : winning[winning.length - 1].s === trump ? winning[0] : winning[winning.length - 1];
  }
  return legal.sort(byPow)[0];
}

return { RANKS, SUITS, power, next, targetOf, deal, legalCards, trickWinner, exchangePlan, returnCards, aiTrump, aiGive, aiDiscard, aiPlay };
})();

__m['js/games/blato/referee.js'] = (() => {
// Блато за сървъра-съдия: ръцете, блатото и разменените карти са тайни.
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
      // всеки участник вижда какво е дал и какво е получил
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
// Сървър-съдия: изпълнява играта авторитетно. Държи тестето и всички ръце,
// проверява всяко решение, играе вместо ботовете и стъпките на „системата“
// (раздаване, точкуване), а на всеки играч дава изглед само с неговите карти.
//
// Един и същ код работи: в браузъра (игра срещу компютъра), в SharedWorker
// (локален онлайн тест, емулира сървър) и в Supabase Edge Function (истински сървър).
// Състоянието е чист JSON, за да може сървърът да го пази в базата данни.
//
// Редуктор на игра (js/games/<игра>/referee.js):
//   init({ seats, opts, seed }) → S          seats: [{ bot: bool, name }]
//   next(S) → { seat, type } | null          seat -1 = системна стъпка; null = край
//   validate(S, seat, type, data) → bool
//   apply(S, seat, type, data) → pub         публични данни за дневника
//   view(S, seat) → изглед за играча (карти, кой е на ход, възможни решения…)
//   ai(S, seat, type) → data                 решение на бот
//   result(S) → { winners: [seat], ... }     при край

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
    // изгледите се правят веднага – всеки играч вижда състоянието след тази стъпка
    const views = {};
    for (const h of humans()) views[h] = reducer.view(M.S, h);
    return { ...e, views };
  }

  // Изпълнява системните стъпки и ходовете на ботовете до решение на човек или край.
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
      if (!nx || nx.seat !== seat || nx.type !== type) throw new Error('Не е ваш ред.');
      if (!reducer.validate(M.S, seat, type, data)) throw new Error('Невалиден ход.');
      return [step(seat, type, data), ...advance()];
    },
    // прекъснал играч → бот (решенията му се вземат автоматично)
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

// Стъпките за конкретен играч: публичната част + неговият изглед.
const forSeat = (entries, seat) => entries.map(({ views, ...e }) => ({ ...e, view: views[seat] }));

return { createMatch, restoreMatch, forSeat };
})();

export const { createMatch, restoreMatch, forSeat } = __m['js/net/referee/core.js'];
export const REDUCERS = {belot: __m['js/games/belot/referee.js'].default, santase: __m['js/games/santase/referee.js'].default, blato: __m['js/games/blato/referee.js'].default};