// Blato help for beginners: card details for the tooltips and why a card can't be played.
import { txt } from '../../i18n.js';
import { power, trickWinner, aiChoose } from './engine.js';
import { suitName, suitChip, cardName } from '../cards/cardtips.js';

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

/** What to do on your turn (HTML with coloured suits). */
export function turnHint(v, me) {
  const need = v.targets?.[me] ?? 0, have = v.tricks?.[me] ?? 0;
  const goal = need > have ? txt('You have {0} of {1} tricks – you need {2} more.', have, need, need - have) : txt('You have {0} of {1} tricks – every extra trick is +1.', have, need);
  if (!v.trick?.length) return `${txt('You lead: play any card.')} ${goal}`;
  const led = v.trick[0].card.s;
  if (v.hand.some((c) => c.s === led)) return `${txt('Follow suit: play a {0} card.', suitChip(led))} ${goal}`;
  return `${txt('You have no {0}: play any card – a trump takes the trick.', suitChip(led))} ${goal}`;
}

/** The suggested card and why: { card, text }. played – card ids already played in this deal. */
export function playAdvice(v, played) {
  const { card, why } = aiChoose({ hand: v.hand, trick: v.trick || [], trump: v.trump, played: new Set(played) });
  const name = cardName(card);
  const text = {
    only: txt('{0} – it is the only card you may play.', name),
    'lead-sure': txt('{0} – nobody has a stronger card of this suit, so it takes the trick.', name),
    'lead-low': txt('{0} – a weak card: you keep the strong ones for later.', name),
    'win-last': txt('{0} – you play last and it is the cheapest card that takes the trick.', name),
    'win-high': txt('{0} – your strongest card of this suit, so the player after you can\'t beat it easily.', name),
    'win-cheap': txt('{0} – the cheapest trump that takes the trick.', name),
    'lose-low': txt('{0} – you can\'t take this trick, so give the weakest card.', name),
  }[why];
  return { card, text };
}
