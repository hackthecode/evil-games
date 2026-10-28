// Evil Empires – the world: deterministic generation from the world seed (terrain, oases,
// computer empires, spots for player cities). Pure functions only.
import { WORLD_R, OASIS_RES, NPC_NAMES, NPC_CLANS, CAMP_SLOTS } from './data.js';
import { hashStr } from './battle.js';

const RACES = ['humans', 'undead', 'orcs', 'vesheri'];

export const hash2 = (seed, x, y, k = 0) => {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(x + 1000, 374761393) ^ Math.imul(y + 1000, 668265263) ^ Math.imul(k + 7, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const inWorld = (x, y) => Math.abs(x) <= WORLD_R && Math.abs(y) <= WORLD_R;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const tileKey = (x, y) => `${x}|${y}`;

// Terrain: grass (buildable), forest, hills, lake, oasis.
export function tileAt(seed, x, y) {
  if (!inWorld(x, y)) return { kind: 'void' };
  const v = hash2(seed, x, y);
  // "patches" – neighbouring tiles are similar
  const near = (hash2(seed, x >> 2, y >> 2, 1) + hash2(seed, (x + 2) >> 2, (y + 1) >> 2, 1)) / 2;
  if (Math.abs(x) + Math.abs(y) > 2) {
    if (v < 0.055) {
      const res = OASIS_RES[Math.floor(hash2(seed, x, y, 2) * OASIS_RES.length)];
      const lvl = 1 + Math.floor(hash2(seed, x, y, 3) * 4 + Math.hypot(x, y) / 6);
      return { kind: 'oasis', res, lvl };
    }
    if (v < 0.09 && near < 0.45) return { kind: 'lake' };
  }
  if (near > 0.62 && v < 0.55) return { kind: 'forest' };
  if (near < 0.3 && v < 0.45) return { kind: 'hills' };
  return { kind: 'grass' };
}

// Computer empires: positions, race, clan and a development "head start".
const npcCache = new Map();
export function npcList(seed) {
  if (npcCache.has(seed)) return npcCache.get(seed);
  const list = NPC_NAMES.map((name, i) => {
    const ang = (i / NPC_NAMES.length) * Math.PI * 2 + hash2(seed, i, 0, 9) * 0.5;
    const rad = 7 + hash2(seed, i, 1, 9) * 11;
    let x = Math.round(Math.cos(ang) * rad), y = Math.round(Math.sin(ang) * rad);
    for (let k = 0; k < 20 && tileAt(seed, x, y).kind !== 'grass'; k++) x += k % 2 ? 1 : 0, y += k % 2 ? 0 : 1;
    return {
      id: `n${i}`, name, x, y,
      race: RACES[Math.floor(hash2(seed, i, 2, 9) * 4)],
      clan: NPC_CLANS[i % NPC_CLANS.length].id,
      head: (i % 5) * 0.6, // days of head start
    };
  });
  npcCache.set(seed, list);
  return list;
}

// A free spot for a new city (searches in a spiral from a starting point).
export function findSpot(seed, start, taken, minGap = 2) {
  const ok = (x, y) => tileAt(seed, x, y).kind === 'grass' && !taken(x, y, minGap);
  for (let r = 0; r <= WORLD_R; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of r === Math.abs(dx) ? [r - Math.abs(dx)] : [r - Math.abs(dx), -(r - Math.abs(dx))]) {
        const x = start.x + dx, y = start.y + dy;
        if (inWorld(x, y) && ok(x, y)) return { x, y };
      }
    }
  }
  return null;
}

export function homeStart(seed, uid) {
  const h = hashStr(`${seed}:${uid}`);
  const ang = (h % 3600) / 3600 * Math.PI * 2;
  const rad = 4 + ((h >>> 12) % 1000) / 1000 * 11;
  return { x: Math.round(Math.cos(ang) * rad), y: Math.round(Math.sin(ang) * rad) };
}

// The player's barbarian camps – around their capital.
export function campSpots(seed, home) {
  return CAMP_SLOTS.map((d, i) => {
    const ang = (i / CAMP_SLOTS.length) * Math.PI * 2 + hash2(seed, home.x, home.y, 20 + i) * 0.8;
    const r = d * 1.6 + 0.6;
    return { x: Math.max(-WORLD_R, Math.min(WORLD_R, home.x + Math.round(Math.cos(ang) * r))), y: Math.max(-WORLD_R, Math.min(WORLD_R, home.y + Math.round(Math.sin(ang) * r))) };
  });
}
