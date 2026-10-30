// Game registry. For a new game: add an entry here and a folder in js/games/<id>/.
import { txt } from '../i18n.js';
import { belotRules, santaseRules, blatoRules } from './cards/rules.js';

export const GAMES = [
  {
    id: 'tabla',
    name: txt('Backgammon'),
    tagline: txt('Classic "regular" backgammon with 15 checkers.'),
    players: txt('Against the computer or online'),
    accent: '#e0954a',
    load: () => import('./tabla/tabla.js'),
    online: {
      seats: 2, minHumans: 2, bots: false, seatNames: [txt('White'), txt('Black')],
      options: [{ key: 'target', label: txt('Match to'), value: 3, options: [[1, txt('1 point')], [3, txt('3 points')], [5, txt('5 points')]] }],
    },
    rules: txt('\n      <p>The goal is to move all 15 of your checkers to your home (bottom right) and bear them off first.</p>\n      <ul>\n        <li>You move counter-clockwise – from top right to bottom right.</li>\n        <li>Each die is a separate move. With doubles you play the number four times.</li>\n        <li>You cannot land on a point with 2 or more opposing checkers (a closed "door").</li>\n        <li>A single opposing checker can be hit – it goes to the bar and must enter again.</li>\n        <li>While you have a checker on the bar, you must enter it first.</li>\n        <li>You bear off only when all checkers are home. If the dice allow it, you must play both dice, and if only one is possible – the larger one.</li>\n        <li><b>Gammon</b>: if the opponent has not borne off a single checker – you win 2 points.</li>\n      </ul>\n      <p><b>Controls:</b> tap a checker, then the point where you want it to go (highlighted). Tapping the selected checker again moves it with the larger die. On a phone held upright the board rotates to be larger.</p>'),
  },
  {
    id: 'tapa',
    name: txt('Tapa'),
    tagline: txt('Backgammon without hitting – a single checker gets pinned.'),
    players: txt('Against the computer or online'),
    accent: '#d9a441',
    load: () => import('./tabla/tabla.js'),
    online: {
      seats: 2, minHumans: 2, bots: false, seatNames: [txt('White'), txt('Black')],
      options: [{ key: 'target', label: txt('Match to'), value: 3, options: [[1, txt('1 point')], [3, txt('3 points')], [5, txt('5 points')]] }],
    },
    rules: txt('\n      <p>Each player starts with all 15 checkers on one point – the farthest from their home – and moves them home, where they bear them off.</p>\n      <ul>\n        <li>Movement is as in regular backgammon: white towards the bottom right corner, black – mirrored.</li>\n        <li><b>No hitting.</b> If you land on a single opposing checker, you <b>pin</b> it – it cannot move until you move your checker away.</li>\n        <li>A point with 2 or more opposing checkers (or pinned by the opponent) is closed.</li>\n        <li>You bear off when all your checkers (including pinned ones) are home.</li>\n        <li><b>Mother:</b> if you pin the opponent\'s last checker on their starting point, you win immediately (2 points).</li>\n        <li><b>Gammon:</b> if the opponent has not borne off a single checker – 2 points.</li>\n      </ul>'),
  },
  {
    id: 'gulbara',
    name: txt('Gulbara'),
    tagline: txt('Both in the same direction, a single checker blocks, doubles escalate.'),
    players: txt('Against the computer or online'),
    accent: '#7bd389',
    load: () => import('./tabla/tabla.js'),
    online: {
      seats: 2, minHumans: 2, bots: false, seatNames: [txt('White'), txt('Black')],
      options: [{ key: 'target', label: txt('Match to'), value: 3, options: [[1, txt('1 point')], [3, txt('3 points')], [5, txt('5 points')]] }],
    },
    rules: txt('\n      <p>Each player starts with 15 checkers in opposite corners (white – top right, black – bottom left) and both move <b>in the same direction</b> – counter-clockwise. White\'s home is bottom right, black\'s – top left.</p>\n      <ul>\n        <li><b>No hitting.</b> Even a single checker blocks the point – the opponent cannot land there.</li>\n        <li>Doubles are played 4 times.</li>\n        <li><b>Escalation:</b> from each player\'s 4th roll on, if you roll doubles, you play them and all following doubles up to 6-6 (e.g. 4-4, then 5-5 and 6-6).</li>\n        <li>If you cannot play everything from such doubles (but have played at least one move), the rest is played by the opponent.</li>\n        <li>You bear off when all checkers are home. <b>Gammon</b> (the opponent has not borne off a single checker) – 2 points.</li>\n      </ul>'),
  },
  {
    id: 'chess',
    name: txt('Chess'),
    tagline: txt('Full rules, three difficulty levels.'),
    players: txt('Against the computer or online'),
    accent: '#c78bff',
    load: () => import('./chess/chess.js'),
    online: { seats: 2, minHumans: 2, bots: false, seatNames: [txt('White'), txt('Black')], options: [] },
    rules: txt('\n      <p>Standard FIDE rules: castling, en passant, promotion, checkmate, stalemate, draw by threefold repetition, the 50-move rule and insufficient material.</p>\n      <p><b>Controls:</b> drag a piece, or tap a piece and then a square. The dots show the possible moves.</p>\n      <p>You can take back a move, flip the board or resign.</p>'),
  },
  {
    id: 'belot',
    name: txt('Belot'),
    tagline: txt('Bulgarian belot 2 vs 2 – you and a partner against two.'),
    players: txt('2 vs 2 · with bots or online'),
    accent: '#3ecf8e',
    load: () => import('./belot/belot.js'),
    online: {
      referee: true,
      teams: 2,
      seats: 4, minHumans: 2, bots: true,
      seatNames: [txt('Team A · south'), txt('Team B · east'), txt('Team A · north'), txt('Team B · west')],
      botNames: [txt('Bot Ivan'), txt('Bot Georgi'), txt('Bot Maria'), txt('Bot Petar')],
      options: [{ key: 'target', label: txt('Play to'), value: 151, options: [[51, '51'], [101, '101'], [151, '151']] }],
    },
    get rules() { return belotRules(); },
  },
  {
    id: 'blato',
    name: txt('Blato'),
    tagline: txt('3-5-8 for three – everyone must make their tricks.'),
    players: txt('Three players · with bots or online'),
    accent: '#a78bfa',
    load: () => import('./blato/blato.js'),
    online: {
      referee: true,
      seats: 3, minHumans: 2, bots: true,
      seatNames: [txt('Seat 1'), txt('Seat 2'), txt('Seat 3')],
      botNames: [txt('Bot Ivan'), txt('Bot Georgi'), txt('Bot Petar')],
      options: [{ key: 'target', label: txt('Play to'), value: 10, options: [[5, '+5'], [10, '+10'], [15, '+15']] }],
    },
    get rules() { return blatoRules(); },
  },
  {
    id: 'santase',
    name: txt('Santase'),
    tagline: txt('Sixty-six – a quick game for two.'),
    players: txt('Against the computer or online'),
    accent: '#ef6f6c',
    load: () => import('./santase/santase.js'),
    online: {
      referee: true, seats: 2, minHumans: 2, bots: false, seatNames: [txt('Player 1'), txt('Player 2')], options: [] },
    get rules() { return santaseRules(); },
  },
  {
    id: 'ludo',
    name: txt('Ludo'),
    tagline: txt('The classic for 2–4 players – with a 3D die.'),
    players: txt('2–4 · with bots or online'),
    accent: '#2fbf71',
    load: () => import('./ludo/ludo.js'),
    online: {
      seats: 4, minHumans: 2, bots: true,
      seatNames: [txt('Red'), txt('Yellow'), txt('Green'), txt('Blue')],
      botNames: [txt('Bot Ivan'), txt('Bot Georgi'), txt('Bot Maria'), txt('Bot Petar')],
      options: [],
    },
    rules: txt('\n      <p>Each player has 4 pieces in their yard. The goal is to be the first to take them around the whole track and into your home row.</p>\n      <ul>\n        <li>A piece leaves the yard only with a <b>six</b>. With a six, bringing out a piece is mandatory if possible.</li>\n        <li>After a six you roll again.</li>\n        <li>If you have no pieces in play, you get 3 tries to roll a six.</li>\n        <li>If you land on a square with an opposing piece, you "capture" it – it goes back to the yard.</li>\n        <li>You cannot land on a square with your own piece. The start square must be cleared while you have pieces in the yard.</li>\n        <li>You enter the home row with an exact roll and cannot jump over your own pieces.</li>\n      </ul>\n      <p><b>Controls:</b> press "Roll" (or the board), then choose the highlighted piece.</p>'),
  },
  {
    id: 'solitaire',
    name: txt('Solitaire'),
    tagline: txt('Classic "Klondike" – sort all the cards.'),
    players: txt('Alone or online race'),
    accent: '#38bdf8',
    load: () => import('./solitaire/solitaire.js'),
    // online: everyone sorts the same deal – whoever finishes first wins
    online: {
      seats: 4, minHumans: 2, bots: false, race: true, seatNames: [txt('Player 1'), txt('Player 2'), txt('Player 3'), txt('Player 4')],
      options: [{ key: 'draw', label: txt('Cards to draw'), value: 1, options: [[1, txt('1 card')], [3, txt('3 cards')]] }],
    },
    rules: txt('\n      <p>The goal is to sort all 52 cards onto the four foundations (top right) – by suit, from ace to king.</p>\n      <ul>\n        <li>In the columns cards are stacked in descending order with alternating colours (red on black and vice versa).</li>\n        <li>You can also move whole sorted groups. Only a king (with the cards on it) can be placed in an empty column.</li>\n        <li>A face-down card turns over when it is uncovered.</li>\n        <li>Tap the stock to draw 1 or 3 cards. When it runs out, the waste is turned over again.</li>\n        <li>When all cards in the columns are face up, the <b>Finish</b> button sorts the rest automatically.</li>\n      </ul>\n      <p><b>Controls:</b> tap a card – it goes to the best place by itself; or drag it wherever you want. There is undo and a hint.</p>\n      <p><b>Online:</b> 2–4 players sort the same deal at the same time and see each other\'s progress. Whoever finishes first wins (or the last one remaining if the others give up).</p>'),
  },
  {
    id: 'empires',
    name: 'Evil Empires',
    tagline: txt('Strategy: raise an empire through the ages.'),
    players: txt('Solo · progress over months'),
    accent: '#b48cff',
    load: () => import('./empires/empires.js'),
    rules: txt('\n      <p>Choose a people – <b>Humans, Undead, Orcs or Witchers</b> – and turn a heap of ashes into an empire of many cities.</p>\n      <ul>\n        <li><b>Resources and buildings:</b> every city produces gold, wood, stone and food (bones for the undead) even when you are not playing. The Citadel limits the levels of the other buildings.</li>\n        <li><b>New cities:</b> with Citadel 5 train settlers and send them to free land on the Map. One more city for every 5 Citadel levels.</li>\n        <li><b>Hero:</b> goes on adventures for experience, resources and items; has skills and equipment, leads the army and defends the city. If they fall – revive them in the Hall of Heroes.</li>\n        <li><b>Marches:</b> raids on barbarian camps, attacks on computer rulers and other players, scouting with scouts, reinforcements. Spears beat cavalry, cavalry beats archers, archers beat spears.</li>\n        <li><b>Tactical battles:</b> when raiding or attacking, choose "Tactical battle" – on arrival you lead the army turn by turn on a hex map (forest, hills, ruins, rivers). You have 1 hour, otherwise the battle is decided automatically.</li>\n        <li><b>Defense:</b> palisade/wall, traps, hideout (protects resources from plunder), watchtower (sees attacks earlier and reveals their makeup), night bonus 0:00–7:00 Bulgarian time (+50% defense). New players are protected for 5 days (it ends if you attack a ruler).</li>\n        <li><b>Morale:</b> if you attack a much weaker ruler, your army hits less hard.</li>\n        <li><b>Oases:</b> defeat the guards with the hero in the army and conquer the oasis (+25% to the resource; up to 3 tiles from the city; Hall of Heroes 3/6/10).</li>\n        <li><b>Alliances:</b> with an Embassy join or found an alliance – chat, reinforcements, diplomacy (alliance, pact, war), rankings. You can buy a pact with the computer clans.</li>\n        <li><b>Science and ages:</b> Ash → Bronze (Citadel 5, Bronze Casting, the barbarian warlord) → Iron (Citadel 10, Iron, camp level 10) – with pikemen, crossbowmen, heavy cavalry, stables and temple.</li>\n      </ul>\n      <p>With an online account the world is shared by all players and the server checks every action. Turn on notifications in the settings (⚙) – they arrive even when the game is closed.</p>'),
  },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
