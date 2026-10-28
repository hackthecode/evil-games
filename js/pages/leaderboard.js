import { session, navigate } from '../app.js';
import { store } from '../store/index.js';
import { GAMES } from '../games/registry.js';
import { h, avatar, fmtDuration, pct } from '../ui.js';
import { txt } from '../i18n.js';

const SORTS = {
  rating: { label: txt('Rating'), fn: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.wins - a.wins },
  wins: { label: txt('Wins'), fn: (a, b) => b.wins - a.wins || pct(b.wins, b.played) - pct(a.wins, a.played) || a.played - b.played },
  rate: { label: txt('Win rate'), fn: (a, b) => rate(b) - rate(a) || b.wins - a.wins },
  played: { label: txt('Played'), fn: (a, b) => b.played - a.played || b.wins - a.wins },
  time: { label: txt('Time'), fn: (a, b) => b.timeMs - a.timeMs },
};

// Win rate with "smoothing", so a player with 1 game and 100% doesn't lead.
const rate = (r) => (r.wins + 1) / (r.played + 2);

export async function renderLeaderboard(view, gameId = 'all') {
  const tabs = [{ id: 'all', name: txt('Overall') }, ...GAMES];

  const tableHost = h('div', { class: 'lb-host' });
  const rows = (await store.getLeaderboard(gameId)).filter((r) => r.played > 0 || r.timeMs > 0);
  // the rating (Elo from online matches) is per game; it's not in "Overall"
  const rated = gameId !== 'all';
  let sortKey = rated && rows.some((r) => r.rating != null) ? 'rating' : 'wins';
  const sorts = Object.entries(SORTS).filter(([k]) => rated || k !== 'rating');

  const draw = () => {
    const sorted = rows.slice().sort(SORTS[sortKey].fn);
    tableHost.replaceChildren(
      sorted.length === 0
        ? h('p', { class: 'empty' }, txt('No results yet. Be the first!'))
        : h('div', { class: `lb-table ${rated ? 'with-rating' : ''}`, role: 'table' },
            h('div', { class: 'lb-row lb-headrow', role: 'row' },
              h('span', null, '#'), h('span', null, txt('Player')),
              rated && h('span', { class: 'num', title: txt('Elo rating from online matches') }, txt('Rating')),
              h('span', { class: 'num' }, txt('Wins')), h('span', { class: 'num' }, txt('Games')),
              h('span', { class: 'num hide-sm' }, txt('Win rate')), h('span', { class: 'num hide-sm' }, txt('Time')),
            ),
            sorted.map((r, i) =>
              h('div', {
                class: `lb-row ${session.user?.id === r.id ? 'me' : ''} ${i < 3 ? 'top top-' + (i + 1) : ''}`,
                role: 'row',
                style: { animationDelay: `${Math.min(i, 12) * 30}ms` },
                onclick: () => session.user && navigate('/profile/' + r.id),
              },
                h('span', { class: 'rank' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1),
                h('span', { class: 'lb-player' }, avatar(r, 30), h('span', null, r.displayName)),
                rated && h('span', { class: 'num strong rating' }, r.rating ?? '—'),
                h('span', { class: 'num strong' }, r.wins),
                h('span', { class: 'num' }, r.played),
                h('span', { class: 'num hide-sm' }, pct(r.wins, r.played) + '%'),
                h('span', { class: 'num hide-sm muted' }, fmtDuration(r.timeMs)),
              ),
            ),
          ),
    );
  };

  view.append(
    h('section', { class: 'page-head' },
      h('h1', null, txt('Ranking')),
      h('p', { class: 'muted' }, store.kind === 'local'
        ? txt('Showing the players registered on this device.')
        : txt('The best players on the portal.')),
    ),
    h('div', { class: 'tabs', role: 'tablist' },
      tabs.map((t) => h('a', { href: `#/leaderboard/${t.id}`, role: 'tab', class: `tab ${t.id === gameId ? 'active' : ''}` }, t.name)),
    ),
    h('div', { class: 'sort-row' },
      h('span', { class: 'muted' }, txt('Sort by:')),
      h('div', { class: 'seg' },
        sorts.map(([k, v]) =>
          h('button', {
            class: k === sortKey ? 'on' : '',
            onclick: (e) => {
              sortKey = k;
              e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
              draw();
            },
          }, v.label),
        ),
      ),
    ),
    h('section', { class: 'panel glass' }, tableHost),
  );
  draw();
}
