// Evil Empires: the shared world – alliances, private messages and what each player sees.
import { test, ok, eq, throws } from './harness.js';
import { freshWorld, makeWorld, buildView, dmKey, WORLD_OPS } from '../js/games/empires/worldcore.js';

function setup() {
  const doc = freshWorld(7, 0);
  const store = { get: () => doc, mutate: (fn) => fn(doc) };
  const player = (uid, name) => ({ uid, name, race: 'humans', epoch: 1, score: 10, protectedUntil: 0, alliance: null, t: 0, cities: [{ id: 'c1', name: 'City', x: 1, y: 1, hall: 1, loyalty: 100 }] });
  doc.players = { a: player('a', 'Anna'), b: player('b', 'Boris'), c: player('c', 'Tsveta') };
  return { doc, A: makeWorld(store, 'a'), B: makeWorld(store, 'b'), C: makeWorld(store, 'c') };
}

test('world: private messages – only between the two', () => {
  const { doc, A, B } = setup();
  A.dm('b', 'Hello!');
  B.dm('a', 'Hi!');
  const k = dmKey('a', 'b');
  eq(doc.dms[k].map((m) => m.text), ['Hello!', 'Hi!']);
  eq(Object.keys(buildView(doc, 'a').dms), [k]);
  eq(Object.keys(buildView(doc, 'c').dms), [], 'the third one doesn\'t see it');
  throws(() => A.dm('a', 'to themselves'));
  throws(() => A.dm('zzz', 'not there'));
  ok(WORLD_OPS.includes('dm'));
});

test('world: private messages are limited in number and length', () => {
  const { doc, A } = setup();
  for (let i = 0; i < 70; i++) A.dm('b', 'x'.repeat(500));
  const list = doc.dms[dmKey('a', 'b')];
  eq(list.length, 60);
  eq(list[0].text.length, 400);
});

test('world: the alliance chat is visible only to members', () => {
  const { doc, A, B } = setup();
  A.createAlliance('Wolves', 'VLK', 3);
  A.say('Just for us');
  const aid = doc.players.a.alliance;
  ok(aid);
  ok(buildView(doc, 'a').alliances[aid].chat.some((m) => m.text === 'Just for us'));
  eq(buildView(doc, 'b').alliances[aid].chat, []);
  throws(() => B.say('not a member'));
});

test('world: a deleted player – their conversations disappear too', () => {
  const { doc, A } = setup();
  A.dm('b', 'echo');
  A.removePlayer('b');
  eq(Object.keys(doc.dms), []);
});
