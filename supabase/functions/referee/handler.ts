// Supabase Edge Function "referee" – the referee server for hidden-card games.
// The game logic is in bundle.js (generated from js/ with tools/build-referee.py).
//
// Requests (POST JSON, with the logged-in user's token):
//   create   { key, gameId, seats, opts }  – creates the match (if it doesn't exist yet)
//   join     { key }                       – my view; the match starts when all humans have joined
//   submit   { key, type, data }           – my decision
//   pull     { key, from }                 – the steps from n = from onwards (with my view)
//   takeover { key, target }               – disconnected player → bot
// After every change a signal is sent on the Realtime channel "ref-<key>": { n }.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createMatch, restoreMatch, forSeat, REDUCERS } from './bundle.js';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const auth = req.headers.get('Authorization') || '';
    const asUser = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: 'You are not logged in.' }, 401);
    const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
    return json(await handle(db, user.id, await req.json()));
  } catch (e) {
    return json({ error: (e as Error).message || String(e) });
  }
});

// deno-lint-ignore no-explicit-any
type Db = any;

async function load(db: Db, key: string) {
  const { data, error } = await db.from('referee_matches').select('*').eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Match not found.');
  return data;
}

// Saves the new state only if nobody else has changed it in the meantime.
// deno-lint-ignore no-explicit-any
async function persist(db: Db, row: any, match: any, entries: any[], patch: Record<string, unknown> = {}) {
  const n = match.log.length;
  const { data, error } = await db.from('referee_matches')
    .update({ state: match.save(), n, updated_at: new Date().toISOString(), ...patch })
    .eq('key', row.key).eq('n', row.n).select('key');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('The match was changed in the meantime – try again.');
  if (entries.length) {
    const rows = entries.map((e) => ({ key: row.key, n: e.n, seat: e.seat, type: e.type, pub: e.pub, views: e.views }));
    const ins = await db.from('referee_log').insert(rows);
    if (ins.error) throw new Error(ins.error.message);
    await signal(row.key, n);
  }
}

// A "new steps" signal (no content – everyone fetches their own view with pull).
async function signal(key: string, n: number) {
  await fetch(`${URL_}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ topic: `ref-${key}`, event: 'n', payload: { n } }] }),
  }).catch(() => {});
}

// deno-lint-ignore no-explicit-any
const seatOf = (seats: any[], uid: string) => seats.findIndex((s) => s.uid === uid);

// deno-lint-ignore no-explicit-any
async function handle(db: Db, uid: string, body: any) {
  const { op, key } = body;
  if (typeof key !== 'string' || key.length > 80) throw new Error('Invalid match.');

  if (op === 'create') {
    const reducer = REDUCERS[body.gameId];
    if (!reducer) throw new Error('This game has no referee.');
    // deno-lint-ignore no-explicit-any
    const seats = (body.seats || []).map((s: any) => ({ uid: s.uid || null, bot: !!s.bot || !s.uid, name: String(s.name || 'Bot').slice(0, 40) }));
    if (seatOf(seats, uid) < 0) throw new Error('You are not at the table.');
    const exists = await db.from('referee_matches').select('key').eq('key', key).maybeSingle();
    if (exists.data) return true;
    const seed = crypto.randomUUID() + crypto.randomUUID();
    const match = createMatch(reducer, { seats, opts: body.opts || {}, seed });
    const ins = await db.from('referee_matches').insert({ key, game_id: body.gameId, seats, state: match.save(), n: 0, joined: [], started: false });
    if (ins.error && !/duplicate/i.test(ins.error.message)) throw new Error(ins.error.message);
    return true;
  }

  const row = await load(db, key);
  const reducer = REDUCERS[row.game_id];
  const seat = seatOf(row.seats, uid);
  if (seat < 0) throw new Error('You are not at the table.');
  const match = restoreMatch(reducer, row.state);

  if (op === 'join') {
    const snap = match.snapshot(seat);
    const joined = [...new Set([...(row.joined || []), seat])];
    // the match starts when all humans have joined
    // deno-lint-ignore no-explicit-any
    const all = match.seats.every((s: any, i: number) => s.bot || joined.includes(i));
    if (!row.started && all) await persist(db, row, match, match.start(), { joined, started: true });
    else await db.from('referee_matches').update({ joined }).eq('key', key);
    return { n: snap.n, view: snap.view };
  }

  if (op === 'submit') {
    const out = match.submit(seat, body.type, body.data);
    await persist(db, row, match, out);
    return true;
  }

  if (op === 'takeover') {
    const out = match.takeover(Number(body.target));
    // deno-lint-ignore no-explicit-any
    const all = match.seats.every((s: any, i: number) => s.bot || (row.joined || []).includes(i));
    const extra = !row.started && all ? match.start() : [];
    await persist(db, row, match, [...out, ...extra], { started: row.started || all });
    return true;
  }

  if (op === 'pull') {
    const from = Math.max(0, Number(body.from) || 0);
    const { data, error } = await db.from('referee_log').select('n, seat, type, pub, views')
      .eq('key', key).gte('n', from).order('n').limit(500);
    if (error) throw new Error(error.message);
    // deno-lint-ignore no-explicit-any
    return { entries: forSeat(data, seat).map((e: any) => ({ n: e.n, seat: e.seat, type: e.type, pub: e.pub, view: e.view })) };
  }

  throw new Error('Unknown request.');
}
