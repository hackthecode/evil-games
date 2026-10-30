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
