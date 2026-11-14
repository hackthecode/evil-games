// The resting die (SVG, 58×58 box): the same look as the 3D die that lands on it –
// rounded ivory body, bevelled edge, engraved pips.
export const DIE_PIPS = {
  1: [[29, 29]],
  2: [[16, 16], [42, 42]],
  3: [[15, 15], [29, 29], [43, 43]],
  4: [[16, 16], [42, 16], [16, 42], [42, 42]],
  5: [[16, 16], [42, 16], [29, 29], [16, 42], [42, 42]],
  6: [[16, 15], [42, 15], [16, 29], [42, 29], [16, 43], [42, 43]],
};

// Gradients for the dice; id – a prefix that keeps the ids unique per <svg>.
export function dieDefs(id = 'die') {
  return `
    <linearGradient id="${id}Lb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffefa"/><stop offset=".55" stop-color="#f4ecd9"/><stop offset="1" stop-color="#cdbf9f"/></linearGradient>
    <radialGradient id="${id}Lf" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#faf4e6"/><stop offset="1" stop-color="#eadfc6"/></radialGradient>
    <radialGradient id="${id}Lp" cx=".4" cy=".34" r=".75"><stop offset="0" stop-color="#050302"/><stop offset=".65" stop-color="#231912"/><stop offset="1" stop-color="#4d3c2e"/></radialGradient>
    <linearGradient id="${id}Db" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a4048"/><stop offset=".5" stop-color="#2c171c"/><stop offset="1" stop-color="#0c0507"/></linearGradient>
    <radialGradient id="${id}Df" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#553138"/><stop offset=".6" stop-color="#2e181d"/><stop offset="1" stop-color="#1b0c10"/></radialGradient>
    <radialGradient id="${id}Dp" cx=".4" cy=".34" r=".75"><stop offset="0" stop-color="#cdbd98"/><stop offset=".6" stop-color="#f1e6cb"/><stop offset="1" stop-color="#fffaf0"/></radialGradient>
    <linearGradient id="${id}Rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".75"/></linearGradient>
    <linearGradient id="${id}Gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
}

// SVG markup of one die face showing `value` (0 – a blank face).
export function dieMarkup(value, dark = false, id = 'die') {
  const k = dark ? 'D' : 'L';
  const pips = (DIE_PIPS[value] || []).map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="5.7" fill="url(#${id}${k}p)"/><circle cx="${x}" cy="${y}" r="5.7" fill="none" stroke="url(#${id}Rim)" stroke-width="1.1" opacity="${dark ? 0.55 : 0.9}"/>`).join('');
  return `<rect x=".5" y=".5" width="57" height="57" rx="12.5" fill="url(#${id}${k}b)" stroke="${dark ? '#050203' : '#b3a37f'}" stroke-width="1"/>
    <rect x="3.6" y="3.2" width="50.8" height="50.8" rx="10" fill="url(#${id}${k}f)"/>
    <rect x="6" y="4.6" width="46" height="13" rx="6.5" fill="url(#${id}Gl)" opacity="${dark ? 0.22 : 0.5}"/>${pips}`;
}
