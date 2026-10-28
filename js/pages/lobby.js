// Лоби: общ чат за всички играчи, кой е на линия и бързо търсене на противник.
import { session, navigate } from '../app.js';
import { social } from '../net/social.js';
import { openLobbyChat } from '../net/lobbychat.js';
import { GAMES, gameById } from '../games/registry.js';
import { newRoomId } from '../net/room.js';
import { NEW_ROOM_KEY } from './online.js';
import { INVITE_AFTER_KEY } from './friends.js';
import { h, toast, avatar } from '../ui.js';
import { icon } from '../icons.js';

const time = (iso) => new Date(iso).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });

export async function renderLobby(view) {
  const me = session.user;
  const list = h('div', { class: 'lobby-msgs', 'aria-live': 'polite' });
  const note = h('p', { class: 'muted lobby-note' });
  const input = h('input', { class: 'lobby-input', placeholder: 'Пишете на всички…', maxlength: 300, 'aria-label': 'Съобщение' });
  const sendBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Прати');
  const online = h('div', { class: 'lobby-online' });
  const seekBox = h('div', { class: 'lobby-seek' });

  const chat = openLobbyChat(me, (msgs, err) => {
    note.textContent = err || '';
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    list.replaceChildren(...(msgs.length ? msgs : []).map((m) => h('div', { class: `lobby-msg ${m.user_id === me.id ? 'me' : ''}` },
      avatar({ displayName: m.name, color: m.color }, 28),
      h('div', null, h('b', null, m.name || 'Играч'), h('small', { class: 'muted' }, ' ' + time(m.created_at)), h('p', null, m.body)))));
    if (!msgs.length) list.append(h('p', { class: 'muted lobby-empty' }, 'Още няма съобщения. Кажете „Здравейте“!'));
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

  // ---------- бърза игра ----------
  const onlineGames = GAMES.filter((g) => g.online);
  let matching = false;
  function tryMatch() {
    const want = social.seeking;
    if (!want || matching) return;
    for (const [uid, st] of social.present()) {
      if (uid === me.id || st.seek !== want) continue;
      // по-малкото id създава стаята – другият чака покана
      if (me.id < uid) {
        matching = true;
        social.setSeek(null);
        const g = gameById(want);
        const id = newRoomId();
        const opts = Object.fromEntries((g.online.options || []).map((o) => [o.key, o.value]));
        sessionStorage.setItem(NEW_ROOM_KEY, JSON.stringify({ id, game: g.id, opts }));
        sessionStorage.setItem(INVITE_AFTER_KEY, JSON.stringify({ room: id, uid, name: st.name, kind: 'match' }));
        toast(`Намерен противник: ${st.name}!`, 'success');
        navigate(`/play/${g.id}?room=${id}`);
      }
      return;
    }
  }

  function draw() {
    const present = [...social.present()];
    online.replaceChildren(
      h('h3', null, `На линия (${present.length})`),
      ...present.map(([uid, st]) => h('div', { class: 'lobby-user' }, avatar({ displayName: st.name, color: st.color }, 26),
        h('span', null, st.name || 'Играч', uid === me.id ? h('small', { class: 'muted' }, ' (вие)') : null),
        st.seek ? h('small', { class: 'lobby-tag' }, `търси ${gameById(st.seek)?.name || ''}`) : st.where?.game ? h('small', { class: 'muted' }, `играе ${gameById(st.where.game)?.name || ''}`) : null)));
    const seekers = (gid) => present.filter(([uid, st]) => uid !== me.id && st.seek === gid).length;
    seekBox.replaceChildren(
      h('h3', null, 'Бърза игра'),
      h('p', { class: 'muted' }, 'Изберете игра – ще ви свържем с първия свободен противник, който търси същото.'),
      h('div', { class: 'lobby-games' }, onlineGames.map((g) => {
        const on = social.seeking === g.id;
        const n = seekers(g.id);
        return h('button', { class: `lobby-game ${on ? 'on' : ''}`, style: { '--accent-g': g.accent }, onclick: () => { social.setSeek(on ? null : g.id); draw(); tryMatch(); } },
          h('b', null, g.name), h('small', null, on ? 'Търсим противник… (натиснете за отказ)' : n ? `${n} търсят` : 'Търси противник'));
      })));
  }

  const off = social.on((e) => { if (e.type === 'presence') { draw(); tryMatch(); } });
  draw();

  view.append(
    h('section', { class: 'page-head' }, h('h1', null, 'Лоби'), h('p', { class: 'muted' }, 'Говорете с всички играчи на портала и намерете противник с едно натискане.')),
    h('div', { class: 'lobby-grid' },
      h('div', { class: 'panel glass lobby-chat' }, h('h3', null, icon('chat', 18), ' Общ чат'), note, list, form),
      h('div', { class: 'lobby-side' }, h('div', { class: 'panel glass' }, seekBox), h('div', { class: 'panel glass' }, online))));
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
  return () => { off(); chat.close(); social.setSeek(null); };
}
