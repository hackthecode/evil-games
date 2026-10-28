// АВТОМАТИЧНО ГЕНЕРИРАН ФАЙЛ – не редактирайте ръчно.
// Източник: js/games/empires/ и supabase/functions/empires/handler.ts (виж tools/build-empires.py).
// @ts-nocheck
/* eslint-disable */
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const __m = {};
__m['js/games/empires/data.js'] = (() => {
// Evil Empires – данни: раси, ресурси, епохи, сгради, единици, технологии, герой,
// свят (оазиси, империи на компютъра), мисии. Всички числа за баланса са тук.

const RES = ['gold', 'wood', 'stone', 'food', 'mana', 'souls'];
const RES_NAMES = { gold: 'Злато', wood: 'Дърво', stone: 'Камък', food: 'Храна', mana: 'Мана', souls: 'Души' };
const resName = (race, r) => (r === 'food' && race === 'undead' ? 'Кости' : RES_NAMES[r]);

const RACES = {
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

const EPOCHS = [
  { n: 1, name: 'Пепелна епоха', cap: 5 },
  { n: 2, name: 'Бронзова епоха', cap: 10 },
  { n: 3, name: 'Желязна епоха', cap: 15 },
  { n: 4, name: 'Епоха на кралствата', cap: 20 },
  { n: 5, name: 'Епоха на мрака', cap: 25 },
];
// До коя епоха може да се стигне в тази версия на играта.
const MAX_EPOCH = 3;

const EPOCH_UP = {
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
const COST_GROWTH = 1.55;
const TIME_GROWTH = 1.75;

const BUILDINGS = {
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

const UNIQUE = {
  humans: { name: 'Търговска гилдия', desc: 'Носи злато и обучава паладини.', prod: { gold: 60 } },
  undead: { name: 'Некрополис', desc: 'Изравя още кости и вдига гулове.', prod: { food: 70 } },
  orcs: { name: 'Бойна яма', desc: 'Обучава берсерки. Всяко ниво ускорява обучението на войска с 5%.' },
  vesheri: { name: 'Кула на вещерите', desc: 'Събира мана и обучава вещери.', prod: { mana: 40 } },
};

// Разположение на сградите в града: (i, j) в изометрична мрежа 5×5 (високите сгради – отзад).
// Палисадата и капаните нямат парцел – рисуват се по края на града.
const GRID = 5;
const PLOTS = {
  hall: [0, 0], unique: [1, 0], academy: [0, 1], temple: [2, 0], barracks: [1, 1], smithy: [0, 2],
  mine: [3, 0], heroHall: [2, 1], houses: [1, 2], lumber: [0, 3], quarry: [4, 0], warehouse: [3, 1],
  embassy: [2, 2], farm: [1, 3], stable: [0, 4], altar: [4, 1], cranny: [2, 3], tower: [1, 4],
};
const DECOR = [[3, 2, 'well'], [4, 2, 'trees'], [3, 3, 'campfire'], [2, 4, 'trees'], [4, 3, 'trees'], [3, 4, 'trees'], [4, 4, 'trees']];
const OFF_PLOT = ['wall', 'traps'];

// Единици. cls: inf, spear, ranged, cav; scout и settler не се бият.
// speed: полета на час (умножава се по WORLD_SPEED).
const UNITS = {
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
const UNIT_ORDER = ['warrior', 'slinger', 'spear', 'archer', 'rider', 'elite', 'pike', 'crossbow', 'knight', 'catapult', 'noble', 'scout', 'settler'];
const FIGHTERS = ['warrior', 'slinger', 'spear', 'archer', 'rider', 'elite', 'pike', 'crossbow', 'knight', 'catapult', 'noble'];

const UNIT_NAMES = {
  humans: { warrior: 'Опълченец', slinger: 'Прашкар', spear: 'Копиеносец', archer: 'Стрелец', rider: 'Конник', elite: 'Паладин', pike: 'Пикинер', crossbow: 'Арбалетчик', knight: 'Рицар', catapult: 'Катапулт', noble: 'Благородник', scout: 'Съгледвач', settler: 'Заселници' },
  undead: { warrior: 'Скелет', slinger: 'Костен прашкар', spear: 'Гробен копиеносец', archer: 'Призрачен стрелец', rider: 'Мъртъв конник', elite: 'Гул', pike: 'Костен пикинер', crossbow: 'Прокълнат стрелец', knight: 'Рицар на смъртта', catapult: 'Костотрошач', noble: 'Лич', scout: 'Призрак', settler: 'Гробокопачи' },
  orcs: { warrior: 'Грубиян', slinger: 'Хвърлач', spear: 'Копиеносец', archer: 'Ловец', rider: 'Вълчи ездач', elite: 'Берсерк', pike: 'Бодливец', crossbow: 'Копиехвъргач', knight: 'Ездач на глиган', catapult: 'Таран', noble: 'Вожд', scout: 'Следотърсач', settler: 'Заселници' },
  vesheri: { warrior: 'Послушник', slinger: 'Прашкар', spear: 'Стражник', archer: 'Арбалетчик', rider: 'Нощен ездач', elite: 'Вещер', pike: 'Пазител', crossbow: 'Ловец на демони', knight: 'Сребърен рицар', catapult: 'Требушет', noble: 'Магистър', scout: 'Сянка', settler: 'Заселници' },
};
const unitCls = (race, u) => (u === 'elite' && race === 'vesheri' ? 'ranged' : UNITS[u].cls);

const CLS_NAMES = { inf: 'пехота', spear: 'копия', ranged: 'стрелци', cav: 'конница', siege: 'обсада', noble: 'завладяване', scout: 'разузнаване', settler: 'заселване', hero: 'герой' };
const COUNTER = {
  spear: { cav: 2 },
  cav: { ranged: 2, inf: 1.2 },
  ranged: { spear: 1.5, inf: 1.2 },
  inf: { ranged: 1.2 },
};

// Скоростта на света: колко пъти по-бързо от „класическите“ браузърни стратегии.
const WORLD_SPEED = 3;

const TECHS = {
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
const TECH_PROD = { agri: 'food', carp: 'wood', mason: 'stone', trade: 'gold', crop: 'food', banking: 'gold' };

// ---------- тактически битки ----------
const TACTIC = { cols: 9, rows: 7, maxTurns: 12, window: 3600 };
const TERRAIN = {
  plain: { name: 'Равнина', cost: 1, def: 1 },
  forest: { name: 'Гора', cost: 2, def: 1.25, vsRanged: true },
  hill: { name: 'Хълм', cost: 2, def: 1.2, range: 1 },
  ruins: { name: 'Руини', cost: 1, def: 1.35 },
  water: { name: 'Река', cost: 99, def: 1 },
};
const MOVES = { inf: 2, spear: 2, ranged: 2, cav: 4, hero: 3, siege: 1, noble: 2 };
// Бойна формация по подразбиране: къде стои всеки клас в тактическата битка.
const FORMATION = { inf: 'front', spear: 'front', hero: 'front', ranged: 'back', cav: 'flank', siege: 'back', noble: 'back' };
const LOYALTY_REGEN = 2; // % на час

// ---------- герой ----------
const HERO = {
  pointsPerLevel: 4, startPoints: 5,
  regen: 10, // % живот на час
  speed: 9, // полета на час
  xpFor: (lvl) => Math.round(60 * lvl ** 1.7),
};
const HERO_POINTS = {
  str: { name: 'Сила', desc: '+4 атака на героя в битка' },
  off: { name: 'Нападение', desc: '+0,2% атака на войската, с която е героят' },
  def: { name: 'Отбрана', desc: '+0,2% защита на войската в града на героя' },
  res: { name: 'Стопанин', desc: '+1% производство в града на героя (до 25%)' },
};
const SLOTS = { weapon: 'Оръжие', armor: 'Броня', helmet: 'Шлем', horse: 'Кон', amulet: 'Амулет' };
const TIERS = [
  { name: 'обикновен', color: '#b9b4a8' },
  { name: 'рядък', color: '#6aa8ff' },
  { name: 'епичен', color: '#b48cff' },
  { name: 'легендарен', color: '#f2c14e' },
];
// Ефект на предмет по слот и ниво (1–4).
const ITEM_FX = {
  weapon: { val: [6, 12, 20, 32], text: (v) => `+${v} атака на героя` },
  armor: { val: [30, 60, 110, 180], text: (v) => `+${v} живот на героя, −${Math.round(v / 7)}% рани` },
  helmet: { val: [10, 20, 35, 50], text: (v) => `+${v}% опит` },
  horse: { val: [30, 60, 90, 130], text: (v) => `+${v}% скорост на героя` },
  amulet: { val: [5, 10, 15, 25], text: (v) => `+${v}% възстановяване на час` },
};
const ITEM_NAMES = {
  weapon: ['Ръждясал меч', 'Бронзов меч', 'Меч на вожда', 'Острието на Падението'],
  armor: ['Кожена броня', 'Плетена ризница', 'Бронзова броня', 'Люспите на дракона'],
  helmet: ['Кожена шапка', 'Бронзов шлем', 'Шлем с гребен', 'Короната на прадедите'],
  horse: ['Дърта кранта', 'Степен кон', 'Боен жребец', 'Нощен ат'],
  amulet: ['Костен амулет', 'Сребърен талисман', 'Окото на вещера', 'Сърцето на Падението'],
};
const ADVENTURE = { every: 5 * 3600, max: 4, life: 24 * 3600 };

// ---------- свят ----------
const WORLD_R = 20; // координати от −20 до 20
const OASIS_RES = ['wood', 'stone', 'food', 'gold'];
const OASIS_BONUS = 0.25;
const OASIS_RANGE = 3;
const OASIS_RESPAWN = 8 * 3600;
const CAMP_RESPAWN = 1200;
const CAMP_SLOTS = [1, 2, 2, 3, 4, 5];
const CAMP_START = [1, 1, 2, 2, 3, 4];
const CAMP_NAMES = ['Мародери', 'Пепелни разбойници', 'Глутница', 'Свърталище', 'Бандитски форт', 'Лагер на вожда'];

const PROTECTION = 5 * 24 * 3600; // защита за новаци (сек при скорост 1)
const NIGHT = { from: 0, to: 7, bonus: 1.5 }; // нощен бонус към защитата
const NPC_ATTACK_EVERY = [10 * 3600, 22 * 3600];
const PACT = { time: 3 * 24 * 3600 };

const NPC_CLANS = [
  { id: 'c0', name: 'Пепелните', tag: 'ПЕП', color: '#a8553a' },
  { id: 'c1', name: 'Нощните вълци', tag: 'ВЪЛ', color: '#5a6a9a' },
  { id: 'c2', name: 'Кървавият полумесец', tag: 'КРВ', color: '#9a2a3a' },
];
const NPC_NAMES = [
  'Ворг Пепелния', 'Сестрите на мъглата', 'Кан Злоруд', 'Черния Боян', 'Велмира Тъмната', 'Гнилия Дарг', 'Вълчия хан',
  'Мълчаливия Стоян', 'Горан Костотрошача', 'Вещицата Морана', 'Железния Ратко', 'Пепелянката', 'Сивия Драгош', 'Безименния',
];

// ---------- мисии ----------
const lvl = (b) => (s) => Math.max(0, ...s.cities.map((c) => c.b[b] || 0));
const STORY = [
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

const DAILY = [
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

return { RES, RES_NAMES, resName, RACES, EPOCHS, MAX_EPOCH, EPOCH_UP, COST_GROWTH, TIME_GROWTH, BUILDINGS, UNIQUE, GRID, PLOTS, DECOR, OFF_PLOT, UNITS, UNIT_ORDER, FIGHTERS, UNIT_NAMES, unitCls, CLS_NAMES, COUNTER, WORLD_SPEED, TECHS, TECH_PROD, TACTIC, TERRAIN, MOVES, FORMATION, LOYALTY_REGEN, HERO, HERO_POINTS, SLOTS, TIERS, ITEM_FX, ITEM_NAMES, ADVENTURE, WORLD_R, OASIS_RES, OASIS_BONUS, OASIS_RANGE, OASIS_RESPAWN, CAMP_RESPAWN, CAMP_SLOTS, CAMP_START, CAMP_NAMES, PROTECTION, NIGHT, NPC_ATTACK_EVERY, PACT, NPC_CLANS, NPC_NAMES, STORY, DAILY };
})();

__m['js/games/empires/battle.js'] = (() => {
// Бърза (автоматична) битка между две армии. Детерминирана при еднакво зърно –
// същият резултат може да се пресметне и на сървъра.
const { COUNTER } = __m['js/games/empires/data.js'];

function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const mult = (a, b) => COUNTER[a]?.[b] ?? 1;

/**
 * side: [{ key, cls, n, hp, atk, def }] (atk/def вече с бонусите).
 * defMult/defHp – множители за защитниците (стена, нощен бонус).
 * Връща { win: 'att' | 'def', rounds, att: [{key, n, lost, dmg}], def: [...] }.
 * Стрелците стрелят сами в първия рунд; после всички едновременно.
 */
function fight(attSide, defSide, seed, { maxRounds = 8, defMult = 1, defHp = 1 } = {}) {
  const rand = rng(seed);
  const prep = (side, dm = 1, hm = 1) => side.filter((g) => g.n > 0).map((g) => ({ ...g, def: g.def * dm, hp: g.hp * hm, start: g.n, dmg: 0 }));
  const A = prep(attSide), D = prep(defSide, defMult, defHp);
  const alive = (side) => side.some((g) => g.n > 0);
  let round = 0;
  while (alive(A) && alive(D) && round < maxRounds) {
    round++;
    const onlyRanged = round === 1;
    const hitA = volley(A, D, onlyRanged, rand);
    const hitD = volley(D, A, onlyRanged, rand);
    apply(D, hitA);
    apply(A, hitD);
  }
  const out = (side) => side.map((g) => ({ key: g.key, n: g.n, lost: g.start - g.n, dmg: g.n > 0 ? g.dmg / g.hp : 0 }));
  return { win: alive(A) && !alive(D) ? 'att' : 'def', rounds: round, att: out(A), def: out(D) };
}

function volley(from, to, onlyRanged, rand) {
  const hits = to.map(() => 0);
  const targets = to.map((t) => (t.n > 0 ? t.n * t.hp : 0));
  const total = targets.reduce((a, b) => a + b, 0);
  if (!total) return hits;
  for (const g of from) {
    if (g.n <= 0 || (onlyRanged && g.cls !== 'ranged')) continue;
    const power = g.n * g.atk * (0.9 + rand() * 0.2);
    to.forEach((t, i) => {
      if (!targets[i]) return;
      hits[i] += ((power * targets[i]) / total) * mult(g.cls, t.cls) * (10 / (10 + t.def * 2));
    });
  }
  return hits;
}

function apply(side, hits) {
  side.forEach((g, i) => {
    if (!hits[i] || g.n <= 0) return;
    g.dmg += hits[i];
    const dead = Math.min(g.n, Math.floor(g.dmg / g.hp));
    g.n -= dead;
    g.dmg -= dead * g.hp;
  });
}

// Груба оценка на силата на армия (за подсказки в интерфейса).
const power = (side, defMult = 1) => Math.round(side.reduce((a, g) => a + g.n * Math.sqrt(g.hp * Math.max(g.atk, 0.5) * (1 + (g.def * defMult) / 5)), 0));

return { rng, hashStr, fight, power };
})();

__m['js/games/empires/worldgen.js'] = (() => {
// Evil Empires – светът: детерминирано генериране от зърното на света (терен, оазиси,
// империи на компютъра, места за градовете на играчите). Само чисти функции.
const { WORLD_R, OASIS_RES, NPC_NAMES, NPC_CLANS, CAMP_SLOTS } = __m['js/games/empires/data.js'];
const { hashStr } = __m['js/games/empires/battle.js'];

const RACES = ['humans', 'undead', 'orcs', 'vesheri'];

const hash2 = (seed, x, y, k = 0) => {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(x + 1000, 374761393) ^ Math.imul(y + 1000, 668265263) ^ Math.imul(k + 7, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const inWorld = (x, y) => Math.abs(x) <= WORLD_R && Math.abs(y) <= WORLD_R;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tileKey = (x, y) => `${x}|${y}`;

// Терен: трева (може да се строи), гора, хълмове, езеро, оазис.
function tileAt(seed, x, y) {
  if (!inWorld(x, y)) return { kind: 'void' };
  const v = hash2(seed, x, y);
  // „петна“ – съседните полета си приличат
  const near = (hash2(seed, x >> 2, y >> 2, 1) + hash2(seed, (x + 2) >> 2, (y + 1) >> 2, 1)) / 2;
  if (Math.abs(x) + Math.abs(y) > 2) {
    if (v < 0.055) {
      const res = OASIS_RES[Math.floor(hash2(seed, x, y, 2) * OASIS_RES.length)];
      const lvl = 1 + Math.floor(hash2(seed, x, y, 3) * 4 + Math.hypot(x, y) / 6);
      return { kind: 'oasis', res, lvl };
    }
    if (v < 0.09 && near < 0.45) return { kind: 'lake' };
  }
  if (near > 0.62 && v < 0.55) return { kind: 'forest' };
  if (near < 0.3 && v < 0.45) return { kind: 'hills' };
  return { kind: 'grass' };
}

// Империите на компютъра: позиции, раса, клан и „преднина“ в развитието.
const npcCache = new Map();
function npcList(seed) {
  if (npcCache.has(seed)) return npcCache.get(seed);
  const list = NPC_NAMES.map((name, i) => {
    const ang = (i / NPC_NAMES.length) * Math.PI * 2 + hash2(seed, i, 0, 9) * 0.5;
    const rad = 7 + hash2(seed, i, 1, 9) * 11;
    let x = Math.round(Math.cos(ang) * rad), y = Math.round(Math.sin(ang) * rad);
    for (let k = 0; k < 20 && tileAt(seed, x, y).kind !== 'grass'; k++) x += k % 2 ? 1 : 0, y += k % 2 ? 0 : 1;
    return {
      id: `n${i}`, name, x, y,
      race: RACES[Math.floor(hash2(seed, i, 2, 9) * 4)],
      clan: NPC_CLANS[i % NPC_CLANS.length].id,
      head: (i % 5) * 0.6, // дни преднина
    };
  });
  npcCache.set(seed, list);
  return list;
}

// Свободно място за нов град (търси по спирала от начална точка).
function findSpot(seed, start, taken, minGap = 2) {
  const ok = (x, y) => tileAt(seed, x, y).kind === 'grass' && !taken(x, y, minGap);
  for (let r = 0; r <= WORLD_R; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of r === Math.abs(dx) ? [r - Math.abs(dx)] : [r - Math.abs(dx), -(r - Math.abs(dx))]) {
        const x = start.x + dx, y = start.y + dy;
        if (inWorld(x, y) && ok(x, y)) return { x, y };
      }
    }
  }
  return null;
}

function homeStart(seed, uid) {
  const h = hashStr(`${seed}:${uid}`);
  const ang = (h % 3600) / 3600 * Math.PI * 2;
  const rad = 4 + ((h >>> 12) % 1000) / 1000 * 11;
  return { x: Math.round(Math.cos(ang) * rad), y: Math.round(Math.sin(ang) * rad) };
}

// Варварските лагери на играча – около столицата му.
function campSpots(seed, home) {
  return CAMP_SLOTS.map((d, i) => {
    const ang = (i / CAMP_SLOTS.length) * Math.PI * 2 + hash2(seed, home.x, home.y, 20 + i) * 0.8;
    const r = d * 1.6 + 0.6;
    return { x: Math.max(-WORLD_R, Math.min(WORLD_R, home.x + Math.round(Math.cos(ang) * r))), y: Math.max(-WORLD_R, Math.min(WORLD_R, home.y + Math.round(Math.sin(ang) * r))) };
  });
}

return { hash2, inWorld, dist, tileKey, tileAt, npcList, findSpot, homeStart, campSpots };
})();

__m['js/games/empires/tactics.js'] = (() => {
// Evil Empires – тактическа битка на ходове върху шестоъгълна карта.
// Детерминирана: една и съща битка + същите ходове дават един и същ резултат,
// затова сървърът може да провери битката, като повтори ходовете на играча.
// Нападателят е страна 'A' (играчът), защитникът – 'D' (компютърът).
const { TACTIC, TERRAIN, MOVES, COUNTER, FORMATION } = __m['js/games/empires/data.js'];
const { rng, hashStr } = __m['js/games/empires/battle.js'];

const EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
const MELEE = ['inf', 'spear', 'hero'];

function neighbors(st, q, r) {
  return ((r & 1) ? ODD : EVEN).map(([dq, dr]) => [q + dq, r + dr]).filter(([a, b]) => a >= 0 && a < st.cols && b >= 0 && b < st.rows);
}

const cube = (q, r) => { const x = q - (r - (r & 1)) / 2; return [x, -x - r, r]; };
function hexDist(a, b) {
  const [x1, y1, z1] = cube(a.q, a.r), [x2, y2, z2] = cube(b.q, b.r);
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

const terrainAt = (st, q, r) => st.terrain[r * st.cols + q];
const alive = (st, side) => st.units.filter((u) => u.side === side && u.n > 0);
const unitAt = (st, q, r) => st.units.find((u) => u.n > 0 && u.q === q && u.r === r);
const rangeOf = (st, u) => (u.cls === 'ranged' ? 3 + (TERRAIN[terrainAt(st, u.q, u.r)].range || 0) : 1);

/**
 * Нова битка. att/def: групи { key, cls, n, hp, atk, def }; opts: { defMult, defHp, formA, formD }
 * (formA/formD – бойна формация: клас → 'front' | 'back' | 'flank').
 */
function createBattle(seed, att, def, { defMult = 1, defHp = 1, formA = null, formD = null } = {}) {
  const cols = TACTIC.cols, rows = TACTIC.rows;
  const r = rng(hashStr(`tac:${seed}`));
  const terrain = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const deploy = x <= 1 || x >= cols - 2;
      const v = r();
      terrain.push(v < 0.14 ? 'forest' : v < 0.24 ? 'hill' : v < 0.3 && !deploy ? 'ruins' : v < 0.34 && !deploy ? 'water' : 'plain');
    }
  }
  const st = { seed: String(seed), cols, rows, terrain, units: [], turn: 1, side: 'A', over: false, win: null, defMult, defHp, k: 0, log: [] };
  let id = 0;
  const place = (groups, side, form) => {
    const F = { ...FORMATION, ...(form || {}) };
    const front = side === 'A' ? 1 : cols - 2, back = side === 'A' ? 0 : cols - 1, extra = side === 'A' ? 2 : cols - 3;
    const CENTER = [3, 2, 4, 1, 5, 0, 6], FLANK = [0, 6, 1, 5, 2, 4, 3];
    const used = new Set();
    const tryCol = (u, c, order) => {
      for (const row of order) {
        const key = `${c},${row}`;
        if (used.has(key) || terrain[row * cols + c] === 'water') continue;
        used.add(key);
        u.q = c;
        u.r = row;
        return true;
      }
      return false;
    };
    const put = (u, pos) => {
      const plan = pos === 'flank' ? [[back, FLANK], [front, FLANK]] : pos === 'back' ? [[back, CENTER], [front, CENTER]] : [[front, CENTER], [back, CENTER]];
      for (const [c, order] of [...plan, [extra, CENTER]]) if (tryCol(u, c, order)) return true;
      // ако няма място – където и да е в своята половина
      for (let c = 0; c < cols; c++) if ((side === 'A' ? c < cols / 2 : c >= cols / 2) && tryCol(u, c, CENTER)) return true;
      return false;
    };
    const list = groups.filter((g) => g.n > 0).map((g, gi) => ({
      id: id++, gi, side, key: g.key, cls: g.cls === 'elite' ? 'inf' : g.cls, n: g.n, start: g.n,
      hp: g.hp * (side === 'D' ? defHp : 1), atk: g.atk, def: g.def, dmg: 0, q: 0, r: 0, moved: false, acted: false,
    }));
    const rank = { front: 0, flank: 1, back: 2 };
    for (const u of [...list].sort((a, b) => rank[F[a.cls] || 'front'] - rank[F[b.cls] || 'front'])) put(u, F[u.cls] || 'front');
    st.units.push(...list);
  };
  place(att, 'A', formA);
  place(def, 'D', formD);
  return st;
}

// Полета, до които единицата може да стигне този ход: { "q,r": цена }.
function reachable(st, u) {
  const out = new Map();
  if (u.moved || u.acted || u.n <= 0) return out;
  const mp = MOVES[u.cls] || 2;
  const enemyNear = (q, r) => neighbors(st, q, r).some(([a, b]) => { const e = unitAt(st, a, b); return e && e.side !== u.side; });
  const best = new Map([[`${u.q},${u.r}`, 0]]);
  const queue = [[u.q, u.r, 0]];
  while (queue.length) {
    queue.sort((a, b) => a[2] - b[2]);
    const [q, r, c] = queue.shift();
    if (c > (best.get(`${q},${r}`) ?? Infinity)) continue;
    if ((q !== u.q || r !== u.r) && enemyNear(q, r)) continue; // зона на контрол: спира тук
    for (const [a, b] of neighbors(st, q, r)) {
      const cost = c + TERRAIN[terrainAt(st, a, b)].cost;
      if (cost > mp || unitAt(st, a, b)) continue;
      const key = `${a},${b}`;
      if (cost < (best.get(key) ?? Infinity)) {
        best.set(key, cost);
        out.set(key, cost);
        queue.push([a, b, cost]);
      }
    }
  }
  return out;
}

function targets(st, u) {
  if (u.acted || u.n <= 0) return [];
  const R = rangeOf(st, u);
  return st.units.filter((e) => e.n > 0 && e.side !== u.side && hexDist(u, e) <= R);
}

const mult = (a, b) => COUNTER[a]?.[b] ?? 1;

// Очакваната сила на удар (без случайност) – за изкуствения интелект и подсказките.
function strike(st, a, t, roll = 1) {
  const ranged = a.cls === 'ranged';
  let power = a.n * a.atk * roll * mult(a.cls, t.cls);
  if (ranged && hexDist(a, t) <= 1) power *= 0.5;
  if (st.units.some((h) => h.cls === 'hero' && h.side === a.side && h.n > 0 && h !== a && hexDist(h, a) === 1)) power *= 1.1;
  if (t.hit) power *= 1.15;
  const terr = TERRAIN[terrainAt(st, t.q, t.r)];
  const tdef = terr.vsRanged && !ranged ? 1 : terr.def;
  const def = t.def * (t.side === 'D' ? st.defMult : 1);
  return (power * (10 / (10 + def * 2))) / tdef;
}

function damage(u, dmg) {
  u.dmg += dmg;
  const dead = Math.min(u.n, Math.floor(u.dmg / u.hp));
  u.n -= dead;
  u.dmg -= dead * u.hp;
  if (u.n <= 0) u.dmg = 0;
  return dead;
}

function checkOver(st) {
  const a = alive(st, 'A').length, d = alive(st, 'D').length;
  if (!a || !d) { st.over = true; st.win = d ? 'def' : 'att'; }
}

function move(st, id, q, r) {
  const u = st.units.find((x) => x.id === id);
  if (st.over || !u || u.side !== st.side || u.n <= 0) return false;
  if (!reachable(st, u).has(`${q},${r}`)) return false;
  u.q = q;
  u.r = r;
  u.moved = true;
  return true;
}

function attack(st, id, tid) {
  const a = st.units.find((x) => x.id === id);
  const t = st.units.find((x) => x.id === tid);
  if (st.over || !a || !t || a.side !== st.side || a.n <= 0 || t.n <= 0 || a.acted) return false;
  if (!targets(st, a).includes(t)) return false;
  const roll = 0.9 + rng(hashStr(`${st.seed}:${st.k++}`))() * 0.2;
  const kills = damage(t, strike(st, a, t, roll));
  let back = 0;
  if (a.cls !== 'ranged' && t.n > 0 && t.cls !== 'ranged' && hexDist(a, t) === 1) {
    const save = t.hit;
    t.hit = false;
    back = damage(a, strike(st, t, a, 1) * 0.5);
    t.hit = save;
  }
  t.hit = true;
  a.acted = true;
  a.moved = true;
  st.log.push({ turn: st.turn, a: a.id, t: t.id, kills, back });
  if (st.log.length > 60) st.log.shift();
  checkOver(st);
  return true;
}

// Изкуственият интелект играе всички единици на страната.
function ai(st, side) {
  const mine = alive(st, side).sort((a, b) => (a.cls === 'ranged' ? -1 : 0) - (b.cls === 'ranged' ? -1 : 0) || (MOVES[b.cls] || 2) - (MOVES[a.cls] || 2) || a.id - b.id);
  for (const u of mine) {
    if (st.over || u.n <= 0) continue;
    const foes = alive(st, side === 'A' ? 'D' : 'A');
    if (!foes.length) break;
    const best = (list) => list.sort((x, y) => strike(st, u, y) / y.hp - strike(st, u, x) / x.hp || x.id - y.id)[0];
    let tg = targets(st, u);
    if (u.cls === 'ranged' && tg.length) { attack(st, u.id, best(tg).id); continue; }
    if (!(u.cls !== 'ranged' && tg.length)) {
      // избор на цел: близка и слаба срещу нас, с бонус за контра
      const goal = foes.slice().sort((x, y) => hexDist(u, x) - 2 * (mult(u.cls, x.cls) > 1) - (hexDist(u, y) - 2 * (mult(u.cls, y.cls) > 1)) || x.id - y.id)[0];
      const reach = reachable(st, u);
      let pick = null, score = Infinity;
      for (const [key, cost] of reach) {
        const [q, r] = key.split(',').map(Number);
        const d = hexDist({ q, r }, goal);
        const want = u.cls === 'ranged' ? Math.abs(d - Math.min(3, rangeOf(st, u))) * 2 + (d <= 1 ? 4 : 0) : d;
        const sc = want * 10 + cost - TERRAIN[terrainAt(st, q, r)].def * 2;
        if (sc < score) { score = sc; pick = [q, r]; }
      }
      const stay = u.cls === 'ranged' ? Math.abs(hexDist(u, goal) - 3) * 2 * 10 : hexDist(u, goal) * 10;
      if (pick && score < stay) move(st, u.id, pick[0], pick[1]);
      tg = targets(st, u);
    }
    if (tg.length && !st.over) attack(st, u.id, best(tg).id);
  }
}

function endTurn(st) {
  if (st.over) return;
  if (st.side === 'A') {
    st.side = 'D';
    for (const u of st.units) { u.moved = false; u.acted = false; u.hit = false; }
    ai(st, 'D');
    if (st.over) return;
    st.turn++;
    st.side = 'A';
    for (const u of st.units) { u.moved = false; u.acted = false; u.hit = false; }
    if (st.turn > TACTIC.maxTurns) { st.over = true; st.win = 'def'; }
  }
}

function autoFinish(st) {
  for (let i = 0; i < 100 && !st.over; i++) {
    if (st.side === 'A') ai(st, 'A');
    endTurn(st);
  }
}

// Ходовете на играча: { m: [id, q, r] }, { a: [id, targetId] }, { end: 1 }, { auto: 1 }.
function applyMove(st, mv) {
  if (st.over || !mv) return false;
  if (mv.m) return move(st, mv.m[0], mv.m[1], mv.m[2]);
  if (mv.a) return attack(st, mv.a[0], mv.a[1]);
  if (mv.end) { endTurn(st); return true; }
  if (mv.auto) { autoFinish(st); return true; }
  return false;
}

function result(st) {
  const sideOut = (side) => st.units.filter((u) => u.side === side).sort((a, b) => a.gi - b.gi)
    .map((u) => ({ key: u.key, n: u.n, lost: u.start - u.n, dmg: u.n > 0 ? u.dmg / u.hp : 0 }));
  return { win: st.win || 'def', rounds: st.turn, att: sideOut('A'), def: sideOut('D'), tactical: true };
}

// Проверка на сървъра: повтаря ходовете; недовършената битка се довършва автоматично.
function replay(b, moves) {
  const st = createBattle(b.seed, b.att, b.def, b.opts);
  for (const mv of (moves || []).slice(0, 2000)) { if (st.over) break; applyMove(st, mv); }
  if (!st.over) autoFinish(st);
  return result(st);
}

return { neighbors, hexDist, terrainAt, alive, rangeOf, createBattle, reachable, targets, strike, move, attack, ai, endTurn, autoFinish, applyMove, result, replay };
})();

__m['js/games/empires/engine.js'] = (() => {
// Evil Empires – логика на играта. Състоянието е обикновен JSON обект; времето тече
// „мързеливо“: advance(s, t, env) пресмята всичко, случило се от последното обновяване
// (производство, строежи, обучение, походи, битки, нападения) – и докато играчът го няма.
// env.world (по желание) свързва играча с общия свят: други играчи, съюзи, оазиси.
// Действията хвърлят Error с текст за играча, ако не са възможни.
const { RES, RACES, EPOCHS, MAX_EPOCH, EPOCH_UP, BUILDINGS, UNIQUE, COST_GROWTH, TIME_GROWTH, UNITS, UNIT_NAMES, FIGHTERS, unitCls, TECHS, TECH_PROD, WORLD_SPEED, HERO, ITEM_FX, ITEM_NAMES, ADVENTURE, OASIS_BONUS, OASIS_RANGE, OASIS_RESPAWN, CAMP_RESPAWN, CAMP_SLOTS, CAMP_START, CAMP_NAMES, PROTECTION, NIGHT, NPC_ATTACK_EVERY, NPC_CLANS, PACT, STORY, DAILY, TACTIC, FORMATION, LOYALTY_REGEN, resName } = __m['js/games/empires/data.js'];
const { fight, hashStr, rng, power } = __m['js/games/empires/battle.js'];
const { tileAt, npcList, dist, tileKey, campSpots, inWorld } = __m['js/games/empires/worldgen.js'];
const { replay, createBattle, autoFinish, result: tacResult } = __m['js/games/empires/tactics.js'];

const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

// Времето на играта е българското – и в браузъра, и на сървъра.
const SOFIA = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sofia', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric' });
const sofia = (t) => Object.fromEntries(SOFIA.formatToParts(new Date(t)).map((x) => [x.type, x.value]));

const HOUR = 3600000;
const fail = (msg) => { throw new Error(msg); };
const round5 = (x) => Math.max(5, Math.round(x / 5) * 5);
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

// ---------- ново състояние и миграция ----------
function newCity(id, name, x, y, res) {
  return { id, name, x, y, res: { gold: 300, wood: 500, stone: 400, food: 400, mana: 0, souls: 0, ...res }, b: { hall: 1 }, queue: [], train: [], units: {} };
}

function newHero() {
  return { name: 'Героят', lvl: 1, xp: 0, health: 100, free: HERO.startPoints, points: { str: 0, off: 0, def: 0, res: 0 }, items: [], eq: {}, city: 'c1', state: 'home', reviveEnd: 0 };
}

function newGame(race, name, t = Date.now(), seed = (Math.random() * 2 ** 32) >>> 0, { uid = 'local', home = { x: 0, y: 0 }, worldSeed = 1 } = {}) {
  if (!RACES[race]) fail('Непозната раса.');
  const spots = campSpots(worldSeed, home);
  return {
    v: 2, uid, race, name, created: t, t, speed: 1, seed, seq: 1, world: worldSeed,
    epoch: 1, techs: {}, research: null, epochUp: null,
    cities: [newCity('c1', 'Столица', home.x, home.y)], active: 'c1',
    marches: [], abroad: [], incoming: [], reports: [], log: [],
    camps: CAMP_SLOTS.map((d, id) => ({ id, dist: d, lvl: CAMP_START[id], respawn: 0, ...spots[id] })),
    hero: newHero(), adventures: [], advNext: t + 60000,
    oases: [], guards: {}, intel: {}, pacts: {},
    protectedUntil: t + PROTECTION * 1000, npcNext: t + PROTECTION * 1000,
    story: { claimed: [] }, daily: { day: '', prog: {}, claimed: [] },
    stats: { trained: 0, built: 0, raids: 0, researched: 0, bestCamp: 0, adventures: 0, scouted: 0, defWins: 0 },
  };
}

// Записите от първата версия (един град) се превръщат в новия формат.
function migrate(s, { uid = 'local', home = { x: 0, y: 0 }, worldSeed = 1 } = {}) {
  if (s.v === 2) return s;
  const fresh = newGame(s.race, s.name, s.created, s.seed, { uid, home, worldSeed });
  const city = fresh.cities[0];
  Object.assign(city, { res: s.res, b: s.b, queue: s.queue || [], train: s.train || [], units: s.units || {} });
  const sp = s.speed || 1;
  Object.assign(fresh, {
    t: s.t, speed: sp, seq: s.seq, epoch: s.epoch, techs: s.techs, research: s.research, epochUp: s.epochUp,
    log: s.log || [], story: s.story, daily: s.daily, stats: { ...fresh.stats, ...s.stats },
    camps: s.camps.map((c, i) => ({ ...fresh.camps[i], lvl: c.lvl, respawn: c.respawn })),
    protectedUntil: s.t + (PROTECTION * 1000) / sp, npcNext: s.t + (PROTECTION * 1000) / sp, advNext: s.t + 60000 / sp,
  });
  // походите от старата версия се връщат у дома
  for (const m of s.marches || []) for (const [u, n] of Object.entries(m.units)) city.units[u] = (city.units[u] || 0) + n;
  return fresh;
}

// ---------- помощни ----------
const cityOf = (s, id) => s.cities.find((c) => c.id === id) || s.cities[0];
const lv = (c, id) => c.b[id] || 0;
const maxLv = (s, id) => Math.max(0, ...s.cities.map((c) => lv(c, id)));
const bName = (s, id) => (id === 'unique' ? UNIQUE[s.race].name : id === 'wall' && s.epoch >= 2 ? BUILDINGS.wall.name2 : (s.race === 'undead' && BUILDINGS[id].undeadName) || BUILDINGS[id].name);
const bDesc = (s, id) => (id === 'unique' ? UNIQUE[s.race].desc : (s.race === 'undead' && BUILDINGS[id].undeadDesc) || BUILDINGS[id].desc);
const uName = (s, u) => (u === 'hero' ? s.hero?.name || 'Героят' : UNIT_NAMES[s.race][u]);
const growth = (L) => L * 1.15 ** (L - 1);
const scaled = (s, sec) => Math.round((sec * 1000) / s.speed);

function bCost(id, L) {
  const out = {};
  for (const [k, v] of Object.entries(BUILDINGS[id].cost)) out[k] = round5(v * COST_GROWTH ** (L - 1));
  return out;
}

function bTime(s, c, id, L) {
  let t = BUILDINGS[id].time * TIME_GROWTH ** (L - 1);
  t *= Math.max(0.5, 1 - 0.04 * (lv(c, 'hall') - 1));
  if (s.race === 'humans') t *= 0.9;
  return scaled(s, t);
}

function maxLevel(s, c, id) {
  const cap = EPOCHS[s.epoch - 1].cap;
  return id === 'hall' ? cap : Math.min(cap, lv(c, 'hall'));
}

function bProd(s, id, L) {
  const base = id === 'unique' ? UNIQUE[s.race].prod : BUILDINGS[id].prod;
  if (!base || !L) return {};
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = v * growth(L);
  return out;
}

const storageCap = (c) => Math.round(1500 * 1.5 ** lv(c, 'warehouse'));
const capOf = (c, r) => (r === 'souls' ? Infinity : r === 'mana' ? storageCap(c) / 2 : storageCap(c));
const crannyCap = (c) => (lv(c, 'cranny') ? Math.round(150 * 1.45 ** (lv(c, 'cranny') - 1)) : 0);
const trapCap = (c) => (lv(c, 'traps') ? Math.round(6 * lv(c, 'traps') * 1.25 ** (lv(c, 'traps') - 1)) : 0);
const wallBonus = (L, fort = false) => ({ def: 1 + 0.06 * L * (fort ? 1.5 : 1), hp: 1 + 0.03 * L * (fort ? 1.5 : 1) });
// Колко рано се вижда идващо нападение (зависи от стражевата кула).
const warnWindow = (s, c) => scaled(s, 600 + 1200 * lv(c, 'tower'));
const oasisSlots = (s) => { const L = maxLv(s, 'heroHall'); return (L >= 3) + (L >= 6) + (L >= 10); };
const allowedCities = (s) => 1 + Math.floor(maxLv(s, 'hall') / 5);
const embassyMax = (s) => 3 * maxLv(s, 'embassy');

function popCap(s, c) {
  const L = lv(c, 'houses');
  return Math.round((20 + (L ? 15 * growth(L) : 0)) * (s.race === 'undead' ? 0.85 : 1));
}

function popUsed(s, c) {
  let n = sum(c.units);
  for (const m of s.marches) if (m.from === c.id) n += sum(m.units);
  for (const a of s.abroad) if (a.from === c.id) n += sum(a.units);
  for (const b of c.train) n += b.n - b.done;
  return n;
}

const upkeepOf = (s, u) => (s.race === 'undead' ? 0 : UNITS[u].upkeep);
function upkeep(s, c) {
  let total = 0;
  const add = (units) => { for (const [u, n] of Object.entries(units)) if (UNITS[u]) total += n * upkeepOf(s, u); };
  add(c.units);
  for (const m of s.marches) if (m.from === c.id) add(m.units);
  return total;
}

const heroHome = (s, c) => s.hero.state === 'home' && s.hero.city === c.id;

// Нетно производство на час за всеки ресурс на града (вкл. издръжката на войската).
function rates(s, c) {
  const r = Object.fromEntries(RES.map((k) => [k, 0]));
  Object.assign(r, { gold: 15, wood: 20, stone: 15, food: 20 });
  for (const id of Object.keys(c.b)) for (const [k, v] of Object.entries(bProd(s, id, lv(c, id)))) r[k] += v;
  for (const o of s.oases) if (o.city === c.id) r[o.res] *= 1 + OASIS_BONUS;
  for (const [t, k] of Object.entries(TECH_PROD)) if (s.techs[t]) r[k] *= 1.15;
  if (s.race === 'humans') for (const k of RES) r[k] *= 1.1;
  if (s.race === 'vesheri') r.mana *= 1.25;
  if (s.hero.city === c.id && s.hero.state !== 'dead') for (const k of RES) r[k] *= 1 + Math.min(25, s.hero.points.res) / 100;
  r.food -= upkeep(s, c);
  for (const k of RES) r[k] *= s.speed;
  return r;
}

function unitStats(s, u, c = s.cities[0]) {
  const d = UNITS[u];
  const cls = unitCls(s.race, u);
  let atk = 1 + 0.03 * lv(c, 'smithy'), def = 1 + 0.03 * lv(c, 'smithy');
  if (s.techs.smith) atk += 0.1;
  if (s.techs.armor) def += 0.1;
  if (s.techs.tactics && cls === 'inf') atk += 0.1;
  if (s.race === 'orcs' && (cls === 'inf' || cls === 'spear')) atk += 0.2;
  if (s.race === 'vesheri' && cls === 'ranged') atk += 0.2;
  return { cls, hp: d.hp, atk: d.atk * atk, def: d.def * def, carry: d.carry, upkeep: upkeepOf(s, u), speed: d.speed };
}

function uCost(s, u) {
  const m = s.race === 'undead' ? 0.8 : s.race === 'vesheri' ? 1.2 : 1;
  const out = {};
  for (const [k, v] of Object.entries(UNITS[u].cost)) out[k] = Math.round(v * m);
  return out;
}

function uTime(s, c, u) {
  let t = UNITS[u].time * Math.max(0.5, 1 - 0.04 * (lv(c, 'barracks') - 1));
  if (s.race === 'orcs') t *= Math.max(0.6, 1 - 0.05 * lv(c, 'unique'));
  if (UNITS[u].cls === 'cav') t *= Math.max(0.6, 1 - 0.05 * lv(c, 'stable'));
  return scaled(s, t);
}

function tTime(s, id) {
  let t = TECHS[id].time * Math.max(0.5, 1 - 0.05 * (maxLv(s, 'academy') - 1));
  if (s.race === 'orcs') t *= 1.2;
  return scaled(s, t);
}

const mul = (cost, n) => Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, v * n]));
const canPay = (c, cost) => Object.entries(cost).every(([k, v]) => c.res[k] >= v - 1e-6);
function pay(s, c, cost) {
  const miss = Object.entries(cost).filter(([k, v]) => c.res[k] < v - 1e-6).map(([k]) => resName(s.race, k).toLowerCase());
  if (miss.length) fail(`Не стига: ${miss.join(', ')}.`);
  for (const [k, v] of Object.entries(cost)) c.res[k] = Math.max(0, c.res[k] - v);
}

function addRes(c, bundle, capped) {
  for (const [k, v] of Object.entries(bundle)) {
    if (!v) continue;
    c.res[k] = capped ? Math.max(c.res[k], Math.min(capOf(c, k), c.res[k] + v)) : c.res[k] + v;
  }
}

function log(s, t, text, kind = 'info') {
  s.log.push({ id: s.seq++, t, text, kind });
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
}

function report(s, r) {
  s.reports.unshift({ id: s.seq++, ...r });
  if (s.reports.length > 30) s.reports.length = 30;
}

// ---------- герой ----------
const itemOf = (it) => ({ ...it, name: ITEM_NAMES[it.slot][it.tier - 1], val: ITEM_FX[it.slot].val[it.tier - 1], text: ITEM_FX[it.slot].text(ITEM_FX[it.slot].val[it.tier - 1]) });
const eqVal = (s, slot) => { const it = s.hero.items.find((i) => i.id === s.hero.eq[slot]); return it ? ITEM_FX[slot].val[it.tier - 1] : 0; };

function heroStats(s) {
  const h = s.hero;
  return {
    atk: 12 + 4 * h.points.str + eqVal(s, 'weapon'),
    hp: 70 + 15 * h.lvl + eqVal(s, 'armor'),
    def: 3 + 0.5 * h.lvl,
    armorRed: Math.round(eqVal(s, 'armor') / 7) / 100,
    xpBonus: eqVal(s, 'helmet') / 100,
    speed: HERO.speed * (1 + eqVal(s, 'horse') / 100),
    regen: HERO.regen + eqVal(s, 'amulet') + 3 * lv(cityOf(s, h.city), 'temple'),
    off: Math.min(100, h.points.off) * 0.002,
    def2: Math.min(100, h.points.def) * 0.002,
  };
}

const heroGroup = (s) => { const st = heroStats(s); return { key: 'hero', cls: 'hero', n: 1, hp: st.hp, atk: st.atk, def: st.def, carry: 0 }; };

function heroXp(s, t, xp) {
  const h = s.hero;
  h.xp += Math.round(xp * (1 + heroStats(s).xpBonus));
  while (h.xp >= HERO.xpFor(h.lvl)) {
    h.xp -= HERO.xpFor(h.lvl);
    h.lvl++;
    h.free += HERO.pointsPerLevel;
    log(s, t, `${h.name} достигна ниво ${h.lvl}!`, 'win');
  }
}

// Раните на героя след битка: g – резултатът за групата 'hero'.
function heroWounds(s, t, g) {
  if (!g) return;
  const h = s.hero;
  if (g.n <= 0) {
    h.health = 0;
    h.state = 'dead';
    log(s, t, `${h.name} падна в битка. Съживете го в Залата на героите.`, 'loss');
  } else h.health = Math.max(1, h.health - g.dmg * 100 * (1 - heroStats(s).armorRed));
}

function assignPoint(s, key) {
  if (!s.hero.free) fail('Нямате свободни точки.');
  if (!own(s.hero.points, key)) fail('Няма такова умение.');
  s.hero.points[key]++;
  s.hero.free--;
}

function equip(s, itemId) {
  const it = s.hero.items.find((i) => i.id === itemId);
  if (!it) fail('Няма такъв предмет.');
  if (s.hero.state !== 'home') fail('Героят трябва да е у дома.');
  s.hero.eq[it.slot] = it.id;
}

function unequip(s, slot) {
  if (s.hero.state !== 'home') fail('Героят трябва да е у дома.');
  delete s.hero.eq[slot];
}

function sellItem(s, t, cid, itemId) {
  const i = s.hero.items.findIndex((x) => x.id === itemId);
  if (i < 0) fail('Няма такъв предмет.');
  const [it] = s.hero.items.splice(i, 1);
  if (s.hero.eq[it.slot] === it.id) delete s.hero.eq[it.slot];
  addRes(cityOf(s, cid), { gold: 100 * it.tier ** 2, souls: it.tier * 2 }, false);
}

const reviveCost = (s) => ({ gold: Math.round(150 * s.hero.lvl ** 1.3), food: Math.round(200 * s.hero.lvl ** 1.2), souls: s.hero.lvl });
const reviveTime = (s) => scaled(s, 1200 + 600 * s.hero.lvl);

function reviveHero(s, t, cid, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  if (s.hero.state !== 'dead') fail('Героят е жив.');
  if (s.hero.reviveEnd) fail('Героят вече се съживява.');
  if (!lv(c, 'heroHall')) fail('Нужна е Зала на героите в този град.');
  pay(s, c, reviveCost(s));
  s.hero.city = c.id;
  s.hero.reviveEnd = t + reviveTime(s);
}

// ---------- време ----------
function accrue(s, to) {
  if (to <= s.t) return;
  const hours = (to - s.t) / HOUR;
  for (const c of s.cities) {
    const r = rates(s, c);
    for (const k of RES) {
      const d = r[k] * hours;
      const cap = capOf(c, k);
      if (d > 0) { if (c.res[k] < cap) c.res[k] = Math.min(cap, c.res[k] + d); }
      else if (d < 0) c.res[k] = Math.max(0, c.res[k] + d);
    }
  }
  for (const c of s.cities) if (c.loyalty != null && c.loyalty < 100) c.loyalty = Math.min(100, c.loyalty + LOYALTY_REGEN * hours * s.speed);
  const h = s.hero;
  if (h.state !== 'dead') h.health = Math.min(100, h.health + heroStats(s).regen * hours * s.speed);
  s.t = to;
}

function nextEvent(s, env) {
  let best = null;
  const take = (t, run) => { if (t != null && (!best || t < best.t)) best = { t, run }; };
  for (const c of s.cities) {
    for (const q of c.queue) take(q.end, () => finishBuild(s, c, q));
    if (c.train.length) {
      const b = c.train[0];
      take(b.start + b.each * (b.done + 1), () => finishUnit(s, c, b));
    }
  }
  if (s.research) take(s.research.end, () => finishResearch(s));
  if (s.epochUp) take(s.epochUp.end, () => finishEpoch(s));
  for (const m of s.marches) {
    if (m.phase === 'go') take(m.arrive, () => arrive(s, m, env));
    else if (m.phase === 'back') take(m.back, () => comeBack(s, m));
    else if (m.phase === 'battle') take(m.battle.expires, () => { const b = m.battle; finishBattleAt(s, m, env, b.def.length ? replay(b, []) : emptyWin(b.att), b.expires); });
  }
  for (const c of s.camps) if (c.respawn) take(c.respawn, () => { c.respawn = 0; c.lvl = Math.min(campMax(s), c.lvl + 1); });
  for (const g of Object.values(s.guards)) if (g.respawn) take(g.respawn, () => { g.respawn = 0; g.alive = 1; });
  if (s.hero.reviveEnd) take(s.hero.reviveEnd, () => { Object.assign(s.hero, { reviveEnd: 0, state: 'home', health: 100 }); log(s, s.t, `${s.hero.name} се върна към живота.`, 'win'); });
  take(s.advNext, () => spawnAdventure(s));
  for (const a of s.adventures) take(a.expires, () => s.adventures.splice(s.adventures.indexOf(a), 1));
  take(s.npcNext, () => launchNpc(s, s.npcNext, env));
  for (const inc of s.incoming) take(inc.arrive, () => npcArrives(s, inc, env));
  if (env?.world) for (const inc of env.world.incomingFor(s.uid)) take(inc.arrive, () => pvpArrives(s, inc, env));
  return best;
}

function advance(s, to = Date.now(), env = null) {
  processOutcomes(s, env);
  // походи, които чакат резултат от битка с друг играч
  for (const m of [...s.marches]) if (m.phase === 'wait') tryPvpResult(s, m, env);
  for (let guard = 0; guard < 100000; guard++) {
    const ev = nextEvent(s, env);
    if (!ev || ev.t > to) break;
    accrue(s, ev.t);
    ev.run();
  }
  accrue(s, to);
  return s;
}

function setSpeed(s, t, speed, env) {
  advance(s, t, env);
  const k = s.speed / speed;
  const rescale = (x) => (x && x > t ? t + (x - t) * k : x);
  s.protectedUntil = rescale(s.protectedUntil);
  s.npcNext = rescale(s.npcNext);
  s.advNext = rescale(s.advNext);
  s.speed = speed;
}

// ---------- дневни мисии ----------
const dayKey = (t) => { const p = sofia(t); return `${p.year}-${+p.month}-${+p.day}`; };
function ensureDaily(s, t) { const day = dayKey(t); if (s.daily.day !== day) s.daily = { day, prog: {}, claimed: [] }; }
function bump(s, t, key, n = 1) {
  s.stats[key] = (s.stats[key] || 0) + n;
  ensureDaily(s, t);
  s.daily.prog[key] = (s.daily.prog[key] || 0) + n;
}

function dailyList(s, t = Date.now()) {
  ensureDaily(s, t);
  const rand = rng(hashStr(`${s.seed}:${s.daily.day}`));
  const pool = [...DAILY];
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  const scale = 150 * maxLv(s, 'hall') ** 1.4;
  return out.map((d) => ({
    ...d,
    have: Math.min(d.goal, s.daily.prog[d.key] || 0),
    claimed: s.daily.claimed.includes(d.id),
    prize: { ...Object.fromEntries(Object.entries(d.reward).map(([k, v]) => [k, Math.round((v * scale) / 10) * 10])), ...(d.souls ? { souls: d.souls } : {}) },
  }));
}

function claimDaily(s, t, cid, id, env) {
  advance(s, t, env);
  const d = dailyList(s, t).find((x) => x.id === id);
  if (!d || d.claimed) fail('Наградата вече е взета.');
  if (d.have < d.goal) fail('Мисията още не е изпълнена.');
  s.daily.claimed.push(id);
  addRes(cityOf(s, cid), d.prize, false);
}

function storyList(s) {
  return STORY.map((m) => ({ ...m, text: (s.race === 'undead' && m.undeadText) || m.text, have: Math.min(m.goal, m.get(s)), claimed: s.story.claimed.includes(m.id) }));
}

function claimStory(s, t, cid, id, env) {
  advance(s, t, env);
  const m = storyList(s).find((x) => x.id === id);
  if (!m || m.claimed) fail('Наградата вече е взета.');
  if (m.have < m.goal) fail('Мисията още не е изпълнена.');
  s.story.claimed.push(id);
  addRes(cityOf(s, cid), m.reward, false);
}

// ---------- строеж ----------
const buildSlots = (s) => (s.techs.logistics ? 2 : 1);

function buildState(s, c, id) {
  const def = BUILDINGS[id];
  const L = lv(c, id);
  const q = c.queue.find((x) => x.id === id);
  if (q) return { status: 'building', q };
  if (def.epoch > s.epoch) return { status: 'locked', why: `Отключва се в ${EPOCHS[def.epoch - 1].name}.` };
  if (def.tech && !s.techs[def.tech]) return { status: 'locked', why: `Нужна е технологията „${TECHS[def.tech].name}“.` };
  for (const [b, n] of Object.entries(def.need || {})) if (lv(c, b) < n) return { status: 'locked', why: `Нужно е: ${bName(s, b)} ниво ${n}.` };
  if (L >= EPOCHS[s.epoch - 1].cap) return { status: 'max', why: s.epoch >= MAX_EPOCH ? 'Максимално ниво в тази версия.' : 'Максимално ниво за епохата – преминете в следващата.' };
  if (L >= maxLevel(s, c, id)) return { status: 'max', why: 'Първо подобрете Цитаделата.' };
  if (c.queue.length >= buildSlots(s)) return { status: 'busy', why: 'Строителите са заети.' };
  return { status: 'ok' };
}

function build(s, t, cid, id, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  if (!own(BUILDINGS, id)) fail('Няма такава сграда.');
  const st = buildState(s, c, id);
  if (st.status !== 'ok') fail(st.status === 'building' ? 'Вече се строи.' : st.why);
  const L = lv(c, id) + 1;
  const cost = bCost(id, L);
  pay(s, c, cost);
  c.queue.push({ id, lvl: L, start: t, end: t + bTime(s, c, id, L), cost });
  bump(s, t, 'built');
}

function cancelBuild(s, t, cid, id, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  const i = c.queue.findIndex((q) => q.id === id);
  if (i < 0) fail('Няма такъв строеж.');
  const [q] = c.queue.splice(i, 1);
  addRes(c, mul(q.cost, 0.8), false);
}

function finishBuild(s, c, q) {
  c.queue.splice(c.queue.indexOf(q), 1);
  c.b[q.id] = q.lvl;
  const where = s.cities.length > 1 ? ` (${c.name})` : '';
  log(s, q.end, q.lvl === 1 ? `Завършен строеж: ${bName(s, q.id)}${where}.` : `${bName(s, q.id)} достигна ниво ${q.lvl}${where}.`, 'build');
}

// ---------- войска ----------
function unitLock(s, c, u) {
  const d = UNITS[u];
  if (d.epoch > s.epoch) return `Отключва се в ${EPOCHS[d.epoch - 1].name}.`;
  if (!lv(c, 'barracks')) return 'Нужна е казарма.';
  if (d.tech && !s.techs[d.tech]) return `Нужна е технологията „${TECHS[d.tech].name}“.`;
  if (d.barracks && lv(c, 'barracks') < d.barracks) return `Нужна е казарма ниво ${d.barracks}.`;
  if (d.hall && lv(c, 'hall') < d.hall) return `Нужна е Цитадела ниво ${d.hall}.`;
  if (d.stable && lv(c, 'stable') < d.stable) return 'Нужна е Конюшня.';
  if (d.unique && !lv(c, 'unique')) return `Нужна е сградата „${UNIQUE[s.race].name}“.`;
  return null;
}

function maxTrain(s, c, u) {
  if (unitLock(s, c, u)) return 0;
  const cost = uCost(s, u);
  let n = popCap(s, c) - popUsed(s, c);
  for (const [k, v] of Object.entries(cost)) n = Math.min(n, Math.floor(c.res[k] / v));
  const up = upkeepOf(s, u);
  if (up) n = Math.min(n, Math.floor(rates(s, c).food / s.speed / up));
  return Math.max(0, n);
}

function train(s, t, cid, u, n, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  n = Math.floor(n);
  if (!own(UNITS, u) || !(n > 0)) fail('Изберете брой.');
  const lock = unitLock(s, c, u);
  if (lock) fail(lock);
  if (c.train.length >= 5) fail('Опашката за обучение е пълна.');
  if (popUsed(s, c) + n > popCap(s, c)) fail('Няма място – постройте още жилища.');
  if (upkeepOf(s, u) && rates(s, c).food / s.speed - n * upkeepOf(s, u) < 0) fail(`${resName(s.race, 'food')} няма да стигне за тях – подобрете фермата.`);
  pay(s, c, mul(uCost(s, u), n));
  const last = c.train[c.train.length - 1];
  c.train.push({ u, n, done: 0, start: last ? last.start + last.each * last.n : t, each: uTime(s, c, u) });
}

function finishUnit(s, c, b) {
  const t = b.start + b.each * (b.done + 1);
  b.done++;
  c.units[b.u] = (c.units[b.u] || 0) + 1;
  bump(s, t, 'trained');
  if (b.done >= b.n) {
    c.train.shift();
    log(s, t, `Обучени: ${b.n} × ${uName(s, b.u)}.`, 'train');
  }
}

// ---------- наука и епохи ----------
function techState(s, id) {
  const d = TECHS[id];
  if (s.techs[id]) return { status: 'done' };
  if (s.research?.id === id) return { status: 'active' };
  if (d.epoch > s.epoch) return { status: 'locked', why: `${EPOCHS[d.epoch - 1].name}` };
  if (maxLv(s, 'academy') < d.academy) return { status: 'locked', why: `Академия ниво ${d.academy}` };
  const miss = (d.req || []).filter((r) => !s.techs[r]);
  if (miss.length) return { status: 'locked', why: 'Нужно: ' + miss.map((r) => TECHS[r].name).join(', ') };
  if (s.research) return { status: 'busy', why: 'Академията е заета.' };
  return { status: 'ok' };
}

function research(s, t, cid, id, env) {
  advance(s, t, env);
  if (!own(TECHS, id)) fail('Няма такава технология.');
  const st = techState(s, id);
  if (st.status !== 'ok') fail(st.status === 'done' ? 'Вече е изследвано.' : st.status === 'active' ? 'Изследва се.' : st.why);
  pay(s, cityOf(s, cid), TECHS[id].cost);
  s.research = { id, start: t, end: t + tTime(s, id) };
}

function finishResearch(s) {
  const { id, end } = s.research;
  s.research = null;
  s.techs[id] = true;
  bump(s, end, 'researched');
  log(s, end, `Изследвано: ${TECHS[id].name}.`, 'tech');
}

function epochReqs(s) {
  const next = s.epoch + 1;
  const spec = EPOCH_UP[next];
  if (!spec) return null;
  const story = STORY.find((m) => m.id === spec.story);
  return {
    next, spec,
    list: [
      { text: `Цитадела ниво ${spec.hall}`, ok: maxLv(s, 'hall') >= spec.hall },
      { text: `Изследване „${TECHS[spec.tech].name}“`, ok: !!s.techs[spec.tech] },
      { text: `Мисия „${story.title}“`, ok: story.get(s) >= story.goal },
    ],
  };
}

function advanceEpoch(s, t, cid, env) {
  advance(s, t, env);
  if (s.epochUp) fail('Империята вече преминава в нова епоха.');
  if (s.epoch >= MAX_EPOCH) fail('Следващата епоха идва в нова версия на играта.');
  const r = epochReqs(s);
  if (r.list.some((x) => !x.ok)) fail('Не са изпълнени всички условия.');
  pay(s, cityOf(s, cid), r.spec.cost);
  s.epochUp = { to: r.next, start: t, end: t + scaled(s, r.spec.time) };
}

function finishEpoch(s) {
  const { to, end } = s.epochUp;
  s.epochUp = null;
  s.epoch = to;
  log(s, end, `Империята навлезе в ${EPOCHS[to - 1].name}!`, 'epoch');
}

// ---------- противници: лагери, оазиси, империи на компютъра ----------
const campMax = (s) => (s.epoch >= 3 ? 18 : s.epoch >= 2 ? 12 : 5);
const campName = (c) => (c.lvl === 5 ? 'Лагер на вожда' : CAMP_NAMES[c.id % CAMP_NAMES.length]);

const barb = (key, n, k = 1) => { const d = UNITS[key]; return { key, n, cls: d.cls, hp: d.hp, atk: d.atk * k, def: d.def * k, carry: d.carry }; };

// Лагерите до ниво 5 имат само пехота и прашкари – същото, което има и играчът.
function campArmy(lvl) {
  const base = Math.round(4.2 * lvl ** 1.4);
  return [
    ['warrior', base],
    ['slinger', lvl >= 2 ? Math.round(base * 0.45) : 0],
    ['spear', lvl >= 6 ? Math.round(base * 0.35) : 0],
    ['archer', lvl >= 6 ? Math.round(base * 0.3) : 0],
    ['rider', lvl >= 7 ? Math.round(base * 0.2) : 0],
    ['elite', lvl === 5 ? 3 : lvl >= 8 ? Math.round(lvl * 0.5) : 0],
    ['crossbow', lvl >= 11 ? Math.round(base * 0.2) : 0],
    ['knight', lvl >= 12 ? Math.round(base * 0.12) : 0],
    ['pike', lvl >= 13 ? Math.round(base * 0.2) : 0],
  ].filter(([, n]) => n > 0).map(([k, n]) => barb(k, n));
}

function campLoot(lvl) {
  const f = lvl ** 1.6;
  return { gold: Math.round(80 * f), wood: Math.round(140 * f), stone: Math.round(120 * f), food: Math.round(140 * f), souls: lvl >= 3 ? lvl : 0 };
}

// Оазис: пазят го зверове (същата сила като лагер от нивото му).
function oasisInfo(s, x, y, env) {
  const tile = tileAt(s.world, x, y);
  if (tile.kind !== 'oasis') return null;
  const key = tileKey(x, y);
  const g = s.guards[key] || { alive: 1, respawn: 0 };
  const mine = s.oases.find((o) => o.key === key);
  const owner = mine ? s.uid : env?.world?.oasisOwner(key)?.uid || null;
  const army = owner ? [] : campArmy(tile.lvl).map((u) => ({ ...u, n: Math.round(u.n * g.alive) })).filter((u) => u.n > 0);
  return { key, x, y, res: tile.res, lvl: tile.lvl, guards: army, respawn: g.respawn, owner, ownerName: mine ? s.name : env?.world?.oasisOwner(key)?.name, mine: !!mine };
}

function npcLevel(s, npc, t, env) {
  const created = env?.world?.created ?? s.created;
  const days = Math.max(0, (t - created) / (24 * HOUR)) * s.speed;
  return Math.min(30, Math.round((1 + npc.head + days * 0.45) * 10) / 10);
}

function npcInfo(s, npc, t, env) {
  const L = npcLevel(s, npc, t, env);
  const st = env?.world?.npcState(npc.id) || { lost: 0, lostT: 0, plunder: 0, plunderT: 0 };
  const rec = (v, since) => Math.max(0, v - ((t - since) / HOUR) * 0.06 * s.speed);
  const lost = rec(st.lost, st.lostT), plunder = rec(st.plunder, st.plunderT);
  const n = Math.floor(L);
  const base = Math.round(6 * n ** 1.45);
  const k = 1 + L * 0.02;
  const army = [
    barb('warrior', base, k), barb('slinger', Math.round(base * 0.5), k),
    barb('spear', n >= 6 ? Math.round(base * 0.35) : 0, k), barb('archer', n >= 6 ? Math.round(base * 0.3) : 0, k),
    barb('rider', n >= 8 ? Math.round(base * 0.2) : 0, k), barb('elite', n >= 10 ? Math.round(n * 0.5) : 0, k),
    barb('pike', n >= 14 ? Math.round(base * 0.2) : 0, k), barb('crossbow', n >= 14 ? Math.round(base * 0.25) : 0, k),
    barb('knight', n >= 16 ? Math.round(base * 0.12) : 0, k),
  ].map((g) => ({ ...g, n: Math.round(g.n * (1 - lost)) })).filter((g) => g.n > 0);
  const f = (1 - plunder) * L ** 1.4;
  return {
    ...npc, lvl: L, army, lost, plunder, scouts: Math.round(2 * L),
    wall: Math.max(0, Math.floor(L / 2) - Math.max(0, (st.wallDmg || 0) - Math.floor(((t - (st.wallT || t)) / (24 * HOUR)) * s.speed))),
    loyalty: Math.min(100, (st.loyalty ?? 100) + ((t - (st.loyT || t)) / HOUR) * LOYALTY_REGEN * s.speed),
    owner: st.owner || null,
    pile: { gold: Math.round(200 * f), wood: Math.round(300 * f), stone: Math.round(260 * f), food: Math.round(300 * f) },
    score: Math.round(60 * L ** 1.8),
    clanInfo: NPC_CLANS.find((c) => c.id === npc.clan),
  };
}

const npcs = (s) => npcList(s.world);
// Владетелите, които още не са завладени от играч.
const activeNpcs = (s, env) => npcs(s).filter((n) => !env?.world?.npcState(n.id)?.owner);

// ---------- защита ----------
const isProtected = (s, t = Date.now()) => t < s.protectedUntil;
// Часът (с минутите) и месецът по българско време – за деня и нощта в града.
const localHour = (t) => (+sofia(t).hour % 24) + new Date(t).getMinutes() / 60;
const localMonth = (t) => +sofia(t).month;
const isNight = (t) => { const h = +sofia(t).hour % 24; return h >= NIGHT.from && h < NIGHT.to; };

function score(s) {
  let b = 0;
  for (const c of s.cities) b += Object.values(c.b).reduce((a, L) => a + L * L, 0);
  const pop = s.cities.reduce((a, c) => a + popUsed(s, c), 0);
  return Math.round(b * 10 + Object.keys(s.techs).length * 50 + pop * 2 + (s.epoch - 1) * 500 + s.hero.lvl * 30);
}

// Морал: силен нападател срещу много по-слаб бие по-слабо.
const morale = (attScore, defScore) => (attScore > defScore && defScore > 0 ? Math.max(0.5, (defScore / attScore) ** 0.35) : 1);

function endProtection(s, t) {
  if (isProtected(s, t)) {
    s.protectedUntil = t;
    s.npcNext = t + scaled(s, 6 * 3600);
  }
}

const pactCost = (s) => ({ gold: 400 * s.epoch + 150 * maxLv(s, 'hall') });
function buyPact(s, t, cid, clanId, env) {
  advance(s, t, env);
  if (!NPC_CLANS.some((c) => c.id === clanId)) fail('Няма такъв клан.');
  pay(s, cityOf(s, cid), pactCost(s));
  s.pacts[clanId] = Math.max(s.pacts[clanId] || 0, t) + scaled(s, PACT.time);
}

// Защитниците на града: войската у дома, героят и подкрепленията от съюзници.
function defenders(s, c, env) {
  const side = FIGHTERS.filter((u) => c.units[u] > 0).map((u) => ({ key: u, n: c.units[u], ...unitStats(s, u, c) }));
  if (heroHome(s, c)) side.push(heroGroup(s));
  const stationed = env?.world?.stationedAt(s.uid, c.id) || [];
  for (const st of stationed) for (const g of st.groups) if (g.n > 0) side.push({ ...g, stId: st.id });
  return { side, stationed };
}

// Подготовка на битката в град: капани, защитници, множители (стена, нощ, кула, герой).
function prepareDefense(s, c, att, t, env) {
  let trapped = 0;
  const groups = att.groups.map((g) => ({ ...g }));
  let cap = trapCap(c);
  for (const g of [...groups].sort((a, b) => b.n - a.n)) {
    if (cap <= 0 || g.key === 'hero') continue;
    const k = Math.min(g.n, cap);
    g.n -= k;
    cap -= k;
    trapped += k;
  }
  const { side } = defenders(s, c, env);
  const wb = wallBonus(lv(c, 'wall'), s.techs.fortify);
  const night = isNight(t) ? NIGHT.bonus : 1;
  const heroDef = (heroHome(s, c) ? 1 + heroStats(s).def2 : 1) * (1 + 0.02 * lv(c, 'tower'));
  return {
    att: groups.filter((g) => g.n > 0), side, trapped, night: night > 1,
    opts: { defMult: wb.def * night * heroDef, defHp: wb.hp, formA: att.formation || null, formD: c.formation || null },
  };
}

// Автоматична битка на тактическата карта (формациите имат значение).
function autoBattle(seed, att, def, opts) {
  if (!def.length) return { win: 'att', rounds: 0, att: att.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [] };
  const st = createBattle(seed, att, def, opts);
  autoFinish(st);
  return tacResult(st);
}

/**
 * Последствията от битка в град: загуби (спрямо началото), плячка, обсада, лоялност, доклад.
 * side – защитниците такива, каквито бяха в началото на битката.
 */
function resolveDefense(s, c, att, prep, r, t, env) {
  const win = r.win === 'att' && r.att.some((g) => g.n > 0);
  const lostOf = (i) => r.def[i]?.lost || 0;
  const touched = new Map();
  prep.side.forEach((src, i) => {
    const g = r.def[i];
    if (!g) return;
    if (src.key === 'hero') { if (heroHome(s, c)) heroWounds(s, t, g); }
    else if (src.stId) touched.set(src.stId, [...(touched.get(src.stId) || []), [src.key, lostOf(i)]]);
    else c.units[src.key] = Math.max(0, (c.units[src.key] || 0) - lostOf(i));
  });
  if (env?.world) {
    for (const [id, losses] of touched) {
      const st = env.world.stationedById(id);
      if (st) env.world.setStationed(id, st.groups.map((g) => ({ ...g, n: Math.max(0, g.n - (losses.find(([k]) => k === g.key)?.[1] || 0)) })));
    }
  }
  const loot = {};
  const siege = {};
  let captured = null;
  if (win) {
    const carryOf = (k) => att.groups.find((x) => x.key === k)?.carry || UNITS[k]?.carry || 0;
    const room = r.att.reduce((a, g) => a + g.n * carryOf(g.key), 0) * (att.lootBoost || 1);
    const hide = crannyCap(c) * (att.crannyFactor ?? 1);
    const avail = Object.fromEntries(['gold', 'wood', 'stone', 'food'].map((k) => [k, Math.max(0, c.res[k] - hide)]));
    const total = sum(avail);
    const share = total ? Math.min(1, room / total) : 0;
    for (const [k, v] of Object.entries(avail)) {
      loot[k] = Math.floor(v * share);
      c.res[k] -= loot[k];
    }
    // катапулти: стената и сградите
    const rr = rng(hashStr(`${att.seed}:siege`));
    const cats = r.att.find((g) => g.key === 'catapult')?.n || 0;
    if (cats) {
      const hit = Math.min(lv(c, 'wall'), Math.floor(cats / 6));
      if (hit) { c.b.wall -= hit; siege.wall = hit; }
      const ids = Object.keys(c.b).filter((b) => b !== 'hall' && b !== 'wall' && c.b[b] > 0);
      siege.buildings = [];
      for (let i = 0; i < Math.min(3, Math.floor(cats / 10)) && ids.length; i++) {
        const b = ids.splice(Math.floor(rr() * ids.length), 1)[0];
        c.b[b]--;
        siege.buildings.push(bName(s, b));
      }
    }
    // благородници: лоялността
    const nobles = r.att.find((g) => g.key === 'noble')?.n || 0;
    if (nobles) {
      let drop = 0;
      for (let i = 0; i < Math.min(3, nobles); i++) drop += 20 + Math.floor(rr() * 11);
      c.loyalty = (c.loyalty ?? 100) - drop;
      siege.loyalty = Math.max(0, Math.round(c.loyalty));
      if (c.loyalty <= 0) {
        if (c.id === s.cities[0].id) { c.loyalty = 1; siege.note = 'Столицата не може да бъде завладяна.'; }
        else if (!att.canConquer) { c.loyalty = 1; siege.note = 'Нападателят няма място за нов град.'; }
        else captured = captureCity(s, c, t, env);
      }
    }
  }
  if (!win) bump(s, t, 'defWins');
  // градът гори след обсада (за картата)
  if (!captured && (siege.wall || siege.buildings?.length || siege.loyalty != null)) c.burnT = t;
  report(s, {
    kind: 'defense', t, title: captured ? `Градът е завладян: ${c.name}` : `${win ? 'Градът е ограбен' : 'Нападението е отбито'}: ${c.name}`, win: !win, enemy: att.name,
    att: r.att, def: r.def.map((g, i) => ({ ...g, key: prep.side[i]?.key || g.key, ally: prep.side[i]?.stId ? true : undefined })), loot, trapped: prep.trapped, night: prep.night, wall: lv(c, 'wall'), rounds: r.rounds, siege, tactical: r.tactical,
  });
  log(s, t, captured ? `${att.name} завладя ${c.name}!` : win ? `${att.name} ограби ${c.name}!` : `${c.name} отби нападението на ${att.name}.`, win ? 'loss' : 'win');
  return { win, loot, trapped: prep.trapped, att: r.att, def: r.def, rounds: r.rounds, siege, captured };
}

// Градът минава у нападателя: сградите и ресурсите (без войската).
function captureCity(s, c, t, env) {
  const data = { name: c.name, x: c.x, y: c.y, b: { ...c.b }, res: { ...c.res } };
  s.cities.splice(s.cities.indexOf(c), 1);
  for (const o of s.oases.filter((o) => o.city === c.id)) env?.world?.setOasisOwner(o.key, null);
  s.oases = s.oases.filter((o) => o.city !== c.id);
  s.incoming = s.incoming.filter((x) => x.city !== c.id);
  if (s.hero.city === c.id) { s.hero.city = s.cities[0].id; if (s.hero.state === 'home') s.hero.health = Math.min(s.hero.health, 30); }
  for (const m of s.marches) if (m.from === c.id) m.from = s.cities[0].id;
  for (const st of env?.world?.stationedAt(s.uid, c.id) || []) env.world.sendBackStationed?.(st.id);
  return data;
}

// Град, получен със завладяване (от играч или от владетел на компютъра).
function addCapturedCity(s, t, data) {
  const id = `c${s.seq++}`;
  const city = newCity(id, data.name, data.x, data.y, data.res);
  city.b = { ...data.b };
  city.loyalty = 30;
  city.captured = t;
  s.cities.push(city);
  report(s, { kind: 'found', t, title: `Завладян град: ${data.name} (${data.x}|${data.y})`, win: true });
  log(s, t, `Завладяхте ${data.name}!`, 'epoch');
}

/**
 * Битка в град на играча (веднага, автоматично). att: { name, groups, lootBoost, crannyFactor, seed, formation, canConquer }.
 */
function defendCity(s, c, att, t, env) {
  const prep = prepareDefense(s, c, att, t, env);
  const r = autoBattle(att.seed, prep.att, prep.side, prep.opts);
  return resolveDefense(s, c, att, prep, r, t, env);
}

// Резултатите от тактически битки срещу мои градове, изиграни от нападателите.
function processOutcomes(s, env) {
  const w = env?.world;
  if (!w?.outcome || !s.pendingDef) return;
  for (const [id, p] of Object.entries(s.pendingDef)) {
    const r = w.outcome(id);
    if (!r) continue;
    const c = s.cities.find((x) => x.id === p.city);
    delete s.pendingDef[id];
    w.clearOutcome(id);
    if (!c) { w.putResult(id, { win: true, loot: {}, trapped: 0, att: r.att, def: [], defName: s.name, city: '', rounds: r.rounds }); continue; }
    const res = resolveDefense(s, c, p.att, p.prep, r, Math.max(p.t, s.t), env);
    w.putResult(id, { ...res, defName: s.name, city: c.name, wall: lv(c, 'wall') });
  }
}

// Компютърът изпраща нападение към град на играча.
function launchNpc(s, t, env) {
  const r = rng(hashStr(`${s.seed}:npc:${t}`));
  const next = () => { s.npcNext = t + scaled(s, NPC_ATTACK_EVERY[0] + r() * (NPC_ATTACK_EVERY[1] - NPC_ATTACK_EVERY[0])); };
  if (isProtected(s, t)) { s.npcNext = s.protectedUntil; return; }
  const c = s.cities[Math.floor(r() * s.cities.length)];
  const hostile = activeNpcs(s, env).filter((n) => !(s.pacts[n.clan] > t)).map((n) => ({ n, d: dist(n, c) })).sort((a, b) => a.d - b.d).slice(0, 4);
  if (!hostile.length) return next();
  const { n: npc, d } = hostile[Math.floor(r() * hostile.length)];
  const info = npcInfo(s, npc, t, env);
  const { side } = defenders(s, c, env);
  const dp = power(side, wallBonus(lv(c, 'wall'), s.techs.fortify).def);
  const floorP = 25 * lv(c, 'hall') ** 1.5;
  const want = Math.max(floorP, dp * (0.55 + r() * 0.6));
  const full = power(info.army) || 1;
  const k = Math.min(0.85, want / full);
  const groups = info.army.map((g) => ({ ...g, n: Math.max(0, Math.round(g.n * k)) })).filter((g) => g.n > 0);
  if (!groups.length) groups.push(barb('warrior', 3 * lv(c, 'hall')));
  const travel = Math.max(scaled(s, 120), Math.round(((d / (7 * WORLD_SPEED)) * HOUR) / s.speed));
  s.incoming.push({ id: s.seq++, kind: 'npc', npcId: npc.id, name: npc.name, city: c.id, groups, launched: t, arrive: t + travel });
  next();
}

function npcArrives(s, inc, env) {
  s.incoming.splice(s.incoming.indexOf(inc), 1);
  const c = cityOf(s, inc.city);
  const res = defendCity(s, c, { name: inc.name, groups: inc.groups, seed: `${s.seed}:inc:${inc.id}` }, inc.arrive, env);
  if (env?.world) {
    const before = inc.groups.reduce((a, g) => a + g.n, 0);
    const after = res.att.reduce((a, g) => a + g.n, 0);
    if (before) env.world.hitNpc(inc.npcId, { lost: ((before - after) / before) * 0.3, plunder: 0, t: inc.arrive });
  }
}

// Нападение от друг играч (през общия свят).
function pvpArrives(s, inc, env) {
  const c = s.cities.find((x) => x.id === inc.toCity);
  env.world.removeIncoming(s.uid, inc.id);
  if (!c) { env.world.putResult(inc.id, { win: true, loot: {}, trapped: 0, att: inc.groups.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [], defName: s.name, city: '', rounds: 0 }); return; }
  const att = { name: inc.attName, groups: inc.groups, lootBoost: inc.lootBoost, crannyFactor: inc.crannyFactor, seed: `pvp:${inc.id}`, formation: inc.formation, canConquer: inc.canConquer };
  const prep = prepareDefense(s, c, att, inc.arrive, env);
  if (inc.tactical && prep.side.length) {
    // нападателят ще води битката сам: пазим подготовката и чакаме изхода
    (s.pendingDef ||= {})[inc.id] = { city: c.id, att, prep: { side: prep.side.map((g) => ({ key: g.key, stId: g.stId || null })), trapped: prep.trapped, night: prep.night }, t: inc.arrive };
    env.world.putResult(inc.id, { pending: true, battle: { seed: att.seed, att: prep.att, def: prep.side.map(({ stId, ...g }) => g), opts: prep.opts }, defName: s.name, city: c.name });
    return;
  }
  const res = resolveDefense(s, c, att, prep, autoBattle(att.seed, prep.att, prep.side, prep.opts), inc.arrive, env);
  env.world.putResult(inc.id, { ...res, defName: s.name, city: c.name, wall: lv(c, 'wall') });
}

// ---------- походи ----------
function marchSpeed(s, units, withHero) {
  let sp = Infinity;
  for (const [u, n] of Object.entries(units)) if (n > 0) sp = Math.min(sp, UNITS[u].speed);
  if (withHero) sp = Math.min(sp, heroStats(s).speed);
  return (sp === Infinity ? HERO.speed : sp) * WORLD_SPEED;
}

const travelTime = (s, from, to, units, withHero) => Math.max(scaled(s, 30), Math.round(((dist(from, to) / marchSpeed(s, units, withHero)) * HOUR) / s.speed));

function foundable(s, x, y, env) {
  if (tileAt(s.world, x, y).kind !== 'grass') return false;
  if (s.cities.some((c) => c.x === x && c.y === y)) return false;
  if (npcs(s).some((n) => n.x === x && n.y === y)) return false;
  if (s.camps.some((c) => c.x === x && c.y === y)) return false;
  if (env?.world?.cityAt(x, y)) return false;
  return true;
}

/**
 * Изпраща войска. kind: raid | attack | scout | support | found | adventure.
 * target: { type: camp|oasis|npc|player|city|ally|tile|adventure, id, x, y, uid, cityId, name, diff }.
 */
function send(s, t, cid, kind, target, units, withHero, env, tactical = false) {
  advance(s, t, env);
  if (!['raid', 'attack', 'scout', 'support', 'found', 'adventure'].includes(kind)) fail('Непознат поход.');
  target = normalizeTarget(s, target || {}, env);
  const c = cityOf(s, cid);
  withHero = !!withHero;
  const sent = {};
  if (units && typeof units !== 'object') fail('Невалидни данни.');
  for (const [u, n] of Object.entries(units || {})) {
    const k = Math.floor(Number(n));
    if (!own(UNITS, u) || !(k > 0)) continue;
    if ((c.units[u] || 0) < k) fail('Нямате толкова войска в този град.');
    sent[u] = k;
  }
  if (withHero) {
    if (!heroHome(s, c)) fail('Героят не е в този град.');
    if (s.hero.health < 10 && kind !== 'support') fail('Героят е твърде ранен.');
  }
  const fighters = Object.keys(sent).filter((u) => FIGHTERS.includes(u));
  const has = (u) => sent[u] > 0;
  if (kind === 'adventure') {
    if (!withHero || Object.keys(sent).length) fail('На приключение тръгва само героят.');
    if (!s.adventures.some((a) => a.id === target.id)) fail('Приключението вече го няма.');
  } else if (kind === 'scout') {
    if (!has('scout') || Object.keys(sent).length > 1 || withHero) fail('Изпратете само съгледвачи.');
  } else if (kind === 'found') {
    if (!has('settler')) fail('Нужни са заселници.');
    if (s.cities.length >= allowedCities(s)) fail(`За нов град е нужна Цитадела ниво ${5 * s.cities.length}.`);
    if (!foundable(s, target.x, target.y, env)) fail('Тук не може да се основе град.');
  } else if (kind === 'support') {
    if (!fighters.length && !withHero) fail('Изберете войска.');
    if (has('settler')) fail('Заселниците не могат да подкрепят.');
  } else {
    if (!fighters.length && !withHero) fail('Изберете войска.');
    if (has('settler') || has('scout')) fail('Съгледвачите и заселниците не се бият.');
  }
  if (kind === 'raid') {
    const camp = s.camps.find((x) => x.id === target.id);
    if (!camp) fail('Няма такъв лагер.');
    if (camp.respawn) fail('Лагерът е разбит – варварите още се събират.');
    if (s.marches.some((m) => m.kind === 'raid' && m.target.id === camp.id && m.phase === 'go')) fail('Към този лагер вече има поход.');
  }
  if (kind === 'attack' && target.type === 'oasis') {
    const o = oasisInfo(s, target.x, target.y, env);
    if (!o) fail('Тук няма оазис.');
    if (o.owner) fail(o.mine ? 'Оазисът вече е ваш.' : 'Оазисът е владян от друг играч.');
  }
  if (kind === 'attack' && target.type === 'player') {
    if (!env?.world) fail('Няма връзка със света.');
    const rel = env.world.relation(s.uid, target.uid);
    if (rel === 'alliance' || rel === 'ally' || rel === 'pact') fail('Не можете да нападате съюзници.');
    const p = env.world.player(target.uid);
    if (!p) fail('Няма такъв играч.');
    if (p.protectedUntil > t) fail('Играчът е под защита за новаци.');
  }
  if (kind === 'attack' && target.type === 'npc') {
    const npc = npcs(s).find((n) => n.id === target.id);
    if (!npc) fail('Няма такъв владетел.');
    if (s.pacts[npc.clan] > t) fail('Имате пакт с този клан.');
  }
  if (kind === 'support' && target.type === 'ally' && env?.world?.relation(s.uid, target.uid) !== 'alliance') fail('Подкрепления се пращат само на членове на съюза.');
  if (kind === 'attack' && (target.type === 'npc' || target.type === 'player')) endProtection(s, t);
  for (const [u, n] of Object.entries(sent)) c.units[u] -= n;
  if (withHero) s.hero.state = 'away';
  const travel = travelTime(s, c, target, sent, withHero);
  const m = { id: s.seq++, kind, from: c.id, target, units: sent, hero: !!withHero, phase: 'go', depart: t, arrive: t + travel, travel, tactical: !!tactical && (kind === 'raid' || kind === 'attack') };
  s.marches.push(m);
  if (kind === 'adventure') s.adventures = s.adventures.filter((a) => a.id !== target.id);
  if (kind === 'attack' && target.type === 'player') {
    const mo = morale(score(s), env.world.player(target.uid)?.score || 0);
    const off = withHero ? heroStats(s).off : 0;
    const groups = Object.entries(sent).map(([u, n]) => { const st = unitStats(s, u, c); return { key: u, n, ...st, atk: st.atk * mo * (1 + off) }; });
    if (withHero) groups.push(heroGroup(s));
    m.pvpId = `${s.uid}:${m.id}`;
    m.morale = mo;
    env.world.sendIncoming({
      id: m.pvpId, toUid: target.uid, toCity: target.cityId, attUid: s.uid, attName: s.name, attRace: s.race,
      groups, lootBoost: s.race === 'orcs' ? 1.25 : 1, crannyFactor: s.race === 'orcs' ? 0.8 : 1, arrive: m.arrive, launched: t,
      tactical: m.tactical, formation: c.formation || null, canConquer: s.cities.length < allowedCities(s),
    });
  }
  return m;
}

// Целта се взима от данните на играта (не се вярва на координатите от клиента).
function normalizeTarget(s, T, env) {
  const xy = (o) => ({ x: o.x, y: o.y });
  switch (T.type) {
    case 'camp': { const c = s.camps.find((x) => x.id === T.id); if (!c) fail('Няма такъв лагер.'); return { type: 'camp', id: c.id, ...xy(c), name: campName(c) }; }
    case 'npc': { const n = activeNpcs(s, env).find((x) => x.id === T.id); if (!n) fail('Няма такъв владетел (може би вече е завладян).'); return { type: 'npc', id: n.id, ...xy(n), name: n.name }; }
    case 'player':
    case 'ally': {
      const p = env?.world?.player(T.uid);
      const pc = p?.cities.find((c) => c.id === T.cityId);
      if (!pc) fail('Няма такъв град.');
      return { type: T.type, uid: p.uid, cityId: pc.id, ...xy(pc), name: T.type === 'ally' ? p.name : `${p.name} – ${pc.name}` };
    }
    case 'city': { const c = s.cities.find((x) => x.id === T.id); if (!c) fail('Няма такъв град.'); return { type: 'city', id: c.id, ...xy(c), name: c.name }; }
    case 'oasis': { const x = Math.round(+T.x), y = Math.round(+T.y); if (tileAt(s.world, x, y).kind !== 'oasis') fail('Тук няма оазис.'); return { type: 'oasis', x, y, name: `оазис (${x}|${y})` }; }
    case 'adventure': { const a = s.adventures.find((x) => x.id === T.id); if (!a) fail('Приключението вече го няма.'); return { type: 'adventure', id: a.id, ...xy(a), diff: a.diff, name: 'приключение' }; }
    case 'tile': { const x = Math.round(+T.x), y = Math.round(+T.y); if (!inWorld(x, y)) fail('Извън света.'); return { type: 'tile', x, y, name: String(T.name || '').trim().slice(0, 24) || undefined }; }
    default: fail('Непозната цел.');
  }
}

// Войската с бонусите си (вкл. героя и морала) за поход.
function attackSide(s, m, mo = 1) {
  const c = cityOf(s, m.from);
  const off = m.hero ? heroStats(s).off : 0;
  const side = FIGHTERS.filter((u) => m.units[u] > 0).map((u) => { const st = unitStats(s, u, c); return { key: u, n: m.units[u], ...st, atk: st.atk * mo * (1 + off) }; });
  if (m.hero && s.hero.state !== 'dead') side.push(heroGroup(s));
  return side;
}

function takeLoot(s, pile, survivors) {
  const room = Object.entries(survivors).reduce((a, [u, n]) => a + n * (UNITS[u]?.carry || 0), 0);
  const boost = s.race === 'orcs' ? 1.25 : 1;
  const total = sum(pile) * boost;
  const share = total ? Math.min(1, room / total) : 0;
  return Object.fromEntries(Object.entries(pile).map(([k, v]) => [k, Math.floor(v * boost * share)]));
}

const battleXp = (r) => r.def.reduce((a, g) => a + g.lost * ((UNITS[g.key]?.hp || 10) / 4), 0);

function arrive(s, m, env) {
  const t = m.arrive;
  const T = m.target;
  const survivorsOf = (r) => Object.fromEntries(r.att.filter((g) => g.n > 0 && g.key !== 'hero').map((g) => [g.key, g.n]));
  const finishBattle = (r) => {
    if (m.hero) {
      heroWounds(s, t, r.att.find((g) => g.key === 'hero'));
      if (s.hero.state !== 'dead') heroXp(s, t, battleXp(r));
    }
  };
  const goHome = (units, loot = {}) => {
    const heroBack = m.hero && s.hero.state !== 'dead';
    if (!Object.keys(units).length && !heroBack) { s.marches.splice(s.marches.indexOf(m), 1); return; }
    Object.assign(m, { phase: 'back', units, loot, hero: heroBack, back: t + m.travel });
  };

  if (m.kind === 'adventure') return adventureArrives(s, m, goHome);

  if (m.kind === 'raid' || (m.kind === 'attack' && (T.type === 'oasis' || T.type === 'npc'))) {
    const setup = battleSetup(s, m, env);
    if (!setup) {
      report(s, { kind: 'attack', t, title: 'Оазисът вече е зает', win: false, att: [], def: [] });
      return goHome(m.units);
    }
    if (m.tactical && setup.def.length) {
      m.phase = 'battle';
      m.battle = { seed: `${s.seed}:${m.id}`, ...setup, expires: t + scaled(s, TACTIC.window) };
      log(s, t, `Войската пристигна при ${T.name || 'целта'} – поведете битката!`, 'alarm');
      return;
    }
    const r = setup.def.length ? fight(setup.att, setup.def, `${s.seed}:${m.id}`, setup.opts) : emptyWin(setup.att);
    return conclude(s, m, env, setup, r, t);
  }

  if (m.kind === 'attack' && T.type === 'player') return tryPvpResult(s, m, env, true);

  if (m.kind === 'scout') return scoutArrives(s, m, env, goHome);

  if (m.kind === 'support') {
    if (T.type === 'city') {
      const to = cityOf(s, T.id);
      for (const [u, n] of Object.entries(m.units)) to.units[u] = (to.units[u] || 0) + n;
      if (m.hero) { s.hero.city = to.id; s.hero.state = 'home'; }
      log(s, t, `Подкрепленията пристигнаха в ${to.name}.`, 'march');
      s.marches.splice(s.marches.indexOf(m), 1);
      return;
    }
    const from = cityOf(s, m.from);
    const groups = Object.entries(m.units).map(([u, n]) => ({ key: u, n, ...unitStats(s, u, from) }));
    const id = `${s.uid}:${m.id}`;
    env?.world?.addStationed({ id, fromUid: s.uid, fromName: s.name, fromRace: s.race, fromCity: m.from, toUid: T.uid, toCity: T.cityId, toName: T.name, groups, since: t });
    s.abroad.push({ id, from: m.from, toUid: T.uid, toCity: T.cityId, toName: T.name, x: T.x, y: T.y, units: m.units });
    log(s, t, `Подкрепленията пристигнаха при ${T.name}.`, 'march');
    s.marches.splice(s.marches.indexOf(m), 1);
    return;
  }

  if (m.kind === 'found') {
    if (!foundable(s, T.x, T.y, env) || s.cities.length >= allowedCities(s)) {
      log(s, t, 'Мястото за новия град е заето – заселниците се връщат.', 'loss');
      return goHome(m.units);
    }
    const id = `c${s.seq++}`;
    const name = T.name || `Град ${s.cities.length + 1}`;
    const city = newCity(id, name, T.x, T.y, { gold: 400, wood: 600, stone: 500, food: 600 });
    const rest = { ...m.units };
    rest.settler--;
    if (!rest.settler) delete rest.settler;
    city.units = rest;
    s.cities.push(city);
    if (m.hero) { s.hero.city = id; s.hero.state = 'home'; }
    report(s, { kind: 'found', t, title: `Основан град: ${name} (${T.x}|${T.y})`, win: true });
    log(s, t, `Основахте нов град: ${name}!`, 'epoch');
    s.marches.splice(s.marches.indexOf(m), 1);
  }
}

const emptyWin = (att) => ({ win: 'att', rounds: 0, att: att.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [] });

function sendHome(s, m, t, units, loot = {}) {
  const heroBack = m.hero && s.hero.state !== 'dead';
  const i = s.marches.indexOf(m);
  if (!Object.keys(units).length && !heroBack) { if (i >= 0) s.marches.splice(i, 1); return; }
  Object.assign(m, { phase: 'back', units, loot, hero: heroBack, back: t + m.travel, battle: undefined });
}

// Страните в битката при пристигане (и всичко, нужно след нея).
function battleSetup(s, m, env) {
  const t = m.arrive, T = m.target;
  if (m.kind === 'raid') {
    const camp = s.camps.find((x) => x.id === T.id);
    return { type: 'camp', att: attackSide(s, m), def: campArmy(camp.lvl), opts: {}, ctx: { id: camp.id, lvl: camp.lvl, name: campName(camp) } };
  }
  if (T.type === 'oasis') {
    const o = oasisInfo(s, T.x, T.y, env);
    if (!o || o.owner) return null;
    return { type: 'oasis', att: attackSide(s, m), def: o.guards, opts: {}, ctx: { key: o.key, x: o.x, y: o.y, res: o.res, lvl: o.lvl, guarded: o.guards.length > 0 } };
  }
  const npc = npcs(s).find((n) => n.id === T.id);
  const info = npcInfo(s, npc, t, env);
  const mo = morale(score(s), info.score);
  const wb = wallBonus(info.wall);
  const night = isNight(t) ? NIGHT.bonus : 1;
  return { type: 'npc', att: attackSide(s, m, mo), def: info.army, opts: { defMult: wb.def * night, defHp: wb.hp, formA: cityOf(s, m.from).formation || null }, ctx: { id: npc.id, name: npc.name, pile: info.pile, lost: info.lost, wall: info.wall, morale: mo, night: night > 1, loyalty: info.loyalty, lvl: info.lvl } };
}

// Последствията от битка (набег, оазис, владетел на компютъра).
function conclude(s, m, env, setup, r, t) {
  const ctx = setup.ctx;
  if (m.hero) {
    heroWounds(s, t, r.att.find((g) => g.key === 'hero'));
    if (s.hero.state !== 'dead') heroXp(s, t, battleXp(r));
  }
  const win = r.win === 'att';
  const surv = Object.fromEntries(r.att.filter((g) => g.n > 0 && g.key !== 'hero').map((g) => [g.key, g.n]));
  if (r.tactical && win) bump(s, t, 'tactics');
  const tag = r.tactical ? ' (тактическа битка)' : '';
  if (setup.type === 'camp') {
    const camp = s.camps.find((x) => x.id === ctx.id);
    let raised = 0, loot = {};
    if (win && s.race === 'undead') {
      raised = Math.floor(r.def.reduce((a, g) => a + g.lost, 0) * 0.1);
      if (raised) surv.warrior = (surv.warrior || 0) + raised;
    }
    if (win) {
      const pile = campLoot(ctx.lvl);
      const souls = pile.souls;
      delete pile.souls;
      loot = takeLoot(s, pile, surv);
      if (souls) loot.souls = souls;
      s.stats.bestCamp = Math.max(s.stats.bestCamp, ctx.lvl);
      bump(s, t, 'raids');
      if (camp) camp.respawn = t + scaled(s, CAMP_RESPAWN);
    }
    report(s, { kind: 'raid', t, title: `${win ? 'Победа' : 'Поражение'}: ${ctx.name} (ниво ${ctx.lvl})${tag}`, win, att: r.att, def: r.def, loot, raised, rounds: r.rounds });
    log(s, t, win ? `Победа над ${ctx.name} (ниво ${ctx.lvl})!` : `Поражение при ${ctx.name} (ниво ${ctx.lvl}).`, win ? 'win' : 'loss');
    return sendHome(s, m, t, surv, loot);
  }
  if (setup.type === 'oasis') {
    const g = (s.guards[ctx.key] ||= { alive: 1, respawn: 0 });
    let loot = {}, annexed = false, note = '';
    if (win) {
      if (ctx.guarded) {
        g.alive = 0;
        g.respawn = t + scaled(s, OASIS_RESPAWN);
        const pile = campLoot(ctx.lvl);
        delete pile.souls;
        for (const k of Object.keys(pile)) pile[k] = Math.round(pile[k] * (k === ctx.res ? 1 : 0.4));
        loot = takeLoot(s, pile, surv);
        bump(s, t, 'raids');
      }
      const from = cityOf(s, m.from);
      const heroOk = m.hero && s.hero.state !== 'dead';
      if (!heroOk) note = 'За да завладеете оазиса, изпратете и героя.';
      else if (s.oases.length >= oasisSlots(s)) note = 'Нямате свободно място за оазис – подобрете Залата на героите (ниво 3, 6, 10).';
      else if (dist(from, ctx) > OASIS_RANGE + 0.01) note = `Оазисът е на повече от ${OASIS_RANGE} полета от ${from.name}.`;
      else if (env?.world?.oasisOwner(ctx.key)) note = 'Друг владетел го завладя преди вас.';
      else {
        s.oases.push({ key: ctx.key, x: ctx.x, y: ctx.y, res: ctx.res, city: from.id });
        env?.world?.setOasisOwner(ctx.key, s.uid, s.name);
        annexed = true;
        log(s, t, `Оазисът (${ctx.x}|${ctx.y}) е ваш: +25% ${resName(s.race, ctx.res).toLowerCase()} за ${from.name}.`, 'win');
      }
    } else {
      const before = setup.def.reduce((a, x) => a + x.n, 0);
      const after = r.def.reduce((a, x) => a + x.n, 0);
      g.alive = before ? (g.alive * after) / before : g.alive;
    }
    report(s, { kind: 'attack', t, title: `${win ? 'Победа' : 'Поражение'}: оазис (${ctx.x}|${ctx.y})${tag}`, win, att: r.att, def: r.def, loot, annexed, rounds: r.rounds, note });
    return sendHome(s, m, t, surv, loot);
  }
  const loot = win ? takeLoot(s, ctx.pile, surv) : {};
  const before = setup.def.reduce((a, g) => a + g.n, 0) || 1;
  const killed = r.def.reduce((a, g) => a + g.lost, 0);
  const siege = {};
  let conquered = false;
  if (win) {
    const cats = r.att.find((g) => g.key === 'catapult')?.n || 0;
    if (cats) siege.wall = Math.min(ctx.wall, Math.floor(cats / 6));
    const nobles = r.att.find((g) => g.key === 'noble')?.n || 0;
    if (nobles) {
      const rr = rng(hashStr(`${s.seed}:${m.id}:noble`));
      let drop = 0;
      for (let i = 0; i < Math.min(3, nobles); i++) drop += 20 + Math.floor(rr() * 11);
      const loy = (ctx.loyalty ?? 100) - drop;
      siege.loyalty = Math.max(0, Math.round(loy));
      if (loy <= 0 && s.cities.length < allowedCities(s)) conquered = true;
      else if (loy <= 0) siege.note = 'Нямате място за нов град – подобрете Цитаделата.';
    }
  }
  env?.world?.hitNpc(ctx.id, {
    lost: (killed / before) * (1 - ctx.lost), plunder: win ? sum(loot) / (sum(ctx.pile) || 1) : 0, t,
    wallDmg: siege.wall || 0, loyalty: siege.loyalty != null ? Math.max(1, siege.loyalty) : undefined,
    owner: conquered ? { uid: s.uid, name: s.name } : undefined,
  });
  if (conquered) {
    const L = Math.floor(ctx.lvl);
    const lvl = (k) => Math.max(1, Math.min(EPOCHS[s.epoch - 1].cap, Math.floor(L * k)));
    addCapturedCity(s, t, {
      name: ctx.name, x: m.target.x, y: m.target.y, res: { gold: 500, wood: 800, stone: 700, food: 800 },
      b: { hall: lvl(0.5), farm: lvl(0.5), lumber: lvl(0.5), quarry: lvl(0.45), mine: lvl(0.4), houses: lvl(0.45), warehouse: lvl(0.45), barracks: lvl(0.35), wall: lvl(0.3) },
    });
    if (surv.noble) { surv.noble--; if (!surv.noble) delete surv.noble; }
  }
  if (win) bump(s, t, 'raids');
  report(s, { kind: 'attack', t, title: `${conquered ? 'Завладяхте' : win ? 'Победа' : 'Поражение'}: ${ctx.name}${tag}`, win, att: r.att, def: r.def, loot, morale: ctx.morale, night: ctx.night, wall: ctx.wall, rounds: r.rounds, siege });
  log(s, t, win ? `Ограбихте ${ctx.name}!` : `Атаката срещу ${ctx.name} се провали.`, win ? 'win' : 'loss');
  return sendHome(s, m, t, surv, loot);
}

// Играчът изигра тактическата битка: сървърът повтаря ходовете му.
function fightTactical(s, t, marchId, moves, env) {
  advance(s, t, env);
  const m = s.marches.find((x) => x.id === marchId && x.phase === 'battle');
  if (!m) fail('Битката вече е решена.');
  if (moves != null && !Array.isArray(moves)) fail('Невалидни ходове.');
  finishBattleAt(s, m, env, replay(m.battle, moves || []), t);
}

// Изходът на тактическа битка: срещу компютъра – веднага; срещу играч – през защитника.
function finishBattleAt(s, m, env, r, t) {
  if (m.battle.pvp) {
    env?.world?.putOutcome(m.pvpId, r);
    m.phase = 'wait';
    m.battle = undefined;
    m.arrive = t;
    if (r.win === 'att') bump(s, t, 'tactics');
    tryPvpResult(s, m, env);
    return;
  }
  conclude(s, m, env, m.battle, r, t);
}

function tryPvpResult(s, m, env, atArrival = false) {
  const w = env?.world;
  let res = w?.result(m.pvpId);
  if (!res && w?.resolveOffline) { w.resolveOffline(m.target.uid, m.pvpId, m.arrive); res = w.result(m.pvpId); }
  if (!res) { if (atArrival) m.phase = 'wait'; return; }
  w.clearResult(m.pvpId);
  const t = m.arrive;
  if (res.pending) {
    // защитникът е готов – водим битката сами
    m.phase = 'battle';
    m.battle = { ...res.battle, pvp: true, expires: Math.max(t, s.t) + scaled(s, TACTIC.window) };
    log(s, s.t, `Войската пристигна при ${res.defName} – поведете битката!`, 'alarm');
    return;
  }
  const win = res.win;
  if (m.hero) {
    heroWounds(s, t, res.att.find((g) => g.key === 'hero'));
    if (s.hero.state !== 'dead') heroXp(s, t, battleXp(res));
  }
  const surv = Object.fromEntries(res.att.filter((g) => g.n > 0 && g.key !== 'hero').map((g) => [g.key, g.n]));
  if (win) bump(s, t, 'raids');
  if (res.captured) {
    if (s.cities.length < allowedCities(s)) {
      addCapturedCity(s, t, res.captured);
      if (surv.noble) { surv.noble--; if (!surv.noble) delete surv.noble; }
    }
  }
  report(s, { kind: 'attack', t, title: `${res.captured ? 'Завладяхте' : win ? 'Победа' : 'Поражение'}: ${res.defName} – ${res.city}`, win, att: res.att, def: res.def, loot: res.loot, trapped: res.trapped, wall: res.wall, rounds: res.rounds, morale: m.morale, siege: res.siege });
  log(s, t, win ? `Ограбихте ${res.defName}!` : `Атаката срещу ${res.defName} се провали.`, win ? 'win' : 'loss');
  const heroBack = m.hero && s.hero.state !== 'dead';
  if (!Object.keys(surv).length && !heroBack) { s.marches.splice(s.marches.indexOf(m), 1); return; }
  Object.assign(m, { phase: 'back', units: surv, loot: res.loot, hero: heroBack, back: t + m.travel });
}

const intelKey = (T) => `${T.type}:${T.type === 'player' ? `${T.uid}:${T.cityId}` : T.id ?? `${T.x}|${T.y}`}`;

function scoutArrives(s, m, env, goHome) {
  const t = m.arrive;
  const T = m.target;
  const A = m.units.scout;
  let D = 0, data = null, title = '';
  if (T.type === 'npc') {
    const info = npcInfo(s, npcs(s).find((n) => n.id === T.id), t, env);
    D = info.scouts;
    data = { army: info.army.map((g) => ({ key: g.key, n: g.n })), wall: info.wall, pile: info.pile, lvl: info.lvl, loyalty: Math.round(info.loyalty) };
    title = info.name;
  } else if (T.type === 'player') {
    const p = env?.world?.player(T.uid);
    const pc = p?.cities.find((c) => c.id === T.cityId);
    D = pc?.scouts || 0;
    data = pc ? { army: Object.entries(pc.units || {}).map(([key, n]) => ({ key, n })), wall: pc.wall, traps: pc.traps, cranny: pc.cranny, res: pc.res, race: p.race, loyalty: pc.loyalty } : null;
    title = `${p?.name || 'Играч'} – ${pc?.name || ''}`;
  } else if (T.type === 'oasis') {
    const o = oasisInfo(s, T.x, T.y, env);
    data = { army: (o?.guards || []).map((g) => ({ key: g.key, n: g.n })), res: o?.res };
    title = `Оазис (${T.x}|${T.y})`;
  } else if (T.type === 'camp') {
    const camp = s.camps.find((x) => x.id === T.id);
    data = { army: campArmy(camp.lvl).map((g) => ({ key: g.key, n: g.n })) };
    title = campName(camp);
  }
  const ok = s.race === 'vesheri' || A >= D * 0.8;
  const lost = ok ? Math.min(A, Math.floor(A * Math.min(0.5, D / (A * 2 || 1)))) : A;
  if (ok) {
    s.intel[intelKey(T)] = { t, data, title };
    bump(s, t, 'scouted');
  }
  report(s, { kind: 'scout', t, title: `${ok ? 'Разузнаване' : 'Съгледвачите бяха разкрити'}: ${title}`, win: ok, intel: ok ? data : null, scoutsLost: lost });
  log(s, t, ok ? `Съгледвачите разузнаха ${title}.` : `Съгледвачите при ${title} бяха избити.`, ok ? 'info' : 'loss');
  const left = A - lost;
  goHome(left > 0 ? { scout: left } : {});
}

function comeBack(s, m) {
  s.marches.splice(s.marches.indexOf(m), 1);
  const c = cityOf(s, m.from);
  for (const [u, n] of Object.entries(m.units)) c.units[u] = (c.units[u] || 0) + n;
  if (m.hero && s.hero.state !== 'dead') { s.hero.state = 'home'; s.hero.city = c.id; }
  addRes(c, m.loot || {}, true);
  log(s, m.back, m.kind === 'adventure' ? `${s.hero.name} се върна от приключение.` : `Войската се върна в ${c.name}.`, 'march');
}

// Изтегляне на подкрепления от съюзник.
function recall(s, t, abroadId, env) {
  advance(s, t, env);
  const i = s.abroad.findIndex((a) => a.id === abroadId);
  if (i < 0) fail('Няма такива подкрепления.');
  const [a] = s.abroad.splice(i, 1);
  const st = env?.world?.removeStationed(a.id);
  const units = st ? Object.fromEntries(st.groups.filter((g) => g.n > 0).map((g) => [g.key, g.n])) : a.units;
  if (!Object.keys(units).length) return;
  const from = cityOf(s, a.from);
  const travel = travelTime(s, { x: a.x, y: a.y }, from, units, false);
  s.marches.push({ id: s.seq++, kind: 'support', from: a.from, target: { type: 'ally', name: a.toName, x: a.x, y: a.y }, units, hero: false, phase: 'back', depart: t, arrive: t, back: t + travel, travel, loot: {} });
}

// Подкрепленията на съюзник се връщат сами, ако той ги отпрати (или напусне съюза).
function syncAbroad(s, t, env) {
  if (!env?.world) return;
  for (const a of [...s.abroad]) {
    const st = env.world.stationedById(a.id);
    if (!st) {
      s.abroad.splice(s.abroad.indexOf(a), 1);
      continue;
    }
    a.units = Object.fromEntries(st.groups.filter((g) => g.n > 0).map((g) => [g.key, g.n]));
    if (st.sendBack) recall(s, t, a.id, env);
  }
}

// ---------- приключения ----------
function spawnAdventure(s) {
  const t = s.advNext;
  s.advNext = t + scaled(s, ADVENTURE.every);
  if (s.adventures.length >= ADVENTURE.max) return;
  const r = rng(hashStr(`${s.seed}:adv:${t}`));
  const c = s.cities[Math.floor(r() * s.cities.length)];
  for (let k = 0; k < 12; k++) {
    const ang = r() * Math.PI * 2, rad = 2 + r() * 5;
    const x = Math.round(c.x + Math.cos(ang) * rad), y = Math.round(c.y + Math.sin(ang) * rad);
    const tile = tileAt(s.world, x, y);
    if (tile.kind === 'void' || tile.kind === 'lake' || tile.kind === 'oasis') continue;
    if (s.adventures.some((a) => a.x === x && a.y === y) || s.cities.some((cc) => cc.x === x && cc.y === y)) continue;
    s.adventures.push({ id: s.seq++, x, y, diff: r() < 0.3 ? 'hard' : 'normal', expires: t + scaled(s, ADVENTURE.life) });
    return;
  }
}

function adventureArrives(s, m, goHome) {
  const t = m.arrive;
  const hard = m.target.diff === 'hard';
  const r = rng(hashStr(`${s.seed}:advres:${m.id}`));
  const h = s.hero;
  const red = Math.min(0.6, heroStats(s).armorRed + h.lvl * 0.015);
  const dmg = (hard ? 18 + r() * 24 : 8 + r() * 14) * (1 - red);
  let text;
  const reward = {};
  let item = null, units = 0;
  bump(s, t, 'adventures');
  if (h.health - dmg <= 0 && hard) {
    h.health = 0;
    h.state = 'dead';
    text = `${h.name} загина в опасно приключение.`;
  } else {
    h.health = Math.max(1, h.health - dmg);
    heroXp(s, t, (hard ? 2.2 : 1) * (15 + r() * 15) * (1 + h.lvl * 0.15));
    const roll = r();
    if (roll < (hard ? 0.4 : 0.22)) {
      const tr = r();
      const tier = hard ? (tr < 0.35 ? 1 : tr < 0.75 ? 2 : tr < 0.95 ? 3 : 4) : (tr < 0.7 ? 1 : tr < 0.95 ? 2 : 3);
      const slots = Object.keys(ITEM_FX);
      item = { id: s.seq++, slot: slots[Math.floor(r() * slots.length)], tier };
      h.items.push(item);
      text = `${h.name} намери предмет: ${itemOf(item).name}.`;
    } else if (roll < 0.55) {
      const amount = Math.round(250 * (1 + h.lvl * 0.4) * (hard ? 2 : 1));
      const ks = ['gold', 'wood', 'stone', 'food'];
      const a = ks[Math.floor(r() * 4)], b = ks[Math.floor(r() * 4)];
      reward[a] = (reward[a] || 0) + amount;
      reward[b] = (reward[b] || 0) + Math.round(amount / 2);
      text = `${h.name} намери скрити запаси.`;
    } else if (roll < 0.72) {
      reward.souls = 2 + Math.floor(r() * (hard ? 8 : 4));
      text = `${h.name} събра души от древно бойно поле.`;
    } else if (roll < 0.85) {
      units = 3 + Math.floor(r() * (hard ? 10 : 5));
      text = `Към героя се присъединиха ${units} бойци.`;
    } else {
      reward.gold = Math.round(150 * (1 + h.lvl * 0.3));
      text = `${h.name} помогна на пътници и получи злато.`;
    }
  }
  report(s, { kind: 'adventure', t, title: `Приключение (${hard ? 'опасно' : 'обикновено'})`, win: h.state !== 'dead', text, loot: reward, item: item ? itemOf(item) : null, dmg: Math.round(dmg) });
  log(s, t, text, h.state === 'dead' ? 'loss' : 'win');
  goHome(units ? { warrior: units } : {}, reward);
}

// Снимка на империята за общия свят (карта, класации, разузнаване от други играчи).
function snapshot(s, alliance = null) {
  return {
    uid: s.uid, name: s.name, race: s.race, epoch: s.epoch, score: score(s), protectedUntil: s.protectedUntil, alliance, t: s.t,
    cities: s.cities.map((c) => ({
      id: c.id, name: c.name, x: c.x, y: c.y, hall: lv(c, 'hall'), loyalty: Math.round(c.loyalty ?? 100), burnT: c.burnT || 0, captured: !!c.captured, wall: lv(c, 'wall'), traps: lv(c, 'traps'), cranny: lv(c, 'cranny'),
      units: Object.fromEntries(FIGHTERS.filter((u) => c.units[u] > 0).map((u) => [u, c.units[u]])), scouts: c.units.scout || 0,
      res: Object.fromEntries(['gold', 'wood', 'stone', 'food'].map((k) => [k, Math.floor(c.res[k])])),
    })),
  };
}

// ---------- всички действия на играча (през тях минава и сървърът) ----------
const cleanName = (v, max) => { const n = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max); if (!n) fail('Въведете име.'); return n; };
const ACTIONS = {
  build: (s, t, env, cid, id) => build(s, t, cid, id, env),
  cancelBuild: (s, t, env, cid, id) => cancelBuild(s, t, cid, id, env),
  train: (s, t, env, cid, u, n) => train(s, t, cid, u, n, env),
  research: (s, t, env, cid, id) => research(s, t, cid, id, env),
  advanceEpoch: (s, t, env, cid) => advanceEpoch(s, t, cid, env),
  claimStory: (s, t, env, cid, id) => claimStory(s, t, cid, id, env),
  claimDaily: (s, t, env, cid, id) => claimDaily(s, t, cid, id, env),
  send: (s, t, env, cid, kind, target, units, withHero, tactical) => { send(s, t, cid, kind, target, units, withHero, env, tactical); },
  recall: (s, t, env, id) => recall(s, t, id, env),
  revive: (s, t, env, cid) => reviveHero(s, t, cid, env),
  pact: (s, t, env, cid, clan) => buyPact(s, t, cid, clan, env),
  sellItem: (s, t, env, cid, id) => sellItem(s, t, cid, id),
  assignPoint: (s, t, env, key) => assignPoint(s, key),
  equip: (s, t, env, id) => equip(s, id),
  unequip: (s, t, env, slot) => unequip(s, slot),
  endProtection: (s, t) => endProtection(s, t),
  renameCity: (s, t, env, cid, name) => { const c = s.cities.find((x) => x.id === cid); if (!c) fail('Няма такъв град.'); c.name = cleanName(name, 24); },
  renameHero: (s, t, env, name) => { s.hero.name = cleanName(name, 20); },
  tactical: (s, t, env, marchId, moves) => fightTactical(s, t, marchId, moves, env),
  setFormation: (s, t, env, cid, cls, pos) => {
    const c = s.cities.find((x) => x.id === cid);
    if (!c) fail('Няма такъв град.');
    if (!own(FORMATION, cls) || !['front', 'back', 'flank'].includes(pos)) fail('Невалидна формация.');
    c.formation = { ...FORMATION, ...(c.formation || {}), [cls]: pos };
  },
};

function perform(s, t, env, name, args = []) {
  if (!own(ACTIONS, name)) fail('Непознато действие.');
  if (!Array.isArray(args) || args.length > 8) fail('Невалидни данни.');
  advance(s, t, env);
  ACTIONS[name](s, t, env, ...args);
  return s;
}

return { newGame, migrate, cityOf, lv, maxLv, bName, bDesc, uName, bCost, bTime, maxLevel, bProd, storageCap, capOf, crannyCap, trapCap, wallBonus, warnWindow, oasisSlots, allowedCities, embassyMax, popCap, popUsed, upkeep, heroHome, rates, unitStats, uCost, uTime, tTime, canPay, itemOf, heroStats, assignPoint, equip, unequip, sellItem, reviveCost, reviveTime, reviveHero, advance, setSpeed, dayKey, dailyList, claimDaily, storyList, claimStory, buildSlots, buildState, build, cancelBuild, unitLock, maxTrain, train, techState, research, epochReqs, advanceEpoch, campMax, campName, campArmy, campLoot, oasisInfo, npcLevel, npcInfo, npcs, activeNpcs, isProtected, localHour, localMonth, isNight, score, morale, endProtection, pactCost, buyPact, defenders, marchSpeed, travelTime, foundable, send, fightTactical, intelKey, recall, syncAbroad, snapshot, perform };
})();

__m['js/games/empires/worldcore.js'] = (() => {
// Evil Empires – общият свят като документ: играчи, съюзи, чат, подкрепления, оазиси,
// нападения между играчи. Едни и същи функции работят в браузъра (localStorage)
// и на сървъра (Supabase); тук няма достъп до хранилище – само до документа.
const { npcList, homeStart, findSpot, dist } = __m['js/games/empires/worldgen.js'];

function freshWorld(seed = (Math.random() * 2 ** 31) >>> 0, created = Date.now()) {
  return { v: 1, seed, created, players: {}, alliances: {}, incoming: {}, results: {}, stationed: [], oases: {}, npc: {} };
}

// Място за столицата на нов играч.
function allocateHomeIn(w, uid) {
  if (w.players[uid]?.cities?.[0]) return { x: w.players[uid].cities[0].x, y: w.players[uid].cities[0].y, seed: w.seed };
  const npcs = npcList(w.seed);
  const taken = (x, y, gap) =>
    npcs.some((n) => dist(n, { x, y }) < gap + 3) ||
    Object.values(w.players).some((p) => p.cities.some((c) => dist(c, { x, y }) < gap + 2));
  const spot = findSpot(w.seed, homeStart(w.seed, uid), taken, 2) || { x: 0, y: 0 };
  return { ...spot, seed: w.seed };
}

// Какво вижда играчът от света: без ресурсите и войската на другите (те се научават с разузнаване).
function buildView(w, uid) {
  const me = w.players[uid];
  const myAlliance = me?.alliance;
  const players = {};
  for (const [id, p] of Object.entries(w.players)) {
    players[id] = id === uid ? p : {
      uid: p.uid, name: p.name, race: p.race, epoch: p.epoch, score: p.score, protectedUntil: p.protectedUntil, alliance: p.alliance, t: p.t,
      cities: p.cities.map((c) => ({ id: c.id, name: c.name, x: c.x, y: c.y, hall: c.hall, loyalty: c.loyalty, burnT: c.burnT, captured: c.captured })),
    };
  }
  const alliances = {};
  for (const [id, a] of Object.entries(w.alliances)) {
    alliances[id] = { ...a, chat: id === myAlliance ? a.chat : [], invites: a.invites.filter((x) => x === uid || id === myAlliance) };
  }
  const results = {};
  for (const [id, r] of Object.entries(w.results)) if (id.startsWith(`${uid}:`)) results[id] = r;
  // лични съобщения: само разговорите на играча
  const dms = {};
  for (const [k, list] of Object.entries(w.dms || {})) if (k.split('|').includes(uid)) dms[k] = list;
  return {
    v: 1, seed: w.seed, created: w.created, players, alliances, results, dms, npc: w.npc, oases: w.oases,
    incoming: { [uid]: w.incoming[uid] || [] },
    stationed: w.stationed.filter((x) => x.toUid === uid || x.fromUid === uid),
  };
}

/**
 * Интерфейсът към света, който ползва логиката (env.world) и интерфейсът.
 * store: { get() → документ, mutate(fn) → резултатът на fn(документ) }.
 */
function makeWorld(store, uid) {
  const W = () => store.get();
  const mut = (fn) => store.mutate(fn);
  const fail = (msg) => { throw new Error(msg); };
  return {
    get seed() { return W().seed; },
    get created() { return W().created; },
    raw: W,

    // ----- играчи -----
    player: (id) => W().players[id] || null,
    players: () => Object.values(W().players),
    publish(snap) {
      mut((w) => {
        const old = w.players[snap.uid];
        w.players[snap.uid] = { ...snap, alliance: old?.alliance || null, joined: old?.joined || Date.now() };
      });
    },
    removePlayer(id) {
      mut((w) => {
        const aid = w.players[id]?.alliance;
        const a = w.alliances[aid];
        if (a) {
          a.members = a.members.filter((x) => x !== id);
          if (!a.members.length) delete w.alliances[aid];
          else if (a.leader === id) a.leader = a.members[0];
        }
        delete w.players[id];
        delete w.incoming[id];
        for (const k of Object.keys(w.dms || {})) if (k.split('|').includes(id)) delete w.dms[k];
        for (const [k, o] of Object.entries(w.oases)) if (o.uid === id) delete w.oases[k];
        for (const st of w.stationed) if (st.toUid === id || st.fromUid === id) st.sendBack = true;
      });
    },
    cityAt(x, y) {
      for (const p of Object.values(W().players)) for (const c of p.cities) if (c.x === x && c.y === y) return { ...c, uid: p.uid, owner: p.name, race: p.race };
      return null;
    },

    // ----- нападения между играчи -----
    incomingFor: (id) => W().incoming[id] || [],
    sendIncoming(rec) { mut((w) => { (w.incoming[rec.toUid] ||= []).push(rec); }); },
    removeIncoming(id, recId) { mut((w) => { w.incoming[id] = (w.incoming[id] || []).filter((x) => x.id !== recId); }); },
    putResult(id, res) { mut((w) => { w.results[id] = res; }); },
    result: (id) => W().results[id] || null,
    clearResult(id) { mut((w) => { delete w.results[id]; }); },
    // изходът на тактическа битка срещу играч (нападателят го праща, защитникът го прилага)
    putOutcome(id, r) { mut((w) => { w.results[`o:${id}`] = r; }); },
    outcome: (id) => W().results[`o:${id}`] || null,
    clearOutcome(id) { mut((w) => { delete w.results[`o:${id}`]; }); },
    resolveOffline: null,

    // ----- подкрепления -----
    stationedAt: (toUid, cityId) => W().stationed.filter((x) => x.toUid === toUid && x.toCity === cityId),
    stationedFrom: (fromUid) => W().stationed.filter((x) => x.fromUid === fromUid),
    stationedById: (id) => W().stationed.find((x) => x.id === id) || null,
    addStationed(rec) { mut((w) => { w.stationed.push(rec); }); },
    setStationed(id, groups) {
      mut((w) => {
        const st = w.stationed.find((x) => x.id === id);
        if (st) st.groups = groups;
        w.stationed = w.stationed.filter((x) => x.groups.some((g) => g.n > 0));
      });
    },
    removeStationed(id) {
      return mut((w) => {
        const st = w.stationed.find((x) => x.id === id) || null;
        w.stationed = w.stationed.filter((x) => x.id !== id);
        return st;
      });
    },
    sendBackStationed(id) {
      mut((w) => {
        const st = w.stationed.find((x) => x.id === id);
        if (!st || (st.toUid !== uid && st.fromUid !== uid)) fail('Няма такива подкрепления.');
        st.sendBack = true;
      });
    },

    // ----- империи на компютъра -----
    npcState: (id) => W().npc[id] || null,
    hitNpc(id, { lost = 0, plunder = 0, t, wallDmg = 0, loyalty, owner }) {
      mut((w) => {
        const o = w.npc[id] || { lost: 0, lostT: t, plunder: 0, plunderT: t };
        if (lost) Object.assign(o, { lost: Math.min(0.9, o.lost + lost), lostT: t });
        if (plunder) Object.assign(o, { plunder: Math.min(0.9, o.plunder + plunder), plunderT: t });
        if (wallDmg) Object.assign(o, { wallDmg: (o.wallDmg || 0) + wallDmg, wallT: t });
        if (loyalty != null) Object.assign(o, { loyalty, loyT: t });
        if (owner) o.owner = owner;
        w.npc[id] = o;
      });
    },

    // ----- оазиси -----
    oasisOwner: (key) => W().oases[key] || null,
    setOasisOwner(key, ownerUid, name) { mut((w) => { if (ownerUid) w.oases[key] = { uid: ownerUid, name }; else delete w.oases[key]; }); },

    // ----- съюзи -----
    allianceOf: (id) => { const a = W().players[id]?.alliance; return a ? W().alliances[a] || null : null; },
    alliances: () => Object.values(W().alliances),
    relation(a, b) {
      if (a === b) return 'self';
      const w = W();
      const pa = w.players[a]?.alliance, pb = w.players[b]?.alliance;
      if (!pa || !pb) return null;
      if (pa === pb) return 'alliance';
      return w.alliances[pa]?.diplomacy?.[pb] || null;
    },
    invitesFor: (id) => Object.values(W().alliances).filter((a) => a.invites.includes(id)),
    createAlliance(name, tag, embassy) {
      name = String(name || '').trim().slice(0, 28);
      tag = String(tag || '').trim().toUpperCase().slice(0, 4);
      if (name.length < 3 || tag.length < 2) fail('Име (3+ букви) и таг (2–4 знака).');
      if (embassy != null && embassy < 3) fail('Нужно е Посолство ниво 3.');
      return mut((w) => {
        if (!w.players[uid]) fail('Империята ви още не е в света.');
        if (w.players[uid].alliance) fail('Вече сте в съюз.');
        if (Object.values(w.alliances).some((a) => a.tag.toLowerCase() === tag.toLowerCase())) fail('Този таг е зает.');
        const id = 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
        w.alliances[id] = { id, name, tag, leader: uid, members: [uid], invites: [], chat: [], diplomacy: {}, created: Date.now() };
        w.players[uid].alliance = id;
        return id;
      });
    },
    invite(targetUid) {
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a) fail('Не сте в съюз.');
        if (!w.players[targetUid]) fail('Няма такъв играч.');
        if (w.players[targetUid].alliance) fail('Играчът вече е в съюз.');
        if (!a.invites.includes(targetUid)) a.invites.push(targetUid);
      });
    },
    acceptInvite(aid, maxMembers) {
      mut((w) => {
        const a = w.alliances[aid];
        if (!a || !a.invites.includes(uid)) fail('Поканата вече не е валидна.');
        if (w.players[uid]?.alliance) fail('Вече сте в съюз.');
        if (a.members.length >= maxMembers) fail('Съюзът е пълен.');
        a.invites = a.invites.filter((x) => x !== uid);
        a.members.push(uid);
        w.players[uid].alliance = aid;
        a.chat.push({ sys: true, text: `${w.players[uid].name} се присъедини към съюза.`, t: Date.now() });
      });
    },
    declineInvite(aid) { mut((w) => { const a = w.alliances[aid]; if (a) a.invites = a.invites.filter((x) => x !== uid); }); },
    leave() {
      mut((w) => {
        const aid = w.players[uid]?.alliance;
        const a = w.alliances[aid];
        if (!a) return;
        a.members = a.members.filter((x) => x !== uid);
        w.players[uid].alliance = null;
        a.chat.push({ sys: true, text: `${w.players[uid].name} напусна съюза.`, t: Date.now() });
        for (const st of w.stationed) if ((st.fromUid === uid && a.members.includes(st.toUid)) || (st.toUid === uid && a.members.includes(st.fromUid))) st.sendBack = true;
        if (!a.members.length) delete w.alliances[aid];
        else if (a.leader === uid) a.leader = a.members[0];
      });
    },
    kick(targetUid) {
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a || a.leader !== uid) fail('Само водачът може да изключва.');
        if (targetUid === uid || !a.members.includes(targetUid)) fail('Няма такъв член.');
        a.members = a.members.filter((x) => x !== targetUid);
        if (w.players[targetUid]) w.players[targetUid].alliance = null;
        a.chat.push({ sys: true, text: `${w.players[targetUid]?.name || 'Играч'} беше изключен.`, t: Date.now() });
        for (const st of w.stationed) if ((st.fromUid === targetUid && a.members.includes(st.toUid)) || (st.toUid === targetUid && a.members.includes(st.fromUid))) st.sendBack = true;
      });
    },
    setRelation(otherId, rel) {
      if (rel && !['ally', 'pact', 'war'].includes(rel)) fail('Невалидно отношение.');
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a || a.leader !== uid) fail('Само водачът определя дипломацията.');
        const o = w.alliances[otherId];
        if (!o || o.id === a.id) fail('Няма такъв съюз.');
        if (rel) a.diplomacy[otherId] = rel; else delete a.diplomacy[otherId];
        // съюз и пакт са взаимни; войната е едностранна
        if (rel === 'ally' || rel === 'pact') o.diplomacy[a.id] = rel;
        else if (o.diplomacy[a.id] === 'ally' || o.diplomacy[a.id] === 'pact') delete o.diplomacy[a.id];
        a.chat.push({ sys: true, text: `Дипломация с [${o.tag}]: ${{ ally: 'съюзници', pact: 'пакт за ненападение', war: 'война' }[rel] || 'неутрални'}.`, t: Date.now() });
      });
    },
    // Лично съобщение до друг владетел (пазят се последните 60 във всеки разговор).
    dm(toUid, text) {
      text = String(text || '').trim().slice(0, 400);
      toUid = String(toUid || '');
      if (!text) return;
      mut((w) => {
        if (!w.players[toUid] || toUid === uid) fail('Няма такъв владетел.');
        const k = dmKey(uid, toUid);
        w.dms ||= {};
        const list = (w.dms[k] ||= []);
        list.push({ uid, name: w.players[uid]?.name || 'Владетел', text, t: Date.now() });
        if (list.length > 60) list.splice(0, list.length - 60);
      });
    },
    dms: () => W().dms || {},
    say(text) {
      text = String(text || '').trim().slice(0, 400);
      if (!text) return;
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a) fail('Не сте в съюз.');
        a.chat.push({ uid, name: w.players[uid].name, text, t: Date.now() });
        if (a.chat.length > 200) a.chat.splice(0, a.chat.length - 200);
      });
    },
  };
}

// Действията със съюзи, които играчът може да поиска (и през сървъра).
const WORLD_OPS = ['createAlliance', 'invite', 'acceptInvite', 'declineInvite', 'leave', 'kick', 'setRelation', 'say', 'dm', 'sendBackStationed'];

const dmKey = (a, b) => [a, b].sort().join('|');

return { freshWorld, allocateHomeIn, buildView, makeWorld, WORLD_OPS, dmKey };
})();

__m['js/games/empires/server.js'] = (() => {
// Evil Empires – сървърът: всяко действие на играча минава оттук и се проверява от
// логиката на играта (engine.js). Не зависи от Supabase – получава „база“ (db):
//   getWorld() → { doc, version } | null
//   getSave(uid) → { state, version } | null
//   commit({ world: { doc, version } | null, saves: [{ uid, state | null, version }] }) → true | false (конфликт)
//   listSaves() → [uid], savePush(uid, sub), deletePush(endpoint), pushSubs(uid) → [sub]
const E = __m['js/games/empires/engine.js'];
const { RACES } = __m['js/games/empires/data.js'];
const { freshWorld, allocateHomeIn, makeWorld, buildView, WORLD_OPS } = __m['js/games/empires/worldcore.js'];

const fail = (msg) => { throw new Error(msg); };
const PUSH_KINDS = ['loss', 'win', 'epoch', 'alarm'];

// Една транзакция: зарежда света и нужните империи, изпълнява и записва (или връща null при конфликт).
async function session(db, uid, t, work) {
  const wrow = (await db.getWorld()) || { doc: freshWorld(), version: -1 };
  const doc = wrow.doc;
  const saves = new Map();
  const mine = await db.getSave(uid);
  if (mine) saves.set(uid, { ...mine, dirty: false });
  // империите, които защитават срещу мои походи, пристигнали вече – битките се решават тук
  if (mine) {
    for (const m of mine.state.marches || []) {
      const d = m.target?.uid;
      if (m.target?.type === 'player' && ['go', 'wait', 'battle'].includes(m.phase) && m.arrive <= t && d && !saves.has(d)) {
        const ds = await db.getSave(d);
        if (ds) saves.set(d, { ...ds, dirty: false });
      }
    }
  }
  let worldDirty = false;
  const store = { get: () => doc, mutate: (fn) => { worldDirty = true; return fn(doc); } };
  const envFor = (u, resolver) => { const w = makeWorld(store, u); w.resolveOffline = resolver; return { world: w }; };
  const resolver = (defUid, id, at) => {
    const d = saves.get(defUid);
    if (d?.state) {
      E.advance(d.state, at, envFor(defUid, null));
      d.dirty = true;
      return;
    }
    // изоставен град (играчът вече го няма): нападателят минава без плячка
    if (doc.players[defUid]) return;
    const inc = (doc.incoming[defUid] || []).find((x) => x.id === id);
    if (inc) {
      worldDirty = true;
      doc.results[id] = { win: true, loot: {}, trapped: 0, att: inc.groups.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [], defName: 'Изоставен град', city: '', rounds: 0 };
      doc.incoming[defUid] = doc.incoming[defUid].filter((x) => x.id !== id);
    }
  };
  const ctx = { doc, saves, store, env: envFor(uid, resolver), envFor, resolver, mine: saves.get(uid) || null, t };
  const out = await work(ctx);
  // снимките на империите в света (само ако нещо се е променило)
  for (const [u, d] of saves) {
    if (!d.state) continue;
    const snap = E.snapshot(d.state);
    const old = doc.players[u];
    const strip = (p) => JSON.stringify({ ...p, t: 0, alliance: null, joined: 0 });
    if (!old || strip(old) !== strip(snap)) makeWorld(store, u).publish(snap);
  }
  const list = [...saves].filter(([, d]) => d.dirty).map(([u, d]) => ({ uid: u, state: d.state, version: d.version }));
  const ok = await db.commit({ world: worldDirty ? { doc, version: wrow.version } : null, saves: list });
  if (!ok) return null;
  return out ?? { state: saves.get(uid)?.state || null, view: buildView(doc, uid), now: t };
}

async function retry(fn) {
  for (let i = 0; i < 6; i++) {
    const r = await fn();
    if (r) return r;
  }
  fail('Сървърът е зает – опитайте отново.');
}

const touch = (ctx) => { const me = ctx.saves.get(ctx.uidSelf); if (me) me.dirty = true; };

/** Заявка от играч. body.op: sync | new | act | world | reset | push | unpush */
async function handle(db, uid, body, now = Date.now()) {
  const op = body?.op;
  if (op === 'push') {
    if (!body.sub?.endpoint) fail('Невалиден абонамент.');
    await db.savePush(uid, body.sub);
    return { ok: true };
  }
  if (op === 'unpush') {
    if (body.endpoint) await db.deletePush(body.endpoint);
    return { ok: true };
  }
  return retry(() => session(db, uid, now, async (ctx) => {
    ctx.uidSelf = uid;
    const me = ctx.mine;
    const s = me?.state;
    if (op === 'sync') {
      if (s) { E.syncAbroad(s, now, ctx.env); E.advance(s, now, ctx.env); touch(ctx); }
      return;
    }
    if (op === 'new') {
      if (s) fail('Вече имате империя.');
      if (!Object.prototype.hasOwnProperty.call(RACES, body.race)) fail('Непозната раса.');
      const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 32) || 'Империя';
      const home = allocateHomeIn(ctx.doc, uid);
      const ns = E.newGame(body.race, name, now, undefined, { uid, home, worldSeed: home.seed });
      ctx.saves.set(uid, { state: ns, version: -1, dirty: true });
      return;
    }
    if (!s) fail('Нямате империя.');
    if (op === 'act') {
      E.syncAbroad(s, now, ctx.env);
      E.perform(s, now, ctx.env, String(body.name || ''), body.args || []);
      touch(ctx);
      return;
    }
    if (op === 'world') {
      const name = String(body.name || '');
      if (!WORLD_OPS.includes(name)) fail('Непознато действие.');
      E.advance(s, now, ctx.env);
      touch(ctx);
      makeWorld(ctx.store, uid).publish(E.snapshot(s));
      const W = ctx.env.world;
      const args = Array.isArray(body.args) ? body.args.slice(0, 4) : [];
      const emb = E.maxLv(s, 'embassy');
      if (name === 'createAlliance') W.createAlliance(args[0], args[1], emb);
      else if (name === 'acceptInvite') { if (!emb) fail('Нужно е Посолство.'); W.acceptInvite(String(args[0]), Math.max(3, 3 * emb)); }
      else if (name === 'invite') { if (emb < 1) fail('Нужно е Посолство.'); W.invite(String(args[0])); }
      else W[name](...args.map((a) => (typeof a === 'string' ? a.slice(0, 400) : a)));
      return;
    }
    if (op === 'reset') {
      makeWorld(ctx.store, uid).removePlayer(uid);
      ctx.saves.set(uid, { ...me, state: null, dirty: true });
      return { state: null, view: null, now };
    }
    fail('Непозната заявка.');
  }));
}

/**
 * На всеки няколко минути (pg_cron): придвижва всички империи във времето и изпраща
 * известия за новите събития и за нападенията, които вече се виждат от стражевата кула.
 */
async function cron(db, now = Date.now(), push = null, limit = 300) {
  const uids = (await db.listSaves()).slice(0, limit);
  let sent = 0;
  for (const uid of uids) {
    let notes = [];
    try {
      await retry(() => session(db, uid, now, async (ctx) => {
        notes = [];
        const s = ctx.mine?.state;
        if (!s) return { ok: true };
        E.syncAbroad(s, now, ctx.env);
        E.advance(s, now, ctx.env);
        ctx.saves.get(uid).dirty = true;
        // първия път не пращаме стари събития
        const since = s.pushed ?? (s.log.length ? s.log[s.log.length - 1].id : 0);
        for (const l of s.log) if (l.id > since && PUSH_KINDS.includes(l.kind)) notes.push(l.text);
        s.pushed = s.log.length ? s.log[s.log.length - 1].id : since;
        // нападения, които вече се виждат
        s.warned ||= [];
        const inc = [
          ...s.incoming.map((x) => ({ id: `n${x.id}`, city: x.city, name: x.name, arrive: x.arrive })),
          ...(ctx.doc.incoming[uid] || []).map((x) => ({ id: `p${x.id}`, city: x.toCity, name: x.attName, arrive: x.arrive })),
        ];
        for (const x of inc) {
          const c = E.cityOf(s, x.city);
          if (!s.warned.includes(x.id) && x.arrive - now <= E.warnWindow(s, c)) {
            s.warned.push(x.id);
            notes.push(`⚠ ${x.name} напада ${c.name} след ${Math.max(1, Math.round((x.arrive - now) / 60000))} мин!`);
          }
        }
        s.warned = s.warned.slice(-50);
        return { ok: true };
      }));
    } catch {
      continue;
    }
    if (notes.length && push) {
      const subs = await db.pushSubs(uid);
      const body = notes.length > 3 ? `${notes.slice(-2).join('\n')}\n…и още ${notes.length - 2}` : notes.join('\n');
      for (const sub of subs) {
        try { await push(sub, { title: 'Evil Empires', body, url: './#/play/empires' }); sent++; } catch (e) { if (e?.gone) await db.deletePush(sub.endpoint); }
      }
    }
  }
  return { ok: true, players: uids.length, sent };
}

return { handle, cron };
})();

const { handle, cron } = __m['js/games/empires/server.js'];
// Supabase Edge Function „empires“ – сървърът на Evil Empires.
// Логиката е в bundle (генерира се от js/ с tools/build-empires.py) – същата, която
// работи и в браузъра. Всяко действие се проверява тук, а записите са в базата.
//
// Заявки (POST JSON, с токена на влезлия потребител):
//   sync | new { race, name } | act { name, args } | world { name, args } | reset | push { sub } | unpush { endpoint }
//   cron (без потребител, със заглавка x-cron-secret) – от pg_cron на няколко минути.

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC') || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE') || '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';
if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails('https://hackthecode.github.io/evil-games/', VAPID_PUBLIC, VAPID_PRIVATE);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
function makeDb(sb: any) {
  const must = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r; };
  return {
    async getWorld() {
      const { data } = must(await sb.from('ee_world').select('doc, version').eq('id', 1).maybeSingle());
      return data;
    },
    async getSave(uid: string) {
      const { data } = must(await sb.from('ee_saves').select('state, version').eq('uid', uid).maybeSingle());
      return data;
    },
    // deno-lint-ignore no-explicit-any
    async commit({ world, saves }: any) {
      const { data } = must(await sb.rpc('ee_commit', { p_world: world?.doc ?? null, p_world_version: world?.version ?? 0, p_saves: saves }));
      return data === true;
    },
    async listSaves() {
      const { data } = must(await sb.from('ee_saves').select('uid').order('updated_at', { ascending: true }).limit(1000));
      // deno-lint-ignore no-explicit-any
      return (data || []).map((r: any) => r.uid);
    },
    // deno-lint-ignore no-explicit-any
    async savePush(uid: string, sub: any) {
      must(await sb.from('ee_push').upsert({ endpoint: String(sub.endpoint).slice(0, 1000), uid, sub }));
    },
    async deletePush(endpoint: string) {
      must(await sb.from('ee_push').delete().eq('endpoint', endpoint));
    },
    async pushSubs(uid: string) {
      const { data } = must(await sb.from('ee_push').select('sub').eq('uid', uid));
      // deno-lint-ignore no-explicit-any
      return (data || []).map((r: any) => r.sub);
    },
  };
}

// deno-lint-ignore no-explicit-any
async function sendPush(sub: any, payload: unknown) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600 });
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const code = (e as any)?.statusCode;
    if (code === 404 || code === 410) throw { gone: true };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json();
    const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
    const db = makeDb(svc);
    if (body?.op === 'cron') {
      if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'Забранено.' }, 403);
      return json(await cron(db, Date.now(), sendPush));
    }
    const auth = req.headers.get('Authorization') || '';
    const asUser = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: 'Не сте влезли.' }, 401);
    // блокиран акаунт (supabase/admin.sql); ако таблицата я няма – без проверка
    const { data: ban } = await svc.from('bans').select('until, reason').eq('user_id', user.id).gt('until', new Date().toISOString()).maybeSingle();
    if (ban) return json({ error: `Акаунтът е блокиран до ${new Date(ban.until).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia' })}${ban.reason ? ` (${ban.reason})` : ''}.` }, 403);
    return json(await handle(db, user.id, body));
  } catch (e) {
    return json({ error: (e as Error).message || String(e) });
  }
});