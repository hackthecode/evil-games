// SharedWorker – a local "server" for online tests between tabs of one browser.
// Holds the secret state of the matches; tabs receive only their own views.
// The protocol is the same as with the Supabase Edge Function.
import { createMatch, forSeat } from './core.js';
import { reducerFor } from './games.js';
import { randomHex } from '../../store/hash.js';
import { tk } from '../../i18n/tk.js';

const matches = new Map(); // key → { match, ports: Map(port → seat) }

async function handle(port, msg) {
  const { op, key, seat } = msg;
  if (op === 'create') {
    if (!matches.has(key)) {
      const reducer = await reducerFor(msg.gameId);
      if (!matches.has(key)) {
        const match = createMatch(reducer, { seats: msg.seats, opts: msg.opts || {}, seed: randomHex(16) });
        matches.set(key, { match, ports: new Map(), joined: new Set(), started: false });
      }
    }
    return true;
  }
  const m = matches.get(key);
  if (!m) throw new Error(tk('Match not found.'));
  if (op === 'join') {
    m.ports.set(port, seat);
    m.joined.add(seat);
    const snap = m.match.snapshot(seat);
    maybeStart(m, key);
    return snap;
  }
  if (op === 'submit') {
    const out = m.match.submit(seat, msg.type, msg.data);
    broadcast(m, key, out);
    return true;
  }
  if (op === 'takeover') {
    broadcast(m, key, m.match.takeover(msg.target));
    maybeStart(m, key);
    return true;
  }
  if (op === 'leave') {
    m.ports.delete(port);
    return true;
  }
  throw new Error(tk('Unknown request.'));
}

// The match starts when all humans have connected (or the disconnected ones are replaced by bots).
function maybeStart(m, key) {
  if (m.started) return;
  if (!m.match.seats.every((s, i) => s.bot || m.joined.has(i))) return;
  m.started = true;
  setTimeout(() => broadcast(m, key, m.match.start()), 0);
}

function broadcast(m, key, entries) {
  if (!entries.length) return;
  for (const [port, s] of m.ports) port.postMessage({ op: 'entries', key, entries: forSeat(entries, s) });
}

self.onconnect = (e) => {
  const port = e.ports[0];
  port.onmessage = async ({ data }) => {
    try {
      const result = await handle(port, data);
      if (data.id) port.postMessage({ id: data.id, result });
    } catch (err) {
      if (data.id) port.postMessage({ id: data.id, error: err.message });
    }
  };
  port.start();
};
