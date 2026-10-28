// Онлайн стая в страницата за игра: избор на места, старт, ленти за връзката,
// бързи реакции и превключване към играта, когато мачът започне.
import { navigate } from '../app.js';
import { Room, ACTIVE_KEY } from '../net/room.js';
import { seg } from '../games/common.js';
import { NEW_ROOM_KEY, optsText, localNetNotice } from './online.js';
import { INVITE_AFTER_KEY } from './friends.js';
import { social } from '../net/social.js';
import { store } from '../store/index.js';
import { h, toast, avatar, modal } from '../ui.js';
import { icon } from '../icons.js';

const EMOTES = ['👍', '😈', '😂', '😮', '🔥', 'Добра игра!'];

export async function runOnline({ root, bar, game, ctx, user, roomId, mountGame }) {
  let pending = null;
  try {
    const p = JSON.parse(sessionStorage.getItem(NEW_ROOM_KEY) || 'null');
    if (p && p.id === roomId && p.game === game.id) pending = p;
  } catch {}
  sessionStorage.removeItem(NEW_ROOM_KEY);

  const room = new Room({ id: roomId, game, user, create: !!pending, opts: pending?.opts || {} });
  const lobbyHref = `#/online/${game.id}`;
  let instance = null;
  let gone = false;

  // ---------- лента над играта ----------
  const dot = h('span', { class: 'net-dot' });
  const netLabel = h('span', null, 'Свързване…');
  const emoteBtn = h('button', { class: 'icon-btn', title: 'Реакция', 'aria-label': 'Реакция', onclick: openEmotes }, '😈');
  const chip = h('span', { class: 'net-chip' }, dot, netLabel);
  bar.querySelector('.clock')?.before(chip, emoteBtn);
  const banner = h('div', { class: 'net-banner', hidden: true });
  root.before(banner);

  function openEmotes() {
    if (!room.inMatch()) return;
    const pop = h('div', { class: 'emote-pop' },
      EMOTES.map((e) => h('button', { onclick: () => { room.emote(e); pop.remove(); } }, e)));
    const close = (ev) => {
      if (!pop.contains(ev.target)) {
        pop.remove();
        document.removeEventListener('pointerdown', close, true);
      }
    };
    document.addEventListener('pointerdown', close, true);
    emoteBtn.after(pop);
  }

  const showBanner = (html, actions = []) => {
    banner.hidden = !html;
    banner.replaceChildren();
    if (html) banner.append(h('span', { html }), ...actions);
  };

  const updateChip = () => {
    if (!room.info) return;
    const others = room.humanUids().filter((u) => u !== user.id);
    const allIn = others.every((u) => room.isPresent(u));
    dot.className = 'net-dot ' + (allIn ? 'ok' : 'warn');
    netLabel.textContent = `Онлайн · ${room.id}`;
  };

  // ---------- стаята преди мача ----------
  function renderRoom() {
    if (instance || gone || room.inMatch()) return;
    updateChip();
    const info = room.info;
    if (!info) {
      root.replaceChildren(h('div', { class: 'g-setup' }, h('div', { class: 'g-setup-card glass' },
        h('h2', null, 'Свързване със стаята…'),
        h('p', { class: 'muted' }, `Код: ${roomId}. Ако стаята не съществува или домакинът е излязъл, върнете се в лобито.`),
        h('a', { class: 'btn', href: lobbyHref }, icon('back', 16), 'Към лобито'),
      )));
      return;
    }
    const mine = room.mySeat();
    if (info.status === 'playing' && mine < 0) {
      root.replaceChildren(h('div', { class: 'g-setup' }, h('div', { class: 'g-setup-card glass' },
        h('h2', null, 'Мачът вече е започнал'),
        h('p', { class: 'muted' }, 'В тази стая вече се играе. Създайте нова стая или изберете друга.'),
        h('a', { class: 'btn btn-primary', href: lobbyHref }, 'Към лобито'),
      )));
      return;
    }
    const link = `${location.origin}${location.pathname}#/play/${game.id}?room=${room.id}`;
    const cfg = game.online;
    const seats = info.seats.map((s, i) => {
      const here = s && room.isPresent(s.uid);
      return h('div', { class: `seat-card ${s ? 'taken' : ''} ${i === mine ? 'me' : ''}` },
        h('span', { class: 'seat-label' }, cfg.seatNames[i]),
        s
          ? h('div', { class: 'seat-who' }, avatar({ displayName: s.name, color: s.color }, 34),
              h('b', null, s.name), h('span', { class: `net-dot ${here ? 'ok' : 'warn'}` }))
          : h('div', { class: 'seat-who muted' }, cfg.bots ? [icon('bot', 22), 'Свободно (бот)'] : cfg.race ? 'Свободно (по желание)' : 'Свободно'),
        !s && h('button', { class: 'btn btn-sm', onclick: () => room.sit(i) }, 'Седни тук'),
      );
    });
    const host = room.isHost();
    const optsEl = (cfg.options || []).length
      ? host
        ? cfg.options.map((g) => h('div', { class: 'opt-group' }, h('span', null, g.label),
            seg(g.options, info.opts[g.key], (v) => room.setOpts({ [g.key]: v }))))
        : h('p', { class: 'muted' }, optsText(game, info.opts))
      : null;
    const humans = room.humanUids().length;
    const need = cfg.bots || cfg.race ? cfg.minHumans : cfg.seats;
    root.replaceChildren(h('div', { class: 'g-setup' }, h('div', { class: 'g-setup-card glass room-card' },
      h('div', null,
        h('h2', null, `Стая ${room.id}`),
        h('p', { class: 'muted', style: { margin: '6px 0 0' } }, host ? 'Вие сте домакин. Поканете приятел с връзката.' : 'Чакаме домакина да започне.'),
      ),
      localNetNotice(),
      h('div', { class: 'invite' },
        h('input', { value: link, readonly: true, 'aria-label': 'Връзка за покана', onclick: (e) => e.target.select() }),
        h('button', {
          class: 'btn', onclick: async () => {
            try {
              if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: `${game.name} – Evil Games`, url: link });
              else {
                await navigator.clipboard.writeText(link);
                toast('Връзката е копирана.', 'success');
              }
            } catch {}
          },
        }, icon('link', 16), 'Връзка'),
        h('button', { class: 'btn btn-primary', onclick: inviteFriend }, icon('users', 16), 'Покани приятел'),
      ),
      h('div', { class: `seat-grid n${cfg.seats}` }, seats),
      optsEl,
      host
        ? h('button', { class: 'btn btn-primary btn-lg btn-block', disabled: !room.canStart(), onclick: () => room.start() },
            icon('play', 18), humans < need ? `Нужни са поне ${need} играчи` : 'Започни мача')
        : h('p', { class: 'muted center' }, mine >= 0 ? 'Готови сте. Мачът започва, когато домакинът натисне „Започни“.' : 'Изберете свободно място.'),
      h('a', { class: 'btn btn-ghost btn-block', href: lobbyHref }, icon('back', 16), 'Напусни стаята'),
    )));
  }

  // Покана към приятел на линия: избор от списъка и съобщение в неговата кутия.
  async function inviteFriend() {
    const friends = (await store.listFriends(user.id)).filter((f) => f.status === 'friend');
    const on = friends.filter((f) => social.isOnline(f.user.id));
    if (!on.length) {
      toast(friends.length ? 'Никой от приятелите ви не е на линия.' : 'Още нямате приятели – добавете ги от „Приятели“.');
      return;
    }
    const uid = await modal({
      title: 'Покани приятел',
      body: h('p', { class: 'muted' }, 'Приятели на линия:'),
      actions: [...on.map((f) => ({ label: f.user.displayName, value: f.user.id })), { label: 'Отказ', value: null }],
    });
    if (!uid) return;
    await social.invite(uid, { game: game.id, gameName: game.name, room: room.id });
    toast('Поканата е изпратена.', 'success');
  }

  const ratedInfo = () => room.ratedInfo();
  let rated = false;
  const rate = async (outcome) => {
    const info = ratedInfo();
    if (rated || !info) return;
    rated = true;
    try {
      await store.reportRated({ userId: user.id, game: game.id, outcome, ...info });
    } catch (e) {
      console.warn('rating', e);
    }
  };
  // онлайн резултатите отиват и в рейтинга
  const ratedCtx = {
    ...ctx,
    async report(outcome, meta) {
      await ctx.report(outcome, meta);
      await rate(outcome);
    },
  };

  // ---------- мач ----------
  async function startGame(resumed) {
    instance?.destroy?.();
    instance = null;
    showBanner('');
    root.replaceChildren();
    updateChip();
    if (!resumed) ctx.newMatch();
    rated = false;
    const onlineCtx = { ...ratedCtx, online: room.api() };
    instance = await mountGame(onlineCtx);
  }

  const seatName = (i) => room.seatName(i);
  room.on(async (e) => {
    if (gone) return;
    switch (e.type) {
      case 'room':
      case 'presence':
        updateChip();
        if (!instance) renderRoom();
        break;
      case 'starting':
        if (instance) break;
        root.replaceChildren(h('div', { class: 'g-setup' }, h('div', { class: 'g-setup-card glass' }, h('h2', null, 'Мачът започва…'))));
        break;
      case 'match':
        startGame(e.resumed);
        break;
      case 'absent':
        if (e.left > 0) {
          const verdict = game.online.seats === 2 ? 'служебна победа за вас' : 'мястото се поема от бот';
          showBanner(`<b>${esc(seatName(e.seat))}</b> прекъсна връзката. Изчакваме… ${Math.ceil(e.left / 1000)} с, след това – ${verdict}.`);
        } else showBanner('');
        break;
      case 'takeover':
        toast(`${seatName(e.seat)} е заменен от бот.`);
        showBanner('');
        break;
      case 'stall':
        showBanner(`<b>${esc(seatName(e.seat))}</b> не е играл отдавна.`, [
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => { room.claim('stall'); showBanner(''); } }, 'Поискай служебна победа'),
        ]);
        break;
      case 'emote':
        toast(`${seatName(e.seat)}: ${e.text}`);
        break;
      case 'votes': {
        const waiting = room.humanUids().filter((u) => !room.votes.has(u));
        if (room.votes.has(user.id) && waiting.length) showBanner('Чакаме другите играчи да приемат реванша…');
        else if (!room.votes.has(user.id) && room.votes.size) showBanner('Противникът иска реванш.', [
          h('button', { class: 'btn btn-sm btn-primary', onclick: () => room.rematch() }, 'Реванш'),
        ]);
        break;
      }
      case 'ended':
        updateChip();
        break;
      case 'error':
        toast(e.message, 'error', 5000);
        break;
    }
  });

  try {
    await room.connect();
  } catch (e) {
    root.replaceChildren(h('p', { class: 'empty' }, 'Няма връзка: ' + e.message));
    return { cleanup: async () => {} };
  }
  renderRoom();
  // покана, поискана от страницата „Приятели“ при създаване на стаята
  try {
    const inv = JSON.parse(sessionStorage.getItem(INVITE_AFTER_KEY) || 'null');
    if (inv?.room === room.id) {
      sessionStorage.removeItem(INVITE_AFTER_KEY);
      social.send(inv.uid, { kind: inv.kind || 'invite', game: game.id, gameName: game.name, room: room.id })
        .then(() => toast(`Поканата до ${inv.name} е изпратена.`, 'success'))
        .catch(() => {});
    }
  } catch {}
  // ако никой не отговори, но аз съм създателят – стаята вече е готова
  setTimeout(() => !instance && renderRoom(), 1500);

  return {
    room,
    async cleanup() {
      gone = true;
      instance?.destroy?.();
      if (room.inMatch() && room.mySeat() >= 0) {
        const info = ratedInfo();
        room.resign();
        await ctx.report('loss', { summary: `Онлайн · напуснат мач`, online: true });
        if (info && !rated) store.reportRated({ userId: user.id, game: game.id, outcome: 'loss', ...info }).catch(() => {});
      }
      localStorage.removeItem(ACTIVE_KEY);
      await room.leave();
    },
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Незавършен онлайн мач (затворен раздел и т.н.): предлагаме връщане,
// а ако е изоставен отдавна – отчитаме загуба.
export async function checkAbandoned(store, user) {
  let a;
  try { a = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null'); } catch {}
  if (!a || !user) return;
  if (location.hash.includes(`room=${a.room}`)) return;
  const rateLoss = () => a.rated && store.reportRated({ userId: user.id, game: a.game, outcome: 'loss', ...a.rated }).catch(() => {});
  if (Date.now() - a.at > 5 * 60000) {
    localStorage.removeItem(ACTIVE_KEY);
    try {
      await store.recordGame(user.id, a.game, { result: 'loss', meta: { summary: 'Онлайн · изоставен мач', online: true } });
      rateLoss();
    } catch {}
    toast('Незавършен онлайн мач беше отчетен като загуба.', 'error', 4000);
    return;
  }
  const choice = await modal({
    title: 'Незавършен онлайн мач',
    body: h('p', null, 'Имате започнат онлайн мач. Върнете се, преди противникът да получи служебна победа.'),
    actions: [{ label: 'Откажи се (загуба)', value: 'quit' }, { label: 'Върни се', value: 'back', primary: true }],
  });
  if (choice === 'back') navigate(`/play/${a.game}?room=${a.room}`);
  else if (choice === 'quit') {
    localStorage.removeItem(ACTIVE_KEY);
    try {
      await store.recordGame(user.id, a.game, { result: 'loss', meta: { summary: 'Онлайн · изоставен мач', online: true } });
      rateLoss();
    } catch {}
  }
}
