// Приятели: списък (кой е на линия и какво играе), заявки, търсене и покана на игра.
import { session, navigate } from '../app.js';
import { store } from '../store/index.js';
import { social } from '../net/social.js';
import { GAMES, gameById } from '../games/registry.js';
import { newRoomId } from '../net/room.js';
import { NEW_ROOM_KEY } from './online.js';
import { h, toast, avatar, modal } from '../ui.js';
import { icon } from '../icons.js';

export const INVITE_AFTER_KEY = 'eg.inviteAfter';

// Създава стая за играта и поканва приятеля веднага щом стаята е готова.
export function inviteToNewRoom(friend, game) {
  const id = newRoomId();
  const opts = Object.fromEntries((game.online.options || []).map((g) => [g.key, g.value]));
  sessionStorage.setItem(NEW_ROOM_KEY, JSON.stringify({ id, game: game.id, opts }));
  sessionStorage.setItem(INVITE_AFTER_KEY, JSON.stringify({ room: id, uid: friend.id, name: friend.displayName }));
  navigate(`/play/${game.id}?room=${id}`);
}

const whereText = (st) => {
  if (!st) return 'не е на линия';
  const g = st.where?.game && gameById(st.where.game);
  return g ? `играе ${g.name}${st.where.room ? ' онлайн' : ''}` : 'на линия';
};

export async function renderFriends(view) {
  const me = session.user;
  let tab = 'list';
  let list = [];
  let results = [];
  let query = '';

  const body = h('div');
  const tabsEl = h('div', { class: 'tabs' });
  const reload = async () => {
    list = await store.listFriends(me.id);
    draw();
  };

  const act = (fn) => async (e) => {
    e?.currentTarget && (e.currentTarget.disabled = true);
    try {
      await fn();
    } catch (err) {
      toast(err.message, 'error');
    }
    await reload();
    if (tab === 'search') await doSearch();
  };

  async function invite(friend) {
    const gid = await modal({
      title: `Поканете ${friend.displayName} на игра`,
      body: h('p', { class: 'muted' }, 'Изберете игра – ще се създаде стая и приятелят ви ще получи покана.'),
      actions: [...GAMES.filter((g) => g.online).map((g) => ({ label: g.name, value: g.id })), { label: 'Отказ', value: null }],
      className: 'modal-wide',
    });
    if (gid) inviteToNewRoom(friend, gameById(gid));
  }

  function friendRow(f) {
    const u = f.user;
    const st = social.status(u.id);
    return h('div', { class: 'friend-row' },
      h('a', { href: `#/profile/${u.id}`, class: 'friend-who' },
        h('span', { class: 'av-wrap' }, avatar(u, 40), h('i', { class: `net-dot ${st ? 'ok' : ''}` })),
        h('div', null, h('b', null, u.displayName), h('span', { class: 'muted' }, f.status === 'friend' ? whereText(st) : f.status === 'incoming' ? 'иска да сте приятели' : 'чака отговор')),
      ),
      h('div', { class: 'friend-actions' },
        f.status === 'friend' && h('button', { class: 'btn btn-sm btn-primary', disabled: !st, title: st ? '' : 'Не е на линия', onclick: () => invite(u) }, icon('play', 14), 'Покани'),
        f.status === 'incoming' && h('button', {
          class: 'btn btn-sm btn-primary',
          onclick: act(async () => {
            await store.acceptFriend(me.id, u.id);
            social.notifyAccept(u.id).catch(() => {});
          }),
        }, 'Приеми'),
        h('button', {
          class: 'icon-btn', title: f.status === 'friend' ? 'Премахни' : 'Откажи', 'aria-label': 'Премахни',
          onclick: act(async () => {
            if (f.status === 'friend' && !(await modal({ title: 'Премахване', body: h('p', null, `Да премахнете ли ${u.displayName} от приятелите?`), actions: [{ label: 'Отказ', value: false }, { label: 'Премахни', value: true, danger: true }] }))) return;
            await store.removeFriend(me.id, u.id);
          }),
        }, '✕'),
      ),
    );
  }

  async function doSearch() {
    results = query.trim().length >= 2 ? await store.searchUsers(me.id, query) : [];
    draw();
  }

  function draw() {
    const friends = list.filter((f) => f.status === 'friend')
      .sort((a, b) => social.isOnline(b.user.id) - social.isOnline(a.user.id) || a.user.displayName.localeCompare(b.user.displayName));
    const incoming = list.filter((f) => f.status === 'incoming');
    const outgoing = list.filter((f) => f.status === 'outgoing');
    const t = (id, label) => h('button', { class: `tab ${tab === id ? 'active' : ''}`, onclick: () => { tab = id; reload(); } }, label);
    tabsEl.replaceChildren(
      t('list', `Приятели (${friends.length})`),
      t('requests', `Заявки${incoming.length ? ` (${incoming.length})` : ''}`),
      t('search', 'Намери играчи'),
    );
    if (tab === 'list') {
      body.replaceChildren(friends.length
        ? h('div', { class: 'friend-list' }, friends.map(friendRow))
        : h('p', { class: 'empty' }, 'Още нямате приятели. Намерете играчи по потребителско име в „Намери играчи“.'));
    } else if (tab === 'requests') {
      body.replaceChildren(
        h('h3', { class: 'sub' }, 'Получени'),
        incoming.length ? h('div', { class: 'friend-list' }, incoming.map(friendRow)) : h('p', { class: 'muted' }, 'Няма нови заявки.'),
        h('h3', { class: 'sub' }, 'Изпратени'),
        outgoing.length ? h('div', { class: 'friend-list' }, outgoing.map(friendRow)) : h('p', { class: 'muted' }, 'Няма изпратени заявки.'),
      );
    } else {
      const input = h('input', {
        value: query, placeholder: 'Потребителско име…', autocomplete: 'off', 'aria-label': 'Търсене',
        oninput: (e) => {
          query = e.target.value;
          clearTimeout(input._t);
          input._t = setTimeout(doSearch, 250);
        },
      });
      const known = new Map(list.map((f) => [f.user.id, f.status]));
      body.replaceChildren(
        h('div', { class: 'friend-search' }, icon('users', 18), input),
        results.length
          ? h('div', { class: 'friend-list' }, results.map((u) => {
              const st = known.get(u.id);
              return h('div', { class: 'friend-row' },
                h('a', { href: `#/profile/${u.id}`, class: 'friend-who' },
                  h('span', { class: 'av-wrap' }, avatar(u, 40), h('i', { class: `net-dot ${social.isOnline(u.id) ? 'ok' : ''}` })),
                  h('div', null, h('b', null, u.displayName), h('span', { class: 'muted' }, '@' + u.username))),
                h('div', { class: 'friend-actions' },
                  st === 'friend' ? h('span', { class: 'muted' }, 'Приятели')
                    : st === 'outgoing' ? h('span', { class: 'muted' }, 'Заявката е изпратена')
                    : h('button', {
                        class: 'btn btn-sm btn-primary',
                        onclick: act(async () => {
                          await store.requestFriend(me.id, u.id);
                          (st === 'incoming' ? social.notifyAccept(u.id) : social.notifyRequest(u.id)).catch(() => {});
                          toast(st === 'incoming' ? 'Вече сте приятели!' : 'Заявката е изпратена.', 'success');
                        }),
                      }, st === 'incoming' ? 'Приеми' : '+ Добави')));
            }))
          : h('p', { class: 'empty' }, query.trim().length >= 2 ? 'Няма намерени играчи.' : 'Въведете поне 2 букви.'),
      );
      setTimeout(() => input.focus(), 0);
    }
  }

  view.append(
    h('section', { class: 'page-head' },
      h('h1', null, 'Приятели'),
      h('p', { class: 'muted' }, 'Добавете приятели, вижте кой е на линия и ги поканете на игра.'),
    ),
    h('div', { class: 'panel glass' }, tabsEl, body),
  );
  await reload();
  const off = social.on((e) => {
    if (e.type === 'presence') draw();
    if (e.type === 'friend-request' || e.type === 'friend-accept') reload();
  });
  return () => off();
}
