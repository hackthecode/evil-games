/* ============================================================
   Имоти и Империи — начална страница (създаване/присъединяване)
   ============================================================ */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const nameInput = IE.el("player-name");
  const codeInput = IE.el("join-code");
  const createBtn = IE.el("btn-create");
  const joinBtn = IE.el("btn-join");
  const rulesBtn = IE.el("btn-rules");
  const rulesModal = IE.el("rules-modal");

  nameInput.value = IE.storage.playerName;

  function getName() {
    const name = nameInput.value.trim();
    if (!name) {
      IE.toast("Въведете име, за да играете.", "error");
      nameInput.focus();
      return null;
    }
    IE.storage.playerName = name;
    return name;
  }

  function setBusy(busy) {
    createBtn.disabled = busy;
    joinBtn.disabled = busy;
  }

  const socket = IE.connect();

  socket.on("room_joined", (data) => {
    IE.storage.reconnectToken = data.reconnect_token;
    window.location.href = IE.urls.game;
  });

  socket.on("error_message", () => setBusy(false));

  createBtn.addEventListener("click", () => {
    const name = getName();
    if (!name) return;
    setBusy(true);
    socket.emit("create_room", {
      name,
      token: "red",
      gender: "male",
      settings: IE.storage.gameSettings || {},
    });
  });

  joinBtn.addEventListener("click", () => {
    const name = getName();
    if (!name) return;
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 6) {
      IE.toast("Кодът на стаята е 6 знака.", "error");
      codeInput.focus();
      return;
    }
    setBusy(true);
    socket.emit("join_room", { room_code: code, name, token: "red", gender: "male" });
  });

  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinBtn.click();
  });
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (codeInput.value.trim()) joinBtn.click();
      else createBtn.click();
    }
  });

  rulesBtn.addEventListener("click", () => rulesModal.classList.remove("hidden"));
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal || e.target.dataset.close !== undefined) {
      rulesModal.classList.add("hidden");
    }
  });

  // Ако има активна сесия — предлагаме връщане в играта.
  if (IE.storage.reconnectToken) {
    const back = IE.el("resume-banner");
    if (back) {
      back.classList.remove("hidden");
      IE.el("btn-resume").addEventListener("click", () => {
        window.location.href = IE.urls.game;
      });
      IE.el("btn-forget").addEventListener("click", () => {
        IE.storage.reconnectToken = null;
        back.classList.add("hidden");
      });
    }
  }
});
