/* ============================================================
   Имоти и Империи — events: сървърните събития на играта.
   Опашката от game_update пакети, последователното изпълнение
   на анимациите за всяко събитие и игровият лог.
   ============================================================ */
"use strict";

(function () {
  const G = window.IEGame;
  if (!G) return;
  const { socket, state } = G;

  // Рендерът никога не бива да срива веригата — иначе бутоните (плащане,
  // фалит, край на хода) изчезват и играта „замръзва" до презареждане.
  function safeRender() {
    try {
      G.renderGame();
    } catch (err) {
      console.error("Грешка при рендиране на играта:", err);
    }
  }

  // Ограничава анимацията по време: спъната (увиснала) анимация не бива да
  // блокира прилагането на следващите пакети и показването на бутоните.
  function withTimeout(promise, ms) {
    let timer;
    const guard = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Изтече времето за анимация на хода")), ms
      );
    });
    return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
  }

  socket.on("game_update", (payload) => {
    if (!payload.state) return;
    const receivedAt = performance.now() / 1000;

    // Прилагаме състоянието, събитията и прерисуването като една обща
    // последователна операция. Иначе следващ пакет може да премести фигурката
    // на финала, докато анимацията на предишния пакет още върви.
    //
    // Критично: каквото и да се случи с анимациите, тази стъпка ВИНАГИ
    // прилага новото състояние и прерисува, и ВИНАГИ връща изпълнен промис.
    // Ако тук изтече грешка, `state.animating` остава „отровен" и всеки
    // следващ пакет се игнорира тихо — точно това замразяваше интерфейса.
    state.animating = state.animating.then(async () => {
      const prev = state.game;
      state.serverClock = {
        serverTime: Number(payload.state.server_time) || Date.now() / 1000,
        receivedAt,
      };
      // Състоянието се прилага пръв — така рендерът винаги вижда последното,
      // дори ако анимацията след това се провали.
      state.game = payload.state;
      state.started = true;
      // Пълното състояние носи и натрупания лог — идва само при влизане,
      // връщане и ръчна синхронизация. Пресъздава се ТУК, преди събитията
      // на същия пакет: иначе редът „X се върна в играта" се появява пръв,
      // прави панела непразен и старите записи така и не се зареждат.
      if (payload.state.log) G.rebuildLog(payload.state.log);
      try {
        G.showView("game");
        const hasOwnTurnEvent = (payload.events || []).some(
          (event) => event.type === "turn" && event.player_id === state.myId
        );
        if (!hasOwnTurnEvent && state.game.current_player === state.myId
            && (!prev || prev.current_player !== state.myId)) {
          G.vibrateTurn();
          G.notifyMyTurn();
        }
        await withTimeout(processEvents(payload.events || [], prev), 15000);
      } catch (err) {
        console.error("Проблем при обработка на хода:", err);
      } finally {
        safeRender();
      }
    }).catch((err) => {
      // Последна защита: веригата никога не остава в отхвърлено състояние.
      console.error("Неочаквана грешка в обновяването:", err);
      safeRender();
    });
  });

  async function processEvents(events, prev) {
    for (const ev of events) {
      // Автоматичната ликвидация при изтекъл ход вече е отразена в
      // състоянието. Не задържаме следващия играч с поредица от анимации.
      if (ev.instant) continue;
      switch (ev.type) {
        case "starting_order": {
          G.showStartingOrder(ev);
          break;
        }
        case "game_paused": {
          IE.toast("Партията е поставена на пауза.", "info");
          break;
        }
        case "game_resumed": {
          IE.toast("Партията е възобновена.", "success");
          break;
        }
        case "dice": {
          IE.sound.dice();
          G.showDice(ev.dice[0], ev.dice[1], true);
          // Изчакваме пълното премятане на заровете преди движението.
          await G.wait(G.DICE_ROLL_WAIT_MS);
          break;
        }
        case "move": {
          if (prev && G.tokenEls.has(ev.player_id)) {
            await G.animateMove(ev.player_id, ev.from, ev.to, ev.steps);
          }
          break;
        }
        case "land": {
          // Банерът е информативен — не задържа следващите действия.
          G.highlightSpace(ev.position);
          G.showLandingBanner(ev.position, ev.player_id);
          break;
        }
        case "card": {
          // Легендарната си има собствен звук — тя е събитие, не поредно
          // теглене. Ако звукът липсва, падаме към обичайния.
          if (ev.legendary && IE.sound.legendary) IE.sound.legendary();
          else IE.sound.card();
          G.animateDeckDraw(ev.deck);
          await G.wait(450);
          G.showCardModal(ev.deck, ev.text, {
            icon: ev.icon, tone: ev.tone, legendary: ev.legendary,
          });
          await G.wait(ev.legendary ? 700 : 300);
          break;
        }
        case "purchase": {
          IE.sound.buy();
          G.pulseSpace(ev.position);
          break;
        }
        case "build": {
          IE.sound.buy();
          await G.animateBuildingTransfer(ev.position, ev.level, false, ev.fast ? 220 : 760);
          break;
        }
        case "sell_improvement": {
          await G.animateBuildingTransfer(ev.position, ev.sold_level || ev.level + 1, true);
          break;
        }
        case "auction_end": {
          if (ev.winner) {
            IE.sound.buy();
            G.pulseSpace(ev.position);
          }
          break;
        }
        case "trade_accepted": {
          IE.sound.trade();
          if (G.tradeMagnitude(ev.trade) >= 600) {
            G.spawnConfetti(55);
            await G.showEventSpotlight("🤝", "Голяма сделка!", "Сериозна размяна раздвижи пазара.", "success", 1350);
          }
          break;
        }
        case "group_completed": {
          IE.sound.monopoly();
          G.animateGroupCompletion(ev.group, ev.color);
          G.spawnConfetti(48);
          const player = state.game.players[ev.player_id];
          await G.showEventSpotlight(
            "🏙️", "Завършена група",
            `${player ? player.name : "Играч"} завърши „${ev.group_name}“!`,
            "success", 1650,
          );
          break;
        }
        case "mission_completed": {
          if (ev.player_id === state.myId) {
            IE.sound.mission();
            G.spawnConfetti(60);
            await G.showEventSpotlight(
              "🎯", "Тайната мисия е изпълнена",
              `${ev.title} · бонус ${IE.fmt(ev.bonus)}`,
              "success", 1800,
            );
          }
          break;
        }
        case "global_event_start": {
          IE.sound.globalEvent();
          await G.showEventSpotlight(
            ev.event.icon || "🌍", ev.event.title,
            ev.event.description, "", 1800,
          );
          break;
        }
        case "global_event_end": {
          IE.toast(`„${ev.event.title}“ приключи.`, "info");
          break;
        }
        case "tax_amnesty": {
          IE.sound.mission();
          break;
        }
        case "payment": {
          if (ev.fast) {
            G.flashCash(ev.from, false);
            if (ev.to) G.flashCash(ev.to, true);
            await G.wait(90);
            break;
          }
          IE.sound.pay();
          G.flashCash(ev.from, false);
          if (ev.to) G.flashCash(ev.to, true);
          G.showTransferBanner(ev.from, ev.to, ev.amount, ev.description || ev.reason);
          G.animateBanknotes(ev.from, ev.to, ev.amount);
          // Изчакваме, за да се вижда ясно кой на кого плаща.
          await G.wait(1500);
          break;
        }
        case "jail": {
          IE.sound.warn();
          break;
        }
        case "jail_shield": {
          // Адвокатската карта се задейства сама — играчът трябва да види
          // защо проверката не се е състояла, иначе изглежда като пропуск.
          IE.sound.card();
          await G.showEventSpotlight(
            "🛡", "Проверката отпада",
            `Адвокатската карта на ${G.playerLabel(ev.player_id)} се задейства.`,
            "success", 1500,
          );
          break;
        }
        case "bankrupt": {
          IE.sound.bankrupt();
          const card = document.querySelector(`[data-player-card="${ev.player_id}"]`);
          if (card) card.classList.add("going-bankrupt");
          const player = state.game.players[ev.player_id];
          await G.showEventSpotlight(
            "💥", "Фалит", `${player ? player.name : "Играч"} напуска икономическата надпревара.`,
            "danger", 1700,
          );
          break;
        }
        case "game_over": {
          IE.sound.victory();
          const winner = state.game.players[ev.winner];
          await G.showEventSpotlight(
            "🏆", "Победител", winner ? winner.name : "Новият имотен магнат",
            "success", 1900,
          );
          break;
        }
        case "turn": {
          if (ev.player_id === state.myId) {
            IE.sound.turn();
            G.vibrateTurn();
            G.notifyMyTurn();
          }
          break;
        }
        case "log": {
          G.appendLog(ev);
          break;
        }
      }
    }
  }

  /* ----------------------------------------------------------
     Игрови лог
     ---------------------------------------------------------- */
  // Иконка по вид събитие — логът се сканира по-бързо от текст.
  const LOG_ICONS = {
    dice: "🎲", land: "📍", money: "💶", rent: "💸", tax: "🧾", buy: "🏠",
    build: "🏗️", mortgage: "🏦", auction: "🔨", trade: "🤝", jail: "⚖️",
    card: "🃏", turn: "▶", warning: "⚠️", bankrupt: "📉", victory: "🏆",
    monopoly: "👑", mission: "🔒",
  };

  /* Групиране по ход.

     И живото добавяне, и презареждането при reconnect минават през тази
     функция, затова групирането живее само тук — иначе логът би изглеждал
     правилно на живо и разбъркан след опресняване.

     Списъкът е най-новото отгоре (`prepend`), тоест нова група се слага
     отгоре, а записите падат в текущата. */
  let logGroup = null;

  /* Пресъздава целия лог от подаден списък. Ползва се при влизане и
     връщане, когато сървърът праща натрупаните записи. */
  G.rebuildLog = function rebuildLog(entries) {
    const box = IE.el("log-entries");
    if (!box) return;
    box.innerHTML = "";
    logGroup = null;
    for (const entry of entries || []) G.appendLog(entry);
  };

  function startLogGroup(box, title) {
    const group = document.createElement("section");
    group.className = "log-group";
    const head = document.createElement("button");
    head.type = "button";
    head.className = "log-group-head";
    head.setAttribute("aria-expanded", "true");
    head.innerHTML = `<span class="lg-caret" aria-hidden="true">⌄</span>`
      + `<span class="lg-title">${G.colorizeNames(title)}</span>`
      + `<span class="lg-count">0</span>`;
    const body = document.createElement("div");
    body.className = "log-group-body";
    head.addEventListener("click", () => {
      const open = group.classList.toggle("collapsed");
      head.setAttribute("aria-expanded", open ? "false" : "true");
    });
    group.append(head, body);
    box.prepend(group);
    return group;
  }

  G.appendLog = function appendLog(entry) {
    const box = IE.el("log-entries");
    // Редът „Ред е на X" става заглавие на групата, вместо да се повтаря
    // вътре в нея — това е същината на съкратения изглед.
    if (entry.kind === "turn" || !logGroup || !logGroup.isConnected) {
      logGroup = startLogGroup(
        box, entry.kind === "turn" ? entry.text : "Начало на партията",
      );
      // Групите растат само нагоре; ограничаваме броя им, не броя записи.
      while (box.children.length > 40) box.lastChild.remove();
      if (entry.kind === "turn") return;
    }
    const el = document.createElement("div");
    el.className = `log-entry kind-${entry.kind || "info"}`;
    const icon = document.createElement("span");
    icon.className = "log-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = LOG_ICONS[entry.kind] || "";
    const text = document.createElement("span");
    text.className = "log-text";
    // Текстът от сървъра вече е екраниран (имената минават през
    // security.sanitize_name), затова тук се вмъква като HTML с оцветени имена.
    text.innerHTML = G.colorizeNames(entry.text);
    // Час на събитието — при дълга партия е единственият начин да се
    // разбере кога точно е станало нещо. Пълната дата стои в подсказката.
    const when = new Date((entry.ts || Date.now() / 1000) * 1000);
    const time = document.createElement("time");
    time.className = "log-time";
    time.textContent = when.toLocaleTimeString("bg-BG", {
      hour: "2-digit", minute: "2-digit",
    });
    time.dateTime = when.toISOString();
    time.title = when.toLocaleString("bg-BG");
    el.append(icon, text, time);
    const body = logGroup.querySelector(".log-group-body");
    body.prepend(el);
    const counter = logGroup.querySelector(".lg-count");
    if (counter) counter.textContent = String(body.children.length);
  };

  socket.on("game_saved", () => IE.toast("Играта е записана.", "success"));
})();
