// Evil Empires: общият свят – съюзи, лични съобщения и какво вижда всеки играч.
import { test, ok, eq, throws } from './harness.js';
import { freshWorld, makeWorld, buildView, dmKey, WORLD_OPS } from '../js/games/empires/worldcore.js';

function setup() {
  const doc = freshWorld(7, 0);
  const store = { get: () => doc, mutate: (fn) => fn(doc) };
  const player = (uid, name) => ({ uid, name, race: 'humans', epoch: 1, score: 10, protectedUntil: 0, alliance: null, t: 0, cities: [{ id: 'c1', name: 'Град', x: 1, y: 1, hall: 1, loyalty: 100 }] });
  doc.players = { a: player('a', 'Анна'), b: player('b', 'Борис'), c: player('c', 'Цвета') };
  return { doc, A: makeWorld(store, 'a'), B: makeWorld(store, 'b'), C: makeWorld(store, 'c') };
}

test('свят: лични съобщения – само между двамата', () => {
  const { doc, A, B } = setup();
  A.dm('b', 'Здравей!');
  B.dm('a', 'Здрасти!');
  const k = dmKey('a', 'b');
  eq(doc.dms[k].map((m) => m.text), ['Здравей!', 'Здрасти!']);
  eq(Object.keys(buildView(doc, 'a').dms), [k]);
  eq(Object.keys(buildView(doc, 'c').dms), [], 'третият не вижда');
  throws(() => A.dm('a', 'сам на себе си'));
  throws(() => A.dm('zzz', 'няма го'));
  ok(WORLD_OPS.includes('dm'));
});

test('свят: личните съобщения са ограничени по брой и дължина', () => {
  const { doc, A } = setup();
  for (let i = 0; i < 70; i++) A.dm('b', 'x'.repeat(500));
  const list = doc.dms[dmKey('a', 'b')];
  eq(list.length, 60);
  eq(list[0].text.length, 400);
});

test('свят: чатът на съюза се вижда само от членовете', () => {
  const { doc, A, B } = setup();
  A.createAlliance('Вълци', 'VLK', 3);
  A.say('Само за нас');
  const aid = doc.players.a.alliance;
  ok(aid);
  ok(buildView(doc, 'a').alliances[aid].chat.some((m) => m.text === 'Само за нас'));
  eq(buildView(doc, 'b').alliances[aid].chat, []);
  throws(() => B.say('не съм член'));
});

test('свят: изтрит играч – изчезват и разговорите му', () => {
  const { doc, A } = setup();
  A.dm('b', 'ехо');
  A.removePlayer('b');
  eq(Object.keys(doc.dms), []);
});
