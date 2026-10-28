// Real-time channels: messages (broadcast) and who is online (presence).
// - Supabase Realtime when the portal uses online accounts.
// - BroadcastChannel in local mode: works only between tabs of the same browser
//   (for tests on the computer, without a server).
import { store } from '../store/index.js';
import { txt } from '../i18n.js';

/**
 * Opens a channel. onMessage(msg) for every foreign message, onPresence(Map uid → state)
 * when those present change. Returns { send(msg), track(state), leave() }.
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
    const timer = setTimeout(() => reject(new Error(txt('No connection to the server.'))), 15000);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        reject(new Error(txt('The connection to the server was lost.')));
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

// Local variant: presence is maintained with a periodic "heartbeat".
// (background tabs slow down timers, so the expiry has a large margin)
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
