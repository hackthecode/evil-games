// Канали за реално време: съобщения (broadcast) и кой е на линия (presence).
// - Supabase Realtime, когато порталът е с онлайн акаунти.
// - BroadcastChannel в локален режим: работи само между раздели на същия браузър
//   (за тестове на компютъра, без сървър).
import { store } from '../store/index.js';

/**
 * Отваря канал. onMessage(msg) за всяко чуждо съобщение, onPresence(Map uid → state)
 * при промяна на присъстващите. Връща { send(msg), track(state), leave() }.
 */
export async function openChannel(name, { uid, state, onMessage, onPresence }) {
  return store.kind === 'supabase'
    ? openSupabase(name, { uid, state, onMessage, onPresence })
    : openLocal(name, { uid, state, onMessage, onPresence });
}

export const isLocalNet = () => store.kind !== 'supabase';

async function openSupabase(name, { uid, state, onMessage, onPresence }) {
  const sb = store.client();
  const ch = sb.channel(name, { config: { broadcast: { self: false }, presence: { key: uid } } });
  const presence = () => {
    const map = new Map();
    for (const [key, metas] of Object.entries(ch.presenceState())) if (metas.length) map.set(key, metas[metas.length - 1]);
    return map;
  };
  ch.on('broadcast', { event: 'm' }, ({ payload }) => onMessage(payload));
  ch.on('presence', { event: 'sync' }, () => onPresence(presence()));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Няма връзка със сървъра.')), 15000);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        reject(new Error('Връзката със сървъра прекъсна.'));
      }
    });
  });
  await ch.track(state);
  return {
    send: (msg) => ch.send({ type: 'broadcast', event: 'm', payload: msg }),
    track: (s) => ch.track(s),
    leave: () => sb.removeChannel(ch),
  };
}

// Локален вариант: присъствието се поддържа с периодичен „пулс“.
// (фоновите раздели забавят таймерите, затова изтичането е с голям запас)
const BEAT_MS = 3000, EXPIRE_MS = 20000;

async function openLocal(name, { uid, state, onMessage, onPresence }) {
  const bc = new BroadcastChannel('eg-' + name);
  const peers = new Map(); // uid → { state, seen }
  let me = state;
  let closed = false;
  const emit = () => {
    const map = new Map([[uid, me]]);
    for (const [k, v] of peers) map.set(k, v.state);
    onPresence(map);
  };
  const beat = () => !closed && bc.postMessage({ k: 'p', uid, state: me });
  bc.onmessage = ({ data }) => {
    if (closed || !data) return;
    if (data.k === 'p') {
      const isNew = !peers.has(data.uid);
      peers.set(data.uid, { state: data.state, seen: Date.now() });
      if (isNew) beat();
      emit();
    } else if (data.k === 'bye') {
      if (peers.delete(data.uid)) emit();
    } else if (data.k === 'm') {
      onMessage(data.msg);
    }
  };
  const bye = () => bc.postMessage({ k: 'bye', uid });
  const timer = setInterval(() => {
    beat();
    let changed = false;
    for (const [k, v] of peers) if (Date.now() - v.seen > EXPIRE_MS) changed = peers.delete(k) || changed;
    if (changed) emit();
  }, BEAT_MS);
  window.addEventListener('pagehide', bye);
  beat();
  emit();
  return {
    send: (msg) => !closed && bc.postMessage({ k: 'm', msg }),
    track: (s) => { me = s; beat(); emit(); },
    leave: () => {
      if (closed) return;
      bye();
      closed = true;
      clearInterval(timer);
      window.removeEventListener('pagehide', bye);
      bc.close();
    },
  };
}
