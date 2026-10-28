// Evil Empires – данни: раси, ресурси, епохи, сгради, единици, технологии, герой,
// свят (оазиси, империи на компютъра), мисии. Всички числа за баланса са тук.

export const RES = ['gold', 'wood', 'stone', 'food', 'mana', 'souls'];
export const RES_NAMES = { gold: 'Злато', wood: 'Дърво', stone: 'Камък', food: 'Храна', mana: 'Мана', souls: 'Души' };
export const resName = (race, r) => (r === 'food' && race === 'undead' ? 'Кости' : RES_NAMES[r]);

export const RACES = {
  humans: {
    name: 'Хора',
    lore: 'Оцелелите кралства след Падението – упорити строители и търговци.',
    perks: ['+10% към всички ресурси', 'Строежите са с 10% по-бързи'],
    weak: 'Средни единици',
    color: '#e8b04a',
  },
  undead: {
    name: 'Немъртви',
    lore: 'Армия на некромант, вдигната от гробовете на старата империя.',
    perks: ['Войската не яде', 'Единиците са с 20% по-евтини', 'След победа част от падналите стават скелети'],
    weak: 'Бавен растеж (−15% население)',
    color: '#5fe39a',
  },
  orcs: {
    name: 'Орки',
    lore: 'Кланове от пепелищата, които живеят от плячка.',
    perks: ['+20% атака на пехотата и копиеносците', '+25% плячка от набези', 'Скривалищата на врага пазят с 20% по-малко'],
    weak: 'Изследванията са с 20% по-бавни',
    color: '#ff5a3c',
  },
  vesheri: {
    name: 'Вещери',
    lore: 'Народ от магьосници и ловци на чудовища, обучавани в тайни кули.',
    perks: ['+20% атака на стрелците', '+25% мана', 'Съгледвачите им не могат да бъдат засечени'],
    weak: 'Единиците са с 20% по-скъпи',
    color: '#b48cff',
  },
};

export const EPOCHS = [
  { n: 1, name: 'Пепелна епоха', cap: 5 },
  { n: 2, name: 'Бронзова епоха', cap: 10 },
  { n: 3, name: 'Желязна епоха', cap: 15 },
  { n: 4, name: 'Епоха на кралствата', cap: 20 },
  { n: 5, name: 'Епоха на мрака', cap: 25 },
];
// До коя епоха може да се стигне в тази версия на играта.
export const MAX_EPOCH = 3;

export const EPOCH_UP = {
  2: {
    hall: 5, tech: 'bronze', story: 's17',
    cost: { wood: 2500, stone: 2500, gold: 1500, food: 2000 },
    time: 1800,
  },
  3: {
    hall: 10, tech: 'iron', story: 'k3',
    cost: { wood: 12000, stone: 12000, gold: 8000, food: 10000, mana: 2000 },
    time: 7200,
  },
};

// Сгради. cost/time са за ниво 1 и растат с всяко ниво (COST_GROWTH, TIME_GROWTH).
// prod: производство на час на ниво 1. need: изискване за друга сграда.
export const COST_GROWTH = 1.55;
export const TIME_GROWTH = 1.75;

export const BUILDINGS = {
  hall: {
    name: 'Цитадела', epoch: 1,
    desc: 'Сърцето на града. Нивото ѝ ограничава останалите сгради, ускорява строежа и позволява нови градове.',
    cost: { wood: 150, stone: 120, gold: 60 }, time: 90,
  },
  farm: {
    name: 'Ферма', undeadName: 'Гробище', epoch: 1,
    desc: 'Произвежда храна за населението и войската.', undeadDesc: 'Изравя кости – основния ресурс на немъртвите.',
    cost: { wood: 60, stone: 30 }, time: 40, prod: { food: 70 },
  },
  lumber: { name: 'Дъскорезница', epoch: 1, desc: 'Сече и обработва дърво.', cost: { wood: 30, stone: 40, food: 20 }, time: 40, prod: { wood: 80 } },
  quarry: { name: 'Кариера', epoch: 1, desc: 'Добива камък за стени и сгради.', cost: { wood: 60, food: 20 }, time: 45, prod: { stone: 65 } },
  mine: { name: 'Златна мина', epoch: 1, desc: 'Добива злато.', cost: { wood: 80, stone: 60 }, time: 60, prod: { gold: 45 } },
  houses: { name: 'Жилища', epoch: 1, desc: 'Увеличават населението (място за войска) и носят данъци.', cost: { wood: 70, stone: 40, food: 30 }, time: 50, prod: { gold: 12 } },
  warehouse: { name: 'Склад', epoch: 1, desc: 'Увеличава колко ресурси можете да пазите.', cost: { wood: 80, stone: 70 }, time: 55 },
  barracks: { name: 'Казарма', epoch: 1, desc: 'Обучава войска. Всяко ниво ускорява обучението с 4%.', cost: { wood: 120, stone: 80, gold: 40 }, time: 70 },
  academy: { name: 'Академия', epoch: 1, desc: 'Изследва технологии. Всяко ниво ускорява изследванията с 5%.', cost: { wood: 100, stone: 120, gold: 80 }, time: 80 },
  heroHall: {
    name: 'Зала на героите', epoch: 1,
    desc: 'Дом на героя: съживява го и позволява завладяване на оазиси (ниво 3, 6 и 10 – по един оазис).',
    cost: { wood: 160, stone: 140, gold: 100 }, time: 90,
  },
  wall: {
    name: 'Палисада', name2: 'Крепостна стена', epoch: 1,
    desc: 'Защитниците получават +6% защита и +3% живот на ниво.',
    cost: { wood: 120, stone: 90 }, time: 60,
  },
  traps: {
    name: 'Капани', epoch: 1, need: { wall: 1 },
    desc: 'Залавят част от нападателите, преди да стигнат до стените.',
    cost: { wood: 90, stone: 40, gold: 30 }, time: 55,
  },
  cranny: {
    name: 'Скривалище', epoch: 1,
    desc: 'Пази част от всеки ресурс от грабеж.',
    cost: { wood: 50, stone: 70 }, time: 35,
  },
  embassy: {
    name: 'Посолство', epoch: 1,
    desc: 'Членство в съюз (ниво 1) и основаване на съюз (ниво 3). Всяко ниво дава 3 места в съюза.',
    cost: { wood: 150, stone: 130, gold: 100 }, time: 90,
  },
  tower: {
    name: 'Стражева кула', epoch: 1, need: { wall: 1 },
    desc: 'Вижда приближаващите се нападения по-отдалеч и разкрива състава им. Стрелците на кулата дават +2% защита на ниво.',
    cost: { wood: 100, stone: 120, gold: 40 }, time: 70,
  },
  temple: {
    name: 'Храм', epoch: 3,
    desc: 'Събира души и ускорява възстановяването на героя (+3% на час на ниво, ако е в този град).',
    cost: { wood: 800, stone: 1500, gold: 1200 }, time: 900, prod: { souls: 0.6 },
  },
  stable: {
    name: 'Конюшня', epoch: 3,
    desc: 'Обучава тежка конница. Всяко ниво ускорява обучението на конницата с 5%.',
    cost: { wood: 1400, stone: 1100, gold: 900 }, time: 900,
  },
  altar: { name: 'Олтар', epoch: 2, tech: 'mysticism', desc: 'Събира мана от разломите на Падението.', cost: { stone: 400, gold: 300 }, time: 300, prod: { mana: 30 } },
  smithy: { name: 'Ковачница', epoch: 2, desc: 'Всяко ниво дава +3% атака и защита на войската от града.', cost: { wood: 350, stone: 300, gold: 200 }, time: 300 },
  unique: { name: '', epoch: 2, desc: '', cost: { wood: 500, stone: 500, gold: 400 }, time: 420 },
};

export const UNIQUE = {
  humans: { name: 'Търговска гилдия', desc: 'Носи злато и обучава паладини.', prod: { gold: 60 } },
  undead: { name: 'Некрополис', desc: 'Изравя още кости и вдига гулове.', prod: { food: 70 } },
  orcs: { name: 'Бойна яма', desc: 'Обучава берсерки. Всяко ниво ускорява обучението на войска с 5%.' },
  vesheri: { name: 'Кула на вещерите', desc: 'Събира мана и обучава вещери.', prod: { mana: 40 } },
};

// Разположение на сградите в града: (i, j) в изометрична мрежа 5×5 (високите сгради – отзад).
// Палисадата и капаните нямат парцел – рисуват се по края на града.
export const GRID = 5;
export const PLOTS = {
  hall: [0, 0], unique: [1, 0], academy: [0, 1], temple: [2, 0], barracks: [1, 1], smithy: [0, 2],
  mine: [3, 0], heroHall: [2, 1], houses: [1, 2], lumber: [0, 3], quarry: [4, 0], warehouse: [3, 1],
  embassy: [2, 2], farm: [1, 3], stable: [0, 4], altar: [4, 1], cranny: [2, 3], tower: [1, 4],
};
export const DECOR = [[3, 2, 'well'], [4, 2, 'trees'], [3, 3, 'campfire'], [2, 4, 'trees'], [4, 3, 'trees'], [3, 4, 'trees'], [4, 4, 'trees']];
export const OFF_PLOT = ['wall', 'traps'];

// Единици. cls: inf, spear, ranged, cav; scout и settler не се бият.
// speed: полета на час (умножава се по WORLD_SPEED).
export const UNITS = {
  warrior: { cls: 'inf', epoch: 1, hp: 10, atk: 3, def: 1, carry: 15, upkeep: 1, speed: 7, cost: { food: 40, gold: 15, wood: 10 }, time: 45 },
  slinger: { cls: 'ranged', epoch: 1, tech: 'slings', hp: 6, atk: 4, def: 0, carry: 10, upkeep: 1, speed: 7, cost: { food: 35, wood: 30, gold: 15 }, time: 55 },
  catapult: { cls: 'siege', epoch: 2, tech: 'engineering', barracks: 5, hp: 30, atk: 2, def: 1, carry: 0, upkeep: 3, speed: 3, cost: { wood: 320, stone: 220, gold: 160 }, time: 300 },
  noble: { cls: 'noble', epoch: 2, tech: 'nobility', hall: 10, hp: 20, atk: 1, def: 2, carry: 0, upkeep: 4, speed: 4, cost: { gold: 4000, food: 3000, wood: 2500, stone: 2500, souls: 50 }, time: 3600 },
  scout: { cls: 'scout', epoch: 1, tech: 'scouting', hp: 2, atk: 0, def: 1, carry: 0, upkeep: 1, speed: 18, cost: { food: 30, gold: 40, wood: 20 }, time: 40 },
  settler: { cls: 'settler', epoch: 1, hall: 5, hp: 5, atk: 0, def: 0, carry: 0, upkeep: 2, speed: 5, cost: { food: 1500, wood: 1300, stone: 1300, gold: 900 }, time: 2400 },
  spear: { cls: 'spear', epoch: 2, tech: 'spears', hp: 12, atk: 3, def: 3, carry: 15, upkeep: 1, speed: 6, cost: { food: 50, wood: 40, gold: 25 }, time: 70 },
  archer: { cls: 'ranged', epoch: 2, tech: 'archery', hp: 8, atk: 6, def: 1, carry: 10, upkeep: 1, speed: 7, cost: { food: 45, wood: 60, gold: 30 }, time: 80 },
  rider: { cls: 'cav', epoch: 2, tech: 'riding', barracks: 3, hp: 18, atk: 6, def: 2, carry: 35, upkeep: 2, speed: 16, cost: { food: 90, gold: 70, wood: 30 }, time: 120 },
  pike: { cls: 'spear', epoch: 3, tech: 'pikes', hp: 16, atk: 5, def: 7, carry: 20, upkeep: 1, speed: 6, cost: { food: 80, wood: 70, gold: 50, stone: 20 }, time: 110 },
  crossbow: { cls: 'ranged', epoch: 3, tech: 'crossbows', hp: 11, atk: 10, def: 2, carry: 12, upkeep: 1, speed: 6, cost: { food: 70, wood: 90, gold: 60 }, time: 130 },
  knight: { cls: 'cav', epoch: 3, tech: 'chivalry', stable: 1, hp: 34, atk: 12, def: 6, carry: 45, upkeep: 3, speed: 14, cost: { food: 160, gold: 150, wood: 40, stone: 40 }, time: 220 },
  elite: { cls: 'inf', epoch: 2, unique: 1, hp: 30, atk: 9, def: 5, carry: 20, upkeep: 2, speed: 5, cost: { food: 120, gold: 120, mana: 30 }, time: 180 },
};
export const UNIT_ORDER = ['warrior', 'slinger', 'spear', 'archer', 'rider', 'elite', 'pike', 'crossbow', 'knight', 'catapult', 'noble', 'scout', 'settler'];
export const FIGHTERS = ['warrior', 'slinger', 'spear', 'archer', 'rider', 'elite', 'pike', 'crossbow', 'knight', 'catapult', 'noble'];

export const UNIT_NAMES = {
  humans: { warrior: 'Опълченец', slinger: 'Прашкар', spear: 'Копиеносец', archer: 'Стрелец', rider: 'Конник', elite: 'Паладин', pike: 'Пикинер', crossbow: 'Арбалетчик', knight: 'Рицар', catapult: 'Катапулт', noble: 'Благородник', scout: 'Съгледвач', settler: 'Заселници' },
  undead: { warrior: 'Скелет', slinger: 'Костен прашкар', spear: 'Гробен копиеносец', archer: 'Призрачен стрелец', rider: 'Мъртъв конник', elite: 'Гул', pike: 'Костен пикинер', crossbow: 'Прокълнат стрелец', knight: 'Рицар на смъртта', catapult: 'Костотрошач', noble: 'Лич', scout: 'Призрак', settler: 'Гробокопачи' },
  orcs: { warrior: 'Грубиян', slinger: 'Хвърлач', spear: 'Копиеносец', archer: 'Ловец', rider: 'Вълчи ездач', elite: 'Берсерк', pike: 'Бодливец', crossbow: 'Копиехвъргач', knight: 'Ездач на глиган', catapult: 'Таран', noble: 'Вожд', scout: 'Следотърсач', settler: 'Заселници' },
  vesheri: { warrior: 'Послушник', slinger: 'Прашкар', spear: 'Стражник', archer: 'Арбалетчик', rider: 'Нощен ездач', elite: 'Вещер', pike: 'Пазител', crossbow: 'Ловец на демони', knight: 'Сребърен рицар', catapult: 'Требушет', noble: 'Магистър', scout: 'Сянка', settler: 'Заселници' },
};
export const unitCls = (race, u) => (u === 'elite' && race === 'vesheri' ? 'ranged' : UNITS[u].cls);

export const CLS_NAMES = { inf: 'пехота', spear: 'копия', ranged: 'стрелци', cav: 'конница', siege: 'обсада', noble: 'завладяване', scout: 'разузнаване', settler: 'заселване', hero: 'герой' };
export const COUNTER = {
  spear: { cav: 2 },
  cav: { ranged: 2, inf: 1.2 },
  ranged: { spear: 1.5, inf: 1.2 },
  inf: { ranged: 1.2 },
};

// Скоростта на света: колко пъти по-бързо от „класическите“ браузърни стратегии.
export const WORLD_SPEED = 3;

export const TECHS = {
  agri: { name: 'Земеделие', epoch: 1, academy: 1, desc: '+15% храна', cost: { gold: 120, wood: 100 }, time: 120 },
  carp: { name: 'Дърводелство', epoch: 1, academy: 1, desc: '+15% дърво', cost: { gold: 120, stone: 100 }, time: 120 },
  scouting: { name: 'Разузнаване', epoch: 1, academy: 1, desc: 'Отключва съгледвачи', cost: { gold: 120, food: 120 }, time: 150 },
  mason: { name: 'Зидария', epoch: 1, academy: 2, desc: '+15% камък', cost: { gold: 150, wood: 150 }, time: 180 },
  slings: { name: 'Прашки', epoch: 1, academy: 1, desc: 'Отключва стрелци с прашка', cost: { gold: 100, wood: 120 }, time: 150 },
  tactics: { name: 'Строй', epoch: 1, academy: 2, req: ['slings'], desc: '+10% атака на пехотата', cost: { gold: 200, food: 200 }, time: 240 },
  bronze: { name: 'Бронзолеене', epoch: 1, academy: 3, req: ['agri', 'mason'], desc: 'Нужно за Бронзовата епоха', cost: { gold: 600, stone: 500, wood: 400 }, time: 900 },
  spears: { name: 'Копия', epoch: 2, academy: 4, desc: 'Отключва копиеносци (силни срещу конница)', cost: { gold: 500, wood: 600 }, time: 900 },
  archery: { name: 'Лъкове', epoch: 2, academy: 4, req: ['slings'], desc: 'Отключва стрелци с лък', cost: { gold: 600, wood: 700 }, time: 1100 },
  riding: { name: 'Езда', epoch: 2, academy: 5, desc: 'Отключва конница (нужна е казарма ниво 3)', cost: { gold: 900, food: 900 }, time: 1500 },
  mysticism: { name: 'Мистицизъм', epoch: 2, academy: 5, desc: 'Отключва Олтара и маната', cost: { gold: 1000, stone: 800 }, time: 1800 },
  smith: { name: 'Ковачество', epoch: 2, academy: 6, req: ['spears'], desc: '+10% атака на войската', cost: { gold: 1400, stone: 1200 }, time: 2700 },
  armor: { name: 'Броня', epoch: 2, academy: 6, req: ['smith'], desc: '+10% защита на войската', cost: { gold: 1600, stone: 1400 }, time: 3200 },
  trade: { name: 'Търговия', epoch: 2, academy: 5, desc: '+15% злато', cost: { gold: 800, wood: 800 }, time: 1600 },
  engineering: { name: 'Инженерство', epoch: 2, academy: 6, req: ['mason'], desc: 'Отключва катапулти – рушат стени и сгради (нужна е казарма ниво 5)', cost: { gold: 1800, wood: 2200, stone: 1800 }, time: 3600 },
  nobility: { name: 'Благородство', epoch: 2, academy: 8, req: ['trade'], desc: 'Отключва благородници – снижават лоялността и завладяват градове (Цитадела 10)', cost: { gold: 6000, food: 4000, souls: 30 }, time: 7200 },
  logistics: { name: 'Логистика', epoch: 2, academy: 7, req: ['trade'], desc: 'Втора опашка за строеж', cost: { gold: 2500, wood: 2000, stone: 2000 }, time: 4800 },
  iron: { name: 'Желязо', epoch: 2, academy: 10, req: ['smith', 'armor'], desc: 'Нужно за Желязната епоха', cost: { gold: 8000, stone: 8000, mana: 1500 }, time: 14400 },
  crop: { name: 'Сеитбооборот', epoch: 3, academy: 10, desc: '+15% храна', cost: { gold: 3000, wood: 3000 }, time: 5400 },
  pikes: { name: 'Пики', epoch: 3, academy: 10, req: ['spears'], desc: 'Отключва пикинери', cost: { gold: 3500, wood: 4000 }, time: 6000 },
  fortify: { name: 'Укрепления', epoch: 3, academy: 11, desc: '+50% към бонуса на стената', cost: { gold: 4000, stone: 6000 }, time: 7200 },
  crossbows: { name: 'Арбалети', epoch: 3, academy: 11, req: ['archery'], desc: 'Отключва арбалетчици', cost: { gold: 4500, wood: 5000 }, time: 7800 },
  chivalry: { name: 'Рицарство', epoch: 3, academy: 12, req: ['riding'], desc: 'Отключва тежка конница (нужна е Конюшня)', cost: { gold: 6000, food: 6000 }, time: 9000 },
  steel: { name: 'Стомана', epoch: 3, academy: 12, req: ['iron'], desc: '+10% атака на войската', cost: { gold: 7000, stone: 7000 }, time: 10800 },
  banking: { name: 'Банкерство', epoch: 3, academy: 12, req: ['trade'], desc: '+15% злато', cost: { gold: 6000, wood: 5000 }, time: 9000 },
  plate: { name: 'Плочеста броня', epoch: 3, academy: 13, req: ['steel'], desc: '+10% защита на войската', cost: { gold: 8000, stone: 9000 }, time: 12600 },
  kingdoms: { name: 'Феодално право', epoch: 3, academy: 15, req: ['steel', 'plate'], desc: 'Нужно за Епохата на кралствата (скоро)', cost: { gold: 20000, stone: 20000, mana: 5000 }, time: 28800 },
};
export const TECH_PROD = { agri: 'food', carp: 'wood', mason: 'stone', trade: 'gold', crop: 'food', banking: 'gold' };

// ---------- тактически битки ----------
export const TACTIC = { cols: 9, rows: 7, maxTurns: 12, window: 3600 };
export const TERRAIN = {
  plain: { name: 'Равнина', cost: 1, def: 1 },
  forest: { name: 'Гора', cost: 2, def: 1.25, vsRanged: true },
  hill: { name: 'Хълм', cost: 2, def: 1.2, range: 1 },
  ruins: { name: 'Руини', cost: 1, def: 1.35 },
  water: { name: 'Река', cost: 99, def: 1 },
};
export const MOVES = { inf: 2, spear: 2, ranged: 2, cav: 4, hero: 3, siege: 1, noble: 2 };
// Бойна формация по подразбиране: къде стои всеки клас в тактическата битка.
export const FORMATION = { inf: 'front', spear: 'front', hero: 'front', ranged: 'back', cav: 'flank', siege: 'back', noble: 'back' };
export const LOYALTY_REGEN = 2; // % на час

// ---------- герой ----------
export const HERO = {
  pointsPerLevel: 4, startPoints: 5,
  regen: 10, // % живот на час
  speed: 9, // полета на час
  xpFor: (lvl) => Math.round(60 * lvl ** 1.7),
};
export const HERO_POINTS = {
  str: { name: 'Сила', desc: '+4 атака на героя в битка' },
  off: { name: 'Нападение', desc: '+0,2% атака на войската, с която е героят' },
  def: { name: 'Отбрана', desc: '+0,2% защита на войската в града на героя' },
  res: { name: 'Стопанин', desc: '+1% производство в града на героя (до 25%)' },
};
export const SLOTS = { weapon: 'Оръжие', armor: 'Броня', helmet: 'Шлем', horse: 'Кон', amulet: 'Амулет' };
export const TIERS = [
  { name: 'обикновен', color: '#b9b4a8' },
  { name: 'рядък', color: '#6aa8ff' },
  { name: 'епичен', color: '#b48cff' },
  { name: 'легендарен', color: '#f2c14e' },
];
// Ефект на предмет по слот и ниво (1–4).
export const ITEM_FX = {
  weapon: { val: [6, 12, 20, 32], text: (v) => `+${v} атака на героя` },
  armor: { val: [30, 60, 110, 180], text: (v) => `+${v} живот на героя, −${Math.round(v / 7)}% рани` },
  helmet: { val: [10, 20, 35, 50], text: (v) => `+${v}% опит` },
  horse: { val: [30, 60, 90, 130], text: (v) => `+${v}% скорост на героя` },
  amulet: { val: [5, 10, 15, 25], text: (v) => `+${v}% възстановяване на час` },
};
export const ITEM_NAMES = {
  weapon: ['Ръждясал меч', 'Бронзов меч', 'Меч на вожда', 'Острието на Падението'],
  armor: ['Кожена броня', 'Плетена ризница', 'Бронзова броня', 'Люспите на дракона'],
  helmet: ['Кожена шапка', 'Бронзов шлем', 'Шлем с гребен', 'Короната на прадедите'],
  horse: ['Дърта кранта', 'Степен кон', 'Боен жребец', 'Нощен ат'],
  amulet: ['Костен амулет', 'Сребърен талисман', 'Окото на вещера', 'Сърцето на Падението'],
};
export const ADVENTURE = { every: 5 * 3600, max: 4, life: 24 * 3600 };

// ---------- свят ----------
export const WORLD_R = 20; // координати от −20 до 20
export const OASIS_RES = ['wood', 'stone', 'food', 'gold'];
export const OASIS_BONUS = 0.25;
export const OASIS_RANGE = 3;
export const OASIS_RESPAWN = 8 * 3600;
export const CAMP_RESPAWN = 1200;
export const CAMP_SLOTS = [1, 2, 2, 3, 4, 5];
export const CAMP_START = [1, 1, 2, 2, 3, 4];
export const CAMP_NAMES = ['Мародери', 'Пепелни разбойници', 'Глутница', 'Свърталище', 'Бандитски форт', 'Лагер на вожда'];

export const PROTECTION = 5 * 24 * 3600; // защита за новаци (сек при скорост 1)
export const NIGHT = { from: 0, to: 7, bonus: 1.5 }; // нощен бонус към защитата
export const NPC_ATTACK_EVERY = [10 * 3600, 22 * 3600];
export const PACT = { time: 3 * 24 * 3600 };

export const NPC_CLANS = [
  { id: 'c0', name: 'Пепелните', tag: 'ПЕП', color: '#a8553a' },
  { id: 'c1', name: 'Нощните вълци', tag: 'ВЪЛ', color: '#5a6a9a' },
  { id: 'c2', name: 'Кървавият полумесец', tag: 'КРВ', color: '#9a2a3a' },
];
export const NPC_NAMES = [
  'Ворг Пепелния', 'Сестрите на мъглата', 'Кан Злоруд', 'Черния Боян', 'Велмира Тъмната', 'Гнилия Дарг', 'Вълчия хан',
  'Мълчаливия Стоян', 'Горан Костотрошача', 'Вещицата Морана', 'Железния Ратко', 'Пепелянката', 'Сивия Драгош', 'Безименния',
];

// ---------- мисии ----------
const lvl = (b) => (s) => Math.max(0, ...s.cities.map((c) => c.b[b] || 0));
export const STORY = [
  { id: 's1', title: 'Огнище', text: 'Постройте ферма', undeadText: 'Постройте гробище', goal: 1, get: lvl('farm'), reward: { wood: 150, stone: 100 } },
  { id: 's2', title: 'Дърва за зимата', text: 'Постройте дъскорезница', goal: 1, get: lvl('lumber'), reward: { food: 150, gold: 50 } },
  { id: 's3', title: 'Камък по камък', text: 'Постройте кариера', goal: 1, get: lvl('quarry'), reward: { wood: 200 } },
  { id: 'h1', title: 'Пътят на героя', text: 'Изпратете героя на приключение', goal: 1, get: (s) => s.stats.adventures || 0, reward: { gold: 150, food: 150 } },
  { id: 's4', title: 'Покрив над главата', text: 'Постройте жилища', goal: 1, get: lvl('houses'), reward: { gold: 120 } },
  { id: 's5', title: 'Цитаделата расте', text: 'Цитадела ниво 2', goal: 2, get: lvl('hall'), reward: { wood: 250, stone: 250 } },
  { id: 's6', title: 'Под знамената', text: 'Постройте казарма', goal: 1, get: lvl('barracks'), reward: { food: 300 } },
  { id: 's7', title: 'Първите воини', text: 'Обучете 5 единици', goal: 5, get: (s) => s.stats.trained, reward: { gold: 200, food: 200 } },
  { id: 's8', title: 'Кръв по пепелта', text: 'Победете лагер ниво 1', goal: 1, get: (s) => (s.stats.bestCamp >= 1 ? 1 : 0), reward: { gold: 250, wood: 250, souls: 2 } },
  { id: 'd1', title: 'Зад кол и камък', text: 'Постройте палисада', goal: 1, get: lvl('wall'), reward: { wood: 250, stone: 150 } },
  { id: 's9', title: 'Знание е сила', text: 'Постройте академия', goal: 1, get: lvl('academy'), reward: { gold: 200 } },
  { id: 's10', title: 'Първата наука', text: 'Завършете едно изследване', goal: 1, get: (s) => Object.keys(s.techs).length, reward: { wood: 300, stone: 300 } },
  { id: 'd2', title: 'Скрито съкровище', text: 'Постройте скривалище', goal: 1, get: lvl('cranny'), reward: { gold: 200 } },
  { id: 's11', title: 'Запаси', text: 'Склад ниво 2', goal: 2, get: lvl('warehouse'), reward: { food: 400 } },
  { id: 'h2', title: 'Дом за героя', text: 'Постройте Зала на героите', goal: 1, get: lvl('heroHall'), reward: { gold: 300, wood: 300 } },
  { id: 's12', title: 'Каменни стени', text: 'Цитадела ниво 3', goal: 3, get: lvl('hall'), reward: { gold: 400, stone: 400 } },
  { id: 'd3', title: 'Очи в мрака', text: 'Разузнайте чужд град', goal: 1, get: (s) => s.stats.scouted || 0, reward: { gold: 300, food: 300 } },
  { id: 's13', title: 'Стопанство', text: 'Ферма, дъскорезница, кариера и мина на ниво 3', goal: 4, get: (s) => ['farm', 'lumber', 'quarry', 'mine'].filter((b) => lvl(b)(s) >= 3).length, reward: { gold: 500, food: 500 } },
  { id: 's14', title: 'Гласът на войната', text: 'Победете лагер ниво 3', goal: 1, get: (s) => (s.stats.bestCamp >= 3 ? 1 : 0), reward: { gold: 500, wood: 500, souls: 5 } },
  { id: 'd4', title: 'Удържахме!', text: 'Отбийте нападение', goal: 1, get: (s) => s.stats.defWins || 0, reward: { gold: 600, stone: 600, souls: 5 } },
  { id: 's15', title: 'Тайната на бронза', text: 'Изследвайте Бронзолеене', goal: 1, get: (s) => (s.techs.bronze ? 1 : 0), reward: { stone: 800, wood: 800 } },
  { id: 'h3', title: 'Изворът', text: 'Завладейте оазис', goal: 1, get: (s) => s.oases.length, reward: { gold: 800, souls: 8 } },
  { id: 's16', title: 'Твърдина', text: 'Цитадела ниво 5', goal: 5, get: lvl('hall'), reward: { gold: 800 } },
  { id: 's17', title: 'Вождът на пепелищата', text: 'Победете лагер ниво 5 – вожда на варварите', goal: 1, get: (s) => (s.stats.bestCamp >= 5 ? 1 : 0), reward: { gold: 1000, food: 1000, souls: 10 }, key: true },
  { id: 's18', title: 'Нова епоха', text: 'Преминете в Бронзовата епоха', goal: 2, get: (s) => s.epoch, reward: { gold: 1500, wood: 1500, stone: 1500 } },
  { id: 'c1', title: 'Нова земя', text: 'Основете втори град', goal: 2, get: (s) => s.cities.length, reward: { gold: 2000, wood: 2000, stone: 2000, food: 2000 } },
  { id: 's19', title: 'Разломите', text: 'Постройте олтар', goal: 1, get: lvl('altar'), reward: { mana: 200 } },
  { id: 's20', title: 'Наследството', text: 'Постройте уникалната сграда на расата', goal: 1, get: lvl('unique'), reward: { gold: 1500, souls: 10 } },
  { id: 's21', title: 'Конница', text: 'Изследвайте Езда', goal: 1, get: (s) => (s.techs.riding ? 1 : 0), reward: { food: 2000 } },
  { id: 's22', title: 'Владетел', text: 'Цитадела ниво 7', goal: 7, get: lvl('hall'), reward: { gold: 2500, stone: 2500 } },
  { id: 's23', title: 'Ужасът на степта', text: 'Победете лагер ниво 8', goal: 1, get: (s) => (s.stats.bestCamp >= 8 ? 1 : 0), reward: { gold: 3000, souls: 25 } },
  { id: 's24', title: 'Империя', text: 'Цитадела ниво 10', goal: 10, get: lvl('hall'), reward: { gold: 6000, wood: 6000, stone: 6000, souls: 50 } },
  { id: 'k3', title: 'Повелителят на степта', text: 'Победете лагер ниво 10', goal: 1, get: (s) => (s.stats.bestCamp >= 10 ? 1 : 0), reward: { gold: 5000, food: 5000, souls: 40 }, key: true },
  { id: 's25', title: 'Желязна воля', text: 'Преминете в Желязната епоха', goal: 3, get: (s) => s.epoch, reward: { gold: 8000, wood: 8000, stone: 8000 } },
  { id: 's26', title: 'Подкови и шпори', text: 'Постройте конюшня', goal: 1, get: lvl('stable'), reward: { food: 6000, gold: 3000 } },
  { id: 's27', title: 'Храмът на прадедите', text: 'Постройте храм', goal: 1, get: lvl('temple'), reward: { souls: 60 } },
  { id: 's28', title: 'Стоманени редици', text: 'Изследвайте Стомана', goal: 1, get: (s) => (s.techs.steel ? 1 : 0), reward: { gold: 9000, stone: 9000 } },
  { id: 's29', title: 'Крепост', text: 'Цитадела ниво 12', goal: 12, get: lvl('hall'), reward: { gold: 12000, wood: 12000 } },
  { id: 's30', title: 'Последният вожд', text: 'Победете лагер ниво 15', goal: 1, get: (s) => (s.stats.bestCamp >= 15 ? 1 : 0), reward: { gold: 15000, souls: 120 } },
  { id: 's31', title: 'Желязна империя', text: 'Цитадела ниво 15', goal: 15, get: lvl('hall'), reward: { gold: 25000, wood: 25000, stone: 25000, souls: 200 } },
];

export const DAILY = [
  { id: 'd_build', text: 'Започнете 3 строежа', key: 'built', goal: 3, reward: { wood: 1, stone: 1 } },
  { id: 'd_train', text: 'Обучете 10 единици', key: 'trained', goal: 10, reward: { food: 1, gold: 0.5 } },
  { id: 'd_raid', text: 'Спечелете 2 набега', key: 'raids', goal: 2, reward: { gold: 1, food: 0.5 }, souls: 3 },
  { id: 'd_research', text: 'Завършете изследване', key: 'researched', goal: 1, reward: { gold: 1, wood: 0.5 } },
  { id: 'd_build5', text: 'Започнете 5 строежа', key: 'built', goal: 5, reward: { gold: 1, food: 1 } },
  { id: 'd_raid1', text: 'Спечелете набег', key: 'raids', goal: 1, reward: { food: 1, wood: 1 } },
  { id: 'd_adv', text: 'Изпратете героя на 2 приключения', key: 'adventures', goal: 2, reward: { gold: 1, stone: 1 } },
  { id: 'd_scout', text: 'Разузнайте цел', key: 'scouted', goal: 1, reward: { gold: 0.5, food: 1 } },
  { id: 'd_tactic', text: 'Спечелете тактическа битка', key: 'tactics', goal: 1, reward: { gold: 1, wood: 1 }, souls: 2 },
];
