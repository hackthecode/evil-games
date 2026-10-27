// Онлайн лоби за игра: отворени стаи, създаване на стая, бърза игра, вход с код.
import { session, navigate } from '../app.js';
import { gameById } from '../games/registry.js';
import { seg, loadPrefs, savePrefs } from '../games/common.js';
import { openChannel, isLocalNet } from '../net/channel.js';
import { newRoomId } from '../net/room.js';
import { h, toast, avatar } from '../ui.js';
import { icon } from '../icons.js';

export const NEW_ROOM_KEY = 'eg.newroom';

export function optsText(game, opts = {}) {
  return (game.online.options || [])
    .map((g) => `${g.label}: ${(g.options.find(([v]) => String(v) === String(opts[g.key])) || [, '–'])[1]}`)
    .join(' · ');
}

export function localNetNotice() {
  return isLocalNet() && h('div', { class: 'net-notice' },
    icon('help', 18),
    h('div', null,
      h('b', null, 'Тестов режим. '),
      'Порталът е без онлайн сървър, затова онлайн игра работи само между раздели на този браузър (влезте с различен потребител във всеки раздел). ',
      'За игра с хора от други устройства настройте безплатен Supabase – стъпките са в README.md.'),
  );
}

export async function renderOnline(view, gameId) {
  const game = gameById(gameId);
  if (!game?.online) return navigate('/');
  const user = session.user;
  const prefs = loadPrefs(`online.${gameId}`, Object.fromEntries((game.online.options || []).map((g) => [g.key, g.value])));
  let rooms = [];
  let online = 0;

  const create = () => {
    savePrefs(`online.${gameId}`, prefs);
    const id = newRoomId();
    sessionStorage.setItem(NEW_ROOM_KEY, JSON.stringify({ id, game: gameId, opts: prefs }));
    navigate(`/play/${gameId}?room=${id}`);
  };
  const join = (id) => navigate(`/play/${gameId}?room=${encodeURIComponent(id)}`);
  const quick = () => {
    const free = rooms.find((r) => r.taken < r.total);
    if (free) join(free.id);
    else create();
  };

  const listEl = h('div', { class: 'room-list' });
  const countEl = h('span', { class: 'muted' });
  const codeInput = h('input', { placeholder: 'Код на стая', maxlength: 12, autocomplete: 'off', 'aria-label': 'Код на стая' });

  const renderList = () => {
    countEl.textContent = `${online} ${online === 1 ? 'играч' : 'играчи'} в лобито`;
    listEl.replaceChildren(
      ...(rooms.length
        ? rooms.map((r) =>
            h('div', { class: 'room-row' },
              avatar({ displayName: r.host, color: r.color }, 36),
              h('div', { class: 'room-main' },
                h('b', null, `Стая на ${r.host}`),
                h('span', { class: 'muted' }, [r.names.join(', '), optsText(game, r.opts)].filter(Boolean).join(' · ')),
              ),
              h('span', { class: 'room-seats' }, icon('users', 16), `${r.taken}/${r.total}`),
              h('button', { class: 'btn btn-sm btn-primary', disabled: r.taken >= r.total, onclick: () => join(r.id) }, 'Влез'),
            ))
        : [h('p', { class: 'empty' }, 'Няма отворени стаи. Създайте своя и поканете приятел!')]),
    );
  };

  view.append(
    h('section', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, 'Онлайн'),
      h('h1', null, game.name),
      h('p', { class: 'muted' }, 'Играйте срещу реални хора. Създайте стая и изпратете връзката на приятел или влезте в отворена стая.'),
    ),
    localNetNotice(),
    h('div', { class: 'online-grid' },
      h('div', { class: 'panel glass online-create' },
        h('h2', null, 'Нова стая'),
        (game.online.options || []).map((g) =>
          h('div', { class: 'opt-group' }, h('span', null, g.label), seg(g.options, prefs[g.key], (v) => (prefs[g.key] = v)))),
        game.online.bots && h('p', { class: 'muted small' }, 'Свободните места се заемат от ботове, ако започнете с по-малко хора.'),
        h('div', { class: 'online-actions' },
          h('button', { class: 'btn btn-primary btn-lg', onclick: create }, icon('plus', 18), 'Създай стая'),
          h('button', { class: 'btn btn-lg', onclick: quick }, icon('bolt', 18), 'Бърза игра'),
        ),
        h('form', {
          class: 'join-code',
          onsubmit: (e) => {
            e.preventDefault();
            const v = codeInput.value.trim().toLowerCase();
            if (/^[0-9a-f]{4,12}$/.test(v)) join(v);
            else toast('Невалиден код на стая.', 'error');
          },
        }, codeInput, h('button', { class: 'btn', type: 'submit' }, 'Влез с код')),
      ),
      h('div', { class: 'panel glass' },
        h('div', { class: 'panel-head' }, h('h2', null, 'Отворени стаи'), countEl),
        listEl,
      ),
    ),
  );
  renderList();

  let ch = null;
  try {
    ch = await openChannel(`lobby-${gameId}`, {
      uid: user.id,
      state: { name: user.displayName },
      onMessage() {},
      onPresence(map) {
        online = map.size;
        rooms = [...map.values()]
          .filter((s) => s.room)
          .map((s) => ({ ...s.room, host: s.name, color: s.color }))
          .sort((a, b) => b.taken - a.taken);
        renderList();
      },
    });
  } catch (e) {
    listEl.replaceChildren(h('p', { class: 'empty' }, 'Няма връзка със сървъра: ' + e.message));
  }
  return () => ch?.leave();
}
