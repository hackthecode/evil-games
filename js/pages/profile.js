import { session } from '../app.js';
import { store } from '../store/index.js';
import { GAMES, gameById } from '../games/registry.js';
import { h, avatar, fmtDuration, fmtDate, pct, toast, modal, AVATAR_COLORS } from '../ui.js';
import { icon } from '../icons.js';

const RESULT = { win: 'Победа', loss: 'Загуба', draw: 'Реми' };

export async function renderProfile(view, userId) {
  const me = session.user;
  const uid = userId || me.id;
  const isMe = uid === me.id;
  const [user, stats, history, ratings] = await Promise.all([
    isMe ? me : store.getProfile(uid),
    store.getStats(uid),
    isMe ? store.getHistory(uid, 25) : [],
    store.getRatings(uid).catch(() => ({})),
  ]);
  if (!user) {
    view.append(h('p', { class: 'empty' }, 'Няма такъв играч.'));
    return;
  }

  const rows = GAMES.map((g) => ({ g, s: stats[g.id] || { played: 0, wins: 0, losses: 0, draws: 0, timeMs: 0 } }));
  const tot = rows.reduce(
    (a, { s }) => ({ played: a.played + s.played, wins: a.wins + s.wins, losses: a.losses + s.losses, draws: a.draws + s.draws, timeMs: a.timeMs + s.timeMs }),
    { played: 0, wins: 0, losses: 0, draws: 0, timeMs: 0 },
  );
  const maxTime = Math.max(1, ...rows.map((r) => r.s.timeMs));
  const fav = rows.slice().sort((a, b) => b.s.timeMs - a.s.timeMs)[0];

  view.append(
    h('section', { class: 'profile-head glass' },
      avatar(user, 72),
      h('div', { class: 'profile-id' },
        h('h1', null, user.displayName),
        h('p', { class: 'muted' }, `@${user.username} · член от ${new Date(user.createdAt).toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })}`),
        tot.timeMs > 0 && h('p', { class: 'muted' }, `Любима игра: `, h('b', null, fav.g.name)),
      ),
      isMe && h('button', { class: 'btn btn-ghost', onclick: () => editProfile(user) }, icon('edit', 16), 'Редактирай'),
    ),
    h('section', { class: 'kpis' },
      kpi('Изиграни игри', tot.played),
      kpi('Победи', tot.wins, 'good'),
      kpi('Загуби', tot.losses, 'bad'),
      kpi('Успеваемост', pct(tot.wins, tot.played) + '%'),
      kpi('Общо време', fmtDuration(tot.timeMs)),
    ),
    h('section', { class: 'panel glass' },
      h('h2', null, 'По игри'),
      h('div', { class: 'game-stats' },
        rows.map(({ g, s }) =>
          h('div', { class: 'gs-row', style: { '--accent-g': g.accent } },
            h('div', { class: 'gs-name' }, h('span', { class: 'dot' }), g.name),
            h('div', { class: 'gs-nums' },
              num(s.played, 'игри'), num(s.wins, 'победи'), num(s.losses, 'загуби'),
              s.draws > 0 && num(s.draws, 'реми'), num(pct(s.wins, s.played) + '%', 'успех'),
              ratings[g.id] && num(ratings[g.id].rating, 'рейтинг'),
            ),
            h('div', { class: 'gs-bar' },
              h('div', { class: 'gs-fill', style: { width: `${(s.timeMs / maxTime) * 100}%` } }),
              h('span', null, fmtDuration(s.timeMs)),
            ),
          ),
        ),
      ),
    ),
    isMe && h('section', { class: 'panel glass' },
      h('h2', null, 'Последни игри'),
      history.length
        ? h('ul', { class: 'history' },
            history.map((x) =>
              h('li', null,
                h('span', { class: `res res-${x.result}` }, RESULT[x.result]),
                h('span', { class: 'h-game' }, gameById(x.gameId)?.name || x.gameId),
                h('span', { class: 'h-detail muted' }, x.meta?.summary || ''),
                h('span', { class: 'h-when muted' }, fmtDate(x.at)),
              ),
            ),
          )
        : h('p', { class: 'empty' }, 'Все още нямате завършени игри.'),
    ),
  );
}

function kpi(label, value, tone = '') {
  return h('div', { class: `kpi glass ${tone}` }, h('span', { class: 'kpi-value' }, value), h('span', { class: 'kpi-label' }, label));
}

function num(v, label) {
  return h('span', { class: 'gs-num' }, h('b', null, v), ' ', label);
}

async function editProfile(user) {
  let color = user.color;
  const name = h('input', { value: user.displayName, maxlength: 24, minlength: 2 });
  const sw = h('div', { class: 'swatches' },
    AVATAR_COLORS.map((c) =>
      h('button', {
        type: 'button', class: `swatch ${c === color ? 'on' : ''}`, style: { background: c },
        onclick: (e) => {
          color = c;
          sw.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
        },
      }),
    ),
  );
  const ok = await modal({
    title: 'Редакция на профила',
    body: h('div', { class: 'auth-form' }, h('label', null, h('span', null, 'Име за показване'), name), h('div', { class: 'field' }, h('span', null, 'Цвят'), sw)),
    actions: [{ label: 'Отказ', value: false }, { label: 'Запази', value: true, primary: true }],
  });
  if (!ok) return;
  try {
    const u = await store.updateProfile(user.id, { displayName: name.value.trim(), color });
    session.setUser(u);
    toast('Профилът е обновен.', 'success');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch (e) {
    toast(e.message, 'error');
  }
}
