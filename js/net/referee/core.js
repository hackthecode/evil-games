// Сървър-съдия: изпълнява играта авторитетно. Държи тестето и всички ръце,
// проверява всяко решение, играе вместо ботовете и стъпките на „системата“
// (раздаване, точкуване), а на всеки играч дава изглед само с неговите карти.
//
// Един и същ код работи: в браузъра (игра срещу компютъра), в SharedWorker
// (локален онлайн тест, емулира сървър) и в Supabase Edge Function (истински сървър).
// Състоянието е чист JSON, за да може сървърът да го пази в базата данни.
//
// Редуктор на игра (js/games/<игра>/referee.js):
//   init({ seats, opts, seed }) → S          seats: [{ bot: bool, name }]
//   next(S) → { seat, type } | null          seat -1 = системна стъпка; null = край
//   validate(S, seat, type, data) → bool
//   apply(S, seat, type, data) → pub         публични данни за дневника
//   view(S, seat) → изглед за играча (карти, кой е на ход, възможни решения…)
//   ai(S, seat, type) → data                 решение на бот
//   result(S) → { winners: [seat], ... }     при край

export function createMatch(reducer, { seats, opts = {}, seed }) {
  return wrap(reducer, { S: reducer.init({ seats, opts, seed }), seats, log: [] });
}

export function restoreMatch(reducer, saved) {
  return wrap(reducer, saved);
}

function wrap(reducer, M) {
  const humans = () => M.seats.map((s, i) => (s.bot ? -1 : i)).filter((i) => i >= 0);

  function step(seat, type, data) {
    const pub = reducer.apply(M.S, seat, type, data);
    const e = { n: M.log.length, seat, type, pub: pub ?? null };
    M.log.push(e);
    // изгледите се правят веднага – всеки играч вижда състоянието след тази стъпка
    const views = {};
    for (const h of humans()) views[h] = reducer.view(M.S, h);
    return { ...e, views };
  }

  // Изпълнява системните стъпки и ходовете на ботовете до решение на човек или край.
  function advance() {
    const out = [];
    for (let guard = 0; guard < 2000; guard++) {
      const nx = reducer.next(M.S);
      if (!nx) break;
      if (nx.seat === -1) out.push(step(-1, nx.type, null));
      else if (M.seats[nx.seat].bot) out.push(step(nx.seat, nx.type, reducer.ai(M.S, nx.seat, nx.type)));
      else break;
    }
    return out;
  }

  return {
    get log() { return M.log; },
    get seats() { return M.seats; },
    pending: () => reducer.next(M.S),
    over: () => !reducer.next(M.S),
    result: () => reducer.result(M.S),
    start: () => (M.log.length ? [] : advance()),
    submit(seat, type, data) {
      const nx = reducer.next(M.S);
      if (!nx || nx.seat !== seat || nx.type !== type) throw new Error('Не е ваш ред.');
      if (!reducer.validate(M.S, seat, type, data)) throw new Error('Невалиден ход.');
      return [step(seat, type, data), ...advance()];
    },
    // прекъснал играч → бот (решенията му се вземат автоматично)
    takeover(seat) {
      if (!M.seats[seat] || M.seats[seat].bot) return [];
      M.seats[seat] = { ...M.seats[seat], bot: true };
      return advance();
    },
    view: (seat) => reducer.view(M.S, seat),
    snapshot: (seat) => ({ n: M.log.length, view: reducer.view(M.S, seat), log: M.log }),
    save: () => JSON.parse(JSON.stringify(M)),
  };
}

// Стъпките за конкретен играч: публичната част + неговият изглед.
export const forSeat = (entries, seat) => entries.map(({ views, ...e }) => ({ ...e, view: views[seat] }));
