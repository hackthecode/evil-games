// Shared lobby chat: Supabase (lobby_messages table + Realtime) or locally
// (localStorage + BroadcastChannel – only between the tabs of this browser).
import { store } from '../store/index.js';
import { txt } from '../i18n.js';

const LOCAL_KEY = 'eg.lobby.v1';

export function openLobbyChat(user, onMessages) {
  return store.kind === 'supabase' ? openSupabase(onMessages) : openLocal(user, onMessages);
}

function openLocal(user, onMessages) {
  const load = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; } };
  const bc = new BroadcastChannel('eg-lobby');
  bc.onmessage = () => onMessages(load());
  const onStorage = (e) => { if (e.key === LOCAL_KEY) onMessages(load()); };
  window.addEventListener('storage', onStorage);
  onMessages(load());
  return {
    async send(body) {
      const list = load();
      list.push({ id: Date.now(), user_id: user.id, name: user.displayName, color: user.color, body: body.slice(0, 300), created_at: new Date().toISOString() });
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(-100)));
      bc.postMessage(1);
      onMessages(load());
    },
    close() { bc.close(); window.removeEventListener('storage', onStorage); },
  };
}

function openSupabase(onMessages) {
  const sb = store.client();
  let list = [];
  let closed = false;
  const push = (rows) => {
    const seen = new Set(list.map((m) => m.id));
    list = [...list, ...rows.filter((r) => !seen.has(r.id))].sort((a, b) => a.id - b.id).slice(-100);
    onMessages(list);
  };
  sb.from('lobby_messages').select('id, user_id, name, color, body, created_at').order('id', { ascending: false }).limit(60)
    .then(({ data, error }) => {
      if (closed) return;
      if (error) onMessages(list, error.message.includes('lobby_messages') ? txt('The chat is not enabled on the server yet.') : error.message);
      else push((data || []).reverse());
    });
  const ch = sb.channel('lobby-chat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_messages' }, (p) => push([p.new]))
    .subscribe();
  return {
    async send(body) {
      const { error } = await sb.from('lobby_messages').insert({ body: body.slice(0, 300) });
      if (error) throw new Error(/Too fast/.test(error.message) ? txt('Too fast – wait a moment.') : error.message);
    },
    close() { closed = true; sb.removeChannel(ch); },
  };
}
