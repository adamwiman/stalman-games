/* ============================================================
   guard.js — shared playtime guard for every game page.
   Include at the end of <body> in each game:
     <script src="../shared/guard.js" data-game="GAME_ID"></script>
   Tracks seconds played per day (localStorage "hub.usage") and
   shows a friendly full-screen lock when the daily limit
   ("hub.limits", set in the hub's parent settings) is reached.
   ============================================================ */
(function () {
  "use strict";
  var script = document.currentScript;
  var gameId = script && script.dataset.game;
  if (!gameId) return;

  var TICK = 5; // seconds between usage updates
  var locked = false;
  var pill = null;

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
      "-" + String(d.getDate()).padStart(2, "0");
  }
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function getLimitMin() {
    var lim = readJSON("hub.limits", {})[gameId];
    return lim > 0 ? lim : null;
  }
  function getUsage() {
    var u = readJSON("hub.usage", null);
    if (!u || u.date !== todayStr()) u = { date: todayStr(), byGame: {} };
    return u;
  }
  function addSeconds(s) {
    var u = getUsage();
    u.byGame[gameId] = (u.byGame[gameId] || 0) + s;
    try { localStorage.setItem("hub.usage", JSON.stringify(u)); } catch (e) {}
    return u.byGame[gameId];
  }
  function secondsLeft() {
    var lim = getLimitMin();
    if (lim === null) return null;
    return Math.max(0, lim * 60 - (getUsage().byGame[gameId] || 0));
  }

  // ---------- UI ----------
  function ensurePill() {
    if (pill) return pill;
    pill = document.createElement("div");
    pill.style.cssText =
      "position:fixed;left:12px;bottom:max(12px, env(safe-area-inset-bottom));" +
      "z-index:9000;font-family:ui-rounded,'SF Pro Rounded',system-ui,sans-serif;" +
      "font-size:13px;font-weight:700;color:#17335b;background:#38d9a9;" +
      "border:2px solid #17335b;border-radius:999px;padding:4px 12px;" +
      "pointer-events:none;";
    document.body.appendChild(pill);
    return pill;
  }
  function updatePill() {
    var left = secondsLeft();
    if (left === null) { if (pill) pill.remove(); pill = null; return; }
    var p = ensurePill();
    var min = Math.ceil(left / 60);
    p.textContent = "⏱ " + min + " min left";
    p.style.background = min <= 5 ? "#ff6b6b" : "#38d9a9";
    p.style.color = min <= 5 ? "#fff" : "#17335b";
  }

  // Input never reaches the game behind the overlay. Inside the overlay the
  // default action is kept, so the back link still works: on iPad a
  // preventDefault() on pointerdown would cancel the tap's click.
  var overlay = null;
  function blockEvent(e) {
    e.stopPropagation();
    if (!overlay || !overlay.contains(e.target)) e.preventDefault();
  }

  function lock() {
    if (locked) return;
    locked = true;
    var ov = document.createElement("div");
    ov.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:#17335bf2;display:flex;" +
      "align-items:center;justify-content:center;text-align:center;" +
      "font-family:ui-rounded,'SF Pro Rounded',system-ui,sans-serif;color:#fff;padding:24px;";
    ov.innerHTML =
      '<div><div style="font-size:64px">🌙</div>' +
      '<h1 style="font-size:32px;margin:12px 0 6px">Time\u2019s up for today!</h1>' +
      '<p style="font-size:17px;opacity:.85;margin:0 0 24px">Great playing \u2014 come back tomorrow.</p>' +
      '<a href="../index.html" style="display:inline-block;font-weight:800;font-size:18px;' +
      "color:#17335b;background:#ffc63f;border:2px solid #fff;border-radius:16px;" +
      'padding:12px 26px;text-decoration:none">\u2190 Back to games</a></div>';
    document.body.appendChild(ov);
    overlay = ov;
    ["keydown", "keyup", "touchstart", "touchmove", "pointerdown"].forEach(function (t) {
      window.addEventListener(t, blockEvent, true);
    });
    if (pill) { pill.remove(); pill = null; }
  }

  // ---------- ticking ----------
  setInterval(function () {
    if (locked || document.visibilityState !== "visible") return;
    addSeconds(TICK);
    var left = secondsLeft();
    updatePill();
    if (left !== null && left <= 0) lock();
  }, TICK * 1000);

  // initial check (e.g. reopening a game that's already used up)
  if (secondsLeft() === 0) lock();
  updatePill();
})();
