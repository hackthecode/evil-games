// Сантасе: интерфейсът се управлява от сървъра-съдия (js/games/santase/referee.js).
// Играта получава стъпки { seat, type, pub, view } и само ги анимира; собствените
// карти идват от изгледа, а чуждите не се знаят.
import { h, sleep, modal, toast, motion } from '../../ui.js';
import { createTable } from '../../net/table.js';
import { setupScreen, showResult, confirmDialog, sound, isMuted, setMuted } from '../common.js';
import { cardEl, sortHand, layoutFan } from '../cards/cards.js';
import { fly, snap, land, collectTrick, flipHand, shuffleDeck } from '../cards/fly.js';
import { suitSvg, SUIT_NAMES } from '../cards/suits.js';
import { order } from './engine.js';

const TARGET = 11;

export async function mount(root, ctx) {
  const online = ctx.online || null;
  let destroyed = false;
  let matchId = 0;
  let cleanup = () => {};

  const start = async () => {
    matchId++;
    cleanup();
    root.replaceChildren();
    if (online) {
      const r = online.referee;
      return runMatch(createTable({ mode: r.mode, gameId: 'santase', key: r.key, seat: online.seat, seats: r.seats, opts: online.opts }), r.seats.map((s) => s.name), matchId);
    }
    const opts = await setupScreen(root, {
      gameId: 'santase',
      title: 'Нова игра на сантасе',
      subtitle: 'Мач до 11 точки срещу компютъра.',
      groups: [{ key: 'level', label: 'Трудност', value: 'normal', options: [['easy', 'Лесно'], ['normal', 'Нормално']] }],
    });
    if (destroyed) return;
    const seats = [{ bot: false, name: ctx.user.displayName }, { bot: true, name: 'Компютър' }];
    runMatch(createTable({ mode: 'local', gameId: 'santase', seat: 0, seats, opts }), seats.map((s) => s.name), matchId, opts.level);
  };

  async function runMatch(table, names, myId, level) {
    if (!online) ctx.newMatch();
    const gone = () => destroyed || myId !== matchId;
    const ME = table.seat, OP = 1 - ME;
    let v = null; // последният изглед от съдията
    let over = false;
    const pendingMine = new Set();
    let pendingOpp = 0;
    let hideTrump = false;

    // ---------- DOM ----------
    const table$ = h('div', { class: 'ct-table' });
    const oppName = h('span', { class: 'seat-name' }, names[OP]);
    const oppHand = h('div', { class: 'opp-hand' });
    const myName = h('span', { class: 'seat-name' }, names[ME]);
    const myHand = h('div', { class: 'my-hand' });
    const north = h('div', { class: 'seat north' }, oppName, oppHand);
    const south = h('div', { class: 'seat south' }, myHand, myName);
    const stockEl = h('div', { class: 'stock' });
    const center = h('div', { class: 'ct-center duo' });
    const slots = [h('div', { class: 'slot s0' }), h('div', { class: 'slot s1' })];
    center.append(...slots);
    const hud = h('div', { class: 'ct-hud' });
    const actions = h('div', { class: 'santase-actions' });
    const muteBtn = h('button', { class: 'btn', onclick: () => { setMuted(!isMuted()); muteBtn.textContent = isMuted() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊');
    const tools = h('div', { class: 'ct-tools' },
      h('button', { class: 'btn', onclick: resign }, 'Предай се'),
      !online && h('button', { class: 'btn', onclick: newGame }, 'Нова'),
      muteBtn,
    );
    table$.append(north, south, stockEl, center, hud, actions, tools);
    root.replaceChildren(table$);

    const slotOf = (p) => slots[p === ME ? 0 : 1];
    const nameOf = (p) => (p === ME ? myName : oppName);
    const red = (s) => s === 'H' || s === 'D';

    // ---------- рендиране от изгледа ----------
    function renderHud() {
      const pts = v?.points;
      hud.replaceChildren(...[
        h('div', { class: 'row' }, h('span', null, 'Вие'), h('b', null, v?.score[ME] ?? 0)),
        h('div', { class: 'row' }, h('span', null, names[OP]), h('b', null, v?.score[OP] ?? 0)),
        h('div', { class: 'goal' }, `мач до ${TARGET}`),
        v?.trump && !hideTrump && h('div', { class: 'contract-badge', html: `Коз: ${suitSvg(v.trump, 'suit' + (red(v.trump) ? ' red' : ''))} ${SUIT_NAMES[v.trump]}` }),
        pts && h('div', { class: 'goal' }, `точки: вие ${pts[ME]}${v.pending[ME] && !v.tricks[ME] ? ` (+${v.pending[ME]})` : ''} · ${names[OP]} ${pts[OP]}`),
      ].filter(Boolean));
      north.classList.toggle('turn', v?.turn === OP);
      south.classList.toggle('turn', v?.turn === ME);
    }

    function renderStock() {
      stockEl.replaceChildren();
      if (!v?.hand) return;
      stockEl.classList.toggle('closed', v.closedBy >= 0);
      if (!v.stock) return;
      const pile = h('div', { class: 'pile' });
      const n = v.stock - 1;
      if (v.trumpCard) stockEl.append(h('div', { class: 'trump-card' }, cardEl(v.trumpCard, { cls: hideTrump ? 'pending' : '' })));
      for (let i = 0; i < Math.min(n, 5); i++) {
        const c = cardEl(null, { faceDown: true });
        c.style.transform = `translate(${-i * 1.2}px, ${-i * 1.2}px)`;
        pile.append(c);
      }
      if (n > 0) stockEl.append(pile);
      stockEl.append(h('div', { class: 'count' }, v.closedBy >= 0 ? 'затворено' : `${v.stock} карти`));
    }

    const sortMine = (hand) => sortHand(hand, order, v.trump === 'S' ? ['S', 'H', 'C', 'D'] : [v.trump, ...['S', 'H', 'C', 'D'].filter((x) => x !== v.trump)]);

    function renderHands(playable = null) {
      if (!v?.hand) {
        oppHand.replaceChildren();
        myHand.replaceChildren();
        return;
      }
      const n = v.oppCount;
      oppHand.replaceChildren(...Array.from({ length: n }, (_, i) => cardEl(null, { faceDown: true, cls: i >= n - pendingOpp ? 'pending' : '' })));
      const hand = sortMine(v.hand);
      flipHand(myHand, () => myHand.replaceChildren(...hand.map((c) => {
        const el = cardEl(c, { cls: pendingMine.has(c.id) ? 'pending' : '' });
        if (playable) el.classList.add(playable.includes(c.id) ? 'playable' : 'disabled');
        return el;
      })));
      myHand.classList.toggle('active', !!playable);
      myHand.classList.toggle('n-few', hand.length <= 4);
      layoutFan(myHand, { spreadDeg: 3.5, lift: 1.6 });
    }

    function renderTable() {
      slots.forEach((s) => s.replaceChildren());
      if (v?.lead) slotOf(v.lead.p).append(cardEl(v.lead.card));
    }

    const renderAll = () => {
      renderHud();
      renderStock();
      renderHands();
      renderTable();
    };

    function bubble(anchor, text, gold = true, ms = 1700) {
      if (motion.fast) return;
      const r = anchor.getBoundingClientRect();
      const tr = table$.getBoundingClientRect();
      const b = h('div', { class: `bubble ${gold ? 'gold' : ''}` }, text);
      table$.append(b);
      const top = anchor === oppName ? r.bottom - tr.top + 8 : r.top - tr.top - b.offsetHeight - myHand.offsetHeight - 10;
      b.style.left = Math.max(6, r.left - tr.left + r.width / 2 - b.offsetWidth / 2) + 'px';
      b.style.top = Math.max(6, top) + 'px';
      setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 300); }, ms);
    }

    // ---------- решения на играча ----------
    let lastFrom = null;
    let picking = false;
    myHand.addEventListener('click', (e) => {
      const el = e.target.closest('.card.playable');
      if (!el || !picking) return;
      picking = false;
      lastFrom = snap(el);
      send({ kind: 'card', card: el.dataset.id });
    });

    function showDecision() {
      actions.replaceChildren();
      const dcs = v?.decision;
      if (!dcs || over) {
        picking = false;
        return renderHands();
      }
      picking = true;
      renderHands(dcs.legal);
      const pick = (kind) => () => {
        if (!picking) return;
        picking = false;
        actions.replaceChildren();
        send({ kind });
      };
      if (dcs.canExchange) actions.append(h('button', { class: 'btn', onclick: pick('exchange') }, 'Смени 9-ката'));
      if (dcs.canClose) actions.append(h('button', { class: 'btn', onclick: pick('close') }, '🔒 Затвори'));
    }

    async function send(data) {
      renderHands();
      try {
        await table.submit('act', data);
      } catch (e) {
        toast(e.message, 'error');
        showDecision();
      }
    }

    // ---------- анимации по стъпки ----------
    const stockTop = () => {
      const pile = stockEl.querySelector('.pile');
      return pile ? { ...snap(pile.lastElementChild), a: 0 } : null;
    };
    const trumpEl = () => stockEl.querySelector('.trump-card .card');
    const oppMid = () => snap(oppHand.children[oppHand.children.length >> 1] || oppHand);

    async function animDeal(e, nv) {
      v = { ...nv };
      slots.forEach((s) => s.replaceChildren());
      hideTrump = true;
      v.hand.forEach((c) => pendingMine.add(c.id));
      pendingOpp = v.oppCount;
      renderHud();
      renderStock();
      renderHands();
      const pile = stockEl.querySelector('.pile');
      sound('dice');
      if (pile) await shuffleDeck(pile, 900);
      if (gone()) return;
      // по 3 карти на всеки два пъти, първо на играча след раздаващия
      const mine = v.hand.slice();
      const flights = [];
      let oppIdx = 0, myIdx = 0;
      for (const half of [0, 1]) {
        for (const p of [e.pub.leader, 1 - e.pub.leader]) {
          for (let j = 0; j < 3; j++) {
            if (p === ME) {
              const c = mine[myIdx++];
              pendingMine.delete(c.id);
              flights.push(fly({ card: c, from: stockTop(), to: () => myHand.querySelector(`[data-id="${c.id}"]`), faceFrom: false, faceTo: true, duration: 430, delay: j * 75, spin: (Math.random() - 0.5) * 50, arc: 0.06, onStart: () => sound('deal') }));
            } else {
              const idx = oppIdx++;
              pendingOpp--;
              flights.push(fly({ card: null, from: stockTop(), to: () => oppHand.children[idx], faceFrom: false, faceTo: false, duration: 430, delay: j * 75, spin: (Math.random() - 0.5) * 50, arc: 0.06, onStart: () => sound('deal') }));
            }
          }
          await sleep(330);
          if (gone()) return;
        }
        void half;
      }
      await Promise.all(flights);
      hideTrump = false;
      renderHud();
      await fly({ card: v.trumpCard, from: stockTop(), to: trumpEl, faceFrom: false, faceTo: true, duration: 520, lift: 0.2 });
    }

    async function animExchange(p, pub, nv) {
      bubble(nameOf(p), 'Смяна на 9-ката');
      const tSnap = trumpEl() ? snap(trumpEl()) : null;
      const nineFrom = p === ME ? snap(myHand.querySelector(`[data-id="${pub.nine.id}"]`) || myHand) : oppMid();
      v = nv;
      renderStock();
      renderHands();
      sound('card');
      await Promise.all([
        fly({ card: pub.nine, from: nineFrom, to: trumpEl, faceFrom: p === ME, faceTo: true, duration: 520 }),
        tSnap && fly({
          card: pub.trumpCard, from: tSnap, faceFrom: true, faceTo: p === ME, duration: 520, delay: 80,
          to: p === ME ? () => myHand.querySelector(`[data-id="${pub.trumpCard.id}"]`) : oppMid(),
        }),
      ]);
    }

    async function animCard(p, pub, nv) {
      const card = pub.card;
      const from = p === ME
        ? (lastFrom && !motion.fast ? lastFrom : snap(myHand.querySelector(`[data-id="${card.id}"]`) || myHand))
        : oppMid();
      lastFrom = null;
      const prevHand = v.hand.map((c) => c.id);
      const prevStock = { pile: stockTop(), trump: trumpEl() && snap(trumpEl()), trumpCard: v.trumpCard };
      // изтеглените карти остават скрити, докато не долетят от тестето
      const drawn = pub.drew ? nv.hand.filter((c) => !prevHand.includes(c.id)) : [];
      drawn.forEach((c) => pendingMine.add(c.id));
      if (pub.drew) pendingOpp = 1;
      v = { ...nv, stock: pub.drew ? v.stock : nv.stock, trumpCard: pub.drew ? v.trumpCard : nv.trumpCard };
      const el = cardEl(card);
      slotOf(p).replaceChildren(el);
      sound('card');
      renderHands();
      renderHud();
      await fly({ card, from, to: () => el, faceFrom: p === ME, duration: 400, spin: p === ME ? 0 : (Math.random() - 0.5) * 40 }).then(() => land(el));
      if (pub.marriage) {
        bubble(nameOf(p), pub.marriage === 40 ? 'Четирийсет!' : 'Двайсет!');
        sound('notify');
      }
      if (!pub.trick) return;
      const w = pub.trick.winner;
      slotOf(w).classList.add('win');
      await sleep(750);
      if (gone()) return;
      slotOf(w).classList.remove('win');
      sound('deal');
      await collectTrick(slots.map((s) => s.firstElementChild).filter(Boolean), slotOf(w).firstElementChild, nameOf(w));
      slots.forEach((s) => { s.replaceChildren(); s.classList.remove('win'); });
      if (pub.drew) {
        // теглят по една карта: първо спечелилият; последната може да е откритият коз
        v = nv;
        renderStock();
        renderHands();
        await Promise.all([w, 1 - w].map((q, i) => {
          const fromTrump = pub.drew.lastTrump && i === 1;
          const src = fromTrump ? prevStock.trump : prevStock.pile || prevStock.trump;
          if (q === ME) {
            const c = drawn[0];
            if (!c) return null;
            pendingMine.delete(c.id);
            return fly({ card: c, from: src, to: () => myHand.querySelector(`[data-id="${c.id}"]`), faceFrom: fromTrump, faceTo: true, duration: 440, delay: i * 160, arc: 0.06, onStart: () => sound('deal') });
          }
          pendingOpp = 0;
          return fly({ card: fromTrump ? prevStock.trumpCard : null, from: src, to: () => oppHand.lastElementChild, faceFrom: fromTrump, faceTo: false, duration: 440, delay: i * 160, arc: 0.06, onStart: () => sound('deal') });
        }));
      }
    }

    async function animScore(pub) {
      const reason = pub.reason === 'closedFail' ? 'затвореното тесте не донесе 66' : pub.reason === 'last' ? 'последна взета ръка' : '66 точки';
      renderHud();
      if (motion.fast || v.phase === 'over') return;
      await modal({
        title: pub.winner === ME ? 'Печелите раздаването!' : `${names[pub.winner]} печели раздаването`,
        body: h('div', null,
          h('p', { class: 'summary-note' }, `+${pub.gp} ${pub.gp === 1 ? 'точка' : 'точки'} (${reason})`),
          h('table', { class: 'summary-table' },
            h('tr', null, h('th', null, ''), h('th', null, 'Вие'), h('th', null, names[OP])),
            h('tr', null, h('td', null, 'Точки в раздаването'), h('td', null, pub.points[ME]), h('td', null, pub.points[OP])),
            h('tr', null, h('td', null, 'Взети ръце'), h('td', null, pub.tricks[ME]), h('td', null, pub.tricks[OP])),
            h('tr', { class: 'total' }, h('td', null, 'Мач'), h('td', null, pub.score[ME]), h('td', null, pub.score[OP])),
          ),
        ),
        actions: [{ label: 'Продължи', value: true, primary: true }],
      });
    }

    async function animate(e) {
      const nv = e.view;
      if (e.type === 'deal') return animDeal(e, nv);
      if (e.type === 'score') {
        v = nv;
        await animScore(e.pub);
        if (nv.phase === 'over') endMatch(nv.score[ME] > nv.score[OP] ? 'win' : 'loss', `Краен резултат ${nv.score[ME]} : ${nv.score[OP]}`);
        return;
      }
      // ход на противника – кратко „мислене“
      if (e.seat !== ME && !motion.fast) await sleep(650);
      if (gone()) return;
      if (e.pub.kind === 'exchange') return animExchange(e.seat, e.pub, nv);
      if (e.pub.kind === 'close') {
        v = nv;
        sound('notify');
        bubble(nameOf(e.seat), 'Затварям!');
        renderStock();
        stockEl.querySelector('.pile')?.animate([{ transform: 'none' }, { transform: 'rotate(-12deg)' }], { duration: 450, easing: 'cubic-bezier(.3,1.4,.5,1)' });
        return;
      }
      return animCard(e.seat, e.pub, nv);
    }

    // Стъпките се анимират една по една; след последната – решението на играча.
    const queue = [];
    let busy = false;
    let skipBelow = 0;
    async function pump() {
      if (busy) return;
      busy = true;
      while (queue.length && !gone()) {
        const e = queue.shift();
        if (e.n < skipBelow) continue;
        await animate(e);
        renderHud();
      }
      busy = false;
      if (!gone()) showDecision();
    }
    const off = table.onEntries((entries) => {
      queue.push(...entries);
      pump();
    });

    // ---------- край ----------
    async function endMatch(outcome, text) {
      if (over) return;
      over = true;
      matchId++;
      online?.finish();
      actions.replaceChildren();
      picking = false;
      await ctx.report(outcome, online
        ? { summary: `Онлайн срещу ${names[OP]} · ${v?.score[ME] ?? 0}:${v?.score[OP] ?? 0}`, online: true, opponent: names[OP] }
        : { summary: `${v?.score[ME] ?? 0}:${v?.score[OP] ?? 0} · ${level === 'easy' ? 'Лесно' : 'Нормално'}` });
      if (destroyed) return;
      const c = await showResult({ outcome, text, again: online ? 'Реванш' : undefined });
      if (c === 'again') online ? online.rematch() : start();
      else if (c === 'exit') location.hash = online ? '#/online/santase' : '#/';
    }

    async function resign() {
      if (over) return;
      if (!(await confirmDialog('Предаване', 'Да се отчете ли мачът като загуба?', 'Предай се', true))) return;
      if (online) online.resign();
      else endMatch('loss', 'Предадохте мача.');
    }

    async function newGame() {
      if (!(await confirmDialog('Нова игра', 'Текущият мач ще бъде прекратен без да се отчита. Продължаване?'))) return;
      start();
    }

    const offEvents = online ? online.onEvent((e) => {
      if (over || destroyed) return;
      if (e.kind === 'resign') endMatch(e.seat === ME ? 'loss' : 'win', e.seat === ME ? 'Предадохте мача.' : `${names[e.seat]} се предаде.`);
      else if (e.kind === 'forfeit') endMatch(e.winner === ME ? 'win' : 'loss', e.reason === 'stall' ? 'Служебна победа заради бездействие.' : 'Противникът напусна – служебна победа.');
    }) : () => {};

    cleanup = () => {
      off();
      offEvents();
      table.close();
    };

    // ---------- свързване ----------
    try {
      const res = await table.connect();
      if (gone()) return;
      v = res.view;
      skipBelow = res.n;
      renderAll();
      pump();
    } catch (e) {
      table$.append(h('div', { class: 'ct-msg' }, 'Няма връзка със съдията: ' + e.message));
    }
  }

  start();
  return { destroy() { destroyed = true; cleanup(); } };
}
