/* ============================================================
   Имоти и Империи — trade: сделки между играчите.
   Модал за оферта, измерител на стойността, входящи оферти и
   контра-предложения.
   ============================================================ */
"use strict";

(function () {
  const G = window.IEGame;
  if (!G) return;
  const { BOARD, socket, state } = G;

  let tradeCounterOf = null;
  let tradeOfferSelection = new Set();
  let tradeRequestSelection = new Set();

  G.tradeUnavailableReason = function tradeUnavailableReason(prop) {
    const g = state.game;
    if (!g || !prop || !prop.owner) return "Имотът няма собственик.";
    if (g.paused) return "Играта е на пауза.";
    const owner = g.players[prop.owner];
    const me = g.players[state.myId];
    if (!g.settings.trading_enabled) return "Сделките са изключени в тази стая.";
    if (!me || me.bankrupt) return "Не можете да правите оферти.";
    if (!owner || owner.bankrupt) return "Собственикът не е активен играч.";
    if (g.phase !== "MANAGEMENT" && g.phase !== "WAITING_FOR_ROLL") {
      return "Изчакайте текущото игрово действие да приключи.";
    }
    if (g.auction) return "Изчакайте края на търга.";
    const sp = BOARD.spaces[prop.position];
    if (sp.type === "property" && G.groupHasBuildings(g, sp.group)) {
      return "В тази цветова група има постройки — първо трябва да бъдат продадени.";
    }
    return "";
  };

  function tradeableProperties(ownerId = null) {
    const g = state.game;
    return Object.values(g.properties)
      .filter((prop) => {
        if (!prop.owner || prop.owner === state.myId) return false;
        if (ownerId && prop.owner !== ownerId) return false;
        const owner = g.players[prop.owner];
        if (!owner || owner.bankrupt) return false;
        const sp = BOARD.spaces[prop.position];
        return !(sp.type === "property" && G.groupHasBuildings(g, sp.group));
      })
      .sort((a, b) => {
        const ownerA = g.turn_order.indexOf(a.owner);
        const ownerB = g.turn_order.indexOf(b.owner);
        return ownerA - ownerB || a.position - b.position;
      });
  }

  function propertyMatchesTradeSearch(prop, query) {
    if (!query) return true;
    const sp = BOARD.spaces[prop.position];
    const owner = state.game.players[prop.owner];
    const groupName = sp.group && BOARD.groups[sp.group]
      ? BOARD.groups[sp.group].name
      : sp.type === "transport" ? "транспорт" : "комунален имот";
    return `${sp.name} ${groupName} ${owner ? owner.name : ""}`
      .toLocaleLowerCase("bg-BG")
      .includes(query);
  }

  G.openTradeModal = function openTradeModal(counterOf = null, presetTarget = null, presetProperty = null) {
    tradeCounterOf = typeof counterOf === "string" ? counterOf : null;
    const g = state.game;
    const select = IE.el("trade-target");
    select.innerHTML = "";
    const allPlayers = document.createElement("option");
    allPlayers.value = "";
    allPlayers.textContent = "Всички играчи — изберете имот";
    select.appendChild(allPlayers);
    const eligibleIds = [];
    for (const pid of g.turn_order) {
      const p = g.players[pid];
      if (!p || p.bankrupt || pid === state.myId) continue;
      eligibleIds.push(pid);
      const opt = document.createElement("option");
      opt.value = pid;
      opt.textContent = p.name;
      if (presetTarget === pid) opt.selected = true;
      select.appendChild(opt);
    }
    if (select.children.length === 1) {
      IE.toast("Няма играчи за сделка.", "error");
      return;
    }
    if (!presetTarget) select.value = "";
    // При само един възможен опонент (напр. в края, когато са останали
    // двама играчи) го избираме автоматично — няма смисъл от избор.
    const soloOpponent = eligibleIds.length === 1;
    if (soloOpponent && !presetTarget) select.value = eligibleIds[0];
    // Скриваме опцията „Всички играчи", когато има само един опонент.
    allPlayers.hidden = soloOpponent;
    select.disabled = soloOpponent;
    tradeOfferSelection = new Set();
    tradeRequestSelection = new Set();
    const requested = presetProperty === null ? NaN : Number(presetProperty);
    const requestedProp = Number.isInteger(requested)
      ? g.properties[String(requested)] : null;
    if (requestedProp && requestedProp.owner !== state.myId
        && !G.tradeUnavailableReason(requestedProp)) {
      tradeRequestSelection.add(requested);
      select.value = requestedProp.owner;
    }
    IE.el("trade-offer-cash").value = 0;
    IE.el("trade-request-cash").value = 0;
    IE.el("trade-offer-cards").value = 0;
    IE.el("trade-request-cards").value = 0;
    IE.el("trade-property-search").value = "";
    // Контраофертата тръгва от условията на получената — обикновено се
    // коригира само една подробност. Ролите се обръщат: това, което
    // насрещната страна е поискала от вас, сега вие давате.
    const prefilled = prefillFromCounteredTrade();
    const note = document.querySelector("#trade-modal .trade-rule-note");
    if (note) {
      note.textContent = (prefilled
        ? "Полетата са попълнени с условията на получената оферта — променете каквото желаете. "
        : "") + (g.settings.free_trading
        ? "Свободна търговия: пари и имоти се разменят без под на цената, без данък върху надценката и без ипотечни такси. Имоти с подобрения не могат да се разменят — първо продайте подобренията."
        : "Имоти с подобрения не могат да се разменят — първо продайте подобренията. Имот не може да се прехвърля срещу активи под изчислената му стойност.");
    }
    fillTradeProps();
    IE.el("trade-modal").classList.remove("hidden");
    updateTradeValueMeter();
  };

  /* Пренася условията на офертата, на която отговаряме, в празния модал.
     Част от нея може вече да е невалидна (имот е сменил собственик, в
     групата е построено) — тези позиции отпадат и играчът се уведомява,
     защото иначе биха останали в селекцията, без да се виждат в списъка. */
  function prefillFromCounteredTrade() {
    const g = state.game;
    const source = tradeCounterOf ? (g.trades || {})[tradeCounterOf] : null;
    if (!source) return false;
    const preset = G.tradePerspective(source);

    const canGive = (position) => {
      const prop = g.properties[String(position)];
      if (!prop || prop.owner !== state.myId) return false;
      const sp = BOARD.spaces[prop.position];
      return !(sp.type === "property" && G.groupHasBuildings(g, sp.group));
    };
    const takeable = new Set(
      tradeableProperties(preset.otherId).map((prop) => prop.position)
    );

    const give = (preset.outgoing || []).filter(canGive);
    const take = (preset.incoming || []).filter((position) => takeable.has(position));
    const dropped = (preset.outgoing || []).length - give.length
      + (preset.incoming || []).length - take.length;

    tradeOfferSelection = new Set(give);
    tradeRequestSelection = new Set(take);
    IE.el("trade-offer-cash").value = preset.giveCash || 0;
    IE.el("trade-request-cash").value = preset.receiveCash || 0;
    IE.el("trade-offer-cards").value = preset.giveCards || 0;
    IE.el("trade-request-cards").value = preset.receiveCards || 0;
    if (dropped) {
      IE.toast(
        dropped === 1
          ? "Един имот от офертата вече не е търгуем и е премахнат."
          : `${dropped} имота от офертата вече не са търгуеми и са премахнати.`,
        "info", 5000,
      );
    }
    return true;
  }

  function fillTradeProps() {
    const g = state.game;
    const target = IE.el("trade-target").value;
    const query = IE.el("trade-property-search").value.trim().toLocaleLowerCase("bg-BG");
    const completionTargets = G.groupCompletionTargets(state.myId);
    const buildList = (containerId, props, selection, showOwner) => {
      const box = IE.el(containerId);
      box.innerHTML = "";
      const visibleProps = props.filter(
        (prop) => selection.has(prop.position) || propertyMatchesTradeSearch(prop, query)
      );
      if (!visibleProps.length) {
        box.innerHTML = '<span class="trade-props-empty">Няма подходящи имоти.</span>';
        return;
      }
      for (const prop of visibleProps) {
        const sp = BOARD.spaces[prop.position];
        const color = G.territoryColor(sp);
        const completion = prop.owner !== state.myId
          ? completionTargets.get(prop.position) : null;
        const owner = g.players[prop.owner];
        const label = document.createElement("label");
        label.className = `trade-property${completion ? " completes-group" : ""}`;
        label.style.setProperty("--territory-color", color);
        const groupName = sp.group && BOARD.groups[sp.group]
          ? BOARD.groups[sp.group].name
          : sp.type === "transport" ? "Транспорт" : "Комунален имот";
        label.innerHTML = `<input type="checkbox" value="${prop.position}"${selection.has(prop.position) ? " checked" : ""}>
          <span class="trade-property-swatch" aria-hidden="true"></span>
          <span class="trade-property-copy">
            <b class="trade-property-name">${sp.name}${prop.mortgaged ? " (ипот.)" : ""}</b>
            <small>${groupName}${showOwner && owner ? ` · ${owner.name}` : ""}</small>
          </span>
          <span class="trade-property-value" title="Изчислена стойност за сделката">${IE.fmt(G.estimatedPropertyValue(prop.position))}</span>
          ${completion ? `<em>${completion.readyToBuild ? "★ ЗАВЪРШВА ЦВЕТА · СТРОЕЖ" : "★ ЗАВЪРШВА ЦВЕТА"}</em>` : ""}`;
        const checkbox = label.querySelector("input");
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) selection.add(prop.position);
          else selection.delete(prop.position);

          if (containerId === "trade-request-props" && checkbox.checked
              && IE.el("trade-target").value !== prop.owner) {
            IE.el("trade-target").value = prop.owner;
            tradeRequestSelection = new Set(
              [...tradeRequestSelection].filter(
                (position) => g.properties[String(position)].owner === prop.owner
              )
            );
            fillTradeProps();
          }
          updateTradeValueMeter();
        });
        box.appendChild(label);
      }
    };

    const mine = Object.values(g.properties)
      .filter((prop) => {
        if (prop.owner !== state.myId) return false;
        const sp = BOARD.spaces[prop.position];
        return !(sp.type === "property" && G.groupHasBuildings(g, sp.group));
      })
      .sort((a, b) => a.position - b.position);
    const market = tradeableProperties(target || null);
    buildList("trade-offer-props", mine, tradeOfferSelection, false);
    buildList("trade-request-props", market, tradeRequestSelection, !target);

    const targetPlayer = target ? g.players[target] : null;
    IE.el("trade-request-scope").textContent = targetPlayer
      ? `· от ${targetPlayer.name}` : "· от всички играчи";
    const visibleMarketCount = market.filter(
      (prop) => tradeRequestSelection.has(prop.position) || propertyMatchesTradeSearch(prop, query)
    ).length;
    IE.el("trade-market-summary").innerHTML = targetPlayer
      ? `Показани са <b>${visibleMarketCount}</b> търгуеми имота на <b>${targetPlayer.name}</b>.`
      : `Показани са <b>${visibleMarketCount}</b> търгуеми имота от всички играчи. Изберете имот и офертата автоматично ще се насочи към собственика му.`;
    updateTradeValueMeter();
  }

  IE.el("trade-target").addEventListener("change", () => {
    const target = IE.el("trade-target").value;
    if (target) {
      tradeRequestSelection = new Set(
        [...tradeRequestSelection].filter(
          (position) => state.game.properties[String(position)].owner === target
        )
      );
    }
    fillTradeProps();
  });

  IE.el("trade-property-search").addEventListener("input", fillTradeProps);

  function updateTradeValueMeter() {
    const meter = IE.el("trade-value-meter");
    if (!meter || !state.game) return;
    const selected = (id) => id === "trade-offer-props"
      ? [...tradeOfferSelection] : [...tradeRequestSelection];
    const offered = (+IE.el("trade-offer-cash").value || 0)
      + (+IE.el("trade-offer-cards").value || 0) * 100
      + selected("trade-offer-props").reduce((sum, pos) => sum + G.estimatedPropertyValue(pos), 0);
    const requested = (+IE.el("trade-request-cash").value || 0)
      + (+IE.el("trade-request-cards").value || 0) * 100
      + selected("trade-request-props").reduce((sum, pos) => sum + G.estimatedPropertyValue(pos), 0);
    const offerProps = selected("trade-offer-props");
    const requestProps = selected("trade-request-props");
    const delta = offered - requested;
    const target = IE.el("trade-target").value;
    const freeTrading = !!state.game.settings.free_trading;
    const warnings = [];
    const targetGroups = completedGroupsAfterTrade(target, offerProps, requestProps);
    const myGroups = completedGroupsAfterTrade(state.myId, requestProps, offerProps);
    if (targetGroups.length) warnings.push(`Противникът завършва: ${targetGroups.join(", ")}`);
    if (myGroups.length) warnings.push(`Вие завършвате: ${myGroups.join(", ")}`);

    const sendButton = IE.el("btn-send-trade");
    let blocked = false;
    let verdict;
    if (freeTrading) {
      // Свободна търговия: без под, таван, данък — вердиктът е информативен.
      sendButton.disabled = false;
      sendButton.title = "";
      verdict = delta === 0
        ? "Равностойна размяна"
        : delta > 0 ? "Давате повече приблизителна стойност" : "Искате повече приблизителна стойност";
    } else {
      // Подът мери срещу стойността на самите имоти, а не срещу целия пакет —
      // така собствената ви добавка в пари не се брои срещу вас.
      const offerPropsValue = offerProps.reduce((sum, pos) => sum + G.estimatedPropertyValue(pos), 0);
      const requestPropsValue = requestProps.reduce((sum, pos) => sum + G.estimatedPropertyValue(pos), 0);
      const myPropertiesBelowValue = offerProps.length > 0 && requested < offerPropsValue;
      const targetPropertiesBelowValue = requestProps.length > 0 && offered < requestPropsValue;
      if (myPropertiesBelowValue) {
        warnings.push(`За вашите имоти трябва да получите още поне ${IE.fmt(offerPropsValue - requested)}.`);
      }
      if (targetPropertiesBelowValue) {
        warnings.push(`За исканите имоти трябва да предложите още поне ${IE.fmt(requestPropsValue - offered)}.`);
      }

      // Надценка: допустима над стойността, но с таван и данък към банката.
      const premium = Math.abs(delta);
      const substance = offerPropsValue + requestPropsValue
        + ((+IE.el("trade-offer-cards").value || 0) + (+IE.el("trade-request-cards").value || 0)) * 100;
      const allowance = Math.max(
        G.TRADE_PREMIUM_MIN,
        Math.floor(substance * G.TRADE_PREMIUM_LIMIT_PCT / 100),
      );
      const premiumTooHigh = premium > allowance;
      if (premiumTooHigh) {
        warnings.push(`Надценката ${IE.fmt(premium)} надхвърля допустимата ${IE.fmt(allowance)} — прилича на прикрит подарък.`);
      } else if (premium > 0) {
        const tax = Math.floor(premium * G.TRADE_PREMIUM_TAX_PCT / 100);
        if (tax) {
          const payer = delta > 0 ? "Вие плащате" : "Противникът плаща";
          warnings.push(`${payer} ${IE.fmt(tax)} данък върху надценката от ${IE.fmt(premium)}.`);
        }
      }

      const belowPropertyValue = myPropertiesBelowValue || targetPropertiesBelowValue;
      sendButton.disabled = belowPropertyValue || premiumTooHigh;
      sendButton.title = belowPropertyValue
        ? "Имот не може да се прехвърля под изчислената му стойност."
        : premiumTooHigh
          ? "Надценката надхвърля допустимата за тази сделка."
          : "";
      // Вердиктът отразява и блокиращите правила — иначе „Балансирана
      // оферта" стои редом с „предложете още X €" и си противоречат.
      blocked = belowPropertyValue || premiumTooHigh;
      verdict = belowPropertyValue
        ? "Недостатъчна оферта"
        : premiumTooHigh
          ? "Прекомерна надценка"
          : Math.abs(delta) <= Math.max(50, Math.max(offered, requested) * 0.12)
            ? "Балансирана оферта"
            : delta > 0 ? "Давате повече приблизителна стойност" : "Искате повече приблизителна стойност";
    }
    meter.innerHTML = `<span>Давате: <b>${IE.fmt(offered)}</b></span><span>Искате: <b>${IE.fmt(requested)}</b></span><strong${blocked ? ' class="verdict-blocked"' : ""}>${verdict}</strong>${warnings.map((text) => `<em>${text}</em>`).join("")}`;
  }

  function completedGroupsAfterTrade(receiver, incoming, outgoing) {
    const groups = new Set(incoming.map((pos) => BOARD.spaces[pos].group).filter((group) => BOARD.groups[group]));
    return [...groups].filter((group) => G.propertyGroupPositions(group).every((pos) => {
      if (incoming.includes(pos)) return true;
      if (outgoing.includes(pos)) return false;
      const prop = state.game.properties[String(pos)];
      return prop && prop.owner === receiver;
    })).map((group) => BOARD.groups[group].name);
  }

  IE.el("trade-modal").addEventListener("input", updateTradeValueMeter);
  IE.el("trade-modal").addEventListener("change", updateTradeValueMeter);

  IE.el("btn-send-trade").addEventListener("click", () => {
    const target = IE.el("trade-target").value;
    if (!target) {
      IE.toast("Изберете играч или имот, за да определите получателя на офертата.", "error");
      IE.el("trade-target").focus();
      return;
    }
    const payload = {
      to_player: target,
      offer_cash: +IE.el("trade-offer-cash").value || 0,
      offer_properties: [...tradeOfferSelection],
      offer_jail_cards: +IE.el("trade-offer-cards").value || 0,
      request_cash: +IE.el("trade-request-cash").value || 0,
      request_properties: [...tradeRequestSelection],
      request_jail_cards: +IE.el("trade-request-cards").value || 0,
      counter_of: tradeCounterOf,
    };
    G.openTradeActionPreview(
      { ...payload, from_player: state.myId },
      () => {
        socket.emit("create_trade", payload);
        IE.el("trade-modal").classList.add("hidden");
        const targetPlayer = state.game.players[target];
        IE.toast(`Офертата е изпратена на ${targetPlayer ? targetPlayer.name : "играча"}.`, "success");
      },
    );
  });
  IE.el("trade-modal").addEventListener("click", (e) => {
    if (e.target === IE.el("trade-modal") || e.target.dataset.close !== undefined) {
      IE.el("trade-modal").classList.add("hidden");
    }
  });

  function renderCounterOfferDiff(trade) {
    if (!trade.counter_original) return "";
    const before = G.tradePerspective(trade.counter_original);
    const after = G.tradePerspective(trade);
    const propertyChanges = (oldPositions, newPositions) => {
      const oldSet = new Set(oldPositions || []);
      const newSet = new Set(newPositions || []);
      const added = [...newSet].filter((position) => !oldSet.has(position));
      const removed = [...oldSet].filter((position) => !newSet.has(position));
      const lines = [];
      if (added.length) lines.push(`<span class="added">+ Добавено: ${added.map((position) => `„${BOARD.spaces[position].name}“`).join(", ")}</span>`);
      if (removed.length) lines.push(`<span class="removed">− Премахнато: ${removed.map((position) => `„${BOARD.spaces[position].name}“`).join(", ")}</span>`);
      return lines;
    };
    const sideChanges = (label, oldCash, newCash, oldProps, newProps, oldCards, newCards) => {
      const changes = propertyChanges(oldProps, newProps);
      if (newCash !== oldCash) {
        const delta = newCash - oldCash;
        changes.unshift(`<span class="${delta > 0 ? "added" : "removed"}">${delta > 0 ? "+" : "−"} Пари: ${IE.fmt(Math.abs(delta))} (${IE.fmt(oldCash)} → ${IE.fmt(newCash)})</span>`);
      }
      if (newCards !== oldCards) {
        const delta = newCards - oldCards;
        changes.push(`<span class="${delta > 0 ? "added" : "removed"}">${delta > 0 ? "+" : "−"} Карти: ${Math.abs(delta)} (${oldCards} → ${newCards})</span>`);
      }
      return `<div><b>${label}</b>${changes.length ? changes.join("") : "<span>Без промяна</span>"}</div>`;
    };
    return `<section class="trade-counter-diff">
      <strong>Промени спрямо предишната оферта</strong>
      ${sideChanges("Вие давате", before.giveCash, after.giveCash, before.outgoing, after.outgoing, before.giveCards, after.giveCards)}
      ${sideChanges("Вие получавате", before.receiveCash, after.receiveCash, before.incoming, after.incoming, before.receiveCards, after.receiveCards)}
    </section>`;
  }

  G.renderTrades = function renderTrades() {
    const g = state.game;
    const box = IE.el("incoming-trades");
    box.innerHTML = "";
    const pending = Object.values(g.trades || {});
    for (const trade of pending) {
      const isForMe = trade.to_player === state.myId;
      const isMine = trade.from_player === state.myId;
      if (!isForMe && !isMine) continue;
      const other = g.players[isForMe ? trade.from_player : trade.to_player];
      if (!other) continue;

      // Нова входяща оферта: звук, известие и премигване на полето.
      const isNew = isForMe && trade.status === "pending"
        && !state.shownTrades.has(trade.trade_id);
      if (isNew) {
        state.shownTrades.add(trade.trade_id);
        IE.sound.trade();
        IE.toast(
          trade.counter_of
            ? `Контраоферта от ${other.name} — вижте условията.`
            : `Нова оферта за сделка от ${other.name}!`,
          "info", 4200,
        );
      }

      const describe = (cash, props, cards) => {
        const parts = [];
        if (cash) parts.push(IE.fmt(cash));
        for (const pos of props) {
          const sp = BOARD.spaces[pos];
          parts.push(`<span class="trade-inline-property" style="--territory-color:${G.territoryColor(sp)}"><i></i>„${sp.name}"</span>`);
        }
        if (cards) parts.push(`${cards} карта/и освобождаване`);
        return parts.length ? parts.join(", ") : "нищо";
      };

      const el = document.createElement("div");
      el.className = "panel-cream incoming-trade" + (isNew ? " trade-attention" : "");
      el.style.cssText = "padding:0.8rem;font-size:0.88rem";
      el.innerHTML = `
        <b>${isForMe ? `Оферта от ${other.name}` : `Вашата оферта към ${other.name}`}</b><br>
        Дава: ${describe(trade.offer_cash, trade.offer_properties, trade.offer_jail_cards)}<br>
        Иска: ${describe(trade.request_cash, trade.request_properties, trade.request_jail_cards)}
        ${renderCounterOfferDiff(trade)}`;
      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:6px;margin-top:8px;flex-wrap:wrap";
      // „Виж" стои и тук, и на известието в центъра — води до едно и също.
      const details = document.createElement("button");
      details.className = "btn btn-secondary";
      details.style.cssText = "font-size:0.8rem;padding:0.4em 1em";
      details.textContent = "🔍 Виж";
      details.title = "Подробности: цени, наеми и кой завършва група";
      details.onclick = () => G.openTradeDetails(trade);
      actions.appendChild(details);
      if (isForMe) {
        const accept = document.createElement("button");
        accept.className = "btn btn-primary";
        accept.style.cssText = "font-size:0.8rem;padding:0.4em 1em";
        accept.textContent = "Приеми";
        accept.onclick = () => G.openTradeActionPreview(
          trade,
          () => socket.emit("respond_trade", { trade_id: trade.trade_id, accept: true }),
          "Приемане на сделка",
        );
        const decline = document.createElement("button");
        decline.className = "btn btn-danger";
        decline.style.cssText = "font-size:0.8rem;padding:0.4em 1em";
        decline.textContent = "Откажи";
        decline.onclick = () => socket.emit("respond_trade", { trade_id: trade.trade_id, accept: false });
        const counter = document.createElement("button");
        counter.className = "btn btn-ghost";
        counter.style.cssText = "font-size:0.8rem;padding:0.4em 1em;color:#444;border-color:#999";
        counter.textContent = "Контра";
        counter.onclick = () => G.openTradeModal(trade.trade_id, trade.from_player);
        actions.append(accept, decline, counter);
      } else {
        const cancel = document.createElement("button");
        cancel.className = "btn btn-ghost";
        cancel.style.cssText = "font-size:0.8rem;padding:0.4em 1em;color:#444;border-color:#999";
        cancel.textContent = "Оттегли";
        cancel.onclick = () => socket.emit("cancel_trade", { trade_id: trade.trade_id });
        actions.append(cancel);
      }
      el.appendChild(actions);
      if (g.paused) {
        actions.querySelectorAll("button").forEach((button) => {
          button.disabled = true;
          button.title = "Играта е на пауза.";
        });
      }
      box.appendChild(el);
    }
    renderTradeAlert();
  };

  /* ----------------------------------------------------------
     Известие в центъра на таблото — само за оферти към мен
     ---------------------------------------------------------- */
  const alertBox = IE.el("trade-alert");

  function myPendingTrades() {
    const g = state.game;
    return Object.values(g.trades || {}).filter(
      (t) => t.status === "pending" && t.to_player === state.myId,
    );
  }

  function renderTradeAlert() {
    const g = state.game;
    const mine = state.isSpectator ? [] : myPendingTrades();
    if (!mine.length) {
      alertBox.classList.add("hidden");
      return;
    }
    const latest = mine[mine.length - 1];
    const from = g.players[latest.from_player];
    IE.el("trade-alert-title").textContent = mine.length > 1
      ? `${mine.length} оферти за вас`
      : (latest.counter_of ? "Контраоферта за вас" : "Оферта за вас");
    IE.el("trade-alert-detail").textContent = mine.length > 1
      ? "Последната е от " + (from ? from.name : "играч")
      : "от " + (from ? from.name : "играч");
    alertBox.classList.remove("hidden");
  }

  // „Виж" отваря подробностите за най-новата оферта към мен.
  alertBox.addEventListener("click", () => {
    const mine = myPendingTrades();
    if (mine.length) G.openTradeDetails(mine[mine.length - 1]);
  });

  /* ----------------------------------------------------------
     Подробности за сделката — всичко нужно за решението

     Показва за всеки имот цената, текущия наем и — най-важното —
     на кого затваря цветова група. Точно това превръща „изглежда
     справедливо" в информирано решение.
     ---------------------------------------------------------- */
  const detailsModal = IE.el("trade-details-modal");

  /* Дали този имот затваря група за играча, ако я получи. */
  function completesGroupFor(position, playerId) {
    const g = state.game;
    const sp = BOARD.spaces[position];
    if (!sp || sp.type !== "property" || !sp.group) return false;
    const rest = G.propertyGroupPositions(sp.group).filter((p) => p !== position);
    if (!rest.length) return false;
    return rest.every((p) => {
      const item = g.properties[String(p)];
      return item && item.owner === playerId;
    });
  }

  /* Колко имота от групата притежава играчът (за контекст). */
  function groupHolding(position, playerId) {
    const sp = BOARD.spaces[position];
    if (!sp || sp.type !== "property" || !sp.group) return null;
    const positions = G.propertyGroupPositions(sp.group);
    const owned = positions.filter((p) => {
      const item = state.game.properties[String(p)];
      return item && item.owner === playerId;
    }).length;
    return { owned, total: positions.length };
  }

  function propertyCard(position, receiverId, giverId, receiverName, giverName) {
    const g = state.game;
    const sp = BOARD.spaces[position];
    const prop = g.properties[String(position)] || { level: 0, mortgaged: false };
    const rent = G.rentBreakdownFor(sp, prop, prop.owner, g.properties);
    const holding = groupHolding(position, receiverId);
    const receiverIsMe = receiverId === state.myId;
    const giverIsMe = giverId === state.myId;
    const flags = [];

    if (completesGroupFor(position, receiverId)) {
      flags.push(`<span class="td-flag td-flag-win">${
        receiverIsMe ? "Затваря вашата група" : `Затваря групата на ${receiverName}`
      }</span>`);
    }
    if (completesGroupFor(position, giverId)) {
      flags.push(`<span class="td-flag td-flag-warn">${
        giverIsMe ? "Затваряше вашата група" : `Щеше да затвори групата на ${giverName}`
      }</span>`);
    }
    if (prop.mortgaged) {
      // Ипотечната такса се плаща от този, който ПОЛУЧАВА имота.
      const fee = Math.floor((sp.mortgage || 0) / 10);
      flags.push(`<span class="td-flag td-flag-warn">Ипотекиран — ${IE.fmt(fee)} такса за ${
        receiverIsMe ? "вас" : receiverName
      }</span>`);
    }
    if (prop.level > 0) {
      flags.push(`<span class="td-flag">Застроен: ${BOARD.improvement_levels[prop.level]}</span>`);
    }

    return `<div class="td-prop" style="--territory-color:${G.territoryColor(sp)}">
      <div class="td-prop-head">
        <i class="td-band"></i>
        <b>${sp.name}</b>
        <span class="td-price">${IE.fmt(sp.price || 0)}</span>
      </div>
      <div class="td-prop-stats">
        <span>Наем сега: <b>${IE.fmt(rent.amount)}</b> <small>(${rent.label})</small></span>
        <span>Ипотечна стойност: <b>${IE.fmt(sp.mortgage || 0)}</b></span>
        ${sp.improve_cost ? `<span>Строеж: <b>${IE.fmt(sp.improve_cost)}</b>/ниво</span>` : ""}
        ${holding ? `<span>${
          receiverIsMe ? "Ще имате" : `${receiverName} ще има`
        } <b>${holding.owned + 1}/${holding.total}</b> от групата</span>` : ""}
      </div>
      ${flags.length ? `<div class="td-flags">${flags.join("")}</div>` : ""}
    </div>`;
  }

  function sideBlock(title, cash, positions, cards, receiverId, giverId, receiverName, giverName) {
    const bits = [];
    if (cash) bits.push(`<div class="td-line"><span>Пари</span><b>${IE.fmt(cash)}</b></div>`);
    if (cards) bits.push(`<div class="td-line"><span>Карти „Освобождаване от проверка"</span><b>${cards}</b></div>`);
    const props = positions.map((p) => propertyCard(p, receiverId, giverId, receiverName, giverName)).join("");
    if (!bits.length && !props) bits.push('<div class="td-line td-empty"><span>Нищо</span></div>');
    return `<section class="td-side">
      <h4>${title}</h4>${bits.join("")}${props}
    </section>`;
  }

  G.openTradeDetails = function openTradeDetails(trade) {
    const g = state.game;
    const me = g.players[state.myId];
    if (!trade || !me) return;
    const p = G.tradePerspective(trade);
    const other = g.players[p.otherId];
    const otherName = other ? other.name : "Играчът";
    const isForMe = trade.to_player === state.myId;

    // Състояние след сделката — за паричния и имотния ефект.
    const properties = G.clonePropertyStates();
    const mortgageFee = p.incoming.reduce((sum, pos) => {
      const prop = g.properties[String(pos)];
      return sum + (prop && prop.mortgaged ? Math.floor(BOARD.spaces[pos].mortgage / 10) : 0);
    }, 0);
    p.outgoing.forEach((pos) => { properties[String(pos)].owner = p.otherId; });
    p.incoming.forEach((pos) => { properties[String(pos)].owner = state.myId; });
    const cashAfter = me.cash - p.giveCash + p.receiveCash - mortgageFee;
    const worthBefore = G.netWorthFor(state.myId);
    const worthAfter = G.netWorthFor(state.myId, properties, cashAfter);

    const giveValue = p.giveCash + p.giveCards * 100
      + p.outgoing.reduce((s, pos) => s + G.estimatedPropertyValue(pos), 0);
    const receiveValue = p.receiveCash + p.receiveCards * 100
      + p.incoming.reduce((s, pos) => s + G.estimatedPropertyValue(pos), 0);
    const diff = receiveValue - giveValue;

    // Монополи: кои групи затварям аз и кои — противникът.
    const myNewGroups = p.incoming.filter((pos) => completesGroupFor(pos, state.myId));
    const theirNewGroups = p.outgoing.filter((pos) => completesGroupFor(pos, p.otherId));

    const verdict = diff > 0
      ? `<span class="td-verdict td-good">Получавате ${IE.fmt(diff)} повече стойност</span>`
      : diff < 0
        ? `<span class="td-verdict td-bad">Давате ${IE.fmt(-diff)} повече стойност</span>`
        : '<span class="td-verdict">Равностойна размяна</span>';

    const warnings = [];
    if (theirNewGroups.length) {
      warnings.push(`⚠ ${otherName} завършва ${theirNewGroups.length === 1 ? "цветова група" : "цветови групи"}: `
        + theirNewGroups.map((pos) => `„${BOARD.spaces[pos].name}“`).join(", ")
        + " — наемите там се удвояват и може да строи.");
    }
    if (myNewGroups.length) {
      warnings.push(`★ Вие завършвате ${myNewGroups.length === 1 ? "цветова група" : "цветови групи"}: `
        + myNewGroups.map((pos) => `„${BOARD.spaces[pos].name}“`).join(", ") + ".");
    }
    if (cashAfter < 0) {
      warnings.push("⚠ Сделката ви оставя на минус — няма да можете да я приемете.");
    } else if (cashAfter < 100) {
      warnings.push(`⚠ Остават ви само ${IE.fmt(cashAfter)} — рисковано при попадане на чужд имот.`);
    }
    if (mortgageFee) {
      warnings.push(`Незабавна ипотечна такса към банката: ${IE.fmt(mortgageFee)}.`);
    }

    IE.el("trade-details-title").textContent = isForMe
      ? `Оферта от ${otherName}` : `Вашата оферта към ${otherName}`;
    IE.el("trade-details-body").innerHTML = `
      <div class="td-summary">
        ${verdict}
        <div class="td-metrics">
          <div><span>Пари в брой</span><b>${IE.fmt(me.cash)} → ${IE.fmt(cashAfter)}</b></div>
          <div><span>Нетна стойност</span><b>${IE.fmt(worthBefore)} → ${IE.fmt(worthAfter)}</b></div>
          <div><span>Стойност: давате / получавате</span><b>${IE.fmt(giveValue)} / ${IE.fmt(receiveValue)}</b></div>
        </div>
      </div>
      ${warnings.length ? `<ul class="td-warnings">${warnings.map((w) => `<li>${w}</li>`).join("")}</ul>` : ""}
      <div class="td-sides">
        ${sideBlock("Вие давате", p.giveCash, p.outgoing, p.giveCards,
                    p.otherId, state.myId, otherName, "вас")}
        ${sideBlock("Вие получавате", p.receiveCash, p.incoming, p.receiveCards,
                    state.myId, p.otherId, "Вие", otherName)}
      </div>`;

    // Действията се дублират тук, за да не се затваря прозорецът напразно.
    const actions = IE.el("trade-details-actions");
    actions.innerHTML = "";
    if (isForMe && trade.status === "pending" && !g.paused) {
      const accept = document.createElement("button");
      accept.className = "btn btn-primary";
      accept.textContent = "Приеми";
      accept.onclick = () => {
        closeTradeDetails();
        socket.emit("respond_trade", { trade_id: trade.trade_id, accept: true });
      };
      const decline = document.createElement("button");
      decline.className = "btn btn-danger";
      decline.textContent = "Откажи";
      decline.onclick = () => {
        closeTradeDetails();
        socket.emit("respond_trade", { trade_id: trade.trade_id, accept: false });
      };
      const counter = document.createElement("button");
      counter.className = "btn btn-ghost";
      counter.textContent = "Контра";
      counter.onclick = () => {
        closeTradeDetails();
        G.openTradeModal(trade.trade_id, trade.from_player);
      };
      actions.append(accept, decline, counter);
    }
    const close = document.createElement("button");
    close.className = "btn btn-ghost";
    close.textContent = "Затвори";
    close.onclick = closeTradeDetails;
    actions.appendChild(close);

    detailsModal.classList.remove("hidden");
  };

  function closeTradeDetails() {
    detailsModal.classList.add("hidden");
  }

  IE.el("trade-details-close").addEventListener("click", closeTradeDetails);
  detailsModal.addEventListener("click", (event) => {
    if (event.target === detailsModal) closeTradeDetails();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !detailsModal.classList.contains("hidden")) {
      closeTradeDetails();
    }
  });

})();
