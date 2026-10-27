// Варианти на таблата с общ интерфейс за интерфейса на играта:
//   'tabla'   – обикновена табла (двигателят от engine.js);
//   'tapa'    – без биене: единичен противников пул се „затапва“ (затиска);
//   'gulbara' – двамата се движат в една посока, единичен пул блокира точката,
//               чифтовете от 4-тия ход нататък ескалират до 6-6.
//
// Състояние на вариантите: pts[0..23] = { o: собственик (-1 празно), n: брой, pin: затиснат пул (-1 няма) }.
// Ходовете са в перспективата на играча: от 23 към 0, домът е 0..5, OFF = -1.
import * as STD from './engine.js';

export const OFF = -1;

export function variantEngine(variant) {
  if (variant === 'tapa' || variant === 'gulbara') return raceEngine(variant);
  return standardEngine();
}

// ---------- обикновена табла: обвивка на engine.js ----------
function standardEngine() {
  const pair = (list) => (list.length === 4 ? [list[0], list[0]] : list);
  return {
    variant: 'tabla',
    hasBar: true,
    initialState: STD.initialState,
    cloneState: STD.cloneState,
    legalSequences: (s, p, list) => STD.legalSequences(s, p, pair(list)),
    chooseSequence: (s, p, list, level) => STD.chooseSequence(s, p, pair(list), level),
    applySingle: STD.applySingle,
    toReal: STD.toReal,
    pipCount: STD.pipCount,
    winner: STD.winner,
    winPoints: STD.winPoints,
    // пуловете на всяка точка отдолу нагоре (собственик на всеки пул)
    stacks: (s) => s.pts.map((v) => Array(Math.abs(v)).fill(v > 0 ? 0 : 1)),
  };
}

// ---------- Тапа и Гюлбара ----------
function raceEngine(variant) {
  const tapa = variant === 'tapa';
  // Гюлбара: черните тръгват от долния ляв ъгъл и се движат в същата посока като белите.
  const real = (p, i) => (p === 0 ? i : tapa ? 23 - i : (i + 12) % 24);
  const persp = (p, r) => (p === 0 ? r : tapa ? 23 - r : (r + 12) % 24);
  const empty = () => ({ o: -1, n: 0, pin: -1 });

  function initialState() {
    const pts = Array.from({ length: 24 }, empty);
    pts[real(0, 23)] = { o: 0, n: 15, pin: -1 };
    pts[real(1, 23)] = { o: 1, n: 15, pin: -1 };
    return { pts, bar: [0, 0], off: [0, 0] };
  }
  const cloneState = (s) => ({ pts: s.pts.map((x) => ({ ...x })), bar: s.bar.slice(), off: s.off.slice() });

  // всички пулове на p на точката (включително затиснат)
  const count = (s, p, i) => {
    const x = s.pts[real(p, i)];
    return (x.o === p ? x.n : 0) + (x.pin === p ? 1 : 0);
  };
  const movable = (s, p, i) => s.pts[real(p, i)].o === p;

  function allHome(s, p) {
    for (let i = 6; i < 24; i++) if (count(s, p, i)) return false;
    return true;
  }

  function canLand(x, p) {
    if (x.o === -1 || x.o === p) return true;
    // противников пул: в Тапа единичен незатиснал пул се затапва; в Гюлбара всеки пул блокира
    return tapa && x.n === 1 && x.pin === -1;
  }

  function singleMoves(s, p, die) {
    const res = [];
    const home = allHome(s, p);
    let highest = -1;
    if (home) for (let i = 5; i >= 0; i--) if (count(s, p, i)) { highest = i; break; }
    for (let i = 0; i < 24; i++) {
      if (!movable(s, p, i)) continue;
      const to = i - die;
      if (to >= 0) {
        if (canLand(s.pts[real(p, to)], p)) res.push({ from: i, to, die });
      } else if (home && (to === -1 || i === highest)) {
        res.push({ from: i, to: OFF, die });
      }
    }
    return res;
  }

  function applySingle(s, p, m) {
    const n = cloneState(s);
    const src = n.pts[real(p, m.from)];
    src.n--;
    if (src.n === 0) {
      // ако под пула е бил затиснат противников пул – освобождава се
      if (src.pin !== -1) Object.assign(src, { o: src.pin, n: 1, pin: -1 });
      else src.o = -1;
    }
    let pin = false;
    if (m.to === OFF) n.off[p]++;
    else {
      const dst = n.pts[real(p, m.to)];
      if (dst.o === -1) Object.assign(dst, { o: p, n: 1 });
      else if (dst.o === p) dst.n++;
      else {
        Object.assign(dst, { pin: dst.o, o: p, n: 1 });
        pin = true;
      }
    }
    return { state: n, hit: false, pin };
  }

  // Всички пълни последователности за списък от ходове (2 зара или 4 при чифт,
  // в Гюлбара – и остатък от ескалиращ чифт) с правилото за максимално използване.
  function legalSequences(s, p, list) {
    const orders = list.length === 2 && list[0] !== list[1] ? [list, [list[1], list[0]]] : [list];
    const seqs = [];
    const seen = new Set();
    for (const order of orders) {
      const rec = (st, idx, path) => {
        const ms = idx < order.length ? singleMoves(st, p, order[idx]) : [];
        if (!ms.length) {
          const k = JSON.stringify(st.pts) + st.off + '|' + path.map((m) => m.from + '>' + m.to).join(' ');
          if (!seen.has(k)) {
            seen.add(k);
            seqs.push({ moves: path, state: st });
          }
          return;
        }
        for (const m of ms) {
          const { state, pin } = applySingle(st, p, m);
          rec(state, idx + 1, [...path, { ...m, pin }]);
        }
      };
      rec(s, 0, []);
    }
    const maxLen = Math.max(0, ...seqs.map((q) => q.moves.length));
    let valid = seqs.filter((q) => q.moves.length === maxLen);
    if (maxLen === 1 && list.length === 2 && list[0] !== list[1]) {
      const big = Math.max(...list);
      if (valid.some((q) => q.moves[0].die === big)) valid = valid.filter((q) => q.moves[0].die === big);
    }
    return valid;
  }

  const toReal = (p, m) => ({
    from: real(p, m.from),
    to: m.to === OFF ? 'off' : real(p, m.to),
    die: m.die,
    hit: false,
  });

  function pipCount(s, p) {
    let n = 0;
    for (let i = 0; i < 24; i++) n += count(s, p, i) * (i + 1);
    return n;
  }

  // „Майка“ (Тапа): затапен последен пул на началната точка – незабавна загуба.
  const motherPinned = (s, q) => tapa && s.pts[real(q, 23)].pin === q;

  function winner(s) {
    for (const q of [0, 1]) if (motherPinned(s, q)) return 1 - q;
    if (s.off[0] === 15) return 0;
    if (s.off[1] === 15) return 1;
    return -1;
  }

  // 1 точка; 2 – марс (губещият не е изнесъл нито един пул) или затапена „майка“.
  const winPoints = (s, w) => (motherPinned(s, 1 - w) || s.off[1 - w] === 0 ? 2 : 1);

  // ---------- AI ----------
  function evaluate(s, p) {
    const o = 1 - p;
    let score = (pipCount(s, o) - pipCount(s, p)) + (s.off[p] - s.off[o]) * 6;
    for (let r = 0; r < 24; r++) {
      const x = s.pts[r];
      if (x.o === p) {
        const i = persp(p, r);
        score += x.n >= 2 ? 1.5 : 0;
        if (x.n > 5) score -= (x.n - 5) * 0.6;
        if (tapa) {
          if (x.pin === o) score += 10 + (24 - persp(o, r)) * 0.3; // затиснат противник
          // единичен пул може да бъде затапен от противник, който идва отзад
          if (x.n === 1 && x.pin === -1) {
            for (let d = 1; d <= 12; d++) {
              const j = i + d;
              if (j > 23) break;
              if (s.pts[real(p, j)].o === o) { score -= d <= 6 ? 4 : 1.5; break; }
            }
          }
        } else {
          // Гюлбара: точка, която блокира пулове на противника, които идват отзад
          const oi = persp(o, r);
          for (let d = 1; d <= 6; d++) {
            const src = oi + d;
            if (src <= 23 && s.pts[real(o, src)].o === o) { score += 2; break; }
          }
        }
      } else if (x.o === o && tapa && x.pin === p) score -= 12;
    }
    for (const q of [0, 1]) if (motherPinned(s, q)) score += q === p ? -1000 : 1000;
    if (tapa) {
      // „майката“: единичен пул на началната точка, до който противникът може да стигне, е огромен риск
      for (const q of [0, 1]) {
        const start = s.pts[real(q, 23)];
        if (start.o !== q || start.n !== 1 || start.pin !== -1) continue;
        const enemy = 1 - q;
        let threat = 0;
        for (let d = 1; d <= 12; d++) {
          // противникът стига началната точка на q (своята точка 0) от своята точка d
          if (s.pts[real(enemy, d)].o === enemy) threat = Math.max(threat, d <= 6 ? 3 : 1);
        }
        if (threat) score += (q === p ? -1 : 1) * 25 * threat;
      }
    }
    return score;
  }

  function chooseSequence(s, p, list, level = 'medium') {
    const seqs = legalSequences(s, p, list);
    if (seqs.length <= 1) return seqs[0] || { moves: [], state: s };
    const noise = level === 'easy' ? 20 : level === 'medium' ? 3 : 0;
    let best = null, bestScore = -Infinity;
    for (const q of seqs) {
      const sc = evaluate(q.state, p) + (Math.random() * 2 - 1) * noise;
      if (sc > bestScore) { bestScore = sc; best = q; }
    }
    return best;
  }

  // пуловете на точката отдолу нагоре: затиснатият е най-отдолу
  const stacks = (s) => s.pts.map((x) => [...(x.pin !== -1 ? [x.pin] : []), ...Array(x.n).fill(x.o)]);

  return {
    variant, hasBar: false, initialState, cloneState, legalSequences, chooseSequence,
    applySingle, toReal, pipCount, winner, winPoints, stacks,
  };
}
