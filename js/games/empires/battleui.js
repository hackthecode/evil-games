// Evil Empires – екранът на тактическата битка. Играчът води нападателите ('A'),
// компютърът – защитниците. Връща списъка с ходовете (сървърът ги проверява).
import { h } from '../../ui.js';
import * as T from './tactics.js';
import { unitIcon } from './art.js';
import { TERRAIN, TACTIC, CLS_NAMES } from './data.js';

const S = 30; // радиус на шестоъгълника
const W = S * Math.sqrt(3);
const PAD = 8;
const pos = (q, r) => [PAD + W / 2 + W * (q + 0.5 * (r & 1)), PAD + S + 1.5 * S * r];
const hexPts = (x, y, k = 1) => Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return `${(x + S * k * Math.cos(a)).toFixed(1)},${(y + S * k * Math.sin(a)).toFixed(1)}`;
}).join(' ');

const TERR_FILL = { plain: '#2b3223', forest: '#1f2a1c', hill: '#3a3428', ruins: '#34312d', water: '#1a2733' };
function terrainDeco(kind, x, y) {
  if (kind === 'forest') return [[-8, -4], [7, -6], [0, 7]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="6" fill="#26331f"/><circle cx="${x + dx - 1.5}" cy="${y + dy - 1.5}" r="3" fill="#33432a"/>`).join('');
  if (kind === 'hill') return `<ellipse cx="${x}" cy="${y + 4}" rx="17" ry="9" fill="#453d2f"/><ellipse cx="${x - 3}" cy="${y + 1}" rx="10" ry="5" fill="#514735"/>`;
  if (kind === 'ruins') return `<rect x="${x - 12}" y="${y - 2}" width="8" height="10" fill="#57524b"/><rect x="${x + 2}" y="${y - 8}" width="6" height="16" fill="#4c4842"/><rect x="${x - 4}" y="${y + 6}" width="10" height="4" fill="#5f5a52"/>`;
  if (kind === 'water') return `<path d="M${x - 14} ${y - 3} q4 -3 8 0 t8 0 t8 0 M${x - 12} ${y + 6} q4 -3 8 0 t8 0 t8 0" stroke="#2f4555" fill="none"/>`;
  return '';
}

/**
 * battle: { seed, att, def, opts } (от похода); names: (side, key) → име; colors: { A, D }.
 * saved: вече изиграни ходове (за продължение). Връща Promise<moves | null> (null – „по-късно“).
 */
export function openTactical({ battle, title, names, colors, saved = [], onProgress }) {
  return new Promise((resolve) => {
    const st = T.createBattle(battle.seed, battle.att, battle.def, battle.opts);
    const moves = [];
    for (const mv of saved) if (T.applyMove(st, mv)) moves.push(mv);
    let sel = null;
    const board = h('div', { class: 'ee-tac-board' });
    const info = h('div', { class: 'ee-tac-info' });
    const logEl = h('div', { class: 'ee-tac-log' });
    const turnEl = h('b');
    const endBtn = h('button', { class: 'btn btn-primary btn-sm', onclick: () => record({ end: 1 }) }, 'Край на хода');
    const autoBtn = h('button', { class: 'btn btn-sm', onclick: () => record({ auto: 1 }) }, 'Автоматично');
    const later = h('button', { class: 'btn btn-sm btn-ghost', onclick: () => close(null) }, 'По-късно');
    const root = h('div', { class: 'ee-tac', role: 'dialog', 'aria-label': title },
      h('div', { class: 'ee-tac-top' }, h('div', null, h('div', { class: 'ee-tac-title' }, title), h('small', { class: 'muted' }, turnEl)), h('div', { class: 'ee-tac-btns' }, later, autoBtn, endBtn)),
      board,
      h('div', { class: 'ee-tac-bottom' }, info, logEl));
    document.body.append(root);
    document.body.classList.add('ee-tac-open');

    function close(v) {
      root.remove();
      document.body.classList.remove('ee-tac-open');
      resolve(v);
    }

    function record(mv) {
      if (st.over) return;
      if (T.applyMove(st, mv)) {
        moves.push(mv);
        onProgress?.(moves);
      }
      if (mv.end || mv.auto) sel = null;
      draw();
    }

    function unitName(u) { return names(u.side, u.key); }

    function draw() {
      const [bw] = pos(st.cols, 0);
      const [, bh] = pos(0, st.rows - 1);
      const reach = sel ? T.reachable(st, sel) : new Map();
      const tg = sel ? T.targets(st, sel) : [];
      let svg = '';
      for (let r = 0; r < st.rows; r++) {
        for (let q = 0; q < st.cols; q++) {
          const [x, y] = pos(q, r);
          const kind = T.terrainAt(st, q, r);
          const can = reach.has(`${q},${r}`);
          svg += `<g class="ee-hex${can ? ' can' : ''}" data-q="${q}" data-r="${r}"><polygon points="${hexPts(x, y)}" fill="${TERR_FILL[kind]}" stroke="#0a0a0c" stroke-width="1.5"/>${terrainDeco(kind, x, y)}${can ? `<polygon points="${hexPts(x, y, 0.92)}" fill="rgba(110,220,140,.22)" stroke="rgba(110,220,140,.7)" stroke-width="1.5"/>` : ''}</g>`;
        }
      }
      for (const u of st.units) {
        if (u.n <= 0) continue;
        const [x, y] = pos(u.q, u.r);
        const isTarget = tg.includes(u);
        const isSel = sel === u;
        const done = u.side === 'A' && u.acted;
        const col = colors[u.side];
        const icon = unitIcon(u.cls === 'hero' ? 'hero' : u.cls, col, 34).replace('<svg ', `<svg x="${(x - 17).toFixed(1)}" y="${(y - 20).toFixed(1)}" `);
        const hp = Math.max(0, 1 - u.dmg / u.hp);
        svg += `<g class="ee-unit${u.side === 'A' ? ' mine' : ''}${done ? ' done' : ''}" data-id="${u.id}">
          <circle cx="${x}" cy="${y - 3}" r="${S * 0.66}" fill="${u.side === 'A' ? '#14121a' : '#1c0d10'}" stroke="${isSel ? '#fff' : isTarget ? '#ff5d6c' : col}" stroke-width="${isSel || isTarget ? 3 : 1.6}"/>
          ${icon}
          <rect x="${x - 15}" y="${y + 12}" width="30" height="12" rx="6" fill="#0b0a0d" stroke="${col}" stroke-opacity=".7"/>
          <text x="${x}" y="${y + 21}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff">${u.n}</text>
          ${u.n > 0 && hp < 1 ? `<rect x="${x - 13}" y="${y + 25}" width="${(26 * hp).toFixed(1)}" height="2.5" fill="#3ee08f"/>` : ''}
          ${isTarget ? `<text x="${x}" y="${y - 25}" text-anchor="middle" font-size="9" font-weight="700" fill="#ffb3ba">−${Math.min(u.n, Math.floor(T.strike(st, sel, u) / u.hp))}</text>` : ''}
        </g>`;
      }
      board.innerHTML = `<svg viewBox="0 0 ${bw + PAD + W / 2} ${bh + S + PAD}" class="ee-tac-svg">${svg}</svg>`;
      turnEl.textContent = st.over ? (st.win === 'att' ? 'Победа!' : 'Поражение') : `Ход ${st.turn} от ${TACTIC.maxTurns}`;
      endBtn.disabled = autoBtn.disabled = st.over;
      if (sel) {
        info.replaceChildren(
          h('b', null, unitName(sel)), h('small', { class: 'muted' }, ` · ${CLS_NAMES[sel.cls] || ''} · ${sel.n} бр.`),
          h('div', { class: 'ee-tac-stats' }, `⚔ ${sel.atk.toFixed(1)} · 🛡 ${sel.def.toFixed(1)} · ❤ ${Math.round(sel.hp)} · ход ${sel.moved ? '—' : (sel.cls === 'cav' ? 4 : sel.cls === 'hero' ? 3 : 2)} · обсег ${T.rangeOf(st, sel)}`),
          h('small', { class: 'muted' }, sel.acted ? 'Действа вече този ход.' : tg.length ? 'Изберете враг (червено), за да атакувате.' : 'Изберете зелено поле, за да се придвижите.'),
          h('small', { class: 'muted' }, `Терен: ${TERRAIN[T.terrainAt(st, sel.q, sel.r)].name}`));
      } else if (st.over) {
        const lost = st.units.filter((u) => u.side === 'A').reduce((a, u) => a + u.start - u.n, 0);
        const killed = st.units.filter((u) => u.side === 'D').reduce((a, u) => a + u.start - u.n, 0);
        info.replaceChildren(h('b', { class: st.win === 'att' ? 'good' : 'bad' }, st.win === 'att' ? 'Победа!' : 'Поражение'),
          h('div', null, `Загуби: ${lost} · Избити врагове: ${killed}`),
          h('button', { class: 'btn btn-primary btn-sm', onclick: () => close(moves) }, 'Приключи битката'));
      } else {
        info.replaceChildren(h('small', { class: 'muted' }, 'Изберете своя единица. Гората пази от стрели, хълмът дава обсег и защита, руините – прикритие. Стрелците стрелят на 3 полета; конницата се движи на 4. Героят вдъхновява съседите (+10%).'));
      }
      logEl.replaceChildren(...st.log.slice(-6).reverse().map((e) => {
        const a = st.units.find((u) => u.id === e.a), t = st.units.find((u) => u.id === e.t);
        return h('div', { class: a.side === 'A' ? 'good' : 'bad' }, `${unitName(a)} → ${unitName(t)}: −${e.kills}${e.back ? ` (ответно −${e.back})` : ''}`);
      }));
    }

    board.addEventListener('click', (e) => {
      if (st.over) return;
      const ug = e.target.closest('.ee-unit');
      if (ug) {
        const u = st.units.find((x) => x.id === +ug.dataset.id);
        if (u.side === 'A') { sel = sel === u ? null : u; return draw(); }
        if (sel && T.targets(st, sel).includes(u)) return record({ a: [sel.id, u.id] });
        return;
      }
      const hg = e.target.closest('.ee-hex');
      if (hg && sel) {
        const q = +hg.dataset.q, r = +hg.dataset.r;
        if (T.reachable(st, sel).has(`${q},${r}`)) return record({ m: [sel.id, q, r] });
        sel = null;
        draw();
      }
    });
    draw();
  });
}
