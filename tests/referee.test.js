// The referee server: card games (belot, santase, blato) are played to the end with bots only.
import { test, ok } from './harness.js';
import { createMatch } from '../js/net/referee/core.js';
import { reducerFor, REFEREED } from '../js/net/referee/games.js';

const SEATS = { belot: 4, santase: 2, blato: 3 };

for (const game of REFEREED) {
  test(`referee: ${game} – 3 bot-vs-bot matches to the end`, async () => {
    const reducer = await reducerFor(game);
    for (let i = 0; i < 3; i++) {
      const m = createMatch(reducer, { seats: Array.from({ length: SEATS[game] }, (_, k) => ({ bot: true, name: `Bot ${k + 1}` })), seed: `${game}-${i}` });
      m.start();
      ok(m.over(), 'the match ends');
      const r = m.result();
      ok(r && Array.isArray(r.winners), 'there is a winner');
    }
  });
}
