// Dice sound from real recordings (Kenney "Casino Audio", CC0): shaking in the hand,
// impacts on the table and quiet rolling. The impacts come from the 3D dice physics – with
// the force, height and direction (left/right) of each impact.
import { isMuted, sound } from './common.js';
import { txt } from '../i18n.js';

const BASE = 'assets/sounds/dice/';
const NAMES = ['dice-shake-1', 'dice-shake-2', 'dice-shake-3', 'dice-throw-1', 'dice-throw-2', 'dice-throw-3', 'dice-grab-1', 'dice-grab-2'];
let ctx = null, master = null, loading = null, noise = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -10;
    master.ratio.value = 3;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// The moments of the impacts in a recording (by the signal envelope).
function peaksOf(buf, thr) {
  const d = buf.getChannelData(0), sr = buf.sampleRate, win = Math.floor(sr * 0.005);
  const env = [];
  for (let i = 0; i < d.length; i += win) {
    let m = 0;
    for (let j = i; j < Math.min(d.length, i + win); j++) m = Math.max(m, Math.abs(d[j]));
    env.push(m);
  }
  const out = [];
  for (let i = 2; i < env.length - 1; i++) {
    if (env[i] > thr && env[i] >= env[i - 2] * 2 && env[i] >= env[i + 1] && (!out.length || i * 0.005 - out[out.length - 1].t > 0.04)) out.push({ t: i * 0.005, a: env[i] });
  }
  return out;
}

/** Loads the recordings (once). Returns null if the browser cannot decode them. */
export function loadDiceSounds() {
  if (!loading) {
    loading = (async () => {
      const c = getCtx();
      const bufs = await Promise.all(NAMES.map(async (n) => c.decodeAudioData(await (await fetch(BASE + n + '.ogg')).arrayBuffer())));
      const by = Object.fromEntries(NAMES.map((n, i) => [n, bufs[i]]));
      // short "die on die" clicks from the shaking recordings
      const clacks = [];
      for (const n of ['dice-shake-1', 'dice-shake-2', 'dice-shake-3']) {
        for (const p of peaksOf(by[n], 0.3)) clacks.push({ buf: by[n], start: Math.max(0, p.t - 0.006), dur: 0.085, a: p.a });
      }
      // impacts on the table: the start of the throwing recordings
      const impacts = ['dice-throw-1', 'dice-throw-2', 'dice-throw-3'].map((n) => {
        const p = peaksOf(by[n], 0.4)[0] || { t: 0.03 };
        return { buf: by[n], start: Math.max(0, p.t - 0.008), dur: 0.16 };
      });
      const len = c.sampleRate;
      noise = c.createBuffer(1, len, c.sampleRate);
      const nd = noise.getChannelData(0);
      for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
      return { by, clacks, impacts };
    })().catch((e) => { console.warn(txt('dice sound'), e); return null; });
  }
  return loading;
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const panner = (c, pan) => {
  if (!c.createStereoPanner) return null;
  const p = c.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  return p;
};

function play(c, { buf, start = 0, dur }, t, gain, rate = 1, pan = 0, fade = true) {
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = c.createGain();
  const len = (dur ?? buf.duration - start) / rate;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.002);
  if (fade) {
    g.gain.setValueAtTime(gain, t + len * 0.55);
    g.gain.linearRampToValueAtTime(0, t + len);
  }
  const p = panner(c, pan);
  src.connect(g);
  (p ? g.connect(p) : g).connect(master);
  src.start(t, start, dur ?? undefined);
}

/** Shaking in the hand right before the throw. */
export async function diceShake(n = 2) {
  if (isMuted()) return false;
  const bank = await loadDiceSounds();
  if (!bank) return false;
  const c = getCtx();
  const t = c.currentTime + 0.01;
  // 3–4 quick "die on die" clicks, then the release
  for (let i = 0; i < 2 + n; i++) play(c, pick(bank.clacks), t + i * (0.045 + Math.random() * 0.03), 0.28 + Math.random() * 0.15, 0.95 + Math.random() * 0.15, (Math.random() - 0.5) * 0.3);
  return true;
}

/**
 * The sound of one throw. dice: [{ hits: [{ t, v, pan }], roll: [{ t, speed, contact }] }],
 * times are in seconds from the start of the animation; slow – a slowdown (for debugging).
 */
export async function diceRollAudio(dice, slow = 1) {
  if (isMuted()) return;
  const bank = await loadDiceSounds();
  if (!bank) {
    // without the recordings (e.g. a browser without OGG): the synthesized impacts
    for (const d of dice) for (const h of d.hits) setTimeout(() => sound('dieHit'), h.t * 1000 * slow);
    return;
  }
  const c = getCtx();
  const t0 = c.currentTime + 0.02;
  for (const d of dice) {
    d.hits.forEach((h, i) => {
      const k = Math.min(1, h.v / 22) ** 1.1;
      const at = t0 + h.t * slow;
      if (i === 0 || k > 0.55) play(c, pick(bank.impacts), at, 0.35 + 0.65 * k, 0.94 + Math.random() * 0.12, h.pan);
      // weaker bounces sound quieter and higher
      else play(c, pick(bank.clacks), at, 0.18 + 0.5 * k, 1.05 + (1 - k) * 0.25 + Math.random() * 0.06, h.pan);
    });
    // rolling on the board: quiet filtered noise that follows the speed
    if (d.roll.length) {
      const src = c.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 0.8;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0);
      for (const r of d.roll) g.gain.setTargetAtTime(r.contact ? Math.min(0.09, r.speed * 0.006) : 0, t0 + r.t * slow, 0.02);
      const end = t0 + d.roll[d.roll.length - 1].t * slow;
      g.gain.setTargetAtTime(0, end, 0.03);
      const p = panner(c, d.hits[0]?.pan || 0);
      src.connect(bp).connect(g);
      (p ? g.connect(p) : g).connect(master);
      src.start(t0);
      src.stop(end + 0.3);
    }
  }
}
