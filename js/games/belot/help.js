// Belot help for beginners: what to do on your turn, why a card can't be played, what a bid means,
// card details for the tooltips and the computer's suggestion (bid or card).
import { txt } from '../../i18n.js';
import { RANKS, CONTRACT_NAMES, isTrump, order, cardPoints, trickWinner, teamOf, legalCards, aiBid, aiPlay } from './engine.js';
import { cardName, suitName, suitChip } from '../cards/cardtips.js';

const isSuit = (c) => c.length === 1;

/** Tooltip lines for a card. ctx: { contract, hand, trick, me, legal (ids) | null }. */
export function cardLines(card, { contract, hand, trick, me, legal }) {
  if (!contract) return [{ text: txt('Trumps are not chosen yet – the bidding decides them.'), tone: 'info' }];
  const out = [];
  const trump = isTrump(card, contract);
  if (contract === 'AT') out.push({ text: txt('All trumps: every suit is trumps.'), tone: 'trump' });
  else if (contract === 'NT') out.push({ text: txt('No trumps: the highest card of the suit led wins.'), tone: 'info' });
  else out.push(trump ? { text: txt('Trump ★ – beats every card of the other suits.'), tone: 'trump' } : { text: txt('Not a trump (trumps: {0}).', suitName(contract)), tone: 'info' });
  const pts = cardPoints(card, contract);
  out.push({ text: pts ? txt('Worth {0} points.', pts) : txt('Worth no points.'), tone: 'info' });
  const place = RANKS.length - order(card, contract);
  out.push({ text: place === 1 ? txt('The strongest card of its suit.') : txt('Strength: {0} of 8 in its suit (1 is the strongest).', place), tone: 'info' });
  if (legal && hand?.some((c) => c.id === card.id)) {
    out.push(legal.includes(card.id) ? { text: txt('✔ You can play this card now.'), tone: 'good' } : { text: '✖ ' + illegalReason(card, hand, trick, contract, me), tone: 'bad' });
  }
  return out;
}

/** Why the card can't be played now (the rules of belot). */
export function illegalReason(card, hand, trick, contract, me) {
  if (!trick.length) return txt('It is not your turn.');
  const led = trick[0].card.s;
  const follow = hand.filter((c) => c.s === led);
  if (follow.length && card.s !== led) return txt('You must follow suit: you have {0}, so you must play one of them.', suitName(led));
  if (follow.length) return txt('In trumps you must play a higher card than the ones on the table when you have one.');
  if (isSuit(contract)) {
    const winner = trickWinner(trick, contract);
    if (teamOf(winner.p) !== teamOf(me) && hand.some((c) => c.s === contract)) {
      if (card.s !== contract) return txt('You have no {0}, so you must trump – play a {1} card.', suitName(led), suitName(contract));
      return txt('You must trump with a higher trump than the one on the table.');
    }
  }
  return txt('This card can\'t be played now.');
}

/** What to do on your turn – one short sentence (HTML: the suits as coloured chips). */
export function turnHint(hand, trick, contract, me) {
  if (!trick.length) return txt('You lead: play any card. The others must follow its suit.');
  const led = trick[0].card.s;
  const winner = trickWinner(trick, contract);
  const partner = teamOf(winner.p) === teamOf(me);
  const L = suitChip(led), T = isSuit(contract) ? suitChip(contract) : '';
  if (hand.some((c) => c.s === led)) {
    const higher = legalCards(hand, trick, contract, me).length < hand.filter((c) => c.s === led).length;
    return higher ? txt('Follow suit with a higher {0} card – in trumps you must go higher.', L) : txt('Follow suit: play a {0} card.', L);
  }
  if (isSuit(contract) && !partner && hand.some((c) => c.s === contract)) return txt('You have no {0} – you must trump with a {1} card.', L, T);
  return partner ? txt('You have no {0} and your partner is winning – play any card (one with points is good).', L) : txt('You have no {0} – play any card (a weak one).', L);
}

/** What a bid means – shown on the bidding buttons. */
export function bidMeaning(bid) {
  if (bid === 'pass') return txt('Pass: you don\'t bid. If everyone passes, the cards are dealt again.');
  if (bid === 'double') return txt('Double: you think the opponents will fail – the points are doubled.');
  if (bid === 'redouble') return txt('Redouble: you are sure of your bid – the points are multiplied by 4.');
  if (bid === 'NT') return txt('No trumps: there are no trumps; the ace is the strongest card in each suit.');
  if (bid === 'AT') return txt('All trumps: every suit is trumps; the jacks and nines are the strongest.');
  return txt('{0} are trumps: they beat all other suits. The strongest trumps are the jack and the nine.', CONTRACT_NAMES[bid]);
}

/** The computer's suggestion for the bidding, as HTML. */
export function bidAdvice(hand, bidding, me) {
  const bid = aiBid(hand, bidding, me);
  if (bid === 'pass') return txt('💡 Tip: pass – your cards are too weak to bid.');
  if (bid === 'double') return txt('💡 Tip: double – the opponents will probably fail.');
  const why = bid === 'AT' ? txt('you have jacks and nines') : bid === 'NT' ? txt('you have aces and tens') : txt('you have strong {0} (jack, nine)', suitName(bid));
  return txt('💡 Tip: bid {0} – {1}.', isSuit(bid) ? suitChip(bid) : CONTRACT_NAMES[bid], why);
}

/** The card the computer would play. */
export const playAdvice = (hand, trick, contract, me, played, bidTeam) => aiPlay({ hand, trick, contract, me, played, bidTeam });

/** "Petar took the trick with the ace of spades (a trump)." */
export function trickNote(name, card, contract, ledSuit) {
  const trumped = isSuit(contract) && card.s === contract && ledSuit !== contract;
  return trumped ? txt('{0} took the trick with the {1} – a trump beats the other suits.', name, cardName(card)) : txt('{0} took the trick with the {1}.', name, cardName(card));
}
