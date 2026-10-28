// Evil Empires – логика на играта. Състоянието е обикновен JSON обект; времето тече
// „мързеливо“: advance(s, t, env) пресмята всичко, случило се от последното обновяване
// (производство, строежи, обучение, походи, битки, нападения) – и докато играчът го няма.
// env.world (по желание) свързва играча с общия свят: други играчи, съюзи, оазиси.
// Действията хвърлят Error с текст за играча, ако не са възможни.
import {
  RES, RACES, EPOCHS, MAX_EPOCH, EPOCH_UP, BUILDINGS, UNIQUE, COST_GROWTH, TIME_GROWTH,
  UNITS, UNIT_NAMES, FIGHTERS, unitCls, TECHS, TECH_PROD, WORLD_SPEED,
  HERO, ITEM_FX, ITEM_NAMES, ADVENTURE, OASIS_BONUS, OASIS_RANGE, OASIS_RESPAWN,
  CAMP_RESPAWN, CAMP_SLOTS, CAMP_START, CAMP_NAMES, PROTECTION, NIGHT, NPC_ATTACK_EVERY, NPC_CLANS, PACT,
  STORY, DAILY, TACTIC, resName,
} from './data.js';
import { fight, hashStr, rng, power } from './battle.js';
import { tileAt, npcList, dist, tileKey, campSpots, inWorld } from './worldgen.js';
import { replay } from './tactics.js';

const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

// Времето на играта е българското – и в браузъра, и на сървъра.
const SOFIA = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sofia', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric' });
const sofia = (t) => Object.fromEntries(SOFIA.formatToParts(new Date(t)).map((x) => [x.type, x.value]));

const HOUR = 3600000;
const fail = (msg) => { throw new Error(msg); };
const round5 = (x) => Math.max(5, Math.round(x / 5) * 5);
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

// ---------- ново състояние и миграция ----------
function newCity(id, name, x, y, res) {
  return { id, name, x, y, res: { gold: 300, wood: 500, stone: 400, food: 400, mana: 0, souls: 0, ...res }, b: { hall: 1 }, queue: [], train: [], units: {} };
}

function newHero() {
  return { name: 'Героят', lvl: 1, xp: 0, health: 100, free: HERO.startPoints, points: { str: 0, off: 0, def: 0, res: 0 }, items: [], eq: {}, city: 'c1', state: 'home', reviveEnd: 0 };
}

export function newGame(race, name, t = Date.now(), seed = (Math.random() * 2 ** 32) >>> 0, { uid = 'local', home = { x: 0, y: 0 }, worldSeed = 1 } = {}) {
  if (!RACES[race]) fail('Непозната раса.');
  const spots = campSpots(worldSeed, home);
  return {
    v: 2, uid, race, name, created: t, t, speed: 1, seed, seq: 1, world: worldSeed,
    epoch: 1, techs: {}, research: null, epochUp: null,
    cities: [newCity('c1', 'Столица', home.x, home.y)], active: 'c1',
    marches: [], abroad: [], incoming: [], reports: [], log: [],
    camps: CAMP_SLOTS.map((d, id) => ({ id, dist: d, lvl: CAMP_START[id], respawn: 0, ...spots[id] })),
    hero: newHero(), adventures: [], advNext: t + 60000,
    oases: [], guards: {}, intel: {}, pacts: {},
    protectedUntil: t + PROTECTION * 1000, npcNext: t + PROTECTION * 1000,
    story: { claimed: [] }, daily: { day: '', prog: {}, claimed: [] },
    stats: { trained: 0, built: 0, raids: 0, researched: 0, bestCamp: 0, adventures: 0, scouted: 0, defWins: 0 },
  };
}

// Записите от първата версия (един град) се превръщат в новия формат.
export function migrate(s, { uid = 'local', home = { x: 0, y: 0 }, worldSeed = 1 } = {}) {
  if (s.v === 2) return s;
  const fresh = newGame(s.race, s.name, s.created, s.seed, { uid, home, worldSeed });
  const city = fresh.cities[0];
  Object.assign(city, { res: s.res, b: s.b, queue: s.queue || [], train: s.train || [], units: s.units || {} });
  const sp = s.speed || 1;
  Object.assign(fresh, {
    t: s.t, speed: sp, seq: s.seq, epoch: s.epoch, techs: s.techs, research: s.research, epochUp: s.epochUp,
    log: s.log || [], story: s.story, daily: s.daily, stats: { ...fresh.stats, ...s.stats },
    camps: s.camps.map((c, i) => ({ ...fresh.camps[i], lvl: c.lvl, respawn: c.respawn })),
    protectedUntil: s.t + (PROTECTION * 1000) / sp, npcNext: s.t + (PROTECTION * 1000) / sp, advNext: s.t + 60000 / sp,
  });
  // походите от старата версия се връщат у дома
  for (const m of s.marches || []) for (const [u, n] of Object.entries(m.units)) city.units[u] = (city.units[u] || 0) + n;
  return fresh;
}

// ---------- помощни ----------
export const cityOf = (s, id) => s.cities.find((c) => c.id === id) || s.cities[0];
export const lv = (c, id) => c.b[id] || 0;
export const maxLv = (s, id) => Math.max(0, ...s.cities.map((c) => lv(c, id)));
export const bName = (s, id) => (id === 'unique' ? UNIQUE[s.race].name : id === 'wall' && s.epoch >= 2 ? BUILDINGS.wall.name2 : (s.race === 'undead' && BUILDINGS[id].undeadName) || BUILDINGS[id].name);
export const bDesc = (s, id) => (id === 'unique' ? UNIQUE[s.race].desc : (s.race === 'undead' && BUILDINGS[id].undeadDesc) || BUILDINGS[id].desc);
export const uName = (s, u) => (u === 'hero' ? s.hero?.name || 'Героят' : UNIT_NAMES[s.race][u]);
const growth = (L) => L * 1.15 ** (L - 1);
const scaled = (s, sec) => Math.round((sec * 1000) / s.speed);

export function bCost(id, L) {
  const out = {};
  for (const [k, v] of Object.entries(BUILDINGS[id].cost)) out[k] = round5(v * COST_GROWTH ** (L - 1));
  return out;
}

export function bTime(s, c, id, L) {
  let t = BUILDINGS[id].time * TIME_GROWTH ** (L - 1);
  t *= Math.max(0.5, 1 - 0.04 * (lv(c, 'hall') - 1));
  if (s.race === 'humans') t *= 0.9;
  return scaled(s, t);
}

export function maxLevel(s, c, id) {
  const cap = EPOCHS[s.epoch - 1].cap;
  return id === 'hall' ? cap : Math.min(cap, lv(c, 'hall'));
}

export function bProd(s, id, L) {
  const base = id === 'unique' ? UNIQUE[s.race].prod : BUILDINGS[id].prod;
  if (!base || !L) return {};
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = v * growth(L);
  return out;
}

export const storageCap = (c) => Math.round(1500 * 1.5 ** lv(c, 'warehouse'));
export const capOf = (c, r) => (r === 'souls' ? Infinity : r === 'mana' ? storageCap(c) / 2 : storageCap(c));
export const crannyCap = (c) => (lv(c, 'cranny') ? Math.round(150 * 1.45 ** (lv(c, 'cranny') - 1)) : 0);
export const trapCap = (c) => (lv(c, 'traps') ? Math.round(6 * lv(c, 'traps') * 1.25 ** (lv(c, 'traps') - 1)) : 0);
export const wallBonus = (L, fort = false) => ({ def: 1 + 0.06 * L * (fort ? 1.5 : 1), hp: 1 + 0.03 * L * (fort ? 1.5 : 1) });
// Колко рано се вижда идващо нападение (зависи от стражевата кула).
export const warnWindow = (s, c) => scaled(s, 600 + 1200 * lv(c, 'tower'));
export const oasisSlots = (s) => { const L = maxLv(s, 'heroHall'); return (L >= 3) + (L >= 6) + (L >= 10); };
export const allowedCities = (s) => 1 + Math.floor(maxLv(s, 'hall') / 5);
export const embassyMax = (s) => 3 * maxLv(s, 'embassy');

export function popCap(s, c) {
  const L = lv(c, 'houses');
  return Math.round((20 + (L ? 15 * growth(L) : 0)) * (s.race === 'undead' ? 0.85 : 1));
}

export function popUsed(s, c) {
  let n = sum(c.units);
  for (const m of s.marches) if (m.from === c.id) n += sum(m.units);
  for (const a of s.abroad) if (a.from === c.id) n += sum(a.units);
  for (const b of c.train) n += b.n - b.done;
  return n;
}

const upkeepOf = (s, u) => (s.race === 'undead' ? 0 : UNITS[u].upkeep);
export function upkeep(s, c) {
  let total = 0;
  const add = (units) => { for (const [u, n] of Object.entries(units)) if (UNITS[u]) total += n * upkeepOf(s, u); };
  add(c.units);
  for (const m of s.marches) if (m.from === c.id) add(m.units);
  return total;
}

export const heroHome = (s, c) => s.hero.state === 'home' && s.hero.city === c.id;

// Нетно производство на час за всеки ресурс на града (вкл. издръжката на войската).
export function rates(s, c) {
  const r = Object.fromEntries(RES.map((k) => [k, 0]));
  Object.assign(r, { gold: 15, wood: 20, stone: 15, food: 20 });
  for (const id of Object.keys(c.b)) for (const [k, v] of Object.entries(bProd(s, id, lv(c, id)))) r[k] += v;
  for (const o of s.oases) if (o.city === c.id) r[o.res] *= 1 + OASIS_BONUS;
  for (const [t, k] of Object.entries(TECH_PROD)) if (s.techs[t]) r[k] *= 1.15;
  if (s.race === 'humans') for (const k of RES) r[k] *= 1.1;
  if (s.race === 'vesheri') r.mana *= 1.25;
  if (s.hero.city === c.id && s.hero.state !== 'dead') for (const k of RES) r[k] *= 1 + Math.min(25, s.hero.points.res) / 100;
  r.food -= upkeep(s, c);
  for (const k of RES) r[k] *= s.speed;
  return r;
}

export function unitStats(s, u, c = s.cities[0]) {
  const d = UNITS[u];
  const cls = unitCls(s.race, u);
  let atk = 1 + 0.03 * lv(c, 'smithy'), def = 1 + 0.03 * lv(c, 'smithy');
  if (s.techs.smith) atk += 0.1;
  if (s.techs.armor) def += 0.1;
  if (s.techs.tactics && cls === 'inf') atk += 0.1;
  if (s.race === 'orcs' && (cls === 'inf' || cls === 'spear')) atk += 0.2;
  if (s.race === 'vesheri' && cls === 'ranged') atk += 0.2;
  return { cls, hp: d.hp, atk: d.atk * atk, def: d.def * def, carry: d.carry, upkeep: upkeepOf(s, u), speed: d.speed };
}

export function uCost(s, u) {
  const m = s.race === 'undead' ? 0.8 : s.race === 'vesheri' ? 1.2 : 1;
  const out = {};
  for (const [k, v] of Object.entries(UNITS[u].cost)) out[k] = Math.round(v * m);
  return out;
}

export function uTime(s, c, u) {
  let t = UNITS[u].time * Math.max(0.5, 1 - 0.04 * (lv(c, 'barracks') - 1));
  if (s.race === 'orcs') t *= Math.max(0.6, 1 - 0.05 * lv(c, 'unique'));
  if (UNITS[u].cls === 'cav') t *= Math.max(0.6, 1 - 0.05 * lv(c, 'stable'));
  return scaled(s, t);
}

export function tTime(s, id) {
  let t = TECHS[id].time * Math.max(0.5, 1 - 0.05 * (maxLv(s, 'academy') - 1));
  if (s.race === 'orcs') t *= 1.2;
  return scaled(s, t);
}

const mul = (cost, n) => Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, v * n]));
export const canPay = (c, cost) => Object.entries(cost).every(([k, v]) => c.res[k] >= v - 1e-6);
function pay(s, c, cost) {
  const miss = Object.entries(cost).filter(([k, v]) => c.res[k] < v - 1e-6).map(([k]) => resName(s.race, k).toLowerCase());
  if (miss.length) fail(`Не стига: ${miss.join(', ')}.`);
  for (const [k, v] of Object.entries(cost)) c.res[k] = Math.max(0, c.res[k] - v);
}

function addRes(c, bundle, capped) {
  for (const [k, v] of Object.entries(bundle)) {
    if (!v) continue;
    c.res[k] = capped ? Math.max(c.res[k], Math.min(capOf(c, k), c.res[k] + v)) : c.res[k] + v;
  }
}

function log(s, t, text, kind = 'info') {
  s.log.push({ id: s.seq++, t, text, kind });
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
}

function report(s, r) {
  s.reports.unshift({ id: s.seq++, ...r });
  if (s.reports.length > 30) s.reports.length = 30;
}

// ---------- герой ----------
export const itemOf = (it) => ({ ...it, name: ITEM_NAMES[it.slot][it.tier - 1], val: ITEM_FX[it.slot].val[it.tier - 1], text: ITEM_FX[it.slot].text(ITEM_FX[it.slot].val[it.tier - 1]) });
const eqVal = (s, slot) => { const it = s.hero.items.find((i) => i.id === s.hero.eq[slot]); return it ? ITEM_FX[slot].val[it.tier - 1] : 0; };

export function heroStats(s) {
  const h = s.hero;
  return {
    atk: 12 + 4 * h.points.str + eqVal(s, 'weapon'),
    hp: 70 + 15 * h.lvl + eqVal(s, 'armor'),
    def: 3 + 0.5 * h.lvl,
    armorRed: Math.round(eqVal(s, 'armor') / 7) / 100,
    xpBonus: eqVal(s, 'helmet') / 100,
    speed: HERO.speed * (1 + eqVal(s, 'horse') / 100),
    regen: HERO.regen + eqVal(s, 'amulet') + 3 * lv(cityOf(s, h.city), 'temple'),
    off: Math.min(100, h.points.off) * 0.002,
    def2: Math.min(100, h.points.def) * 0.002,
  };
}

const heroGroup = (s) => { const st = heroStats(s); return { key: 'hero', cls: 'hero', n: 1, hp: st.hp, atk: st.atk, def: st.def, carry: 0 }; };

function heroXp(s, t, xp) {
  const h = s.hero;
  h.xp += Math.round(xp * (1 + heroStats(s).xpBonus));
  while (h.xp >= HERO.xpFor(h.lvl)) {
    h.xp -= HERO.xpFor(h.lvl);
    h.lvl++;
    h.free += HERO.pointsPerLevel;
    log(s, t, `${h.name} достигна ниво ${h.lvl}!`, 'win');
  }
}

// Раните на героя след битка: g – резултатът за групата 'hero'.
function heroWounds(s, t, g) {
  if (!g) return;
  const h = s.hero;
  if (g.n <= 0) {
    h.health = 0;
    h.state = 'dead';
    log(s, t, `${h.name} падна в битка. Съживете го в Залата на героите.`, 'loss');
  } else h.health = Math.max(1, h.health - g.dmg * 100 * (1 - heroStats(s).armorRed));
}

export function assignPoint(s, key) {
  if (!s.hero.free) fail('Нямате свободни точки.');
  if (!own(s.hero.points, key)) fail('Няма такова умение.');
  s.hero.points[key]++;
  s.hero.free--;
}

export function equip(s, itemId) {
  const it = s.hero.items.find((i) => i.id === itemId);
  if (!it) fail('Няма такъв предмет.');
  if (s.hero.state !== 'home') fail('Героят трябва да е у дома.');
  s.hero.eq[it.slot] = it.id;
}

export function unequip(s, slot) {
  if (s.hero.state !== 'home') fail('Героят трябва да е у дома.');
  delete s.hero.eq[slot];
}

export function sellItem(s, t, cid, itemId) {
  const i = s.hero.items.findIndex((x) => x.id === itemId);
  if (i < 0) fail('Няма такъв предмет.');
  const [it] = s.hero.items.splice(i, 1);
  if (s.hero.eq[it.slot] === it.id) delete s.hero.eq[it.slot];
  addRes(cityOf(s, cid), { gold: 100 * it.tier ** 2, souls: it.tier * 2 }, false);
}

export const reviveCost = (s) => ({ gold: Math.round(150 * s.hero.lvl ** 1.3), food: Math.round(200 * s.hero.lvl ** 1.2), souls: s.hero.lvl });
export const reviveTime = (s) => scaled(s, 1200 + 600 * s.hero.lvl);

export function reviveHero(s, t, cid, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  if (s.hero.state !== 'dead') fail('Героят е жив.');
  if (s.hero.reviveEnd) fail('Героят вече се съживява.');
  if (!lv(c, 'heroHall')) fail('Нужна е Зала на героите в този град.');
  pay(s, c, reviveCost(s));
  s.hero.city = c.id;
  s.hero.reviveEnd = t + reviveTime(s);
}

// ---------- време ----------
function accrue(s, to) {
  if (to <= s.t) return;
  const hours = (to - s.t) / HOUR;
  for (const c of s.cities) {
    const r = rates(s, c);
    for (const k of RES) {
      const d = r[k] * hours;
      const cap = capOf(c, k);
      if (d > 0) { if (c.res[k] < cap) c.res[k] = Math.min(cap, c.res[k] + d); }
      else if (d < 0) c.res[k] = Math.max(0, c.res[k] + d);
    }
  }
  const h = s.hero;
  if (h.state !== 'dead') h.health = Math.min(100, h.health + heroStats(s).regen * hours * s.speed);
  s.t = to;
}

function nextEvent(s, env) {
  let best = null;
  const take = (t, run) => { if (t != null && (!best || t < best.t)) best = { t, run }; };
  for (const c of s.cities) {
    for (const q of c.queue) take(q.end, () => finishBuild(s, c, q));
    if (c.train.length) {
      const b = c.train[0];
      take(b.start + b.each * (b.done + 1), () => finishUnit(s, c, b));
    }
  }
  if (s.research) take(s.research.end, () => finishResearch(s));
  if (s.epochUp) take(s.epochUp.end, () => finishEpoch(s));
  for (const m of s.marches) {
    if (m.phase === 'go') take(m.arrive, () => arrive(s, m, env));
    else if (m.phase === 'back') take(m.back, () => comeBack(s, m));
    else if (m.phase === 'battle') take(m.battle.expires, () => { const b = m.battle; conclude(s, m, env, b, b.def.length ? fight(b.att, b.def, b.seed, b.opts) : emptyWin(b.att), b.expires); });
  }
  for (const c of s.camps) if (c.respawn) take(c.respawn, () => { c.respawn = 0; c.lvl = Math.min(campMax(s), c.lvl + 1); });
  for (const g of Object.values(s.guards)) if (g.respawn) take(g.respawn, () => { g.respawn = 0; g.alive = 1; });
  if (s.hero.reviveEnd) take(s.hero.reviveEnd, () => { Object.assign(s.hero, { reviveEnd: 0, state: 'home', health: 100 }); log(s, s.t, `${s.hero.name} се върна към живота.`, 'win'); });
  take(s.advNext, () => spawnAdventure(s));
  for (const a of s.adventures) take(a.expires, () => s.adventures.splice(s.adventures.indexOf(a), 1));
  take(s.npcNext, () => launchNpc(s, s.npcNext, env));
  for (const inc of s.incoming) take(inc.arrive, () => npcArrives(s, inc, env));
  if (env?.world) for (const inc of env.world.incomingFor(s.uid)) take(inc.arrive, () => pvpArrives(s, inc, env));
  return best;
}

export function advance(s, to = Date.now(), env = null) {
  // походи, които чакат резултат от битка с друг играч
  for (const m of [...s.marches]) if (m.phase === 'wait') tryPvpResult(s, m, env);
  for (let guard = 0; guard < 100000; guard++) {
    const ev = nextEvent(s, env);
    if (!ev || ev.t > to) break;
    accrue(s, ev.t);
    ev.run();
  }
  accrue(s, to);
  return s;
}

export function setSpeed(s, t, speed, env) {
  advance(s, t, env);
  const k = s.speed / speed;
  const rescale = (x) => (x && x > t ? t + (x - t) * k : x);
  s.protectedUntil = rescale(s.protectedUntil);
  s.npcNext = rescale(s.npcNext);
  s.advNext = rescale(s.advNext);
  s.speed = speed;
}

// ---------- дневни мисии ----------
export const dayKey = (t) => { const p = sofia(t); return `${p.year}-${+p.month}-${+p.day}`; };
function ensureDaily(s, t) { const day = dayKey(t); if (s.daily.day !== day) s.daily = { day, prog: {}, claimed: [] }; }
function bump(s, t, key, n = 1) {
  s.stats[key] = (s.stats[key] || 0) + n;
  ensureDaily(s, t);
  s.daily.prog[key] = (s.daily.prog[key] || 0) + n;
}

export function dailyList(s, t = Date.now()) {
  ensureDaily(s, t);
  const rand = rng(hashStr(`${s.seed}:${s.daily.day}`));
  const pool = [...DAILY];
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  const scale = 150 * maxLv(s, 'hall') ** 1.4;
  return out.map((d) => ({
    ...d,
    have: Math.min(d.goal, s.daily.prog[d.key] || 0),
    claimed: s.daily.claimed.includes(d.id),
    prize: { ...Object.fromEntries(Object.entries(d.reward).map(([k, v]) => [k, Math.round((v * scale) / 10) * 10])), ...(d.souls ? { souls: d.souls } : {}) },
  }));
}

export function claimDaily(s, t, cid, id, env) {
  advance(s, t, env);
  const d = dailyList(s, t).find((x) => x.id === id);
  if (!d || d.claimed) fail('Наградата вече е взета.');
  if (d.have < d.goal) fail('Мисията още не е изпълнена.');
  s.daily.claimed.push(id);
  addRes(cityOf(s, cid), d.prize, false);
}

export function storyList(s) {
  return STORY.map((m) => ({ ...m, text: (s.race === 'undead' && m.undeadText) || m.text, have: Math.min(m.goal, m.get(s)), claimed: s.story.claimed.includes(m.id) }));
}

export function claimStory(s, t, cid, id, env) {
  advance(s, t, env);
  const m = storyList(s).find((x) => x.id === id);
  if (!m || m.claimed) fail('Наградата вече е взета.');
  if (m.have < m.goal) fail('Мисията още не е изпълнена.');
  s.story.claimed.push(id);
  addRes(cityOf(s, cid), m.reward, false);
}

// ---------- строеж ----------
export const buildSlots = (s) => (s.techs.logistics ? 2 : 1);

export function buildState(s, c, id) {
  const def = BUILDINGS[id];
  const L = lv(c, id);
  const q = c.queue.find((x) => x.id === id);
  if (q) return { status: 'building', q };
  if (def.epoch > s.epoch) return { status: 'locked', why: `Отключва се в ${EPOCHS[def.epoch - 1].name}.` };
  if (def.tech && !s.techs[def.tech]) return { status: 'locked', why: `Нужна е технологията „${TECHS[def.tech].name}“.` };
  for (const [b, n] of Object.entries(def.need || {})) if (lv(c, b) < n) return { status: 'locked', why: `Нужно е: ${bName(s, b)} ниво ${n}.` };
  if (L >= EPOCHS[s.epoch - 1].cap) return { status: 'max', why: s.epoch >= MAX_EPOCH ? 'Максимално ниво в тази версия.' : 'Максимално ниво за епохата – преминете в следващата.' };
  if (L >= maxLevel(s, c, id)) return { status: 'max', why: 'Първо подобрете Цитаделата.' };
  if (c.queue.length >= buildSlots(s)) return { status: 'busy', why: 'Строителите са заети.' };
  return { status: 'ok' };
}

export function build(s, t, cid, id, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  if (!own(BUILDINGS, id)) fail('Няма такава сграда.');
  const st = buildState(s, c, id);
  if (st.status !== 'ok') fail(st.status === 'building' ? 'Вече се строи.' : st.why);
  const L = lv(c, id) + 1;
  const cost = bCost(id, L);
  pay(s, c, cost);
  c.queue.push({ id, lvl: L, start: t, end: t + bTime(s, c, id, L), cost });
  bump(s, t, 'built');
}

export function cancelBuild(s, t, cid, id, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  const i = c.queue.findIndex((q) => q.id === id);
  if (i < 0) fail('Няма такъв строеж.');
  const [q] = c.queue.splice(i, 1);
  addRes(c, mul(q.cost, 0.8), false);
}

function finishBuild(s, c, q) {
  c.queue.splice(c.queue.indexOf(q), 1);
  c.b[q.id] = q.lvl;
  const where = s.cities.length > 1 ? ` (${c.name})` : '';
  log(s, q.end, q.lvl === 1 ? `Завършен строеж: ${bName(s, q.id)}${where}.` : `${bName(s, q.id)} достигна ниво ${q.lvl}${where}.`, 'build');
}

// ---------- войска ----------
export function unitLock(s, c, u) {
  const d = UNITS[u];
  if (d.epoch > s.epoch) return `Отключва се в ${EPOCHS[d.epoch - 1].name}.`;
  if (!lv(c, 'barracks')) return 'Нужна е казарма.';
  if (d.tech && !s.techs[d.tech]) return `Нужна е технологията „${TECHS[d.tech].name}“.`;
  if (d.barracks && lv(c, 'barracks') < d.barracks) return `Нужна е казарма ниво ${d.barracks}.`;
  if (d.hall && lv(c, 'hall') < d.hall) return `Нужна е Цитадела ниво ${d.hall}.`;
  if (d.stable && lv(c, 'stable') < d.stable) return 'Нужна е Конюшня.';
  if (d.unique && !lv(c, 'unique')) return `Нужна е сградата „${UNIQUE[s.race].name}“.`;
  return null;
}

export function maxTrain(s, c, u) {
  if (unitLock(s, c, u)) return 0;
  const cost = uCost(s, u);
  let n = popCap(s, c) - popUsed(s, c);
  for (const [k, v] of Object.entries(cost)) n = Math.min(n, Math.floor(c.res[k] / v));
  const up = upkeepOf(s, u);
  if (up) n = Math.min(n, Math.floor(rates(s, c).food / s.speed / up));
  return Math.max(0, n);
}

export function train(s, t, cid, u, n, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  n = Math.floor(n);
  if (!own(UNITS, u) || !(n > 0)) fail('Изберете брой.');
  const lock = unitLock(s, c, u);
  if (lock) fail(lock);
  if (c.train.length >= 5) fail('Опашката за обучение е пълна.');
  if (popUsed(s, c) + n > popCap(s, c)) fail('Няма място – постройте още жилища.');
  if (upkeepOf(s, u) && rates(s, c).food / s.speed - n * upkeepOf(s, u) < 0) fail(`${resName(s.race, 'food')} няма да стигне за тях – подобрете фермата.`);
  pay(s, c, mul(uCost(s, u), n));
  const last = c.train[c.train.length - 1];
  c.train.push({ u, n, done: 0, start: last ? last.start + last.each * last.n : t, each: uTime(s, c, u) });
}

function finishUnit(s, c, b) {
  const t = b.start + b.each * (b.done + 1);
  b.done++;
  c.units[b.u] = (c.units[b.u] || 0) + 1;
  bump(s, t, 'trained');
  if (b.done >= b.n) {
    c.train.shift();
    log(s, t, `Обучени: ${b.n} × ${uName(s, b.u)}.`, 'train');
  }
}

// ---------- наука и епохи ----------
export function techState(s, id) {
  const d = TECHS[id];
  if (s.techs[id]) return { status: 'done' };
  if (s.research?.id === id) return { status: 'active' };
  if (d.epoch > s.epoch) return { status: 'locked', why: `${EPOCHS[d.epoch - 1].name}` };
  if (maxLv(s, 'academy') < d.academy) return { status: 'locked', why: `Академия ниво ${d.academy}` };
  const miss = (d.req || []).filter((r) => !s.techs[r]);
  if (miss.length) return { status: 'locked', why: 'Нужно: ' + miss.map((r) => TECHS[r].name).join(', ') };
  if (s.research) return { status: 'busy', why: 'Академията е заета.' };
  return { status: 'ok' };
}

export function research(s, t, cid, id, env) {
  advance(s, t, env);
  if (!own(TECHS, id)) fail('Няма такава технология.');
  const st = techState(s, id);
  if (st.status !== 'ok') fail(st.status === 'done' ? 'Вече е изследвано.' : st.status === 'active' ? 'Изследва се.' : st.why);
  pay(s, cityOf(s, cid), TECHS[id].cost);
  s.research = { id, start: t, end: t + tTime(s, id) };
}

function finishResearch(s) {
  const { id, end } = s.research;
  s.research = null;
  s.techs[id] = true;
  bump(s, end, 'researched');
  log(s, end, `Изследвано: ${TECHS[id].name}.`, 'tech');
}

export function epochReqs(s) {
  const next = s.epoch + 1;
  const spec = EPOCH_UP[next];
  if (!spec) return null;
  const story = STORY.find((m) => m.id === spec.story);
  return {
    next, spec,
    list: [
      { text: `Цитадела ниво ${spec.hall}`, ok: maxLv(s, 'hall') >= spec.hall },
      { text: `Изследване „${TECHS[spec.tech].name}“`, ok: !!s.techs[spec.tech] },
      { text: `Мисия „${story.title}“`, ok: story.get(s) >= story.goal },
    ],
  };
}

export function advanceEpoch(s, t, cid, env) {
  advance(s, t, env);
  if (s.epochUp) fail('Империята вече преминава в нова епоха.');
  if (s.epoch >= MAX_EPOCH) fail('Следващата епоха идва в нова версия на играта.');
  const r = epochReqs(s);
  if (r.list.some((x) => !x.ok)) fail('Не са изпълнени всички условия.');
  pay(s, cityOf(s, cid), r.spec.cost);
  s.epochUp = { to: r.next, start: t, end: t + scaled(s, r.spec.time) };
}

function finishEpoch(s) {
  const { to, end } = s.epochUp;
  s.epochUp = null;
  s.epoch = to;
  log(s, end, `Империята навлезе в ${EPOCHS[to - 1].name}!`, 'epoch');
}

// ---------- противници: лагери, оазиси, империи на компютъра ----------
export const campMax = (s) => (s.epoch >= 3 ? 18 : s.epoch >= 2 ? 12 : 5);
export const campName = (c) => (c.lvl === 5 ? 'Лагер на вожда' : CAMP_NAMES[c.id % CAMP_NAMES.length]);

const barb = (key, n, k = 1) => { const d = UNITS[key]; return { key, n, cls: d.cls, hp: d.hp, atk: d.atk * k, def: d.def * k, carry: d.carry }; };

// Лагерите до ниво 5 имат само пехота и прашкари – същото, което има и играчът.
export function campArmy(lvl) {
  const base = Math.round(4.2 * lvl ** 1.4);
  return [
    ['warrior', base],
    ['slinger', lvl >= 2 ? Math.round(base * 0.45) : 0],
    ['spear', lvl >= 6 ? Math.round(base * 0.35) : 0],
    ['archer', lvl >= 6 ? Math.round(base * 0.3) : 0],
    ['rider', lvl >= 7 ? Math.round(base * 0.2) : 0],
    ['elite', lvl === 5 ? 3 : lvl >= 8 ? Math.round(lvl * 0.5) : 0],
    ['crossbow', lvl >= 11 ? Math.round(base * 0.2) : 0],
    ['knight', lvl >= 12 ? Math.round(base * 0.12) : 0],
    ['pike', lvl >= 13 ? Math.round(base * 0.2) : 0],
  ].filter(([, n]) => n > 0).map(([k, n]) => barb(k, n));
}

export function campLoot(lvl) {
  const f = lvl ** 1.6;
  return { gold: Math.round(80 * f), wood: Math.round(140 * f), stone: Math.round(120 * f), food: Math.round(140 * f), souls: lvl >= 3 ? lvl : 0 };
}

// Оазис: пазят го зверове (същата сила като лагер от нивото му).
export function oasisInfo(s, x, y, env) {
  const tile = tileAt(s.world, x, y);
  if (tile.kind !== 'oasis') return null;
  const key = tileKey(x, y);
  const g = s.guards[key] || { alive: 1, respawn: 0 };
  const mine = s.oases.find((o) => o.key === key);
  const owner = mine ? s.uid : env?.world?.oasisOwner(key)?.uid || null;
  const army = owner ? [] : campArmy(tile.lvl).map((u) => ({ ...u, n: Math.round(u.n * g.alive) })).filter((u) => u.n > 0);
  return { key, x, y, res: tile.res, lvl: tile.lvl, guards: army, respawn: g.respawn, owner, ownerName: mine ? s.name : env?.world?.oasisOwner(key)?.name, mine: !!mine };
}

export function npcLevel(s, npc, t, env) {
  const created = env?.world?.created ?? s.created;
  const days = Math.max(0, (t - created) / (24 * HOUR)) * s.speed;
  return Math.min(30, Math.round((1 + npc.head + days * 0.45) * 10) / 10);
}

export function npcInfo(s, npc, t, env) {
  const L = npcLevel(s, npc, t, env);
  const st = env?.world?.npcState(npc.id) || { lost: 0, lostT: 0, plunder: 0, plunderT: 0 };
  const rec = (v, since) => Math.max(0, v - ((t - since) / HOUR) * 0.06 * s.speed);
  const lost = rec(st.lost, st.lostT), plunder = rec(st.plunder, st.plunderT);
  const n = Math.floor(L);
  const base = Math.round(6 * n ** 1.45);
  const k = 1 + L * 0.02;
  const army = [
    barb('warrior', base, k), barb('slinger', Math.round(base * 0.5), k),
    barb('spear', n >= 6 ? Math.round(base * 0.35) : 0, k), barb('archer', n >= 6 ? Math.round(base * 0.3) : 0, k),
    barb('rider', n >= 8 ? Math.round(base * 0.2) : 0, k), barb('elite', n >= 10 ? Math.round(n * 0.5) : 0, k),
    barb('pike', n >= 14 ? Math.round(base * 0.2) : 0, k), barb('crossbow', n >= 14 ? Math.round(base * 0.25) : 0, k),
    barb('knight', n >= 16 ? Math.round(base * 0.12) : 0, k),
  ].map((g) => ({ ...g, n: Math.round(g.n * (1 - lost)) })).filter((g) => g.n > 0);
  const f = (1 - plunder) * L ** 1.4;
  return {
    ...npc, lvl: L, army, wall: Math.floor(L / 2), scouts: Math.round(2 * L), lost, plunder,
    pile: { gold: Math.round(200 * f), wood: Math.round(300 * f), stone: Math.round(260 * f), food: Math.round(300 * f) },
    score: Math.round(60 * L ** 1.8),
    clanInfo: NPC_CLANS.find((c) => c.id === npc.clan),
  };
}

export const npcs = (s) => npcList(s.world);

// ---------- защита ----------
export const isProtected = (s, t = Date.now()) => t < s.protectedUntil;
// Часът (с минутите) и месецът по българско време – за деня и нощта в града.
export const localHour = (t) => (+sofia(t).hour % 24) + new Date(t).getMinutes() / 60;
export const localMonth = (t) => +sofia(t).month;
export const isNight = (t) => { const h = +sofia(t).hour % 24; return h >= NIGHT.from && h < NIGHT.to; };

export function score(s) {
  let b = 0;
  for (const c of s.cities) b += Object.values(c.b).reduce((a, L) => a + L * L, 0);
  const pop = s.cities.reduce((a, c) => a + popUsed(s, c), 0);
  return Math.round(b * 10 + Object.keys(s.techs).length * 50 + pop * 2 + (s.epoch - 1) * 500 + s.hero.lvl * 30);
}

// Морал: силен нападател срещу много по-слаб бие по-слабо.
export const morale = (attScore, defScore) => (attScore > defScore && defScore > 0 ? Math.max(0.5, (defScore / attScore) ** 0.35) : 1);

export function endProtection(s, t) {
  if (isProtected(s, t)) {
    s.protectedUntil = t;
    s.npcNext = t + scaled(s, 6 * 3600);
  }
}

export const pactCost = (s) => ({ gold: 400 * s.epoch + 150 * maxLv(s, 'hall') });
export function buyPact(s, t, cid, clanId, env) {
  advance(s, t, env);
  if (!NPC_CLANS.some((c) => c.id === clanId)) fail('Няма такъв клан.');
  pay(s, cityOf(s, cid), pactCost(s));
  s.pacts[clanId] = Math.max(s.pacts[clanId] || 0, t) + scaled(s, PACT.time);
}

// Защитниците на града: войската у дома, героят и подкрепленията от съюзници.
export function defenders(s, c, env) {
  const side = FIGHTERS.filter((u) => c.units[u] > 0).map((u) => ({ key: u, n: c.units[u], ...unitStats(s, u, c) }));
  if (heroHome(s, c)) side.push(heroGroup(s));
  const stationed = env?.world?.stationedAt(s.uid, c.id) || [];
  for (const st of stationed) for (const g of st.groups) if (g.n > 0) side.push({ ...g, stId: st.id });
  return { side, stationed };
}

/**
 * Битка в град на играча. att: { name, groups, lootBoost, crannyFactor, seed }.
 * Връща резултата за нападателя: { win, loot, trapped, att, def, rounds }.
 */
function defendCity(s, c, att, t, env) {
  let trapped = 0;
  const groups = att.groups.map((g) => ({ ...g }));
  let cap = trapCap(c);
  for (const g of [...groups].sort((a, b) => b.n - a.n)) {
    if (cap <= 0 || g.key === 'hero') continue;
    const k = Math.min(g.n, cap);
    g.n -= k;
    cap -= k;
    trapped += k;
  }
  const { side, stationed } = defenders(s, c, env);
  const wb = wallBonus(lv(c, 'wall'), s.techs.fortify);
  const night = isNight(t) ? NIGHT.bonus : 1;
  const heroDef = (heroHome(s, c) ? 1 + heroStats(s).def2 : 1) * (1 + 0.02 * lv(c, 'tower'));
  const attSide = groups.filter((g) => g.n > 0);
  const r = side.length
    ? fight(attSide, side, att.seed, { defMult: wb.def * night * heroDef, defHp: wb.hp })
    : { win: 'att', rounds: 0, att: attSide.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [] };
  const win = r.win === 'att' && r.att.some((g) => g.n > 0);
  // загуби на защитниците (r.def е в реда на side)
  r.def.forEach((g, i) => {
    const src = side[i];
    if (src.key === 'hero') heroWounds(s, t, g);
    else if (src.stId) src.n = g.n;
    else c.units[g.key] = g.n;
  });
  if (env?.world) for (const st of stationed) env.world.setStationed(st.id, st.groups.map((g) => ({ ...g, n: side.find((x) => x.stId === st.id && x.key === g.key)?.n ?? g.n })));
  const loot = {};
  if (win) {
    const room = r.att.reduce((a, g) => a + g.n * (groups.find((x) => x.key === g.key)?.carry || 0), 0) * (att.lootBoost || 1);
    const hide = crannyCap(c) * (att.crannyFactor ?? 1);
    const avail = Object.fromEntries(['gold', 'wood', 'stone', 'food'].map((k) => [k, Math.max(0, c.res[k] - hide)]));
    const total = sum(avail);
    const share = total ? Math.min(1, room / total) : 0;
    for (const [k, v] of Object.entries(avail)) {
      loot[k] = Math.floor(v * share);
      c.res[k] -= loot[k];
    }
  }
  if (!win) bump(s, t, 'defWins');
  report(s, {
    kind: 'defense', t, title: `${win ? 'Градът е ограбен' : 'Нападението е отбито'}: ${c.name}`, win: !win, enemy: att.name,
    att: r.att, def: r.def.map((g, i) => ({ ...g, ally: side[i]?.stId ? true : undefined })), loot, trapped, night: night > 1, wall: lv(c, 'wall'), rounds: r.rounds,
  });
  log(s, t, win ? `${att.name} ограби ${c.name}!` : `${c.name} отби нападението на ${att.name}.`, win ? 'loss' : 'win');
  return { win, loot, trapped, att: r.att, def: r.def, rounds: r.rounds };
}

// Компютърът изпраща нападение към град на играча.
function launchNpc(s, t, env) {
  const r = rng(hashStr(`${s.seed}:npc:${t}`));
  const next = () => { s.npcNext = t + scaled(s, NPC_ATTACK_EVERY[0] + r() * (NPC_ATTACK_EVERY[1] - NPC_ATTACK_EVERY[0])); };
  if (isProtected(s, t)) { s.npcNext = s.protectedUntil; return; }
  const c = s.cities[Math.floor(r() * s.cities.length)];
  const hostile = npcs(s).filter((n) => !(s.pacts[n.clan] > t)).map((n) => ({ n, d: dist(n, c) })).sort((a, b) => a.d - b.d).slice(0, 4);
  if (!hostile.length) return next();
  const { n: npc, d } = hostile[Math.floor(r() * hostile.length)];
  const info = npcInfo(s, npc, t, env);
  const { side } = defenders(s, c, env);
  const dp = power(side, wallBonus(lv(c, 'wall'), s.techs.fortify).def);
  const floorP = 25 * lv(c, 'hall') ** 1.5;
  const want = Math.max(floorP, dp * (0.55 + r() * 0.6));
  const full = power(info.army) || 1;
  const k = Math.min(0.85, want / full);
  const groups = info.army.map((g) => ({ ...g, n: Math.max(0, Math.round(g.n * k)) })).filter((g) => g.n > 0);
  if (!groups.length) groups.push(barb('warrior', 3 * lv(c, 'hall')));
  const travel = Math.max(scaled(s, 120), Math.round(((d / (7 * WORLD_SPEED)) * HOUR) / s.speed));
  s.incoming.push({ id: s.seq++, kind: 'npc', npcId: npc.id, name: npc.name, city: c.id, groups, launched: t, arrive: t + travel });
  next();
}

function npcArrives(s, inc, env) {
  s.incoming.splice(s.incoming.indexOf(inc), 1);
  const c = cityOf(s, inc.city);
  const res = defendCity(s, c, { name: inc.name, groups: inc.groups, seed: `${s.seed}:inc:${inc.id}` }, inc.arrive, env);
  if (env?.world) {
    const before = inc.groups.reduce((a, g) => a + g.n, 0);
    const after = res.att.reduce((a, g) => a + g.n, 0);
    if (before) env.world.hitNpc(inc.npcId, { lost: ((before - after) / before) * 0.3, plunder: 0, t: inc.arrive });
  }
}

// Нападение от друг играч (през общия свят).
function pvpArrives(s, inc, env) {
  const c = cityOf(s, inc.toCity);
  const res = defendCity(s, c, { name: inc.attName, groups: inc.groups, lootBoost: inc.lootBoost, crannyFactor: inc.crannyFactor, seed: `pvp:${inc.id}` }, inc.arrive, env);
  env.world.putResult(inc.id, { ...res, defName: s.name, city: c.name, wall: lv(c, 'wall') });
  env.world.removeIncoming(s.uid, inc.id);
}

// ---------- походи ----------
export function marchSpeed(s, units, withHero) {
  let sp = Infinity;
  for (const [u, n] of Object.entries(units)) if (n > 0) sp = Math.min(sp, UNITS[u].speed);
  if (withHero) sp = Math.min(sp, heroStats(s).speed);
  return (sp === Infinity ? HERO.speed : sp) * WORLD_SPEED;
}

export const travelTime = (s, from, to, units, withHero) => Math.max(scaled(s, 30), Math.round(((dist(from, to) / marchSpeed(s, units, withHero)) * HOUR) / s.speed));

export function foundable(s, x, y, env) {
  if (tileAt(s.world, x, y).kind !== 'grass') return false;
  if (s.cities.some((c) => c.x === x && c.y === y)) return false;
  if (npcs(s).some((n) => n.x === x && n.y === y)) return false;
  if (s.camps.some((c) => c.x === x && c.y === y)) return false;
  if (env?.world?.cityAt(x, y)) return false;
  return true;
}

/**
 * Изпраща войска. kind: raid | attack | scout | support | found | adventure.
 * target: { type: camp|oasis|npc|player|city|ally|tile|adventure, id, x, y, uid, cityId, name, diff }.
 */
export function send(s, t, cid, kind, target, units, withHero, env, tactical = false) {
  advance(s, t, env);
  if (!['raid', 'attack', 'scout', 'support', 'found', 'adventure'].includes(kind)) fail('Непознат поход.');
  target = normalizeTarget(s, target || {}, env);
  const c = cityOf(s, cid);
  withHero = !!withHero;
  const sent = {};
  if (units && typeof units !== 'object') fail('Невалидни данни.');
  for (const [u, n] of Object.entries(units || {})) {
    const k = Math.floor(Number(n));
    if (!own(UNITS, u) || !(k > 0)) continue;
    if ((c.units[u] || 0) < k) fail('Нямате толкова войска в този град.');
    sent[u] = k;
  }
  if (withHero) {
    if (!heroHome(s, c)) fail('Героят не е в този град.');
    if (s.hero.health < 10 && kind !== 'support') fail('Героят е твърде ранен.');
  }
  const fighters = Object.keys(sent).filter((u) => FIGHTERS.includes(u));
  const has = (u) => sent[u] > 0;
  if (kind === 'adventure') {
    if (!withHero || Object.keys(sent).length) fail('На приключение тръгва само героят.');
    if (!s.adventures.some((a) => a.id === target.id)) fail('Приключението вече го няма.');
  } else if (kind === 'scout') {
    if (!has('scout') || Object.keys(sent).length > 1 || withHero) fail('Изпратете само съгледвачи.');
  } else if (kind === 'found') {
    if (!has('settler')) fail('Нужни са заселници.');
    if (s.cities.length >= allowedCities(s)) fail(`За нов град е нужна Цитадела ниво ${5 * s.cities.length}.`);
    if (!foundable(s, target.x, target.y, env)) fail('Тук не може да се основе град.');
  } else if (kind === 'support') {
    if (!fighters.length && !withHero) fail('Изберете войска.');
    if (has('settler')) fail('Заселниците не могат да подкрепят.');
  } else {
    if (!fighters.length && !withHero) fail('Изберете войска.');
    if (has('settler') || has('scout')) fail('Съгледвачите и заселниците не се бият.');
  }
  if (kind === 'raid') {
    const camp = s.camps.find((x) => x.id === target.id);
    if (!camp) fail('Няма такъв лагер.');
    if (camp.respawn) fail('Лагерът е разбит – варварите още се събират.');
    if (s.marches.some((m) => m.kind === 'raid' && m.target.id === camp.id && m.phase === 'go')) fail('Към този лагер вече има поход.');
  }
  if (kind === 'attack' && target.type === 'oasis') {
    const o = oasisInfo(s, target.x, target.y, env);
    if (!o) fail('Тук няма оазис.');
    if (o.owner) fail(o.mine ? 'Оазисът вече е ваш.' : 'Оазисът е владян от друг играч.');
  }
  if (kind === 'attack' && target.type === 'player') {
    if (!env?.world) fail('Няма връзка със света.');
    const rel = env.world.relation(s.uid, target.uid);
    if (rel === 'alliance' || rel === 'ally' || rel === 'pact') fail('Не можете да нападате съюзници.');
    const p = env.world.player(target.uid);
    if (!p) fail('Няма такъв играч.');
    if (p.protectedUntil > t) fail('Играчът е под защита за новаци.');
  }
  if (kind === 'attack' && target.type === 'npc') {
    const npc = npcs(s).find((n) => n.id === target.id);
    if (!npc) fail('Няма такъв владетел.');
    if (s.pacts[npc.clan] > t) fail('Имате пакт с този клан.');
  }
  if (kind === 'support' && target.type === 'ally' && env?.world?.relation(s.uid, target.uid) !== 'alliance') fail('Подкрепления се пращат само на членове на съюза.');
  if (kind === 'attack' && (target.type === 'npc' || target.type === 'player')) endProtection(s, t);
  for (const [u, n] of Object.entries(sent)) c.units[u] -= n;
  if (withHero) s.hero.state = 'away';
  const travel = travelTime(s, c, target, sent, withHero);
  const m = { id: s.seq++, kind, from: c.id, target, units: sent, hero: !!withHero, phase: 'go', depart: t, arrive: t + travel, travel, tactical: !!tactical && (kind === 'raid' || (kind === 'attack' && target.type !== 'player')) };
  s.marches.push(m);
  if (kind === 'adventure') s.adventures = s.adventures.filter((a) => a.id !== target.id);
  if (kind === 'attack' && target.type === 'player') {
    const mo = morale(score(s), env.world.player(target.uid)?.score || 0);
    const off = withHero ? heroStats(s).off : 0;
    const groups = Object.entries(sent).map(([u, n]) => { const st = unitStats(s, u, c); return { key: u, n, ...st, atk: st.atk * mo * (1 + off) }; });
    if (withHero) groups.push(heroGroup(s));
    m.pvpId = `${s.uid}:${m.id}`;
    m.morale = mo;
    env.world.sendIncoming({
      id: m.pvpId, toUid: target.uid, toCity: target.cityId, attUid: s.uid, attName: s.name, attRace: s.race,
      groups, lootBoost: s.race === 'orcs' ? 1.25 : 1, crannyFactor: s.race === 'orcs' ? 0.8 : 1, arrive: m.arrive, launched: t,
    });
  }
  return m;
}

// Целта се взима от данните на играта (не се вярва на координатите от клиента).
function normalizeTarget(s, T, env) {
  const xy = (o) => ({ x: o.x, y: o.y });
  switch (T.type) {
    case 'camp': { const c = s.camps.find((x) => x.id === T.id); if (!c) fail('Няма такъв лагер.'); return { type: 'camp', id: c.id, ...xy(c), name: campName(c) }; }
    case 'npc': { const n = npcs(s).find((x) => x.id === T.id); if (!n) fail('Няма такъв владетел.'); return { type: 'npc', id: n.id, ...xy(n), name: n.name }; }
    case 'player':
    case 'ally': {
      const p = env?.world?.player(T.uid);
      const pc = p?.cities.find((c) => c.id === T.cityId);
      if (!pc) fail('Няма такъв град.');
      return { type: T.type, uid: p.uid, cityId: pc.id, ...xy(pc), name: T.type === 'ally' ? p.name : `${p.name} – ${pc.name}` };
    }
    case 'city': { const c = s.cities.find((x) => x.id === T.id); if (!c) fail('Няма такъв град.'); return { type: 'city', id: c.id, ...xy(c), name: c.name }; }
    case 'oasis': { const x = Math.round(+T.x), y = Math.round(+T.y); if (tileAt(s.world, x, y).kind !== 'oasis') fail('Тук няма оазис.'); return { type: 'oasis', x, y, name: `оазис (${x}|${y})` }; }
    case 'adventure': { const a = s.adventures.find((x) => x.id === T.id); if (!a) fail('Приключението вече го няма.'); return { type: 'adventure', id: a.id, ...xy(a), diff: a.diff, name: 'приключение' }; }
    case 'tile': { const x = Math.round(+T.x), y = Math.round(+T.y); if (!inWorld(x, y)) fail('Извън света.'); return { type: 'tile', x, y, name: String(T.name || '').trim().slice(0, 24) || undefined }; }
    default: fail('Непозната цел.');
  }
}

// Войската с бонусите си (вкл. героя и морала) за поход.
function attackSide(s, m, mo = 1) {
  const c = cityOf(s, m.from);
  const off = m.hero ? heroStats(s).off : 0;
  const side = FIGHTERS.filter((u) => m.units[u] > 0).map((u) => { const st = unitStats(s, u, c); return { key: u, n: m.units[u], ...st, atk: st.atk * mo * (1 + off) }; });
  if (m.hero && s.hero.state !== 'dead') side.push(heroGroup(s));
  return side;
}

function takeLoot(s, pile, survivors) {
  const room = Object.entries(survivors).reduce((a, [u, n]) => a + n * (UNITS[u]?.carry || 0), 0);
  const boost = s.race === 'orcs' ? 1.25 : 1;
  const total = sum(pile) * boost;
  const share = total ? Math.min(1, room / total) : 0;
  return Object.fromEntries(Object.entries(pile).map(([k, v]) => [k, Math.floor(v * boost * share)]));
}

const battleXp = (r) => r.def.reduce((a, g) => a + g.lost * ((UNITS[g.key]?.hp || 10) / 4), 0);

function arrive(s, m, env) {
  const t = m.arrive;
  const T = m.target;
  const survivorsOf = (r) => Object.fromEntries(r.att.filter((g) => g.n > 0 && g.key !== 'hero').map((g) => [g.key, g.n]));
  const finishBattle = (r) => {
    if (m.hero) {
      heroWounds(s, t, r.att.find((g) => g.key === 'hero'));
      if (s.hero.state !== 'dead') heroXp(s, t, battleXp(r));
    }
  };
  const goHome = (units, loot = {}) => {
    const heroBack = m.hero && s.hero.state !== 'dead';
    if (!Object.keys(units).length && !heroBack) { s.marches.splice(s.marches.indexOf(m), 1); return; }
    Object.assign(m, { phase: 'back', units, loot, hero: heroBack, back: t + m.travel });
  };

  if (m.kind === 'adventure') return adventureArrives(s, m, goHome);

  if (m.kind === 'raid' || (m.kind === 'attack' && (T.type === 'oasis' || T.type === 'npc'))) {
    const setup = battleSetup(s, m, env);
    if (!setup) {
      report(s, { kind: 'attack', t, title: 'Оазисът вече е зает', win: false, att: [], def: [] });
      return goHome(m.units);
    }
    if (m.tactical && setup.def.length) {
      m.phase = 'battle';
      m.battle = { seed: `${s.seed}:${m.id}`, ...setup, expires: t + scaled(s, TACTIC.window) };
      log(s, t, `Войската пристигна при ${T.name || 'целта'} – поведете битката!`, 'alarm');
      return;
    }
    const r = setup.def.length ? fight(setup.att, setup.def, `${s.seed}:${m.id}`, setup.opts) : emptyWin(setup.att);
    return conclude(s, m, env, setup, r, t);
  }

  if (m.kind === 'attack' && T.type === 'player') return tryPvpResult(s, m, env, true);

  if (m.kind === 'scout') return scoutArrives(s, m, env, goHome);

  if (m.kind === 'support') {
    if (T.type === 'city') {
      const to = cityOf(s, T.id);
      for (const [u, n] of Object.entries(m.units)) to.units[u] = (to.units[u] || 0) + n;
      if (m.hero) { s.hero.city = to.id; s.hero.state = 'home'; }
      log(s, t, `Подкрепленията пристигнаха в ${to.name}.`, 'march');
      s.marches.splice(s.marches.indexOf(m), 1);
      return;
    }
    const from = cityOf(s, m.from);
    const groups = Object.entries(m.units).map(([u, n]) => ({ key: u, n, ...unitStats(s, u, from) }));
    const id = `${s.uid}:${m.id}`;
    env?.world?.addStationed({ id, fromUid: s.uid, fromName: s.name, fromRace: s.race, fromCity: m.from, toUid: T.uid, toCity: T.cityId, toName: T.name, groups, since: t });
    s.abroad.push({ id, from: m.from, toUid: T.uid, toCity: T.cityId, toName: T.name, x: T.x, y: T.y, units: m.units });
    log(s, t, `Подкрепленията пристигнаха при ${T.name}.`, 'march');
    s.marches.splice(s.marches.indexOf(m), 1);
    return;
  }

  if (m.kind === 'found') {
    if (!foundable(s, T.x, T.y, env) || s.cities.length >= allowedCities(s)) {
      log(s, t, 'Мястото за новия град е заето – заселниците се връщат.', 'loss');
      return goHome(m.units);
    }
    const id = `c${s.seq++}`;
    const name = T.name || `Град ${s.cities.length + 1}`;
    const city = newCity(id, name, T.x, T.y, { gold: 400, wood: 600, stone: 500, food: 600 });
    const rest = { ...m.units };
    rest.settler--;
    if (!rest.settler) delete rest.settler;
    city.units = rest;
    s.cities.push(city);
    if (m.hero) { s.hero.city = id; s.hero.state = 'home'; }
    report(s, { kind: 'found', t, title: `Основан град: ${name} (${T.x}|${T.y})`, win: true });
    log(s, t, `Основахте нов град: ${name}!`, 'epoch');
    s.marches.splice(s.marches.indexOf(m), 1);
  }
}

const emptyWin = (att) => ({ win: 'att', rounds: 0, att: att.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [] });

function sendHome(s, m, t, units, loot = {}) {
  const heroBack = m.hero && s.hero.state !== 'dead';
  const i = s.marches.indexOf(m);
  if (!Object.keys(units).length && !heroBack) { if (i >= 0) s.marches.splice(i, 1); return; }
  Object.assign(m, { phase: 'back', units, loot, hero: heroBack, back: t + m.travel, battle: undefined });
}

// Страните в битката при пристигане (и всичко, нужно след нея).
function battleSetup(s, m, env) {
  const t = m.arrive, T = m.target;
  if (m.kind === 'raid') {
    const camp = s.camps.find((x) => x.id === T.id);
    return { type: 'camp', att: attackSide(s, m), def: campArmy(camp.lvl), opts: {}, ctx: { id: camp.id, lvl: camp.lvl, name: campName(camp) } };
  }
  if (T.type === 'oasis') {
    const o = oasisInfo(s, T.x, T.y, env);
    if (!o || o.owner) return null;
    return { type: 'oasis', att: attackSide(s, m), def: o.guards, opts: {}, ctx: { key: o.key, x: o.x, y: o.y, res: o.res, lvl: o.lvl, guarded: o.guards.length > 0 } };
  }
  const npc = npcs(s).find((n) => n.id === T.id);
  const info = npcInfo(s, npc, t, env);
  const mo = morale(score(s), info.score);
  const wb = wallBonus(info.wall);
  const night = isNight(t) ? NIGHT.bonus : 1;
  return { type: 'npc', att: attackSide(s, m, mo), def: info.army, opts: { defMult: wb.def * night, defHp: wb.hp }, ctx: { id: npc.id, name: npc.name, pile: info.pile, lost: info.lost, wall: info.wall, morale: mo, night: night > 1 } };
}

// Последствията от битка (набег, оазис, владетел на компютъра).
function conclude(s, m, env, setup, r, t) {
  const ctx = setup.ctx;
  if (m.hero) {
    heroWounds(s, t, r.att.find((g) => g.key === 'hero'));
    if (s.hero.state !== 'dead') heroXp(s, t, battleXp(r));
  }
  const win = r.win === 'att';
  const surv = Object.fromEntries(r.att.filter((g) => g.n > 0 && g.key !== 'hero').map((g) => [g.key, g.n]));
  if (r.tactical && win) bump(s, t, 'tactics');
  const tag = r.tactical ? ' (тактическа битка)' : '';
  if (setup.type === 'camp') {
    const camp = s.camps.find((x) => x.id === ctx.id);
    let raised = 0, loot = {};
    if (win && s.race === 'undead') {
      raised = Math.floor(r.def.reduce((a, g) => a + g.lost, 0) * 0.1);
      if (raised) surv.warrior = (surv.warrior || 0) + raised;
    }
    if (win) {
      const pile = campLoot(ctx.lvl);
      const souls = pile.souls;
      delete pile.souls;
      loot = takeLoot(s, pile, surv);
      if (souls) loot.souls = souls;
      s.stats.bestCamp = Math.max(s.stats.bestCamp, ctx.lvl);
      bump(s, t, 'raids');
      if (camp) camp.respawn = t + scaled(s, CAMP_RESPAWN);
    }
    report(s, { kind: 'raid', t, title: `${win ? 'Победа' : 'Поражение'}: ${ctx.name} (ниво ${ctx.lvl})${tag}`, win, att: r.att, def: r.def, loot, raised, rounds: r.rounds });
    log(s, t, win ? `Победа над ${ctx.name} (ниво ${ctx.lvl})!` : `Поражение при ${ctx.name} (ниво ${ctx.lvl}).`, win ? 'win' : 'loss');
    return sendHome(s, m, t, surv, loot);
  }
  if (setup.type === 'oasis') {
    const g = (s.guards[ctx.key] ||= { alive: 1, respawn: 0 });
    let loot = {}, annexed = false, note = '';
    if (win) {
      if (ctx.guarded) {
        g.alive = 0;
        g.respawn = t + scaled(s, OASIS_RESPAWN);
        const pile = campLoot(ctx.lvl);
        delete pile.souls;
        for (const k of Object.keys(pile)) pile[k] = Math.round(pile[k] * (k === ctx.res ? 1 : 0.4));
        loot = takeLoot(s, pile, surv);
        bump(s, t, 'raids');
      }
      const from = cityOf(s, m.from);
      const heroOk = m.hero && s.hero.state !== 'dead';
      if (!heroOk) note = 'За да завладеете оазиса, изпратете и героя.';
      else if (s.oases.length >= oasisSlots(s)) note = 'Нямате свободно място за оазис – подобрете Залата на героите (ниво 3, 6, 10).';
      else if (dist(from, ctx) > OASIS_RANGE + 0.01) note = `Оазисът е на повече от ${OASIS_RANGE} полета от ${from.name}.`;
      else if (env?.world?.oasisOwner(ctx.key)) note = 'Друг владетел го завладя преди вас.';
      else {
        s.oases.push({ key: ctx.key, x: ctx.x, y: ctx.y, res: ctx.res, city: from.id });
        env?.world?.setOasisOwner(ctx.key, s.uid, s.name);
        annexed = true;
        log(s, t, `Оазисът (${ctx.x}|${ctx.y}) е ваш: +25% ${resName(s.race, ctx.res).toLowerCase()} за ${from.name}.`, 'win');
      }
    } else {
      const before = setup.def.reduce((a, x) => a + x.n, 0);
      const after = r.def.reduce((a, x) => a + x.n, 0);
      g.alive = before ? (g.alive * after) / before : g.alive;
    }
    report(s, { kind: 'attack', t, title: `${win ? 'Победа' : 'Поражение'}: оазис (${ctx.x}|${ctx.y})${tag}`, win, att: r.att, def: r.def, loot, annexed, rounds: r.rounds, note });
    return sendHome(s, m, t, surv, loot);
  }
  const loot = win ? takeLoot(s, ctx.pile, surv) : {};
  const before = setup.def.reduce((a, g) => a + g.n, 0) || 1;
  const killed = r.def.reduce((a, g) => a + g.lost, 0);
  env?.world?.hitNpc(ctx.id, { lost: (killed / before) * (1 - ctx.lost), plunder: win ? sum(loot) / (sum(ctx.pile) || 1) : 0, t });
  if (win) bump(s, t, 'raids');
  report(s, { kind: 'attack', t, title: `${win ? 'Победа' : 'Поражение'}: ${ctx.name}${tag}`, win, att: r.att, def: r.def, loot, morale: ctx.morale, night: ctx.night, wall: ctx.wall, rounds: r.rounds });
  log(s, t, win ? `Ограбихте ${ctx.name}!` : `Атаката срещу ${ctx.name} се провали.`, win ? 'win' : 'loss');
  return sendHome(s, m, t, surv, loot);
}

// Играчът изигра тактическата битка: сървърът повтаря ходовете му.
export function fightTactical(s, t, marchId, moves, env) {
  advance(s, t, env);
  const m = s.marches.find((x) => x.id === marchId && x.phase === 'battle');
  if (!m) fail('Битката вече е решена.');
  if (moves != null && !Array.isArray(moves)) fail('Невалидни ходове.');
  conclude(s, m, env, m.battle, replay(m.battle, moves || []), t);
}

function tryPvpResult(s, m, env, atArrival = false) {
  const w = env?.world;
  let res = w?.result(m.pvpId);
  if (!res && w?.resolveOffline) { w.resolveOffline(m.target.uid, m.pvpId, m.arrive); res = w.result(m.pvpId); }
  if (!res) { if (atArrival) m.phase = 'wait'; return; }
  w.clearResult(m.pvpId);
  const t = m.arrive;
  const win = res.win;
  if (m.hero) {
    heroWounds(s, t, res.att.find((g) => g.key === 'hero'));
    if (s.hero.state !== 'dead') heroXp(s, t, battleXp(res));
  }
  const surv = Object.fromEntries(res.att.filter((g) => g.n > 0 && g.key !== 'hero').map((g) => [g.key, g.n]));
  if (win) bump(s, t, 'raids');
  report(s, { kind: 'attack', t, title: `${win ? 'Победа' : 'Поражение'}: ${res.defName} – ${res.city}`, win, att: res.att, def: res.def, loot: res.loot, trapped: res.trapped, wall: res.wall, rounds: res.rounds, morale: m.morale });
  log(s, t, win ? `Ограбихте ${res.defName}!` : `Атаката срещу ${res.defName} се провали.`, win ? 'win' : 'loss');
  const heroBack = m.hero && s.hero.state !== 'dead';
  if (!Object.keys(surv).length && !heroBack) { s.marches.splice(s.marches.indexOf(m), 1); return; }
  Object.assign(m, { phase: 'back', units: surv, loot: res.loot, hero: heroBack, back: t + m.travel });
}

export const intelKey = (T) => `${T.type}:${T.type === 'player' ? `${T.uid}:${T.cityId}` : T.id ?? `${T.x}|${T.y}`}`;

function scoutArrives(s, m, env, goHome) {
  const t = m.arrive;
  const T = m.target;
  const A = m.units.scout;
  let D = 0, data = null, title = '';
  if (T.type === 'npc') {
    const info = npcInfo(s, npcs(s).find((n) => n.id === T.id), t, env);
    D = info.scouts;
    data = { army: info.army.map((g) => ({ key: g.key, n: g.n })), wall: info.wall, pile: info.pile, lvl: info.lvl };
    title = info.name;
  } else if (T.type === 'player') {
    const p = env?.world?.player(T.uid);
    const pc = p?.cities.find((c) => c.id === T.cityId);
    D = pc?.scouts || 0;
    data = pc ? { army: Object.entries(pc.units || {}).map(([key, n]) => ({ key, n })), wall: pc.wall, traps: pc.traps, cranny: pc.cranny, res: pc.res, race: p.race } : null;
    title = `${p?.name || 'Играч'} – ${pc?.name || ''}`;
  } else if (T.type === 'oasis') {
    const o = oasisInfo(s, T.x, T.y, env);
    data = { army: (o?.guards || []).map((g) => ({ key: g.key, n: g.n })), res: o?.res };
    title = `Оазис (${T.x}|${T.y})`;
  } else if (T.type === 'camp') {
    const camp = s.camps.find((x) => x.id === T.id);
    data = { army: campArmy(camp.lvl).map((g) => ({ key: g.key, n: g.n })) };
    title = campName(camp);
  }
  const ok = s.race === 'vesheri' || A >= D * 0.8;
  const lost = ok ? Math.min(A, Math.floor(A * Math.min(0.5, D / (A * 2 || 1)))) : A;
  if (ok) {
    s.intel[intelKey(T)] = { t, data, title };
    bump(s, t, 'scouted');
  }
  report(s, { kind: 'scout', t, title: `${ok ? 'Разузнаване' : 'Съгледвачите бяха разкрити'}: ${title}`, win: ok, intel: ok ? data : null, scoutsLost: lost });
  log(s, t, ok ? `Съгледвачите разузнаха ${title}.` : `Съгледвачите при ${title} бяха избити.`, ok ? 'info' : 'loss');
  const left = A - lost;
  goHome(left > 0 ? { scout: left } : {});
}

function comeBack(s, m) {
  s.marches.splice(s.marches.indexOf(m), 1);
  const c = cityOf(s, m.from);
  for (const [u, n] of Object.entries(m.units)) c.units[u] = (c.units[u] || 0) + n;
  if (m.hero && s.hero.state !== 'dead') { s.hero.state = 'home'; s.hero.city = c.id; }
  addRes(c, m.loot || {}, true);
  log(s, m.back, m.kind === 'adventure' ? `${s.hero.name} се върна от приключение.` : `Войската се върна в ${c.name}.`, 'march');
}

// Изтегляне на подкрепления от съюзник.
export function recall(s, t, abroadId, env) {
  advance(s, t, env);
  const i = s.abroad.findIndex((a) => a.id === abroadId);
  if (i < 0) fail('Няма такива подкрепления.');
  const [a] = s.abroad.splice(i, 1);
  const st = env?.world?.removeStationed(a.id);
  const units = st ? Object.fromEntries(st.groups.filter((g) => g.n > 0).map((g) => [g.key, g.n])) : a.units;
  if (!Object.keys(units).length) return;
  const from = cityOf(s, a.from);
  const travel = travelTime(s, { x: a.x, y: a.y }, from, units, false);
  s.marches.push({ id: s.seq++, kind: 'support', from: a.from, target: { type: 'ally', name: a.toName, x: a.x, y: a.y }, units, hero: false, phase: 'back', depart: t, arrive: t, back: t + travel, travel, loot: {} });
}

// Подкрепленията на съюзник се връщат сами, ако той ги отпрати (или напусне съюза).
export function syncAbroad(s, t, env) {
  if (!env?.world) return;
  for (const a of [...s.abroad]) {
    const st = env.world.stationedById(a.id);
    if (!st) {
      s.abroad.splice(s.abroad.indexOf(a), 1);
      continue;
    }
    a.units = Object.fromEntries(st.groups.filter((g) => g.n > 0).map((g) => [g.key, g.n]));
    if (st.sendBack) recall(s, t, a.id, env);
  }
}

// ---------- приключения ----------
function spawnAdventure(s) {
  const t = s.advNext;
  s.advNext = t + scaled(s, ADVENTURE.every);
  if (s.adventures.length >= ADVENTURE.max) return;
  const r = rng(hashStr(`${s.seed}:adv:${t}`));
  const c = s.cities[Math.floor(r() * s.cities.length)];
  for (let k = 0; k < 12; k++) {
    const ang = r() * Math.PI * 2, rad = 2 + r() * 5;
    const x = Math.round(c.x + Math.cos(ang) * rad), y = Math.round(c.y + Math.sin(ang) * rad);
    const tile = tileAt(s.world, x, y);
    if (tile.kind === 'void' || tile.kind === 'lake' || tile.kind === 'oasis') continue;
    if (s.adventures.some((a) => a.x === x && a.y === y) || s.cities.some((cc) => cc.x === x && cc.y === y)) continue;
    s.adventures.push({ id: s.seq++, x, y, diff: r() < 0.3 ? 'hard' : 'normal', expires: t + scaled(s, ADVENTURE.life) });
    return;
  }
}

function adventureArrives(s, m, goHome) {
  const t = m.arrive;
  const hard = m.target.diff === 'hard';
  const r = rng(hashStr(`${s.seed}:advres:${m.id}`));
  const h = s.hero;
  const red = Math.min(0.6, heroStats(s).armorRed + h.lvl * 0.015);
  const dmg = (hard ? 18 + r() * 24 : 8 + r() * 14) * (1 - red);
  let text;
  const reward = {};
  let item = null, units = 0;
  bump(s, t, 'adventures');
  if (h.health - dmg <= 0 && hard) {
    h.health = 0;
    h.state = 'dead';
    text = `${h.name} загина в опасно приключение.`;
  } else {
    h.health = Math.max(1, h.health - dmg);
    heroXp(s, t, (hard ? 2.2 : 1) * (15 + r() * 15) * (1 + h.lvl * 0.15));
    const roll = r();
    if (roll < (hard ? 0.4 : 0.22)) {
      const tr = r();
      const tier = hard ? (tr < 0.35 ? 1 : tr < 0.75 ? 2 : tr < 0.95 ? 3 : 4) : (tr < 0.7 ? 1 : tr < 0.95 ? 2 : 3);
      const slots = Object.keys(ITEM_FX);
      item = { id: s.seq++, slot: slots[Math.floor(r() * slots.length)], tier };
      h.items.push(item);
      text = `${h.name} намери предмет: ${itemOf(item).name}.`;
    } else if (roll < 0.55) {
      const amount = Math.round(250 * (1 + h.lvl * 0.4) * (hard ? 2 : 1));
      const ks = ['gold', 'wood', 'stone', 'food'];
      const a = ks[Math.floor(r() * 4)], b = ks[Math.floor(r() * 4)];
      reward[a] = (reward[a] || 0) + amount;
      reward[b] = (reward[b] || 0) + Math.round(amount / 2);
      text = `${h.name} намери скрити запаси.`;
    } else if (roll < 0.72) {
      reward.souls = 2 + Math.floor(r() * (hard ? 8 : 4));
      text = `${h.name} събра души от древно бойно поле.`;
    } else if (roll < 0.85) {
      units = 3 + Math.floor(r() * (hard ? 10 : 5));
      text = `Към героя се присъединиха ${units} бойци.`;
    } else {
      reward.gold = Math.round(150 * (1 + h.lvl * 0.3));
      text = `${h.name} помогна на пътници и получи злато.`;
    }
  }
  report(s, { kind: 'adventure', t, title: `Приключение (${hard ? 'опасно' : 'обикновено'})`, win: h.state !== 'dead', text, loot: reward, item: item ? itemOf(item) : null, dmg: Math.round(dmg) });
  log(s, t, text, h.state === 'dead' ? 'loss' : 'win');
  goHome(units ? { warrior: units } : {}, reward);
}

// Снимка на империята за общия свят (карта, класации, разузнаване от други играчи).
export function snapshot(s, alliance = null) {
  return {
    uid: s.uid, name: s.name, race: s.race, epoch: s.epoch, score: score(s), protectedUntil: s.protectedUntil, alliance, t: s.t,
    cities: s.cities.map((c) => ({
      id: c.id, name: c.name, x: c.x, y: c.y, hall: lv(c, 'hall'), wall: lv(c, 'wall'), traps: lv(c, 'traps'), cranny: lv(c, 'cranny'),
      units: Object.fromEntries(FIGHTERS.filter((u) => c.units[u] > 0).map((u) => [u, c.units[u]])), scouts: c.units.scout || 0,
      res: Object.fromEntries(['gold', 'wood', 'stone', 'food'].map((k) => [k, Math.floor(c.res[k])])),
    })),
  };
}

// ---------- всички действия на играча (през тях минава и сървърът) ----------
const cleanName = (v, max) => { const n = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max); if (!n) fail('Въведете име.'); return n; };
const ACTIONS = {
  build: (s, t, env, cid, id) => build(s, t, cid, id, env),
  cancelBuild: (s, t, env, cid, id) => cancelBuild(s, t, cid, id, env),
  train: (s, t, env, cid, u, n) => train(s, t, cid, u, n, env),
  research: (s, t, env, cid, id) => research(s, t, cid, id, env),
  advanceEpoch: (s, t, env, cid) => advanceEpoch(s, t, cid, env),
  claimStory: (s, t, env, cid, id) => claimStory(s, t, cid, id, env),
  claimDaily: (s, t, env, cid, id) => claimDaily(s, t, cid, id, env),
  send: (s, t, env, cid, kind, target, units, withHero, tactical) => { send(s, t, cid, kind, target, units, withHero, env, tactical); },
  recall: (s, t, env, id) => recall(s, t, id, env),
  revive: (s, t, env, cid) => reviveHero(s, t, cid, env),
  pact: (s, t, env, cid, clan) => buyPact(s, t, cid, clan, env),
  sellItem: (s, t, env, cid, id) => sellItem(s, t, cid, id),
  assignPoint: (s, t, env, key) => assignPoint(s, key),
  equip: (s, t, env, id) => equip(s, id),
  unequip: (s, t, env, slot) => unequip(s, slot),
  endProtection: (s, t) => endProtection(s, t),
  renameCity: (s, t, env, cid, name) => { const c = s.cities.find((x) => x.id === cid); if (!c) fail('Няма такъв град.'); c.name = cleanName(name, 24); },
  renameHero: (s, t, env, name) => { s.hero.name = cleanName(name, 20); },
  tactical: (s, t, env, marchId, moves) => fightTactical(s, t, marchId, moves, env),
};

export function perform(s, t, env, name, args = []) {
  if (!own(ACTIONS, name)) fail('Непознато действие.');
  if (!Array.isArray(args) || args.length > 8) fail('Невалидни данни.');
  advance(s, t, env);
  ACTIONS[name](s, t, env, ...args);
  return s;
}
