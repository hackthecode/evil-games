import { h, s, sleep, toast } from '../../ui.js';
import { icon } from '../../icons.js';
import { offlineNet } from '../../net/room.js';
import { setupScreen, showResult, confirmDialog, sound, muteButton } from '../common.js';
import { rollDice3d } from '../tabla/dice3d.js';
import { START, TRACK, LANES, YARDS, newGame, cell, cellAt, moves, apply, won, onTrack, aiChoose } from './engine.js';

const COLORS = [
  { name: 'червени', main: '#e23b4e', light: '#ff8a98', dark: '#7a0f1e' },
  { name: 'жълти', main: '#f2b33d', light: '#ffe09a', dark: '#8a5a06' },
  { name: 'зелени', main: '#2fbf71', light: '#8ff0bb', dark: '#0f5c33' },
  { name: 'сини', main: '#3b82f6', light: '#9cc3ff', dark: '#173d8a' },
];
const CS = 60; // размер на клетка
const C = (x) => x * CS + CS / 2;
const BOT_NAMES = ['Вие', 'Георги', 'Мария', 'Петър'];
const LEVELS = { easy: 'Лесно', normal: 'Нормално' };
const PIP = { 1: [[29, 29]], 2: [[16, 16], [42, 42]], 3: [[15, 15], [29, 29], [43, 43]], 4: [[16, 16], [42, 16], [16, 42], [42, 42]], 5: [[16, 16], [42, 16], [29, 29], [16, 42], [42, 42]], 6: [[16, 15], [42, 15], [16, 29], [42, 29], [16, 43], [42, 43]] };

export async function mount(root, ctx) {
  const online = ctx.online || null;
  let destroyed = false;
  let matchId = 0;
  let offEvents = () => {};
  let resizeObs = null;

  const start = async () => {
    matchId++;
    root.replaceChildren();
    if (online) return play(online, [0, 1, 2, 3], 'normal', matchId);
    const opts = await setupScreen(root, {
      gameId: 'ludo',
      title: 'Не се сърди, човече',
      subtitle: 'Вие сте с червените. Изкарайте четирите си пула до дома преди другите.',
      groups: [
        { key: 'players', label: 'Играчи', value: 4, options: [[2, '2'], [3, '3'], [4, '4']] },
        { key: 'level', label: 'Компютър', value: 'normal', options: Object.entries(LEVELS) },
      ],
    });
    const n = Number(opts.players);
    if (!destroyed) play(offlineNet(BOT_NAMES.map((x, i) => (i === 0 ? ctx.user.displayName : x))), n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3], opts.level, matchId);
  };

  function play(net, active, level, myId) {
    if (!online) ctx.newMatch();
    const gone = () => destroyed || myId !== matchId;
    const ME = net.seat;
    const names = [0, 1, 2, 3].map((p) => net.name(p));
    let st = newGame(active);
    let turn = active[0];
    let over = false;
    let rollNo = 0;
    let rollResolver = null, pickResolver = null;
    let dieVal = 0;
    // дъската се завърта така, че моята кошара да е долу вляво
    const angle = ((3 - ME + 4) % 4) * 90;

    // ---------- DOM ----------
    const svg = s('svg', { viewBox: '-24 -24 708 708', class: 'ludo-svg', role: 'img', 'aria-label': 'Дъска' });
    const board = s('g', { transform: `rotate(${angle} 330 330)` });
    const hiLayer = s('g');
    const tokenLayer = s('g');
    const dieLayer = s('g');
    svg.append(defs(), board);
    board.append(staticBoard(), hiLayer, tokenLayer, dieLayer);

    const chips = h('div', { class: 'ludo-chips' });
    const statusEl = h('div', { class: 'g-status' });
    const rollBtn = h('button', { class: 'btn btn-primary tb-roll', onclick: () => humanRoll() }, icon('dice', 18), 'Хвърли');
    const resignBtn = h('button', { class: 'btn btn-danger', onclick: resign }, icon('flag', 16), 'Предай се');
    const newBtn = h('button', { class: 'btn', onclick: newGameBtn }, icon('refresh', 16), 'Нова');
    root.replaceChildren(h('div', { class: 'ludo-layout' },
      chips,
      h('div', { class: 'ludo-wrap' }, svg),
      statusEl,
      h('div', { class: 'g-toolbar' }, rollBtn, resignBtn, !online && newBtn, muteButton()),
    ));
    svg.addEventListener('click', onClick);

    // ---------- пулове ----------
    const tokens = active.map((p) => [0, 1, 2, 3].map((t) => {
      const g = s('g', { class: 'ludo-tok', 'data-p': p, 'data-t': t },
        s('g', { transform: `rotate(${-angle})` }, pawn(p)));
      tokenLayer.append(g);
      return g;
    }));
    const tokEl = (p, t) => tokens[active.indexOf(p)][t];
    const place = (p, t, [x, y], instant = false) => {
      const g = tokEl(p, t);
      g.classList.toggle('instant', instant);
      g.style.transform = `translate(${C(x)}px, ${C(y)}px)`;
    };
    function placeAll(instant = false) {
      for (const p of active) for (let t = 0; t < 4; t++) place(p, t, cell(st, p, t), instant);
    }

    function renderChips() {
      chips.replaceChildren(...active.map((p) => {
        const home = st.pos[p].filter((x) => x >= 40).length;
        return h('div', { class: `ludo-chip ${p === turn && !over ? 'on' : ''}`, style: { '--c': COLORS[p].main } },
          h('i'), h('b', null, p === ME ? 'Вие' : names[p]), h('span', null, `${home}/4`));
      }));
    }

    function renderDie(val, p) {
      dieLayer.replaceChildren();
      if (!val) return;
      const g = s('g', { transform: `translate(301 301) rotate(${-angle} 29 29)` },
        s('rect', { width: 58, height: 58, rx: 12, fill: '#fbf7ee', stroke: COLORS[p].main, 'stroke-width': 4 }),
        ...PIP[val].map(([x, y]) => s('circle', { cx: x, cy: y, r: 5.6, fill: '#2a2018' })));
      dieLayer.append(g);
    }

    function render() {
      renderChips();
      rollBtn.disabled = over || !rollResolver;
      rollBtn.classList.toggle('pulse', !rollBtn.disabled);
      resignBtn.disabled = over;
    }

    // ---------- вход ----------
    let pickList = [];
    function onClick(e) {
      if (over) return;
      if (rollResolver) return humanRoll();
      const g = e.target.closest('.ludo-tok');
      if (!g || !pickResolver) return;
      const p = Number(g.dataset.p), t = Number(g.dataset.t);
      if (p !== ME || !pickList.some((m) => m.t === t)) return;
      const r = pickResolver;
      pickResolver = null;
      hiLayer.replaceChildren();
      tokens.flat().forEach((x) => x.classList.remove('can'));
      r(t);
    }
    function humanRoll() {
      const r = rollResolver;
      rollResolver = null;
      r?.(0);
      render();
    }

    // ---------- зар ----------
    async function throwDie(val, p) {
      renderDie(0);
      const m = board.getScreenCTM();
      if (!m) return;
      const pt = (x, y) => {
        const q = svg.createSVGPoint();
        q.x = x;
        q.y = y;
        const r = q.matrixTransform(m);
        return { x: r.x, y: r.y };
      };
      // зарът идва откъм кошарата на хвърлящия
      const [yx, yy] = YARDS[p][0];
      await rollDice3d({
        size: 58 * Math.hypot(m.a, m.b),
        rotZ: 0,
        duration: 950,
        items: [{ value: val, dark: false, from: pt(C(yx), C(yy)), to: pt(330, 330) }],
      });
      renderDie(val, p);
    }

    async function rollPhase(p) {
      statusEl.textContent = p === ME ? 'Ваш ред – хвърлете зара.' : `${names[p]} хвърля…`;
      await net.decide(p, 'roll', () => {
        if (p !== ME) return sleep(500).then(() => 0);
        const pr = new Promise((r) => (rollResolver = r));
        render();
        return pr;
      }, (d) => d === 0);
      if (gone()) return 0;
      const r = net.rng(`roll:${rollNo++}`);
      const val = 1 + Math.floor(r() * 6);
      await throwDie(val, p);
      return val;
    }

    // ---------- ход ----------
    async function animateMove(p, m) {
      const path = [];
      if (m.from === -1) path.push(cellAt(p, 0));
      else for (let x = m.from + 1; x <= m.to; x++) path.push(cellAt(p, x));
      const g = tokEl(p, m.t);
      g.classList.add('moving');
      for (const c of path) {
        place(p, m.t, c);
        sound('checker');
        await sleep(160);
        if (gone()) return;
      }
      g.classList.remove('moving');
      if (m.capture) {
        const [q, t] = m.capture;
        sound('capture');
        tokEl(q, t).classList.add('captured');
        place(q, t, YARDS[q][t]);
        setTimeout(() => tokEl(q, t).classList.remove('captured'), 600);
      }
    }

    async function movePhase(p, d) {
      const list = moves(st, p, d);
      if (!list.length) {
        statusEl.textContent = `${p === ME ? 'Нямате' : `${names[p]} няма`} ход с ${d}.`;
        await sleep(900);
        return false;
      }
      const t = await net.decide(p, 'move', () => {
        if (p !== ME) return sleep(450).then(() => aiChoose(st, p, d, list, level).t);
        if (list.length === 1) return sleep(450).then(() => list[0].t);
        statusEl.textContent = `Хвърлихте ${d}. Изберете пул.`;
        pickList = list;
        for (const m of list) {
          tokEl(p, m.t).classList.add('can');
          const [x, y] = cell(apply(st, p, m), p, m.t);
          hiLayer.append(s('circle', { cx: C(x), cy: C(y), r: 25, class: 'ludo-dst' }));
        }
        return new Promise((r) => (pickResolver = r));
      }, (x) => list.some((m) => m.t === x));
      if (gone()) return false;
      const m = list.find((x) => x.t === t);
      st = apply(st, p, m);
      await animateMove(p, m);
      renderChips();
      return true;
    }

    // ---------- главен цикъл ----------
    async function loop() {
      while (!gone() && !over) {
        const p = turn;
        render();
        let tries = onTrack(st, p) ? 1 : 3;
        for (let a = 0; a < tries && !gone() && !over; a++) {
          const d = await rollPhase(p);
          if (gone()) return;
          const moved = await movePhase(p, d);
          if (gone()) return;
          if (won(st, p)) return endMatch(p);
          if (d === 6) {
            // шестица – ново хвърляне
            tries = a + 2;
            statusEl.textContent = `${p === ME ? 'Шестица! Хвърлете' : `${names[p]} хвърли шестица и хвърля`} отново.`;
            continue;
          }
          if (moved || onTrack(st, p)) break;
        }
        renderDie(0);
        turn = active[(active.indexOf(turn) + 1) % active.length];
      }
    }

    async function endMatch(w) {
      if (over) return;
      over = true;
      net.finish();
      render();
      const outcome = w === ME ? 'win' : 'loss';
      statusEl.textContent = w === ME ? 'Победа!' : `${names[w]} печели.`;
      await ctx.report(outcome, online
        ? { summary: `Онлайн · ${active.length} играчи · победител ${names[w]}`, online: true }
        : { summary: `${active.length} играчи · ${LEVELS[level]} · победител ${w === ME ? 'вие' : names[w]}` });
      if (destroyed) return;
      const c = await showResult({ outcome, text: w === ME ? 'Изкарахте всичките си пулове първи!' : `${names[w]} изкара пуловете си първи.`, again: online ? 'Реванш' : undefined });
      if (c === 'again') online ? net.rematch() : start();
      else if (c === 'exit') location.hash = online ? '#/online/ludo' : '#/';
    }

    async function resign() {
      if (over) return;
      if (!(await confirmDialog('Предаване', 'Играта ще се отчете като загуба. Продължаване?', 'Предай се', true))) return;
      if (online) net.resign();
      else {
        over = true;
        await ctx.report('loss', { summary: `Предаване · ${active.length} играчи` });
        if (destroyed) return;
        const c = await showResult({ outcome: 'loss', text: 'Предадохте играта.' });
        if (c === 'again') start();
        else if (c === 'exit') location.hash = '#/';
      }
    }

    async function newGameBtn() {
      if (!over && !(await confirmDialog('Нова игра', 'Текущата игра ще бъде прекратена без да се отчита. Продължаване?'))) return;
      over = true;
      matchId++;
      start();
    }

    offEvents();
    offEvents = net.onEvent(async (e) => {
      if (over || destroyed) return;
      if (e.kind === 'resign') {
        if (e.seat === ME) {
          over = true;
          await ctx.report('loss', { summary: `Онлайн · предаване`, online: true });
          if (!destroyed) showResult({ outcome: 'loss', text: 'Предадохте играта.' });
        } else endMatch(ME);
      } else if (e.kind === 'forfeit') endMatch(e.winner);
      else if (e.kind === 'desync') {
        over = true;
        toast('Грешка в синхронизацията – играта е прекратена.', 'error', 5000);
      }
    });

    resizeObs?.disconnect();
    placeAll(true);
    render();
    loop();
  }

  start();
  return {
    destroy() {
      destroyed = true;
      offEvents();
      resizeObs?.disconnect();
    },
  };
}

// ---------- рисуване ----------
function defs() {
  const d = s('defs');
  d.innerHTML = COLORS.map((c, i) => `
    <radialGradient id="lp${i}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${c.light}"/><stop offset=".55" stop-color="${c.main}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient>`).join('') + `
    <radialGradient id="lboard" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#2a2233"/><stop offset="1" stop-color="#0b0910"/></radialGradient>
    <radialGradient id="lcell" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#d9cfbd"/></radialGradient>
    <filter id="lsh" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".55"/></filter>`;
  return d;
}

function staticBoard() {
  const g = s('g');
  g.append(s('rect', { x: -18, y: -18, width: 696, height: 696, rx: 34, fill: 'url(#lboard)', stroke: 'rgba(255,255,255,.08)', 'stroke-width': 2 }));
  // кошари
  YARDS.forEach((cells, p) => {
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    const x = Math.min(...xs) * CS, y = Math.min(...ys) * CS;
    g.append(s('rect', { x: x + 2, y: y + 2, width: CS * 2 - 4, height: CS * 2 - 4, rx: 22, fill: COLORS[p].main, opacity: 0.22, stroke: COLORS[p].main, 'stroke-width': 2 }));
    for (const [cx, cy] of cells) g.append(s('circle', { cx: C(cx), cy: C(cy), r: 21, fill: 'rgba(0,0,0,.45)', stroke: COLORS[p].main, 'stroke-width': 2.5 }));
  });
  // пътят
  TRACK.forEach(([x, y], i) => {
    const owner = START.indexOf(i);
    g.append(s('circle', {
      cx: C(x), cy: C(y), r: 24, fill: owner >= 0 ? COLORS[owner].main : 'url(#lcell)',
      stroke: owner >= 0 ? COLORS[owner].light : 'rgba(0,0,0,.35)', 'stroke-width': 2,
    }));
  });
  // стрелки на стартовите полета
  START.forEach((i, p) => {
    const [x, y] = TRACK[i];
    g.append(s('circle', { cx: C(x), cy: C(y), r: 9, fill: 'rgba(255,255,255,.75)' }));
  });
  // домашни редици и център
  LANES.forEach((cells, p) => {
    for (const [x, y] of cells) {
      g.append(s('circle', { cx: C(x), cy: C(y), r: 24, fill: COLORS[p].main, opacity: 0.85, stroke: COLORS[p].light, 'stroke-width': 2 }));
    }
  });
  // център: триъгълник към домашната редица на всеки играч (0 отляво, 1 отгоре, 2 отдясно, 3 отдолу)
  const c = 330, r = 26;
  g.append(s('polygon', { points: `${c - r},${c - r} ${c},${c} ${c - r},${c + r}`, fill: COLORS[0].main }));
  g.append(s('polygon', { points: `${c - r},${c - r} ${c},${c} ${c + r},${c - r}`, fill: COLORS[1].main }));
  g.append(s('polygon', { points: `${c + r},${c - r} ${c},${c} ${c + r},${c + r}`, fill: COLORS[2].main }));
  g.append(s('polygon', { points: `${c - r},${c + r} ${c},${c} ${c + r},${c + r}`, fill: COLORS[3].main }));
  return g;
}

// Пешка с обем: сянка, основа, тяло и глава.
function pawn(p) {
  const f = `url(#lp${p})`;
  return s('g', { filter: 'url(#lsh)' },
    s('ellipse', { cx: 0, cy: 14, rx: 17, ry: 6, fill: 'rgba(0,0,0,.35)' }),
    s('ellipse', { cx: 0, cy: 11, rx: 15, ry: 6, fill: f, stroke: COLORS[p].dark, 'stroke-width': 1.2 }),
    s('path', { d: 'M -10 10 Q -7 -2 -5 -8 L 5 -8 Q 7 -2 10 10 Z', fill: f, stroke: COLORS[p].dark, 'stroke-width': 1.2 }),
    s('circle', { cx: 0, cy: -14, r: 8.5, fill: f, stroke: COLORS[p].dark, 'stroke-width': 1.2 }),
    s('ellipse', { cx: -3, cy: -17, rx: 3, ry: 2, fill: 'rgba(255,255,255,.7)' }),
  );
}
