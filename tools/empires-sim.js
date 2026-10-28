// Симулация за баланса на Evil Empires: „алчен“ бот играе N дни и отчита кога
// стига ключовите етапи. Пуска се от конзолата на браузъра (на локалния сървър):
//   const { run } = await import('/tools/empires-sim.js'); console.table(await run('humans', 20));
import * as E from '../js/games/empires/engine.js';
import { BUILDINGS, TECHS, FIGHTERS } from '../js/games/empires/data.js';
import { fight } from '../js/games/empires/battle.js';

export async function run(race = 'humans', days = 20, stepMin = 1) {
  let t = 0;
  const s = E.newGame(race, 'Sim', t, 42);
  const at = {};
  const mark = (k) => { if (!(k in at)) at[k] = +(t / 3600000).toFixed(1); };
  const tryDo = (f) => { try { f(); return true; } catch { return false; } };
  const prio = (id) => (s.cities[0].b[id] || 0) + (id === 'hall' ? -1.5 : 0) + (id === 'warehouse' ? 0.5 : 0);
  for (let i = 0; i < (days * 24 * 60) / stepMin; i++) {
    t += stepMin * 60000;
    E.advance(s, t);
    const city = s.cities[0];
    if (city.queue.length < E.buildSlots(s)) {
      const ids = Object.keys(BUILDINGS).filter((id) => E.buildState(s, city, id).status === 'ok').sort((a, b) => prio(a) - prio(b));
      for (const id of ids) if (tryDo(() => E.build(s, t, 'c1', id))) break;
    }
    if (!s.research) for (const id of Object.keys(TECHS)) if (E.techState(s, id).status === 'ok' && tryDo(() => E.research(s, t, 'c1', id))) break;
    if (!city.train.length) for (const u of ['elite', 'rider', 'archer', 'spear', 'slinger', 'warrior']) {
      const n = Math.min(10, E.maxTrain(s, city, u));
      if (n > 0 && tryDo(() => E.train(s, t, 'c1', u, n))) break;
    }
    const army = Object.fromEntries(FIGHTERS.filter((u) => city.units[u] > 0).map((u) => [u, city.units[u]]));
    if (Object.keys(army).length) {
      const side = Object.entries(army).map(([u, n]) => ({ key: u, n, ...E.unitStats(s, u, city) }));
      for (const c of [...s.camps].sort((a, b) => b.lvl - a.lvl)) {
        if (c.respawn || s.marches.some((m) => m.kind === 'raid' && m.target.id === c.id)) continue;
        if (fight(side, E.campArmy(c.lvl), 'probe' + i).win === 'att') { tryDo(() => E.send(s, t, 'c1', 'raid', { type: 'camp', id: c.id, x: c.x, y: c.y }, army, false, null)); break; }
      }
    }
    for (const m of E.storyList(s)) if (!m.claimed && m.have >= m.goal) tryDo(() => E.claimStory(s, t, 'c1', m.id));
    for (const d of E.dailyList(s, t)) if (!d.claimed && d.have >= d.goal) tryDo(() => E.claimDaily(s, t, 'c1', d.id));
    if (!s.epochUp) tryDo(() => E.advanceEpoch(s, t, 'c1'));
    for (const L of [2, 3, 5, 7, 10]) if (E.maxLv(s, 'hall') >= L) mark('hall' + L);
    for (const L of [1, 3, 5, 8]) if (s.stats.bestCamp >= L) mark('camp' + L);
    if (s.techs.bronze) mark('bronze');
    if (s.epoch >= 2) mark('epoch2');
    if (s.techs.iron) mark('iron');
  }
  const c0 = s.cities[0];
  const r = E.rates(s, c0);
  return {
    race, hoursAt: at, b: c0.b, units: c0.units, story: s.story.claimed.length, score: E.score(s),
    res: Object.fromEntries(Object.entries(c0.res).map(([k, v]) => [k, Math.round(v)])),
    rates: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)])),
    pop: `${E.popUsed(s, c0)}/${E.popCap(s, c0)}`, reports: s.reports.slice(0, 3), state: s,
  };
}
