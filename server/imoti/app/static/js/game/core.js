/* ============================================================
   Имоти и Империи — core: общ контекст на игровия екран.
   Създава window.IEGame (G) — споделеното пространство между
   модулите (board, effects, lobby, chat, trade, auction, ui,
   events). Тук живеят състоянието, сокетът и чистите помощници.
   Сървърът е авторитетен: клиентът само показва състоянието
   и изпраща намерения за действия.
   ============================================================ */
"use strict";

(function () {
  // Без валиден reconnect токен няма какво да показваме — обратно към
  // началния екран. window.IEGame не се създава и останалите модули
  // се самоизключват.
  const token = IE.storage.reconnectToken;
  if (!token) {
    window.location.href = IE.urls.home;
    return;
  }

  const G = (window.IEGame = {});

  G.BOARD = window.IE_BOARD; // статично табло от сървъра
  G.socket = IE.connect();

  G.state = {
    myId: null,
    isHost: false,
    isSpectator: false,
    started: false,
    roomCode: null,
    lobby: null,
    game: null,
    serverClock: null,
    shownTrades: new Set(),
    // Подробният протокол се тегли по заявка (request_history), а не идва
    // с всяко обновяване — там тежеше две трети от целия трафик.
    fullHistory: [],
    animating: Promise.resolve(),
  };

  G.DICE_ROLL_MS = 1280;
  G.DICE_ROLL_WAIT_MS = G.DICE_ROLL_MS + 90;

  G.wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const { BOARD, socket, state } = G;

  /* ==========================================================
     Свързване чрез reconnect токен
     ========================================================== */
  // Първата заявка тръгва чак след като всички модули са изпълнени.
  // Браузърът може да обработи входящо съобщение между два <script>
  // тага; при бърз сървър lobby_state пристигаше преди ui.js да е
  // дефинирал G.showView и екранът оставаше черен.
  const joinRoom = () => socket.emit("reconnect_room", { reconnect_token: token });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", joinRoom, { once: true });
  } else {
    joinRoom();
  }
  socket.on("connect", () => {
    if (state.myId) socket.emit("reconnect_room", { reconnect_token: IE.storage.reconnectToken });
  });

  socket.on("reconnect_failed", () => {
    IE.storage.reconnectToken = null;
    IE.toast("Сесията е изтекла — върнете се в началото.", "error");
    setTimeout(() => (window.location.href = IE.urls.home), 1500);
  });

  socket.on("room_joined", (data) => {
    state.myId = data.player_id;
    state.roomCode = data.room_code || state.roomCode;
    state.isHost = !!data.is_host;
    state.isSpectator = !!data.is_spectator;
    state.started = !!data.started;
    IE.storage.reconnectToken = data.reconnect_token;
    socket.emit("request_state", {});
  });

  socket.on("kicked", () => {
    IE.storage.reconnectToken = null;
    IE.toast("Премахнати сте от стаята.", "error");
    setTimeout(() => (window.location.href = IE.urls.home), 1400);
  });

  socket.on("left_room", () => {
    IE.storage.reconnectToken = null;
    window.location.href = IE.urls.home;
  });

  /* Отхвърлено действие не променя състоянието, затова сървърът не излъчва
     нищо. Бутоните в централния панел обаче се самозаключват при щракане
     (защита от двойно изпращане) и без ново рисуване оставаха мъртви до
     следващото събитие — играчът изглеждаше блокиран точно когато бърза.
     Тостът идва от common.js; тук връщаме бутоните в употреба. */
  socket.on("error_message", () => {
    if (state.game && G.renderGame) G.renderGame();
  });

  /* ==========================================================
     Часовник, фази, дребни етикети
     ========================================================== */
  G.syncedServerNow = function syncedServerNow() {
    if (!state.serverClock) return Date.now() / 1000;
    return state.serverClock.serverTime
      + performance.now() / 1000
      - state.serverClock.receivedAt;
  };

  G.phaseLabel = function phaseLabel(phase) {
    const labels = {
      WAITING_FOR_ROLL: "хвърляне",
      ROLLING: "зарове",
      MOVING: "движение",
      RESOLVING_SPACE: "уреждане",
      AWAITING_PURCHASE: "покупка",
      AWAITING_AUCTION: "търг",
      AWAITING_PAYMENT: "плащане",
      AWAITING_MORTGAGE_DECISION: "решение за ипотеки",
      MANAGEMENT: "управление",
      END_TURN: "край на хода",
      GAME_OVER: "край на играта",
    };
    return labels[phase] || phase;
  };

  G.botStyleLabel = function botStyleLabel(style) {
    return ({ cautious: "предпазлив", balanced: "търговец", aggressive: "агресивен" })[style] || "търговец";
  };

  G.playerLabel = function playerLabel(pid) {
    if (!pid) return "Банката";
    const p = state.game && state.game.players[pid];
    return p ? p.name : "Банката";
  };

  G.playerColorFor = function playerColorFor(pid) {
    const p = pid && state.game && state.game.players[pid];
    return p ? IE.tokenColor(p.token) : "#c9803f";
  };

  /* Цвят на името, четим и на тъмен, и на светъл фон.

     Суровият цвят на жетона не става: черното изчезва в тъмния лог, а
     бялото — в кремавите панели. Затова връщаме два варианта и CSS избира
     според повърхността. */
  function shiftColor(hex, target, amount) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
      Math.max(0, Math.min(255, Math.round(c + (target - c) * amount)))
    );
    return "#" + parts.map((c) => c.toString(16).padStart(2, "0")).join("");
  }

  /* Свободен лимит по заема — огледало на GameEngine.loan_capacity.
     Служи само за показване; сървърът пресмята наново при отпускане. */
  G.LOAN_MAX_PERCENT = 50;
  G.loanCapacity = function loanCapacity(pid) {
    const g = state.game;
    const player = g && g.players[pid];
    if (!player) return 0;
    let assets = 0;
    for (const prop of Object.values(g.properties)) {
      if (prop.owner !== pid || prop.mortgaged) continue;
      const sp = BOARD.spaces[prop.position];
      assets += (sp.price || 0) + (prop.level || 0) * (sp.improve_cost || 0);
    }
    return Math.max(0, Math.floor(assets * G.LOAN_MAX_PERCENT / 100) - (player.loan || 0));
  };

  /* Обезпечението по заема — огледало на Player.collateral_value.
     За разлика от loanCapacity тук ипотекираните СЕ броят: банката държи
     акта, а ипотеката не го унищожава. Щом заемът надхвърли това число,
     банката иска целия остатък наведнъж. */
  G.collateralValue = function collateralValue(pid) {
    const g = state.game;
    if (!g || !g.players[pid]) return 0;
    let total = 0;
    for (const prop of Object.values(g.properties)) {
      if (prop.owner !== pid) continue;
      const sp = BOARD.spaces[prop.position];
      total += (sp.price || 0) + (prop.level || 0) * (sp.improve_cost || 0);
    }
    return total;
  };

  G.nameColors = function nameColors(pid) {
    const hex = G.playerColorFor(pid);
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return { light: hex, dark: hex };
    const n = parseInt(m[1], 16);
    const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    return {
      // На тъмен фон изсветляваме твърде тъмните цветове…
      light: lum < 120 ? shiftColor(hex, 255, (120 - lum) / 120 * 0.72) : hex,
      // …а на светъл затъмняваме твърде светлите.
      dark: lum > 150 ? shiftColor(hex, 0, (lum - 150) / 105 * 0.6) : hex,
    };
  };

  /* Оцветява имената на играчите в готов (вече екраниран) текст на лог.

     Сървърът екранира имената при влизане в стаята, затова текстът се
     третира като безопасен HTML — както прави и историята на ходовете. */
  G.colorizeNames = function colorizeNames(text) {
    const source = String(text ?? "");
    const g = state.game;
    if (!g || !g.players) return source;
    const players = Object.values(g.players)
      .filter((p) => p && p.name)
      // По-дългите първи: иначе „Иван" би разцепило „Иванка".
      .sort((a, b) => b.name.length - a.name.length);
    if (!players.length) return source;
    const byName = new Map();
    const parts = [];
    for (const p of players) {
      if (byName.has(p.name)) continue; // съименници: първият цвят печели
      byName.set(p.name, G.nameColors(p.player_id));
      parts.push(p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }
    // Границите пазят от разцепване: „Иван" не бива да оцвети „Иванка".
    // \b не върши работа за кирилица, затова са Unicode свойства.
    const boundary = "(?<![\\p{L}\\p{N}])(?:" + parts.join("|") + ")(?![\\p{L}\\p{N}])";
    // Едно преминаване, за да не се сканира вече вмъкнатият HTML.
    return source.replace(new RegExp(boundary, "gu"), (match) => {
      const colors = byName.get(match);
      return `<b class="log-name" style="--name-light:${colors.light};`
        + `--name-dark:${colors.dark}">${match}</b>`;
    });
  };

  // Дали цветът е светъл (за избор на контрастен ореол в графики).
  G.isLightColor = function isLightColor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return false;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    // Възприемана яркост (0..255).
    return (0.299 * r + 0.587 * gg + 0.114 * b) > 150;
  };

  /* Мастило за знак върху цветна лента: тъмно върху светъл цвят и обратно.
     Не са чисто черно и бяло — лентата е боядисана керамика, а не хартия. */
  G.bandInk = function bandInk(color) {
    return G.isLightColor(color) ? "rgba(28, 38, 52, 0.78)" : "rgba(255, 251, 240, 0.86)";
  };

  /* ==========================================================
     Имоти, групи, наеми — огледални проверки на сървърните правила
     ========================================================== */
  G.MAX_LEVEL = BOARD.improvement_levels.length - 1;
  G.HOUSE_POOL = 32;
  G.HOTEL_POOL = 12;

  G.territoryColor = function territoryColor(space) {
    if (space && space.group && BOARD.groups[space.group]) return BOARD.groups[space.group].color;
    if (space && space.type === "transport") return "#37475a";
    if (space && space.type === "utility") return "#287f9c";
    return "#647383";
  };

  G.propertyGroupPositions = function propertyGroupPositions(group) {
    return BOARD.spaces
      .filter((s) => s.type === "property" && s.group === group)
      .map((s) => s.position);
  };

  /* Има ли постройки в групата на имота (пречи на ипотека/размяна). */
  G.groupHasBuildings = function groupHasBuildings(g, group) {
    if (!group) return false;
    return G.propertyGroupPositions(group).some((pos) => {
      const st = g.properties[String(pos)];
      return st && st.level > 0;
    });
  };

  G.groupCompletionTargets = function groupCompletionTargets(playerId) {
    const targets = new Map();
    if (!state.game || !playerId) return targets;
    for (const groupId of Object.keys(BOARD.groups)) {
      const positions = G.propertyGroupPositions(groupId);
      if (positions.length < 2) continue;
      const missing = positions.filter((position) => {
        const prop = state.game.properties[String(position)];
        return !prop || prop.owner !== playerId;
      });
      if (missing.length !== 1) continue;
      const owned = positions
        .filter((position) => position !== missing[0])
        .map((position) => state.game.properties[String(position)]);
      targets.set(missing[0], {
        groupId,
        readyToBuild: owned.every((prop) => prop && !prop.mortgaged),
      });
    }
    return targets;
  };

  G.ownsFullGroupClient = function ownsFullGroupClient(g, ownerId, group) {
    return G.propertyGroupPositions(group).every((pos) => {
      const prop = g.properties[String(pos)];
      return prop && prop.owner === ownerId && !prop.mortgaged;
    });
  };

  /* Къщички (нива 1–4) и хотел (ниво 5) вместо ромбчета. */
  G.levelMarkup = function levelMarkup(level) {
    if (!level) return "";
    if (level >= G.MAX_LEVEL) return '<span class="mini-hotel" title="Гранд хотел"></span>';
    let html = "";
    for (let i = 0; i < level; i++) html += '<span class="mini-house"></span>';
    return html;
  };

  /* Свободни къщи и хотели в банката (огледално на сървъра). */
  G.bankStock = function bankStock(g) {
    let houses = 0, hotels = 0;
    for (const p of Object.values(g.properties)) {
      if (p.level >= 1 && p.level <= 4) houses += p.level;
      else if (p.level === 5) hotels += 1;
    }
    return { houses: G.HOUSE_POOL - houses, hotels: G.HOTEL_POOL - hotels };
  };

  G.canBuildHere = function canBuildHere(g, prop) {
    const sp = BOARD.spaces[prop.position];
    if (sp.type !== "property" || prop.mortgaged) return false;
    if (prop.level >= G.MAX_LEVEL) return false;
    for (const pos of G.propertyGroupPositions(sp.group)) {
      const st = g.properties[String(pos)];
      // Пълна група без ипотеки…
      if (!st || st.owner !== state.myId || st.mortgaged) return false;
      // …и равномерно строителство: никой имот с по-ниско ниво.
      if (pos !== prop.position && (st.level || 0) < prop.level) return false;
    }
    // Строителен фонд: къща за нива 1–4, хотел за ниво 5.
    const stock = G.bankStock(g);
    const target = prop.level + 1;
    if (target <= 4 && stock.houses < 1) return false;
    if (target === G.MAX_LEVEL && stock.hotels < 1) return false;
    return true;
  };

  /* Кога изобщо са позволени действията с имот.

     Общо за панела „Моите имоти" и за нотариалния акт — двете места
     предлагат едни и същи действия и не бива да се разминават. Пази и
     разграничението „при дълг": там води планът с един бутон, а отделните
     действия само пречат.

     `sellable` включва и фазата на плащане, защото точно тогава играчът
     набавя средства. `inMyDebt` е неговият собствен дълг. */
  G.propertyActionContext = function propertyActionContext() {
    const g = state.game;
    if (!g) return { manageable: false, sellable: false, myTurn: false, inMyDebt: false };
    const manageable = !g.paused
      && (g.phase === "MANAGEMENT" || g.phase === "WAITING_FOR_ROLL");
    return {
      manageable,
      sellable: !g.paused && (manageable || g.phase === "AWAITING_PAYMENT"),
      myTurn: g.current_player === state.myId,
      inMyDebt: g.phase === "AWAITING_PAYMENT" && !!g.debt && g.debt.debtor === state.myId,
    };
  };

  G.canSellHere = function canSellHere(g, prop) {
    const sp = BOARD.spaces[prop.position];
    if (sp.type !== "property" || prop.level <= 0) return false;
    for (const pos of G.propertyGroupPositions(sp.group)) {
      const st = g.properties[String(pos)];
      // Равномерност: продава се първо най-високото ниво в групата.
      if ((st ? st.level : 0) > prop.level) return false;
    }
    // Разваляне на хотел изисква 4 свободни къщи в банката.
    if (prop.level === G.MAX_LEVEL && G.bankStock(g).houses < 4) return false;
    return true;
  };

  /* ==========================================================
     Глобални събития и наеми
     ========================================================== */
  G.activeEventPercent = function activeEventPercent(modifier) {
    const event = state.game && state.game.active_global_event;
    return event && event.modifiers && Number.isFinite(+event.modifiers[modifier])
      ? +event.modifiers[modifier] : 100;
  };

  G.currentEventAmount = function currentEventAmount(amount, modifier) {
    return Math.max(0, Math.floor((amount * G.activeEventPercent(modifier) + 50) / 100));
  };

  G.currentBuildCost = function currentBuildCost(sp) {
    return G.currentEventAmount(sp.improve_cost || 0, "build_cost_percent");
  };

  /* Колко обекта от този тип притежава собственикът — за да се маркира
     редът от тарифата, който е в сила в момента. */
  G.countTypeOwned = function countTypeOwned(ownerId, spaceType) {
    const g = state.game;
    if (!g || !ownerId) return 0;
    return Object.values(g.properties).filter((prop) =>
      prop.owner === ownerId && BOARD.spaces[prop.position].type === spaceType
    ).length;
  };

  /* Дали активното събитие променя наема на този вид поле. */
  G.rentEventNote = function rentEventNote(spaceType) {
    const g = state.game;
    const event = g && g.active_global_event;
    if (!event) return "";
    const keys = ["rent_percent"];
    if (spaceType === "transport") keys.push("transport_rent_percent");
    if (spaceType === "utility") keys.push("utility_rent_percent");
    return keys.some((key) => G.activeEventPercent(key) !== 100) ? event.title : "";
  };

  G.applyGlobalRent = function applyGlobalRent(amount, spaceType) {
    let adjusted = G.currentEventAmount(amount, "rent_percent");
    if (spaceType === "transport") adjusted = G.currentEventAmount(adjusted, "transport_rent_percent");
    if (spaceType === "utility") adjusted = G.currentEventAmount(adjusted, "utility_rent_percent");
    return adjusted;
  };

  G.rentBreakdownFor = function rentBreakdownFor(sp, prop, ownerId, properties, diceTotal = null) {
    const g = state.game;
    if (sp.type === "property") {
      if (prop.level > 0) return { amount: G.applyGlobalRent(sp.rent[prop.level], sp.type), label: BOARD.improvement_levels[prop.level] };
      const group = G.propertyGroupPositions(sp.group);
      const complete = group.every((pos) => {
        const item = properties[String(pos)];
        return item && item.owner === ownerId && !item.mortgaged;
      });
      return { amount: G.applyGlobalRent(sp.rent[0] * (complete ? 2 : 1), sp.type), label: complete ? "Пълна група ×2" : "Основен наем" };
    }
    if (sp.type === "transport") {
      const count = Object.values(properties).filter((item) => item.owner === ownerId && BOARD.spaces[item.position].type === "transport").length;
      return {
        amount: G.applyGlobalRent(sp.rent[Math.max(0, count - 1)], sp.type),
        label: count === 1 ? "1 транспортен обект" : `${count} транспортни обекта`,
      };
    }
    const count = Object.values(properties).filter((item) => item.owner === ownerId && BOARD.spaces[item.position].type === "utility").length;
    const multiplier = sp.rent_multiplier[Math.max(0, count - 1)];
    const dice = diceTotal === null ? (g.last_roll || [3, 4]).reduce((a, b) => a + b, 0) : diceTotal;
    return { amount: G.applyGlobalRent(dice * multiplier, sp.type), label: `${dice} от заровете ×${multiplier}` };
  };

  G.rentBreakdown = function rentBreakdown(sp, prop, ownerId) {
    return G.rentBreakdownFor(sp, prop, ownerId, state.game.properties);
  };

  /* ==========================================================
     Пари, стойности, сделки — общи изчисления
     ========================================================== */
  G.banknoteDenominations = function banknoteDenominations(amount) {
    const denominations = [500, 100, 50, 20, 10, 5, 1];
    const splits = {
      500: [100, 100, 100, 100, 100],
      100: [50, 50],
      50: [20, 20, 10],
      20: [10, 5, 5],
      10: [5, 5],
      5: [1, 1, 1, 1, 1],
    };
    const notes = [];
    let remaining = Math.max(0, Math.floor(Math.abs(amount || 0)));
    for (const value of denominations) {
      while (remaining >= value && notes.length < 7) {
        notes.push(value);
        remaining -= value;
      }
    }
    if (!notes.length) notes.push(1);
    while (new Set(notes).size === 1 && notes[notes.length - 1] > 1) {
      const replacement = splits[notes[notes.length - 1]];
      if (!replacement || notes.length - 1 + replacement.length > 8) break;
      notes.pop();
      notes.push(...replacement);
    }
    return notes;
  };

  G.cashDenominationCounts = function cashDenominationCounts(amount) {
    let remaining = Math.max(0, Math.floor(amount || 0));
    return [500, 100, 50, 20, 10, 5, 1].map((value) => {
      const count = Math.floor(remaining / value);
      remaining %= value;
      return { value, count };
    }).filter((item) => item.count > 0);
  };

  G.netWorthFor = function netWorthFor(playerId, properties = state.game.properties, cash = null) {
    const player = state.game.players[playerId];
    if (!player) return 0;
    // Заемът се вади, както и на сървъра — иначе показваме измамно богатство.
    let total = (cash === null ? player.cash : cash) - (player.loan || 0);
    for (const prop of Object.values(properties)) {
      if (prop.owner !== playerId || prop.mortgaged) continue;
      const sp = BOARD.spaces[prop.position];
      total += sp.mortgage || 0;
      total += Math.floor((prop.level || 0) * (sp.improve_cost || 0) / 2);
    }
    return total;
  };

  G.clonePropertyStates = function clonePropertyStates() {
    return Object.fromEntries(
      Object.entries(state.game.properties).map(([position, prop]) => [position, { ...prop }])
    );
  };

  // Огледало на правилата от app/game/trading.py — двете трябва да съвпадат.
  G.TRADE_PREMIUM_LIMIT_PCT = 200;
  G.TRADE_PREMIUM_MIN = 150;
  G.TRADE_PREMIUM_TAX_PCT = 30;

  G.estimatedPropertyValue = function estimatedPropertyValue(pos) {
    const sp = BOARD.spaces[pos];
    const prop = state.game.properties[String(pos)];
    if (!sp || !prop) return 0;
    return Math.round(sp.price * (prop.mortgaged ? 0.55 : 1) + (prop.level || 0) * (sp.improve_cost || 0));
  };

  G.tradeMagnitude = function tradeMagnitude(trade) {
    if (!trade) return 0;
    const propertyValue = (positions) => (positions || []).reduce(
      (sum, pos) => sum + ((BOARD.spaces[pos] || {}).price || 0), 0,
    );
    return (trade.offer_cash || 0) + (trade.request_cash || 0)
      + propertyValue(trade.offer_properties) + propertyValue(trade.request_properties);
  };

  G.tradePerspective = function tradePerspective(trade) {
    const amSender = trade.from_player === state.myId || trade.to_player !== state.myId;
    return {
      otherId: amSender ? trade.to_player : trade.from_player,
      giveCash: amSender ? trade.offer_cash : trade.request_cash,
      receiveCash: amSender ? trade.request_cash : trade.offer_cash,
      outgoing: amSender ? trade.offer_properties : trade.request_properties,
      incoming: amSender ? trade.request_properties : trade.offer_properties,
      giveCards: amSender ? trade.offer_jail_cards : trade.request_jail_cards,
      receiveCards: amSender ? trade.request_jail_cards : trade.offer_jail_cards,
    };
  };
})();
