// Blato help for beginners: card details for the tooltips and why a card can't be played.
import { txt } from '../../i18n.js';
import { power, trickWinner } from './engine.js';
import { suitName } from '../cards/cardtips.js';

/** ctx: { trump, hand, trick, legal (ids) | null }. */
export function cardLines(card, { trump, hand, trick, legal }) {
  const out = [];
  if (trump) out.push(card.s === trump ? { text: txt('Trump ★ – beats every card of the other suits.'), tone: 'trump' } : { text: txt('Not a trump (trumps: {0}).', suitName(trump)), tone: 'info' });
  else out.push({ text: txt('Trumps are not chosen yet.'), tone: 'info' });
  const place = 13 - power(card);
  out.push({ text: place === 1 ? txt('The strongest card of its suit.') : txt('Strength: {0} of 13 in its suit (1 is the strongest).', place), tone: 'info' });
  if (legal && hand?.some((c) => c.id === card.id)) {
    if (legal.includes(card.id)) {
      const wins = trick?.length && trickWinner([...trick, { p: -1, card }], trump) === -1;
      out.push({ text: txt('✔ You can play this card now.'), tone: 'good' });
      if (trick?.length) out.push(wins ? { text: txt('It would take the trick (for now).'), tone: 'good' } : { text: txt('It would not take the trick.'), tone: 'info' });
    } else out.push({ text: '✖ ' + txt('You must follow suit: you have {0}, so you must play one of them.', suitName(trick[0].card.s)), tone: 'bad' });
  }
  return out;
}

export const illegalReason = (card, trick) => txt('You must follow suit: you have {0}, so you must play one of them.', suitName(trick[0].card.s));
