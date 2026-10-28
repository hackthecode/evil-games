// Belot for the referee server: the hands of the four players are only here. Declarations and "belot"
// are computed by the referee and announced publicly in the move in which they are declared.
import { makeDeck, shuffle, sortHand } from '../cards/cards.js';
import { seededRng } from '../../net/rng.js';
import {
  RANKS, teamOf, legalCards, trickWinner, findDeclarations, resolveDeclarations, isBelot,
  scoreDeal, legalBids, applyBid, aiBid, aiPlay, cardPoints, handOrder,
} from './engine.js';
import { tk } from '../../i18n/tk.js';

const sortFor = (hand, contract) => (contract
  ? sortHand(hand, handOrder(contract))
  : sortHand(hand, (c) => RANKS.indexOf(c.r)));

export default {
  init({ opts, seed }) {
    return {
      seed, target: Number(opts.target) || 151, score: [0, 0], hanging: 0,
      dealer: Math.floor(seededRng(seed, 'dealer')() * 4), dealNo: 0, phase: 'deal', h: null, last: null,
    };
  },

  next(S) {
    const h = S.h;
    switch (S.phase) {
      case 'deal': return { seat: -1, type: 'deal' };
      case 'bid': return { seat: h.turn, type: 'bid' };
      case 'deal2': return { seat: -1, type: 'deal2' };
      case 'play': return { seat: h.turn, type: 'card' };
      case 'score': return { seat: -1, type: 'score' };
      default: return null;
    }
  },

  validate(S, p, type, data) {
    const h = S.h;
    if (type === 'bid') return legalBids(h.bidding, p).includes(data);
    if (type === 'card') return legalCards(h.hands[p], h.trick, h.contract, p).some((c) => c.id === data);
    return false;
  },

  apply(S, p, type, data) {
    const h = S.h;
    if (type === 'deal') {
      S.dealNo++;
      const deck = shuffle(makeDeck(RANKS), seededRng(S.seed, `deal:${S.dealNo}`));
      S.h = {
        deck, k: 0, hands: [[], [], [], []], bidding: { current: null, passes: 0, history: [] },
        contract: null, turn: (S.dealer + 1) % 4, trick: [], t: 0, tricks: [], tricksWon: [0, 0],
        played: [], decls: [[], [], [], []], belot: [0, 0],
      };
      dealRound(S.h, S.dealer, [3, 2]);
      S.phase = 'bid';
      return { dealNo: S.dealNo, dealer: S.dealer };
    }
    if (type === 'bid') {
      const done = applyBid(h.bidding, p, data);
      h.turn = (p + 1) % 4;
      if (done) {
        if (!h.bidding.current) {
          // everyone passed – a new deal with the next dealer
          S.dealer = (S.dealer + 1) % 4;
          S.phase = 'deal';
          return { bid: data, redeal: true };
        }
        h.contract = h.bidding.current.contract;
        S.phase = 'deal2';
      }
      return { bid: data };
    }
    if (type === 'deal2') {
      dealRound(h, S.dealer, [3]);
      h.turn = (S.dealer + 1) % 4;
      S.phase = 'play';
      return { contract: h.contract, mult: h.bidding.current.mult, bidder: h.bidding.current.player };
    }
    if (type === 'card') {
      const hand = h.hands[p];
      const card = hand.find((c) => c.id === data);
      const notes = [];
      if (h.t === 0) {
        const ds = findDeclarations(hand, h.contract);
        h.decls[p] = ds;
        notes.push(...ds.map((d) => d.name));
      }
      const belot = isBelot(card, hand, h.trick, h.contract);
      if (belot) {
        h.belot[teamOf(p)] += 20;
        notes.push(tk('Belot'));
      }
      h.hands[p] = hand.filter((c) => c !== card);
      h.trick.push({ p, card });
      h.played.push(card.id);
      const pub = { card, notes };
      if (h.trick.length < 4) {
        h.turn = (p + 1) % 4;
        return pub;
      }
      const w = trickWinner(h.trick, h.contract);
      const pts = h.trick.reduce((a, x) => a + cardPoints(x.card, h.contract), 0);
      h.tricks.push({ team: teamOf(w.p), points: pts });
      h.tricksWon[teamOf(w.p)]++;
      h.trick = [];
      h.t++;
      h.turn = w.p;
      if (h.t === 8) S.phase = 'score';
      return { ...pub, trick: { winner: w.p } };
    }
    if (type === 'score') {
      const cur = h.bidding.current;
      const decl = resolveDeclarations(h.decls);
      const res = scoreDeal({
        contract: h.contract, bidTeam: teamOf(cur.player), mult: cur.mult,
        tricks: h.tricks, declPts: decl.pts, belotPts: h.belot, hanging: S.hanging,
      });
      S.score[0] += res.gp[0];
      S.score[1] += res.gp[1];
      S.hanging = res.hanging;
      S.last = {
        res, decl: decl.pts, contract: h.contract, mult: cur.mult, bidder: cur.player,
        belot: h.belot.slice(), tricksWon: h.tricksWon.slice(), dealNo: S.dealNo,
      };
      const max = Math.max(...S.score);
      if (max >= S.target && S.score[0] !== S.score[1]) S.phase = 'over';
      else {
        S.dealer = (S.dealer + 1) % 4;
        S.phase = 'deal';
      }
      return { ...S.last, score: S.score.slice(), hanging: S.hanging };
    }
    return null;
  },

  view(S, p) {
    const h = S.h;
    const v = { seat: p, score: S.score.slice(), hanging: S.hanging, dealer: S.dealer, dealNo: S.dealNo, phase: S.phase, last: S.last, target: S.target };
    if (!h) return v;
    const turn = S.phase === 'bid' || S.phase === 'play' ? h.turn : -1;
    let decision = null;
    if (turn === p && S.phase === 'bid') decision = { type: 'bid', legal: legalBids(h.bidding, p) };
    if (turn === p && S.phase === 'play') decision = { type: 'card', legal: legalCards(h.hands[p], h.trick, h.contract, p).map((c) => c.id) };
    return {
      ...v,
      hand: sortFor(h.hands[p], h.contract),
      counts: h.hands.map((x) => x.length),
      bidding: { current: h.bidding.current, history: h.bidding.history },
      contract: h.contract,
      trick: h.trick,
      tricksWon: h.tricksWon.slice(),
      turn,
      decision,
    };
  },

  ai(S, p, type) {
    const h = S.h;
    if (type === 'bid') return aiBid(h.hands[p], h.bidding, p);
    return aiPlay({
      hand: h.hands[p], trick: h.trick, contract: h.contract, me: p,
      played: new Set(h.played), bidTeam: teamOf(h.bidding.current.player),
    }).id;
  },

  result(S) {
    const w = S.score[0] > S.score[1] ? 0 : 1;
    return { winners: [w, w + 2], score: S.score.slice() };
  },
};

function dealRound(h, dealer, counts) {
  for (const cnt of counts) {
    for (let i = 1; i <= 4; i++) {
      const p = (dealer + i) % 4;
      for (let j = 0; j < cnt; j++) h.hands[p].push(h.deck[h.k++]);
    }
  }
}
