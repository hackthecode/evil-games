// Evil Empires – тактическа битка на ходове върху шестоъгълна карта.
// Детерминирана: една и съща битка + същите ходове дават един и същ резултат,
// затова сървърът може да провери битката, като повтори ходовете на играча.
// Нападателят е страна 'A' (играчът), защитникът – 'D' (компютърът).
import { TACTIC, TERRAIN, MOVES, COUNTER, FORMATION } from './data.js';
import { rng, hashStr } from './battle.js';

const EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
const MELEE = ['inf', 'spear', 'hero'];

export function neighbors(st, q, r) {
  return ((r & 1) ? ODD : EVEN).map(([dq, dr]) => [q + dq, r + dr]).filter(([a, b]) => a >= 0 && a < st.cols && b >= 0 && b < st.rows);
}

const cube = (q, r) => { const x = q - (r - (r & 1)) / 2; return [x, -x - r, r]; };
export function hexDist(a, b) {
  const [x1, y1, z1] = cube(a.q, a.r), [x2, y2, z2] = cube(b.q, b.r);
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

export const terrainAt = (st, q, r) => st.terrain[r * st.cols + q];
export const alive = (st, side) => st.units.filter((u) => u.side === side && u.n > 0);
const unitAt = (st, q, r) => st.units.find((u) => u.n > 0 && u.q === q && u.r === r);
export const rangeOf = (st, u) => (u.cls === 'ranged' ? 3 + (TERRAIN[terrainAt(st, u.q, u.r)].range || 0) : 1);

/**
 * Нова битка. att/def: групи { key, cls, n, hp, atk, def }; opts: { defMult, defHp, formA, formD }
 * (formA/formD – бойна формация: клас → 'front' | 'back' | 'flank').
 */
export function createBattle(seed, att, def, { defMult = 1, defHp = 1, formA = null, formD = null } = {}) {
  const cols = TACTIC.cols, rows = TACTIC.rows;
  const r = rng(hashStr(`tac:${seed}`));
  const terrain = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const deploy = x <= 1 || x >= cols - 2;
      const v = r();
      terrain.push(v < 0.14 ? 'forest' : v < 0.24 ? 'hill' : v < 0.3 && !deploy ? 'ruins' : v < 0.34 && !deploy ? 'water' : 'plain');
    }
  }
  const st = { seed: String(seed), cols, rows, terrain, units: [], turn: 1, side: 'A', over: false, win: null, defMult, defHp, k: 0, log: [] };
  let id = 0;
  const place = (groups, side, form) => {
    const F = { ...FORMATION, ...(form || {}) };
    const front = side === 'A' ? 1 : cols - 2, back = side === 'A' ? 0 : cols - 1, extra = side === 'A' ? 2 : cols - 3;
    const CENTER = [3, 2, 4, 1, 5, 0, 6], FLANK = [0, 6, 1, 5, 2, 4, 3];
    const used = new Set();
    const tryCol = (u, c, order) => {
      for (const row of order) {
        const key = `${c},${row}`;
        if (used.has(key) || terrain[row * cols + c] === 'water') continue;
        used.add(key);
        u.q = c;
        u.r = row;
        return true;
      }
      return false;
    };
    const put = (u, pos) => {
      const plan = pos === 'flank' ? [[back, FLANK], [front, FLANK]] : pos === 'back' ? [[back, CENTER], [front, CENTER]] : [[front, CENTER], [back, CENTER]];
      for (const [c, order] of [...plan, [extra, CENTER]]) if (tryCol(u, c, order)) return true;
      // ако няма място – където и да е в своята половина
      for (let c = 0; c < cols; c++) if ((side === 'A' ? c < cols / 2 : c >= cols / 2) && tryCol(u, c, CENTER)) return true;
      return false;
    };
    const list = groups.filter((g) => g.n > 0).map((g, gi) => ({
      id: id++, gi, side, key: g.key, cls: g.cls === 'elite' ? 'inf' : g.cls, n: g.n, start: g.n,
      hp: g.hp * (side === 'D' ? defHp : 1), atk: g.atk, def: g.def, dmg: 0, q: 0, r: 0, moved: false, acted: false,
    }));
    const rank = { front: 0, flank: 1, back: 2 };
    for (const u of [...list].sort((a, b) => rank[F[a.cls] || 'front'] - rank[F[b.cls] || 'front'])) put(u, F[u.cls] || 'front');
    st.units.push(...list);
  };
  place(att, 'A', formA);
  place(def, 'D', formD);
  return st;
}

// Полета, до които единицата може да стигне този ход: { "q,r": цена }.
export function reachable(st, u) {
  const out = new Map();
  if (u.moved || u.acted || u.n <= 0) return out;
  const mp = MOVES[u.cls] || 2;
  const enemyNear = (q, r) => neighbors(st, q, r).some(([a, b]) => { const e = unitAt(st, a, b); return e && e.side !== u.side; });
  const best = new Map([[`${u.q},${u.r}`, 0]]);
  const queue = [[u.q, u.r, 0]];
  while (queue.length) {
    queue.sort((a, b) => a[2] - b[2]);
    const [q, r, c] = queue.shift();
    if (c > (best.get(`${q},${r}`) ?? Infinity)) continue;
    if ((q !== u.q || r !== u.r) && enemyNear(q, r)) continue; // зона на контрол: спира тук
    for (const [a, b] of neighbors(st, q, r)) {
      const cost = c + TERRAIN[terrainAt(st, a, b)].cost;
      if (cost > mp || unitAt(st, a, b)) continue;
      const key = `${a},${b}`;
      if (cost < (best.get(key) ?? Infinity)) {
        best.set(key, cost);
        out.set(key, cost);
        queue.push([a, b, cost]);
      }
    }
  }
  return out;
}

export function targets(st, u) {
  if (u.acted || u.n <= 0) return [];
  const R = rangeOf(st, u);
  return st.units.filter((e) => e.n > 0 && e.side !== u.side && hexDist(u, e) <= R);
}

const mult = (a, b) => COUNTER[a]?.[b] ?? 1;

// Очакваната сила на удар (без случайност) – за изкуствения интелект и подсказките.
export function strike(st, a, t, roll = 1) {
  const ranged = a.cls === 'ranged';
  let power = a.n * a.atk * roll * mult(a.cls, t.cls);
  if (ranged && hexDist(a, t) <= 1) power *= 0.5;
  if (st.units.some((h) => h.cls === 'hero' && h.side === a.side && h.n > 0 && h !== a && hexDist(h, a) === 1)) power *= 1.1;
  if (t.hit) power *= 1.15;
  const terr = TERRAIN[terrainAt(st, t.q, t.r)];
  const tdef = terr.vsRanged && !ranged ? 1 : terr.def;
  const def = t.def * (t.side === 'D' ? st.defMult : 1);
  return (power * (10 / (10 + def * 2))) / tdef;
}

function damage(u, dmg) {
  u.dmg += dmg;
  const dead = Math.min(u.n, Math.floor(u.dmg / u.hp));
  u.n -= dead;
  u.dmg -= dead * u.hp;
  if (u.n <= 0) u.dmg = 0;
  return dead;
}

function checkOver(st) {
  const a = alive(st, 'A').length, d = alive(st, 'D').length;
  if (!a || !d) { st.over = true; st.win = d ? 'def' : 'att'; }
}

export function move(st, id, q, r) {
  const u = st.units.find((x) => x.id === id);
  if (st.over || !u || u.side !== st.side || u.n <= 0) return false;
  if (!reachable(st, u).has(`${q},${r}`)) return false;
  u.q = q;
  u.r = r;
  u.moved = true;
  return true;
}

export function attack(st, id, tid) {
  const a = st.units.find((x) => x.id === id);
  const t = st.units.find((x) => x.id === tid);
  if (st.over || !a || !t || a.side !== st.side || a.n <= 0 || t.n <= 0 || a.acted) return false;
  if (!targets(st, a).includes(t)) return false;
  const roll = 0.9 + rng(hashStr(`${st.seed}:${st.k++}`))() * 0.2;
  const kills = damage(t, strike(st, a, t, roll));
  let back = 0;
  if (a.cls !== 'ranged' && t.n > 0 && t.cls !== 'ranged' && hexDist(a, t) === 1) {
    const save = t.hit;
    t.hit = false;
    back = damage(a, strike(st, t, a, 1) * 0.5);
    t.hit = save;
  }
  t.hit = true;
  a.acted = true;
  a.moved = true;
  st.log.push({ turn: st.turn, a: a.id, t: t.id, kills, back });
  if (st.log.length > 60) st.log.shift();
  checkOver(st);
  return true;
}

// Изкуственият интелект играе всички единици на страната.
export function ai(st, side) {
  const mine = alive(st, side).sort((a, b) => (a.cls === 'ranged' ? -1 : 0) - (b.cls === 'ranged' ? -1 : 0) || (MOVES[b.cls] || 2) - (MOVES[a.cls] || 2) || a.id - b.id);
  for (const u of mine) {
    if (st.over || u.n <= 0) continue;
    const foes = alive(st, side === 'A' ? 'D' : 'A');
    if (!foes.length) break;
    const best = (list) => list.sort((x, y) => strike(st, u, y) / y.hp - strike(st, u, x) / x.hp || x.id - y.id)[0];
    let tg = targets(st, u);
    if (u.cls === 'ranged' && tg.length) { attack(st, u.id, best(tg).id); continue; }
    if (!(u.cls !== 'ranged' && tg.length)) {
      // избор на цел: близка и слаба срещу нас, с бонус за контра
      const goal = foes.slice().sort((x, y) => hexDist(u, x) - 2 * (mult(u.cls, x.cls) > 1) - (hexDist(u, y) - 2 * (mult(u.cls, y.cls) > 1)) || x.id - y.id)[0];
      const reach = reachable(st, u);
      let pick = null, score = Infinity;
      for (const [key, cost] of reach) {
        const [q, r] = key.split(',').map(Number);
        const d = hexDist({ q, r }, goal);
        const want = u.cls === 'ranged' ? Math.abs(d - Math.min(3, rangeOf(st, u))) * 2 + (d <= 1 ? 4 : 0) : d;
        const sc = want * 10 + cost - TERRAIN[terrainAt(st, q, r)].def * 2;
        if (sc < score) { score = sc; pick = [q, r]; }
      }
      const stay = u.cls === 'ranged' ? Math.abs(hexDist(u, goal) - 3) * 2 * 10 : hexDist(u, goal) * 10;
      if (pick && score < stay) move(st, u.id, pick[0], pick[1]);
      tg = targets(st, u);
    }
    if (tg.length && !st.over) attack(st, u.id, best(tg).id);
  }
}

export function endTurn(st) {
  if (st.over) return;
  if (st.side === 'A') {
    st.side = 'D';
    for (const u of st.units) { u.moved = false; u.acted = false; u.hit = false; }
    ai(st, 'D');
    if (st.over) return;
    st.turn++;
    st.side = 'A';
    for (const u of st.units) { u.moved = false; u.acted = false; u.hit = false; }
    if (st.turn > TACTIC.maxTurns) { st.over = true; st.win = 'def'; }
  }
}

export function autoFinish(st) {
  for (let i = 0; i < 100 && !st.over; i++) {
    if (st.side === 'A') ai(st, 'A');
    endTurn(st);
  }
}

// Ходовете на играча: { m: [id, q, r] }, { a: [id, targetId] }, { end: 1 }, { auto: 1 }.
export function applyMove(st, mv) {
  if (st.over || !mv) return false;
  if (mv.m) return move(st, mv.m[0], mv.m[1], mv.m[2]);
  if (mv.a) return attack(st, mv.a[0], mv.a[1]);
  if (mv.end) { endTurn(st); return true; }
  if (mv.auto) { autoFinish(st); return true; }
  return false;
}

export function result(st) {
  const sideOut = (side) => st.units.filter((u) => u.side === side).sort((a, b) => a.gi - b.gi)
    .map((u) => ({ key: u.key, n: u.n, lost: u.start - u.n, dmg: u.n > 0 ? u.dmg / u.hp : 0 }));
  return { win: st.win || 'def', rounds: st.turn, att: sideOut('A'), def: sideOut('D'), tactical: true };
}

// Проверка на сървъра: повтаря ходовете; недовършената битка се довършва автоматично.
export function replay(b, moves) {
  const st = createBattle(b.seed, b.att, b.def, b.opts);
  for (const mv of (moves || []).slice(0, 2000)) { if (st.over) break; applyMove(st, mv); }
  if (!st.over) autoFinish(st);
  return result(st);
}
