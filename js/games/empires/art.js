// Evil Empires – графика: изометричен град в реалистичен, приглушен стил. Обемите
// (кутии, покриви, кули) получават зърнеста текстура (камък, дърво, слама),
// плавни сенки и нощно осветление. Анимациите са само дим, огън и знамена.

import { GRID } from './data.js';

// Изометрия: (u, v) в единици на парцел, z – височина в пиксели.
const TW = 60, TH = 30;
const P = (u, v, z = 0) => [(u - v) * TW, (u + v) * TH - z];
const f1 = (x) => Math.round(x * 10) / 10;
const pts = (...ps) => ps.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');
const poly = (fill, ...ps) => `<polygon points="${pts(...ps)}" fill="${fill}"/>`;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- палитри ----------
// Приглушени естествени цветове; цветът на расата е само по знамената и светлините.
const BASE = {
  humans: {
    wall: '#bcae95', wallL: '#a0937b', wallR: '#7d725f', stone: '#8b857a', wood: '#6e5238',
    roof1: ['#8c7650', '#6b5a3c'], roof2: ['#8a4b3b', '#653528'], roof3: ['#4d5560', '#363c45'],
    accent: '#c9a24a', banner: '#8e2c2a', glow: '#f2b765', ground: '#5d5541', tint: '#1c1a24',
  },
  undead: {
    wall: '#7b7b80', wallL: '#646469', wallR: '#4b4b51', stone: '#6e6d72', wood: '#4a4038',
    roof1: ['#545040', '#3e3b30'], roof2: ['#3d4347', '#2b3034'], roof3: ['#2f3538', '#1f2427'],
    accent: '#7fbf95', banner: '#2f4a3a', glow: '#a9dcb2', ground: '#4f5245', tint: '#141c1a',
  },
  orcs: {
    wall: '#8c6c4e', wallL: '#73583c', wallR: '#57432e', stone: '#7a6c60', wood: '#5e4430',
    roof1: ['#6e5b3f', '#53442e'], roof2: ['#5d5446', '#443d32'], roof3: ['#6a3a2c', '#4c281e'],
    accent: '#b4553a', banner: '#7a2a1e', glow: '#f09a52', ground: '#5e4c38', tint: '#221614',
  },
  vesheri: {
    wall: '#7e7b88', wallL: '#66636f', wallR: '#4e4c57', stone: '#727080', wood: '#4c4048',
    roof1: ['#5b546a', '#454055'], roof2: ['#4a4568', '#35314f'], roof3: ['#3a3554', '#28243c'],
    accent: '#9c88c9', banner: '#4a3a78', glow: '#d6c8ff', ground: '#535246', tint: '#1a1628',
  },
};

export function pal(race, epoch = 1) {
  const b = BASE[race];
  const [roof, roofD] = epoch >= 3 ? b.roof3 || b.roof2 : epoch >= 2 ? b.roof2 : b.roof1;
  return { ...b, roof, roofD, epoch, thatch: epoch < 2 };
}
// Съвместимост: PALETTE[race] за прости употреби (акцент, светлина).
export const PALETTE = Object.fromEntries(Object.keys(BASE).map((r) => [r, pal(r, 1)]));

// ---------- текстури (генерират се веднъж с canvas) ----------
let TX = null;
function noiseURL(size, seed, gx, gy, darkA, lightA) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const r = rand(seed);
  const grid = Array.from({ length: gy }, () => Array.from({ length: gx }, r));
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * gx, fy = (y / size) * gy;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = smooth(fx - x0), ty = smooth(fy - y0);
      const g = (i, j) => grid[(y0 + j) % gy][(x0 + i) % gx];
      const lf = (g(0, 0) * (1 - tx) + g(1, 0) * tx) * (1 - ty) + (g(0, 1) * (1 - tx) + g(1, 1) * tx) * ty;
      const v = lf * 0.55 + r() * 0.45;
      const k = (y * size + x) * 4;
      if (v < 0.5) { img.data[k + 3] = Math.round((0.5 - v) * 2 * darkA * 255); }
      else { img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round((v - 0.5) * 2 * lightA * 255); }
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL();
}
function textures() {
  if (TX) return TX;
  try {
    TX = {
      grain: noiseURL(96, 11, 8, 8, 0.32, 0.14),
      wood: noiseURL(96, 23, 3, 40, 0.38, 0.12),
      ground: noiseURL(128, 37, 6, 6, 0.45, 0.1),
    };
  } catch {
    TX = {};
  }
  return TX;
}

// Общи дефиниции (текстури, сенки, светлини). Идентични във всеки SVG на страницата.
export function defs(c) {
  const t = typeof document !== 'undefined' ? textures() : {};
  const pat = (id, url, s) => (url ? `<pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><image href="${url}" width="${s}" height="${s}"/></pattern>` : '');
  const glow = (id, col, a = 0.45) => `<radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity="${a}"/><stop offset=".4" stop-color="${col}" stop-opacity="${a / 3}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
  return `<defs>
    ${pat('ee-tx-grain', t.grain, 48)}${pat('ee-tx-wood', t.wood, 48)}${pat('ee-tx-ground', t.ground, 96)}
    <linearGradient id="ee-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".05"/><stop offset=".55" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>
    <radialGradient id="ee-shd"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <filter id="ee-t-undead" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.62 0.28 0.06 0 0  0.18 0.72 0.08 0 0.01  0.16 0.26 0.52 0 0.01  0 0 0 1 0"/></filter>
    <filter id="ee-t-orcs" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1.08 0.08 0 0 0.02  0.06 0.88 0 0 0  0 0.06 0.74 0 0  0 0 0 1 0"/></filter>
    <filter id="ee-t-vesheri-arcane" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.62 0.1 0.22 0 0.02  0.08 0.55 0.2 0 0  0.25 0.12 0.95 0 0.06  0 0 0 1 0"/></filter>
    <filter id="ee-t-vesheri" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.8 0.08 0.14 0 0  0.02 0.8 0.14 0 0  0.12 0.06 1.02 0 0.03  0 0 0 1 0"/></filter>
    ${glow('ee-g-race', c.glow, 0.35)}${glow('ee-g-fire', '#ff9a4a', 0.4)}${glow('ee-g-mana', '#a88be6', 0.35)}${glow('ee-g-gold', '#e8b850', 0.3)}${glow('ee-g-moon', '#cdd6e6', 0.35)}
  </defs>`;
}

const halo = (x, y, r, kind = 'race') => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="url(#ee-g-${kind})" pointer-events="none"/>`;
const glowAt = (u, v, z, r, kind) => { const [x, y] = P(u, v, z); return halo(x, y, r, kind); };
const TXR = { stone: 'grain', plaster: 'grain', wood: 'wood', thatch: 'wood', earth: 'ground' };
// Повърхност: основен цвят + текстура + (по желание) плавна сянка.
const face = (fill, mat, shade, ...ps) => poly(fill, ...ps) +
  (mat && TXR[mat] ? `<polygon points="${pts(...ps)}" fill="url(#ee-tx-${TXR[mat]})"/>` : '') +
  (shade ? `<polygon points="${pts(...ps)}" fill="url(#ee-shade)"/>` : '');

// ---------- примитиви ----------
// Кутия с център (cu, cv), половин размери a×b, височина h, на височина z0.
// o.mat: 'stone' | 'plaster' | 'wood' (текстура), o.tex: 'brick' | 'plank' (линии).
function box(c, cu, cv, a, b, h, z0 = 0, o = {}) {
  const top = o.top || c.wall, l = o.l || c.wallL, r = o.r || c.wallR;
  const mat = o.mat === undefined ? 'stone' : o.mat;
  const N = [cu - a, cv - b], E = [cu + a, cv - b], S = [cu + a, cv + b], W = [cu - a, cv + b];
  const at = ([u, v], z) => P(u, v, z);
  let out = face(l, mat, h > 6, at(W, z0 + h), at(S, z0 + h), at(S, z0), at(W, z0)) +
    face(r, mat, h > 6, at(S, z0 + h), at(E, z0 + h), at(E, z0), at(S, z0));
  if (o.tex === 'brick' && h > 10) {
    let lines = '';
    for (let z = z0 + 5; z < z0 + h - 2; z += 5) lines += `<polyline points="${pts(at(W, z), at(S, z), at(E, z))}"/>`;
    out += `<g stroke="#000" stroke-opacity=".09" stroke-width=".7" fill="none">${lines}</g>`;
  } else if (o.tex === 'plank' && h > 8) {
    let lines = '';
    const n = Math.max(2, Math.round((a + b) * 16));
    for (let i = 1; i < n; i++) {
      const t = (i / n) * (a + b);
      const p = t < a ? [W[0] + 2 * t, W[1]] : [S[0], S[1] - 2 * (t - a)];
      lines += `<line x1="${f1(at(p, z0)[0])}" y1="${f1(at(p, z0)[1])}" x2="${f1(at(p, z0 + h)[0])}" y2="${f1(at(p, z0 + h)[1])}"/>`;
    }
    out += `<g stroke="#000" stroke-opacity=".16" stroke-width=".7">${lines}</g>`;
  }
  out += face(top, mat, false, at(N, z0 + h), at(E, z0 + h), at(S, z0 + h), at(W, z0 + h));
  out += `<polyline points="${pts(at(W, z0 + h), at(S, z0 + h), at(E, z0 + h))}" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="1"/>`;
  out += `<line x1="${f1(at(S, z0)[0])}" y1="${f1(at(S, z0)[1])}" x2="${f1(at(S, z0 + h)[0])}" y2="${f1(at(S, z0 + h)[1])}" stroke="#000" stroke-opacity=".12" stroke-width=".8"/>`;
  return out;
}

// Двускатен покрив с било по оста u: слама (епоха 1) или керемиди (епоха 2+).
function gable(c, cu, cv, a, b, z, rh, o = {}) {
  const roof = o.roof || c.roof, dark = o.dark || c.roofD;
  const mat = o.mat || (c.thatch ? 'thatch' : 'stone');
  const R1 = P(cu - a, cv, z + rh), R2 = P(cu + a, cv, z + rh);
  const W = P(cu - a, cv + b, z), S = P(cu + a, cv + b, z), E = P(cu + a, cv - b, z), N = P(cu - a, cv - b, z);
  let rows = '';
  if (mat !== 'thatch') for (const t of [0.2, 0.4, 0.6, 0.8]) rows += `<line x1="${f1(lerp(W, R1, t)[0])}" y1="${f1(lerp(W, R1, t)[1])}" x2="${f1(lerp(S, R2, t)[0])}" y2="${f1(lerp(S, R2, t)[1])}"/>`;
  else for (let i = 1; i < 9; i++) { const p = lerp(W, S, i / 9), q = lerp(R1, R2, i / 9); rows += `<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}"/>`; }
  return face(dark, mat, false, N, E, R2, R1) +
    face(roof, mat, false, W, S, R2, R1) +
    `<polygon points="${pts(R1, R2, S, W)}" fill="url(#ee-shade)" opacity=".6"/>` +
    `<g stroke="#000" stroke-opacity="${mat === 'thatch' ? 0.13 : 0.2}" stroke-width=".8">${rows}</g>` +
    face(o.side || c.wallR, o.sideMat || 'stone', true, S, E, R2) +
    `<polyline points="${pts(W, S, E)}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.6"/>` +
    `<line x1="${f1(R1[0])}" y1="${f1(R1[1])}" x2="${f1(R2[0])}" y2="${f1(R2[1])}" stroke="#fff" stroke-opacity=".1" stroke-width="1.4"/>`;
}

function pyramid(c, cu, cv, a, z, rh, o = {}) {
  const apex = P(cu, cv, z + rh);
  const mat = o.mat === undefined ? 'stone' : o.mat;
  return face(o.l || c.roof, mat, false, P(cu - a, cv + a, z), P(cu + a, cv + a, z), apex) +
    face(o.r || c.roofD, mat, false, P(cu + a, cv + a, z), P(cu + a, cv - a, z), apex);
}

// Кула (цилиндър) с конусен покрив; o.merlons – назъбен връх.
function tower(c, cu, cv, r, h, z0 = 0, o = {}) {
  const [x, y] = P(cu, cv, z0);
  const rx = r * TW, ry = r * TH;
  const mat = o.mat === undefined ? 'stone' : o.mat;
  const body = `M${f1(x - rx)} ${f1(y)} L${f1(x - rx)} ${f1(y - h)} A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(x + rx)} ${f1(y - h)} L${f1(x + rx)} ${f1(y)} A${f1(rx)} ${f1(ry)} 0 0 1 ${f1(x - rx)} ${f1(y)}Z`;
  const right = `M${f1(x + rx * 0.15)} ${f1(y + ry)} L${f1(x + rx * 0.15)} ${f1(y - h + ry)} A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(x + rx)} ${f1(y - h)} L${f1(x + rx)} ${f1(y)} A${f1(rx)} ${f1(ry)} 0 0 1 ${f1(x + rx * 0.15)} ${f1(y + ry)}Z`;
  let rings = '';
  if (o.tex !== false && mat === 'stone') for (let z = 5; z < h - 3; z += 5) rings += `<path d="M${f1(x - rx)} ${f1(y - z)} A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(x + rx)} ${f1(y - z)}" fill="none" stroke="#000" stroke-opacity=".08" stroke-width=".7"/>`;
  const coneMat = c.thatch && !o.slate ? 'thatch' : 'stone';
  const tip = [x, y - h - rx * 1.9];
  const cone = o.cone === false ? '' : `<path d="M${f1(x - rx - 3)} ${f1(y - h)} L${f1(tip[0])} ${f1(tip[1])} L${f1(x + rx + 3)} ${f1(y - h)} A${f1(rx + 3)} ${f1(ry + 1.5)} 0 0 1 ${f1(x - rx - 3)} ${f1(y - h)}Z" fill="${o.roof || c.roof}"/>
    <path d="M${f1(x - rx - 3)} ${f1(y - h)} L${f1(tip[0])} ${f1(tip[1])} L${f1(x + rx + 3)} ${f1(y - h)} A${f1(rx + 3)} ${f1(ry + 1.5)} 0 0 1 ${f1(x - rx - 3)} ${f1(y - h)}Z" fill="url(#ee-tx-${TXR[coneMat]})"/>
    <path d="M${f1(tip[0])} ${f1(tip[1])} L${f1(x + rx + 3)} ${f1(y - h)} A${f1(rx + 3)} ${f1(ry + 1.5)} 0 0 1 ${f1(x)} ${f1(y - h + ry + 1.5)}Z" fill="${o.dark || c.roofD}" opacity=".9"/>`;
  const merlons = o.merlons ? [-0.75, -0.25, 0.25, 0.75].map((k) => `<rect x="${f1(x + k * rx - 2.4)}" y="${f1(y - h - 4.5 + Math.abs(k) * 2.2)}" width="4.8" height="5.5" fill="${o.wall || c.wallL}"/><rect x="${f1(x + k * rx - 2.4)}" y="${f1(y - h - 4.5 + Math.abs(k) * 2.2)}" width="4.8" height="5.5" fill="url(#ee-shade)"/>`).join('') : '';
  return `<path d="${body}" fill="${o.wall || c.wallL}"/><path d="${body}" fill="url(#ee-tx-${TXR[mat] || 'grain'})"/><path d="${right}" fill="#000" opacity=".22"/><path d="${body}" fill="url(#ee-shade)"/>
    ${rings}<ellipse cx="${f1(x)}" cy="${f1(y - h)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${o.top || c.wall}"/>${merlons}${cone}`;
}

// Прозорец/врата по лявата (v = const) или дясната (u = const) стена.
function winL(c, u, v, z, w = 0.032, hh = 7, lit = true) {
  const q = [P(u - w, v, z), P(u + w, v, z), P(u + w, v, z + hh), P(u - w, v, z + hh)];
  const [x, y] = P(u, v, z + hh / 2);
  return (lit ? halo(x, y, 7) : '') + `<polygon points="${pts(...q)}" fill="${lit ? c.glow : '#17130f'}" opacity="${lit ? 0.85 : 1}" stroke="#2a2018" stroke-width="1"/>`;
}
function winR(c, u, v, z, w = 0.032, hh = 7, lit = true) {
  const q = [P(u, v + w, z), P(u, v - w, z), P(u, v - w, z + hh), P(u, v + w, z + hh)];
  const [x, y] = P(u, v, z + hh / 2);
  return (lit ? halo(x, y, 6) : '') + `<polygon points="${pts(...q)}" fill="${lit ? c.glow : '#17130f'}" opacity="${lit ? 0.7 : 1}" stroke="#2a2018" stroke-width="1"/>`;
}
const doorL = (u, v, w = 0.05, hh = 13) => `<polygon points="${pts(P(u - w, v, 0), P(u + w, v, 0), P(u + w, v, hh), P(u, v, hh + 3), P(u - w, v, hh))}" fill="#21170f" stroke="#3e2c1c" stroke-width="1.4"/><polygon points="${pts(P(u - w, v, 0), P(u + w, v, 0), P(u + w, v, hh), P(u, v, hh + 3), P(u - w, v, hh))}" fill="url(#ee-tx-wood)"/>`;

const flag = (u, v, z, color, big = 1) => {
  const [x, y] = P(u, v, z);
  return `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x)}" y2="${f1(y - 24 * big)}" stroke="#2b2620" stroke-width="1.4"/>
    <path class="ee-flag" d="M${f1(x)} ${f1(y - 24 * big)} Q${f1(x + 7 * big)} ${f1(y - 25 * big)} ${f1(x + 14 * big)} ${f1(y - 21 * big)} L${f1(x + 13 * big)} ${f1(y - 15 * big)} Q${f1(x + 7 * big)} ${f1(y - 18 * big)} ${f1(x)} ${f1(y - 15 * big)}Z" fill="${color}"/>`;
};
const smoke = (x, y, n = 3) => `<g class="ee-smoke" pointer-events="none">${Array.from({ length: n }, (_, i) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${4 + i * 1.5}" fill="#8c8a90" style="animation-delay:${(i * 1.8).toFixed(1)}s"/>`).join('')}</g>`;
const fire = (x, y, s = 1) => halo(x, y - 5 * s, 22 * s, 'fire') +
  `<g class="ee-flame" style="transform-origin:${f1(x)}px ${f1(y)}px"><path d="M${f1(x - 5 * s)} ${f1(y)} Q${f1(x - 6 * s)} ${f1(y - 8 * s)} ${f1(x - 1 * s)} ${f1(y - 16 * s)} Q${f1(x + 1 * s)} ${f1(y - 9 * s)} ${f1(x + 5 * s)} ${f1(y - 12 * s)} Q${f1(x + 6 * s)} ${f1(y - 5 * s)} ${f1(x + 5 * s)} ${f1(y)}Z" fill="#d9662a"/><path d="M${f1(x - 2.5 * s)} ${f1(y)} Q${f1(x - 3 * s)} ${f1(y - 5 * s)} ${f1(x)} ${f1(y - 9 * s)} Q${f1(x + 3 * s)} ${f1(y - 5 * s)} ${f1(x + 2.5 * s)} ${f1(y)}Z" fill="#f6bd62"/></g>`;
const shadow = (rx = 52, ry = 24, dy = 4) => `<ellipse cx="0" cy="${dy}" rx="${f1(rx)}" ry="${f1(ry)}" fill="url(#ee-shd)"/>`;

function logPile(u, v) {
  return [[0, 0, 0], [0.1, -0.05, 0], [0.05, -0.02, 6]].map(([du, dv, z]) => {
    const [x, y] = P(u + du, v + dv, z);
    return `<rect x="${f1(x - 10)}" y="${f1(y - 7)}" width="18" height="7" rx="3.5" fill="#5a4230"/><rect x="${f1(x - 10)}" y="${f1(y - 7)}" width="18" height="7" rx="3.5" fill="url(#ee-tx-wood)"/><ellipse cx="${f1(x + 8)}" cy="${f1(y - 3.5)}" rx="2.4" ry="3.5" fill="#b08a5e"/>`;
  }).join('');
}
const WOOD = { top: '#6e5238', l: '#5c4430', r: '#463424', mat: 'wood' };
const barrel = (u, v) => tower({}, u, v, 0.045, 11, 0, { wall: '#5c4430', top: '#6e5238', cone: false, mat: 'wood' }) +
  (() => { const [x, y] = P(u, v, 3); const [x2, y2] = P(u, v, 8); return `<line x1="${f1(x - 2.7)}" y1="${f1(y)}" x2="${f1(x + 2.7)}" y2="${f1(y)}" stroke="#2a2420" stroke-width="1"/><line x1="${f1(x2 - 2.7)}" y1="${f1(y2)}" x2="${f1(x2 + 2.7)}" y2="${f1(y2)}" stroke="#2a2420" stroke-width="1"/>`; })();
const crate = (u, v, z = 0) => box({}, u, v, 0.06, 0.06, 10, z, { top: '#8a6a48', l: '#735638', r: '#5a432c', mat: 'wood', tex: 'plank' });

// ---------- сградите ----------
const DRAW = {
  hall(c, race, L) {
    const tall = 36 + Math.min(L, 10) * 2.5;
    const slate = { slate: true, roof: '#4a4c52', dark: '#35373c' };
    let s = '';
    if (L >= 3) s += tower(c, 0.28, -0.3, 0.1, tall + 18, 0, { merlons: true, cone: false });
    s += box(c, 0, 0.02, 0.34, 0.27, tall, 0, { tex: 'brick' }) + gable(c, 0, 0.02, 0.38, 0.31, tall, 22);
    s += doorL(0.05, 0.29, 0.06, 15);
    s += winL(c, -0.17, 0.29, tall * 0.55) + winL(c, 0.22, 0.29, tall * 0.55, 0.032, 7, L % 2 === 0) + winR(c, 0.34, -0.1, tall * 0.55) + winR(c, 0.34, 0.12, tall * 0.55, 0.032, 7, false);
    if (L >= 5) s += [-0.17, 0.22].map((u) => `<polygon points="${pts(P(u - 0.035, 0.295, tall - 2), P(u + 0.035, 0.295, tall - 2), P(u + 0.035, 0.295, tall - 16), P(u, 0.295, tall - 19), P(u - 0.035, 0.295, tall - 16))}" fill="${c.banner}"/>`).join('');
    if (L >= 2) s += tower(c, 0.38, 0.32, 0.1, tall + 6, 0, { merlons: true, cone: L >= 4, ...slate });
    s += tower(c, -0.32, 0.32, 0.13, tall + 20, 0, slate) + winL(c, -0.32, 0.45, tall - 4, 0.025, 6);
    s += flag(-0.32, 0.32, tall + 20 + 0.13 * TW * 1.9, c.banner);
    return s;
  },
  farm(c, race, L) {
    if (race === 'undead') {
      let s = face('#22261f', 'earth', false, P(-0.44, -0.44), P(0.44, -0.44), P(0.44, 0.44), P(-0.44, 0.44));
      s += box(c, -0.22, -0.22, 0.16, 0.13, 20, 0, { tex: 'brick' }) + pyramid(c, -0.22, -0.22, 0.18, 20, 14, { l: '#4a4c52', r: '#35373c' }) + doorL(-0.22, -0.09, 0.04, 11);
      const stones = [[0.1, -0.25], [0.3, -0.2], [0.05, 0.05], [0.28, 0.05], [-0.28, 0.2], [0, 0.3], [0.28, 0.3]].slice(0, 4 + Math.min(3, L));
      for (const [u, v] of stones) s += box(c, u, v, 0.05, 0.02, 12, 0, { top: '#8f8e93', l: '#77767b', r: '#5d5c61' });
      const [fx, fy] = P(-0.3, 0.35);
      s += `<g stroke="#3a332c" stroke-width="1.6">${[0, 1, 2, 3, 4].map((i) => `<line x1="${f1(fx + i * 9)}" y1="${f1(fy + i * 4.5)}" x2="${f1(fx + i * 9)}" y2="${f1(fy + i * 4.5 - 9)}"/>`).join('')}<line x1="${f1(fx)}" y1="${f1(fy - 6)}" x2="${f1(fx + 36)}" y2="${f1(fy + 12)}"/></g>`;
      s += `<g class="ee-pulse">${glowAt(0.15, 0.15, 10, 14)}</g>`;
      return s;
    }
    let s = '';
    for (let i = 0; i < 5; i++) s += face(i % 2 ? '#4f4a2a' : '#6b6236', 'earth', false, P(-0.44, -0.02 + i * 0.09), P(0.44, -0.02 + i * 0.09), P(0.44, 0.05 + i * 0.09), P(-0.44, 0.05 + i * 0.09));
    s += box(c, -0.12, -0.25, 0.22, 0.14, 22, 0, { top: '#6e5238', l: '#6a4e36', r: '#523b28', mat: 'wood', tex: 'plank' }) + gable(c, -0.12, -0.25, 0.25, 0.17, 22, 15);
    s += doorL(-0.05, -0.11, 0.05, 13);
    const [hx, hy] = P(0.28, -0.25);
    s += `<path d="M${hx - 10} ${hy} Q${hx - 9} ${hy - 17} ${hx} ${hy - 19} Q${hx + 9} ${hy - 17} ${hx + 10} ${hy}Z" fill="#a08a50"/><path d="M${hx - 10} ${hy} Q${hx - 9} ${hy - 17} ${hx} ${hy - 19} Q${hx + 9} ${hy - 17} ${hx + 10} ${hy}Z" fill="url(#ee-tx-wood)"/><path d="M${hx} ${hy - 19} Q${hx + 9} ${hy - 17} ${hx + 10} ${hy} L${hx} ${hy}Z" fill="#000" opacity=".2"/>`;
    return s;
  },
  lumber(c, race, L) {
    let s = box(c, -0.16, -0.16, 0.2, 0.17, 24, 0, { ...WOOD, tex: 'plank' }) + gable(c, -0.16, -0.16, 0.23, 0.2, 24, 14);
    s += doorL(-0.16, 0.01, 0.05, 12) + winR(c, 0.04, -0.2, 12, 0.03, 6, false);
    s += logPile(0.12, 0.26) + (L >= 3 ? logPile(-0.32, 0.3) : '');
    // магаре за рязане с труп
    const [x, y] = P(0.3, -0.08);
    s += `<g stroke="#4a3626" stroke-width="2"><line x1="${x - 8}" y1="${y}" x2="${x - 2}" y2="${y - 10}"/><line x1="${x + 4}" y1="${y + 3}" x2="${x - 2}" y2="${y - 10}"/><line x1="${x + 10}" y1="${y - 6}" x2="${x + 16}" y2="${y - 16}"/></g><rect x="${x - 6}" y="${y - 15}" width="26" height="5" rx="2.5" fill="#6a4e36" transform="rotate(-26 ${x} ${y - 12})"/>`;
    const [sx, sy] = P(0.32, 0.08);
    s += `<path d="M${sx - 7} ${sy} v4 a7 3.5 0 0 0 14 0 v-4" fill="#4e3a28"/><ellipse cx="${sx}" cy="${sy}" rx="7" ry="3.5" fill="#a5835a"/>`;
    return s;
  },
  quarry(c, race, L) {
    const rk = { l: '#8a8780', r: '#64625d' };
    let s = face('#2a2926', 'earth', false, P(-0.44, -0.3), P(0.38, -0.44), P(0.44, 0.38), P(-0.32, 0.44));
    s += pyramid(c, -0.16, -0.14, 0.26, 0, 34, rk) + pyramid(c, 0.18, -0.2, 0.16, 0, 20, rk) + pyramid(c, -0.3, 0.16, 0.12, 0, 13, rk);
    const blk = { top: '#a8a59d', l: '#8e8b83', r: '#706e68', tex: 'brick' };
    s += box(c, 0.22, 0.2, 0.08, 0.08, 10, 0, blk) + box(c, 0.05, 0.3, 0.08, 0.06, 9, 0, blk);
    if (L >= 2) s += box(c, 0.22, 0.2, 0.07, 0.07, 9, 10, blk);
    const [x1, y1] = P(0.35, -0.05), [x2, y2] = P(0.35, -0.05, 44), [x3, y3] = P(0.05, -0.05, 42);
    s += `<g stroke="#4a3626" stroke-width="2.6" stroke-linecap="round"><line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/><line x1="${f1(x2)}" y1="${f1(y2)}" x2="${f1(x3)}" y2="${f1(y3)}"/></g><line x1="${f1(x3)}" y1="${f1(y3)}" x2="${f1(x3)}" y2="${f1(y3 + 20)}" stroke="#8a8478" stroke-width=".8"/><rect x="${f1(x3 - 4)}" y="${f1(y3 + 20)}" width="8" height="6" fill="#9a978f"/>`;
    return s;
  },
  mine(c, race, L) {
    let s = pyramid(c, 0, -0.04, 0.42, 0, 46, { l: '#4d4535', r: '#38322a', mat: 'earth' });
    const [x, y] = P(0.02, 0.3);
    s += `<path d="M${f1(x - 12)} ${f1(y)} L${f1(x - 12)} ${f1(y - 15)} L${f1(x + 12)} ${f1(y - 15)} L${f1(x + 12)} ${f1(y)}Z" fill="#0b0806"/>
      <g stroke="#5a4230" stroke-width="3"><line x1="${f1(x - 12)}" y1="${f1(y)}" x2="${f1(x - 12)}" y2="${f1(y - 17)}"/><line x1="${f1(x + 12)}" y1="${f1(y)}" x2="${f1(x + 12)}" y2="${f1(y - 17)}"/><line x1="${f1(x - 15)}" y1="${f1(y - 17)}" x2="${f1(x + 15)}" y2="${f1(y - 17)}"/></g>`;
    const [r1, r2] = [P(0.02, 0.3), P(0.02, 0.5)];
    s += `<g stroke="#4a4a50" stroke-width="1.4"><line x1="${f1(r1[0] - 5)}" y1="${f1(r1[1])}" x2="${f1(r2[0] - 5)}" y2="${f1(r2[1])}"/><line x1="${f1(r1[0] + 5)}" y1="${f1(r1[1])}" x2="${f1(r2[0] + 5)}" y2="${f1(r2[1])}"/></g>`;
    s += box(c, 0.3, 0.32, 0.07, 0.05, 8, 0, { top: '#3e3e44', l: '#4c4c52', r: '#36363b' });
    const [gx, gy] = P(0.3, 0.32, 9);
    s += `<circle cx="${f1(gx - 3)}" cy="${f1(gy - 1)}" r="3" fill="#c49a3a"/><circle cx="${f1(gx + 3)}" cy="${f1(gy - 1.5)}" r="2.7" fill="#a8822e"/><circle cx="${f1(gx)}" cy="${f1(gy - 3.5)}" r="2.4" fill="#d6b050"/>`;
    s += glowAt(0.02, 0.3, 9, 14, 'fire') + (() => { const [lx, ly] = P(-0.08, 0.31, 12); return `<rect x="${f1(lx - 1.5)}" y="${f1(ly - 3)}" width="3" height="4" fill="#f2b765"/>`; })();
    return s;
  },
  houses(c, race, L) {
    const all = [[-0.22, -0.22], [0.2, -0.18], [-0.18, 0.2], [0.22, 0.24]];
    const many = all.slice(0, Math.min(4, 2 + Math.floor(L / 3)));
    return many.map(([u, v], i) => {
      const hh = 15 + (i % 2) * 4;
      const timber = i % 2 === 1;
      return box(c, u, v, 0.13, 0.11, hh, 0, timber ? { ...WOOD, tex: 'plank' } : { mat: 'plaster', top: c.wall }) + gable(c, u, v, 0.15, 0.13, hh, 12) +
        doorL(u + 0.04, v + 0.11, 0.028, 8) + winL(c, u - 0.06, v + 0.11, 6, 0.025, 5, (i + L) % 3 !== 0) + winR(c, u + 0.13, v, 6, 0.025, 5, false) +
        (L >= 2 && i < 2 ? box(c, u + 0.06, v - 0.05, 0.025, 0.025, 10, hh + 4, { top: '#3a3633', l: '#5a524b', r: '#433d38' }) + smoke(...P(u + 0.06, v - 0.05, hh + 16), 2) : '');
    }).join('');
  },
  warehouse(c, race, L) {
    let s = box(c, -0.02, -0.08, 0.34, 0.24, 28, 0, { ...WOOD, tex: 'plank' });
    s += gable(c, -0.02, -0.08, 0.37, 0.27, 28, 12);
    s += `<polygon points="${pts(P(-0.12, 0.16, 0), P(0.1, 0.16, 0), P(0.1, 0.16, 20), P(-0.12, 0.16, 20))}" fill="#21170f" stroke="#3e2c1c" stroke-width="1.4"/>`;
    s += crate(0.25, 0.33) + crate(0.1, 0.36) + crate(0.25, 0.33, 10) + barrel(-0.25, 0.3) + (L >= 3 ? barrel(-0.14, 0.36) + crate(0.36, 0.2) : '');
    return s;
  },
  barracks(c, race, L) {
    let s = box(c, 0, -0.12, 0.4, 0.2, 26, 0, { tex: 'brick' }) + gable(c, 0, -0.12, 0.43, 0.23, 26, 16);
    s += doorL(0.02, 0.08, 0.06, 15) + winL(c, -0.24, 0.08, 12) + winL(c, 0.25, 0.08, 12, 0.032, 7, false) + winR(c, 0.4, -0.12, 12, 0.032, 7, false);
    s += flag(0.38, 0.32, 0, c.banner, 1.1);
    s += `<g stroke="#8d9096" stroke-width="1.6" stroke-linecap="round">${[-0.32, -0.25, -0.18].map((u) => { const [x, y] = P(u, 0.36); return `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x + 3)}" y2="${f1(y - 22)}"/>`; }).join('')}</g>`;
    const [rx, ry] = P(-0.25, 0.36);
    s += `<line x1="${rx - 12}" y1="${ry - 12}" x2="${rx + 10}" y2="${ry - 1}" stroke="#4a3626" stroke-width="2.4"/>`;
    if (L >= 3) {
      const [x, y] = P(0.18, 0.36);
      s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - 20}" stroke="#4a3626" stroke-width="2.6"/><line x1="${x - 7}" y1="${y - 13}" x2="${x + 7}" y2="${y - 13}" stroke="#4a3626" stroke-width="2.4"/><ellipse cx="${x}" cy="${y - 22}" rx="4" ry="4.5" fill="#9a8058"/>`;
    }
    return s;
  },
  academy(c, race, L) {
    let s = '';
    if (L >= 4) s += tower(c, 0.24, -0.26, 0.08, 52, 0, { slate: true, roof: '#4a4c52', dark: '#35373c' });
    s += box(c, 0, 0, 0.32, 0.25, 32, 0, { tex: 'brick', mat: 'plaster', top: c.wall });
    s += box(c, 0, 0.29, 0.34, 0.06, 3, 0, { top: '#a29d92', l: '#8a867c', r: '#706c64' });
    s += [-0.24, -0.1, 0.04, 0.18].map((u) => box(c, u, 0.31, 0.02, 0.02, 28, 3, { top: '#d4cfc4', l: '#c1bbae', r: '#9a958a' })).join('');
    s += box(c, 0, 0.29, 0.34, 0.06, 4, 31);
    s += doorL(-0.03, 0.25, 0.05, 15) + winR(c, 0.32, -0.08, 14);
    const [x, y] = P(0, 0, 32);
    const dome = `M${f1(x - 30)} ${f1(y)} A30 24 0 0 1 ${f1(x + 30)} ${f1(y)}Z`;
    s += `<path d="${dome}" fill="#5f7a70"/><path d="${dome}" fill="url(#ee-tx-grain)"/><path d="M${f1(x)} ${f1(y - 24)} A30 24 0 0 1 ${f1(x + 30)} ${f1(y)}L${f1(x)} ${f1(y)}Z" fill="#000" opacity=".25"/>
      <path d="M${f1(x - 18)} ${f1(y - 18)} A30 24 0 0 1 ${f1(x - 2)} ${f1(y - 24)}" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>`;
    s += `<rect x="${f1(x - 1.2)}" y="${f1(y - 32)}" width="2.4" height="9" fill="#3a3a3a"/>`;
    return s;
  },
  altar(c) {
    const st = (k) => ({ top: ['#5a5862', '#6a6872', '#7a7882'][k], l: ['#48464f', '#56545d', '#64626b'][k], r: ['#37353d', '#43414a', '#4f4d56'][k], tex: 'brick' });
    let s = box(c, 0, 0, 0.36, 0.36, 6, 0, st(0)) + box(c, 0, 0, 0.25, 0.25, 6, 6, st(1)) + box(c, 0, 0, 0.13, 0.13, 6, 12, st(2));
    for (const [u, v] of [[-0.3, 0.3], [0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) s += box(c, u, v, 0.03, 0.03, 20, 0, st(1)) + fire(...P(u, v, 20), 0.3);
    const [x, y] = P(0, 0, 18);
    s += `<g class="ee-pulse">${halo(x, y - 20, 26, 'mana')}</g><polygon points="${pts([x, y - 44], [x + 8, y - 22], [x, y - 4], [x - 8, y - 22])}" fill="#7d63b8"/><polygon points="${pts([x, y - 44], [x + 8, y - 22], [x, y - 4])}" fill="#4f3c80"/><polyline points="${pts([x - 8, y - 22], [x, y - 44])}" stroke="#c9b8f0" stroke-opacity=".6" stroke-width="1" fill="none"/>`;
    return s;
  },
  smithy(c, race, L) {
    let s = box(c, 0.2, -0.17, 0.06, 0.06, 52, 0, { top: '#2e2c2b', l: '#57524c', r: '#423e39', tex: 'brick' });
    s += smoke(...P(0.2, -0.17, 58), 4);
    s += box(c, -0.02, 0.02, 0.3, 0.24, 24, 0, { tex: 'brick' }) + gable(c, -0.02, 0.02, 0.33, 0.27, 24, 12);
    const [x, y] = P(-0.04, 0.26, 2);
    s += halo(x, y - 6, 24, 'fire') + `<polygon class="ee-pulse" points="${pts(P(-0.12, 0.26, 2), P(0.04, 0.26, 2), P(0.04, 0.26, 13), P(-0.12, 0.26, 13))}" fill="#c9572a"/>`;
    const [ax, ay] = P(0.25, 0.36);
    s += `<path d="M${ax - 8} ${ay - 8} h16 l-3 4 h-10Z M${ax - 3} ${ay - 4} h6 v4 h-6Z" fill="#2e2e33"/>`;
    s += winR(c, 0.28, -0.05, 10, 0.03, 6, false);
    return s;
  },
  tower(c, race, L) {
    const stone = c.epoch >= 2;
    let s = '';
    if (stone) s += tower(c, 0, 0, 0.16, 58 + L * 2, 0, { merlons: true, cone: c.epoch >= 3, slate: true, roof: '#3d4147', dark: '#2b2e33' }) + winL(c, 0, 0.16, 40, 0.025, 7);
    else {
      for (const [du, dv] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) s += box(c, du, dv, 0.02, 0.02, 48, 0, WOOD);
      const [ax, ay] = P(-0.12, 0.12, 4), [bx, by] = P(0.12, 0.12, 40);
      s += `<line x1="${f1(ax)}" y1="${f1(ay)}" x2="${f1(bx)}" y2="${f1(by)}" stroke="#4a3626" stroke-width="2"/>`;
      s += box(c, 0, 0, 0.17, 0.17, 3, 48, WOOD) + box(c, 0, 0, 0.15, 0.15, 8, 51, { ...WOOD, tex: 'plank' }) + pyramid(c, 0, 0, 0.19, 59, 18, { l: c.roof, r: c.roofD, mat: 'thatch' });
    }
    s += fire(...P(0.14, 0.14, stone ? 60 + L * 2 : 51), 0.35) + flag(0, 0, stone ? 58 + L * 2 + (c.epoch >= 3 ? 0.16 * TW * 1.9 : 0) : 77, c.banner, 0.9);
    return s;
  },
  temple(c, race, L) {
    let s = box(c, 0, 0, 0.36, 0.3, 6, 0, { top: '#9a958b', l: '#837e74', r: '#69655d', tex: 'brick' });
    s += box(c, 0, -0.04, 0.28, 0.2, 30, 6, { mat: 'plaster', top: c.wall, tex: 'brick' });
    s += [-0.22, -0.08, 0.06, 0.2].map((u) => box(c, u, 0.21, 0.022, 0.022, 26, 6, { top: '#d4cfc4', l: '#c1bbae', r: '#9a958a' })).join('');
    s += gable(c, 0, 0.02, 0.32, 0.26, 36, 16, { roof: '#7a7466', dark: '#5c574c', mat: 'stone' });
    const [x, y] = P(0, 0.1, 6);
    s += halo(x, y - 12, 18, 'fire') + `<rect x="${f1(x - 3)}" y="${f1(y - 14)}" width="6" height="12" fill="#2a1d12"/>`;
    s += smoke(...P(0.1, -0.1, 58), 2);
    return s;
  },
  stable(c, race, L) {
    let s = box(c, -0.06, -0.12, 0.34, 0.2, 22, 0, { ...WOOD, tex: 'plank' }) + gable(c, -0.06, -0.12, 0.37, 0.23, 22, 14);
    for (const u of [-0.28, -0.12, 0.04, 0.2]) s += `<polygon points="${pts(P(u - 0.05, 0.08, 0), P(u + 0.05, 0.08, 0), P(u + 0.05, 0.08, 12), P(u - 0.05, 0.08, 12))}" fill="#21170f" stroke="#3e2c1c"/>`;
    // ограда и кон
    const [fx, fy] = P(-0.3, 0.38);
    s += `<g stroke="#4a3626" stroke-width="1.6">${[0, 1, 2, 3, 4].map((i) => `<line x1="${f1(fx + i * 11)}" y1="${f1(fy + i * 5.5)}" x2="${f1(fx + i * 11)}" y2="${f1(fy + i * 5.5 - 8)}"/>`).join('')}<line x1="${f1(fx)}" y1="${f1(fy - 6)}" x2="${f1(fx + 44)}" y2="${f1(fy + 16)}"/></g>`;
    const [hx, hy] = P(0.18, 0.3);
    s += `<path d="M${hx - 9} ${hy} l2 -9 q4 -3 12 -2 l4 -6 l3 1 l-2 7 l1 9 h-2 l-1 -6 h-9 l-1 6Z" fill="#5a4030"/>`;
    s += flag(0.32, -0.12, 36, c.banner);
    return s;
  },
  heroHall(c, race, L) {
    let s = box(c, -0.05, -0.12, 0.32, 0.22, 30, 0, { tex: 'brick' }) + gable(c, -0.05, -0.12, 0.35, 0.25, 30, 18);
    s += [-0.27, -0.12, 0.03, 0.18].map((u) => box(c, u, 0.12, 0.02, 0.02, 26, 0, { top: '#cfc9bc', l: '#bbb4a6', r: '#958f83' })).join('');
    s += doorL(-0.05, 0.1, 0.05, 15) + winR(c, 0.27, -0.12, 14);
    // статуя на пиедестал
    s += box(c, 0.22, 0.32, 0.06, 0.06, 8, 0, { top: '#8f8a80', l: '#7a756c', r: '#605c55' });
    const [x, y] = P(0.22, 0.32, 8);
    s += `<path d="M${x - 3} ${y} L${x - 2.5} ${y - 9} Q${x} ${y - 12} ${x + 2.5} ${y - 9} L${x + 3} ${y}Z" fill="#6f6a62"/><circle cx="${x}" cy="${y - 13}" r="2.6" fill="#7d786f"/><line x1="${x + 3}" y1="${y - 4}" x2="${x + 5}" y2="${y - 18}" stroke="#8a857c" stroke-width="1.2"/>`;
    s += flag(-0.36, 0.12, 0, c.banner, 1.15) + (L >= 3 ? flag(0.27, 0.12, 0, c.banner, 1.15) : '');
    return s;
  },
  embassy(c, race, L) {
    let s = box(c, 0, -0.06, 0.3, 0.24, 28, 0, { mat: 'plaster', tex: 'brick', top: c.wall }) + gable(c, 0, -0.06, 0.33, 0.27, 28, 14);
    s += doorL(0.02, 0.18, 0.05, 15) + winL(c, -0.17, 0.18, 14) + winL(c, 0.2, 0.18, 14, 0.032, 7, false) + winR(c, 0.3, -0.06, 14);
    const cols = [c.banner, '#3d5a7a', '#5a6a3a'].slice(0, 1 + Math.min(2, Math.floor(L / 2)));
    cols.forEach((col, i) => { s += flag(-0.3 + i * 0.12, 0.36, 0, col, 1.1); });
    return s;
  },
  cranny(c, race, L) {
    let s = pyramid(c, 0, -0.05, 0.3, 0, 14, { l: '#3e4a32', r: '#2e3826', mat: 'earth' });
    s += `<polygon points="${pts(P(-0.1, 0.18, 0), P(0.1, 0.18, 0), P(0.1, 0.18, 9), P(-0.1, 0.18, 9))}" fill="#3b2a1c" stroke="#24180f" stroke-width="1.2"/><polygon points="${pts(P(-0.1, 0.18, 0), P(0.1, 0.18, 0), P(0.1, 0.18, 9), P(-0.1, 0.18, 9))}" fill="url(#ee-tx-wood)"/>`;
    s += barrel(0.26, 0.3) + crate(-0.26, 0.3) + (L >= 3 ? barrel(0.32, 0.12) : '');
    return s;
  },
  unique(c, race) {
    if (race === 'humans') {
      return box(c, 0, 0, 0.3, 0.25, 32, 0, { tex: 'brick' }) + gable(c, 0, 0, 0.33, 0.28, 32, 18, { roof: '#7a3e30', dark: '#57291f', mat: 'stone' }) +
        doorL(0.02, 0.25, 0.05, 15) + winL(c, -0.18, 0.25, 16) + winL(c, 0.2, 0.25, 16) + winR(c, 0.3, -0.05, 16, 0.032, 7, false) +
        flag(0.3, 0.25, 50, c.banner) + `<circle cx="${f1(P(-0.33, 0.27, 22)[0])}" cy="${f1(P(-0.33, 0.27, 22)[1])}" r="5" fill="#a8822e" stroke="#5a4418"/>`;
    }
    if (race === 'undead') {
      const dk = { roof: '#26292b', dark: '#1a1c1e', slate: true };
      return box(c, 0, 0, 0.3, 0.3, 14, 0, { top: '#4a484e', l: '#3a383e', r: '#2c2a30', tex: 'brick' }) + tower(c, 0, 0, 0.12, 50, 14, { ...dk, wall: '#4a484e', top: '#58565c' }) +
        tower(c, 0.24, 0.24, 0.06, 26, 0, { ...dk, wall: '#4a484e', top: '#58565c' }) + tower(c, -0.24, 0.24, 0.06, 26, 0, { ...dk, wall: '#4a484e', top: '#58565c' }) + winL(c, 0, 0.12, 30, 0.028, 9) +
        `<g class="ee-pulse">${glowAt(0, 0, 70, 26)}</g>`;
    }
    if (race === 'orcs') {
      const [x, y] = P(0, 0);
      return `<ellipse cx="${x}" cy="${y}" rx="52" ry="26" fill="#3e2c1e"/><ellipse cx="${x}" cy="${y}" rx="52" ry="26" fill="url(#ee-tx-ground)"/><ellipse cx="${x}" cy="${y - 3}" rx="44" ry="21" fill="#1e140c"/><ellipse cx="${x}" cy="${y + 2}" rx="34" ry="15" fill="#5e4632"/><ellipse cx="${x}" cy="${y + 2}" rx="34" ry="15" fill="url(#ee-tx-ground)"/>` +
        [[0, -0.38], [-0.38, 0], [0.38, 0], [0, 0.38]].map(([u, v]) => box(c, u, v, 0.035, 0.035, 28, 0, { ...WOOD, tex: 'plank' }) + fire(...P(u, v, 28), 0.4)).join('') +
        flag(0.38, 0, 28, c.banner);
    }
    return tower(c, 0.27, -0.22, 0.08, 40, 0, { slate: true, roof: '#3e3a52', dark: '#2c293c' }) + tower(c, 0, 0.02, 0.18, 74, 0, { slate: true, roof: '#3e3a52', dark: '#2c293c' }) + tower(c, -0.28, 0.25, 0.07, 30, 0, { slate: true, roof: '#3e3a52', dark: '#2c293c' }) +
      winL(c, 0, 0.2, 44, 0.03, 8) + winL(c, 0, 0.2, 20, 0.03, 8, false) + `<g class="ee-pulse">${glowAt(0, 0.02, 100, 18)}</g>`;
  },
};

// ---------- декор ----------
function conifer(x, y, k, r) {
  const g = ['#1d2a22', '#22302a', '#1a261f'][Math.floor(r() * 3)];
  let s = `<ellipse cx="${f1(x + 4 * k)}" cy="${f1(y)}" rx="${f1(12 * k)}" ry="${f1(5 * k)}" fill="url(#ee-shd)"/><rect x="${f1(x - 1.6)}" y="${f1(y - 9 * k)}" width="3.2" height="${f1(9 * k)}" fill="#2e2219"/>`;
  for (let i = 0; i < 4; i++) {
    const w = (13 - i * 2.6) * k, by = y - (6 + i * 9) * k, ty = by - 15 * k;
    const jag = `M${f1(x - w)} ${f1(by)} L${f1(x - w * 0.55)} ${f1(by - 3 * k)} L${f1(x - w * 0.7)} ${f1(by - 1 * k)} L${f1(x)} ${f1(ty)} L${f1(x + w * 0.7)} ${f1(by - 1 * k)} L${f1(x + w * 0.55)} ${f1(by - 3 * k)} L${f1(x + w)} ${f1(by)}Z`;
    s += `<path d="${jag}" fill="${g}"/><path d="${jag}" fill="url(#ee-tx-grain)"/><path d="M${f1(x)} ${f1(ty)} L${f1(x + w * 0.7)} ${f1(by - 1 * k)} L${f1(x + w)} ${f1(by)} L${f1(x)} ${f1(by)}Z" fill="#000" opacity=".28"/>`;
  }
  return s;
}
function broadleaf(x, y, k, r) {
  let s = `<ellipse cx="${f1(x + 4 * k)}" cy="${f1(y)}" rx="${f1(13 * k)}" ry="${f1(6 * k)}" fill="url(#ee-shd)"/><rect x="${f1(x - 1.8)}" y="${f1(y - 14 * k)}" width="3.6" height="${f1(14 * k)}" fill="#33261b"/>`;
  const blobs = [[-6, -18, 9], [6, -19, 8], [0, -26, 9], [-3, -14, 7], [5, -13, 6]];
  for (const [dx, dy, rr] of blobs) s += `<circle cx="${f1(x + dx * k)}" cy="${f1(y + dy * k)}" r="${f1(rr * k)}" fill="${r() < 0.5 ? '#2a3524' : '#253020'}"/>`;
  s += `<circle cx="${f1(x - 3 * k)}" cy="${f1(y - 23 * k)}" r="${f1(6 * k)}" fill="#3a4630" opacity=".7"/><circle cx="${f1(x)}" cy="${f1(y - 19 * k)}" r="${f1(14 * k)}" fill="url(#ee-tx-grain)"/>`;
  return s;
}
const DECOR_DRAW = {
  trees: (c, seed = 1) => {
    const r = rand(seed * 977);
    const trees = [[-0.22, -0.12], [0.18, -0.2], [0.2, 0.12], [-0.12, 0.26], [0.02, 0.02]].map(([u, v]) => [u + (r() - 0.5) * 0.08, v + (r() - 0.5) * 0.08, 0.75 + r() * 0.4, r() < 0.35]);
    trees.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    return trees.map(([u, v, k, leafy]) => { const [x, y] = P(u, v); return `<g class="ee-sway" style="transform-origin:${f1(x)}px ${f1(y)}px;animation-delay:-${(r() * 5).toFixed(1)}s">${leafy ? broadleaf(x, y, k, r) : conifer(x, y, k, r)}</g>`; }).join('');
  },
  rocks: (c) => {
    const rk = { l: '#5a5853', r: '#43413d' };
    return pyramid(c, -0.1, -0.05, 0.17, 0, 16, rk) + pyramid(c, 0.2, 0.12, 0.1, 0, 9, rk) + pyramid(c, -0.15, 0.25, 0.07, 0, 6, rk) +
      [[0.25, -0.2], [-0.3, 0.1]].map(([u, v]) => { const [x, y] = P(u, v); return `<path d="M${x - 6} ${y} q2 -6 6 -2 q4 -5 6 2Z" fill="#2c3626"/>`; }).join('');
  },
  campfire: () => {
    const [x, y] = P(0, 0.05);
    const logs = `<g stroke="#3a2a1c" stroke-width="3.4" stroke-linecap="round"><line x1="${x - 9}" y1="${y + 3}" x2="${x + 9}" y2="${y - 3}"/><line x1="${x - 9}" y1="${y - 3}" x2="${x + 9}" y2="${y + 3}"/></g>`;
    const ring = [[-14, 2], [14, 2], [-9, 6], [9, 6], [0, 8], [-9, -3], [9, -3], [0, -5]].map(([dx, dy]) => `<ellipse cx="${x + dx}" cy="${y + dy}" rx="4.5" ry="2.7" fill="#55524f"/>`).join('');
    const seats = box({}, -0.32, 0.05, 0.12, 0.04, 5, 0, WOOD) + box({}, 0.05, -0.3, 0.04, 0.12, 5, 0, WOOD);
    return seats + ring + logs + fire(x, y, 0.9) + smoke(x, y - 22, 3);
  },
};

// ---------- плочки и сцена ----------
export function tile(c, state) {
  const k = 0.44;
  const top = [P(-k, -k), P(k, -k), P(k, k), P(-k, k)];
  if (state === 'empty') {
    return face('#46553a', 'earth', false, ...top) + `<polygon points="${pts(...top)}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.2" stroke-dasharray="5 5"/>`;
  }
  return face(c.ground, 'earth', false, ...top) +
    `<polygon points="${pts(...top)}" fill="none" stroke="#8a857a" stroke-opacity=".28" stroke-width="2"/>` +
    face('#2a2722', 'stone', false, P(-k, k), P(k, k), P(k, k, -4), P(-k, k, -4)) +
    face('#1e1c18', 'stone', false, P(k, k), P(k, -k), P(k, -k, -4), P(k, k, -4));
}

export function scaffold() {
  const posts = [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]];
  const lines = posts.map(([u, v]) => { const [x, y] = P(u, v); return `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x)}" y2="${f1(y - 36)}"/>`; });
  const ring = (z) => `<polygon points="${pts(P(-0.3, -0.3, z), P(0.3, -0.3, z), P(0.3, 0.3, z), P(-0.3, 0.3, z))}" fill="none"/>`;
  const diag = `<line x1="${f1(P(-0.3, 0.3)[0])}" y1="${f1(P(-0.3, 0.3)[1])}" x2="${f1(P(0.3, 0.3, 26)[0])}" y2="${f1(P(0.3, 0.3, 26)[1])}"/>`;
  const sparks = [[-0.1, 0.3, 14], [0.3, 0.05, 22]].map(([u, v, z], i) => { const [x, y] = P(u, v, z); return `<circle class="ee-spark" style="animation-delay:${i * 0.6}s" cx="${f1(x)}" cy="${f1(y)}" r="1.8" fill="#f6bd62"/>`; }).join('');
  return `<g stroke="#8a6a46" stroke-width="2.2" stroke-linecap="round">${lines.join('')}${ring(12)}${ring(26)}${diag}</g>` +
    box({}, 0.2, 0.32, 0.08, 0.04, 6, 0, { top: '#8a6a48', l: '#735638', r: '#5a432c', mat: 'wood' }) + crate(-0.28, 0.34) + sparks;
}

// Мащабът расте леко с нивото – сградите „растат“.
const levelScale = (L) => 0.86 + 0.035 * Math.min(Math.max(L, 1), 8);

// ---------- реалистични сгради (рендирани спрайтове, OpenGameArt) ----------
// w,h – размер; x0..x1 – ширината на самата сграда; by – най-ниската точка на основата (в пиксели);
// size – ширина на сградата в сцената; lights / smoke – прозорци и комини (в пиксели).
const SPR = {
  castle: { w: 500, h: 422, x0: 50, x1: 498, by: 420, size: 124, lights: [[300, 130], [195, 300], [330, 250], [440, 200]], smoke: [[262, 40]] },
  house1: { w: 178, h: 141, x0: 20, x1: 176, by: 139, size: 78, lights: [[60, 85], [130, 95]] },
  house2: { w: 175, h: 140, x0: 13, x1: 172, by: 138, size: 80, lights: [[70, 80], [140, 90]] },
  house3: { w: 178, h: 137, x0: 9, x1: 176, by: 135, size: 82, lights: [[60, 90], [140, 85]] },
  smithy: { w: 305, h: 259, x0: 30, x1: 300, by: 255, size: 92, lights: [[205, 205], [100, 110]], smoke: [[157, 12], [262, 30]] },
  stable: { w: 318, h: 252, x0: 29, x1: 316, by: 250, size: 94, lights: [[150, 120]], smoke: [[208, 12]] },
  barracks: { w: 315, h: 250, x0: 30, x1: 313, by: 248, size: 94, lights: [[180, 90], [240, 120]] },
  herohall: { w: 305, h: 222, x0: 21, x1: 304, by: 220, size: 92, lights: [[240, 80]], smoke: [[247, 15]] },
  'tower-wood': { w: 351, h: 520, x0: 138, x1: 349, by: 501, size: 50, lights: [[245, 150]] },
  'tower-stone': { w: 389, h: 520, x0: 167, x1: 387, by: 516, size: 54, lights: [[280, 120]] },
  academy: { w: 520, h: 414, x0: 152, x1: 517, by: 411, size: 86, lights: [[200, 200], [420, 180], [450, 300]], smoke: [[298, 16]] },
  embassy: { w: 460, h: 310, x0: 79, x1: 457, by: 305, size: 84, lights: [[150, 200], [330, 220], [400, 180]], smoke: [[368, 43]] },
  mill: { w: 460, h: 333, x0: 78, x1: 457, by: 328, size: 84, lights: [[250, 220]], smoke: [[311, 18]] },
  well: { w: 350, h: 378, x0: 74, x1: 346, by: 368, size: 40 },
  // rubberduck (OpenGameArt, CC0)
  temple: { w: 360, h: 380, x0: 1, x1: 344, by: 378, size: 84, lights: [[95, 270], [300, 290], [150, 95]], smoke: [[150, 6]] },
  warehouse: { w: 386, h: 400, x0: 1, x1: 360, by: 398, size: 90, lights: [[160, 300], [330, 320]] },
  guild: { w: 400, h: 397, x0: 2, x1: 367, by: 395, size: 90, lights: [[140, 300], [300, 280], [330, 210]], smoke: [[150, 10]] },
  lumber: { w: 240, h: 189, x0: 1, x1: 226, by: 187, size: 74 },
  cranny: { w: 230, h: 223, x0: 2, x1: 209, by: 221, size: 62 },
};

export function spriteKey(id, L, epoch) {
  switch (id) {
    case 'hall': return 'castle';
    case 'houses': return L >= 7 ? 'house3' : L >= 4 ? 'house2' : 'house1';
    case 'smithy': return 'smithy';
    case 'stable': return 'stable';
    case 'barracks': return 'barracks';
    case 'heroHall': return 'herohall';
    case 'tower': return epoch >= 2 ? 'tower-stone' : 'tower-wood';
    case 'academy': return 'academy';
    case 'embassy': return 'embassy';
    case 'farm': return 'mill';
    case 'temple': return 'temple';
    case 'warehouse': return 'warehouse';
    case 'lumber': return 'lumber';
    case 'cranny': return 'cranny';
    default: return null;
  }
}

function spriteFit(key, mul = 1, ox = 0, oy = 26) {
  const s = SPR[key];
  const k = (s.size * mul) / (s.x1 - s.x0);
  return { s, k, x: ox - ((s.x0 + s.x1) / 2) * k, y: oy - s.by * k };
}

function spriteImg(key, race, mul = 1, ox, oy) {
  const { s, k, x, y } = spriteFit(key, mul, ox, oy);
  const filt = race && race !== 'humans' ? ` filter="url(#ee-t-${race})"` : '';
  let out = `<image href="assets/empires/${key}.png" x="${f1(x)}" y="${f1(y)}" width="${f1(s.w * k)}" height="${f1(s.h * k)}"${filt}/>`;
  if (key === 'mill') {
    // колелото на воденицата се върти (5 кадъра)
    const wx = x + 330 * k, wy = y + 170 * k;
    out += `<g class="ee-wheel"${filt}>${[0, 1, 2, 3, 4].map((i) => `<image href="assets/empires/mill-wheel${i}.png" x="${f1(wx)}" y="${f1(wy)}" width="${f1(166 * k)}" height="${f1(141 * k)}" style="animation-delay:${(-i * 0.24).toFixed(2)}s"/>`).join('')}</g>`;
  }
  for (const [px, py] of s.smoke || []) out += smoke(x + px * k, y + py * k, 3);
  return out;
}

// Светлините на сградата (за нощта) – в координатите на парцела.
export function buildingLights(id, L, epoch, race) {
  const key = id === 'unique' ? (race === 'humans' ? 'guild' : race === 'vesheri' ? 'tower-stone' : null) : spriteKey(id, L, epoch);
  if (!key) return [];
  const { s, k, x, y } = spriteFit(key, id === 'unique' && race === 'vesheri' ? 1.15 : spriteMul(id, L));
  return (s.lights || []).map(([px, py]) => [x + px * k, y + py * k]);
}

const glowAtPx = (x, y, r) => `<g class="ee-pulse">${halo(x, y, r, 'mana')}</g>`;
const spriteMul = (id, L) => (id === 'hall' ? 0.82 + 0.03 * Math.min(L, 10) : 0.92 + 0.02 * Math.min(L, 8));

export function buildingSvg(id, race, L, epoch = 1) {
  if (id === 'unique' && race === 'humans') return spriteImg('guild', race, spriteMul(id, L));
  if (id === 'unique' && race === 'vesheri') return spriteImg('tower-stone', 'vesheri-arcane', 1.15) + glowAtPx(0, -78, 26);
  const key = spriteKey(id, L, epoch);
  if (key) {
    // дъскорезницата: навес с трупи около него
    const extra = id === 'lumber' ? logPile(0.18, 0.28) + logPile(-0.34, 0.2) : '';
    return spriteImg(key, race, spriteMul(id, L)) + extra;
  }
  const sc = levelScale(L);
  return shadow(48 * sc, 22 * sc) + `<g transform="scale(${sc.toFixed(3)})">${DRAW[id](pal(race, epoch), race, L)}</g>`;
}

export const decorSvg = (kind, race, seed, epoch = 1) => (kind === 'well' ? spriteImg('well', null, 1, 4, 18) : DECOR_DRAW[kind](pal(race, epoch), seed));

// Самостоятелна картинка на сграда (прозорец, списък).
export function buildingPicture(id, race, L, epoch = 1) {
  const c = pal(race, epoch);
  return `<svg viewBox="-82 -138 164 178" class="ee-pic">${defs(c)}${tile(c, 'built')}${buildingSvg(id, race, Math.max(1, L), epoch)}</svg>`;
}

// Палисада (епоха 1) или каменна стена (епоха 2+) по ръб на града.
function wallSegment(c, epoch, u1, v1, u2, v2) {
  const len = Math.hypot(u2 - u1, v2 - v1);
  const alongU = Math.abs(u2 - u1) > Math.abs(v2 - v1);
  if (epoch >= 2) {
    const cu = (u1 + u2) / 2, cv = (v1 + v2) / 2;
    const a = alongU ? len / 2 : 0.05, b = alongU ? 0.05 : len / 2;
    const stone = { top: '#86817a', l: '#6e6a63', r: '#56534d', tex: 'brick' };
    const wh = epoch >= 3 ? 22 : 16;
    let s = box(c, cu, cv, a, b, wh, 0, stone);
    const n = Math.floor(len / 0.16);
    for (let i = 0; i <= n; i += 2) {
      const t = i / n;
      s += box(c, u1 + (u2 - u1) * t, v1 + (v2 - v1) * t, 0.035, 0.035, 5, wh, stone);
    }
    return s;
  }
  let s = '';
  const n = Math.round(len / 0.1);
  const r = rand(Math.round((u1 + v1 * 7 + u2 * 13) * 100));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = u1 + (u2 - u1) * t, v = v1 + (v2 - v1) * t;
    const h = 12 + r() * 4;
    s += tower({}, u, v, 0.038, h, 0, { wall: r() < 0.5 ? '#54402e' : '#4a3828', top: '#6e5238', cone: false, mat: 'wood' }) +
      poly('#5c4630', P(u - 0.038, v, h), P(u + 0.038, v, h), P(u, v, h + 5));
  }
  // напречна греда
  const [ax, ay] = P(u1, v1, 8), [bx, by] = P(u2, v2, 8);
  s += `<line x1="${f1(ax)}" y1="${f1(ay)}" x2="${f1(bx)}" y2="${f1(by)}" stroke="#3a2a1c" stroke-width="2.4" stroke-opacity=".8"/>`;
  return s;
}

// Наблюдателна кула: дървена в епоха 1, каменна след това.
function watchtower(c, epoch, u, v, withFlag) {
  if (epoch >= 2) {
    if (epoch >= 3) return tower(c, u, v, 0.15, 44, 0, { wall: '#6e6a63', top: '#86817a', merlons: false, slate: true, roof: '#3d4147', dark: '#2b2e33' }) + (withFlag ? flag(u, v, 44 + 0.15 * TW * 1.9, c.banner) : '');
    return tower(c, u, v, 0.13, 34, 0, { wall: '#6e6a63', top: '#86817a', merlons: true, cone: false }) + (withFlag ? flag(u, v, 34, c.banner) : '');
  }
  let s = '';
  for (const [du, dv] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) s += box(c, u + du, v + dv, 0.015, 0.015, 30, 0, WOOD);
  s += box(c, u, v, 0.11, 0.11, 3, 30, WOOD) + box(c, u, v, 0.1, 0.1, 6, 33, { ...WOOD, tex: 'plank' });
  s += pyramid(c, u, v, 0.13, 39, 14, { l: c.roof1 ? c.roof : '#6b5a3c', r: c.roofD, mat: 'thatch' });
  return s + (withFlag ? flag(u, v, 53, c.banner, 0.9) : '');
}

// ---------- ден и нощ ----------
// [час, небе отгоре, хоризонт, цвят на сумрака, сила на сумрака, звезди, светлини]
const LIGHT = [
  [0, '#05070b', '#121828', '#16224a', 0.55, 1, 1],
  [5, '#070a12', '#1c2232', '#16224a', 0.5, 0.8, 1],
  [6.2, '#2b3550', '#c98a5a', '#c87a4a', 0.28, 0.2, 0.6],
  [7.5, '#4f7396', '#c9d6dc', '#ffffff', 0, 0, 0],
  [17.5, '#4f7396', '#d6d0c0', '#ffffff', 0, 0, 0],
  [19, '#3a3f5c', '#d9864e', '#c0603a', 0.25, 0.1, 0.5],
  [20.5, '#121628', '#3a2a3a', '#1c2a5a', 0.45, 0.6, 0.9],
  [24, '#05070b', '#121828', '#16224a', 0.55, 1, 1],
];
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
export function lightAt(h) {
  let i = 0;
  while (i < LIGHT.length - 2 && LIGHT[i + 1][0] <= h) i++;
  const [h0, t0, z0, a0, s0, st0, g0] = LIGHT[i], [h1, t1, z1, a1, s1, st1, g1] = LIGHT[i + 1];
  const t = Math.min(1, Math.max(0, (h - h0) / (h1 - h0)));
  const L = (p, q) => p + (q - p) * t;
  const amb = L(s0, s1);
  return { top: mix(t0, t1, t), hor: mix(z0, z1, t), ambC: mix(a0, a1, t), amb, stars: L(st0, st1), glow: L(g0, g1), day: Math.max(0, 1 - amb / 0.5) };
}

// Живот по улиците: хора, каруци, птици, облаци, време.
function streetLife(r, N, people, lt, P0) {
  let s = '';
  const lines = [];
  for (let k = 0; k < N - 1; k++) {
    lines.push([[k + 0.5, -0.55], [k + 0.5, N - 0.45]]);
    lines.push([[-0.55, k + 0.5], [N - 0.45, k + 0.5]]);
  }
  const front = [[[-0.55, N - 0.45], [N - 0.45, N - 0.45]], [[N - 0.45, -0.55], [N - 0.45, N - 0.45]]];
  let back = '';
  const cloth = ['#9a4a32', '#4e6a8a', '#8a8a4a', '#6a4a7a', '#b09060', '#4e6e4e', '#c0b098', '#7a2a2a'];
  const n = Math.round(people * (0.35 + 0.65 * lt.day));
  for (let i = 0; i < n; i++) {
    const onFront = i % 2 === 0;
    const [a, b] = onFront ? front[Math.floor(r() * 2)] : lines[Math.floor(r() * lines.length)];
    const t0 = 0.1 + r() * 0.8;
    const off = (r() - 0.5) * 0.06;
    const pa = P0(a[0] + off, a[1] + off), pb = P0(b[0] + off, b[1] + off);
    const dur = (30 + r() * 40).toFixed(1);
    const col = cloth[Math.floor(r() * cloth.length)];
    const torch = lt.glow > 0.5 && r() < 0.5 ? `<circle cy="-8" r="6" fill="url(#ee-g-fire)"/><circle cx="2" cy="-7" r="0.9" fill="#ffc56b"/>` : '';
    const fig = `<g class="ee-walker"><g transform="scale(1.8)"><ellipse rx="2.4" ry="1" fill="#000" opacity=".35"/>${torch}<path d="M-1.6 0 L-1.3 -4.6 Q0 -6 1.3 -4.6 L1.6 0Z" fill="${col}"/><circle cy="-6.4" r="1.25" fill="#c9a88c"/></g>
      <animateMotion dur="${dur}s" begin="-${(r() * 60).toFixed(1)}s" repeatCount="indefinite" path="M${f1(pa[0])} ${f1(pa[1])} L${f1(pb[0])} ${f1(pb[1])} L${f1(pa[0])} ${f1(pa[1])}"/></g>`;
    if (onFront) s += fig; else back += fig;
  }
  // каруци по околовръстната улица
  for (let i = 0; i < Math.min(2, Math.ceil(people / 6)); i++) {
    const [a, b] = front[i];
    const pa = P0(...a), pb = P0(...b);
    s += `<g><ellipse cx="0" cy="1" rx="9" ry="2.5" fill="#000" opacity=".35"/><path d="M-12 -3 l3 -6 l3 1 l-1 5Z" fill="#5a4030"/><rect x="-7" y="-7" width="13" height="5" fill="#6e5238"/><rect x="-6" y="-9.5" width="11" height="3" fill="#a08a50"/>
      <circle cx="-4" cy="-1.5" r="2.2" fill="none" stroke="#3a2a1c" stroke-width="1.2"/><circle cx="3.5" cy="-1.5" r="2.2" fill="none" stroke="#3a2a1c" stroke-width="1.2"/>
      <animateMotion dur="${(90 + r() * 40).toFixed(0)}s" begin="-${(r() * 90).toFixed(0)}s" repeatCount="indefinite" path="M${f1(pa[0])} ${f1(pa[1])} L${f1(pb[0])} ${f1(pb[1])} L${f1(pa[0])} ${f1(pa[1])}"/></g>`;
  }
  return { front: s, back };
}

function sky(r, lt, weather) {
  let s = '';
  const stars = Array.from({ length: 40 }, () => `<circle cx="${f1(-320 + r() * 640)}" cy="${f1(-170 + r() * 110)}" r="${(0.4 + r() * 0.8).toFixed(1)}" fill="#dfe6f2" opacity="${((0.2 + r() * 0.5) * lt.stars).toFixed(2)}"/>`).join('');
  if (lt.stars > 0.05) s += stars;
  return s;
}

/**
 * Цялата сцена на града. cells: [{ i, j, html, label, bid, L }] – съдържанието на всеки парцел
 * (вече нарисувано от интерфейса); label (нивото, таймерът) се рисува най-отгоре.
 * hour – часът (0–24), weather – 'clear' | 'rain' | 'snow', people – колко хора по улиците.
 */
export function sceneSvg({ race, epoch, cells, wall = 1, traps = 0, hour = 12, weather = 'clear', people = 6 }) {
  const c = pal(race, epoch);
  const r = rand(race.length * 131 + epoch);
  const lr = rand(Math.floor(hour * 7) + 11);
  const lt = lightAt(hour);
  if (weather !== 'clear') { lt.amb = Math.min(0.6, lt.amb + 0.12); lt.day = Math.max(0, 1 - lt.amb / 0.5); }
  const N = GRID, M = (N - 1) / 2;
  const E0 = -0.75, E1 = N - 0.25;
  const D = lt.day;
  // небе: слънце/луна, облаци, планини
  const ridge = (base, amp, step, fill) => {
    let d = `M-340 ${base}`;
    for (let x = -340; x <= 340; x += step) d += ` L${x} ${f1(base - amp * (0.3 + 0.7 * r()))}`;
    return `<path d="${d} L340 ${base + 600} L-340 ${base + 600}Z" fill="${fill}"/>`;
  };
  let celestial = '';
  if (hour >= 6 && hour <= 19.5) {
    const t = (hour - 6) / 13.5;
    const sx = -270 + 540 * t, sy = -40 - 110 * Math.sin(Math.PI * t);
    celestial = `<circle cx="${f1(sx)}" cy="${f1(sy)}" r="60" fill="url(#ee-g-sun)"/><circle cx="${f1(sx)}" cy="${f1(sy)}" r="11" fill="#fff6dc"/>`;
  } else {
    const t = ((hour + 24 - 19.5) % 24) / 10.5;
    const mx = -270 + 540 * t, my = -50 - 100 * Math.sin(Math.PI * t);
    celestial = `${halo(mx, my, 80, 'moon')}<circle cx="${f1(mx)}" cy="${f1(my)}" r="12" fill="#e4e8ef"/><circle cx="${f1(mx - 4)}" cy="${f1(my - 3)}" r="3" fill="#cdd2db"/><circle cx="${f1(mx + 5)}" cy="${f1(my + 4)}" r="2" fill="#cdd2db"/>`;
  }
  const cloudCol = mix('#2a3040', '#f4f2ec', D);
  const cloudA = weather === 'clear' ? 0.35 : 0.6;
  const clouds = Array.from({ length: weather === 'clear' ? 4 : 7 }, (_, i) => {
    const y = -150 + r() * 70, w = 70 + r() * 80, dur = 160 + r() * 120;
    return `<g opacity="${cloudA}"><ellipse cx="0" cy="${f1(y)}" rx="${f1(w)}" ry="${f1(w * 0.18)}" fill="${cloudCol}" filter="url(#ee-soft)"/><ellipse cx="${f1(w * 0.3)}" cy="${f1(y - w * 0.1)}" rx="${f1(w * 0.5)}" ry="${f1(w * 0.16)}" fill="${cloudCol}" filter="url(#ee-soft)"/>
      <animateTransform attributeName="transform" type="translate" from="-460 0" to="460 0" dur="${f1(dur)}s" begin="-${f1(r() * dur)}s" repeatCount="indefinite"/></g>`;
  }).join('');
  const skyLayer = `<rect x="-420" y="-420" width="840" height="940" fill="url(#ee-sky)"/>${sky(lr, lt, weather)}${celestial}${clouds}
    ${ridge(-34, 70, 24, 'url(#ee-mtn1)')}<rect x="-420" y="-70" width="840" height="70" fill="url(#ee-haze)"/>${ridge(-6, 42, 16, 'url(#ee-mtn2)')}`;
  // птици (денем)
  const birds = D > 0.3 && weather === 'clear' ? Array.from({ length: 4 }, () => {
    const y = -150 + r() * 80, dur = 28 + r() * 20, sc = 0.8 + r() * 0.5;
    return `<g><path d="M-4 0 Q-2 -2.5 0 0 Q2 -2.5 4 0" stroke="#1d1d22" stroke-width="1.1" fill="none" transform="scale(${sc.toFixed(2)})"><animate attributeName="d" values="M-4 0 Q-2 -2.5 0 0 Q2 -2.5 4 0;M-4 -1.5 Q-2 1 0 0 Q2 1 4 -1.5;M-4 0 Q-2 -2.5 0 0 Q2 -2.5 4 0" dur="${(0.5 + r() * 0.3).toFixed(2)}s" repeatCount="indefinite"/></path>
      <animateMotion dur="${f1(dur)}s" begin="-${f1(r() * dur)}s" repeatCount="indefinite" path="M-380 ${f1(y)} C -150 ${f1(y - 30)} 150 ${f1(y + 30)} 380 ${f1(y - 10)}"/></g>`;
  }).join('') : '';
  // платформа, трева, улици (дневни цветове – нощта е сумрак отгоре)
  const corner = (u, v, z = 0) => P(u, v, z);
  const g = [corner(E0, E0), corner(E1, E0), corner(E1, E1), corner(E0, E1)];
  let ground = face('#3a4a2a', 'earth', false, ...g) +
    face('#3a2e22', 'earth', true, corner(E0, E1), corner(E1, E1), corner(E1, E1, -26), corner(E0, E1, -26)) +
    face('#2a2219', 'earth', true, corner(E1, E1), corner(E1, E0), corner(E1, E0, -26), corner(E1, E1, -26));
  const road = (u1, v1, u2, v2) => face('#6a6253', 'stone', false, P(u1, v1), P(u2, v1), P(u2, v2), P(u1, v2));
  const RE = N - 0.4;
  for (let k = 0; k < N - 1; k++) ground += road(k + 0.44, -0.6, k + 0.56, RE) + road(-0.6, k + 0.44, RE, k + 0.56);
  ground += road(-0.6, -0.6, RE, -0.5) + road(-0.6, N - 0.5, RE, RE) + road(-0.6, -0.6, -0.5, RE) + road(N - 0.5, -0.6, RE, RE);
  let cobble = '';
  for (let k = 0; k < N - 1; k++) for (let t = -0.55; t < N - 0.45; t += 0.07) {
    for (const [u, v] of [[k + 0.47 + r() * 0.06, t], [t, k + 0.47 + r() * 0.06]]) {
      const [x, y] = P(u, v);
      cobble += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="1.8" ry="1" fill="${r() < 0.5 ? '#7d7466' : '#4e483f'}"/>`;
    }
  }
  ground += `<g opacity=".7">${cobble}</g>`;
  for (let i = 0; i < 70; i++) {
    const u = E0 + 0.05 + r() * (E1 - E0 - 0.1), v = E0 + 0.05 + r() * (E1 - E0 - 0.1);
    if (u > -0.6 && u < RE && v > -0.6 && v < RE) continue;
    const [x, y] = P(u, v);
    ground += `<path d="M${f1(x - 3)} ${f1(y)} l1.5 -5 l1.5 5 l1.5 -6 l1.5 6Z" fill="${r() < 0.5 ? '#4f6236' : '#43552e'}"/>`;
  }
  if (weather === 'snow') ground += `<polygon points="${pts(...g)}" fill="#e8eef4" opacity=".35"/>`;
  // сенки от облаците (денем)
  const cloudShadows = D > 0.2 ? Array.from({ length: 3 }, () => {
    const dur = 140 + r() * 80;
    return `<ellipse cx="0" cy="${f1(40 + r() * 150)}" rx="${f1(70 + r() * 50)}" ry="${f1(26 + r() * 14)}" fill="#000" opacity="${(0.1 * D).toFixed(2)}" filter="url(#ee-soft)"><animateTransform attributeName="transform" type="translate" from="-460 0" to="460 0" dur="${f1(dur)}s" begin="-${f1(r() * dur)}s" repeatCount="indefinite"/></ellipse>`;
  }).join('') : '';
  // стени
  const W = -0.68, Wf = N - 0.32;
  const wEp = wall ? Math.min(3, epoch) : 1;
  const marker = (u, v) => box(c, u, v, 0.03, 0.03, 9, 0, WOOD);
  const backWalls = wall
    ? watchtower(c, wEp, W, W) + wallSegment(c, wEp, W, W, Wf, W) + wallSegment(c, wEp, W, W, W, Wf) + watchtower(c, wEp, Wf, W, true) + watchtower(c, wEp, W, Wf, true)
    : marker(W, W) + marker(Wf, W) + marker(W, Wf);
  const post = epoch >= 2 ? { top: '#86817a', l: '#6e6a63', r: '#56534d', tex: 'brick' } : WOOD;
  const [g1x, g1y] = P(M - 0.25, Wf, 24), [g2x, g2y] = P(M + 0.25, Wf, 24);
  const gate = box(c, M - 0.25, Wf, 0.06, 0.06, 26, 0, post) + box(c, M + 0.25, Wf, 0.06, 0.06, 26, 0, post) +
    `<line x1="${f1(g1x)}" y1="${f1(g1y)}" x2="${f1(g2x)}" y2="${f1(g2y)}" stroke="${epoch >= 2 ? '#6e6a63' : '#4a3828'}" stroke-width="5"/>` +
    fire(...P(M - 0.25, Wf, 26), 0.3) + fire(...P(M + 0.25, Wf, 26), 0.3);
  let spikes = '';
  if (traps) {
    const n = Math.min(14, 4 + traps * 2);
    for (let i = 0; i < n; i++) {
      const u = M - 0.9 + (i / (n - 1)) * 1.8 + (i % 2) * 0.03, v = Wf + 0.16 + (i % 2) * 0.07;
      const [x, y] = P(u, v);
      spikes += `<line x1="${f1(x - 3)}" y1="${f1(y + 1)}" x2="${f1(x + 2)}" y2="${f1(y - 9)}" stroke="#5a4430" stroke-width="1.8" stroke-linecap="round"/><line x1="${f1(x + 3)}" y1="${f1(y + 1)}" x2="${f1(x - 1)}" y2="${f1(y - 8)}" stroke="#4a3828" stroke-width="1.6" stroke-linecap="round"/>`;
    }
    const [px, py] = P(M, Wf + 0.32);
    spikes += `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="14" ry="6" fill="#120d09"/>`;
  }
  const frontWalls = (wall
    ? wallSegment(c, wEp, W, Wf, M - 0.33, Wf) + wallSegment(c, wEp, M + 0.33, Wf, Wf, Wf) + gate + wallSegment(c, wEp, Wf, W, Wf, Wf) + watchtower(c, wEp, Wf, Wf, true)
    : marker(Wf, Wf)) + spikes;
  // време
  let precip = '';
  if (weather === 'rain') precip = `<g class="ee-rain" stroke="#a9b8c8" stroke-opacity=".5" stroke-width="1">${Array.from({ length: 90 }, () => { const x = -340 + r() * 680, y = -200 + r() * 520; return `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x - 3)}" y2="${f1(y + 12)}" style="animation-delay:-${(r() * 0.8).toFixed(2)}s"/>`; }).join('')}</g>`;
  if (weather === 'snow') precip = `<g class="ee-snow" fill="#fff">${Array.from({ length: 80 }, () => { const x = -340 + r() * 680, y = -200 + r() * 520; return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${(0.8 + r() * 1.2).toFixed(1)}" opacity=".8" style="animation-delay:-${(r() * 8).toFixed(1)}s"/>`; }).join('')}</g>`;
  // сумрак и светлини
  const dusk = lt.amb > 0.01 ? `<rect x="-420" y="-420" width="840" height="940" fill="${lt.ambC}" opacity="${lt.amb.toFixed(2)}" style="mix-blend-mode:multiply" pointer-events="none"/>` : '';
  let lights = '';
  if (lt.glow > 0.05) {
    for (const cell of cells) {
      const [cx, cy] = P(cell.i, cell.j);
      for (const [lx, ly] of cell.lights || []) lights += `<circle cx="${f1(cx + lx)}" cy="${f1(cy + ly)}" r="9" fill="url(#ee-g-race)"/><circle cx="${f1(cx + lx)}" cy="${f1(cy + ly)}" r="1.6" fill="${c.glow}"/>`;
    }
    for (const [u, v] of [[M - 0.25, Wf], [M + 0.25, Wf]]) { const [x, y] = P(u, v, 30); lights += halo(x, y, 30, 'fire'); }
    lights = `<g opacity="${lt.glow.toFixed(2)}" pointer-events="none">${lights}</g>`;
  }
  const extra = `<defs><linearGradient id="ee-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lt.top}"/><stop offset=".55" stop-color="${lt.hor}"/><stop offset="1" stop-color="${mix('#07080a', '#5a6a5a', D)}"/></linearGradient>
    <linearGradient id="ee-mtn1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix('#232838', '#7a8aa0', D)}"/><stop offset=".25" stop-color="${mix('#121521', '#4c5a6a', D)}"/></linearGradient>
    <linearGradient id="ee-mtn2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix('#151820', '#4a5a48', D)}"/><stop offset=".15" stop-color="${mix('#0b0c10', '#2e3a2c', D)}"/><stop offset="1" stop-color="#050506"/></linearGradient>
    <linearGradient id="ee-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8c4d0" stop-opacity="0"/><stop offset="1" stop-color="#b8c4d0" stop-opacity="${(0.08 + 0.2 * D).toFixed(2)}"/></linearGradient>
    <radialGradient id="ee-g-sun"><stop offset="0" stop-color="#fff2c8" stop-opacity=".9"/><stop offset=".3" stop-color="#ffd890" stop-opacity=".35"/><stop offset="1" stop-color="#ffd890" stop-opacity="0"/></radialGradient>
    <filter id="ee-soft" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="6"/></filter>
    <radialGradient id="ee-fog"><stop offset="0" stop-color="#b0bccb" stop-opacity="${(0.08 + (weather !== 'clear' ? 0.12 : 0)).toFixed(2)}"/><stop offset="1" stop-color="#b0bccb" stop-opacity="0"/></radialGradient>
    <radialGradient id="ee-vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${(0.7 - 0.35 * D).toFixed(2)}"/></radialGradient></defs>`;
  const body = cells.map((cell) => {
    const [x, y] = P(cell.i, cell.j);
    return `<g transform="translate(${f1(x)} ${f1(y)})" ${cell.attrs || ''}>${cell.html}</g>`;
  }).join('');
  const labels = cells.filter((cell) => cell.label).map((cell) => {
    const [x, y] = P(cell.i, cell.j);
    return `<g transform="translate(${f1(x)} ${f1(y)})" pointer-events="none">${cell.label}</g>`;
  }).join('');
  const life = streetLife(rand(Math.floor(hour) + 7), N, people, lt, (u, v) => P(u, v));
  const overlay = `<g pointer-events="none"><ellipse cx="0" cy="240" rx="440" ry="90" fill="url(#ee-fog)"/><rect x="-420" y="-420" width="840" height="940" fill="url(#ee-vig)"/></g>`;
  return `<svg viewBox="-330 -175 660 495" preserveAspectRatio="xMidYMid slice">${defs(c)}${extra}${skyLayer}${birds}${ground}${cloudShadows}${backWalls}<g pointer-events="none">${life.back}</g>${body}<g pointer-events="none">${life.front}</g>${frontWalls}${precip}${dusk}${lights}${overlay}${labels}</svg>`;
}

export const ISO = { TW, TH, P };

// ---------- варварски лагер ----------
export function campSvg(lvl, { boss = false, down = false } = {}) {
  const r = rand(lvl * 31 + (boss ? 7 : 0));
  const tents = Math.min(4, 1 + Math.ceil(lvl / 2));
  const tent = (x, y, s, col) => `<path d="M${x - 14 * s} ${y} L${x} ${y - 19 * s} L${x + 14 * s} ${y}Z" fill="${col}"/><path d="M${x - 14 * s} ${y} L${x} ${y - 19 * s} L${x + 14 * s} ${y}Z" fill="url(#ee-tx-wood)"/><path d="M${x} ${y - 19 * s} L${x + 14 * s} ${y} L${x + 3 * s} ${y}Z" fill="#000" opacity=".3"/><path d="M${x - 3 * s} ${y} L${x} ${y - 8 * s} L${x + 3 * s} ${y}Z" fill="#120c08"/><line x1="${x}" y1="${y - 19 * s}" x2="${x - 2 * s}" y2="${y - 23 * s}" stroke="#3a2a1c"/><line x1="${x}" y1="${y - 19 * s}" x2="${x + 2 * s}" y2="${y - 23 * s}" stroke="#3a2a1c"/>`;
  const cols = ['#7a6a52', '#6a5640', '#5c4a38', '#806c50'];
  let s = `<ellipse cx="50" cy="56" rx="47" ry="14" fill="#241c14"/><ellipse cx="50" cy="56" rx="47" ry="14" fill="url(#ee-tx-ground)"/>`;
  for (let i = 0; i < 9; i++) s += `<path d="M${8 + i * 10.5} 60 l1.6 -11 l1.6 11Z" fill="#4a3828"/>`;
  for (let i = 0; i < tents; i++) s += tent(tents === 1 ? 50 : 18 + (i * 64) / (tents - 1), 50 - (i % 2) * 5, 0.85 + r() * 0.3, cols[i % cols.length]);
  if (boss) s += tent(50, 44, 1.5, '#5a2a26') + `<line x1="80" y1="54" x2="80" y2="20" stroke="#3a2a1c" stroke-width="2"/><circle cx="80" cy="18" r="4.5" fill="#cfc8b8"/><circle cx="78.6" cy="17.5" r="1.1" fill="#111"/><circle cx="81.4" cy="17.5" r="1.1" fill="#111"/>`;
  s += down
    ? `<g opacity=".6"><circle cx="50" cy="38" r="8" fill="#4a4a4e"/><circle cx="56" cy="30" r="10" fill="#3c3c40"/></g>`
    : fire(50, 57, 0.75);
  s += `<line x1="22" y1="50" x2="22" y2="22" stroke="#3a2a1c" stroke-width="1.6"/><path class="ee-flag" d="M22 22 L35 25 L34 30 L22 31Z" fill="${boss ? '#7a1f26' : '#6a3a2a'}"/>`;
  return `<svg viewBox="0 0 100 70" class="ee-campart${down ? ' down' : ''}">${defs(PALETTE.orcs)}${s}</svg>`;
}

// ---------- емблеми на расите ----------
export function emblem(race, size = 56) {
  const c = BASE[race];
  const accent = { humans: '#e2b553', undead: '#7fd7a0', orcs: '#e0623f', vesheri: '#b39ae6' }[race];
  const id = `em-${race}`;
  const shield = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2622"/><stop offset="1" stop-color="#0c0a0a"/></linearGradient>
    <linearGradient id="${id}-m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="${accent}"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient></defs>
    <path d="M50 6 L88 18 L84 58 Q78 84 50 96 Q22 84 16 58 L12 18Z" fill="url(#${id})" stroke="${accent}" stroke-width="4"/>
    <path d="M50 13 L81 23 L78 57 Q73 78 50 88" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="2"/>`;
  const a = accent;
  const sym = {
    humans: `<path d="M28 60 L32 34 L41 46 L50 28 L59 46 L68 34 L72 60Z" fill="${a}"/><rect x="28" y="62" width="44" height="7" rx="2" fill="${a}"/><circle cx="50" cy="26" r="3" fill="${a}"/>`,
    undead: `<path d="M50 26 C32 26 28 42 30 52 C31 58 36 60 36 66 L64 66 C64 60 69 58 70 52 C72 42 68 26 50 26Z" fill="${a}"/><circle cx="41" cy="48" r="6" fill="#141016"/><circle cx="59" cy="48" r="6" fill="#141016"/><path d="M47 58 L50 52 L53 58Z" fill="#141016"/><path d="M38 66 L62 66 L60 74 L40 74Z" fill="${a}" opacity=".85"/><g stroke="#141016" stroke-width="2.5"><line x1="44" y1="66" x2="44" y2="74"/><line x1="50" y1="66" x2="50" y2="74"/><line x1="56" y1="66" x2="56" y2="74"/></g>`,
    orcs: `<g stroke="${a}" stroke-width="5" stroke-linecap="round"><line x1="32" y1="76" x2="68" y2="30"/><line x1="68" y1="76" x2="32" y2="30"/></g><path d="M62 24 Q80 30 74 46 Q66 38 58 34Z" fill="${a}"/><path d="M38 24 Q20 30 26 46 Q34 38 42 34Z" fill="${a}"/>`,
    vesheri: `<path d="M22 52 Q50 24 78 52 Q50 80 22 52Z" fill="none" stroke="${a}" stroke-width="4"/><circle cx="50" cy="52" r="10" fill="${a}"/><circle cx="50" cy="52" r="4" fill="#141016"/><g fill="${a}"><path d="M50 14 L53 24 L50 30 L47 24Z"/><path d="M50 74 L53 82 L50 88 L47 82Z"/></g>`,
  }[race];
  void c;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="ee-emblem">${shield}${sym}</svg>`;
}

// ---------- иконки на ресурси ----------
export const RES_ICON = {
  gold: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="15" rx="8" ry="3.5" fill="#a87d1f"/><rect x="4" y="9" width="16" height="6" fill="#a87d1f"/><ellipse cx="12" cy="9" rx="8" ry="3.5" fill="#f2c14e"/><ellipse cx="12" cy="9" rx="4.5" ry="1.8" fill="none" stroke="#a87d1f" stroke-width="1.2"/></svg>',
  wood: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="16" height="8" rx="4" fill="#8b5e34"/><ellipse cx="19" cy="12" rx="3" ry="4" fill="#d9a86a"/><ellipse cx="19" cy="12" rx="1.4" ry="2" fill="none" stroke="#8b5e34"/></svg>',
  stone: '<svg viewBox="0 0 24 24"><path d="M4 17 L7 8 L14 5 L20 10 L19 18 Z" fill="#8e8b93"/><path d="M14 5 L20 10 L19 18 L13 14Z" fill="#67646d"/></svg>',
  food: '<svg viewBox="0 0 24 24"><path d="M12 21 V8" stroke="#c9a23a" stroke-width="2"/><g fill="#e8c35a"><ellipse cx="9.5" cy="9" rx="2.2" ry="3.4" transform="rotate(-25 9.5 9)"/><ellipse cx="14.5" cy="9" rx="2.2" ry="3.4" transform="rotate(25 14.5 9)"/><ellipse cx="9.5" cy="14" rx="2.2" ry="3.4" transform="rotate(-25 9.5 14)"/><ellipse cx="14.5" cy="14" rx="2.2" ry="3.4" transform="rotate(25 14.5 14)"/><ellipse cx="12" cy="5" rx="2" ry="3"/></g></svg>',
  bones: '<svg viewBox="0 0 24 24"><g fill="#e6e1d3"><rect x="6" y="10.5" width="12" height="3" rx="1.5" transform="rotate(-35 12 12)"/><circle cx="6.5" cy="15" r="2.3"/><circle cx="5" cy="12.6" r="2.3"/><circle cx="17.5" cy="9" r="2.3"/><circle cx="19" cy="11.4" r="2.3"/></g></svg>',
  mana: '<svg viewBox="0 0 24 24"><path d="M12 2 L18 10 L12 22 L6 10Z" fill="#9f6bff"/><path d="M12 2 L18 10 L12 22Z" fill="#6c3fd1"/><path d="M6 10 L18 10" stroke="#d7c2ff" stroke-width=".8"/></svg>',
  souls: '<svg viewBox="0 0 24 24"><path d="M12 3 C16 8 19 11 19 15 A7 7 0 0 1 5 15 C5 11 9 9 10 5 C11 8 12 9 12 3Z" fill="#5fe3d0"/><path d="M12 11 C14 13 15 14 15 16 A3 3 0 0 1 9 16 C9 14 11 13 12 11Z" fill="#c9fff6"/></svg>',
  pop: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.4" fill="#cfd3da"/><path d="M2.5 20 C3 14 15 14 15.5 20Z" fill="#cfd3da"/><circle cx="16.5" cy="9" r="2.8" fill="#8d8d99"/><path d="M15 14.5 C19 13.8 22 16 21.5 20 L17 20 C17 18 16.5 16 15 14.5Z" fill="#8d8d99"/></svg>',
};
export const resIcon = (race, r) => RES_ICON[r === 'food' && race === 'undead' ? 'bones' : r];

// ---------- иконки на единиците (по клас) ----------
const UNIT_GLYPH = {
  inf: '<path d="M20 8 L24 8 L24 26 L28 26 L28 30 L24 30 L24 36 L20 36 L20 30 L16 30 L16 26 L20 26Z" fill="#e4e6ea"/><path d="M22 4 L24 8 L20 8Z" fill="#e4e6ea"/>',
  spear: '<line x1="12" y1="36" x2="31" y2="9" stroke="#a5835a" stroke-width="3" stroke-linecap="round"/><path d="M34 4 L35 14 L27 9Z" fill="#e4e6ea"/>',
  ranged: '<path d="M14 6 Q34 22 14 38" fill="none" stroke="#a5835a" stroke-width="3"/><line x1="14" y1="6" x2="14" y2="38" stroke="#e4e6ea" stroke-width="1.2"/><line x1="10" y1="22" x2="33" y2="22" stroke="#e4e6ea" stroke-width="2"/><path d="M36 22 L30 18 L30 26Z" fill="#e4e6ea"/>',
  cav: '<path d="M10 34 L14 24 Q12 14 20 8 L24 4 L26 9 Q33 12 34 20 L30 22 Q27 18 24 19 L26 34Z" fill="#e4e6ea"/><circle cx="25" cy="13" r="1.6" fill="#222"/>',
  elite: '<path d="M10 20 Q10 6 22 6 Q34 6 34 20 L34 30 L28 34 L16 34 L10 30Z" fill="#e4e6ea"/><rect x="15" y="17" width="14" height="4" rx="1" fill="#222"/><line x1="22" y1="21" x2="22" y2="30" stroke="#222" stroke-width="2.5"/><path d="M22 6 L22 0" stroke="#c9a24a" stroke-width="3"/>',
  scout: '<path d="M8 22 Q22 9 36 22 Q22 35 8 22Z" fill="none" stroke="#e4e6ea" stroke-width="2.4"/><circle cx="22" cy="22" r="5" fill="#e4e6ea"/><circle cx="22" cy="22" r="2" fill="#222"/>',
  settler: '<path d="M9 24 L22 12 L35 24Z" fill="#e4e6ea"/><rect x="12" y="24" width="20" height="11" fill="#e4e6ea"/><rect x="19" y="27" width="6" height="8" fill="#222"/>',
  siege: '<path d="M8 32 h28" stroke="#c59a62" stroke-width="3"/><circle cx="13" cy="33" r="3.5" fill="#e4e6ea"/><circle cx="31" cy="33" r="3.5" fill="#e4e6ea"/><line x1="16" y1="30" x2="32" y2="9" stroke="#c59a62" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="8" r="4" fill="#e4e6ea"/>',
  noble: '<path d="M12 18 L16 10 L22 15 L28 10 L32 18Z" fill="#e2b553"/><circle cx="22" cy="24" r="5" fill="#e4e6ea"/><path d="M13 38 Q14 29 22 29 Q30 29 31 38Z" fill="#e4e6ea"/>',
  hero: '<path d="M11 15 L15 23 L22 11 L29 23 L33 15 L31 31 L13 31Z" fill="#e2b553"/><rect x="13" y="31" width="18" height="4" rx="1" fill="#e2b553"/><circle cx="22" cy="10" r="2" fill="#e2b553"/>',
};
export function unitIcon(cls, color, size = 40) {
  return `<svg viewBox="0 0 44 44" width="${size}" height="${size}" class="ee-unit-ic"><circle cx="22" cy="22" r="21" fill="#0c0b0f"/><circle cx="22" cy="22" r="21" fill="${color}" opacity=".16"/><circle cx="22" cy="22" r="20" fill="none" stroke="${color}" stroke-width="1.3" stroke-opacity=".6"/>${UNIT_GLYPH[cls]}</svg>`;
}

// ---------- карта на света (отгоре) ----------
export const REL_COLORS = { self: '#f2c14e', alliance: '#4fd18b', ally: '#4fd18b', pact: '#6aa8ff', war: '#ff5d6c', neutral: '#b9b4a8', npc: '#c8463a' };
const S = 40;

function mapGround(kind, x, y) {
  const r = rand((x * 73856093) ^ (y * 19349663));
  const base = { grass: '#28301f', forest: '#1f281c', hills: '#332e24', lake: '#18232c', oasis: '#28301f', void: '#060606' }[kind];
  let s = `<rect width="${S}" height="${S}" fill="${base}"/><rect width="${S}" height="${S}" fill="url(#ee-tx-ground)"/>`;
  if (kind === 'grass' || kind === 'oasis') for (let i = 0; i < 3; i++) { const gx = 4 + r() * 32, gy = 6 + r() * 30; s += `<path d="M${f1(gx)} ${f1(gy)} l1.4 -4 l1.4 4" stroke="#3b4730" stroke-width="1" fill="none"/>`; }
  if (kind === 'forest') {
    const trees = [[11, 13], [27, 11], [19, 24], [8, 31], [31, 29]].map(([a, b]) => [a + (r() - 0.5) * 4, b + (r() - 0.5) * 4]);
    for (const [tx, ty] of trees) s += `<circle cx="${f1(tx + 1.5)}" cy="${f1(ty + 2)}" r="6.5" fill="#000" opacity=".3"/><circle cx="${f1(tx)}" cy="${f1(ty)}" r="6.5" fill="#22301f"/><circle cx="${f1(tx - 1.6)}" cy="${f1(ty - 1.8)}" r="3.6" fill="#2f3f2a"/>`;
  }
  if (kind === 'hills') s += `<ellipse cx="15" cy="22" rx="11" ry="8" fill="#3d372b"/><ellipse cx="13" cy="20" rx="7" ry="5" fill="#4a4334"/><ellipse cx="28" cy="27" rx="8" ry="6" fill="#3a3429"/><ellipse cx="26.5" cy="25.5" rx="5" ry="3.5" fill="#463f31"/>`;
  if (kind === 'lake') s += `<g stroke="#2c3e4c" stroke-width="1" fill="none"><path d="M8 14 q4 -2 8 0 t8 0"/><path d="M14 25 q4 -2 8 0 t8 0"/></g>`;
  return s;
}

const RES_DOT = { wood: '#7b5a36', stone: '#8e8b93', food: '#c9a23a', gold: '#e2b553' };

function mapObject(o) {
  if (!o) return '';
  if (o.type === 'oasis') {
    const ring = o.rel ? `<circle cx="20" cy="20" r="17" fill="none" stroke="${REL_COLORS[o.rel]}" stroke-width="1.6" stroke-dasharray="3 3"/>` : '';
    return `${ring}<ellipse cx="20" cy="22" rx="11" ry="7" fill="#2b4756"/><ellipse cx="18" cy="21" rx="6" ry="3" fill="#3d6273"/><circle cx="29" cy="12" r="4.2" fill="${RES_DOT[o.res]}" stroke="#111" stroke-width=".8"/>`;
  }
  if (o.type === 'camp') {
    return `<path d="M8 28 L15 16 L22 28Z" fill="${o.down ? '#4a4540' : '#7a6a52'}"/><path d="M19 30 L26 18 L33 30Z" fill="${o.down ? '#3e3a36' : '#6a5640'}"/>${o.down ? '' : '<circle cx="20" cy="31" r="2.6" fill="#e07a30"/>'}<text x="34" y="11" text-anchor="end" font-size="9" font-weight="700" fill="#ffb3b3">${o.lvl}</text>`;
  }
  if (o.type === 'adventure') {
    return `<circle cx="20" cy="20" r="10" fill="#1a140c" stroke="#e2b553" stroke-width="1.6"/><path d="M14 18 h12 v7 h-12Z" fill="#8a6a3a"/><path d="M14 18 q6 -6 12 0" fill="#a8824a"/><rect x="19" y="19" width="2" height="3" fill="#e2b553"/>${o.hard ? '<circle cx="30" cy="10" r="4" fill="#ff5d6c"/><text x="30" y="13" text-anchor="middle" font-size="7" font-weight="800" fill="#fff">!</text>' : ''}`;
  }
  if (o.type === 'city' || o.type === 'npc') {
    const col = o.type === 'npc' ? REL_COLORS.npc : REL_COLORS[o.rel || 'neutral'];
    const wall = o.type === 'npc' ? '#4a3f3a' : '#8a8478';
    const roof = o.type === 'npc' ? '#3a2420' : '#5a4a3a';
    const big = o.capital || o.type === 'npc';
    return `<ellipse cx="20" cy="31" rx="15" ry="4" fill="#000" opacity=".35"/>
      <rect x="9" y="17" width="22" height="13" fill="${wall}"/><rect x="9" y="17" width="22" height="13" fill="url(#ee-tx-grain)"/>
      <rect x="6" y="${big ? 10 : 13}" width="7" height="${big ? 20 : 17}" fill="${wall}"/><rect x="27" y="${big ? 10 : 13}" width="7" height="${big ? 20 : 17}" fill="${wall}"/>
      <path d="M5 ${big ? 10 : 13} l4.5 -6 l4.5 6Z M26 ${big ? 10 : 13} l4.5 -6 l4.5 6Z" fill="${roof}"/><path d="M13 17 l7 -7 l7 7Z" fill="${roof}"/>
      <rect x="18" y="23" width="4" height="7" fill="#1a120c"/>
      <line x1="20" y1="10" x2="20" y2="2" stroke="#2b2620" stroke-width="1"/><path d="M20 2 l7 2 l-7 2Z" fill="${col}"/>
      ${o.protected ? '<circle cx="34" cy="34" r="4.5" fill="#6aa8ff"/><path d="M34 31.5 l2.5 1 v1.6 q0 2 -2.5 3 q-2.5 -1 -2.5 -3 v-1.6Z" fill="#fff"/>' : ''}
      <rect x="0.8" y="0.8" width="38.4" height="38.4" rx="5" fill="none" stroke="${col}" stroke-width="1.4" stroke-opacity=".75"/>`;
  }
  return '';
}

/**
 * Карта: tiles – [{ x, y, kind, obj }] за видимата област, center – { x, y }, R – радиус.
 * lines – походи [{ x1, y1, x2, y2, color }]; sel – избрано поле { x, y }.
 */
export function mapSvg({ tiles, center, R, sel, lines = [] }) {
  const N = 2 * R + 1;
  const px = (x) => (x - center.x + R) * S, py = (y) => (y - center.y + R) * S;
  let body = '';
  for (const t of tiles) body += `<g transform="translate(${px(t.x)} ${py(t.y)})" class="ee-tile" data-x="${t.x}" data-y="${t.y}">${mapGround(t.kind, t.x, t.y)}${mapObject(t.obj)}</g>`;
  const grid = Array.from({ length: N + 1 }, (_, i) => `<line x1="${i * S}" y1="0" x2="${i * S}" y2="${N * S}"/><line x1="0" y1="${i * S}" x2="${N * S}" y2="${i * S}"/>`).join('');
  const paths = lines.map((l) => `<line x1="${px(l.x1) + S / 2}" y1="${py(l.y1) + S / 2}" x2="${px(l.x2) + S / 2}" y2="${py(l.y2) + S / 2}" stroke="${l.color}" stroke-width="2" stroke-dasharray="5 4" stroke-opacity=".85"/>`).join('');
  const selBox = sel && Math.abs(sel.x - center.x) <= R && Math.abs(sel.y - center.y) <= R ? `<rect x="${px(sel.x) + 1}" y="${py(sel.y) + 1}" width="${S - 2}" height="${S - 2}" rx="5" fill="none" stroke="#fff" stroke-width="2.2"/>` : '';
  const labels = Array.from({ length: N }, (_, i) => `<text x="${i * S + S / 2}" y="${N * S + 12}" text-anchor="middle">${center.x - R + i}</text><text x="-6" y="${i * S + S / 2 + 3}" text-anchor="end">${center.y - R + i}</text>`).join('');
  return `<svg viewBox="-24 -4 ${N * S + 30} ${N * S + 22}" class="ee-mapsvg">${defs(PALETTE.humans)}${body}<g stroke="#000" stroke-opacity=".35" stroke-width=".6">${grid}</g>${paths}${selBox}<g font-size="9" fill="#8d8d99">${labels}</g></svg>`;
}

// ---------- портрет на героя ----------
export function heroPortrait(race, size = 96, dead = false) {
  const c = BASE[race];
  const acc = { humans: '#e2b553', undead: '#7fd7a0', orcs: '#e0623f', vesheri: '#b39ae6' }[race];
  const skin = { humans: '#c9a283', undead: '#9da39a', orcs: '#7d8a4e', vesheri: '#b8a9b5' }[race];
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="ee-hero-pt${dead ? ' dead' : ''}">
    <defs><radialGradient id="hp-${race}" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="${c.tint}"/><stop offset="1" stop-color="#050506"/></radialGradient></defs>
    <circle cx="50" cy="50" r="48" fill="url(#hp-${race})" stroke="${acc}" stroke-width="3"/>
    <path d="M18 96 Q20 70 50 66 Q80 70 82 96Z" fill="#3a3632"/><path d="M18 96 Q20 70 50 66 Q80 70 82 96Z" fill="url(#ee-tx-grain)"/>
    <path d="M30 78 L50 70 L70 78 L66 96 L34 96Z" fill="#5a544c"/><circle cx="50" cy="78" r="4" fill="${acc}"/>
    <ellipse cx="50" cy="46" rx="15" ry="18" fill="${skin}"/>
    <path d="M33 44 Q33 22 50 20 Q67 22 67 44 L63 44 Q62 31 50 30 Q38 31 37 44Z" fill="#6f6a62"/>
    <path d="M47 30 L53 30 L52 50 L48 50Z" fill="#5f5a53"/>
    <path d="M33 44 Q33 22 50 20 Q67 22 67 44" fill="none" stroke="#8a857c" stroke-width="1.2"/>
    ${race === 'orcs' ? '<path d="M42 58 l2 -6 l2 6Z M54 58 l2 -6 l2 6Z" fill="#e8e0c8"/>' : ''}
    ${race === 'undead' ? '<circle cx="44" cy="47" r="2.5" fill="#7fd7a0"/><circle cx="56" cy="47" r="2.5" fill="#7fd7a0"/>' : '<circle cx="44" cy="47" r="1.6" fill="#1a1410"/><circle cx="56" cy="47" r="1.6" fill="#1a1410"/>'}
    ${race === 'vesheri' ? '<path d="M50 22 l3 -10 l3 10" fill="none" stroke="#b39ae6" stroke-width="2"/>' : ''}
    ${race === 'humans' ? '<path d="M50 20 q4 -10 14 -8 q-6 4 -8 10" fill="#8e2c2a"/>' : ''}
  </svg>`;
}
