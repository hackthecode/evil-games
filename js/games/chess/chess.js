import { h, toast, modal } from '../../ui.js';
import { icon } from '../../icons.js';
import { setupScreen, showResult, confirmDialog, sound, muteButton, loadPrefs, savePrefs, seg } from '../common.js';
import {
  START_FEN, fromFEN, toFEN, legalMoves, makeMove, inCheck, gameStatus, toSAN,
  positionKey, kingSquare, colorOf,
} from './engine.js';
import { search, LEVELS } from './ai.js';
import { txt } from '../../i18n.js';
import { PIECES, threats, blunder, blunderText, suggest } from './help.js';

const LEVEL_NAMES = { easy: txt('Easy'), medium: txt('Medium'), hard: txt('Hard') };
const PIECE_VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9 };
const REASONS = {
  checkmate: txt('Checkmate'),
  stalemate: txt('Stalemate'),
  fifty: txt('50-move rule'),
  repetition: txt('Threefold repetition'),
  material: txt('Insufficient material'),
  resign: txt('Resign'),
  agreement: txt('Draw by agreement'),
  abandon: txt('The opponent left'),
  stall: txt('Inactivity'),
  desync: txt('Synchronization error'),
};

// Piece sets (free licenses, from the lichess project) and board themes.
export const PIECE_SETS = {
  celtic: txt('Celtic'), fantasy: txt('Fantasy'), rhosgfx: txt('Wooden'), merida: txt('Merida'), cburnett: txt('Classic'),
};
export const BOARD_THEMES = { wine: txt('Burgundy'), wood: txt('Wood'), marble: txt('Marble'), green: txt('Tournament'), ocean: txt('Ice') };
let look = loadPrefs('chess.look', { pieces: 'celtic', board: 'wine' });
const pieceSrc = (p) => {
  const f = `${p < 'a' ? 'w' : 'b'}${p.toUpperCase()}.svg`;
  return look.pieces === 'cburnett' || !PIECE_SETS[look.pieces] ? `assets/chess/${f}` : `assets/chess/${look.pieces}/${f}`;
};

export async function mount(root, ctx) {
  const net = ctx.online || null; // online match against a real player
  let destroyed = false;
  let offEvents = () => {};
  let worker = null;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  } catch {}

  const startGame = async () => {
    root.replaceChildren();
    if (net) return play(net.seat === 0 ? 'w' : 'b', 'online', loadPrefs('chess', { help: 'on' }).help !== 'off');
    const opts = await setupScreen(root, {
      gameId: 'chess',
      title: txt('New game'),
      subtitle: txt('Choose a colour and the computer\'s level.'),
      groups: [
        { key: 'color', label: txt('You play'), value: 'w', options: [['w', txt('White')], ['b', txt('Black')], ['r', txt('Random')]] },
        { key: 'level', label: txt('Difficulty'), value: 'medium', options: Object.entries(LEVEL_NAMES) },
        { key: 'help', label: txt('Help for beginners'), value: 'on', options: [['on', txt('On')], ['off', txt('Off')]] },
      ],
    });
    if (destroyed) return;
    const human = opts.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : opts.color;
    play(human, opts.level, opts.help !== 'off');
  };

  function play(human, level, beginner = true) {
    ctx.newMatch();
    let st = fromFEN(START_FEN);
    let history = []; // {st, move, san}
    let reps = new Map([[positionKey(st), 1]]);
    let flipped = human === 'b';
    let selected = -1;
    let legal = legalMoves(st);
    let over = false;
    let thinking = false;
    let reqId = 0;
    let lastMove = null;
    let moveResolver = null; // online: waiting for the player's move
    let localAnim = true;
    const opp = net ? net.name(1 - net.seat) : txt('Computer');

    // ---------- DOM ----------
    const squaresEl = h('div', { class: 'cb-squares' });
    const piecesEl = h('div', { class: 'cb-pieces' });
    const board = h('div', { class: 'cb-board' }, squaresEl, piecesEl);
    const sqEls = [];
    for (let i = 0; i < 64; i++) {
      const el = h('div', { class: 'cb-sq' });
      sqEls.push(el);
      squaresEl.append(el);
    }
    const pieceEls = new Map();

    const aiBar = playerBar(net ? opp : txt('Computer · ') + LEVEL_NAMES[level], human === 'w' ? 'b' : 'w');
    const meBar = playerBar(ctx.user.displayName, human);
    const movesEl = h('ol', { class: 'cb-moves' });
    const statusEl = h('div', { class: 'g-status' });
    // help for beginners: the selected piece, pieces in danger and a suggested move
    const helpEl = beginner ? h('div', { class: 'cb-help' }) : null;
    let hint = null; // { move, text }
    let infoSq = -1; // the piece whose explanation is shown

    const undoBtn = h('button', { class: 'btn', onclick: undo }, icon('undo', 16), txt('Undo'));
    const flipBtn = h('button', { class: 'btn', onclick: () => { flipped = !flipped; renderAll(); } }, icon('flip', 16), txt('Flip'));
    const resignBtn = h('button', { class: 'btn btn-danger', onclick: resign }, icon('flag', 16), txt('Resign'));
    const newBtn = h('button', { class: 'btn', onclick: newGame }, icon('refresh', 16), txt('New game'));
    const drawBtn = h('button', { class: 'btn', onclick: offerDraw }, txt('½ Draw?'));
    const lookBtn = h('button', { class: 'btn', onclick: chooseLook }, txt('🎨 Style'));
    const tools = net ? [flipBtn, drawBtn, resignBtn, lookBtn, muteButton()] : [undoBtn, flipBtn, resignBtn, newBtn, lookBtn, muteButton()];
    // the coordinates are in the frame around the board
    const filesEl = h('div', { class: 'cb-files' }, Array.from({ length: 8 }, () => h('span')));
    const ranksEl = h('div', { class: 'cb-ranks' }, Array.from({ length: 8 }, () => h('span')));
    const frame = h('div', { class: 'cb-frame', 'data-theme': look.board }, ranksEl, board, filesEl);

    root.replaceChildren(
      h('div', { class: 'chess-layout' },
        h('div', { class: 'cb-col' }, aiBar.el, frame, meBar.el),
        h('aside', { class: 'cb-side glass' },
          statusEl,
          helpEl,
          h('div', { class: 'cb-moves-wrap' }, movesEl),
          h('div', { class: 'g-toolbar' }, tools),
        ),
      ),
    );

    function playerBar(name, color) {
      const caps = h('span', { class: 'cb-caps' });
      const el = h('div', { class: 'cb-player' },
        h('span', { class: `cb-swatch ${color}` }),
        h('span', { class: 'cb-name' }, name),
        caps,
      );
      return { el, caps, color };
    }

    // ---------- rendering ----------
    const view = (sq) => (flipped ? 63 - sq : sq);
    const placeEl = (el, sq) => {
      const v = view(sq);
      el.style.transform = `translate(${(v & 7) * 100}%, ${(v >> 3) * 100}%)`;
    };

    function renderSquares() {
      const checkSq = inCheck(st) ? kingSquare(st.board, st.turn) : -1;
      const myThreats = beginner && !over ? threats(st, human) : [];
      const danger = new Set(myThreats.map((t) => t.sq));
      renderHelp(myThreats);
      const targets = new Map();
      if (selected >= 0) for (const m of legal) if (m.from === selected) targets.set(m.to, !!m.captured);
      for (let sq = 0; sq < 64; sq++) {
        const v = view(sq);
        const el = sqEls[v];
        const r = sq >> 3, c = sq & 7;
        el.className = 'cb-sq ' + ((r + c) % 2 ? 'dark' : 'light');
        if (lastMove && (sq === lastMove.from || sq === lastMove.to)) el.classList.add('last');
        if (sq === selected) el.classList.add('sel');
        if (sq === checkSq) el.classList.add('check');
        if (targets.has(sq)) el.classList.add(targets.get(sq) ? 'cap' : 'dot');
        if (danger.has(sq)) el.classList.add('danger');
        if (hint && (sq === hint.move.from || sq === hint.move.to)) el.classList.add(sq === hint.move.from ? 'hint-from' : 'hint-to');
        el.dataset.sq = sq;
      }
      [...filesEl.children].forEach((x, i) => (x.textContent = 'abcdefgh'[flipped ? 7 - i : i]));
      [...ranksEl.children].forEach((x, i) => (x.textContent = flipped ? i + 1 : 8 - i));
    }

    // Choosing pieces and board – applied immediately and remembered.
    function chooseLook() {
      const apply = (patch) => {
        look = { ...look, ...patch };
        savePrefs('chess.look', look);
        frame.dataset.theme = look.board;
        rebuildPieces();
        renderInfo();
      };
      const preview = () => h('div', { class: 'look-pieces' }, ['K', 'Q', 'N', 'k', 'q', 'n'].map((p) => h('img', { src: pieceSrc(p), alt: '' })));
      let pv = preview();
      const box = h('div', { class: 'look-box' },
        h('div', { class: 'opt-group' }, h('span', null, txt('Pieces')),
          seg(Object.entries(PIECE_SETS), look.pieces, (v) => { apply({ pieces: v }); const n = preview(); pv.replaceWith(n); pv = n; })),
        pv,
        h('div', { class: 'opt-group' }, h('span', null, txt('Board')), seg(Object.entries(BOARD_THEMES), look.board, (v) => apply({ board: v }))),
      );
      modal({ title: txt('Board style'), body: box, actions: [{ label: txt('Done'), value: true, primary: true }], className: 'modal-wide' });
    }

    function rebuildPieces() {
      piecesEl.replaceChildren();
      pieceEls.clear();
      st.board.forEach((p, sq) => {
        if (!p) return;
        const el = h('img', { class: 'cb-piece', src: pieceSrc(p), alt: p, draggable: 'false' });
        placeEl(el, sq);
        piecesEl.append(el);
        pieceEls.set(sq, el);
      });
    }

    function renderInfo() {
      // captured pieces and material advantage
      const count = (b) => {
        const m = {};
        for (const p of b) if (p && p.toUpperCase() !== 'K') m[p] = (m[p] || 0) + 1;
        return m;
      };
      const now = count(st.board);
      const start = count(fromFEN(START_FEN).board);
      let mat = 0;
      for (const p of 'PNBRQ') mat += ((now[p] || 0) - (now[p.toLowerCase()] || 0)) * PIECE_VAL[p];
      for (const bar of [aiBar, meBar]) {
        const enemyCase = bar.color === 'w' ? (x) => x.toLowerCase() : (x) => x;
        bar.caps.replaceChildren();
        for (const t of 'QRBNP') {
          const p = enemyCase(t);
          const lost = (start[p] || 0) - (now[p] || 0);
          for (let i = 0; i < lost; i++) bar.caps.append(h('img', { src: pieceSrc(p), alt: '' }));
        }
        const adv = bar.color === 'w' ? mat : -mat;
        if (adv > 0) bar.caps.append(h('span', { class: 'adv' }, '+' + adv));
        bar.el.classList.toggle('to-move', !over && st.turn === bar.color);
      }
      // moves
      movesEl.replaceChildren();
      for (let i = 0; i < history.length; i += 2) {
        movesEl.append(h('li', null,
          h('span', { class: 'mv' }, history[i].san),
          history[i + 1] ? h('span', { class: 'mv' }, history[i + 1].san) : '',
        ));
      }
      movesEl.lastElementChild?.scrollIntoView({ block: 'nearest', inline: 'end' });
      undoBtn.disabled = thinking || over || history.length < (human === 'w' ? 1 : 2);
      resignBtn.disabled = over;
      drawBtn.disabled = over;
      if (!over) {
        statusEl.textContent = thinking ? txt('The computer is thinking…')
          : st.turn === human ? (inCheck(st) ? txt('Check! It\'s your move.') : txt('Your move'))
          : net ? txt('{0} to move…', opp) : '';
      }
    }

    function renderHelp(myThreats) {
      if (!helpEl) return;
      const sq = infoSq >= 0 ? infoSq : selected;
      const p = sq >= 0 ? st.board[sq] : null;
      const info = p ? PIECES[p.toLowerCase()] : null;
      const myTurn = !over && !thinking && st.turn === human;
      helpEl.replaceChildren(...[
        info ? h('div', { class: 'cb-help-piece' }, h('img', { src: pieceSrc(p), alt: '' }), h('div', null, h('b', null, info.name), h('p', null, info.moves)))
          : h('p', { class: 'muted' }, txt('Tap or point at a piece to see how it moves. The dots show where it can go.')),
        myThreats.length ? h('p', { class: 'cb-help-danger' }, txt('⚠ In danger: {0}', myThreats.map((t) => `${PIECES[t.piece.toLowerCase()].name} ${'abcdefgh'[t.sq & 7]}${8 - (t.sq >> 3)}`).join(', '))) : null,
        myTurn && h('button', { class: 'btn btn-sm', onclick: () => {
          hint = suggest(st);
          renderSquares();
        } }, txt('💡 Hint')),
        hint && myTurn && h('p', { class: 'cb-help-hint' }, '💡 ' + hint.text),
      ].filter(Boolean));
    }

    function renderAll() {
      renderSquares();
      rebuildPieces();
      renderInfo();
    }

    // ---------- moves ----------
    function applyMove(m, animate = true) {
      hint = null;
      const san = toSAN(st, m, legal);
      history.push({ st, move: m, san });
      // piece animation
      const el = pieceEls.get(m.from);
      const capSq = m.flag === 'ep' ? m.to + (st.turn === 'w' ? 8 : -8) : m.to;
      const capEl = m.captured ? pieceEls.get(capSq) : null;
      if (capEl) {
        capEl.classList.add('gone');
        setTimeout(() => capEl.remove(), 250);
        pieceEls.delete(capSq);
      }
      if (el) {
        if (!animate) {
          el.classList.add('no-anim');
          requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('no-anim')));
        }
        placeEl(el, m.to);
        pieceEls.delete(m.from);
        pieceEls.set(m.to, el);
        if (m.promo) setTimeout(() => (el.src = pieceSrc(st.turn === 'w' ? m.promo.toUpperCase() : m.promo)), 150);
      }
      if (m.flag === 'castleK' || m.flag === 'castleQ') {
        const [rf, rt] = m.flag === 'castleK' ? [m.to + 1, m.to - 1] : [m.to - 2, m.to + 1];
        const rEl = pieceEls.get(rf);
        if (rEl) {
          placeEl(rEl, rt);
          pieceEls.delete(rf);
          pieceEls.set(rt, rEl);
        }
      }
      st = makeMove(st, m);
      lastMove = m;
      selected = -1;
      legal = legalMoves(st);
      const key = positionKey(st);
      reps.set(key, (reps.get(key) || 0) + 1);
      sound(inCheck(st) ? 'check' : m.captured ? 'capture' : 'move');
      renderSquares();
      renderInfo();
      checkEnd();
    }

    function checkEnd() {
      const res = gameStatus(st, reps.get(positionKey(st)));
      if (!res) {
        if (!net && st.turn !== human) aiMove();
        return;
      }
      finish(res.reason, res.winner);
    }

    async function finish(reason, winner) {
      if (over) return;
      over = true;
      thinking = false;
      net?.finish();
      renderInfo();
      const outcome = !winner ? 'draw' : winner === human ? 'win' : 'loss';
      const moves = Math.ceil(history.length / 2);
      statusEl.textContent = `${REASONS[reason]} – ${{ win: txt('you win!'), loss: txt('{0} wins.', net ? opp : txt('the computer')), draw: txt('draw.') }[outcome]}`;
      if (reason === 'desync') return;
      await ctx.report(outcome, net
        ? { summary: txt('Online against {0} · {1} · {2} moves', opp, REASONS[reason], moves), online: true, opponent: opp, color: human }
        : { summary: txt('{0} · {1} · {2} moves', REASONS[reason], LEVEL_NAMES[level], moves), level, color: human });
      if (destroyed) return;
      const choice = await showResult({ outcome, text: txt('{0} after {1} moves.', REASONS[reason], moves), again: net ? txt('Rematch') : undefined });
      if (choice === 'again') net ? net.rematch() : startGame();
      else if (choice === 'exit') location.hash = net ? '#/online/chess' : '#/';
    }

    // ---------- online ----------
    const findLegal = (d) => d && legal.find((x) => x.from === d.from && x.to === d.to && (x.promo || null) === (d.promo || null));
    async function turnLoop() {
      while (!over && !destroyed) {
        const seat = st.turn === 'w' ? 0 : 1;
        const mine = st.turn === human;
        const mv = await net.decide(seat, 'move', () => new Promise((r) => (moveResolver = r)), (d) => !!findLegal(d));
        if (over || destroyed) return;
        moveResolver = null;
        applyMove(findLegal(mv), mine ? localAnim : true);
      }
    }
    async function offerDraw() {
      if (over) return;
      net.offerDraw();
      toast(txt('You offered a draw.'));
    }
    offEvents();
    offEvents = net ? net.onEvent(async (e) => {
      if (destroyed) return;
      const mine = net.seat;
      if (e.kind === 'resign') finish('resign', e.seat === 0 ? 'b' : 'w');
      else if (e.kind === 'forfeit') finish(e.reason === 'stall' ? 'stall' : 'abandon', e.winner === 0 ? 'w' : 'b');
      else if (e.kind === 'draw') finish('agreement', null);
      else if (e.kind === 'desync') finish('desync', null);
      else if (e.kind === 'draw-declined' && e.seat !== mine) toast(txt('The opponent declined the draw.'));
      else if (e.kind === 'draw-offer' && e.seat !== mine) {
        net.answerDraw(await confirmDialog(txt('Draw offer'), txt('{0} offers a draw. Do you accept?', opp), txt('Accept')));
      }
    }) : () => {};

    function aiMove() {
      thinking = true;
      renderInfo();
      const id = ++reqId;
      const fen = toFEN(st);
      const started = Date.now();
      const done = (mv) => {
        if (destroyed || id !== reqId || over) return;
        const wait = Math.max(0, 350 - (Date.now() - started));
        setTimeout(() => {
          if (destroyed || id !== reqId || over) return;
          thinking = false;
          const m = legal.find((x) => x.from === mv.from && x.to === mv.to && (x.promo || null) === (mv.promo || null)) || legal[0];
          applyMove(m);
        }, wait);
      };
      if (worker) {
        worker.onmessage = (e) => e.data.id === id && done(e.data.move);
        worker.postMessage({ fen, level, id });
      } else {
        setTimeout(() => done(search(fromFEN(fen), LEVELS[level])), 30);
      }
    }

    async function tryHumanMove(from, to, animate = true) {
      const cands = legal.filter((m) => m.from === from && m.to === to);
      if (!cands.length) return false;
      let m = cands[0];
      if (cands.length > 1) {
        const promo = await pickPromotion(to);
        if (!promo) return false;
        m = cands.find((x) => x.promo === promo);
      }
      if (beginner) {
        // warn before a move that loses material or allows a mate in one
        const b = blunder(st, m);
        if (b && !(await confirmDialog(txt('⚠ Careful!'), blunderText(b), txt('Play it anyway')))) return false;
      }
      hint = null;
      infoSq = -1;
      if (net) {
        if (!moveResolver) return false;
        localAnim = animate;
        moveResolver({ from: m.from, to: m.to, promo: m.promo || null });
        return true;
      }
      applyMove(m, animate);
      return true;
    }

    function pickPromotion(to) {
      return new Promise((resolve) => {
        const v = view(to);
        const picker = h('div', { class: 'cb-promo', style: { left: `${(v & 7) * 12.5}%`, [v >> 3 === 0 ? 'top' : 'bottom']: '0' } },
          ['q', 'r', 'b', 'n'].map((p) =>
            h('button', { onclick: () => { picker.remove(); resolve(p); } },
              h('img', { src: pieceSrc(human === 'w' ? p.toUpperCase() : p), alt: p })),
          ),
        );
        const cancel = h('div', { class: 'cb-promo-shade', onclick: () => { picker.remove(); cancel.remove(); resolve(null); } });
        picker.addEventListener('click', () => cancel.remove());
        board.append(cancel, picker);
      });
    }

    // ---------- input (click and drag) ----------
    let drag = null;
    const sqFromPoint = (x, y) => {
      const r = board.getBoundingClientRect();
      const c = Math.floor(((x - r.left) / r.width) * 8);
      const rr = Math.floor(((y - r.top) / r.height) * 8);
      if (c < 0 || c > 7 || rr < 0 || rr > 7) return -1;
      return view(rr * 8 + c);
    };

    board.addEventListener('pointerdown', (e) => {
      if (over || thinking || st.turn !== human || e.button > 0) return;
      const sq = sqFromPoint(e.clientX, e.clientY);
      if (sq < 0) return;
      const p = st.board[sq];
      if (selected >= 0 && sq !== selected && legal.some((m) => m.from === selected && m.to === sq)) {
        tryHumanMove(selected, sq);
        return;
      }
      if (p && colorOf(p) === human) {
        const wasSelected = selected === sq;
        selected = sq;
        renderSquares();
        const el = pieceEls.get(sq);
        if (el) {
          const r = board.getBoundingClientRect();
          drag = { sq, el, startX: e.clientX, startY: e.clientY, moved: false, size: r.width / 8, r, wasSelected };
          board.setPointerCapture(e.pointerId);
        }
      } else if (selected >= 0) {
        selected = -1;
        renderSquares();
      }
    });

    board.addEventListener('pointermove', (e) => {
      if (helpEl && !drag && e.pointerType === 'mouse') {
        const sq = sqFromPoint(e.clientX, e.clientY);
        const nsq = sq >= 0 && st.board[sq] ? sq : -1;
        if (nsq !== infoSq) { infoSq = nsq; renderHelp(beginner && !over ? threats(st, human) : []); }
      }
      if (!drag) return;
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      drag.el.classList.add('dragging');
      const x = e.clientX - drag.r.left - drag.size / 2;
      const y = e.clientY - drag.r.top - drag.size / 2;
      drag.el.style.transform = `translate(${x}px, ${y}px) scale(1.12)`;
    });

    const endDrag = async (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      d.el.classList.remove('dragging');
      if (!d.moved) {
        if (d.wasSelected) {
          selected = -1;
          renderSquares();
        }
        return;
      }
      const to = sqFromPoint(e.clientX, e.clientY);
      const isLegal = to >= 0 && legal.some((m) => m.from === d.sq && m.to === to);
      if (!isLegal || !(await tryHumanMove(d.sq, to, false))) placeEl(d.el, d.sq);
    };
    board.addEventListener('pointerup', endDrag);
    board.addEventListener('pointerleave', () => { if (helpEl && infoSq >= 0) { infoSq = -1; renderHelp(threats(st, human)); } });
    board.addEventListener('pointercancel', endDrag);

    // ---------- buttons ----------
    function undo() {
      if (thinking || over) return;
      let n = st.turn === human ? 2 : 1;
      while (n-- > 0 && history.length) {
        const last = history.pop();
        const k = positionKey(st);
        reps.set(k, reps.get(k) - 1);
        st = last.st;
      }
      lastMove = history.length ? history[history.length - 1].move : null;
      legal = legalMoves(st);
      selected = -1;
      renderAll();
      if (st.turn !== human) aiMove();
    }

    async function resign() {
      if (over) return;
      if (!(await confirmDialog(txt('Resign'), txt('Are you sure you want to resign? The game will count as a loss.'), txt('Resign'), true))) return;
      reqId++;
      if (net) net.resign(); // the event ends the game for both players
      else finish('resign', human === 'w' ? 'b' : 'w');
    }

    async function newGame() {
      if (!over && history.length > 0 &&
          !(await confirmDialog(txt('New game'), txt('The current game will be stopped without being counted. Continue?')))) return;
      reqId++;
      over = true;
      startGame();
    }

    renderAll();
    if (net) turnLoop();
    else if (st.turn !== human) aiMove();
  }

  startGame();

  return {
    destroy() {
      destroyed = true;
      offEvents();
      worker?.terminate();
    },
  };
}
