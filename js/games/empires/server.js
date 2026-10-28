// Evil Empires – the server: every player action goes through here and is checked by
// the game logic (engine.js). It does not depend on Supabase – it receives a "database" (db):
//   getWorld() → { doc, version } | null
//   getSave(uid) → { state, version } | null
//   commit({ world: { doc, version } | null, saves: [{ uid, state | null, version }] }) → true | false (conflict)
//   listSaves() → [uid], savePush(uid, sub), deletePush(endpoint), pushSubs(uid) → [sub]
import * as E from './engine.js';
import { RACES } from './data.js';
import { freshWorld, allocateHomeIn, makeWorld, buildView, WORLD_OPS } from './worldcore.js';
import { tk } from '../../i18n/tk.js';
import { render } from '../../i18n/render.js';
import { BG } from '../../i18n/bg.js';

const fail = (msg) => { throw new Error(msg); };
const PUSH_KINDS = ['loss', 'win', 'epoch', 'alarm'];

// One transaction: loads the world and the needed empires, runs and saves (or returns null on conflict).
async function session(db, uid, t, work) {
  const wrow = (await db.getWorld()) || { doc: freshWorld(), version: -1 };
  const doc = wrow.doc;
  const saves = new Map();
  const mine = await db.getSave(uid);
  if (mine) saves.set(uid, { ...mine, dirty: false });
  // the empires defending against my marches that have already arrived – the battles are resolved here
  if (mine) {
    for (const m of mine.state.marches || []) {
      const d = m.target?.uid;
      if (m.target?.type === 'player' && ['go', 'wait', 'battle'].includes(m.phase) && m.arrive <= t && d && !saves.has(d)) {
        const ds = await db.getSave(d);
        if (ds) saves.set(d, { ...ds, dirty: false });
      }
    }
  }
  let worldDirty = false;
  const store = { get: () => doc, mutate: (fn) => { worldDirty = true; return fn(doc); } };
  const envFor = (u, resolver) => { const w = makeWorld(store, u); w.resolveOffline = resolver; return { world: w }; };
  const resolver = (defUid, id, at) => {
    const d = saves.get(defUid);
    if (d?.state) {
      E.advance(d.state, at, envFor(defUid, null));
      d.dirty = true;
      return;
    }
    // abandoned city (the player is gone): the attacker passes without loot
    if (doc.players[defUid]) return;
    const inc = (doc.incoming[defUid] || []).find((x) => x.id === id);
    if (inc) {
      worldDirty = true;
      doc.results[id] = { win: true, loot: {}, trapped: 0, att: inc.groups.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [], defName: tk('Abandoned city'), city: '', rounds: 0 };
      doc.incoming[defUid] = doc.incoming[defUid].filter((x) => x.id !== id);
    }
  };
  const ctx = { doc, saves, store, env: envFor(uid, resolver), envFor, resolver, mine: saves.get(uid) || null, t };
  const out = await work(ctx);
  // the empire snapshots in the world (only if something changed)
  for (const [u, d] of saves) {
    if (!d.state) continue;
    const snap = E.snapshot(d.state);
    const old = doc.players[u];
    const strip = (p) => JSON.stringify({ ...p, t: 0, alliance: null, joined: 0 });
    if (!old || strip(old) !== strip(snap)) makeWorld(store, u).publish(snap);
  }
  const list = [...saves].filter(([, d]) => d.dirty).map(([u, d]) => ({ uid: u, state: d.state, version: d.version }));
  const ok = await db.commit({ world: worldDirty ? { doc, version: wrow.version } : null, saves: list });
  if (!ok) return null;
  return out ?? { state: saves.get(uid)?.state || null, view: buildView(doc, uid), now: t };
}

async function retry(fn) {
  for (let i = 0; i < 6; i++) {
    const r = await fn();
    if (r) return r;
  }
  fail(tk('The server is busy – try again.'));
}

const touch = (ctx) => { const me = ctx.saves.get(ctx.uidSelf); if (me) me.dirty = true; };

/** A request from a player. body.op: sync | new | act | world | reset | push | unpush */
export async function handle(db, uid, body, now = Date.now()) {
  const op = body?.op;
  if (op === 'push') {
    if (!body.sub?.endpoint) fail(tk('Invalid subscription.'));
    await db.savePush(uid, { ...body.sub, lang: body.sub.lang === 'bg' ? 'bg' : 'en' });
    return { ok: true };
  }
  if (op === 'unpush') {
    if (body.endpoint) await db.deletePush(body.endpoint);
    return { ok: true };
  }
  return retry(() => session(db, uid, now, async (ctx) => {
    ctx.uidSelf = uid;
    const me = ctx.mine;
    const s = me?.state;
    if (op === 'sync') {
      if (s) { E.syncAbroad(s, now, ctx.env); E.advance(s, now, ctx.env); touch(ctx); }
      return;
    }
    if (op === 'new') {
      if (s) fail(tk('You already have an empire.'));
      if (!Object.prototype.hasOwnProperty.call(RACES, body.race)) fail(tk('Unknown race.'));
      const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 32) || tk('Empire');
      const home = allocateHomeIn(ctx.doc, uid);
      const ns = E.newGame(body.race, name, now, undefined, { uid, home, worldSeed: home.seed });
      ctx.saves.set(uid, { state: ns, version: -1, dirty: true });
      return;
    }
    if (!s) fail(tk('You don\'t have an empire.'));
    if (op === 'act') {
      E.syncAbroad(s, now, ctx.env);
      E.perform(s, now, ctx.env, String(body.name || ''), body.args || []);
      touch(ctx);
      return;
    }
    if (op === 'world') {
      const name = String(body.name || '');
      if (!WORLD_OPS.includes(name)) fail(tk('Unknown action.'));
      E.advance(s, now, ctx.env);
      touch(ctx);
      makeWorld(ctx.store, uid).publish(E.snapshot(s));
      const W = ctx.env.world;
      const args = Array.isArray(body.args) ? body.args.slice(0, 4) : [];
      const emb = E.maxLv(s, 'embassy');
      if (name === 'createAlliance') W.createAlliance(args[0], args[1], emb);
      else if (name === 'acceptInvite') { if (!emb) fail(tk('Embassy required.')); W.acceptInvite(String(args[0]), Math.max(3, 3 * emb)); }
      else if (name === 'invite') { if (emb < 1) fail(tk('Embassy required.')); W.invite(String(args[0])); }
      else W[name](...args.map((a) => (typeof a === 'string' ? a.slice(0, 400) : a)));
      return;
    }
    if (op === 'reset') {
      makeWorld(ctx.store, uid).removePlayer(uid);
      ctx.saves.set(uid, { ...me, state: null, dirty: true });
      return { state: null, view: null, now };
    }
    fail(tk('Unknown request.'));
  }));
}

/**
 * Every few minutes (pg_cron): moves all empires forward in time and sends
 * notifications about new events and about attacks already visible from the watchtower.
 */
export async function cron(db, now = Date.now(), push = null, limit = 300) {
  const uids = (await db.listSaves()).slice(0, limit);
  let sent = 0;
  for (const uid of uids) {
    let notes = [];
    try {
      await retry(() => session(db, uid, now, async (ctx) => {
        notes = [];
        const s = ctx.mine?.state;
        if (!s) return { ok: true };
        E.syncAbroad(s, now, ctx.env);
        E.advance(s, now, ctx.env);
        ctx.saves.get(uid).dirty = true;
        // the first time we don't send old events
        const since = s.pushed ?? (s.log.length ? s.log[s.log.length - 1].id : 0);
        for (const l of s.log) if (l.id > since && PUSH_KINDS.includes(l.kind)) notes.push(l.text);
        s.pushed = s.log.length ? s.log[s.log.length - 1].id : since;
        // attacks that are already visible
        s.warned ||= [];
        const inc = [
          ...s.incoming.map((x) => ({ id: `n${x.id}`, city: x.city, name: x.name, arrive: x.arrive })),
          ...(ctx.doc.incoming[uid] || []).map((x) => ({ id: `p${x.id}`, city: x.toCity, name: x.attName, arrive: x.arrive })),
        ];
        for (const x of inc) {
          const c = E.cityOf(s, x.city);
          if (!s.warned.includes(x.id) && x.arrive - now <= E.warnWindow(s, c)) {
            s.warned.push(x.id);
            notes.push(tk('⚠ {0} attacks {1} in {2} min!', x.name, c.name, Math.max(1, Math.round((x.arrive - now) / 60000))));
          }
        }
        s.warned = s.warned.slice(-50);
        return { ok: true };
      }));
    } catch {
      continue;
    }
    if (notes.length && push) {
      const subs = await db.pushSubs(uid);
      const body = notes.length > 3 ? tk('{0}\n…and {1} more', notes.slice(-2).join('\n'), notes.length - 2) : notes.join('\n');
      for (const sub of subs) {
        // notifications in the player's language (saved with the subscription)
        try { await push(sub, { title: 'Evil Empires', body: render(body, sub.lang === 'bg' ? BG : null), url: './#/play/empires' }); sent++; } catch (e) { if (e?.gone) await db.deletePush(sub.endpoint); }
      }
    }
  }
  return { ok: true, players: uids.length, sent };
}
