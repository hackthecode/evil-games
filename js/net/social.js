// Социални функции в реално време: кой е на линия (и какво играе) и лична
// „пощенска кутия“ за покани и заявки за приятелство.
//   Канал „online“  – присъствие на всички влезли играчи: { name, color, where }.
//   Канал „inbox-<id>“ – съобщения към конкретен играч (покана, заявка).
import { openChannel } from './channel.js';

let me = null;
let online = null, inbox = null;
let present = new Map();
let where = null;
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

  // Къде съм в момента (игра/стая) – вижда се от приятелите.
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

  // Съобщение до друг играч: отваряме за миг неговата кутия и пращаме.
  async send(toUid, payload) {
    if (!me) throw new Error('Не сте влезли.');
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
  return { name: me?.displayName, color: me?.color || null, where };
}
