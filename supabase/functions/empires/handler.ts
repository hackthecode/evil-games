// Supabase Edge Function „empires“ – сървърът на Evil Empires.
// Логиката е в bundle (генерира се от js/ с tools/build-empires.py) – същата, която
// работи и в браузъра. Всяко действие се проверява тук, а записите са в базата.
//
// Заявки (POST JSON, с токена на влезлия потребител):
//   sync | new { race, name } | act { name, args } | world { name, args } | reset | push { sub } | unpush { endpoint }
//   cron (без потребител, със заглавка x-cron-secret) – от pg_cron на няколко минути.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC') || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE') || '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';
if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails('https://hackthecode.github.io/evil-games/', VAPID_PUBLIC, VAPID_PRIVATE);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
function makeDb(sb: any) {
  const must = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r; };
  return {
    async getWorld() {
      const { data } = must(await sb.from('ee_world').select('doc, version').eq('id', 1).maybeSingle());
      return data;
    },
    async getSave(uid: string) {
      const { data } = must(await sb.from('ee_saves').select('state, version').eq('uid', uid).maybeSingle());
      return data;
    },
    // deno-lint-ignore no-explicit-any
    async commit({ world, saves }: any) {
      const { data } = must(await sb.rpc('ee_commit', { p_world: world?.doc ?? null, p_world_version: world?.version ?? 0, p_saves: saves }));
      return data === true;
    },
    async listSaves() {
      const { data } = must(await sb.from('ee_saves').select('uid').order('updated_at', { ascending: true }).limit(1000));
      // deno-lint-ignore no-explicit-any
      return (data || []).map((r: any) => r.uid);
    },
    // deno-lint-ignore no-explicit-any
    async savePush(uid: string, sub: any) {
      must(await sb.from('ee_push').upsert({ endpoint: String(sub.endpoint).slice(0, 1000), uid, sub }));
    },
    async deletePush(endpoint: string) {
      must(await sb.from('ee_push').delete().eq('endpoint', endpoint));
    },
    async pushSubs(uid: string) {
      const { data } = must(await sb.from('ee_push').select('sub').eq('uid', uid));
      // deno-lint-ignore no-explicit-any
      return (data || []).map((r: any) => r.sub);
    },
  };
}

// deno-lint-ignore no-explicit-any
async function sendPush(sub: any, payload: unknown) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600 });
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const code = (e as any)?.statusCode;
    if (code === 404 || code === 410) throw { gone: true };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json();
    const db = makeDb(createClient(URL_, SERVICE, { auth: { persistSession: false } }));
    if (body?.op === 'cron') {
      if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'Забранено.' }, 403);
      return json(await cron(db, Date.now(), sendPush));
    }
    const auth = req.headers.get('Authorization') || '';
    const asUser = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: 'Не сте влезли.' }, 401);
    return json(await handle(db, user.id, body));
  } catch (e) {
    return json({ error: (e as Error).message || String(e) });
  }
});
