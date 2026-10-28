// "Table": the game's connection to the referee server. The game receives a series of steps
// { n, seat, type, pub, view } (the public part + its own view) and sends its decisions.
//
// Transports:
//   local  – the referee runs in the same tab (game against the computer);
//   worker – a SharedWorker shared by the browser's tabs (local online test, emulates a server);
//   server – Supabase Edge Function "referee" (real online game).
import { createMatch, forSeat } from './referee/core.js';
import { reducerFor } from './referee/games.js';
import { randomHex } from '../store/hash.js';
import { store } from '../store/index.js';
import { CONFIG } from '../../config.js';
import { txt } from '../i18n.js';

export function createTable({ mode, gameId, key, seat, seats, opts }) {
  const listeners = new Set();
  const emit = (entries) => entries.length && listeners.forEach((fn) => fn(entries));
  const base = { seat, onEntries: (fn) => (listeners.add(fn), () => listeners.delete(fn)) };

  if (mode === 'local') {
    let match;
    return {
      ...base,
      async connect() {
        match = createMatch(await reducerFor(gameId), { seats, opts, seed: randomHex(16) });
        const view = match.view(seat); // the view from before the first deal
        const first = forSeat(match.start(), seat);
        setTimeout(() => emit(first), 0);
        return { n: 0, view, log: [] };
      },
      async submit(type, data) {
        const out = forSeat(match.submit(seat, type, data), seat);
        setTimeout(() => emit(out), 0);
      },
      takeover() {},
      close() { listeners.clear(); },
    };
  }

  if (mode === 'worker') {
    const w = new SharedWorker(new URL('./referee/worker.js', import.meta.url), { type: 'module', name: 'eg-referee' });
    const port = w.port;
    const waiting = new Map();
    let reqId = 0;
    const call = (msg) => new Promise((resolve, reject) => {
      const id = ++reqId;
      waiting.set(id, { resolve, reject });
      port.postMessage({ ...msg, id, key, seat });
    });
    port.onmessage = ({ data }) => {
      if (data.op === 'entries' && data.key === key) emit(data.entries);
      else if (data.id && waiting.has(data.id)) {
        const { resolve, reject } = waiting.get(data.id);
        waiting.delete(data.id);
        data.error ? reject(new Error(data.error)) : resolve(data.result);
      }
    };
    port.start();
    return {
      ...base,
      async connect() {
        await call({ op: 'create', gameId, seats, opts });
        return call({ op: 'join' });
      },
      submit: (type, data) => call({ op: 'submit', type, data }),
      takeover: (s) => call({ op: 'takeover', target: s }),
      close() {
        listeners.clear();
        port.postMessage({ op: 'leave', key, seat });
        port.close();
      },
    };
  }

  // server: Supabase Edge Function + Realtime channel with a "new steps" signal
  const sb = store.client();
  let ch = null;
  let have = 0;
  let latest = 0; // the latest signal from the server
  let pulling = null;
  const invoke = async (body) => {
    const { data, error } = await sb.functions.invoke(CONFIG.supabase.refereeFunction || 'referee', { body: { ...body, key } });
    if (error) throw new Error(error.message || txt('Server error.'));
    if (data?.error) throw new Error(data.error);
    return data;
  };
  // fetches the new steps (with its own view) from the server
  const pull = () => (pulling ||= (async () => {
    try {
      const res = await invoke({ op: 'pull', from: have });
      const fresh = res.entries.filter((e) => e.n >= have);
      if (fresh.length) have = fresh[fresh.length - 1].n + 1;
      emit(fresh);
    } finally {
      pulling = null;
      if (latest > have) setTimeout(() => pull().catch(() => {}), 0);
    }
  })());
  return {
    ...base,
    async connect() {
      await invoke({ op: 'create', gameId, seats, opts });
      ch = sb.channel(`ref-${key}`).on('broadcast', { event: 'n' }, ({ payload }) => {
        latest = Math.max(latest, payload.n);
        if (payload.n > have) pull().catch(() => {});
      });
      await new Promise((r) => ch.subscribe((s) => s === 'SUBSCRIBED' && r()));
      const snap = await invoke({ op: 'join' });
      have = snap.n;
      setTimeout(() => pull().catch(() => {}), 0); // if the match has just started
      return snap;
    },
    async submit(type, data) {
      await invoke({ op: 'submit', type, data });
      await pull();
    },
    takeover: (s) => invoke({ op: 'takeover', target: s }),
    close() {
      listeners.clear();
      if (ch) sb.removeChannel(ch);
    },
  };
}
