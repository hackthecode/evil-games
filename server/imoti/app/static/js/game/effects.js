/* ============================================================
   Имоти и Империи — effects: визуални ефекти извън таблото.
   Банери за стъпване и трансфери, летящи банкноти, спотлайт,
   конфети, стартов ред, строителни превози.
   ============================================================ */
"use strict";

(function () {
  const G = window.IEGame;
  if (!G) return;
  const { BOARD, state } = G;

  G.showStartingOrder = function showStartingOrder(event) {
    const old = document.querySelector(".starting-order-panel");
    if (old) old.remove();
    const diceFace = (value) => ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][value] || value;
    const rollsByPlayer = new Map();
    for (const roll of event.rolls || []) {
      if (!rollsByPlayer.has(roll.player_id)) rollsByPlayer.set(roll.player_id, []);
      rollsByPlayer.get(roll.player_id).push(roll);
    }
    const panel = document.createElement("section");
    panel.className = "starting-order-panel";
    panel.innerHTML = `
      <button type="button" aria-label="Затвори">&times;</button>
      <small>НАЧАЛНО ХВЪРЛЯНЕ</small>
      <h3>Ред на играчите</h3>
      <div class="starting-order-list">${(event.order || []).map((playerId, index) => {
        const player = state.game && state.game.players[playerId];
        const rolls = rollsByPlayer.get(playerId) || [];
        const first = rolls[0] || { dice: [], total: 0 };
        const ties = rolls.slice(1).map((roll) => `равенство: ${roll.total}`).join(" · ");
        return `<div class="starting-order-row">
          <b>${index + 1}</b>
          <span>${IE.escapeHtml(player ? player.name : "Играч")}${ties ? `<small>${ties}</small>` : ""}</span>
          <strong>${(first.dice || []).map(diceFace).join(" ")} <i>${first.total}</i></strong>
        </div>`;
      }).join("")}</div>`;
    const center = document.querySelector(".board-center");
    if (!center) return;
    center.appendChild(panel);
    const close = () => panel.remove();
    panel.querySelector("button").addEventListener("click", close);
    setTimeout(() => {
      if (!panel.isConnected) return;
      panel.classList.add("closing");
      setTimeout(close, 300);
    }, 6500);
  };

  G.vibrateTurn = function vibrateTurn() {
    if (navigator.vibrate) navigator.vibrate([120, 65, 120]);
  };

  G.showEventSpotlight = function showEventSpotlight(icon, title, detail, kind = "", duration = 1700) {
    const old = document.querySelector(".event-spotlight");
    if (old) old.remove();
    const overlay = document.createElement("div");
    overlay.className = `event-spotlight ${kind}`.trim();
    overlay.innerHTML = `<div class="spotlight-icon">${icon}</div><strong>${IE.escapeHtml(title)}</strong><span>${IE.escapeHtml(detail)}</span>`;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), duration + 120);
    return G.wait(duration);
  };

  G.animateGroupCompletion = function animateGroupCompletion(group, color) {
    for (const pos of G.propertyGroupPositions(group)) {
      const space = IE.el(`space-${pos}`);
      if (!space) continue;
      space.style.setProperty("--celebration-color", color || "#e6c36b");
      space.classList.remove("group-celebration");
      void space.offsetWidth;
      space.classList.add("group-celebration");
      setTimeout(() => space.classList.remove("group-celebration"), 1900);
    }
  };

  G.showLandingBanner = function showLandingBanner(pos, playerId) {
    const sp = BOARD.spaces[pos];
    const g = state.game;
    const player = g.players[playerId];
    const prop = g.properties[String(pos)];
    const owner = prop && prop.owner ? g.players[prop.owner] : null;
    let result = "Специално поле";
    if (sp.price && !owner) result = `Свободен имот · ${IE.fmt(sp.price)}`;
    else if (owner && prop.owner === playerId) result = "Собствен имот";
    else if (owner && prop.mortgaged) result = "Ипотекиран · без наем";
    else if (owner) {
      const rent = G.rentBreakdown(sp, prop, owner.player_id);
      result = `${rent.label} · ${IE.fmt(rent.amount)} към ${owner.name}`;
    }
    else if (sp.type === "tax") {
      const tax = G.currentEventAmount(sp.amount, "tax_percent");
      result = tax ? `Плащане към банката · ${IE.fmt(tax)}` : "Данъчна амнистия · без плащане";
    }
    else if (sp.type === "card") result = "Теглене на карта";
    IE.el("landing-kicker").textContent = player ? `${player.name} Стъпи на` : "Стъпване на";
    IE.el("landing-name").textContent = sp.name;
    IE.el("landing-result").textContent = result;
    const banner = IE.el("landing-banner");
    banner.classList.remove("hidden");
    clearTimeout(showLandingBanner._timer);
    showLandingBanner._timer = setTimeout(() => banner.classList.add("hidden"), 3900);
  };

  G.flashCash = function flashCash(pid, up) {
    const el = document.querySelector(`[data-player-card="${pid}"] .pc-cash`);
    if (!el) return;
    el.classList.remove("flash-up", "flash-down");
    void el.offsetWidth;
    el.classList.add(up ? "flash-up" : "flash-down");
  };

  /* ----------------------------------------------------------
     Анимации: теглене от тестето и летящи банкноти
     ---------------------------------------------------------- */
  G.animateDeckDraw = function animateDeckDraw(deckId) {
    const pile = IE.el(deckId === "community" ? "deck-community" : "deck-business");
    if (!pile) return;
    const rect = pile.getBoundingClientRect();
    const ghost = document.createElement("div");
    // Нюансът на тестето върви с летящата карта, за да прилича на
    // купчината. Класът е отделен (ghost-*), защото .deck-* носи и
    // позицията, и наклона на самото тесте.
    ghost.className = `deck-ghost ghost-${deckId}`;
    ghost.innerHTML = IE.spaceIconSvg(deckId === "community" ? "❓" : "💼");
    ghost.style.left = rect.left + rect.width / 2 + "px";
    ghost.style.top = rect.top + rect.height / 2 + "px";
    document.body.appendChild(ghost);
    // Купчината „разлиства": горната карта се плъзва настрани и се връща,
    // за да личи откъде тръгва летящата карта. Класът се маха след края,
    // иначе следващото теглене не би го задействало отново.
    const cards = pile.querySelectorAll(".deck-card");
    const top = cards.length ? cards[cards.length - 1] : null;
    if (top) {
      top.classList.remove("is-dealing");
      // Ново кадриране преди повторното добавяне — иначе браузърът не
      // вижда промяна и анимацията не тръгва втори път.
      void top.offsetWidth;
      top.classList.add("is-dealing");
      setTimeout(() => top.classList.remove("is-dealing"), 460);
    }
    requestAnimationFrame(() => {
      ghost.style.left = window.innerWidth / 2 + "px";
      ghost.style.top = window.innerHeight / 2 + "px";
      ghost.style.transform = "translate(-50%, -50%) scale(2.6) rotate(360deg)";
      ghost.style.opacity = "0";
    });
    setTimeout(() => ghost.remove(), 800);
  };

  G.animateBuildingTransfer = async function animateBuildingTransfer(position, level, returning, duration = 760) {
    const space = IE.el(`space-${position}`);
    const bank = IE.el("bank-toggle");
    if (!space || !bank) return;
    const spaceRect = space.getBoundingClientRect();
    const bankRect = bank.getBoundingClientRect();
    const target = {
      x: spaceRect.left + spaceRect.width / 2,
      y: spaceRect.top + spaceRect.height / 2,
    };
    const vault = {
      x: bankRect.left + bankRect.width / 2,
      y: bankRect.top + bankRect.height / 2,
    };
    const from = returning ? target : vault;
    const to = returning ? vault : target;
    const piece = document.createElement("div");
    piece.className = `construction-piece ${level >= G.MAX_LEVEL ? "hotel" : "house"}`;
    piece.style.left = `${from.x}px`;
    piece.style.top = `${from.y}px`;
    document.body.appendChild(piece);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const animation = piece.animate([
      { transform: "translate(-50%, -50%) scale(0.7) rotate(-12deg)", opacity: 0.3 },
      { transform: `translate(calc(-50% + ${dx * 0.46}px), calc(-50% + ${dy * 0.46 - 55}px)) scale(1.35) rotate(10deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.9) rotate(0deg)`, opacity: 1 },
    ], { duration, easing: "cubic-bezier(.22,.75,.3,1)", fill: "forwards" });
    await animation.finished.catch(() => {});
    piece.remove();
    const impact = returning ? bank : space;
    impact.classList.remove("construction-impact");
    void impact.offsetWidth;
    impact.classList.add("construction-impact");
    setTimeout(() => impact.classList.remove("construction-impact"), 500);
  };

  function moneyAnchor(playerId) {
    if (playerId) {
      const card = document.querySelector(`[data-player-card="${playerId}"]`);
      if (card) {
        const r = card.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    // Банката = центърът на таблото.
    const center = document.querySelector(".board-center");
    const r = center.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Ясен банер: кой на кого прехвърля колко (банката е с неутрално име).
  G.showTransferBanner = function showTransferBanner(fromId, toId, amount, description = "Паричен трансфер") {
    const banner = document.createElement("div");
    banner.className = "transfer-banner";
    banner.innerHTML =
      `<div class="tb-transfer">` +
        `<span class="tb-name" style="color:${G.playerColorFor(fromId)}">${IE.escapeHtml(G.playerLabel(fromId))}</span>` +
        `<span class="tb-arrow">➜</span>` +
        `<span class="tb-amount">${IE.fmt(amount)}</span>` +
        `<span class="tb-arrow">➜</span>` +
        `<span class="tb-name" style="color:${G.playerColorFor(toId)}">${IE.escapeHtml(G.playerLabel(toId))}</span>` +
      `</div>` +
      `<div class="tb-reason">${IE.escapeHtml(description || "Паричен трансфер")}</div>`;
    const stack = IE.el("board-notification-stack");
    (stack || document.body).appendChild(banner);
    requestAnimationFrame(() => banner.classList.add("show"));
    setTimeout(() => banner.classList.remove("show"), 3650);
    setTimeout(() => banner.remove(), 4050);
  };

  G.animateBanknotes = function animateBanknotes(fromId, toId, amount) {
    const from = moneyAnchor(fromId);
    const to = moneyAnchor(toId);
    const denominations = G.banknoteDenominations(amount);
    for (let i = 0; i < denominations.length; i++) {
      const note = document.createElement("div");
      const denomination = denominations[i];
      note.className = `banknote banknote-${denomination}`;
      note.textContent = denomination;
      note.style.left = from.x + (Math.random() * 30 - 15) + "px";
      note.style.top = from.y + (Math.random() * 20 - 10) + "px";
      document.body.appendChild(note);
      const dx = to.x - from.x + (Math.random() * 50 - 25);
      const dy = to.y - from.y + (Math.random() * 30 - 15);
      setTimeout(() => {
        note.animate([
          { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 0.95 },
          { transform: `translate(${dx * 0.46}px, ${dy * 0.46 - 60 - i * 3}px) rotate(${Math.random() * 90 - 45}deg) scale(1.14)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 160 - 80}deg) scale(0.72)`, opacity: 0.08 },
        ], { duration: 1450, easing: "cubic-bezier(.25,.65,.3,1)", fill: "forwards" });
      }, 40 + i * 150);
      setTimeout(() => note.remove(), 1700 + i * 150);
    }
    setTimeout(() => {
      const collector = document.createElement("div");
      collector.className = "money-collector";
      collector.style.left = `${to.x}px`;
      collector.style.top = `${to.y}px`;
      collector.innerHTML = "<i></i><i></i><i></i>";
      document.body.appendChild(collector);
      setTimeout(() => collector.remove(), 900);
    }, 1150 + denominations.length * 90);
    // Плаваща сума над платеца.
    const label = document.createElement("div");
    label.className = "money-float";
    label.textContent = `−${IE.fmt(amount)}`;
    label.style.left = from.x + "px";
    label.style.top = from.y - 14 + "px";
    document.body.appendChild(label);
    setTimeout(() => {
      label.style.transform = "translate(-50%, -50px)";
      label.style.opacity = "0";
    }, 60);
    setTimeout(() => label.remove(), 1600);
    if (toId) {
      const gain = document.createElement("div");
      gain.className = "money-float gain";
      gain.textContent = `+${IE.fmt(amount)}`;
      gain.style.left = to.x + "px";
      gain.style.top = to.y - 14 + "px";
      document.body.appendChild(gain);
      setTimeout(() => {
        gain.style.transform = "translate(-50%, -50px)";
        gain.style.opacity = "0";
      }, 700);
      setTimeout(() => gain.remove(), 2100);
    }
  };

  G.spawnConfetti = function spawnConfetti(count = 90) {
    const colors = ["#e6c36b", "#c9803f", "#3fae7a", "#4a9db5", "#d05545", "#b98add"];
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti";
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = 2.4 + Math.random() * 2.6 + "s";
      piece.style.animationDelay = Math.random() * 1.6 + "s";
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 6500);
    }
  };
})();
