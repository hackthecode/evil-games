// Evil Empires – общият свят в локален режим: всички акаунти в този браузър споделят
// един свят в localStorage. Логиката на света е в worldcore.js; онлайн тя работи на сървъра.
import { freshWorld, allocateHomeIn, makeWorld } from './worldcore.js';

const KEY = 'ee.world.v1';
const LEASE = (uid) => `ee.lease.${uid}`;
export const WORLD_KEY = KEY;

export function loadWorld() {
  try {
    const w = JSON.parse(localStorage.getItem(KEY));
    if (w && w.v === 1) return w;
  } catch {}
  const w = freshWorld();
  saveWorld(w);
  return w;
}

function saveWorld(w) {
  try { localStorage.setItem(KEY, JSON.stringify(w)); } catch {}
}

export const setLease = (uid) => { try { localStorage.setItem(LEASE(uid), String(Date.now())); } catch {} };
export const clearLease = (uid) => { try { localStorage.removeItem(LEASE(uid)); } catch {} };
export const leaseFresh = (uid) => Date.now() - Number(localStorage.getItem(LEASE(uid)) || 0) < 10000;

export const allocateHome = (uid) => allocateHomeIn(loadWorld(), uid);

// Всяка промяна чете най-новото състояние – другите раздели също пишат.
export function worldApi(uid) {
  let cache = loadWorld();
  const api = makeWorld({
    get: () => cache,
    mutate(fn) {
      const w = loadWorld();
      const r = fn(w);
      saveWorld(w);
      cache = w;
      return r;
    },
  }, uid);
  api.refresh = () => (cache = loadWorld());
  return api;
}

// Онлайн: изгледът от сървъра (само за четене и предвиждане – промените не се записват).
export function viewApi(uid, view) {
  let doc = view;
  const api = makeWorld({ get: () => doc, mutate: (fn) => fn(doc) }, uid);
  api.refresh = () => doc;
  api.setView = (v) => { doc = v; };
  return api;
}
