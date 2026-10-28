// 3D зарове. Основно: истински 3D (Three.js) с физика (cannon-es) – заровете се
// хвърлят, подскачат, търкалят и въртят, а накрая кацат точно на мястото и със
// стойността от играта. Резерва (без интернет/WebGL): CSS кубчета.
import { sound } from '../common.js';
import { motion } from '../../ui.js';

// Точки върху стена (в единици от кутия 58) – същите като SVG заровете.
const PIPS = {
  1: [[29, 29]],
  2: [[16, 16], [42, 42]],
  3: [[15, 15], [29, 29], [43, 43]],
  4: [[16, 16], [42, 16], [16, 42], [42, 42]],
  5: [[16, 16], [42, 16], [29, 29], [16, 42], [42, 42]],
  6: [[16, 15], [42, 15], [16, 29], [42, 29], [16, 43], [42, 43]],
};

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a, b) => a + Math.random() * (b - a);

/**
 * Хвърля заровете. items: [{ value, dark, from: {x,y}, to: {x,y} }] в екранни координати,
 * size – размер на зара в px, rotZ – завъртане на дъската (0 или 90).
 * Връща Promise, който се изпълнява при кацане; заровете изчезват в следващия кадър,
 * след като SVG заровете са нарисувани на същото място.
 */
export async function rollDice3d(opts) {
  if (motion.fast) return;
  sound('dice');
  if (reduced()) return;
  const libs = await preloadDice();
  if (libs) {
    try {
      return await rollGL(libs, opts);
    } catch (e) {
      console.warn('3D зарове', e);
    }
  }
  return rollCss(opts);
}

// ===================== истински 3D =====================
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
const CANNON_URL = 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
let libsP = null;

// Зарежда библиотеките предварително (при отваряне на играта), за да няма забавяне.
export function preloadDice() {
  if (!libsP) {
    libsP = Promise.all([import(THREE_URL), import(CANNON_URL)])
      .then(([THREE, CANNON]) => ({ THREE, CANNON }))
      .catch((e) => { console.warn('3D библиотеките не се заредиха', e); return null; });
  }
  return libsP;
}

let G3 = null; // общата 3D сцена (една за всички хвърляния)

// Стойността на всяка стена на кубa: [+x, -x, +y, -y, +z, -z] – срещуположните са със сбор 7.
const FACE_VALUES = [2, 5, 3, 4, 1, 6];

function faceCanvas(v, dark, bump) {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  if (bump) {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, N, N);
  } else {
    const grd = g.createRadialGradient(N * 0.32, N * 0.28, N * 0.05, N * 0.5, N * 0.5, N * 0.78);
    if (dark) { grd.addColorStop(0, '#4a2a30'); grd.addColorStop(0.55, '#2a1418'); grd.addColorStop(1, '#14080a'); }
    else { grd.addColorStop(0, '#fffdf7'); grd.addColorStop(0.55, '#f7f0e0'); grd.addColorStop(1, '#e6d9bc'); }
    g.fillStyle = grd;
    g.fillRect(0, 0, N, N);
    // ситна зърнистост на материала
    const img = g.getImageData(0, 0, N, N);
    for (let i = 0; i < img.data.length; i += 4) {
      const d = (Math.random() - 0.5) * (dark ? 10 : 7);
      img.data[i] += d; img.data[i + 1] += d; img.data[i + 2] += d;
    }
    g.putImageData(img, 0, 0);
  }
  const r = N * 0.0965;
  for (const [px, py] of PIPS[v]) {
    const x = (px / 58) * N, y = (py / 58) * N;
    if (bump) {
      const b = g.createRadialGradient(x, y, r * 0.2, x, y, r * 1.08);
      b.addColorStop(0, '#000');
      b.addColorStop(0.75, '#333');
      b.addColorStop(1, '#fff');
      g.fillStyle = b;
      g.beginPath();
      g.arc(x, y, r * 1.08, 0, Math.PI * 2);
      g.fill();
      continue;
    }
    // издълбана точка: тъмна вдлъбнатина + светъл ръб долу вдясно
    const hole = g.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
    if (dark) { hole.addColorStop(0, '#fffaf0'); hole.addColorStop(0.7, '#efe3c6'); hole.addColorStop(1, '#bfae88'); }
    else { hole.addColorStop(0, '#0e0a08'); hole.addColorStop(0.7, '#2a1f18'); hole.addColorStop(1, '#4a3a2c'); }
    g.fillStyle = hole;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = dark ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, r, Math.PI * 0.05, Math.PI * 0.75);
    g.stroke();
  }
  return c;
}

// Куб със заоблени ръбове: върховете на сегментирания куб се „издуват“ към ъглите.
function roundedBox(THREE, radius = 0.12, seg = 6) {
  const geo = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const inner = 0.5 - radius;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(Math.max(-inner, Math.min(inner, v.x)), Math.max(-inner, Math.min(inner, v.y)), Math.max(-inner, Math.min(inner, v.z)));
    n.subVectors(v, c);
    if (n.lengthSq() < 1e-9) continue;
    n.normalize();
    v.copy(c).addScaledVector(n, radius);
    pos.setXYZ(i, v.x, v.y, v.z);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return geo;
}

function setup({ THREE }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'd3-gl';
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 10000);
  scene.add(new THREE.HemisphereLight(0xfff2e0, 0x30261e, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.6;
  key.shadow.radius = 5;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.6);
  scene.add(fill);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.42 }));
  plane.receiveShadow = true;
  scene.add(plane);
  const geo = roundedBox(THREE);
  const mats = {};
  for (const dark of [false, true]) {
    mats[dark] = FACE_VALUES.map((v) => {
      const map = new THREE.CanvasTexture(faceCanvas(v, dark, false));
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
      const bumpMap = new THREE.CanvasTexture(faceCanvas(v, dark, true));
      return new THREE.MeshPhysicalMaterial({
        map, bumpMap, bumpScale: 2.2,
        roughness: dark ? 0.32 : 0.38, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.14,
        sheen: dark ? 0 : 0.25, sheenColor: new THREE.Color(0xfff4dc),
      });
    });
  }
  return { renderer, scene, camera, key, fill, plane, geo, mats, canvas };
}

// Всички 24 завъртания на куба (като кватерниони).
function cubeRotations(THREE) {
  const out = [];
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const m = new THREE.Matrix4();
  for (const p of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
    for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
      const cols = [axes[p[0]].map((x) => x * sx), axes[p[1]].map((x) => x * sy), axes[p[2]].map((x) => x * sz)];
      const det = cols[0][0] * (cols[1][1] * cols[2][2] - cols[1][2] * cols[2][1]) - cols[1][0] * (cols[0][1] * cols[2][2] - cols[0][2] * cols[2][1]) + cols[2][0] * (cols[0][1] * cols[1][2] - cols[0][2] * cols[1][1]);
      if (det < 0) continue;
      m.makeBasis(new THREE.Vector3(...cols[0]), new THREE.Vector3(...cols[1]), new THREE.Vector3(...cols[2]));
      out.push(new THREE.Quaternion().setFromRotationMatrix(m));
    }
  }
  return out;
}

// Нормалата и посоката „нагоре“ на текстурата за всяка стойност (в координатите на куба).
const NORMAL = { 2: [1, 0, 0], 5: [-1, 0, 0], 3: [0, 1, 0], 4: [0, -1, 0], 1: [0, 0, 1], 6: [0, 0, -1] };
const TEX_UP = { 2: [0, 1, 0], 5: [0, 1, 0], 3: [0, 0, -1], 4: [0, 0, 1], 1: [0, 1, 0], 6: [0, 1, 0] };

const GRAV = 260; // в „заровe“ за секунда на квадрат (ребро = 1)

// Физиката на едно хвърляне: кадри по 60 в секунда и моментите на удар.
function simulate({ CANNON }, start, target, power = 1) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, -GRAV) });
  const mDie = new CANNON.Material(), mFloor = new CANNON.Material();
  world.addContactMaterial(new CANNON.ContactMaterial(mDie, mFloor, { friction: 0.32, restitution: 0.45 }));
  const floor = new CANNON.Body({ mass: 0, material: mFloor });
  floor.addShape(new CANNON.Plane());
  world.addBody(floor);
  const body = new CANNON.Body({ mass: 1, material: mDie, linearDamping: 0.1, angularDamping: 0.12 });
  body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)));
  const z0 = rnd(3.2, 4.4), vz = rnd(1, 4);
  const tf = (vz + Math.sqrt(vz * vz + 2 * GRAV * z0)) / GRAV;
  const dx = target[0] - start[0], dy = target[1] - start[1];
  const k = (rnd(0.5, 0.62) * power) / tf;
  body.position.set(start[0], start[1], z0);
  body.velocity.set(dx * k, dy * k, vz);
  body.angularVelocity.set(rnd(-28, 28), rnd(-28, 28), rnd(-10, 10));
  body.quaternion.setFromEuler(rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3));
  world.addBody(body);
  const hits = [];
  body.addEventListener('collide', (e) => {
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (v > 4 && (!hits.length || world.time - hits[hits.length - 1].t > 0.06)) hits.push({ t: world.time, v });
  });
  const frames = [];
  const dt = 1 / 240;
  let still = 0;
  for (let i = 0; i < 240 * 2.2; i++) {
    world.step(dt);
    if (i % 4 === 3) {
      const p = body.position, q = body.quaternion;
      frames.push([p.x, p.y, p.z, q.x, q.y, q.z, q.w]);
      still = body.velocity.length() < 0.25 && body.angularVelocity.length() < 0.4 ? still + 1 : 0;
      if (still > 8 && frames.length > 30) break;
    }
  }
  return { frames, hits };
}

// Поправя траекторията, така че зарът да кацне точно на мястото, със стойността
// и със същото завъртане като SVG зара (плавно, в края на търкалянето).
function plan(L, sim, value, rotZ) {
  const { THREE } = L;
  const ROT = G3.rot || (G3.rot = cubeRotations(THREE));
  const last = sim.frames[sim.frames.length - 1];
  const qn = new THREE.Quaternion(last[3], last[4], last[5], last[6]);
  // коя стена на тялото е нагоре
  const up = new THREE.Vector3(0, 0, 1);
  let best = null, bestDot = -2;
  for (const n of Object.values(NORMAL)) {
    const w = new THREE.Vector3(...n).applyQuaternion(qn);
    if (w.z > bestDot) { bestDot = w.z; best = new THREE.Vector3(...n); }
  }
  const Nv = new THREE.Vector3(...NORMAL[value]), Uv = new THREE.Vector3(...TEX_UP[value]);
  const ang = ((90 - rotZ) * Math.PI) / 180;
  const want = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
  let Q = null, res = Infinity;
  for (const r of ROT) {
    if (Nv.clone().applyQuaternion(r).distanceTo(best) > 1e-3) continue;
    const uw = Uv.clone().applyQuaternion(r).applyQuaternion(qn);
    uw.z = 0;
    const a = Math.abs(uw.angleTo(want));
    if (a < res) { res = a; Q = r; }
  }
  // крайното положение: стойността нагоре, текстурата – както на SVG зара
  const bl = new THREE.Matrix4().makeBasis(Uv, Nv, Uv.clone().cross(Nv));
  const bw = new THREE.Matrix4().makeBasis(want, up, want.clone().cross(up));
  const qt = new THREE.Quaternion().setFromRotationMatrix(bw.multiply(bl.transpose()));
  const Mn = qn.clone().multiply(Q);
  const D = qt.clone().multiply(Mn.clone().invert());
  const off = new THREE.Vector3(-last[0], -last[1], 0.5 - last[2]);
  return { Q, D, off };
}

async function rollGL(L, { items, size, rotZ = 0 }) {
  const { THREE } = L;
  G3 ||= setup(L);
  const { renderer, scene, camera, key, fill, plane, geo, mats, canvas } = G3;
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  const hc = H / 2 / Math.tan((camera.fov * Math.PI) / 360);
  camera.near = hc * 0.05;
  camera.far = hc * 3;
  camera.position.set(0, 0, hc);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  plane.scale.set(W * 2, H * 2, 1);
  const span = Math.max(W, H) * 0.6;
  key.position.set(-W * 0.3, H * 0.4, hc * 0.7);
  Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: hc * 2 });
  key.shadow.camera.updateProjectionMatrix();
  fill.position.set(W * 0.4, -H * 0.3, hc * 0.5);
  document.body.append(canvas);

  const edge = size * 0.9;
  const toWorld = (p) => [p.x - W / 2, H / 2 - p.y];
  const dice = items.map((it, i) => {
    const to = toWorld(it.to), from = toWorld(it.from);
    const start = [(from[0] - to[0]) / edge, (from[1] - to[1]) / edge];
    // прицелване: няколко опита, като силата се коригира според това къде е спрял зарът
    let sim = null, bestD = Infinity, power = 0.75;
    const want = Math.hypot(start[0], start[1]) || 1;
    for (let a = 0; a < 6; a++) {
      const s1 = simulate(L, start, [0, 0], power);
      const e = s1.frames[s1.frames.length - 1];
      const miss = Math.hypot(e[0], e[1]);
      if (miss < bestD) { bestD = miss; sim = s1; }
      if (miss < 0.6) break;
      const went = Math.hypot(e[0] - start[0], e[1] - start[1]) || want;
      power = Math.min(2, Math.max(0.2, power * (want / went)));
    }
    const p = plan(L, sim, it.value, rotZ);
    const holder = new THREE.Group();
    const mesh = new THREE.Mesh(geo, mats[!!it.dark]);
    mesh.castShadow = true;
    mesh.quaternion.copy(p.Q);
    holder.add(mesh);
    holder.scale.setScalar(edge);
    holder.visible = false;
    scene.add(holder);
    const delay = i * 0.09;
    for (const h of sim.hits) setTimeout(() => sound('dieHit'), (delay + h.t) * 1000);
    return { sim, p, holder, to, delay };
  });

  const qb = new THREE.Quaternion(), qd = new THREE.Quaternion(), I = new THREE.Quaternion();
  const smooth = (x) => x * x * (3 - 2 * x);
  const show = (d, t) => {
    const fr = d.sim.frames;
    const n = fr.length - 1;
    const fi = Math.min(n, Math.max(0, (t - d.delay) * 60));
    const i = Math.floor(fi), j = Math.min(n, i + 1), a = fi - i;
    const A = fr[i], B = fr[j];
    const w = smooth(Math.min(1, Math.max(0, (fi - n * 0.42) / (n * 0.58))));
    const x = A[0] + (B[0] - A[0]) * a + d.p.off.x * w;
    const y = A[1] + (B[1] - A[1]) * a + d.p.off.y * w;
    const z = A[2] + (B[2] - A[2]) * a + d.p.off.z * w;
    qb.set(A[3], A[4], A[5], A[6]).slerp(new THREE.Quaternion(B[3], B[4], B[5], B[6]), a);
    qd.copy(I).slerp(d.p.D, w);
    d.holder.quaternion.copy(qd).multiply(qb);
    d.holder.position.set(d.to[0] + x * edge, d.to[1] + y * edge, z * edge);
    d.holder.visible = t >= d.delay;
    return fi >= n;
  };

  const total = Math.max(...dice.map((d) => d.delay + (d.sim.frames.length - 1) / 60));
  await new Promise((resolve) => {
    const t0 = performance.now();
    const frame = () => {
      const t = (performance.now() - t0) / 1000 / (window.__diceSlow || 1); // __diceSlow – за проверка
      let done = true;
      for (const d of dice) done = show(d, t) && done;
      renderer.render(scene, camera);
      if (done || t > total + 0.3) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  // заровете остават още кадър, докато играта нарисува своите на същото място
  if (window.__diceHold) await new Promise((r) => setTimeout(r, window.__diceHold));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const d of dice) scene.remove(d.holder);
    renderer.render(scene, camera);
    canvas.remove();
  }));
}

// ===================== резерва: CSS кубчета =====================
const FACES = { 1: 'rotateY(0deg)', 6: 'rotateY(180deg)', 2: 'rotateY(90deg)', 5: 'rotateY(-90deg)', 3: 'rotateX(90deg)', 4: 'rotateX(-90deg)' };
const SHOW = { 1: [0, 0], 6: [0, -180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };

function div(cls, style) {
  const e = document.createElement('div');
  e.className = cls;
  if (style) e.style.cssText = style;
  return e;
}

function dieEl(size, dark) {
  const c = size * 0.9;
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

function rollCss({ items, size, rotZ = 0, duration = 1100 }) {
  const layer = div('d3-layer');
  document.body.append(layer);
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
    const pos = O.map((o, j) => ({ offset: o, easing: 'linear', transform: `translate(${it.from.x + dx * P[j] - size / 2}px, ${it.from.y + dy * P[j] - size / 2}px)` }));
    const lift = O.map((o, j) => ({ offset: o, easing: ease(j), transform: `scale(${1 + 0.8 * Hh[j]})` }));
    lift[0].opacity = 0;
    lift.splice(1, 0, { offset: 0.07, opacity: 1 });
    const shadow = O.map((o, j) => ({ offset: o, easing: ease(j), opacity: 0.6 - 0.4 * Hh[j], transform: `translate(${Hh[j] * 0.35 * size}px, ${Hh[j] * 0.6 * size}px) scale(${1 + 0.5 * Hh[j]})` }));
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
