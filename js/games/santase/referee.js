// Santase for the referee server: the full state (with both players' cards) is only here,
// each player gets a view with their own cards.
import { makeDeck, shuffle } from '../cards/cards.js';
import { seededRng } from '../../net/rng.js';
import {
  RANKS, newDeal, legalCards, play, canClose, canExchange, exchange, scoreOf, dealResult,
  aiPlay, aiDecideAction,
} from './engine.js';

export const TARGET = 11;

export default {
  init({ seats, opts = {}, seed }) {
    return {
      seed, seats: seats.length, level: opts.level || 'normal', score: [0, 0], dealNo: 0, phase: 'deal',
      dealer: seededRng(seed, 'dealer')() < 0.5 ? 0 : 1,
      d: null, seen: [], last: null,
    };
  },

  next(S) {
    if (S.phase === 'deal') return { seat: -1, type: 'deal' };
    if (S.phase === 'score') return { seat: -1, type: 'score' };
    if (S.phase === 'play') return { seat: S.d.lead ? 1 - S.d.lead.p : S.d.leader, type: 'act' };
    return null;
  },

  validate(S, p, type, a) {
    const d = S.d;
    if (type !== 'act' || !a) return false;
    if (a.kind === 'exchange') return canExchange(d, p);
    if (a.kind === 'close') return canClose(d, p);
    return a.kind === 'card' && legalCards(d, p).some((c) => c.id === a.card);
  },

  apply(S, p, type, a) {
    if (type === 'deal') {
      S.dealNo++;
      S.d = newDeal(shuffle(makeDeck(RANKS), seededRng(S.seed, `deal:${S.dealNo}`)), S.dealer);
      S.seen = [];
      S.phase = 'play';
      return { dealNo: S.dealNo, dealer: S.dealer, leader: S.d.leader, trump: S.d.stock[0] };
    }
    if (type === 'score') {
      const r = dealResult(S.d);
      S.score[r.winner] += r.gp;
      S.last = { ...r, points: [scoreOf(S.d, 0), scoreOf(S.d, 1)], tricks: S.d.tricks.slice() };
      S.phase = S.score[0] >= TARGET || S.score[1] >= TARGET ? 'over' : 'deal';
      if (S.phase === 'deal') S.dealer = 1 - S.dealer;
      return { ...S.last, score: S.score.slice() };
    }
    const d = S.d;
    if (a.kind === 'exchange') {
      const nine = d.hands[p].find((c) => c.s === d.trump && c.r === '9');
      const old = d.stock[0];
      exchange(d, p);
      return { kind: 'exchange', nine, trumpCard: old };
    }
    if (a.kind === 'close') {
      d.closedBy = p;
      return { kind: 'close' };
    }
    const card = d.hands[p].find((c) => c.id === a.card);
    const stockBefore = d.stock.length;
    const ev = play(d, p, card);
    S.seen.push(card.id);
    if (d.winner >= 0) S.phase = 'score';
    return {
      kind: 'card', card, marriage: ev.marriage || 0,
      trick: ev.type === 'trick' ? { winner: ev.winner } : null,
      // the drawn cards are secret; it's public only whether the last one was the face-up trump
      drew: ev.drew ? { lastTrump: stockBefore === 2 } : null,
    };
  },

  view(S, p) {
    const d = S.d;
    const v = { seat: p, score: S.score.slice(), dealNo: S.dealNo, dealer: S.dealer, phase: S.phase, last: S.last };
    if (!d) return v;
    const my = S.phase === 'play' && (d.lead ? 1 - d.lead.p : d.leader) === p;
    return {
      ...v,
      hand: d.hands[p].slice(),
      oppCount: d.hands[1 - p].length,
      stock: d.stock.length,
      trumpCard: d.stock[0] || null,
      trump: d.trump,
      closedBy: d.closedBy,
      lead: d.lead,
      points: [scoreOf(d, 0), scoreOf(d, 1)],
      pending: d.pending.slice(),
      tricks: d.tricks.slice(),
      turn: S.phase === 'play' ? (d.lead ? 1 - d.lead.p : d.leader) : -1,
      decision: my ? { type: 'act', legal: legalCards(d, p).map((c) => c.id), canExchange: canExchange(d, p), canClose: canClose(d, p) } : null,
    };
  },

  ai(S, p) {
    const d = S.d;
    if (S.level === 'easy' && Math.random() < 0.4) {
      const legal = legalCards(d, p);
      return { kind: 'card', card: legal[Math.floor(Math.random() * legal.length)].id };
    }
    if (!d.lead && S.level !== 'easy') {
      for (const a of aiDecideAction(d, p, new Set(S.seen))) {
        if (a === 'exchange' && canExchange(d, p)) return { kind: 'exchange' };
        if (a === 'close' && canClose(d, p)) return { kind: 'close' };
      }
    }
    return { kind: 'card', card: aiPlay(d, p, new Set(S.seen)).id };
  },

  result(S) {
    const w = S.score[0] > S.score[1] ? 0 : 1;
    return { winners: [w], score: S.score.slice() };
  },
};
