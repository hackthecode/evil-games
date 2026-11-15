// The resting die (SVG, 58×58 box): the same look as the die of "Imoti i Imperii" and as
// the 3D cube that tumbles onto it (.d3-face in css/tabla.css) – a cream body, a soft
// highlight at the top left, dark slate pips on a 3×3 grid.
export const DIE_PIPS = {
  1: [[29, 29]],
  2: [[14.7, 14.7], [43.3, 43.3]],
  3: [[14.7, 14.7], [29, 29], [43.3, 43.3]],
  4: [[14.7, 14.7], [43.3, 14.7], [14.7, 43.3], [43.3, 43.3]],
  5: [[14.7, 14.7], [43.3, 14.7], [29, 29], [14.7, 43.3], [43.3, 43.3]],
  6: [[14.7, 14.7], [43.3, 14.7], [14.7, 29], [43.3, 29], [14.7, 43.3], [43.3, 43.3]],
};

// Gradients for the dice; id – a prefix that keeps the ids unique per <svg>.
export function dieDefs(id = 'die') {
  return `
    <linearGradient id="${id}Body" x1=".1" y1="-.07" x2=".9" y2="1.07"><stop offset="0" stop-color="#fdf9ee"/><stop offset="1" stop-color="#e2d3af"/></linearGradient>
    <radialGradient id="${id}Shine" cx=".28" cy=".22" r="1.06"><stop offset="0" stop-color="#fff" stop-opacity=".88"/><stop offset=".36" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}Edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".14" stop-color="#fff" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
    <radialGradient id="${id}Pip" cx=".35" cy=".3" r=".955"><stop offset="0" stop-color="#46525f"/><stop offset=".75" stop-color="#1a232d"/></radialGradient>
    <linearGradient id="${id}PipIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".45" stop-color="#000" stop-opacity="0"/></linearGradient>
    <radialGradient id="${id}Shadow"><stop offset="0" stop-color="#000" stop-opacity=".36"/><stop offset=".8" stop-color="#000" stop-opacity="0"/></radialGradient>`;
}

// SVG markup of one die face showing `value` (0 – a blank face).
export function dieMarkup(value, id = 'die') {
  const pips = (DIE_PIPS[value] || []).map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="5.3" fill="url(#${id}Pip)"/><circle cx="${x}" cy="${y}" r="5.3" fill="url(#${id}PipIn)"/>`).join('');
  return `<ellipse cx="29" cy="62.8" rx="22.6" ry="6.4" fill="url(#${id}Shadow)"/>
    <rect width="58" height="58" rx="10.4" fill="url(#${id}Body)"/>
    <rect width="58" height="58" rx="10.4" fill="url(#${id}Shine)"/>
    <rect width="58" height="58" rx="10.4" fill="url(#${id}Edge)"/>
    <rect x=".85" y=".85" width="56.3" height="56.3" rx="9.6" fill="none" stroke="rgba(36,48,63,.22)" stroke-width="1.7"/>${pips}`;
}
