// Shared functions for card games: rendering, deck, shuffling.
import { suitSvg, isRed } from './suits.js';
import { cryptoRng } from '../../net/rng.js';

export const SUITS = ['C', 'D', 'H', 'S'];

export function makeDeck(ranks) {
  const deck = [];
  for (const s of SUITS) for (const r of ranks) deck.push({ s, r, id: r + s });
  return deck;
}

// rnd: function → [0, 1); in online games it's the match's shared generator.
export function shuffle(arr, rnd = cryptoRng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PIPS = {
  2: [[50, 12], [50, 88]],
  3: [[50, 12], [50, 50], [50, 88]],
  4: [[25, 12], [75, 12], [25, 88], [75, 88]],
  5: [[25, 12], [75, 12], [50, 50], [25, 88], [75, 88]],
  6: [[25, 12], [75, 12], [25, 50], [75, 50], [25, 88], [75, 88]],
  7: [[25, 12], [75, 12], [50, 31], [25, 50], [75, 50], [25, 88], [75, 88]],
  8: [[25, 12], [75, 12], [50, 31], [25, 50], [75, 50], [50, 69], [25, 88], [75, 88]],
  9: [[25, 12], [75, 12], [25, 37], [75, 37], [50, 50], [25, 63], [75, 63], [25, 88], [75, 88]],
  10: [[25, 12], [75, 12], [50, 25], [25, 37], [75, 37], [25, 63], [75, 63], [50, 75], [25, 88], [75, 88]],
};

function centerHtml(c) {
  if (PIPS[c.r]) {
    return `<div class="pips">${PIPS[c.r]
      .map(([x, y]) => `<span class="pip${y > 55 ? ' flip' : ''}" style="left:${x}%;top:${y}%">${suitSvg(c.s)}</span>`)
      .join('')}</div>`;
  }
  return `<div class="ace">${suitSvg(c.s)}</div>`;
}

// Face cards (jack, queen, king): English pattern illustrations by Dmitry Fomin (CC0),
// recoloured in the portal's palette. Preloaded so there is no flicker.
const COURT = new Set(['J', 'Q', 'K']);
const courtSrc = (c) => `assets/cards/${c.r}${c.s}.svg`;
if (typeof Image !== 'undefined') for (const s of SUITS) for (const r of COURT) new Image().src = courtSrc({ r, s });

export function cardEl(card, { faceDown = false, cls = '' } = {}) {
  const el = document.createElement('div');
  if (faceDown || !card) {
    el.className = `card back ${cls}`;
    el.innerHTML = '<div class="card-back"></div>';
    return el;
  }
  el.className = `card ${isRed(card.s) ? 'red' : 'black'} ${cls}`;
  el.dataset.id = card.id;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', card.r + ' ' + card.s);
  const idx = `<span class="cr">${card.r}</span>${suitSvg(card.s)}`;
  const center = COURT.has(card.r)
    ? `<img class="court-art" src="${courtSrc(card)}" alt="" draggable="false" decoding="async">`
    : `<div class="cc">${centerHtml(card)}</div>`;
  if (COURT.has(card.r)) el.classList.add('court');
  el.innerHTML = `<div class="card-face">
      ${center}
      <div class="ci tl">${idx}</div>
      <div class="ci br">${idx}</div>
    </div>`;
  return el;
}

// Sorts a hand by suit (alternating colours) and strength.
export function sortHand(hand, rankOrder, suitOrder = ['S', 'H', 'C', 'D']) {
  return hand.slice().sort((a, b) => {
    const sa = suitOrder.indexOf(a.s), sb = suitOrder.indexOf(b.s);
    if (sa !== sb) return sa - sb;
    return rankOrder(a) - rankOrder(b);
  });
}

// Lays out the cards in the hand as a fan.
export function layoutFan(container, { spreadDeg = 5, lift = 0.6 } = {}) {
  const cards = [...container.children];
  const n = cards.length;
  cards.forEach((el, i) => {
    const t = i - (n - 1) / 2;
    el.style.setProperty('--rot', `${t * spreadDeg * (n > 6 ? 6 / n : 1)}deg`);
    el.style.setProperty('--lift', `${Math.abs(t) * Math.abs(t) * lift}px`);
    el.style.zIndex = i + 1;
  });
}
