// Online room: seats, match start and lockstep synchronization of moves.
//
// Every client runs the game itself. Only the players' decisions are sent over the network
// (move, bid, card…) with a sequence number n, while dice and shuffles
// come from a shared seed that everyone agrees on via commit-reveal – so nobody
// can rig the randomness. Decisions from others are checked for
// validity with the game rules. When rejoining, the client gets
// the log of others' decisions and fast-forwards the game to the current moment.
import { openChannel, isLocalNet } from './channel.js';
import { randomHex, sha256 } from '../store/hash.js';
import { seededRng, cryptoRng } from './rng.js';
import { motion } from '../ui.js';
import { teamOfSeat } from '../store/elo.js';
import { txt } from '../i18n.js';

const GRACE_MS = 75000; // how long we wait for a disconnected player before a forfeit win / bot
const STALL_MS = { chess: 10 * 60000, default: 3 * 60000 }; // long inactivity on a turn
const START_TIMEOUT_MS = 20000;
export const ACTIVE_KEY = 'eg.active';

export const newRoomId = () => randomHex(4);

export class Room {
  constructor({ id, game, user, create = false, opts = {} }) {
    this.id = id;
    this.game = game;
    this.cfg = game.online;
    this.me = { uid: user.id, name: user.displayName, color: user.color || null };
    this.info = null;
    if (create) {
      const seats = Array(this.cfg.seats).fill(null);
      seats[0] = this.me;
      this.info = { host: this.me.uid, opts, seats, status: 'open', no: 0 };
    }
    this.present = new Map();
    this.match = null;
    this.handlers = new Set();
    this.absentSince = new Map();
    this.takeover = new Set();
    this.votes = new Set();
    this.early = [];
    this.lobby = null;
    this.ch = null;
    this.closed = false;
    if (!create) this.restore();
  }

  // The room state is kept per tab to survive a reload
  // (even if all players reload at the same time).
  save() {
    try {
      const m = this.match;
      sessionStorage.setItem(`eg.room.${this.id}`, JSON.stringify({
        info: this.info,
        match: m?.seed ? { no: m.no, seed: m.seed, log: m.log, takeover: [...this.takeover], ended: m.ended, endEvent: m.endEvent } : null,
      }));
    } catch {}
  }
  restore() {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(`eg.room.${this.id}`) || 'null'); } catch {}
    if (!saved?.info) return;
    this.info = saved.info;
    const m = saved.match;
    if (m?.seed && !m.ended) {
      this.takeover = new Set(m.takeover || []);
      this.match = {
        no: m.no, seed: m.seed, log: m.log, pending: new Map(), cursor: 0, catchUp: m.log.length,
        commits: new Map(), reveals: new Map(), revealed: true, ended: false,
        endEvent: m.endEvent || null, endDelivered: false, waiters: new Set(), waiting: null,
      };
      this.restored = true;
    }
  }

  // ---------- events ----------
  on(fn) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }
  emit(type, data = {}) {
    for (const fn of [...this.handlers]) {
      try { fn({ type, ...data }); } catch (e) { console.error(e); }
    }
  }
  send(t, data = {}) {
    this.ch?.send({ t, from: this.me.uid, ...data });
  }

  // ---------- state ----------
  isHost() { return this.info?.host === this.me.uid; }
  mySeat() { return this.info ? this.info.seats.findIndex((s) => s?.uid === this.me.uid) : -1; }
  humanSeats() { return this.info.seats.map((s, i) => (s ? i : -1)).filter((i) => i >= 0); }
  humanUids() { return this.humanSeats().map((i) => this.info.seats[i].uid); }
  isPresent(uid) { return uid === this.me.uid || this.present.has(uid); }
  inMatch() { return !!(this.match?.seed && !this.match.ended); }
  seatName(i) {
    const s = this.info.seats[i];
    return s ? s.name : (this.cfg.botNames?.[i] || txt('Bot'));
  }
  isBot(i) { return !this.info.seats[i] || this.takeover.has(i); }

  // Which client makes the bots' decisions: the first present human by seat order.
  runner() {
    for (const i of this.humanSeats()) {
      const uid = this.info.seats[i].uid;
      if (!this.takeover.has(i) && this.isPresent(uid)) return uid;
    }
    return null;
  }
  controls(seat) {
    const s = this.info.seats[seat];
    if (s && !this.takeover.has(seat)) return s.uid === this.me.uid;
    return this.runner() === this.me.uid;
  }

  // ---------- connection ----------
  async connect() {
    this.ch = await openChannel(`room-${this.game.id}-${this.id}`, {
      uid: this.me.uid,
      state: { name: this.me.name },
      onMessage: (m) => this.onMessage(m),
      onPresence: (p) => this.onPresence(p),
    });
    this.send('hello', { name: this.me.name });
    this.send('sync?');
    this.timer = setInterval(() => this.tick(), 2000);
    this.updateLobby();
    if (this.restored) {
      motion.fast = this.match.log.length > 0;
      this.emit('match', { resumed: true });
    }
  }

  async leave() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    clearTimeout(this.startTimer);
    if (this.info?.status === 'open' && this.mySeat() >= 0 && !this.isHost()) this.send('stand');
    this.send('bye');
    try { await this.lobby?.leave(); } catch {}
    try { await this.ch?.leave(); } catch {}
    this.handlers.clear();
    motion.fast = false;
  }

  onPresence(map) {
    this.present = new Map([...map].filter(([uid]) => uid !== this.me.uid));
    this.emit('presence');
    this.wake();
  }

  // Periodic check: disconnected players, host change, inactivity.
  tick() {
    if (!this.info || this.closed) return;
    const now = Date.now();
    // the host left the room before the start → new host
    if (this.info.status === 'open' && !this.isPresent(this.info.host)) {
      const since = this.absentSince.get('host') ?? now;
      this.absentSince.set('host', since);
      if (now - since > 20000) {
        const cands = [...this.humanUids(), ...[...this.present.keys()].sort()].filter((u) => this.isPresent(u));
        if (cands[0] === this.me.uid) {
          this.info.seats = this.info.seats.map((s) => (s && this.isPresent(s.uid) ? s : null));
          this.info.host = this.me.uid;
          this.broadcastRoom();
        }
      }
    } else this.absentSince.delete('host');

    if (!this.inMatch()) return;
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ game: this.game.id, room: this.id, no: this.match.no, at: now, rated: this.ratedInfo() }));
    for (const i of this.humanSeats()) {
      const uid = this.info.seats[i].uid;
      if (this.takeover.has(i) || this.isPresent(uid)) {
        if (this.absentSince.delete(uid)) this.emit('absent', { seat: i, left: 0 });
        continue;
      }
      const since = this.absentSince.get(uid) ?? now;
      this.absentSince.set(uid, since);
      if (this.cfg.race) continue; // in a race everyone plays alone – a disconnected player simply falls behind
      const left = GRACE_MS - (now - since);
      this.emit('absent', { seat: i, left: Math.max(0, left) });
      if (left > 0) continue;
      if (this.cfg.seats === 2) {
        if (this.mySeat() >= 0) this.claim('abandon');
      } else if (this.runner() === this.me.uid) {
        this.applyTakeover(i);
        this.send('takeover', { no: this.match.no, seat: i });
      }
    }
    const w = this.match.waiting;
    if (w && !w.stallSent && now - w.since > (STALL_MS[this.game.id] || STALL_MS.default)) {
      w.stallSent = true;
      this.emit('stall', { seat: w.seat });
    }
  }

  applyTakeover(seat) {
    if (this.takeover.has(seat)) return;
    this.takeover.add(seat);
    this.save();
    this.emit('takeover', { seat });
    this.wake();
  }

  // ---------- the room before the match ----------
  broadcastRoom() {
    this.save();
    this.send('room', { info: this.info });
    this.emit('room');
    this.updateLobby();
  }

  sit(seat) {
    if (this.isHost()) this.hostSit(this.me, seat);
    else this.send('sit', { seat, name: this.me.name, color: this.me.color });
  }
  stand() {
    if (this.isHost()) return;
    this.send('stand');
  }
  setOpts(opts) {
    if (!this.isHost()) return;
    this.info.opts = { ...this.info.opts, ...opts };
    this.broadcastRoom();
  }
  hostSit(who, seat) {
    const seats = this.info.seats;
    if (this.info.status !== 'open' || seat < 0 || seat >= seats.length) return;
    if (seats[seat] && seats[seat].uid !== who.uid) return;
    for (let i = 0; i < seats.length; i++) if (seats[i]?.uid === who.uid) seats[i] = null;
    seats[seat] = { uid: who.uid, name: who.name, color: who.color || null };
    this.broadcastRoom();
  }

  canStart() {
    if (!this.isHost() || this.info.status !== 'open') return false;
    const humans = this.humanUids();
    if (humans.length < (this.cfg.minHumans || 2)) return false;
    if (!this.cfg.bots && !this.cfg.race && humans.length < this.cfg.seats) return false;
    return humans.every((u) => this.isPresent(u));
  }

  start() {
    if (!this.canStart()) return;
    this.info.status = 'playing';
    this.info.no++;
    this.send('start', { info: this.info });
    this.updateLobby();
    this.beginMatch();
  }

  async updateLobby() {
    const open = this.isHost() && this.info?.status === 'open' && !this.closed;
    const summary = open && {
      id: this.id,
      opts: this.info.opts,
      taken: this.humanUids().length,
      total: this.cfg.seats,
      names: this.humanSeats().map((i) => this.info.seats[i].name),
    };
    try {
      if (open && !this.lobby) {
        this.lobby = await openChannel(`lobby-${this.game.id}`, {
          uid: this.me.uid, state: { name: this.me.name, room: summary }, onMessage() {}, onPresence() {},
        });
      } else if (this.lobby) {
        if (open) await this.lobby.track({ name: this.me.name, room: summary });
        else {
          const l = this.lobby;
          this.lobby = null;
          await l.leave();
        }
      }
    } catch (e) {
      console.warn('lobby', e);
    }
  }

  // ---------- match start: shared seed (commit-reveal) ----------
  beginMatch() {
    const no = this.info.no;
    this.raceOut = false;
    this.takeover.clear();
    this.votes.clear();
    this.absentSince.clear();
    this.match = {
      no, seed: null, log: [], pending: new Map(), cursor: 0, catchUp: 0,
      commits: new Map(), reveals: new Map(), r: randomHex(32), revealed: false,
      ended: false, endEvent: null, waiters: new Set(), waiting: null,
    };
    this.emit('starting');
    if (this.cfg.referee) {
      // hidden-card games are run by the referee server: the seed is the server's secret
      this.match.seed = 'referee';
      this.match.revealed = true;
      this.save();
      localStorage.setItem(ACTIVE_KEY, JSON.stringify({ game: this.game.id, room: this.id, no, at: Date.now() }));
      this.emit('match', { resumed: false });
      return;
    }
    if (this.mySeat() >= 0) {
      const c = sha256(this.match.r);
      this.match.commits.set(this.me.uid, c);
      this.send('commit', { no, c });
    }
    const early = this.early.filter((m) => m.no === no);
    this.early = [];
    early.forEach((m) => this.onMessage(m));
    this.tryReveal();
    clearTimeout(this.startTimer);
    this.startTimer = setTimeout(() => {
      if (this.match?.no === no && !this.match.seed) this.emit('error', { message: txt('The match could not start – one of the players did not respond.') });
    }, START_TIMEOUT_MS);
  }

  tryReveal() {
    const m = this.match;
    if (!m || m.revealed || this.mySeat() < 0) return;
    if (!this.humanUids().every((u) => m.commits.has(u))) return;
    m.revealed = true;
    m.reveals.set(this.me.uid, m.r);
    this.send('reveal', { no: m.no, r: m.r });
    this.tryFinishSeed();
  }

  tryFinishSeed() {
    const m = this.match;
    if (!m || m.seed) return;
    const uids = this.humanUids();
    if (!uids.every((u) => m.reveals.has(u))) return;
    for (const u of uids) {
      if (sha256(m.reveals.get(u)) !== m.commits.get(u)) {
        this.emit('error', { message: txt('The shared seed check failed.') });
        return;
      }
    }
    m.seed = sha256([...uids.map((u) => m.reveals.get(u)), this.id, m.no].join('|'));
    clearTimeout(this.startTimer);
    this.save();
    this.emit('match', { resumed: false });
  }

  // ---------- moves ----------
  wake() {
    const m = this.match;
    if (!m) return;
    const ws = [...m.waiters];
    m.waiters.clear();
    ws.forEach((r) => r());
  }

  addAct(a) {
    const m = this.match;
    if (!m || a.no !== m.no || m.log[a.n]) return;
    m.pending.set(a.n, { n: a.n, seat: a.seat, type: a.type, data: a.data });
    while (m.pending.has(m.log.length)) {
      const x = m.pending.get(m.log.length);
      m.pending.delete(m.log.length);
      m.log.push(x);
    }
    this.save();
    this.wake();
  }

  /**
   * The next decision in the match. If the seat is mine (or a bot that I control),
   * runs local() and sends it to the others; otherwise waits for the decision from the network.
   * validate(data) checks others' decisions against the game rules.
   * When the match ends, pending calls simply never complete.
   */
  async decide(seat, type, local, validate = () => true) {
    const m = this.match;
    const n = m.cursor++;
    motion.fast = n < m.catchUp;
    for (;;) {
      if (m !== this.match || m.ended) return never();
      const a = m.log[n];
      if (a) {
        if (a.seat !== seat || a.type !== type || !validate(a.data)) {
          console.error('desync', { n, seat, type, got: a });
          this.endMatch({ kind: 'desync' });
          this.emit('event', { kind: 'desync' });
          return never();
        }
        m.waiting = null;
        return a.data;
      }
      motion.fast = false;
      if (m.endEvent && !m.endDelivered) {
        m.endDelivered = true;
        this.emit('event', m.endEvent);
        return never();
      }
      if (this.controls(seat)) {
        m.waiting = null;
        const data = await local();
        if (m !== this.match || m.ended) return never();
        if (m.log[n]) continue;
        m.log[n] = { n, seat, type, data };
        this.save();
        this.send('act', { no: m.no, n, seat, type, data });
        return data;
      }
      if (!m.waiting || m.waiting.n !== n) m.waiting = { n, seat, since: Date.now() };
      await new Promise((r) => m.waiters.add(r));
    }
  }

  // Line-up for the rating (humans without bots), so an abandoned match also counts.
  ratedInfo() {
    if (!this.match || !this.info) return null;
    const players = this.info.seats
      .map((s, i) => (s && !this.takeover.has(i) ? { uid: s.uid, team: teamOfSeat(this.game, i) } : null))
      .filter(Boolean)
      .sort((a, b) => (a.uid < b.uid ? -1 : 1));
    const me = players.find((x) => x.uid === this.me.uid);
    if (!me || players.length < 2) return null;
    return { key: `${this.game.id}:${this.id}:${this.match.no}`, team: me.team, players };
  }

  rng(label) {
    return this.match?.seed ? seededRng(this.match.seed, label) : cryptoRng;
  }

  // ---------- end of the match ----------
  endMatch(ev) {
    const m = this.match;
    if (!m || m.ended) return;
    m.ended = true;
    m.endEvent = ev;
    m.endDelivered = true;
    motion.fast = false;
    this.save();
    localStorage.removeItem(ACTIVE_KEY);
    this.emit('ended');
    this.wake();
  }

  // The game ended normally (by the rules) – it is no longer "active".
  finish() {
    this.endMatch(this.match?.endEvent || { kind: 'normal' });
  }

  resign() {
    if (!this.inMatch()) return;
    if (this.cfg.race) {
      // in a race the one who gives up drops out, and the others continue
      if (this.raceOut) return;
      this.raceOut = true;
      localStorage.removeItem(ACTIVE_KEY);
      this.signal({ kind: 'gaveup' });
      this.emit('event', { kind: 'resign', seat: this.mySeat() });
      return;
    }
    const ev = { kind: 'resign', seat: this.mySeat() };
    this.send('resign', { no: this.match.no, seat: ev.seat });
    this.endMatch(ev);
    this.emit('event', ev);
  }

  claim(reason) {
    if (!this.inMatch()) return;
    const ev = { kind: 'forfeit', winner: this.mySeat(), reason };
    this.send('claim', { no: this.match.no, seat: ev.winner, reason });
    this.endMatch(ev);
    this.emit('event', ev);
  }

  offerDraw() {
    if (this.inMatch()) this.send('draw', { no: this.match.no, kind: 'offer', seat: this.mySeat() });
  }
  answerDraw(accept) {
    if (!this.inMatch()) return;
    this.send('draw', { no: this.match.no, kind: accept ? 'accept' : 'decline', seat: this.mySeat() });
    if (accept) {
      const ev = { kind: 'draw' };
      this.endMatch(ev);
      this.emit('event', ev);
    }
  }

  // Free-form game messages (e.g. progress in a race) – outside the move order.
  signal(data) {
    if (!this.match) return;
    this.send('sig', { no: this.match.no, seat: this.mySeat(), data });
  }

  emote(text) {
    this.send('emote', { seat: this.mySeat(), text });
    this.emit('emote', { seat: this.mySeat(), text });
  }

  // Rematch: when all present players agree, the host starts a new match.
  rematch() {
    this.votes.add(this.me.uid);
    this.send('rematch', { no: this.info.no });
    this.emit('votes');
    this.maybeRematch();
  }
  maybeRematch() {
    if (!this.isHost() || this.inMatch()) return;
    const humans = this.humanUids();
    if (!humans.every((u) => this.votes.has(u) && this.isPresent(u))) return;
    if (this.cfg.seats === 2) this.info.seats.reverse();
    this.info.no++;
    this.info.status = 'playing';
    this.send('start', { info: this.info });
    this.beginMatch();
  }

  // ---------- incoming messages ----------
  onMessage(m) {
    if (!m || m.from === this.me.uid || this.closed) return;
    const fromHost = this.info && m.from === this.info.host;
    switch (m.t) {
      case 'hello':
        if (this.info) this.send('room', { info: this.info });
        break;
      case 'room':
        if (!this.info || m.info.no > this.info.no || (m.info.no === this.info.no && m.info.host === m.from)) {
          const wasMatch = this.inMatch();
          this.info = m.info;
          this.save();
          if (!wasMatch) this.emit('room');
          this.updateLobby();
        }
        break;
      case 'sit':
        if (this.isHost()) this.hostSit({ uid: m.from, name: m.name, color: m.color }, m.seat);
        break;
      case 'stand':
      case 'bye':
        if (this.isHost() && this.info.status === 'open') {
          const i = this.info.seats.findIndex((s) => s?.uid === m.from);
          if (i >= 0) {
            this.info.seats[i] = null;
            this.broadcastRoom();
          }
        }
        if (m.t === 'bye') {
          this.present.delete(m.from);
          this.emit('presence');
        }
        break;
      case 'start':
        if (!fromHost && this.info) break;
        if (this.match && this.match.no >= m.info.no) break;
        this.info = m.info;
        this.beginMatch();
        break;
      case 'commit':
      case 'reveal':
        if (!this.match || this.match.no !== m.no) {
          if (!this.match || m.no > this.match.no) this.early.push(m);
          break;
        }
        if (m.t === 'commit') {
          this.match.commits.set(m.from, m.c);
          this.tryReveal();
        } else {
          this.match.reveals.set(m.from, m.r);
          this.tryFinishSeed();
        }
        break;
      case 'act':
        this.addAct(m);
        break;
      case 'sync?':
        if (this.match?.seed) {
          this.send('sync', {
            to: m.from, info: this.info, no: this.match.no, seed: this.match.seed,
            log: this.match.log, takeover: [...this.takeover], endEvent: this.match.endEvent,
          });
        }
        break;
      case 'sync':
        if (m.to !== this.me.uid) break;
        if (this.match?.seed && this.match.no >= m.no) {
          for (const a of m.log) this.addAct({ ...a, no: m.no });
          break;
        }
        this.adopt(m);
        break;
      case 'takeover':
        if (this.match?.no === m.no) this.applyTakeover(m.seat);
        break;
      case 'resign':
      case 'claim':
        if (this.match?.no === m.no && !this.match.ended) {
          const ev = m.t === 'resign' ? { kind: 'resign', seat: m.seat } : { kind: 'forfeit', winner: m.seat, reason: m.reason };
          this.endMatch(ev);
          this.emit('event', ev);
        }
        break;
      case 'draw':
        if (this.match?.no !== m.no || this.match.ended) break;
        if (m.kind === 'offer') this.emit('event', { kind: 'draw-offer', seat: m.seat });
        else if (m.kind === 'decline') this.emit('event', { kind: 'draw-declined', seat: m.seat });
        else if (m.kind === 'accept') {
          const ev = { kind: 'draw' };
          this.endMatch(ev);
          this.emit('event', ev);
        }
        break;
      case 'sig':
        if (this.match?.no === m.no) this.emit('signal', { seat: m.seat, data: m.data });
        break;
      case 'emote':
        this.emit('emote', { seat: m.seat, text: String(m.text).slice(0, 40) });
        break;
      case 'rematch':
        if (m.no === this.info?.no) {
          this.votes.add(m.from);
          this.emit('votes');
          this.maybeRematch();
        }
        break;
    }
  }

  // Rejoining: we accept the match state from others and fast-forward it.
  adopt(m) {
    this.info = m.info;
    this.takeover = new Set(m.takeover || []);
    this.match = {
      no: m.no, seed: m.seed, log: m.log.slice(), pending: new Map(), cursor: 0, catchUp: m.log.length,
      commits: new Map(), reveals: new Map(), revealed: true, ended: false,
      endEvent: m.endEvent || null, endDelivered: false, waiters: new Set(), waiting: null,
    };
    motion.fast = m.log.length > 0;
    this.save();
    this.emit('match', { resumed: true });
  }

  // The interface the game receives as ctx.online.
  api() {
    const room = this;
    return {
      online: true,
      get seat() { return room.mySeat(); },
      get no() { return room.match?.no || 0; },
      opts: room.info.opts,
      seats: room.info.seats.length,
      name: (i) => room.seatName(i),
      isBot: (i) => room.isBot(i),
      rng: (label) => room.rng(label),
      decide: (seat, type, local, validate) => room.decide(seat, type, local, validate),
      replaying: () => motion.fast,
      onEvent: (fn) => room.on((e) => e.type === 'event' && fn(e)),
      resign: () => room.resign(),
      offerDraw: () => room.offerDraw(),
      answerDraw: (yes) => room.answerDraw(yes),
      finish: () => room.finish(),
      claim: (reason) => room.claim(reason),
      signal: (data) => room.signal(data),
      onSignal: (fn) => room.on((e) => e.type === 'signal' && fn(e)),
      humanSeats: () => room.humanSeats(),
      // refereed games: where the referee is, the match key and the seats (empty ones are bots)
      referee: room.cfg.referee ? {
        mode: isLocalNet() ? 'worker' : 'server',
        key: `${room.game.id}:${room.id}:${room.match?.no || 0}`,
        seats: room.info.seats.map((s, i) => ({ bot: !s, name: room.seatName(i), uid: s?.uid || null })),
      } : null,
      onTakeover: (fn) => room.on((e) => e.type === 'takeover' && fn(e.seat)),
      rematch: () => room.rematch(),
    };
  }
}

const never = () => new Promise(() => {});

// Network interface for a game against the computer: all decisions are local.
export function offlineNet(names = []) {
  return {
    online: false,
    seat: 0,
    no: 0,
    opts: {},
    name: (i) => names[i],
    isBot: (i) => i !== 0,
    rng: () => cryptoRng,
    decide: (seat, type, local) => local(),
    replaying: () => false,
    onEvent: () => () => {},
    resign() {},
    offerDraw() {},
    answerDraw() {},
    finish() {},
    rematch() {},
    claim() {},
    signal() {},
    onSignal: () => () => {},
    humanSeats: () => [0],
  };
}
