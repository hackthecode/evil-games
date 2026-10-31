// Belot: the UI is driven by the referee server (js/games/belot/referee.js).
// The game receives steps { seat, type, pub, view } and only animates them; its own
// cards come from the view, and the others' are unknown.
import { h, sleep, modal, toast, motion } from '../../ui.js';
import { createTable } from '../../net/table.js';
import { setupScreen, showResult, confirmDialog, sound, isMuted, setMuted, loadPrefs } from '../common.js';
import { cardEl, layoutFan } from '../cards/cards.js';
import { fly, snap, land, collectTrick, flipHand, deckEl, setDeckCount, shuffleDeck } from '../cards/fly.js';
import { suitSvg, isRed } from '../cards/suits.js';
import { CONTRACT_NAMES, teamOf, cardPoints, RANKS } from './engine.js';
import { lastTrickButton, bigCardsButton } from '../cards/tablehelp.js';
import { enableCardTips, setCardInfo } from '../cards/cardtips.js';
import { cardLines, illegalReason, turnHint, bidMeaning, bidAdvice, playAdvice, trickNote } from './help.js';
import { txt } from '../../i18n.js';

const SEATS = ['south', 'east', 'north', 'west'];
const BOT_NAMES = [null, txt('Georgi'), txt('Maria'), txt('Petar')];
const SPEED = { slow: 1.4, normal: 1, fast: 0.6 };

function contractLabel(c, withIcon = true) {
  if (c.length === 1 && withIcon) {
    return `${suitSvg(c, isRed(c) ? 'suit red' : 'suit')} ${CONTRACT_NAMES[c]}`;
  }
  return CONTRACT_NAMES[c];
}

function bidLabel(bid) {
  if (bid === 'pass') return txt('Pass');
  if (bid === 'double') return txt('Double!');
  if (bid === 'redouble') return txt('Redouble!');
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
      return runMatch(createTable({ mode: r.mode, gameId: 'belot', key: r.key, seat: online.seat, seats: r.seats, opts: online.opts }), r.seats.map((s) => s.name), 1, matchId, loadPrefs('belot', { help: 'on' }).help !== 'off');
    }
    const opts = await setupScreen(root, {
      gameId: 'belot',
      title: txt('New game of belot'),
      subtitle: txt('You and Maria against Georgi and Petar.'),
      groups: [
        { key: 'target', label: txt('Play to'), value: 151, options: [[51, '51'], [101, '101'], [151, '151']] },
        { key: 'speed', label: txt('Computer speed'), value: 'normal', options: [['slow', txt('Slow')], ['normal', txt('Normal')], ['fast', txt('Fast')]] },
        { key: 'help', label: txt('Help for beginners'), value: 'on', options: [['on', txt('On')], ['off', txt('Off')]] },
      ],
    });
    if (destroyed) return;
    const seats = [ctx.user.displayName, ...BOT_NAMES.slice(1)].map((name, i) => ({ bot: i !== 0, name }));
    runMatch(createTable({ mode: 'local', gameId: 'belot', seat: 0, seats, opts }), seats.map((s) => s.name), SPEED[opts.speed] || 1, matchId, opts.help !== 'off');
  };

  async function runMatch(table, names, speed, myId, beginner = true) {
    if (!online) ctx.newMatch();
    const gone = () => destroyed || myId !== matchId;
    const wait = (ms) => sleep(ms * speed);
    const ME = table.seat;
    const V = (p) => (p - ME + 4) % 4; // position at the table: 0 = bottom (me), 1 = right, 2 = top, 3 = left
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
    // the last finished trick and the card points taken in this deal (per team, US/THEM)
    let lastTrick = null;
    let dealPts = [0, 0];
    const lastBtn = lastTrickButton(() => lastTrick, (p) => (p === ME ? txt('You') : names[p]));
    const tools = h('div', { class: 'ct-tools' },
      lastBtn.el,
      bigCardsButton(table$, () => renderHands(v?.decision?.type === 'card' && picking ? v.decision.legal : null)),
      h('button', { class: 'btn', onclick: resign }, txt('Resign')),
      !online && h('button', { class: 'btn', onclick: newGame }, txt('New')),
      muteBtn,
    );
    // help for beginners: what to do now, plus a hint button
    const coach = h('div', { class: 'ct-coach', hidden: true });
    table$.append(center, hud, tools, coach);
    root.replaceChildren(table$);
    enableCardTips();
    let played = []; // cards played in this deal (for the computer's suggestion)
    const offInfo = setCardInfo((card) => cardLines(card, {
      contract: v?.contract && v.phase !== 'bid' ? v.contract : null, hand: v?.hand, trick: v?.trick || [], me: ME,
      legal: v?.decision?.type === 'card' ? v.decision.legal : null,
    }));

    const p2name = (p) => (p === ME ? txt('you') : names[p]);

    // ---------- rendering from the view ----------
    function renderHud() {
      const cur = v?.bidding?.current;
      const playing = v?.contract && v.phase !== 'bid';
      hud.replaceChildren(...[
        h('div', { class: 'row' }, h('span', null, txt('Us')), h('b', null, v?.score[US] ?? 0)),
        h('div', { class: 'row' }, h('span', null, txt('Them')), h('b', null, v?.score[THEM] ?? 0)),
        h('div', { class: 'goal' }, txt('to {0}{1}', v?.target ?? '', v?.hanging ? txt(' · hanging {0}', v.hanging) : '')),
        playing && cur && h('div', { class: 'contract-badge', html: `${contractLabel(cur.contract)}${cur.mult > 1 ? ` ×${cur.mult}` : ''}` }),
        playing && cur && beginner && h('div', { class: 'goal contract-help' }, cur.contract === 'AT' ? txt('All suits are trumps') : cur.contract === 'NT' ? txt('No trumps') : txt('★ Trumps beat the other suits')),
        playing && cur && !beginner && h('div', { class: 'goal' }, txt('bid {0} · tricks {1}:{2}', p2name(cur.player), v.tricksWon[US], v.tricksWon[THEM])),
        playing && cur && pointsBox(cur),
      ].filter(Boolean));
      seats.forEach((s, p) => s.el.classList.toggle('turn', v?.turn === p));
    }

    // Card points taken so far and what the bidding team still needs not to be "inside".
    function pointsBox(cur) {
      const all = ['C', 'D', 'H', 'S'].reduce((a, s) => a + RANKS.reduce((b, r) => b + cardPoints({ r, s }, cur.contract), 0), 0) + 10;
      const left = Math.max(0, all - dealPts[0] - dealPts[1]);
      const bidUs = teamOf(cur.player) === US;
      const mine = bidUs ? dealPts[0] : dealPts[1];
      const need = Math.max(0, Math.floor(all / 2) + 1 - mine);
      const pct = (x) => `${Math.round((x / all) * 100)}%`;
      return h('div', { class: 'deal-points', title: `${txt('Card points in this deal (without declarations)')} · ${txt('{0} points still in play', left)}` },
        h('span', null, txt('Points: us {0} · them {1}', dealPts[0], dealPts[1])),
        h('div', { class: 'bar' }, h('i', { style: { width: pct(dealPts[0]) } }), h('i', { class: 'them', style: { width: pct(dealPts[1]) } })),
        h('div', { class: `need ${need ? '' : 'ok'}` }, need
          ? (bidUs ? txt('You bid: {0} more points and you are safe', need) : txt('They bid: they need {0} more points', need))
          : (bidUs ? txt('✔ You have more than half – not "inside"') : txt('They have more than half of the points'))));
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

    // ---------- player decisions ----------
    let picking = false;
    let lastFrom = null;
    seats[ME].handEl.addEventListener('click', (e) => {
      const off = e.target.closest('.card.disabled');
      if (off && picking) {
        // explain why this card can't be played
        const card = v.hand.find((c) => c.id === off.dataset.id);
        if (card) toast(illegalReason(card, v.hand, v.trick, v.contract, ME), 'error', 4200);
        off.classList.remove('shake');
        void off.offsetWidth;
        off.classList.add('shake');
        return;
      }
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
          title: bidMeaning(bid),
          onmouseenter: () => { if (desc) desc.textContent = bidMeaning(bid); },
          onfocus: () => { if (desc) desc.textContent = bidMeaning(bid); },
          onclick: () => { panel.remove(); send('bid', bid); },
        });
      const desc = beginner ? h('p', { class: 'bid-desc' }, txt('Choose which suit will be trumps, or pass. Point at a button to see what it means.')) : null;
      const panel = h('div', { class: 'bid-panel' },
        h('h3', null, cur ? txt('Bid: {0}{1} ({2})', CONTRACT_NAMES[cur.contract], cur.mult > 1 ? ' ×' + cur.mult : '', p2name(cur.player)) : txt('Your bid')),
        h('div', { class: 'bid-grid' },
          ['C', 'D', 'H', 'S'].map((c) => btn(c)),
          btn('NT', 'wide'), btn('AT', 'wide'),
          legal.includes('redouble') ? btn('redouble', 'wide') : btn('double', 'wide'),
          btn('pass', 'btn-primary wide'),
        ),
        desc,
        beginner && h('p', { class: 'bid-advice', html: bidAdvice(v.hand, v.bidding, ME) }),
      );
      table$.append(panel);
    }

    function showCoach(d) {
      // during the bidding the panel itself explains everything
      coach.hidden = !beginner || !d || over || d.type === 'bid';
      if (coach.hidden) return;
      const hintBtn = h('button', { class: 'btn btn-sm', onclick: () => {
        const { card, text } = playAdvice(v.hand, v.trick, v.contract, ME, played, teamOf(v.bidding.current?.player ?? ME));
        seats[ME].handEl.querySelectorAll('.suggest').forEach((x) => x.classList.remove('suggest'));
        seats[ME].handEl.querySelector(`[data-id="${card.id}"]`)?.classList.add('suggest');
        why.textContent = '💡 ' + text;
        why.hidden = false;
      } }, txt('💡 Hint'));
      const why = h('small', { class: 'coach-why', hidden: true });
      coach.replaceChildren(h('div', { class: 'coach-text' }, h('span', { html: turnHint(v.hand, v.trick, v.contract, ME, played, teamOf(v.bidding.current?.player ?? ME)) }), why), hintBtn);
    }

    function showDecision() {
      table$.querySelectorAll('.bid-panel').forEach((x) => x.remove());
      const d = v?.decision;
      picking = false;
      showCoach(d && !over ? d : null);
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
      coach.hidden = true;
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

    // Dealing packets (3+2 or 3) from the deck in front of the dealer.
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
      played = [];
      dealPts = [0, 0];
      lastTrick = null;
      lastBtn.update();
      slots.forEach((s) => s.replaceChildren());
      table$.querySelector('.deal-deck')?.remove();
      v = { ...nv, hand: [], counts: [0, 0, 0, 0] };
      renderHud();
      renderHands();
      deckBox = deckEl(32);
      deckBox.dataset.left = 32;
      deckBox.dataset.seat = V(e.pub.dealer);
      table$.append(deckBox);
      message(txt('{0} deals', p2name(e.pub.dealer)), 1000);
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
      played.push(card.id);
      const prevTrick = (v?.trick || []).slice();
      const ledSuit = (v?.trick?.length ? v.trick[0].card.s : card.s);
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
      // remember the trick and count its points (the last trick brings 10 more)
      const cards = [...prevTrick.filter((t) => t.p !== p), { p, card }]; // the view may already contain my card
      const contract = v.bidding?.current?.contract || v.contract;
      const gained = cards.reduce((a, t) => a + cardPoints(t.card, contract), 0) + (nv.hand?.length === 0 ? 10 : 0);
      dealPts[teamOf(w) === US ? 0 : 1] += gained;
      lastTrick = { cards, winner: w };
      lastBtn.update();
      renderHud();
      slots[w].classList.add('win');
      const wCard = slots[w].firstElementChild?.dataset.id;
      if (beginner && wCard) message(trickNote(p2name(w) === txt('you') ? txt('You') : names[w], { id: wCard, r: wCard.slice(0, -1), s: wCard.slice(-1) }, v.contract, ledSuit), 1900);
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
        ? (us ? txt('You\'re inside! The points go to the opponents.') : txt('The opponents are inside!'))
        : res.outcome === 'hanging' ? txt('Hanging points – they go to the winner of the next deal.')
        : us ? txt('You won the game!') : txt('The opponents won the game.');
      // the columns are "Us" / "Them" relative to my team
      const row = (label, pair, cls = '') => h('tr', { class: cls }, h('td', null, label), h('td', null, pair[US]), h('td', null, pair[THEM]));
      const nt = pub.contract === 'NT';
      await modal({
        title: txt('Deal {0} · {1}{2}', pub.dealNo, CONTRACT_NAMES[pub.contract], pub.mult > 1 ? ' ×' + pub.mult : ''),
        body: h('div', null,
          h('p', { class: 'summary-note' }, note),
          h('table', { class: 'summary-table' },
            h('tr', null, h('th', null, ''), h('th', null, txt('Us')), h('th', null, txt('Them'))),
            row(txt('Tricks taken'), pub.tricksWon),
            row(txt('Card points'), res.cardPts),
            row(txt('Declarations'), nt ? [0, 0] : pub.decl),
            row(txt('Belot'), nt ? [0, 0] : pub.belot),
            res.capot >= 0 && row(txt('Capot'), [res.capot === 0 ? 90 : 0, res.capot === 1 ? 90 : 0]),
            row(txt('Overall'), res.total),
            row(txt('Game points'), res.gp.map((x) => '+' + x), 'total'),
            row(txt('Result'), pub.score, 'total'),
          ),
        ),
        actions: [{ label: txt('Continue'), value: true, primary: true }],
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
          endMatch(nv.score[US] > nv.score[THEM] ? 'win' : 'loss', txt('Final result: Us {0} – Them {1}', nv.score[US], nv.score[THEM]));
        }
        return;
      }
      // another player's turn – a short "think"
      if (e.seat !== ME && !motion.fast) await wait(e.type === 'bid' ? 750 : 650);
      if (gone()) return;
      if (e.type === 'bid') {
        v = nv;
        bubble(e.seat, bidLabel(e.pub.bid), e.pub.bid !== 'pass');
        sound(e.pub.bid === 'pass' ? 'card' : 'notify');
        renderHud();
        if (e.pub.redeal) {
          await wait(900);
          message(txt('Everyone passed – a new deal'), 1600);
          await wait(1700);
        }
        return;
      }
      if (e.type === 'card') return animCard(e, nv);
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
      const sc = v?.score || [0, 0];
      const partner = names[(ME + 2) % 4];
      await ctx.report(outcome, online
        ? { summary: txt('Online · with {0} · {1}:{2} · to {3}', partner, sc[US], sc[THEM], v?.target), online: true, score: [sc[US], sc[THEM]] }
        : { summary: txt('{0}:{1} · to {2}', sc[US], sc[THEM], v?.target), score: [sc[US], sc[THEM]] });
      if (destroyed) return;
      const c = await showResult({ outcome, text, again: online ? txt('Rematch') : undefined });
      if (c === 'again') online ? online.rematch() : start();
      else if (c === 'exit') location.hash = online ? '#/online/belot' : '#/';
    }

    async function resign() {
      if (over) return;
      if (!(await confirmDialog(txt('Resign'), online ? txt('Your team will lose the game. Continue?') : txt('Count the game as a loss?'), txt('Resign'), true))) return;
      if (online) online.resign(); // the event ends the game for everyone
      else endMatch('loss', txt('You resigned the game.'));
    }

    async function newGame() {
      if (!(await confirmDialog(txt('New game'), txt('The current game will be stopped without being counted. Continue?')))) return;
      start();
    }

    const offEvents = online ? online.onEvent((e) => {
      if (over || destroyed) return;
      if (e.kind === 'resign') {
        const lost = teamOf(e.seat) === US;
        endMatch(lost ? 'loss' : 'win', e.seat === ME ? txt('You resigned the game.') : txt('{0} resigned the game{1}.', names[e.seat], lost ? txt(' on behalf of your team') : ''));
      } else if (e.kind === 'forfeit') {
        endMatch(teamOf(e.winner) === US ? 'win' : 'loss', txt('Forfeit win.'));
      }
    }) : () => {};
    // a disconnected player is replaced by a bot – the referee takes over their decisions
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
