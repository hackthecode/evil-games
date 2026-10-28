// Сървърът-съдия: игрите с карти (белот, сантасе, блато) се изиграват докрай само с ботове.
import { test, ok } from './harness.js';
import { createMatch } from '../js/net/referee/core.js';
import { reducerFor, REFEREED } from '../js/net/referee/games.js';

const SEATS = { belot: 4, santase: 2, blato: 3 };

for (const game of REFEREED) {
  test(`съдия: ${game} – 3 мача бот срещу бот докрай`, async () => {
    const reducer = await reducerFor(game);
    for (let i = 0; i < 3; i++) {
      const m = createMatch(reducer, { seats: Array.from({ length: SEATS[game] }, (_, k) => ({ bot: true, name: `Бот ${k + 1}` })), seed: `${game}-${i}` });
      m.start();
      ok(m.over(), 'мачът свършва');
      const r = m.result();
      ok(r && Array.isArray(r.winners), 'има победител');
    }
  });
}
