// Online room on the game page: choosing seats, start, connection bars,
// quick reactions and switching to the game when the match starts.
import { navigate } from '../app.js';
import { Room, ACTIVE_KEY } from '../net/room.js';
import { seg } from '../games/common.js';
import { NEW_ROOM_KEY, optsText, localNetNotice } from './online.js';
import { INVITE_AFTER_KEY } from './friends.js';
import { social } from '../net/social.js';
import { store } from '../store/index.js';
import { h, toast, avatar, modal } from '../ui.js';
import { icon } from '../icons.js';
import { txt } from '../i18n.js';

const EMOTES = ['👍', '😈', '😂', '😮', '🔥', txt('Good game!')];

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

  // ---------- bar above the game ----------
  const dot = h('span', { class: 'net-dot' });
  const netLabel = h('span', null, txt('Connecting…'));
  const emoteBtn = h('button', { class: 'icon-btn', title: txt('Reaction'), 'aria-label': txt('Reaction'), onclick: openEmotes }, '😈');
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
    netLabel.textContent = txt('Online · {0}', room.id);
  };

  // ---------- the room before the match ----------
  function renderRoom() {
    if (instance || gone || room.inMatch()) return;
    updateChip();
    const info = room.info;
    if (!info) {
      root.replaceChildren(h('div', { class: 'g-setup' }, h('div', { class: 'g-setup-card glass' },
        h('h2', null, txt('Connecting to the room…')),
        h('p', { class: 'muted' }, txt('Code: {0}. If the room doesn\'t exist or the host has left, go back to the lobby.', roomId)),
        h('a', { class: 'btn', href: lobbyHref }, icon('back', 16), txt('To the lobby')),
      )));
      return;
    }
    const mine = room.mySeat();
    if (info.status === 'playing' && mine < 0) {
      root.replaceChildren(h('div', { class: 'g-setup' }, h('div', { class: 'g-setup-card glass' },
        h('h2', null, txt('The match has already started')),
        h('p', { class: 'muted' }, txt('A game is already being played in this room. Create a new room or choose another one.')),
        h('a', { class: 'btn btn-primary', href: lobbyHref }, txt('To the lobby')),
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
          : h('div', { class: 'seat-who muted' }, cfg.bots ? [icon('bot', 22), txt('Free (bot)')] : cfg.race ? txt('Free (optional)') : txt('Free')),
        !s && h('button', { class: 'btn btn-sm', onclick: () => room.sit(i) }, txt('Sit here')),
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
        h('h2', null, txt('Room {0}', room.id)),
        h('p', { class: 'muted', style: { margin: '6px 0 0' } }, host ? txt('You are the host. Invite a friend with the link.') : txt('Waiting for the host to start.')),
      ),
      localNetNotice(),
      h('div', { class: 'invite' },
        h('input', { value: link, readonly: true, 'aria-label': txt('Invitation link'), onclick: (e) => e.target.select() }),
        h('button', {
          class: 'btn', onclick: async () => {
            try {
              if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: `${game.name} – Evil Games`, url: link });
              else {
                await navigator.clipboard.writeText(link);
                toast(txt('The link has been copied.'), 'success');
              }
            } catch {}
          },
        }, icon('link', 16), txt('Link')),
        h('button', { class: 'btn btn-primary', onclick: inviteFriend }, icon('users', 16), txt('Invite a friend')),
      ),
      h('div', { class: `seat-grid n${cfg.seats}` }, seats),
      optsEl,
      host
        ? h('button', { class: 'btn btn-primary btn-lg btn-block', disabled: !room.canStart(), onclick: () => room.start() },
            icon('play', 18), humans < need ? txt('At least {0} players are needed', need) : txt('Start the match'))
        : h('p', { class: 'muted center' }, mine >= 0 ? txt('You are ready. The match starts when the host presses "Start".') : txt('Choose a free seat.')),
      h('a', { class: 'btn btn-ghost btn-block', href: lobbyHref }, icon('back', 16), txt('Leave the room')),
    )));
  }

  // Invitation to a friend who is online: choosing from the list and a message to their mailbox.
  async function inviteFriend() {
    const friends = (await store.listFriends(user.id)).filter((f) => f.status === 'friend');
    const on = friends.filter((f) => social.isOnline(f.user.id));
    if (!on.length) {
      toast(friends.length ? txt('None of your friends are online.') : txt('You have no friends yet – add them from "Friends".'));
      return;
    }
    const uid = await modal({
      title: txt('Invite a friend'),
      body: h('p', { class: 'muted' }, txt('Friends online:')),
      actions: [...on.map((f) => ({ label: f.user.displayName, value: f.user.id })), { label: txt('Cancel'), value: null }],
    });
    if (!uid) return;
    await social.invite(uid, { game: game.id, gameName: game.name, room: room.id });
    toast(txt('The invitation has been sent.'), 'success');
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
  // online results also go into the rating
  const ratedCtx = {
    ...ctx,
    async report(outcome, meta) {
      await ctx.report(outcome, meta);
      await rate(outcome);
    },
  };

  // ---------- match ----------
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
        root.replaceChildren(h('div', { class: 'g-setup' }, h('div', { class: 'g-setup-card glass' }, h('h2', null, txt('The match is starting…')))));
        break;
      case 'match':
        startGame(e.resumed);
        break;
      case 'absent':
        if (e.left > 0) {
          const verdict = game.online.seats === 2 ? txt('a forfeit win for you') : txt('a bot takes over the seat');
          showBanner(txt('<b>{0}</b> lost the connection. Waiting… {1} s, then – {2}.', esc(seatName(e.seat)), Math.ceil(e.left / 1000), verdict));
        } else showBanner('');
        break;
      case 'takeover':
        toast(txt('{0} has been replaced by a bot.', seatName(e.seat)));
        showBanner('');
        break;
      case 'stall':
        showBanner(txt('<b>{0}</b> hasn\'t played for a while.', esc(seatName(e.seat))), [
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => { room.claim('stall'); showBanner(''); } }, txt('Claim a forfeit win')),
        ]);
        break;
      case 'emote':
        toast(`${seatName(e.seat)}: ${e.text}`);
        break;
      case 'votes': {
        const waiting = room.humanUids().filter((u) => !room.votes.has(u));
        if (room.votes.has(user.id) && waiting.length) showBanner(txt('Waiting for the other players to accept the rematch…'));
        else if (!room.votes.has(user.id) && room.votes.size) showBanner(txt('The opponent wants a rematch.'), [
          h('button', { class: 'btn btn-sm btn-primary', onclick: () => room.rematch() }, txt('Rematch')),
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
    root.replaceChildren(h('p', { class: 'empty' }, txt('No connection: ') + e.message));
    return { cleanup: async () => {} };
  }
  renderRoom();
  // an invitation requested from the "Friends" page when creating the room
  try {
    const inv = JSON.parse(sessionStorage.getItem(INVITE_AFTER_KEY) || 'null');
    if (inv?.room === room.id) {
      sessionStorage.removeItem(INVITE_AFTER_KEY);
      social.send(inv.uid, { kind: inv.kind || 'invite', game: game.id, gameName: game.name, room: room.id })
        .then(() => toast(txt('The invitation to {0} has been sent.', inv.name), 'success'))
        .catch(() => {});
    }
  } catch {}
  // if nobody answers but I'm the creator – the room is already ready
  setTimeout(() => !instance && renderRoom(), 1500);

  return {
    room,
    async cleanup() {
      gone = true;
      instance?.destroy?.();
      if (room.inMatch() && room.mySeat() >= 0) {
        const info = ratedInfo();
        room.resign();
        await ctx.report('loss', { summary: txt('Online · left match'), online: true });
        if (info && !rated) store.reportRated({ userId: user.id, game: game.id, outcome: 'loss', ...info }).catch(() => {});
      }
      localStorage.removeItem(ACTIVE_KEY);
      await room.leave();
    },
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// An unfinished online match (closed tab etc.): we offer to go back,
// and if it was abandoned long ago – we count a loss.
export async function checkAbandoned(store, user) {
  let a;
  try { a = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null'); } catch {}
  if (!a || !user) return;
  if (location.hash.includes(`room=${a.room}`)) return;
  const rateLoss = () => a.rated && store.reportRated({ userId: user.id, game: a.game, outcome: 'loss', ...a.rated }).catch(() => {});
  if (Date.now() - a.at > 5 * 60000) {
    localStorage.removeItem(ACTIVE_KEY);
    try {
      await store.recordGame(user.id, a.game, { result: 'loss', meta: { summary: txt('Online · abandoned match'), online: true } });
      rateLoss();
    } catch {}
    toast(txt('An unfinished online match was counted as a loss.'), 'error', 4000);
    return;
  }
  const choice = await modal({
    title: txt('Unfinished online match'),
    body: h('p', null, txt('You have an online match in progress. Go back before your opponent gets a forfeit win.')),
    actions: [{ label: txt('Give up (loss)'), value: 'quit' }, { label: txt('Go back'), value: 'back', primary: true }],
  });
  if (choice === 'back') navigate(`/play/${a.game}?room=${a.room}`);
  else if (choice === 'quit') {
    localStorage.removeItem(ACTIVE_KEY);
    try {
      await store.recordGame(user.id, a.game, { result: 'loss', meta: { summary: txt('Online · abandoned match'), online: true } });
      rateLoss();
    } catch {}
  }
}
