// Installing the portal as an app (home screen of the phone / computer).
// Chrome/Edge/Android: the browser's own prompt; iPhone/iPad: short instructions
// ("Share" → "Add to Home Screen"), because Safari has no such prompt.
import { h, modal } from './ui.js';
import { txt } from './i18n.js';

const DISMISS = 'eg.install.dismissed';
let deferred = null;
const listeners = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  listeners.forEach((f) => f());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  try { localStorage.setItem(DISMISS, 'installed'); } catch {}
  listeners.forEach((f) => f());
});

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canInstall = () => !isStandalone() && (!!deferred || isIOS());

export async function install() {
  if (deferred) {
    deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({}));
    if (outcome === 'accepted') deferred = null;
    listeners.forEach((f) => f());
    return;
  }
  if (isIOS()) {
    await modal({
      title: txt('Add Evil Games to the home screen'),
      body: h('ol', { class: 'install-steps' },
        h('li', null, txt('Open the site in Safari.')),
        h('li', null, txt('Tap the "Share" button '), h('span', { class: 'install-ico', 'aria-hidden': 'true' }, '⬆︎'), txt(' in the bottom bar.')),
        h('li', null, txt('Choose "Add to Home Screen" and then "Add".')),
        h('li', null, txt('Open the game from the new icon – full screen, like an app. Evil Empires notifications only work this way.'))),
      actions: [{ label: txt('Got it'), value: true, primary: true }],
    });
  }
}

/** "Install as an app" banner (for the home page); null if not needed. */
export function installBanner() {
  let off = false;
  try { off = !!localStorage.getItem(DISMISS); } catch {}
  const el = h('section', { class: 'install-banner', hidden: true },
    h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 44, height: 44 }),
    h('div', null, h('b', null, txt('Evil Games as an app')), h('small', { class: 'muted' }, txt('Home screen icon, full screen and notifications for Evil Empires.'))),
    h('button', { class: 'btn btn-primary btn-sm', onclick: () => install() }, txt('Install')),
    h('button', { class: 'icon-btn', 'aria-label': txt('Hide'), onclick: () => { try { localStorage.setItem(DISMISS, '1'); } catch {} el.remove(); } }, '✕'));
  const sync = () => { el.hidden = off || !canInstall(); };
  listeners.add(sync);
  sync();
  return el;
}
