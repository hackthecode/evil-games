// Administration: Supabase (the functions from supabase/admin.sql – each checks the rights)
// or local mode for development (localStorage; on localhost everyone is an administrator).
import { store } from '../store/index.js';
import { txt } from '../i18n.js';

const ONLINE = store.kind === 'supabase';
const BANS = 'eg.admin.bans', REPORTS = 'eg.reports', LOBBY = 'eg.lobby.v1';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const keep = (k, v) => localStorage.setItem(k, JSON.stringify(v));
// the accounts of the local store (js/store/local.js)
const localUsers = () => Object.values(load('kare.db.v1', {}).users || {}).map((u) => ({ id: u.id, username: u.username, name: u.displayName || u.username, createdAt: u.createdAt }));

async function rpc(name, args) {
  const { data, error } = await store.client().rpc(name, args);
  if (error) throw new Error(/admin_|is_admin|reports/.test(error.message) && /not exist|schema cache/i.test(error.message)
    ? txt('The dashboard is not enabled on the server yet (run supabase/admin.sql).') : error.message);
  return data;
}

export const admin = {
  async isAdmin() {
    if (!ONLINE) return ['localhost', '127.0.0.1'].includes(location.hostname);
    try { return !!(await rpc('is_admin')); } catch { return false; }
  },

  async overview() {
    if (ONLINE) return rpc('admin_overview');
    return {
      users: localUsers().length, users7: 0, matches24: 0,
      lobby24: load(LOBBY, []).filter((m) => Date.parse(m.created_at) > Date.now() - 864e5).length,
      reports: load(REPORTS, []).filter((r) => !r.resolved).length,
      bans: Object.values(load(BANS, {})).filter((b) => Date.parse(b.until) > Date.now()).length,
    };
  },

  async players(q = '') {
    if (ONLINE) return rpc('admin_players', { p_query: q });
    const bans = load(BANS, {});
    return localUsers()
      .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
      .map((p) => ({ id: p.id, username: p.username, display_name: p.name, created_at: p.createdAt,
        banned_until: Date.parse(bans[p.id]?.until) > Date.now() ? bans[p.id].until : null, ban_reason: bans[p.id]?.reason || null, is_admin: false }));
  },

  async ban(uid, reason, hours) {
    if (ONLINE) return rpc('admin_ban', { p_user: uid, p_reason: reason, p_hours: hours });
    const b = load(BANS, {});
    b[uid] = { reason, until: new Date(Date.now() + hours * 3600000).toISOString() };
    keep(BANS, b);
  },

  async unban(uid) {
    if (ONLINE) return rpc('admin_unban', { p_user: uid });
    const b = load(BANS, {});
    delete b[uid];
    keep(BANS, b);
  },

  async reports() {
    if (ONLINE) return rpc('admin_reports');
    const msgs = load(LOBBY, []);
    return load(REPORTS, []).filter((r) => !r.resolved).map((r) => ({ ...r, message_exists: msgs.some((m) => m.id === r.message_id) }));
  },

  async resolve(id) {
    if (ONLINE) return rpc('admin_resolve', { p_id: id });
    keep(REPORTS, load(REPORTS, []).map((r) => (r.id === id ? { ...r, resolved: true } : r)));
  },

  async deleteMessage(id) {
    if (ONLINE) return rpc('admin_delete_message', { p_id: id });
    keep(LOBBY, load(LOBBY, []).filter((m) => m.id !== id));
  },

  /** A player's report about a lobby message. */
  async report({ messageId, reason, user, body = '', target = null }) {
    reason = String(reason || '').trim().slice(0, 300);
    if (!reason) throw new Error(txt('Describe the reason.'));
    if (ONLINE) {
      const { error } = await store.client().from('reports').insert({ message_id: messageId, reason });
      if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? txt('Reports are not enabled on the server yet.') : error.message);
      return;
    }
    const list = load(REPORTS, []);
    list.push({ id: Date.now(), created_at: new Date().toISOString(), reporter_name: user?.displayName || '', target, target_name: '', message_id: messageId, body, reason, resolved: false });
    keep(REPORTS, list);
  },
};
