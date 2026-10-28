// Local storage: accounts, statistics and history in localStorage.
import { hashPassword, verifyPassword, randomHex } from './hash.js';
import { eloDeltas, START_RATING } from './elo.js';
import { txt } from '../i18n.js';

const DB_KEY = 'kare.db.v1';
const SESSION_KEY = 'kare.session.v1';
const HISTORY_LIMIT = 400;

// The session is also kept per tab (sessionStorage): this way two tabs can have
// different users – needed to test online games on one computer.
const session = {
  get() {
    try {
      const own = sessionStorage.getItem(SESSION_KEY);
      if (own) return own;
    } catch {}
    const id = localStorage.getItem(SESSION_KEY);
    if (id) session.set(id);
    return id;
  },
  set(id) {
    localStorage.setItem(SESSION_KEY, id);
    try { sessionStorage.setItem(SESSION_KEY, id); } catch {}
  },
  clear() {
    localStorage.removeItem(SESSION_KEY);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  },
};

function load() {
  try {
    const db = JSON.parse(localStorage.getItem(DB_KEY));
    if (db && db.users) return db;
  } catch {}
  return { users: {}, stats: {}, history: [], friends: [], rated: {}, ratings: {} };
}

function save(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function publicUser(u) {
  return u && { id: u.id, username: u.username, displayName: u.displayName, color: u.color, createdAt: u.createdAt };
}

function emptyRow() {
  return { played: 0, wins: 0, losses: 0, draws: 0, timeMs: 0, lastPlayed: null };
}

export function createLocalStore() {
  return {
    kind: 'local',

    async init() {},

    async getUser() {
      const id = session.get();
      return id ? publicUser(load().users[id]) : null;
    },

    async register({ username, password, color }) {
      const db = load();
      const lower = username.toLowerCase();
      if (Object.values(db.users).some((u) => u.username.toLowerCase() === lower)) {
        throw new Error(txt('This username is already taken.'));
      }
      const salt = randomHex(16);
      const user = {
        id: 'u_' + randomHex(8),
        username,
        displayName: username,
        color,
        salt,
        hash: await hashPassword(password, salt),
        createdAt: new Date().toISOString(),
      };
      db.users[user.id] = user;
      save(db);
      session.set(user.id);
      return publicUser(user);
    },

    async login({ username, password }) {
      const db = load();
      const lower = username.toLowerCase();
      const user = Object.values(db.users).find((u) => u.username.toLowerCase() === lower);
      if (!user || !(await verifyPassword(password, user.salt, user.hash))) {
        throw new Error(txt('Wrong username or password.'));
      }
      session.set(user.id);
      return publicUser(user);
    },

    async logout() {
      session.clear();
    },

    async updateProfile(userId, { displayName, color }) {
      const db = load();
      const u = db.users[userId];
      if (!u) throw new Error(txt('No such user.'));
      if (displayName) u.displayName = displayName;
      if (color) u.color = color;
      save(db);
      return publicUser(u);
    },

    async addTime(userId, gameId, ms) {
      if (!userId || ms <= 0) return;
      const db = load();
      const row = ((db.stats[userId] ||= {})[gameId] ||= emptyRow());
      row.timeMs += Math.round(ms);
      save(db);
    },

    async recordGame(userId, gameId, { result, durationMs = 0, meta = {} }) {
      const db = load();
      const row = ((db.stats[userId] ||= {})[gameId] ||= emptyRow());
      row.played++;
      if (result === 'win') row.wins++;
      else if (result === 'loss') row.losses++;
      else row.draws++;
      row.lastPlayed = new Date().toISOString();
      db.history.unshift({ userId, gameId, result, durationMs, meta, at: row.lastPlayed });
      if (db.history.length > HISTORY_LIMIT) db.history.length = HISTORY_LIMIT;
      save(db);
    },

    async getProfile(userId) {
      return publicUser(load().users[userId]);
    },

    async getStats(userId) {
      return load().stats[userId] || {};
    },

    async getHistory(userId, limit = 20) {
      return load().history.filter((h) => h.userId === userId).slice(0, limit);
    },

    // ---------- rating ----------
    // Each player reports their result; the rating is computed once,
    // when everyone has reported the same line-up and consistent results.
    async reportRated({ userId, game, key, team, outcome, players }) {
      // each player writes to their own key – tabs writing at the same time don't interfere
      const base = `kare.rated.${key}`;
      const sig = JSON.stringify(players);
      localStorage.setItem(`${base}.${userId}`, JSON.stringify({ uid: userId, team, outcome, sig }));
      // writes from other tabs arrive late – we check again a bit later
      const tryApply = () => {
        const reps = players.map((p) => JSON.parse(localStorage.getItem(`${base}.${p.uid}`) || 'null'));
        if (reps.some((r) => !r || r.sig !== sig) || localStorage.getItem(`${base}.done`)) return false;
        localStorage.setItem(`${base}.done`, '1');
        applyElo(game, reps);
        return true;
      };
      if (!tryApply()) [800, 2500, 6000].forEach((ms) => setTimeout(tryApply, ms));
    },

    async getRatings(userId) {
      return load().ratings?.[userId] || {};
    },

    // ---------- friends ----------
    async searchUsers(userId, q) {
      const s = q.trim().toLowerCase();
      if (!s) return [];
      return Object.values(load().users)
        .filter((u) => u.id !== userId && u.username.toLowerCase().includes(s))
        .slice(0, 20).map(publicUser);
    },

    async listFriends(userId) {
      const db = load();
      return (db.friends || [])
        .filter((f) => f.from === userId || f.to === userId)
        .map((f) => {
          const other = f.from === userId ? f.to : f.from;
          const status = f.status === 'accepted' ? 'friend' : f.from === userId ? 'outgoing' : 'incoming';
          return { user: publicUser(db.users[other]), status };
        })
        .filter((x) => x.user);
    },

    async requestFriend(userId, otherId) {
      const db = load();
      db.friends ||= [];
      const row = db.friends.find((f) => (f.from === userId && f.to === otherId) || (f.from === otherId && f.to === userId));
      if (row) {
        if (row.status === 'pending' && row.to === userId) row.status = 'accepted';
      } else db.friends.push({ from: userId, to: otherId, status: 'pending' });
      save(db);
    },

    async acceptFriend(userId, otherId) {
      const db = load();
      const row = (db.friends || []).find((f) => f.from === otherId && f.to === userId);
      if (row) row.status = 'accepted';
      save(db);
    },

    async removeFriend(userId, otherId) {
      const db = load();
      db.friends = (db.friends || []).filter((f) => !((f.from === userId && f.to === otherId) || (f.from === otherId && f.to === userId)));
      save(db);
    },

    async getLeaderboard(gameId) {
      const db = load();
      return Object.values(db.users).map((u) => {
        const s = db.stats[u.id] || {};
        const rows = gameId === 'all' ? Object.values(s) : [s[gameId] || emptyRow()];
        const agg = rows.reduce(
          (a, r) => ({
            played: a.played + r.played,
            wins: a.wins + r.wins,
            losses: a.losses + r.losses,
            draws: a.draws + r.draws,
            timeMs: a.timeMs + r.timeMs,
          }),
          emptyRow(),
        );
        const rt = gameId === 'all' ? null : db.ratings?.[u.id]?.[gameId];
        return { ...publicUser(u), ...agg, rating: rt ? rt.rating : null, ratedGames: rt ? rt.games : 0 };
      });
    },
  };
}

// Applies the rating changes from a match (once – see the "done" marker).
function applyElo(game, reps) {
  const db = load();
  db.ratings ||= {};
  const rating = (u) => db.ratings[u]?.[game]?.rating ?? START_RATING;
  const deltas = eloDeltas(reps, rating);
  if (!deltas) return;
  for (const [u, d] of Object.entries(deltas)) {
    const r = ((db.ratings[u] ||= {})[game] ||= { rating: START_RATING, games: 0 });
    r.rating = Math.max(100, r.rating + d);
    r.games++;
  }
  save(db);
}
