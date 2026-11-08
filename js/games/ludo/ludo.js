import { h, s, sleep, toast, motion } from '../../ui.js';
import { icon } from '../../icons.js';
import { offlineNet } from '../../net/room.js';
import { setupScreen, showResult, confirmDialog, sound, muteButton } from '../common.js';
import { rollDice3d, preloadDice } from '../tabla/dice3d.js';
import { START, TRACK, LANES, YARDS, ZONES, newGame, cell, cellAt, moves, apply, won, onTrack, aiChoose } from './engine.js';
import { txt } from '../../i18n.js';

const COLORS = [
  { name: txt('red'), main: '#e23b4e', light: '#ff8a98', dark: '#7a0f1e' },
  { name: txt('yellow'), main: '#f2b33d', light: '#ffe09a', dark: '#8a5a06' },
  { name: txt('green'), main: '#2fbf71', light: '#8ff0bb', dark: '#0f5c33' },
  { name: txt('blue'), main: '#3b82f6', light: '#9cc3ff', dark: '#173d8a' },
];
const CS = 60; // cell size
const C = (x) => x * CS + CS / 2;
const BOT_NAMES = [txt('You'), txt('Georgi'), txt('Maria'), txt('Petar')];
const LEVELS = { easy: txt('Easy'), normal: txt('Normal') };
const PIP = { 1: [[29, 29]], 2: [[16, 16], [42, 42]], 3: [[15, 15], [29, 29], [43, 43]], 4: [[16, 16], [42, 16], [16, 42], [42, 42]], 5: [[16, 16], [42, 16], [29, 29], [16, 42], [42, 42]], 6: [[16, 15], [42, 15], [16, 29], [42, 29], [16, 43], [42, 43]] };

const still = () => motion.fast || matchMedia('(prefers-reduced-motion: reduce)').matches;
// t from 0 to 1 over ms, fn(t) every frame
function tween(ms, fn) {
  if (still()) { fn(1); return Promise.resolve(); }
  return new Promise((done) => {
    const t0 = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      fn(t);
      if (t < 1) requestAnimationFrame(frame);
      else done();
    };
    requestAnimationFrame(frame);
  });
}
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export async function mount(root, ctx) {
  preloadDice();
  const online = ctx.online || null;
  let destroyed = false;
  let matchId = 0;
  let offEvents = () => {};

  const start = async () => {
    matchId++;
    root.replaceChildren();
    if (online) return play(online, [0, 1, 2, 3], 'normal', matchId);
    const opts = await setupScreen(root, {
      gameId: 'ludo',
      title: txt('Ludo'),
      subtitle: txt('You play red. Bring your four pieces home before the others.'),
      groups: [
        { key: 'players', label: txt('Players'), value: 4, options: [[2, '2'], [3, '3'], [4, '4']] },
        { key: 'level', label: txt('Computer'), value: 'normal', options: Object.entries(LEVELS) },
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
    const nameOf = (p) => (p === ME ? txt('You') : names[p]);
    let st = newGame(active);
    let turn = active[0];
    let over = false;
    let rollNo = 0;
    let rollResolver = null, pickResolver = null;
    // the board rotates so that my yard is at the bottom left
    const angle = ((3 - ME + 4) % 4) * 90;

    // ---------- DOM ----------
    const svg = s('svg', { viewBox: '-26 -26 712 712', class: 'ludo-svg', role: 'img', 'aria-label': txt('Board') });
    const board = s('g', { transform: `rotate(${angle} 330 330)` });
    const hiLayer = s('g');
    const tokenLayer = s('g');
    svg.append(defs(), board);
    board.append(staticBoard(), hiLayer, tokenLayer);

    const players = h('div', { class: 'ludo-players' });
    const statusEl = h('div', { class: 'ludo-status' });
    const dieEl = h('div', { class: 'ludo-die' });
    const trayLabel = h('span', { class: 'ludo-tray-label' });
    const tray = h('button', { class: 'ludo-tray', type: 'button', 'aria-label': txt('Roll'), onclick: () => humanRoll() }, dieEl, trayLabel);
    const resignBtn = h('button', { class: 'btn btn-sm', onclick: resign }, icon('flag', 15), txt('Resign'));
    const newBtn = h('button', { class: 'btn btn-sm', onclick: newGameBtn }, icon('refresh', 15), txt('New'));
    const side = h('div', { class: 'ludo-side' },
      players,
      h('div', { class: 'ludo-dock' }, tray, statusEl),
      h('div', { class: 'ludo-tools' }, resignBtn, !online && newBtn, muteButton()));
    root.replaceChildren(h('div', { class: 'ludo-layout' }, h('div', { class: 'ludo-wrap' }, svg), side));
    svg.addEventListener('click', onClick);

    // ---------- pieces ----------
    // token: position on the board (board units) + an upright part (counter-rotated)
    // with a shadow that stays on the board and a body that hops.
    const tokens = active.map((p) => [0, 1, 2, 3].map((t) => {
      const shadow = s('ellipse', { cx: 0, cy: 16, rx: 19, ry: 7, fill: 'rgba(0,0,0,.4)' });
      const body = s('g', null, pawn(p));
      const g = s('g', { class: 'ludo-tok', 'data-p': p, 'data-t': t },
        s('g', { transform: `rotate(${-angle})` },
          s('ellipse', { class: 'lt-ring', cx: 0, cy: 14, rx: 25, ry: 11 }),
          shadow, body, s('circle', { cx: 0, cy: -2, r: 30, fill: 'transparent' })));
      g.xy = [0, 0];
      g.shadow = shadow;
      g.body = body;
      tokenLayer.append(g);
      return g;
    }));
    const tokEl = (p, t) => tokens[active.indexOf(p)][t];
    function put(g, x, y, lift = 0, squash = 0) {
      g.xy = [x, y];
      g.setAttribute('transform', `translate(${x} ${y})`);
      g.body.setAttribute('transform', `translate(0 ${-lift}) scale(${1 + squash * 0.12} ${1 - squash * 0.14})`);
      const k = 1 - Math.min(lift, 60) / 110;
      g.shadow.setAttribute('rx', 19 * k);
      g.shadow.setAttribute('ry', 7 * k);
      g.shadow.setAttribute('opacity', k);
    }
    const placeAt = (p, t, [x, y]) => put(tokEl(p, t), C(x), C(y));
    function placeAll() {
      for (const p of active) for (let t = 0; t < 4; t++) placeAt(p, t, cell(st, p, t));
      sortTokens();
    }
    // the lower pieces are drawn over the higher ones (on the screen, after the rotation)
    function sortTokens() {
      const m = board.getCTM();
      const yOf = (g) => (m ? g.xy[0] * m.b + g.xy[1] * m.d : g.xy[1]);
      [...tokenLayer.children].sort((a, b) => yOf(a) - yOf(b)).forEach((g) => tokenLayer.append(g));
    }
    // a hop from where the piece is to [x, y] (cell coordinates)
    async function hop(g, [x, y], { ms = 210, height = 26 } = {}) {
      const [x0, y0] = g.xy, x1 = C(x), y1 = C(y);
      tokenLayer.append(g); // on top while it moves
      await tween(ms, (t) => {
        const u = ease(t);
        put(g, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 4 * t * (1 - t) * height, t > 0.85 ? (t - 0.85) / 0.15 : 0);
      });
      // a small squash when it lands
      await tween(90, (t) => put(g, x1, y1, 0, 1 - t));
    }

    // ---------- the side panel ----------
    function renderPlayers() {
      players.replaceChildren(...active.map((p) => {
        const home = st.pos[p].filter((x) => x >= 40).length;
        const out = st.pos[p].filter((x) => x >= 0 && x < 40).length;
        return h('div', { class: `ludo-player ${p === turn && !over ? 'on' : ''}`, style: { '--c': COLORS[p].main, '--cl': COLORS[p].light } },
          h('span', { class: 'lp-dot' }),
          h('span', { class: 'lp-name' }, nameOf(p)),
          h('span', { class: 'lp-home', title: txt('{0} at home · {1} on the board', home, out) },
            [0, 1, 2, 3].map((i) => h('i', { class: i < home ? 'home' : i < home + out ? 'out' : '' }))));
      }));
      board.querySelectorAll('.ludo-zone').forEach((z) => z.classList.toggle('on', !over && Number(z.dataset.p) === turn));
    }

    function drawDie(val, p) {
      dieEl.style.setProperty('--c', COLORS[p].main);
      dieEl.innerHTML = `<svg viewBox="0 0 58 58" aria-hidden="true"><rect x="1.5" y="1.5" width="55" height="55" rx="12" class="ld-face"/>${(PIP[val] || []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.4"/>`).join('')}</svg>`;
      dieEl.dataset.v = val || '';
    }

    function render() {
      renderPlayers();
      const mine = !over && !!rollResolver;
      tray.disabled = !mine;
      tray.classList.toggle('ready', mine);
      tray.style.setProperty('--c', COLORS[turn].main);
      trayLabel.textContent = mine ? txt('Roll') : '';
      resignBtn.disabled = over;
    }

    // ---------- input ----------
    let pickList = [];
    function onClick(e) {
      if (over) return;
      if (rollResolver) return humanRoll();
      if (!pickResolver) return;
      const g = e.target.closest('.ludo-tok, .ludo-dst-hit');
      if (!g) return;
      const p = Number(g.dataset.p), t = Number(g.dataset.t);
      if (p !== ME || !pickList.some((m) => m.t === t)) return;
      const r = pickResolver;
      pickResolver = null;
      clearChoice();
      r(t);
    }
    function humanRoll() {
      const r = rollResolver;
      if (!r) return;
      rollResolver = null;
      r(0);
      render();
    }
    function clearChoice() {
      hiLayer.replaceChildren();
      tokens.flat().forEach((x) => x.classList.remove('can', 'hot'));
    }
    // the movable pieces glow; each gets its target square and (on hover) the path to it
    function showChoice(p, list) {
      clearChoice();
      pickList = list;
      for (const m of list) {
        const g = tokEl(p, m.t);
        g.classList.add('can');
        const [x, y] = cell(apply(st, p, m), p, m.t);
        const path = m.from === -1 ? [] : Array.from({ length: m.to - m.from - 1 }, (_, i) => cellAt(p, m.from + 1 + i));
        const grp = s('g', { class: 'ludo-choice', 'data-t': m.t },
          ...path.map(([px, py]) => s('circle', { cx: C(px), cy: C(py), r: 6, class: 'ludo-step' })),
          s('circle', { cx: C(x), cy: C(y), r: 25, class: `ludo-dst${m.capture ? ' cap' : ''}` }),
          s('circle', { cx: C(x), cy: C(y), r: 28, class: 'ludo-dst-hit', 'data-p': p, 'data-t': m.t }));
        hiLayer.append(grp);
        const hot = (on) => { g.classList.toggle('hot', on); grp.classList.toggle('hot', on); };
        for (const el of [g, grp]) {
          el.onpointerenter = () => hot(true);
          el.onpointerleave = () => hot(false);
        }
      }
    }

    // ---------- die ----------
    function screenPoint(bx, by) {
      const m = board.getScreenCTM();
      if (!m) return null;
      const q = svg.createSVGPoint();
      q.x = bx;
      q.y = by;
      const r = q.matrixTransform(m);
      return { x: r.x, y: r.y };
    }
    async function throwDie(val, p) {
      // thrown from the player's yard into the tray
      const [zx, zy] = ZONES[p];
      const from = screenPoint((zx + 2) * CS, (zy + 2) * CS);
      const box = dieEl.getBoundingClientRect();
      dieEl.classList.add('rolling');
      if (from && box.width) {
        await rollDice3d({
          size: box.width,
          rotZ: 0,
          duration: 950,
          items: [{ value: val, dark: false, from, to: { x: box.left + box.width / 2, y: box.top + box.height / 2 } }],
        });
      }
      drawDie(val, p);
      dieEl.classList.remove('rolling');
      dieEl.animate?.([{ transform: 'scale(1.18)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    }

    async function rollPhase(p, again, left = 0) {
      statusEl.textContent = p === ME
        ? (again ? txt('A six! Roll again.') : left ? txt('You need a six – try again ({0} left).', left) : txt('Your turn – roll the die.'))
        : (again ? txt('{0} rolled a six and rolls again.', names[p]) : left ? txt('{0} needs a six…', names[p]) : txt('{0} is rolling…', names[p]));
      await net.decide(p, 'roll', () => {
        if (p !== ME) return sleep(550).then(() => 0);
        const pr = new Promise((r) => (rollResolver = r));
        render();
        return pr;
      }, (d) => d === 0);
      if (gone()) return 0;
      render();
      const r = net.rng(`roll:${rollNo++}`);
      const val = 1 + Math.floor(r() * 6);
      await throwDie(val, p);
      return val;
    }

    // ---------- move ----------
    async function animateMove(p, m) {
      const g = tokEl(p, m.t);
      if (m.from === -1) {
        sound('checker');
        await hop(g, cellAt(p, 0), { ms: 380, height: 70 });
      } else {
        for (let x = m.from + 1; x <= m.to; x++) {
          await hop(g, cellAt(p, x));
          sound('checker');
          if (gone()) return;
        }
      }
      if (m.capture) {
        // the captured piece is knocked back to its yard
        const [q, t] = m.capture;
        sound('capture');
        const cg = tokEl(q, t);
        cg.classList.add('hit');
        await hop(cg, YARDS[q][t], { ms: 650, height: 150 });
        cg.classList.remove('hit');
      }
      sortTokens();
    }

    async function movePhase(p, d) {
      const list = moves(st, p, d);
      if (!list.length) {
        statusEl.textContent = p === ME ? txt('No move with {0}.', d) : txt('{0} has no move with {1}.', names[p], d);
        await sleep(1000);
        return false;
      }
      const t = await net.decide(p, 'move', () => {
        if (p !== ME) return sleep(420).then(() => aiChoose(st, p, d, list, level).t);
        if (list.length === 1) {
          statusEl.textContent = txt('You rolled {0}.', d);
          return sleep(500).then(() => list[0].t);
        }
        statusEl.textContent = txt('You rolled {0}. Tap the piece you want to move.', d);
        showChoice(p, list);
        return new Promise((r) => (pickResolver = r));
      }, (x) => list.some((m) => m.t === x));
      if (gone()) return false;
      clearChoice();
      const m = list.find((x) => x.t === t);
      st = apply(st, p, m);
      await animateMove(p, m);
      renderPlayers();
      return true;
    }

    // ---------- main loop ----------
    async function loop() {
      while (!gone() && !over) {
        const p = turn;
        drawDie(Number(dieEl.dataset.v) || 0, p);
        render();
        let tries = onTrack(st, p) ? 1 : 3;
        let again = false;
        for (let a = 0; a < tries && !gone() && !over; a++) {
          const d = await rollPhase(p, again, again || !a ? 0 : tries - a);
          if (gone()) return;
          const moved = await movePhase(p, d);
          if (gone()) return;
          if (won(st, p)) return endMatch(p);
          if (d === 6) {
            // a six – roll again
            tries = a + 2;
            again = true;
            continue;
          }
          again = false;
          if (moved || onTrack(st, p)) break;
        }
        turn = active[(active.indexOf(turn) + 1) % active.length];
      }
    }

    async function endMatch(w) {
      if (over) return;
      over = true;
      net.finish();
      render();
      const outcome = w === ME ? 'win' : 'loss';
      statusEl.textContent = w === ME ? txt('Victory!') : txt('{0} wins.', names[w]);
      await ctx.report(outcome, online
        ? { summary: txt('Online · {0} players · winner {1}', active.length, names[w]), online: true }
        : { summary: txt('{0} players · {1} · winner {2}', active.length, LEVELS[level], w === ME ? txt('you') : names[w]) });
      if (destroyed) return;
      const c = await showResult({ outcome, text: w === ME ? txt('You got all your pieces home first!') : txt('{0} got their pieces home first.', names[w]), again: online ? txt('Rematch') : undefined });
      if (c === 'again') online ? net.rematch() : start();
      else if (c === 'exit') location.hash = online ? '#/online/ludo' : '#/';
    }

    async function resign() {
      if (over) return;
      if (!(await confirmDialog(txt('Resign'), txt('The game will count as a loss. Continue?'), txt('Resign'), true))) return;
      if (online) net.resign();
      else {
        over = true;
        await ctx.report('loss', { summary: txt('Resigned · {0} players', active.length) });
        if (destroyed) return;
        const c = await showResult({ outcome: 'loss', text: txt('You resigned the game.') });
        if (c === 'again') start();
        else if (c === 'exit') location.hash = '#/';
      }
    }

    async function newGameBtn() {
      if (!over && !(await confirmDialog(txt('New game'), txt('The current game will be stopped without being counted. Continue?')))) return;
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
          await ctx.report('loss', { summary: txt('Online · resigned'), online: true });
          if (!destroyed) showResult({ outcome: 'loss', text: txt('You resigned the game.') });
        } else endMatch(ME);
      } else if (e.kind === 'forfeit') endMatch(e.winner);
      else if (e.kind === 'desync') {
        over = true;
        toast(txt('Synchronization error – the game was stopped.'), 'error', 5000);
      }
    });

    placeAll();
    drawDie(0, turn);
    render();
    loop();
  }

  start();
  return {
    destroy() {
      destroyed = true;
      offEvents();
    },
  };
}

// ---------- drawing ----------
function defs() {
  const d = s('defs');
  d.innerHTML = COLORS.map((c, i) => `
    <radialGradient id="lp${i}" cx=".35" cy=".28" r=".85"><stop offset="0" stop-color="${c.light}"/><stop offset=".5" stop-color="${c.main}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient>
    <linearGradient id="lz${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.light}"/><stop offset=".45" stop-color="${c.main}"/><stop offset="1" stop-color="${c.dark}"/></linearGradient>
    <linearGradient id="lc${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.light}"/><stop offset="1" stop-color="${c.main}"/></linearGradient>`).join('') + `
    <radialGradient id="lboard" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="#2b2433"/><stop offset=".7" stop-color="#16121c"/><stop offset="1" stop-color="#0a080d"/></radialGradient>
    <linearGradient id="lcell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset="1" stop-color="#ddd2bd"/></linearGradient>
    <linearGradient id="lbrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dd9b"/><stop offset=".35" stop-color="#b98a35"/><stop offset=".6" stop-color="#f1d58a"/><stop offset="1" stop-color="#7a5418"/></linearGradient>
    <radialGradient id="lgloss" cx=".25" cy=".1" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="lhole" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></radialGradient>
    <filter id="lsh" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-opacity=".45"/></filter>
    <filter id="ltile" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2.5" stdDeviation="1.6" flood-opacity=".45"/></filter>
    <filter id="lnoise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 .06"/></filter>`;
  return d;
}

// A rounded tile on the square (with volume: shadow, top highlight, bottom edge).
function tile(g, x, y, fill, stroke = 'rgba(0,0,0,.25)') {
  const t = s('g', { filter: 'url(#ltile)' },
    s('rect', { x: C(x) - 26, y: C(y) - 26, width: 52, height: 52, rx: 13, fill, stroke, 'stroke-width': 1.5 }),
    s('rect', { x: C(x) - 22, y: C(y) - 23, width: 44, height: 16, rx: 8, fill: '#fff', opacity: 0.28 }),
  );
  g.append(t);
  return t;
}

function staticBoard() {
  const g = s('g');
  // base with a brass frame, texture and highlight
  g.append(s('rect', { x: -22, y: -22, width: 704, height: 704, rx: 40, fill: 'url(#lbrass)' }));
  g.append(s('rect', { x: -14, y: -14, width: 688, height: 688, rx: 34, fill: 'url(#lboard)' }));
  g.append(s('rect', { x: -14, y: -14, width: 688, height: 688, rx: 34, filter: 'url(#lnoise)', 'pointer-events': 'none' }));
  // the corner zones with the yards (the one whose turn it is glows)
  ZONES.forEach(([zx, zy], p) => {
    const x = zx * CS + 6, y = zy * CS + 6, w = 4 * CS - 12;
    g.append(s('rect', { x: x - 4, y: y - 4, width: w + 8, height: w + 8, rx: 34, class: 'ludo-zone', 'data-p': p, fill: 'none', stroke: COLORS[p].light, 'stroke-width': 5 }));
    g.append(s('rect', { x, y, width: w, height: w, rx: 30, fill: `url(#lz${p})`, stroke: COLORS[p].light, 'stroke-width': 2 }));
    g.append(s('rect', { x: x + 22, y: y + 22, width: w - 44, height: w - 44, rx: 24, fill: 'rgba(255,255,255,.9)' }));
    g.append(s('rect', { x: x + 22, y: y + 22, width: w - 44, height: w - 44, rx: 24, fill: 'none', stroke: COLORS[p].dark, 'stroke-opacity': 0.35, 'stroke-width': 3 }));
    for (const [cx, cy] of YARDS[p]) {
      g.append(s('circle', { cx: C(cx), cy: C(cy), r: 24, fill: `url(#lz${p})`, opacity: 0.35 }));
      g.append(s('circle', { cx: C(cx), cy: C(cy), r: 20, fill: 'url(#lhole)', stroke: COLORS[p].main, 'stroke-width': 2.5 }));
    }
  });
  // the track: light tiles; the start ones are in the player's colour with an arrow in the direction
  TRACK.forEach(([x, y], i) => {
    const owner = START.indexOf(i);
    tile(g, x, y, owner >= 0 ? `url(#lc${owner})` : 'url(#lcell)', owner >= 0 ? COLORS[owner].dark : 'rgba(0,0,0,.25)');
    if (owner >= 0) {
      const [nx, ny] = TRACK[(i + 1) % TRACK.length];
      const a = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
      g.append(s('path', { d: 'M -9 -10 L 11 0 L -9 10 Z', fill: '#fff', opacity: 0.9, transform: `translate(${C(x)} ${C(y)}) rotate(${a})` }));
    }
  });
  // the home rows
  LANES.forEach((cells, p) => cells.forEach(([x, y]) => tile(g, x, y, `url(#lc${p})`, COLORS[p].dark)));
  // centre: a four-colour star towards the home rows
  const c = 330, r = 30, k = 10;
  const tri = (pts, p) => g.append(s('polygon', { points: pts, fill: `url(#lz${p})`, stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1.5 }));
  tri(`${c - r - k},${c - r} ${c},${c} ${c - r - k},${c + r}`, 0);
  tri(`${c - r},${c - r - k} ${c},${c} ${c + r},${c - r - k}`, 1);
  tri(`${c + r + k},${c - r} ${c},${c} ${c + r + k},${c + r}`, 2);
  tri(`${c - r},${c + r + k} ${c},${c} ${c + r},${c + r + k}`, 3);
  g.append(s('circle', { cx: c, cy: c, r: 9, fill: '#fff', opacity: 0.85 }));
  g.append(s('rect', { x: -14, y: -14, width: 688, height: 688, rx: 34, fill: 'url(#lgloss)', 'pointer-events': 'none' }));
  return g;
}

// A pawn with volume: base with a rim, body with a highlight and a head (the shadow is separate).
function pawn(p) {
  const f = `url(#lp${p})`, d = COLORS[p].dark;
  return s('g', { filter: 'url(#lsh)', transform: 'scale(1.22)' },
    s('ellipse', { cx: 0, cy: 12, rx: 16, ry: 6.5, fill: f, stroke: d, 'stroke-width': 1.2 }),
    s('ellipse', { cx: 0, cy: 9.5, rx: 13, ry: 4.5, fill: f, stroke: d, 'stroke-width': .8 }),
    s('path', { d: 'M -10.5 10 Q -8 -1 -5.5 -8 L 5.5 -8 Q 8 -1 10.5 10 Z', fill: f, stroke: d, 'stroke-width': 1.2 }),
    s('ellipse', { cx: 0, cy: -8, rx: 7.5, ry: 2.6, fill: f, stroke: d, 'stroke-width': 1 }),
    s('circle', { cx: 0, cy: -15, r: 9, fill: f, stroke: d, 'stroke-width': 1.2 }),
    s('path', { d: 'M -6 8 Q -5 -1 -3 -6', stroke: '#fff', 'stroke-opacity': .45, 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' }),
    s('ellipse', { cx: -3.2, cy: -18.5, rx: 3.4, ry: 2.2, fill: 'rgba(255,255,255,.8)' }),
  );
}
