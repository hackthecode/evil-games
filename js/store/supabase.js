// Online storage via Supabase (Postgres + Auth). The schema is in supabase/schema.sql.
// The username becomes an internal email so that sign-up
// needs only a name and password ("Confirm email" must be turned off in Supabase).
import { txt } from '../i18n.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const EMAIL_DOMAIN = 'players.kare.local';

// The email must be ASCII – Cyrillic names are hex-encoded.
const toEmail = (username) => {
  const u = username.toLowerCase();
  const local = /^[a-z0-9_]+$/.test(u)
    ? u
    : 'x' + [...new TextEncoder().encode(u)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${local}@${EMAIL_DOMAIN}`;
};

function mapProfile(p) {
  return p && { id: p.id, username: p.username, displayName: p.display_name, color: p.color, createdAt: p.created_at };
}

function mapRow(r) {
  return {
    played: r.played,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    timeMs: Number(r.time_ms),
    lastPlayed: r.last_played,
  };
}

export function createSupabaseStore({ url, anonKey }) {
  let sb;

  const check = ({ data, error }) => {
    if (error) throw new Error(translate(error.message));
    return data;
  };

  return {
    kind: 'supabase',

    async init() {
      const { createClient } = await import(SDK_URL);
      sb = createClient(url, anonKey, { auth: { persistSession: true } });
    },

    // The client is also used for online games (Realtime channels).
    client: () => sb,

    async getUser() {
      const { data } = await sb.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return null;
      return this.getProfile(uid);
    },

    async register({ username, password, color }) {
      const res = check(
        await sb.auth.signUp({
          email: toEmail(username),
          password,
          options: { data: { username, color } },
        }),
      );
      if (!res.session) {
        throw new Error(txt('In Supabase turn off "Confirm email" (Authentication → Providers → Email).'));
      }
      return this.getProfile(res.user.id);
    },

    async login({ username, password }) {
      const res = check(await sb.auth.signInWithPassword({ email: toEmail(username), password }));
      return this.getProfile(res.user.id);
    },

    async logout() {
      await sb.auth.signOut();
    },

    async updateProfile(userId, { displayName, color }) {
      const patch = {};
      if (displayName) patch.display_name = displayName;
      if (color) patch.color = color;
      const row = check(await sb.from('profiles').update(patch).eq('id', userId).select().single());
      return mapProfile(row);
    },

    async addTime(_userId, gameId, ms) {
      if (ms <= 0) return;
      check(await sb.rpc('add_play_time', { p_game: gameId, p_ms: Math.round(ms) }));
    },

    async recordGame(_userId, gameId, { result, durationMs = 0, meta = {} }) {
      check(
        await sb.rpc('record_game', {
          p_game: gameId,
          p_result: result,
          p_duration: Math.round(durationMs),
          p_meta: meta,
        }),
      );
    },

    async getProfile(userId) {
      return mapProfile(check(await sb.from('profiles').select('*').eq('id', userId).maybeSingle()));
    },

    async getStats(userId) {
      const rows = check(await sb.from('game_stats').select('*').eq('user_id', userId));
      return Object.fromEntries(rows.map((r) => [r.game_id, mapRow(r)]));
    },

    async getHistory(userId, limit = 20) {
      const rows = check(
        await sb
          .from('matches')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit),
      );
      return rows.map((r) => ({
        userId: r.user_id,
        gameId: r.game_id,
        result: r.result,
        durationMs: r.duration_ms,
        meta: r.meta || {},
        at: r.created_at,
      }));
    },

    // ---------- rating ----------
    async reportRated({ game, key, team, outcome, players }) {
      check(await sb.rpc('report_rated', { p_key: key, p_game: game, p_team: team, p_outcome: outcome, p_players: players }));
    },

    async getRatings(userId) {
      const rows = check(await sb.from('ratings').select('*').eq('user_id', userId));
      return Object.fromEntries(rows.map((r) => [r.game_id, { rating: r.rating, games: r.games }]));
    },

    // ---------- friends ----------
    async searchUsers(userId, q) {
      const s = q.trim().replace(/[%_]/g, '');
      if (!s) return [];
      const rows = check(await sb.from('profiles').select('*').ilike('username', `%${s}%`).limit(20));
      return rows.filter((r) => r.id !== userId).map(mapProfile);
    },

    async listFriends(userId) {
      const rows = check(await sb.from('friendships').select('*').or(`user_id.eq.${userId},friend_id.eq.${userId}`));
      const ids = rows.map((r) => (r.user_id === userId ? r.friend_id : r.user_id));
      if (!ids.length) return [];
      const profs = check(await sb.from('profiles').select('*').in('id', ids));
      const byId = Object.fromEntries(profs.map((p) => [p.id, mapProfile(p)]));
      return rows.map((r) => {
        const other = r.user_id === userId ? r.friend_id : r.user_id;
        const status = r.status === 'accepted' ? 'friend' : r.user_id === userId ? 'outgoing' : 'incoming';
        return { user: byId[other], status };
      }).filter((x) => x.user);
    },

    async requestFriend(userId, otherId) {
      const incoming = check(await sb.from('friendships').select('*').eq('user_id', otherId).eq('friend_id', userId).maybeSingle());
      if (incoming) {
        check(await sb.from('friendships').update({ status: 'accepted' }).eq('user_id', otherId).eq('friend_id', userId));
        return;
      }
      const res = await sb.from('friendships').insert({ user_id: userId, friend_id: otherId });
      if (res.error && !/duplicate/i.test(res.error.message)) throw new Error(res.error.message);
    },

    async acceptFriend(userId, otherId) {
      check(await sb.from('friendships').update({ status: 'accepted' }).eq('user_id', otherId).eq('friend_id', userId));
    },

    async removeFriend(userId, otherId) {
      check(await sb.from('friendships').delete().or(`and(user_id.eq.${userId},friend_id.eq.${otherId}),and(user_id.eq.${otherId},friend_id.eq.${userId})`));
    },

    async getLeaderboard(gameId) {
      const rows = check(await sb.from('leaderboard').select('*').eq('game_id', gameId).limit(500));
      return rows.map((r) => ({ ...mapProfile({ ...r, id: r.user_id }), ...mapRow(r), rating: r.rating ?? null, ratedGames: r.rated_games ?? 0 }));
    },
  };
}

function translate(msg) {
  if (/already registered/i.test(msg)) return txt('This username is already taken.');
  if (/invalid login/i.test(msg)) return txt('Wrong username or password.');
  if (/password should be/i.test(msg)) return txt('The password must be at least 6 characters.');
  return msg;
}
