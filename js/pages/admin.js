// Табло на администратора: кой е на линия, играчи (търсене, блокиране), жалби от лобито,
// рестарт на света на Evil Empires. Правата се проверяват на сървъра при всяко действие.
import { session, navigate } from '../app.js';
import { social } from '../net/social.js';
import { admin } from '../net/admin.js';
import { h, toast, modal, avatar } from '../ui.js';

const when = (v) => (v ? new Date(v).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const ago = (ms) => {
  if (!ms) return '—';
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? 'сега' : m < 60 ? `преди ${m} мин` : m < 1440 ? `преди ${Math.round(m / 60)} ч` : `преди ${Math.round(m / 1440)} дни`;
};

export async function renderAdmin(view) {
  if (!(await admin.isAdmin())) {
    toast('Нямате права на администратор.', 'error');
    return navigate('/');
  }
  const stats = h('div', { class: 'adm-stats' });
  const onlineBox = h('div', { class: 'adm-online' });
  const playersBox = h('div', { class: 'adm-table' });
  const reportsBox = h('div', { class: 'adm-reports' });
  const search = h('input', { class: 'lobby-input', placeholder: 'Търсене по име…', 'aria-label': 'Търсене' });
  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadPlayers, 300); });

  const card = (label, value, sub) => h('div', { class: 'adm-card' }, h('b', null, String(value ?? '—')), h('span', null, label), sub && h('small', { class: 'muted' }, sub));

  async function loadOverview() {
    try {
      const o = await admin.overview();
      stats.replaceChildren(
        card('На линия в портала', social.present().size),
        card('Акаунти', o.users, o.users7 ? `+${o.users7} за 7 дни` : null),
        card('Империи', o.empires, `${o.active15} активни (15 мин)`),
        card('Съюзи', o.alliances),
        card('Мачове за 24 ч', o.matches24),
        card('Съобщения в лобито (24 ч)', o.lobby24),
        card('Нови жалби', o.reports),
        card('Блокирани', o.bans),
      );
    } catch (e) { stats.replaceChildren(h('p', { class: 'muted' }, e.message)); }
  }

  function drawOnline() {
    const list = [...social.present()];
    onlineBox.replaceChildren(...(list.length ? list.map(([uid, st]) => h('div', { class: 'lobby-user' }, avatar({ displayName: st.name, color: st.color }, 26),
      h('span', null, st.name || 'Играч'), st.where?.game ? h('small', { class: 'muted' }, ` играе ${st.where.game}`) : st.seek ? h('small', { class: 'lobby-tag' }, `търси ${st.seek}`) : null))
      : [h('p', { class: 'muted' }, 'Никой не е на линия.')]));
  }

  async function banDialog(p) {
    const reason = h('input', { class: 'lobby-input', placeholder: 'Причина (вижда я играчът)', maxlength: 300 });
    const hours = h('select', { class: 'lobby-input' }, [[24, '1 ден'], [72, '3 дни'], [168, '1 седмица'], [720, '30 дни'], [87600, 'завинаги']].map(([v, l]) => h('option', { value: v }, l)));
    const ok = await modal({
      title: `Блокиране: ${p.display_name}`,
      body: h('div', { class: 'adm-form' }, reason, hours, h('p', { class: 'muted' }, 'Блокираният не може да играе Evil Empires и да пише в лобито.')),
      actions: [{ label: 'Отказ', value: false }, { label: 'Блокирай', value: true, danger: true }],
    });
    if (!ok) return;
    try { await admin.ban(p.id, reason.value.trim(), Number(hours.value)); toast('Играчът е блокиран.', 'success'); loadPlayers(); loadOverview(); } catch (e) { toast(e.message, 'error'); }
  }

  async function loadPlayers() {
    try {
      const rows = await admin.players(search.value.trim());
      playersBox.replaceChildren(rows.length ? h('table', null,
        h('thead', null, h('tr', null, ['Играч', 'Империя', 'Точки', 'Активен', 'Регистриран', ''].map((t) => h('th', null, t)))),
        h('tbody', null, rows.map((p) => h('tr', { class: p.banned_until ? 'banned' : '' },
          h('td', null, h('b', null, p.display_name), h('small', { class: 'muted' }, ` @${p.username}`), p.is_admin ? h('small', { class: 'lobby-tag' }, 'админ') : null,
            social.isOnline(p.id) ? h('small', { class: 'adm-dot', title: 'на линия' }, '●') : null),
          h('td', null, p.empire || '—'), h('td', null, p.score ?? '—'), h('td', null, ago(p.last_active)), h('td', null, when(p.created_at)),
          h('td', null, p.banned_until
            ? h('button', { class: 'btn btn-sm', title: `${p.ban_reason || ''} · до ${when(p.banned_until)}`, onclick: async () => { try { await admin.unban(p.id); toast('Блокирането е премахнато.', 'success'); loadPlayers(); loadOverview(); } catch (e) { toast(e.message, 'error'); } } }, 'Отблокирай')
            : !p.is_admin && p.id !== session.user.id && h('button', { class: 'btn btn-sm btn-ghost', onclick: () => banDialog(p) }, 'Блокирай')))))) : h('p', { class: 'muted' }, 'Няма намерени играчи.'));
    } catch (e) { playersBox.replaceChildren(h('p', { class: 'muted' }, e.message)); }
  }

  async function loadReports() {
    try {
      const rows = await admin.reports();
      reportsBox.replaceChildren(...(rows.length ? rows.map((r) => h('div', { class: 'adm-report' },
        h('div', null, h('b', null, r.target_name || 'Играч'), h('small', { class: 'muted' }, ` · докладван от ${r.reporter_name || '—'} · ${when(r.created_at)}`)),
        r.body && h('blockquote', null, r.body),
        h('p', null, 'Причина: ', r.reason),
        h('div', { class: 'adm-actions' },
          r.message_exists && h('button', { class: 'btn btn-sm', onclick: async () => { try { await admin.deleteMessage(r.message_id); await admin.resolve(r.id); toast('Съобщението е изтрито.', 'success'); loadReports(); loadOverview(); } catch (e) { toast(e.message, 'error'); } } }, 'Изтрий съобщението'),
          r.target && h('button', { class: 'btn btn-sm btn-ghost', onclick: () => banDialog({ id: r.target, display_name: r.target_name || 'Играч' }) }, 'Блокирай автора'),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: async () => { try { await admin.resolve(r.id); loadReports(); loadOverview(); } catch (e) { toast(e.message, 'error'); } } }, 'Приключи')))) : [h('p', { class: 'muted' }, 'Няма нови жалби.')]));
    } catch (e) { reportsBox.replaceChildren(h('p', { class: 'muted' }, e.message)); }
  }

  async function resetWorld() {
    const inp = h('input', { class: 'lobby-input', placeholder: 'РЕСТАРТ', 'aria-label': 'Потвърждение' });
    const ok = await modal({
      title: 'Рестарт на света на Evil Empires',
      body: h('div', { class: 'adm-form' }, h('p', null, 'Всички империи, съюзи и картата се изтриват завинаги. Играчите започват отначало.'), h('p', { class: 'muted' }, 'Напишете РЕСТАРТ за потвърждение:'), inp),
      actions: [{ label: 'Отказ', value: false }, { label: 'Рестартирай', value: true, danger: true }],
    });
    if (!ok) return;
    try { await admin.resetWorld(inp.value.trim()); toast('Светът е рестартиран.', 'success'); loadOverview(); loadPlayers(); } catch (e) { toast(e.message, 'error'); }
  }

  const off = social.on((e) => { if (e.type === 'presence') { drawOnline(); } });
  view.append(
    h('section', { class: 'page-head' }, h('h1', null, 'Администрация'), h('p', { class: 'muted' }, 'Преглед на портала, играчи, жалби и светът на Evil Empires.')),
    stats,
    h('div', { class: 'adm-grid' },
      h('div', { class: 'panel glass' }, h('h2', null, 'Играчи'), search, playersBox),
      h('div', { class: 'adm-side' },
        h('div', { class: 'panel glass' }, h('h2', null, 'Жалби'), reportsBox),
        h('div', { class: 'panel glass' }, h('h2', null, 'На линия'), onlineBox),
        h('div', { class: 'panel glass adm-danger' }, h('h2', null, 'Опасна зона'),
          h('p', { class: 'muted' }, 'Нов свят на Evil Empires – напр. за нов сезон.'),
          h('button', { class: 'btn btn-danger', onclick: resetWorld }, 'Рестарт на света')))));
  loadOverview();
  loadPlayers();
  loadReports();
  drawOnline();
  return () => off();
}
