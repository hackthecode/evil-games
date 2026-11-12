/* ============================================================
   Имоти и Империи — общи помощници: връзка, звук, фигурки
   ============================================================ */
"use strict";

const IE = window.IE || (window.IE = {});

/* ------------------------------------------------------------
   Адреси. Пуснат от собствения си сървър, всичко е на един адрес.
   Статичната версия (GitHub Pages, build_pages.py) задава
   window.IE_CONFIG = { serverUrl, homeUrl, gameUrl }: страниците
   идват от Pages, а сокетът се свързва към отделния сървър.
   ------------------------------------------------------------ */
IE.config = window.IE_CONFIG || {};
IE.urls = {
  home: IE.config.homeUrl || "/",
  game: IE.config.gameUrl || "/game",
};

/* ------------------------------------------------------------
   Локално съхранение
   ------------------------------------------------------------ */
IE.storage = {
  get reconnectToken() { return localStorage.getItem("ie_reconnect_token"); },
  set reconnectToken(v) {
    if (v) localStorage.setItem("ie_reconnect_token", v);
    else localStorage.removeItem("ie_reconnect_token");
  },
  get playerName() { return localStorage.getItem("ie_player_name") || ""; },
  set playerName(v) { localStorage.setItem("ie_player_name", v); },
  get gameSettings() {
    const raw = localStorage.getItem("ie_game_settings");
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
    } catch {
      localStorage.removeItem("ie_game_settings");
      return null;
    }
  },
  set gameSettings(value) {
    if (value && typeof value === "object") {
      localStorage.setItem("ie_game_settings", JSON.stringify(value));
    } else {
      localStorage.removeItem("ie_game_settings");
    }
  },
  get muted() { return localStorage.getItem("ie_muted") === "1"; },
  set muted(v) { localStorage.setItem("ie_muted", v ? "1" : "0"); },
  /* Сила на звука 0..1, лична за всеки играч (пази се в неговия браузър). */
  get volume() {
    const raw = parseFloat(localStorage.getItem("ie_volume"));
    if (!Number.isFinite(raw)) return 0.7;
    return Math.min(1, Math.max(0, raw));
  },
  set volume(v) {
    const value = Math.min(1, Math.max(0, Number(v) || 0));
    localStorage.setItem("ie_volume", String(value));
  },
  /* Сила по вид звук: {ключ: 0..1}. Множи се с общата сила. Липсващ
     ключ означава 1 (без промяна), затова празният обект е валиден. */
  get soundLevels() {
    try {
      const raw = JSON.parse(localStorage.getItem("ie_sound_levels") || "{}");
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch {
      localStorage.removeItem("ie_sound_levels");
      return {};
    }
  },
  set soundLevels(value) {
    if (value && typeof value === "object") {
      localStorage.setItem("ie_sound_levels", JSON.stringify(value));
    } else {
      localStorage.removeItem("ie_sound_levels");
    }
  },
  /* Системно известие при твой ред (изисква и разрешение от браузъра).
     Мигането на заглавието и точката върху иконата не зависят от това. */
  get turnNotify() { return localStorage.getItem("ie_turn_notify") === "1"; },
  set turnNotify(v) { localStorage.setItem("ie_turn_notify", v ? "1" : "0"); },
};

/* ------------------------------------------------------------
   Известие в таба — заглавие, иконка и системно съобщение

   При игра в мрежа ходът идва, докато гледаш друг таб: 60-те секунди
   изтичат и ходът се пропуска, без нищо да е трепнало. Затова заглавието
   на таба мига, а върху иконката застава червена точка — и двете работят
   без разрешение от браузъра. Системното известие е отделно, зад бутон.
   ------------------------------------------------------------ */
IE.tabAlert = (function () {
  const BASE_TITLE = document.title;
  const BLINK_MS = 1100;
  let timer = null;
  let flipped = false;
  let message = "";
  // Иконата с точката се композира веднъж — файлът е половин мегабайт и
  // пресмятането му при всяко примигване би било чиста загуба.
  let dottedIcon = null;
  let dottedPending = false;

  function iconLink() {
    return document.querySelector('link[rel="icon"]');
  }

  function buildDottedIcon() {
    if (dottedIcon || dottedPending) return;
    const link = iconLink();
    if (!link || !link.href) return;
    dottedPending = true;
    const img = new Image();
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        ctx.beginPath();
        ctx.arc(size * 0.72, size * 0.72, size * 0.26, 0, Math.PI * 2);
        ctx.fillStyle = "#d94436";
        ctx.fill();
        ctx.lineWidth = size * 0.07;
        ctx.strokeStyle = "#fff7e6";
        ctx.stroke();
        dottedIcon = canvas.toDataURL("image/png");
        if (timer) applyIcon(flipped);
      } catch {
        dottedIcon = null; // рисуването се провали — оставаме само със заглавието
      }
      dottedPending = false;
    };
    img.onerror = () => { dottedPending = false; };
    img.src = link.href;
  }

  function applyIcon(on) {
    const link = iconLink();
    if (!link || !dottedIcon) return;
    if (on) {
      if (!link.dataset.ieOriginal) link.dataset.ieOriginal = link.href;
      link.href = dottedIcon;
    } else if (link.dataset.ieOriginal) {
      link.href = link.dataset.ieOriginal;
    }
  }

  function tick() {
    flipped = !flipped;
    document.title = flipped ? message : BASE_TITLE;
    applyIcon(flipped);
  }

  return {
    /* Започва мигането. Повторното извикване със същия текст не рестартира. */
    start(text) {
      const next = text || "(!) Твой ред";
      if (timer && message === next) return;
      message = next;
      buildDottedIcon();
      if (timer) return;
      flipped = false;
      tick();
      timer = setInterval(tick, BLINK_MS);
    },
    /* Спира и връща заглавието и иконата в първоначалния им вид. */
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      flipped = false;
      document.title = BASE_TITLE;
      applyIcon(false);
    },
    get active() { return timer !== null; },

    /* Системно известие — само с разрешение и само при скрит таб. */
    notify(title, body) {
      if (!("Notification" in window)) return false;
      if (!IE.storage.turnNotify || Notification.permission !== "granted") return false;
      if (!document.hidden) return false;
      try {
        const note = new Notification(title, { body, tag: "ie-turn", renotify: false });
        note.onclick = () => {
          window.focus();
          note.close();
        };
        return true;
      } catch {
        return false;
      }
    },

    /* Включва/изключва системните известия; при включване иска разрешение.
       Връща промис с новото състояние (true = включени и разрешени). */
    async toggleNotify() {
      if (IE.storage.turnNotify) {
        IE.storage.turnNotify = false;
        return false;
      }
      if (!("Notification" in window)) return false;
      let permission = Notification.permission;
      if (permission === "default") {
        try {
          permission = await Notification.requestPermission();
        } catch {
          permission = "denied";
        }
      }
      if (permission !== "granted") return false;
      IE.storage.turnNotify = true;
      return true;
    },

    get notifySupported() { return "Notification" in window; },
    get notifyBlocked() {
      return "Notification" in window && Notification.permission === "denied";
    },
  };
})();

// Забравено мигане при затваряне/навигация би оставило подменена иконка
// в кеша на таба.
window.addEventListener("pagehide", () => IE.tabAlert.stop());

/* ------------------------------------------------------------
   Socket.IO връзка
   ------------------------------------------------------------ */
IE.monitorConnection = function (socket) {
  if (socket._ieConnectionMonitor) return;
  const indicators = [...document.querySelectorAll(".connection-indicator")];
  if (!indicators.length) return;
  socket._ieConnectionMonitor = true;

  function render(kind, label, title = label) {
    indicators.forEach((indicator) => {
      indicator.classList.remove(
        "is-good", "is-delayed", "is-offline", "is-connecting",
      );
      indicator.classList.add(`is-${kind}`);
      const text = indicator.querySelector(".connection-label");
      if (text) text.textContent = label;
      indicator.title = title;
    });
  }

  function measure() {
    if (!socket.connected) {
      render("offline", "Няма връзка", "Връзката със сървъра е прекъсната");
      return;
    }
    const started = performance.now();
    socket.timeout(4500).emit("connection_probe", {}, (error) => {
      if (error) {
        render(
          "delayed", "Силно забавяне",
          "Сървърът не отговори навреме; действията може да се забавят",
        );
        return;
      }
      const rtt = Math.max(1, Math.round(performance.now() - started));
      if (rtt < 250) {
        render("good", `Добра връзка · ${rtt} ms`, `Закъснение до сървъра: ${rtt} ms`);
      } else if (rtt < 800) {
        render("delayed", `Забавяне · ${rtt} ms`, `Повишено закъснение до сървъра: ${rtt} ms`);
      } else {
        render("delayed", `Силно забавяне · ${rtt} ms`, `Високо закъснение до сървъра: ${rtt} ms`);
      }
    });
  }

  socket.on("connect", () => {
    render("connecting", "Проверка на връзката…");
    measure();
  });
  socket.on("disconnect", () => {
    render("offline", "Връзката е прекъсната", "Изчаква се повторно свързване");
  });
  socket.io.on("reconnect_attempt", () => {
    render("connecting", "Повторно свързване…");
  });
  socket.io.on("reconnect", () => {
    render("connecting", "Връзката е възстановена…");
    measure();
  });
  window.addEventListener("offline", () => render("offline", "Няма интернет"));
  window.addEventListener("online", () => {
    render("connecting", "Повторно свързване…");
    measure();
  });
  const timer = window.setInterval(measure, 5000);
  window.addEventListener("pagehide", () => window.clearInterval(timer), { once: true });
  if (socket.connected) measure();
  else render("connecting", "Свързване…");
};

IE.connect = function () {
  if (IE.socket) return IE.socket;
  const options = { transports: ["websocket", "polling"] };
  IE.socket = IE.config.serverUrl ? io(IE.config.serverUrl, options) : io(options);
  // Безплатният хостинг приспива сървъра без посетители; събуждането
  // отнема до минута и без обяснение изглежда като счупена страница.
  if (IE.config.serverUrl) {
    window.setTimeout(() => {
      if (!IE.socket.connected) {
        IE.toast("Сървърът се събужда — това може да отнеме до минута…", "info", 8000);
      }
    }, 4000);
  }
  IE.socket.on("error_message", (data) => {
    IE.toast((data && data.message) || "Възникна грешка.", "error");
  });
  IE.monitorConnection(IE.socket);
  return IE.socket;
};

/* ------------------------------------------------------------
   Тостове
   ------------------------------------------------------------ */
IE.toast = function (message, kind = "info", ms = 3200) {
  let area = document.getElementById("toast-area");
  if (!area) {
    area = document.createElement("div");
    area.id = "toast-area";
    document.body.appendChild(area);
  }
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = message;
  area.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.35s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 380);
  }, ms);
};

/* ------------------------------------------------------------
   Помощни
   ------------------------------------------------------------ */
IE.fmt = (n) => `${Number(n).toLocaleString("bg-BG")} €`;
IE.el = (id) => document.getElementById(id);

IE.escapeHtml = function (text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
};

/* ------------------------------------------------------------
   Анимирани човешки фигурки с избираеми цвят и пол
   ------------------------------------------------------------ */
IE.TOKENS = {
  red: { name: "Червено", color: "#df3f45", shade: "#9f252b" },
  black: { name: "Черно", color: "#171b22", shade: "#07090d" },
  green: { name: "Зелено", color: "#2faa64", shade: "#197342" },
  pink: { name: "Розово", color: "#e65b9b", shade: "#a93369" },
  yellow: { name: "Жълто", color: "#f0c431", shade: "#ad8212" },
  blue: { name: "Синьо", color: "#3476df", shade: "#1c4d9f" },
  white: { name: "Бяло", color: "#f3f4f2", shade: "#aeb5bd" },
  orange: { name: "Оранжево", color: "#ef7a32", shade: "#a94718" },
  purple: { name: "Лилаво", color: "#8d5bd6", shade: "#59339a" },
  turquoise: { name: "Тюркоазено", color: "#25b9bd", shade: "#13777b" },
  brown: { name: "Кафяво", color: "#98603d", shade: "#60371f" },
  silver: { name: "Сребристо", color: "#a8b3c2", shade: "#687586" },
};

IE.LEGACY_TOKEN_COLORS = {
  owl: "red", fox: "black", bulb: "yellow", ship: "blue", mountain: "green",
  solar: "pink", gear: "white", backpack: "red", tractor: "green", rocket: "blue",
};

/* Външност на човечето — независима от цвета на фигурката. Цветът остава
   идентичността на играча (уникален в стаята), външността е лична украса,
   затова двама играча може да си приличат. Идентификаторите тук трябва да
   съвпадат с ALLOWED_SKINS / ALLOWED_HAIR_COLORS / ALLOWED_HAIRSTYLES
   в security.py — сървърът пуска само тях. */
IE.SKINS = {
  light: { name: "Светла", color: "#f7dcc4", shade: "#d7ab8a" },
  fair: { name: "Бежова", color: "#e8b58d", shade: "#bd7e5d" },
  tan: { name: "Загоряла", color: "#d59a68", shade: "#a86c42" },
  olive: { name: "Маслинена", color: "#bd8452", shade: "#8c5c31" },
  brown: { name: "Кафява", color: "#93603c", shade: "#684026" },
  dark: { name: "Тъмна", color: "#68432a", shade: "#432a19" },
};

IE.HAIR_COLORS = {
  black: { name: "Черна", color: "#221a17", shade: "#0d0908" },
  brown: { name: "Кестенява", color: "#4d3222", shade: "#2c1c13" },
  blond: { name: "Руса", color: "#dcae56", shade: "#a87f31" },
  ginger: { name: "Червена", color: "#ab4a21", shade: "#763012" },
  gray: { name: "Прошарена", color: "#9aa2aa", shade: "#6b737b" },
  white: { name: "Бяла", color: "#eae7e0", shade: "#b2afa7" },
};

IE.HAIRSTYLES = {
  short: { name: "Къса" },
  long: { name: "Дълга" },
  bun: { name: "Кок" },
  curly: { name: "Къдрава" },
  bald: { name: "Без коса" },
};

IE.DEFAULT_APPEARANCE = { skin: "fair", hair: "brown", hairstyle: "short" };

/* Изважда външността от член на лобито или играч, като пази стойностите
   в позволените — така стар запис или клиент от друга версия не чупи SVG-то. */
IE.appearanceOf = function (source) {
  const src = source || {};
  return {
    skin: IE.SKINS[src.skin] ? src.skin : IE.DEFAULT_APPEARANCE.skin,
    hair: IE.HAIR_COLORS[src.hair] ? src.hair : IE.DEFAULT_APPEARANCE.hair,
    hairstyle: IE.HAIRSTYLES[src.hairstyle] ? src.hairstyle : IE.DEFAULT_APPEARANCE.hairstyle,
  };
};

IE.tokenDefinition = function (tokenId) {
  const normalized = IE.TOKENS[tokenId] ? tokenId : IE.LEGACY_TOKEN_COLORS[tokenId];
  return IE.TOKENS[normalized] || IE.TOKENS.red;
};

/* Косата се рисува на два слоя: `back` минава ЗАД главата (дължина, кок),
   `front` — отгоре ѝ (бретон, къдри). Затова всеки стил връща двойката,
   а не един път: иначе дългата коса би закрила лицето. */
function hairLayers(gender, style, hair) {
  const def = IE.HAIR_COLORS[hair] || IE.HAIR_COLORS.brown;
  // Тънък контур — иначе бялата и русата коса се губят върху светло табло.
  const paint = `fill="${def.color}" stroke="${def.shade}" stroke-width=".5" stroke-linejoin="round"`;
  if (style === "bald") return { back: "", front: "" };
  if (gender === "female") {
    const bangs = `<path d="M11.5 7.1c.2-4 2.2-5.6 4.6-5.6 3 0 4.7 2.2 4.6 5.7-2.6-.3-4.4-1.4-5.7-3.1-.6 1.5-1.7 2.5-3.5 3z" ${paint}/>`;
    if (style === "long") {
      return {
        back: `<path d="M9.8 8.3c0-5.2 2.7-7.6 6.2-7.6s6.2 2.4 6.2 7.6v6.1l-3.1-1.2V7.8h-6.2v5.4l-3.1 1.2z" ${paint}/>`,
        front: bangs,
      };
    }
    if (style === "short") {
      return {
        back: `<path d="M10.5 8.1c0-4.9 2.4-7 5.5-7s5.5 2.1 5.5 7v3.7l-2.7 1V7.6h-5.6v5.2l-2.7-1z" ${paint}/>`,
        front: bangs,
      };
    }
    if (style === "bun") {
      // Кокът трябва да стърчи ясно над темето (y≈3.15) — иначе при
      // размера на фигурката върху таблото се чете като „без коса".
      return {
        back: `<circle cx="16" cy="2.3" r="2.9" ${paint}/>`,
        front: `<path d="M11.5 7.4c0-4.2 2-6 4.5-6s4.5 1.8 4.5 6c-1-2.9-2.5-4-4.5-4s-3.5 1.1-4.5 4z" ${paint}/>`,
      };
    }
    return {  // curly
      back: `<circle cx="10.7" cy="9.5" r="2.3" ${paint}/><circle cx="21.3" cy="9.5" r="2.3" ${paint}/>`,
      front: `<circle cx="11.9" cy="5.3" r="2.3" ${paint}/><circle cx="14.5" cy="3.2" r="2.5" ${paint}/>`
        + `<circle cx="17.6" cy="3.2" r="2.5" ${paint}/><circle cx="20.2" cy="5.3" r="2.3" ${paint}/>`
        + `<circle cx="11.3" cy="7.7" r="1.9" ${paint}/><circle cx="20.8" cy="7.7" r="1.9" ${paint}/>`,
    };
  }
  const crop = `<path d="M11.5 6.8c.1-3.5 1.7-5.2 4.8-5.2 2.8 0 4.3 1.7 4.4 4.7-2.2-.2-4.1-1-5.5-2.2-.8 1.4-2 2.3-3.7 2.7z" ${paint}/>`;
  if (style === "long") {
    return {
      back: `<path d="M10.7 7.5c0-5 2.3-7.1 5.3-7.1s5.3 2.1 5.3 7.1v6.5l-2.6-1V7h-5.4v6l-2.6 1z" ${paint}/>`,
      front: crop,
    };
  }
  if (style === "bun") {
    return {
      back: `<circle cx="16" cy="2.2" r="2.75" ${paint}/>`,
      front: `<path d="M11.4 7.2c0-4 1.9-5.8 4.6-5.8s4.6 1.8 4.6 5.8c-1-2.8-2.5-3.9-4.6-3.9s-3.6 1.1-4.6 3.9z" ${paint}/>`,
    };
  }
  if (style === "curly") {
    return {
      back: "",
      front: `<circle cx="12.1" cy="5.4" r="2.1" ${paint}/><circle cx="14.6" cy="3.5" r="2.3" ${paint}/>`
        + `<circle cx="17.5" cy="3.5" r="2.3" ${paint}/><circle cx="19.9" cy="5.4" r="2.1" ${paint}/>`
        + `<circle cx="11.6" cy="7.5" r="1.6" ${paint}/><circle cx="20.4" cy="7.5" r="1.6" ${paint}/>`,
    };
  }
  return { back: "", front: crop };  // short
}

IE.tokenSvg = function (tokenId, gender = "male", appearance = null) {
  const token = IE.tokenDefinition(tokenId);
  const color = token.color;
  const shade = token.shade;
  const look = IE.appearanceOf(appearance);
  const skinDef = IE.SKINS[look.skin];
  const skin = skinDef.color;
  const skinShade = skinDef.shade;
  const outline = "#111820";
  const hair = hairLayers(gender, look.hairstyle, look.hair);
  if (gender === "female") {
    return `<svg class="person-token gender-female" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <ellipse cx="16" cy="30" rx="8.8" ry="1.5" fill="#02060c" opacity=".34"/>
      <g class="avatar-figure">
        <g class="avatar-leg avatar-leg-left"><path d="M11.2 22.3h4l-.9 6.4H9.9z" fill="${shade}" stroke="${outline}" stroke-width=".75"/><path d="M9.5 28h5.1v2H8.8c-.7 0-.8-1.3.7-2z" fill="${outline}"/></g>
        <g class="avatar-leg avatar-leg-right"><path d="M16.8 22.3h4l1.3 6.4h-4.4z" fill="${shade}" stroke="${outline}" stroke-width=".75"/><path d="M17.4 28h5.1c1.5.7 1.4 2 .7 2h-5.8z" fill="${outline}"/></g>
        <g class="avatar-arm avatar-arm-left"><path d="M10.8 13.4 7 20.7" stroke="${color}" stroke-width="3.3" stroke-linecap="round"/><circle cx="6.8" cy="21.5" r="1.45" fill="${skin}" stroke="${outline}" stroke-width=".65"/></g>
        <g class="avatar-arm avatar-arm-right"><path d="m21.2 13.4 3.8 7.3" stroke="${color}" stroke-width="3.3" stroke-linecap="round"/><circle cx="25.2" cy="21.5" r="1.45" fill="${skin}" stroke="${outline}" stroke-width=".65"/></g>
        <path d="M12.1 12.2h7.8l.7 5 3.3 7.4H8.1l3.3-7.4z" fill="${color}" stroke="${outline}" stroke-width=".9" stroke-linejoin="round"/>
        <path d="M11.4 17.2h9.2" stroke="${shade}" stroke-width="1.15"/>
        <path d="m13.4 12.2 2.6 3.2 2.6-3.2" fill="#fff" opacity=".92"/>
        ${hair.back}
        <circle cx="16" cy="7.7" r="4.55" fill="${skin}" stroke="${outline}" stroke-width=".75"/>
        ${hair.front}
        <path d="m13.4 7.6 1.3.2m2.5 0 1.3-.2" stroke="${outline}" stroke-width=".65" stroke-linecap="round"/>
        <circle cx="14.4" cy="7.9" r=".45" fill="${outline}"/><circle cx="17.8" cy="7.9" r=".45" fill="${outline}"/>
        <path d="M14.6 10.1c.8.65 2 .65 2.8 0" stroke="${skinShade}" stroke-width=".65" stroke-linecap="round"/>
      </g>
      <g class="gender-marker"><circle cx="27" cy="5" r="4.1" fill="#c02678" stroke="#fff" stroke-width=".8"/><text x="27" y="7.35" fill="#fff" font-family="Arial,sans-serif" font-size="7" font-weight="700" text-anchor="middle">♀</text></g>
    </svg>`;
  }
  return `<svg class="person-token gender-male" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <ellipse cx="16" cy="30" rx="8.8" ry="1.5" fill="#02060c" opacity=".34"/>
    <g class="avatar-figure">
      <g class="avatar-leg avatar-leg-left"><path d="M10.8 20.2h4.8l-1.2 8.5H9.8z" fill="${shade}" stroke="${outline}" stroke-width=".75"/><path d="M9.4 28h5.3v2H8.8c-.7 0-.8-1.3.6-2z" fill="${outline}"/></g>
      <g class="avatar-leg avatar-leg-right"><path d="M16.4 20.2h4.8l1 8.5h-4.6z" fill="${shade}" stroke="${outline}" stroke-width=".75"/><path d="M17.3 28h5.3c1.4.7 1.3 2 .6 2h-5.9z" fill="${outline}"/></g>
      <g class="avatar-arm avatar-arm-left"><path d="M10.8 13.4 7.2 21" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/><circle cx="6.9" cy="21.7" r="1.45" fill="${skin}" stroke="${outline}" stroke-width=".65"/></g>
      <g class="avatar-arm avatar-arm-right"><path d="m21.2 13.4 3.6 7.6" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/><circle cx="25.1" cy="21.7" r="1.45" fill="${skin}" stroke="${outline}" stroke-width=".65"/></g>
      <path d="M9.4 12.6 13 11.5h6l3.6 1.1-.4 9H9.8z" fill="${color}" stroke="${outline}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="m13.2 12.1 2.8 3.1 2.8-3.1" fill="#fff" opacity=".9"/><path d="m16 15.2-1 4.1 1 1.2 1-1.2z" fill="${shade}"/>
      ${hair.back}
      <circle cx="16" cy="7.5" r="4.65" fill="${skin}" stroke="${outline}" stroke-width=".75"/>
      ${hair.front}
      <circle cx="14.4" cy="7.7" r=".45" fill="${outline}"/><circle cx="17.8" cy="7.7" r=".45" fill="${outline}"/>
      <path d="M13.8 9.5c.7.25 1.4.25 2.2 0 .8.25 1.5.25 2.2 0-.3 1.2-1 1.7-2.2 1.7s-1.9-.5-2.2-1.7z" fill="#704735" opacity=".82"/>
    </g>
    <g class="gender-marker"><circle cx="27" cy="5" r="4.1" fill="#1976c9" stroke="#fff" stroke-width=".8"/><text x="27" y="7.35" fill="#fff" font-family="Arial,sans-serif" font-size="7" font-weight="700" text-anchor="middle">♂</text></g>
  </svg>`;
};
/* Само главата — за избора на прическа в лобито, където цялото човече
   би било твърде дребно, за да се различат стиловете. viewBox-ът е
   изрязан около главата, но оставя място за кока и дългата коса. */
IE.headSvg = function (gender, appearance = null) {
  const look = IE.appearanceOf(appearance);
  const skin = IE.SKINS[look.skin].color;
  const outline = "#111820";
  const hair = hairLayers(gender, look.hairstyle, look.hair);
  const cy = gender === "female" ? 7.7 : 7.5;
  const r = gender === "female" ? 4.55 : 4.65;
  return `<svg class="head-preview" viewBox="7 -1.4 18 16" fill="none" aria-hidden="true">
    ${hair.back}
    <circle cx="16" cy="${cy}" r="${r}" fill="${skin}" stroke="${outline}" stroke-width=".75"/>
    ${hair.front}
    <circle cx="14.4" cy="${cy + 0.2}" r=".45" fill="${outline}"/>
    <circle cx="17.8" cy="${cy + 0.2}" r=".45" fill="${outline}"/>
  </svg>`;
};

IE.tokenColor = function (tokenId) {
  return IE.tokenDefinition(tokenId).color;
};
IE.tokenName = function (tokenId) {
  return IE.tokenDefinition(tokenId).name;
};

/* ------------------------------------------------------------
   Икони на полетата — дуотон SVG глифи вместо цветните емоджи
   ------------------------------------------------------------
   Емоджито беше единственото на дъската, което не следваше
   пергамент/мед/златния език. Тук всяка икона е прост силует в
   две мастила: тъмно (структура) + мед (акцент), четлив и при 14px.
   Ключът е емоджито от board_config.json, но БЕЗ вариационния селектор
   U+FE0F (⚖️ и ✈️ го носят) — иначе търсенето тихо не съвпада. */
const GLYPH_INK = "#2b3648";
const GLYPH_COPPER = "#c07430";
IE.SPACE_GLYPHS = {
  // --- Транспорт ---
  "⚓": `<circle cx="12" cy="4.3" r="2.5" fill="none" stroke="${GLYPH_COPPER}" stroke-width="2.2"/>
    <path d="M12 6.6V21" stroke="${GLYPH_INK}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M7.6 10.4h8.8" stroke="${GLYPH_INK}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M4 13.4c0 5.2 3.7 7.4 8 7.4s8-2.2 8-7.4" fill="none" stroke="${GLYPH_INK}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M4 13.4 1.9 14.7M4 13.4l2.2 1M20 13.4l2.1 1.3M20 13.4l-2.2 1" stroke="${GLYPH_INK}" stroke-width="1.9" stroke-linecap="round"/>`,
  "🚂": `<rect x="3" y="8" width="12.5" height="7.5" rx="1.4" fill="${GLYPH_INK}"/>
    <rect x="13.5" y="4.8" width="5.5" height="10.7" rx="1.2" fill="${GLYPH_INK}"/>
    <rect x="5.6" y="4.6" width="2.6" height="3.8" rx=".5" fill="${GLYPH_COPPER}"/>
    <circle cx="9.6" cy="11.4" r="1.6" fill="${GLYPH_COPPER}"/>
    <circle cx="7" cy="18" r="2.1" fill="${GLYPH_INK}"/><circle cx="15.5" cy="18" r="2.1" fill="${GLYPH_INK}"/>
    <circle cx="7" cy="18" r=".8" fill="${GLYPH_COPPER}"/><circle cx="15.5" cy="18" r=".8" fill="${GLYPH_COPPER}"/>`,
  "✈": `<path d="M12 2.5c-.9 0-1.5 1.1-1.5 3.2v3.1L2.5 13v2.1l8-2.3v3.9L8.2 18v1.6L12 18.6l3.8 1v-1.6l-2.3-1.4v-3.9l8 2.3V13l-8-4.2V5.7c0-2.1-.6-3.2-1.5-3.2z" fill="${GLYPH_COPPER}" stroke="${GLYPH_INK}" stroke-width="1.1" stroke-linejoin="round"/>`,
  "🌉": `<path d="M2.5 17.5h19" stroke="${GLYPH_INK}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M6 17.5V6M18 17.5V6" stroke="${GLYPH_INK}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M6 6c2.5 5 9.5 5 12 0" fill="none" stroke="${GLYPH_COPPER}" stroke-width="2" stroke-linecap="round"/>
    <path d="M9 8.6v4.4M12 9.6v3.4M15 8.6v4.4" stroke="${GLYPH_INK}" stroke-width="1.4"/>`,
  // --- Комунални ---
  "⚡": `<path d="M13.4 2 5.5 13.2h5.1l-1.6 8.8L18.5 10h-5.7z" fill="${GLYPH_COPPER}" stroke="${GLYPH_INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
  "💧": `<path d="M12 3.2c-.4 3.8-5.4 7.6-5.4 11.6a5.4 5.4 0 0 0 10.8 0c0-4-5-7.8-5.4-11.6z" fill="${GLYPH_COPPER}" stroke="${GLYPH_INK}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M9.4 14.8a2.6 2.6 0 0 0 2 2.9" fill="none" stroke="#f6ecd8" stroke-width="1.5" stroke-linecap="round"/>`,
  // --- Данък ---
  "💰": `<circle cx="12" cy="12" r="8.3" fill="${GLYPH_COPPER}" stroke="${GLYPH_INK}" stroke-width="1.6"/>
    <path d="M15 8.6a4.2 4.2 0 1 0 0 6.8" fill="none" stroke="${GLYPH_INK}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M7.4 11h6.2M7.4 13.4h6.2" stroke="${GLYPH_INK}" stroke-width="1.8" stroke-linecap="round"/>`,
  // --- Карти ---
  "❓": `<path d="M8.8 9.3c0-2.2 1.5-3.6 3.3-3.6s3.3 1.3 3.3 3.1c0 2.4-3 2.6-3 5" fill="none" stroke="${GLYPH_COPPER}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="12" cy="18.4" r="1.6" fill="${GLYPH_COPPER}"/>`,
  "💼": `<rect x="3.5" y="8" width="17" height="11.5" rx="1.6" fill="${GLYPH_INK}"/>
    <path d="M9 8V6.6A1.6 1.6 0 0 1 10.6 5h2.8A1.6 1.6 0 0 1 15 6.6V8" fill="none" stroke="${GLYPH_INK}" stroke-width="2"/>
    <rect x="3.5" y="12.2" width="17" height="2.2" fill="${GLYPH_COPPER}"/>
    <rect x="10.4" y="11.2" width="3.2" height="4" rx=".6" fill="${GLYPH_COPPER}"/>`,
  // --- Ъгли ---
  "🚩": `<path d="M6 2.4V21.6" stroke="${GLYPH_INK}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M6.9 3.1h11.4l-2.8 3.6 2.8 3.6H6.9z" fill="${GLYPH_COPPER}" stroke="${GLYPH_INK}" stroke-width="1.3" stroke-linejoin="round"/>`,
  "🌳": `<path d="M12 4C6.8 4 3.1 7.4 2.7 11.2c-.05.42.34.66.7.42C4.6 10.9 5.8 10.7 7 11.1c1-.5 2.2-.6 3.3.05 1-.7 2.4-.7 3.4 0 1.1-.65 2.3-.55 3.3-.05 1.2.4 2.4.2 3.6-.52.36-.24.75 0 .7-.42C20.9 7.4 17.2 4 12 4z" fill="${GLYPH_COPPER}" stroke="${GLYPH_INK}" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M12 11.2V20" stroke="${GLYPH_INK}" stroke-width="2.1" stroke-linecap="round"/>
    <path d="M12 20c0-1.4 1.3-1.7 2.1-1.2" fill="none" stroke="${GLYPH_INK}" stroke-width="1.6" stroke-linecap="round"/>`,
  "⚖": `<path d="M12 4.6V20" stroke="${GLYPH_INK}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M4.8 7.5h14.4" stroke="${GLYPH_INK}" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="12" cy="4.6" r="1.5" fill="${GLYPH_COPPER}"/>
    <path d="M8.5 20h7" stroke="${GLYPH_INK}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M4.8 7.5 2.4 12.8h4.8zM19.2 7.5l-2.4 5.3h4.8z" fill="none" stroke="${GLYPH_COPPER}" stroke-width="1.8" stroke-linejoin="round"/>`,
  "🚨": `<path d="M6.5 15a5.5 5.5 0 0 1 11 0z" fill="${GLYPH_COPPER}" stroke="${GLYPH_INK}" stroke-width="1.4" stroke-linejoin="round"/>
    <rect x="5" y="15" width="14" height="2.8" rx=".8" fill="${GLYPH_INK}"/>
    <path d="M12 3.2v2.6M4.6 6.4l1.8 1.9M19.4 6.4l-1.8 1.9" stroke="${GLYPH_COPPER}" stroke-width="2" stroke-linecap="round"/>`,
};
IE.spaceIconSvg = function (raw) {
  if (!raw) return "";
  const key = String(raw).replace(/️/g, ""); // маха вариационния селектор
  const inner = IE.SPACE_GLYPHS[key];
  if (!inner) return raw; // непозната икона → връщаме емоджито (без изненади)
  return `<svg class="sp-glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true">${inner}</svg>`;
};

/* ------------------------------------------------------------
   Емблеми на осемте цветови групи

   Досега групите се различаваха единствено по нюанса на лентата — трудно
   от разстояние и невъзможно при далтонизъм. Всяка група получава по един
   знак за темата си.

   Ключът е ИДЕНТИФИКАТОРЪТ на групата от board_config.json, не емоджи:
   така не се повтаря капанът с вариационния селектор U+FE0F при иконите
   на полетата. Мастилото идва отвън (`currentColor`), защото лентата е ту
   светла, ту тъмна.
   ------------------------------------------------------------ */
IE.GROUP_EMBLEMS = {
  // Западни балнео курорти — вана с топла вода и пара.
  star_centar: `<path d="M3.2 12.6h17.6v2.1a4.6 4.6 0 0 1-4.6 4.6H7.8a4.6 4.6 0 0 1-4.6-4.6z"/>
    <path d="M6.4 12.6V6.9a2.1 2.1 0 0 1 4.2 0"/>
    <path d="M12.6 4.4c-.9 1.1-.9 2 0 3.1s.9 2 0 3.1M16.4 4.4c-.9 1.1-.9 2 0 3.1s.9 2 0 3.1"/>`,
  // Природни курорти — лист с жилка.
  krairechen: `<path d="M19.6 4.4c-8 .3-13.4 3.5-13.4 9.2 0 2.4 1.2 4.4 2.8 5.6 4.6-1 10.6-5.8 10.6-14.8z"/>
    <path d="M17.4 6.6C12.2 8.9 9 12.9 7.2 19.6"/>`,
  // Минерални курорти — чучур с капка.
  kulturen: `<path d="M4.4 6.2h6.2v3.4H4.4z"/>
    <path d="M10.6 7.9h5.2a2.2 2.2 0 0 1 2.2 2.2v2.3"/>
    <path d="M18 20.2a2.7 2.7 0 0 1-2.7-2.7c0-1.7 2.7-4.3 2.7-4.3s2.7 2.6 2.7 4.3a2.7 2.7 0 0 1-2.7 2.7z"/>
    <path d="M4.4 12.2h6.2"/>`,
  // Слънчеви курорти — слънце с лъчи.
  targovski: `<circle cx="12" cy="12" r="4.4"/>
    <path d="M12 2.6v2.4M12 19v2.4M2.6 12H5M19 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7"/>`,
  // Южно Черноморие — вълни и чайка над тях.
  tehno: `<path d="M2.6 15.4c1.9 0 1.9 1.9 3.8 1.9s1.9-1.9 3.8-1.9 1.9 1.9 3.8 1.9 1.9-1.9 3.8-1.9 1.9 1.9 3.8 1.9"/>
    <path d="M2.6 19.6c1.9 0 1.9 1.9 3.8 1.9s1.9-1.9 3.8-1.9 1.9 1.9 3.8 1.9 1.9-1.9 3.8-1.9 1.9 1.9 3.8 1.9"/>
    <path d="M6.6 8.4c2-2.6 3.6-2.6 5.4 0 1.8-2.6 3.4-2.6 5.4 0"/>`,
  // Морски курорти — плажен чадър.
  energien: `<path d="M12 5.1v14.6"/>
    <path d="M3.6 11.4a8.4 8.4 0 0 1 16.8 0z"/>
    <path d="M12 19.7c1.7 0 2.4-.9 2.4-2.2"/>`,
  // Планински курорти — двоен връх със сняг.
  kurort: `<path d="M2.4 19.4 9.3 6.8l4.1 7.1 2.1-3.2 6.1 8.7z"/>
    <path d="M6.7 11.6c1.4.9 2.8.9 4.2 0M18 14.4c-1 .8-2.1.8-3.1 0"/>`,
  // Луксозни курорти — корона с камъни по върховете (без тях знакът се
  // чете като зигзаг при размера на лентата).
  elit: `<path d="M3.4 8.2 7 13.4l5-7.2 5 7.2 3.6-5.2v8.6H3.4z"/>
    <path d="M3.4 19.8h17.2"/>
    <circle cx="3.4" cy="8.2" r="1.1"/><circle cx="12" cy="6.2" r="1.1"/><circle cx="20.6" cy="8.2" r="1.1"/>`,
};

/* Останалите видове полета — техните ленти също бяха само цвят и щриховка.
   Ключовете идват от типа на полето, а за картите — от `deck` в
   board_config.json (стабилно поле, за разлика от емоджито в `icon`).
   Двете тестета нарочно получават различен знак: така се вижда кое поле
   към кое тесте води, без да се чете надписът. */
Object.assign(IE.GROUP_EMBLEMS, {
  // Транспорт — маршрут между два пункта.
  transport: `<circle cx="5.4" cy="18.6" r="2.4"/><circle cx="18.6" cy="5.4" r="2.4"/>
    <path d="M7.8 16.2c0-3 1.4-4.5 4.2-4.5s4.2-1.5 4.2-4.5"/>
    <path d="M12.6 11.7h-2.4M12.6 11.7v2.4"/>`,
  // Комунални предприятия — брояч с стрелка.
  utility: `<circle cx="12" cy="12" r="8.4"/>
    <path d="M12 12 8.4 8.4"/>
    <path d="M4.6 9.6h2M19.4 9.6h-2M12 3.6v2"/>`,
  // Обществено събитие — въпросителна.
  card_community: `<path d="M8.6 9c0-2.2 1.5-3.6 3.4-3.6s3.4 1.4 3.4 3.2c0 2.4-3.1 2.7-3.1 5.1"/>
    <path d="M12.3 18.6h.01"/>`,
  // Бизнес възможност — куфарче.
  card_business: `<rect x="3.4" y="7.8" width="17.2" height="11.4" rx="1.8"/>
    <path d="M8.8 7.8V6.4a1.8 1.8 0 0 1 1.8-1.8h2.8a1.8 1.8 0 0 1 1.8 1.8v1.4"/>
    <path d="M3.4 12.6h17.2"/>`,
  // Данък — процент.
  tax: `<circle cx="7.6" cy="7.6" r="2.4"/><circle cx="16.4" cy="16.4" r="2.4"/>
    <path d="M18.4 5.6 5.6 18.4"/>`,
});

/* SVG на емблемата с подадено мастило. `ink` идва от повикващия, защото
   яркостта на повърхността се знае само там (тъмна лента иска светъл знак,
   кремавата хартия на акта — винаги тъмен). */
IE.bandEmblemSvg = function (key, ink) {
  const inner = IE.GROUP_EMBLEMS[key];
  if (!inner) return "";
  return `<svg class="band-emblem" viewBox="0 0 24 24" fill="none" stroke="${ink}"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
};

/* ------------------------------------------------------------
   Звук — изцяло синтезиран чрез Web Audio API (без външни файлове)

   Звуците не са прости „бийпове": ударите (зарове, тик, стъпка) се правят
   от шумов импулс през резонансен филтър — така звучи истински удар на
   пластмаса в дърво. Металните звуци (каса, камбани) използват
   нехармонични обертонове, а хартията е филтриран шум с плъзгащ се
   филтър. Всичко минава през общ компресор, защото заровете трупат много
   къси импулса един върху друг.

   Публичните имена НЕ се променят — извикват се от board/chat/events/
   trade/ui модулите.
   ------------------------------------------------------------ */
IE.sound = (function () {
  let ctx = null;      // AudioContext
  let bus = null;      // вход за „сухия" сигнал
  let master = null;   // общата сила на звука
  let reverb = null;   // процедурен ревербератор (само за фанфарите)
  let noiseBuf = null; // еднократно генериран бял шум

  function targetGain() {
    return IE.storage.muted ? 0 : IE.storage.volume;
  }

  function buildImpulse(seconds, decay) {
    const rate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();

      master = ctx.createGain();
      master.gain.value = targetGain();

      // Компресорът пази от клипване, когато няколко звука се застъпят.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 22;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;

      bus = ctx.createGain();
      bus.gain.value = 1;
      bus.connect(comp);
      comp.connect(master);
      master.connect(ctx.destination);

      // Реверберацията се ползва пестеливо — размазва бързи повторения.
      reverb = ctx.createConvolver();
      reverb.buffer = buildImpulse(1.1, 2.8);
      reverb.connect(comp);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function noiseBuffer() {
    if (!noiseBuf) {
      const length = Math.floor(ctx.sampleRate * 2);
      noiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  /* Свързва източник към сухия бус и (по избор) към реверберацията.
     Ако текущият вид звук е приглушен, минава през допълнителен усилвател —
     така отделната настройка важи и за сухия сигнал, и за реверберацията. */
  function route(node, send) {
    let source = node;
    if (activeLevel !== 1) {
      const level = ctx.createGain();
      level.gain.value = activeLevel;
      node.connect(level);
      source = level;
    }
    source.connect(bus);
    if (send > 0) {
      const wet = ctx.createGain();
      wet.gain.value = send;
      source.connect(wet).connect(reverb);
    }
  }

  /* Сила на вида звук, който се изпълнява в момента. Задава се от ready(). */
  let activeLevel = 1;

  function levelFor(name) {
    const raw = IE.storage.soundLevels[name];
    if (raw === undefined || raw === null) return 1;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
  }

  function ready(name) {
    if (IE.storage.muted || IE.storage.volume <= 0) return false;
    activeLevel = name ? levelFor(name) : 1;
    if (activeLevel <= 0) return false; // видът е изключен поотделно
    return !!ensureCtx();
  }

  /* --- Примитиви --------------------------------------------------- */

  /* Шумов импулс през филтър: удар, тик, шумолене. */
  function hit(opts) {
    const o = opts || {};
    const at = ctx.currentTime + (o.at || 0);
    const dur = o.dur || 0.05;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    src.playbackRate.value = 0.75 + Math.random() * 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type || "bandpass";
    filter.frequency.setValueAtTime(o.freq || 1800, at);
    if (o.sweepTo) {
      filter.frequency.exponentialRampToValueAtTime(o.sweepTo, at + dur);
    }
    filter.Q.value = o.q === undefined ? 6 : o.q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(o.gain || 0.3, at + (o.attack || 0.002));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(gain);
    route(gain, o.send || 0);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.05);
  }

  /* Обикновен тон с плавно затихване; по избор плъзгане на височината. */
  function tone(freq, dur, type, volume, delay, opts) {
    const o = opts || {};
    const at = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, at);
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, at + dur);
    if (o.detune) osc.detune.value = o.detune;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume === undefined ? 0.16 : volume,
                                           at + (o.attack || 0.012));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node = gain;
    osc.connect(gain);
    if (o.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(o.lowpass, at);
      if (o.lowpassTo) lp.frequency.exponentialRampToValueAtTime(o.lowpassTo, at + dur);
      gain.connect(lp);
      node = lp;
    }
    route(node, o.send || 0);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /* Метален звън: нехармонични обертонове (както при камбана/каса).

     Най-високият обертон (8.93×) стигаше до 12 kHz и звучеше остро, затова
     е премахнат, а останалите минават през lowpass. Таванът от ~2.6 kHz е
     избран така, че звуците да останат под най-високото в заровете и
     хартията — те се харесаха и не се пипат. */
  const BELL_PARTIALS = [1, 2.76, 5.4];
  const BELL_CEILING = 2600;
  function metal(base, dur, volume, at, send) {
    BELL_PARTIALS.forEach((ratio, i) => {
      tone(base * ratio, dur * (1 - i * 0.16), "sine",
           volume / (i + 1.6), at,
           { send: i === 0 ? (send || 0) : 0, lowpass: BELL_CEILING });
    });
  }

  /* Хартия: широколентов шум с плъзгащ се филтър. */
  function paper(at, dur, volume) {
    hit({ at: at, dur: dur || 0.2, freq: 900, sweepTo: 3200, q: 1.1,
          gain: volume || 0.26, attack: 0.03, type: "bandpass" });
    hit({ at: (at || 0) + 0.04, dur: (dur || 0.2) * 0.7, freq: 2600,
          sweepTo: 1100, q: 0.9, gain: (volume || 0.26) * 0.7 });
  }

  /* Телефонен звън: два тона през общо вибрато — както при механичен
     звънец, където чукчето бие бързо между две камбанки. Тоновете са
     нарочно в средния регистър и с lowpass, за да не бодат. */
  function phoneRing(at, dur, volume) {
    const t0 = ctx.currentTime + at;

    // Вибратото модулира обща степен: 0.10 … 1.00 при 20 Hz.
    const tremolo = ctx.createGain();
    tremolo.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 20;
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(tremolo.gain);

    // Плик на самото позвъняване.
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(volume, t0 + 0.03);
    env.gain.setValueAtTime(volume, t0 + dur - 0.09);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const soften = ctx.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 2200;

    for (const freq of [940, 1180]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t0);
      osc.connect(tremolo);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }
    tremolo.connect(env).connect(soften);
    route(soften, 0.14);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
  }

  /* Глух удар — „масата" под хвърлените зарове и стъпките. */
  function thud(at, freq, volume, dur) {
    tone(freq || 150, dur || 0.09, "sine", volume || 0.18, at,
         { glideTo: (freq || 150) * 0.6, attack: 0.004 });
  }

  return {
    /* Всички видове звуци, групирани за менюто. Това е единственият
       източник на истина — добавиш ли нов звук, впиши го и тук. */
    CATALOG: [
      { group: "Ход", items: [
        { key: "dice", label: "Зарове" },
        { key: "move", label: "Движение на пионката" },
        { key: "turn", label: "Твой ред" },
        { key: "timerTick", label: "Тиктакане на таймера" },
      ] },
      { group: "Пари", items: [
        { key: "buy", label: "Покупка на имот" },
        { key: "pay", label: "Плащане" },
      ] },
      { group: "Карти и сделки", items: [
        { key: "card", label: "Теглене на карта" },
        { key: "legendary", label: "Легендарна карта" },
        { key: "trade", label: "Сделка" },
      ] },
      { group: "Известия", items: [
        { key: "chat", label: "Съобщение в чата" },
        { key: "warn", label: "Предупреждение" },
        { key: "globalEvent", label: "Глобално събитие" },
      ] },
      { group: "Големи моменти", items: [
        { key: "monopoly", label: "Завършена група" },
        { key: "mission", label: "Изпълнена мисия" },
        { key: "victory", label: "Победа" },
        { key: "bankrupt", label: "Фалит" },
      ] },
    ],

    /* --- Сила на звука ---------------------------------------------- */
    levelOf(name) { return levelFor(name); },
    setLevel(name, value) {
      const levels = IE.storage.soundLevels;
      const clean = Math.min(1, Math.max(0, Number(value) || 0));
      if (clean === 1) delete levels[name]; // 1 е подразбиране, не го пазим
      else levels[name] = clean;
      IE.storage.soundLevels = levels;
    },
    resetLevels() { IE.storage.soundLevels = {}; },

    applyVolume() {
      if (!ctx || !master) return;
      master.gain.setTargetAtTime(targetGain(), ctx.currentTime, 0.02);
    },
    /* Пуска контекста след първо докосване и прилага текущата сила. */
    prime() {
      const audio = ensureCtx();
      if (audio && master) master.gain.value = targetGain();
      return !!audio;
    },

    /* --- Звуци ------------------------------------------------------- */

    /* Зарове: серия удари на пластмаса в дърво, които се сгъстяват и
       затихват, докато заровете спрат — плюс глух удар от масата. */
    dice() {
      if (!ready("dice")) return;
      hit({ dur: 0.11, freq: 2400, q: 0.8, gain: 0.1, attack: 0.02 }); // разклащане
      let t = 0.06;
      const clacks = 6 + Math.floor(Math.random() * 3);
      for (let i = 0; i < clacks; i++) {
        const fade = 1 - i / (clacks + 1);
        hit({ at: t, dur: 0.03 + Math.random() * 0.025,
              freq: 950 + Math.random() * 1700, q: 4 + Math.random() * 6,
              gain: 0.16 + 0.24 * fade });
        if (i % 2 === 0) thud(t, 120 + Math.random() * 60, 0.07 * fade, 0.06);
        t += 0.035 + Math.random() * 0.06 * (1 + i * 0.25); // разредява се
      }
      thud(t, 105, 0.1, 0.12); // спират на масата
    },

    /* Стъпка на фигурката: тих, приглушен допир. */
    move() {
      if (!ready("move")) return;
      hit({ dur: 0.035, freq: 520, q: 2.2, gain: 0.17, type: "lowpass" });
      thud(0, 190, 0.08, 0.05);
    },

    /* Покупка: тих касов апарат.

       Беше най-плътният звук в играта — 7 гласа, от които 6 звънтящи по
       половин секунда, плюс широк шумов импулс (Q 1.6), който съскаше.
       Сега щракването е тесен филтър вместо шум (Q 7), звънът е наполовина
       по-тих и угасва с около една трета по-бързо. Измерено: сборът на
       върховете падна от 0.70 на 0.31 — под този на сделката и картата. */
    buy() {
      if (!ready("buy")) return;
      hit({ dur: 0.035, freq: 900, q: 7, gain: 0.08 }); // чекмедже: щракане, не съскане
      metal(620, 0.34, 0.11, 0.02, 0.12);
      metal(830, 0.26, 0.07, 0.09, 0.1);
    },

    /* Плащане: само шумоленето на банкнотите.
       Металните монети бяха най-острият звук в играта (до 12 kHz) и са
       премахнати изцяло — броенето на пари звучи като хартия, не като звън. */
    pay() {
      if (!ready("pay")) return;
      paper(0, 0.26, 0.3);
      paper(0.13, 0.2, 0.2);
    },

    /* Карта: обръщане на хартия. */
    card() {
      if (!ready("card")) return;
      paper(0, 0.26, 0.3);
      hit({ at: 0.16, dur: 0.05, freq: 1700, q: 3, gain: 0.16 }); // ляга на масата
    },

    /* Легендарна карта: обръщането на хартия остава, но след него идва
       възходящ звън — играчът трябва да разбере по слух, че това не е
       поредното теглене, а събитие. */
    legendary() {
      if (!ready("legendary")) return;
      paper(0, 0.3, 0.3);
      hit({ at: 0.14, dur: 0.06, freq: 1700, q: 3, gain: 0.16 });
      [659, 880, 1175, 1568].forEach(
        (f, i) => metal(f, 0.95, 0.17, 0.24 + i * 0.1, 0.32),
      );
    },

    /* Твой ред: мек дървен чук, изцяло в топлия регистър. */
    turn() {
      if (!ready("turn")) return;
      hit({ dur: 0.03, freq: 480, q: 3, gain: 0.15, type: "lowpass" });
      tone(440, 0.34, "sine", 0.17, 0, { send: 0.1 });
      tone(660, 0.2, "sine", 0.05, 0.005, { lowpass: 1200 });
    },

    /* Предупреждение: приглушен зумер с вибрато. */
    warn() {
      if (!ready("warn")) return;
      for (let i = 0; i < 5; i++) {
        tone(196, 0.055, "sawtooth", 0.13, i * 0.06, { lowpass: 900 });
      }
    },

    /* Тиктакане: дървен часовников тик, без реверберация.
       Беше на 2700 Hz — най-острото нещо в играта, при това повтарящо се
       всяка секунда в последните 5. Свален е в дървения регистър. */
    timerTick() {
      if (!ready("timerTick")) return;
      hit({ dur: 0.02, freq: 900, q: 9, gain: 0.2, attack: 0.001 });
      hit({ at: 0.004, dur: 0.035, freq: 380, q: 5, gain: 0.12, type: "lowpass" });
    },

    /* Фалит: тежко спускане с притъмняващ филтър. */
    bankrupt() {
      if (!ready("bankrupt")) return;
      [392, 330, 262, 196].forEach((f, i) => {
        tone(f, 0.34, "sawtooth", 0.13, i * 0.17,
             { lowpass: 1400, lowpassTo: 260, detune: -6, send: 0.14 });
        tone(f, 0.34, "sawtooth", 0.08, i * 0.17, { lowpass: 900, detune: 7 });
      });
      thud(0.72, 90, 0.2, 0.5);
    },

    /* Победа: камбанна фанфара с ясна зала. */
    victory() {
      if (!ready("victory")) return;
      [523, 659, 784, 1047].forEach((f, i) => metal(f, 1.1, 0.2, i * 0.13, 0.34));
    },

    /* Мисия: мек звън, свален с октава спрямо първоначалния. */
    mission() {
      if (!ready("mission")) return;
      [523, 659, 784].forEach((f, i) => metal(f, 0.75, 0.15, i * 0.1, 0.26));
    },

    /* Глобално събитие: нисък тътен, който набъбва. */
    globalEvent() {
      if (!ready("globalEvent")) return;
      hit({ dur: 0.9, freq: 260, sweepTo: 90, q: 0.7, gain: 0.2,
            attack: 0.25, type: "lowpass", send: 0.2 });
      tone(147, 0.8, "sawtooth", 0.1, 0.05, { lowpass: 500, attack: 0.2, send: 0.2 });
      tone(294, 0.6, "triangle", 0.1, 0.24, { send: 0.18 });
    },

    /* Завършена група: три ярки камбани нагоре. */
    monopoly() {
      if (!ready("monopoly")) return;
      [523, 659, 880].forEach((f, i) => metal(f, 0.85, 0.18, i * 0.11, 0.3));
    },

    /* Сделка: приглушен звън и ръкостискане с хартия. */
    /* Сделка: телефонен звън — „дрън-дрън" с пауза между двете позвънявания. */
    trade() {
      if (!ready("trade")) return;
      phoneRing(0, 0.4, 0.15);
      phoneRing(0.58, 0.4, 0.15);
    },

    /* Чат: тихо „пук" в ниския регистър — чува се често, не бива да боде. */
    chat() {
      if (!ready("chat")) return;
      tone(430, 0.07, "sine", 0.14, 0, { glideTo: 260, attack: 0.004 });
    },

    /* Прослушване на всички звуци един след друг (за настройката). */
    preview(onName) {
      const order = [
        ["dice", "Зарове"], ["move", "Движение"], ["buy", "Покупка"],
        ["pay", "Плащане"], ["card", "Карта"], ["turn", "Твой ред"],
        ["trade", "Сделка"], ["timerTick", "Тиктакане"], ["warn", "Предупреждение"],
        ["monopoly", "Завършена група"], ["mission", "Мисия"],
        ["globalEvent", "Глобално събитие"], ["chat", "Съобщение"],
        ["bankrupt", "Фалит"], ["victory", "Победа"],
      ];
      this.prime();
      let delay = 0;
      const timers = [];
      order.forEach(([name, label]) => {
        timers.push(setTimeout(() => {
          if (onName) onName(label);
          this[name]();
        }, delay));
        delay += name === "victory" || name === "bankrupt" ? 1400 : 850;
      });
      return () => timers.forEach(clearTimeout);
    },
  };
})();
