// Evil Empires – the shared world as a document: players, alliances, chat, reinforcements, oases,
// attacks between players. The same functions run in the browser (localStorage)
// and on the server (Supabase); there is no storage access here – only the document.
import { npcList, homeStart, findSpot, dist } from './worldgen.js';
import { tk } from '../../i18n/tk.js';

export function freshWorld(seed = (Math.random() * 2 ** 31) >>> 0, created = Date.now()) {
  return { v: 1, seed, created, players: {}, alliances: {}, incoming: {}, results: {}, stationed: [], oases: {}, npc: {} };
}

// A spot for a new player's capital.
export function allocateHomeIn(w, uid) {
  if (w.players[uid]?.cities?.[0]) return { x: w.players[uid].cities[0].x, y: w.players[uid].cities[0].y, seed: w.seed };
  const npcs = npcList(w.seed);
  const taken = (x, y, gap) =>
    npcs.some((n) => dist(n, { x, y }) < gap + 3) ||
    Object.values(w.players).some((p) => p.cities.some((c) => dist(c, { x, y }) < gap + 2));
  const spot = findSpot(w.seed, homeStart(w.seed, uid), taken, 2) || { x: 0, y: 0 };
  return { ...spot, seed: w.seed };
}

// What a player sees of the world: without the resources and troops of others (those are learned by scouting).
export function buildView(w, uid) {
  const me = w.players[uid];
  const myAlliance = me?.alliance;
  const players = {};
  for (const [id, p] of Object.entries(w.players)) {
    players[id] = id === uid ? p : {
      uid: p.uid, name: p.name, race: p.race, epoch: p.epoch, score: p.score, protectedUntil: p.protectedUntil, alliance: p.alliance, t: p.t,
      cities: p.cities.map((c) => ({ id: c.id, name: c.name, x: c.x, y: c.y, hall: c.hall, loyalty: c.loyalty, burnT: c.burnT, captured: c.captured })),
    };
  }
  const alliances = {};
  for (const [id, a] of Object.entries(w.alliances)) {
    alliances[id] = { ...a, chat: id === myAlliance ? a.chat : [], invites: a.invites.filter((x) => x === uid || id === myAlliance) };
  }
  const results = {};
  for (const [id, r] of Object.entries(w.results)) if (id.startsWith(`${uid}:`)) results[id] = r;
  // private messages: only the player's own conversations
  const dms = {};
  for (const [k, list] of Object.entries(w.dms || {})) if (k.split('|').includes(uid)) dms[k] = list;
  return {
    v: 1, seed: w.seed, created: w.created, players, alliances, results, dms, npc: w.npc, oases: w.oases,
    incoming: { [uid]: w.incoming[uid] || [] },
    stationed: w.stationed.filter((x) => x.toUid === uid || x.fromUid === uid),
  };
}

/**
 * The world interface used by the game logic (env.world) and the UI.
 * store: { get() → document, mutate(fn) → the result of fn(document) }.
 */
export function makeWorld(store, uid) {
  const W = () => store.get();
  const mut = (fn) => store.mutate(fn);
  const fail = (msg) => { throw new Error(msg); };
  return {
    get seed() { return W().seed; },
    get created() { return W().created; },
    raw: W,

    // ----- players -----
    player: (id) => W().players[id] || null,
    players: () => Object.values(W().players),
    publish(snap) {
      mut((w) => {
        const old = w.players[snap.uid];
        w.players[snap.uid] = { ...snap, alliance: old?.alliance || null, joined: old?.joined || Date.now() };
      });
    },
    removePlayer(id) {
      mut((w) => {
        const aid = w.players[id]?.alliance;
        const a = w.alliances[aid];
        if (a) {
          a.members = a.members.filter((x) => x !== id);
          if (!a.members.length) delete w.alliances[aid];
          else if (a.leader === id) a.leader = a.members[0];
        }
        delete w.players[id];
        delete w.incoming[id];
        for (const k of Object.keys(w.dms || {})) if (k.split('|').includes(id)) delete w.dms[k];
        for (const [k, o] of Object.entries(w.oases)) if (o.uid === id) delete w.oases[k];
        for (const st of w.stationed) if (st.toUid === id || st.fromUid === id) st.sendBack = true;
      });
    },
    cityAt(x, y) {
      for (const p of Object.values(W().players)) for (const c of p.cities) if (c.x === x && c.y === y) return { ...c, uid: p.uid, owner: p.name, race: p.race };
      return null;
    },

    // ----- attacks between players -----
    incomingFor: (id) => W().incoming[id] || [],
    sendIncoming(rec) { mut((w) => { (w.incoming[rec.toUid] ||= []).push(rec); }); },
    removeIncoming(id, recId) { mut((w) => { w.incoming[id] = (w.incoming[id] || []).filter((x) => x.id !== recId); }); },
    putResult(id, res) { mut((w) => { w.results[id] = res; }); },
    result: (id) => W().results[id] || null,
    clearResult(id) { mut((w) => { delete w.results[id]; }); },
    // the outcome of a tactical battle against a player (the attacker sends it, the defender applies it)
    putOutcome(id, r) { mut((w) => { w.results[`o:${id}`] = r; }); },
    outcome: (id) => W().results[`o:${id}`] || null,
    clearOutcome(id) { mut((w) => { delete w.results[`o:${id}`]; }); },
    resolveOffline: null,

    // ----- reinforcements -----
    stationedAt: (toUid, cityId) => W().stationed.filter((x) => x.toUid === toUid && x.toCity === cityId),
    stationedFrom: (fromUid) => W().stationed.filter((x) => x.fromUid === fromUid),
    stationedById: (id) => W().stationed.find((x) => x.id === id) || null,
    addStationed(rec) { mut((w) => { w.stationed.push(rec); }); },
    setStationed(id, groups) {
      mut((w) => {
        const st = w.stationed.find((x) => x.id === id);
        if (st) st.groups = groups;
        w.stationed = w.stationed.filter((x) => x.groups.some((g) => g.n > 0));
      });
    },
    removeStationed(id) {
      return mut((w) => {
        const st = w.stationed.find((x) => x.id === id) || null;
        w.stationed = w.stationed.filter((x) => x.id !== id);
        return st;
      });
    },
    sendBackStationed(id) {
      mut((w) => {
        const st = w.stationed.find((x) => x.id === id);
        if (!st || (st.toUid !== uid && st.fromUid !== uid)) fail(tk('No such reinforcements.'));
        st.sendBack = true;
      });
    },

    // ----- computer empires -----
    npcState: (id) => W().npc[id] || null,
    hitNpc(id, { lost = 0, plunder = 0, t, wallDmg = 0, loyalty, owner }) {
      mut((w) => {
        const o = w.npc[id] || { lost: 0, lostT: t, plunder: 0, plunderT: t };
        if (lost) Object.assign(o, { lost: Math.min(0.9, o.lost + lost), lostT: t });
        if (plunder) Object.assign(o, { plunder: Math.min(0.9, o.plunder + plunder), plunderT: t });
        if (wallDmg) Object.assign(o, { wallDmg: (o.wallDmg || 0) + wallDmg, wallT: t });
        if (loyalty != null) Object.assign(o, { loyalty, loyT: t });
        if (owner) o.owner = owner;
        w.npc[id] = o;
      });
    },

    // ----- oases -----
    oasisOwner: (key) => W().oases[key] || null,
    setOasisOwner(key, ownerUid, name) { mut((w) => { if (ownerUid) w.oases[key] = { uid: ownerUid, name }; else delete w.oases[key]; }); },

    // ----- alliances -----
    allianceOf: (id) => { const a = W().players[id]?.alliance; return a ? W().alliances[a] || null : null; },
    alliances: () => Object.values(W().alliances),
    relation(a, b) {
      if (a === b) return 'self';
      const w = W();
      const pa = w.players[a]?.alliance, pb = w.players[b]?.alliance;
      if (!pa || !pb) return null;
      if (pa === pb) return 'alliance';
      return w.alliances[pa]?.diplomacy?.[pb] || null;
    },
    invitesFor: (id) => Object.values(W().alliances).filter((a) => a.invites.includes(id)),
    createAlliance(name, tag, embassy) {
      name = String(name || '').trim().slice(0, 28);
      tag = String(tag || '').trim().toUpperCase().slice(0, 4);
      if (name.length < 3 || tag.length < 2) fail(tk('Name (3+ letters) and tag (2–4 characters).'));
      if (embassy != null && embassy < 3) fail(tk('Embassy level 3 required.'));
      return mut((w) => {
        if (!w.players[uid]) fail(tk('Your empire is not in the world yet.'));
        if (w.players[uid].alliance) fail(tk('You are already in an alliance.'));
        if (Object.values(w.alliances).some((a) => a.tag.toLowerCase() === tag.toLowerCase())) fail(tk('This tag is taken.'));
        const id = 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
        w.alliances[id] = { id, name, tag, leader: uid, members: [uid], invites: [], chat: [], diplomacy: {}, created: Date.now() };
        w.players[uid].alliance = id;
        return id;
      });
    },
    invite(targetUid) {
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a) fail(tk('You are not in an alliance.'));
        if (!w.players[targetUid]) fail(tk('No such player.'));
        if (w.players[targetUid].alliance) fail(tk('The player is already in an alliance.'));
        if (!a.invites.includes(targetUid)) a.invites.push(targetUid);
      });
    },
    acceptInvite(aid, maxMembers) {
      mut((w) => {
        const a = w.alliances[aid];
        if (!a || !a.invites.includes(uid)) fail(tk('The invitation is no longer valid.'));
        if (w.players[uid]?.alliance) fail(tk('You are already in an alliance.'));
        if (a.members.length >= maxMembers) fail(tk('The alliance is full.'));
        a.invites = a.invites.filter((x) => x !== uid);
        a.members.push(uid);
        w.players[uid].alliance = aid;
        a.chat.push({ sys: true, text: tk('{0} joined the alliance.', w.players[uid].name), t: Date.now() });
      });
    },
    declineInvite(aid) { mut((w) => { const a = w.alliances[aid]; if (a) a.invites = a.invites.filter((x) => x !== uid); }); },
    leave() {
      mut((w) => {
        const aid = w.players[uid]?.alliance;
        const a = w.alliances[aid];
        if (!a) return;
        a.members = a.members.filter((x) => x !== uid);
        w.players[uid].alliance = null;
        a.chat.push({ sys: true, text: tk('{0} left the alliance.', w.players[uid].name), t: Date.now() });
        for (const st of w.stationed) if ((st.fromUid === uid && a.members.includes(st.toUid)) || (st.toUid === uid && a.members.includes(st.fromUid))) st.sendBack = true;
        if (!a.members.length) delete w.alliances[aid];
        else if (a.leader === uid) a.leader = a.members[0];
      });
    },
    kick(targetUid) {
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a || a.leader !== uid) fail(tk('Only the leader can kick members.'));
        if (targetUid === uid || !a.members.includes(targetUid)) fail(tk('No such member.'));
        a.members = a.members.filter((x) => x !== targetUid);
        if (w.players[targetUid]) w.players[targetUid].alliance = null;
        a.chat.push({ sys: true, text: tk('{0} was kicked.', w.players[targetUid]?.name || tk('Player')), t: Date.now() });
        for (const st of w.stationed) if ((st.fromUid === targetUid && a.members.includes(st.toUid)) || (st.toUid === targetUid && a.members.includes(st.fromUid))) st.sendBack = true;
      });
    },
    setRelation(otherId, rel) {
      if (rel && !['ally', 'pact', 'war'].includes(rel)) fail(tk('Invalid relation.'));
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a || a.leader !== uid) fail(tk('Only the leader sets the diplomacy.'));
        const o = w.alliances[otherId];
        if (!o || o.id === a.id) fail(tk('No such alliance.'));
        if (rel) a.diplomacy[otherId] = rel; else delete a.diplomacy[otherId];
        // alliance and pact are mutual; war is one-sided
        if (rel === 'ally' || rel === 'pact') o.diplomacy[a.id] = rel;
        else if (o.diplomacy[a.id] === 'ally' || o.diplomacy[a.id] === 'pact') delete o.diplomacy[a.id];
        a.chat.push({ sys: true, text: tk('Diplomacy with [{0}]: {1}.', o.tag, { ally: tk('allies'), pact: tk('non-aggression pact'), war: tk('war') }[rel] || tk('neutral')), t: Date.now() });
      });
    },
    // A private message to another ruler (the last 60 in each conversation are kept).
    dm(toUid, text) {
      text = String(text || '').trim().slice(0, 400);
      toUid = String(toUid || '');
      if (!text) return;
      mut((w) => {
        if (!w.players[toUid] || toUid === uid) fail(tk('No such ruler.'));
        const k = dmKey(uid, toUid);
        w.dms ||= {};
        const list = (w.dms[k] ||= []);
        list.push({ uid, name: w.players[uid]?.name || tk('Ruler'), text, t: Date.now() });
        if (list.length > 60) list.splice(0, list.length - 60);
      });
    },
    dms: () => W().dms || {},
    say(text) {
      text = String(text || '').trim().slice(0, 400);
      if (!text) return;
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a) fail(tk('You are not in an alliance.'));
        a.chat.push({ uid, name: w.players[uid].name, text, t: Date.now() });
        if (a.chat.length > 200) a.chat.splice(0, a.chat.length - 200);
      });
    },
  };
}

// Alliance actions the player may request (also through the server).
export const WORLD_OPS = ['createAlliance', 'invite', 'acceptInvite', 'declineInvite', 'leave', 'kick', 'setRelation', 'say', 'dm', 'sendBackStationed'];

export const dmKey = (a, b) => [a, b].sort().join('|');
