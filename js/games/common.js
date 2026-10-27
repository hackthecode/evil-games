// Общи елементи за игрите: екран с настройки, резултат, звуци, запомняне на настройки.
import { h, modal, motion } from '../ui.js';
import { icon } from '../icons.js';

export function loadPrefs(gameId, defaults) {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(`kare.prefs.${gameId}`) || '{}') };
  } catch {
    return { ...defaults };
  }
}

export function savePrefs(gameId, prefs) {
  try {
    localStorage.setItem(`kare.prefs.${gameId}`, JSON.stringify(prefs));
  } catch {}
}

export function seg(options, value, onChange) {
  const el = h('div', { class: 'seg', role: 'radiogroup' });
  for (const [v, label] of options) {
    el.append(
      h('button', {
        type: 'button',
        class: String(v) === String(value) ? 'on' : '',
        role: 'radio',
        'aria-checked': String(String(v) === String(value)),
        onclick: (e) => {
          el.querySelectorAll('button').forEach((b) => {
            b.classList.toggle('on', b === e.currentTarget);
            b.setAttribute('aria-checked', String(b === e.currentTarget));
          });
          onChange(v);
        },
      }, label),
    );
  }
  return el;
}

// Показва екран с настройки в root. Връща Promise с избраните стойности.
export function setupScreen(root, { gameId, title, subtitle, groups, startLabel = 'Започни играта' }) {
  return new Promise((resolve) => {
    const prefs = loadPrefs(gameId, Object.fromEntries(groups.map((g) => [g.key, g.value])));
    const wrap = h('div', { class: 'g-setup' },
      h('div', { class: 'g-setup-card glass' },
        h('div', null, h('h2', null, title), subtitle && h('p', { class: 'muted', style: { margin: '6px 0 0' } }, subtitle)),
        groups.map((g) =>
          h('div', { class: 'opt-group' },
            h('span', null, g.label),
            seg(g.options, prefs[g.key], (v) => (prefs[g.key] = v)),
          ),
        ),
        h('button', {
          class: 'btn btn-primary btn-lg btn-block',
          onclick: () => {
            savePrefs(gameId, prefs);
            wrap.remove();
            resolve(prefs);
          },
        }, icon('play', 18), startLabel),
      ),
    );
    root.append(wrap);
  });
}

export function showResult({ outcome, title, text, again = 'Нова игра' }) {
  const t = title || { win: 'Победа!', loss: 'Загуба', draw: 'Реми' }[outcome];
  if (outcome === 'win') sound('win');
  return modal({
    body: h('div', { class: `result-banner ${outcome}` },
      h('div', { style: { fontSize: '44px' } }, { win: '🏆', loss: '🎲', draw: '🤝' }[outcome]),
      h('div', { class: 'big' }, t),
      text && h('p', { class: 'muted' }, text),
    ),
    actions: [
      { label: 'Към игрите', value: 'exit' },
      { label: again, value: 'again', primary: true },
    ],
  });
}

export function confirmDialog(title, text, okLabel = 'Да', danger = false) {
  return modal({
    title,
    body: h('p', null, text),
    actions: [{ label: 'Отказ', value: false }, { label: okLabel, value: true, primary: !danger, danger }],
  });
}

// --- Синтезирани звуци (Web Audio), без файлове ---
let actx;
const MUTE_KEY = 'kare.muted';
export const isMuted = () => localStorage.getItem(MUTE_KEY) === '1';
export function setMuted(m) {
  localStorage.setItem(MUTE_KEY, m ? '1' : '0');
}

export function sound(kind) {
  if (isMuted() || motion.fast) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    const tone = (freq, dur, type = 'sine', vol = 0.15, delay = 0, slide = 0) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t + delay);
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + delay + dur);
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
      o.connect(g).connect(actx.destination);
      o.start(t + delay);
      o.stop(t + delay + dur + 0.02);
    };
    const noise = (dur, vol = 0.2, freq = 1800) => {
      const len = Math.floor(actx.sampleRate * dur);
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const src = actx.createBufferSource();
      const f = actx.createBiquadFilter();
      const g = actx.createGain();
      f.type = 'bandpass';
      f.frequency.value = freq;
      g.gain.value = vol;
      src.buffer = buf;
      src.connect(f).connect(g).connect(actx.destination);
      src.start();
    };
    switch (kind) {
      case 'move': tone(420, 0.08, 'triangle', 0.18, 0, 0.6); break;
      case 'capture': tone(300, 0.12, 'triangle', 0.22, 0, 0.5); noise(0.06, 0.25, 900); break;
      case 'check': tone(660, 0.12, 'sine', 0.12); tone(880, 0.14, 'sine', 0.1, 0.08); break;
      case 'card': noise(0.07, 0.35, 2600); break;
      case 'deal': noise(0.05, 0.25, 3200); break;
      case 'dice': for (let i = 0; i < 4; i++) noise(0.04, 0.3, 1200 + i * 300); break;
      case 'dieHit': noise(0.035, 0.45, 1500 + Math.random() * 900); tone(900 + Math.random() * 400, 0.03, 'triangle', 0.05); break;
      case 'checker': tone(240, 0.07, 'triangle', 0.25, 0, 0.7); noise(0.03, 0.2, 1500); break;
      case 'notify': tone(740, 0.1, 'sine', 0.1); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.11)); break;
    }
  } catch {}
}

export function muteButton() {
  const btn = h('button', { class: 'btn btn-ghost', title: 'Звук' });
  const draw = () => (btn.textContent = isMuted() ? '🔇 Звук' : '🔊 Звук');
  btn.onclick = () => {
    setMuted(!isMuted());
    draw();
  };
  draw();
  return btn;
}
