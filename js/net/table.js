// „Маса“: връзката на играта със сървъра-съдия. Играта получава поредица стъпки
// { n, seat, type, pub, view } (публичното + собствения си изглед) и праща своите решения.
//
// Транспорти:
//   local  – съдията работи в същия раздел (игра срещу компютъра);
//   worker – SharedWorker, общ за разделите на браузъра (локален онлайн тест, емулира сървър);
//   server – Supabase Edge Function „referee“ (истинска онлайн игра).
import { createMatch, forSeat } from './referee/core.js';
import { reducerFor } from './referee/games.js';
import { randomHex } from '../store/hash.js';
import { store } from '../store/index.js';
import { CONFIG } from '../../config.js';

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
        const view = match.view(seat); // изгледът отпреди първото раздаване
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

  // server: Supabase Edge Function + Realtime канал със сигнал „има нови стъпки“
  const sb = store.client();
  let ch = null;
  let have = 0;
  let latest = 0; // най-новият сигнал от сървъра
  let pulling = null;
  const invoke = async (body) => {
    const { data, error } = await sb.functions.invoke(CONFIG.supabase.refereeFunction || 'referee', { body: { ...body, key } });
    if (error) throw new Error(error.message || 'Грешка от сървъра.');
    if (data?.error) throw new Error(data.error);
    return data;
  };
  // взема новите стъпки (със собствения изглед) от сървъра
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
      setTimeout(() => pull().catch(() => {}), 0); // ако мачът е тръгнал току-що
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
