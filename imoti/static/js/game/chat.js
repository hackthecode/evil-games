/* ============================================================
   Имоти и Империи — chat: общ чат за лоби и игра.
   Съобщения, брояч на непрочетени, емоджи пикъри и бързи
   реакции.
   ============================================================ */
"use strict";

(function () {
  const G = window.IEGame;
  if (!G) return;
  const { socket, state } = G;

  // Брояч на непрочетени съобщения в игровия чат.
  let chatUnread = 0;
  function updateChatUnread() {
    const badge = IE.el("chat-unread");
    if (!badge) return;
    if (chatUnread > 0) {
      badge.textContent = chatUnread > 99 ? "99+" : String(chatUnread);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }
  function clearChatUnread() { chatUnread = 0; updateChatUnread(); }

  // Дали игровият чат в момента е видим за играча (не е свит на телефон).
  function gameChatVisible() {
    const box = IE.el("game-chat-messages");
    if (!box || IE.el("game-view").classList.contains("hidden")) return false;
    const panel = box.closest(".mobile-collapsible");
    if (panel && panel.classList.contains("collapsed")) return false;
    return document.hasFocus();
  }

  socket.on("chat_message", (msg) => {
    for (const boxId of ["chat-messages", "game-chat-messages"]) {
      const box = IE.el(boxId);
      if (!box) continue;
      const line = document.createElement("div");
      line.className = "chat-line";
      line.innerHTML = `<span class="who">${IE.escapeHtml(msg.from)}:</span> ${msg.text}`;
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
    }
    if (msg.player_id !== state.myId) {
      IE.sound.chat();
      if (!gameChatVisible()) { chatUnread++; updateChatUnread(); }
    }
  });

  function wireChat(formId, inputId) {
    IE.el(formId).addEventListener("submit", (e) => {
      e.preventDefault();
      const input = IE.el(inputId);
      const text = input.value.trim();
      if (!text) return;
      socket.emit("chat_message", { text });
      input.value = "";
      closeEmojiPickers();
      clearChatUnread();
    });
  }

  const CHAT_EMOJIS = [
    ["😀", "Усмивка"], ["😂", "Смях"], ["😊", "Радост"], ["😉", "Намигване"],
    ["😍", "Харесване"], ["😮", "Изненада"], ["😢", "Тъга"], ["😡", "Яд"],
    ["👍", "Одобрение"], ["👎", "Неодобрение"], ["👏", "Аплодисменти"], ["🙏", "Благодаря"],
    ["🤝", "Сделка"], ["💪", "Сила"], ["🎉", "Празник"], ["🏆", "Победа"],
    ["🎲", "Зарове"], ["🔥", "Страхотно"], ["💰", "Пари"], ["🏠", "Имот"],
    ["🏦", "Банка"], ["📈", "Печалба"], ["📉", "Загуба"], ["❤️", "Сърце"],
  ];

  function closeEmojiPickers(except = null) {
    document.querySelectorAll(".chat-emoji-picker:not(.hidden)").forEach((picker) => {
      if (picker === except) return;
      picker.classList.add("hidden");
      const toggle = picker.closest(".chat-form").querySelector(".chat-emoji-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  }

  function insertEmoji(input, emoji) {
    const start = input.selectionStart == null ? input.value.length : input.selectionStart;
    const end = input.selectionEnd == null ? start : input.selectionEnd;
    const nextValue = input.value.slice(0, start) + emoji + input.value.slice(end);
    if (nextValue.length > Number(input.maxLength || 300)) return;
    input.value = nextValue;
    const caret = start + emoji.length;
    input.focus({ preventScroll: true });
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  document.querySelectorAll(".chat-emoji-toggle[data-emoji-target]").forEach((toggle) => {
    const input = IE.el(toggle.dataset.emojiTarget);
    if (!input) return;
    const picker = document.createElement("div");
    picker.id = `${input.id}-emoji-picker`;
    picker.className = "chat-emoji-picker hidden";
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "Избор на емоджи");
    toggle.setAttribute("aria-controls", picker.id);
    for (const [emoji, label] of CHAT_EMOJIS) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = emoji;
      button.title = label;
      button.setAttribute("aria-label", label);
      button.dataset.emoji = emoji;
      picker.appendChild(button);
    }
    toggle.closest(".chat-form").appendChild(picker);

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = picker.classList.contains("hidden");
      closeEmojiPickers(picker);
      picker.classList.toggle("hidden", !willOpen);
      toggle.setAttribute("aria-expanded", String(willOpen));
    });
    picker.addEventListener("click", (event) => {
      event.stopPropagation();
      const button = event.target.closest("button[data-emoji]");
      if (button) insertEmoji(input, button.dataset.emoji);
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".chat-form")) closeEmojiPickers();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeEmojiPickers();
  });

  wireChat("chat-form", "chat-input");
  wireChat("game-chat-form", "game-chat-input");

  // Изчистване на брояча при взаимодействие с чата.
  IE.el("game-chat-input").addEventListener("focus", clearChatUnread);
  IE.el("game-chat-messages").addEventListener("click", clearChatUnread);

  // Бързи емоджи реакции — изпращат се като кратко чат съобщение.
  IE.el("chat-reactions").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-emoji]");
    if (!btn || btn.dataset.sending === "true") return;
    btn.dataset.sending = "true";
    btn.classList.add("sent");
    socket.emit("chat_message", { text: btn.dataset.emoji });
    clearChatUnread();
    setTimeout(() => {
      btn.dataset.sending = "false";
      btn.classList.remove("sent");
    }, 420);
  });
})();
