// Online lobby for a game: open rooms, creating a room, quick game, joining by code.
import { session, navigate } from '../app.js';
import { gameById } from '../games/registry.js';
import { seg, loadPrefs, savePrefs } from '../games/common.js';
import { openChannel, isLocalNet } from '../net/channel.js';
import { newRoomId } from '../net/room.js';
import { h, toast, avatar } from '../ui.js';
import { icon } from '../icons.js';
import { txt } from '../i18n.js';

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
      h('b', null, txt('Test mode. ')),
      txt('The portal has no online server, so online play only works between tabs of this browser (log in with a different user in each tab). '),
      txt('To play with people on other devices, set up a free Supabase – the steps are in README.md.')),
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
  const codeInput = h('input', { placeholder: txt('Room code'), maxlength: 12, autocomplete: 'off', 'aria-label': txt('Room code') });

  const renderList = () => {
    countEl.textContent = txt('{0} {1} in the lobby', online, online === 1 ? txt('player') : txt('players'));
    listEl.replaceChildren(
      ...(rooms.length
        ? rooms.map((r) =>
            h('div', { class: 'room-row' },
              avatar({ displayName: r.host, color: r.color }, 36),
              h('div', { class: 'room-main' },
                h('b', null, txt('{0}\'s room', r.host)),
                h('span', { class: 'muted' }, [r.names.join(', '), optsText(game, r.opts)].filter(Boolean).join(' · ')),
              ),
              h('span', { class: 'room-seats' }, icon('users', 16), `${r.taken}/${r.total}`),
              h('button', { class: 'btn btn-sm btn-primary', disabled: r.taken >= r.total, onclick: () => join(r.id) }, txt('Join')),
            ))
        : [h('p', { class: 'empty' }, txt('No open rooms. Create your own and invite a friend!'))]),
    );
  };

  view.append(
    h('section', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, txt('Online')),
      h('h1', null, game.name),
      h('p', { class: 'muted' }, txt('Play against real people. Create a room and send the link to a friend, or join an open room.')),
    ),
    localNetNotice(),
    h('div', { class: 'online-grid' },
      h('div', { class: 'panel glass online-create' },
        h('h2', null, txt('New room')),
        (game.online.options || []).map((g) =>
          h('div', { class: 'opt-group' }, h('span', null, g.label), seg(g.options, prefs[g.key], (v) => (prefs[g.key] = v)))),
        game.online.bots && h('p', { class: 'muted small' }, txt('Free seats are taken by bots if you start with fewer people.')),
        h('div', { class: 'online-actions' },
          h('button', { class: 'btn btn-primary btn-lg', onclick: create }, icon('plus', 18), txt('Create a room')),
          h('button', { class: 'btn btn-lg', onclick: quick }, icon('bolt', 18), txt('Quick game')),
        ),
        h('form', {
          class: 'join-code',
          onsubmit: (e) => {
            e.preventDefault();
            const v = codeInput.value.trim().toLowerCase();
            if (/^[0-9a-f]{4,12}$/.test(v)) join(v);
            else toast(txt('Invalid room code.'), 'error');
          },
        }, codeInput, h('button', { class: 'btn', type: 'submit' }, txt('Join with a code'))),
      ),
      h('div', { class: 'panel glass' },
        h('div', { class: 'panel-head' }, h('h2', null, txt('Open rooms')), countEl),
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
    listEl.replaceChildren(h('p', { class: 'empty' }, txt('No connection to the server: ') + e.message));
  }
  return () => ch?.leave();
}
