// Evil Empires – data: races, resources, epochs, buildings, units, technologies, hero,
// world (oases, computer empires), missions. All balance numbers live here.
import { tk } from '../../i18n/tk.js';

export const RES = ['gold', 'wood', 'stone', 'food', 'mana', 'souls'];
export const RES_NAMES = { gold: tk('Gold'), wood: tk('Wood'), stone: tk('Stone'), food: tk('Food'), mana: tk('Mana'), souls: tk('Souls') };
export const resName = (race, r) => (r === 'food' && race === 'undead' ? tk('Bones') : RES_NAMES[r]);

export const RACES = {
  humans: {
    name: tk('Humans'),
    lore: tk('The surviving kingdoms after the Fall – stubborn builders and traders.'),
    perks: [tk('+10% to all resources'), tk('Construction is 10% faster')],
    weak: tk('Average units'),
    color: '#e8b04a',
  },
  undead: {
    name: tk('Undead'),
    lore: tk('A necromancer\'s army, raised from the graves of the old empire.'),
    perks: [tk('The army does not eat'), tk('Units are 20% cheaper'), tk('After a victory some of the fallen rise as skeletons')],
    weak: tk('Slow growth (−15% population)'),
    color: '#5fe39a',
  },
  orcs: {
    name: tk('Orcs'),
    lore: tk('Clans from the ashlands who live off plunder.'),
    perks: [tk('+20% attack for infantry and spearmen'), tk('+25% loot from raids'), tk('Enemy hideouts protect 20% less')],
    weak: tk('Research is 20% slower'),
    color: '#ff5a3c',
  },
  vesheri: {
    name: tk('Witchers'),
    lore: tk('A people of mages and monster hunters, trained in secret towers.'),
    perks: [tk('+20% attack for archers'), tk('+25% mana'), tk('Their scouts cannot be detected')],
    weak: tk('Units are 20% more expensive'),
    color: '#b48cff',
  },
};

export const EPOCHS = [
  { n: 1, name: tk('Ash Age'), cap: 5 },
  { n: 2, name: tk('Bronze Age'), cap: 10 },
  { n: 3, name: tk('Iron Age'), cap: 15 },
  { n: 4, name: tk('Age of Kingdoms'), cap: 20 },
  { n: 5, name: tk('Age of Darkness'), cap: 25 },
];
// The last epoch reachable in this version of the game.
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

// Buildings. cost/time are for level 1 and grow with every level (COST_GROWTH, TIME_GROWTH).
// prod: production per hour at level 1. need: requirement for another building.
export const COST_GROWTH = 1.55;
export const TIME_GROWTH = 1.75;

export const BUILDINGS = {
  hall: {
    name: tk('Citadel'), epoch: 1,
    desc: tk('The heart of the city. Its level limits the other buildings, speeds up construction and allows new cities.'),
    cost: { wood: 150, stone: 120, gold: 60 }, time: 90,
  },
  farm: {
    name: tk('Farm'), undeadName: tk('Graveyard'), epoch: 1,
    desc: tk('Produces food for the population and the army.'), undeadDesc: tk('Digs up bones – the main resource of the undead.'),
    cost: { wood: 60, stone: 30 }, time: 40, prod: { food: 70 },
  },
  lumber: { name: tk('Sawmill'), epoch: 1, desc: tk('Cuts and processes wood.'), cost: { wood: 30, stone: 40, food: 20 }, time: 40, prod: { wood: 80 } },
  quarry: { name: tk('Quarry'), epoch: 1, desc: tk('Mines stone for walls and buildings.'), cost: { wood: 60, food: 20 }, time: 45, prod: { stone: 65 } },
  mine: { name: tk('Gold Mine'), epoch: 1, desc: tk('Mines gold.'), cost: { wood: 80, stone: 60 }, time: 60, prod: { gold: 45 } },
  houses: { name: tk('Houses'), epoch: 1, desc: tk('Increase the population (room for troops) and bring taxes.'), cost: { wood: 70, stone: 40, food: 30 }, time: 50, prod: { gold: 12 } },
  warehouse: { name: tk('Warehouse'), epoch: 1, desc: tk('Increases how many resources you can store.'), cost: { wood: 80, stone: 70 }, time: 55 },
  barracks: { name: tk('Barracks'), epoch: 1, desc: tk('Trains troops. Each level speeds up training by 4%.'), cost: { wood: 120, stone: 80, gold: 40 }, time: 70 },
  academy: { name: tk('Academy'), epoch: 1, desc: tk('Researches technologies. Each level speeds up research by 5%.'), cost: { wood: 100, stone: 120, gold: 80 }, time: 80 },
  heroHall: {
    name: tk('Hall of Heroes'), epoch: 1,
    desc: tk('Home of the hero: revives them and allows conquering oases (levels 3, 6 and 10 – one oasis each).'),
    cost: { wood: 160, stone: 140, gold: 100 }, time: 90,
  },
  wall: {
    name: tk('Palisade'), name2: tk('City Wall'), epoch: 1,
    desc: tk('Defenders get +6% defense and +3% health per level.'),
    cost: { wood: 120, stone: 90 }, time: 60,
  },
  traps: {
    name: tk('Traps'), epoch: 1, need: { wall: 1 },
    desc: tk('Catch some of the attackers before they reach the walls.'),
    cost: { wood: 90, stone: 40, gold: 30 }, time: 55,
  },
  cranny: {
    name: tk('Hideout'), epoch: 1,
    desc: tk('Protects part of every resource from plunder.'),
    cost: { wood: 50, stone: 70 }, time: 35,
  },
  embassy: {
    name: tk('Embassy'), epoch: 1,
    desc: tk('Alliance membership (level 1) and founding an alliance (level 3). Each level gives 3 alliance slots.'),
    cost: { wood: 150, stone: 130, gold: 100 }, time: 90,
  },
  tower: {
    name: tk('Watchtower'), epoch: 1, need: { wall: 1 },
    desc: tk('Sees approaching attacks from farther away and reveals their makeup. The tower\'s archers give +2% defense per level.'),
    cost: { wood: 100, stone: 120, gold: 40 }, time: 70,
  },
  temple: {
    name: tk('Temple'), epoch: 3,
    desc: tk('Gathers souls and speeds up the hero\'s recovery (+3% per hour per level if the hero is in this city).'),
    cost: { wood: 800, stone: 1500, gold: 1200 }, time: 900, prod: { souls: 0.6 },
  },
  stable: {
    name: tk('Stables'), epoch: 3,
    desc: tk('Trains heavy cavalry. Each level speeds up cavalry training by 5%.'),
    cost: { wood: 1400, stone: 1100, gold: 900 }, time: 900,
  },
  altar: { name: tk('Altar'), epoch: 2, tech: 'mysticism', desc: tk('Gathers mana from the rifts of the Fall.'), cost: { stone: 400, gold: 300 }, time: 300, prod: { mana: 30 } },
  smithy: { name: tk('Smithy'), epoch: 2, desc: tk('Each level gives +3% attack and defense to the city\'s troops.'), cost: { wood: 350, stone: 300, gold: 200 }, time: 300 },
  unique: { name: '', epoch: 2, desc: '', cost: { wood: 500, stone: 500, gold: 400 }, time: 420 },
};

export const UNIQUE = {
  humans: { name: tk('Merchant Guild'), desc: tk('Brings gold and trains paladins.'), prod: { gold: 60 } },
  undead: { name: tk('Necropolis'), desc: tk('Digs up more bones and raises ghouls.'), prod: { food: 70 } },
  orcs: { name: tk('Fighting Pit'), desc: tk('Trains berserkers. Each level speeds up troop training by 5%.') },
  vesheri: { name: tk('Witchers\' Tower'), desc: tk('Gathers mana and trains witchers.'), prod: { mana: 40 } },
};

// Building layout in the city: (i, j) on a 5×5 isometric grid (tall buildings at the back).
// The palisade and traps have no plot – they are drawn along the city edge.
export const GRID = 5;
export const PLOTS = {
  hall: [0, 0], unique: [1, 0], academy: [0, 1], temple: [2, 0], barracks: [1, 1], smithy: [0, 2],
  mine: [3, 0], heroHall: [2, 1], houses: [1, 2], lumber: [0, 3], quarry: [4, 0], warehouse: [3, 1],
  embassy: [2, 2], farm: [1, 3], stable: [0, 4], altar: [4, 1], cranny: [2, 3], tower: [1, 4],
};
export const DECOR = [[3, 2, 'well'], [4, 2, 'trees'], [3, 3, 'campfire'], [2, 4, 'trees'], [4, 3, 'trees'], [3, 4, 'trees'], [4, 4, 'trees']];
export const OFF_PLOT = ['wall', 'traps'];

// Units. cls: inf, spear, ranged, cav; scout and settler do not fight.
// speed: tiles per hour (multiplied by WORLD_SPEED).
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
  humans: { warrior: tk('Militiaman'), slinger: tk('Slinger'), spear: tk('Spearman'), archer: tk('Archer'), rider: tk('Horseman'), elite: tk('Paladin'), pike: tk('Pikeman'), crossbow: tk('Crossbowman'), knight: tk('Knight'), catapult: tk('Catapult'), noble: tk('Nobleman'), scout: tk('Scout'), settler: tk('Settlers') },
  undead: { warrior: tk('Skeleton'), slinger: tk('Bone Slinger'), spear: tk('Grave Spearman'), archer: tk('Ghost Archer'), rider: tk('Dead Rider'), elite: tk('Ghoul'), pike: tk('Bone Pikeman'), crossbow: tk('Cursed Archer'), knight: tk('Death Knight'), catapult: tk('Bonecrusher'), noble: tk('Lich'), scout: tk('Wraith'), settler: tk('Gravediggers') },
  orcs: { warrior: tk('Brute'), slinger: tk('Thrower'), spear: tk('Spearman'), archer: tk('Hunter'), rider: tk('Wolf Rider'), elite: tk('Berserker'), pike: tk('Spiker'), crossbow: tk('Javelineer'), knight: tk('Boar Rider'), catapult: tk('Battering Ram'), noble: tk('Warlord'), scout: tk('Tracker'), settler: tk('Settlers') },
  vesheri: { warrior: tk('Novice'), slinger: tk('Slinger'), spear: tk('Guard'), archer: tk('Crossbowman'), rider: tk('Night Rider'), elite: tk('Witcher'), pike: tk('Warden'), crossbow: tk('Demon Hunter'), knight: tk('Silver Knight'), catapult: tk('Trebuchet'), noble: tk('Magister'), scout: tk('Shadow'), settler: tk('Settlers') },
};
export const unitCls = (race, u) => (u === 'elite' && race === 'vesheri' ? 'ranged' : UNITS[u].cls);

export const CLS_NAMES = { inf: tk('infantry'), spear: tk('spears'), ranged: tk('archers'), cav: tk('cavalry'), siege: tk('siege'), noble: tk('conquest'), scout: tk('scouting'), settler: tk('settling'), hero: tk('hero') };
export const COUNTER = {
  spear: { cav: 2 },
  cav: { ranged: 2, inf: 1.2 },
  ranged: { spear: 1.5, inf: 1.2 },
  inf: { ranged: 1.2 },
};

// World speed: how many times faster than the "classic" browser strategies.
export const WORLD_SPEED = 3;

export const TECHS = {
  agri: { name: tk('Agriculture'), epoch: 1, academy: 1, desc: tk('+15% food'), cost: { gold: 120, wood: 100 }, time: 120 },
  carp: { name: tk('Carpentry'), epoch: 1, academy: 1, desc: tk('+15% wood'), cost: { gold: 120, stone: 100 }, time: 120 },
  scouting: { name: tk('Scouting'), epoch: 1, academy: 1, desc: tk('Unlocks scouts'), cost: { gold: 120, food: 120 }, time: 150 },
  mason: { name: tk('Masonry'), epoch: 1, academy: 2, desc: tk('+15% stone'), cost: { gold: 150, wood: 150 }, time: 180 },
  slings: { name: tk('Slings'), epoch: 1, academy: 1, desc: tk('Unlocks slingers'), cost: { gold: 100, wood: 120 }, time: 150 },
  tactics: { name: tk('Formation'), epoch: 1, academy: 2, req: ['slings'], desc: tk('+10% infantry attack'), cost: { gold: 200, food: 200 }, time: 240 },
  bronze: { name: tk('Bronze Casting'), epoch: 1, academy: 3, req: ['agri', 'mason'], desc: tk('Required for the Bronze Age'), cost: { gold: 600, stone: 500, wood: 400 }, time: 900 },
  spears: { name: tk('Spears'), epoch: 2, academy: 4, desc: tk('Unlocks spearmen (strong against cavalry)'), cost: { gold: 500, wood: 600 }, time: 900 },
  archery: { name: tk('Bows'), epoch: 2, academy: 4, req: ['slings'], desc: tk('Unlocks bow archers'), cost: { gold: 600, wood: 700 }, time: 1100 },
  riding: { name: tk('Horse Riding'), epoch: 2, academy: 5, desc: tk('Unlocks cavalry (requires Barracks level 3)'), cost: { gold: 900, food: 900 }, time: 1500 },
  mysticism: { name: tk('Mysticism'), epoch: 2, academy: 5, desc: tk('Unlocks the Altar and mana'), cost: { gold: 1000, stone: 800 }, time: 1800 },
  smith: { name: tk('Smithing'), epoch: 2, academy: 6, req: ['spears'], desc: tk('+10% army attack'), cost: { gold: 1400, stone: 1200 }, time: 2700 },
  armor: { name: tk('Armor'), epoch: 2, academy: 6, req: ['smith'], desc: tk('+10% army defense'), cost: { gold: 1600, stone: 1400 }, time: 3200 },
  trade: { name: tk('Trade'), epoch: 2, academy: 5, desc: tk('+15% gold'), cost: { gold: 800, wood: 800 }, time: 1600 },
  engineering: { name: tk('Engineering'), epoch: 2, academy: 6, req: ['mason'], desc: tk('Unlocks catapults – they destroy walls and buildings (requires Barracks level 5)'), cost: { gold: 1800, wood: 2200, stone: 1800 }, time: 3600 },
  nobility: { name: tk('Nobility'), epoch: 2, academy: 8, req: ['trade'], desc: tk('Unlocks noblemen – they lower loyalty and conquer cities (Citadel 10)'), cost: { gold: 6000, food: 4000, souls: 30 }, time: 7200 },
  logistics: { name: tk('Logistics'), epoch: 2, academy: 7, req: ['trade'], desc: tk('A second construction queue'), cost: { gold: 2500, wood: 2000, stone: 2000 }, time: 4800 },
  iron: { name: tk('Iron'), epoch: 2, academy: 10, req: ['smith', 'armor'], desc: tk('Required for the Iron Age'), cost: { gold: 8000, stone: 8000, mana: 1500 }, time: 14400 },
  crop: { name: tk('Crop Rotation'), epoch: 3, academy: 10, desc: tk('+15% food'), cost: { gold: 3000, wood: 3000 }, time: 5400 },
  pikes: { name: tk('Pikes'), epoch: 3, academy: 10, req: ['spears'], desc: tk('Unlocks pikemen'), cost: { gold: 3500, wood: 4000 }, time: 6000 },
  fortify: { name: tk('Fortifications'), epoch: 3, academy: 11, desc: tk('+50% to the wall bonus'), cost: { gold: 4000, stone: 6000 }, time: 7200 },
  crossbows: { name: tk('Crossbows'), epoch: 3, academy: 11, req: ['archery'], desc: tk('Unlocks crossbowmen'), cost: { gold: 4500, wood: 5000 }, time: 7800 },
  chivalry: { name: tk('Chivalry'), epoch: 3, academy: 12, req: ['riding'], desc: tk('Unlocks heavy cavalry (requires Stables)'), cost: { gold: 6000, food: 6000 }, time: 9000 },
  steel: { name: tk('Steel'), epoch: 3, academy: 12, req: ['iron'], desc: tk('+10% army attack'), cost: { gold: 7000, stone: 7000 }, time: 10800 },
  banking: { name: tk('Banking'), epoch: 3, academy: 12, req: ['trade'], desc: tk('+15% gold'), cost: { gold: 6000, wood: 5000 }, time: 9000 },
  plate: { name: tk('Plate Armor'), epoch: 3, academy: 13, req: ['steel'], desc: tk('+10% army defense'), cost: { gold: 8000, stone: 9000 }, time: 12600 },
  kingdoms: { name: tk('Feudal Law'), epoch: 3, academy: 15, req: ['steel', 'plate'], desc: tk('Required for the Age of Kingdoms (coming soon)'), cost: { gold: 20000, stone: 20000, mana: 5000 }, time: 28800 },
};
export const TECH_PROD = { agri: 'food', carp: 'wood', mason: 'stone', trade: 'gold', crop: 'food', banking: 'gold' };

// ---------- tactical battles ----------
export const TACTIC = { cols: 9, rows: 7, maxTurns: 12, window: 3600 };
export const TERRAIN = {
  plain: { name: tk('Plain'), cost: 1, def: 1 },
  forest: { name: tk('Forest'), cost: 2, def: 1.25, vsRanged: true },
  hill: { name: tk('Hill'), cost: 2, def: 1.2, range: 1 },
  ruins: { name: tk('Ruins'), cost: 1, def: 1.35 },
  water: { name: tk('River'), cost: 99, def: 1 },
};
export const MOVES = { inf: 2, spear: 2, ranged: 2, cav: 4, hero: 3, siege: 1, noble: 2 };
// Default battle formation: where each class stands in a tactical battle.
export const FORMATION = { inf: 'front', spear: 'front', hero: 'front', ranged: 'back', cav: 'flank', siege: 'back', noble: 'back' };
export const LOYALTY_REGEN = 2; // % per hour

// ---------- hero ----------
export const HERO = {
  pointsPerLevel: 4, startPoints: 5,
  regen: 10, // % health per hour
  speed: 9, // tiles per hour
  xpFor: (lvl) => Math.round(60 * lvl ** 1.7),
};
export const HERO_POINTS = {
  str: { name: tk('Strength'), desc: tk('+4 hero attack in battle') },
  off: { name: tk('Offense'), desc: tk('+0.2% attack for the army the hero travels with') },
  def: { name: tk('Defense'), desc: tk('+0.2% defense for the army in the hero\'s city') },
  res: { name: tk('Steward'), desc: tk('+1% production in the hero\'s city (up to 25%)') },
};
export const SLOTS = { weapon: tk('Weapon'), armor: tk('Armor'), helmet: tk('Helmet'), horse: tk('Horse'), amulet: tk('Amulet') };
export const TIERS = [
  { name: tk('common'), color: '#b9b4a8' },
  { name: tk('rare'), color: '#6aa8ff' },
  { name: tk('epic'), color: '#b48cff' },
  { name: tk('legendary'), color: '#f2c14e' },
];
// Item effect by slot and level (1–4).
export const ITEM_FX = {
  weapon: { val: [6, 12, 20, 32], text: (v) => tk('+{0} hero attack', v) },
  armor: { val: [30, 60, 110, 180], text: (v) => tk('+{0} hero health, −{1}% wounds', v, Math.round(v / 7)) },
  helmet: { val: [10, 20, 35, 50], text: (v) => tk('+{0}% experience', v) },
  horse: { val: [30, 60, 90, 130], text: (v) => tk('+{0}% hero speed', v) },
  amulet: { val: [5, 10, 15, 25], text: (v) => tk('+{0}% recovery per hour', v) },
};
export const ITEM_NAMES = {
  weapon: [tk('Rusty Sword'), tk('Bronze Sword'), tk('Warlord\'s Sword'), tk('Blade of the Fall')],
  armor: [tk('Leather Armor'), tk('Chain Mail'), tk('Bronze Armor'), tk('Dragon Scales')],
  helmet: [tk('Leather Cap'), tk('Bronze Helmet'), tk('Crested Helmet'), tk('Crown of the Ancestors')],
  horse: [tk('Old Nag'), tk('Steppe Horse'), tk('War Stallion'), tk('Night Steed')],
  amulet: [tk('Bone Amulet'), tk('Silver Talisman'), tk('Witcher\'s Eye'), tk('Heart of the Fall')],
};
export const ADVENTURE = { every: 5 * 3600, max: 4, life: 24 * 3600 };

// ---------- world ----------
export const WORLD_R = 20; // coordinates from −20 to 20
export const OASIS_RES = ['wood', 'stone', 'food', 'gold'];
export const OASIS_BONUS = 0.25;
export const OASIS_RANGE = 3;
export const OASIS_RESPAWN = 8 * 3600;
export const CAMP_RESPAWN = 1200;
export const CAMP_SLOTS = [1, 2, 2, 3, 4, 5];
export const CAMP_START = [1, 1, 2, 2, 3, 4];
export const CAMP_NAMES = [tk('Marauders'), tk('Ash Bandits'), tk('Wolf Pack'), tk('Lair'), tk('Bandit Fort'), tk('Warlord\'s Camp')];

export const PROTECTION = 5 * 24 * 3600; // beginner protection (seconds at speed 1)
export const NIGHT = { from: 0, to: 7, bonus: 1.5 }; // night bonus to defense
export const NPC_ATTACK_EVERY = [10 * 3600, 22 * 3600];
export const PACT = { time: 3 * 24 * 3600 };

export const NPC_CLANS = [
  { id: 'c0', name: tk('The Ashen'), tag: tk('ASH'), color: '#a8553a' },
  { id: 'c1', name: tk('The Night Wolves'), tag: tk('WLF'), color: '#5a6a9a' },
  { id: 'c2', name: tk('The Blood Crescent'), tag: tk('BLD'), color: '#9a2a3a' },
];
export const NPC_NAMES = [
  tk('Vorg the Ashen'), tk('Sisters of the Mist'), tk('Khan Zlorud'), tk('Black Boyan'), tk('Velmira the Dark'), tk('Rotten Darg'), tk('The Wolf Khan'),
  tk('Silent Stoyan'), tk('Goran the Bonecrusher'), tk('Morana the Witch'), tk('Iron Ratko'), tk('The Ash Viper'), tk('Grey Dragosh'), tk('The Nameless'),
];

// ---------- missions ----------
const lvl = (b) => (s) => Math.max(0, ...s.cities.map((c) => c.b[b] || 0));
export const STORY = [
  { id: 's1', title: tk('Hearth'), text: tk('Build a farm'), undeadText: tk('Build a graveyard'), goal: 1, get: lvl('farm'), reward: { wood: 150, stone: 100 } },
  { id: 's2', title: tk('Wood for the Winter'), text: tk('Build a sawmill'), goal: 1, get: lvl('lumber'), reward: { food: 150, gold: 50 } },
  { id: 's3', title: tk('Stone by Stone'), text: tk('Build a quarry'), goal: 1, get: lvl('quarry'), reward: { wood: 200 } },
  { id: 'h1', title: tk('The Hero\'s Path'), text: tk('Send the hero on an adventure'), goal: 1, get: (s) => s.stats.adventures || 0, reward: { gold: 150, food: 150 } },
  { id: 's4', title: tk('A Roof Overhead'), text: tk('Build houses'), goal: 1, get: lvl('houses'), reward: { gold: 120 } },
  { id: 's5', title: tk('The Citadel Grows'), text: tk('Citadel level 2'), goal: 2, get: lvl('hall'), reward: { wood: 250, stone: 250 } },
  { id: 's6', title: tk('Under the Banners'), text: tk('Build barracks'), goal: 1, get: lvl('barracks'), reward: { food: 300 } },
  { id: 's7', title: tk('The First Warriors'), text: tk('Train 5 units'), goal: 5, get: (s) => s.stats.trained, reward: { gold: 200, food: 200 } },
  { id: 's8', title: tk('Blood on the Ashes'), text: tk('Defeat a level 1 camp'), goal: 1, get: (s) => (s.stats.bestCamp >= 1 ? 1 : 0), reward: { gold: 250, wood: 250, souls: 2 } },
  { id: 'd1', title: tk('Behind Stake and Stone'), text: tk('Build a palisade'), goal: 1, get: lvl('wall'), reward: { wood: 250, stone: 150 } },
  { id: 's9', title: tk('Knowledge Is Power'), text: tk('Build an academy'), goal: 1, get: lvl('academy'), reward: { gold: 200 } },
  { id: 's10', title: tk('The First Science'), text: tk('Complete one research'), goal: 1, get: (s) => Object.keys(s.techs).length, reward: { wood: 300, stone: 300 } },
  { id: 'd2', title: tk('Hidden Treasure'), text: tk('Build a hideout'), goal: 1, get: lvl('cranny'), reward: { gold: 200 } },
  { id: 's11', title: tk('Supplies'), text: tk('Warehouse level 2'), goal: 2, get: lvl('warehouse'), reward: { food: 400 } },
  { id: 'h2', title: tk('A Home for the Hero'), text: tk('Build the Hall of Heroes'), goal: 1, get: lvl('heroHall'), reward: { gold: 300, wood: 300 } },
  { id: 's12', title: tk('Stone Walls'), text: tk('Citadel level 3'), goal: 3, get: lvl('hall'), reward: { gold: 400, stone: 400 } },
  { id: 'd3', title: tk('Eyes in the Dark'), text: tk('Scout a foreign city'), goal: 1, get: (s) => s.stats.scouted || 0, reward: { gold: 300, food: 300 } },
  { id: 's13', title: tk('Economy'), text: tk('Farm, sawmill, quarry and mine at level 3'), goal: 4, get: (s) => ['farm', 'lumber', 'quarry', 'mine'].filter((b) => lvl(b)(s) >= 3).length, reward: { gold: 500, food: 500 } },
  { id: 's14', title: tk('The Voice of War'), text: tk('Defeat a level 3 camp'), goal: 1, get: (s) => (s.stats.bestCamp >= 3 ? 1 : 0), reward: { gold: 500, wood: 500, souls: 5 } },
  { id: 'd4', title: tk('We Held!'), text: tk('Repel an attack'), goal: 1, get: (s) => s.stats.defWins || 0, reward: { gold: 600, stone: 600, souls: 5 } },
  { id: 's15', title: tk('The Secret of Bronze'), text: tk('Research Bronze Casting'), goal: 1, get: (s) => (s.techs.bronze ? 1 : 0), reward: { stone: 800, wood: 800 } },
  { id: 'h3', title: tk('The Spring'), text: tk('Conquer an oasis'), goal: 1, get: (s) => s.oases.length, reward: { gold: 800, souls: 8 } },
  { id: 's16', title: tk('Stronghold'), text: tk('Citadel level 5'), goal: 5, get: lvl('hall'), reward: { gold: 800 } },
  { id: 's17', title: tk('Warlord of the Ashlands'), text: tk('Defeat a level 5 camp – the barbarian warlord'), goal: 1, get: (s) => (s.stats.bestCamp >= 5 ? 1 : 0), reward: { gold: 1000, food: 1000, souls: 10 }, key: true },
  { id: 's18', title: tk('A New Age'), text: tk('Enter the Bronze Age'), goal: 2, get: (s) => s.epoch, reward: { gold: 1500, wood: 1500, stone: 1500 } },
  { id: 'c1', title: tk('New Land'), text: tk('Found a second city'), goal: 2, get: (s) => s.cities.length, reward: { gold: 2000, wood: 2000, stone: 2000, food: 2000 } },
  { id: 's19', title: tk('The Rifts'), text: tk('Build an altar'), goal: 1, get: lvl('altar'), reward: { mana: 200 } },
  { id: 's20', title: tk('The Legacy'), text: tk('Build your race\'s unique building'), goal: 1, get: lvl('unique'), reward: { gold: 1500, souls: 10 } },
  { id: 's21', title: tk('Cavalry'), text: tk('Research Horse Riding'), goal: 1, get: (s) => (s.techs.riding ? 1 : 0), reward: { food: 2000 } },
  { id: 's22', title: tk('Ruler'), text: tk('Citadel level 7'), goal: 7, get: lvl('hall'), reward: { gold: 2500, stone: 2500 } },
  { id: 's23', title: tk('Terror of the Steppe'), text: tk('Defeat a level 8 camp'), goal: 1, get: (s) => (s.stats.bestCamp >= 8 ? 1 : 0), reward: { gold: 3000, souls: 25 } },
  { id: 's24', title: tk('Empire'), text: tk('Citadel level 10'), goal: 10, get: lvl('hall'), reward: { gold: 6000, wood: 6000, stone: 6000, souls: 50 } },
  { id: 'k3', title: tk('Lord of the Steppe'), text: tk('Defeat a level 10 camp'), goal: 1, get: (s) => (s.stats.bestCamp >= 10 ? 1 : 0), reward: { gold: 5000, food: 5000, souls: 40 }, key: true },
  { id: 's25', title: tk('Iron Will'), text: tk('Enter the Iron Age'), goal: 3, get: (s) => s.epoch, reward: { gold: 8000, wood: 8000, stone: 8000 } },
  { id: 's26', title: tk('Horseshoes and Spurs'), text: tk('Build stables'), goal: 1, get: lvl('stable'), reward: { food: 6000, gold: 3000 } },
  { id: 's27', title: tk('Temple of the Ancestors'), text: tk('Build a temple'), goal: 1, get: lvl('temple'), reward: { souls: 60 } },
  { id: 's28', title: tk('Steel Ranks'), text: tk('Research Steel'), goal: 1, get: (s) => (s.techs.steel ? 1 : 0), reward: { gold: 9000, stone: 9000 } },
  { id: 's29', title: tk('Fortress'), text: tk('Citadel level 12'), goal: 12, get: lvl('hall'), reward: { gold: 12000, wood: 12000 } },
  { id: 's30', title: tk('The Last Warlord'), text: tk('Defeat a level 15 camp'), goal: 1, get: (s) => (s.stats.bestCamp >= 15 ? 1 : 0), reward: { gold: 15000, souls: 120 } },
  { id: 's31', title: tk('Iron Empire'), text: tk('Citadel level 15'), goal: 15, get: lvl('hall'), reward: { gold: 25000, wood: 25000, stone: 25000, souls: 200 } },
];

export const DAILY = [
  { id: 'd_build', text: tk('Start 3 constructions'), key: 'built', goal: 3, reward: { wood: 1, stone: 1 } },
  { id: 'd_train', text: tk('Train 10 units'), key: 'trained', goal: 10, reward: { food: 1, gold: 0.5 } },
  { id: 'd_raid', text: tk('Win 2 raids'), key: 'raids', goal: 2, reward: { gold: 1, food: 0.5 }, souls: 3 },
  { id: 'd_research', text: tk('Complete a research'), key: 'researched', goal: 1, reward: { gold: 1, wood: 0.5 } },
  { id: 'd_build5', text: tk('Start 5 constructions'), key: 'built', goal: 5, reward: { gold: 1, food: 1 } },
  { id: 'd_raid1', text: tk('Win a raid'), key: 'raids', goal: 1, reward: { food: 1, wood: 1 } },
  { id: 'd_adv', text: tk('Send the hero on 2 adventures'), key: 'adventures', goal: 2, reward: { gold: 1, stone: 1 } },
  { id: 'd_scout', text: tk('Scout a target'), key: 'scouted', goal: 1, reward: { gold: 0.5, food: 1 } },
  { id: 'd_tactic', text: tk('Win a tactical battle'), key: 'tactics', goal: 1, reward: { gold: 1, wood: 1 }, souls: 2 },
];
