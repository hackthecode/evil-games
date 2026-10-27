// Блато за сървъра-съдия: ръцете, блатото и разменените карти са тайни.
import { makeDeck, shuffle, sortHand } from '../cards/cards.js';
import { seededRng } from '../../net/rng.js';
import {
  RANKS, SUITS, power, next, targetOf, deal, legalCards, trickWinner, exchangePlan, returnCards,
  aiTrump, aiGive, aiDiscard, aiPlay,
} from './engine.js';

const ORDER = ['S', 'H', 'C', 'D'];
const sortFor = (hand, trump) => sortHand(hand, power, trump ? [trump, ...ORDER.filter((s) => s !== trump)] : ORDER);

export default {
  init({ opts, seed }) {
    return {
      seed, target: Number(opts.target) || 10, score: [0, 0, 0], diff: [0, 0, 0],
      dealer: Math.floor(seededRng(seed, 'dealer')() * 3), dealNo: 0, phase: 'deal', h: null, last: null,
    };
  },

  next(S) {
    const h = S.h;
    switch (S.phase) {
      case 'deal': return { seat: -1, type: 'deal' };
      case 'give': return { seat: h.plan[h.pi].from, type: 'give' };
      case 'take': return { seat: -1, type: 'take' };
      case 'trump': return { seat: S.dealer, type: 'trump' };
      case 'discard': return { seat: S.dealer, type: 'discard' };
      case 'play': return { seat: h.turn, type: 'card' };
      case 'score': return { seat: -1, type: 'score' };
      default: return null;
    }
  },

  validate(S, p, type, data) {
    const h = S.h;
    const own = (ids, n) => Array.isArray(ids) && ids.length === n && new Set(ids).size === n && ids.every((id) => h.hands[p].some((c) => c.id === id));
    if (type === 'give') return own(data, h.plan[h.pi].count);
    if (type === 'discard') return own(data, 4);
    if (type === 'trump') return SUITS.includes(data);
    if (type === 'card') return legalCards(h.hands[p], h.trick).some((c) => c.id === data);
    return false;
  },

  apply(S, p, type, data) {
    const h = S.h;
    if (type === 'deal') {
      S.dealNo++;
      const d = deal(shuffle(makeDeck(RANKS), seededRng(S.seed, `deal:${S.dealNo}`)));
      S.h = {
        hands: d.hands, kitty: d.kitty, trump: null, plan: exchangePlan(S.diff, S.dealer), pi: 0,
        exchanged: [[], [], []], tricks: [0, 0, 0], trick: [], t: 0, turn: -1, played: [],
      };
      S.phase = S.h.plan.length ? 'give' : 'take';
      return { dealNo: S.dealNo, dealer: S.dealer, plan: S.h.plan };
    }
    if (type === 'give') {
      const { from, to, count } = h.plan[h.pi];
      const give = data.map((id) => h.hands[from].find((c) => c.id === id));
      h.hands[from] = h.hands[from].filter((c) => !give.includes(c));
      const back = returnCards(h.hands[to], give);
      h.hands[to] = [...h.hands[to], ...give].filter((c) => !back.includes(c));
      h.hands[from].push(...back);
      // всеки участник вижда какво е дал и какво е получил
      h.exchanged[from].push({ with: to, gave: give, got: back });
      h.exchanged[to].push({ with: from, gave: back, got: give });
      h.pi++;
      if (h.pi >= h.plan.length) S.phase = 'take';
      return { from, to, count };
    }
    if (type === 'take') {
      h.hands[S.dealer].push(...h.kitty);
      h.kitty = [];
      S.phase = 'trump';
      return { dealer: S.dealer };
    }
    if (type === 'trump') {
      h.trump = data;
      S.phase = 'discard';
      return { trump: data };
    }
    if (type === 'discard') {
      h.hands[p] = h.hands[p].filter((c) => !data.includes(c.id));
      h.turn = next(S.dealer);
      S.phase = 'play';
      return {};
    }
    if (type === 'card') {
      const card = h.hands[p].find((c) => c.id === data);
      h.hands[p] = h.hands[p].filter((c) => c !== card);
      h.trick.push({ p, card });
      h.played.push(card.id);
      if (h.trick.length < 3) {
        h.turn = next(p);
        return { card };
      }
      const w = trickWinner(h.trick, h.trump);
      h.tricks[w]++;
      h.trick = [];
      h.t++;
      h.turn = w;
      if (h.t === 16) S.phase = 'score';
      return { card, trick: { winner: w } };
    }
    if (type === 'score') {
      S.diff = [0, 1, 2].map((q) => h.tricks[q] - targetOf(q, S.dealer));
      S.diff.forEach((x, q) => (S.score[q] += x));
      S.last = { tricks: h.tricks.slice(), diff: S.diff.slice(), dealer: S.dealer, dealNo: S.dealNo };
      const best = Math.max(...S.score);
      if (best >= S.target && S.score.filter((x) => x === best).length === 1) S.phase = 'over';
      else {
        S.dealer = next(S.dealer);
        S.phase = 'deal';
      }
      return { ...S.last, score: S.score.slice() };
    }
    return null;
  },

  view(S, p) {
    const h = S.h;
    const v = { seat: p, score: S.score.slice(), dealer: S.dealer, dealNo: S.dealNo, phase: S.phase, last: S.last, target: S.target };
    if (!h) return v;
    const nx = this.next(S);
    let decision = null;
    if (nx && nx.seat === p) {
      if (nx.type === 'give') decision = { type: 'give', count: h.plan[h.pi].count, to: h.plan[h.pi].to };
      else if (nx.type === 'card') decision = { type: 'card', legal: legalCards(h.hands[p], h.trick).map((c) => c.id) };
      else decision = { type: nx.type };
    }
    return {
      ...v,
      hand: sortFor(h.hands[p], h.trump),
      counts: h.hands.map((x) => x.length),
      kitty: h.kitty.length,
      trump: h.trump,
      trick: h.trick,
      tricks: h.tricks.slice(),
      targets: [0, 1, 2].map((q) => targetOf(q, S.dealer)),
      exchanged: h.exchanged[p],
      turn: nx && nx.seat >= 0 ? nx.seat : -1,
      decision,
    };
  },

  ai(S, p, type) {
    const h = S.h;
    if (type === 'give') return aiGive(h.hands[p], h.plan[h.pi].count).map((c) => c.id);
    if (type === 'trump') return aiTrump(h.hands[p]);
    if (type === 'discard') return aiDiscard(h.hands[p], h.trump).map((c) => c.id);
    return aiPlay({ hand: h.hands[p], trick: h.trick, trump: h.trump, played: new Set(h.played) }).id;
  },

  result(S) {
    const best = Math.max(...S.score);
    return { winners: [S.score.indexOf(best)], score: S.score.slice() };
  },
};
