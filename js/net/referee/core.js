// Referee server: runs the game authoritatively. Holds the deck and all hands,
// checks every decision, plays for the bots and the "system" steps
// (dealing, scoring), and gives each player a view with only their own cards.
//
// The same code runs: in the browser (game against the computer), in a SharedWorker
// (local online test, emulates a server) and in a Supabase Edge Function (real server).
// The state is plain JSON so the server can keep it in the database.
//
// Game reducer (js/games/<game>/referee.js):
//   init({ seats, opts, seed }) → S          seats: [{ bot: bool, name }]
//   next(S) → { seat, type } | null          seat -1 = system step; null = end
//   validate(S, seat, type, data) → bool
//   apply(S, seat, type, data) → pub         public data for the log
//   view(S, seat) → the player's view (cards, whose turn, possible decisions…)
//   ai(S, seat, type) → data                 a bot's decision
//   result(S) → { winners: [seat], ... }     at the end
import { tk } from '../../i18n/tk.js';

export function createMatch(reducer, { seats, opts = {}, seed }) {
  return wrap(reducer, { S: reducer.init({ seats, opts, seed }), seats, log: [] });
}

export function restoreMatch(reducer, saved) {
  return wrap(reducer, saved);
}

function wrap(reducer, M) {
  const humans = () => M.seats.map((s, i) => (s.bot ? -1 : i)).filter((i) => i >= 0);

  function step(seat, type, data) {
    const pub = reducer.apply(M.S, seat, type, data);
    const e = { n: M.log.length, seat, type, pub: pub ?? null };
    M.log.push(e);
    // the views are made right away – every player sees the state after this step
    const views = {};
    for (const h of humans()) views[h] = reducer.view(M.S, h);
    return { ...e, views };
  }

  // Runs the system steps and bot moves until a human decision or the end.
  function advance() {
    const out = [];
    for (let guard = 0; guard < 2000; guard++) {
      const nx = reducer.next(M.S);
      if (!nx) break;
      if (nx.seat === -1) out.push(step(-1, nx.type, null));
      else if (M.seats[nx.seat].bot) out.push(step(nx.seat, nx.type, reducer.ai(M.S, nx.seat, nx.type)));
      else break;
    }
    return out;
  }

  return {
    get log() { return M.log; },
    get seats() { return M.seats; },
    pending: () => reducer.next(M.S),
    over: () => !reducer.next(M.S),
    result: () => reducer.result(M.S),
    start: () => (M.log.length ? [] : advance()),
    submit(seat, type, data) {
      const nx = reducer.next(M.S);
      if (!nx || nx.seat !== seat || nx.type !== type) throw new Error(tk('It\'s not your turn.'));
      if (!reducer.validate(M.S, seat, type, data)) throw new Error(tk('Invalid move.'));
      return [step(seat, type, data), ...advance()];
    },
    // disconnected player → bot (their decisions are made automatically)
    takeover(seat) {
      if (!M.seats[seat] || M.seats[seat].bot) return [];
      M.seats[seat] = { ...M.seats[seat], bot: true };
      return advance();
    },
    view: (seat) => reducer.view(M.S, seat),
    snapshot: (seat) => ({ n: M.log.length, view: reducer.view(M.S, seat), log: M.log }),
    save: () => JSON.parse(JSON.stringify(M)),
  };
}

// The steps for a specific player: the public part + their view.
export const forSeat = (entries, seat) => entries.map(({ views, ...e }) => ({ ...e, view: views[seat] }));
