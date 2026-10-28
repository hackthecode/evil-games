// Lobby: shared chat for all players, who is online and a quick opponent search.
import { session, navigate } from '../app.js';
import { social } from '../net/social.js';
import { openLobbyChat } from '../net/lobbychat.js';
import { GAMES, gameById } from '../games/registry.js';
import { newRoomId } from '../net/room.js';
import { NEW_ROOM_KEY } from './online.js';
import { INVITE_AFTER_KEY } from './friends.js';
import { h, toast, avatar, modal } from '../ui.js';
import { icon } from '../icons.js';
import { admin } from '../net/admin.js';
import { txt, LOCALE } from '../i18n.js';

const time = (iso) => new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

export async function renderLobby(view) {
  const me = session.user;
  const list = h('div', { class: 'lobby-msgs', 'aria-live': 'polite' });
  const note = h('p', { class: 'muted lobby-note' });
  const input = h('input', { class: 'lobby-input', placeholder: txt('Write to everyone…'), maxlength: 300, 'aria-label': txt('Message') });
  const sendBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, txt('Send'));
  const online = h('div', { class: 'lobby-online' });
  const seekBox = h('div', { class: 'lobby-seek' });

  const chat = openLobbyChat(me, (msgs, err) => {
    note.textContent = err || '';
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    list.replaceChildren(...(msgs.length ? msgs : []).map((m) => h('div', { class: `lobby-msg ${m.user_id === me.id ? 'me' : ''}` },
      avatar({ displayName: m.name, color: m.color }, 28),
      h('div', null, h('b', null, m.name || txt('Player')), h('small', { class: 'muted' }, ' ' + time(m.created_at)), h('p', null, m.body)),
      m.user_id !== me.id && h('button', { class: 'lobby-report', title: txt('Report'), 'aria-label': txt('Report the message'), onclick: () => reportMsg(m) }, '⚑'))));
    if (!msgs.length) list.append(h('p', { class: 'muted lobby-empty' }, txt('No messages yet. Say "Hello"!')));
    if (atBottom) list.scrollTop = list.scrollHeight;
  });

  const form = h('form', {
    class: 'lobby-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      sendBtn.disabled = true;
      try {
        await chat.send(v);
        input.value = '';
        list.scrollTop = list.scrollHeight;
      } catch (err) {
        toast(err.message, 'error');
      }
      sendBtn.disabled = false;
      input.focus();
    },
  }, input, sendBtn);

  async function reportMsg(m) {
    const reason = h('input', { class: 'lobby-input', maxlength: 300, placeholder: txt('E.g. insults, spam…'), 'aria-label': txt('Reason') });
    const ok = await modal({
      title: txt('Report a message from {0}', m.name || txt('player')),
      body: h('div', null, h('blockquote', { class: 'lobby-quote' }, m.body), reason),
      actions: [{ label: txt('Cancel'), value: false }, { label: txt('Send the report'), value: true, primary: true }],
    });
    if (!ok) return;
    try { await admin.report({ messageId: m.id, reason: reason.value, user: me, body: m.body, target: m.user_id }); toast(txt('The report has been sent to the administrators.'), 'success'); } catch (e) { toast(e.message, 'error'); }
  }

  // ---------- quick game ----------
  const onlineGames = GAMES.filter((g) => g.online);
  let matching = false;
  function tryMatch() {
    const want = social.seeking;
    if (!want || matching) return;
    for (const [uid, st] of social.present()) {
      if (uid === me.id || st.seek !== want) continue;
      // the smaller id creates the room – the other waits for an invitation
      if (me.id < uid) {
        matching = true;
        social.setSeek(null);
        const g = gameById(want);
        const id = newRoomId();
        const opts = Object.fromEntries((g.online.options || []).map((o) => [o.key, o.value]));
        sessionStorage.setItem(NEW_ROOM_KEY, JSON.stringify({ id, game: g.id, opts }));
        sessionStorage.setItem(INVITE_AFTER_KEY, JSON.stringify({ room: id, uid, name: st.name, kind: 'match' }));
        toast(txt('Opponent found: {0}!', st.name), 'success');
        navigate(`/play/${g.id}?room=${id}`);
      }
      return;
    }
  }

  function draw() {
    const present = [...social.present()];
    online.replaceChildren(
      h('h3', null, txt('Online ({0})', present.length)),
      ...present.map(([uid, st]) => h('div', { class: 'lobby-user' }, avatar({ displayName: st.name, color: st.color }, 26),
        h('span', null, st.name || txt('Player'), uid === me.id ? h('small', { class: 'muted' }, txt(' (you)')) : null),
        st.seek ? h('small', { class: 'lobby-tag' }, txt('looking for {0}', gameById(st.seek)?.name || '')) : st.where?.game ? h('small', { class: 'muted' }, txt('playing {0}', gameById(st.where.game)?.name || '')) : null)));
    const seekers = (gid) => present.filter(([uid, st]) => uid !== me.id && st.seek === gid).length;
    seekBox.replaceChildren(
      h('h3', null, txt('Quick game')),
      h('p', { class: 'muted' }, txt('Choose a game – we\'ll connect you with the first free opponent looking for the same.')),
      h('div', { class: 'lobby-games' }, onlineGames.map((g) => {
        const on = social.seeking === g.id;
        const n = seekers(g.id);
        return h('button', { class: `lobby-game ${on ? 'on' : ''}`, style: { '--accent-g': g.accent }, onclick: () => { social.setSeek(on ? null : g.id); draw(); tryMatch(); } },
          h('b', null, g.name), h('small', null, on ? txt('Looking for an opponent… (tap to cancel)') : n ? txt('{0} looking', n) : txt('Find an opponent')));
      })));
  }

  const off = social.on((e) => { if (e.type === 'presence') { draw(); tryMatch(); } });
  draw();

  view.append(
    h('section', { class: 'page-head' }, h('h1', null, txt('Lobby')), h('p', { class: 'muted' }, txt('Talk to all the players on the portal and find an opponent with one tap.'))),
    h('div', { class: 'lobby-grid' },
      h('div', { class: 'panel glass lobby-chat' }, h('h3', null, icon('chat', 18), txt(' Shared chat')), note, list, form),
      h('div', { class: 'lobby-side' }, h('div', { class: 'panel glass' }, seekBox), h('div', { class: 'panel glass' }, online))));
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
  return () => { off(); chat.close(); social.setSeek(null); };
}
