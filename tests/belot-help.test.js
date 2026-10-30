// Belot help for beginners: the explanations match the rules (legalCards).
import { test, ok, eq } from './harness.js';
import { legalCards } from '../js/games/belot/engine.js';
import { illegalReason, turnHint } from '../js/games/belot/help.js';

const c = (id) => ({ id, r: id.slice(0, -1), s: id.slice(-1) });
const hand = ['AH', '7H', 'KS', '9C', 'JC'].map(c);

test('belot help: must follow suit', () => {
  const trick = [{ p: 1, card: c('10H') }];
  const legal = legalCards(hand, trick, 'C', 0).map((x) => x.id);
  eq(legal.sort(), ['7H', 'AH']);
  ok(/follow suit/.test(illegalReason(c('KS'), hand, trick, 'C', 0)));
  ok(/Follow suit/.test(turnHint(hand, trick, 'C', 0)));
});

test('belot help: no such suit – must trump', () => {
  const trick = [{ p: 1, card: c('10D') }];
  const legal = legalCards(hand, trick, 'C', 0).map((x) => x.id);
  eq(legal.sort(), ['9C', 'JC']);
  ok(/must trump/.test(illegalReason(c('AH'), hand, trick, 'C', 0)));
});

test('belot help: partner winning – any card', () => {
  const trick = [{ p: 1, card: c('AD') }, { p: 2, card: c('8D') }]; // player 1 is the partner of player 3
  eq(legalCards(hand, trick, 'C', 3).length, hand.length);
  ok(/partner/.test(turnHint(hand, trick, 'C', 3)));
});

test('belot advice: a sure trick for the partner – give points, not the weakest card', async () => {
  const { playAdvice } = await import('../js/games/belot/help.js');
  // player 3 plays last; player 1 (the partner) is winning with the ace of diamonds
  const trick = [{ p: 0, card: c('8D') }, { p: 1, card: c('AD') }, { p: 2, card: c('7D') }];
  const { card } = playAdvice(hand, trick, 'C', 3, trick.map((t) => t.card.id), 1);
  eq(card.id, 'KS', 'a card with points (keeping trumps and the ace of hearts for later)');
});

test('belot advice: the partner can still be beaten – a weak card', async () => {
  const { playAdvice } = await import('../js/games/belot/help.js');
  // player 1 (the partner) is winning with the queen of diamonds; player 0 still plays after me
  const trick = [{ p: 1, card: c('QD') }, { p: 2, card: c('8D') }];
  const { card } = playAdvice(hand, trick, 'C', 3, ['QD', '8D'], 1);
  eq(card.id, '7H');
});
