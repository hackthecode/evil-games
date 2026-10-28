// Renders text with translation tokens (see tk.js) using a dictionary (null = English).
// Pure function – used by the browser (js/i18n.js) and by the server for push notifications.
import { T_OPEN, T_SEP, T_CLOSE } from './tk.js';

const fill = (s, args, dict) => (args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (i < args.length ? render(String(args[i] ?? ''), dict) : m)) : s);

export function translate(key, args, dict) {
  return fill((dict && dict[key]) || key, args, dict);
}

export function render(s, dict) {
  if (typeof s !== 'string' || !s.includes(T_OPEN)) return s;
  let i = 0;
  function parse(stop) {
    let out = '';
    while (i < s.length) {
      if (s[i] === T_OPEN) {
        i++;
        const parts = [''];
        while (i < s.length && s[i] !== T_CLOSE) {
          if (s[i] === T_OPEN) parts[parts.length - 1] += parse(true);
          else if (s[i] === T_SEP) { parts.push(''); i++; }
          else parts[parts.length - 1] += s[i++];
        }
        i++;
        const [key, ...args] = parts;
        out += translate(key, args, dict);
        if (stop) return out;
        continue;
      }
      out += s[i++];
    }
    return out;
  }
  return parse(false);
}
