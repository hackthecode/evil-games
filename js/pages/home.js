import { session } from '../app.js';
import { store } from '../store/index.js';
import { GAMES } from '../games/registry.js';
import { ART } from '../art.js';
import { h, fmtDuration, pct } from '../ui.js';
import { icon } from '../icons.js';
import { installBanner } from '../pwa.js';

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
        h('p', { class: 'eyebrow' }, u ? 'Добре дошли отново' : 'Игрален портал'),
        u
          ? h('h1', null, 'Здравейте, ', h('em', null, u.displayName), '!')
          : h('h1', null, 'Класически игри. ', h('em', null, 'Зловещо'), ' красиви.'),
        h('p', { class: 'lead' },
          u
            ? 'Изберете игра и продължете да трупате победи в класацията.'
            : 'Табла, шах, белот и сантасе – в браузъра, на компютър и телефон. Регистрирайте се, за да следите статистиката си и да се изкачите в класацията.'),
        !u && h('div', { class: 'hero-cta' },
          h('a', { href: '#/register', class: 'btn btn-primary btn-lg' }, 'Създай профил'),
          h('a', { href: '#/login', class: 'btn btn-ghost btn-lg' }, 'Вход'),
        ),
      ),
      u && h('div', { class: 'hero-stats' },
        stat('Изиграни', tot.played),
        stat('Победи', tot.wins),
        stat('Успеваемост', pct(tot.wins, tot.played) + '%'),
        stat('Време в игра', fmtDuration(tot.timeMs)),
      ),
    ),
    installBanner(),
    h('section', { class: 'games-grid' },
      GAMES.map((g, i) => gameCard(g, stats[g.id], i)),
      h('article', { class: 'game-card soon' },
        h('div', { class: 'game-art soon-art' }, h('span', null, '+')),
        h('div', { class: 'game-info' },
          h('h3', null, 'Още игри'),
          h('p', null, 'Очаквайте скоро нови заглавия в портала.'),
        ),
      ),
    ),
  );
}

function stat(label, value) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));
}

function gameCard(g, s, i) {
  // Цялата карта води към игра срещу компютъра; „Онлайн“ е отделна връзка отгоре.
  return h('article', {
    class: 'game-card',
    style: { '--accent-g': g.accent, animationDelay: `${i * 60}ms` },
  },
    h('a', { href: `#/play/${g.id}`, class: 'game-card-link', 'aria-label': `${g.name} срещу компютъра` }),
    h('div', { class: 'game-art', html: ART[g.id] }),
    h('div', { class: 'game-info' },
      h('div', { class: 'game-title-row' },
        h('h3', null, g.name),
        h('span', { class: 'play-pill' }, icon('play', 14), 'Играй'),
      ),
      h('p', null, g.tagline),
      h('div', { class: 'game-meta' },
        h('span', null, g.players),
        s && s.played > 0 && h('span', { class: 'mini-stats' }, `${s.wins} победи · ${s.played} игри · ${fmtDuration(s.timeMs)}`),
      ),
      g.online && h('div', { class: 'game-modes' },
        h('a', { href: `#/play/${g.id}`, class: 'btn btn-sm' }, icon('bot', 16), 'Компютър'),
        h('a', { href: `#/online/${g.id}`, class: 'btn btn-sm btn-online' }, icon('users', 16), 'Онлайн'),
      ),
    ),
  );
}
