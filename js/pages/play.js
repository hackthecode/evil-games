import { session, navigate } from '../app.js';
import { store } from '../store/index.js';
import { gameById } from '../games/registry.js';
import { h, modal, toast, fmtClock } from '../ui.js';
import { icon } from '../icons.js';
import { runOnline } from './room-ui.js';
import { social } from '../net/social.js';
import { txt } from '../i18n.js';

const FLUSH_EVERY_MS = 30000;
const IDLE_AFTER_MS = 5 * 60000; // no action for 5 min -> we don't count time

export async function renderPlay(view, gameId, query) {
  const game = gameById(gameId);
  if (!game) return navigate('/');
  const roomId = game.online && query?.get('room');
  const user = session.user;

  // --- Tracking active time in a game ---
  let pendingMs = 0;
  let sessionMs = 0;
  let matchMs = 0;
  let last = performance.now();
  let lastInput = Date.now();
  const clockEl = h('span', { class: 'clock-val' }, '00:00');

  const tick = () => {
    const now = performance.now();
    const dt = Math.min(now - last, 5000);
    last = now;
    if (document.hidden || Date.now() - lastInput > IDLE_AFTER_MS) return;
    pendingMs += dt;
    sessionMs += dt;
    matchMs += dt;
    clockEl.textContent = fmtClock(sessionMs);
  };
  const flush = async () => {
    tick();
    const ms = pendingMs;
    pendingMs = 0;
    if (ms > 500) {
      try {
        await store.addTime(user.id, gameId, ms);
      } catch {
        pendingMs += ms;
      }
    }
  };
  const onInput = () => (lastInput = Date.now());
  const onVis = () => {
    last = performance.now();
    if (document.hidden) flush();
  };
  const tickTimer = setInterval(tick, 1000);
  const flushTimer = setInterval(flush, FLUSH_EVERY_MS);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', flush);
  window.addEventListener('pointerdown', onInput, true);
  window.addEventListener('keydown', onInput, true);

  const ctx = {
    user,
    gameId,
    toast,
    modal,
    // The game calls this at the start of every new match.
    newMatch() {
      tick();
      matchMs = 0;
    },
    // Saves the result of a finished match: 'win' | 'loss' | 'draw'.
    async report(result, meta = {}) {
      tick();
      try {
        await store.recordGame(user.id, gameId, { result, durationMs: matchMs, meta });
        await flush();
      } catch (e) {
        toast(txt('The result was not saved: ') + e.message, 'error');
      }
      matchMs = 0;
    },
  };

  const root = h('div', { class: `game-root game-${gameId}` });
  const bar = h('div', { class: 'play-bar' },
        h('a', { href: roomId ? `#/online/${gameId}` : '#/', class: 'icon-btn', 'aria-label': txt('Back') }, icon('back')),
        h('h1', { class: 'play-title' }, game.name, roomId && h('span', { class: 'online-badge' }, txt('online'))),
        h('span', { class: 'clock', title: txt('Time played (this session)') }, icon('clock', 16), clockEl),
        h('button', {
          class: 'icon-btn', 'aria-label': txt('Rules'), title: txt('Rules'),
          onclick: () => modal({ title: txt('Rules – {0}', game.name), body: h('div', { class: 'rules', html: game.rules }), className: 'modal-wide' }),
        }, icon('help')),
  );
  view.append(h('section', { class: 'play', style: { '--accent-g': game.accent } }, bar, root));

  let instance;
  let online = null;
  social.setWhere({ game: gameId, room: roomId || null });
  try {
    const mod = await game.load();
    if (roomId) {
      online = await runOnline({ root, bar, game, ctx, user, roomId, mountGame: (octx) => mod.mount(root, octx) });
    } else {
      instance = await mod.mount(root, ctx);
    }
  } catch (e) {
    console.error(e);
    root.append(h('p', { class: 'empty' }, txt('The game could not load: ') + e.message));
  }

  return async () => {
    clearInterval(tickTimer);
    clearInterval(flushTimer);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', flush);
    window.removeEventListener('pointerdown', onInput, true);
    window.removeEventListener('keydown', onInput, true);
    instance?.destroy?.();
    social.setWhere(null);
    await online?.cleanup();
    await flush();
  };
}
