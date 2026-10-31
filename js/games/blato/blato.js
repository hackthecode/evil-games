// Blato: the UI is driven by the referee server (js/games/blato/referee.js).
// The game receives steps { seat, type, pub, view } and only animates them; its own
// cards come from the view, and the others' are unknown.
import { h, sleep, modal, toast, motion } from '../../ui.js';
import { createTable } from '../../net/table.js';
import { setupScreen, showResult, confirmDialog, sound, isMuted, setMuted, loadPrefs } from '../common.js';
import { cardEl, layoutFan } from '../cards/cards.js';
import { fly, snap, land, collectTrick, flipHand, deckEl, setDeckCount, shuffleDeck } from '../cards/fly.js';
import { suitSvg, isRed, SUIT_NAMES } from '../cards/suits.js';
import { SUITS, next } from './engine.js';
import { enableCardTips, setCardInfo } from '../cards/cardtips.js';
import { cardLines, illegalReason, turnHint, playAdvice } from './help.js';
import { coachStrip, lastTrickButton, bigCardsButton } from '../cards/tablehelp.js';
import { txt } from '../../i18n.js';

const BOT_NAMES = [null, txt('Georgi'), txt('Petar')];
const POS = ['south', 'east', 'west']; // me, the next one (on the right), the last one (on the left)
const SLOT = ['s0', 's1', 's3'];
const DECK_SEAT = [0, 1, 3];

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
      return runMatch(createTable({ mode: r.mode, gameId: 'blato', key: r.key, seat: online.seat, seats: r.seats, opts: online.opts }), r.seats.map((s) => s.name), matchId, loadPrefs('blato', { help: 'on' }).help !== 'off');
    }
    const opts = await setupScreen(root, {
      gameId: 'blato',
      title: txt('New game of blato'),
      subtitle: txt('You against Georgi and Petar. The dealer takes 8 tricks, the next player 5, the third 3.'),
      groups: [
        { key: 'target', label: txt('Play to'), value: 10, options: [[5, '+5'], [10, '+10'], [15, '+15']] },
        { key: 'help', label: txt('Help for beginners'), value: 'on', options: [['on', txt('On')], ['off', txt('Off')]] },
      ],
    });
    if (destroyed) return;
    const seats = [ctx.user.displayName, ...BOT_NAMES.slice(1)].map((name, i) => ({ bot: i !== 0, name }));
    runMatch(createTable({ mode: 'local', gameId: 'blato', seat: 0, seats, opts }), seats.map((s) => s.name), matchId, opts.help !== 'off');
  };

  async function runMatch(table, names, myId, beginner = true) {
    if (!online) ctx.newMatch();
    const gone = () => destroyed || myId !== matchId;
    const ME = table.seat;
    const V = (p) => (p - ME + 3) % 3;
    let v = null;
    let over = false;
    const pendingMine = new Set();
    const pendingOpp = [0, 0, 0];

    // ---------- DOM ----------
    const table$ = h('div', { class: 'ct-table blato-table' });
    const seats = [0, 1, 2].map((p) => {
      const nameEl = h('span', { class: 'seat-name' }, names[p]);
      const handEl = p === ME ? h('div', { class: 'my-hand' }) : h('div', { class: 'opp-hand' });
      const el = h('div', { class: `seat ${POS[V(p)]}` }, p === ME ? [handEl, nameEl] : [nameEl, handEl]);
      table$.append(el);
      return { el, nameEl, handEl };
    });
    const center = h('div', { class: 'ct-center' });
    const slots = [0, 1, 2].map((p) => {
      const s = h('div', { class: `slot ${SLOT[V(p)]}` });
      center.append(s);
      return s;
    });
    const kittyEl = h('div', { class: 'blato-kitty' });
    const hud = h('div', { class: 'ct-hud' });
    const muteBtn = h('button', { class: 'btn', onclick: () => { setMuted(!isMuted()); muteBtn.textContent = isMuted() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊');
    // help for beginners, the last trick and large cards
    const coach = coachStrip(seats[ME].handEl);
    let played = []; // cards played in this deal (for the hint)
    let lastTrick = null;
    const lastBtn = lastTrickButton(() => lastTrick, (p) => (p === ME ? txt('You') : names[p]));
    const tools = h('div', { class: 'ct-tools' },
      lastBtn.el,
      bigCardsButton(table$, () => renderHands(picking && v?.decision?.type === 'card' ? { playable: v.decision.legal } : {})),
      h('button', { class: 'btn', onclick: resign }, txt('Resign')),
      !online && h('button', { class: 'btn', onclick: newGame }, txt('New')),
      muteBtn,
    );
    table$.append(center, kittyEl, hud, tools, coach.el);
    root.replaceChildren(table$);

    const order3 = [ME, next(ME), next(next(ME))];
    const sign = (x) => (x > 0 ? '+' : '') + x;

    // ---------- rendering from the view ----------
    function renderHud() {
      hud.replaceChildren(...[
        ...order3.map((p) => h('div', { class: 'row' }, h('span', null, p === ME ? txt('You') : names[p]), h('b', null, sign(v?.score[p] ?? 0)))),
        h('div', { class: 'goal' }, txt('play to +{0}', v?.target ?? '')),
        v?.trump && h('div', { class: 'contract-badge', html: txt('Trumps: {0} {1}', suitSvg(v.trump, 'suit' + (isRed(v.trump) ? ' red' : '')), SUIT_NAMES[v.trump]) }),
      ].filter(Boolean));
      seats.forEach((s, p) => {
        s.nameEl.textContent = names[p] + (v?.targets ? ` · ${v.tricks[p]}/${v.targets[p]}` : '');
        s.el.classList.toggle('turn', v?.turn === p);
      });
    }

    function renderKitty() {
      kittyEl.replaceChildren(...Array.from({ length: v?.kitty || 0 }, () => cardEl(null, { faceDown: true })));
    }

    // The hand: with many cards the overlap gets tighter so it fits on the screen.
    function renderHands({ playable = null, select = null } = {}) {
      if (!v?.hand) {
        seats.forEach((s) => s.handEl.replaceChildren());
        return;
      }
      for (let p = 0; p < 3; p++) {
        if (p === ME) continue;
        const n = v.counts[p];
        seats[p].handEl.replaceChildren(...Array.from({ length: n }, (_, i) => cardEl(null, { faceDown: true, cls: i >= n - pendingOpp[p] ? 'pending' : '' })));
      }
      const mine = seats[ME].handEl;
      const els = v.hand.map((c) => {
        const el = cardEl(c, { cls: pendingMine.has(c.id) ? 'pending' : '' });
        if (playable) el.classList.add(playable.includes(c.id) ? 'playable' : 'disabled');
        if (select) {
          el.classList.add('playable');
          if (select.has(c.id)) el.classList.add('picked');
        }
        return el;
      });
      flipHand(mine, () => {
        mine.replaceChildren(...els);
        squeeze(mine);
      });
      mine.classList.toggle('active', !!(playable || select));
      layoutFan(mine, { spreadDeg: 1.6, lift: 0.5 });
    }

    function squeeze(mine) {
      const cards = [...mine.children];
      if (cards.length < 2) return;
      const cw = cards[0].offsetWidth;
      const avail = table$.clientWidth - 24;
      const step = Math.min(cw * 0.62, (avail - cw) / (cards.length - 1));
      cards.forEach((c, i) => (c.style.marginLeft = i ? `${step - cw}px` : '0'));
    }

    function renderTrick() {
      slots.forEach((s) => s.replaceChildren());
      for (const t of v?.trick || []) slots[t.p].append(cardEl(t.card));
    }

    function bubble(p, html, gold = false, ms = 1700) {
      if (motion.fast) return;
      const vv = V(p);
      const r = seats[p].nameEl.getBoundingClientRect();
      const tr = table$.getBoundingClientRect();
      const b = h('div', { class: `bubble ${gold ? 'gold' : ''}`, html });
      table$.append(b);
      const bw = b.offsetWidth, bh = b.offsetHeight;
      let x = r.left - tr.left + r.width / 2 - bw / 2, y;
      if (vv === 0) y = tr.height - seats[ME].handEl.offsetHeight - bh - 40;
      else {
        x = vv === 1 ? r.left - tr.left - bw - 8 : r.right - tr.left + 8;
        y = r.top - tr.top;
      }
      b.style.left = Math.max(6, Math.min(x, tr.width - bw - 6)) + 'px';
      b.style.top = Math.max(6, y) + 'px';
      setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 300); }, ms);
    }

    function message(text, ms = 1600) {
      if (motion.fast) return;
      const m = h('div', { class: 'ct-msg' }, text);
      table$.append(m);
      setTimeout(() => m.remove(), ms);
    }

    // ---------- player decisions ----------
    let picking = false;
    let selection = null;
    let lastFrom = null;
    enableCardTips();
    const offInfo = setCardInfo((card) => cardLines(card, { trump: v?.trump, hand: v?.hand, trick: v?.trick || [], legal: v?.decision?.type === 'card' ? v.decision.legal : null }));
    seats[ME].handEl.addEventListener('click', (e) => {
      const off = e.target.closest('.card.disabled');
      if (off && picking && !selection && v?.trick?.length) {
        // explain why this card can't be played
        toast(illegalReason(null, v.trick), 'error', 4200);
        off.classList.remove('shake');
        void off.offsetWidth;
        off.classList.add('shake');
        return;
      }
      const el = e.target.closest('.card.playable');
      if (!el) return;
      if (selection) return selection.toggle(el.dataset.id);
      if (!picking) return;
      picking = false;
      lastFrom = snap(el);
      send('card', el.dataset.id);
    });

    // Choosing N cards (giving or discarding) with confirmation.
    function selectCards(count, title, type) {
      const picked = new Set();
      const btn = h('button', { class: 'btn btn-primary', disabled: true }, txt('Confirm'));
      const info = h('span', null, `${title} (0/${count})`);
      const panel = h('div', { class: 'bid-panel select-panel' }, h('h3', null, info), btn);
      const refresh = () => {
        info.textContent = `${title} (${picked.size}/${count})`;
        btn.disabled = picked.size !== count;
        renderHands({ select: picked });
      };
      selection = {
        toggle(id) {
          if (picked.has(id)) picked.delete(id);
          else if (picked.size < count) picked.add(id);
          refresh();
        },
      };
      btn.onclick = () => {
        selection = null;
        panel.remove();
        send(type, [...picked]);
      };
      table$.append(panel);
      refresh();
    }

    function chooseTrump() {
      const panel = h('div', { class: 'bid-panel' },
        h('h3', null, txt('Choose trumps')),
        h('div', { class: 'bid-grid' }, SUITS.map((s) => h('button', {
          class: `btn ${isRed(s) ? 'red' : ''}`,
          html: `${suitSvg(s)} ${SUIT_NAMES[s]}`,
          onclick: () => { panel.remove(); send('trump', s); },
        }))),
      );
      table$.append(panel);
    }

    function showDecision() {
      table$.querySelectorAll('.bid-panel').forEach((x) => x.remove());
      selection = null;
      picking = false;
      const d = v?.decision;
      coach.hide();
      if (!d || over) return renderHands();
      if (d.type === 'card') {
        picking = true;
        if (beginner) coach.show(turnHint(v, ME), () => playAdvice(v, played));
        return renderHands({ playable: d.legal });
      }
      renderHands();
      if (d.type === 'give') selectCards(d.count, txt('Give {0} {1} to {2}', d.count, d.count === 1 ? txt('card') : txt('cards'), names[d.to]), 'give');
      else if (d.type === 'discard') selectCards(4, txt('Discard 4 cards'), 'discard');
      else if (d.type === 'trump') chooseTrump();
    }

    async function send(type, data) {
      coach.hide();
      renderHands();
      try {
        await table.submit(type, data);
      } catch (e) {
        toast(e.message, 'error');
        showDecision();
      }
    }

    // ---------- step animations ----------
    const handSnap = (p) => {
      const kids = seats[p].handEl.children;
      return snap(kids[kids.length >> 1] || seats[p].handEl);
    };
    const toHand = (p, card) => (p === ME
      ? () => seats[ME].handEl.querySelector(`[data-id="${card.id}"]`)
      : handSnap(p));

    async function animDeal(e, nv) {
      played = [];
      lastTrick = null;
      lastBtn.update();
      slots.forEach((s) => s.replaceChildren());
      kittyEl.replaceChildren();
      v = { ...nv, kitty: 0 };
      nv.hand.forEach((c) => pendingMine.add(c.id));
      for (let p = 0; p < 3; p++) if (p !== ME) pendingOpp[p] = nv.counts[p];
      renderHud();
      renderHands();
      const deckBox = deckEl(52);
      deckBox.dataset.seat = DECK_SEAT[V(e.pub.dealer)];
      table$.querySelector('.deal-deck')?.remove();
      table$.append(deckBox);
      message(txt('{0} deals', e.pub.dealer === ME ? txt('you') : names[e.pub.dealer]), 1100);
      sound('dice');
      await shuffleDeck(deckBox, 900);
      if (gone()) return;
      // 4 cards to each player, 4 times; the swamp – 4 cards in the middle
      let left = 52;
      const mine = nv.hand.slice();
      let mi = 0;
      const flights = [];
      for (let round = 0; round < 4; round++) {
        for (let i = 1; i <= 3; i++) {
          const p = (e.pub.dealer + i) % 3;
          for (let j = 0; j < 4; j++) {
            let to, card = null;
            if (p === ME) {
              card = mine[mi++];
              pendingMine.delete(card.id);
              const id = card.id;
              to = () => seats[ME].handEl.querySelector(`[data-id="${id}"]`);
            } else {
              const idx = nv.counts[p] - pendingOpp[p]--;
              to = () => seats[p].handEl.children[idx];
            }
            const top = deckBox.lastElementChild || deckBox;
            flights.push(fly({
              card, from: { ...snap(top), a: 0 }, to, faceFrom: false, faceTo: p === ME,
              duration: 400, delay: j * 60, spin: (Math.random() - 0.5) * 40, arc: 0.05,
              onStart: () => { sound('deal'); setDeckCount(deckBox, --left); },
            }));
          }
          await sleep(300);
          if (gone()) return;
        }
      }
      v = nv;
      renderKitty();
      setDeckCount(deckBox, 0);
      await Promise.all(flights);
      deckBox.remove();
    }

    async function animGive(e, nv) {
      const { from, to, count } = e.pub;
      message(txt('{0} {1} {2} to {3}', from === ME ? txt('You give') : txt('{0} gives', names[from]), count, count === 1 ? txt('card') : txt('cards'), to === ME ? txt('you') : names[to]), 1800);
      if (e.seat !== ME && !motion.fast) await sleep(900);
      const involved = from === ME || to === ME;
      const ex = involved ? nv.exchanged[nv.exchanged.length - 1] : null;
      // what went from "from" to "to" and what came back (only the participants see it)
      const forward = involved ? (from === ME ? ex.gave : ex.got) : Array(count).fill(null);
      const backward = involved ? (from === ME ? ex.got : ex.gave) : Array(count).fill(null);
      const mySnaps = new Map();
      if (from === ME) for (const c of forward) mySnaps.set(c.id, snap(seats[ME].handEl.querySelector(`[data-id="${c.id}"]`) || seats[ME].handEl));
      const fromSnap = from === ME ? null : handSnap(from);
      v = nv;
      renderHands();
      if (!motion.fast) {
        await Promise.all(forward.map((c, j) => fly({
          card: c, from: from === ME ? mySnaps.get(c.id) : fromSnap, to: toHand(to, c || {}),
          faceFrom: from === ME, faceTo: to === ME, duration: 520, delay: j * 90, arc: 0.12, onStart: () => sound('deal'),
        })));
        await Promise.all(backward.map((c, j) => fly({
          card: c, from: handSnap(to), to: toHand(from, c || {}),
          faceFrom: to === ME, faceTo: from === ME, duration: 520, delay: j * 90, arc: 0.12, onStart: () => sound('deal'),
        })));
      }
      if (involved) bubble(to, txt('Returned: {0}', backward.map((c) => c.r + suitSvg(c.s, 'suit' + (isRed(c.s) ? ' red' : ''))).join(' ')), true, 2600);
    }

    async function animTake(e, nv) {
      const dealer = e.pub.dealer;
      message(txt('{0} the swamp', dealer === ME ? txt('You take') : txt('{0} takes', names[dealer])), 1300);
      const from = snap(kittyEl);
      const prev = new Set((v?.hand || []).map((c) => c.id));
      const got = dealer === ME ? nv.hand.filter((c) => !prev.has(c.id)) : Array(4).fill(null);
      if (dealer === ME) got.forEach((c) => pendingMine.add(c.id));
      else pendingOpp[dealer] = 4;
      v = nv;
      renderKitty();
      renderHands();
      renderHud();
      await Promise.all(got.map((c, j) => {
        let to;
        if (dealer === ME) {
          pendingMine.delete(c.id);
          to = () => seats[ME].handEl.querySelector(`[data-id="${c.id}"]`);
        } else {
          const idx = nv.counts[dealer] - pendingOpp[dealer]--;
          to = () => seats[dealer].handEl.children[idx];
        }
        return fly({ card: c, from, to, faceFrom: false, faceTo: dealer === ME, duration: 460, delay: j * 80 });
      }));
    }

    async function animDiscard(e, nv) {
      const from = handSnap(e.seat);
      v = nv;
      renderHands();
      if (!motion.fast) {
        await Promise.all([0, 1, 2, 3].map((j) => fly({ card: null, from, to: snap(kittyEl), faceFrom: false, faceTo: false, duration: 420, delay: j * 70, toOpacity: 0 })));
      }
    }

    async function animCard(e, nv) {
      const p = e.seat;
      const card = e.pub.card;
      played.push(card.id);
      const prevTrick = (v?.trick || []).slice();
      const from = p === ME
        ? (lastFrom && !motion.fast ? lastFrom : snap(seats[ME].handEl.querySelector(`[data-id="${card.id}"]`) || seats[ME].handEl))
        : handSnap(p);
      lastFrom = null;
      v = nv;
      const el = cardEl(card);
      slots[p].replaceChildren(el);
      sound('card');
      renderHands();
      renderHud();
      await fly({ card, from, to: () => el, faceFrom: p === ME, duration: 380, spin: p === ME ? 0 : (Math.random() - 0.5) * 40 }).then(() => land(el));
      if (!e.pub.trick) return;
      const w = e.pub.trick.winner;
      lastTrick = { cards: [...prevTrick.filter((t) => t.p !== p), { p, card }], winner: w }; // the view may already contain my card
      lastBtn.update();
      slots[w].classList.add('win');
      await sleep(700);
      if (gone()) return;
      slots[w].classList.remove('win');
      sound('deal');
      await collectTrick(slots.map((s) => s.firstElementChild).filter(Boolean), slots[w].firstElementChild, seats[w].nameEl, { duration: 560 });
      slots.forEach((s) => { s.replaceChildren(); s.classList.remove('win'); });
    }

    async function showSummary(pub) {
      const row = (p) => h('tr', null,
        h('td', null, p === ME ? txt('You') : names[p]),
        h('td', null, pub.tricks[p] - pub.diff[p]),
        h('td', null, pub.tricks[p]),
        h('td', { class: pub.diff[p] > 0 ? 'pos' : pub.diff[p] < 0 ? 'neg' : '' }, sign(pub.diff[p])),
        h('td', null, sign(pub.score[p])));
      await modal({
        title: txt('Deal {0}', pub.dealNo),
        body: h('div', null,
          h('table', { class: 'summary-table' },
            h('tr', null, h('th', null, ''), h('th', null, txt('Goal')), h('th', null, txt('Taken')), h('th', null, '±'), h('th', null, txt('Overall'))),
            order3.map(row)),
          pub.diff.some((x) => x !== 0) && h('p', { class: 'muted small', style: { marginTop: '10px' } },
            txt('In the next deal the players who took more exchange cards with those who fell short.')),
        ),
        actions: [{ label: txt('Continue'), value: true, primary: true }],
      });
    }

    async function animate(e) {
      const nv = e.view;
      switch (e.type) {
        case 'deal': return animDeal(e, nv);
        case 'give': return animGive(e, nv);
        case 'take': return animTake(e, nv);
        case 'trump':
          if (e.seat !== ME && !motion.fast) await sleep(900);
          v = nv;
          bubble(e.seat, txt('Trumps {0} {1}', suitSvg(e.pub.trump, 'suit' + (isRed(e.pub.trump) ? ' red' : '')), SUIT_NAMES[e.pub.trump]), true);
          sound('notify');
          renderHud();
          renderHands();
          return;
        case 'discard':
          if (e.seat !== ME && !motion.fast) await sleep(900);
          return animDiscard(e, nv);
        case 'card':
          if (e.seat !== ME && !motion.fast) await sleep(600);
          return animCard(e, nv);
        case 'score': {
          v = nv;
          renderHud();
          if (!motion.fast && nv.phase !== 'over') await showSummary(e.pub);
          if (nv.phase === 'over') {
            const best = Math.max(...nv.score);
            const w = nv.score.indexOf(best);
            endMatch(w === ME ? 'win' : 'loss', w === ME ? txt('You reached {0} first!', sign(best)) : txt('{0} reached {1} first.', names[w], sign(best)));
          }
          return;
        }
      }
    }

    // Steps are animated one by one; after the last one – the player's decision.
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

    // ---------- end ----------
    async function endMatch(outcome, text) {
      if (over) return;
      over = true;
      matchId++;
      online?.finish();
      picking = false;
      table$.querySelectorAll('.bid-panel').forEach((p) => p.remove());
      const sc = v?.score || [0, 0, 0];
      const sum = `${sign(sc[ME])} · ${[next(ME), next(next(ME))].map((p) => `${names[p]} ${sign(sc[p])}`).join(', ')}`;
      await ctx.report(outcome, online ? { summary: txt('Online · {0}', sum), online: true } : { summary: txt('{0} · to +{1}', sum, v?.target) });
      if (destroyed) return;
      const c = await showResult({ outcome, text, again: online ? txt('Rematch') : undefined });
      if (c === 'again') online ? online.rematch() : start();
      else if (c === 'exit') location.hash = online ? '#/online/blato' : '#/';
    }

    async function resign() {
      if (over) return;
      if (!(await confirmDialog(txt('Resign'), txt('The game will count as a loss. Continue?'), txt('Resign'), true))) return;
      if (online) online.resign();
      else endMatch('loss', txt('You resigned the game.'));
    }

    async function newGame() {
      if (!(await confirmDialog(txt('New game'), txt('The current game will be stopped without being counted. Continue?')))) return;
      start();
    }

    const offEvents = online ? online.onEvent((e) => {
      if (over || destroyed) return;
      if (e.kind === 'resign') endMatch(e.seat === ME ? 'loss' : 'win', e.seat === ME ? txt('You resigned the game.') : txt('{0} resigned.', names[e.seat]));
      else if (e.kind === 'forfeit') endMatch(e.winner === ME ? 'win' : 'loss', txt('Forfeit win.'));
    }) : () => {};
    const offTakeover = online ? online.onTakeover((seat) => table.takeover(seat).catch(() => {})) : () => {};

    cleanup = () => {
      offInfo();
      off();
      offEvents();
      offTakeover();
      table.close();
    };

    // ---------- connecting ----------
    try {
      const res = await table.connect();
      if (gone()) return;
      v = res.view;
      skipBelow = res.n;
      renderHud();
      renderHands();
      renderKitty();
      renderTrick();
      pump();
    } catch (e) {
      table$.append(h('div', { class: 'ct-msg' }, txt('No connection to the referee: ') + e.message));
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
