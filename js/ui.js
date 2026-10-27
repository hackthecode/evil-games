// Малки помощни функции за DOM и общи UI компоненти.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      }
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children.flat()) if (c) el.append(c);
  return el;
}

// При превъртане на онлайн мач (повторно влизане) паузите и анимациите се пропускат.
export const motion = { fast: false };
export const sleep = (ms) => (motion.fast ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

export function fmtDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  if (totalMin > 0) return `${m} мин`;
  return `${Math.floor(ms / 1000)} сек`;
}

export function fmtClock(ms) {
  const t = Math.floor(ms / 1000);
  const hh = Math.floor(t / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
}

export function pct(a, b) {
  return b ? Math.round((a / b) * 100) : 0;
}

// --- Известия ---
let toastHost;
export function toast(message, type = 'info', ms = 2600) {
  toastHost ||= document.body.appendChild(h('div', { class: 'toast-host', 'aria-live': 'polite' }));
  const t = h('div', { class: `toast toast-${type}` }, message);
  toastHost.append(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

// --- Модален прозорец ---
// actions: [{label, value, primary, danger}] -> Promise<value>
// Отворените прозорци се затварят при смяна на страницата (closeAllModals).
const openModals = new Set();
export function closeAllModals() {
  for (const close of [...openModals]) close(undefined);
}

export function modal({ title, body, actions = [{ label: 'OK', value: true, primary: true }], dismissable = true, className = '' }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: `modal ${className}` });
    const close = (v) => {
      if (!openModals.delete(close)) return;
      dlg.classList.add('closing');
      setTimeout(() => {
        dlg.close();
        dlg.remove();
      }, 180);
      resolve(v);
    };
    dlg.append(
      h('div', { class: 'modal-card' },
        title && h('h2', { class: 'modal-title' }, title),
        h('div', { class: 'modal-body' }, body),
        actions.length > 0 && h('div', { class: 'modal-actions' },
          actions.map((a) =>
            h('button', {
              class: `btn ${a.primary ? 'btn-primary' : ''} ${a.danger ? 'btn-danger' : ''}`,
              onclick: () => close(a.value),
            }, a.label),
          ),
        ),
      ),
    );
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (dismissable) close(undefined);
    });
    if (dismissable) dlg.addEventListener('click', (e) => e.target === dlg && close(undefined));
    document.body.append(dlg);
    openModals.add(close);
    dlg.showModal();
  });
}

export function avatar(user, size = 36) {
  const name = user?.displayName || user?.username || '?';
  return h('span', {
    class: 'avatar',
    style: { '--av': user?.color || '#6aa8ff', width: size + 'px', height: size + 'px', fontSize: size * 0.42 + 'px' },
    title: name,
  }, name.slice(0, 1).toUpperCase());
}

export const AVATAR_COLORS = ['#f2c14e', '#ef6f6c', '#3ecf8e', '#6aa8ff', '#b388ff', '#ff9f43', '#2dd4bf', '#f472b6'];

// Анимира елемент от предишна позиция (FLIP).
export function flyFrom(el, fromRect, { duration = 380, easing = 'cubic-bezier(.2,.8,.2,1)', rotate = 0 } = {}) {
  if (!fromRect || motion.fast || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const to = el.getBoundingClientRect();
  const dx = fromRect.left + fromRect.width / 2 - (to.left + to.width / 2);
  const dy = fromRect.top + fromRect.height / 2 - (to.top + to.height / 2);
  const sc = fromRect.width && to.width ? fromRect.width / to.width : 1;
  const anim = el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotate(${rotate}deg)` },
      { transform: 'none' },
    ],
    { duration, easing },
  );
  return anim.finished.catch(() => {});
}
