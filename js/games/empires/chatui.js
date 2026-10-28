// Evil Empires – чат в самата игра: съюзът, лични съобщения между владетелите и общото лоби
// на портала. Панел отстрани (на телефон – на цял екран), бутон 💬 с брой непрочетени.
import { h, toast } from '../../ui.js';
import { openLobbyChat } from '../../net/lobbychat.js';
import { dmKey } from './worldcore.js';

const clock = (t) => new Date(t).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });

/**
 * uid, user – текущият играч; W – светът; doWorld(name, args) – действие в света (say / dm).
 * Връща { button, refresh(), isOpen(), destroy() }.
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
  const button = h('button', { class: 'ee-tool ee-chat-b', title: 'Чат', 'aria-label': 'Чат', onclick: () => toggle() }, '💬', badge);
  const body = h('div', { class: 'ee-chatp-body' });
  const tabs = h('div', { class: 'seg ee-chatp-tabs' });
  const panel = h('aside', { class: 'ee-chatp', role: 'dialog', 'aria-label': 'Чат', hidden: true },
    h('div', { class: 'ee-chatp-head' }, h('b', null, 'Чат'), h('button', { class: 'icon-btn', 'aria-label': 'Затвори', onclick: () => toggle(false) }, '✕')),
    tabs, body);
  document.body.append(panel);

  // онлайн светът идва от сървъра малко след старта – дотогава чатът е празен
  const safe = (f, d) => { try { return f() ?? d; } catch { return d; } };
  const ally = () => safe(() => W.allianceOf(uid), null);
  const dms = () => safe(() => W.dms(), {});
  const players = () => safe(() => W.players(), []);
  const otherOf = (k) => k.split('|').find((x) => x !== uid);
  const nameOf = (id) => players().find((p) => p.uid === id)?.name || 'Владетел';

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

  // Списъкът със съобщения се обновява сам, без да губи написаното в полето.
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
    return h('div', { class: 'ee-chat-in' }, inp, h('button', { class: 'btn btn-primary btn-sm', onclick: go }, 'Прати'));
  }

  function draw() {
    viewKey = `${tab}:${peer || ''}:${!!ally()}`;
    listEl = null;
    const a = ally();
    const dmUnread = Object.entries(dms()).reduce((n, [k, l]) => n + l.filter((m) => m.uid !== uid && m.t > (read[k] || 0)).length, 0);
    const allyUnread = a ? a.chat.filter((m) => !m.sys && m.uid !== uid && m.t > (read.ally || 0)).length : 0;
    const tabBtn = (id, label, n) => h('button', { type: 'button', class: tab === id ? 'on' : '', onclick: () => { tab = id; peer = null; draw(); } }, label, n ? h('span', { class: 'ee-badge in' }, String(n)) : null);
    tabs.replaceChildren(tabBtn('ally', 'Съюз', tab === 'ally' ? 0 : allyUnread), tabBtn('dm', 'Лични', tab === 'dm' && peer ? 0 : dmUnread), tabBtn('lobby', 'Лоби', 0));

    if (tab === 'ally') {
      if (!a) return body.replaceChildren(h('p', { class: 'muted' }, 'Не сте в съюз. Присъединете се или основете съюз в раздела „Съюз“ (нужно е Посолство).'));
      markRead('ally', a.chat.at(-1)?.t);
      body.replaceChildren(
        h('small', { class: 'muted' }, `[${a.tag}] ${a.name} · ${a.members.length} членове`),
        list(() => (ally()?.chat || []).slice(-80).map((m) => msgEl(m.uid === uid, m.name, m.text, m.t, m.sys)), 'Още няма съобщения.'),
        input('Пишете на съюза…', (v) => doWorld('say', [v])));
    } else if (tab === 'dm') {
      if (peer) {
        const k = dmKey(uid, peer);
        markRead(k, (dms()[k] || []).at(-1)?.t);
        body.replaceChildren(
          h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { peer = null; draw(); } }, '← Разговори'),
          h('b', null, nameOf(peer)),
          list(() => (dms()[k] || []).map((m) => msgEl(m.uid === uid, m.name, m.text, m.t)), 'Напишете първото съобщение.'),
          input(`Съобщение до ${nameOf(peer)}…`, (v) => doWorld('dm', [peer, v])));
      } else {
        const convs = Object.entries(dms()).map(([k, l]) => ({ k, other: otherOf(k), last: l.at(-1) })).filter((c) => c.last).sort((x, y) => y.last.t - x.last.t);
        const others = players().filter((p) => p.uid !== uid).sort((x, y) => x.name.localeCompare(y.name, 'bg'));
        const pick = h('select', { class: 'ee-input', 'aria-label': 'Нов разговор' },
          h('option', { value: '' }, others.length ? 'Нов разговор с…' : 'Няма други владетели в света'),
          others.map((p) => h('option', { value: p.uid }, p.name)));
        pick.addEventListener('change', () => { if (pick.value) { peer = pick.value; draw(); } });
        body.replaceChildren(pick,
          h('div', { class: 'ee-convs' }, convs.length ? convs.map((c) => {
            const n = (dms()[c.k] || []).filter((m) => m.uid !== uid && m.t > (read[c.k] || 0)).length;
            return h('button', { class: 'ee-conv', onclick: () => { peer = c.other; draw(); } },
              h('b', null, nameOf(c.other)), n ? h('span', { class: 'ee-badge in' }, String(n)) : null,
              h('small', { class: 'muted' }, `${c.last.uid === uid ? 'Вие: ' : ''}${c.last.text.slice(0, 60)} · ${clock(c.last.t)}`));
          }) : h('p', { class: 'muted' }, 'Нямате лични разговори.')));
      }
    } else {
      if (!lobby) lobby = openLobbyChat(user, (msgs, err) => { lobbyMsgs = msgs; lobbyErr = err || ''; if (tab === 'lobby' && !panel.hidden) refresh(); });
      body.replaceChildren(
        list(() => lobbyMsgs.map((m) => msgEl(m.user_id === uid, m.name || 'Играч', m.body, new Date(m.created_at).getTime())), lobbyErr || 'Още няма съобщения в лобито.'),
        input('Пишете на всички в портала…', (v) => lobby.send(v)));
    }
    updateBadge();
  }

  function toggle(on = panel.hidden) {
    panel.hidden = !on;
    button.classList.toggle('on', on);
    if (on) draw();
  }

  // Нови съобщения: при същия изглед – само списъкът (и „прочетено“), иначе целият панел.
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
