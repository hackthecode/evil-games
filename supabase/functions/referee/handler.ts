// Supabase Edge Function „referee“ – сървърът-съдия за игрите със скрити карти.
// Логиката на игрите е в bundle.js (генерира се от js/ с tools/build-referee.py).
//
// Заявки (POST JSON, с токена на влезлия потребител):
//   create   { key, gameId, seats, opts }  – създава мача (ако още го няма)
//   join     { key }                       – изгледът ми; мачът тръгва, когато всички хора влязат
//   submit   { key, type, data }           – моето решение
//   pull     { key, from }                 – стъпките от n = from нататък (с моя изглед)
//   takeover { key, target }               – прекъснал играч → бот
// След всяка промяна се праща сигнал по Realtime канал „ref-<key>“: { n }.
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
    if (!user) return json({ error: 'Не сте влезли.' }, 401);
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
  if (!data) throw new Error('Мачът не е намерен.');
  return data;
}

// Записва новото състояние само ако никой друг не го е променил междувременно.
// deno-lint-ignore no-explicit-any
async function persist(db: Db, row: any, match: any, entries: any[], patch: Record<string, unknown> = {}) {
  const n = match.log.length;
  const { data, error } = await db.from('referee_matches')
    .update({ state: match.save(), n, updated_at: new Date().toISOString(), ...patch })
    .eq('key', row.key).eq('n', row.n).select('key');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Мачът беше променен междувременно – опитайте отново.');
  if (entries.length) {
    const rows = entries.map((e) => ({ key: row.key, n: e.n, seat: e.seat, type: e.type, pub: e.pub, views: e.views }));
    const ins = await db.from('referee_log').insert(rows);
    if (ins.error) throw new Error(ins.error.message);
    await signal(row.key, n);
  }
}

// Сигнал „има нови стъпки“ (без съдържание – всеки си взема своя изглед с pull).
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
  if (typeof key !== 'string' || key.length > 80) throw new Error('Невалиден мач.');

  if (op === 'create') {
    const reducer = REDUCERS[body.gameId];
    if (!reducer) throw new Error('Тази игра няма съдия.');
    // deno-lint-ignore no-explicit-any
    const seats = (body.seats || []).map((s: any) => ({ uid: s.uid || null, bot: !!s.bot || !s.uid, name: String(s.name || 'Бот').slice(0, 40) }));
    if (seatOf(seats, uid) < 0) throw new Error('Не сте на масата.');
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
  if (seat < 0) throw new Error('Не сте на масата.');
  const match = restoreMatch(reducer, row.state);

  if (op === 'join') {
    const snap = match.snapshot(seat);
    const joined = [...new Set([...(row.joined || []), seat])];
    // мачът тръгва, когато всички хора са влезли
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

  throw new Error('Непозната заявка.');
}
