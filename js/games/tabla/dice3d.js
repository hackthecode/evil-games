// 3D dice – the dice of "Imoti i Imperii" (initDice/setDie in imoti/static/js/game/board.js):
// CSS cubes with six faces that hop and tumble in place and settle on the value from the game.
import { diceSound } from '../dicesound.js';
import { motion } from '../../ui.js';

const ROLL_MS = 1280;

// The faces of the cube – opposite faces sum to 7, as on a real die.
const FACES = [
  { v: 1, t: 'translateZ(var(--hd))' },
  { v: 6, t: 'rotateY(180deg) translateZ(var(--hd))' },
  { v: 3, t: 'rotateY(90deg) translateZ(var(--hd))' },
  { v: 4, t: 'rotateY(-90deg) translateZ(var(--hd))' },
  { v: 5, t: 'rotateX(90deg) translateZ(var(--hd))' },
  { v: 2, t: 'rotateX(-90deg) translateZ(var(--hd))' },
];
// The rotation of the cube that brings the given value to the front.
const ORIENT = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] };

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a, b) => a + Math.round(Math.random() * (b - a));

function div(cls, style) {
  const e = document.createElement('div');
  e.className = cls;
  if (style) e.style.cssText = style;
  return e;
}

function dieEl(size) {
  const root = div('d3', `--die:${size}px`);
  const die = div('d3-die');
  const cube = div('d3-cube');
  for (const face of FACES) {
    const f = div('d3-face', `transform:${face.t}`);
    f.dataset.v = face.v;
    for (let i = 0; i < 9; i++) f.append(div('d3-pip'));
    cube.append(f);
  }
  die.append(cube);
  root.append(die);
  return { root, die, cube };
}

function nextAngle(current, target, fullTurns) {
  const mod = (a) => ((a % 360) + 360) % 360;
  let delta = mod(target) - mod(current);
  if (delta <= 0) delta += 360;
  return current + 360 * Math.max(0, fullTurns - 1) + delta;
}

/**
 * Rolls the dice. items: [{ value, to: {x,y} }] – where each die rests, in screen coordinates,
 * size – die size in px, rotZ – board rotation (0 or 90).
 * Returns a Promise resolved when the dice settle; they disappear in the next frame,
 * after the SVG dice have been drawn in the same place.
 */
export async function rollDice3d({ items, size, rotZ = 0 }) {
  if (motion.fast) return;
  diceSound();
  if (reduced()) return;
  const layer = div('d3-layer');
  document.body.append(layer);
  const k = Math.max(0.75, size / 52); // the hop is sized for a 52px die
  const anims = items.map((it, i) => {
    const d = dieEl(size);
    d.root.style.transform = `translate(${it.to.x - size / 2}px, ${it.to.y - size / 2}px)`;
    layer.append(d.root);
    const side = i % 2 ? 1 : -1;
    const opt = { duration: ROLL_MS, fill: 'both', delay: i % 2 ? 55 : 0 };
    const tf = (rx, ry, rz) => `rotateZ(${rotZ}deg) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
    // starts on a random face
    const [sx, sy] = ORIENT[rnd(1, 6)];
    const [tx, ty] = ORIENT[it.value] || [0, 0];
    const turns = rnd(3, 5);
    const fx = nextAngle(sx, tx, turns + 1), fy = nextAngle(sy, ty, turns + (i % 2 ? 2 : 1)), fz = nextAngle(0, 0, turns);
    const wobbleX = side * rnd(16, 28);
    const hop = rnd(34, 44) * k;
    const drift = side * rnd(13, 25) * k;
    return Promise.all([
      d.cube.animate([
        { transform: tf(sx, sy, 0), offset: 0 },
        { transform: tf(sx + 430 + wobbleX, sy - 260 * side, 185 * side), offset: 0.18 },
        { transform: tf(sx + 840, sy + 540 * side, -280 * side), offset: 0.43 },
        { transform: tf(fx - 250, fy + 180 * side, fz + 95 * side), offset: 0.68 },
        { transform: tf(fx + 34 * side, fy - 28 * side, fz + 16 * side), offset: 0.98 },
        { transform: tf(fx, fy, fz), offset: 1 },
      ], { ...opt, easing: 'cubic-bezier(0.16, 0.78, 0.55, 1)' }).finished,
      d.die.animate([
        { transform: 'translate3d(0, 0, 0) rotateZ(0deg) scale(1)', offset: 0 },
        { transform: `translate3d(${drift}px, -${hop}px, ${18 * k}px) rotateZ(${side * 18}deg) scale(1.16)`, offset: 0.18 },
        { transform: `translate3d(${drift * 0.9}px, ${5 * k}px, 0) rotateZ(${-side * 11}deg) scale(0.94)`, offset: 0.44 },
        { transform: `translate3d(${drift * 0.45}px, ${-17 * k}px, ${9 * k}px) rotateZ(${side * 7}deg) scale(1.07)`, offset: 0.62 },
        { transform: `translate3d(${drift * 0.18}px, ${3 * k}px, 0) rotateZ(${-side * 3}deg) scale(0.985)`, offset: 0.80 },
        { transform: 'translate3d(0, 0, 0) rotateZ(0deg) scale(1)', offset: 1 },
      ], { ...opt, easing: 'cubic-bezier(0.24, 0.72, 0.52, 1)' }).finished,
    ]).catch(() => {});
  });
  await Promise.all(anims);
  // the dice stay one more frame until the game draws its own in the same place
  requestAnimationFrame(() => requestAnimationFrame(() => layer.remove()));
}
