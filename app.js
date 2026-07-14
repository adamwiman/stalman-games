/* ============================================================
   Game Hub — hub logic
   localStorage keys:
     hub.pin      — hashed parent PIN
     hub.limits   — {gameId: minutesPerDay}
     hub.usage    — {date:"YYYY-MM-DD", byGame:{gameId: seconds}}
     score.<id>   — each game's best score (written by the game)
   ============================================================ */
(function () {
  "use strict";

  // ---------- tiny helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const todayStr = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
      "-" + String(d.getDate()).padStart(2, "0");
  };
  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return "h" + h;
  };

  const getLimits = () => readJSON("hub.limits", {});
  const getUsage = () => {
    const u = readJSON("hub.usage", null);
    if (!u || u.date !== todayStr()) return { date: todayStr(), byGame: {} };
    return u;
  };
  const minutesLeft = (gameId) => {
    const lim = getLimits()[gameId];
    if (!lim) return null; // no limit set
    const used = (getUsage().byGame[gameId] || 0) / 60;
    return Math.max(0, Math.ceil(lim - used));
  };

  // ---------- render game cards ----------
  function renderCards() {
    const grid = $("#grid");
    grid.innerHTML = "";
    for (const g of GAMES) {
      const best = localStorage.getItem(g.scoreKey);
      const left = minutesLeft(g.id);
      const locked = left !== null && left <= 0;

      const a = document.createElement("a");
      a.className = "game-card" + (locked ? " locked" : "");
      a.href = g.file;
      if (locked) {
        a.addEventListener("click", (e) => e.preventDefault());
      }

      let timeChip = "";
      if (left !== null) {
        const cls = locked ? "" : left <= 5 ? " low" : "";
        const label = locked ? "Time's up today" : "⏱ " + left + " min left";
        timeChip = '<span class="chip time' + cls + '">' + label + "</span>";
      }

      a.innerHTML =
        '<span class="emoji">' + g.emoji + "</span>" +
        "<h2>" + g.title + "</h2>" +
        '<p class="blurb">' + g.blurb + "</p>" +
        '<div class="chips">' +
        '<span class="chip">🏆 ' + (best ? Number(best).toLocaleString() : "—") + "</span>" +
        timeChip +
        "</div>";
      grid.appendChild(a);
    }
  }

  // ---------- settings (PIN-gated) ----------
  const overlay = $("#overlay");
  const panel = $("#panel");
  let unlocked = false;

  function openOverlay() {
    overlay.classList.add("open");
    unlocked = false;
    localStorage.getItem("hub.pin") ? showPinEntry() : showPinCreate();
  }
  function closeOverlay() {
    overlay.classList.remove("open");
    renderCards();
  }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeOverlay(); });
  $("#gear").addEventListener("click", openOverlay);

  function showPinCreate() {
    panel.innerHTML =
      "<h2>Create a parent PIN</h2>" +
      '<p class="sub">This PIN protects the settings on this device.</p>' +
      '<label>New PIN (4+ digits)</label><input id="pin1" type="password" inputmode="numeric" autocomplete="off">' +
      '<label>Repeat PIN</label><input id="pin2" type="password" inputmode="numeric" autocomplete="off">' +
      '<div class="msg" id="pmsg"></div>' +
      '<button class="btn" id="psave">Save PIN</button>' +
      '<button class="btn quiet" id="pcancel">Cancel</button>';
    $("#pcancel").onclick = closeOverlay;
    $("#psave").onclick = () => {
      const a = $("#pin1").value, b = $("#pin2").value;
      if (a.length < 4) { $("#pmsg").textContent = "PIN needs at least 4 digits."; return; }
      if (a !== b) { $("#pmsg").textContent = "PINs don't match."; return; }
      localStorage.setItem("hub.pin", hash(a));
      unlocked = true;
      showSettings();
    };
  }

  function showPinEntry() {
    panel.innerHTML =
      "<h2>Parent settings</h2>" +
      '<p class="sub">Enter the PIN to continue.</p>' +
      '<label>PIN</label><input id="pin" type="password" inputmode="numeric" autocomplete="off">' +
      '<div class="msg" id="pmsg"></div>' +
      '<button class="btn" id="pgo">Unlock</button>' +
      '<button class="btn quiet" id="pcancel">Cancel</button>';
    $("#pcancel").onclick = closeOverlay;
    const tryUnlock = () => {
      if (hash($("#pin").value) === localStorage.getItem("hub.pin")) {
        unlocked = true;
        showSettings();
      } else {
        $("#pmsg").textContent = "Wrong PIN.";
        $("#pin").value = "";
      }
    };
    $("#pgo").onclick = tryUnlock;
    $("#pin").addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });
    $("#pin").focus();
  }

  function showSettings() {
    if (!unlocked) return;
    const limits = getLimits();
    let rows = "";
    for (const g of GAMES) {
      rows +=
        '<div class="limit-row"><span>' + g.emoji + " " + g.title + "</span>" +
        '<input type="number" min="0" step="5" inputmode="numeric" placeholder="No limit" ' +
        'data-game="' + g.id + '" value="' + (limits[g.id] || "") + '"></div>';
    }
    panel.innerHTML =
      "<h2>Parent settings</h2>" +
      '<p class="sub">Daily play time per game, in minutes. Leave empty for no limit. Resets each day.</p>' +
      rows +
      '<div class="msg" id="smsg"></div>' +
      '<button class="btn" id="save">Save limits</button>' +
      '<button class="btn quiet" id="resetTime">Reset today\u2019s playtime</button>' +
      '<button class="btn quiet" id="changePin">Change PIN</button>' +
      '<button class="btn danger" id="resetScores">Reset high scores</button>' +
      '<button class="btn quiet" id="close">Close</button>';

    $("#save").onclick = () => {
      const next = {};
      panel.querySelectorAll("input[data-game]").forEach((inp) => {
        const v = parseInt(inp.value, 10);
        if (v > 0) next[inp.dataset.game] = v;
      });
      localStorage.setItem("hub.limits", JSON.stringify(next));
      const m = $("#smsg"); m.textContent = "Saved."; m.className = "msg ok";
    };
    $("#resetTime").onclick = () => {
      localStorage.removeItem("hub.usage");
      const m = $("#smsg"); m.textContent = "Playtime reset for today."; m.className = "msg ok";
    };
    $("#resetScores").onclick = () => {
      for (const g of GAMES) localStorage.removeItem(g.scoreKey);
      const m = $("#smsg"); m.textContent = "High scores cleared."; m.className = "msg ok";
    };
    $("#changePin").onclick = () => { localStorage.removeItem("hub.pin"); showPinCreate(); };
    $("#close").onclick = closeOverlay;
  }

  // ---------- keep cards fresh when returning from a game ----------
  window.addEventListener("pageshow", renderCards);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") renderCards();
  });
  setInterval(renderCards, 30000);

  renderCards();

  // ---------- offline: register the service worker ----------
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
