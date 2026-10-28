import { session } from '../app.js';
import { store } from '../store/index.js';
import { GAMES } from '../games/registry.js';
import { ART } from '../art.js';
import { h, fmtDuration, pct } from '../ui.js';
import { icon } from '../icons.js';
import { installBanner } from '../pwa.js';
import { txt } from '../i18n.js';

export async function renderHome(view) {
  const u = session.user;
  const stats = u ? await store.getStats(u.id) : {};
  const tot = Object.values(stats).reduce(
    (a, r) => ({ played: a.played + r.played, wins: a.wins + r.wins, timeMs: a.timeMs + r.timeMs }),
    { played: 0, wins: 0, timeMs: 0 },
  );

  view.append(
    h('section', { class: 'hero' },
      h('div', { class: 'hero-text' },
        h('p', { class: 'eyebrow' }, u ? txt('Welcome back') : txt('Games portal')),
        u
          ? h('h1', null, txt('Hello, '), h('em', null, u.displayName), '!')
          : h('h1', null, txt('Classic games. '), h('em', null, txt('Wickedly')), txt(' beautiful.')),
        h('p', { class: 'lead' },
          u
            ? txt('Choose a game and keep racking up wins in the ranking.')
            : txt('Backgammon, chess, belot and santase – in the browser, on computer and phone. Sign up to track your statistics and climb the ranking.')),
        !u && h('div', { class: 'hero-cta' },
          h('a', { href: '#/register', class: 'btn btn-primary btn-lg' }, txt('Create a profile')),
          h('a', { href: '#/login', class: 'btn btn-ghost btn-lg' }, txt('Log in')),
        ),
      ),
      u && h('div', { class: 'hero-stats' },
        stat(txt('Played'), tot.played),
        stat(txt('Wins'), tot.wins),
        stat(txt('Win rate'), pct(tot.wins, tot.played) + '%'),
        stat(txt('Time played'), fmtDuration(tot.timeMs)),
      ),
    ),
    installBanner(),
    h('section', { class: 'games-grid' },
      GAMES.map((g, i) => gameCard(g, stats[g.id], i)),
      h('article', { class: 'game-card soon' },
        h('div', { class: 'game-art soon-art' }, h('span', null, '+')),
        h('div', { class: 'game-info' },
          h('h3', null, txt('More games')),
          h('p', null, txt('New titles are coming to the portal soon.')),
        ),
      ),
    ),
  );
}

function stat(label, value) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));
}

function gameCard(g, s, i) {
  // The whole card leads to a game against the computer; "Online" is a separate link on top.
  return h('article', {
    class: 'game-card',
    style: { '--accent-g': g.accent, animationDelay: `${i * 60}ms` },
  },
    h('a', { href: `#/play/${g.id}`, class: 'game-card-link', 'aria-label': txt('{0} against the computer', g.name) }),
    h('div', { class: 'game-art', html: ART[g.id] }),
    h('div', { class: 'game-info' },
      h('div', { class: 'game-title-row' },
        h('h3', null, g.name),
        h('span', { class: 'play-pill' }, icon('play', 14), txt('Play')),
      ),
      h('p', null, g.tagline),
      h('div', { class: 'game-meta' },
        h('span', null, g.players),
        s && s.played > 0 && h('span', { class: 'mini-stats' }, txt('{0} wins · {1} games · {2}', s.wins, s.played, fmtDuration(s.timeMs))),
      ),
      g.online && h('div', { class: 'game-modes' },
        h('a', { href: `#/play/${g.id}`, class: 'btn btn-sm' }, icon('bot', 16), txt('Computer')),
        h('a', { href: `#/online/${g.id}`, class: 'btn btn-sm btn-online' }, icon('users', 16), txt('Online')),
      ),
    ),
  );
}
