// Evil Empires – the shared world in local mode: all accounts in this browser share
// one world in localStorage. The world logic is in worldcore.js; online it runs on the server.
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

// Every change reads the latest state – other tabs write too.
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

// Online: the view from the server (read-only and for prediction – changes are not saved).
export function viewApi(uid, view) {
  let doc = view;
  const api = makeWorld({ get: () => doc, mutate: (fn) => fn(doc) }, uid);
  api.refresh = () => doc;
  api.setView = (v) => { doc = v; };
  return api;
}
