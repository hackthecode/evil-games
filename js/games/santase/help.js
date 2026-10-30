// Santase help for beginners: card details for the tooltips and why a card can't be played.
import { txt } from '../../i18n.js';
import { PTS, order } from './engine.js';
import { suitName } from '../cards/cardtips.js';

/** ctx: { trump, hand, lead (the card on the table) | null, strict, legal (ids) | null }. */
export function cardLines(card, { trump, hand, lead, strict, legal }) {
  const out = [];
  if (trump) out.push(card.s === trump ? { text: txt('Trump ★ – beats every card of the other suits.'), tone: 'trump' } : { text: txt('Not a trump (trumps: {0}).', suitName(trump)), tone: 'info' });
  out.push({ text: PTS[card.r] ? txt('Worth {0} points.', PTS[card.r]) : txt('Worth no points.'), tone: 'info' });
  const place = 6 - order(card);
  out.push({ text: place === 1 ? txt('The strongest card of its suit.') : txt('Strength: {0} of 6 in its suit (1 is the strongest).', place), tone: 'info' });
  if (legal && hand?.some((c) => c.id === card.id)) {
    out.push(legal.includes(card.id) ? { text: txt('✔ You can play this card now.'), tone: 'good' } : { text: '✖ ' + illegalReason(card, hand, lead, trump, strict), tone: 'bad' });
  }
  if (!strict && lead && legal) out.push({ text: txt('While there is a stock you may play any card.'), tone: 'info' });
  return out;
}

export function illegalReason(card, hand, lead, trump) {
  if (!lead) return txt('It is not your turn.');
  const same = hand.filter((c) => c.s === lead.s);
  if (same.length && card.s !== lead.s) return txt('The stock is closed: you must follow suit – you have {0}.', suitName(lead.s));
  if (same.length) return txt('The stock is closed: you must play a higher {0} card when you have one.', suitName(lead.s));
  if (card.s !== trump) return txt('You have no {0}, so you must trump – play a {1} card.', suitName(lead.s), suitName(trump));
  return txt('This card can\'t be played now.');
}
