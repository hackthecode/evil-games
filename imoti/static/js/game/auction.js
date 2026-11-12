/* ============================================================
   Имоти и Империи — auction: търгове за имоти и постройки.
   Карта на актива, финансов преглед, наддаване и сървърен
   таймер.
   ============================================================ */
"use strict";

(function () {
  const G = window.IEGame;
  if (!G) return;
  const { BOARD, socket, state } = G;

  function auctionPropertyCategory(sp) {
    if (sp.type === "property" && sp.group && BOARD.groups[sp.group]) {
      return BOARD.groups[sp.group].name;
    }
    if (sp.type === "transport") return "Транспортно предприятие";
    return "Комунално предприятие";
  }

  function auctionGroupImpact(g, sp, position, building) {
    if (sp.type !== "property" || !sp.group) return "Не е цветова група";
    const group = BOARD.groups[sp.group];
    if (building) return `${group.name} · завършена`;
    if (state.isSpectator || !state.myId) return group.name;
    const positions = G.propertyGroupPositions(sp.group);
    const owned = positions.filter((pos) => {
      const prop = g.properties[String(pos)];
      return prop && prop.owner === state.myId;
    }).length;
    const completes = positions.every((pos) => {
      if (pos === position) return true;
      const prop = g.properties[String(pos)];
      return prop && prop.owner === state.myId;
    });
    return completes ? `Да · завършва ${group.name}` : `Не · притежавате ${owned}/${positions.length}`;
  }

  function auctionRentPreview(g, sp, position, building) {
    const existing = g.properties[String(position)];
    if (building && existing && existing.owner) {
      if (existing.mortgaged) return { amount: 0, label: "Ипотекиран" };
      return G.rentBreakdownFor(sp, existing, existing.owner, g.properties, 7);
    }
    if (!state.isSpectator && state.myId) {
      const projectedProperties = { ...g.properties };
      const projected = {
        ...(existing || {}),
        position,
        owner: state.myId,
        mortgaged: false,
        level: existing ? existing.level || 0 : 0,
      };
      projectedProperties[String(position)] = projected;
      const rent = G.rentBreakdownFor(sp, projected, state.myId, projectedProperties, 7);
      return { amount: rent.amount, label: `${rent.label} · при придобиване` };
    }
    if (sp.type === "property") return { amount: G.applyGlobalRent(sp.rent[0], sp.type), label: "Основен наем" };
    if (sp.type === "transport") return { amount: G.applyGlobalRent(sp.rent[0], sp.type), label: "При 1 транспортен обект" };
    return { amount: G.applyGlobalRent(7 * sp.rent_multiplier[0], sp.type), label: "При стандартни зарове 7" };
  }

  function renderAuctionPropertyCard(g, auction, position, building) {
    const sp = BOARD.spaces[position] || BOARD.spaces[auction.position];
    const prop = g.properties[String(position)];
    const rent = auctionRentPreview(g, sp, position, building);
    const card = IE.el("auction-property-card");
    card.style.setProperty("--auction-accent", G.territoryColor(sp));
    IE.el("auction-property-category").textContent = auctionPropertyCategory(sp);
    IE.el("auction-property-name").textContent = `${sp.icon ? `${sp.icon} ` : ""}${sp.name}`;
    IE.el("auction-property-level").textContent = building && prop
      ? BOARD.improvement_levels[prop.level] : "Свободен актив";
    IE.el("auction-market-value").textContent = IE.fmt(sp.price || 0);
    IE.el("auction-mortgage-value").textContent = IE.fmt(sp.mortgage || 0);
    IE.el("auction-rent-value").textContent = IE.fmt(rent.amount);
    IE.el("auction-rent-label").textContent = rent.label;
    IE.el("auction-group-impact").textContent = auctionGroupImpact(g, sp, position, building);
  }

  function updateAuctionFinance() {
    const g = state.game;
    if (!g || !g.auction) return;
    const me = g.players[state.myId];
    const input = IE.el("auction-bid-input");
    const minimum = Number(input.min) || 0;
    const amount = parseInt(input.value, 10);
    const canBid = !state.isSpectator && me && !me.bankrupt
      && g.auction.participants.includes(state.myId);
    const validAmount = Number.isFinite(amount) && amount >= minimum && amount <= (me ? me.cash : 0);
    const building = g.auction.kind === "house" || g.auction.kind === "hotel";
    const targetValue = IE.el("auction-build-target").value;
    const validTarget = !building || (
      targetValue !== "" && Number.isInteger(+targetValue) && !!BOARD.spaces[+targetValue]
    );
    const after = me && Number.isFinite(amount) ? me.cash - amount : null;

    IE.el("auction-cash-before").textContent = me ? IE.fmt(me.cash) : "—";
    IE.el("auction-cash-after").textContent = after === null ? "—" : IE.fmt(after);
    IE.el("auction-cash-after").classList.toggle("negative", after !== null && after < 0);
    IE.el("auction-min-next").textContent = IE.fmt(minimum);
    IE.el("auction-max-bid").textContent = me ? IE.fmt(me.cash) : "—";
    input.max = me ? String(me.cash) : "0";
    input.setAttribute("aria-invalid", String(!validAmount));
    IE.el("btn-place-bid").disabled = !canBid || !validAmount || !validTarget;
  }

  // Последно показаната водеща оферта — за да подскача само при промяна.
  let lastLeadingBid = null;
  let lastLeadingBidder = null;

  G.renderAuction = function renderAuction() {
    const g = state.game;
    const modal = IE.el("auction-modal");
    if (!g.auction || g.phase !== "AWAITING_AUCTION") {
      modal.classList.add("hidden");
      // Нов търг започва „на чисто" — без подскок на първото рендиране.
      lastLeadingBid = null;
      lastLeadingBidder = null;
      return;
    }
    const a = g.auction;
    const sp = BOARD.spaces[a.position];
    modal.classList.remove("hidden");
    const building = a.kind === "house" || a.kind === "hotel";
    IE.el("auction-title").textContent = building
      ? `Търг: последен ${a.kind === "house" ? "обект" : "Гранд хотел"}`
      : `Търг: ${sp.name}`;
    IE.el("auction-kind").textContent = a.kind === "house"
      ? "Последна къща" : a.kind === "hotel" ? "Последен хотел" : "Имот";
    IE.el("auction-price").textContent = building
      ? "Оскъдният банков фонд се разпределя чрез наддаване."
      : "Свободен актив на Българската народна банка.";
    const leader = a.highest_bidder ? g.players[a.highest_bidder] : null;
    const currentBox = IE.el("auction-current");
    const mine = a.highest_bidder === state.myId;
    IE.el("auction-current-amount").textContent =
      a.highest_bid > 0 ? IE.fmt(a.highest_bid) : "—";
    IE.el("auction-current-bidder").innerHTML = a.highest_bid > 0
      ? `<i class="dot" style="background:${G.playerColorFor(a.highest_bidder)}"></i>` +
        (mine ? "Вие водите" : `от ${leader ? leader.name : "играч"}`)
      : "Все още няма оферти";
    currentBox.classList.toggle("is-mine", mine);
    // Подскок само при реална промяна на водещата оферта.
    if (lastLeadingBid !== null && (
      a.highest_bid !== lastLeadingBid || a.highest_bidder !== lastLeadingBidder
    )) {
      currentBox.classList.remove("bump");
      void currentBox.offsetWidth; // рестартира анимацията
      currentBox.classList.add("bump");
    }
    lastLeadingBid = a.highest_bid;
    lastLeadingBidder = a.highest_bidder;
    G.updateAuctionTimer();
    IE.el("auction-participants").innerHTML = g.turn_order.map((pid) => {
      const player = g.players[pid];
      if (!player || player.bankrupt) return "";
      const active = a.participants.includes(pid);
      const leading = a.highest_bidder === pid;
      return `<span class="${active ? "active" : "withdrawn"}${leading ? " leading" : ""}">${player.name}${leading ? " · води" : active ? "" : " · отказал се"}</span>`;
    }).join("");
    const bidHistory = (a.bid_history || []).slice().reverse();
    IE.el("auction-bid-history").innerHTML = bidHistory.length
      ? bidHistory.map((bid, index) => {
          const player = g.players[bid.player_id];
          const time = bid.ts
            ? new Date(bid.ts * 1000).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : "";
          return `<div class="auction-history-row${index === 0 ? " latest" : ""}">
            <span>${player ? player.name : "Играч"}${bid.automatic ? " · автоматично" : ""}</span>
            <b>${IE.fmt(bid.amount)}</b><time>${time}</time>
          </div>`;
        }).join("")
      : '<div class="auction-history-empty">Все още няма наддавания.</div>';

    const me = g.players[state.myId];
    const canBid = !g.paused && !state.isSpectator && me && !me.bankrupt
      && a.participants.includes(state.myId);
    IE.el("auction-bid-controls").classList.toggle("hidden", !canBid);
    let minBid = Math.max(a.minimum_bid || 0, a.highest_bid + g.settings.auction_min_step);
    const targetSelect = IE.el("auction-build-target");
    const previousTarget = Number(targetSelect.value);
    targetSelect.classList.toggle("hidden", !building || !canBid);
    if (building && canBid) {
      const options = auctionBuildOptions(g, a.kind);
      const defaultTarget = options.includes(previousTarget)
        ? previousTarget : a.targets[state.myId];
      targetSelect.innerHTML = options.map((pos) =>
        `<option value="${pos}"${pos === defaultTarget ? " selected" : ""}>${BOARD.spaces[pos].name} · ${IE.fmt(G.currentBuildCost(BOARD.spaces[pos]))}</option>`
      ).join("");
      const selected = BOARD.spaces[+targetSelect.value];
      if (selected) minBid = Math.max(minBid, G.currentBuildCost(selected));
    }
    const assetPosition = building
      ? (+targetSelect.value || (a.highest_bidder && a.targets[a.highest_bidder]) || a.position)
      : a.position;
    renderAuctionPropertyCard(g, a, assetPosition, building);
    const input = IE.el("auction-bid-input");
    if (document.activeElement !== input) input.value = minBid;
    input.min = minBid;
    input.step = g.settings.auction_min_step;
    IE.el("btn-withdraw-auction").disabled = a.highest_bidder === state.myId;
    updateAuctionFinance();
  };

  G.updateAuctionTimer = function updateAuctionTimer() {
    const status = IE.el("auction-status");
    const auction = state.game && state.game.auction;
    if (!status || !auction || !auction.ends_at) {
      if (status) status.textContent = "";
      return;
    }
    if (state.game.paused) {
      const remaining = Math.max(0, Math.ceil(
        Number.isFinite(state.game.paused_auction_remaining)
          ? state.game.paused_auction_remaining
          : auction.ends_at - G.syncedServerNow(),
      ));
      status.textContent = `⏸ Търгът е на пауза · остават ${remaining} сек`;
      status.classList.remove("urgent");
      return;
    }
    const remaining = Math.max(0, Math.ceil(auction.ends_at - G.syncedServerNow()));
    status.textContent = remaining > 0
      ? `⏱ ${remaining} сек · срокът се подновява при всяка нова оферта`
      : "⏱ Приключване на търга…";
    status.classList.toggle("urgent", remaining <= 5);
  };

  function auctionBuildOptions(g, kind) {
    return Object.values(g.properties).filter((prop) => {
      if (prop.owner !== state.myId || prop.mortgaged) return false;
      const sp = BOARD.spaces[prop.position];
      if (sp.type !== "property" || !G.ownsFullGroupClient(g, state.myId, sp.group)) return false;
      const levels = G.propertyGroupPositions(sp.group).map((pos) => (g.properties[String(pos)] || {level: 0}).level);
      if (Math.min(...levels) < prop.level || prop.level >= G.MAX_LEVEL) return false;
      return kind === "hotel" ? prop.level + 1 === 5 : prop.level + 1 <= 4;
    }).map((prop) => prop.position);
  }

  IE.el("btn-place-bid").addEventListener("click", () => {
    const amount = parseInt(IE.el("auction-bid-input").value, 10);
    const target = IE.el("auction-build-target");
    if (Number.isFinite(amount) && !IE.el("btn-place-bid").disabled) socket.emit("place_bid", {
      amount,
      position: target.classList.contains("hidden") ? null : +target.value,
    });
  });
  IE.el("btn-withdraw-auction").addEventListener("click", () => {
    socket.emit("withdraw_auction", {});
  });
  IE.el("auction-build-target").addEventListener("change", () => G.renderAuction());
  IE.el("auction-bid-input").addEventListener("input", updateAuctionFinance);
  IE.el("auction-bid-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !IE.el("btn-place-bid").disabled) {
      event.preventDefault();
      IE.el("btn-place-bid").click();
    }
  });
  document.querySelectorAll("[data-bid-plus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const g = state.game;
      if (!g || !g.auction) return;
      const auction = g.auction;
      const target = auction.kind === "property" ? null : +IE.el("auction-build-target").value;
      const buildCost = target === null ? 0 : G.currentBuildCost(BOARD.spaces[target] || {});
      const input = IE.el("auction-bid-input");
      const currentAmount = parseInt(input.value, 10);
      const amount = Math.max(
        (Number.isFinite(currentAmount) ? currentAmount : auction.highest_bid)
          + parseInt(btn.dataset.bidPlus, 10),
        auction.highest_bid + g.settings.auction_min_step,
        auction.minimum_bid || 0,
        buildCost,
      );
      input.value = amount;
      input.focus();
      updateAuctionFinance();
    });
  });
})();
