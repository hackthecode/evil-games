// Administrator dashboard: who is online, players (search, ban), lobby reports,
// resetting the Evil Empires world. The rights are checked on the server for every action.
import { session, navigate } from '../app.js';
import { social } from '../net/social.js';
import { admin } from '../net/admin.js';
import { h, toast, modal, avatar } from '../ui.js';
import { txt, LOCALE } from '../i18n.js';

const when = (v) => (v ? new Date(v).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' }) : '—');
const ago = (ms) => {
  if (!ms) return '—';
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? txt('now') : m < 60 ? txt('{0} min ago', m) : m < 1440 ? txt('{0} h ago', Math.round(m / 60)) : txt('{0} days ago', Math.round(m / 1440));
};

export async function renderAdmin(view) {
  if (!(await admin.isAdmin())) {
    toast(txt('You don\'t have administrator rights.'), 'error');
    return navigate('/');
  }
  const stats = h('div', { class: 'adm-stats' });
  const onlineBox = h('div', { class: 'adm-online' });
  const playersBox = h('div', { class: 'adm-table' });
  const reportsBox = h('div', { class: 'adm-reports' });
  const search = h('input', { class: 'lobby-input', placeholder: txt('Search by name…'), 'aria-label': txt('Search') });
  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadPlayers, 300); });

  const card = (label, value, sub) => h('div', { class: 'adm-card' }, h('b', null, String(value ?? '—')), h('span', null, label), sub && h('small', { class: 'muted' }, sub));

  async function loadOverview() {
    try {
      const o = await admin.overview();
      stats.replaceChildren(
        card(txt('Online on the portal'), social.present().size),
        card(txt('Accounts'), o.users, o.users7 ? txt('+{0} in 7 days', o.users7) : null),
        card(txt('Empires'), o.empires, txt('{0} active (15 min)', o.active15)),
        card(txt('Alliances'), o.alliances),
        card(txt('Matches in 24 h'), o.matches24),
        card(txt('Lobby messages (24 h)'), o.lobby24),
        card(txt('New reports'), o.reports),
        card(txt('Banned'), o.bans),
      );
    } catch (e) { stats.replaceChildren(h('p', { class: 'muted' }, e.message)); }
  }

  function drawOnline() {
    const list = [...social.present()];
    onlineBox.replaceChildren(...(list.length ? list.map(([uid, st]) => h('div', { class: 'lobby-user' }, avatar({ displayName: st.name, color: st.color }, 26),
      h('span', null, st.name || txt('Player')), st.where?.game ? h('small', { class: 'muted' }, txt(' playing {0}', st.where.game)) : st.seek ? h('small', { class: 'lobby-tag' }, txt('looking for {0}', st.seek)) : null))
      : [h('p', { class: 'muted' }, txt('Nobody is online.'))]));
  }

  async function banDialog(p) {
    const reason = h('input', { class: 'lobby-input', placeholder: txt('Reason (the player sees it)'), maxlength: 300 });
    const hours = h('select', { class: 'lobby-input' }, [[24, txt('1 day')], [72, txt('3 days')], [168, txt('1 week')], [720, txt('30 days')], [87600, txt('forever')]].map(([v, l]) => h('option', { value: v }, l)));
    const ok = await modal({
      title: txt('Ban: {0}', p.display_name),
      body: h('div', { class: 'adm-form' }, reason, hours, h('p', { class: 'muted' }, txt('A banned player cannot play Evil Empires or write in the lobby.'))),
      actions: [{ label: txt('Cancel'), value: false }, { label: txt('Ban'), value: true, danger: true }],
    });
    if (!ok) return;
    try { await admin.ban(p.id, reason.value.trim(), Number(hours.value)); toast(txt('The player is banned.'), 'success'); loadPlayers(); loadOverview(); } catch (e) { toast(e.message, 'error'); }
  }

  async function loadPlayers() {
    try {
      const rows = await admin.players(search.value.trim());
      playersBox.replaceChildren(rows.length ? h('table', null,
        h('thead', null, h('tr', null, [txt('Player'), txt('Empire'), txt('Points'), txt('Active'), txt('Registered'), ''].map((t) => h('th', null, t)))),
        h('tbody', null, rows.map((p) => h('tr', { class: p.banned_until ? 'banned' : '' },
          h('td', null, h('b', null, p.display_name), h('small', { class: 'muted' }, ` @${p.username}`), p.is_admin ? h('small', { class: 'lobby-tag' }, txt('admin')) : null,
            social.isOnline(p.id) ? h('small', { class: 'adm-dot', title: txt('online now') }, '●') : null),
          h('td', null, p.empire || '—'), h('td', null, p.score ?? '—'), h('td', null, ago(p.last_active)), h('td', null, when(p.created_at)),
          h('td', null, p.banned_until
            ? h('button', { class: 'btn btn-sm', title: txt('{0} · until {1}', p.ban_reason || '', when(p.banned_until)), onclick: async () => { try { await admin.unban(p.id); toast(txt('The ban has been lifted.'), 'success'); loadPlayers(); loadOverview(); } catch (e) { toast(e.message, 'error'); } } }, txt('Unban'))
            : !p.is_admin && p.id !== session.user.id && h('button', { class: 'btn btn-sm btn-ghost', onclick: () => banDialog(p) }, txt('Ban'))))))) : h('p', { class: 'muted' }, txt('No players found.')));
    } catch (e) { playersBox.replaceChildren(h('p', { class: 'muted' }, e.message)); }
  }

  async function loadReports() {
    try {
      const rows = await admin.reports();
      reportsBox.replaceChildren(...(rows.length ? rows.map((r) => h('div', { class: 'adm-report' },
        h('div', null, h('b', null, r.target_name || txt('Player')), h('small', { class: 'muted' }, txt(' · reported by {0} · {1}', r.reporter_name || '—', when(r.created_at)))),
        r.body && h('blockquote', null, r.body),
        h('p', null, txt('Reason: '), r.reason),
        h('div', { class: 'adm-actions' },
          r.message_exists && h('button', { class: 'btn btn-sm', onclick: async () => { try { await admin.deleteMessage(r.message_id); await admin.resolve(r.id); toast(txt('The message was deleted.'), 'success'); loadReports(); loadOverview(); } catch (e) { toast(e.message, 'error'); } } }, txt('Delete the message')),
          r.target && h('button', { class: 'btn btn-sm btn-ghost', onclick: () => banDialog({ id: r.target, display_name: r.target_name || txt('Player') }) }, txt('Ban the author')),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: async () => { try { await admin.resolve(r.id); loadReports(); loadOverview(); } catch (e) { toast(e.message, 'error'); } } }, txt('Close'))))) : [h('p', { class: 'muted' }, txt('No new reports.'))]));
    } catch (e) { reportsBox.replaceChildren(h('p', { class: 'muted' }, e.message)); }
  }

  async function resetWorld() {
    const inp = h('input', { class: 'lobby-input', placeholder: 'RESET', 'aria-label': txt('Confirmation') });
    const ok = await modal({
      title: txt('Reset the Evil Empires world'),
      body: h('div', { class: 'adm-form' }, h('p', null, txt('All empires, alliances and the map are deleted forever. The players start over.')), h('p', { class: 'muted' }, txt('Type RESET to confirm:')), inp),
      actions: [{ label: txt('Cancel'), value: false }, { label: txt('Reset'), value: true, danger: true }],
    });
    if (!ok) return;
    try { await admin.resetWorld(inp.value.trim()); toast(txt('The world has been reset.'), 'success'); loadOverview(); loadPlayers(); } catch (e) { toast(e.message, 'error'); }
  }

  const off = social.on((e) => { if (e.type === 'presence') { drawOnline(); } });
  view.append(
    h('section', { class: 'page-head' }, h('h1', null, txt('Administration')), h('p', { class: 'muted' }, txt('Overview of the portal, players, reports and the Evil Empires world.'))),
    stats,
    h('div', { class: 'adm-grid' },
      h('div', { class: 'panel glass' }, h('h2', null, txt('Players')), search, playersBox),
      h('div', { class: 'adm-side' },
        h('div', { class: 'panel glass' }, h('h2', null, txt('Reports')), reportsBox),
        h('div', { class: 'panel glass' }, h('h2', null, txt('Online now')), onlineBox),
        h('div', { class: 'panel glass adm-danger' }, h('h2', null, txt('Danger zone')),
          h('p', { class: 'muted' }, txt('A new Evil Empires world – e.g. for a new season.')),
          h('button', { class: 'btn btn-danger', onclick: resetWorld }, txt('Reset the world'))))));
  loadOverview();
  loadPlayers();
  loadReports();
  drawOnline();
  return () => off();
}
