/* ============================================================
   Имоти и Империи — lobby: чакалнята преди старта.
   Списък играчи, избор на фигурка, настройки на домакина,
   готовност и стартиране.
   ============================================================ */
"use strict";

(function () {
  const G = window.IEGame;
  if (!G) return;
  const { socket, state } = G;

  socket.on("lobby_state", (lobby) => {
    state.lobby = lobby;
    state.started = lobby.started;
    const me = lobby.members.find((m) => m.player_id === state.myId);
    const wasHost = state.isHost;
    if (me) state.isHost = me.is_host;
    if (!lobby.started) {
      G.showView("lobby");
      renderLobby(lobby);
      return;
    }
    // По време на игра лобито се обновява без игрово събитие — например
    // при предаване на домакинството или при влизане на зрител. Тогава
    // домакинските контроли трябва да се пресметнат наново, иначе новият
    // домакин остава без панел до следващия ход.
    if (state.game && (wasHost !== state.isHost || G.renderHostControls)) {
      if (G.renderHostControls) G.renderHostControls();
    }
  });

  /* Ред с цветни образци (кожа или коса). Изборът пътува като частичен
     речник — сървърът приема само променените полета. */
  function renderLookRow(elId, options, field, selected, locked, colorOf) {
    const row = IE.el(elId);
    row.innerHTML = "";
    for (const [id, def] of Object.entries(options)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "look-swatch" + (id === selected ? " selected" : "");
      btn.style.background = colorOf(def);
      btn.title = def.name;
      btn.setAttribute("aria-label", def.name);
      btn.setAttribute("aria-pressed", String(id === selected));
      btn.disabled = locked;
      if (!locked && id !== selected) {
        btn.addEventListener("click", () => socket.emit("set_appearance", { [field]: id }));
      }
      row.appendChild(btn);
    }
  }

  /* Прическите се показват като глави, а не като цветни кръгчета —
     стилът личи само по формата. Предварителният изглед използва
     текущата кожа и цвят на косата, за да е верен на резултата. */
  function renderHairstyleRow(look, gender, locked) {
    const row = IE.el("hairstyle-picker");
    row.innerHTML = "";
    for (const [id, def] of Object.entries(IE.HAIRSTYLES)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hairstyle-choice" + (id === look.hairstyle ? " selected" : "");
      btn.title = def.name;
      btn.setAttribute("aria-label", def.name);
      btn.setAttribute("aria-pressed", String(id === look.hairstyle));
      btn.disabled = locked;
      btn.innerHTML = IE.headSvg(gender, { ...look, hairstyle: id })
        + `<span class="hairstyle-name">${def.name}</span>`;
      if (!locked && id !== look.hairstyle) {
        btn.addEventListener("click", () => socket.emit("set_appearance", { hairstyle: id }));
      }
      row.appendChild(btn);
    }
  }

  function renderLobby(lobby) {
    IE.el("room-code").textContent = lobby.room_code;

    // Списък играчи
    const list = IE.el("lobby-players");
    list.innerHTML = "";
    for (const m of lobby.members) {
      const row = document.createElement("div");
      row.className = "player-row";
      const badges = [];
      const isFemale = m.gender === "female";
      const genderLabel = isFemale ? "Жена" : "Мъж";
      badges.push(`<span class="p-badge ${isFemale ? "gender-female" : "gender-male"}">${isFemale ? "♀" : "♂"} ${genderLabel}</span>`);
      if (m.is_host) badges.push('<span class="p-badge host">Домакин</span>');
      if (m.is_bot) badges.push(`<span class="p-badge bot">Бот · ${G.botStyleLabel(m.bot_style)}</span>`);
      if (m.is_spectator) badges.push('<span class="p-badge spectator">Зрител</span>');
      else if (m.ready) badges.push('<span class="p-badge ready">Готов</span>');
      else badges.push('<span class="p-badge waiting">Изчаква</span>');
      if (!m.connected && !m.is_bot) badges.push('<span class="p-badge offline">Извън линия</span>');
      row.innerHTML = `
        <div class="p-token" style="color:${IE.tokenColor(m.token)}" title="${genderLabel}, ${IE.tokenName(m.token).toLowerCase()}">${IE.tokenSvg(m.token, m.gender, m)}</div>
        <div class="p-name">${m.name}${m.player_id === state.myId ? " (вие)" : ""}</div>
        ${badges.join("")}`;
      if (state.isHost && m.is_bot) {
        const remove = document.createElement("button");
        remove.className = "icon-btn lobby-remove-bot";
        remove.title = "Премахни бота";
        remove.setAttribute("aria-label", "Премахни бота");
        remove.textContent = "×";
        remove.onclick = () => socket.emit("remove_bot", { player_id: m.player_id });
        row.appendChild(remove);
      }
      list.appendChild(row);
    }

    // Фигурки
    const me = lobby.members.find((m) => m.player_id === state.myId);
    const selectedGender = me && me.gender === "female" ? "female" : "male";
    IE.el("gender-picker").querySelectorAll("button[data-gender]").forEach((button) => {
      const active = button.dataset.gender === selectedGender;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = !me || me.is_spectator;
      button.onclick = active || !me || me.is_spectator
        ? null
        : () => socket.emit("set_gender", { gender: button.dataset.gender });
    });
    // Външността се избира отделно от цвета: тя е лична украса и няма
    // изискване за уникалност, затова тези редове нямат заети варианти.
    const myLook = IE.appearanceOf(me);
    const locked = !me || me.is_spectator;
    renderLookRow("skin-picker", IE.SKINS, "skin", myLook.skin, locked, (def) => def.color);
    renderLookRow("hair-picker", IE.HAIR_COLORS, "hair", myLook.hair, locked, (def) => def.color);
    renderHairstyleRow(myLook, selectedGender, locked);

    const picker = IE.el("token-picker");
    picker.innerHTML = "";
    const taken = new Set(
      lobby.members.filter((m) => !m.is_spectator && m.player_id !== state.myId).map((m) => m.token)
    );
    for (const [id, tok] of Object.entries(IE.TOKENS)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "token-choice";
      btn.title = `${tok.name} · ${selectedGender === "female" ? "жена" : "мъж"}`;
      btn.setAttribute("aria-label", btn.title);
      btn.innerHTML = `${IE.tokenSvg(id, selectedGender, myLook)}<span class="token-choice-name">${tok.name}</span><span class="token-swatch" style="background:${tok.color}"></span>`;
      btn.style.color = tok.color;
      if (me && me.token === id) {
        btn.classList.add("selected");
        btn.setAttribute("aria-pressed", "true");
      } else {
        btn.setAttribute("aria-pressed", "false");
      }
      if (taken.has(id)) {
        btn.classList.add("taken");
        btn.disabled = true;
      }
      else btn.addEventListener("click", () => socket.emit("set_token", { token: id }));
      picker.appendChild(btn);
    }

    // Готовност
    const readyBtn = IE.el("btn-ready");
    if (me && !me.is_host && !me.is_spectator) {
      readyBtn.classList.remove("hidden");
      readyBtn.textContent = me.ready ? "Отмени готовност" : "Готов съм";
      readyBtn.className = "btn " + (me.ready ? "btn-secondary" : "btn-primary");
    } else {
      readyBtn.classList.add("hidden");
    }

    // Настройки (само домакин)
    const settingsPanel = IE.el("settings-panel");
    settingsPanel.classList.toggle("hidden", !state.isHost);
    if (state.isHost) fillSettings(lobby.settings);

    // Стартиране
    const startBtn = IE.el("btn-start");
    const players = lobby.members.filter((m) => !m.is_spectator);
    const allReady = players.length >= 2 && players.every((m) => m.ready);
    startBtn.classList.toggle("hidden", !state.isHost);
    startBtn.disabled = !allReady;
    IE.el("start-hint").textContent = state.isHost
      ? (allReady ? "Всички са готови — успех!" : "Нужни са 2–10 готови играчи.")
      : "Изчакайте домакина да стартира играта.";
  }

  let settingsFilled = false;

  /* Настройки, които зависят от друга настройка, се заключват визуално,
     за да е ясно кога изобщо имат ефект. */
  function syncEuSubsidyControl() {
    IE.el("set-eu-subsidy-amount").disabled = !IE.el("set-eu-subsidies").checked;
  }
  function syncDependentControls() {
    syncEuSubsidyControl();
    const auctions = IE.el("set-auctions").checked;
    for (const id of ["set-auction-start-market", "set-auction-min-step", "set-auction-seconds"]) {
      IE.el(id).disabled = !auctions;
    }
    IE.el("set-free-trading").disabled = !IE.el("set-trading").checked;
    IE.el("set-rounds").disabled = IE.el("set-victory").value !== "round_limit";
    const loans = IE.el("set-loans").checked;
    IE.el("set-loan-max").disabled = !loans;
    IE.el("set-loan-interest").disabled = !loans;
    IE.el("set-sell-percent").disabled = !IE.el("set-sell-bank").checked;
  }

  function fillSettings(s) {
    if (settingsFilled && document.activeElement && document.activeElement.closest("#settings-panel")) return;
    IE.el("set-preset").value = s.rules_preset || "classic";
    IE.el("set-max-players").value = s.max_players;
    IE.el("set-cash").value = s.starting_cash;
    IE.el("set-income").value = s.start_income;
    IE.el("set-eu-subsidies").checked = !!s.eu_subsidies_enabled;
    IE.el("set-eu-subsidy-amount").value = s.eu_subsidy_amount ?? 100;
    IE.el("set-trading").checked = s.trading_enabled;
    IE.el("set-free-trading").checked = !!s.free_trading;
    IE.el("set-auctions").checked = s.auctions_enabled;
    IE.el("set-auction-start-market").checked = !!s.auction_start_market;
    IE.el("set-auction-min-step").value = s.auction_min_step ?? 10;
    IE.el("set-auction-seconds").value = s.auction_seconds || 30;
    IE.el("set-loans").checked = s.loans_enabled !== false;
    IE.el("set-loan-max").value = s.loan_max_percent ?? 50;
    IE.el("set-loan-interest").value = s.loan_interest_percent ?? 20;
    IE.el("set-sell-bank").checked = s.sell_to_bank_enabled !== false;
    IE.el("set-sell-percent").value = s.sell_to_bank_percent ?? 80;
    IE.el("set-jail-fee").value = s.jail_fee ?? 50;
    IE.el("set-jail-max-turns").value = s.jail_max_turns ?? 3;
    IE.el("set-doubles-to-jail").value = s.doubles_to_jail ?? 3;
    IE.el("set-disconnect-grace").value = s.disconnect_grace_seconds ?? 180;
    IE.el("set-turn-limit").value = s.turn_time_limit;
    IE.el("set-victory").value = s.victory_condition;
    IE.el("set-rounds").value = s.victory_rounds;
    IE.el("set-spectators").checked = s.allow_spectators;
    IE.el("set-free-parking").checked = !!s.free_parking_jackpot;
    syncDependentControls();
    settingsFilled = true;
  }

  IE.el("btn-apply-settings").addEventListener("click", () => {
    const settings = {
      rules_preset: IE.el("set-preset").value,
      max_players: +IE.el("set-max-players").value,
      starting_cash: +IE.el("set-cash").value,
      start_income: +IE.el("set-income").value,
      eu_subsidies_enabled: IE.el("set-eu-subsidies").checked,
      eu_subsidy_amount: +IE.el("set-eu-subsidy-amount").value,
      trading_enabled: IE.el("set-trading").checked,
      free_trading: IE.el("set-free-trading").checked,
      auctions_enabled: IE.el("set-auctions").checked,
      auction_start_market: IE.el("set-auction-start-market").checked,
      auction_min_step: +IE.el("set-auction-min-step").value,
      auction_seconds: +IE.el("set-auction-seconds").value,
      loans_enabled: IE.el("set-loans").checked,
      loan_max_percent: +IE.el("set-loan-max").value,
      loan_interest_percent: +IE.el("set-loan-interest").value,
      sell_to_bank_enabled: IE.el("set-sell-bank").checked,
      sell_to_bank_percent: +IE.el("set-sell-percent").value,
      jail_fee: +IE.el("set-jail-fee").value,
      jail_max_turns: +IE.el("set-jail-max-turns").value,
      doubles_to_jail: +IE.el("set-doubles-to-jail").value,
      disconnect_grace_seconds: +IE.el("set-disconnect-grace").value,
      turn_time_limit: +IE.el("set-turn-limit").value,
      victory_condition: IE.el("set-victory").value,
      victory_rounds: +IE.el("set-rounds").value,
      allow_spectators: IE.el("set-spectators").checked,
      free_parking_jackpot: IE.el("set-free-parking").checked,
    };
    // Паролата важи само за текущата стая и не се пази в браузъра.
    IE.storage.gameSettings = settings;
    socket.emit("update_settings", {
      settings: {
        ...settings,
        room_password: IE.el("set-password").value,
      },
    });
    IE.toast("Настройките са запазени и за следващите игри.", "success");
  });

  IE.el("btn-ready").addEventListener("click", () => {
    const me = state.lobby.members.find((m) => m.player_id === state.myId);
    socket.emit("set_ready", { ready: !(me && me.ready) });
  });

  IE.el("btn-start").addEventListener("click", () => socket.emit("start_game", {}));

  IE.el("btn-copy-link").addEventListener("click", async () => {
    // Копираме единствено кода на стаята — нищо друго.
    const code = String((state.lobby && state.lobby.room_code) || "").trim();
    if (!code) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
    } catch {
      // Резервен вариант за браузъри без clipboard API.
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand("copy");
        ta.remove();
      } catch { copied = false; }
    }
    IE.toast(copied ? `Кодът ${code} е копиран!` : `Код на стаята: ${code}`,
      copied ? "success" : "info", copied ? 3200 : 6000);
  });

  for (const id of ["btn-leave", "btn-leave-game"]) {
    IE.el(id).addEventListener("click", () => {
      G.confirmAction({
        title: "Напускане на стаята",
        body: ["Наистина ли искате да напуснете партията?"],
        confirmLabel: "Напусни",
        onConfirm: () => socket.emit("leave_room", {}),
      });
    });
  }

  IE.el("set-preset").addEventListener("change", () => {
    socket.emit("update_settings", { settings: { rules_preset: IE.el("set-preset").value } });
    settingsFilled = false;
  });
  IE.el("settings-panel").querySelectorAll("input, select").forEach((control) => {
    if (control.id === "set-preset" || control.id === "bot-style") return;
    control.addEventListener("input", () => { IE.el("set-preset").value = "custom"; });
  });
  for (const id of ["set-eu-subsidies", "set-auctions", "set-trading", "set-victory",
                  "set-loans", "set-sell-bank"]) {
    IE.el(id).addEventListener("change", syncDependentControls);
  }
  IE.el("btn-add-bot").addEventListener("click", () => {
    socket.emit("add_bot", { style: IE.el("bot-style").value });
  });
})();
