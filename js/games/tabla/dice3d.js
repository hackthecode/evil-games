// 3D зарове: HTML/CSS кубчета, които се търкалят над SVG дъската и кацат точно върху SVG заровете.
import { sound } from '../common.js';
import { motion } from '../../ui.js';

// Точки върху стена (в % от страната) – същите като SVG заровете (кутия 58).
const PIPS = {
  1: [[29, 29]],
  2: [[16, 16], [42, 42]],
  3: [[15, 15], [29, 29], [43, 43]],
  4: [[16, 16], [42, 16], [16, 42], [42, 42]],
  5: [[16, 16], [42, 16], [29, 29], [16, 42], [42, 42]],
  6: [[16, 15], [42, 15], [16, 29], [42, 29], [16, 43], [42, 43]],
};
// Завъртане на стената към куба и обратното завъртане, което я извежда отпред.
const FACES = { 1: 'rotateY(0deg)', 6: 'rotateY(180deg)', 2: 'rotateY(90deg)', 5: 'rotateY(-90deg)', 3: 'rotateX(90deg)', 4: 'rotateX(-90deg)' };
const SHOW = { 1: [0, 0], 6: [0, -180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };

function div(cls, style) {
  const e = document.createElement('div');
  e.className = cls;
  if (style) e.style.cssText = style;
  return e;
}

function dieEl(size, dark) {
  const c = size * 0.9; // с перспектива предната стена изглежда точно колкото SVG зара
  const root = div(`d3${dark ? ' dark' : ''}`, `--S:${size}px;--c:${c}px`);
  const shadow = div('d3-shadow');
  const lift = div('d3-lift');
  const cube = div('d3-cube');
  for (const v of [1, 2, 3, 4, 5, 6]) {
    const f = div('d3-face', `transform:${FACES[v]} translateZ(${c / 2}px)`);
    for (const [x, y] of PIPS[v]) f.append(div('d3-pip', `left:${(x / 58) * 100}%;top:${(y / 58) * 100}%`));
    cube.append(f);
  }
  for (const r of ['none', 'rotateX(90deg)', 'rotateY(90deg)']) cube.append(div('d3-core', `transform:${r}`));
  lift.append(cube);
  root.append(shadow, lift);
  return { root, shadow, lift, cube };
}

const rnd = (a, b) => a + Math.random() * (b - a);

/**
 * Хвърля заровете. items: [{ value, dark, from: {x,y}, to: {x,y} }] в екранни координати,
 * size – размер на зара в px, rotZ – завъртане на дъската (0 или 90).
 * Връща Promise, който се изпълнява при кацане; слоят изчезва в следващия кадър,
 * след като SVG заровете са нарисувани на същото място.
 */
export function rollDice3d({ items, size, rotZ = 0, duration = 1100 }) {
  if (motion.fast) return Promise.resolve();
  sound('dice');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const layer = div('d3-layer');
  document.body.append(layer);
  // Отскоци: дял от пътя, височина (1 = във въздуха) и момент във времето.
  const P = [0, 0.6, 0.79, 0.9, 0.96, 1, 1];
  const Hh = [1, 0, 0.32, 0, 0.1, 0, 0];
  const O = [0, 0.36, 0.53, 0.67, 0.77, 0.86, 1];
  const ease = (j) => (Hh[j + 1] < Hh[j] ? 'cubic-bezier(.55,0,1,.6)' : 'cubic-bezier(0,.45,.45,1)');
  const anims = items.map((it, i) => {
    const d = dieEl(size, it.dark);
    layer.append(d.root);
    const delay = i * 90;
    const opt = { duration, delay, fill: 'both' };
    const dx = it.to.x - it.from.x, dy = it.to.y - it.from.y;
    const pos = O.map((o, j) => ({
      offset: o, easing: 'linear',
      transform: `translate(${it.from.x + dx * P[j] - size / 2}px, ${it.from.y + dy * P[j] - size / 2}px)`,
    }));
    const lift = O.map((o, j) => ({ offset: o, easing: ease(j), transform: `scale(${1 + 0.8 * Hh[j]})` }));
    lift[0].opacity = 0;
    lift.splice(1, 0, { offset: 0.07, opacity: 1 });
    const shadow = O.map((o, j) => ({
      offset: o, easing: ease(j), opacity: 0.6 - 0.4 * Hh[j],
      transform: `translate(${Hh[j] * 0.35 * size}px, ${Hh[j] * 0.6 * size}px) scale(${1 + 0.5 * Hh[j]})`,
    }));
    shadow[0].opacity = 0;
    const [fx, fy] = SHOW[it.value];
    const sx = Math.random() < 0.5 ? -1 : 1, sy = Math.random() < 0.5 ? -1 : 1;
    const spin = [
      { transform: `rotateZ(${rotZ + rnd(-120, 120)}deg) rotateX(${rnd(-180, 180)}deg) rotateY(${rnd(-180, 180)}deg)` },
      { transform: `rotateZ(${rotZ}deg) rotateX(${fx + sx * 360 * 2}deg) rotateY(${fy + sy * 360 * (Math.random() < 0.5 ? 1 : 2)}deg)` },
    ];
    for (const k of [1, 3, 5]) setTimeout(() => sound('dieHit'), delay + O[k] * duration);
    return Promise.all([
      d.root.animate(pos, opt).finished,
      d.lift.animate(lift, opt).finished,
      d.shadow.animate(shadow, opt).finished,
      d.cube.animate(spin, { ...opt, duration: duration * 0.84, easing: 'cubic-bezier(.2,.6,.3,1)' }).finished,
    ]).catch(() => {});
  });
  return Promise.all(anims).then(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => layer.remove()));
  });
}
