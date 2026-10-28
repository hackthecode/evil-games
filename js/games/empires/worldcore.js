// Evil Empires – общият свят като документ: играчи, съюзи, чат, подкрепления, оазиси,
// нападения между играчи. Едни и същи функции работят в браузъра (localStorage)
// и на сървъра (Supabase); тук няма достъп до хранилище – само до документа.
import { npcList, homeStart, findSpot, dist } from './worldgen.js';

export function freshWorld(seed = (Math.random() * 2 ** 31) >>> 0, created = Date.now()) {
  return { v: 1, seed, created, players: {}, alliances: {}, incoming: {}, results: {}, stationed: [], oases: {}, npc: {} };
}

// Място за столицата на нов играч.
export function allocateHomeIn(w, uid) {
  if (w.players[uid]?.cities?.[0]) return { x: w.players[uid].cities[0].x, y: w.players[uid].cities[0].y, seed: w.seed };
  const npcs = npcList(w.seed);
  const taken = (x, y, gap) =>
    npcs.some((n) => dist(n, { x, y }) < gap + 3) ||
    Object.values(w.players).some((p) => p.cities.some((c) => dist(c, { x, y }) < gap + 2));
  const spot = findSpot(w.seed, homeStart(w.seed, uid), taken, 2) || { x: 0, y: 0 };
  return { ...spot, seed: w.seed };
}

// Какво вижда играчът от света: без ресурсите и войската на другите (те се научават с разузнаване).
export function buildView(w, uid) {
  const me = w.players[uid];
  const myAlliance = me?.alliance;
  const players = {};
  for (const [id, p] of Object.entries(w.players)) {
    players[id] = id === uid ? p : {
      uid: p.uid, name: p.name, race: p.race, epoch: p.epoch, score: p.score, protectedUntil: p.protectedUntil, alliance: p.alliance, t: p.t,
      cities: p.cities.map((c) => ({ id: c.id, name: c.name, x: c.x, y: c.y, hall: c.hall })),
    };
  }
  const alliances = {};
  for (const [id, a] of Object.entries(w.alliances)) {
    alliances[id] = { ...a, chat: id === myAlliance ? a.chat : [], invites: a.invites.filter((x) => x === uid || id === myAlliance) };
  }
  const results = {};
  for (const [id, r] of Object.entries(w.results)) if (id.startsWith(`${uid}:`)) results[id] = r;
  return {
    v: 1, seed: w.seed, created: w.created, players, alliances, results, npc: w.npc, oases: w.oases,
    incoming: { [uid]: w.incoming[uid] || [] },
    stationed: w.stationed.filter((x) => x.toUid === uid || x.fromUid === uid),
  };
}

/**
 * Интерфейсът към света, който ползва логиката (env.world) и интерфейсът.
 * store: { get() → документ, mutate(fn) → резултатът на fn(документ) }.
 */
export function makeWorld(store, uid) {
  const W = () => store.get();
  const mut = (fn) => store.mutate(fn);
  const fail = (msg) => { throw new Error(msg); };
  return {
    get seed() { return W().seed; },
    get created() { return W().created; },
    raw: W,

    // ----- играчи -----
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
        for (const [k, o] of Object.entries(w.oases)) if (o.uid === id) delete w.oases[k];
        for (const st of w.stationed) if (st.toUid === id || st.fromUid === id) st.sendBack = true;
      });
    },
    cityAt(x, y) {
      for (const p of Object.values(W().players)) for (const c of p.cities) if (c.x === x && c.y === y) return { ...c, uid: p.uid, owner: p.name, race: p.race };
      return null;
    },

    // ----- нападения между играчи -----
    incomingFor: (id) => W().incoming[id] || [],
    sendIncoming(rec) { mut((w) => { (w.incoming[rec.toUid] ||= []).push(rec); }); },
    removeIncoming(id, recId) { mut((w) => { w.incoming[id] = (w.incoming[id] || []).filter((x) => x.id !== recId); }); },
    putResult(id, res) { mut((w) => { w.results[id] = res; }); },
    result: (id) => W().results[id] || null,
    clearResult(id) { mut((w) => { delete w.results[id]; }); },
    // изходът на тактическа битка срещу играч (нападателят го праща, защитникът го прилага)
    putOutcome(id, r) { mut((w) => { w.results[`o:${id}`] = r; }); },
    outcome: (id) => W().results[`o:${id}`] || null,
    clearOutcome(id) { mut((w) => { delete w.results[`o:${id}`]; }); },
    resolveOffline: null,

    // ----- подкрепления -----
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
        if (!st || (st.toUid !== uid && st.fromUid !== uid)) fail('Няма такива подкрепления.');
        st.sendBack = true;
      });
    },

    // ----- империи на компютъра -----
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

    // ----- оазиси -----
    oasisOwner: (key) => W().oases[key] || null,
    setOasisOwner(key, ownerUid, name) { mut((w) => { if (ownerUid) w.oases[key] = { uid: ownerUid, name }; else delete w.oases[key]; }); },

    // ----- съюзи -----
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
      if (name.length < 3 || tag.length < 2) fail('Име (3+ букви) и таг (2–4 знака).');
      if (embassy != null && embassy < 3) fail('Нужно е Посолство ниво 3.');
      return mut((w) => {
        if (!w.players[uid]) fail('Империята ви още не е в света.');
        if (w.players[uid].alliance) fail('Вече сте в съюз.');
        if (Object.values(w.alliances).some((a) => a.tag.toLowerCase() === tag.toLowerCase())) fail('Този таг е зает.');
        const id = 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
        w.alliances[id] = { id, name, tag, leader: uid, members: [uid], invites: [], chat: [], diplomacy: {}, created: Date.now() };
        w.players[uid].alliance = id;
        return id;
      });
    },
    invite(targetUid) {
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a) fail('Не сте в съюз.');
        if (!w.players[targetUid]) fail('Няма такъв играч.');
        if (w.players[targetUid].alliance) fail('Играчът вече е в съюз.');
        if (!a.invites.includes(targetUid)) a.invites.push(targetUid);
      });
    },
    acceptInvite(aid, maxMembers) {
      mut((w) => {
        const a = w.alliances[aid];
        if (!a || !a.invites.includes(uid)) fail('Поканата вече не е валидна.');
        if (w.players[uid]?.alliance) fail('Вече сте в съюз.');
        if (a.members.length >= maxMembers) fail('Съюзът е пълен.');
        a.invites = a.invites.filter((x) => x !== uid);
        a.members.push(uid);
        w.players[uid].alliance = aid;
        a.chat.push({ sys: true, text: `${w.players[uid].name} се присъедини към съюза.`, t: Date.now() });
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
        a.chat.push({ sys: true, text: `${w.players[uid].name} напусна съюза.`, t: Date.now() });
        for (const st of w.stationed) if ((st.fromUid === uid && a.members.includes(st.toUid)) || (st.toUid === uid && a.members.includes(st.fromUid))) st.sendBack = true;
        if (!a.members.length) delete w.alliances[aid];
        else if (a.leader === uid) a.leader = a.members[0];
      });
    },
    kick(targetUid) {
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a || a.leader !== uid) fail('Само водачът може да изключва.');
        if (targetUid === uid || !a.members.includes(targetUid)) fail('Няма такъв член.');
        a.members = a.members.filter((x) => x !== targetUid);
        if (w.players[targetUid]) w.players[targetUid].alliance = null;
        a.chat.push({ sys: true, text: `${w.players[targetUid]?.name || 'Играч'} беше изключен.`, t: Date.now() });
        for (const st of w.stationed) if ((st.fromUid === targetUid && a.members.includes(st.toUid)) || (st.toUid === targetUid && a.members.includes(st.fromUid))) st.sendBack = true;
      });
    },
    setRelation(otherId, rel) {
      if (rel && !['ally', 'pact', 'war'].includes(rel)) fail('Невалидно отношение.');
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a || a.leader !== uid) fail('Само водачът определя дипломацията.');
        const o = w.alliances[otherId];
        if (!o || o.id === a.id) fail('Няма такъв съюз.');
        if (rel) a.diplomacy[otherId] = rel; else delete a.diplomacy[otherId];
        // съюз и пакт са взаимни; войната е едностранна
        if (rel === 'ally' || rel === 'pact') o.diplomacy[a.id] = rel;
        else if (o.diplomacy[a.id] === 'ally' || o.diplomacy[a.id] === 'pact') delete o.diplomacy[a.id];
        a.chat.push({ sys: true, text: `Дипломация с [${o.tag}]: ${{ ally: 'съюзници', pact: 'пакт за ненападение', war: 'война' }[rel] || 'неутрални'}.`, t: Date.now() });
      });
    },
    say(text) {
      text = String(text || '').trim().slice(0, 400);
      if (!text) return;
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a) fail('Не сте в съюз.');
        a.chat.push({ uid, name: w.players[uid].name, text, t: Date.now() });
        if (a.chat.length > 200) a.chat.splice(0, a.chat.length - 200);
      });
    },
  };
}

// Действията със съюзи, които играчът може да поиска (и през сървъра).
export const WORLD_OPS = ['createAlliance', 'invite', 'acceptInvite', 'declineInvite', 'leave', 'kick', 'setRelation', 'say', 'sendBackStationed'];
