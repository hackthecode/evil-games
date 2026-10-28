// Evil Empires – атмосфера: музика (запис, CC0), звуци на града (синтезирани – птици,
// щурци, вятър, дъжд, ковачница) и звуци на битките (записи на мечове, CC0).
import { isMuted } from '../common.js';

const PREF = 'ee.audio';
export function audioPrefs() {
  try { return { music: true, ambient: true, ...JSON.parse(localStorage.getItem(PREF) || '{}') }; } catch { return { music: true, ambient: true }; }
}
export function setAudioPref(key, on) {
  const p = audioPrefs();
  p[key] = on;
  try { localStorage.setItem(PREF, JSON.stringify(p)); } catch {}
  apply();
}

let ctx = null, out = null, noiseBuf = null;
let musicEl = null;
let amb = null; // активните звуци на града
let want = null; // { hour, weather, smithy }
let timers = [];

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain();
    out.gain.value = 0.8;
    out.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Браузърите пускат звук едва след действие на потребителя.
let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  getCtx();
  apply();
}
window.addEventListener('pointerdown', unlock, { once: true, capture: true });
window.addEventListener('keydown', unlock, { once: true, capture: true });

// ---------- музика ----------
function setMusic(on) {
  if (on && !musicEl) {
    musicEl = new Audio('assets/sounds/music/bards-tale.mp3');
    musicEl.loop = true;
    musicEl.volume = 0;
  }
  if (!musicEl) return;
  const target = on ? 0.22 : 0;
  if (on && musicEl.paused) musicEl.play().catch(() => {});
  const step = () => {
    const v = musicEl.volume;
    const nv = v + Math.sign(target - v) * Math.min(0.02, Math.abs(target - v));
    musicEl.volume = Math.max(0, Math.min(1, nv));
    if (Math.abs(target - musicEl.volume) > 0.005) setTimeout(step, 80);
    else if (!on) musicEl.pause();
  };
  step();
}

// ---------- звуци на града ----------
function noiseLoop(type, freq, q, gain) {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = 0;
  g.gain.setTargetAtTime(gain, c.currentTime, 1.2);
  src.connect(f).connect(g).connect(out);
  src.start();
  return { src, g, f };
}

function chirp(base, n, gain) {
  const c = getCtx();
  let t = c.currentTime + 0.02;
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(out); }
  for (let i = 0; i < n; i++) {
    const o = c.createOscillator(), g = c.createGain();
    const f0 = base * (0.9 + Math.random() * 0.25);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + Math.random() * 0.5), t + 0.05);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(pan || out);
    o.start(t);
    o.stop(t + 0.12);
    t += 0.09 + Math.random() * 0.06;
  }
}

function cricket(gain) {
  const c = getCtx();
  const t = c.currentTime + 0.02;
  const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o.frequency.value = 4300 + Math.random() * 500;
  lfo.frequency.value = 28 + Math.random() * 8;
  lg.gain.value = gain;
  lfo.connect(lg).connect(g.gain);
  g.gain.setValueAtTime(0, t);
  o.connect(g).connect(out);
  const len = 0.25 + Math.random() * 0.3;
  o.start(t); lfo.start(t);
  o.stop(t + len); lfo.stop(t + len);
}

function owl() {
  const c = getCtx();
  let t = c.currentTime + 0.05;
  for (const [f, d] of [[420, 0.35], [380, 0.6]]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * 0.92, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
    t += d + 0.25;
  }
}

function anvil() {
  const c = getCtx();
  const t = c.currentTime + 0.02;
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  if (pan) { pan.pan.value = -0.3 + Math.random() * 0.6; pan.connect(out); }
  for (const [f, a, d] of [[1180, 0.05, 0.9], [2960, 0.03, 0.5], [4310, 0.02, 0.35], [6020, 0.012, 0.2]]) {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f * (0.98 + Math.random() * 0.04);
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(pan || out);
    o.start(t);
    o.stop(t + d);
  }
}

function every(fn, min, max) {
  let id;
  const loop = () => { id = setTimeout(() => { fn(); loop(); }, min + Math.random() * (max - min)); timers.push(id); };
  loop();
}

function stopAmb() {
  for (const id of timers) clearTimeout(id);
  timers = [];
  if (amb) {
    const c = getCtx();
    for (const n of amb.loops) { n.g.gain.setTargetAtTime(0, c.currentTime, 0.6); n.src.stop(c.currentTime + 3); }
    amb = null;
  }
}

function startAmb(w) {
  stopAmb();
  const day = w.hour >= 6 && w.hour < 20;
  const loops = [noiseLoop('bandpass', 380, 0.6, 0.035)]; // вятър
  if (w.weather === 'rain') loops.push(noiseLoop('highpass', 1800, 0.5, 0.11), noiseLoop('lowpass', 900, 0.4, 0.06));
  if (w.weather === 'snow') loops.push(noiseLoop('bandpass', 260, 0.4, 0.05));
  amb = { loops };
  if (w.weather !== 'rain') {
    if (day) every(() => chirp(2600 + Math.random() * 1600, 2 + Math.floor(Math.random() * 4), 0.025), 1200, 4200);
    else { every(() => cricket(0.012), 400, 1400); every(owl, 9000, 20000); }
  }
  if (w.smithy && day) every(() => { anvil(); setTimeout(anvil, 420); }, 3500, 7000);
}

function apply() {
  if (!unlocked) return;
  const p = audioPrefs();
  const active = !!want && !isMuted();
  setMusic(active && p.music);
  if (active && p.ambient) {
    const key = JSON.stringify(want);
    if (!amb || amb.key !== key) { startAmb(want); amb.key = key; }
  } else stopAmb();
}

/** Пуска/обновява атмосферата на града; null – спира всичко (изход от играта). */
export function cityAudio(w) {
  want = w;
  apply();
}

// ---------- битки ----------
let swords = null;
async function loadSwords() {
  if (!swords) {
    swords = (async () => {
      const c = getCtx();
      const load = async (n) => c.decodeAudioData(await (await fetch(`assets/sounds/battle/${n}.ogg`)).arrayBuffer());
      const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      return { sword: await Promise.all(ids.map((i) => load(`sword-${i}`))), clash: await Promise.all(ids.map((i) => load(`clash-${i}`))) };
    })().catch(() => null);
  }
  return swords;
}
export const preloadBattleSounds = () => loadSwords();

/** Удар в битка: kind – 'sword' (замах) или 'clash' (сблъсък); strength 0..1. */
export async function battleSound(kind = 'clash', strength = 0.6, delay = 0) {
  if (isMuted()) return;
  const bank = await loadSwords();
  if (!bank) return;
  const c = getCtx();
  const list = bank[kind];
  const src = c.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)];
  src.playbackRate.value = 0.92 + Math.random() * 0.16;
  const g = c.createGain();
  g.gain.value = 0.25 + 0.6 * strength;
  src.connect(g).connect(out);
  src.start(c.currentTime + delay);
}
