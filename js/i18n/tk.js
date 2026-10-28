// Translatable text for code that also runs on the server (game logic, Supabase Edge Functions).
// tk('English text {0}', arg) returns a compact token; the browser turns it into the player's
// language when it is displayed (see js/i18n.js → decode). Arguments may be tokens themselves.
export const T_OPEN = '\u0001', T_SEP = '\u001f', T_CLOSE = '\u0002';

export function tk(key, ...args) {
  return T_OPEN + key + args.map((a) => T_SEP + String(a ?? '')).join('') + T_CLOSE;
}
