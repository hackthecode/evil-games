// Real-time social features: who is online (and what they play) and a personal
// "mailbox" for invitations and friend requests.
//   Channel "online"  – presence of all logged-in players: { name, color, where }.
//   Channel "inbox-<id>" – messages to a specific player (invitation, request).
import { openChannel } from './channel.js';
import { txt } from '../i18n.js';

let me = null;
let online = null, inbox = null;
let present = new Map();
let where = null;
let seek = null; // the game I'm looking for an opponent for (in the lobby)
const listeners = new Set();
const emit = (e) => listeners.forEach((fn) => { try { fn(e); } catch (err) { console.error(err); } });

export const social = {
  async start(user) {
    if (me?.id === user?.id) return;
    await this.stop();
    if (!user) return;
    me = user;
    try {
      online = await openChannel('online', {
        uid: user.id,
        state: state(),
        onMessage() {},
        onPresence(map) {
          present = map;
          emit({ type: 'presence' });
        },
      });
      inbox = await openChannel(`inbox-${user.id}`, {
        uid: user.id,
        state: { name: user.displayName },
        onMessage(m) {
          if (m?.to === user.id) emit({ type: m.kind, ...m });
        },
        onPresence() {},
      });
    } catch (e) {
      console.warn('social', e);
    }
  },

  async stop() {
    const o = online, i = inbox;
    online = inbox = null;
    me = null;
    present = new Map();
    try { await o?.leave(); } catch {}
    try { await i?.leave(); } catch {}
  },

  // Where I am right now (game/room) – visible to friends.
  // Looking for an opponent for a game (null – stop looking).
  setSeek(gameId) {
    seek = gameId || null;
    online?.track(state());
  },
  get seeking() { return seek; },
  present: () => present,
  me: () => me,

  setWhere(w) {
    where = w;
    online?.track(state());
  },

  isOnline: (uid) => present.has(uid),
  status: (uid) => present.get(uid) || null,
  on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // A message to another player: we briefly open their mailbox and send.
  async send(toUid, payload) {
    if (!me) throw new Error(txt('You are not logged in.'));
    const ch = await openChannel(`inbox-${toUid}`, { uid: me.id, state: { name: me.displayName }, onMessage() {}, onPresence() {} });
    try {
      await ch.send({ ...payload, to: toUid, from: me.id, fromName: me.displayName, at: Date.now() });
    } finally {
      setTimeout(() => ch.leave(), 1500);
    }
  },

  invite: (toUid, { game, gameName, room }) => social.send(toUid, { kind: 'invite', game, gameName, room }),
  notifyRequest: (toUid) => social.send(toUid, { kind: 'friend-request' }),
  notifyAccept: (toUid) => social.send(toUid, { kind: 'friend-accept' }),
};

function state() {
  return { name: me?.displayName, color: me?.color || null, where, seek };
}
