// Детерминиран генератор на случайни числа за онлайн игрите: всички клиенти
// получават едни и същи зарове/разбърквания от общия seed на мача.
import { sha256 } from '../store/hash.js';

// sfc32, инициализиран с SHA-256(seed | етикет). Връща функция → [0, 1).
export function seededRng(seed, label) {
  const h = sha256(`${seed}|${label}`);
  let [a, b, c, d] = [0, 8, 16, 24].map((i) => parseInt(h.slice(i, i + 8), 16) >>> 0);
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const r = (t + d) | 0;
    c = (c + r) | 0;
    return (r >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}

// Криптографски случайно число – за игри срещу компютъра.
export function cryptoRng() {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] / 4294967296;
}
