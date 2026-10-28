import { CONFIG } from '../config.js';
import { store } from './store/index.js';
import { h, avatar, toast, closeAllModals } from './ui.js';
import { icon } from './icons.js';
import { renderHome } from './pages/home.js';
import { renderAuth } from './pages/auth.js';
import { renderProfile } from './pages/profile.js';
import { renderLeaderboard } from './pages/leaderboard.js';
import { renderPlay } from './pages/play.js';
import { renderOnline } from './pages/online.js';
import { checkAbandoned } from './pages/room-ui.js';
import { renderFriends } from './pages/friends.js';
import { renderLobby } from './pages/lobby.js';
import { renderAdmin } from './pages/admin.js';
import { admin } from './net/admin.js';
import { social } from './net/social.js';
import { modal } from './ui.js';
import './pwa.js'; // captures the install prompt right at load time
import { txt, lang, LANGS, setLang } from './i18n.js';

export const session = {
  user: null,
  isAdmin: false,
  setUser(u) {
    this.user = u;
    this.isAdmin = false;
    social.start(u);
    refreshBadge();
    renderChrome();
    checkAdmin();
  },
};

export function navigate(path) {
  location.hash = path;
}

const routes = [
  { re: /^\/?$/, page: renderHome, nav: 'home' },
  { re: /^\/login$/, page: (v, p, q) => renderAuth(v, 'login', q), nav: 'profile' },
  { re: /^\/register$/, page: (v, p, q) => renderAuth(v, 'register', q), nav: 'profile' },
  { re: /^\/leaderboard(?:\/(\w+))?$/, page: (v, p) => renderLeaderboard(v, p[0]), nav: 'leaderboard' },
  { re: /^\/profile(?:\/([\w-]+))?$/, page: (v, p) => renderProfile(v, p[0]), nav: 'profile', auth: true },
  { re: /^\/play\/(\w+)$/, page: (v, p, q) => renderPlay(v, p[0], q), nav: 'home', auth: true, game: true },
  { re: /^\/online\/(\w+)$/, page: (v, p) => renderOnline(v, p[0]), nav: 'home', auth: true },
  { re: /^\/friends$/, page: (v) => renderFriends(v), nav: 'friends', auth: true },
  { re: /^\/lobby$/, page: (v) => renderLobby(v), nav: 'lobby', auth: true },
  { re: /^\/admin$/, page: (v) => renderAdmin(v), nav: 'admin', auth: true },
];

const appEl = document.getElementById('app');
let viewEl, headerEl, tabbarEl;
let cleanup = null;
let currentNav = 'home';

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, query: new URLSearchParams(qs || '') };
}

async function route() {
  const { path, query } = parseHash();
  const r = routes.find((x) => x.re.test(path));
  if (!r) return navigate('/');
  if (r.auth && !session.user) {
    return navigate('/login?next=' + encodeURIComponent(path));
  }
  const params = path.match(r.re).slice(1);

  const swap = async () => {
    closeAllModals();
    if (cleanup) {
      try { await cleanup(); } catch (e) { console.error(e); }
      cleanup = null;
    }
    currentNav = r.nav;
    document.body.classList.toggle('in-game', !!r.game);
    renderChrome();
    viewEl.replaceChildren();
    viewEl.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
    cleanup = (await r.page(viewEl, params, query)) || null;
  };

  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden) {
    // The transition can be interrupted (e.g. hidden tab) – the content still changes.
    const t = document.startViewTransition(swap);
    t.ready.catch(() => {});
    t.finished.catch(() => {});
  } else {
    await swap();
  }
}

function navLink(id, href, label, ico, badge = 0) {
  return h('a', { href: '#' + href, class: `nav-link ${currentNav === id ? 'active' : ''}` }, icon(ico), h('span', null, label),
    badge > 0 && h('i', { class: 'nav-badge' }, badge));
}

// Number of new friend requests (badge in the menu).
let friendBadge = 0;
async function refreshBadge() {
  try {
    friendBadge = session.user ? (await store.listFriends(session.user.id)).filter((f) => f.status === 'incoming').length : 0;
  } catch {
    friendBadge = 0;
  }
  renderChrome();
}

function renderChrome() {
  const u = session.user;
  headerEl.replaceChildren(
    h('a', { href: '#/', class: 'brand' },
      h('span', { class: 'brand-mark', html: BRAND_SVG }),
      brandName(CONFIG.appName),
    ),
    h('nav', { class: 'top-nav' },
      navLink('home', '/', txt('Games'), 'grid'),
      navLink('leaderboard', '/leaderboard', txt('Ranking'), 'trophy'),
      u && navLink('lobby', '/lobby', txt('Lobby'), 'chat'),
      u && navLink('friends', '/friends', txt('Friends'), 'users', friendBadge),
      u && session.isAdmin && navLink('admin', '/admin', txt('Admin'), 'settings'),
    ),
    h('div', { class: 'header-right' },
      langSwitch(),
      u
        ? [
            h('a', { href: '#/profile', class: 'user-chip' }, avatar(u, 30), h('span', null, u.displayName)),
            h('button', { class: 'icon-btn', title: txt('Log out'), 'aria-label': txt('Log out'), onclick: logout }, icon('logout')),
          ]
        : [
            h('a', { href: '#/login', class: 'btn btn-ghost btn-sm' }, txt('Log in')),
            h('a', { href: '#/register', class: 'btn btn-primary btn-sm' }, txt('Sign up')),
          ],
    ),
  );
  tabbarEl.replaceChildren(...[
    navLink('home', '/', txt('Games'), 'grid'),
    navLink('leaderboard', '/leaderboard', txt('Ranking'), 'trophy'),
    u && navLink('lobby', '/lobby', txt('Lobby'), 'chat'),
    u && navLink('friends', '/friends', txt('Friends'), 'users', friendBadge),
    navLink('profile', u ? '/profile' : '/login', u ? txt('Profile') : txt('Log in'), 'user'),
  ].filter(Boolean));
}

// Language switch (flags); the choice is remembered and the page reloads in that language.
function langSwitch() {
  return h('div', { class: 'lang-switch', role: 'group', 'aria-label': txt('Language') },
    LANGS.map((l) => h('button', {
      type: 'button', class: l.id === lang ? 'on' : '', title: l.name, 'aria-label': l.name, 'aria-pressed': l.id === lang ? 'true' : 'false',
      onclick: () => { if (l.id !== lang) setLang(l.id); },
      html: l.flag,
    })));
}

// The "Admin" link is shown only to administrators (the rights are checked on the server).
async function checkAdmin() {
  const u = session.user;
  const ok = !!u && (await admin.isAdmin());
  if (session.user === u && ok !== session.isAdmin) {
    session.isAdmin = ok;
    renderChrome();
  }
}

async function logout() {
  await store.logout();
  session.setUser(null);
  toast(txt('You have logged out.'));
  navigate('/');
}

// The first word of the name is in the accent colour ("Evil" Games).
function brandName(name) {
  const [first, ...rest] = name.split(' ');
  return h('span', { class: 'brand-name' }, rest.length ? [h('b', null, first), ' ' + rest.join(' ')] : name);
}

// The logo: a die with horns.
const BRAND_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="bm-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a78"/><stop offset="1" stop-color="#b00020"/></linearGradient>
    <linearGradient id="bm-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8aa0"/><stop offset="1" stop-color="#d4123a"/></linearGradient>
  </defs>
  <path d="M15 21 C9 16 7 9 9 2 C13 9 19 12 26 15 Z" fill="url(#bm-h)"/>
  <path d="M49 21 C55 16 57 9 55 2 C51 9 45 12 38 15 Z" fill="url(#bm-h)"/>
  <rect x="9" y="15" width="46" height="46" rx="13" fill="url(#bm-g)"/>
  <rect x="9.75" y="15.75" width="44.5" height="44.5" rx="12.4" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="1.5"/>
  <path d="M17 31 Q23 31.5 29.5 35.5 Q28.5 41.5 23 41 Q17.5 40 17 31 Z" fill="#000"/>
  <path d="M47 31 Q41 31.5 34.5 35.5 Q35.5 41.5 41 41 Q46.5 40 47 31 Z" fill="#000"/>
  <path d="M21 48 Q32 56 43 48" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M25.5 50.6 L27.3 55 L29.4 51.9 Z M34.6 51.9 L36.7 55 L38.5 50.6 Z" fill="#000"/>
</svg>`;

async function boot() {
  appEl.append(
    (headerEl = h('header', { class: 'app-header' })),
    (viewEl = h('main', { class: 'view', id: 'view' })),
    (tabbarEl = h('nav', { class: 'tabbar' })),
  );
  try {
    await store.init();
    session.user = await store.getUser();
  } catch (e) {
    console.error(e);
    toast(txt('Could not connect to the server: ') + e.message, 'error', 6000);
  }
  renderChrome();
  checkAdmin();
  window.addEventListener('hashchange', route);
  social.start(session.user);
  refreshBadge();
  await route();
  checkAbandoned(store, session.user);
  // invitations and friend requests – wherever you are on the portal
  social.on(async (e) => {
    if (e.type === 'friend-request') {
      toast(txt('{0} wants to be friends.', e.fromName), 'info', 4000);
      refreshBadge();
    }
    if (e.type === 'friend-accept') toast(txt('{0} accepted the friend request.', e.fromName), 'success', 4000);
    if (e.type === 'match') {
      // opponent found in the lobby – go straight into the room
      toast(txt('Opponent found: {0}!', e.fromName), 'success', 4000);
      social.setSeek(null);
      navigate(`/play/${e.game}?room=${e.room}`);
    }
    if (e.type === 'invite') {
      const ok = await modal({
        title: txt('Game invitation'),
        body: h('p', null, txt('{0} invites you to play {1} online.', e.fromName, e.gameName)),
        actions: [{ label: txt('Decline'), value: false }, { label: txt('Accept'), value: true, primary: true }],
      });
      if (ok) navigate(`/play/${e.game}?room=${e.room}`);
    }
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
