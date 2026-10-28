import { h, toast, fmtClock } from '../../ui.js';
import { icon } from '../../icons.js';
import { setupScreen, showResult, confirmDialog, sound, muteButton } from '../common.js';
import { makeDeck, shuffle, cardEl } from '../cards/cards.js';
import { offlineNet } from '../../net/room.js';
import {
  RANKS, newGame, applyMove, drawCards, canMove, picked, smartTarget, hints, isWon,
  canAutoFinish, autoStep, foundCount, top,
} from './engine.js';
import { txt } from '../../i18n.js';

const DRAW_NAMES = { 1: txt('1 card'), 3: txt('3 cards') };

export async function mount(root, ctx) {
  const online = ctx.online || null;
  let destroyed = false;
  let game = null;

  const start = async () => {
    game?.stop();
    root.replaceChildren();
    if (online) return (game = play(online, Number(online.opts.draw) || 1));
    const opts = await setupScreen(root, {
      gameId: 'solitaire',
      title: txt('Klondike Solitaire'),
      subtitle: txt('Sort all the cards by suit from ace to king.'),
      groups: [{ key: 'draw', label: txt('Drawing from the stock'), value: 1, options: Object.entries(DRAW_NAMES) }],
    });
    if (!destroyed) game = play(offlineNet([ctx.user.displayName]), Number(opts.draw));
  };

  function play(net, draw) {
    ctx.newMatch();
    const saveKey = online ? `eg.sol.${ctx.gameId}.${net.no}.${location.hash}` : 'eg.sol.offline';
    let st = restore() || newGame(shuffle(makeDeck(RANKS), net.rng('deal')), draw);
    let history = [];
    let over = false;
    let startedAt = st.moves ? Date.now() - (st.elapsed || 0) : 0;
    const rivals = new Map(); // online: seat → { n, out }
    let lastSent = -1;

    // ---------- DOM ----------
    const board = h('div', { class: 'sol-board' });
    const movesEl = h('span', null, txt('0 moves'));
    const timeEl = h('span', null, '00:00');
    const rivalsEl = h('div', { class: 'sol-rivals' });
    const undoBtn = h('button', { class: 'btn', onclick: undo }, icon('undo', 16), txt('Undo'));
    const hintBtn = h('button', { class: 'btn', onclick: showHint }, '💡', txt('Hint'));
    const autoBtn = h('button', { class: 'btn btn-primary', onclick: autoFinish, style: { display: 'none' } }, icon('bolt', 16), txt('Finish'));
    const endBtn = online
      ? h('button', { class: 'btn btn-danger', onclick: giveUp }, icon('flag', 16), txt('Give up'))
      : h('button', { class: 'btn', onclick: newDeal }, icon('refresh', 16), txt('New game'));
    root.replaceChildren(h('div', { class: 'sol-layout' },
      board,
      online && rivalsEl,
      h('div', { class: 'sol-bar' },
        h('div', { class: 'sol-stats' }, icon('clock', 16), timeEl, h('span', { class: 'sep' }, '·'), movesEl,
          h('span', { class: 'sep' }, '·'), h('span', null, DRAW_NAMES[draw])),
        h('div', { class: 'g-toolbar' }, undoBtn, hintBtn, autoBtn, endBtn, muteButton()),
      ),
    ));

    // Empty places: stock, foundations, columns.
    const slots = {
      stock: h('div', { class: 'sol-slot stock' }, h('span', null, '↻')),
      found: [0, 1, 2, 3].map(() => h('div', { class: 'sol-slot found' }, h('span', null, 'A'))),
      tab: [0, 1, 2, 3, 4, 5, 6].map(() => h('div', { class: 'sol-slot tab' }, h('span', null, 'K'))),
    };
    board.append(slots.stock, ...slots.found, ...slots.tab);

    // Every card is a permanent element with a face and a back – moving and flipping are smooth.
    const els = new Map();
    const where = new Map(); // id → place { t, i, k }
    for (const c of allCards()) {
      const inner = h('div', { class: 'sc-in' }, cardEl(c), cardEl(null, { faceDown: true }));
      const el = h('div', { class: 'sc', 'data-id': c.id }, inner);
      els.set(c.id, el);
      board.append(el);
    }

    function allCards() {
      return [...st.stock, ...st.waste, ...st.found.flat(), ...st.tab.flat()];
    }

    // ---------- geometry ----------
    let G = {};
    function measure() {
      const W = board.clientWidth, H = board.clientHeight;
      const gap = Math.max(4, Math.min(14, W * 0.014));
      const pad = Math.max(6, Math.min(18, W * 0.02));
      const cw = Math.max(30, Math.min((W - 2 * pad - 6 * gap) / 7, 116, (H - 2 * pad - 2 * gap) / 3.6));
      const ch = cw * 1.4;
      const left = (W - (7 * cw + 6 * gap)) / 2;
      G = { W, H, gap, pad, cw, ch, left, tabY: pad + ch + gap * 1.8 };
      board.style.setProperty('--cw', cw + 'px');
    }
    const colX = (i) => G.left + i * (G.cw + G.gap);

    function layout() {
      const pos = new Map();
      const put = (c, x, y, z, loc) => {
        pos.set(c.id, { x, y, z, up: c.up });
        where.set(c.id, loc);
      };
      st.stock.forEach((c, k) => put(c, colX(0) - Math.min(k, 20) * 0.15, G.pad - Math.min(k, 20) * 0.15, 1 + k, { t: 'stock' }));
      const fan = st.waste.length;
      st.waste.forEach((c, k) => {
        const j = Math.max(0, k - (fan - Math.min(draw, 3))); // the last 1–3 cards are visible
        const x = colX(1) + (draw > 1 ? j * G.cw * 0.24 : 0);
        put(c, x, G.pad, 100 + k, { t: 'waste' });
      });
      st.found.forEach((f, i) => f.forEach((c, k) => put(c, colX(3 + i), G.pad, 200 + k, { t: 'found', i })));
      st.tab.forEach((p, i) => {
        // the spacing shrinks if the column is too long for the screen
        const down = p.filter((c) => !c.up).length;
        const upN = p.length - down;
        const avail = G.H - G.tabY - G.ch - G.pad;
        const dOff = G.cw * 0.16, uOff = G.cw * 0.4;
        const need = down * dOff + Math.max(0, upN - 1) * uOff;
        const f = need > avail && need > 0 ? avail / need : 1;
        let y = G.tabY;
        p.forEach((c, k) => {
          put(c, colX(i), y, 300 + i * 30 + k, { t: 'tab', i, k });
          y += (c.up ? uOff : dOff) * f;
        });
      });
      return pos;
    }

    function placeSlots() {
      const at = (el, x, y) => (el.style.transform = `translate(${x}px, ${y}px)`);
      at(slots.stock, colX(0), G.pad);
      slots.stock.classList.toggle('empty', !st.stock.length);
      slots.stock.classList.toggle('done', !st.stock.length && !st.waste.length);
      slots.found.forEach((el, i) => at(el, colX(3 + i), G.pad));
      slots.tab.forEach((el, i) => at(el, colX(i), G.tabY));
    }

    let prev = new Map();
    function render(animate = true) {
      measure();
      placeSlots();
      const pos = layout();
      for (const [id, p] of pos) {
        const el = els.get(id);
        const old = prev.get(id);
        el.classList.toggle('down', !p.up);
        el.classList.toggle('no-anim', !animate);
        el.style.transform = `translate(${p.x}px, ${p.y}px)`;
        // the moved card flies above the others and then takes its place
        if (animate && old && (Math.abs(old.x - p.x) > 1 || Math.abs(old.y - p.y) > 1)) {
          el.style.zIndex = 1000 + p.z;
          clearTimeout(el._z);
          el._z = setTimeout(() => (el.style.zIndex = p.z), 320);
        } else el.style.zIndex = p.z;
      }
      prev = pos;
      if (!animate) requestAnimationFrame(() => els.forEach((el) => el.classList.remove('no-anim')));
      movesEl.textContent = `${st.moves} ${st.moves === 1 ? txt('move') : txt('moves')}`;
      undoBtn.disabled = over || !history.length;
      hintBtn.disabled = over;
      autoBtn.style.display = over || !canAutoFinish(st) ? 'none' : '';
      endBtn.disabled = over && !!online;
    }

    // ---------- moves ----------
    function commit(next, snd = 'card') {
      history.push(st);
      if (history.length > 300) history.shift();
      st = next;
      if (!startedAt) startedAt = Date.now();
      sound(snd);
      render();
      save();
      progress();
      if (isWon(st)) win();
    }
    const doMove = (from, to) => commit(applyMove(st, from, to), to.t === 'found' ? 'move' : 'card');
    const doDraw = () => (st.stock.length || st.waste.length) && commit(drawCards(st), 'deal');

    function undo() {
      if (over || !history.length) return;
      st = history.pop();
      sound('card');
      render();
      save();
    }

    function showHint() {
      if (over) return;
      const hs = hints(st);
      const mark = (el) => {
        el.classList.remove('hint');
        void el.offsetWidth;
        el.classList.add('hint');
        setTimeout(() => el.classList.remove('hint'), 1400);
      };
      if (hs.length) {
        const { from, to } = hs[0];
        picked(st, from).forEach((c) => mark(els.get(c.id)));
        const dest = to.t === 'found' ? top(st.found[to.i]) : top(st.tab[to.i]);
        mark(dest ? els.get(dest.id) : to.t === 'found' ? slots.found[to.i] : slots.tab[to.i]);
      } else if (st.stock.length || st.waste.length) {
        mark(st.stock.length ? els.get(top(st.stock).id) : slots.stock);
        toast(txt('Draw from the stock.'));
      } else toast(txt('No more useful moves.'));
    }

    async function autoFinish() {
      if (over || !canAutoFinish(st)) return;
      autoBtn.style.display = 'none';
      for (let n = 0; n < 400 && !over && !destroyed && !isWon(st); n++) {
        const a = autoStep(st);
        if (!a) break;
        if (a.draw) doDraw();
        else doMove(a.from, a.to);
        await new Promise((r) => setTimeout(r, 70));
      }
    }

    // ---------- tap and drag ----------
    let drag = null;
    board.addEventListener('pointerdown', (e) => {
      if (over || e.button > 0) return;
      const el = e.target.closest('.sc');
      if (!el) {
        if (e.target.closest('.sol-slot.stock')) doDraw();
        return;
      }
      const loc = where.get(el.dataset.id);
      if (loc.t === 'stock') return doDraw();
      if (el.classList.contains('down')) return;
      const from = loc.t === 'tab' ? loc : loc.t === 'waste' ? { t: 'waste' } : { t: 'found', i: loc.i };
      const cards = picked(st, from);
      if (!cards.length || (loc.t !== 'tab' && cards[0].id !== el.dataset.id)) return;
      drag = {
        from, startX: e.clientX, startY: e.clientY, moved: false,
        items: cards.map((c) => ({ el: els.get(c.id), ...prev.get(c.id) })),
      };
      try { board.setPointerCapture(e.pointerId); } catch {}
    });
    board.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      drag.items.forEach((it, j) => {
        it.el.classList.add('drag');
        it.el.style.zIndex = 2000 + j;
        it.el.style.transform = `translate(${it.x + dx}px, ${it.y + dy}px) rotate(${Math.max(-6, Math.min(6, dx / 40))}deg)`;
      });
    });
    const endDrag = (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      d.items.forEach((it) => it.el.classList.remove('drag'));
      if (!d.moved) {
        const to = smartTarget(st, d.from);
        if (to) doMove(d.from, to);
        else {
          sound('notify');
          d.items[0].el.animate([{ translate: '0 0' }, { translate: '-5px 0' }, { translate: '5px 0' }, { translate: '0 0' }], { duration: 220 });
        }
        return;
      }
      const to = dropTarget(e.clientX, e.clientY);
      if (to && canMove(st, d.from, to)) doMove(d.from, to);
      else render();
    };
    board.addEventListener('pointerup', endDrag);
    board.addEventListener('pointercancel', endDrag);

    function dropTarget(cx, cy) {
      const r = board.getBoundingClientRect();
      const x = cx - r.left, y = cy - r.top;
      const col = Math.floor((x - G.left + G.gap / 2) / (G.cw + G.gap));
      if (col < 0 || col > 6) return null;
      if (y < G.tabY - G.gap) return col >= 3 ? { t: 'found', i: col - 3 } : null;
      return { t: 'tab', i: col };
    }

    // ---------- end ----------
    async function win() {
      over = true;
      clearInterval(timer);
      render();
      sound('win');
      const time = fmtClock(Date.now() - startedAt);
      cascade();
      if (online) {
        net.claim('solved'); // the event ends the race for everyone
        return;
      }
      clearSave();
      await ctx.report('win', { summary: txt('Solved in {0} · {1} moves · {2}', time, st.moves, DRAW_NAMES[draw]) });
      await new Promise((r) => setTimeout(r, 1600));
      if (destroyed) return;
      const c = await showResult({ outcome: 'win', title: txt('Solved!'), text: txt('Time {0}, {1} moves.', time, st.moves) });
      if (c === 'again') start();
      else if (c === 'exit') location.hash = '#/';
    }

    // Victory animation: the cards fall from the foundations with a bounce.
    function cascade() {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const cards = st.found.flatMap((f) => [...f].reverse());
      cards.forEach((c, n) => {
        const el = els.get(c.id);
        const p = prev.get(c.id);
        const dir = Math.random() < 0.5 ? -1 : 1;
        const dx = dir * (120 + Math.random() * 260);
        const floor = G.H - G.ch;
        el.style.zIndex = 3000 + n;
        el.animate([
          { transform: `translate(${p.x}px, ${p.y}px)` },
          { transform: `translate(${p.x + dx * 0.45}px, ${floor}px) rotate(${dir * 90}deg)`, offset: 0.45, easing: 'cubic-bezier(.3,0,.7,.4)' },
          { transform: `translate(${p.x + dx * 0.75}px, ${floor - G.H * 0.3}px) rotate(${dir * 200}deg)`, offset: 0.7, easing: 'cubic-bezier(.3,.6,.7,1)' },
          { transform: `translate(${p.x + dx}px, ${G.H + 40}px) rotate(${dir * 300}deg)`, easing: 'ease-in' },
        ], { duration: 1500, delay: n * 45, fill: 'forwards' });
      });
    }

    let reported = false;
    async function endMatch(outcome, text) {
      if (reported) return; // e.g. I gave up, and then someone else finished first
      reported = true;
      over = true;
      clearInterval(timer);
      render();
      clearSave();
      net.finish();
      await ctx.report(outcome, online
        ? { summary: txt('Online race · {0}/52 cards · {1}', foundCount(st), DRAW_NAMES[draw]), online: true }
        : { summary: txt('Gave up · {0}/52 cards · {1}', foundCount(st), DRAW_NAMES[draw]) });
      if (destroyed || !text) return;
      if (outcome === 'win') await new Promise((r) => setTimeout(r, 1600));
      const c = await showResult({ outcome, text, again: online ? txt('Rematch') : undefined });
      if (c === 'again') online ? net.rematch() : start();
      else if (c === 'exit') location.hash = online ? '#/online/solitaire' : '#/';
    }

    async function newDeal() {
      if (st.moves > 0 && !over) {
        if (!(await confirmDialog(txt('New game'), txt('The current game will count as a loss. Continue?')))) return;
        over = true;
        clearSave();
        await ctx.report('loss', { summary: txt('Gave up · {0}/52 cards · {1}', foundCount(st), DRAW_NAMES[draw]) });
      }
      clearSave();
      start();
    }

    async function giveUp() {
      if (over) return;
      if (!(await confirmDialog(txt('Giving up'), txt('You will lose the race. Continue?'), txt('Give up'), true))) return;
      net.resign();
    }

    // ---------- online race ----------
    function progress() {
      const n = foundCount(st);
      if (!online || n === lastSent) return;
      lastSent = n;
      net.signal({ kind: 'progress', n });
    }
    function renderRivals() {
      rivalsEl.replaceChildren(...net.humanSeats().filter((i) => i !== net.seat).map((i) => {
        const r = rivals.get(i) || { n: 0 };
        return h('div', { class: `sol-rival ${r.out ? 'out' : ''}` },
          h('b', null, net.name(i)),
          h('div', { class: 'sol-prog' }, h('i', { style: { width: `${(r.n / 52) * 100}%` } })),
          h('span', null, r.out ? txt('gave up') : `${r.n}/52`));
      }));
    }
    const offSignal = net.onSignal((e) => {
      if (e.seat === net.seat) return;
      const r = rivals.get(e.seat) || { n: 0 };
      if (e.data?.kind === 'progress') r.n = Math.max(0, Math.min(52, Number(e.data.n) || 0));
      if (e.data?.kind === 'gaveup') r.out = true;
      rivals.set(e.seat, r);
      renderRivals();
      // all the others gave up → you win
      const others = net.humanSeats().filter((i) => i !== net.seat);
      if (!over && others.length && others.every((i) => rivals.get(i)?.out)) net.claim('last');
    });
    const offEvents = net.onEvent((e) => {
      if (destroyed) return;
      if (e.kind === 'resign' && e.seat === net.seat) endMatch('loss', txt('You gave up the race.'));
      else if (e.kind === 'forfeit') {
        const me = e.winner === net.seat;
        endMatch(me ? 'win' : 'loss', me
          ? (e.reason === 'last' ? txt('All the others gave up – you win!') : txt('You finished first! Time {0}.', fmtClock(Date.now() - startedAt)))
          : txt('{0} solved the solitaire first.', net.name(e.winner)));
      }
    });

    // ---------- saving (survives a reload) ----------
    function save() {
      try { sessionStorage.setItem(saveKey, JSON.stringify({ ...st, elapsed: startedAt ? Date.now() - startedAt : 0 })); } catch {}
    }
    function restore() {
      try {
        const s = JSON.parse(sessionStorage.getItem(online ? `eg.sol.${ctx.gameId}.${net.no}.${location.hash}` : 'eg.sol.offline') || 'null');
        return s && s.tab && s.draw === draw ? s : null;
      } catch { return null; }
    }
    function clearSave() {
      try { sessionStorage.removeItem(saveKey); } catch {}
    }

    const timer = setInterval(() => {
      if (startedAt && !over) timeEl.textContent = fmtClock(Date.now() - startedAt);
    }, 500);
    const ro = new ResizeObserver(() => render(false));
    ro.observe(board);
    render(false);
    if (online) {
      renderRivals();
      progress();
    }

    return {
      stop() {
        clearInterval(timer);
        ro.disconnect();
        offSignal();
        offEvents();
      },
    };
  }

  start();
  return {
    destroy() {
      destroyed = true;
      game?.stop();
    },
  };
}
