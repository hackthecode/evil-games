/* ============================================================
   Имоти и Империи — ui: изгледи, панели и модални прозорци.
   Превключване лоби/игра, централният панел, играчи, действия,
   имоти, дълг, портфейл, банка, история, известия, победа,
   таймери и настройки на екрана.
   ============================================================ */
"use strict";

(function () {
  const G = window.IEGame;
  if (!G) return;
  const { BOARD, socket, state } = G;

  /* Картите, които остават у играча между ходовете. Останалите се изиграват
     веднага; ефектите с продължение са модификатори, не карти.
     Двете „затворнически" карти не са еднакви: чиновническата се използва по
     избор, адвокатската се задейства сама. Иконата ги различава. */
  const JAIL_CARD_ICONS = { release: "🎫", shield: "🛡" };
  const JAIL_CARD_FALLBACK = {
    mode: "release",
    label: "Освобождаване от проверка",
    hint: "Използвате я по избор, докато сте на административна проверка.",
    text: "",
  };

  /* ==========================================================
     Изгледи: лоби ↔ игра
     ========================================================== */
  const lobbyView = IE.el("lobby-view");
  const gameView = IE.el("game-view");

  G.showView = function showView(name) {
    lobbyView.classList.toggle("hidden", name !== "lobby");
    gameView.classList.toggle("hidden", name !== "game");
    document.body.classList.toggle("board-popups", name === "game");
    if (name === "game") requestAnimationFrame(updateBoardPopupBounds);
  };

  function updateBoardPopupBounds() {
    if (!document.body.classList.contains("board-popups")) return;
    const center = document.querySelector(".board-center");
    if (!center) return;
    const rect = center.getBoundingClientRect();
    const margin = 5;
    const top = Math.max(0, Math.min(window.innerHeight, rect.top + margin));
    const right = Math.max(0, Math.min(window.innerWidth, window.innerWidth - rect.right + margin));
    const bottom = Math.max(0, Math.min(window.innerHeight, window.innerHeight - rect.bottom + margin));
    const left = Math.max(0, Math.min(window.innerWidth, rect.left + margin));
    document.documentElement.style.setProperty("--board-popup-top", `${top}px`);
    document.documentElement.style.setProperty("--board-popup-right", `${right}px`);
    document.documentElement.style.setProperty("--board-popup-bottom", `${bottom}px`);
    document.documentElement.style.setProperty("--board-popup-left", `${left}px`);
  }

  function revealBoardPopup(backdrop) {
    if (!document.body.classList.contains("board-popups")
        || backdrop.classList.contains("hidden")) return;
    if (backdrop.classList.contains("viewport-popup")) return;
    const center = document.querySelector(".board-center");
    if (!center) return;
    const rect = center.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      center.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
    }
    updateBoardPopupBounds();
    requestAnimationFrame(updateBoardPopupBounds);
  }

  const popupObserver = new MutationObserver((records) => {
    for (const record of records) revealBoardPopup(record.target);
  });
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    popupObserver.observe(backdrop, { attributes: true, attributeFilter: ["class"] });
  });
  window.addEventListener("resize", updateBoardPopupBounds);
  window.addEventListener("scroll", updateBoardPopupBounds, { passive: true });
  if (window.ResizeObserver) {
    const popupResizeObserver = new ResizeObserver(updateBoardPopupBounds);
    popupResizeObserver.observe(document.querySelector(".board-center"));
  }

  socket.on("game_started", (data) => {
    state.started = true;
    IE.sound.turn();
    // При реванш нулираме победния екран, за да започне играта наново.
    if (data && data.rematch) {
      victoryShown = false;
      IE.el("victory-modal").classList.add("hidden");
      IE.el("btn-rematch").disabled = false;
      const log = IE.el("log-entries");
      if (log) log.innerHTML = "";
      IE.toast("Нова игра! Успех.", "success");
    }
  });

  /* ==========================================================
     РЕНДЕРИРАНЕ НА ИГРАТА
     ========================================================== */
  G.renderGame = function renderGame() {
    const g = state.game;
    if (!g) return;

    // Централен панел
    const current = g.players[g.current_player];
    const myTurnNow = g.current_player === state.myId;
    IE.el("center-turn").innerHTML = current
      ? (myTurnNow ? '<b class="my-turn-text">Ти си на ход!</b>' : `Ред е на <b>${current.name}</b>`)
      : "";
    IE.el("center-round").textContent = `Рунд ${g.round_number} · Фаза: ${G.phaseLabel(g.phase)}`;
    renderGlobalEvent();
    renderMission();
    renderPauseState();
    if (g.last_roll) G.showDice(g.last_roll[0], g.last_roll[1], false);
    updateTurnTimer();

    // Кликаеми зарове: светят, когато е твой ред да хвърлиш.
    const me = g.players[state.myId];
    const canRoll = !g.paused && myTurnNow && g.phase === "WAITING_FOR_ROLL" && !g.winner
      && !state.isSpectator && me && !me.bankrupt;
    IE.el("dice-area").classList.toggle("rollable", !!canRoll);
    IE.el("dice-area").setAttribute("aria-disabled", String(!canRoll));

    renderDecks();

    // Играчи
    renderPlayers();
    renderControlBar();
    G.updateBoardOwnership();
    G.syncTokens();
    if (current) G.highlightSpace(current.position);

    // Логът се пресъздава от обработчика на game_update, когато пристигне
    // пълно състояние (влизане, връщане, ръчна синхронизация). Тук няма
    // какво да се прави: обичайните обновявания вече не носят лога.

    // Строителен фонд на банката.
    const stock = G.bankStock(g);
    IE.el("center-stock").innerHTML =
      `<span class="mini-house"></span> ${stock.houses} · <span class="mini-hotel"></span> ${stock.hotels}`;
    const pot = IE.el("center-bank-pot");
    pot.classList.toggle("hidden", !g.settings.free_parking_jackpot);
    pot.textContent = `Свободен престой: ${IE.fmt(g.bank_pot || 0)}`;
    renderBankInterface(stock);
    // Балончето за заем важи само докато сте пред решение за покупка.
    if (g.phase !== "AWAITING_PURCHASE") hideLoanPrompt();

    renderActions();
    renderMyProperties();
    // Отвореният нотариален акт следва състоянието — нивото се вижда
    // веднага след строеж, без да се затваря модалът.
    G.refreshOpenDeed();
    G.renderAuction();
    G.renderTrades();
    renderDebt();
    renderMortgageTransfer();
    renderCardChoice();
    renderNotificationBadge();
    renderVictory();
    G.updateTurnAlert();
    if (!IE.el("portfolio-modal").classList.contains("hidden")) renderPortfolio();
    if (!IE.el("history-modal").classList.contains("hidden")) {
      // Отвореният прозорец следи играта — заявява наново само за този
      // играч, вместо всички да носят протокола постоянно.
      socket.emit("request_history", {});
    }
    if (!statsModal.classList.contains("hidden")) renderPlayerStats();
  };

  function renderGlobalEvent() {
    const g = state.game;
    const banner = IE.el("global-event-banner");
    const event = g.active_global_event;
    banner.classList.toggle("hidden", !event);
    if (!event) return;
    IE.el("global-event-icon").textContent = event.icon || "🌍";
    IE.el("global-event-title").textContent = event.title;
    IE.el("global-event-description").textContent = event.description;
    const remaining = Math.max(1, (event.ends_round || g.round_number + 1) - g.round_number);
    IE.el("global-event-duration").textContent = `Оставащи рундове: ${remaining}`;
  }

  function renderMission() {
    const mission = state.game.my_mission;
    const panel = IE.el("mission-panel");
    panel.classList.toggle("hidden", !mission || state.isSpectator);
    if (!mission || state.isSpectator) return;
    panel.classList.toggle("completed", !!mission.completed);
    IE.el("mission-title").textContent = mission.title;
    IE.el("mission-description").textContent = mission.description;
    IE.el("mission-progress-text").textContent = mission.completed
      ? "Изпълнена" : `${mission.current} / ${mission.target} ${mission.unit}`;
    IE.el("mission-bonus").textContent = mission.completed
      ? `Получени ${IE.fmt(mission.bonus)}` : `Бонус ${IE.fmt(mission.bonus)}`;
    const percent = mission.completed ? 100 : Math.min(100, mission.current / Math.max(1, mission.target) * 100);
    IE.el("mission-progress-bar").style.width = `${percent}%`;
  }

  function renderPauseState() {
    const g = state.game;
    const paused = !!(g && g.paused);
    const overlay = IE.el("pause-overlay");
    const button = IE.el("btn-pause-game");
    overlay.classList.toggle("hidden", !paused);
    button.classList.toggle("hidden", !state.isHost || !!g.winner);
    // Панелът на домакина остава достъпен и на пауза — част от смисъла му е
    // именно да се възобнови оттам.
    IE.el("btn-admin-panel").classList.toggle("hidden", !state.isHost);
    if (G.renderAdminPanel) G.renderAdminPanel();
    button.textContent = paused ? "▶" : "⏸";
    button.title = paused ? "Възобнови играта" : "Постави играта на пауза";
    button.setAttribute("aria-label", button.title);
    button.classList.toggle("is-resume", paused);
    if (!paused) return;
    for (const id of ["trade-modal", "action-preview-modal", "info-modal", "confirm-modal"]) {
      IE.el(id).classList.add("hidden");
    }
    const host = g.paused_by && g.players[g.paused_by];
    IE.el("pause-detail").textContent = host
      ? `${host.name} постави играта на пауза.`
      : "Домакинът постави играта на пауза.";
    IE.el("pause-hint").textContent = state.isHost
      ? "Натиснете ▶ горе, за да продължите."
      : "Таймерите ще продължат, когато домакинът възобнови партията.";
  }

  IE.el("btn-pause-game").addEventListener("click", () => {
    socket.emit("host_toggle_pause", {});
  });

  function renderPlayers() {
    const g = state.game;
    const panel = IE.el("players-panel");
    panel.innerHTML = "";
    // Голяма стая — сбит вид, за да се побират повече карти без скролиране.
    panel.classList.toggle("compact", g.turn_order.length > 6);
    for (const [orderIndex, pid] of g.turn_order.entries()) {
      const p = g.players[pid];
      if (!p) continue;
      const card = document.createElement("div");
      card.className = "player-card";
      card.dataset.playerCard = pid;
      if (pid === g.current_player) card.classList.add("current");
      if (p.bankrupt) card.classList.add("bankrupt");
      /* Флаговете като значки, а не като изречение.

         Дългият текстов ред („♂ мъж · неактивни ходове: 3 · домакин")
         се пренасяше на три реда и правеше картата висока, а името в
         същото време оставаше отрязано. Числата се пазят във видимия
         надпис — броят неактивни ходове е условието, при което домакинът
         получава бутона за премахване, а размерът на заема е сума, не
         превключвател. Пълното описание стои в `title`. */
      const flags = [];
      const addFlag = (icon, label, extra) => flags.push(
        `<span class="pc-flag${extra ? " " + extra : ""}" title="${IE.escapeHtml(label)}">`
        + `${icon}</span>`,
      );
      // „(вие)" е значка, а не част от името: като суфикс отнемаше около
      // 45px точно от елемента, който се съкращава.
      if (pid === state.myId) addFlag("вие", "Това сте вие", "is-me");
      addFlag(
        p.gender === "female" ? "♀" : "♂",
        p.gender === "female" ? "Жена" : "Мъж",
      );
      if (p.is_host) addFlag("👑", "Домакин");
      if (p.is_bot) addFlag("🤖", `Бот · ${G.botStyleLabel(p.bot_style)}`);
      if (p.in_jail) addFlag("🚔", "На административна проверка", "is-warn");
      if (!p.connected) addFlag("⚡", "Извън линия", "is-warn");
      const inactiveTurns = +(p.stats && p.stats.consecutive_timeouts) || 0;
      if (inactiveTurns) {
        addFlag(
          `⏳${inactiveTurns}`,
          `Неактивни ходове: ${inactiveTurns}`
          + (inactiveTurns >= 2 ? " — домакинът може да премахне играча" : ""),
          "is-warn",
        );
      }
      if (p.loan > 0) {
        addFlag(`🏦${IE.fmt(p.loan)}`, `Заем: ${IE.fmt(p.loan)}`, "is-loan");
      }
      const disc = (g.disconnections || {})[pid];
      const reconnectHtml = (!p.connected && !p.is_bot && disc)
        ? `<div class="pc-reconnect" data-deadline="${disc.deadline}" data-paused-remaining="${disc.paused_remaining ?? ""}"></div>`
        : "";
      if (reconnectHtml) card.classList.add("disconnected");
      // Картите в ръката като икони под името. Всяка си носи обяснението в
      // title, за да го видят и останалите играчи при посочване.
      // Описанието стои в data-атрибути; балончето го чете при посочване.
      // Вграденият title нарочно е махнат — бави се и не се оформя.
      const chips = [];
      // По-старите състояния носят само брой — тогава показваме основния вид.
      const jailCards = p.jail_cards
        || Array.from({ length: p.get_out_cards || 0 }, () => JAIL_CARD_FALLBACK);
      for (const jc of jailCards) {
        const icon = JAIL_CARD_ICONS[jc.mode] || JAIL_CARD_ICONS.release;
        chips.push(`<span class="pc-card-chip" tabindex="0" role="img"
              data-tip-title="${IE.escapeHtml(jc.label)}"
              data-tip-hint="${IE.escapeHtml(jc.hint)}"
              data-tip-text="${IE.escapeHtml(jc.text || "")}"
              aria-label="Карта „${IE.escapeHtml(jc.label)}“">${icon}</span>`);
      }
      for (const card of p.held_cards || []) {
        const delta = card.percent - 100;
        const uses = card.uses_left > 1 ? ` · ${card.uses_left} пъти` : "";
        chips.push(`<span class="pc-card-chip ${card.good ? "is-good" : "is-bad"}"
              tabindex="0" role="img"
              data-tip-title="${IE.escapeHtml(card.label)} (${delta > 0 ? "+" : "−"}${Math.abs(delta)}%${uses})"
              data-tip-hint="${IE.escapeHtml(card.hint)}"
              data-tip-text="${IE.escapeHtml(card.text)}"
              data-tip-bad="${card.good ? "" : "1"}"
              aria-label="Карта „${IE.escapeHtml(card.label)}“">${card.good ? "🎟" : "⚠"}</span>`);
      }
      const heldHtml = chips.length ? `<div class="pc-cards">${chips.join("")}</div>` : "";
      /* Номерът на реда излиза ИЗВЪН .pc-name: беше вътре в елемента, който
         се съкращава, и изяждаше около една трета от ширината му. Сумата
         слиза на свой ред под името — така цялата ширина на картата остава
         за името, вместо да се дели с нея. */
      card.innerHTML = `
        <div class="pc-token" style="background:${IE.tokenColor(p.token)}22;color:${IE.tokenColor(p.token)}">${IE.tokenSvg(p.token, p.gender, p)}</div>
        <span class="pc-order">${orderIndex + 1}</span>
        <div class="pc-info">
          <div class="pc-name" title="${IE.escapeHtml(p.name)}">${p.name}</div>
          <div class="pc-meta">
            <span class="pc-cash">${IE.fmt(p.cash)}</span>
            <span class="pc-flags">${flags.join("")}</span>
          </div>
          ${heldHtml}
          ${reconnectHtml}
        </div>`;
      // Домакински контроли за изключени или два пъти неактивни играчи.
      const canRemoveForInactivity = inactiveTurns >= 2;
      if (state.isHost && !g.paused && !p.bankrupt && pid !== state.myId
          && (!p.connected || canRemoveForInactivity)) {
        const controls = document.createElement("div");
        controls.style.cssText = "display:flex;flex-direction:column;gap:3px";
        if (!p.connected) {
          const skipBtn = document.createElement("button");
          skipBtn.className = "btn-ghost";
          skipBtn.style.cssText = "font-size:0.65rem;padding:2px 7px";
          skipBtn.textContent = "Пропусни";
          skipBtn.onclick = () => socket.emit("host_skip_turn", { player_id: pid });
          controls.appendChild(skipBtn);
        }
        const kickBtn = document.createElement("button");
        kickBtn.className = "btn-ghost";
        kickBtn.style.cssText = "font-size:0.65rem;padding:2px 7px";
        kickBtn.textContent = canRemoveForInactivity ? "Премахни · неактивен" : "Премахни";
        kickBtn.onclick = () => {
          G.confirmAction({
            title: "Премахване на играч",
            body: [
              `Наистина ли премахвате ${p.name} от партията?`,
              "Имотите се връщат на банката и стават свободни за всички.",
            ],
            confirmLabel: "Премахни",
            danger: true,
            onConfirm: () => socket.emit("host_remove_player", { player_id: pid }),
          });
        };
        controls.appendChild(kickBtn);
        card.appendChild(controls);
      }
      panel.appendChild(card);
    }
  }

  /* ----------------------------------------------------------
     Лента на контрола — дял от имотите в цветовите групи

     Само 22-та имота от осемте групи; транспортните и комуналните обекти
     нарочно остават извън сметката, защото не се застрояват и не влизат
     в „квартал". Незаетите имоти имат свой дял — иначе в началото на
     партията лентата би показала пълно владение от двама играчи.
     ---------------------------------------------------------- */
  const COLOR_PROPERTY_COUNT = BOARD.spaces.filter((sp) => sp.type === "property").length;

  function renderControlBar() {
    const g = state.game;
    const bar = IE.el("control-bar");
    if (!bar) return;
    if (!COLOR_PROPERTY_COUNT) {
      bar.classList.add("hidden");
      return;
    }
    const counts = new Map();
    for (const prop of Object.values(g.properties)) {
      if (!prop.owner) continue;
      if (BOARD.spaces[prop.position].type !== "property") continue;
      const owner = g.players[prop.owner];
      if (!owner || owner.bankrupt) continue;
      counts.set(prop.owner, (counts.get(prop.owner) || 0) + 1);
    }
    const segments = g.turn_order
      .filter((pid) => counts.has(pid))
      .map((pid) => ({ pid, count: counts.get(pid) }));
    const owned = segments.reduce((sum, item) => sum + item.count, 0);
    const free = COLOR_PROPERTY_COUNT - owned;

    const html = segments.map(({ pid, count }) => {
      const player = g.players[pid];
      const percent = (count * 100 / COLOR_PROPERTY_COUNT).toFixed(2);
      // Светлият вариант на цвета — суровият цвят на жетона потъва в
      // тъмния панел при тъмните фигурки.
      const color = G.nameColors(pid).light;
      const label = `${player.name}: ${count} от ${COLOR_PROPERTY_COUNT}`;
      // Бутон, не span: дялът отваря картата на играча, а с role="group"
      // отгоре четецът стига до всеки дял поотделно.
      return `<button type="button" class="cb-seg" data-control-player="${IE.escapeHtml(pid)}"
        style="width:${percent}%;background:${color}"
        title="${IE.escapeHtml(label)}" aria-label="${IE.escapeHtml(label)}"
        >${count >= 2 ? count : ""}</button>`;
    }).join("");
    const freeHtml = free > 0
      ? `<span class="cb-seg cb-free" style="width:${(free * 100 / COLOR_PROPERTY_COUNT).toFixed(2)}%"
          title="Свободни: ${free} от ${COLOR_PROPERTY_COUNT}">${free >= 2 ? free : ""}</span>`
      : "";
    bar.innerHTML = html + freeHtml;
    bar.classList.toggle("hidden", !segments.length);
  }

  /* ----------------------------------------------------------
     Тестетата в центъра — колко карти остават

     Сървърът праща само броя (deck_counts), не съдържанието. Освен
     числото се променя и дебелината на купчината: три степени, за да личи
     от разстояние кога тестето ще се разбърка.
     ---------------------------------------------------------- */
  const DECK_NAMES = { community: "Обществено събитие", business: "Бизнес възможност" };

  function renderDecks() {
    const counts = state.game.deck_counts;
    if (!counts) return;
    for (const deckId of Object.keys(DECK_NAMES)) {
      const entry = counts[deckId];
      const pile = IE.el(`deck-${deckId}`);
      const label = IE.el(`deck-count-${deckId}`);
      if (!entry || !pile || !label) continue;
      const left = entry.draw;
      const total = entry.draw + entry.discard;
      label.textContent = `${left}/${total}`;
      // Изчерпи ли се тестето, изиграните карти се разбъркват наново —
      // затова „остават 0" не значи „край на картите". Описанието влиза в
      // aria-label, а не в title: .deck-pile е с pointer-events: none и
      // балонче при посочване така или иначе не се появява.
      pile.setAttribute("aria-label", left
        ? `Тесте „${DECK_NAMES[deckId]}“: остават ${left} от ${total} карти`
        : `Тесте „${DECK_NAMES[deckId]}“: следващото теглене разбърква изиграните`);
      pile.classList.toggle("deck-medium", left > 0 && left <= total * 0.6);
      pile.classList.toggle("deck-low", left > 0 && left <= total * 0.25);
      pile.classList.toggle("deck-empty", left === 0);
    }
  }

  /* ----------------------------------------------------------
     Карта на играча — статистиката, събирана през цялата партия

     Числата вече идват в състоянието (Player.to_client), но досега се
     виждаха единствено в крайния отчет.
     ---------------------------------------------------------- */
  let statsPlayerId = null;
  const statsModal = IE.el("player-stats-modal");

  function statValue(player, key) {
    return +(player.stats && player.stats[key]) || 0;
  }

  function renderPlayerStats() {
    const g = state.game;
    const p = g && statsPlayerId ? g.players[statsPlayerId] : null;
    if (!p) {
      closePlayerStats();
      return;
    }
    IE.el("player-stats-token").innerHTML = IE.tokenSvg(p.token, p.gender, p);
    IE.el("player-stats-token").style.background = `${IE.tokenColor(p.token)}22`;
    IE.el("player-stats-name").textContent = p.name + (p.player_id === state.myId ? " (вие)" : "");

    const flags = [];
    if (p.is_bot) flags.push(`бот · ${G.botStyleLabel(p.bot_style)}`);
    if (p.bankrupt) flags.push("фалирал");
    if (p.in_jail) flags.push("на проверка");
    if (p.loan > 0) flags.push(`заем: ${IE.fmt(p.loan)}`);
    if (!p.connected) flags.push("извън линия");
    IE.el("player-stats-flags").textContent = flags.join(" · ");

    const owned = Object.values(g.properties).filter((prop) => prop.owner === p.player_id);
    const mortgaged = owned.filter((prop) => prop.mortgaged).length;
    const buildings = owned.reduce((sum, prop) => sum + (prop.level || 0), 0);
    const rolls = statValue(p, "dice_rolls");
    const avgRoll = rolls ? (statValue(p, "dice_pips") / rolls).toFixed(1) : "—";

    const groups = [
      ["Състояние", [
        ["Пари в брой", IE.fmt(p.cash)],
        ["Нетна стойност", IE.fmt(G.netWorthFor(p.player_id))],
        ["Най-много пари", IE.fmt(statValue(p, "max_cash"))],
        ["Имоти", `${owned.length}${mortgaged ? ` · ${mortgaged} ипотекирани` : ""}`],
        ["Построени нива", String(buildings)],
        ["Купени от банката", String(statValue(p, "properties_bought"))],
      ]],
      ["Пари в движение", [
        ["Събран наем", IE.fmt(statValue(p, "rent_collected"))],
        ["Платен наем", IE.fmt(statValue(p, "rent_paid"))],
        ["Платено на банката", IE.fmt(statValue(p, "bank_paid"))],
        ["Постъпления", IE.fmt(statValue(p, "cash_received"))],
        ["Сключени сделки", String(statValue(p, "trades_completed"))],
      ]],
      ["Път и зарове", [
        ["Обиколки", String(statValue(p, "laps"))],
        ["Хвърляния", String(rolls)],
        ["Среден зар", avgRoll],
        ["Дубли", String(statValue(p, "doubles"))],
        ["Изпълнени мисии", String(statValue(p, "missions_completed"))],
      ]],
    ];
    IE.el("player-stats-grid").innerHTML = groups.map(([title, rows]) => `
      <section class="ps-group">
        <h4>${title}</h4>
        ${rows.map(([label, value]) => `
          <div class="ps-row"><span>${label}</span><strong>${value}</strong></div>`).join("")}
      </section>`).join("");
  }

  function closePlayerStats() {
    statsPlayerId = null;
    statsModal.classList.add("hidden");
  }

  G.showPlayerStats = function showPlayerStats(pid) {
    if (!state.game || !state.game.players[pid]) return;
    statsPlayerId = pid;
    statsModal.classList.remove("hidden");
    renderPlayerStats();
  };

  // Делегиране: картите на играчите се пресъздават при всяко прерисуване.
  // Бутоните на домакина и чиповете с карти пазят собственото си действие.
  IE.el("players-panel").addEventListener("click", (event) => {
    if (event.target.closest("button, .pc-card-chip")) return;
    const card = event.target.closest("[data-player-card]");
    if (card) G.showPlayerStats(card.dataset.playerCard);
  });
  // Дял от лентата на контрола → картата на същия играч.
  IE.el("control-bar").addEventListener("click", (event) => {
    const seg = event.target.closest("[data-control-player]");
    if (seg) G.showPlayerStats(seg.dataset.controlPlayer);
  });
  IE.el("player-stats-close").addEventListener("click", closePlayerStats);
  statsModal.addEventListener("click", (event) => {
    if (event.target === statsModal) closePlayerStats();
  });

  /* ----------------------------------------------------------
     Бутони за действия според фазата
     ---------------------------------------------------------- */
  function renderActions() {
    const g = state.game;
    const sidePanel = IE.el("actions-panel");
    const centerPanel = IE.el("center-actions");
    sidePanel.innerHTML = "";
    centerPanel.innerHTML = "";
    if (g.paused) {
      sidePanel.innerHTML = '<div class="actions-paused">⏸ Действията са спрени до възобновяване на партията.</div>';
      return;
    }
    if (state.isSpectator || g.winner) return;
    const me = g.players[state.myId];
    if (!me || me.bankrupt) return;
    const myTurn = g.current_player === state.myId;

    const add = (target, label, cls, handler, disabled = false) => {
      const b = document.createElement("button");
      b.className = "btn " + cls;
      b.textContent = label;
      b.disabled = disabled;
      b.addEventListener("click", (event) => {
        if (target === centerPanel) {
          centerPanel.querySelectorAll("button").forEach((button) => { button.disabled = true; });
        }
        handler(event);
      });
      target.appendChild(b);
      return b;
    };
    const addCenter = (label, cls, handler, disabled = false) =>
      add(centerPanel, label, cls, handler, disabled);
    const addSide = (label, cls, handler, disabled = false) =>
      add(sidePanel, label, cls, handler, disabled);

    if (myTurn && g.phase === "WAITING_FOR_ROLL") {
      if (me.in_jail) {
        addCenter("🎲 Опитай с чифт", "btn-roll", () => socket.emit("roll_dice", {}));
        addCenter(`Плати такса (${IE.fmt(g.settings.jail_fee)})`, "btn-secondary",
          () => socket.emit("pay_jail_fee", {}), me.cash < g.settings.jail_fee);
        // Само чиновническата карта освобождава по избор; адвокатската
        // действа предварително и вече не помага.
        const canRelease = (me.jail_cards || []).some((c) => c.mode === "release")
          || (!me.jail_cards && me.get_out_cards > 0);
        if (canRelease) {
          addCenter("Използвай карта", "btn-secondary", () => socket.emit("use_jail_card", {}));
        }
      } else {
        addCenter("🎲 Хвърли заровете", "btn-roll", () => socket.emit("roll_dice", {}));
      }
    }

    if (myTurn && g.phase === "AWAITING_PURCHASE") {
      const sp = BOARD.spaces[me.position];
      addCenter(`Купи „${sp.name}" (${IE.fmt(sp.price)})`, "btn-primary",
        () => socket.emit("buy_property", {}), me.cash < sp.price);
      // Заем при недостиг — бутонът се показва САМО ако лимитът стига.
      const need = sp.price - me.cash;
      if (need > 0 && g.settings.loans_enabled
          && G.loanCapacity(state.myId) >= need) {
        addCenter(
          `🏦 Заеми ${IE.fmt(need)} и купи`,
          "btn-secondary",
          () => showLoanPrompt(need, sp),
        );
      }
      addCenter("Откажи", "btn-secondary", () => socket.emit("decline_purchase", {}));
    }

    if (myTurn && g.phase === "MANAGEMENT") {
      addCenter("Край на хода", "btn-end", () => socket.emit("end_turn", {}));
    }

    if (g.phase === "AWAITING_PAYMENT" && g.debt && g.debt.debtor === state.myId) {
      const plan = g.debt_advice;
      if (plan && plan.actions.length) {
        if (plan.covers) {
          // Точното съдържание стои в надписа — това е информираното
          // съгласие вместо още един потвърждаващ модал.
          addCenter(
            `⚡ ${G.planSummary(plan)} → плати ${IE.fmt(g.debt.amount)}`,
            "btn-secondary",
            () => socket.emit("settle_debt_with_plan", {}),
          );
        } else {
          // Тук планът НЕ стига — затова питаме: разпродажбата е
          // необратима, а изходът остава сделка или фалит.
          addCenter(
            `⚡ ${G.planSummary(plan)} (+${IE.fmt(plan.raised)})`,
            "btn-secondary",
            () => {
              const missing = g.debt.amount - me.cash - plan.raised;
              G.confirmAction({
                title: "Набавяне на средства",
                body: [
                  `${G.planSummary(plan)} наведнъж?`,
                  `Ще наберете ${IE.fmt(plan.raised)}, но пак ще не достигат `
                  + `${IE.fmt(missing)}.`,
                  "Действието е необратимо — след него ви трябва сделка с "
                  + "друг играч или фалит.",
                ],
                confirmLabel: "Набави",
                danger: true,
                onConfirm: () => socket.emit("raise_funds", {}),
              });
            },
          );
        }
      }
      addCenter(`Плати ${IE.fmt(g.debt.amount)}`, "btn-primary",
        () => socket.emit("settle_debt", {}), me.cash < g.debt.amount);
      addCenter("Обяви фалит", "btn-danger", () => {
        G.confirmAction({
          title: "Обявяване на фалит",
          body: [
            "Наистина ли обявявате фалит?",
            "Излизате от партията и активите ви отиват при кредитора или "
            + "на търг. Действието е необратимо.",
          ],
          confirmLabel: "Обяви фалит",
          danger: true,
          onConfirm: () => socket.emit("declare_bankruptcy", {}),
        });
      });
    }

    if (g.settings.trading_enabled &&
        (g.phase === "MANAGEMENT" || g.phase === "WAITING_FOR_ROLL")) {
      addSide("🤝 Предложи сделка", "btn-ghost", () => G.openTradeModal());
    }

    // Погасяване на заема — винаги достъпно, когато има какво да се плати.
    if (me && me.loan > 0 && !state.isSpectator
        && (g.phase === "MANAGEMENT" || g.phase === "WAITING_FOR_ROLL")) {
      const payable = Math.min(me.loan, me.cash);
      addSide(
        `🏦 Погаси заем (${IE.fmt(me.loan)})`, "btn-ghost",
        () => socket.emit("repay_loan", {}), payable <= 0,
      );
    }

    if (state.isHost) {
      addSide("💾 Запази играта", "btn-ghost", () => socket.emit("host_save_game", {}));
    }
  }

  /* ----------------------------------------------------------
     Заем: балонче за потвърждение над заровете
     ---------------------------------------------------------- */
  const loanPrompt = IE.el("loan-prompt");

  function hideLoanPrompt() { loanPrompt.classList.add("hidden"); }

  function showLoanPrompt(amount, space) {
    const g = state.game;
    const me = g.players[state.myId];
    const percent = g.settings.loan_interest_percent;
    const grace = g.settings.loan_grace_laps ?? 10;
    const capacity = G.loanCapacity(state.myId);
    IE.el("loan-prompt-body").innerHTML =
      `За „${space.name}“ не достигат <b>${IE.fmt(amount)}</b>. `
      + `Банката ги отпуска срещу залог на имотите ви.<br>`
      + `На всяка ваша пълна обиколка дължите <b>${percent}%</b> лихва `
      + `в брой. Без пари за нея тя се добавя към дълга, но само през `
      + `първите <b>${grace}</b> обиколки — после трябва да продавате.<br>`
      + `Ако дългът надрасне стойността на имотите ви, банката иска `
      + `целия остатък наведнъж.<br>`
      + `Свободен лимит след този заем: <b>${IE.fmt(capacity - amount)}</b>`
      + (me.loan ? ` · текущ дълг: <b>${IE.fmt(me.loan)}</b>` : "");
    IE.el("loan-prompt-confirm").onclick = () => {
      hideLoanPrompt();
      socket.emit("take_loan", { amount });
      socket.emit("buy_property", {});
    };
    loanPrompt.classList.remove("hidden");
  }

  IE.el("loan-prompt-cancel").addEventListener("click", hideLoanPrompt);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideLoanPrompt();
  });

  /* ----------------------------------------------------------
     Балонче за картите под имената на играчите
     ---------------------------------------------------------- */
  const chipTip = IE.el("chip-tip");

  function showChipTip(chip) {
    const title = chip.dataset.tipTitle || "";
    if (!title) return;
    IE.el("chip-tip-title").textContent = title;
    const hint = IE.el("chip-tip-hint");
    hint.textContent = chip.dataset.tipHint || "";
    hint.classList.toggle("hidden", !chip.dataset.tipHint);
    const text = IE.el("chip-tip-text");
    text.textContent = chip.dataset.tipText || "";
    text.classList.toggle("hidden", !chip.dataset.tipText);
    chipTip.classList.toggle("is-bad", !!chip.dataset.tipBad);
    chipTip.classList.remove("hidden");
    chipTip.setAttribute("aria-hidden", "false");

    // Позицията се мери чак след показването, за да са известни размерите.
    const anchor = chip.getBoundingClientRect();
    const box = chipTip.getBoundingClientRect();
    const margin = 8;
    let left = anchor.left + anchor.width / 2 - box.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - box.width - margin));
    // Отгоре, ако има място; иначе отдолу.
    let top = anchor.top - box.height - 6;
    if (top < margin) top = anchor.bottom + 6;
    chipTip.style.left = `${Math.round(left)}px`;
    chipTip.style.top = `${Math.round(top)}px`;
  }

  function hideChipTip() {
    chipTip.classList.add("hidden");
    chipTip.setAttribute("aria-hidden", "true");
  }

  // Делегиране: панелът се пререндира често, слушателите остават на документа.
  document.addEventListener("mouseover", (event) => {
    const chip = event.target.closest && event.target.closest(".pc-card-chip");
    if (chip) showChipTip(chip);
  });
  document.addEventListener("mouseout", (event) => {
    if (event.target.closest && event.target.closest(".pc-card-chip")) hideChipTip();
  });
  document.addEventListener("focusin", (event) => {
    const chip = event.target.closest && event.target.closest(".pc-card-chip");
    if (chip) showChipTip(chip);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest && event.target.closest(".pc-card-chip")) hideChipTip();
  });
  window.addEventListener("scroll", hideChipTip, true);

  /* ----------------------------------------------------------
     Моите имоти: строеж, ипотека
     ---------------------------------------------------------- */
  function renderMyProperties() {
    const g = state.game;
    const box = IE.el("my-props");
    const countEl = IE.el("my-props-count");
    box.innerHTML = "";
    if (countEl) countEl.textContent = "";
    if (state.isSpectator) return;
    const me = g.players[state.myId];
    if (!me || me.bankrupt) return;
    const mine = Object.values(g.properties).filter((p) => p.owner === state.myId);
    if (countEl) countEl.textContent = mine.length ? String(mine.length) : "";
    if (!mine.length) {
      box.innerHTML = '<div class="my-props-empty">Още нямате имоти.<span>Спрете на свободен курорт и го купете, за да сложите начало на империята.</span></div>';
      return;
    }
    // Предикатите са общи с нотариалния акт (G.propertyActionContext в
    // core.js) — двете места предлагат едни и същи действия.
    // При собствен дълг бутоните за набавяне на средства се показват винаги —
    // неактивни с обяснение защо, вместо да изчезват безследно.
    const { manageable, sellable, myTurn, inMyDebt } = G.propertyActionContext();

    // Защо не може да се продаде подобрение (огледално на сървъра).
    const sellBlockReason = (prop) => {
      const sp = BOARD.spaces[prop.position];
      if (sp.type !== "property" || !prop.level) return null;
      for (const pos of G.propertyGroupPositions(sp.group)) {
        const st = g.properties[String(pos)];
        if ((st ? st.level : 0) > prop.level) {
          return "Първо продайте по-високото ниво в групата — строежът е равномерен.";
        }
      }
      if (prop.level === G.MAX_LEVEL && G.bankStock(g).houses < 4) {
        return "За разваляне на хотела са нужни 4 свободни къщи в банката.";
      }
      return "";
    };

    const completionTargets = G.groupCompletionTargets(state.myId);
    if (completionTargets.size) {
      const goals = document.createElement("div");
      goals.className = "group-completion-goals";
      goals.innerHTML = "<strong>★ До отключване на строеж:</strong>";
      for (const [position, target] of completionTargets) {
        const sp = BOARD.spaces[position];
        const group = BOARD.groups[target.groupId];
        const prop = g.properties[String(position)];
        const owner = prop && prop.owner ? g.players[prop.owner] : null;
        const button = document.createElement("button");
        button.type = "button";
        button.style.setProperty("--territory-color", group.color);
        button.innerHTML = `<i></i><span><b>${sp.name}</b><small>${group.name} · ${owner ? `поискайте от ${owner.name}` : "закупете при стъпване"}</small></span>`;
        button.onclick = () => G.showSpaceInfo(position);
        goals.appendChild(button);
      }
      box.appendChild(goals);
    }

    // Групово строене: по един бутон за всяка развиваема пълна група.
    if (manageable && myTurn) {
      const buildableGroups = new Map();
      for (const prop of mine) {
        const sp = BOARD.spaces[prop.position];
        if (sp.type !== "property" || !sp.group) continue;
        if (buildableGroups.has(sp.group)) continue;
        if (G.canBuildHere(g, prop)) buildableGroups.set(sp.group, sp.group);
      }
      if (buildableGroups.size) {
        const wrap = document.createElement("div");
        wrap.className = "group-build-actions";
        for (const groupId of buildableGroups.keys()) {
          const grp = BOARD.groups[groupId];
          const positions = G.propertyGroupPositions(groupId);
          const perCost = G.currentBuildCost(BOARD.spaces[positions[0]]);
          const estimate = perCost * positions.length;
          const btn = document.createElement("button");
          btn.className = "btn-secondary group-build-btn";
          btn.innerHTML =
            `<span class="gb-dot" style="background:${grp.color}"></span> Развий „${grp.name}"`;
          btn.disabled = me.cash < perCost;
          btn.title = btn.disabled
            ? `Нужни са поне ${IE.fmt(perCost)}`
            : `Развива всеки имот с едно ниво (~${IE.fmt(estimate)}). `
              + `Започва от най-скъпата територия — при недостиг без къща `
              + `остава най-евтината.`;
          btn.onclick = () => socket.emit("build_group", { group: groupId });
          wrap.appendChild(btn);
        }
        box.appendChild(wrap);
      }
    }

    // Групова продажба: по един бутон за всяка група с постройки.
    if (sellable) {
      const sellableGroups = new Map();
      for (const prop of mine) {
        const sp = BOARD.spaces[prop.position];
        if (sp.type !== "property" || !sp.group || prop.level <= 0) continue;
        if (sellableGroups.has(sp.group)) continue;
        // Показваме групата, ако поне един неин имот има подобрение за продажба.
        const anySellable = G.propertyGroupPositions(sp.group).some((pos) => {
          const st = g.properties[String(pos)];
          return st && st.owner === state.myId && st.level > 0
            && sellBlockReason(st) === "";
        });
        if (anySellable || inMyDebt) sellableGroups.set(sp.group, sp.group);
      }
      if (sellableGroups.size) {
        const wrap = document.createElement("div");
        wrap.className = "group-build-actions group-sell-actions";
        for (const groupId of sellableGroups.keys()) {
          const grp = BOARD.groups[groupId];
          const positions = G.propertyGroupPositions(groupId);
          // Груба оценка на връщаната сума за едно ниво от групата.
          let refund = 0;
          for (const pos of positions) {
            const st = g.properties[String(pos)];
            if (st && st.owner === state.myId && st.level > 0) {
              refund += Math.floor(BOARD.spaces[pos].improve_cost / 2);
            }
          }
          const btn = document.createElement("button");
          btn.className = "btn-sell-house group-sell-btn";
          btn.innerHTML =
            `<span class="mini-house sell-icon"></span> Продай ниво „${grp.name}" (+${IE.fmt(refund)})`;
          btn.title = `Продава по едно подобрение от всеки имот в групата (връща ~${IE.fmt(refund)})`;
          btn.onclick = () => {
            G.confirmAction({
              title: "Продажба на подобрения",
              body: [
                `Да продадете ли по едно ниво подобрение от всеки имот в „${grp.name}“?`,
                `Банката ще изплати около ${IE.fmt(refund)}.`,
              ],
              confirmLabel: "Продай",
              danger: true,
              onConfirm: () => socket.emit("sell_group", { group: groupId }),
            });
          };
          wrap.appendChild(btn);
        }
        box.appendChild(wrap);
      }
    }

    for (const prop of mine.sort((a, b) => a.position - b.position)) {
      const sp = BOARD.spaces[prop.position];
      const color = sp.group && BOARD.groups[sp.group] ? BOARD.groups[sp.group].color : "#8d9aa8";
      const row = document.createElement("div");
      row.className = "prop-row" + (prop.mortgaged ? " mortgaged" : "");
      row.innerHTML = `
        <span class="pr-dot" style="background:${color}"></span>
        <span class="pr-name" title="${sp.name}">${sp.name}</span>
        <span class="pr-lv">${G.levelMarkup(prop.level)}</span>`;
      // Бутоните отиват на собствен ред под името, за да не го стесняват.
      const actions = document.createElement("div");
      actions.className = "pr-actions";
      row.addEventListener("click", (event) => {
        if (!event.target.closest("button")) G.showSpaceInfo(prop.position);
      });
      // Строеж: само на свой ход, при пълна група, равномерно, под макс. ниво.
      if (manageable && myTurn && G.canBuildHere(g, prop)) {
        const b = document.createElement("button");
        b.className = "btn-secondary";
        b.textContent = "⬆ Развий";
        const buildCost = G.currentBuildCost(sp);
        b.disabled = me.cash < buildCost;
        b.title = b.disabled
          ? `Нужни са ${IE.fmt(buildCost)} — нямате достатъчно`
          : `Подобрение: ${IE.fmt(buildCost)}`;
        b.onclick = () => openPropertyActionPreview("build", prop);
        actions.appendChild(b);
      }
      // Продажба на подобрение: пази равномерността в групата.
      // При собствен дълг бутонът присъства и когато е блокиран — с причина.
      const sellReason = sellBlockReason(prop);
      if (sellable && sellReason !== null && (sellReason === "" || inMyDebt)) {
        const b = document.createElement("button");
        b.className = "btn-sell-house";
        const isHotel = prop.level >= G.MAX_LEVEL;
        b.innerHTML = `<span class="mini-house sell-icon"></span> Продай ${isHotel ? "хотел" : "къща"}`;
        b.disabled = sellReason !== "";
        b.title = sellReason || `Продава едно ниво и връща ${IE.fmt(sp.improve_cost / 2)}`;
        b.onclick = () => openPropertyActionPreview("sell", prop);
        actions.appendChild(b);
      }
      // Ипотека: само ако цялата група е без постройки.
      if (sellable && !prop.mortgaged && prop.level === 0) {
        const buildingsBlock = G.groupHasBuildings(g, sp.group);
        if (!buildingsBlock || inMyDebt) {
          const b = document.createElement("button");
          b.className = "btn-ghost";
          b.textContent = "Ипотека";
          b.disabled = buildingsBlock;
          b.title = buildingsBlock
            ? "Първо продайте всички постройки в групата, за да ипотекирате."
            : `Получавате ${IE.fmt(sp.mortgage)}`;
          b.onclick = () => openPropertyActionPreview("mortgage", prop);
          actions.appendChild(b);
        }
      }
      // Откупуване: извън фаза на плащане и само при достатъчно средства.
      if (manageable && prop.mortgaged) {
        const cost = sp.mortgage + Math.floor(sp.mortgage / 10);
        const b = document.createElement("button");
        b.className = "btn-ghost";
        b.textContent = "Откупи";
        b.disabled = me.cash < cost;
        b.title = b.disabled
          ? `Нужни са ${IE.fmt(cost)} — нямате достатъчно`
          : `Плащате ${IE.fmt(cost)}`;
        b.onclick = () => openPropertyActionPreview("unmortgage", prop);
        actions.appendChild(b);
      }
      // Продажба на банката: необратима, затова е последна и с потвърждение.
      // Изключи ли я домакинът, бутонът изобщо не се появява — иначе водеше
      // до отказ от сървъра точно когато играчът бърза да набави пари.
      if (sellable && prop.level === 0 && g.settings.sell_to_bank_enabled !== false) {
        const buildingsBlock = G.groupHasBuildings(g, sp.group);
        const percent = g.settings.sell_to_bank_percent ?? 80;
        const payout = Math.max(
          0,
          Math.floor((sp.price || 0) * percent / 100) - (prop.mortgaged ? sp.mortgage : 0)
        );
        const b = document.createElement("button");
        b.className = "btn-ghost";
        b.textContent = "Продай";
        b.disabled = buildingsBlock || payout <= 0;
        b.title = buildingsBlock
          ? "Първо продайте всички постройки в групата."
          : `Банката плаща ${IE.fmt(payout)} (${percent}% от цената${
              prop.mortgaged ? " минус ипотеката" : ""
            }). Имотът се губи безвъзвратно.`;
        b.onclick = () => {
          G.confirmAction({
            title: "Продажба на банката",
            body: [
              `Да продадете ли „${sp.name}“ на банката за ${IE.fmt(payout)}?`,
              "Имотът става отново свободен и всеки може да го купи. "
              + "Действието е необратимо.",
            ],
            confirmLabel: "Продай",
            danger: true,
            onConfirm: () => socket.emit(
              "sell_property_to_bank", { position: prop.position }
            ),
          });
        };
        actions.appendChild(b);
      }
      // Пускане на собствен имот на търг — печалбата отива при вас.
      if (manageable && myTurn && !prop.mortgaged && prop.level === 0) {
        const buildingsBlock = G.groupHasBuildings(g, sp.group);
        const otherPlayers = g.turn_order.filter((pid) => {
          const pl = g.players[pid];
          return pl && !pl.bankrupt && !pl.is_spectator && pid !== state.myId;
        }).length;
        const b = document.createElement("button");
        b.className = "btn-ghost";
        b.textContent = "🔨 На търг";
        b.disabled = buildingsBlock || otherPlayers < 1 || !!g.auction;
        b.title = buildingsBlock
          ? "Първо продайте всички постройки в групата."
          : otherPlayers < 1
            ? "Няма други играчи, които да наддават."
            : `Търгът започва от стойността (${IE.fmt(sp.price || 0)}); печалбата е за вас.`;
        b.onclick = () => {
          G.confirmAction({
            title: "Имот на търг",
            body: [
              `Да обявите ли „${sp.name}“ на търг?`,
              `Наддаването започва от стойността на имота (${IE.fmt(sp.price || 0)}), `
              + "а спечелената сума отива при вас. Ако никой не наддаде, имотът остава ваш.",
            ],
            confirmLabel: "Обяви търг",
            onConfirm: () => socket.emit(
              "auction_own_property", { position: prop.position }
            ),
          });
        };
        actions.appendChild(b);
      }
      // Празният контейнер не се добавя, за да не оставя дупка.
      if (actions.children.length) row.appendChild(actions);
      box.appendChild(row);
    }
  }

  /* ----------------------------------------------------------
     Общо потвърждение

     Браузърният confirm() спира целия документ и се рисува от самия
     браузър — при цял екран излиза извън прозореца на играта. Тук
     питаме със същия модал като останалите.
     ---------------------------------------------------------- */
  const confirmModal = IE.el("confirm-modal");
  let pendingConfirm = null;

  function closeConfirm() {
    pendingConfirm = null;
    confirmModal.classList.add("hidden");
  }

  /* `body` е списък от абзаци. Всеки се пише през textContent — имената
     на играчите идват от потребители и не бива да стигат до innerHTML. */
  G.confirmAction = function confirmAction(
    { title, body, confirmLabel = "Потвърди", danger = false, onConfirm }
  ) {
    pendingConfirm = onConfirm;
    IE.el("confirm-title").textContent = title;
    IE.el("confirm-icon").textContent = danger ? "⚠" : "❓";
    const box = IE.el("confirm-body");
    box.innerHTML = "";
    for (const line of [].concat(body)) {
      const p = document.createElement("p");
      p.textContent = line;
      box.appendChild(p);
    }
    const ok = IE.el("confirm-ok");
    ok.textContent = confirmLabel;
    ok.className = "btn " + (danger ? "btn-danger" : "btn-primary");
    confirmModal.classList.remove("hidden");
    // При необратимо действие фокусът стои на „Отказ“, за да не го
    // задейства случаен Enter.
    (danger ? IE.el("confirm-cancel") : ok).focus();
  };

  IE.el("confirm-cancel").addEventListener("click", closeConfirm);
  confirmModal.addEventListener("click", (event) => {
    if (event.target === confirmModal) closeConfirm();
  });
  IE.el("confirm-ok").addEventListener("click", () => {
    const action = pendingConfirm;
    closeConfirm();
    if (action) action();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !confirmModal.classList.contains("hidden")) {
      closeConfirm();
    }
  });

  /* ----------------------------------------------------------
     Финансов преглед преди действие
     ---------------------------------------------------------- */
  let pendingPreviewAction = null;

  function openActionPreview({ title, summary, metrics, details, confirmLabel = "Потвърди", onConfirm }) {
    pendingPreviewAction = onConfirm;
    IE.el("action-preview-title").textContent = title;
    IE.el("action-preview-summary").textContent = summary;
    IE.el("action-preview-confirm").textContent = confirmLabel;
    IE.el("action-preview-metrics").innerHTML = metrics.map((metric) => {
      const before = metric.number ? metric.before : IE.fmt(metric.before);
      const after = metric.number ? metric.after : IE.fmt(metric.after);
      const delta = metric.after - metric.before;
      const deltaText = delta === 0
        ? "без промяна"
        : `${delta > 0 ? "+" : ""}${metric.number ? delta : IE.fmt(delta)}`;
      return `<div><span>${metric.label}</span><b>${before} → ${after}</b><strong class="${delta < 0 ? "negative" : ""}">${deltaText}</strong></div>`;
    }).join("");
    IE.el("action-preview-details").innerHTML = details.map((detail) => `<p>${detail}</p>`).join("");
    IE.el("action-preview-modal").classList.remove("hidden");
  }

  function closeActionPreview() {
    pendingPreviewAction = null;
    IE.el("action-preview-modal").classList.add("hidden");
  }

  function openPropertyActionPreview(action, prop) {
    const g = state.game;
    const me = g.players[state.myId];
    const sp = BOARD.spaces[prop.position];
    const properties = G.clonePropertyStates();
    const simulated = properties[String(prop.position)];
    const cashBefore = me.cash;
    const worthBefore = G.netWorthFor(state.myId);
    const rentBefore = prop.mortgaged ? 0 : G.rentBreakdownFor(sp, prop, state.myId, g.properties, 7).amount;
    let cashAfter = cashBefore;
    let title = "Преглед на действието";
    let summary = sp.name;
    let confirmLabel = "Потвърди";
    const details = [];
    let socketEvent = "";

    if (action === "build") {
      const buildCost = G.currentBuildCost(sp);
      cashAfter -= buildCost;
      simulated.level += 1;
      title = "Потвърждение на строеж";
      summary = `Развитие на „${sp.name}“ до ${BOARD.improvement_levels[simulated.level]}.`;
      confirmLabel = "Построй";
      socketEvent = "build_improvement";
      details.push(`Текуща цена на строежа: ${IE.fmt(buildCost)}.`);
      const stock = G.bankStock(g);
      const remaining = simulated.level === G.MAX_LEVEL ? stock.hotels : stock.houses;
      if (remaining === 1) details.push("Това е последната налична постройка и може да започне търг. Крайната цена ще се определи от наддаването.");
    } else if (action === "sell") {
      const refund = Math.floor(sp.improve_cost / 2);
      cashAfter += refund;
      simulated.level -= 1;
      title = "Потвърждение на продажба";
      summary = `Продажба на едно ниво подобрение от „${sp.name}“.`;
      confirmLabel = "Продай";
      socketEvent = "sell_improvement";
      details.push(`Банката ще изплати ${IE.fmt(refund)}.`);
    } else if (action === "mortgage") {
      cashAfter += sp.mortgage;
      simulated.mortgaged = true;
      title = "Потвърждение на ипотека";
      summary = `Ипотекиране на „${sp.name}“ в Българската народна банка.`;
      confirmLabel = "Ипотекирай";
      socketEvent = "mortgage_property";
      details.push(`Получавате незабавно ${IE.fmt(sp.mortgage)}. Докато ипотеката е активна, имотът не носи наем.`);
      details.push(`Стандартното откупуване ще струва ${IE.fmt(sp.mortgage + Math.floor(sp.mortgage / 10))}.`);
    } else if (action === "unmortgage") {
      const cost = sp.mortgage + Math.floor(sp.mortgage / 10);
      cashAfter -= cost;
      simulated.mortgaged = false;
      title = "Освобождаване на ипотека";
      summary = `Възстановяване на правата върху „${sp.name}“.`;
      confirmLabel = "Откупи";
      socketEvent = "unmortgage_property";
      details.push(`Главница ${IE.fmt(sp.mortgage)} и лихва ${IE.fmt(Math.floor(sp.mortgage / 10))}.`);
    }

    const rentAfter = simulated.mortgaged ? 0 : G.rentBreakdownFor(sp, simulated, state.myId, properties, 7).amount;
    const worthAfter = G.netWorthFor(state.myId, properties, cashAfter);
    openActionPreview({
      title,
      summary,
      confirmLabel,
      metrics: [
        { label: "Пари в брой", before: cashBefore, after: cashAfter },
        { label: "Нетна стойност", before: worthBefore, after: worthAfter },
        { label: "Наем при стандартни зарове", before: rentBefore, after: rentAfter },
      ],
      details,
      onConfirm: () => socket.emit(socketEvent, { position: prop.position }),
    });
  }

  // Достъпно и от нотариалния акт, където собственикът строи направо.
  G.openPropertyActionPreview = openPropertyActionPreview;

  G.openTradeActionPreview = function openTradeActionPreview(trade, onConfirm, title = "Потвърждение на сделка") {
    const g = state.game;
    const me = g.players[state.myId];
    const perspective = G.tradePerspective(trade);
    const other = g.players[perspective.otherId];
    const properties = G.clonePropertyStates();
    const cashBefore = me.cash;
    const worthBefore = G.netWorthFor(state.myId);
    const assetsBefore = Object.values(g.properties).filter((prop) => prop.owner === state.myId).length;
    const mortgageFee = perspective.incoming.reduce((sum, position) => {
      const prop = g.properties[String(position)];
      return sum + (prop && prop.mortgaged ? Math.floor(BOARD.spaces[position].mortgage / 10) : 0);
    }, 0);
    perspective.outgoing.forEach((position) => { properties[String(position)].owner = perspective.otherId; });
    perspective.incoming.forEach((position) => { properties[String(position)].owner = state.myId; });
    const cashAfter = cashBefore - perspective.giveCash + perspective.receiveCash - mortgageFee;
    const worthAfter = G.netWorthFor(state.myId, properties, cashAfter);
    const assetsAfter = Object.values(properties).filter((prop) => prop.owner === state.myId).length;
    const giveValue = perspective.giveCash + perspective.giveCards * 100
      + perspective.outgoing.reduce((sum, pos) => sum + G.estimatedPropertyValue(pos), 0);
    const receiveValue = perspective.receiveCash + perspective.receiveCards * 100
      + perspective.incoming.reduce((sum, pos) => sum + G.estimatedPropertyValue(pos), 0);
    const names = (positions) => positions.length
      ? positions.map((position) => `„${BOARD.spaces[position].name}“`).join(", ") : "няма имоти";
    const details = [
      `Давате: ${IE.fmt(perspective.giveCash)}, ${names(perspective.outgoing)} и ${perspective.giveCards} карти.`,
      `Получавате: ${IE.fmt(perspective.receiveCash)}, ${names(perspective.incoming)} и ${perspective.receiveCards} карти.`,
      `Приблизителна стойност: давате ${IE.fmt(giveValue)}, получавате ${IE.fmt(receiveValue)}.`,
    ];
    if (mortgageFee) details.push(`Незабавна ипотечна такса към банката: ${IE.fmt(mortgageFee)}.`);
    openActionPreview({
      title,
      summary: `${other ? other.name : "Другият играч"} е насрещната страна по сделката.`,
      confirmLabel: title.includes("Приемане") ? "Приеми" : "Изпрати",
      metrics: [
        { label: "Пари в брой", before: cashBefore, after: cashAfter },
        { label: "Нетна стойност", before: worthBefore, after: worthAfter },
        { label: "Брой активи", before: assetsBefore, after: assetsAfter, number: true },
      ],
      details,
      onConfirm,
    });
  };

  IE.el("action-preview-close").addEventListener("click", closeActionPreview);
  IE.el("action-preview-cancel").addEventListener("click", closeActionPreview);
  IE.el("action-preview-modal").addEventListener("click", (event) => {
    if (event.target === IE.el("action-preview-modal")) closeActionPreview();
  });
  IE.el("action-preview-confirm").addEventListener("click", () => {
    const action = pendingPreviewAction;
    closeActionPreview();
    if (action) action();
  });

  /* ----------------------------------------------------------
     Дълг
     ---------------------------------------------------------- */
  /* Кратко описание какво точно ще направи планът — стои в надписа на
     бутона, за да е ясно предварително кои активи се пипат. */
  G.planSummary = function planSummary(plan) {
    const sells = plan.actions.filter((a) => a.type === "sell").length;
    const sold = plan.actions.filter((a) => a.type === "sell_property").length;
    const mortgages = plan.actions.length - sells - sold;
    const parts = [];
    if (sells) {
      parts.push(`продай ${sells} ${sells === 1 ? "подобрение" : "подобрения"}`);
    }
    if (mortgages) {
      parts.push(`ипотекирай ${mortgages} ${mortgages === 1 ? "имот" : "имота"}`);
    }
    if (sold) {
      parts.push(`продай на банката ${sold} ${sold === 1 ? "имот" : "имота"}`);
    }
    const text = parts.join(" и ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  function renderDebt() {
    const g = state.game;
    const banner = IE.el("debt-banner");
    if (g.debt && g.debt.debtor === state.myId) {
      banner.classList.remove("hidden");
      const creditor = g.debt.creditor && g.players[g.debt.creditor]
        ? g.players[g.debt.creditor].name : "банката";
      const missing = Math.max(0, g.debt.amount - (g.players[state.myId] || {}).cash);
      IE.el("debt-text").textContent =
        `Дължите ${IE.fmt(g.debt.amount)} на ${creditor} (${g.debt.reason}). ` +
        (missing
          ? `Не достигат ${IE.fmt(missing)}. Допустимите автоматични ипотеки ` +
            "вече са проверени — изпълнете плана наведнъж с един бутон или " +
            "стъпка по стъпка."
          : "Средствата стигат — потвърдете плащането.");
      const advice = IE.el("debt-advice");
      const plan = g.debt_advice;
      if (plan && plan.actions.length) {
        advice.innerHTML = `<b>Препоръчан план · нужни още ${IE.fmt(plan.shortfall)}</b>`;
        plan.actions.forEach((action, index) => {
          const row = document.createElement("div");
          row.className = "debt-advice-row";
          const verb = action.type === "sell" ? "Продайте подобрение"
            : action.type === "sell_property" ? "Продайте на банката"
            : "Ипотекирайте";
          row.innerHTML = `<span>${index + 1}. ${verb} · ${action.name}</span>`
            + `<strong>+${IE.fmt(action.amount)}</strong>`;
          const button = document.createElement("button");
          button.className = "btn btn-ghost";
          button.textContent = index === 0 ? "Изпълни" : "";
          button.title = "Изпълни тази стъпка";
          button.disabled = index !== 0;
          button.onclick = () => {
            const prop = g.properties[String(action.position)];
            if (prop) openPropertyActionPreview(action.type, prop);
          };
          row.appendChild(button);
          advice.appendChild(row);
        });
        if (!plan.covers) {
          const warning = document.createElement("p");
          warning.textContent = "Допустимите действия не покриват целия дълг.";
          advice.appendChild(warning);
        }
      } else {
        advice.innerHTML = '<p>Няма останали действия за набавяне на средства.</p>';
      }
    } else {
      banner.classList.add("hidden");
    }
  }

  /* ----------------------------------------------------------
     Карта (модал)
     ---------------------------------------------------------- */
  /* Отворен ли е потребителски модал в момента (без самата карта). Карта,
     изтеглена от друг играч, не бива да застъпва прозорец, който четете. */
  function userModalOpen() {
    return Array.prototype.some.call(
      document.querySelectorAll(".modal-backdrop"),
      (el) => el.id !== "card-modal" && !el.classList.contains("hidden"),
    );
  }

  /* Дискретен вариант на картата, докато е отворен друг модал. Живее в
     областта на тостовете (z-index 400) — над модала, а не под него: банер
     в стека на таблото би останал невидим зад отворения прозорец. Не приема
     мишката, така че не пречи на четенето отдолу. */
  function showCardNotice(deck, text, meta) {
    const isCommunity = deck === "community";
    const info = meta || {};
    let area = document.getElementById("toast-area");
    if (!area) {
      area = document.createElement("div");
      area.id = "toast-area";
      document.body.appendChild(area);
    }
    const banner = document.createElement("div");
    banner.className = "card-notice "
      + (isCommunity ? "cn-community" : "cn-business")
      + (info.tone ? ` cn-${info.tone}` : "")
      + (info.legendary ? " cn-legendary" : "");
    banner.innerHTML =
      `<div class="cn-head">${IE.escapeHtml(info.icon || (isCommunity ? "❓" : "💼"))} `
      + `${info.legendary ? "Легендарна · " : ""}`
      + `${isCommunity ? "Обществено събитие" : "Бизнес възможност"}</div>`
      + `<div class="cn-text">${IE.escapeHtml(cardDisplayText(text))}</div>`;
    area.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add("show"));
    setTimeout(() => banner.classList.remove("show"), 5600);
    setTimeout(() => banner.remove(), 6000);
  }

  /* Имената идват екранирани от сървъра (security.sanitize_name), защото
     игровият лог ги вмъква през innerHTML. Лицето на картата обаче се пише
     през textContent и там „&amp;" би се показало буквално, затова точно за
     този път връщаме символите. Обратното декодиране е безопасно: textContent
     никога не тълкува HTML. */
  const ENTITIES = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'",
  };
  function cardDisplayText(text) {
    return String(text == null ? "" : text)
      .replace(/&(amp|lt|gt|quot|#x27);/g, (match) => ENTITIES[match] || match);
  }

  G.showCardModal = function showCardModal(deck, text, meta) {
    const info = meta || {};
    if (userModalOpen()) {
      showCardNotice(deck, text, info);
      return;
    }
    const isCommunity = deck === "community";
    const icon = info.icon || (isCommunity ? "❓" : "💼");
    IE.el("card-deck-name").textContent = info.legendary
      ? "Легендарна карта"
      : (isCommunity ? "Обществено събитие" : "Бизнес възможност");
    IE.el("card-text").textContent = cardDisplayText(text);
    IE.el("card-icon").textContent = icon;
    IE.el("card-icon-tl").textContent = icon;
    IE.el("card-icon-br").textContent = icon;
    const card = IE.el("drawn-card");
    card.classList.toggle("dc-community", isCommunity);
    card.classList.toggle("dc-business", !isCommunity);
    // Тонът дава аурата: зелена при добра новина, червена при лоша.
    for (const tone of ["good", "bad", "neutral"]) {
      card.classList.toggle(`dc-${tone}`, info.tone === tone);
    }
    card.classList.toggle("dc-legendary", !!info.legendary);

    // Гърбът показва само от кое тесте е картата — съдържанието ѝ е тайна,
    // докато не се обърне.
    const back = IE.el("drawn-card-back");
    back.classList.toggle("dcb-community", isCommunity);
    back.classList.toggle("dcb-business", !isCommunity);
    IE.el("card-back-icon").textContent = isCommunity ? "❓" : "💼";
    IE.el("card-back-title").textContent = isCommunity
      ? "Обществено събитие" : "Бизнес възможност";

    if (G.resetFoil) G.resetFoil();
    // Върти се носачът, не лицето.
    const flip = IE.el("card-flip");
    flip.classList.remove("flipping");
    void flip.offsetWidth;
    flip.classList.add("flipping");
    IE.el("card-modal").classList.remove("hidden");
    clearTimeout(showCardModal._t);
    // Легендарната стои по-дълго — тя е събитието на партията.
    showCardModal._t = setTimeout(
      () => IE.el("card-modal").classList.add("hidden"),
      info.legendary ? 8000 : 6000,
    );
  };
  IE.el("card-modal").addEventListener("click", () => IE.el("card-modal").classList.add("hidden"));

  /* Фолио на легендарната карта: отблясъкът следва показалеца.

     Стойностите се пишат като CSS променливи, а не като нов стил на всяко
     мърдане — браузърът тогава преизчислява само рисуването. Записът минава
     през requestAnimationFrame, за да не се пише по няколко пъти в един кадър
     (mousemove се обажда по-често от опресняването на екрана). */
  (function foil() {
    const modal = IE.el("card-modal");
    const card = IE.el("drawn-card");
    let pending = null;

    function apply(xPct, yPct) {
      card.style.setProperty("--foil-x", `${xPct.toFixed(1)}%`);
      card.style.setProperty("--foil-y", `${yPct.toFixed(1)}%`);
      // Ъгълът се върти с положението: отблясъкът „тече" по картата,
      // вместо да стои като залепен слой.
      card.style.setProperty("--foil-angle", `${(70 + xPct * 0.9).toFixed(0)}deg`);
    }

    modal.addEventListener("pointermove", (event) => {
      if (!card.classList.contains("dc-legendary")) return;
      const r = card.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = ((event.clientX - r.left) / r.width) * 100;
      const y = ((event.clientY - r.top) / r.height) * 100;
      if (pending) cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        pending = null;
        // Извън картата отблясъкът се прибира към ръба, а не изчезва рязко.
        apply(Math.max(-20, Math.min(120, x)), Math.max(-20, Math.min(120, y)));
      });
    });

    // При всяка нова карта отблясъкът тръгва от средата.
    G.resetFoil = () => apply(50, 50);
    G.resetFoil();
  })();

  /* ----------------------------------------------------------
     Карта с избор: сигурен вариант или залог на зара

     Виждат го всички — напрежението е част от смисъла — но бутоните
     работят само за играча, изтеглил картата.
     ---------------------------------------------------------- */
  function signedAmount(value) {
    if (!value) return "нищо";
    return (value > 0 ? "+" : "−") + IE.fmt(Math.abs(value));
  }

  function renderCardChoice() {
    const g = state.game;
    const modal = IE.el("card-choice-modal");
    const pending = g && g.pending_card_choice;
    if (!pending) {
      modal.classList.add("hidden");
      return;
    }
    const mine = pending.player_id === state.myId;
    IE.el("choice-icon").textContent = pending.icon || "🎲";
    IE.el("choice-deck").textContent = pending.deck === "community"
      ? "Обществено събитие" : "Бизнес възможност";
    IE.el("choice-text").textContent = cardDisplayText(pending.card_text);

    IE.el("choice-safe-label").textContent = pending.safe_label;
    IE.el("choice-safe-amount").textContent = signedAmount(pending.safe_amount);
    IE.el("choice-risky-label").textContent = pending.risky_label;
    // И двата изхода наведнъж: играчът трябва да види срещу какво залага.
    IE.el("choice-risky-amount").textContent =
      `${signedAmount(pending.risky_win)} / ${signedAmount(pending.risky_lose)}`;
    IE.el("choice-risky-note").textContent = pending.risky_note;

    for (const [id, option] of [["choice-safe", "safe"], ["choice-risky", "risky"]]) {
      const btn = IE.el(id);
      btn.disabled = !mine;
      btn.onclick = mine
        ? () => {
            btn.disabled = true;
            socket.emit("resolve_card_choice", { option });
          }
        : null;
    }
    const who = g.players[pending.player_id];
    IE.el("choice-waiting").textContent = mine
      ? "Изборът е ваш — играта чака."
      : `Изборът е на ${who ? who.name : "играча"}.`;
    modal.classList.remove("hidden");
  }

  /* ----------------------------------------------------------
     Решение за ипотеки, получени при фалит
     ---------------------------------------------------------- */
  function renderMortgageTransfer() {
    const g = state.game;
    const modal = IE.el("mortgage-transfer-modal");
    const pending = g.pending_mortgage_transfer;
    if (g.paused || !pending || pending.player_id !== state.myId
        || g.phase !== "AWAITING_MORTGAGE_DECISION") {
      modal.classList.add("hidden");
      modal.dataset.key = "";
      return;
    }
    modal.classList.remove("hidden");
    const key = `${pending.player_id}:${pending.positions.join(",")}`;
    if (modal.dataset.key === key) return;
    modal.dataset.key = key;
    IE.el("mortgage-transfer-intro").textContent =
      `Задължителната лихва от ${IE.fmt(pending.interest_paid)} е платена. ` +
      "Изберете имотите, които искате да откупите веднага само срещу главницата.";
    const list = IE.el("mortgage-transfer-list");
    list.innerHTML = pending.positions.map((pos) => {
      const sp = BOARD.spaces[pos];
      return `<label><input type="checkbox" value="${pos}"><span>${sp.name}</span><b>${IE.fmt(sp.mortgage)}</b></label>`;
    }).join("");
    list.querySelectorAll("input").forEach((input) => input.addEventListener("change", updateMortgageTransferTotal));
    updateMortgageTransferTotal();
  }

  function updateMortgageTransferTotal() {
    const selected = [...IE.el("mortgage-transfer-list").querySelectorAll("input:checked")];
    const total = selected.reduce((sum, input) => sum + BOARD.spaces[+input.value].mortgage, 0);
    const me = state.game.players[state.myId];
    IE.el("mortgage-transfer-total").textContent =
      `Избрани: ${selected.length} · Общо: ${IE.fmt(total)} · Налични: ${IE.fmt(me.cash)}`;
    IE.el("btn-redeem-mortgages").disabled = !selected.length || total > me.cash;
  }

  IE.el("btn-keep-mortgages").addEventListener("click", () => {
    socket.emit("resolve_mortgage_transfer", { positions: [] });
  });
  IE.el("btn-redeem-mortgages").addEventListener("click", () => {
    const positions = [...IE.el("mortgage-transfer-list").querySelectorAll("input:checked")]
      .map((input) => +input.value);
    socket.emit("resolve_mortgage_transfer", { positions });
  });

  /* ----------------------------------------------------------
     Портфейл
     ---------------------------------------------------------- */
  function renderPortfolio() {
    const g = state.game;
    if (!g) return;
    const player = g.players[state.myId];
    if (!player) {
      IE.el("portfolio-title").textContent = "Портфейл на зрител";
      IE.el("portfolio-metrics").innerHTML = '<p class="portfolio-empty">Зрителите нямат финансов портфейл.</p>';
      IE.el("portfolio-banknotes").innerHTML = "";
      IE.el("portfolio-properties").innerHTML = "";
      return;
    }
    const properties = Object.values(g.properties)
      .filter((prop) => prop.owner === state.myId)
      .sort((a, b) => a.position - b.position);
    const mortgaged = properties.filter((prop) => prop.mortgaged).length;
    const opponents = Object.values(g.players)
      .filter((item) => !item.bankrupt && !item.is_spectator && item.player_id !== state.myId).length;
    const rentPerCircuit = properties.reduce((sum, prop) => {
      if (prop.mortgaged) return sum;
      return sum + G.rentBreakdownFor(BOARD.spaces[prop.position], prop, state.myId, g.properties, 7).amount;
    }, 0);
    const expectedIncome = rentPerCircuit * opponents;
    const netWorth = G.netWorthFor(state.myId);
    IE.el("portfolio-title").textContent = `Портфейл · ${player.name}`;
    IE.el("portfolio-cash-total").textContent = IE.fmt(player.cash);
    IE.el("portfolio-metrics").innerHTML = `
      <div><span>Обща нетна стойност</span><strong>${IE.fmt(netWorth)}</strong></div>
      <div><span>Стойност на активите</span><strong>${IE.fmt(netWorth - player.cash)}</strong></div>
      <div><span>Очакван приход за обиколка</span><strong>${IE.fmt(expectedIncome)}</strong><small>${opponents} активни съперници</small></div>
      <div><span>Ипотеки</span><strong>${mortgaged}</strong><small>от ${properties.length} актива</small></div>`;
    const banknotes = G.cashDenominationCounts(player.cash);
    IE.el("portfolio-banknotes").innerHTML = banknotes.length
      ? banknotes.map(({ value, count }) => `
          <div class="portfolio-note portfolio-note-${value}"><span>${value}</span><b>× ${count}</b><small>И&amp;И</small></div>`).join("")
      : '<p class="portfolio-empty">Няма налични банкноти.</p>';
    IE.el("portfolio-property-summary").textContent = `${properties.length} актива · ${mortgaged} ипотекирани`;
    const list = IE.el("portfolio-properties");
    list.innerHTML = "";
    if (!properties.length) {
      list.innerHTML = '<p class="portfolio-empty">Все още няма придобити имоти.</p>';
      return;
    }
    properties.forEach((prop) => {
      const sp = BOARD.spaces[prop.position];
      const rent = prop.mortgaged ? 0 : G.rentBreakdown(sp, prop, state.myId).amount;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `portfolio-property${prop.mortgaged ? " mortgaged" : ""}`;
      button.innerHTML = `
        <span class="portfolio-property-color" style="background:${sp.group && BOARD.groups[sp.group] ? BOARD.groups[sp.group].color : "#647383"}"></span>
        <span><b>${sp.name}</b><small>${prop.mortgaged ? "Ипотекиран" : prop.level ? BOARD.improvement_levels[prop.level] : "Без постройки"}</small></span>
        <span><small>Текущ наем</small><strong>${IE.fmt(rent)}</strong></span>`;
      button.onclick = () => {
        IE.el("portfolio-modal").classList.add("hidden");
        G.showSpaceInfo(prop.position);
      };
      list.appendChild(button);
    });
  }

  IE.el("btn-portfolio").addEventListener("click", () => {
    renderPortfolio();
    IE.el("portfolio-modal").classList.remove("hidden");
  });
  IE.el("portfolio-close").addEventListener("click", () => IE.el("portfolio-modal").classList.add("hidden"));
  IE.el("portfolio-modal").addEventListener("click", (e) => {
    if (e.target === IE.el("portfolio-modal")) IE.el("portfolio-modal").classList.add("hidden");
  });

  /* ----------------------------------------------------------
     Банка
     ---------------------------------------------------------- */
  function renderBankInterface(stock) {
    const g = state.game;
    IE.el("bank-houses").textContent = stock.houses;
    IE.el("bank-hotels").textContent = stock.hotels;
    const fundEnabled = !!g.settings.free_parking_jackpot;
    const fundPanel = IE.el("bank-pot-panel");
    fundPanel.classList.toggle("is-disabled", !fundEnabled);
    fundPanel.title = fundEnabled
      ? "Плащанията към банката се натрупват тук и се получават при стъпване на „Свободен престой“."
      : "Фондът се активира от настройките на стаята. При изключено правило плащанията не се натрупват.";
    IE.el("bank-pot-value").textContent = fundEnabled
      ? IE.fmt(g.bank_pot || 0)
      : "Изключен";

    // Заемът е най-долу в модала, свит до един бутон. Разгънатото състояние
    // се пази между пререндиранията — иначе панелът би се затварял сам,
    // докато играчът чете подробностите.
    const loanPanel = IE.el("bank-loan-panel");
    const me = g.players[state.myId];
    const hasLoan = !!(me && me.loan > 0 && !state.isSpectator);
    loanPanel.classList.toggle("hidden", !hasLoan);
    if (hasLoan) {
      const percent = Number(g.settings.loan_interest_percent) || 0;
      // Лихвата се плаща в брой — показваме нея, а не уголемен дълг.
      const interest = Math.floor(me.loan * percent / 100);
      const collateral = G.collateralValue(state.myId);
      IE.el("bank-loan-chip").textContent = IE.fmt(me.loan);
      IE.el("bank-loan-amount").textContent = IE.fmt(me.loan);
      IE.el("bank-loan-interest").textContent = `${percent}%`;
      IE.el("bank-loan-next").textContent = IE.fmt(interest);
      IE.el("bank-loan-cash").textContent = IE.fmt(me.cash);
      const collateralCell = IE.el("bank-loan-collateral");
      collateralCell.textContent = IE.fmt(collateral);
      // Червено, когато обезпечението вече не покрива дълга: следващата
      // обиколка банката ще поиска целия остатък.
      collateralCell.classList.toggle("is-danger", me.loan > collateral);

      const repay = IE.el("bank-loan-repay");
      const payable = Math.min(me.loan, me.cash);
      const myTurn = g.current_player === state.myId;
      const rightPhase = g.phase === "MANAGEMENT" || g.phase === "WAITING_FOR_ROLL";
      const canRepay = payable > 0 && myTurn && rightPhase;
      repay.disabled = !canRepay;
      repay.textContent = payable >= me.loan
        ? "Погаси изцяло" : `Погаси ${IE.fmt(payable)}`;

      let note;
      if (me.loan > collateral) {
        note = "Дългът надхвърли стойността на имотите ви — на следващата "
             + "обиколка банката ще поиска целия остатък.";
      } else if (payable <= 0) {
        note = "Нямате пари в брой за погасяване. Продайте или ипотекирайте актив.";
      } else if (!myTurn || !rightPhase) {
        note = "Погасяването е възможно само по време на вашия ход.";
      } else if (payable >= me.loan) {
        note = "Плащането закрива дълга и спира лихвата.";
      } else {
        note = `Плащате колкото имате; остават ${IE.fmt(me.loan - payable)} дълг. `
             + `Лихвата от ${IE.fmt(interest)} се дължи в брой на всяка ваша обиколка.`;
      }
      IE.el("bank-loan-note").textContent = note;
      repay.title = canRepay ? "" : note;
    } else {
      // Без заем панелът се връща в свито положение за следващия път.
      setLoanExpanded(false);
    }

    const ledger = IE.el("bank-transactions");
    ledger.innerHTML = "";
    const transactions = (g.bank_transactions || []).slice(-12).reverse();
    if (!transactions.length) {
      const empty = document.createElement("div");
      empty.className = "bank-transactions-empty";
      empty.textContent = "Все още няма транзакции.";
      ledger.appendChild(empty);
      return;
    }
    const partyName = (playerId) => {
      const player = playerId && g.players[playerId];
      return player ? player.name : "Българска народна банка";
    };
    transactions.forEach((transaction) => {
      const row = document.createElement("div");
      row.className = "bank-transaction";

      const route = document.createElement("div");
      route.className = "bank-transaction-route";
      route.innerHTML = G.colorizeNames(
        `${partyName(transaction.from)} → ${partyName(transaction.to)}`
      );

      const reason = document.createElement("div");
      reason.className = "bank-transaction-reason";
      reason.textContent = transaction.reason || "Плащане";

      const amount = document.createElement("strong");
      amount.textContent = IE.fmt(transaction.amount || 0);

      const time = document.createElement("time");
      time.textContent = transaction.ts
        ? new Date(transaction.ts * 1000).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })
        : "";

      row.append(route, reason, amount, time);
      ledger.appendChild(row);
    });
  }

  function setLoanExpanded(open) {
    const toggle = IE.el("bank-loan-toggle");
    IE.el("bank-loan-details").classList.toggle("hidden", !open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("is-open", open);
  }

  IE.el("bank-loan-toggle").addEventListener("click", () => {
    const open = IE.el("bank-loan-toggle").getAttribute("aria-expanded") === "true";
    setLoanExpanded(!open);
  });

  IE.el("bank-loan-repay").addEventListener("click", () => {
    socket.emit("repay_loan", {});
  });

  IE.el("bank-toggle").addEventListener("click", () => {
    IE.el("bank-modal").classList.remove("hidden");
  });
  IE.el("bank-close").addEventListener("click", () => {
    IE.el("bank-modal").classList.add("hidden");
  });
  IE.el("bank-modal").addEventListener("click", (e) => {
    if (e.target === IE.el("bank-modal")) IE.el("bank-modal").classList.add("hidden");
  });

  /* ----------------------------------------------------------
     Подробна история
     ---------------------------------------------------------- */
  let historyFilter = "all";

  function historyCategory(type) {
    if (["dice", "move", "turn", "jail", "starting_order", "player_disconnected", "player_reconnected", "game_paused", "game_resumed"].includes(type)) return "movement";
    if (type === "payment") return "money";
    if (type === "card") return "cards";
    return "property";
  }

  function historyDescription(entry) {
    const g = state.game;
    const playerName = (id) => id && g.players[id] ? g.players[id].name : "Банката";
    const spaceName = (pos) => BOARD.spaces[pos] ? BOARD.spaces[pos].name : `поле ${pos}`;
    switch (entry.type) {
      case "dice": return `${playerName(entry.player_id)} хвърли ${entry.dice[0]} и ${entry.dice[1]}.`;
      case "move": return `${playerName(entry.player_id)} се премести от „${spaceName(entry.from)}“ до „${spaceName(entry.to)}“.`;
      case "card": return `${playerName(entry.player_id)} изтегли карта: ${entry.text}`;
      case "payment": return entry.description
        || `${playerName(entry.from)} плати ${IE.fmt(entry.amount)} на ${playerName(entry.to)}${entry.reason ? ` · ${entry.reason}` : ""}.`;
      case "purchase": return `${playerName(entry.player_id)} придоби „${spaceName(entry.position)}“ за ${IE.fmt(entry.price)}.`;
      case "auction_end": return entry.winner
        ? `${playerName(entry.winner)} спечели търга за „${spaceName(entry.position)}“ с ${IE.fmt(entry.price)}.`
        : `Търгът за „${spaceName(entry.position)}“ приключи без купувач.`;
      case "auction_bid": {
        const auction = entry.auction || {};
        return `${playerName(auction.highest_bidder)} наддаде ${IE.fmt(auction.highest_bid || 0)} за „${spaceName(auction.position)}“.`;
      }
      case "build": return `${playerName(entry.player_id)} разви „${spaceName(entry.position)}“ до ${BOARD.improvement_levels[entry.level]}.`;
      case "sell_improvement": return `${playerName(entry.player_id)} продаде подобрение на „${spaceName(entry.position)}“.`;
      case "mortgage": return `${playerName(entry.player_id)} ипотекира „${spaceName(entry.position)}“.`;
      case "unmortgage": return `${playerName(entry.player_id)} освободи ипотеката на „${spaceName(entry.position)}“.`;
      case "trade_accepted": {
        const trade = entry.trade || {};
        const count = (trade.offer_properties || []).length + (trade.request_properties || []).length;
        return `${playerName(trade.from_player)} и ${playerName(trade.to_player)} приключиха сделка с ${count} прехвърлени имота.`;
      }
      case "ownership_transfer": return `${(entry.positions || []).length} имота преминаха от ${playerName(entry.from)} към ${playerName(entry.to)} след фалит.`;
      case "bankrupt": return `${playerName(entry.player_id)} обяви фалит.`;
      case "jail": return `${playerName(entry.player_id)} беше изпратен на административна проверка.`;
      case "turn": return `Ред е на ${playerName(entry.player_id)}${entry.extra ? " · допълнителен ход" : ""}.`;
      case "mortgage_transfer": return `${playerName(entry.transfer && entry.transfer.player_id)} получи ${(entry.transfer && entry.transfer.positions || []).length} ипотекирани имота.`;
      case "mission_completed": return `${playerName(entry.player_id)} изпълни тайната мисия „${entry.title}“ и получи ${IE.fmt(entry.bonus)}.`;
      case "group_completed": return `${playerName(entry.player_id)} завърши цялата група „${entry.group_name}“.`;
      case "global_event_start": return `Започна глобалното събитие „${entry.event.title}“: ${entry.event.description}`;
      case "global_event_end": return `Глобалното събитие „${entry.event.title}“ приключи.`;
      case "tax_amnesty": return `${playerName(entry.player_id)} не плати данък заради данъчната амнистия.`;
      case "starting_order": return `Началният ред е: ${(entry.order || []).map(playerName).join(", ")}.`;
      case "player_disconnected": return `${entry.name || playerName(entry.player_id)} загуби връзка.`;
      case "player_reconnected": return `${entry.name || playerName(entry.player_id)} се свърза отново.`;
      case "game_paused": return `${playerName(entry.player_id)} постави партията на пауза.`;
      case "game_resumed": return `${playerName(entry.player_id)} възобнови партията.`;
      default: return entry.type;
    }
  }

  function renderTurnHistory() {
    const g = state.game;
    const box = IE.el("turn-history");
    box.innerHTML = "";
    if (!g) return;
    const entries = (state.fullHistory || []).filter((entry) =>
      historyFilter === "all" || historyCategory(entry.type) === historyFilter
    ).slice().reverse();
    if (!entries.length) {
      box.innerHTML = '<p class="history-empty">Все още няма събития в тази категория.</p>';
      return;
    }
    let lastRound = null;
    const icons = { movement: "→", money: "€", property: "⌂", cards: "▣" };
    entries.forEach((entry) => {
      if (entry.round !== lastRound) {
        const heading = document.createElement("div");
        heading.className = "history-round";
        heading.textContent = `Рунд ${entry.round}`;
        box.appendChild(heading);
        lastRound = entry.round;
      }
      const category = historyCategory(entry.type);
      const row = document.createElement("div");
      row.className = `history-entry history-${category}`;
      const when = entry.ts
        ? new Date(entry.ts * 1000).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
      row.innerHTML = `<span class="history-icon">${icons[category]}</span>`
        + `<p>${G.colorizeNames(historyDescription(entry))}</p><time>${when}</time>`;
      box.appendChild(row);
    });
  }

  /* ----------------------------------------------------------
     Панел на домакина

     Събира на едно място всичко, което досега беше пръснато по картите
     на играчите и по страничните бутони: пауза, пропускане, премахване,
     прехвърляне на домакинството, запис и конзолата на връзките.
     ---------------------------------------------------------- */
  const adminModal = IE.el("admin-modal");
  let connectionEntries = [];

  const CONNECTION_LABELS = {
    create: { icon: "🏠", text: "създаде стаята" },
    join: { icon: "➕", text: "се присъедини" },
    reconnect: { icon: "🔄", text: "се свърза отново" },
    disconnect: { icon: "⚡", text: "загуби връзка" },
    leave: { icon: "🚪", text: "напусна" },
    kick: { icon: "⛔", text: "беше премахнат" },
  };

  function adminOpen() { return !adminModal.classList.contains("hidden"); }

  function openAdminPanel() {
    // Панелът борави с текущата партия — преди старта няма какво да покаже.
    if (!state.isHost || !state.game) return;
    adminModal.classList.remove("hidden");
    socket.emit("host_connection_log", {});
    renderAdminPanel();
  }

  function closeAdminPanel() { adminModal.classList.add("hidden"); }

  function renderAdminPanel() {
    if (!adminOpen()) return;
    renderAdminActions();
    renderAdminPlayers();
    renderConnectionConsole();
  }

  function adminButton(box, label, className, onClick, disabled, hint) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.innerHTML = hint
      ? `<span>${label}</span><small>${hint}</small>`
      : `<span>${label}</span>`;
    btn.disabled = !!disabled;
    btn.onclick = onClick;
    box.appendChild(btn);
    return btn;
  }

  function renderAdminActions() {
    const g = state.game;
    const box = IE.el("admin-actions");
    box.innerHTML = "";
    if (!g) return;
    const over = !!g.winner;

    adminButton(
      box, g.paused ? "▶ Възобнови партията" : "⏸ Постави на пауза",
      "admin-action",
      () => socket.emit("host_toggle_pause", {}),
      over,
      g.paused ? "Таймерите продължават оттам, докъдето са стигнали."
        : "Спира таймерите на хода и на търга за всички.",
    );

    const current = g.players[g.current_player];
    adminButton(
      box, "⏭ Пропусни текущия ход", "admin-action",
      () => {
        G.confirmAction({
          title: "Пропускане на хода",
          body: [
            `Да пропуснете ли хода на ${current ? current.name : "играча"}?`,
            "Ходът минава към следващия играч, без да се изиграе.",
          ],
          confirmLabel: "Пропусни",
          danger: true,
          onConfirm: () => socket.emit(
            "host_skip_turn", { player_id: g.current_player, force: true },
          ),
        });
      },
      over || g.paused || !g.current_player || g.phase === "AWAITING_AUCTION",
      current ? `На ход е ${current.name}.` : "Няма играч на ход.",
    );

    adminButton(
      box, "💾 Запази играта", "admin-action",
      () => socket.emit("host_save_game", {}), over,
      "Ръчен запис — играта се записва и автоматично след всяко действие.",
    );

    adminButton(
      box, "🏁 Приключи партията", "admin-action is-danger",
      () => {
        G.confirmAction({
          title: "Предсрочен край",
          body: [
            "Да приключите ли партията сега?",
            "Печели играчът с най-голямо състояние в момента. Действието е необратимо.",
          ],
          confirmLabel: "Приключи",
          danger: true,
          onConfirm: () => {
            closeAdminPanel();
            socket.emit("host_end_game", {});
          },
        });
      },
      over || g.paused,
      "Побеждава най-богатият в момента.",
    );
  }

  function renderAdminPlayers() {
    const g = state.game;
    const box = IE.el("admin-players");
    box.innerHTML = "";
    if (!g) return;
    // Освен участниците в партията панелът показва и зрителите: който се
    // присъедини след старта, влиза само в стаята, но домакинът трябва да
    // може да го премахне или да му предаде ролята си.
    const lobbyMembers = (state.lobby && state.lobby.members) || [];
    const spectators = lobbyMembers.filter(
      (m) => !g.players[m.player_id] && !m.is_bot,
    );
    for (const pid of [...g.turn_order, ...spectators.map((m) => m.player_id)]) {
      const p = g.players[pid]
        || lobbyMembers.find((m) => m.player_id === pid);
      if (!p) continue;
      const inGame = !!g.players[pid];
      const row = document.createElement("div");
      row.className = "admin-player-row";
      const flags = [];
      if (inGame && pid === g.current_player) flags.push("на ход");
      if (p.bankrupt) flags.push("отпаднал");
      if (!p.connected) flags.push("извън линия");
      if (p.is_bot) flags.push("бот");
      if (p.is_host) flags.push("домакин");
      if (!inGame) flags.push("зрител");
      const timeouts = +(p.stats && p.stats.consecutive_timeouts) || 0;
      if (timeouts) flags.push(`${timeouts} неактивни хода`);

      const identity = document.createElement("div");
      identity.className = "apr-identity";
      identity.innerHTML = `
        <span class="apr-token" style="color:${IE.tokenColor(p.token)}">${IE.tokenSvg(p.token, p.gender, p)}</span>
        <span class="apr-name"><b>${p.name}${pid === state.myId ? " (вие)" : ""}</b>
          <small>${flags.join(" · ") || "в играта"}</small></span>`;
      row.appendChild(identity);

      const controls = document.createElement("div");
      controls.className = "apr-controls";

      if (inGame && pid === g.current_player && !p.bankrupt && !g.winner) {
        const skip = document.createElement("button");
        skip.type = "button";
        skip.className = "btn-ghost";
        skip.textContent = "⏭ Пропусни";
        skip.disabled = g.paused || g.phase === "AWAITING_AUCTION";
        skip.onclick = () => G.confirmAction({
          title: "Пропускане на хода",
          body: [`Да пропуснете ли хода на ${p.name}?`],
          confirmLabel: "Пропусни",
          danger: true,
          onConfirm: () => socket.emit(
            "host_skip_turn", { player_id: pid, force: true },
          ),
        });
        controls.appendChild(skip);
      }

      if (pid !== state.myId && !p.is_bot) {
        const promote = document.createElement("button");
        promote.type = "button";
        promote.className = "btn-ghost";
        promote.textContent = "👑 Домакин";
        promote.title = "Прехвърли домакинството на този играч";
        promote.disabled = !p.connected;
        promote.onclick = () => G.confirmAction({
          title: "Прехвърляне на домакинството",
          body: [
            `Да направите ли ${p.name} домакин на стаята?`,
            "Вие губите достъпа до този панел.",
          ],
          confirmLabel: "Прехвърли",
          onConfirm: () => {
            closeAdminPanel();
            socket.emit("transfer_host", { player_id: pid });
          },
        });
        controls.appendChild(promote);
      }

      if (pid !== state.myId) {
        const kick = document.createElement("button");
        kick.type = "button";
        kick.className = "btn-ghost is-danger";
        kick.textContent = "⛔ Премахни";
        kick.disabled = !!g.paused;
        kick.onclick = () => G.confirmAction({
          title: "Премахване на играч",
          body: [
            inGame
              ? `Наистина ли премахвате ${p.name} от партията?`
              : `Наистина ли премахвате зрителя ${p.name} от стаята?`,
            p.connected ? "Играчът е свързан в момента и ще бъде изхвърлен." : "",
            inGame
              ? "Имотите му се връщат на банката и стават свободни за всички."
              : "",
          ].filter(Boolean),
          confirmLabel: "Премахни",
          danger: true,
          onConfirm: () => socket.emit(
            "host_remove_player", { player_id: pid, force: true },
          ),
        });
        controls.appendChild(kick);
      }

      row.appendChild(controls);
      box.appendChild(row);
    }
  }

  function renderConnectionConsole() {
    const box = IE.el("admin-console");
    box.innerHTML = "";
    IE.el("admin-console-count").textContent = connectionEntries.length
      ? `${connectionEntries.length} записа` : "";
    if (!connectionEntries.length) {
      box.innerHTML = '<p class="ps-note">Още няма записи за тази стая.</p>';
      return;
    }
    // Най-новото отгоре — то интересува домакина в момента.
    for (const entry of [...connectionEntries].reverse()) {
      const meta = CONNECTION_LABELS[entry.event]
        || { icon: "•", text: entry.event };
      const when = new Date((entry.ts || 0) * 1000);
      const date = when.toLocaleDateString("bg-BG", {
        day: "2-digit", month: "2-digit", year: "numeric",
      });
      const clock = when.toLocaleTimeString("bg-BG", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
      const row = document.createElement("div");
      row.className = `console-row is-${entry.event}`;
      row.innerHTML = `
        <span class="cr-icon">${meta.icon}</span>
        <span class="cr-time"><b>${clock}</b><small>${date}</small></span>
        <span class="cr-body">
          <b>${IE.escapeHtml(entry.name || "—")}</b> ${meta.text}
          ${entry.detail ? `<small>${IE.escapeHtml(entry.detail)}</small>` : ""}
        </span>
        <code class="cr-ip">${IE.escapeHtml(entry.ip || "неизвестен")}</code>`;
      box.appendChild(row);
    }
  }

  socket.on("connection_log", (payload) => {
    connectionEntries = (payload && payload.entries) || [];
    if (adminOpen()) renderConnectionConsole();
  });

  IE.el("btn-admin-panel").addEventListener("click", openAdminPanel);
  IE.el("admin-close").addEventListener("click", closeAdminPanel);
  IE.el("admin-console-refresh").addEventListener("click", () => {
    socket.emit("host_connection_log", {});
  });
  adminModal.addEventListener("click", (event) => {
    if (event.target === adminModal) closeAdminPanel();
  });
  adminModal.querySelectorAll("[data-admin-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.adminTab;
      adminModal.querySelectorAll("[data-admin-tab]").forEach((item) => {
        const active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
      adminModal.querySelectorAll("[data-admin-pane]").forEach((pane) => {
        pane.classList.toggle("hidden", pane.dataset.adminPane !== target);
      });
    });
  });

  G.renderAdminPanel = renderAdminPanel;

  /* Преизчислява само домакинските контроли. Вика се и от `lobby_state`
     при предаване на ролята: тогава няма игрово събитие, което да
     задейства пълния рендер. */
  G.renderHostControls = function renderHostControls() {
    const g = state.game;
    if (!g) return;
    IE.el("btn-admin-panel").classList.toggle("hidden", !state.isHost);
    IE.el("btn-pause-game").classList.toggle(
      "hidden", !state.isHost || !!g.winner,
    );
    if (!state.isHost) closeAdminPanel();
    else renderAdminPanel();
  };

  IE.el("btn-history").addEventListener("click", () => {
    // Протоколът тежи около 21 KB и затова не пътува при всяко обновяване;
    // тегли се точно когато потрябва.
    socket.emit("request_history", {});
    renderTurnHistory();
    IE.el("history-modal").classList.remove("hidden");
  });
  socket.on("game_history", (payload) => {
    state.fullHistory = (payload && payload.entries) || [];
    if (!IE.el("history-modal").classList.contains("hidden")) renderTurnHistory();
  });
  IE.el("history-close").addEventListener("click", () => IE.el("history-modal").classList.add("hidden"));
  IE.el("history-modal").addEventListener("click", (e) => {
    if (e.target === IE.el("history-modal")) IE.el("history-modal").classList.add("hidden");
  });
  IE.el("history-filters").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      historyFilter = button.dataset.historyFilter;
      IE.el("history-filters").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      renderTurnHistory();
    });
  });

  /* ----------------------------------------------------------
     Център за известия
     ---------------------------------------------------------- */
  function notificationStorageKey() {
    return `ie_notification_cursor:${state.roomCode || "room"}:${state.myId || "viewer"}`;
  }

  function notificationCursor() {
    try {
      return Number(localStorage.getItem(notificationStorageKey())) || 0;
    } catch {
      return 0;
    }
  }

  function setNotificationCursor(value = G.syncedServerNow()) {
    try {
      localStorage.setItem(notificationStorageKey(), String(value));
    } catch {
      // Частният режим може да забранява localStorage; центърът остава видим.
    }
  }

  function notificationPlayerName(playerId) {
    const player = state.game && state.game.players[playerId];
    return player ? player.name : "Българската народна банка";
  }

  function notificationItems() {
    const g = state.game;
    if (!g) return [];
    const items = [];
    for (const trade of Object.values(g.trades || {})) {
      if (trade.to_player !== state.myId) continue;
      const sender = g.players[trade.from_player];
      items.push({
        id: `trade:${trade.trade_id}`,
        ts: Number(trade.created_at) || Number(g.server_time) || 0,
        icon: "🤝",
        kind: "trade",
        title: trade.counter_of ? "Нова контраоферта" : "Нова сделка",
        text: `${sender ? sender.name : "Играч"} очаква вашия отговор.`,
      });
    }
    const importantTypes = new Set([
      "global_event_start", "global_event_end", "auction_end", "group_completed",
      "mission_completed", "bankrupt", "player_disconnected", "player_reconnected",
      "game_paused", "game_resumed",
    ]);
    // Малката извадка от протокола — идва при всяко обновяване, за
    // разлика от пълната история, която се тегли по заявка.
    (g.notable_history || []).forEach((event, index) => {
      const type = event.type;
      const importantPayment = type === "payment" && Number(event.amount) >= 100
        && (state.isSpectator || event.from === state.myId || event.to === state.myId);
      if (!importantTypes.has(type) && !importantPayment) return;
      let icon = "🔔";
      let title = "Важно събитие";
      let text = event.description || event.reason || "";
      if (type === "global_event_start") {
        icon = (event.event && event.event.icon) || "🌍";
        title = `Глобално събитие: ${(event.event && event.event.title) || "Ново събитие"}`;
        text = (event.event && event.event.description) || text;
      } else if (type === "global_event_end") {
        icon = "🌤️";
        title = "Глобалното събитие приключи";
        text = (event.event && event.event.title) || text;
      } else if (type === "auction_end") {
        icon = "🔨";
        title = "Търгът приключи";
        text = event.winner
          ? `${notificationPlayerName(event.winner)} спечели с ${IE.fmt(event.price || 0)}.`
          : "Нямаше печеливша оферта.";
      } else if (type === "group_completed") {
        icon = "🏙️";
        title = "Завършена цветова група";
        text = `${notificationPlayerName(event.player_id)} завърши „${event.group_name || event.group}“.`;
      } else if (type === "mission_completed") {
        icon = "🎯";
        title = "Изпълнена мисия";
        text = `${notificationPlayerName(event.player_id)} получи бонус ${IE.fmt(event.bonus || 0)}.`;
      } else if (type === "bankrupt") {
        icon = "💥";
        title = "Фалит";
        text = `${notificationPlayerName(event.player_id)} напусна надпреварата.`;
      } else if (type === "player_disconnected" || type === "player_reconnected") {
        const returned = type === "player_reconnected";
        icon = returned ? "🟢" : "🔌";
        title = returned ? "Играчът се свърза отново" : "Прекъснал играч";
        text = `${event.name || notificationPlayerName(event.player_id)} ${returned ? "се върна в играта" : "загуби връзка"}.`;
      } else if (type === "game_paused" || type === "game_resumed") {
        const resumed = type === "game_resumed";
        icon = resumed ? "▶️" : "⏸️";
        title = resumed ? "Партията е възобновена" : "Партията е на пауза";
        text = `${notificationPlayerName(event.player_id)} ${resumed ? "възобнови" : "паузира"} играта.`;
      } else if (importantPayment) {
        icon = "💶";
        title = "Важно плащане";
        text = `${notificationPlayerName(event.from)} → ${notificationPlayerName(event.to)} · ${IE.fmt(event.amount)}${text ? ` · ${text}` : ""}`;
      }
      items.push({
        id: `event:${type}:${event.ts || 0}:${index}`,
        ts: Number(event.ts) || 0,
        icon,
        kind: type,
        title,
        text,
      });
    });
    return items.sort((a, b) => b.ts - a.ts).slice(0, 100);
  }

  function renderNotificationBadge() {
    const items = notificationItems();
    const cursor = notificationCursor();
    const unread = items.filter((item) => item.ts > cursor).length;
    const badge = IE.el("notification-badge");
    if (!badge) return;
    badge.textContent = unread > 99 ? "99+" : String(unread);
    badge.classList.toggle("hidden", unread === 0);
    IE.el("btn-notifications").classList.toggle("has-unread", unread > 0);
    if (!IE.el("notifications-modal").classList.contains("hidden")) renderNotifications();
  }

  function renderNotifications() {
    const list = IE.el("notifications-list");
    if (!list) return;
    const items = notificationItems();
    const cursor = notificationCursor();
    const unread = items.filter((item) => item.ts > cursor).length;
    IE.el("notifications-summary").textContent = `${items.length} запазени · ${unread} непрочетени`;
    list.innerHTML = items.length ? items.map((item) => {
      const time = item.ts
        ? new Date(item.ts * 1000).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "";
      return `<article class="notification-item${item.ts > cursor ? " unread" : ""}">
        <i>${item.icon}</i><div><strong>${G.colorizeNames(IE.escapeHtml(item.title))}</strong>
        <p>${G.colorizeNames(IE.escapeHtml(item.text))}</p></div><time>${time}</time>
      </article>`;
    }).join("") : '<p class="notifications-empty">Все още няма запазени известия.</p>';
  }

  IE.el("btn-notifications").addEventListener("click", () => {
    renderNotifications();
    IE.el("notifications-modal").classList.remove("hidden");
    setNotificationCursor();
    renderNotificationBadge();
  });
  IE.el("notifications-read-all").addEventListener("click", () => {
    setNotificationCursor();
    renderNotifications();
    renderNotificationBadge();
  });
  IE.el("notifications-close").addEventListener("click", () => IE.el("notifications-modal").classList.add("hidden"));
  IE.el("notifications-modal").addEventListener("click", (event) => {
    if (event.target === IE.el("notifications-modal")) IE.el("notifications-modal").classList.add("hidden");
  });

  /* ----------------------------------------------------------
     Победа
     ---------------------------------------------------------- */
  let victoryShown = false;
  function renderVictory() {
    const g = state.game;
    if (!g.winner || victoryShown) return;
    victoryShown = true;
    const winner = g.players[g.winner];
    IE.el("victory-name").textContent = winner ? winner.name : "?";
    renderFinalReport(g);
    // Реванш: само домакинът може да го стартира.
    const rematchBtn = IE.el("btn-rematch");
    rematchBtn.classList.toggle("hidden", !state.isHost);
    IE.el("rematch-hint").textContent = state.isHost
      ? "Нова игра със същите играчи и настройки."
      : "Изчакайте домакина за реванш.";
    IE.el("victory-modal").classList.remove("hidden");
    G.spawnConfetti();
  }

  function renderFinalReport(g) {
    const report = IE.el("victory-report");
    report.innerHTML = "";
    for (const [index, row] of (g.final_report || []).entries()) {
      const stats = row.stats || {};
      const bestProp = row.best_property
        ? `${row.best_property}${row.best_property_income ? " (" + IE.fmt(row.best_property_income) + ")" : ""}`
        : "без водещ имот";
      const item = document.createElement("div");
      item.className = "victory-row" + (row.player_id === g.winner ? " winner" : "");
      item.innerHTML = `
        <div class="vr-rank">${index + 1}</div>
        <div class="vr-token" style="color:${IE.tokenColor(row.token)}">${IE.tokenSvg(row.token, row.gender, row)}</div>
        <div class="vr-main">
          <b>${row.name}${row.bankrupt ? " · фалит" : ""}</b>
          <span>🏆 най-печеливш: ${bestProp}</span>
        </div>
        <div class="vr-stat"><b>${IE.fmt(row.net_worth)}</b><span>богатство</span></div>
        <div class="vr-stat"><b>${IE.fmt(stats.rent_collected || 0)}</b><span>събран наем</span></div>
        <div class="vr-stat"><b>${IE.fmt(stats.rent_paid || 0)}</b><span>платен наем</span></div>
        <div class="vr-stat"><b>${row.properties}</b><span>имота</span></div>
        <div class="vr-stat"><b>${stats.laps || 0}</b><span>обиколки</span></div>
        <div class="vr-stat" title="Среден резултат от заровете и брой чифтове">
          <b>${row.avg_roll || 0} 🎲</b><span>${stats.doubles || 0} чифта</span></div>
        <div class="vr-stat"><b>${stats.trades_completed || 0}</b><span>сделки</span></div>`;
      report.appendChild(item);
    }
    renderWealthChart(g);
  }

  function renderWealthChart(g) {
    const box = IE.el("victory-chart");
    box.innerHTML = "";
    const history = g.wealth_history || [];
    if (history.length < 2) return;
    const width = 720;
    const height = 170;
    const pad = 16;
    const values = history.flatMap((point) => Object.values(point.values || {}));
    const maxValue = Math.max(1, ...values);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "История на богатството по рундове");
    for (const pid of g.turn_order) {
      const player = g.players[pid];
      if (!player) continue;
      const points = history.map((point, index) => {
        const x = pad + index * (width - pad * 2) / Math.max(1, history.length - 1);
        const y = height - pad - ((point.values || {})[pid] || 0) / maxValue * (height - pad * 2);
        return `${x},${y}`;
      }).join(" ");
      const color = IE.tokenColor(player.token);
      const wide = pid === g.winner ? 4 : 2.5;
      // Контрастен ореол зад линията: светъл под тъмни цветове, тъмен под
      // светли — така и черната, и бялата линия се четат на всеки фон.
      const halo = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      halo.setAttribute("points", points);
      halo.setAttribute("fill", "none");
      halo.setAttribute("stroke", G.isLightColor(color) ? "rgba(9,15,28,0.9)" : "rgba(255,255,255,0.9)");
      halo.setAttribute("stroke-width", String(wide + 2.4));
      halo.setAttribute("stroke-linecap", "round");
      halo.setAttribute("stroke-linejoin", "round");
      svg.appendChild(halo);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("points", points);
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", String(wide));
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-linejoin", "round");
      svg.appendChild(line);
    }
    const title = document.createElement("div");
    title.className = "victory-chart-title";
    title.textContent = "Развитие на богатството";
    box.append(title, svg);
  }

  IE.el("btn-victory-exit").addEventListener("click", () => {
    IE.storage.reconnectToken = null;
    window.location.href = IE.urls.home;
  });

  IE.el("btn-rematch").addEventListener("click", () => {
    IE.el("btn-rematch").disabled = true;
    socket.emit("rematch", {});
  });

  /* Прибиращи се панели на телефон; действията остават отворени. */
  const mobilePanelQuery = window.matchMedia("(max-width: 720px)");
  document.querySelectorAll(".mobile-collapsible").forEach((panel) => {
    const toggle = panel.querySelector(".mobile-panel-toggle");
    const initiallyCollapsed = ["players", "properties", "log", "chat"]
      .includes(panel.dataset.mobilePanel);
    if (mobilePanelQuery.matches && initiallyCollapsed) {
      panel.classList.add("mobile-collapsed");
      toggle.setAttribute("aria-expanded", "false");
    }
    toggle.addEventListener("click", () => {
      const collapsed = panel.classList.toggle("mobile-collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
    });
  });

  /* ----------------------------------------------------------
     Цял екран
     ---------------------------------------------------------- */
  const enterFullscreenBtn = IE.el("btn-enter-fullscreen");
  const exitFullscreenBtn = IE.el("btn-exit-fullscreen");
  function currentFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function renderFullscreenButtons() {
    const isFullscreen = !!currentFullscreenElement();
    enterFullscreenBtn.classList.toggle("hidden", isFullscreen);
    exitFullscreenBtn.classList.toggle("hidden", !isFullscreen);
  }
  async function enterFullscreen() {
    // Модалните прозорци са извън #game-view. Целият документ трябва да е
    // fullscreen, за да останат видими и кликаеми сделките и потвържденията.
    const target = document.documentElement;
    try {
      if (target.requestFullscreen) await target.requestFullscreen();
      else if (target.webkitRequestFullscreen) await target.webkitRequestFullscreen();
      else IE.toast("Браузърът не поддържа цял екран.", "error");
    } catch {
      IE.toast("Браузърът не позволи цял екран.", "error");
    }
    renderFullscreenButtons();
  }
  async function exitFullscreen() {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      else IE.toast("Браузърът не поддържа изход от цял екран.", "error");
    } catch {
      IE.toast("Неуспешен изход от цял екран.", "error");
    }
    renderFullscreenButtons();
  }
  enterFullscreenBtn.addEventListener("click", enterFullscreen);
  exitFullscreenBtn.addEventListener("click", exitFullscreen);
  document.addEventListener("fullscreenchange", renderFullscreenButtons);
  document.addEventListener("webkitfullscreenchange", renderFullscreenButtons);
  renderFullscreenButtons();

  /* ----------------------------------------------------------
     „Твой ред" в скрит таб

     Ходът тече и когато играчът гледа друг таб — при 60-секунден лимит
     това е пропуснат ход. Заглавието мига и иконката получава червена
     точка (не искат разрешение), а системното известие стои зад бутона
     в горната лента, защото Notification.requestPermission изисква
     потребителски жест.
     ---------------------------------------------------------- */
  const turnNotifyBtn = IE.el("btn-turn-notify");

  function renderTurnNotifyButton() {
    const on = IE.storage.turnNotify && !IE.tabAlert.notifyBlocked;
    turnNotifyBtn.classList.toggle("is-active", !!on);
    turnNotifyBtn.setAttribute("aria-pressed", String(!!on));
    turnNotifyBtn.textContent = on ? "📣" : "🔕";
    turnNotifyBtn.title = !IE.tabAlert.notifySupported
      ? "Браузърът не поддържа системни известия"
      : IE.tabAlert.notifyBlocked
        ? "Известията са блокирани от браузъра — разрешете ги от адресната лента"
        : on
          ? "Системно известие при твой ред: включено"
          : "Системно известие при твой ред: изключено";
  }

  turnNotifyBtn.addEventListener("click", async () => {
    if (!IE.tabAlert.notifySupported) {
      IE.toast("Браузърът не поддържа системни известия.", "error");
      return;
    }
    const enabled = await IE.tabAlert.toggleNotify();
    renderTurnNotifyButton();
    if (enabled) IE.toast("Ще ви известяваме при твой ред.", "success");
    else if (IE.tabAlert.notifyBlocked) {
      IE.toast("Браузърът блокира известията за тази страница.", "error");
    } else IE.toast("Известията при твой ред са изключени.", "info");
  });
  renderTurnNotifyButton();

  /* Мига ли заглавието — решава се от състоянието, не от преход: така
     покрива и случая „ходът е мой, а после превключвам таба". */
  G.updateTurnAlert = function updateTurnAlert() {
    const g = state.game;
    const me = g && g.players[state.myId];
    // При пауза таймерът е замразен — мигащото „Твой ред" би подканвало
    // към ход, който още не може да се направи.
    const mine = !!g && !g.winner && !g.paused && !state.isSpectator
      && g.current_player === state.myId && !!me && !me.bankrupt;
    if (mine && document.hidden) IE.tabAlert.start("(!) Твой ред");
    else IE.tabAlert.stop();
  };

  document.addEventListener("visibilitychange", () => G.updateTurnAlert());

  /* Системното известие е еднократно — задейства се при самия преход
     на хода (от events.js), не при всяко прерисуване. */
  G.notifyMyTurn = function notifyMyTurn() {
    const g = state.game;
    if (!g || g.winner || state.isSpectator) return;
    IE.tabAlert.notify("Имоти и Империи — твой ред", `Рунд ${g.round_number}. Хвърли заровете.`);
  };

  /* ----------------------------------------------------------
     Брояч на времето за ход (сървърът налага лимита)
     ---------------------------------------------------------- */
  let lastTimerBeepSecond = null;

  function updateTurnTimer() {
    const el = IE.el("center-timer");
    const g = state.game;
    if (!el) return;
    if (!g || !g.turn_deadline || g.winner || g.settings.turn_time_limit <= 0) {
      el.textContent = "";
      el.classList.remove("warn");
      lastTimerBeepSecond = null;
      return;
    }
    if (g.paused) {
      const frozen = Math.max(0, Math.ceil(g.paused_turn_remaining || 0));
      el.textContent = `⏸ Паузирано · ${frozen} сек`;
      el.classList.remove("warn");
      return;
    }
    const remaining = Math.max(
      0,
      Math.min(
        g.settings.turn_time_limit,
        Math.ceil(g.turn_deadline - G.syncedServerNow()),
      ),
    );
    el.textContent = `⏱ ${remaining} сек`;
    el.classList.toggle("warn", remaining <= 10);
    // Звуково предупреждение само за играча на ход: веднъж на 10-ата
    // секунда и тиктакане в последните 5.
    const myTurn = g.current_player === state.myId && !state.isSpectator;
    if (myTurn && remaining > 0 && remaining <= 10) {
      if (remaining !== lastTimerBeepSecond) {
        lastTimerBeepSecond = remaining;
        if (remaining === 10) IE.sound.warn();
        else if (remaining <= 5) IE.sound.timerTick();
      }
    } else {
      lastTimerBeepSecond = null;
    }
  }

  // Обратно броене за прекъснати играчи (изчаква връзка / изтекло).
  function updateReconnectTimers() {
    const now = G.syncedServerNow();
    for (const el of document.querySelectorAll(".pc-reconnect")) {
      if (state.game && state.game.paused) {
        const frozen = Math.max(0, Math.ceil(parseFloat(el.dataset.pausedRemaining || "0")));
        el.textContent = `⏸ срокът за връзка е спрян (${frozen} сек остават)`;
        el.classList.remove("expired");
        continue;
      }
      const deadline = parseFloat(el.dataset.deadline || "0");
      const remaining = Math.ceil(deadline - now);
      if (remaining > 0) {
        el.textContent = `⏳ изчаква връзка (${remaining} сек)`;
        el.classList.remove("expired");
      } else {
        el.textContent = state.isHost
          ? "⚠ връзката изтече — пропуснете или премахнете играча"
          : "⚠ връзката изтече — чака домакина";
        el.classList.add("expired");
      }
    }
  }
  setInterval(() => { updateTurnTimer(); G.updateAuctionTimer(); updateReconnectTimers(); }, 500);

  /* ----------------------------------------------------------
     Звук: включване/изключване
     ---------------------------------------------------------- */
  const muteBtn = IE.el("btn-mute");
  const volumeBtn = IE.el("btn-volume");
  const volumePopover = IE.el("volume-popover");
  const volumeSlider = IE.el("volume-slider");
  const volumeValue = IE.el("volume-value");
  const previewBtn = IE.el("btn-sound-preview");
  const resetBtn = IE.el("btn-sound-reset");
  const mixer = IE.el("volume-mixer");
  const previewLabel = IE.el("volume-preview-label");
  let stopPreview = null;

  /* По един плъзгач за всеки вид звук, групиран по каталога. Строи се
     веднъж; после само стойностите се опресняват. */
  function buildMixer() {
    for (const section of IE.sound.CATALOG) {
      const heading = document.createElement("div");
      heading.className = "volume-mixer-group";
      heading.textContent = section.group;
      mixer.appendChild(heading);
      for (const item of section.items) {
        const row = document.createElement("label");
        row.className = "volume-mixer-row";
        row.innerHTML =
          `<span class="vm-label">${item.label}</span>`
          + `<output class="vm-value"></output>`
          + `<input class="vm-slider" type="range" min="0" max="100" step="5"`
          + ` data-sound="${item.key}" aria-label="Сила на звука „${item.label}“">`;
        mixer.appendChild(row);
      }
    }
    mixer.addEventListener("input", (event) => {
      const slider = event.target.closest(".vm-slider");
      if (!slider) return;
      IE.sound.setLevel(slider.dataset.sound, Number(slider.value) / 100);
      renderVolume();
    });
    // Прослушване на конкретния звук чак при пускане на плъзгача.
    mixer.addEventListener("change", (event) => {
      const slider = event.target.closest(".vm-slider");
      if (!slider || IE.storage.muted) return;
      const play = IE.sound[slider.dataset.sound];
      if (typeof play === "function") play.call(IE.sound);
    });
  }

  function renderVolume() {
    const muted = IE.storage.muted;
    const percent = Math.round(IE.storage.volume * 100);
    // Иконата отразява и заглушаването, и много ниската сила.
    muteBtn.textContent = muted || percent === 0 ? "🔇" : percent < 45 ? "🔉" : "🔊";
    muteBtn.title = muted ? "Звукът е изключен" : "Звук (вкл./изкл.)";
    volumeSlider.value = String(percent);
    volumeValue.textContent = muted ? "изкл." : percent + "%";
    volumePopover.classList.toggle("is-muted", muted);
    for (const slider of mixer.querySelectorAll(".vm-slider")) {
      const level = Math.round(IE.sound.levelOf(slider.dataset.sound) * 100);
      slider.value = String(level);
      const row = slider.closest(".volume-mixer-row");
      row.querySelector(".vm-value").textContent = level === 0 ? "изкл." : level + "%";
      row.classList.toggle("is-off", level === 0);
    }
    IE.sound.applyVolume();
  }

  /* Панелът виси вдясно под стрелката, но на тесен екран горната лента се
     пренася и подравняването вдясно го изкарва извън левия ръб. Затова при
     всяко отваряне проверяваме и при нужда го прилепваме към екрана. */
  function positionVolume() {
    volumePopover.style.left = "";
    volumePopover.style.right = "0";
    const control = volumePopover.parentElement.getBoundingClientRect();
    const margin = 8;
    if (control.right - volumePopover.offsetWidth < margin) {
      volumePopover.style.right = "auto";
      volumePopover.style.left = (margin - control.left) + "px";
    }
  }

  function closeVolume() {
    volumePopover.classList.add("hidden");
    volumeBtn.setAttribute("aria-expanded", "false");
    if (stopPreview) { stopPreview(); stopPreview = null; }
    previewLabel.textContent = "";
  }

  muteBtn.addEventListener("click", () => {
    IE.storage.muted = !IE.storage.muted;
    renderVolume();
    // Кратък сигнал при включване, за да се чуе текущата сила.
    if (!IE.storage.muted) IE.sound.turn();
  });

  volumeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = volumePopover.classList.contains("hidden");
    if (open) {
      volumePopover.classList.remove("hidden");
      volumeBtn.setAttribute("aria-expanded", "true");
      positionVolume();
      IE.sound.prime();
      volumeSlider.focus();
    } else {
      closeVolume();
    }
  });

  volumeSlider.addEventListener("input", () => {
    IE.storage.volume = Number(volumeSlider.value) / 100;
    // Движението на плъзгача сваля заглушаването — иначе не се чува нищо.
    if (IE.storage.muted && Number(volumeSlider.value) > 0) IE.storage.muted = false;
    renderVolume();
  });
  // Звукова обратна връзка чак при пускане, за да не трещи при влачене.
  volumeSlider.addEventListener("change", () => { IE.sound.buy(); });

  previewBtn.addEventListener("click", () => {
    if (stopPreview) { stopPreview(); stopPreview = null; previewLabel.textContent = ""; return; }
    if (IE.storage.muted) { IE.storage.muted = false; renderVolume(); }
    stopPreview = IE.sound.preview((label) => { previewLabel.textContent = label; });
  });

  resetBtn.addEventListener("click", () => {
    IE.sound.resetLevels();
    renderVolume();
    previewLabel.textContent = "Всички върнати на 100%";
    setTimeout(() => { previewLabel.textContent = ""; }, 2200);
  });

  volumePopover.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => {
    if (!volumePopover.classList.contains("hidden")) closeVolume();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !volumePopover.classList.contains("hidden")) closeVolume();
  });

  buildMixer();
  renderVolume();

  /* ----------------------------------------------------------
     Правила в играта (бутон горе вдясно след звука)
     ---------------------------------------------------------- */
  const rulesModal = IE.el("game-rules-modal");
  IE.el("btn-rules-game").addEventListener("click", () => {
    rulesModal.classList.remove("hidden");
  });
  rulesModal.addEventListener("click", (event) => {
    if (event.target === rulesModal || event.target.dataset.close !== undefined) {
      rulesModal.classList.add("hidden");
    }
  });
})();
