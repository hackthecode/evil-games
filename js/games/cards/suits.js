// Vector suit symbols (viewBox 0 0 100 100) – they look the same on all devices.
import { tk } from '../../i18n/tk.js';
export const SUIT_PATHS = {
  H: '<path d="M50 90C22 66 4 49 4 29 4 14 15 4 29 4c10 0 17 6 21 14 4-8 11-14 21-14 14 0 25 10 25 25 0 20-18 37-46 61z"/>',
  D: '<path d="M50 3c10 17 24 33 40 47-16 14-30 30-40 47C40 80 26 64 10 50 26 36 40 20 50 3z"/>',
  S: '<path d="M50 4C62 24 94 38 94 61c0 14-10 22-22 22-8 0-14-4-18-10 1 10 6 18 14 23H32c8-5 13-13 14-23-4 6-10 10-18 10-12 0-22-8-22-22C6 38 38 24 50 4z"/>',
  C: '<circle cx="50" cy="28" r="20"/><circle cx="26" cy="58" r="20"/><circle cx="74" cy="58" r="20"/><path d="M44 50h12v8c1 15 6 27 14 38H30c8-11 13-23 14-38z"/>',
};

export const SUIT_NAMES = { C: tk('Clubs'), D: tk('Diamonds'), H: tk('Hearts'), S: tk('Spades') };
export const isRed = (s) => s === 'H' || s === 'D';

export function suitSvg(s, cls = 'suit') {
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${SUIT_PATHS[s]}</svg>`;
}
