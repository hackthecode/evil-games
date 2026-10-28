// Elo rating for online matches. The rating changes only when all players of
// the match have reported consistent results – so nobody can "write" themselves a win.
// The same algorithm is in supabase/schema.sql (apply_elo) for online mode.

export const START_RATING = 1200;
const K = 32;
const expected = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));

/**
 * reports: [{ uid, team, outcome: 'win' | 'loss' | 'draw' }], rating(uid) → current rating.
 * Returns { uid: change } or null for inconsistent results.
 *  - 2 teams: win/loss or draw; team rating = the average of its members;
 *  - more participants: exactly one winner, the others lose (in pairs, with K / (n − 1)).
 */
export function eloDeltas(reports, rating) {
  const teams = new Map();
  for (const r of reports) {
    const t = teams.get(r.team) || { outcome: r.outcome, uids: [] };
    if (t.outcome !== r.outcome) return null;
    t.uids.push(r.uid);
    teams.set(r.team, t);
  }
  const list = [...teams.values()].map((t) => ({ ...t, avg: t.uids.reduce((a, u) => a + rating(u), 0) / t.uids.length, d: 0 }));
  const n = list.length;
  if (n < 2) return null;
  const wins = list.filter((t) => t.outcome === 'win');
  const draws = list.filter((t) => t.outcome === 'draw');
  if (n === 2 && draws.length === 2) {
    const d = K * (0.5 - expected(list[0].avg, list[1].avg));
    list[0].d = d;
    list[1].d = -d;
  } else if (wins.length === 1 && list.filter((t) => t.outcome === 'loss').length === n - 1) {
    const w = wins[0];
    for (const l of list) {
      if (l === w) continue;
      const d = (K * (1 - expected(w.avg, l.avg))) / (n - 1);
      w.d += d;
      l.d -= d;
    }
  } else return null;
  const out = {};
  for (const t of list) for (const u of t.uids) out[u] = Math.round(t.d);
  return out;
}

// Team of a seat in the match: in belot 0/2 vs 1/3, elsewhere everyone plays alone.
export const teamOfSeat = (game, seat) => (game.online?.teams === 2 ? seat % 2 : seat);
