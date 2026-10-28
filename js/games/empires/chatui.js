// Evil Empires – in-game chat: the alliance, private messages between rulers and the portal's
// shared lobby. A side panel (full screen on phones), a 💬 button with the unread count.
import { h, toast } from '../../ui.js';
import { openLobbyChat } from '../../net/lobbychat.js';
import { dmKey } from './worldcore.js';
import { txt, LOCALE } from '../../i18n.js';

const clock = (t) => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

/**
 * uid, user – the current player; W – the world; doWorld(name, args) – a world action (say / dm).
 * Returns { button, refresh(), isOpen(), destroy() }.
 */
export function createChat({ uid, user, W, doWorld }) {
  const READ_KEY = `ee.chatRead.${uid}`;
  let read = {};
  try { read = JSON.parse(localStorage.getItem(READ_KEY)) || {}; } catch {}
  const markRead = (ch, t) => {
    if (!t || (read[ch] || 0) >= t) return;
    read[ch] = t;
    try { localStorage.setItem(READ_KEY, JSON.stringify(read)); } catch {}
  };

  let tab = 'ally', peer = null, lobby = null, lobbyMsgs = [], lobbyErr = '';
  const badge = h('span', { class: 'ee-badge', hidden: true });
  const button = h('button', { class: 'ee-tool ee-chat-b', title: txt('Chat'), 'aria-label': txt('Chat'), onclick: () => toggle() }, '💬', badge);
  const body = h('div', { class: 'ee-chatp-body' });
  const tabs = h('div', { class: 'seg ee-chatp-tabs' });
  const panel = h('aside', { class: 'ee-chatp', role: 'dialog', 'aria-label': txt('Chat'), hidden: true },
    h('div', { class: 'ee-chatp-head' }, h('b', null, txt('Chat')), h('button', { class: 'icon-btn', 'aria-label': txt('Close'), onclick: () => toggle(false) }, '✕')),
    tabs, body);
  document.body.append(panel);

  // the online world arrives from the server shortly after start – until then the chat is empty
  const safe = (f, d) => { try { return f() ?? d; } catch { return d; } };
  const ally = () => safe(() => W.allianceOf(uid), null);
  const dms = () => safe(() => W.dms(), {});
  const players = () => safe(() => W.players(), []);
  const otherOf = (k) => k.split('|').find((x) => x !== uid);
  const nameOf = (id) => players().find((p) => p.uid === id)?.name || txt('Ruler');

  function unread() {
    let n = 0;
    const a = ally();
    if (a) n += a.chat.filter((m) => !m.sys && m.uid !== uid && m.t > (read.ally || 0)).length;
    for (const [k, list] of Object.entries(dms())) n += list.filter((m) => m.uid !== uid && m.t > (read[k] || 0)).length;
    return n;
  }

  function updateBadge() {
    const n = unread();
    badge.hidden = !n;
    badge.textContent = n > 9 ? '9+' : String(n);
  }

  const msgEl = (mine, name, text, t, sys) => h('div', { class: `ee-msg ${sys ? 'sys' : mine ? 'me' : ''}` },
    !sys && !mine && h('b', null, name), h('span', null, text), h('small', { class: 'muted' }, clock(t)));

  // The message list updates itself without losing what was typed in the field.
  let listEl = null, listFn = null, viewKey = '';
  function list(fn, empty) {
    listFn = () => { const items = fn(); return items.length ? items : [h('p', { class: 'muted ee-center' }, empty)]; };
    listEl = h('div', { class: 'ee-chat ee-chatp-list' }, listFn());
    requestAnimationFrame(() => { listEl.scrollTop = listEl.scrollHeight; });
    return listEl;
  }
  function refreshList() {
    if (!listEl) return;
    const atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 60;
    listEl.replaceChildren(...listFn());
    if (atBottom) listEl.scrollTop = listEl.scrollHeight;
  }

  function input(placeholder, send) {
    const inp = h('input', { class: 'ee-input', maxlength: 400, placeholder, 'aria-label': placeholder });
    const go = async () => {
      const v = inp.value.trim();
      if (!v) return;
      inp.value = '';
      try { await send(v); refresh(); } catch (e) { toast(e.message, 'error'); inp.value = v; }
      inp.focus();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    setTimeout(() => inp.focus(), 50);
    return h('div', { class: 'ee-chat-in' }, inp, h('button', { class: 'btn btn-primary btn-sm', onclick: go }, txt('Send')));
  }

  function draw() {
    viewKey = `${tab}:${peer || ''}:${!!ally()}`;
    listEl = null;
    const a = ally();
    const dmUnread = Object.entries(dms()).reduce((n, [k, l]) => n + l.filter((m) => m.uid !== uid && m.t > (read[k] || 0)).length, 0);
    const allyUnread = a ? a.chat.filter((m) => !m.sys && m.uid !== uid && m.t > (read.ally || 0)).length : 0;
    const tabBtn = (id, label, n) => h('button', { type: 'button', class: tab === id ? 'on' : '', onclick: () => { tab = id; peer = null; draw(); } }, label, n ? h('span', { class: 'ee-badge in' }, String(n)) : null);
    tabs.replaceChildren(tabBtn('ally', txt('Alliance'), tab === 'ally' ? 0 : allyUnread), tabBtn('dm', txt('Private'), tab === 'dm' && peer ? 0 : dmUnread), tabBtn('lobby', txt('Lobby'), 0));

    if (tab === 'ally') {
      if (!a) return body.replaceChildren(h('p', { class: 'muted' }, txt('You are not in an alliance. Join or found one in the "Alliance" tab (an Embassy is required).')));
      markRead('ally', a.chat.at(-1)?.t);
      body.replaceChildren(
        h('small', { class: 'muted' }, txt('[{0}] {1} · {2} members', a.tag, a.name, a.members.length)),
        list(() => (ally()?.chat || []).slice(-80).map((m) => msgEl(m.uid === uid, m.name, m.text, m.t, m.sys)), txt('No messages yet.')),
        input(txt('Write to the alliance…'), (v) => doWorld('say', [v])));
    } else if (tab === 'dm') {
      if (peer) {
        const k = dmKey(uid, peer);
        markRead(k, (dms()[k] || []).at(-1)?.t);
        body.replaceChildren(
          h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { peer = null; draw(); } }, txt('← Conversations')),
          h('b', null, nameOf(peer)),
          list(() => (dms()[k] || []).map((m) => msgEl(m.uid === uid, m.name, m.text, m.t)), txt('Write the first message.')),
          input(txt('Message to {0}…', nameOf(peer)), (v) => doWorld('dm', [peer, v])));
      } else {
        const convs = Object.entries(dms()).map(([k, l]) => ({ k, other: otherOf(k), last: l.at(-1) })).filter((c) => c.last).sort((x, y) => y.last.t - x.last.t);
        const others = players().filter((p) => p.uid !== uid).sort((x, y) => x.name.localeCompare(y.name, LOCALE));
        const pick = h('select', { class: 'ee-input', 'aria-label': txt('New conversation') },
          h('option', { value: '' }, others.length ? txt('New conversation with…') : txt('There are no other rulers in the world')),
          others.map((p) => h('option', { value: p.uid }, p.name)));
        pick.addEventListener('change', () => { if (pick.value) { peer = pick.value; draw(); } });
        body.replaceChildren(pick,
          h('div', { class: 'ee-convs' }, convs.length ? convs.map((c) => {
            const n = (dms()[c.k] || []).filter((m) => m.uid !== uid && m.t > (read[c.k] || 0)).length;
            return h('button', { class: 'ee-conv', onclick: () => { peer = c.other; draw(); } },
              h('b', null, nameOf(c.other)), n ? h('span', { class: 'ee-badge in' }, String(n)) : null,
              h('small', { class: 'muted' }, `${c.last.uid === uid ? txt('You: ') : ''}${c.last.text.slice(0, 60)} · ${clock(c.last.t)}`));
          }) : h('p', { class: 'muted' }, txt('You have no private conversations.'))));
      }
    } else {
      if (!lobby) lobby = openLobbyChat(user, (msgs, err) => { lobbyMsgs = msgs; lobbyErr = err || ''; if (tab === 'lobby' && !panel.hidden) refresh(); });
      body.replaceChildren(
        list(() => lobbyMsgs.map((m) => msgEl(m.user_id === uid, m.name || txt('Player'), m.body, new Date(m.created_at).getTime())), lobbyErr || txt('No messages in the lobby yet.')),
        input(txt('Write to everyone on the portal…'), (v) => lobby.send(v)));
    }
    updateBadge();
  }

  function toggle(on = panel.hidden) {
    panel.hidden = !on;
    button.classList.toggle('on', on);
    if (on) draw();
  }

  // New messages: same view – only the list (and "read"), otherwise the whole panel.
  function refresh() {
    if (panel.hidden) return updateBadge();
    if (viewKey !== `${tab}:${peer || ''}:${!!ally()}` || tab === 'dm' && !peer) return draw();
    if (tab === 'ally') markRead('ally', ally()?.chat.at(-1)?.t);
    if (tab === 'dm' && peer) markRead(dmKey(uid, peer), (dms()[dmKey(uid, peer)] || []).at(-1)?.t);
    refreshList();
    updateBadge();
  }

  updateBadge();
  return {
    button,
    isOpen: () => !panel.hidden,
    refresh,
    destroy() { lobby?.close(); panel.remove(); },
  };
}
