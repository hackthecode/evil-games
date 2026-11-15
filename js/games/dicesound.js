// The dice sound of "Imoti i Imperii" (IE.sound.dice in imoti/static/js/common.js), entirely
// synthesized with Web Audio: a run of plastic-on-wood clacks that thin out and fade
// while the dice come to rest, plus a dull thud from the table.
import { isMuted } from './common.js';

const VOLUME = 0.7; // the default volume in Imoti
let ctx = null, bus = null, noiseBuf = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = VOLUME;
    // the compressor guards against clipping when several sounds overlap
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    bus = ctx.createGain();
    bus.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer() {
  if (!noiseBuf) {
    const length = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

// A noise burst through a filter: an impact, a tick.
function hit({ at = 0, dur = 0.05, freq = 1800, q = 6, gain = 0.3, attack = 0.002 }) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.playbackRate.value = 0.75 + Math.random() * 0.5;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t);
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(bus);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

// A low dull thud: a sine that glides down.
function thud(at, freq, volume, dur) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** The sound of one roll. */
export function diceSound() {
  if (isMuted()) return;
  try {
    if (!getCtx()) return;
    hit({ dur: 0.11, freq: 2400, q: 0.8, gain: 0.1, attack: 0.02 }); // the shake
    let t = 0.06;
    const clacks = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < clacks; i++) {
      const fade = 1 - i / (clacks + 1);
      hit({ at: t, dur: 0.03 + Math.random() * 0.025, freq: 950 + Math.random() * 1700, q: 4 + Math.random() * 6, gain: 0.16 + 0.24 * fade });
      if (i % 2 === 0) thud(t, 120 + Math.random() * 60, 0.07 * fade, 0.06);
      t += 0.035 + Math.random() * 0.06 * (1 + i * 0.25); // they thin out
    }
    thud(t, 105, 0.1, 0.12); // they stop on the table
  } catch {}
}
