/* ============================================================
   Имоти и Империи — board: таблото и всичко върху него.
   Геометрия на полетата, hover карта, нотариален акт, фигурки,
   движение стъпка по стъпка и 3D заровете.
   ============================================================ */
"use strict";

(function () {
  const G = window.IEGame;
  if (!G) return;
  const { BOARD, socket, state } = G;

  /* ==========================================================
     ТАБЛО — класическа квадратна периметърна подредба:
     4 ъгъла + 8 полета на всяка страна, движение по часовниковата
     стрелка от долния десен ъгъл. Съдържанието е изцяло оригинално.
     ========================================================== */
  const boardEl = IE.el("board");

  /* Меко сричкопренасяне за плочките на таблото. Chrome не носи речник за
     `hyphens: auto` на български, затова дългите слети имена („Водоснабдяване")
     се пренасяха по средата на думата без тире. Вмъкваме U+00AD (мек пренос)
     на приблизителни сричкови граници: след гласна, следвана от съгласна —
     браузърът избира само мястото, където реално се пренася, а тирето се
     вижда единствено там. Прилага се само тук; данните за имената остават
     чисти за логовете, картите и модалите. */
  const VOWELS_BG = "аеиоуъюяАЕИОУЪЮЯ";

  /* Сложните думи се пренасят по шева между двете основи, а не по
     сричка. Евристиката отдолу гледа само гласна+съгласна и затова
     предлагаше „Електроснабдя-ване"; браузърът избира последната
     възможност, която се събира, и се получаваше пренос по средата на
     втората основа. Тук преломът е зададен изрично и е единствен. */
  const HYPHEN_EXCEPTIONS = {
    "Електроснабдяване": "Електро­снабдяване",
    "Водоснабдяване": "Водо­снабдяване",
  };

  function softHyphenate(name) {
    const explicit = HYPHEN_EXCEPTIONS[name];
    if (explicit) return explicit;
    if (name.length < 10 || name.includes(" ")) return name; // късите и съставните думи се пренасят по интервала
    let out = "";
    for (let i = 0; i < name.length; i++) {
      out += name[i];
      const isVowel = VOWELS_BG.includes(name[i]);
      const nextIsConsonant = i + 1 < name.length && /[а-яА-Я]/.test(name[i + 1]) && !VOWELS_BG.includes(name[i + 1]);
      // Не оставяме по-малко от 2 знака от двете страни на прелома.
      if (isVowel && nextIsConsonant && i >= 1 && i + 2 < name.length) out += "­";
    }
    return out;
  }
  const spaceCoords = [];
  const SIDE = (BOARD.size - 4) / 4;        // полета на страна без ъглите (9)
  const CORNER = 13;                        // % страна на ъглово поле
  const CELL = (100 - 2 * CORNER) / SIDE;   // % ширина на редово поле

  function spaceGeometry(i) {
    if (i === 0) return { left: 100 - CORNER, top: 100 - CORNER, w: CORNER, h: CORNER, side: "bottom", corner: true };
    if (i <= SIDE) {
      return { left: 100 - CORNER - CELL * i, top: 100 - CORNER, w: CELL, h: CORNER, side: "bottom" };
    }
    if (i === SIDE + 1) return { left: 0, top: 100 - CORNER, w: CORNER, h: CORNER, side: "left", corner: true };
    if (i <= 2 * SIDE + 1) {
      return { left: 0, top: 100 - CORNER - CELL * (i - SIDE - 1), w: CORNER, h: CELL, side: "left" };
    }
    if (i === 2 * SIDE + 2) return { left: 0, top: 0, w: CORNER, h: CORNER, side: "top", corner: true };
    if (i <= 3 * SIDE + 2) {
      return { left: CORNER + CELL * (i - 2 * SIDE - 3), top: 0, w: CELL, h: CORNER, side: "top" };
    }
    if (i === 3 * SIDE + 3) return { left: 100 - CORNER, top: 0, w: CORNER, h: CORNER, side: "right", corner: true };
    return { left: 100 - CORNER, top: CORNER + CELL * (i - 3 * SIDE - 4), w: CORNER, h: CELL, side: "right" };
  }

  /* Цветовете на лентите за неимотните полета се задават в board.css
     (.type-transport / .type-utility / .type-card / .type-tax) — тук стоят
     само за да се избере мастилото на знака. При промяна в CSS се пипа и
     тази таблица. */
  const TYPE_BAND_COLORS = {
    transport: "#37475a",
    utility: "#57a7c2",
    card: "#a273cc",
    tax: "#7b8996",
  };

  /* Мастилото на знака в нотариалния акт — същото като кръглия печат
     (.deed-emblem в space-card.css). Не се извежда от цвета на групата:
     хартията е кремава, а светлото мастило би изчезнало върху нея. */
  const DEED_INK = "#33424a";

  /* Знак за поле извън осемте цветови групи. Картите се различават по
     тестето си (`deck` в board_config.json), а не по емоджито. */
  function typeEmblem(sp) {
    const key = sp.type === "card" ? `card_${sp.deck}` : sp.type;
    const color = TYPE_BAND_COLORS[sp.type];
    if (!color) return "";
    return IE.bandEmblemSvg(key, G.bandInk(color));
  }

  /* Лентата в картата при посочване за неимотните полета. Текстът минава
     през <span>, както при цветовите групи — .sc-band е flex контейнер. */
  function typeBandHTML(sp, label) {
    return `<div class="sc-band" style="background:${TYPE_BAND_COLORS[sp.type]}">`
      + `${typeEmblem(sp)}<span>${label}</span></div>`;
  }

  function buildBoard() {
    for (let i = 0; i < BOARD.size; i++) {
      const g = spaceGeometry(i);
      spaceCoords[i] = { x: g.left + g.w / 2, y: g.top + g.h / 2 };

      const sp = BOARD.spaces[i];
      const el = document.createElement("div");
      // corner-<позиция> носи сцената на ъгъла (изгрев, решетка, морава,
      // сигнална лампа). Позициите идват от board_config.json — при промяна
      // на таблото трябва да се пипне и board.css.
      el.className = `space type-${sp.type} side-${g.side}`
        + (g.corner ? ` is-corner corner-${i}` : "");
      el.id = `space-${i}`;
      el.style.left = g.left + "%";
      el.style.top = g.top + "%";
      el.style.width = g.w + "%";
      el.style.height = g.h + "%";

      const groupColor = sp.group && BOARD.groups[sp.group] ? BOARD.groups[sp.group].color : null;
      let band = "";
      if (sp.type === "property") {
        // Емблемата на групата: мастилото се избира според яркостта на
        // лентата — жълтото и светлосиньото искат тъмен знак, тъмносиньото
        // и кафявото — светъл.
        band = `<div class="sp-band" style="background:${groupColor}">`
          + `${IE.bandEmblemSvg(sp.group, G.bandInk(groupColor))}</div>`;
        // Лек оттенък на цялата плочка в цвета на групата. Групите не са
        // непрекъснати (между „Стар център" 1 и 3 стои картово поле), затова
        // обединен кант не върши работа — окото ги свързва по цвят.
        el.style.setProperty("--group-tint", groupColor);
      } else if (sp.type !== "corner") {
        band = `<div class="sp-band">${typeEmblem(sp)}</div>`;
      }
      const icon = sp.icon ? `<div class="sp-icon">${IE.spaceIconSvg(sp.icon)}</div>` : "";
      const price = sp.price ? `<div class="sp-price">${IE.fmt(sp.price)}</div>` : "";
      el.innerHTML = `${band}<div class="sp-body">${icon}<div class="sp-name">${softHyphenate(sp.name)}</div>${price}</div>
        <div class="sp-level"></div><div class="sp-owner" style="display:none"></div>`;
      // Полето е достъпно и с клавиатура: Enter/Space отваря информацията.
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", sp.price ? `${sp.name}, ${IE.fmt(sp.price)}` : sp.name);
      el.addEventListener("click", () => G.showSpaceInfo(i));
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          G.showSpaceInfo(i);
        }
      });
      el.addEventListener("focus", () => showSpaceCard(i));
      el.addEventListener("blur", hideSpaceCard);
      el.addEventListener("mouseenter", () => showSpaceCard(i));
      el.addEventListener("mouseleave", hideSpaceCard);
      boardEl.appendChild(el);
    }
  }
  buildBoard();

  /* Смаляване САМО на надписите, които наистина не се събират.

     Преценка по брой знаци не върши работа: „Бизнес възможност" (17 знака)
     се събира, защото полето му няма ред за цена, а „Централна гара" (14)
     не се събира. Затова се мери реално — веднъж след построяването и
     наново при всяка промяна на размера, понеже шрифтът follows ширината
     на таблото. */
  function fitSpaceNames() {
    const names = [...document.querySelectorAll(".space .sp-name")];
    const boardWidth = boardEl.getBoundingClientRect().width;
    if (!names.length || !boardWidth) return;
    const doesNotFit = (el) => el.scrollHeight > el.clientHeight + 1
      || el.scrollWidth > el.clientWidth + 1;
    for (const el of names) el.classList.remove("is-long", "is-longer");
    // На телефон плочката е под 30px и шрифтът вече е на долната си
    // граница (6.4px). Смаляване там прави надписа нечетим, вместо просто
    // отрязан — по-добре е дългите имена да се подават извън кадъра, както
    // беше и досега.
    if (boardWidth < 520) return;
    // Две стъпки надолу, всяка на отделен проход: първо се свалят класовете
    // на всички, после се мери — така писането и мереното не се редуват за
    // всеки елемент поотделно (layout thrash).
    const tooBig = names.filter(doesNotFit);
    for (const el of tooBig) el.classList.add("is-long");
    for (const el of tooBig.filter(doesNotFit)) {
      el.classList.remove("is-long");
      el.classList.add("is-longer");
    }
  }
  fitSpaceNames();
  G.fitSpaceNames = fitSpaceNames;

  // Тестетата в ъглите са винаги на дъската — техните икони също минават към
  // SVG глифите, иначе биха останали единствените цветни емоджи върху таблото.
  (function skinDeckPiles() {
    // Последната карта се взима от списъка, а не със селектор: последното
    // дете на тестето е .deck-label (също div), затова и :last-child, и
    // :last-of-type не съвпадаха с нищо и върху купчините тихо оставаха
    // емоджитата от game.html вместо SVG глифите.
    const lastCard = (pileId) => {
      const cards = document.querySelectorAll(`#${pileId} .deck-card`);
      return cards.length ? cards[cards.length - 1] : null;
    };
    const community = lastCard("deck-community");
    const business = lastCard("deck-business");
    if (community) community.innerHTML = IE.spaceIconSvg("❓");
    if (business) business.innerHTML = IE.spaceIconSvg("💼");
  })();

  G.updateBoardOwnership = function updateBoardOwnership() {
    if (!state.game) return;
    const completionTargets = G.groupCompletionTargets(state.myId);
    for (let i = 0; i < BOARD.size; i++) {
      const el = IE.el(`space-${i}`);
      const sp = BOARD.spaces[i];
      const prop = state.game.properties[String(i)];
      const ownerBar = el.querySelector(".sp-owner");
      const levelEl = el.querySelector(".sp-level");
      el.classList.toggle("mortgaged", !!(prop && prop.mortgaged));
      const target = completionTargets.get(i);
      el.classList.toggle("group-completion-target", !!target);
      if (target) {
        const group = BOARD.groups[target.groupId];
        el.style.setProperty("--completion-color", group.color);
        el.dataset.completionMark = "★";
        el.title = target.readyToBuild
          ? `Нужен за цялата група „${group.name}“ и отключване на строежа`
          : `Нужен за цялата група „${group.name}“; освободете ипотеките преди строеж`;
      } else {
        el.style.removeProperty("--completion-color");
        delete el.dataset.completionMark;
        el.removeAttribute("title");
      }
      const owner = prop && prop.owner ? state.game.players[prop.owner] : null;
      el.classList.toggle("is-owned", !!owner);
      if (owner) {
        const color = IE.tokenColor(owner.token);
        ownerBar.style.display = "";
        ownerBar.style.background = color;
        ownerBar.title = `Собственик: ${owner.name}`;
        el.style.outline = `2px solid ${color}`;
        el.style.outlineOffset = "-2px";
      } else {
        ownerBar.style.display = "none";
        el.style.outline = "";
      }
      /* Цената отстъпва на наема, щом имотът има собственик.

         Купената цена вече е история — от този момент нататък въпросът е
         „колко ще ми струва да стъпя тук". Наемът се взима от същия
         помощник, който храни и нотариалния акт, вместо да се преписва
         формулата (глобалните събития и пълната група влизат в сметката
         на едно място). */
      const priceEl = el.querySelector(".sp-price");
      if (priceEl) {
        if (owner && !prop.mortgaged) {
          const rent = G.rentBreakdown(sp, prop, owner.player_id);
          priceEl.textContent = IE.fmt(rent.amount);
          priceEl.classList.add("is-rent");
          priceEl.title = `Наем · ${rent.label}`;
        } else if (owner && prop.mortgaged) {
          priceEl.textContent = "ипотека";
          priceEl.classList.add("is-rent");
          priceEl.title = "Ипотекиран — не начислява наем";
        } else {
          priceEl.textContent = sp.price ? IE.fmt(sp.price) : "";
          priceEl.classList.remove("is-rent");
          priceEl.removeAttribute("title");
        }
      }
      levelEl.innerHTML = prop ? G.levelMarkup(prop.level) : "";
    }
  };

  /* ----------------------------------------------------------
     Hover карта на полето: пълната информация, а фигурките върху
     полето се скриват, за да се чете спокойно.
     ---------------------------------------------------------- */
  const spaceCardEl = document.createElement("div");
  spaceCardEl.className = "space-card hidden";
  document.querySelector(".board-wrap").appendChild(spaceCardEl);

  function spaceCardHTML(pos) {
    const sp = BOARD.spaces[pos];
    const g = state.game;
    const prop = g ? g.properties[String(pos)] : null;
    const owner = prop && prop.owner && g.players[prop.owner] ? g.players[prop.owner] : null;

    let head = "";
    let body = "";
    if (sp.type === "property") {
      const grp = BOARD.groups[sp.group];
      // Същата емблема, както върху лентата на полето — така знакът от
      // таблото се свързва с името на групата.
      head = `<div class="sc-band" style="background:${grp.color}">`
        + `${IE.bandEmblemSvg(sp.group, G.bandInk(grp.color))}<span>${grp.name}</span></div>`;
      const rows = BOARD.improvement_levels.map((lv, idx) => {
        const active = prop && prop.level === idx;
        return `<tr class="${active ? "sc-active" : ""}"><td>${G.levelMarkup(idx)} ${lv}</td>
          <td>${IE.fmt(G.applyGlobalRent(sp.rent[idx], sp.type))}</td></tr>`;
      }).join("");
      const propNote = G.rentEventNote(sp.type);
      body = `
        <table class="sc-table">
          <tr><td>Цена</td><td>${IE.fmt(sp.price)}</td></tr>
          ${rows}
          <tr><td>Пълна група (без обекти)</td><td>${IE.fmt(G.applyGlobalRent(sp.rent[0] * 2, sp.type))}</td></tr>
          <tr><td>Строеж на ниво</td><td>${IE.fmt(G.currentBuildCost(sp))}</td></tr>
          <tr><td>Ипотечна стойност</td><td>${IE.fmt(sp.mortgage)}</td></tr>
        </table>
        <div class="sc-group-strip">${G.propertyGroupPositions(sp.group).map((groupPos) => {
          const groupSpace = BOARD.spaces[groupPos];
          const groupProp = g ? g.properties[String(groupPos)] : null;
          const held = owner && groupProp && groupProp.owner === owner.player_id;
          return `<span class="${held ? "held" : ""}">${groupSpace.name}</span>`;
        }).join("")}</div>
        ${propNote ? `<div class="sc-event-note">Тарифата е променена от „${propNote}“.</div>` : ""}`;
    } else if (sp.type === "transport") {
      head = typeBandHTML(sp, "Транспортно предприятие");
      // Тарифата се показва СЛЕД глобалното събитие и с маркиран текущ ред —
      // иначе играчът чете 200 €, а плаща 400 € и не разбира защо.
      const owned = owner ? G.countTypeOwned(owner.player_id, "transport") : 0;
      const note = G.rentEventNote("transport");
      body = `
        <table class="sc-table">
          <tr><td>Цена</td><td>${IE.fmt(sp.price)}</td></tr>
          ${sp.rent.map((r, i) => {
            const active = owned === i + 1;
            return `<tr class="${active ? "sc-active" : ""}">
              <td>Наем при ${i + 1} притежавани</td>
              <td>${IE.fmt(G.applyGlobalRent(r, "transport"))}</td></tr>`;
          }).join("")}
          <tr><td>Ипотечна стойност</td><td>${IE.fmt(sp.mortgage)}</td></tr>
        </table>
        ${note ? `<div class="sc-event-note">Тарифата е променена от „${note}“.</div>` : ""}`;
    } else if (sp.type === "utility") {
      head = typeBandHTML(sp, "Комунално предприятие");
      body = `
        <table class="sc-table">
          <tr><td>Цена</td><td>${IE.fmt(sp.price)}</td></tr>
          <tr><td>Наем при 1 притежавано</td><td>зарове × ${sp.rent_multiplier[0]}</td></tr>
          <tr><td>Наем при 2 притежавани</td><td>зарове × ${sp.rent_multiplier[1]}</td></tr>
          <tr><td>Ипотечна стойност</td><td>${IE.fmt(sp.mortgage)}</td></tr>
        </table>`;
    } else if (sp.type === "tax") {
      head = typeBandHTML(sp, "Такса");
      const tax = G.currentEventAmount(sp.amount, "tax_percent");
      body = tax
        ? `<p class="sc-text">При стъпване плащате <b>${IE.fmt(tax)}</b> на банката.</p>`
        : '<p class="sc-text"><b>Данъчна амнистия:</b> в момента не се плаща.</p>';
    } else if (sp.type === "card") {
      const deckName = sp.deck === "community" ? "Обществено събитие" : "Бизнес възможност";
      head = typeBandHTML(sp, deckName);
      body = '<p class="sc-text">При стъпване теглите карта и изпълнявате ефекта ѝ.</p>';
    } else {
      head = '<div class="sc-band" style="background:#c9a227">Специално поле</div>';
      const texts = {
        start: `Начало на обиколката. Преминаване оттук носи доход от ${g ? IE.fmt(g.settings.start_income) : "200 €"}${g && g.settings.eu_subsidies_enabled ? ` плюс европейска субсидия от ${IE.fmt(g.settings.eu_subsidy_amount)}` : ""}.`,
        jail: "Тук стоят проверяваните играчи. Посетителите са само на гости.",
        free_parking: g && g.settings.free_parking_jackpot
          ? `Получавате натрупания банков фонд (${IE.fmt(g.bank_pot || 0)}).`
          : "Спокойно поле — нищо не се случва.",
        goto_jail: "Стъпите ли тук, отивате незабавно на административна проверка.",
      };
      body = `<p class="sc-text">${texts[sp.subtype] || ""}</p>`;
    }

    let ownership = "";
    if (sp.price) {
      if (owner) {
        ownership = `<div class="sc-owner">
          <span class="sc-dot" style="background:${IE.tokenColor(owner.token)}"></span>
          Собственик: <b>${owner.name}</b>${prop.mortgaged ? " · ипотекиран" : ""}
          ${prop.level > 0 ? ` · ниво: ${BOARD.improvement_levels[prop.level]}` : ""}
        </div>`;
      } else {
        ownership = '<div class="sc-owner sc-free">Свободен имот</div>';
      }
    }
    // Кой стои на полето — замества скритите чипове с имена на жетоните.
    let standing = "";
    if (g) {
      const here = Object.values(g.players)
        .filter((p) => !p.bankrupt && !p.is_spectator && p.position === pos);
      if (here.length) {
        standing = `<div class="sc-standing">Тук: ${here.map((p) =>
          `<b style="color:${IE.tokenColor(p.token)}">${IE.escapeHtml(p.name)}</b>`
        ).join(", ")}</div>`;
      }
    }
    const visual = sp.price
      ? `<div class="property-visual visual-${sp.group || sp.type}"><span>${sp.name}</span></div>`
      : "";
    return `${head}${visual}<div class="sc-name">${sp.icon ? sp.icon + " " : ""}${sp.name}</div>${standing}${ownership}${body}`;
  }

  function deedHTML(pos) {
    const sp = BOARD.spaces[pos];
    if (!sp || !sp.price) return `<div class="space-card in-modal">${spaceCardHTML(pos)}</div>`;
    const g = state.game;
    const prop = g ? g.properties[String(pos)] : null;
    const owner = prop && prop.owner ? g.players[prop.owner] : null;
    const category = sp.type === "property"
      ? BOARD.groups[sp.group].name
      : sp.type === "transport" ? "Транспортно предприятие" : "Комунално предприятие";
    // Същият знак, който стои на лентата и в картата при посочване. Тук
    // мастилото е постоянно тъмно: хартията на акта е кремава, а цветът на
    // групата (жълто, светлосиньо) би се загубил върху нея.
    const categoryEmblem = IE.bandEmblemSvg(
      sp.type === "property" ? sp.group : sp.type, DEED_INK,
    );

    // Колко наем е донесъл имотът от началото на партията. Сървърът вече
    // праща property_income; дотук числото се виждаше само в крайния отчет.
    const collected = g && g.property_income
      ? +(g.property_income[String(pos)] || 0) : 0;

    // Тарифата вече е коригирана от активното събитие — без бележка
    // играчът чете едно число, а плаща друго и не разбира защо.
    const eventNote = G.rentEventNote(sp.type);

    // Дял от вида: за имот — колко от цветовата група държи собственикът
    // (това решава реда „Пълна група ×2"); за транспорт и комунални —
    // колко обекта има, защото от тях зависи тарифата.
    let holdingHTML = "";
    if (owner) {
      if (sp.type === "property") {
        const positions = G.propertyGroupPositions(sp.group);
        const held = positions.filter((groupPos) => {
          const item = g.properties[String(groupPos)];
          return item && item.owner === owner.player_id;
        });
        const mortgagedInGroup = held.filter((groupPos) => {
          const item = g.properties[String(groupPos)];
          return item && item.mortgaged;
        }).length;
        const complete = held.length === positions.length;
        holdingHTML = `
          <section class="deed-holding">
            <span>Дял от групата</span>
            <div class="deed-holding-strip">${positions.map((groupPos) => {
              const item = g.properties[String(groupPos)];
              const mine = item && item.owner === owner.player_id;
              return `<span class="${mine ? (item.mortgaged ? "held mortgaged" : "held") : ""}"
                >${IE.escapeHtml(BOARD.spaces[groupPos].name)}</span>`;
            }).join("")}</div>
            <strong>${held.length} от ${positions.length}${
              complete
                ? mortgagedInGroup
                  ? " · пълна, но с ипотеки"
                  : " · пълна група, наемът е двоен"
                : ""
            }</strong>
          </section>`;
      } else {
        const count = G.countTypeOwned(owner.player_id, sp.type);
        const total = BOARD.spaces.filter((item) => item.type === sp.type).length;
        holdingHTML = `
          <section class="deed-holding">
            <span>${sp.type === "transport" ? "Транспортни обекти" : "Комунални предприятия"}</span>
            <strong>${count} от ${total} · тарифата следва броя</strong>
          </section>`;
      }
    }

    // Кой стои на полето в момента — на таблото чиповете с имена се виждат
    // само за играча на ход.
    const here = g
      ? Object.values(g.players).filter(
        (player) => !player.bankrupt && !player.is_spectator && player.position === pos,
      )
      : [];
    const standingHTML = here.length
      ? `<section class="deed-standing"><span>В момента на полето</span><strong>${
        here.map((player) =>
          `<i style="background:${IE.tokenColor(player.token)}"></i>${IE.escapeHtml(player.name)}`
        ).join("")
      }</strong></section>`
      : "";
    let rentRows = "";
    // Тарифите отразяват активното глобално събитие, за да съвпадат с
    // това, което наистина се плаща.
    if (sp.type === "property") {
      rentRows = BOARD.improvement_levels.map((level, index) => `
        <tr class="${prop && prop.level === index ? "current" : ""}">
          <td>${level}</td><td>${IE.fmt(G.applyGlobalRent(sp.rent[index], sp.type))}</td>
        </tr>`).join("");
      rentRows += `<tr><td>Пълна група без постройки</td>`
        + `<td>${IE.fmt(G.applyGlobalRent(sp.rent[0] * 2, sp.type))}</td></tr>`;
    } else if (sp.type === "transport") {
      const ownedTransport = owner ? G.countTypeOwned(owner.player_id, "transport") : 0;
      rentRows = sp.rent.map((rent, index) => `
        <tr class="${ownedTransport === index + 1 ? "current" : ""}">
          <td>${index + 1} ${index === 0 ? "транспортен обект" : "транспортни обекта"}</td>
          <td>${IE.fmt(G.applyGlobalRent(rent, "transport"))}</td></tr>`).join("");
    } else {
      rentRows = sp.rent_multiplier.map((multiplier, index) => `
        <tr><td>${index + 1} комунални предприятия</td><td>зарове × ${multiplier}</td></tr>`).join("");
    }
    const currentRent = owner && prop && !prop.mortgaged
      ? G.rentBreakdown(sp, prop, owner.player_id) : { amount: 0, label: prop && prop.mortgaged ? "Ипотекиран" : "Не се начислява" };
    const status = prop && prop.mortgaged ? "ИПОТЕКИРАН" : owner ? "В СИЛА" : "СВОБОДЕН";
    const statusClass = prop && prop.mortgaged ? "mortgaged" : owner ? "owned" : "free";
    const ownerName = owner ? owner.name : "Българска народна банка";
    const ownerColor = owner ? IE.tokenColor(owner.token) : "#7b8794";
    const groupColor = sp.group && BOARD.groups[sp.group]
      ? BOARD.groups[sp.group].color : sp.type === "transport" ? "#37475a" : "#57a7c2";
    return `
      <article class="property-deed" style="--deed-accent:${groupColor}">
        <div class="deed-watermark">И&amp;И</div>
        <header class="deed-header">
          <div class="deed-emblem">ИИ</div>
          <div>
            <div class="deed-country">ИМОТИ &amp; ИМПЕРИИ · ЦЕНТРАЛЕН РЕГИСТЪР</div>
            <h2>Нотариален акт</h2>
            <p>за собственост и право на стопанисване</p>
          </div>
          <div class="deed-status ${statusClass}">${status}</div>
        </header>
        <div class="deed-identity">
          <div><span>Регистров номер</span><strong>ИИ-${String(pos + 1).padStart(2, "0")}-${sp.type.toUpperCase().slice(0, 3)}</strong></div>
          <div><span>Категория</span><strong class="deed-category-line">${categoryEmblem}${category}</strong></div>
        </div>
        <section class="deed-property-name">
          <span>Предмет на акта</span>
          <h3>${sp.name}</h3>
        </section>
        <section class="deed-owner">
          <div class="deed-owner-mark" style="background:${ownerColor}"></div>
          <div><span>Вписан собственик</span><strong>${ownerName}</strong></div>
          <div><span>Текущо състояние</span><strong>${prop && prop.level ? BOARD.improvement_levels[prop.level] : "Без постройки"}</strong></div>
        </section>
        ${holdingHTML}
        ${standingHTML}
        <div class="deed-columns">
          <section>
            <h4>Финансови условия</h4>
            <dl class="deed-values">
              <div><dt>Покупна цена</dt><dd>${IE.fmt(sp.price)}</dd></div>
              <div><dt>Ипотечна стойност</dt><dd>${IE.fmt(sp.mortgage)}</dd></div>
              ${sp.improve_cost ? `<div><dt>Строеж на ниво</dt><dd>${IE.fmt(G.currentBuildCost(sp))}</dd></div>` : ""}
              <div class="deed-current-rent"><dt>Текущ наем · ${currentRent.label}</dt><dd>${IE.fmt(currentRent.amount)}</dd></div>
              <div class="deed-income"><dt>Събран наем от началото</dt><dd>${IE.fmt(collected)}</dd></div>
            </dl>
            <!-- Действията на собственика стоят до числата, върху които
                 действат; попълват се от configureDeedOwnerActions. -->
            <div id="deed-owner-actions" class="deed-actions hidden"></div>
          </section>
          <section>
            <h4>Тарифа на наемите</h4>
            <table class="deed-rents"><tbody>${rentRows}</tbody></table>
            ${eventNote ? `<p class="deed-event-note">Тарифата е променена от „${IE.escapeHtml(eventNote)}“.</p>` : ""}
          </section>
        </div>
        <footer class="deed-footer">
          <div class="deed-signature"><span>${ownerName}</span><small>собственик / упълномощен представител</small></div>
          <div class="deed-seal">ВПИСАНО<br><b>${String(pos + 1).padStart(2, "0")}</b></div>
          <div class="deed-signature registry"><span>Централен регистър</span><small>валидно за текущата партия</small></div>
        </footer>
      </article>`;
  }

  function showSpaceCard(pos) {
    spaceCardEl.innerHTML = spaceCardHTML(pos);
    const g = spaceGeometry(pos);
    const s = spaceCardEl.style;
    s.left = s.right = s.top = s.bottom = "auto";
    if (g.side === "bottom") {
      s.bottom = (100 - g.top) + 1 + "%";
      s.left = Math.min(Math.max(g.left - 7, 1), 68) + "%";
    } else if (g.side === "top") {
      s.top = g.h + 1 + "%";
      s.left = Math.min(Math.max(g.left - 7, 1), 68) + "%";
    } else if (g.side === "left") {
      s.left = g.w + 1 + "%";
      s.top = Math.min(Math.max(g.top - 9, 1), 55) + "%";
    } else {
      s.right = g.w + 1 + "%";
      s.top = Math.min(Math.max(g.top - 9, 1), 55) + "%";
    }
    spaceCardEl.classList.remove("hidden");
    // Скриваме фигурките върху това поле, за да се чете информацията.
    for (const [pid, el] of G.tokenEls) {
      el.classList.toggle("ghost", el.dataset.pos === String(pos));
    }
  }

  function hideSpaceCard() {
    spaceCardEl.classList.add("hidden");
    for (const [, el] of G.tokenEls) el.classList.remove("ghost");
  }

  /* ----------------------------------------------------------
     Информация за поле (нотариален акт в модал)
     ---------------------------------------------------------- */
  // Отвореният акт се помни, за да се обновява на място след строеж —
  // нивото и наемът се променят, а модалът остава отворен.
  let openDeedPos = null;
  let openDeedHTML = "";

  G.showSpaceInfo = function showSpaceInfo(pos) {
    openDeedPos = pos;
    openDeedHTML = deedHTML(pos);
    IE.el("info-content").innerHTML = openDeedHTML;
    IE.el("info-modal").classList.remove("hidden");
    configureDeedButtons(pos);
  };

  function closeInfoModal() {
    openDeedPos = null;
    openDeedHTML = "";
    IE.el("info-modal").classList.add("hidden");
  }

  /* Актът е жив: щом състоянието се промени (строеж, сделка, ипотека),
     съдържанието се пресъздава, без модалът да се затваря. */
  G.refreshOpenDeed = function refreshOpenDeed() {
    if (openDeedPos === null) return;
    // Паузата крие модала принудително — тогава актът вече не е отворен.
    if (IE.el("info-modal").classList.contains("hidden")) {
      openDeedPos = null;
      openDeedHTML = "";
      return;
    }
    const html = deedHTML(openDeedPos);
    // Пререндираме само при реална промяна, за да не трепка при всяко
    // обновяване на състоянието.
    if (html !== openDeedHTML) {
      openDeedHTML = html;
      IE.el("info-content").innerHTML = html;
    }
    configureDeedButtons(openDeedPos);
  };

  /* Всички бутони на акта на едно място — редът на извикване няма значение,
     но има значение да не се пропусне някой при обновяване. */
  function configureDeedButtons(pos) {
    configureDeedBuyButton(pos);
    configureDeedTradeButton(pos);
    configureDeedBuildButton(pos);
    configureDeedOwnerActions(pos);
  }

  /* Покупка направо от акта. Дотук актът на свободен имот показваше
     „СВОБОДЕН" и цената, но нито един бутон — играчът трябваше да го
     затвори и да търси бутона в центъра на таблото. */
  function configureDeedBuyButton(pos) {
    const button = IE.el("btn-deed-buy");
    const g = state.game;
    const sp = BOARD.spaces[pos];
    const me = g && g.players[state.myId];
    const prop = g && g.properties[String(pos)];
    // Некупеният имот НЯМА запис в g.properties — записът се създава чак
    // при покупката. Затова условието е „няма собственик", а не „prop.owner
    // е празен".
    const shouldShow = !!(
      me && !state.isSpectator && !me.bankrupt && !g.paused
      && sp.price && !(prop && prop.owner)
      && g.phase === "AWAITING_PURCHASE"
      && g.current_player === state.myId
      && me.position === pos
    );
    button.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) return;
    const short = me.cash < sp.price;
    button.disabled = short;
    button.textContent = `Купи за ${IE.fmt(sp.price)}`;
    // Заемът си остава в балончето над заровете — тук само обясняваме защо
    // бутонът не работи, вместо да дублираме целия поток.
    button.title = short
      ? `Нужни са ${IE.fmt(sp.price)} — вземете заем от бутона над заровете`
      : `Купувате „${sp.name}“ от банката`;
    button.onclick = () => {
      socket.emit("buy_property", {});
      closeInfoModal();
    };
  }

  /* Управление на собствения имот направо от акта: същите действия, които
     стоят в панела „Моите имоти", със същите условия (G.propertyActionContext).
     Стоят вътре в акта, до сумите, върху които действат — шест бутона в
     реда на модала не се събират на телефон. */
  function configureDeedOwnerActions(pos) {
    const box = document.getElementById("deed-owner-actions");
    if (!box) return;
    const g = state.game;
    const sp = BOARD.spaces[pos];
    const prop = g && g.properties[String(pos)];
    const me = g && g.players[state.myId];
    box.innerHTML = "";
    const mine = !!(prop && prop.owner === state.myId && me && !me.bankrupt && !state.isSpectator);
    box.classList.toggle("hidden", !mine);
    if (!mine) return;

    const { manageable, sellable, myTurn, inMyDebt } = G.propertyActionContext();
    const add = (label, title, disabled, onClick) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn-ghost";
      button.textContent = label;
      button.title = title;
      button.disabled = !!disabled;
      button.onclick = onClick;
      box.appendChild(button);
    };

    // При собствен дълг води планът с един бутон — отделните действия тук
    // само биха се състезавали с него.
    if (inMyDebt) {
      box.innerHTML = '<p class="deed-actions-note">Докато има дълг, използвайте плана в панела „Действия“.</p>';
      return;
    }

    // Продажба на подобрение: равномерно в групата, отгоре надолу.
    if (sellable && sp.type === "property" && prop.level > 0) {
      const uneven = G.propertyGroupPositions(sp.group).some((other) => {
        const item = g.properties[String(other)];
        return (item ? item.level : 0) > prop.level;
      });
      const noHouses = prop.level === G.MAX_LEVEL && G.bankStock(g).houses < 4;
      add(`⬇ Продай подобрение (+${IE.fmt(Math.floor(sp.improve_cost / 2))})`,
        uneven
          ? "Първо продайте по-високото ниво в групата — строежът е равномерен."
          : noHouses
            ? "За разваляне на хотела са нужни 4 свободни къщи в банката."
            : "Връща половината от цената на нивото.",
        uneven || noHouses,
        () => G.openPropertyActionPreview("sell", prop));
    }

    // Ипотека: цялата група трябва да е без постройки.
    if (sellable && !prop.mortgaged && prop.level === 0) {
      const blocked = G.groupHasBuildings(g, sp.group);
      add(`🏦 Ипотекирай (+${IE.fmt(sp.mortgage)})`,
        blocked
          ? "Първо продайте всички постройки в групата, за да ипотекирате."
          : `Получавате ${IE.fmt(sp.mortgage)}; наемът спира до откупуване.`,
        blocked,
        () => G.openPropertyActionPreview("mortgage", prop));
    }

    // Откупуване: главница плюс 10% лихва.
    if (manageable && prop.mortgaged) {
      const cost = sp.mortgage + Math.floor(sp.mortgage / 10);
      add(`↩ Откупи за ${IE.fmt(cost)}`,
        me.cash < cost
          ? `Нужни са ${IE.fmt(cost)} — нямате достатъчно`
          : "Имотът започва да носи наем отново.",
        me.cash < cost,
        () => G.openPropertyActionPreview("unmortgage", prop));
    }

    // Продажба на банката: необратима, затова е последна и с потвърждение.
    if (sellable && prop.level === 0 && g.settings.sell_to_bank_enabled !== false) {
      const blocked = G.groupHasBuildings(g, sp.group);
      const percent = g.settings.sell_to_bank_percent ?? 80;
      const payout = Math.max(
        0,
        Math.floor((sp.price || 0) * percent / 100) - (prop.mortgaged ? sp.mortgage : 0),
      );
      add(`💰 Продай на банката (+${IE.fmt(payout)})`,
        blocked
          ? "Първо продайте всички постройки в групата."
          : `Банката плаща ${percent}% от цената${prop.mortgaged ? " минус ипотеката" : ""}. Имотът се губи безвъзвратно.`,
        blocked || payout <= 0,
        () => G.confirmAction({
          title: "Продажба на банката",
          body: [
            `Да продадете ли „${sp.name}“ на банката за ${IE.fmt(payout)}?`,
            "Имотът става отново свободен и всеки може да го купи. "
            + "Действието е необратимо.",
          ],
          confirmLabel: "Продай",
          danger: true,
          onConfirm: () => socket.emit("sell_property_to_bank", { position: pos }),
        }));
    }

    // Обяви на търг: печалбата отива при собственика, старт от стойността.
    if (manageable && myTurn && !prop.mortgaged && prop.level === 0) {
      const blocked = G.groupHasBuildings(g, sp.group);
      const others = g.turn_order.filter((pid) => {
        const pl = g.players[pid];
        return pl && !pl.bankrupt && !pl.is_spectator && pid !== state.myId;
      }).length;
      add(`🔨 Обяви на търг (от ${IE.fmt(sp.price || 0)})`,
        blocked
          ? "Първо продайте всички постройки в групата."
          : others < 1
            ? "Няма други играчи, които да наддават."
            : `Търгът започва от ${IE.fmt(sp.price || 0)}; печалбата е за вас.`,
        blocked || others < 1 || !!g.auction,
        () => G.confirmAction({
          title: "Имот на търг",
          body: [
            `Да обявите ли „${sp.name}“ на търг?`,
            `Наддаването започва от стойността на имота (${IE.fmt(sp.price || 0)}), `
            + "а спечелената сума отива при вас. Ако никой не наддаде, имотът остава ваш.",
          ],
          confirmLabel: "Обяви търг",
          onConfirm: () => socket.emit("auction_own_property", { position: pos }),
        }));
    }

    if (!box.children.length) box.classList.add("hidden");
  }

  function configureDeedTradeButton(pos) {
    const button = IE.el("btn-deed-trade");
    const g = state.game;
    const prop = g && g.properties[String(pos)];
    const owner = prop && prop.owner ? g.players[prop.owner] : null;
    const shouldShow = !!(
      owner && prop.owner !== state.myId && !owner.bankrupt && !state.isSpectator
    );
    button.classList.toggle("hidden", !shouldShow);
    button.dataset.position = shouldShow ? String(pos) : "";
    if (!shouldShow) return;

    const reason = G.tradeUnavailableReason(prop);
    button.disabled = !!reason;
    button.textContent = `🤝 Оферта към ${owner.name}`;
    button.title = reason || `Поискайте „${BOARD.spaces[pos].name}“ от ${owner.name}`;
  }

  /* Защо строежът е невъзможен — огледално на properties.can_build плюс
     ограниченията за ред, фаза и налични пари. Празен низ значи „може“. */
  function buildBlockReason(pos) {
    const g = state.game;
    const sp = BOARD.spaces[pos];
    const prop = g && g.properties[String(pos)];
    const me = g && g.players[state.myId];
    if (!prop || !me) return "Строежът не е възможен в момента.";
    if (g.paused) return "Партията е на пауза.";
    // Първо пречките по самия имот — те не се решават с изчакване.
    if (prop.mortgaged) return "Ипотекиран имот не може да се подобрява.";
    if (!G.ownsFullGroupClient(g, state.myId, sp.group)) {
      return "Нужна е пълна група без ипотеки.";
    }
    if (prop.level >= G.MAX_LEVEL) return "Достигнато е максималното ниво.";
    for (const other of G.propertyGroupPositions(sp.group)) {
      const st = g.properties[String(other)];
      if ((st ? st.level : 0) < prop.level) {
        return "Подобренията в групата трябва да са равномерни — първо развийте изоставащия имот.";
      }
    }
    const stock = G.bankStock(g);
    const target = prop.level + 1;
    if (target < G.MAX_LEVEL && stock.houses < 1) return "В банката няма свободни къщи.";
    if (target === G.MAX_LEVEL && stock.hotels < 1) return "В банката няма свободни хотели.";
    // После кога е позволено — ред и фаза.
    if (g.current_player !== state.myId) return "Може да строите само на свой ход.";
    if (g.phase !== "MANAGEMENT" && g.phase !== "WAITING_FOR_ROLL") {
      return "Строежът е възможен преди хвърлянето на заровете или при управление на хода.";
    }
    const cost = G.currentBuildCost(sp);
    if (me.cash < cost) return `Нужни са ${IE.fmt(cost)} — нямате достатъчно.`;
    return "";
  }

  /* Строеж направо от акта. Бутонът се вижда само от собственика и само
     при имот с нива — транспортът и комуналните не се застрояват. Когато
     строежът е блокиран, бутонът остава видим, но неактивен с причината:
     актът е мястото, където се очаква обяснението. */
  function configureDeedBuildButton(pos) {
    const button = IE.el("btn-deed-build");
    const note = IE.el("deed-build-note");
    const g = state.game;
    const sp = BOARD.spaces[pos];
    const prop = g && g.properties[String(pos)];
    const shouldShow = !!(
      prop && prop.owner === state.myId && !state.isSpectator
      && sp.type === "property" && sp.improve_cost
    );
    button.classList.toggle("hidden", !shouldShow);
    button.dataset.position = shouldShow ? String(pos) : "";
    if (!shouldShow) {
      note.classList.add("hidden");
      return;
    }

    const reason = buildBlockReason(pos);
    button.disabled = !!reason;
    // Причината стои като текст, а не само в подсказка: подсказките на
    // неактивен бутон не се показват навсякъде, а тук обяснението е
    // основното, което играчът търси. Пишем само при промяна — актът се
    // обновява при всяко състояние, а екранните четци четат наново.
    if (note.textContent !== reason) note.textContent = reason;
    note.classList.toggle("hidden", !reason);
    if (prop.level >= G.MAX_LEVEL) {
      button.textContent = "🏨 Максимално ниво";
      button.title = "Имотът е развит докрай.";
      return;
    }
    button.textContent = `⬆ Развий за ${IE.fmt(G.currentBuildCost(sp))}`;
    button.title = reason
      || `Ново състояние: ${BOARD.improvement_levels[prop.level + 1]}`;
  }

  IE.el("btn-deed-build").addEventListener("click", () => {
    const pos = Number(IE.el("btn-deed-build").dataset.position);
    const prop = state.game && state.game.properties[String(pos)];
    if (!prop) return;
    // Актът нарочно остава отворен: прегледът застава върху него и след
    // потвърждението новото ниво се вижда веднага в самия акт.
    G.openPropertyActionPreview("build", prop);
  });

  IE.el("btn-deed-trade").addEventListener("click", () => {
    const pos = Number(IE.el("btn-deed-trade").dataset.position);
    const prop = state.game && state.game.properties[String(pos)];
    if (!prop || !prop.owner) return;
    closeInfoModal();
    G.openTradeModal(null, prop.owner, pos);
  });

  IE.el("info-modal").addEventListener("click", (e) => {
    if (e.target === IE.el("info-modal") || e.target.dataset.close !== undefined) {
      closeInfoModal();
    }
  });

  /* ----------------------------------------------------------
     Фигурки върху таблото
     ---------------------------------------------------------- */
  G.tokenEls = new Map();

  // Колко реда, колони и на какъв мащаб да се подредят N фигурки в едно поле.
  // При 10 играчи всички стартират на един и същ ъгъл, затова един ред не
  // стига — след третата фигурка минаваме на две редици и смаляваме.
  function tokenLayout(slots) {
    if (slots <= 1) return { rows: 1, cols: 1, scale: 1 };
    if (slots <= 3) return { rows: 1, cols: slots, scale: slots === 2 ? 1 : 0.86 };
    const rows = 2;
    const cols = Math.ceil(slots / rows);
    const scale = slots <= 4 ? 0.86 : slots <= 6 ? 0.76 : slots <= 8 ? 0.68 : 0.62;
    return { rows, cols, scale };
  }

  function tokenPosition(spaceIdx, slot, slots) {
    const c = spaceCoords[spaceIdx];
    const g = spaceGeometry(spaceIdx);
    const side = g.side || "bottom";
    const horizontal = side === "bottom" || side === "top";
    // Дължина на полето по ръба на таблото: там се редят колоните. Ъгловите
    // полета са по-широки от редовите, затова стъпката идва от геометрията.
    const alongLen = horizontal ? g.w : g.h;
    const { rows, cols, scale } = tokenLayout(slots);
    const row = Math.floor(slot / cols);
    const col = slot % cols;
    // Последната редица често е непълна — центрираме само нейните фигурки.
    const inRow = Math.min(cols, slots - row * cols);
    const colStep = Math.min(3.4 * scale, (alongLen + 1.4) / Math.max(1, cols));
    const rowStep = 5.6 * scale * 0.8;
    const along = (col - (inRow - 1) / 2) * colStep;
    const depth = rows > 1 ? (row - (rows - 1) / 2) * rowStep : 0;
    // Жетонът застава към вътрешния ръб на полето (върху цветната лента),
    // за да не закрива името и цената. Втората редица е още по-навътре.
    const inset = 3.1;
    let x = c.x;
    let y = c.y;
    if (side === "bottom") { x += along; y -= inset + depth; }
    else if (side === "top") { x += along; y += inset + depth; }
    else if (side === "left") { y += along; x += inset + depth; }
    else { y += along; x -= inset + depth; }
    return { x, y, scale };
  }

  // Позиционирането е чрез transform (композитно) вместо left/top —
  // движението не предизвиква layout на всяка стъпка.
  function applyTokenTransform(el, xPct, yPct) {
    const x = (xPct / 100) * boardEl.clientWidth;
    const y = (yPct / 100) * boardEl.clientHeight;
    // Посоката на последната стъпка. Сянката се отмества срещу нея и после
    // догонва — това е, което окото чете като инерция.
    const prevX = Number(el.dataset.pxX);
    const prevY = Number(el.dataset.pxY);
    if (Number.isFinite(prevX) && Number.isFinite(prevY)) {
      const dx = x - prevX;
      const dy = y - prevY;
      const distance = Math.hypot(dx, dy);
      // Дял от стъпката, но с таван: при прескок през половин табло
      // (връщане на фигурката в изходна точка) сянката не бива да отлита.
      const lag = distance > 0.5 ? Math.min(1, 30 / distance) * 0.3 : 0;
      el.style.setProperty("--lag-x", `${(-dx * lag).toFixed(1)}px`);
      el.style.setProperty("--lag-y", `${(-dy * lag).toFixed(1)}px`);
    }
    el.dataset.pxX = String(x);
    el.dataset.pxY = String(y);
    el.style.transform = `translate(calc(${x.toFixed(1)}px - 50%), calc(${y.toFixed(1)}px - 50%))`;
  }

  function placeToken(el, spaceIdx, slot = 0, slots = 1) {
    const { x, y, scale } = tokenPosition(spaceIdx, slot, slots);
    const side = (spaceGeometry(spaceIdx).side) || "bottom";
    el.style.setProperty("--tok-scale", String(scale));
    el.dataset.xPct = String(x);
    el.dataset.yPct = String(y);
    applyTokenTransform(el, x, y);
    el.dataset.pos = String(spaceIdx);
    el.classList.remove("side-bottom", "side-top", "side-left", "side-right");
    el.classList.add("side-" + side);
    // Прибиране на името навътре при ъглите/ръбовете, за да не се реже.
    el.classList.toggle("name-clamp-right", x >= 82);
    el.classList.toggle("name-clamp-left", x <= 18);
  }

  // При преоразмеряване на таблото пиксельните координати се преизчисляват
  // от запомнените проценти — без анимация на прехода.
  new ResizeObserver(() => {
    for (const [, el] of G.tokenEls) {
      if (el.dataset.xPct == null) continue;
      el.classList.add("token-instant");
      applyTokenTransform(el, +el.dataset.xPct, +el.dataset.yPct);
    }
    requestAnimationFrame(() => {
      for (const [, el] of G.tokenEls) el.classList.remove("token-instant");
      // Шрифтът на плочките се води по ширината на таблото, затова кои
      // надписи не се събират се променя с всяко преоразмеряване.
      fitSpaceNames();
    });
  }).observe(boardEl);

  G.syncTokens = function syncTokens() {
    if (!state.game) return;
    const players = Object.values(state.game.players).filter((p) => !p.bankrupt && !p.is_spectator);
    // Създаваме липсващите елементи (фигурка + основа + име).
    for (const p of players) {
      if (!G.tokenEls.has(p.player_id)) {
        const el = document.createElement("div");
        el.className = "board-token";
        el.style.setProperty("--tok-color", IE.tokenColor(p.token));
        // Сянката е отделен елемент, а не filter върху фигурката: така
        // остава на земята, докато човечето подскача, и може да изостава
        // при движение.
        const shadow = document.createElement("div");
        shadow.className = "tok-shadow";
        const piece = document.createElement("div");
        piece.className = "tok-piece";
        piece.innerHTML = IE.tokenSvg(p.token, p.gender, p);
        const label = document.createElement("div");
        label.className = "tok-name";
        label.textContent = p.name;          // име под фигурката (безопасно)
        label.title = p.name;
        el.append(shadow, piece, label);
        boardEl.appendChild(el);
        G.tokenEls.set(p.player_id, el);
      }
    }
    // Премахваме фалиралите.
    for (const [pid, el] of G.tokenEls) {
      if (!players.find((p) => p.player_id === pid)) {
        el.remove();
        G.tokenEls.delete(pid);
      }
    }
    // Групираме по позиция, за да не се застъпват.
    const current = state.game.current_player;
    const byPos = {};
    for (const p of players) (byPos[p.position] = byPos[p.position] || []).push(p);
    for (const [posStr, group] of Object.entries(byPos)) {
      group.forEach((p, idx) => {
        const el = G.tokenEls.get(p.player_id);
        placeToken(el, +posStr, idx, group.length);
        el.classList.toggle("is-current", p.player_id === current);
        if (p.player_id !== current) el.style.zIndex = 40 + idx;
        else el.style.zIndex = "";
      });
    }
  };

  G.animateMove = async function animateMove(pid, from, to, steps) {
    const el = G.tokenEls.get(pid);
    if (!el) return;
    const total = BOARD.size;
    const start = Number(from);
    const target = Number(to);
    const signedSteps = Math.trunc(Number(steps) || 0);

    // Ако DOM е останал със стара позиция, връщаме фигурката в началната
    // точка без преход. Така никога не се вижда кратко телепортиране.
    if (Number(el.dataset.pos) !== start) {
      el.classList.add("token-instant");
      placeToken(el, start);
      void el.offsetWidth;
      el.classList.remove("token-instant");
    }

    // Крайната цел се вижда още преди първия подскок.
    G.highlightSpace(target);

    // Посока: при карта „назад" (отрицателни стъпки) се връщаме стъпка по
    // стъпка назад, вместо да обикаляме цялото табло напред.
    const dir = signedSteps < 0 ? -1 : 1;
    let stepCount = Math.abs(signedSteps);
    if (!stepCount && start !== target) {
      stepCount = (target - start + total) % total;
    }
    // Не задържаме екрана за повече от една пълна обиколка, като запазваме
    // правилното крайно поле и при необичайно голяма стойност на steps.
    if (stepCount > total) stepCount = ((stepCount - 1) % total) + 1;

    let cur = start;
    el.classList.add("is-moving");
    for (let step = 0; step < stepCount; step += 1) {
      cur = (cur + dir + total) % total;
      el.classList.remove("jump");
      void el.offsetWidth;
      el.classList.add("jump");

      const isLastStep = step === stepCount - 1;
      if (isLastStep && state.game) {
        const targetGroup = Object.values(state.game.players).filter(
          (p) => !p.bankrupt && !p.is_spectator && Number(p.position) === target
        );
        const targetSlot = targetGroup.findIndex((p) => p.player_id === pid);
        placeToken(el, target, Math.max(0, targetSlot), Math.max(1, targetGroup.length));
      } else {
        placeToken(el, cur);
      }

      IE.sound.move();
      await G.wait(260);
    }
    el.classList.remove("jump", "is-moving");
  };

  G.highlightSpace = function highlightSpace(pos) {
    document.querySelectorAll(".space.active-space").forEach((el) => el.classList.remove("active-space"));
    const el = IE.el(`space-${pos}`);
    if (el) el.classList.add("active-space");
  };

  G.pulseSpace = function pulseSpace(pos) {
    const el = IE.el(`space-${pos}`);
    if (!el) return;
    el.classList.remove("purchase-pulse");
    void el.offsetWidth;
    el.classList.add("purchase-pulse");
    clearTimeout(el._pulseTimer);
    el._pulseTimer = setTimeout(() => el.classList.remove("purchase-pulse"), 520);
  };

  /* ----------------------------------------------------------
     3D зарове: кубчета с 6 стени, които се премятат реалистично.
     Противоположните стени дават сбор 7 като при истински зар.
     ---------------------------------------------------------- */
  const DIE_FACES = [
    { v: 1, t: "translateZ(var(--hd))" },
    { v: 6, t: "rotateY(180deg) translateZ(var(--hd))" },
    { v: 3, t: "rotateY(90deg) translateZ(var(--hd))" },
    { v: 4, t: "rotateY(-90deg) translateZ(var(--hd))" },
    { v: 5, t: "rotateX(90deg) translateZ(var(--hd))" },
    { v: 2, t: "rotateX(-90deg) translateZ(var(--hd))" },
  ];
  // Ротация на куба, при която дадената стойност застава отпред.
  const DIE_ORIENT = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] };
  const diceSpin = { 1: { rx: 0, ry: 0, rz: 0 }, 2: { rx: 0, ry: 0, rz: 0 } };
  let diceRollingUntil = 0;
  let lastDiceViewKey = "";

  (function initDice() {
    for (const n of [1, 2]) {
      const holder = IE.el(`die-${n}`);
      const cube = document.createElement("div");
      cube.className = "cube";
      for (const face of DIE_FACES) {
        const f = document.createElement("div");
        f.className = "face";
        f.dataset.v = face.v;
        f.style.transform = face.t;
        for (let i = 0; i < 9; i++) {
          const pip = document.createElement("span");
          pip.className = "pip";
          f.appendChild(pip);
        }
        cube.appendChild(f);
      }
      holder.appendChild(cube);
    }
  })();

  function dieTransform(rx, ry, rz) {
    return `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
  }

  function normalizedAngle(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function nextDiceAngle(current, target, fullTurns) {
    const currentMod = normalizedAngle(current);
    const targetMod = normalizedAngle(target);
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += 360;
    return current + 360 * Math.max(0, fullTurns - 1) + delta;
  }

  function cancelDieAnimations(holder, cube) {
    for (const animation of holder.getAnimations()) animation.cancel();
    for (const animation of cube.getAnimations()) animation.cancel();
  }

  function setDie(n, value, animate) {
    const holder = IE.el(`die-${n}`);
    const cube = holder.querySelector(".cube");
    const st = diceSpin[n];
    const [tx, ty] = DIE_ORIENT[value] || [0, 0];
    cancelDieAnimations(holder, cube);
    if (animate) {
      const side = n === 1 ? -1 : 1;
      const start = { ...st };
      const turns = 3 + Math.floor(Math.random() * 3);
      const final = {
        rx: nextDiceAngle(st.rx, tx, turns + 1),
        ry: nextDiceAngle(st.ry, ty, turns + (n === 2 ? 2 : 1)),
        rz: nextDiceAngle(st.rz, 0, turns),
      };
      const wobbleX = side * (16 + Math.round(Math.random() * 12));
      const hop = 34 + Math.round(Math.random() * 10);
      const drift = side * (13 + Math.round(Math.random() * 12));

      st.rx = final.rx;
      st.ry = final.ry;
      st.rz = final.rz;
      cube.style.transition = "none";
      cube.style.transform = dieTransform(start.rx, start.ry, start.rz);

      if (cube.animate && holder.animate) {
        const cubeAnimation = cube.animate([
          { transform: dieTransform(start.rx, start.ry, start.rz), offset: 0 },
          { transform: dieTransform(start.rx + 430 + wobbleX, start.ry - 260 * side, start.rz + 185 * side), offset: 0.18 },
          { transform: dieTransform(start.rx + 840, start.ry + 540 * side, start.rz - 280 * side), offset: 0.43 },
          { transform: dieTransform(final.rx - 250, final.ry + 180 * side, final.rz + 95 * side), offset: 0.68 },
          { transform: dieTransform(final.rx + 34 * side, final.ry - 28 * side, final.rz + 16 * side), offset: 0.98 },
          { transform: dieTransform(final.rx, final.ry, final.rz), offset: 1 },
        ], {
          duration: G.DICE_ROLL_MS,
          easing: "cubic-bezier(0.16, 0.78, 0.55, 1)",
          fill: "both",
          delay: n === 2 ? 55 : 0,
        });
        const holderAnimation = holder.animate([
          { transform: "translate3d(0, 0, 0) rotateZ(0deg) scale(1)", offset: 0 },
          { transform: `translate3d(${drift}px, -${hop}px, 18px) rotateZ(${side * 18}deg) scale(1.16)`, offset: 0.18 },
          { transform: `translate3d(${Math.round(drift * 0.9)}px, 5px, 0) rotateZ(${-side * 11}deg) scale(0.94)`, offset: 0.44 },
          { transform: `translate3d(${Math.round(drift * 0.45)}px, -17px, 9px) rotateZ(${side * 7}deg) scale(1.07)`, offset: 0.62 },
          { transform: `translate3d(${Math.round(drift * 0.18)}px, 3px, 0) rotateZ(${-side * 3}deg) scale(0.985)`, offset: 0.80 },
          { transform: "translate3d(0, 0, 0) rotateZ(0deg) scale(1)", offset: 1 },
        ], {
          duration: G.DICE_ROLL_MS,
          easing: "cubic-bezier(0.24, 0.72, 0.52, 1)",
          fill: "both",
          delay: n === 2 ? 55 : 0,
        });
        cubeAnimation.finished.then(() => {
          cube.style.transform = dieTransform(final.rx, final.ry, final.rz);
          cubeAnimation.cancel();
        }).catch(() => {});
        holderAnimation.finished.then(() => {
          holder.style.transform = "";
          holderAnimation.cancel();
        }).catch(() => {});
      } else {
        cube.style.transition = `transform ${G.DICE_ROLL_MS}ms cubic-bezier(0.16, 0.78, 0.24, 1)`;
        cube.style.transform = dieTransform(final.rx, final.ry, final.rz);
      }
    } else {
      st.rx = tx;
      st.ry = ty;
      st.rz = 0;
      cube.style.transition = "none";
      holder.style.transform = "";
      cube.style.transform = dieTransform(st.rx, st.ry, st.rz);
      return;
    }
  }

  G.showDice = function showDice(d1, d2, animate) {
    const diceKey = `${d1}:${d2}`;
    if (!animate) {
      if (performance.now() < diceRollingUntil || diceKey === lastDiceViewKey) return;
      lastDiceViewKey = diceKey;
    } else {
      diceRollingUntil = performance.now() + G.DICE_ROLL_WAIT_MS;
      lastDiceViewKey = diceKey;
    }
    setDie(1, d1, animate);
    setDie(2, d2, animate);
  };

  /* ----------------------------------------------------------
     Централни контроли: клик върху заровете също хвърля.
     Заровете са и клавиатурно достъпни (role=button + Enter/Space).
     ---------------------------------------------------------- */
  IE.el("dice-area").tabIndex = 0;
  IE.el("dice-area").setAttribute("role", "button");
  IE.el("dice-area").setAttribute("aria-label", "Хвърли заровете");
  IE.el("dice-area").addEventListener("click", () => {
    if (IE.el("dice-area").classList.contains("rollable")) {
      socket.emit("roll_dice", {});
    }
  });
  IE.el("dice-area").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    if (IE.el("dice-area").classList.contains("rollable")) {
      socket.emit("roll_dice", {});
    }
  });

  /* ----------------------------------------------------------
     Бързи клавиши: Интервал хвърля заровете или приключва хода
     според текущата фаза.
     ---------------------------------------------------------- */
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.key !== " ") return;
    // Не пречим на писане в полета или на отворени прозорци.
    const tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" ||
        event.target.isContentEditable) return;
    if (document.querySelector(".modal-backdrop:not(.hidden)")) return;
    const g = state.game;
    if (!g || g.winner || state.isSpectator) return;
    if (g.current_player !== state.myId) return;
    const me = g.players[state.myId];
    if (!me || me.bankrupt) return;
    if (g.phase === "WAITING_FOR_ROLL" &&
        IE.el("dice-area").classList.contains("rollable")) {
      event.preventDefault();
      socket.emit("roll_dice", {});
    } else if (g.phase === "MANAGEMENT" && !g.debt) {
      event.preventDefault();
      socket.emit("end_turn", {});
    }
  });
})();
