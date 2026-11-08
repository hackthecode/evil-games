// Shared table effects for the card games: avatars next to the names, the "your turn" chip,
// the flash on the player who took a trick, speech bubbles with a tail and the trump mark.
import { h, motion, AVATAR_COLORS } from '../../ui.js';
import { suitSvg, isRed } from '../cards/suits.js';
import { txt } from '../../i18n.js';

const reduced = () => motion.fast || matchMedia('(prefers-reduced-motion: reduce)').matches;
const colorOf = (name) => AVATAR_COLORS[[...String(name)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length];

/**
 * The name plate of a seat: avatar, name, an optional extra (e.g. tricks 3/5) and the
 * "your turn" chip, shown by CSS while the seat has the class "turn".
 */
export function seatLabel(name, { me = false } = {}) {
  const extra = h('small', { class: 'sn-extra', hidden: true });
  const el = h('span', { class: `seat-name${me ? ' me' : ''}` },
    h('span', { class: 'sn-av', style: { '--av': colorOf(name) } }, String(name || '?').slice(0, 1).toUpperCase()),
    h('span', { class: 'sn-text' }, name),
    extra,
    me && h('span', { class: 'sn-turn' }, txt('your turn')));
  el.setExtra = (text) => { extra.textContent = text || ''; extra.hidden = !text; };
  return el;
}

/** A short flash on the name of the player who took the trick, with a floating label ("+14"). */
export function flashWinner(nameEl, label = '') {
  if (reduced()) return;
  nameEl.classList.remove('took');
  void nameEl.offsetWidth;
  nameEl.classList.add('took');
  setTimeout(() => nameEl.classList.remove('took'), 1100);
  if (!label) return;
  const r = nameEl.getBoundingClientRect();
  const pop = h('div', { class: 'took-pop' }, label);
  pop.style.left = r.left + r.width / 2 + 'px';
  pop.style.top = r.top + 'px';
  document.body.append(pop);
  setTimeout(() => pop.remove(), 1300);
}

/**
 * A speech bubble next to a name plate. side: where the bubble goes relative to the name –
 * 'below' (top seat), 'above' (me), 'left' (right seat) or 'right' (left seat); the tail points at the name.
 */
export function speak(tableEl, nameEl, html, { side = 'below', gold = false, ms = 1700, above = 0 } = {}) {
  if (motion.fast) return;
  const r = nameEl.getBoundingClientRect();
  const tr = tableEl.getBoundingClientRect();
  const b = h('div', { class: `bubble tail-${side}${gold ? ' gold' : ''}`, html });
  tableEl.append(b);
  const bw = b.offsetWidth, bh = b.offsetHeight;
  const cx = r.left - tr.left + r.width / 2;
  let x = cx - bw / 2, y = r.bottom - tr.top + 12;
  if (side === 'above') y = r.top - tr.top - bh - 12 - above;
  if (side === 'left') { x = r.left - tr.left - bw - 12; y = r.top - tr.top + r.height / 2 - bh / 2; }
  if (side === 'right') { x = r.right - tr.left + 12; y = r.top - tr.top + r.height / 2 - bh / 2; }
  const left = Math.max(6, Math.min(x, tr.width - bw - 6));
  b.style.left = left + 'px';
  b.style.top = Math.max(6, y) + 'px';
  // keep the tail pointing at the name even when the bubble was pushed away from the edge
  if (side === 'below' || side === 'above') b.style.setProperty('--tail-x', Math.max(14, Math.min(bw - 14, cx - left)) + 'px');
  setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 300); }, ms);
}

const NAMES = () => ({ NT: txt('No trumps'), AT: txt('All trumps') });

function markFace(contract) {
  if (contract === 'AT') return `<span class="tm-all">${['S', 'H', 'C', 'D'].map((s) => suitSvg(s, 'suit' + (isRed(s) ? ' red' : ''))).join('')}</span>`;
  if (contract === 'NT') return '<span class="tm-none">✕</span>';
  return suitSvg(contract, 'suit' + (isRed(contract) ? ' red' : ''));
}

/**
 * The large trump sign in the corner of the table. set(contract) – a suit letter, 'NT', 'AT'
 * or null; when a new trump appears it is shown big in the middle and then moves to the corner.
 */
export function trumpMark(tableEl) {
  const el = h('div', { class: 'trump-mark', hidden: true, 'aria-live': 'polite' });
  tableEl.append(el);
  let cur = null;
  return {
    el,
    set(contract) {
      if (contract === cur) return;
      const fresh = !cur && contract;
      cur = contract || null;
      el.hidden = !cur;
      if (!cur) return;
      const label = NAMES()[cur] || txt('Trumps');
      el.title = label;
      el.innerHTML = `<div class="tm-face">${markFace(cur)}</div><small>${label}</small>`;
      if (!fresh || reduced()) return;
      const r = el.getBoundingClientRect();
      const tr = tableEl.getBoundingClientRect();
      const dx = tr.left + tr.width / 2 - (r.left + r.width / 2);
      const dy = tr.top + tr.height * 0.44 - (r.top + r.height / 2);
      const big = `translate(${dx}px, ${dy}px) scale(2.6)`;
      // above the flying cards while it is big
      el.classList.add('announce');
      el.animate([
        { transform: `${big} scale(.4)`, opacity: 0 },
        { transform: big, opacity: 1, offset: 0.2 },
        { transform: big, opacity: 1, offset: 0.62 },
        { transform: 'none', opacity: 1 },
      ], { duration: 1700, easing: 'cubic-bezier(.4,0,.2,1)' }).finished.finally(() => el.classList.remove('announce'));
    },
  };
}
