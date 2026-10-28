// Илюстрации за картите на игрите в портала: прожекторна светлина, обемни сенки
// и краища, които преливат в черно (OLED). Всяка илюстрация има собствени id-та.
import { SUIT_PATHS } from './games/cards/suits.js';
import { buildingSvg, tile, PALETTE, defs as eeDefs } from './games/empires/art.js';

const suit = (s, x, y, size, fill) =>
  `<g transform="translate(${x} ${y}) scale(${size / 100})" fill="${fill}">${SUIT_PATHS[s]}</g>`;

// Общи дефиниции: сянка и винетка към черно.
const defs = (p) => `
  <filter id="${p}-sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".7"/></filter>
  <filter id="${p}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <radialGradient id="${p}-vig" cx=".5" cy=".42" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".92"/></radialGradient>
  <radialGradient id="${p}-spot" cx=".5" cy=".2" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
const overlay = (p) => `<rect width="320" height="180" fill="url(#${p}-spot)"/><rect width="320" height="180" fill="url(#${p}-vig)"/>`;

// Мини карта; фигурите (J/Q/K) са с илюстрацията от комплекта.
function miniCard(p, x, y, rot, rank, s) {
  const red = s === 'H' || s === 'D';
  const col = red ? '#cf2f36' : '#141418';
  const body = 'JQK'.includes(rank)
    ? `<image href="assets/cards/${rank}${s}.svg" x="-32" y="-48" width="64" height="96"/>`
    : `<text x="-27" y="-28" font-family="Playfair Display,Georgia,serif" font-weight="700" font-size="17" fill="${col}">${rank}</text>
       ${suit(s, -28, -24, 12, col)}
       ${suit(s, -14, -6, 28, col)}`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})" filter="url(#${p}-sh)">
    <rect x="-34" y="-48" width="68" height="96" rx="7" fill="url(#${p}-card)"/>
    ${body}
    <rect x="-34" y="-48" width="68" height="96" rx="7" fill="none" stroke="rgba(0,0,0,.35)"/>
  </g>`;
}
const cardGrad = (p) => `<linearGradient id="${p}-card" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#efe8da"/></linearGradient>`;

// Пул за табла с гравиран ръб и отблясък.
function checker(p, cx, cy, dark) {
  return `<g transform="translate(${cx} ${cy})" filter="url(#${p}-sh)">
    <circle r="11" fill="url(#${p}-${dark ? 'd' : 'l'})"/>
    <circle r="10.3" fill="none" stroke="${dark ? 'rgba(255,120,140,.35)' : 'rgba(255,255,255,.9)'}" stroke-width=".8"/>
    <circle r="7" fill="none" stroke="${dark ? 'rgba(0,0,0,.6)' : 'rgba(120,95,60,.45)'}" stroke-width="1"/>
    <ellipse cx="-3.5" cy="-4.5" rx="5" ry="2.6" transform="rotate(-30 -3.5 -4.5)" fill="#fff" opacity="${dark ? 0.25 : 0.7}"/>
  </g>`;
}

// Зар в изометрия: горна стена и две странични в сянка.
function die(x, y, pips, rot) {
  const pip = ([px, py]) => `<circle cx="${px}" cy="${py}" r="3.3" fill="#1a1012"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <rect x="3" y="5" width="36" height="36" rx="8" fill="#000" opacity=".55" filter="blur(3px)"/>
    <rect width="36" height="36" rx="8" fill="#c9bea7"/>
    <rect width="36" height="32" rx="8" fill="url(#ta-die)"/>
    ${pips.map(pip).join('')}
  </g>`;
}

function tablaArt(kind) {
  const pieces = kind === 'tabla' ? `
    ${[0, 1, 2, 3].map((i) => checker('ta', 26, 155 - i * 21, false)).join('')}
    ${[0, 1].map((i) => checker('ta', 74, 25 + i * 21, true)).join('')}
    ${[0, 1, 2, 3].map((i) => checker('ta', 122, 155 - i * 21, true)).join('')}
    ${[0, 1, 2].map((i) => checker('ta', 297, 25 + i * 21, false)).join('')}
` : kind === 'tapa'
    ? [0, 1, 2, 3, 4].map((i) => checker('ta', 297, 25 + i * 21, false)).join('') + [0, 1, 2, 3, 4].map((i) => checker('ta', 297, 155 - i * 21, true)).join('') + checker('ta', 250, 155, false) + checker('ta', 250, 134, true)
    : [0, 1, 2, 3, 4].map((i) => checker('ta', 297, 25 + i * 21, false)).join('') + [0, 1, 2, 3, 4].map((i) => checker('ta', 26, 155 - i * 21, true)).join('');
  const label = kind === 'tabla' ? '' : `<text x="86" y="98" text-anchor="middle" font-family="Unbounded,Inter,sans-serif" font-size="22" font-weight="800" fill="#ffe7a3" filter="url(#ta-glow)" letter-spacing="1">${kind === 'tapa' ? 'ТАПА' : 'ГЮЛБАРА'}</text>`;
  return `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
    <defs>${defs('ta')}
      <linearGradient id="ta-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a5530"/><stop offset=".5" stop-color="#5a3218"/><stop offset="1" stop-color="#2e170a"/></linearGradient>
      <radialGradient id="ta-felt" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#2f7a52"/><stop offset="1" stop-color="#0d2e1d"/></radialGradient>
      <linearGradient id="ta-tA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e2bd"/><stop offset="1" stop-color="#c9ab76"/></linearGradient>
      <linearGradient id="ta-tB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c2412e"/><stop offset="1" stop-color="#7c2216"/></linearGradient>
      <radialGradient id="ta-l" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#efe5cf"/><stop offset="1" stop-color="#a8977a"/></radialGradient>
      <radialGradient id="ta-d" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9a3a4a"/><stop offset=".6" stop-color="#4a1420"/><stop offset="1" stop-color="#14040a"/></radialGradient>
      <linearGradient id="ta-die" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ece4d2"/></linearGradient>
      <filter id="ta-grain"><feTurbulence type="fractalNoise" baseFrequency=".02 .5" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 .9"/></filter>
    </defs>
    <rect width="320" height="180" fill="url(#ta-wood)"/>
    <rect width="320" height="180" filter="url(#ta-grain)" opacity=".5"/>
    <rect x="12" y="12" width="144" height="156" rx="5" fill="url(#ta-felt)"/>
    <rect x="168" y="12" width="140" height="156" rx="5" fill="url(#ta-felt)"/>
    <rect x="12" y="12" width="144" height="156" rx="5" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
    <rect x="168" y="12" width="140" height="156" rx="5" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${14 + i * 24} 13 l12 66 l12 -66z" fill="url(#ta-t${i % 2 ? 'A' : 'B'})"/><path d="M${14 + i * 24} 167 l12 -66 l12 66z" fill="url(#ta-t${i % 2 ? 'B' : 'A'})"/>`).join('')}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${170 + i * 23} 13 l11.5 66 l11.5 -66z" fill="url(#ta-t${i % 2 ? 'A' : 'B'})"/><path d="M${170 + i * 23} 167 l11.5 -66 l11.5 66z" fill="url(#ta-t${i % 2 ? 'B' : 'A'})"/>`).join('')}
${pieces}
    ${die(200, 86, [[9, 9], [18, 16], [27, 23]], -14)}
    ${die(246, 92, [[9, 8], [27, 8], [9, 16], [27, 16], [9, 24], [27, 24]], 12)}
    ${overlay('ta')}
    ${label}
  </svg>`;
}

export const ART = {
  tabla: tablaArt('tabla'),
  tapa: tablaArt('tapa'),
  gulbara: tablaArt('gulbara'),

  chess: `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
    <defs>${defs('ch')}
      <radialGradient id="ch-bg" cx=".55" cy=".1" r="1"><stop offset="0" stop-color="#3a0f1a"/><stop offset=".6" stop-color="#120407"/><stop offset="1" stop-color="#000"/></radialGradient>
      <linearGradient id="ch-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".75"/><stop offset=".55" stop-color="#000" stop-opacity="0"/></linearGradient>
      <filter id="ch-rim" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#ff2d55" flood-opacity=".55"/><feDropShadow dx="2" dy="8" stdDeviation="5" flood-color="#000" flood-opacity=".8"/></filter>
    </defs>
    <rect width="320" height="180" fill="url(#ch-bg)"/>
    <g transform="translate(160 62) scale(1 .42) rotate(45)">
      ${Array.from({ length: 64 }, (_, i) => {
        const r = Math.floor(i / 8), c = i % 8;
        return `<rect x="${(c - 4) * 26}" y="${(r - 4) * 26}" width="26" height="26" fill="${(r + c) % 2 ? '#93505b' : '#e4d7cc'}"/>`;
      }).join('')}
    </g>
    <rect width="320" height="180" fill="url(#ch-fade)"/>
    <image href="assets/chess/bK.svg" x="182" y="22" width="64" height="64" filter="url(#ch-rim)"/>
    <image href="assets/chess/wQ.svg" x="228" y="70" width="70" height="70" filter="url(#ch-rim)"/>
    <image href="assets/chess/wN.svg" x="22" y="40" width="120" height="120" filter="url(#ch-rim)"/>
    ${overlay('ch')}
  </svg>`,

  belot: `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
    <defs>${defs('be')}${cardGrad('be')}
      <radialGradient id="be-felt" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#23854f"/><stop offset=".7" stop-color="#0b3d24"/><stop offset="1" stop-color="#03140b"/></radialGradient>
      <linearGradient id="be-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset="1" stop-color="#d79a2b"/></linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#be-felt)"/>
    ${miniCard('be', 104, 104, -24, 'J', 'S')}
    ${miniCard('be', 138, 92, -8, '9', 'S')}
    ${miniCard('be', 174, 92, 8, 'A', 'S')}
    ${miniCard('be', 208, 104, 24, 'K', 'S')}
    ${overlay('be')}
    <text x="302" y="34" text-anchor="end" font-family="Unbounded,Inter,sans-serif" font-size="15" font-weight="700" fill="url(#be-gold)" filter="url(#be-glow)">Всичко коз</text>
  </svg>`,

  ludo: `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
    <defs>${defs('lu')}
      <radialGradient id="lu-bg" cx=".5" cy=".45" r=".8"><stop offset="0" stop-color="#2a2233"/><stop offset="1" stop-color="#07060a"/></radialGradient>
      ${[['r', '#ff8a98', '#e23b4e', '#7a0f1e'], ['y', '#ffe09a', '#f2b33d', '#8a5a06'], ['g', '#8ff0bb', '#2fbf71', '#0f5c33'], ['b', '#9cc3ff', '#3b82f6', '#173d8a']].map(([k, l, m, d]) => `<radialGradient id="lu-${k}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${l}"/><stop offset=".55" stop-color="${m}"/><stop offset="1" stop-color="${d}"/></radialGradient>`).join('')}
    </defs>
    <rect width="320" height="180" fill="url(#lu-bg)"/>
    ${[[30, 20, 'r'], [250, 20, 'y'], [250, 120, 'g'], [30, 120, 'b']].map(([x, y, k]) => `<rect x="${x}" y="${y}" width="40" height="40" rx="10" fill="url(#lu-${k})" opacity=".35"/>`).join('')}
    ${Array.from({ length: 9 }, (_, i) => `<circle cx="${100 + i * 15}" cy="82" r="5.5" fill="#e9e0cf"/><circle cx="${100 + i * 15}" cy="98" r="5.5" fill="#e9e0cf"/>`).join('')}
    ${Array.from({ length: 5 }, (_, i) => `<circle cx="160" cy="${20 + i * 12}" r="5.5" fill="#e9e0cf"/><circle cx="160" cy="${112 + i * 12}" r="5.5" fill="#e9e0cf"/>`).join('')}
    ${[[112, 74, 'r'], [196, 108, 'g'], [160, 40, 'y'], [146, 132, 'b']].map(([x, y, k]) => `<g transform="translate(${x} ${y}) scale(1.15)" filter="url(#lu-sh)"><ellipse cx="0" cy="11" rx="11" ry="4.5" fill="url(#lu-${k})"/><path d="M -7 10 Q -5 -1 -3.5 -6 L 3.5 -6 Q 5 -1 7 10 Z" fill="url(#lu-${k})"/><circle cx="0" cy="-10" r="6" fill="url(#lu-${k})"/><ellipse cx="-2" cy="-12" rx="2" ry="1.4" fill="#fff" opacity=".7"/></g>`).join('')}
    <g transform="translate(232 58) rotate(14)" filter="url(#lu-sh)"><rect width="34" height="34" rx="7" fill="#fbf7ee"/><circle cx="9" cy="9" r="3.2" fill="#222"/><circle cx="25" cy="9" r="3.2" fill="#222"/><circle cx="9" cy="17" r="3.2" fill="#222"/><circle cx="25" cy="17" r="3.2" fill="#222"/><circle cx="9" cy="25" r="3.2" fill="#222"/><circle cx="25" cy="25" r="3.2" fill="#222"/></g>
    ${overlay('lu')}
  </svg>`,

  solitaire: `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
    <defs>${defs('so')}${cardGrad('so')}
      <radialGradient id="so-felt" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#1a6a8a"/><stop offset=".7" stop-color="#0a2b3b"/><stop offset="1" stop-color="#020b10"/></radialGradient>
      <linearGradient id="so-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a3122e"/><stop offset="1" stop-color="#5c0516"/></linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#so-felt)"/>
    <g filter="url(#so-sh)"><rect x="40" y="26" width="68" height="96" rx="7" fill="url(#so-back)" stroke="#f5ece4" stroke-width="2.5"/><rect x="40" y="38" width="68" height="96" rx="7" fill="url(#so-back)" stroke="#f5ece4" stroke-width="2.5"/></g>
    ${miniCard('so', 74, 92, -3, 'K', 'S')}
    ${miniCard('so', 82, 118, 2, 'Q', 'H')}
    ${miniCard('so', 90, 144, -2, 'J', 'C')}
    ${miniCard('so', 196, 70, 0, 'A', 'H')}
    ${miniCard('so', 244, 70, 0, 'A', 'S')}
    ${miniCard('so', 292, 70, 0, 'A', 'D')}
    ${overlay('so')}
  </svg>`,

  blato: `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
    <defs>${defs('bl')}${cardGrad('bl')}
      <radialGradient id="bl-felt" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#5a3fa0"/><stop offset=".7" stop-color="#21134a"/><stop offset="1" stop-color="#08041a"/></radialGradient>
      <linearGradient id="bl-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset="1" stop-color="#d79a2b"/></linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#bl-felt)"/>
    ${miniCard('bl', 70, 100, -18, 'A', 'S')}
    ${miniCard('bl', 106, 92, -4, 'K', 'H')}
    ${miniCard('bl', 142, 100, 12, '8', 'D')}
    ${overlay('bl')}
    <text x="248" y="100" text-anchor="middle" font-family="Unbounded,Inter,sans-serif" font-size="34" font-weight="800" fill="url(#bl-gold)" filter="url(#bl-glow)">3·5·8</text>
    <text x="248" y="126" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="3" fill="#e2d6ff">БЛАТО</text>
  </svg>`,

  santase: `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
    <defs>${defs('sa')}${cardGrad('sa')}
      <radialGradient id="sa-felt" cx=".45" cy=".42" r=".75"><stop offset="0" stop-color="#8a2140"/><stop offset=".7" stop-color="#3a0a18"/><stop offset="1" stop-color="#120206"/></radialGradient>
      <linearGradient id="sa-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset="1" stop-color="#d79a2b"/></linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#sa-felt)"/>
    ${miniCard('sa', 104, 96, -14, 'K', 'H')}
    ${miniCard('sa', 152, 92, 8, 'Q', 'H')}
    ${overlay('sa')}
    <text x="250" y="110" text-anchor="middle" font-family="Unbounded,Inter,sans-serif" font-size="54" font-weight="800" fill="url(#sa-gold)" filter="url(#sa-glow)">66</text>
    <text x="250" y="136" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="3" fill="#ffc9d3">САНТАСЕ</text>
  </svg>`,
  empires: (() => {
    const at = (x, y, sc, id, race, L) => `<g transform="translate(${x} ${y}) scale(${sc})">${tile(PALETTE[race], 'built')}${buildingSvg(id, race, L)}</g>`;
    return `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
    ${eeDefs(PALETTE.vesheri)}
    <defs>${defs('ee')}
      <radialGradient id="eep-sky" cx=".5" cy=".15" r=".9"><stop offset="0" stop-color="#3b1f5c"/><stop offset=".55" stop-color="#140a22"/><stop offset="1" stop-color="#000"/></radialGradient>
      <radialGradient id="eep-moon" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff1d6"/><stop offset=".6" stop-color="#ffcf8a"/><stop offset="1" stop-color="#ff8a3c" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="320" height="180" fill="url(#eep-sky)"/>
    <circle cx="252" cy="40" r="34" fill="url(#eep-moon)" opacity=".9"/>
    <circle cx="252" cy="40" r="16" fill="#fff4dc"/>
    <polygon points="160,74 290,139 160,204 30,139" fill="#120d19"/>
    ${at(98, 128, 0.62, 'houses', 'humans', 4)}
    ${at(226, 128, 0.62, 'unique', 'vesheri', 3)}
    ${at(160, 108, 0.8, 'hall', 'undead', 6)}
    ${at(122, 150, 0.6, 'barracks', 'orcs', 3)}
    ${at(198, 152, 0.6, 'altar', 'vesheri', 2)}
    ${overlay('ee')}
  </svg>`;
  })(),
};
