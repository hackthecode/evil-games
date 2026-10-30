// Card tooltips for beginners: hovering a card (or a long press on touch screens) shows what the
// card is ("Ace of spades"), its suit and colour, plus game-specific lines (trump, points, whether
// it can be played and why not). Browser only – cards.js stays usable on the server.
import { txt } from '../../i18n.js';
import { suitSvg, isRed } from './suits.js';
import { h } from '../../ui.js';

const RANK_NAMES = {
  2: txt('Two'), 3: txt('Three'), 4: txt('Four'), 5: txt('Five'), 6: txt('Six'), 7: txt('Seven'), 8: txt('Eight'),
  9: txt('Nine'), 10: txt('Ten'), J: txt('Jack'), Q: txt('Queen'), K: txt('King'), A: txt('Ace'),
};
const SUIT_LABEL = { C: txt('Clubs'), D: txt('Diamonds'), H: txt('Hearts'), S: txt('Spades') };
const OF_SUIT = { C: (r) => txt('{0} of clubs', r), D: (r) => txt('{0} of diamonds', r), H: (r) => txt('{0} of hearts', r), S: (r) => txt('{0} of spades', r) };

export const rankName = (r) => RANK_NAMES[r] || r;
export const suitName = (s) => SUIT_LABEL[s];
/** "Ace of spades" */
export const cardName = (c) => OF_SUIT[c.s](rankName(c.r));
export const parseCardId = (id) => ({ id, r: id.slice(0, -1), s: id.slice(-1) });

/** A suit with its symbol in colour, as HTML: ♠ Spades */
export const suitChip = (s) => `<span class="suit-chip ${isRed(s) ? 'red' : 'black'}">${suitSvg(s)}${suitName(s)}</span>`;

// The active game adds its own lines: (card, el) → [{ text, tone: 'good' | 'bad' | 'trump' | 'info' }].
let provider = null;
export function setCardInfo(fn) {
  provider = fn;
  return () => { if (provider === fn) provider = null; hide(); };
}

let tip = null;
let shownFor = null;
function hide() {
  tip?.remove();
  tip = null;
  shownFor = null;
}

function show(el) {
  if (shownFor === el) return;
  hide();
  const c = parseCardId(el.dataset.id);
  if (!c.s || !'CDHS'.includes(c.s)) return;
  const red = isRed(c.s);
  const extra = (provider?.(c, el) || []).filter(Boolean);
  tip = h('div', { class: 'card-tip', role: 'tooltip' },
    h('div', { class: 'card-tip-head' },
      h('span', { class: `card-tip-suit ${red ? 'red' : 'black'}`, html: suitSvg(c.s) }),
      h('div', null,
        h('b', null, cardName(c)),
        h('small', null, txt('Suit: {0} · {1}', suitName(c.s), red ? txt('a red suit') : txt('a black suit'))))),
    extra.length ? h('ul', null, extra.map((x) => h('li', { class: x.tone || 'info' }, x.text))) : null);
  document.body.append(tip);
  shownFor = el;
  place(el);
}

function place(el) {
  if (!tip) return;
  const r = el.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2;
  let y = r.top - th - 10;
  if (y < 8) y = r.bottom + 10;
  x = Math.max(8, Math.min(x, innerWidth - tw - 8));
  y = Math.max(8, Math.min(y, innerHeight - th - 8));
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}

// One set of listeners for the whole page (cards are created and removed all the time).
let installed = false;
export function enableCardTips() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const cardOf = (e) => e.target.closest?.('.card[data-id]');
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = cardOf(e);
    if (el && !el.closest('.dragging, .fly')) show(el);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = cardOf(e);
    if (el && !el.contains(e.relatedTarget)) hide();
  });
  // touch: a long press shows the tip; the click that follows the long press is ignored
  let timer = null, longPressed = false;
  document.addEventListener('pointerdown', (e) => {
    hide();
    if (e.pointerType === 'mouse') return;
    const el = cardOf(e);
    if (!el) return;
    longPressed = false;
    clearTimeout(timer);
    timer = setTimeout(() => { longPressed = true; show(el); }, 450);
  }, true);
  const cancel = () => clearTimeout(timer);
  document.addEventListener('pointerup', cancel, true);
  document.addEventListener('pointercancel', cancel, true);
  document.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' && Math.abs(e.movementX) + Math.abs(e.movementY) > 6) cancel(); }, true);
  document.addEventListener('click', (e) => {
    if (longPressed) { longPressed = false; e.stopPropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener('contextmenu', (e) => { if (cardOf(e)) e.preventDefault(); });
  addEventListener('scroll', hide, true);
  addEventListener('hashchange', hide);
}
