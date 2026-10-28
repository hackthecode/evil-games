// Бърза (автоматична) битка между две армии. Детерминирана при еднакво зърно –
// същият резултат може да се пресметне и на сървъра.
import { COUNTER } from './data.js';

export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const mult = (a, b) => COUNTER[a]?.[b] ?? 1;

/**
 * side: [{ key, cls, n, hp, atk, def }] (atk/def вече с бонусите).
 * defMult/defHp – множители за защитниците (стена, нощен бонус).
 * Връща { win: 'att' | 'def', rounds, att: [{key, n, lost, dmg}], def: [...] }.
 * Стрелците стрелят сами в първия рунд; после всички едновременно.
 */
export function fight(attSide, defSide, seed, { maxRounds = 8, defMult = 1, defHp = 1 } = {}) {
  const rand = rng(seed);
  const prep = (side, dm = 1, hm = 1) => side.filter((g) => g.n > 0).map((g) => ({ ...g, def: g.def * dm, hp: g.hp * hm, start: g.n, dmg: 0 }));
  const A = prep(attSide), D = prep(defSide, defMult, defHp);
  const alive = (side) => side.some((g) => g.n > 0);
  let round = 0;
  while (alive(A) && alive(D) && round < maxRounds) {
    round++;
    const onlyRanged = round === 1;
    const hitA = volley(A, D, onlyRanged, rand);
    const hitD = volley(D, A, onlyRanged, rand);
    apply(D, hitA);
    apply(A, hitD);
  }
  const out = (side) => side.map((g) => ({ key: g.key, n: g.n, lost: g.start - g.n, dmg: g.n > 0 ? g.dmg / g.hp : 0 }));
  return { win: alive(A) && !alive(D) ? 'att' : 'def', rounds: round, att: out(A), def: out(D) };
}

function volley(from, to, onlyRanged, rand) {
  const hits = to.map(() => 0);
  const targets = to.map((t) => (t.n > 0 ? t.n * t.hp : 0));
  const total = targets.reduce((a, b) => a + b, 0);
  if (!total) return hits;
  for (const g of from) {
    if (g.n <= 0 || (onlyRanged && g.cls !== 'ranged')) continue;
    const power = g.n * g.atk * (0.9 + rand() * 0.2);
    to.forEach((t, i) => {
      if (!targets[i]) return;
      hits[i] += ((power * targets[i]) / total) * mult(g.cls, t.cls) * (10 / (10 + t.def * 2));
    });
  }
  return hits;
}

function apply(side, hits) {
  side.forEach((g, i) => {
    if (!hits[i] || g.n <= 0) return;
    g.dmg += hits[i];
    const dead = Math.min(g.n, Math.floor(g.dmg / g.hp));
    g.n -= dead;
    g.dmg -= dead * g.hp;
  });
}

// Груба оценка на силата на армия (за подсказки в интерфейса).
export const power = (side, defMult = 1) => Math.round(side.reduce((a, g) => a + g.n * Math.sqrt(g.hp * Math.max(g.atk, 0.5) * (1 + (g.def * defMult) / 5)), 0));
