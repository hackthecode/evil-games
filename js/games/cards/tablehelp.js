// Shared helpers for the card tables: the beginners' help strip with a hint button,
// the "last trick" viewer and the large-cards mode for phones.
import { h, modal } from '../../ui.js';
import { txt } from '../../i18n.js';
import { cardEl } from './cards.js';
import { cardName } from './cardtips.js';

/**
 * The help strip above the hand: what to do now and a hint button.
 * show(html, advise) – advise() → { card, text } | null; the suggested card gets the class "suggest".
 */
export function coachStrip(handEl) {
  const el = h('div', { class: 'ct-coach', hidden: true });
  return {
    el,
    show(html, advise) {
      const why = h('small', { class: 'coach-why', hidden: true });
      const btn = advise && h('button', { class: 'btn btn-sm', onclick: () => {
        const a = advise();
        if (!a) return;
        handEl.querySelectorAll('.suggest').forEach((x) => x.classList.remove('suggest'));
        handEl.querySelector(`[data-id="${a.card.id}"]`)?.classList.add('suggest');
        why.textContent = '💡 ' + a.text;
        why.hidden = false;
      } }, txt('💡 Hint'));
      el.replaceChildren(h('div', { class: 'coach-text' }, h('span', { html: html }), why), btn || null);
      el.hidden = false;
    },
    hide() { el.hidden = true; },
  };
}

/**
 * "Last trick" button: shows the cards of the last finished trick, who played them and who took it.
 * get() → { cards: [{ p, card }], winner } | null; nameOf(p) → name.
 */
export function lastTrickButton(get, nameOf) {
  const btn = h('button', { class: 'btn', title: txt('Last trick'), 'aria-label': txt('Last trick'), disabled: true, onclick: () => {
    const t = get();
    if (!t) return;
    modal({
      title: txt('Last trick'),
      body: h('div', { class: 'last-trick' },
        t.cards.map(({ p, card }) => h('figure', { class: p === t.winner ? 'win' : '' },
          cardEl(card),
          h('figcaption', null, h('b', null, nameOf(p)), h('small', null, cardName(card)), p === t.winner ? h('span', { class: 'lt-win' }, txt('✔ took the trick')) : null)))),
      actions: [{ label: txt('Close'), value: true, primary: true }],
    });
  } }, txt('↺ Last trick'));
  return { el: btn, update: () => { btn.disabled = !get(); } };
}

// Large cards (for phones): remembered; on by default on narrow screens.
const BIG = 'eg.bigCards';
const bigOn = () => {
  try { const v = localStorage.getItem(BIG); if (v != null) return v === '1'; } catch {}
  return typeof innerWidth !== 'undefined' && innerWidth < 700;
};

/** A button that switches the table between normal and large cards. */
export function bigCardsButton(tableEl, relayout) {
  tableEl.classList.toggle('big-cards', bigOn());
  const btn = h('button', { class: 'btn', title: txt('Large cards'), 'aria-label': txt('Large cards'), 'aria-pressed': String(bigOn()), onclick: () => {
    const on = !tableEl.classList.contains('big-cards');
    tableEl.classList.toggle('big-cards', on);
    btn.setAttribute('aria-pressed', String(on));
    try { localStorage.setItem(BIG, on ? '1' : '0'); } catch {}
    relayout?.();
  } }, '🔍');
  return btn;
}
