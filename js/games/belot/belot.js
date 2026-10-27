// Белот: интерфейсът се управлява от сървъра-съдия (js/games/belot/referee.js).
// Играта получава стъпки { seat, type, pub, view } и само ги анимира; собствените
// карти идват от изгледа, а чуждите не се знаят.
import { h, sleep, modal, toast, motion } from '../../ui.js';
import { createTable } from '../../net/table.js';
import { setupScreen, showResult, confirmDialog, sound, isMuted, setMuted } from '../common.js';
import { cardEl, layoutFan } from '../cards/cards.js';
import { fly, snap, land, collectTrick, flipHand, deckEl, setDeckCount, shuffleDeck } from '../cards/fly.js';
import { suitSvg, isRed } from '../cards/suits.js';
import { CONTRACT_NAMES, teamOf } from './engine.js';

const SEATS = ['south', 'east', 'north', 'west'];
const BOT_NAMES = [null, 'Георги', 'Мария', 'Петър'];
const SPEED = { slow: 1.4, normal: 1, fast: 0.6 };

function contractLabel(c, withIcon = true) {
  if (c.length === 1 && withIcon) {
    return `${suitSvg(c, isRed(c) ? 'suit red' : 'suit')} ${CONTRACT_NAMES[c]}`;
  }
  return CONTRACT_NAMES[c];
}

function bidLabel(bid) {
  if (bid === 'pass') return 'Пас';
  if (bid === 'double') return 'Контра!';
  if (bid === 'redouble') return 'Реконтра!';
  return contractLabel(bid);
}

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
      return runMatch(createTable({ mode: r.mode, gameId: 'belot', key: r.key, seat: online.seat, seats: r.seats, opts: online.opts }), r.seats.map((s) => s.name), 1, matchId);
    }
    const opts = await setupScreen(root, {
      gameId: 'belot',
      title: 'Нова игра на белот',
      subtitle: 'Вие и Мария срещу Георги и Петър.',
      groups: [
        { key: 'target', label: 'Игра до', value: 151, options: [[51, '51'], [101, '101'], [151, '151']] },
        { key: 'speed', label: 'Скорост на компютъра', value: 'normal', options: [['slow', 'Бавно'], ['normal', 'Нормално'], ['fast', 'Бързо']] },
      ],
    });
    if (destroyed) return;
    const seats = [ctx.user.displayName, ...BOT_NAMES.slice(1)].map((name, i) => ({ bot: i !== 0, name }));
    runMatch(createTable({ mode: 'local', gameId: 'belot', seat: 0, seats, opts }), seats.map((s) => s.name), SPEED[opts.speed] || 1, matchId);
  };

  async function runMatch(table, names, speed, myId) {
    if (!online) ctx.newMatch();
    const gone = () => destroyed || myId !== matchId;
    const wait = (ms) => sleep(ms * speed);
    const ME = table.seat;
    const V = (p) => (p - ME + 4) % 4; // позиция на масата: 0 = долу (аз), 1 = дясно, 2 = горе, 3 = ляво
    const US = teamOf(ME), THEM = 1 - US;
    let v = null;
    let over = false;
    const pendingMine = new Set();
    const pendingOpp = [0, 0, 0, 0];
    let deckBox = null;

    // ---------- DOM ----------
    const table$ = h('div', { class: 'ct-table' });
    const seats = [0, 1, 2, 3].map((p) => {
      const nameEl = h('span', { class: 'seat-name' }, names[p]);
      const handEl = p === ME ? h('div', { class: 'my-hand' }) : h('div', { class: 'opp-hand' });
      const el = h('div', { class: `seat ${SEATS[V(p)]}` }, p === ME ? [handEl, nameEl] : [nameEl, handEl]);
      table$.append(el);
      return { el, nameEl, handEl };
    });
    const center = h('div', { class: 'ct-center' });
    const slots = [0, 1, 2, 3].map((p) => {
      const s = h('div', { class: `slot s${V(p)}` });
      center.append(s);
      return s;
    });
    const hud = h('div', { class: 'ct-hud' });
    const muteBtn = h('button', { class: 'btn', onclick: () => { setMuted(!isMuted()); muteBtn.textContent = isMuted() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊');
    const tools = h('div', { class: 'ct-tools' },
      h('button', { class: 'btn', onclick: resign }, 'Предай се'),
      !online && h('button', { class: 'btn', onclick: newGame }, 'Нова'),
      muteBtn,
    );
    table$.append(center, hud, tools);
    root.replaceChildren(table$);

    const p2name = (p) => (p === ME ? 'вие' : names[p]);

    // ---------- рендиране от изгледа ----------
    function renderHud() {
      const cur = v?.bidding?.current;
      const playing = v?.contract && v.phase !== 'bid';
      hud.replaceChildren(...[
        h('div', { class: 'row' }, h('span', null, 'Ние'), h('b', null, v?.score[US] ?? 0)),
        h('div', { class: 'row' }, h('span', null, 'Те'), h('b', null, v?.score[THEM] ?? 0)),
        h('div', { class: 'goal' }, `до ${v?.target ?? ''}${v?.hanging ? ` · висят ${v.hanging}` : ''}`),
        playing && cur && h('div', { class: 'contract-badge', html: `${contractLabel(cur.contract)}${cur.mult > 1 ? ` ×${cur.mult}` : ''}` }),
        playing && cur && h('div', { class: 'goal' }, `обяви ${p2name(cur.player)} · ръце ${v.tricksWon[US]}:${v.tricksWon[THEM]}`),
      ].filter(Boolean));
      seats.forEach((s, p) => s.el.classList.toggle('turn', v?.turn === p));
    }

    function renderHands(playable = null) {
      if (!v?.hand) {
        seats.forEach((s) => s.handEl.replaceChildren());
        return;
      }
      for (let p = 0; p < 4; p++) {
        if (p === ME) continue;
        const n = v.counts[p];
        seats[p].handEl.replaceChildren(...Array.from({ length: n }, (_, i) => cardEl(null, { faceDown: true, cls: i >= n - pendingOpp[p] ? 'pending' : '' })));
      }
      const mine = seats[ME].handEl;
      flipHand(mine, () => mine.replaceChildren(...v.hand.map((c) => {
        const el = cardEl(c, { cls: pendingMine.has(c.id) ? 'pending' : '' });
        if (playable) {
          const ok = playable.includes(c.id);
          el.classList.add(ok ? 'playable' : 'disabled');
          if (ok) el.tabIndex = 0;
        }
        return el;
      })));
      mine.classList.toggle('active', !!playable);
      mine.classList.toggle('n-few', v.hand.length <= 4);
      layoutFan(mine, { spreadDeg: 3, lift: 1.4 });
    }

    function renderTrick() {
      slots.forEach((s) => s.replaceChildren());
      for (const t of v?.trick || []) slots[t.p].append(cardEl(t.card));
    }

    function bubble(p, html, gold = false, ms = 1600) {
      if (motion.fast) return;
      const vv = V(p);
      const r = seats[p].nameEl.getBoundingClientRect();
      const tr = table$.getBoundingClientRect();
      const b = h('div', { class: `bubble ${gold ? 'gold' : ''}`, html });
      table$.append(b);
      const bw = b.offsetWidth, bh = b.offsetHeight;
      let x = r.left - tr.left + r.width / 2 - bw / 2;
      let y = r.bottom - tr.top + 8;
      if (vv === 1) { x = r.left - tr.left - bw - 8; y = r.top - tr.top; }
      if (vv === 3) { x = r.right - tr.left + 8; y = r.top - tr.top; }
      if (vv === 0) y = tr.height - seats[ME].handEl.offsetHeight - bh - 40;
      b.style.left = Math.max(6, Math.min(x, tr.width - bw - 6)) + 'px';
      b.style.top = Math.max(6, y) + 'px';
      setTimeout(() => {
        b.classList.add('out');
        setTimeout(() => b.remove(), 300);
      }, ms * speed);
    }

    function message(text, ms = 1500) {
      if (motion.fast) return;
      const m = h('div', { class: 'ct-msg' }, text);
      table$.append(m);
      setTimeout(() => m.remove(), ms);
    }

    // ---------- решения на играча ----------
    let picking = false;
    let lastFrom = null;
    seats[ME].handEl.addEventListener('click', (e) => {
      const el = e.target.closest('.card.playable');
      if (!el || !picking) return;
      picking = false;
      lastFrom = snap(el);
      send('card', el.dataset.id);
    });
    seats[ME].handEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') e.target.closest('.card.playable')?.click();
    });

    function showBidPanel(legal) {
      const cur = v.bidding.current;
      const btn = (bid, cls = '') =>
        h('button', {
          class: `btn ${cls} ${bid.length === 1 && isRed(bid) ? 'red' : ''}`,
          disabled: !legal.includes(bid),
          html: bid.length === 1 ? contractLabel(bid) : bidLabel(bid),
          onclick: () => { panel.remove(); send('bid', bid); },
        });
      const panel = h('div', { class: 'bid-panel' },
        h('h3', null, cur ? `Обявено: ${CONTRACT_NAMES[cur.contract]}${cur.mult > 1 ? ' ×' + cur.mult : ''} (${p2name(cur.player)})` : 'Вие обявявате'),
        h('div', { class: 'bid-grid' },
          ['C', 'D', 'H', 'S'].map((c) => btn(c)),
          btn('NT', 'wide'), btn('AT', 'wide'),
          legal.includes('redouble') ? btn('redouble', 'wide') : btn('double', 'wide'),
          btn('pass', 'btn-primary wide'),
        ),
      );
      table$.append(panel);
    }

    function showDecision() {
      table$.querySelectorAll('.bid-panel').forEach((x) => x.remove());
      const d = v?.decision;
      picking = false;
      if (!d || over) return renderHands();
      if (d.type === 'bid') {
        renderHands();
        showBidPanel(d.legal);
      } else {
        picking = true;
        renderHands(d.legal);
      }
    }

    async function send(type, data) {
      renderHands();
      try {
        await table.submit(type, data);
      } catch (e) {
        toast(e.message, 'error');
        showDecision();
      }
    }

    // ---------- анимации по стъпки ----------
    const handSnap = (p) => {
      const kids = seats[p].handEl.children;
      return snap(kids[kids.length >> 1] || seats[p].handEl);
    };

    // Раздаване на пакети (3+2 или 3) от тестето пред раздаващия.
    async function dealPackets(nv, counts, dealer) {
      const prev = new Set((v?.hand || []).map((c) => c.id));
      const newMine = nv.hand.filter((c) => !prev.has(c.id));
      const total = counts.reduce((a, b) => a + b, 0);
      v = nv;
      newMine.forEach((c) => pendingMine.add(c.id));
      for (let p = 0; p < 4; p++) if (p !== ME) pendingOpp[p] = total;
      renderHands();
      let left = Number(deckBox?.dataset.left || 32);
      let mi = 0;
      const flights = [];
      for (const cnt of counts) {
        for (let i = 1; i <= 4; i++) {
          const p = (dealer + i) % 4;
          for (let j = 0; j < cnt; j++) {
            let to, card = null;
            if (p === ME) {
              card = newMine[mi++];
              pendingMine.delete(card.id);
              const id = card.id;
              to = () => seats[ME].handEl.querySelector(`[data-id="${id}"]`);
            } else {
              const idx = nv.counts[p] - pendingOpp[p]--;
              to = () => seats[p].handEl.children[idx];
            }
            const top = deckBox?.lastElementChild || deckBox || seats[dealer].nameEl;
            flights.push(fly({
              card, from: { ...snap(top), a: 0 }, to, faceFrom: false, faceTo: p === ME,
              duration: 430 * speed, delay: j * 75 * speed, spin: (Math.random() - 0.5) * 50, arc: 0.06,
              onStart: () => {
                sound('deal');
                if (deckBox) {
                  deckBox.dataset.left = --left;
                  setDeckCount(deckBox, left);
                }
              },
            }));
          }
          await wait(90 + cnt * 60);
          if (gone()) return;
        }
      }
      await Promise.all(flights);
    }

    async function animDeal(e, nv) {
      slots.forEach((s) => s.replaceChildren());
      table$.querySelector('.deal-deck')?.remove();
      v = { ...nv, hand: [], counts: [0, 0, 0, 0] };
      renderHud();
      renderHands();
      deckBox = deckEl(32);
      deckBox.dataset.left = 32;
      deckBox.dataset.seat = V(e.pub.dealer);
      table$.append(deckBox);
      message(`Раздава ${p2name(e.pub.dealer)}`, 1000);
      sound('dice');
      await shuffleDeck(deckBox, 900 * speed);
      if (gone()) return;
      await dealPackets(nv, [3, 2], e.pub.dealer);
    }

    async function animDeal2(e, nv) {
      await wait(700);
      await dealPackets(nv, [3], nv.dealer);
      deckBox?.classList.add('out');
      const box = deckBox;
      deckBox = null;
      setTimeout(() => box?.remove(), 400);
    }

    async function animCard(e, nv) {
      const p = e.seat;
      const { card, notes } = e.pub;
      const from = p === ME
        ? (lastFrom && !motion.fast ? lastFrom : snap(seats[ME].handEl.querySelector(`[data-id="${card.id}"]`) || seats[ME].handEl))
        : handSnap(p);
      lastFrom = null;
      if (notes.length) bubble(p, notes.join(' · '), true, 2000);
      v = nv;
      const el = cardEl(card);
      slots[p].replaceChildren(el);
      sound('card');
      renderHands();
      renderHud();
      await fly({ card, from, to: () => el, faceFrom: p === ME, duration: 400 * speed, spin: p === ME ? 0 : (Math.random() - 0.5) * 40 }).then(() => land(el));
      if (!e.pub.trick) return;
      const w = e.pub.trick.winner;
      slots[w].classList.add('win');
      await wait(900);
      if (gone()) return;
      slots[w].classList.remove('win');
      sound('deal');
      await collectTrick(slots.map((s) => s.firstElementChild).filter(Boolean), slots[w].firstElementChild, seats[w].nameEl, { duration: 680 * speed });
      slots.forEach((s) => { s.replaceChildren(); s.classList.remove('win'); });
    }

    async function showSummary(pub) {
      const us = teamOf(pub.bidder) === US;
      const res = pub.res;
      const note = res.outcome === 'inside'
        ? (us ? 'Вътре сте! Точките отиват при противника.' : 'Противниците са вътре!')
        : res.outcome === 'hanging' ? 'Висящи точки – отиват при победителя в следващото раздаване.'
        : us ? 'Изкарахте играта!' : 'Противниците изкараха играта.';
      // колоните са „Ние“ / „Те“ спрямо моя отбор
      const row = (label, pair, cls = '') => h('tr', { class: cls }, h('td', null, label), h('td', null, pair[US]), h('td', null, pair[THEM]));
      const nt = pub.contract === 'NT';
      await modal({
        title: `Раздаване ${pub.dealNo} · ${CONTRACT_NAMES[pub.contract]}${pub.mult > 1 ? ' ×' + pub.mult : ''}`,
        body: h('div', null,
          h('p', { class: 'summary-note' }, note),
          h('table', { class: 'summary-table' },
            h('tr', null, h('th', null, ''), h('th', null, 'Ние'), h('th', null, 'Те')),
            row('Взети ръце', pub.tricksWon),
            row('Точки от карти', res.cardPts),
            row('Анонси', nt ? [0, 0] : pub.decl),
            row('Белот', nt ? [0, 0] : pub.belot),
            res.capot >= 0 && row('Валат', [res.capot === 0 ? 90 : 0, res.capot === 1 ? 90 : 0]),
            row('Общо', res.total),
            row('Точки за играта', res.gp.map((x) => '+' + x), 'total'),
            row('Резултат', pub.score, 'total'),
          ),
        ),
        actions: [{ label: 'Продължи', value: true, primary: true }],
      });
    }

    async function animate(e) {
      const nv = e.view;
      if (e.type === 'deal') return animDeal(e, nv);
      if (e.type === 'deal2') return animDeal2(e, nv);
      if (e.type === 'score') {
        v = nv;
        renderHud();
        if (!motion.fast && nv.phase !== 'over') await showSummary(e.pub);
        if (nv.phase === 'over') {
          endMatch(nv.score[US] > nv.score[THEM] ? 'win' : 'loss', `Краен резултат: Ние ${nv.score[US]} – Те ${nv.score[THEM]}`);
        }
        return;
      }
      // ход на друг играч – кратко „мислене“
      if (e.seat !== ME && !motion.fast) await wait(e.type === 'bid' ? 750 : 650);
      if (gone()) return;
      if (e.type === 'bid') {
        v = nv;
        bubble(e.seat, bidLabel(e.pub.bid), e.pub.bid !== 'pass');
        sound(e.pub.bid === 'pass' ? 'card' : 'notify');
        renderHud();
        if (e.pub.redeal) {
          await wait(900);
          message('Всички пасуваха – ново раздаване', 1600);
          await wait(1700);
        }
        return;
      }
      if (e.type === 'card') return animCard(e, nv);
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
      }
      busy = false;
      if (!gone()) {
        renderHud();
        showDecision();
      }
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
      picking = false;
      table$.querySelectorAll('.bid-panel').forEach((p) => p.remove());
      const sc = v?.score || [0, 0];
      const partner = names[(ME + 2) % 4];
      await ctx.report(outcome, online
        ? { summary: `Онлайн · с ${partner} · ${sc[US]}:${sc[THEM]} · до ${v?.target}`, online: true, score: [sc[US], sc[THEM]] }
        : { summary: `${sc[US]}:${sc[THEM]} · до ${v?.target}`, score: [sc[US], sc[THEM]] });
      if (destroyed) return;
      const c = await showResult({ outcome, text, again: online ? 'Реванш' : undefined });
      if (c === 'again') online ? online.rematch() : start();
      else if (c === 'exit') location.hash = online ? '#/online/belot' : '#/';
    }

    async function resign() {
      if (over) return;
      if (!(await confirmDialog('Предаване', online ? 'Отборът ви ще загуби играта. Продължаване?' : 'Да се отчете ли играта като загуба?', 'Предай се', true))) return;
      if (online) online.resign(); // събитието завършва играта при всички
      else endMatch('loss', 'Предадохте играта.');
    }

    async function newGame() {
      if (!(await confirmDialog('Нова игра', 'Текущата игра ще бъде прекратена без да се отчита. Продължаване?'))) return;
      start();
    }

    const offEvents = online ? online.onEvent((e) => {
      if (over || destroyed) return;
      if (e.kind === 'resign') {
        const lost = teamOf(e.seat) === US;
        endMatch(lost ? 'loss' : 'win', e.seat === ME ? 'Предадохте играта.' : `${names[e.seat]} предаде играта${lost ? ' от името на отбора ви' : ''}.`);
      } else if (e.kind === 'forfeit') {
        endMatch(teamOf(e.winner) === US ? 'win' : 'loss', 'Служебна победа.');
      }
    }) : () => {};
    // прекъснал играч е заменен с бот – съдията поема решенията му
    const offTakeover = online ? online.onTakeover((seat) => table.takeover(seat).catch(() => {})) : () => {};

    cleanup = () => {
      off();
      offEvents();
      offTakeover();
      table.close();
    };

    // ---------- свързване ----------
    try {
      const res = await table.connect();
      if (gone()) return;
      v = res.view;
      skipBelow = res.n;
      renderHud();
      renderHands();
      renderTrick();
      pump();
    } catch (e) {
      table$.append(h('div', { class: 'ct-msg' }, 'Няма връзка със съдията: ' + e.message));
    }
  }

  start();
  return {
    destroy() {
      destroyed = true;
      cleanup();
    },
  };
}
