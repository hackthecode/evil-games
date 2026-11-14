import { h, s, sleep } from '../../ui.js';
import { icon } from '../../icons.js';
import { setupScreen, showResult, confirmDialog, sound, muteButton, loadPrefs } from '../common.js';
import { variantEngine } from './variants.js';
import { rollDice3d, preloadDice } from './dice3d.js';
import { dieDefs, dieMarkup } from '../dieface.js';
import { offlineNet } from '../../net/room.js';
import { txt } from '../../i18n.js';

const LEVEL_NAMES = { easy: txt('Easy'), medium: txt('Medium'), hard: txt('Hard') };
const VARIANTS = {
  tabla: { name: txt('backgammon'), sub: txt('You play white and move towards the bottom right corner.') },
  tapa: { name: txt('tapa'), sub: txt('All checkers start from one corner. No hitting – a single checker gets pinned.') },
  gulbara: { name: txt('gulbara'), sub: txt('Both players move in the same direction. A single checker blocks the point.') },
};

// ---- Board geometry (SVG coordinates) ----
const W = 980, H = 760, F = 20, PW = 65, R = 29;
const LEFT_X = F, BAR_X = F + 6 * PW, RIGHT_X = BAR_X + 60, TRAY_X = RIGHT_X + 6 * PW + 10;
const TRI_H = 300;

function pointX(i) {
  if (i <= 5) return RIGHT_X + (5 - i) * PW;
  if (i <= 11) return LEFT_X + (11 - i) * PW;
  if (i <= 17) return LEFT_X + (i - 12) * PW;
  return RIGHT_X + (i - 18) * PW;
}
const isTop = (i) => i >= 12;

function checkerXY(loc, k, n) {
  if (loc === 'bar0') return [BAR_X + 30, 480 + k * 54];
  if (loc === 'bar1') return [BAR_X + 30, 280 - k * 54];
  const i = loc;
  const step = n <= 5 ? 2 * R : Math.min(2 * R, (TRI_H - 2 * R) / (n - 1));
  const cx = pointX(i) + PW / 2;
  return isTop(i) ? [cx, F + R + 2 + k * step] : [cx, H - F - R - 2 - k * step];
}

function offXY(p, k) {
  // trays: the player at the bottom, the computer at the top
  return p === 0 ? [TRAY_X, H - F - 14 - k * 15] : [TRAY_X, F + k * 15];
}

export async function mount(root, ctx) {
  preloadDice();
  const online = ctx.online || null;
  const variant = VARIANTS[ctx.gameId] ? ctx.gameId : 'tabla';
  const E = variantEngine(variant);
  const { initialState, legalSequences, applySingle, chooseSequence, toReal, pipCount, winner, winPoints, cloneState } = E;
  let destroyed = false;
  let resizeObs = null;
  let offEvents = () => {};

  const start = async () => {
    root.replaceChildren();
    if (online) return match(online, 'online', Number(online.opts.target) || 3, loadPrefs(variant, { help: 'on' }).help !== 'off');
    const opts = await setupScreen(root, {
      gameId: variant,
      title: txt('New game of {0}', VARIANTS[variant].name),
      subtitle: VARIANTS[variant].sub,
      groups: [
        { key: 'level', label: txt('Difficulty'), value: 'medium', options: Object.entries(LEVEL_NAMES) },
        { key: 'target', label: txt('Match to'), value: 3, options: [[1, txt('1 point')], [3, txt('3 points')], [5, txt('5 points')]] },
        { key: 'help', label: txt('Help for beginners'), value: 'on', options: [['on', txt('On')], ['off', txt('Off')]] },
      ],
    });
    if (!destroyed) match(offlineNet([ctx.user.displayName, txt('Computer')]), opts.level, Number(opts.target), opts.help !== 'off');
  };

  function match(net, level, target, beginner = true) {
    if (!online) ctx.newMatch();
    const me = net.seat; // 0 = white, 1 = black
    const opp = 1 - me;
    const flip = me === 1; // black sees the board flipped: their home at the bottom right
    const names = [net.name(0), net.name(1)];
    const score = [0, 0];
    let st = initialState(), turn = 0, dice = [], used = [], seqs = [], selected = null, busy = true, over = false;
    let moveDice = []; // the moves to play (4 with doubles; in Gulbara also escalating/passed ones)
    let turnHistory = [], movesMade = [], turnResolver = null, rollResolver = null;
    let gameNo = 0, rollNo = 0;
    let openingColors = false; // when rolling for the first move the dice are white and black
    let popUntil = 0; // with doubles the other two dice "pop up"

    // ---------- DOM ----------
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: `tb-svg ${flip ? 'flip' : ''}`, role: 'img', 'aria-label': txt('Backgammon board') });
    const staticLayer = s('g');
    const hiLayer = s('g');
    const checkerLayer = s('g');
    const diceLayer = s('g');
    const boardG = s('g');
    boardG.append(staticLayer, hiLayer, checkerLayer, diceLayer);
    svg.append(buildDefs(), boardG);
    drawStatic(staticLayer, me);
    // On a portrait screen the board rotates 90° so the checkers are larger.
    const fit = () => {
      const rot = root.clientWidth < root.clientHeight * 0.85;
      svg.classList.toggle('rot', rot);
      svg.setAttribute('viewBox', rot ? `0 0 ${H} ${W}` : `0 0 ${W} ${H}`);
      const t = [rot && `translate(${H} 0) rotate(90)`, flip && `translate(0 ${H}) scale(1 -1)`].filter(Boolean).join(' ');
      if (t) boardG.setAttribute('transform', t);
      else boardG.removeAttribute('transform');
    };
    resizeObs?.disconnect();
    resizeObs = new ResizeObserver(fit);
    resizeObs.observe(root);
    fit();

    const statusEl = h('div', { class: 'g-status' });
    const rollBtn = h('button', { class: 'btn btn-primary tb-roll', onclick: () => humanRoll() }, icon('dice', 18), txt('Roll'));
    const undoBtn = h('button', { class: 'btn', onclick: undoMove }, icon('undo', 16), txt('Undo'));
    const resignBtn = h('button', { class: 'btn btn-danger', onclick: resign }, icon('flag', 16), txt('Resign'));
    const newBtn = h('button', { class: 'btn', onclick: newGame }, icon('refresh', 16), txt('New'));
    const hintBtn = beginner ? h('button', { class: 'btn', onclick: showHint }, txt('💡 Hint')) : null;
    let hintTo = null; // the suggested destination (highlighted)
    const scoreEl = h('div', { class: 'tb-score' });

    root.replaceChildren(
      h('div', { class: 'tb-layout' },
        scoreEl,
        h('div', { class: 'tb-board-wrap' }, svg),
        statusEl,
        h('div', { class: 'g-toolbar' }, rollBtn, hintBtn, undoBtn, resignBtn, !online && newBtn, muteButton()),
      ),
    );

    svg.addEventListener('click', onBoardClick);

    // ---------- rendering ----------
    function renderScore() {
      const chip = (p) => h('span', { class: `tb-chip ${p === 0 ? 'light' : 'dark'}` });
      scoreEl.replaceChildren(
        h('div', { class: `tb-pl ${turn === me && !over ? 'on' : ''}` },
          chip(me), h('b', null, names[me]),
          h('span', { class: 'muted' }, txt('pips {0}', pipCount(st, me)))),
        h('div', { class: 'tb-match' }, h('b', null, score[me]), h('span', null, txt('to {0}', target)), h('b', null, score[opp])),
        h('div', { class: `tb-pl right ${turn === opp && !over ? 'on' : ''}` },
          h('span', { class: 'muted' }, txt('pips {0}', pipCount(st, opp))),
          h('b', null, names[opp]), chip(opp)),
      );
    }

    function renderCheckers() {
      checkerLayer.replaceChildren();
      const els = {};
      const put = (loc, owner, k, n) => {
        const [x, y] = checkerXY(loc, k, n);
        // on a flipped board the checker is turned back so the highlight is on top
        const g = s('g', { class: 'tb-ck', 'data-loc': String(loc) },
          s('use', { href: owner === 0 ? '#pulL' : '#pulD', x: x - R, y: y - R, width: 2 * R, height: 2 * R, transform: flip ? `translate(0 ${2 * y}) scale(1 -1)` : null }),
        );
        checkerLayer.append(g);
        (els[loc] ||= []).push(g);
        return g;
      };
      E.stacks(st).forEach((stack, i) => {
        const n = stack.length;
        stack.forEach((owner, k) => put(i, owner, k, n));
        if (n > 5) {
          const [x, y] = checkerXY(i, n - 1, n);
          checkerLayer.append(s('text', { x, y: y + 7, class: 'tb-count', fill: stack[n - 1] === 0 ? '#3b3020' : '#eee' }, String(n)));
        }
      });
      for (let k = 0; k < st.bar[0]; k++) put('bar0', 0, k, st.bar[0]);
      for (let k = 0; k < st.bar[1]; k++) put('bar1', 1, k, st.bar[1]);
      for (const p of [0, 1]) {
        for (let k = 0; k < st.off[p]; k++) {
          const [x, y] = offXY(p, k);
          const g = s('g', { filter: 'url(#shOff)' },
            s('rect', { x: x + 6, y, width: 78, height: 13, rx: 4.5, fill: p === 0 ? 'url(#ckLight)' : 'url(#ckDark)', stroke: p === 0 ? '#9c8c6c' : '#000', 'stroke-width': 0.8 }),
            s('rect', { x: x + 10, y: y + 1.6, width: 70, height: 2.6, rx: 1.3, fill: '#fff', opacity: p === 0 ? 0.75 : 0.22 }));
          checkerLayer.append(g);
          (els['off' + p] ||= []).push(g);
        }
      }
      return els;
    }

    function renderHighlights() {
      hiLayer.replaceChildren();
      if (!turnResolver || busy || over || !dice.length) return;
      const firsts = nextMoves();
      const sources = new Set(firsts.map((m) => m.from));
      for (const src of sources) {
        const loc = src === 'bar' ? 'bar' + me : src;
        const n = src === 'bar' ? st.bar[me] : E.stacks(st)[src].length;
        const [x, y] = checkerXY(loc, n - 1, n);
        hiLayer.append(s('circle', { cx: x, cy: y, r: R + 5, class: `tb-src ${selected === src ? 'sel' : ''}` }));
      }
      if (selected !== null) {
        for (const m of firsts.filter((m) => m.from === selected)) {
          const hint = hintTo !== null && String(m.to) === String(hintTo);
          if (m.to === 'off') {
            hiLayer.append(s('rect', { x: TRAY_X + 2, y: me === 0 ? H / 2 + 10 : F + 2, width: 86, height: H / 2 - 30, rx: 10, class: `tb-dst ${hint ? 'hint' : ''}`, 'data-to': 'off' }));
          } else {
            const x = pointX(m.to);
            const tri = isTop(m.to)
              ? `M${x} ${F} L${x + PW / 2} ${F + TRI_H} L${x + PW} ${F} Z`
              : `M${x} ${H - F} L${x + PW / 2} ${H - F - TRI_H} L${x + PW} ${H - F} Z`;
            hiLayer.append(s('path', { d: tri, class: `tb-dst ${hint ? 'hint' : ''}`, 'data-to': String(m.to) }));
          }
        }
      }
    }

    // Top-left corner of the i-th of n dice (mine on the right, the opponent's on the left).
    function diePos(i, n, p) {
      const cx = p === me ? RIGHT_X + 3 * PW : LEFT_X + 3 * PW;
      return [cx - (n * 66 - 8) / 2 + i * 66, H / 2 - 29];
    }

    function renderDice() {
      diceLayer.replaceChildren();
      if (!dice.length) return;
      const list = diceList();
      const pop = performance.now() < popUntil;
      list.forEach((d, i) => {
        const [x, y] = diePos(i, list.length, turn);
        const dark = openingColors ? i === 1 : turn === 1;
        const g = s('g', { class: `tb-die ${used[i] ? 'used' : ''} ${pop && (i === 0 || i === 3) ? 'pop' : ''}` });
        g.innerHTML = dieMarkup(d, dark, 'tbd');
        diceLayer.append(s('g', { transform: `translate(${x} ${y})` }, g));
      });
    }

    // A roll with 3D dice; items: [{ value, dark, slot: [x, y], thrower }].
    async function throw3d(items) {
      diceLayer.replaceChildren();
      const m = boardG.getScreenCTM();
      if (!m) return;
      const toClient = (x, y) => {
        const pt = svg.createSVGPoint();
        pt.x = x;
        pt.y = y;
        const p = pt.matrixTransform(m);
        return { x: p.x, y: p.y };
      };
      await rollDice3d({
        size: 58 * Math.hypot(m.a, m.b),
        rotZ: svg.classList.contains('rot') ? 90 : 0,
        items: items.map((it) => {
          const [x, y] = it.slot;
          // thrown from the thrower's side (mine is at the bottom of the screen)
          const dir = (it.thrower === me ? 1 : -1) * (flip ? -1 : 1);
          return {
            value: it.value, dark: it.dark,
            to: toClient(x + 29, y + 29),
            from: toClient(x + 29 + dir * (110 + Math.random() * 90), H / 2 + dir * (250 + Math.random() * 60)),
          };
        }),
      });
    }

    function render() {
      renderScore();
      const els = renderCheckers();
      renderHighlights();
      renderDice();
      rollBtn.disabled = over || !rollResolver;
      if (hintBtn) hintBtn.disabled = over || busy || !turnResolver;
      rollBtn.classList.toggle('pulse', !rollBtn.disabled);
      undoBtn.disabled = over || busy || !turnResolver || !turnHistory.length;
      resignBtn.disabled = over;
      return els;
    }

    // ---------- move logic ----------
    const diceList = () => moveDice;
    const expand = (d) => (d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : d.slice());
    const isGone = () => destroyed || !alive;
    let alive = true;
    const rollValue = (r) => 1 + Math.floor(r() * 6);
    const who = (p) => (p === me ? txt('You') : names[p]);

    function nextMoves() {
      const seen = new Map();
      for (const q of seqs) {
        if (!q.moves.length) continue;
        const m = toReal(turn, q.moves[0]);
        const k = m.from + '>' + m.to;
        if (!seen.has(k)) seen.set(k, { ...m, raw: q.moves[0] });
      }
      return [...seen.values()];
    }

    async function animateMove(prevSt, realMove, owner) {
      // position before the move
      const srcLoc = realMove.from === 'bar' ? 'bar' + owner : realMove.from;
      const srcN = realMove.from === 'bar' ? prevSt.bar[owner] : E.stacks(prevSt)[realMove.from].length;
      const [sx, sy] = checkerXY(srcLoc, srcN - 1, srcN);
      const hitN = prevSt.bar[1 - owner] + 1;
      const els = render();
      if (net.replaying()) return;
      const dstLoc = realMove.to === 'off' ? 'off' + owner : realMove.to;
      const list = els[dstLoc] || [];
      const el = list[list.length - 1];
      const anims = [];
      if (el) {
        const [tx, ty] = realMove.to === 'off' ? [offXY(owner, st.off[owner] - 1)[0] + 45, offXY(owner, st.off[owner] - 1)[1] + 6] : checkerXY(dstLoc, list.length - 1, list.length);
        el.style.transformBox = 'view-box';
        anims.push(el.animate([{ transform: `translate(${sx - tx}px, ${sy - ty}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.3,.7,.3,1)' }).finished);
      }
      if (realMove.hit) {
        const barList = els['bar' + (1 - owner)] || [];
        const bel = barList[barList.length - 1];
        if (bel) {
          const [bx, by] = checkerXY('bar' + (1 - owner), hitN - 1, hitN);
          const [ox, oy] = checkerXY(realMove.to, 0, 1);
          anims.push(bel.animate([{ transform: `translate(${ox - bx}px, ${oy - by}px)` }, { transform: 'none' }], { duration: 380, easing: 'ease-in-out' }).finished);
        }
      }
      sound('checker');
      await Promise.all(anims.map((a) => a.catch(() => {})));
    }

    // ---------- hint for beginners ----------
    const ptLabel = (x) => (x === 'bar' ? txt('the bar') : x === 'off' ? txt('off the board') : String(me === 0 ? x + 1 : 24 - x));
    function showHint() {
      if (!turnResolver || busy) return;
      const left = diceList().filter((d, i) => !used[i]);
      const best = chooseSequence(st, me, left, 'hard');
      if (!best?.moves?.length) return;
      const first = toReal(me, best.moves[0]);
      const after = applySingle(st, me, best.moves[0]);
      const plan = best.moves.map((m) => { const r = toReal(me, m); return `${ptLabel(r.from)} → ${ptLabel(r.to)}`; }).join(', ');
      let why;
      if (first.from === 'bar') why = txt('first you must bring the checker on the bar back into play');
      else if (first.to === 'off') why = txt('all your checkers are home, so you bear them off');
      else if (after.hit) why = txt('it hits an opponent\'s single checker and sends it to the bar');
      else if (E.stacks(best.state)[first.to]?.filter((o) => o === me).length >= 2) why = txt('it makes a point with 2 or more checkers – the opponent can\'t land there');
      else {
        // single checkers ("blots") can be hit – say "safely" only if the move adds none
        const blots = (state) => E.stacks(state).filter((x) => x.length === 1 && x[0] === me).length;
        why = blots(best.state) > blots(st) ? txt('the computer judges this the best use of your dice') : txt('it moves forward safely');
      }
      selected = first.from;
      hintTo = first.to;
      renderHighlights();
      statusEl.textContent = txt('💡 Move the checker from {0} to {1} – {2}. Whole move: {3}.', ptLabel(first.from), ptLabel(first.to), why, plan);
    }

    function markDieUsed(die) {
      const idx = diceList().findIndex((d, i) => d === die && !used[i]);
      if (idx >= 0) used[idx] = true;
    }

    // A player's move with mouse/finger – one checker at a time; the whole move is sent at the end.
    async function humanMove(from, to) {
      const cand = seqs.find((q) => q.moves.length && toReal(me, q.moves[0]).from === from && toReal(me, q.moves[0]).to === to);
      if (!cand || !turnResolver) return;
      const raw = cand.moves[0];
      busy = true;
      turnHistory.push({ st: cloneState(st), seqs, used: used.slice() });
      movesMade.push(raw);
      const prev = st;
      const res = applySingle(st, me, raw);
      st = res.state;
      seqs = seqs.filter((q) => q.moves.length && q.moves[0].from === raw.from && q.moves[0].to === raw.to && q.moves[0].die === raw.die)
        .map((q) => ({ ...q, moves: q.moves.slice(1) }));
      markDieUsed(raw.die);
      selected = null;
      hintTo = null;
      await animateMove(prev, { ...toReal(me, raw), hit: res.hit }, me);
      busy = false;
      if (!seqs.some((q) => q.moves.length)) {
        render();
        await sleep(350);
        const r = turnResolver;
        turnResolver = null;
        r?.(movesMade.map(({ from, to, die }) => ({ from, to, die })));
      } else render();
    }

    function onBoardClick(e) {
      if (over || busy) return;
      if (rollResolver) return humanRoll();
      if (!turnResolver) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(boardG.getScreenCTM().inverse());
      const loc = locateClick(p.x, p.y);
      if (loc === null) {
        selected = null;
        renderHighlights();
        return;
      }
      const firsts = nextMoves();
      if (selected !== null) {
        const dst = firsts.find((m) => m.from === selected && String(m.to) === String(loc));
        if (dst) return humanMove(dst.from, dst.to);
        if (loc === selected) {
          // tapping again: play with the larger die
          const opts = firsts.filter((m) => m.from === selected).sort((a, b) => b.die - a.die);
          if (opts.length) return humanMove(opts[0].from, opts[0].to);
        }
      }
      const isSource = firsts.some((m) => m.from === loc);
      if (loc !== selected) hintTo = null;
      selected = isSource ? loc : null;
      if (isSource) sound('notify');
      renderHighlights();
    }

    function locateClick(x, y) {
      if (x >= BAR_X && x <= BAR_X + 60) return st.bar[me] ? 'bar' : null;
      if (x >= TRAY_X) return 'off';
      const top = y < H / 2;
      let col, base;
      if (x >= LEFT_X && x < BAR_X) {
        col = Math.floor((x - LEFT_X) / PW);
        base = top ? 12 + col : 11 - col;
      } else if (x >= RIGHT_X && x < RIGHT_X + 6 * PW) {
        col = Math.floor((x - RIGHT_X) / PW);
        base = top ? 18 + col : 5 - col;
      } else return null;
      return base;
    }

    function humanRoll() {
      const r = rollResolver;
      rollResolver = null;
      r?.(0);
      render();
    }

    async function animateRoll(vals) {
      dice = [];
      used = [];
      const n = vals[0] === vals[1] ? 4 : 2;
      const slots = n === 4 ? [1, 2] : [0, 1];
      await throw3d(vals.map((v, j) => ({ value: v, dark: turn === 1, slot: diePos(slots[j], n, turn), thrower: turn })));
      dice = vals;
      moveDice = expand(vals);
      if (n === 4) popUntil = performance.now() + 400;
      renderDice();
    }

    // Rolling: the only decision is "when"; the values come from the shared generator.
    async function rollPhase(p) {
      busy = true;
      statusEl.textContent = p === me ? txt('Your turn – roll the dice.') : txt('{0} is rolling…', names[p]);
      await net.decide(p, 'roll', () => {
        if (p !== me) return sleep(450).then(() => 0);
        const pr = new Promise((r) => (rollResolver = r));
        busy = false;
        render();
        return pr;
      }, (d) => d === 0);
      if (isGone()) return;
      busy = true;
      const r = net.rng(`roll:${gameNo}:${rollNo++}`);
      await animateRoll([rollValue(r), rollValue(r)]);
    }

    // Moves: the whole move (up to 4 steps) is one decision. Returns the number of steps played.
    async function movePhase(p, list = expand(dice)) {
      moveDice = list;
      used = [];
      seqs = legalSequences(st, p, list);
      turnHistory = [];
      movesMade = [];
      selected = null;
      render();
      if (!seqs.some((q) => q.moves.length)) {
        statusEl.textContent = txt('{0} {1} – no possible move.', p === me ? txt('You rolled') : txt('{0} rolled', names[p]), dice.join('–'));
        await sleep(1400);
        return 0;
      }
      const legalSeqs = seqs;
      let local = false;
      const data = await net.decide(p, 'moves', () => {
        local = true;
        if (p !== me) return sleep(500).then(() => chooseSequence(st, p, list, level).moves.map(({ from, to, die }) => ({ from, to, die })));
        statusEl.textContent = txt('You rolled {0}. Choose a checker.', dice.join('–'));
        const pr = new Promise((r) => (turnResolver = r));
        busy = false;
        render();
        return pr;
      }, (d) => !!matchSeq(legalSeqs, d));
      if (isGone()) return 0;
      turnResolver = null;
      busy = true;
      if (local && p === me) return data.length; // already played on the board
      statusEl.textContent = txt('{0} rolled {1}.', names[p], dice.join('–'));
      const q = matchSeq(legalSeqs, data);
      for (const raw of q.moves) {
        if (isGone() || over) return 0;
        const prev = st;
        const res = applySingle(st, p, raw);
        st = res.state;
        markDieUsed(raw.die);
        await animateMove(prev, { ...toReal(p, raw), hit: res.hit }, p);
        await sleep(320);
      }
      return q.moves.length;
    }

    // Gulbara: from each player's 4th move on doubles escalate – the next doubles are played too
    // up to 6-6. If the player can't play everything (but has started), the rest passes to the opponent.
    async function gulbaraDoubles(p, played, turnNo) {
      if (variant !== 'gulbara' || turnNo <= 6 || dice[0] !== dice[1]) return;
      let d = dice[0], total = 4;
      while (!isGone() && !over && winner(st) < 0) {
        if (played < total) {
          if (played > 0) {
            const left = total - played;
            statusEl.textContent = txt('{0} play everything – {1} × {2} passes to {3}.', p === me ? txt('You can\'t') : txt('{0} can\'t', names[p]), left, d, p === me ? names[1 - p] : txt('you'));
            await sleep(1300);
            turn = 1 - p;
            render();
            await movePhase(1 - p, Array(left).fill(d));
            turn = p;
          }
          return;
        }
        if (d === 6) return;
        d++;
        statusEl.textContent = txt('Doubles – {0} with {1}–{2}.', p === me ? txt('you continue') : txt('{0} continues', names[p]), d, d);
        dice = [d, d];
        popUntil = performance.now() + 400;
        render();
        await sleep(900);
        played = await movePhase(p, [d, d, d, d]);
      }
    }

    const matchSeq = (list, d) => Array.isArray(d) &&
      list.find((q) => q.moves.length === d.length && q.moves.every((m, i) => m.from === d[i]?.from && m.to === d[i]?.to && m.die === d[i]?.die));

    function undoMove() {
      if (!turnHistory.length || busy || !turnResolver) return;
      const last = turnHistory.pop();
      movesMade.pop();
      st = last.st;
      seqs = last.seqs;
      used = last.used.slice();
      selected = null;
      render();
    }

    // One game until all checkers are borne off.
    async function playGame() {
      gameNo++;
      rollNo = 0;
      st = initialState();
      dice = [];
      used = [];
      seqs = [];
      turn = 0;
      busy = true;
      render();
      statusEl.textContent = txt('Rolling for the first move…');
      await sleep(500);
      const r = net.rng(`open:${gameNo}`);
      let a, b;
      do {
        a = rollValue(r);
        b = rollValue(r);
      } while (a === b);
      turn = a > b ? 0 : 1;
      await throw3d([
        { value: a, dark: false, slot: diePos(0, 2, turn), thrower: 0 },
        { value: b, dark: true, slot: diePos(1, 2, turn), thrower: 1 },
      ]);
      if (isGone()) return;
      dice = [a, b];
      moveDice = [a, b];
      openingColors = true;
      renderScore();
      renderDice();
      statusEl.textContent = `${names[0]}: ${a}, ${names[1]}: ${b} – ${turn === me ? txt('you start') : txt('{0} starts', names[turn])}.`;
      await sleep(1300);
      if (isGone()) return;
      openingColors = false;
      let first = true;
      let turnNo = 0;
      while (!isGone() && !over) {
        if (!first) {
          dice = [];
          moveDice = [];
          render();
          await rollPhase(turn);
          if (isGone() || over) return;
        }
        first = false;
        turnNo++;
        const played = await movePhase(turn);
        if (isGone() || over) return;
        await gulbaraDoubles(turn, played, turnNo);
        if (isGone() || over) return;
        if (winner(st) >= 0) return endGame();
        dice = [];
        moveDice = [];
        used = [];
        seqs = [];
        turn = 1 - turn;
      }
    }

    async function endGame() {
      const w = winner(st);
      const pts = winPoints(st, w);
      score[w] += pts;
      dice = [];
      busy = true;
      render();
      const kind = pts === 1 ? '' : variant === 'tapa' && winPoints(st, w) === 2 && st.off[1 - w] > 0 ? txt(' (pinned mother)') : pts === 2 ? txt(' (gammon)') : txt(' (backgammon)');
      if (score[w] >= target) return endMatch(score[me] > score[opp] ? 'win' : 'loss', txt('Final score {0} : {1}{2}.', score[me], score[opp], kind));
      statusEl.textContent = w === me ? txt('You win the game{0} – +{1}', kind, pts) : txt('{0} wins the game{1} – +{2}', names[w], kind, pts);
      sound(w === me ? 'win' : 'notify');
      await sleep(2200);
      if (!isGone()) playGame();
    }

    async function endMatch(outcome, text) {
      if (over) return;
      over = true;
      busy = true;
      net.finish();
      turnResolver = rollResolver = null;
      render();
      statusEl.textContent = outcome === 'win' ? txt('You won the match!') : txt('{0} won the match.', names[opp]);
      await ctx.report(outcome, online
        ? { summary: txt('Online against {0} · {1}:{2} · to {3}', names[opp], score[me], score[opp], target), online: true, opponent: names[opp], score: [score[me], score[opp]] }
        : { summary: txt('{0}:{1} · to {2} · {3}', score[0], score[1], target, LEVEL_NAMES[level]), level, score: score.slice() });
      if (isGone()) return;
      const c = await showResult({ outcome, text, again: online ? txt('Rematch') : undefined });
      if (c === 'again') online ? net.rematch() : start();
      else if (c === 'exit') location.hash = online ? `#/online/${variant}` : '#/';
    }

    async function resign() {
      if (over) return;
      if (!(await confirmDialog(txt('Resign'), txt('Count the match as a loss?'), txt('Resign'), true))) return;
      if (online) net.resign(); // the event ends the match for both players
      else endMatch('loss', txt('You resigned the match.'));
    }

    async function newGame() {
      if (!over && !(await confirmDialog(txt('New game'), txt('The current match will be stopped without being counted. Continue?')))) return;
      over = true;
      alive = false;
      start();
    }

    offEvents();
    offEvents = net.onEvent((e) => {
      if (isGone() || over) return;
      if (e.kind === 'resign') endMatch(e.seat === me ? 'loss' : 'win', e.seat === me ? txt('You resigned the match.') : txt('{0} resigned.', names[e.seat]));
      else if (e.kind === 'forfeit') endMatch(e.winner === me ? 'win' : 'loss', e.reason === 'stall' ? txt('Forfeit win due to inactivity.') : txt('The opponent left – forfeit win.'));
      else if (e.kind === 'desync') {
        over = true;
        statusEl.textContent = txt('Synchronization error – the match was stopped.');
      }
    });

    playGame();
  }

  start();
  return { destroy() { destroyed = true; offEvents(); resizeObs?.disconnect(); } };
}


// Checker: a turned disc with thickness (the side wall shows below the face), a bevelled
// rim, two engraved rings (dark line + a light one beneath it) and a highlight at the top left.
function pulSymbol(id, body, rim, side, groove, lite, hi) {
  const ring = (r, w) => `<circle r="${r}" fill="none" stroke="${groove}" stroke-width="${w}"/><circle r="${r}" cy="${w * 0.7}" fill="none" stroke="${lite}" stroke-width="${w * 0.6}"/>`;
  return `<symbol id="${id}" viewBox="-30 -30 60 60" overflow="visible">
    <circle r="28.6" cy="3.2" fill="${side}"/>
    <circle r="28.6" cy="3.2" fill="url(#pulSide)"/>
    <circle r="28.6" fill="url(#${body})"/>
    <circle r="27.6" fill="none" stroke="url(#${rim})" stroke-width="2"/>
    <circle r="24.6" fill="none" stroke="${groove}" stroke-width=".7" opacity=".7"/>
    ${ring(20, 1.6)}${ring(12, 1.2)}
    <circle r="4.6" fill="url(#${body})" stroke="${groove}" stroke-width=".8"/>
    <ellipse cx="-9" cy="-13" rx="13" ry="6.5" transform="rotate(-32 -9 -13)" fill="url(#pulHi)" opacity="${hi}"/>
  </symbol>`;
}

function buildDefs() {
  const defs = s('defs');
  defs.innerHTML = `
    <linearGradient id="ckLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset=".5" stop-color="#efe6d2"/><stop offset="1" stop-color="#b7a888"/></linearGradient>
    <linearGradient id="ckDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a3443"/><stop offset=".5" stop-color="#4a1420"/><stop offset="1" stop-color="#16040a"/></linearGradient>
    <!-- frame: walnut -->
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6e4020"/><stop offset=".45" stop-color="#4b2a14"/><stop offset="1" stop-color="#2e180b"/></linearGradient>
    <linearGradient id="woodEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffdfae" stop-opacity=".5"/><stop offset=".08" stop-color="#ffdfae" stop-opacity="0"/><stop offset=".92" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
    <!-- playing field: oak veneer -->
    <linearGradient id="field" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d3a868"/><stop offset=".5" stop-color="#c2924f"/><stop offset="1" stop-color="#b28044"/></linearGradient>
    <radialGradient id="fieldVig" cx=".5" cy=".5" r=".72"><stop offset=".55" stop-color="#2a1304" stop-opacity="0"/><stop offset="1" stop-color="#2a1304" stop-opacity=".42"/></radialGradient>
    <linearGradient id="fieldDrop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <linearGradient id="fieldDropX" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".4"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <!-- inlaid points: maple and dark walnut -->
    <linearGradient id="triA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f6e8c6"/><stop offset=".5" stop-color="#ecd9ac"/><stop offset="1" stop-color="#d6bd88"/></linearGradient>
    <linearGradient id="triB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a2f17"/><stop offset=".5" stop-color="#40200f"/><stop offset="1" stop-color="#281308"/></linearGradient>
    <linearGradient id="slot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#150a04"/><stop offset=".25" stop-color="#2a160a"/><stop offset="1" stop-color="#3a2010"/></linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8e3a6"/><stop offset=".4" stop-color="#b98c3a"/><stop offset=".62" stop-color="#eed08a"/><stop offset="1" stop-color="#7c561b"/></linearGradient>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="3.2" flood-color="#150700" flood-opacity=".55"/></filter>
    <filter id="shOff" x="-10%" y="-30%" width="120%" height="180%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-opacity=".5"/></filter>
    <radialGradient id="pulLb" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#f3ead6"/><stop offset="1" stop-color="#b9a886"/></radialGradient>
    <linearGradient id="pulLr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8c7c5e"/></linearGradient>
    <radialGradient id="pulDb" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#a23d4f"/><stop offset=".5" stop-color="#541624"/><stop offset="1" stop-color="#17040b"/></radialGradient>
    <linearGradient id="pulDr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d06a7c"/><stop offset="1" stop-color="#050102"/></linearGradient>
    <linearGradient id="pulSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".1"/><stop offset=".3" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
    <radialGradient id="pulHi" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    ${pulSymbol('pulL', 'pulLb', 'pulLr', '#8f7f60', 'rgba(110,85,50,.5)', 'rgba(255,255,255,.75)', 0.8)}
    ${pulSymbol('pulD', 'pulDb', 'pulDr', '#0d0206', 'rgba(0,0,0,.7)', 'rgba(255,130,150,.28)', 0.4)}
    ${dieDefs('tbd')}
    <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .22" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.05"/></filter>
    <filter id="grainV" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".3 .009" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 .16  0 0 0 0 .07  0 0 0 0 0  0 0 0 -1.9 1.12"/></filter>
    <filter id="pores" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9 .05" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .1  0 0 0 0 0  0 0 0 -2.2 1.05"/></filter>
    <clipPath id="clipL"><rect x="${LEFT_X}" y="${F}" width="${6 * PW}" height="${H - 2 * F}" rx="5"/></clipPath>
    <clipPath id="clipR"><rect x="${RIGHT_X}" y="${F}" width="${6 * PW}" height="${H - 2 * F}" rx="5"/></clipPath>`;
  return defs;
}

// The board: a walnut case, two recessed oak fields with inlaid maple/walnut points,
// a hinged bar in the middle and a tray for the borne-off checkers.
function drawStatic(g, me = 0) {
  const np = { 'pointer-events': 'none' };
  // case
  g.append(s('rect', { x: 0, y: 0, width: W, height: H, rx: 22, fill: 'url(#wood)' }));
  g.append(s('rect', { x: 0, y: 0, width: W, height: H, rx: 22, filter: 'url(#grain)', opacity: 0.5, ...np }));
  g.append(s('rect', { x: 0, y: 0, width: W, height: H, rx: 22, fill: 'url(#woodEdge)', ...np }));
  g.append(s('rect', { x: 1.5, y: 1.5, width: W - 3, height: H - 3, rx: 21, fill: 'none', stroke: 'rgba(255,214,160,.28)', 'stroke-width': 1.5 }));
  // brass inlay line around the case
  g.append(s('rect', { x: 7, y: 7, width: W - 14, height: H - 14, rx: 16, fill: 'none', stroke: 'url(#brass)', 'stroke-width': 1.6, opacity: 0.75 }));

  const tri = (i) => {
    const x = pointX(i), b = isTop(i) ? F : H - F, tip = isTop(i) ? F + TRI_H : H - F - TRI_H;
    return `M${x + 3} ${b} L${x + PW / 2} ${tip} L${x + PW - 3} ${b} Z`;
  };
  [[LEFT_X, 'clipL'], [RIGHT_X, 'clipR']].forEach(([x, clip]) => {
    const w = 6 * PW, hgt = H - 2 * F;
    const f = s('g', { 'clip-path': `url(#${clip})` });
    f.append(s('rect', { x, y: F, width: w, height: hgt, fill: 'url(#field)' }));
    f.append(s('rect', { x, y: F, width: w, height: hgt, filter: 'url(#grainV)', opacity: 0.55, ...np }));
    // the points are veneer set into the field: fill, grain, a fine dark joint
    for (let i = 0; i < 24; i++) {
      const px = pointX(i);
      if (px < x || px >= x + w) continue;
      const dark = i % 2 === 0;
      f.append(s('path', { d: tri(i), fill: dark ? 'url(#triB)' : 'url(#triA)' }));
      f.append(s('path', { d: tri(i), fill: 'none', stroke: dark ? 'rgba(20,8,2,.8)' : 'rgba(92,58,22,.75)', 'stroke-width': 1.1, 'stroke-linejoin': 'round' }));
      // a light chamfer on the left side of the point
      const b = isTop(i) ? F : H - F, tip = isTop(i) ? F + TRI_H : H - F - TRI_H;
      f.append(s('path', { d: `M${px + 4.6} ${b} L${px + PW / 2} ${tip - (isTop(i) ? 6 : -6)}`, stroke: dark ? 'rgba(255,190,130,.2)' : 'rgba(255,255,255,.55)', 'stroke-width': 1.2, fill: 'none' }));
    }
    f.append(s('rect', { x, y: F, width: w, height: hgt, filter: 'url(#pores)', opacity: 0.35, ...np }));
    // the field is sunk into the case: shade under the top and left walls, vignette
    f.append(s('rect', { x, y: F, width: w, height: hgt, fill: 'url(#fieldVig)', ...np }));
    f.append(s('rect', { x, y: F, width: w, height: 16, fill: 'url(#fieldDrop)', ...np }));
    f.append(s('rect', { x, y: F, width: 11, height: hgt, fill: 'url(#fieldDropX)', ...np }));
    g.append(f);
    g.append(s('rect', { x: x - 0.5, y: F - 0.5, width: w + 1, height: hgt + 1, rx: 5.5, fill: 'none', stroke: 'rgba(12,4,0,.75)', 'stroke-width': 2 }));
    g.append(s('path', { d: `M${x + 4} ${H - F + 1.2} H${x + w - 4} M${x + w + 1.2} ${F + 4} V${H - F - 4}`, stroke: 'rgba(255,215,160,.3)', 'stroke-width': 1.2, fill: 'none' }));
  });

  // the bar with two brass hinges
  g.append(s('rect', { x: BAR_X + 6, y: F, width: 48, height: H - 2 * F, rx: 6, fill: 'url(#slot)', stroke: 'rgba(0,0,0,.6)', 'stroke-width': 1.5 }));
  g.append(s('line', { x1: BAR_X + 30, y1: F + 3, x2: BAR_X + 30, y2: H - F - 3, stroke: 'rgba(0,0,0,.75)', 'stroke-width': 2 }));
  g.append(s('line', { x1: BAR_X + 31.4, y1: F + 3, x2: BAR_X + 31.4, y2: H - F - 3, stroke: 'rgba(255,200,140,.16)', 'stroke-width': 1 }));
  for (const hy of [H / 2 - 58, H / 2 + 34]) {
    const hg = s('g', { filter: 'url(#shOff)' });
    hg.append(s('rect', { x: BAR_X + 12, y: hy, width: 36, height: 24, rx: 2.5, fill: 'url(#brass)', stroke: '#5e4012', 'stroke-width': 0.8 }));
    hg.append(s('rect', { x: BAR_X + 27.5, y: hy - 2, width: 5, height: 28, rx: 2.5, fill: 'url(#brass)', stroke: '#5e4012', 'stroke-width': 0.7 }));
    for (const [sx, sy] of [[18.5, 6], [18.5, 18], [41.5, 6], [41.5, 18]]) {
      hg.append(s('circle', { cx: BAR_X + sx, cy: hy + sy, r: 2.3, fill: '#8a6420', stroke: '#4a300a', 'stroke-width': 0.6 }));
      hg.append(s('line', { x1: BAR_X + sx - 1.5, y1: hy + sy - 1, x2: BAR_X + sx + 1.5, y2: hy + sy + 1, stroke: '#3a2406', 'stroke-width': 0.8 }));
    }
    g.append(hg);
  }
  // trays for the borne-off checkers
  for (const y of [F, H / 2 + 8]) {
    const th = H / 2 - F - 8;
    g.append(s('rect', { x: TRAY_X, y, width: 90, height: th, rx: 8, fill: 'url(#slot)', stroke: 'rgba(0,0,0,.65)', 'stroke-width': 1.5 }));
    g.append(s('rect', { x: TRAY_X + 1, y: y + 1, width: 88, height: 14, rx: 7, fill: 'url(#fieldDrop)', ...np }));
    g.append(s('path', { d: `M${TRAY_X + 6} ${y + th + 1} H${TRAY_X + 84}`, stroke: 'rgba(255,215,160,.25)', 'stroke-width': 1.2 }));
  }
  for (let i = 0; i < 24; i++) {
    // the numbering is from the player's point of view
    g.append(s('text', { x: pointX(i) + PW / 2, y: isTop(i) ? 14 : H - 5, class: 'tb-num' }, String(me === 0 ? i + 1 : 24 - i)));
  }
}
