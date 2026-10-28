// Friends: list (who is online and what they play), requests, search and game invitations.
import { session, navigate } from '../app.js';
import { store } from '../store/index.js';
import { social } from '../net/social.js';
import { GAMES, gameById } from '../games/registry.js';
import { newRoomId } from '../net/room.js';
import { NEW_ROOM_KEY } from './online.js';
import { h, toast, avatar, modal } from '../ui.js';
import { icon } from '../icons.js';
import { txt } from '../i18n.js';

export const INVITE_AFTER_KEY = 'eg.inviteAfter';

// Creates a room for the game and invites the friend as soon as the room is ready.
export function inviteToNewRoom(friend, game) {
  const id = newRoomId();
  const opts = Object.fromEntries((game.online.options || []).map((g) => [g.key, g.value]));
  sessionStorage.setItem(NEW_ROOM_KEY, JSON.stringify({ id, game: game.id, opts }));
  sessionStorage.setItem(INVITE_AFTER_KEY, JSON.stringify({ room: id, uid: friend.id, name: friend.displayName }));
  navigate(`/play/${game.id}?room=${id}`);
}

const whereText = (st) => {
  if (!st) return txt('offline');
  const g = st.where?.game && gameById(st.where.game);
  return g ? txt('playing {0}{1}', g.name, st.where.room ? txt(' online') : '') : txt('online now');
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
      title: txt('Invite {0} to a game', friend.displayName),
      body: h('p', { class: 'muted' }, txt('Choose a game – a room will be created and your friend will get an invitation.')),
      actions: [...GAMES.filter((g) => g.online).map((g) => ({ label: g.name, value: g.id })), { label: txt('Cancel'), value: null }],
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
        h('div', null, h('b', null, u.displayName), h('span', { class: 'muted' }, f.status === 'friend' ? whereText(st) : f.status === 'incoming' ? txt('wants to be friends') : txt('waiting for an answer'))),
      ),
      h('div', { class: 'friend-actions' },
        f.status === 'friend' && h('button', { class: 'btn btn-sm btn-primary', disabled: !st, title: st ? '' : txt('Offline'), onclick: () => invite(u) }, icon('play', 14), txt('Invite')),
        f.status === 'incoming' && h('button', {
          class: 'btn btn-sm btn-primary',
          onclick: act(async () => {
            await store.acceptFriend(me.id, u.id);
            social.notifyAccept(u.id).catch(() => {});
          }),
        }, txt('Accept')),
        h('button', {
          class: 'icon-btn', title: f.status === 'friend' ? txt('Remove') : txt('Decline'), 'aria-label': txt('Remove'),
          onclick: act(async () => {
            if (f.status === 'friend' && !(await modal({ title: txt('Removing'), body: h('p', null, txt('Remove {0} from your friends?', u.displayName)), actions: [{ label: txt('Cancel'), value: false }, { label: txt('Remove'), value: true, danger: true }] }))) return;
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
    const tabButton = (id, label) => h('button', { class: `tab ${tab === id ? 'active' : ''}`, onclick: () => { tab = id; reload(); } }, label);
    tabsEl.replaceChildren(
      tabButton('list', txt('Friends ({0})', friends.length)),
      tabButton('requests', txt('Requests{0}', incoming.length ? ` (${incoming.length})` : '')),
      tabButton('search', txt('Find players')),
    );
    if (tab === 'list') {
      body.replaceChildren(friends.length
        ? h('div', { class: 'friend-list' }, friends.map(friendRow))
        : h('p', { class: 'empty' }, txt('You have no friends yet. Find players by username in "Find players".')));
    } else if (tab === 'requests') {
      body.replaceChildren(
        h('h3', { class: 'sub' }, txt('Received')),
        incoming.length ? h('div', { class: 'friend-list' }, incoming.map(friendRow)) : h('p', { class: 'muted' }, txt('No new requests.')),
        h('h3', { class: 'sub' }, txt('Sent')),
        outgoing.length ? h('div', { class: 'friend-list' }, outgoing.map(friendRow)) : h('p', { class: 'muted' }, txt('No sent requests.')),
      );
    } else {
      const input = h('input', {
        value: query, placeholder: txt('Username…'), autocomplete: 'off', 'aria-label': txt('Search'),
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
                  st === 'friend' ? h('span', { class: 'muted' }, txt('Friends'))
                    : st === 'outgoing' ? h('span', { class: 'muted' }, txt('Request sent'))
                    : h('button', {
                        class: 'btn btn-sm btn-primary',
                        onclick: act(async () => {
                          await store.requestFriend(me.id, u.id);
                          (st === 'incoming' ? social.notifyAccept(u.id) : social.notifyRequest(u.id)).catch(() => {});
                          toast(st === 'incoming' ? txt('You are now friends!') : txt('The request has been sent.'), 'success');
                        }),
                      }, st === 'incoming' ? txt('Accept') : txt('+ Add'))));
            }))
          : h('p', { class: 'empty' }, query.trim().length >= 2 ? txt('No players found.') : txt('Enter at least 2 letters.')),
      );
      setTimeout(() => input.focus(), 0);
    }
  }

  view.append(
    h('section', { class: 'page-head' },
      h('h1', null, txt('Friends')),
      h('p', { class: 'muted' }, txt('Add friends, see who is online and invite them to a game.')),
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
