// Bilingual UI (English / Bulgarian). Source strings in the code are English; the Bulgarian
// dictionary lives in js/i18n/bg.js. Switching the language reloads the page.
import { BG } from './i18n/bg.js';
import { T_OPEN } from './i18n/tk.js';
import { translate, render } from './i18n/render.js';

export { tk } from './i18n/tk.js';

const KEY = 'eg.lang';
export const LANGS = [
  { id: 'bg', name: 'Български', flag: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#d62612"/><rect width="30" height="13.33" fill="#00966e"/><rect width="30" height="6.67" fill="#fff"/></svg>' },
  { id: 'en', name: 'English', flag: '<svg viewBox="0 0 60 40"><clipPath id="uk-c"><path d="M0 0v40h60V0z"/></clipPath><clipPath id="uk-t"><path d="M30 20h30v20zv20H0zH0V0zV0h30z"/></clipPath><g clip-path="url(#uk-c)"><path d="M0 0v40h60V0z" fill="#012169"/><path d="M0 0l60 40m0-40L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0l60 40m0-40L0 40" clip-path="url(#uk-t)" stroke="#C8102E" stroke-width="5"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#C8102E" stroke-width="7"/></g></svg>' },
];

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'bg' || saved === 'en') return saved;
  } catch {}
  const nav = (globalThis.navigator?.languages || [globalThis.navigator?.language || '']).join(',').toLowerCase();
  return /(^|,)bg/.test(nav) ? 'bg' : 'en';
}

export const lang = detect();
export const LOCALE = lang === 'bg' ? 'bg-BG' : 'en-GB';
const DICT = lang === 'bg' ? BG : null;
if (globalThis.document) document.documentElement.lang = lang;

export function setLang(id) {
  try { localStorage.setItem(KEY, id); } catch {}
  location.reload();
}

/** Translate an English source string; {0}, {1}… are replaced by the arguments. */
export const txt = (key, ...args) => translate(key, args, DICT);

/** Turns server tokens (tk) inside any text into the player's language. */
export const decode = (s) => render(s, DICT);

/** decode() plus an exact-match lookup – for plain English messages from the servers. */
export function tr(s) {
  if (typeof s !== 'string') return s;
  if (s.includes(T_OPEN)) return decode(s);
  return (DICT && DICT[s]) || s;
}
