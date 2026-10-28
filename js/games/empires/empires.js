// Evil Empires – интерфейс. Състоянието се пази локално за всеки потребител; общият
// свят (други играчи, съюзи, оазиси) е в world.js, логиката – в engine.js.
import { h, modal, toast } from '../../ui.js';
import { sound, confirmDialog, loadPrefs, savePrefs, isMuted, setMuted } from '../common.js';
import * as E from './engine.js';
import {
  RES, RACES, EPOCHS, BUILDINGS, PLOTS, DECOR, OFF_PLOT, UNITS, UNIT_ORDER, FIGHTERS, TECHS, CLS_NAMES, resName, unitCls,
  HERO_POINTS, SLOTS, TIERS, NPC_CLANS, OASIS_BONUS, NIGHT, MAX_EPOCH, FORMATION,
} from './data.js';
import {
  PALETTE, tile, scaffold, buildingSvg, buildingPicture, decorSvg, emblem, resIcon, RES_ICON, unitIcon, sceneSvg, campSvg,
  mapSvg, heroPortrait, REL_COLORS, buildingLights,
} from './art.js';
import { fight, power } from './battle.js';
import { tileAt, dist, tileKey, inWorld } from './worldgen.js';
import { worldApi, viewApi, allocateHome, setLease, clearLease, leaseFresh, WORLD_KEY } from './world.js';
import { openTactical } from './battleui.js';
import { createChat } from './chatui.js';
import { cityAudio, audioPrefs, setAudioPref, preloadBattleSounds, battleMusic } from './audio.js';
import { store } from '../../store/index.js';
import { CONFIG } from '../../../config.js';

const SAVE_KEY = (uid) => `ee.save.${uid}`;
const DEV = ['localhost', '127.0.0.1'].includes(location.hostname);
const TABS = [['city', 'Град'], ['army', 'Армия'], ['map', 'Карта'], ['marches', 'Походи'], ['hero', 'Герой'], ['science', 'Наука'], ['alliance', 'Съюз'], ['missions', 'Мисии']];
const REL_NAMES = { self: 'вие', alliance: 'вашият съюз', ally: 'съюзници', pact: 'пакт за ненападение', war: 'война', neutral: 'неутрален' };

// ---------- форматиране ----------
export function fmtN(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' млн';
  if (n >= 1e5) return Math.round(n / 1000) + 'k';
  return n.toLocaleString('bg-BG');
}

export function fmtLeft(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(t / 86400), hh = Math.floor((t % 86400) / 3600), mm = Math.floor((t % 3600) / 60), ss = t % 60;
  if (d) return `${d}д ${hh}ч`;
  if (hh) return `${hh}ч ${String(mm).padStart(2, '0')}м`;
  if (mm) return `${mm}м ${String(ss).padStart(2, '0')}с`;
  return `${ss}с`;
}
const clock = (t) => new Date(t).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });

function loadSave(uid) {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY(uid)));
    return s && (s.v === 1 || s.v === 2) ? s : null;
  } catch {
    return null;
  }
}
const writeSave = (uid, s) => { try { localStorage.setItem(SAVE_KEY(uid), JSON.stringify(s)); } catch {} };

export function mount(root, ctx) {
  const uid = ctx.user.id;
  // онлайн (Supabase): всяко действие се проверява от сървъра; локално – всичко е в браузъра
  const ONLINE = store.kind === 'supabase';
  const FN = CONFIG.supabase?.empiresFunction || 'empires';
  const W = ONLINE ? viewApi(uid, null) : worldApi(uid);
  const env = { world: W };
  let syncTimer = null, busy = false;
  const seenInc = new Set();
  async function call(body) {
    const { data, error } = await store.client().functions.invoke(FN, { body });
    if (error) {
      let msg = error.message;
      try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch {}
      throw new Error(msg === 'Failed to send a request to the Edge Function' ? 'Няма връзка със сървъра на играта.' : msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  function applyServer(res) {
    if (res?.view) W.setView(res.view);
    s = res?.state || null;
  }
  let s = null;
  let destroyed = false;
  let timer = null, leaseTimer = null;
  let lastLog = 0, lastPublish = 0, lastIncoming = '';
  const ui = loadPrefs('empires.ui', { tab: 'city' });
  const mapView = { center: null, sel: null };

  // Нападение към играч, чийто раздел не е отворен: решаваме битката от негово име (само локално).
  if (!ONLINE) W.resolveOffline = (defUid, id, t) => {
    if (defUid === uid || leaseFresh(defUid)) return;
    let d = loadSave(defUid);
    if (!d) {
      const inc = W.incomingFor(defUid).find((x) => x.id === id);
      if (inc) {
        W.putResult(id, { win: true, loot: {}, trapped: 0, att: inc.groups.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [], defName: 'Изоставен град', city: '', rounds: 0 });
        W.removeIncoming(defUid, id);
      }
      return;
    }
    if (d.v !== 2) d = E.migrate(d, { uid: defUid, home: allocateHome(defUid), worldSeed: W.seed });
    E.advance(d, t, { world: worldApi(defUid) });
    writeSave(defUid, d);
    W.refresh();
  };

  const save = () => {
    if (!s || ONLINE) return;
    writeSave(uid, s);
    if (Date.now() - lastPublish > 4000) {
      lastPublish = Date.now();
      W.publish(E.snapshot(s));
    }
  };
  const onHide = () => { markSeen(); if (s && !ONLINE) { E.advance(s, Date.now(), env); writeSave(uid, s); W.publish(E.snapshot(s)); } };
  window.addEventListener('pagehide', onHide);
  const onStorage = (e) => {
    if (!s || destroyed || ONLINE || e.key !== WORLD_KEY) return;
    W.refresh();
    if (ui.tab === 'alliance') refreshChat();
    chat.refresh();
  };
  window.addEventListener('storage', onStorage);

  const wrap = h('div', { class: 'ee' });
  const chat = createChat({ uid, user: ctx.user, W, doWorld: (name, args) => doWorld(name, args) });
  root.append(wrap);
  const cur = () => E.cityOf(s, ui.city);
  const now = () => Date.now();

  // ---------- старт ----------
  const SEEN = `ee.seen.${uid}`;
  function markSeen() {
    if (!s) return;
    try { localStorage.setItem(SEEN, JSON.stringify({ id: s.log.length ? s.log[s.log.length - 1].id : 0, t: now() })); } catch {}
  }
  function catchUp() {
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(SEEN)) || {}; } catch {}
    const events = s.log.filter((l) => l.id > (seen.id || 0));
    const away = seen.t ? now() - seen.t : 0;
    markSeen();
    if (!events.length || away < 120000) return;
    modal({
      title: 'Докато ви нямаше',
      body: h('div', { class: 'ee-away' },
        h('p', { class: 'muted' }, `Минаха ${fmtLeft(away)}. Империята не спи.`),
        h('ul', { class: 'ee-log' }, events.slice(-16).map((l) => h('li', { class: `k-${l.kind}` }, l.text))),
      ),
      actions: [{ label: 'Към империята', value: true, primary: true }],
    });
  }

  function welcome() {
    modal({
      title: 'Добре дошли, владетелю',
      body: h('div', { class: 'ee-away' },
        h('div', { class: 'ee-center', html: emblem(s.race, 72) }),
        h('p', null, `${s.name} е само пепелище и една Цитадела. Изградете ${E.bName(s, 'farm').toLowerCase()}, дъскорезница и кариера, обучете войска и разбийте варварите наоколо.`),
        h('p', { class: 'muted' }, `Героят ви вече чака приключения. Първите ${fmtLeft(E.isProtected(s) ? s.protectedUntil - now() : 0)} сте под защита за новаци – никой няма да ви напада.`),
      ),
      actions: [{ label: 'Да започваме', value: true, primary: true }],
    });
  }

  // ---------- рамка ----------
  let topEl, jobsEl, tabsEl, bodyEl, coachEl, color;
  function buildShell() {
    topEl = h('div', { class: 'ee-top' });
    jobsEl = h('div', { class: 'ee-jobs' });
    tabsEl = h('div', { class: 'ee-tabs', role: 'tablist' });
    bodyEl = h('div', { class: 'ee-body' });
    coachEl = h('div', { class: 'ee-coach-wrap' });
    wrap.replaceChildren(topEl, jobsEl, tabsEl, bodyEl, coachEl);
    color = RACES[s.race].color;
    wrap.style.setProperty('--race', color);
    updateAudio();
    preloadBattleSounds();
  }

  function renderAll() {
    if (!s || destroyed) return;
    renderTop();
    renderJobs();
    renderTabs();
    renderBody();
    updateLive();
  }

  // ---------- обучение за нови играчи ----------
  const TUT_KEY = `ee.tut.${uid}`;
  const queued = (id) => s.cities.some((c) => c.queue.some((q) => q.id === id));
  const TUT = [
    { text: () => `Постройте ${E.bName(s, 'farm').toLowerCase()} – тя храни града. Натиснете светещия парцел.`, tab: 'city', sel: '.ee-plot[data-id="farm"]', done: () => E.maxLv(s, 'farm') >= 1 || queued('farm') },
    { text: () => 'Постройте дъскорезница – дървото трябва за всички строежи.', tab: 'city', sel: '.ee-plot[data-id="lumber"]', done: () => E.maxLv(s, 'lumber') >= 1 || queued('lumber') },
    { text: () => (s.adventures.length ? 'Изпратете героя на приключение – ще се върне с опит, а може би и с плячка.' : 'Героят чака първото си приключение – появява се след минута. Междувременно огледайте раздел „Герой“.'), tab: 'hero', sel: '.ee-adv-send', done: () => (s.stats.adventures || 0) >= 1 || s.marches.some((m) => m.kind === 'adventure') },
    { text: () => 'Постройте казарма, за да обучавате войска.', tab: 'city', sel: '.ee-plot[data-id="barracks"]', done: () => E.maxLv(s, 'barracks') >= 1 || queued('barracks') },
    { text: () => 'Обучете поне 5 войници в раздел „Армия“.', tab: 'army', sel: '.ee-card .ee-train .btn-primary', done: () => s.stats.trained + s.cities.reduce((a, c) => a + c.train.reduce((x, b) => x + b.n - b.done, 0), 0) >= 5 },
    { text: () => 'Нападнете варварски лагер: на Картата изберете палатките и натиснете „Набег“.', tab: 'map', sel: '.ee-map', done: () => (s.stats.raids || 0) >= 1 || s.marches.some((m) => m.kind === 'raid') },
    { text: () => 'Вземете наградите за изпълнените мисии.', tab: 'missions', sel: '.ee-mission.ready .btn-primary', done: () => s.story.claimed.length >= 3 },
    { text: () => 'Постройте палисада – първата защита срещу нападенията на варварските владетели.', tab: 'city', sel: '.ee-brow[data-bid="wall"]', done: () => E.maxLv(s, 'wall') >= 1 || queued('wall') },
  ];
  function renderCoach() {
    if (!coachEl) return;
    document.querySelectorAll('.ee-hl').forEach((el) => el.classList.remove('ee-hl'));
    let st = localStorage.getItem(TUT_KEY);
    if (st === 'off' || st === 'done') return coachEl.replaceChildren();
    const i = TUT.findIndex((x) => !x.done());
    if (i < 0) {
      localStorage.setItem(TUT_KEY, 'done');
      toast('Обучението е завършено – империята е ваша! 👑', 'success', 4000);
      return coachEl.replaceChildren();
    }
    const step = TUT[i];
    if (ui.tab === step.tab) document.querySelector(step.sel)?.classList.add('ee-hl');
    coachEl.replaceChildren(h('div', { class: 'ee-coach' },
      h('span', { class: 'ee-coach-ic' }, '🧭'),
      h('div', { class: 'ee-coach-t' }, h('small', null, `Обучение · стъпка ${i + 1} от ${TUT.length}`), h('b', null, step.text())),
      ui.tab !== step.tab && h('button', { class: 'btn btn-sm btn-primary', onclick: () => goTab(step.tab) }, 'Покажи'),
      h('button', { class: 'icon-btn', title: 'Пропусни обучението', 'aria-label': 'Пропусни обучението', onclick: () => { localStorage.setItem(TUT_KEY, 'off'); renderCoach(); } }, '✕')));
  }

  function renderTop() {
    const c = cur();
    const r = E.rates(s, c);
    const show = RES.filter((k) => k !== 'mana' || s.epoch >= 2 || c.res.mana > 0).filter((k) => k !== 'souls' || c.res.souls > 0);
    const citySel = s.cities.length > 1
      ? h('select', { class: 'ee-citysel', 'aria-label': 'Град', onchange: (e) => switchCity(e.target.value) }, s.cities.map((x) => h('option', { value: x.id, selected: x.id === c.id }, `${x.name} (${x.x}|${x.y})`)))
      : h('small', null, `${c.name} · (${c.x}|${c.y})`);
    topEl.replaceChildren(
      h('div', { class: 'ee-crest' },
        h('button', { class: 'ee-crest-b', title: 'Империята', onclick: settings, html: emblem(s.race, 40) }),
        h('span', { class: 'ee-crest-t' }, h('b', null, s.name), h('small', { class: 'ee-ep' }, EPOCHS[s.epoch - 1].name), citySel),
        h('span', { class: 'ee-tools' },
          chat.button,
          h('button', { class: 'ee-tool', title: 'Настройки и звук', 'aria-label': 'Настройки и звук', onclick: settings }, '⚙'),
          h('button', { class: 'ee-tool', title: isMuted() ? 'Включи звука' : 'Изключи звука', 'aria-label': 'Звук', onclick: () => { setMuted(!isMuted()); updateAudio(); renderTop(); } }, isMuted() ? '🔇' : '🔊')),
        E.isProtected(s, now()) && h('span', { class: 'ee-prot', title: 'Защита за новаци – никой не може да ви напада' }, '🛡 ', h('span', { class: 'ee-timer', dataset: { end: s.protectedUntil } }))),
      h('div', { class: 'ee-res' },
        show.map((k) => {
          const cap = E.capOf(c, k);
          return h('div', { class: 'ee-res-i', title: `${resName(s.race, k)}${cap < Infinity ? ` · склад ${fmtN(cap)}` : ''}` },
            ri(k),
            h('span', { class: 'ee-res-v' }, h('b', { dataset: { res: k } }, fmtN(c.res[k])),
              k !== 'souls' && h('small', { class: r[k] < 0 ? 'neg' : '' }, `${r[k] >= 0 ? '+' : ''}${fmtN(r[k])}/ч`)),
            cap < Infinity && h('i', { class: 'ee-cap' }, h('i', { dataset: { capres: k, cap } })));
        }),
        h('div', { class: 'ee-res-i', title: 'Население (място за войска)' },
          h('span', { class: 'ee-ri', html: RES_ICON.pop }),
          h('span', { class: 'ee-res-v' }, h('b', null, `${E.popUsed(s, c)}/${E.popCap(s, c)}`), h('small', null, 'население')))));
  }

  function switchCity(id) {
    ui.city = id;
    savePrefs('empires.ui', ui);
    renderAll();
  }

  function job(label, start, end, onclick, cls = '') {
    return h('button', { class: `ee-job ${cls}`, onclick },
      h('span', { class: 'ee-job-t' }, label),
      h('span', { class: 'ee-timer', dataset: { end } }, fmtLeft(end - now())),
      h('i', { class: 'ee-bar' }, h('i', { dataset: { start, end } })));
  }

  // Входящите нападения се виждат, когато влязат в обсега на стражевата кула.
  const allIncoming = () => [
    ...s.incoming.map((x) => ({ ...x, key: `n${x.id}`, cityId: x.city, attacker: x.name })),
    ...W.incomingFor(uid).map((x) => ({ ...x, key: `p${x.id}`, cityId: x.toCity, attacker: x.attName, pvp: true })),
  ].map((x) => ({ ...x, cityObj: E.cityOf(s, x.cityId), cityName: E.cityOf(s, x.cityId).name }))
    .filter((x) => x.arrive - now() <= E.warnWindow(s, x.cityObj))
    .sort((a, b) => a.arrive - b.arrive);

  function marchLabel(m) {
    const T = m.target;
    const name = T.type === 'camp' ? E.campName(s.camps.find((c) => c.id === T.id) || { id: T.id, lvl: 1 })
      : T.type === 'npc' ? E.npcs(s).find((n) => n.id === T.id)?.name
        : T.type === 'city' ? E.cityOf(s, T.id).name
          : T.name || `(${T.x}|${T.y})`;
    if (m.phase === 'back') return `↩ ${m.kind === 'adventure' ? 'Героят се връща' : 'Връщане'} от ${name}`;
    if (m.phase === 'wait') return `⚔ Битка при ${name}…`;
    if (m.phase === 'battle') return `⚔ Поведете битката: ${name}`;
    return { raid: '🚩 Набег', attack: '⚔ Атака', scout: '👁 Разузнаване', support: '🛡 Подкрепа', found: '🏰 Заселване', adventure: '🧭 Приключение' }[m.kind] + ` → ${name}`;
  }

  function renderJobs() {
    const c = cur();
    const items = [];
    for (const inc of allIncoming()) items.push(job(`⚠ ${inc.attacker} → ${inc.cityName}`, inc.launched || inc.arrive - 1, inc.arrive, () => goTab('marches'), 'alarm'));
    for (const q of c.queue) items.push(job(`🔨 ${E.bName(s, q.id)} → ${q.lvl}`, q.start, q.end, () => openBuilding(q.id)));
    if (c.train.length) {
      const b = c.train[0];
      const left = c.train.reduce((a, x) => a + x.n - x.done, 0);
      const last = c.train[c.train.length - 1];
      items.push(job(`⚔ ${E.uName(s, b.u)} · ${left} в обучение`, b.start, last.start + last.each * last.n, () => goTab('army')));
    }
    if (s.research) items.push(job(`📜 ${TECHS[s.research.id].name}`, s.research.start, s.research.end, () => goTab('science')));
    if (s.epochUp) items.push(job(`✦ ${EPOCHS[s.epochUp.to - 1].name}`, s.epochUp.start, s.epochUp.end, () => goTab('science')));
    for (const m of s.marches) {
      if (m.phase === 'battle') { items.unshift(job(marchLabel(m), m.arrive, m.battle.expires, () => openBattle(m), 'alarm')); continue; }
      const [a, b] = m.phase === 'back' ? [m.arrive, m.back] : [m.depart, m.arrive];
      items.push(job(marchLabel(m), a, b, () => goTab('marches')));
    }
    if (!c.queue.length) items.splice(allIncoming().length, 0, h('button', { class: 'ee-job idle', onclick: () => goTab('city') }, '🔨 Строителите почиват'));
    jobsEl.replaceChildren(...items);
  }

  function renderTabs() {
    const claimable = E.storyList(s).some((m) => !m.claimed && m.have >= m.goal) || E.dailyList(s).some((d) => !d.claimed && d.have >= d.goal);
    const heroDot = s.hero.free > 0 || (s.hero.state === 'home' && s.adventures.length > 0);
    const allyDot = W.invitesFor(uid).length > 0;
    const dots = { missions: claimable, hero: heroDot, marches: allIncoming().length > 0 || s.marches.some((m) => m.phase === 'battle'), alliance: allyDot };
    tabsEl.replaceChildren(...TABS.map(([id, label]) =>
      h('button', { class: `tab ${ui.tab === id ? 'active' : ''}`, role: 'tab', 'aria-selected': String(ui.tab === id), onclick: () => goTab(id) },
        label, dots[id] && h('i', { class: `ee-dot ${id === 'marches' ? 'red' : ''}` }))));
  }

  function goTab(id) {
    ui.tab = id;
    savePrefs('empires.ui', ui);
    if (ONLINE && id === 'alliance') { syncNow(); scheduleSync(); }
    renderTabs();
    renderBody();
    updateLive();
  }

  function renderBody() {
    const view = { city: viewCity, army: viewArmy, map: viewMap, marches: viewMarches, hero: viewHero, science: viewScience, alliance: viewAlliance, missions: viewMissions }[ui.tab] || viewCity;
    bodyEl.replaceChildren(view());
    renderCoach();
  }

  // Обновява числата и таймерите без да прерисува всичко.
  function updateLive() {
    const c = cur();
    const t = now();
    for (const el of document.querySelectorAll('.ee [data-res]')) el.textContent = fmtN(c.res[el.dataset.res]);
    for (const el of document.querySelectorAll('.ee [data-capres]')) el.style.width = Math.min(100, (c.res[el.dataset.capres] / el.dataset.cap) * 100) + '%';
    for (const el of document.querySelectorAll('.ee [data-end]:not([data-start]), dialog [data-end]:not([data-start])')) el.textContent = fmtLeft(+el.dataset.end - t);
    for (const el of document.querySelectorAll('.ee [data-start][data-end], dialog [data-start][data-end]')) {
      const a = +el.dataset.start, b = +el.dataset.end;
      el.style.width = Math.min(100, Math.max(0, ((t - a) / Math.max(1, b - a)) * 100)) + '%';
    }
    for (const el of document.querySelectorAll('.ee [data-need], dialog [data-need]')) el.classList.toggle('lack', c.res[el.dataset.need] < +el.dataset.amount);
    for (const el of document.querySelectorAll('.ee [data-hp]')) el.style.width = Math.round(s.hero.health) + '%';
  }

  let tickN = 0;
  const NOTE_KINDS = ['loss', 'win', 'epoch', 'alarm'];
  // Проверява за нови събития и нападения: известия, звук, прерисуване.
  function afterChange(force = false) {
    if (!s) return false;
    const fresh = s.log.filter((l) => l.id > lastLog);
    const inc = allIncoming();
    const newInc = inc.filter((x) => !seenInc.has(x.key));
    for (const x of newInc) seenInc.add(x.key);
    if (fresh.length) {
      lastLog = fresh[fresh.length - 1].id;
      fresh.slice(-3).forEach((l) => toast(l.text, l.kind === 'loss' || l.kind === 'alarm' ? 'error' : 'success'));
      sound(fresh.some((l) => l.kind === 'win' || l.kind === 'epoch') ? 'win' : 'notify');
      for (const l of fresh.filter((x) => NOTE_KINDS.includes(x.kind)).slice(-3)) notify(l.text);
    }
    for (const x of newInc) {
      const msg = `⚠ ${x.attacker} напада ${x.cityName} след ${fmtLeft(x.arrive - now())}!`;
      toast(msg, 'error', 5000);
      sound('check');
      notify(msg);
    }
    const incKey = inc.map((x) => x.key).join(',');
    if (force || fresh.length || incKey !== lastIncoming) {
      lastIncoming = incKey;
      save();
      // не прекъсваме писането в чата / формите
      const typing = document.activeElement?.closest?.('.ee') && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
      if (!document.querySelector('dialog[open]') && !typing) renderAll();
      else { renderTop(); renderJobs(); renderTabs(); }
      return true;
    }
    return false;
  }

  function tick() {
    if (destroyed || !s) return;
    const t = now();
    if (!ONLINE) {
      W.refresh();
      E.syncAbroad(s, t, env);
    }
    E.advance(s, t, env);
    if (afterChange()) return;
    // светлината в града се сменя на всеки 15 минути (ден, залез, нощ)
    const sk = `${Math.floor(E.localHour(t) * 4)}:${weatherNow()}`;
    if (sk !== sceneKey) updateAudio();
    if (ui.tab === 'city' && sceneKey && sk !== sceneKey && !document.querySelector('dialog[open]')) renderBody();
    sceneKey = sk;
    if (++tickN % 5 === 0) renderTop();
    updateLive();
    if (tickN % 10 === 0) { save(); markSeen(); }
  }

  // Онлайн: състоянието от сървъра на всеки 20 секунди (6 в раздела на съюза – заради чата).
  async function syncNow() {
    if (!ONLINE || !s || destroyed || busy) return;
    try {
      applyServer(await call({ op: 'sync' }));
      if (!s) return;
      if (!afterChange() && ui.tab === 'alliance') refreshChat();
      chat.refresh();
    } catch (e) {
      console.warn('sync', e);
    }
  }
  function scheduleSync() {
    clearTimeout(syncTimer);
    if (!ONLINE || destroyed) return;
    syncTimer = setTimeout(async () => { await syncNow(); scheduleSync(); }, ui.tab === 'alliance' || chat.isOpen() ? 6000 : 20000);
  }

  // Действие на играча: локално – направо в логиката; онлайн – през сървъра.
  async function doAct(name, args = [], okMsg) {
    if (busy) return false;
    busy = true;
    try {
      if (ONLINE) applyServer(await call({ op: 'act', name, args }));
      else { E.perform(s, now(), env, name, args); save(); }
      sound('move');
      if (okMsg) toast(okMsg, 'success');
      afterChange(true);
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      busy = false;
    }
  }

  async function doWorld(name, args = [], okMsg) {
    try {
      if (ONLINE) applyServer(await call({ op: 'world', name, args }));
      else {
        W.refresh();
        W.publish(E.snapshot(s));
        const emb = E.maxLv(s, 'embassy');
        if (name === 'createAlliance') W.createAlliance(args[0], args[1], emb);
        else if (name === 'acceptInvite') { if (!emb) throw new Error('Нужно е Посолство.'); W.acceptInvite(args[0], Math.max(3, 3 * emb)); }
        else if (name === 'invite' && !emb) throw new Error('Нужно е Посолство.');
        else W[name](...args);
      }
      if (okMsg) toast(okMsg, 'success');
      renderAll();
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  }

  // ---------- известия ----------
  const notifyOn = () => localStorage.getItem('ee.notify') === '1' && 'Notification' in window && Notification.permission === 'granted';
  const pushOn = () => ONLINE && localStorage.getItem('ee.push') === '1';
  function notify(text) {
    if (!notifyOn() || !document.hidden || pushOn()) return;
    const opts = { body: text, icon: 'assets/icons/icon-192.png', tag: 'ee-' + Date.now(), data: { url: './#/play/empires' } };
    if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then((reg) => reg.showNotification('Evil Empires', opts)).catch(() => {});
    else { try { new Notification('Evil Empires', opts); } catch {} }
  }
  const b64u = (str) => { const b = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)); return Uint8Array.from(b, (ch) => ch.charCodeAt(0)); };
  async function enableNotify() {
    if (!('Notification' in window)) return toast('Браузърът не поддържа известия.', 'error');
    const p = await Notification.requestPermission();
    if (p !== 'granted') return toast('Известията са забранени в браузъра.', 'error');
    localStorage.setItem('ee.notify', '1');
    if (ONLINE && CONFIG.supabase?.empiresPush && 'serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(CONFIG.supabase.empiresPush) }));
        await call({ op: 'push', sub: sub.toJSON() });
        localStorage.setItem('ee.push', '1');
        return toast('Известията са включени – ще пристигат и когато играта е затворена.', 'success');
      } catch (e) {
        console.warn('push', e);
      }
    }
    toast('Известията са включени (докато браузърът е отворен).', 'success');
  }
  async function disableNotify() {
    localStorage.setItem('ee.notify', '0');
    if (pushOn()) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) { await call({ op: 'unpush', endpoint: sub.endpoint }); await sub.unsubscribe(); }
      } catch {}
      localStorage.setItem('ee.push', '0');
    }
    toast('Известията са изключени.', 'success');
  }

  // ---------- тактическа битка ----------
  const TAC_KEY = (id) => `ee.tac.${uid}.${id}`;
  async function openBattle(m) {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(TAC_KEY(m.id))) || []; } catch {}
    battleMusic(true);
    const moves = await openTactical({
      battle: m.battle,
      title: `Битка: ${m.target.name || 'цел'}`,
      names: (side, key) => (side === 'A' ? (key === 'hero' ? s.hero.name : E.uName(s, key)) : enemyName(key)),
      colors: { A: color, D: '#ff5d6c' },
      saved,
      onProgress: (mv) => { try { localStorage.setItem(TAC_KEY(m.id), JSON.stringify(mv)); } catch {} },
    });
    battleMusic(false);
    if (!moves) return;
    if (await doAct('tactical', [m.id, moves], 'Битката приключи.')) localStorage.removeItem(TAC_KEY(m.id));
  }

  // ---------- общи елементи ----------
  const ri = (k) => h('span', { class: 'ee-ri', html: resIcon(s.race, k) });
  const costChips = (cost, mult = 1) => h('div', { class: 'ee-cost' },
    Object.entries(cost).filter(([, v]) => v > 0).map(([k, v]) => h('span', { class: 'ee-chip', title: resName(s.race, k), dataset: { need: k, amount: v * mult } }, ri(k), fmtN(v * mult))));
  const rewardChips = (rw) => h('div', { class: 'ee-cost' },
    Object.entries(rw || {}).filter(([, v]) => v > 0).map(([k, v]) => h('span', { class: 'ee-chip good', title: resName(s.race, k) }, ri(k), '+' + fmtN(v))));
  const bar = (start, end) => h('i', { class: 'ee-bar' }, h('i', { dataset: { start, end } }));
  const progress = (have, goal) => h('i', { class: 'ee-bar static' }, h('i', { style: { width: Math.min(100, (have / goal) * 100) + '%' } }));
  const enemyName = (key) => (key === 'hero' ? 'Герой' : CLS_NAMES[UNITS[key]?.cls] ? CLS_NAMES[UNITS[key].cls][0].toUpperCase() + CLS_NAMES[UNITS[key].cls].slice(1) : key);
  const clsOf = (key, mine) => (key === 'hero' ? 'hero' : mine ? unitCls(s.race, key) : UNITS[key]?.cls || 'inf');
  const enemyChips = (army) => h('div', { class: 'ee-enemy' }, army.map((g) => h('span', { class: 'ee-echip', title: enemyName(g.key) }, h('span', { html: unitIcon(UNITS[g.key]?.cls || 'inf', '#ff5d6c', 22) }), fmtN(g.n))));
  const unitsLine = (units) => Object.entries(units || {}).filter(([, n]) => n > 0).map(([u, n]) => `${n} ${E.uName(s, u)}`).join(', ');

  // Времето в града: дъжд или сняг в някои часове (еднакво за всички играчи).
  function weatherNow() {
    const t = now();
    const m = E.localMonth(t);
    const h = Math.floor(E.localHour(t));
    let x = 0;
    for (const ch of `${E.dayKey(t)}:${h}`) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
    const v = (x % 1000) / 1000;
    if (m === 12 || m <= 2) return v < 0.35 ? 'snow' : 'clear';
    return v < 0.14 ? 'rain' : 'clear';
  }
  let sceneKey = '';
  function updateAudio() {
    if (!s || destroyed) return cityAudio(null);
    cityAudio({ hour: Math.floor(E.localHour(now())), weather: weatherNow(), smithy: E.lv(cur(), 'smithy') > 0, race: s.race });
  }

  // ---------- Град ----------
  function viewCity() {
    const c = cur();
    const pal = PALETTE[s.race];
    const cells = [];
    for (const [id, [i, j]] of Object.entries(PLOTS)) cells.push({ i, j, id });
    DECOR.forEach(([i, j, kind], n) => cells.push({ i, j, decor: kind, seed: n + 1 }));
    cells.sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i);
    for (const cell of cells) {
      if (cell.decor) { cell.html = decorSvg(cell.decor, s.race, cell.seed, s.epoch); continue; }
      const id = cell.id;
      const L = c.b[id] || 0;
      const st = E.buildState(s, c, id);
      let inner;
      if (st.status === 'building') inner = (L ? buildingSvg(id, s.race, L, s.epoch) : '') + scaffold();
      else if (L) inner = buildingSvg(id, s.race, L, s.epoch);
      else if (st.status === 'locked') inner = `<g opacity=".5"><circle cx="0" cy="-4" r="13" fill="rgba(0,0,0,.6)"/><path d="M-5 -6 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke="#aaa" stroke-width="2"/><rect x="-7" y="-6" width="14" height="10" rx="2" fill="#aaa"/></g>`;
      else inner = `<g class="ee-plus"><circle cx="0" cy="-4" r="15" fill="${pal.accent}" opacity=".18"/><circle cx="0" cy="-4" r="11" fill="${pal.accent}"/><path d="M-5 -4 h10 M0 -9 v10" stroke="#111" stroke-width="2.6" stroke-linecap="round"/></g>`;
      const badge = L ? `<g transform="translate(0 24)"><rect x="-12" y="-8.5" width="24" height="16" rx="8" fill="#0b0a0d" stroke="${pal.accent}" stroke-opacity=".8"/><text x="0" y="3.5" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">${L}</text></g>` : '';
      const timerTxt = st.status === 'building' ? `<g transform="translate(0 -74)"><rect x="-31" y="-11" width="62" height="18" rx="9" fill="rgba(0,0,0,.8)" stroke="rgba(255,210,122,.4)"/><text x="0" y="2" text-anchor="middle" font-size="10.5" font-weight="600" fill="#ffd27a" data-end="${st.q.end}">${fmtLeft(st.q.end - now())}</text></g>` : '';
      cell.attrs = `class="ee-plot" data-id="${id}" tabindex="0" role="button" aria-label="${E.bName(s, id)}"`;
      cell.html = `${tile(pal, L || st.status === 'building' ? 'built' : 'empty')}${inner}`;
      if (L && st.status !== 'building') cell.lights = buildingLights(id, L, s.epoch, s.race);
      cell.label = badge + timerTxt;
    }
    const svg = h('div', {
      class: 'ee-city',
      html: sceneSvg({ race: s.race, epoch: s.epoch, cells, wall: E.lv(c, 'wall'), traps: E.lv(c, 'traps'), hour: DEV && localStorage.getItem('ee.hour') ? +localStorage.getItem('ee.hour') : E.localHour(now()), weather: (DEV && localStorage.getItem('ee.weather')) || weatherNow(), people: Math.min(16, 3 + 2 * E.lv(c, 'houses')) }),
      onclick: (e) => { const g = e.target.closest('.ee-plot'); if (g) openBuilding(g.dataset.id); },
      onkeydown: (e) => { const g = e.target.closest('.ee-plot'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openBuilding(g.dataset.id); } },
    });
    const ids = [...Object.keys(PLOTS), ...OFF_PLOT];
    const list = h('div', { class: 'ee-blist' }, ids.map((id) => {
      const L = c.b[id] || 0;
      const st = E.buildState(s, c, id);
      return h('button', { class: `ee-brow ${st.status}`, dataset: { bid: id }, onclick: () => openBuilding(id) },
        h('span', { class: 'ee-brow-pic', html: OFF_PLOT.includes(id) ? offPlotIcon(id) : buildingPicture(id, s.race, L || 1, s.epoch) }),
        h('span', { class: 'ee-brow-t' }, h('b', null, E.bName(s, id)),
          h('small', { class: 'muted' }, st.status === 'building' ? 'строи се…' : st.status === 'locked' ? st.why : L ? `ниво ${L}` : 'не е построена')),
        h('span', { class: 'ee-brow-a' }, st.status === 'building' ? h('span', { class: 'ee-timer', dataset: { end: st.q.end } }) : st.status === 'ok' ? (L ? '↑' : '+') : ''));
    }));
    return h('div', { class: 'ee-cityview' }, svg, list);
  }

  const offPlotIcon = (id) => (id === 'wall'
    ? '<svg viewBox="0 0 50 50"><g fill="#6b4f36">' + [6, 14, 22, 30, 38].map((x) => `<path d="M${x} 42 V18 l4 -6 l4 6 V42Z"/>`).join('') + '</g><rect x="4" y="28" width="44" height="3" fill="#3a2a1c"/></svg>'
    : '<svg viewBox="0 0 50 50"><g stroke="#6b4f36" stroke-width="3" stroke-linecap="round">' + [10, 20, 30, 40].map((x) => `<line x1="${x - 4}" y1="40" x2="${x + 2}" y2="20"/><line x1="${x + 4}" y1="40" x2="${x - 1}" y2="22"/>`).join('') + '</g><ellipse cx="25" cy="42" rx="20" ry="4" fill="#120d09"/></svg>');

  function effects(c, id, L) {
    const lines = [];
    const prod = E.bProd(s, id, L);
    for (const [k, v] of Object.entries(prod)) lines.push(`${resName(s.race, k)}: +${fmtN(v * s.speed)}/ч`);
    const withB = (lvl) => ({ ...c, b: { ...c.b, [id]: lvl } });
    if (id === 'hall') lines.push(`Строежите −${Math.round(Math.min(0.5, 0.04 * (L - 1)) * 100)}%`, `Сградите до ниво ${Math.min(EPOCHS[s.epoch - 1].cap, L)}`, L >= 5 ? 'Позволява нов град' : 'Нов град от ниво 5');
    if (id === 'houses') lines.push(`Население: ${E.popCap(s, withB(L))}`);
    if (id === 'warehouse') lines.push(`Склад: ${fmtN(E.storageCap(withB(L)))}`);
    if (id === 'barracks') lines.push(`Обучение −${Math.round(Math.min(0.5, 0.04 * (L - 1)) * 100)}%`);
    if (id === 'academy') lines.push(`Изследвания −${Math.round(Math.min(0.5, 0.05 * (L - 1)) * 100)}%`);
    if (id === 'smithy') lines.push(`Войската: +${3 * L}% атака и защита`);
    if (id === 'unique' && s.race === 'orcs') lines.push(`Обучение −${Math.round(Math.min(0.4, 0.05 * L) * 100)}%`);
    if (id === 'wall') { const wb = E.wallBonus(L, s.techs.fortify); lines.push(`Защита +${Math.round((wb.def - 1) * 100)}%`, `Живот +${Math.round((wb.hp - 1) * 100)}%`); }
    if (id === 'tower') lines.push(`Вижда нападенията ${fmtLeft(E.warnWindow(s, withB(L)))} преди пристигане`, L >= 5 ? 'Разкрива точния състав' : L >= 3 ? 'Разкрива видовете войски' : L >= 1 ? 'Разкрива приблизителния брой' : '', `Защита +${2 * L}%`);
    if (id === 'temple') lines.push(`Героят се възстановява +${3 * L}%/ч по-бързо тук`);
    if (id === 'stable') lines.push(`Конница −${5 * L}% време за обучение`);
    if (id === 'traps') lines.push(`Залавят до ${E.trapCap(withB(L))} нападатели`);
    if (id === 'cranny') lines.push(`Пази по ${fmtN(E.crannyCap(withB(L)))} от ресурс`);
    if (id === 'embassy') lines.push(`Места в съюза: ${3 * L}`, L >= 3 ? 'Може да основете съюз' : 'Основаване на съюз от ниво 3');
    if (id === 'heroHall') lines.push(`Оазиси: ${(L >= 3) + (L >= 6) + (L >= 10)}`, 'Съживяване на героя');
    return lines.filter(Boolean);
  }

  async function openBuilding(id) {
    E.advance(s, now(), env);
    const c = cur();
    const L = c.b[id] || 0;
    const st = E.buildState(s, c, id);
    const next = L + 1;
    const effNow = L ? effects(c, id, L) : [];
    const effNext = effects(c, id, next);
    const body = h('div', { class: 'ee-bmodal' },
      h('div', { class: 'ee-bhead' },
        h('div', { class: 'ee-bpic', html: OFF_PLOT.includes(id) ? offPlotIcon(id) : buildingPicture(id, s.race, L || 1, s.epoch) }),
        h('div', null,
          h('div', { class: 'ee-lvl' }, L ? `Ниво ${L} / ${E.maxLevel(s, c, id)}` : 'Не е построена'),
          h('p', { class: 'muted' }, E.bDesc(s, id)))),
      (effNow.length || effNext.length) && h('div', { class: 'ee-eff' },
        effNow.length > 0 && h('div', null, h('small', null, 'Сега'), effNow.map((x) => h('div', null, x))),
        st.status !== 'max' && effNext.length > 0 && h('div', null, h('small', null, `Ниво ${next}`), effNext.map((x) => h('div', { class: 'up' }, x)))),
      st.status === 'building'
        ? h('div', { class: 'ee-building' }, h('div', null, `Строи се ниво ${st.q.lvl} – остават `, h('b', { dataset: { end: st.q.end } }, fmtLeft(st.q.end - now()))), bar(st.q.start, st.q.end))
        : st.status === 'max' || st.status === 'locked'
          ? h('p', { class: 'ee-why' }, st.why)
          : h('div', { class: 'ee-price' }, costChips(E.bCost(id, next)), h('span', { class: 'muted' }, '⏱ ' + fmtLeft(E.bTime(s, c, id, next))),
            st.status === 'busy' && h('p', { class: 'ee-why' }, st.why)),
    );
    const actions = [{ label: 'Затвори', value: null }];
    if (id === 'barracks' && L) actions.unshift({ label: 'Войска', value: 'army' });
    if (id === 'academy' && L) actions.unshift({ label: 'Наука', value: 'science' });
    if (id === 'heroHall') actions.unshift({ label: 'Герой', value: 'hero' });
    if (id === 'embassy' && L) actions.unshift({ label: 'Съюз', value: 'alliance' });
    if (id === 'hall') actions.unshift({ label: 'Преименувай', value: 'rename' });
    if (st.status === 'building') actions.push({ label: 'Откажи строежа', value: 'cancel', danger: true });
    if (st.status === 'ok') actions.push({ label: L ? `Подобри до ${next}` : 'Построй', value: 'build', primary: true });
    setTimeout(updateLive, 0);
    const v = await modal({ title: E.bName(s, id), body, actions, className: 'ee-modal' });
    if (!s || destroyed) return;
    if (v === 'build') doAct('build', [c.id, id]);
    else if (v === 'cancel') {
      if (await confirmDialog('Отказ на строежа', 'Ще получите обратно 80% от ресурсите.', 'Откажи строежа', true)) doAct('cancelBuild', [c.id, id]);
    } else if (v === 'rename') renameCity(c);
    else if (v) goTab(v);
  }

  async function renameCity(c) {
    const input = h('input', { class: 'ee-input', value: c.name, maxlength: 24 });
    setTimeout(() => input.focus(), 50);
    const v = await modal({ title: 'Име на града', body: input, actions: [{ label: 'Отказ', value: false }, { label: 'Запази', value: true, primary: true }], className: 'ee-modal' });
    if (v && input.value.trim()) doAct('renameCity', [c.id, input.value]);
  }

  // Бойната формация на града: къде застава всеки вид войска в тактическата битка.
  function formationCard(c) {
    const F = { ...FORMATION, ...(c.formation || {}) };
    const POS = [['front', 'Отпред'], ['back', 'Отзад'], ['flank', 'Фланг']];
    const rows = [['inf', 'Пехота'], ['spear', 'Копия'], ['ranged', 'Стрелци'], ['cav', 'Конница'], ['siege', 'Обсада'], ['hero', 'Героят']];
    return h('details', { class: 'ee-card ee-form' },
      h('summary', null, h('b', null, '⚔ Бойна формация'), h('small', { class: 'muted' }, ' – подредбата при отбрана и автоматични битки')),
      rows.map(([cls, name]) => h('div', { class: 'ee-form-row' }, h('span', null, name),
        h('div', { class: 'seg' }, POS.map(([pos, label]) => h('button', { type: 'button', class: F[cls] === pos ? 'on' : '', onclick: () => doAct('setFormation', [c.id, cls, pos]) }, label))))),
      h('small', { class: 'muted' }, 'Пехотата и копията отпред пазят стрелците; конницата по фланговете удря стрелците на врага.'));
  }

  // ---------- Армия ----------
  function statLine(u, c) {
    const st = E.unitStats(s, u, c);
    if (st.cls === 'scout' || st.cls === 'settler') return h('div', { class: 'ee-stats' }, h('span', { title: 'Скорост' }, '🐎 ', `${UNITS[u].speed} пол./ч`), st.upkeep > 0 && h('span', { title: 'Издръжка' }, '🍖 ', st.upkeep));
    return h('div', { class: 'ee-stats' },
      h('span', { title: 'Атака' }, '⚔ ', +st.atk.toFixed(1)),
      h('span', { title: 'Защита' }, '🛡 ', +st.def.toFixed(1)),
      h('span', { title: 'Живот' }, '❤ ', st.hp),
      h('span', { title: 'Носи плячка' }, '🎒 ', st.carry),
      h('span', { title: 'Скорост (полета на час)' }, '🐎 ', UNITS[u].speed),
      st.upkeep > 0 && h('span', { title: 'Издръжка (храна на час)' }, '🍖 ', st.upkeep));
  }

  function viewArmy() {
    const c = cur();
    const cap = E.popCap(s, c), used = E.popUsed(s, c);
    const cards = UNIT_ORDER.map((u) => {
      const lock = E.unitLock(s, c, u);
      const have = c.units[u] || 0;
      const cls = unitCls(s.race, u);
      const head = h('div', { class: 'ee-uhead' },
        h('span', { html: unitIcon(cls, color, 44) }),
        h('div', null, h('b', null, E.uName(s, u)), h('small', { class: 'muted' }, CLS_NAMES[cls] + (have ? ` · имате ${have}` : ''))));
      if (lock) return h('div', { class: 'ee-card locked' }, head, h('p', { class: 'ee-why' }, '🔒 ' + lock));
      const max = E.maxTrain(s, c, u);
      const input = h('input', { type: 'number', min: 1, max: Math.max(1, max), value: Math.min(Math.max(1, max), u === 'settler' ? 1 : 5), inputmode: 'numeric', 'aria-label': 'Брой' });
      const totalCost = h('div');
      const n = () => Math.max(1, Math.floor(+input.value || 1));
      const redraw = () => totalCost.replaceChildren(costChips(E.uCost(s, u), n()), h('small', { class: 'muted' }, '⏱ ' + fmtLeft(E.uTime(s, c, u) * n())));
      input.oninput = () => { redraw(); updateLive(); };
      redraw();
      const step = (d) => { input.value = Math.max(1, n() + d); input.oninput(); };
      return h('div', { class: 'ee-card' }, head, statLine(u, c),
        u === 'settler' && h('p', { class: 'muted' }, `Основават нов град. Градове: ${s.cities.length} / ${E.allowedCities(s)} (още един на всеки 5 нива на Цитаделата).`),
        h('div', { class: 'ee-each muted' }, 'за 1: ', costChips(E.uCost(s, u))),
        h('div', { class: 'ee-train' },
          h('div', { class: 'ee-step' },
            h('button', { class: 'icon-btn', onclick: () => step(-1), 'aria-label': 'По-малко' }, '−'), input,
            h('button', { class: 'icon-btn', onclick: () => step(1), 'aria-label': 'Повече' }, '+'),
            h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { input.value = Math.max(1, max); input.oninput(); } }, `макс ${max}`)),
          h('button', { class: 'btn btn-primary btn-sm', disabled: max < 1, onclick: () => doAct('train', [c.id, u, n()], 'Обучението започна.') }, 'Обучи')),
        totalCost);
    });
    const queue = c.train.map((b, i) => h('div', { class: 'ee-qrow' },
      h('span', null, `${E.uName(s, b.u)} × ${b.n - b.done}`),
      i === 0 ? h('span', { class: 'ee-timer', dataset: { end: b.start + b.each * b.n } }) : h('small', { class: 'muted' }, 'чака'),
      i === 0 && bar(b.start + b.each * b.done, b.start + b.each * (b.done + 1))));
    const stationed = W.stationedAt(uid, c.id);
    return h('div', { class: 'ee-pane' },
      h('div', { class: 'ee-summary' },
        h('div', null, h('small', null, 'Население'), h('b', null, `${used} / ${cap}`)),
        h('div', null, h('small', null, 'Издръжка'), h('b', null, s.race === 'undead' ? 'няма' : `${fmtN(E.upkeep(s, c) * s.speed)}/ч`)),
        h('div', null, h('small', null, 'Сила у дома'), h('b', null, fmtN(power(E.defenders(s, c, env).side, E.wallBonus(E.lv(c, 'wall')).def)))),
        h('div', null, h('small', null, 'Лоялност'), h('b', { class: (c.loyalty ?? 100) < 50 ? 'bad' : '' }, `${Math.round(c.loyalty ?? 100)}%`))),
      formationCard(c),
      c.train.length > 0 && h('div', { class: 'ee-queue' }, h('h3', null, 'Обучение'), queue),
      stationed.length > 0 && h('div', { class: 'ee-queue' }, h('h3', null, 'Подкрепления от съюзници'),
        stationed.map((st) => h('div', { class: 'ee-qrow' }, h('span', null, `${st.fromName}: ${st.groups.filter((g) => g.n > 0).map((g) => `${g.n} ${enemyName(g.key)}`).join(', ')}`),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: () => doWorld('sendBackStationed', [st.id], 'Подкрепленията ще се приберат.') }, 'Отпрати')))),
      !c.b.barracks && h('p', { class: 'ee-why' }, 'Постройте казарма, за да обучавате войска.'),
      h('div', { class: 'ee-grid' }, cards));
  }

  // ---------- Карта ----------
  function objectsMap() {
    const t = now();
    const map = new Map();
    for (const camp of s.camps) map.set(tileKey(camp.x, camp.y), { type: 'camp', lvl: camp.lvl, down: !!camp.respawn, camp });
    for (const a of s.adventures) map.set(tileKey(a.x, a.y), { type: 'adventure', hard: a.diff === 'hard', adv: a });
    // градът гори няколко часа след обсада (стена/сгради/лоялност)
    const BURN = (6 * 3600000) / (s.speed || 1);
    const burning = (bt, loyalty) => (bt && t - bt < BURN) || (loyalty != null && loyalty < 99);
    for (const n of E.activeNpcs(s, env)) {
      const st = W.npcState?.(n.id);
      map.set(tileKey(n.x, n.y), { type: 'npc', npc: n, burning: !!st && burning(Math.max(st.wallT || 0, st.loyT || 0), E.npcInfo(s, n, t, env).loyalty) });
    }
    for (const p of W.players()) {
      if (p.uid === uid) continue;
      const rel = W.relation(uid, p.uid) || 'neutral';
      for (const pc of p.cities) map.set(tileKey(pc.x, pc.y), { type: 'city', rel, player: p, city: pc, capital: pc.id === 'c1', protected: p.protectedUntil > t, burning: burning(pc.burnT, pc.loyalty), conquered: pc.captured });
    }
    for (const c of s.cities) map.set(tileKey(c.x, c.y), { type: 'city', rel: 'self', own: c, capital: c.id === 'c1', protected: E.isProtected(s, t), burning: burning(c.burnT, c.loyalty), conquered: !!c.captured });
    // катапулти пред стените: мои походи с обсадни машини, които са стигнали целта или са на път
    for (const m of s.marches) {
      if (!m.units?.catapult || m.phase === 'back' || m.target?.x == null) continue;
      const o = map.get(tileKey(m.target.x, m.target.y));
      if (o) o.siege = m.phase === 'battle' || m.phase === 'wait' ? 'here' : 'coming';
    }
    return map;
  }

  function tileObj(objs, x, y) {
    const o = objs.get(tileKey(x, y));
    if (o) return o;
    const tl = tileAt(s.world, x, y);
    if (tl.kind === 'oasis') {
      const owner = s.oases.some((q) => q.key === tileKey(x, y)) ? 'self' : W.oasisOwner(tileKey(x, y)) ? (W.relation(uid, W.oasisOwner(tileKey(x, y)).uid) || 'neutral') : null;
      return { type: 'oasis', res: tl.res, lvl: tl.lvl, rel: owner };
    }
    return null;
  }

  function viewMap() {
    const c = cur();
    if (!mapView.center) mapView.center = { x: c.x, y: c.y };
    const R = innerWidth < 640 ? 5 : 7;
    const objs = objectsMap();
    const tiles = [];
    for (let y = mapView.center.y - R; y <= mapView.center.y + R; y++) {
      for (let x = mapView.center.x - R; x <= mapView.center.x + R; x++) {
        const kind = tileAt(s.world, x, y).kind;
        tiles.push({ x, y, kind, obj: kind === 'void' ? null : tileObj(objs, x, y) });
      }
    }
    const lines = s.marches.map((m) => {
      const from = E.cityOf(s, m.from);
      return { x1: from.x, y1: from.y, x2: m.target.x, y2: m.target.y, color: m.kind === 'attack' || m.kind === 'raid' ? '#ff5d6c' : m.kind === 'scout' ? '#b9b4a8' : '#4fd18b' };
    }).filter((l) => l.x2 != null);
    const info = h('div', { class: 'ee-mapinfo' });
    const mapEl = h('div', {
      class: 'ee-map',
      html: mapSvg({ tiles, center: mapView.center, R, sel: mapView.sel, lines }),
      onclick: (e) => {
        const g = e.target.closest('.ee-tile');
        if (!g) return;
        mapView.sel = { x: +g.dataset.x, y: +g.dataset.y };
        mapEl.querySelector('.ee-mapsel')?.remove();
        renderBody();
      },
    });
    // плъзгане с пръст/мишка
    let drag = null;
    mapEl.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; });
    mapEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const tilePx = mapEl.getBoundingClientRect().width / (2 * R + 2);
      const dx = Math.round((drag.x - e.clientX) / tilePx), dy = Math.round((drag.y - e.clientY) / tilePx);
      if (dx || dy) {
        drag.moved = true;
        drag.x = e.clientX; drag.y = e.clientY;
        move(dx, dy);
      }
    });
    mapEl.addEventListener('pointerup', () => { drag = null; });
    mapEl.addEventListener('pointerleave', () => { drag = null; });
    function move(dx, dy) {
      mapView.center = { x: Math.max(-20 + 2, Math.min(20 - 2, mapView.center.x + dx)), y: Math.max(-20 + 2, Math.min(20 - 2, mapView.center.y + dy)) };
      renderBody();
    }
    const ctrl = h('div', { class: 'ee-mapctrl' },
      h('button', { class: 'icon-btn', onclick: () => move(0, -3), 'aria-label': 'Север' }, '↑'),
      h('button', { class: 'icon-btn', onclick: () => move(-3, 0), 'aria-label': 'Запад' }, '←'),
      h('button', { class: 'icon-btn', onclick: () => move(3, 0), 'aria-label': 'Изток' }, '→'),
      h('button', { class: 'icon-btn', onclick: () => move(0, 3), 'aria-label': 'Юг' }, '↓'),
      h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { mapView.center = { x: c.x, y: c.y }; mapView.sel = { x: c.x, y: c.y }; renderBody(); } }, '⌂ Моят град'),
      h('span', { class: 'muted ee-legend' },
        h('i', { style: { background: REL_COLORS.self } }), 'вие ', h('i', { style: { background: REL_COLORS.alliance } }), 'съюз ',
        h('i', { style: { background: REL_COLORS.pact } }), 'пакт ', h('i', { style: { background: REL_COLORS.war } }), 'война ', h('i', { style: { background: REL_COLORS.npc } }), 'компютър'));
    if (mapView.sel) info.append(tileInfo(mapView.sel.x, mapView.sel.y, objs));
    else info.append(h('p', { class: 'muted' }, 'Изберете поле на картата.'));
    return h('div', { class: 'ee-pane ee-mapview' }, h('div', { class: 'ee-mapcol' }, ctrl, mapEl), info);
  }

  function tileInfo(x, y, objs) {
    const c = cur();
    const o = tileObj(objs, x, y);
    const tl = tileAt(s.world, x, y);
    const d = dist(c, { x, y });
    const head = (title, sub) => h('div', { class: 'ee-mi-h' }, h('b', null, title), h('small', { class: 'muted' }, `(${x}|${y}) · ${d.toFixed(1)} полета от ${c.name}${sub ? ' · ' + sub : ''}`));
    const btns = [];
    const homeScouts = c.units.scout || 0;
    const heroHere = E.heroHome(s, c);
    const scoutBtn = (target, title) => btns.push(h('button', { class: 'btn btn-sm', disabled: !homeScouts, title: homeScouts ? '' : 'Нямате съгледвачи в този град', onclick: () => openSend('scout', target, `Разузнаване: ${title}`) }, '👁 Разузнай'));
    const intelBox = (key) => {
      const it = s.intel[key];
      if (!it) return h('p', { class: 'muted' }, 'Няма сведения. Изпратете съгледвачи.');
      return h('div', { class: 'ee-intel' }, h('small', { class: 'muted' }, `Разузнато преди ${fmtLeft(now() - it.t)}`), intelView(it.data));
    };
    let body = [];
    if (!o) {
      const names = { grass: 'Свободна земя', forest: 'Гора', hills: 'Хълмове', lake: 'Езеро', void: 'Краят на света' };
      body.push(head(names[tl.kind] || ''));
      if (tl.kind === 'grass') {
        const can = E.foundable(s, x, y, env);
        body.push(h('p', { class: 'muted' }, can ? 'Тук може да се основе град със заселници.' : 'Мястото е заето.'));
        if (can) btns.push(h('button', { class: 'btn btn-sm btn-primary', disabled: !(c.units.settler > 0), title: c.units.settler ? '' : 'Нужни са заселници (Цитадела 5)', onclick: () => openSend('found', { type: 'tile', x, y }, 'Основаване на град') }, '🏰 Основи град'));
      } else body.push(h('p', { class: 'muted' }, 'Тук не може да се строи.'));
    } else if (o.type === 'city' && o.own) {
      body.push(head(o.own.name, 'ваш град'));
      if (o.own.id !== c.id) {
        btns.push(h('button', { class: 'btn btn-sm btn-primary', onclick: () => { switchCity(o.own.id); goTab('city'); } }, 'Към града'));
        btns.push(h('button', { class: 'btn btn-sm', onclick: () => openSend('support', { type: 'city', id: o.own.id, x, y, name: o.own.name }, `Подкрепа за ${o.own.name}`) }, '🛡 Изпрати войска'));
      }
    } else if (o.type === 'city') {
      const p = o.player;
      const al = W.allianceOf(p.uid);
      body.push(head(`${p.name} – ${o.city.name}`, RACES[p.race]?.name));
      body.push(h('div', { class: 'ee-kv' },
        h('span', null, 'Съюз'), h('b', null, al ? `${al.name} [${al.tag}]` : '—'),
        h('span', null, 'Отношения'), h('b', { style: { color: REL_COLORS[o.rel] } }, REL_NAMES[o.rel] || 'неутрален'),
        h('span', null, 'Точки'), h('b', null, fmtN(p.score)),
        h('span', null, 'Морал'), h('b', null, `${Math.round(E.morale(E.score(s), p.score) * 100)}%`)));
      if (o.protected) body.push(h('p', { class: 'ee-why' }, `🛡 Под защита за новаци още ${fmtLeft(p.protectedUntil - now())}.`));
      body.push(intelBox(`player:${p.uid}:${o.city.id}`));
      const T = { type: 'player', uid: p.uid, cityId: o.city.id, x, y, name: `${p.name} – ${o.city.name}` };
      scoutBtn(T, T.name);
      if (!['alliance', 'ally', 'pact'].includes(o.rel) && !o.protected) btns.push(h('button', { class: 'btn btn-sm btn-danger', onclick: () => openSend('attack', T, `Атака: ${T.name}`, s.intel[`player:${p.uid}:${o.city.id}`]?.data?.army) }, '⚔ Атакувай'));
      if (o.rel === 'alliance') btns.push(h('button', { class: 'btn btn-sm', onclick: () => openSend('support', { type: 'ally', uid: p.uid, cityId: o.city.id, x, y, name: p.name }, `Подкрепа за ${p.name}`) }, '🛡 Подкрепи'));
    } else if (o.type === 'npc') {
      const info = E.npcInfo(s, o.npc, now(), env);
      const pact = s.pacts[o.npc.clan] > now();
      body.push(head(info.name, `${RACES[info.race].name} · компютър`));
      body.push(h('div', { class: 'ee-kv' },
        h('span', null, 'Клан'), h('b', { style: { color: info.clanInfo.color } }, `${info.clanInfo.name} [${info.clanInfo.tag}]`),
        h('span', null, 'Ниво'), h('b', null, Math.floor(info.lvl)),
        h('span', null, 'Стена'), h('b', null, info.wall),
        h('span', null, 'Лоялност'), h('b', null, `${Math.round(info.loyalty)}%`),
        h('span', null, 'Морал'), h('b', null, `${Math.round(E.morale(E.score(s), info.score) * 100)}%`),
        h('span', null, 'Пакт'), h('b', null, pact ? `още ${fmtLeft(s.pacts[o.npc.clan] - now())}` : 'няма')));
      body.push(intelBox(`npc:${o.npc.id}`));
      const T = { type: 'npc', id: o.npc.id, x, y, name: info.name };
      scoutBtn(T, info.name);
      if (!pact) btns.push(h('button', { class: 'btn btn-sm btn-danger', onclick: () => openSend('attack', T, `Атака: ${info.name}`, s.intel[`npc:${o.npc.id}`] ? info.army : null, { wall: info.wall, score: info.score }) }, '⚔ Атакувай'));
    } else if (o.type === 'camp') {
      const camp = o.camp;
      body.push(head(E.campName(camp), `варвари · ниво ${camp.lvl}`));
      if (camp.respawn) body.push(h('p', { class: 'muted' }, 'Разбит · варварите се събират: ', h('span', { class: 'ee-timer', dataset: { end: camp.respawn } })));
      else {
        body.push(enemyChips(E.campArmy(camp.lvl)), h('div', { class: 'ee-loot' }, h('small', { class: 'muted' }, 'Плячка до:'), rewardChips(E.campLoot(camp.lvl))));
        btns.push(h('button', { class: 'btn btn-sm btn-primary', onclick: () => openSend('raid', { type: 'camp', id: camp.id, x, y, name: E.campName(camp) }, `Набег: ${E.campName(camp)} (ниво ${camp.lvl})`, E.campArmy(camp.lvl)) }, '🚩 Набег'));
      }
    } else if (o.type === 'adventure') {
      const a = o.adv;
      body.push(head(a.diff === 'hard' ? 'Опасно приключение' : 'Приключение', `изчезва след ${fmtLeft(a.expires - now())}`));
      body.push(h('p', { class: 'muted' }, a.diff === 'hard' ? 'По-богата награда и по-тежки рани. Героят може да загине.' : 'Героят ще се върне с опит и може би с плячка.'));
      btns.push(h('button', { class: 'btn btn-sm btn-primary', disabled: !heroHere, title: heroHere ? '' : 'Героят не е в този град', onclick: () => openSend('adventure', { type: 'adventure', id: a.id, x, y, diff: a.diff, name: 'приключение' }, 'Приключение') }, '🧭 Изпрати героя'));
    } else if (o.type === 'oasis') {
      const oi = E.oasisInfo(s, x, y, env);
      body.push(head(`Оазис: +${OASIS_BONUS * 100}% ${resName(s.race, oi.res).toLowerCase()}`, `ниво ${oi.lvl}`));
      if (oi.owner) body.push(h('p', null, `Владетел: ${oi.mine ? 'вие' : oi.ownerName || '?'}`));
      else {
        body.push(oi.guards.length ? enemyChips(oi.guards) : h('p', { class: 'muted' }, 'Зверовете са прогонени.' + (oi.respawn ? ' Връщат се след ' : '')), oi.respawn ? h('span', { class: 'ee-timer', dataset: { end: oi.respawn } }) : null);
        body.push(h('p', { class: 'muted' }, `Победете пазачите с героя във войската, за да завладеете оазиса (Зала на героите ниво 3/6/10; до ${3} полета от града). Имате ${s.oases.length}/${E.oasisSlots(s)}.`));
        btns.push(h('button', { class: 'btn btn-sm btn-primary', onclick: () => openSend('attack', { type: 'oasis', x, y, name: `оазис (${x}|${y})` }, `Атака: оазис (${x}|${y})`, oi.guards) }, '⚔ Атакувай'));
      }
    }
    return h('div', { class: 'ee-card ee-mi' }, ...body, btns.length > 0 && h('div', { class: 'ee-mi-b' }, btns));
  }

  function intelView(data) {
    if (!data) return h('p', { class: 'muted' }, 'Няма данни.');
    return h('div', { class: 'ee-intel-d' },
      data.army && (data.army.length ? enemyChips(data.army) : h('p', { class: 'muted' }, 'Няма войска у дома.')),
      (data.wall != null || data.traps != null || data.cranny != null || data.loyalty != null) && h('div', { class: 'ee-kv' },
        data.wall != null && [h('span', null, 'Стена'), h('b', null, data.wall)],
        data.traps != null && [h('span', null, 'Капани'), h('b', null, data.traps)],
        data.cranny != null && [h('span', null, 'Скривалище'), h('b', null, data.cranny)],
        data.loyalty != null && [h('span', null, 'Лоялност'), h('b', null, `${data.loyalty}%`)]),
      (data.res || data.pile) && typeof (data.res || data.pile) === 'object' && h('div', null, h('small', { class: 'muted' }, 'Ресурси'), rewardChips(data.res || data.pile)));
  }

  // Прозорец за изпращане на войска (набег, атака, разузнаване, подкрепа, заселване, приключение).
  async function openSend(kind, target, title, enemy = null, extra = {}) {
    E.advance(s, now(), env);
    const c = cur();
    const heroHere = E.heroHome(s, c);
    const pick = {};
    let withHero = kind === 'adventure';
    const canTactic = kind === 'raid' || kind === 'attack';
    let tactical = canTactic && !!ui.tactical;
    const avail = kind === 'scout' ? ['scout'] : kind === 'adventure' ? [] : kind === 'found' ? FIGHTERS.filter((u) => c.units[u] > 0) : FIGHTERS.filter((u) => c.units[u] > 0);
    for (const u of avail) pick[u] = kind === 'found' ? 0 : c.units[u];
    if (kind === 'found') pick.settler = 1;
    const forecast = h('div', { class: 'ee-forecast' });
    const night = (tt) => E.isNight(tt) && (target.type === 'npc' || target.type === 'player');
    const mo = target.type === 'npc' ? E.morale(E.score(s), extra.score || 0) : target.type === 'player' ? E.morale(E.score(s), W.player(target.uid)?.score || 0) : 1;
    const redraw = () => {
      const units = Object.fromEntries(Object.entries(pick).filter(([, n]) => n > 0));
      const tt = E.travelTime(s, c, target, units, withHero);
      const arriveAt = now() + tt;
      const lines = [h('div', null, '⏱ Път: ', h('b', null, fmtLeft(tt)), ` · пристига в ${clock(arriveAt)}`)];
      if (night(arriveAt)) lines.push(h('div', { class: 'mid' }, `🌙 Пристига през нощта – защитниците получават +${Math.round((NIGHT.bonus - 1) * 100)}% защита.`));
      if (mo < 1) lines.push(h('div', { class: 'mid' }, `Морал ${Math.round(mo * 100)}% – целта е много по-слаба от вас.`));
      if ((kind === 'attack' || kind === 'raid') && enemy?.length) {
        const off = withHero ? E.heroStats(s).off : 0;
        const side = FIGHTERS.filter((u) => units[u]).map((u) => { const st = E.unitStats(s, u, c); return { key: u, n: units[u], ...st, atk: st.atk * mo * (1 + off) }; });
        if (withHero) side.push({ key: 'hero', cls: 'hero', n: 1, hp: E.heroStats(s).hp, atk: E.heroStats(s).atk, def: E.heroStats(s).def });
        if (side.length) {
          const wb = E.wallBonus(extra.wall || 0);
          const dm = wb.def * (night(arriveAt) ? NIGHT.bonus : 1);
          let wins = 0, lost = 0;
          const N = 16;
          for (let i = 0; i < N; i++) {
            const r = fight(side, enemy, `f${i}`, { defMult: dm, defHp: wb.hp });
            if (r.win === 'att') wins++;
            lost += r.att.reduce((a, g) => a + (g.key === 'hero' ? 0 : g.lost), 0);
          }
          const p = Math.round((wins / N) * 100);
          lines.unshift(h('div', null, 'Шанс за победа: ', h('b', { class: p >= 75 ? 'good' : p >= 40 ? 'mid' : 'bad' }, `~${p}%`), h('span', { class: 'muted' }, ` · загуби ~${Math.round(lost / N)}`)));
        }
      } else if (kind === 'attack') lines.unshift(h('div', { class: 'muted' }, 'Силата на врага е неизвестна – разузнайте първо.'));
      if ((kind === 'attack') && (target.type === 'npc' || target.type === 'player') && E.isProtected(s, now())) lines.push(h('div', { class: 'bad' }, '⚠ Атаката ще прекрати защитата ви за новаци.'));
      forecast.replaceChildren(...lines);
    };
    const rows = avail.map((u) => {
      const input = h('input', { type: 'range', min: 0, max: c.units[u], value: pick[u], 'aria-label': E.uName(s, u) });
      const val = h('b', null, pick[u]);
      input.oninput = () => { pick[u] = +input.value; val.textContent = input.value; redraw(); };
      return h('div', { class: 'ee-pick' }, h('span', { html: unitIcon(unitCls(s.race, u), color, 30) }), h('span', null, E.uName(s, u)), input, val);
    });
    const heroRow = kind !== 'scout' && heroHere && kind !== 'adventure' && h('label', { class: 'ee-herochk' },
      h('input', { type: 'checkbox', onchange: (e) => { withHero = e.target.checked; redraw(); } }),
      h('span', { html: unitIcon('hero', '#e2b553', 30) }), `${s.hero.name} (ниво ${s.hero.lvl}, живот ${Math.round(s.hero.health)}%)`);
    redraw();
    const v = await modal({
      title,
      body: h('div', { class: 'ee-attack' },
        enemy?.length > 0 && [h('small', { class: 'muted' }, 'Врагът'), enemyChips(enemy)],
        kind === 'found' && h('p', { class: 'muted' }, 'Тръгват едни заселници; можете да изпратите и охрана – тя остава в новия град.'),
        kind === 'adventure' && h('p', null, `${s.hero.name} тръгва сам. Живот: ${Math.round(s.hero.health)}%.`),
        rows.length > 0 && h('small', { class: 'muted' }, kind === 'found' ? 'Охрана' : 'Войска'), rows,
        !rows.length && kind !== 'adventure' && kind !== 'found' && h('p', { class: 'ee-why' }, 'Нямате подходяща войска в този град.'),
        heroRow,
        canTactic && h('label', { class: 'ee-herochk ee-tacchk' },
          h('input', { type: 'checkbox', checked: tactical, onchange: (e) => { tactical = e.target.checked; ui.tactical = tactical; savePrefs('empires.ui', ui); } }),
          h('span', null, h('b', null, 'Тактическа битка'), h('br'), h('small', { class: 'muted' }, 'При пристигане водите битката сами на ходове (иначе – автоматично). Имате 1 час да я изиграете.'))),
        forecast),
      actions: [{ label: 'Отказ', value: false }, { label: 'Тръгвай', value: true, primary: true }],
      className: 'ee-modal',
    });
    if (!v || !s || destroyed) return;
    doAct('send', [c.id, kind, target, pick, withHero, tactical], kind === 'adventure' ? 'Героят потегли.' : 'Войската потегли.');
  }

  // ---------- Походи ----------
  function viewMarches() {
    const c = cur();
    const inc = allIncoming();
    const incEls = inc.map((x) => {
      const city = x.cityObj;
      const tw = E.lv(city, 'tower');
      const total = x.groups.filter((g) => g.key !== 'hero').reduce((a, g) => a + g.n, 0);
      const seen = tw >= 5 ? enemyChips(x.groups.filter((g) => g.key !== 'hero'))
        : tw >= 3 ? h('div', { class: 'ee-enemy' }, x.groups.filter((g) => g.key !== 'hero').map((g) => h('span', { class: 'ee-echip', title: enemyName(g.key) }, h('span', { html: unitIcon(UNITS[g.key]?.cls || 'inf', '#ff5d6c', 22) }), '?')), h('small', { class: 'muted' }, ` ~${fmtN(Math.round(total / 10) * 10 || total)} войници`))
          : tw >= 1 ? h('small', { class: 'muted' }, `~${fmtN(Math.round(total / 10) * 10 || total)} войници (видове – от кула ниво 3, точен състав – от ниво 5)`)
            : h('small', { class: 'muted' }, 'Неизвестна сила – постройте Стражева кула.');
      return h('div', { class: 'ee-card ee-inc' },
        h('div', { class: 'ee-tech-h' }, h('b', null, `⚠ ${x.attacker} → ${x.cityName}`), h('span', { class: 'ee-timer', dataset: { end: x.arrive } })),
        h('small', { class: 'muted' }, `пристига в ${clock(x.arrive)}${E.isNight(x.arrive) ? ' · 🌙 нощен бонус за вас' : ''}`),
        seen,
        h('small', { class: 'muted' }, `Защитата ви: ${fmtN(power(E.defenders(s, city, env).side, E.wallBonus(E.lv(city, 'wall')).def))} · стена ${E.lv(city, 'wall')} · капани за ${E.trapCap(city)} · скривалище ${fmtN(E.crannyCap(city))}`));
    });
    const battles = s.marches.filter((m) => m.phase === 'battle').map((m) => h('div', { class: 'ee-card ee-inc' },
      h('div', { class: 'ee-tech-h' }, h('b', null, `⚔ ${m.target.name || 'Битка'}`), h('span', { class: 'ee-timer', dataset: { end: m.battle.expires } })),
      h('small', { class: 'muted' }, 'Войската чака заповед. Ако не изиграете битката навреме, тя ще се реши автоматично.'),
      enemyChips(m.battle.def),
      h('div', { class: 'ee-mi-b' },
        h('button', { class: 'btn btn-primary btn-sm', onclick: () => openBattle(m) }, 'Поведи битката'),
        h('button', { class: 'btn btn-sm', onclick: () => doAct('tactical', [m.id, [{ auto: 1 }]], 'Битката е решена.') }, 'Автоматично'))));
    const marchEls = s.marches.filter((m) => m.phase !== 'battle').map((m) => h('div', { class: 'ee-qrow' },
      h('span', null, marchLabel(m), h('br'), h('small', { class: 'muted' }, [unitsLine(m.units), m.hero ? s.hero.name : ''].filter(Boolean).join(', '))),
      m.phase === 'wait' ? h('small', { class: 'muted' }, 'чака…') : h('span', { class: 'ee-timer', dataset: { end: m.phase === 'back' ? m.back : m.arrive } })));
    const abroadEls = s.abroad.map((a) => h('div', { class: 'ee-qrow' },
      h('span', null, `При ${a.toName}: ${unitsLine(a.units)}`),
      h('button', { class: 'btn btn-sm btn-ghost', onclick: () => doAct('recall', [a.id], 'Войската се прибира.') }, 'Изтегли')));
    const reports = s.reports.map((r) => h('button', { class: `ee-report ${r.win ? 'win' : 'loss'}`, onclick: () => showReport(r) },
      h('b', null, { raid: '🚩', attack: '⚔', defense: '🛡', scout: '👁', adventure: '🧭', found: '🏰' }[r.kind] || '•'),
      h('span', null, r.title),
      h('small', { class: 'muted' }, clock(r.t))));
    return h('div', { class: 'ee-pane' },
      battles.length > 0 && h('div', null, h('h3', { class: 'ee-h3 bad' }, 'Битки, които чакат'), h('div', { class: 'ee-grid' }, battles)),
      inc.length > 0 && h('div', null, h('h3', { class: 'ee-h3 bad' }, 'Входящи нападения'), h('div', { class: 'ee-grid' }, incEls)),
      h('div', { class: 'ee-queue' }, h('h3', null, 'Вашите походи'), marchEls.length ? marchEls : h('small', { class: 'muted' }, 'Няма войска на път. Изберете цел от Картата.')),
      abroadEls.length > 0 && h('div', { class: 'ee-queue' }, h('h3', null, 'Подкрепления при съюзници'), abroadEls),
      h('div', { class: 'ee-queue' }, h('h3', null, 'Доклади'), reports.length ? h('div', { class: 'ee-reports' }, reports) : h('small', { class: 'muted' }, 'Още няма доклади.')),
      h('p', { class: 'muted ee-hint' }, `Защита: стената дава бонус към защитата, капаните залавят нападатели, скривалището пази ${fmtN(E.crannyCap(c))} от всеки ресурс в ${c.name}. Стражевата кула вижда нападенията ${fmtLeft(E.warnWindow(s, c))} преди пристигане. Нощем (${NIGHT.from}:00–${NIGHT.to}:00 българско време) защитниците са с +${Math.round((NIGHT.bonus - 1) * 100)}% по-силни.`));
  }

  function showReport(r) {
    const mineAtt = r.kind !== 'defense';
    const side = (list, mine) => h('div', { class: 'ee-rside' }, (list || []).map((g) => h('div', null,
      h('span', { html: unitIcon(clsOf(g.key, mine && !g.ally), mine && !g.ally ? color : '#ff5d6c', 24) }),
      h('span', null, g.key === 'hero' && mine ? s.hero.name : mine && !g.ally ? E.uName(s, g.key) : enemyName(g.key) + (g.ally ? ' (съюзник)' : '')),
      h('b', null, g.n + g.lost), g.lost > 0 && h('span', { class: 'bad' }, ` −${g.lost}`))));
    const extras = [];
    if (r.morale && r.morale < 1) extras.push(`Морал: ${Math.round(r.morale * 100)}%`);
    if (r.night) extras.push('🌙 Нощен бонус за защитниците');
    if (r.wall) extras.push(`Стена ниво ${r.wall}`);
    if (r.trapped) extras.push(`В капаните попаднаха ${r.trapped} нападатели`);
    if (r.raised) extras.push(`💀 ${r.raised} паднали врагове се вдигнаха като скелети`);
    if (r.annexed) extras.push('🌴 Оазисът е завладян!');
    if (r.siege?.wall) extras.push(`🪨 Катапултите събориха ${r.siege.wall} нива от стената`);
    if (r.siege?.buildings?.length) extras.push(`🪨 Повредени сгради: ${r.siege.buildings.join(', ')}`);
    if (r.siege?.loyalty != null) extras.push(`👑 Лоялност на града: ${r.siege.loyalty}%`);
    if (r.siege?.note) extras.push(r.siege.note);
    if (r.tactical) extras.push('Битката е проведена на тактическата карта.');
    if (r.note) extras.push(r.note);
    let body;
    if (r.kind === 'scout') body = h('div', { class: 'ee-attack' }, r.intel ? intelView(r.intel) : h('p', { class: 'bad' }, 'Съгледвачите не успяха.'), r.scoutsLost > 0 && h('small', { class: 'muted' }, `Загубени съгледвачи: ${r.scoutsLost}`));
    else if (r.kind === 'adventure') body = h('div', { class: 'ee-attack' }, h('p', null, r.text), h('small', { class: 'muted' }, `Рани: −${r.dmg}% живот`), r.item && h('p', null, 'Предмет: ', h('b', { style: { color: TIERS[r.item.tier - 1].color } }, r.item.name), ` (${r.item.text})`), rewardChips(r.loot));
    else if (r.kind === 'found') body = h('p', null, 'Новият град е ваш. Превключете към него от горната лента.');
    else body = h('div', { class: 'ee-attack' },
      r.rounds != null && h('small', { class: 'muted' }, `${r.rounds} рунда${r.enemy ? ` · нападател: ${r.enemy}` : ''}`),
      h('div', { class: 'ee-rgrid' },
        h('div', null, h('h4', null, mineAtt ? 'Вие' : r.enemy || 'Нападател'), side(r.att, mineAtt)),
        h('div', null, h('h4', null, mineAtt ? 'Противник' : 'Вие'), side(r.def, !mineAtt))),
      extras.map((x) => h('p', { class: 'muted' }, x)),
      r.loot && Object.values(r.loot).some((v) => v > 0) && h('div', null, h('small', { class: 'muted' }, r.kind === 'defense' ? 'Отнесено' : 'Плячка'), rewardChips(r.loot)));
    modal({ title: r.title, body, className: 'ee-modal' });
  }

  // ---------- Герой ----------
  function viewHero() {
    const hh = s.hero;
    const st = E.heroStats(s);
    const c = cur();
    const home = E.cityOf(s, hh.city);
    const statusText = hh.state === 'dead' ? (hh.reviveEnd ? 'Съживява се' : 'Мъртъв') : hh.state === 'away' ? 'На път' : `У дома в ${home.name}`;
    const xpNeed = 60 * hh.lvl ** 1.7;
    const head = h('div', { class: 'ee-card ee-herocard' },
      h('div', { class: 'ee-hero-l', html: heroPortrait(s.race, 104, hh.state === 'dead') }),
      h('div', { class: 'ee-hero-r' },
        h('div', { class: 'ee-tech-h' }, h('b', { class: 'ee-hero-name' }, hh.name), h('button', { class: 'btn btn-sm btn-ghost', onclick: renameHero }, '✎')),
        h('small', { class: 'muted' }, `Ниво ${hh.lvl} · ${statusText}`),
        h('div', { class: 'ee-hbar' }, h('small', null, `Живот ${Math.round(hh.health)}%`), h('i', { class: 'ee-bar static hp' }, h('i', { dataset: { hp: 1 }, style: { width: Math.round(hh.health) + '%' } }))),
        h('div', { class: 'ee-hbar' }, h('small', null, `Опит ${Math.round(hh.xp)} / ${Math.round(xpNeed)}`), progress(hh.xp, xpNeed)),
        h('div', { class: 'ee-stats' },
          h('span', { title: 'Атака' }, '⚔ ', st.atk), h('span', { title: 'Живот в битка' }, '❤ ', st.hp),
          h('span', { title: 'Скорост' }, '🐎 ', `${+st.speed.toFixed(1)}`), h('span', { title: 'Възстановяване' }, '✚ ', `${st.regen}%/ч`))));
    let revive = null;
    if (hh.state === 'dead') {
      revive = hh.reviveEnd
        ? h('div', { class: 'ee-card' }, h('b', null, 'Съживяване'), h('span', { class: 'ee-timer', dataset: { end: hh.reviveEnd } }), bar(hh.reviveEnd - E.reviveTime(s), hh.reviveEnd))
        : h('div', { class: 'ee-card' }, h('b', null, `Съживете ${hh.name}`), h('p', { class: 'muted' }, `В Залата на героите на ${c.name}.`), costChips(E.reviveCost(s)),
          h('button', { class: 'btn btn-primary btn-sm', disabled: !E.lv(c, 'heroHall'), onclick: () => doAct('revive', [c.id], 'Съживяването започна.') }, E.lv(c, 'heroHall') ? `Съживи · ${fmtLeft(E.reviveTime(s))}` : 'Нужна е Зала на героите'));
    }
    const points = h('div', { class: 'ee-card' },
      h('div', { class: 'ee-tech-h' }, h('b', null, 'Умения'), h('small', { class: hh.free ? 'good' : 'muted' }, `свободни точки: ${hh.free}`)),
      Object.entries(HERO_POINTS).map(([k, p]) => h('div', { class: 'ee-point' },
        h('div', null, h('b', null, `${p.name}: ${hh.points[k]}`), h('small', { class: 'muted' }, p.desc)),
        h('button', { class: 'icon-btn', disabled: !hh.free, 'aria-label': `+ ${p.name}`, onclick: () => doAct('assignPoint', [k]) }, '+'))));
    const eqItems = Object.entries(SLOTS).map(([slot, name]) => {
      const it = hh.items.find((i) => i.id === hh.eq[slot]);
      const ii = it && E.itemOf(it);
      return h('div', { class: `ee-slot ${ii ? 't' + ii.tier : ''}` }, h('small', { class: 'muted' }, name),
        ii ? [h('b', { style: { color: TIERS[ii.tier - 1].color } }, ii.name), h('small', null, ii.text), h('button', { class: 'btn btn-sm btn-ghost', onclick: () => doAct('unequip', [slot]) }, 'Свали')] : h('small', { class: 'muted' }, '—'));
    });
    const inv = hh.items.filter((i) => !Object.values(hh.eq).includes(i.id)).map((it) => {
      const ii = E.itemOf(it);
      return h('div', { class: 'ee-qrow ee-item' },
        h('span', null, h('b', { style: { color: TIERS[ii.tier - 1].color } }, ii.name), h('small', { class: 'muted' }, ` · ${SLOTS[ii.slot]}, ${TIERS[ii.tier - 1].name} · ${ii.text}`)),
        h('span', { class: 'ee-item-b' },
          h('button', { class: 'btn btn-sm', onclick: () => doAct('equip', [it.id]) }, 'Сложи'),
          h('button', { class: 'btn btn-sm btn-ghost', title: `Продай за ${100 * ii.tier ** 2} злато и ${ii.tier * 2} души`, onclick: () => doAct('sellItem', [c.id, it.id], 'Продадено.') }, 'Продай')));
    });
    const advs = s.adventures.map((a) => h('div', { class: 'ee-qrow' },
      h('span', null, a.diff === 'hard' ? '⚠ Опасно приключение' : '🧭 Приключение', h('small', { class: 'muted' }, ` (${a.x}|${a.y}) · ${dist(home, a).toFixed(1)} полета · изчезва след `), h('span', { class: 'ee-timer', dataset: { end: a.expires } })),
      h('button', { class: 'btn btn-sm btn-primary ee-adv-send', disabled: !E.heroHome(s, c), onclick: () => openSend('adventure', { type: 'adventure', id: a.id, x: a.x, y: a.y, diff: a.diff, name: 'приключение' }, 'Приключение') }, 'Изпрати')));
    return h('div', { class: 'ee-pane' },
      head, revive,
      h('div', { class: 'ee-grid' }, points,
        h('div', { class: 'ee-card' }, h('b', null, 'Екипировка'), h('div', { class: 'ee-slots' }, eqItems))),
      h('div', { class: 'ee-queue' }, h('h3', null, 'Приключения'),
        advs.length ? advs : h('small', { class: 'muted' }, 'Няма приключения. Ново се появява на всеки няколко часа.'),
        !E.heroHome(s, c) && hh.state === 'home' && h('small', { class: 'muted' }, `Героят е в ${home.name} – превключете към този град, за да го изпратите.`)),
      h('div', { class: 'ee-queue' }, h('h3', null, 'Торба'), inv.length ? inv : h('small', { class: 'muted' }, 'Празна. Предметите се намират в приключения.')));
  }

  async function renameHero() {
    const input = h('input', { class: 'ee-input', value: s.hero.name, maxlength: 20 });
    setTimeout(() => input.focus(), 50);
    const v = await modal({ title: 'Име на героя', body: input, actions: [{ label: 'Отказ', value: false }, { label: 'Запази', value: true, primary: true }], className: 'ee-modal' });
    if (v && input.value.trim()) doAct('renameHero', [input.value]);
  }

  // ---------- Наука ----------
  function viewScience() {
    const c = cur();
    const req = E.epochReqs(s);
    let epochCard;
    if (s.epochUp) epochCard = h('div', { class: 'ee-card ee-epoch' }, h('b', null, `Преход към ${EPOCHS[s.epochUp.to - 1].name}`), h('span', { class: 'ee-timer', dataset: { end: s.epochUp.end } }), bar(s.epochUp.start, s.epochUp.end));
    else if (!req || s.epoch >= MAX_EPOCH) epochCard = h('div', { class: 'ee-card ee-epoch' }, h('b', null, EPOCHS[s.epoch - 1].name), h('p', { class: 'muted' }, 'Следващата епоха идва в нова версия на играта.'));
    else epochCard = h('div', { class: 'ee-card ee-epoch' },
      h('div', { class: 'ee-uhead' }, h('span', { class: 'ee-epoch-n' }, '✦'), h('div', null, h('small', { class: 'muted' }, 'Следваща епоха'), h('b', null, EPOCHS[req.next - 1].name))),
      h('ul', { class: 'ee-check' }, req.list.map((x) => h('li', { class: x.ok ? 'ok' : '' }, x.ok ? '✔ ' : '○ ', x.text))),
      costChips(req.spec.cost),
      h('button', { class: 'btn btn-primary', disabled: req.list.some((x) => !x.ok), onclick: () => doAct('advanceEpoch', [c.id], 'Империята навлиза в нова епоха!') }, `Към ${EPOCHS[req.next - 1].name} · ${fmtLeft((req.spec.time * 1000) / s.speed)}`));
    const groups = EPOCHS.slice(0, MAX_EPOCH).map((x) => x.n).map((ep) => h('div', null,
      h('h3', { class: 'ee-h3' }, EPOCHS[ep - 1].name),
      h('div', { class: 'ee-grid' }, Object.entries(TECHS).filter(([, d]) => d.epoch === ep).map(([id, d]) => {
        const st = E.techState(s, id);
        return h('div', { class: `ee-card ee-tech ${st.status}` },
          h('div', { class: 'ee-tech-h' }, h('b', null, d.name), st.status === 'done' && h('span', { class: 'good' }, '✔')),
          h('p', { class: 'muted' }, d.desc.replace('храна', resName(s.race, 'food').toLowerCase())),
          st.status === 'active' ? h('div', null, h('span', { class: 'ee-timer', dataset: { end: s.research.end } }), bar(s.research.start, s.research.end))
            : st.status === 'done' ? null
              : h('div', { class: 'ee-tech-f' },
                st.status === 'locked' ? h('p', { class: 'ee-why' }, '🔒 ' + st.why) : costChips(d.cost),
                st.status !== 'locked' && h('div', { class: 'ee-tech-b' }, h('small', { class: 'muted' }, '⏱ ' + fmtLeft(E.tTime(s, id))),
                  h('button', { class: 'btn btn-primary btn-sm', disabled: st.status !== 'ok', title: st.why || '', onclick: () => doAct('research', [c.id, id], 'Изследването започна.') }, 'Изследвай'))));
      }))));
    return h('div', { class: 'ee-pane' },
      !E.maxLv(s, 'academy') && h('p', { class: 'ee-why' }, 'Постройте академия, за да изследвате технологии.'),
      epochCard, groups);
  }

  // ---------- Съюз ----------
  let chatList = null;
  function chatItems(a) {
    return a.chat.slice(-60).map((m) => h('div', { class: `ee-msg ${m.sys ? 'sys' : m.uid === uid ? 'me' : ''}` },
      !m.sys && h('b', null, m.name), h('span', null, m.text), h('small', { class: 'muted' }, clock(m.t))));
  }
  function refreshChat() {
    const a = W.allianceOf(uid);
    if (!chatList || !a) return renderBody();
    chatList.replaceChildren(...chatItems(a));
    chatList.scrollTop = chatList.scrollHeight;
  }

  function viewAlliance() {
    if (!ONLINE) W.refresh();
    const emb = E.maxLv(s, 'embassy');
    const a = W.allianceOf(uid);
    const parts = [];
    chatList = null;
    if (!emb) parts.push(h('p', { class: 'ee-why' }, 'Постройте Посолство, за да се присъедините към съюз (ниво 1) или да основете свой (ниво 3).'));
    if (a) {
      const leader = a.leader === uid;
      const members = a.members.map((m) => W.player(m)).filter(Boolean).sort((x, y) => y.score - x.score);
      parts.push(h('div', { class: 'ee-card ee-epoch' },
        h('div', { class: 'ee-tech-h' }, h('b', null, `${a.name} [${a.tag}]`), h('small', { class: 'muted' }, `${a.members.length} / ${Math.max(3, 3 * (members.find((m) => m.uid === a.leader) ? E.maxLv(s, 'embassy') : 1))} членове`)),
        h('div', { class: 'ee-members' }, members.map((p) => h('div', { class: 'ee-qrow' },
          h('span', null, h('span', { class: `ee-online ${p.uid === uid || leaseFresh(p.uid) ? 'on' : ''}` }), `${p.name}${p.uid === a.leader ? ' 👑' : ''}`, h('small', { class: 'muted' }, ` · ${RACES[p.race]?.name} · ${fmtN(p.score)} т. · ${p.cities.length} гр.`)),
          leader && p.uid !== uid ? h('button', { class: 'btn btn-sm btn-ghost', onclick: async () => { if (await confirmDialog('Изключване', `Да изключите ли ${p.name}?`, 'Изключи', true)) doWorld('kick', [p.uid]); } }, 'Изключи') : null))),
        h('div', { class: 'ee-mi-b' },
          h('button', { class: 'btn btn-sm btn-ghost', onclick: async () => { if (await confirmDialog('Напускане', 'Да напуснете ли съюза?', 'Напусни', true)) doWorld('leave', []); } }, 'Напусни'))));
      // покана
      const q = h('input', { class: 'ee-input', placeholder: 'Име на играч…', 'aria-label': 'Покани играч' });
      const found = h('div');
      q.oninput = () => {
        const v = q.value.trim().toLowerCase();
        const list = v.length < 2 ? [] : W.players().filter((p) => p.uid !== uid && !p.alliance && p.name.toLowerCase().includes(v)).slice(0, 6);
        found.replaceChildren(...list.map((p) => h('div', { class: 'ee-qrow' }, h('span', null, `${p.name} · ${fmtN(p.score)} т.`),
          h('button', { class: 'btn btn-sm', onclick: () => doWorld('invite', [p.uid], `Поканихте ${p.name}.`) }, 'Покани'))));
      };
      parts.push(h('div', { class: 'ee-grid' },
        h('div', { class: 'ee-card' }, h('b', null, 'Чат на съюза'),
          (chatList = h('div', { class: 'ee-chat' }, chatItems(a))),
          (() => {
            const inp = h('input', { class: 'ee-input', placeholder: 'Съобщение…', maxlength: 400, 'aria-label': 'Съобщение' });
            const sendMsg = async () => { const v = inp.value.trim(); if (!v) return; inp.value = ''; if (await doWorld('say', [v])) refreshChat(); };
            inp.onkeydown = (e) => { if (e.key === 'Enter') sendMsg(); };
            return h('div', { class: 'ee-chat-in' }, inp, h('button', { class: 'btn btn-primary btn-sm', onclick: sendMsg }, 'Прати'));
          })()),
        h('div', { class: 'ee-card' }, h('b', null, 'Покани играч'), q, found,
          h('b', null, 'Дипломация'),
          W.alliances().filter((x) => x.id !== a.id).length
            ? W.alliances().filter((x) => x.id !== a.id).map((o) => h('div', { class: 'ee-qrow' }, h('span', null, `${o.name} [${o.tag}]`),
              leader
                ? h('select', { class: 'ee-sel', onchange: (e) => doWorld('setRelation', [o.id, e.target.value || null]) },
                  [['', 'неутрален'], ['ally', 'съюзници'], ['pact', 'пакт'], ['war', 'война']].map(([v, l]) => h('option', { value: v, selected: (a.diplomacy[o.id] || '') === v }, l)))
                : h('small', { style: { color: REL_COLORS[a.diplomacy[o.id] || 'neutral'] } }, REL_NAMES[a.diplomacy[o.id] || 'neutral'])))
            : h('small', { class: 'muted' }, 'Няма други съюзи.'))));
      setTimeout(() => chatList && (chatList.scrollTop = chatList.scrollHeight), 0);
    } else {
      const inv = W.invitesFor(uid);
      if (inv.length) parts.push(h('div', { class: 'ee-queue' }, h('h3', null, 'Покани'), inv.map((x) => h('div', { class: 'ee-qrow' }, h('span', null, `${x.name} [${x.tag}] · ${x.members.length} членове`),
        h('span', { class: 'ee-item-b' },
          h('button', { class: 'btn btn-sm btn-primary', disabled: !emb, onclick: () => doWorld('acceptInvite', [x.id], `Вече сте в ${x.name}!`) }, 'Приеми'),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: () => doWorld('declineInvite', [x.id]) }, 'Откажи'))))));
      const name = h('input', { class: 'ee-input', placeholder: 'Име на съюза', maxlength: 28 });
      const tag = h('input', { class: 'ee-input ee-tag', placeholder: 'Таг', maxlength: 4 });
      parts.push(h('div', { class: 'ee-card' }, h('b', null, 'Основаване на съюз'), h('small', { class: 'muted' }, 'Нужно е Посолство ниво 3.'),
        h('div', { class: 'ee-chat-in' }, name, tag,
          h('button', { class: 'btn btn-primary btn-sm', disabled: emb < 3, onclick: () => {
            if (name.value.trim().length < 3 || tag.value.trim().length < 2) return toast('Име (3+ букви) и таг (2–4 знака).', 'error');
            doWorld('createAlliance', [name.value.trim(), tag.value.trim().toUpperCase()], 'Съюзът е основан!');
          } }, 'Основи'))));
    }
    // кланове на компютъра
    parts.push(h('div', { class: 'ee-queue' }, h('h3', null, 'Кланове на варварските владетели'),
      NPC_CLANS.map((cl) => {
        const until = s.pacts[cl.id] || 0;
        const members = E.npcs(s).filter((n) => n.clan === cl.id).length;
        return h('div', { class: 'ee-qrow' },
          h('span', null, h('b', { style: { color: cl.color } }, `${cl.name} [${cl.tag}]`), h('small', { class: 'muted' }, ` · ${members} владетели`)),
          until > now() ? h('small', { class: 'good' }, 'пакт още ', h('span', { class: 'ee-timer', dataset: { end: until } }))
            : h('button', { class: 'btn btn-sm', title: 'Кланът няма да ви напада 3 дни', onclick: () => doAct('pact', [cur().id, cl.id], `Пакт с ${cl.name}.`) }, `Пакт · ${fmtN(E.pactCost(s).gold)} злато`));
      }),
      h('small', { class: 'muted' }, 'Пактът спира нападенията на клана срещу вас, но и вие не можете да ги нападате.')));
    // класация
    const t = now();
    const rows = [
      ...W.players().map((p) => ({ name: p.name, tag: W.allianceOf(p.uid)?.tag, score: p.uid === uid ? E.score(s) : p.score, me: p.uid === uid })),
      ...E.npcs(s).map((n) => { const i = E.npcInfo(s, n, t, env); return { name: n.name, tag: i.clanInfo.tag, score: i.score, npc: true }; }),
    ].sort((x, y) => y.score - x.score).slice(0, 20);
    const allis = W.alliances().map((x) => ({ x, score: x.members.reduce((acc, m) => acc + (W.player(m)?.score || 0), 0) })).sort((p, q) => q.score - p.score);
    parts.push(h('div', { class: 'ee-grid' },
      h('div', { class: 'ee-queue' }, h('h3', null, 'Класация на владетелите'),
        rows.map((r, i) => h('div', { class: `ee-qrow ${r.me ? 'me' : ''}` }, h('span', null, `${i + 1}. ${r.name}`, r.tag && h('small', { class: 'muted' }, ` [${r.tag}]`), r.npc && h('small', { class: 'muted' }, ' · компютър')), h('b', null, fmtN(r.score))))),
      h('div', { class: 'ee-queue' }, h('h3', null, 'Класация на съюзите'),
        allis.length ? allis.map((r, i) => h('div', { class: 'ee-qrow' }, h('span', null, `${i + 1}. ${r.x.name} [${r.x.tag}]`, h('small', { class: 'muted' }, ` · ${r.x.members.length} членове`)), h('b', null, fmtN(r.score)))) : h('small', { class: 'muted' }, 'Още няма съюзи.'))));
    return h('div', { class: 'ee-pane' }, parts);
  }

  // ---------- Мисии ----------
  function viewMissions() {
    const c = cur();
    const story = E.storyList(s);
    const open = story.filter((m) => !m.claimed).slice(0, 3);
    const done = story.filter((m) => m.claimed).length;
    const card = (m, onClaim) => h('div', { class: `ee-card ee-mission ${m.key ? 'key' : ''} ${m.have >= m.goal ? 'ready' : ''}` },
      h('div', { class: 'ee-tech-h' }, h('b', null, m.title || m.text), h('small', { class: 'muted' }, `${fmtN(m.have)} / ${fmtN(m.goal)}`)),
      m.title && h('p', { class: 'muted' }, m.text),
      progress(m.have, m.goal),
      h('div', { class: 'ee-tech-b' }, rewardChips(m.reward || m.prize),
        m.claimed ? h('span', { class: 'good' }, '✔ взета') : h('button', { class: 'btn btn-primary btn-sm', disabled: m.have < m.goal, onclick: onClaim }, 'Вземи')));
    const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0);
    return h('div', { class: 'ee-pane' },
      h('div', { class: 'ee-sec' }, h('h3', { class: 'ee-h3' }, 'Кампания'), h('small', { class: 'muted' }, `${done} / ${story.length}`)),
      open.length ? h('div', { class: 'ee-grid' }, open.map((m) => card(m, () => doAct('claimStory', [c.id, m.id], 'Наградата е ваша!'))))
        : h('p', { class: 'muted' }, 'Кампанията за тази версия е завършена. Очаквайте нови глави!'),
      h('div', { class: 'ee-sec' }, h('h3', { class: 'ee-h3' }, 'Дневни мисии'), h('small', { class: 'muted' }, 'нови след ', h('span', { class: 'ee-timer', dataset: { end: tomorrow.getTime() } }))),
      h('div', { class: 'ee-grid' }, E.dailyList(s).map((d) => card(d, () => doAct('claimDaily', [c.id, d.id], 'Наградата е ваша!')))));
  }

  // ---------- Настройки ----------
  async function settings() {
    const speedSel = DEV && !ONLINE && h('div', { class: 'opt-group' }, h('span', null, 'Скорост (само за тестове на локалния сървър)'),
      h('div', { class: 'seg' }, [1, 10, 100, 1000].map((v) => h('button', {
        type: 'button', class: s.speed === v ? 'on' : '',
        onclick: (e) => {
          E.setSpeed(s, now(), v, env);
          save();
          e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
          renderAll();
        },
      }, `×${v}`))));
    const prot = E.isProtected(s, now());
    const v = await modal({
      title: s.name,
      body: h('div', { class: 'ee-away' },
        h('div', { class: 'ee-center', html: emblem(s.race, 72) }),
        h('p', { class: 'ee-center' }, `${RACES[s.race].name} · ${EPOCHS[s.epoch - 1].name} · ${fmtN(E.score(s))} точки · ${s.cities.length} град(а)`),
        h('ul', { class: 'ee-check' }, RACES[s.race].perks.map((p) => h('li', { class: 'ok' }, '✔ ' + p)), h('li', null, '✖ ' + RACES[s.race].weak)),
        prot && h('p', { class: 'muted' }, `🛡 Защита за новаци: още ${fmtLeft(s.protectedUntil - now())}. Изтича по-рано, ако нападнете друг владетел.`),
        h('div', { class: 'opt-group' }, h('span', null, 'Известия за нападения и събития'),
          h('div', { class: 'seg' },
            h('button', { type: 'button', class: notifyOn() ? 'on' : '', onclick: async (e) => { await enableNotify(); e.target.parentElement.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === 0 && notifyOn())); } }, 'Включени'),
            h('button', { type: 'button', class: notifyOn() ? '' : 'on', onclick: async (e) => { await disableNotify(); e.target.parentElement.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === 1)); } }, 'Изключени'))),
        h('div', { class: 'opt-group' }, h('span', null, 'Звук (музика, град, битки)'),
          h('div', { class: 'seg' },
            h('button', { type: 'button', class: isMuted() ? '' : 'on', onclick: (e) => { setMuted(!isMuted()); updateAudio(); renderTop(); e.currentTarget.classList.toggle('on', !isMuted()); e.currentTarget.textContent = isMuted() ? '🔇 Изключен' : '🔊 Включен'; } }, isMuted() ? '🔇 Изключен' : '🔊 Включен'),
            h('button', { type: 'button', class: audioPrefs().music ? 'on' : '', onclick: (e) => { const on = !audioPrefs().music; setAudioPref('music', on); e.currentTarget.classList.toggle('on', on); } }, '🎵 Музика'),
            h('button', { type: 'button', class: audioPrefs().ambient ? 'on' : '', onclick: (e) => { const on = !audioPrefs().ambient; setAudioPref('ambient', on); e.currentTarget.classList.toggle('on', on); } }, '🐦 Град'))),
        h('p', { class: 'muted' }, ONLINE ? 'Онлайн свят: всички играчи са в един свят, а сървърът проверява всяко действие.' : 'Локален свят: споделен само между акаунтите в този браузър.'),
        speedSel),
      actions: [{ label: 'Започни отначало', value: 'reset', danger: true }, ...(prot ? [{ label: 'Свали защитата', value: 'unprotect' }] : []), { label: 'Затвори', value: null, primary: true }],
      className: 'ee-modal',
    });
    if (v === 'unprotect' && await confirmDialog('Край на защитата', 'Варварските владетели ще могат да ви нападат. Сигурни ли сте?', 'Свали защитата', true)) doAct('endProtection', []);
    if (v === 'reset' && await confirmDialog('Нова империя', 'Цялият напредък ще бъде изтрит завинаги. Сигурни ли сте?', 'Изтрий и започни', true)) {
      if (ONLINE) {
        try { await call({ op: 'reset' }); } catch (e) { return toast(e.message, 'error'); }
      } else {
        W.refresh();
        W.removePlayer(uid);
        localStorage.removeItem(SAVE_KEY(uid));
      }
      clearInterval(timer);
      s = null;
      wrap.replaceChildren();
      wrap.removeAttribute('style');
      await startNew();
    }
  }

  async function startNew() {
    const pick = await chooseRace(wrap, ctx.user);
    if (destroyed) return;
    if (ONLINE) {
      try { applyServer(await call({ op: 'new', race: pick.race, name: pick.name })); } catch (e) { toast(e.message, 'error'); return startNew(); }
    } else {
      const home = allocateHome(uid);
      s = E.newGame(pick.race, pick.name, now(), undefined, { uid, home, worldSeed: home.seed });
    }
    lastLog = s.log.length ? s.log[s.log.length - 1].id : 0;
    lastPublish = 0;
    save();
    buildShell();
    renderAll();
    welcome();
    timer = setInterval(tick, 1000);
    scheduleSync();
  }

  // ---------- старт ----------
  (async () => {
    if (ONLINE) {
      wrap.append(h('p', { class: 'muted ee-center' }, 'Свързване със света…'));
      try {
        applyServer(await call({ op: 'sync' }));
      } catch (e) {
        wrap.replaceChildren(h('div', { class: 'ee-card' }, h('b', null, 'Онлайн светът не е достъпен'), h('p', { class: 'muted' }, e.message),
          h('p', { class: 'muted' }, 'Сървърът на Evil Empires (Supabase Edge Function) трябва да е качен – виж README.')));
        return;
      }
      if (destroyed) return;
      wrap.replaceChildren();
      if (!s) return startNew();
      catchUp();
      lastLog = s.log.length ? s.log[s.log.length - 1].id : 0;
      for (const x of allIncoming()) seenInc.add(x.key);
      buildShell();
      renderAll();
      timer = setInterval(tick, 1000);
      scheduleSync();
      return;
    }
    setLease(uid);
    leaseTimer = setInterval(() => setLease(uid), 3000);
    if (!s) {
      const raw = loadSave(uid);
      if (raw) {
        const home = allocateHome(uid);
        s = raw.v === 2 ? raw : E.migrate(raw, { uid, home, worldSeed: home.seed });
      }
    }
    if (!s) return startNew();
    catchUp();
    lastLog = s.log.length ? s.log[s.log.length - 1].id : 0;
    for (const x of allIncoming()) seenInc.add(x.key);
    lastPublish = 0;
    save();
    buildShell();
    renderAll();
    timer = setInterval(tick, 1000);
  })();

  return {
    destroy() {
      destroyed = true;
      clearInterval(timer);
      clearInterval(leaseTimer);
      clearTimeout(syncTimer);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('storage', onStorage);
      markSeen();
      cityAudio(null);
      chat.destroy();
      if (ONLINE) return;
      clearLease(uid);
      if (s) { E.advance(s, Date.now(), env); writeSave(uid, s); W.publish(E.snapshot(s)); }
    },
  };
}

// ---------- избор на раса ----------
function chooseRace(root, user) {
  return new Promise((resolve) => {
    let race = null;
    const name = h('input', { value: `Империята на ${user.displayName}`, maxlength: 32, 'aria-label': 'Име на империята' });
    const go = h('button', { class: 'btn btn-primary btn-lg', disabled: true }, 'Основи империята');
    const cards = Object.entries(RACES).map(([id, r]) => h('button', {
      class: 'ee-race', style: { '--rc': r.color },
      onclick: (e) => {
        race = id;
        cards.forEach((c) => c.classList.toggle('on', c === e.currentTarget));
        go.disabled = false;
      },
    },
      h('span', { html: emblem(id, 64) }),
      h('b', null, r.name),
      h('p', { class: 'muted' }, r.lore),
      h('ul', null, r.perks.map((p) => h('li', { class: 'good' }, '+ ' + p)), h('li', { class: 'bad' }, '− ' + r.weak))));
    go.onclick = () => {
      const n = name.value.trim() || `Империята на ${user.displayName}`;
      el.remove();
      resolve({ race, name: n.slice(0, 32) });
    };
    const el = h('div', { class: 'ee-start' },
      h('div', { class: 'ee-start-h' },
        h('h2', null, 'Evil Empires'),
        h('p', { class: 'muted' }, 'Векове след Падението светът е пепелище. Изберете народ и издигнете империя, която ще надживее мрака.')),
      h('div', { class: 'ee-races' }, cards),
      h('div', { class: 'ee-start-f' }, h('label', null, h('span', { class: 'muted' }, 'Име на империята'), name), go));
    root.append(el);
  });
}
