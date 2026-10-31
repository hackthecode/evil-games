// Santase help for beginners: card details for the tooltips and why a card can't be played.
import { txt } from '../../i18n.js';
import { PTS, order, aiChoose } from './engine.js';
import { suitName, suitChip, cardName } from '../cards/cardtips.js';

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

/** What to do on your turn (HTML with coloured suits). v – the view, me – my seat. */
export function turnHint(v) {
  const strict = v.closedBy >= 0 || v.stock === 0;
  if (!v.lead) {
    return strict ? txt('You lead. The stock is closed: the opponent must follow suit, so lead your strongest cards.')
      : txt('You lead: play any card. Holding the queen and king of one suit? Play one of them to declare 20 (40 in trumps).');
  }
  const L = suitChip(v.lead.card.s);
  if (strict) return txt('Answer {0}: follow suit and beat it if you can; with no {0}, you must trump.', L);
  return txt('Answer {0}: while there is a stock you may play any card – take it only if it brings points.', L);
}

/** The suggested card and why: { card, text }. me – my seat, seen – card ids already played. */
export function playAdvice(v, me, seen) {
  const d = {
    hands: me === 0 ? [v.hand, []] : [[], v.hand], lead: v.lead, trump: v.trump, closedBy: v.closedBy,
    stock: new Array(v.stock || 0), points: v.points || [0, 0], pending: [0, 0], tricks: [1, 1], leader: me,
  };
  const { card, why } = aiChoose(d, me, seen);
  const name = cardName(card);
  const text = {
    only: txt('{0} – it is the only card you may play.', name),
    marriage: txt('{0} – you hold the queen and king of this suit: playing it declares {1}.', name, card.s === v.trump ? 40 : 20),
    'lead-trump-master': txt('{0} – your highest trump: nobody can beat it.', name),
    'lead-master': txt('{0} – nobody has a stronger card of this suit, so it takes the trick.', name),
    'lead-low': txt('{0} – a weak card: you keep trumps and pairs for later.', name),
    'strict-win': txt('{0} – the cheapest card that beats the opponent\'s card.', name),
    'strict-lose': txt('{0} – you can\'t take this trick, so give the weakest card.', name),
    'take-points': txt('{0} – it takes the trick and brings many points.', name),
    'take-cheap': txt('{0} – it takes the trick cheaply.', name),
    'trump-take': txt('{0} – a trump: worth it because the opponent\'s card has many points.', name),
    throw: txt('{0} – the trick isn\'t worth fighting for, so give a weak card.', name),
  }[why];
  return { card, text };
}
