// Инсталиране на портала като приложение (начален екран на телефона / компютъра).
// Chrome/Edge/Android: собственият прозорец на браузъра; iPhone/iPad: кратки указания
// („Сподели“ → „Добави към началния екран“), защото Safari няма такъв прозорец.
import { h, modal } from './ui.js';

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
      title: 'Добавете Evil Games на началния екран',
      body: h('ol', { class: 'install-steps' },
        h('li', null, 'Отворете сайта в Safari.'),
        h('li', null, 'Натиснете бутона „Сподели“ ', h('span', { class: 'install-ico', 'aria-hidden': 'true' }, '⬆︎'), ' в долната лента.'),
        h('li', null, 'Изберете „Добави към началния екран“ и после „Добави“.'),
        h('li', null, 'Отваряйте играта от новата икона – на цял екран, като приложение. Известията на Evil Empires работят само така.')),
      actions: [{ label: 'Разбрах', value: true, primary: true }],
    });
  }
}

/** Лента „Инсталирай като приложение“ (за началната страница); null, ако не е нужна. */
export function installBanner() {
  let off = false;
  try { off = !!localStorage.getItem(DISMISS); } catch {}
  const el = h('section', { class: 'install-banner', hidden: true },
    h('img', { src: 'assets/icons/icon-192.png', alt: '', width: 44, height: 44 }),
    h('div', null, h('b', null, 'Evil Games като приложение'), h('small', { class: 'muted' }, 'Икона на началния екран, цял екран и известия за Evil Empires.')),
    h('button', { class: 'btn btn-primary btn-sm', onclick: () => install() }, 'Инсталирай'),
    h('button', { class: 'icon-btn', 'aria-label': 'Скрий', onclick: () => { try { localStorage.setItem(DISMISS, '1'); } catch {} el.remove(); } }, '✕'));
  const sync = () => { el.hidden = off || !canInstall(); };
  listeners.add(sync);
  sync();
  return el;
}
