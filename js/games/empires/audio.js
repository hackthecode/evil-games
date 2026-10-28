// Evil Empires – atmosphere: music for each race and for battles, city sounds (recordings of birds,
// crickets and an anvil; the wind and the owl are synthesized) and battle sounds. All recordings are CC0.
// Two volume levels (0–100): music, and all other sounds (city and battles).
import { isMuted } from '../common.js';

const PREF = 'ee.audio';
const level = (v, d) => (typeof v === 'number' ? Math.max(0, Math.min(100, v)) : v === false ? 0 : d);
export function audioPrefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(PREF) || '{}') || {}; } catch {}
  // older versions stored on/off switches (music, ambient)
  return { music: level(p.music, 70), sfx: level(p.sfx ?? p.ambient, 80) };
}
/** key: 'music' | 'sfx', value: 0–100. */
export function setAudioPref(key, value) {
  const p = audioPrefs();
  p[key] = level(Number(value), 0);
  try { localStorage.setItem(PREF, JSON.stringify(p)); } catch {}
  if (out) out.gain.value = 0.8 * (p.sfx / 100);
  if (key === 'music' && musicEl) { clearTimeout(musicEl._fade); musicEl.volume = musicTarget(musicKey); }
  apply();
}

let ctx = null, out = null, noiseBuf = null;
let musicEl = null;
let amb = null; // the active city sounds
let want = null; // { hour, weather, smithy, race }
let battleOn = false;
let timers = [];

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain();
    out.gain.value = 0.8 * (audioPrefs().sfx / 100);
    out.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Browsers only play sound after a user action.
let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  getCtx();
  apply();
}
window.addEventListener('pointerdown', unlock, { once: true, capture: true });
window.addEventListener('keydown', unlock, { once: true, capture: true });

// ---------- music ----------
const MUSIC = { humans: 'bards-tale', undead: 'undead', orcs: 'orcs', vesheri: 'vesheri', battle: 'battle' };
const MUSIC_VOL = { orcs: 0.16, battle: 0.2 };
let musicKey = null;
const musicTarget = (key) => (MUSIC_VOL[key] ?? 0.22) * 1.6 * (audioPrefs().music / 100);
function fadeTo(el, target, done) {
  clearTimeout(el._fade);
  const step = () => {
    const v = el.volume;
    el.volume = Math.max(0, Math.min(1, v + Math.sign(target - v) * Math.min(0.02, Math.abs(target - v))));
    if (Math.abs(target - el.volume) > 0.005) el._fade = setTimeout(step, 80);
    else done?.();
  };
  step();
}
// Plays the tune key (or stops the music on null) with a smooth crossfade.
function setMusic(key) {
  if (key === musicKey) return;
  const old = musicEl;
  if (old) fadeTo(old, 0, () => old.pause());
  musicKey = key;
  musicEl = null;
  if (!key) return;
  musicEl = new Audio(`assets/sounds/music/${MUSIC[key] || MUSIC.humans}.mp3`);
  musicEl.loop = true;
  musicEl.volume = 0;
  musicEl.play().catch(() => {});
  fadeTo(musicEl, musicTarget(key));
}

// ---------- recordings ----------
const bufs = {};
function sample(name) {
  if (!bufs[name]) bufs[name] = (async () => getCtx().decodeAudioData(await (await fetch(`assets/sounds/ambient/${name}.mp3`)).arrayBuffer()))().catch(() => null);
  return bufs[name];
}
// An endless recording (birds, crickets) – quiet start, no click at the end (skips the mp3 silence).
function sampleLoop(name, gain) {
  const c = getCtx();
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(out);
  const node = { g, src: null, stopped: false };
  sample(name).then((buf) => {
    if (!buf || node.stopped) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = 0.06;
    src.loopEnd = buf.duration - 0.06;
    src.connect(g);
    src.start(c.currentTime, Math.random() * buf.duration * 0.8);
    g.gain.setTargetAtTime(gain, c.currentTime, 1.2);
    node.src = src;
  });
  return node;
}
function playSample(name, gain, rate = 1) {
  sample(name).then((buf) => {
    if (!buf) return;
    const c = getCtx();
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf;
    src.playbackRate.value = rate;
    g.gain.value = gain;
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 0.8 - 0.4;
    src.connect(g).connect(pan || out);
    if (pan) pan.connect(out);
    src.start();
  });
}

// ---------- city sounds ----------
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
    for (const n of amb.loops) { n.stopped = true; n.g.gain.setTargetAtTime(0, c.currentTime, 0.6); n.src?.stop(c.currentTime + 3); }
    amb = null;
  }
}

function startAmb(w) {
  stopAmb();
  const day = w.hour >= 6 && w.hour < 20;
  const loops = [noiseLoop('bandpass', 380, 0.6, 0.03)]; // wind
  if (w.weather === 'snow') loops.push(noiseLoop('bandpass', 260, 0.4, 0.05));
  amb = { loops };
  if (w.weather !== 'rain') {
    if (day) loops.push(sampleLoop('birds', 0.35));
    else { loops.push(sampleLoop('crickets', 0.22)); every(owl, 12000, 26000); }
  }
  // the smith strikes the anvil (a recording with three strikes)
  if (w.smithy && day) every(() => playSample('anvil', 0.18, 0.95 + Math.random() * 0.1), 6000, 11000);
}

function apply() {
  if (!unlocked) return;
  const p = audioPrefs();
  const active = !!want && !isMuted();
  setMusic(active && p.music > 0 ? (battleOn ? 'battle' : want.race || 'humans') : null);
  if (active && p.sfx > 0) {
    const key = JSON.stringify(want);
    if (!amb || amb.key !== key) { startAmb(want); amb.key = key; }
  } else stopAmb();
}

/** Battle music (the tactical screen) – on/off. */
export function battleMusic(on) {
  battleOn = on;
  apply();
}

/** Starts/updates the city atmosphere; null – stops everything (leaving the game). */
export function cityAudio(w) {
  want = w;
  apply();
}

// ---------- battles ----------
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

/** A strike in battle: kind – 'sword' (swing) or 'clash'; strength 0..1. */
export async function battleSound(kind = 'clash', strength = 0.6, delay = 0) {
  if (isMuted() || audioPrefs().sfx <= 0) return;
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
