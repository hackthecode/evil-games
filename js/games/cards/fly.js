// Card animations: flight along an arc and flipping, collecting a trick, FLIP of the hand.
import { cardEl } from './cards.js';
import { motion } from '../../ui.js';

const reduced = () => motion.fast || matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// The total rotation angle of the element and its parents (fan, table slots).
export function angleOf(el) {
  let a = 0;
  for (let e = el, i = 0; e && i < 3; e = e.parentElement, i++) {
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(e).transform);
    if (m) {
      const [ma, mb] = m[1].split(',').map(Number);
      a += (Math.atan2(mb, ma) * 180) / Math.PI;
    }
  }
  return a;
}

// Position (centre), size and angle of a card on the screen.
export function snap(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: el.offsetWidth, a: angleOf(el) };
}

function ghost(card) {
  const g = document.createElement('div');
  g.className = 'fly';
  const inner = document.createElement('div');
  inner.className = 'fly-in';
  const front = card instanceof Element ? card.cloneNode(true) : cardEl(card);
  front.classList.remove('playable', 'disabled');
  front.style.cssText = '';
  front.classList.add('fly-front');
  const back = cardEl(null, { faceDown: true, cls: 'fly-back' });
  inner.append(front, back);
  g.append(inner);
  document.body.append(g);
  return { g, inner };
}

/**
 * Flight of a card from `from` (snap) to `to` (a function returning the target element, or a snap).
 * The target element is hidden while the card flies and shown on landing.
 * card: a card object or an element to clone; faceFrom/faceTo: face up at the start/end.
 * via: an intermediate point (snap) – the card goes there first, then to the target.
 */
export function fly({
  card = null, from, to, faceFrom = !!card, faceTo = !!card, duration = 420, delay = 0,
  arc = 0.1, lift = 0.14, spin = 0, toScale = 1, toOpacity = 1, via = null, viaAt = 0.42, onStart,
}) {
  const getEl = typeof to === 'function' ? to : null;
  let target = getEl ? null : to;
  let el = null;
  const hide = () => {
    if (!getEl) return;
    const e = getEl();
    if (e) {
      if (el && el !== e) el.style.visibility = '';
      el = e;
      el.style.visibility = 'hidden';
      target = snap(el);
    }
  };
  hide();
  if (reduced() || !target) {
    if (el) {
      el.style.visibility = '';
      el.classList.remove('pending');
    }
    onStart?.();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let started = false, t0 = 0, gh = null;
    const frame = (now) => {
      if (!t0) t0 = now;
      hide();
      const el0 = now - t0 - delay;
      if (el0 < 0) return requestAnimationFrame(frame);
      if (!started) {
        started = true;
        gh = ghost(card);
        onStart?.();
      }
      const t = clamp(el0 / duration);
      const v = via ? clamp((t - viaAt) / (1 - viaAt)) : t;
      let a, b, u;
      if (via && t < viaAt) [a, b, u] = [from, via, easeOut(t / viaAt)];
      else [a, b, u] = [via || from, target, easeOut(v)];
      const bump = 4 * u * (1 - u);
      const dx = b.x - a.x, dy = b.y - a.y;
      const x = lerp(a.x, b.x, u) - dy * arc * bump;
      const y = lerp(a.y, b.y, u) + dx * arc * bump;
      const w = lerp(a.w, b.w, u);
      const ang = lerp(a.a + (a === from ? spin : 0), b.a, u);
      const sc = lerp(1, toScale, easeOut(v)) * (1 + lift * bump);
      const flip = lerp(faceFrom ? 0 : 180, faceTo ? 0 : 180, easeInOut(clamp((v - 0.12) / 0.66)));
      gh.g.style.width = w + 'px';
      gh.g.style.height = w * 1.4 + 'px';
      gh.g.style.transform = `translate(${x - w / 2}px, ${y - w * 0.7}px) rotate(${ang}deg) scale(${sc})`;
      gh.g.style.setProperty('--l', bump.toFixed(3));
      gh.g.style.opacity = toOpacity === 1 ? '' : String(lerp(1, toOpacity, clamp((v - 0.55) / 0.45)));
      gh.inner.style.transform = `rotateY(${flip}deg)`;
      if (t < 1) return requestAnimationFrame(frame);
      if (el) {
        el.style.visibility = '';
        el.classList.remove('pending');
      }
      gh.g.remove();
      resolve();
    };
    requestAnimationFrame(frame);
  });
}

// A light "thud" when a card lands on the table.
export function land(el) {
  if (reduced()) return;
  el.animate([{ transform: 'scale(1.07)' }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.3,.7,.4,1)' });
}

/**
 * Collects the cards from the table: first they stack on the winning card, then
 * fly to the winner, turning face down.
 */
export function collectTrick(cardEls, winnerEl, targetEl, { duration = 680 } = {}) {
  if (!cardEls.length) return Promise.resolve();
  const ordered = [...cardEls.filter((c) => c !== winnerEl), winnerEl].filter(Boolean);
  const w = snap(winnerEl || ordered[ordered.length - 1]);
  const tr = targetEl.getBoundingClientRect();
  const target = { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2, w: w.w, a: 0 };
  const froms = ordered.map(snap);
  ordered.forEach((el) => (el.style.visibility = 'hidden'));
  return Promise.all(ordered.map((el, i) => fly({
    card: el, from: froms[i], to: target, via: { ...w, a: w.a + (i - ordered.length + 1) * 5 },
    faceFrom: true, faceTo: false, duration, toScale: 0.45, toOpacity: 0, lift: 0.08, arc: 0.06,
  })));
}

// Smooth rearranging of the hand (FLIP): render() redraws the contents of container.
export function flipHand(container, render) {
  const before = new Map();
  for (const e of container.children) {
    if (e.dataset.id) before.set(e.dataset.id, { l: e.offsetLeft, t: e.offsetTop, tf: getComputedStyle(e).transform });
  }
  render();
  if (reduced() || !before.size) return;
  for (const e of container.children) {
    const b = before.get(e.dataset.id);
    if (!b) continue;
    const dl = b.l - e.offsetLeft, dt = b.t - e.offsetTop;
    const tf = getComputedStyle(e).transform;
    if (Math.abs(dl) < 1 && Math.abs(dt) < 1 && tf === b.tf) continue;
    const base = (x) => (x === 'none' ? '' : x);
    e.animate(
      [{ transform: `translate(${dl}px, ${dt}px) ${base(b.tf)}` }, { transform: base(tf) || 'none' }],
      { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }
}

// The deck on the table that is dealt from (with a shuffle animation).
export function deckEl(n) {
  const d = document.createElement('div');
  d.className = 'deal-deck';
  setDeckCount(d, n);
  return d;
}

export function setDeckCount(d, n) {
  const k = Math.max(0, Math.min(7, Math.ceil(n / 4)));
  while (d.children.length > k) d.lastElementChild.remove();
  while (d.children.length < k) {
    const c = cardEl(null, { faceDown: true });
    c.style.setProperty('--i', d.children.length);
    d.append(c);
  }
}

export function shuffleDeck(d, ms = 900) {
  if (reduced()) return Promise.resolve();
  d.classList.add('shuffle');
  return new Promise((r) => setTimeout(() => { d.classList.remove('shuffle'); r(); }, ms));
}
