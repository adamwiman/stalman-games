/* ============================================================
   i18n.js — the hub's language, shared by the hub and every game.
   Swedish is the default; English is chosen on the hub and saved
   on the device (localStorage "hub.lang" = "sv" | "en").
   Include in <head>, before the page's own scripts:
     <script src="../shared/i18n.js"></script>
   Static markup is written in Swedish. Give an element its English
   version in data-en (inner HTML), and attributes in data-en-<attr>:
     <h1 data-en="Times tables">Gångertabellen</h1>
     <button aria-label="Stäng" data-en-aria-label="Close">✕</button>
   Scripts use I18N.lang, or I18N.t("svensk text", "English text").
   ============================================================ */
(function () {
  "use strict";
  var KEY = "hub.lang";
  var LANGS = ["sv", "en"];

  function read() {
    try { return localStorage.getItem(KEY) === "en" ? "en" : "sv"; }
    catch (e) { return "sv"; }
  }

  // Swaps every data-en element under root to the current language. The
  // Swedish original is kept in data-sv (and data-sv-<attr>) so the page can
  // switch back without a reload.
  function apply(root) {
    root = root || document;
    var en = I18N.lang === "en";
    document.documentElement.lang = I18N.lang;
    var els = root.querySelectorAll("[data-en]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.hasAttribute("data-sv")) el.setAttribute("data-sv", el.innerHTML);
      el.innerHTML = en ? el.getAttribute("data-en") : el.getAttribute("data-sv");
    }
    var all = root.querySelectorAll("*");
    for (var j = 0; j < all.length; j++) {
      var attrs = all[j].attributes;
      for (var k = 0; k < attrs.length; k++) {
        var m = /^data-en-(.+)$/.exec(attrs[k].name);
        if (!m) continue;
        var el2 = all[j], name = m[1], keep = "data-sv-" + name;
        if (!el2.hasAttribute(keep)) el2.setAttribute(keep, el2.getAttribute(name) || "");
        el2.setAttribute(name, en ? attrs[k].value : el2.getAttribute(keep));
      }
    }
  }

  var I18N = window.I18N = {
    lang: read(),
    langs: LANGS,
    t: function (sv, en) { return I18N.lang === "en" ? en : sv; },
    set: function (lang) {
      I18N.lang = lang === "en" ? "en" : "sv";
      try { localStorage.setItem(KEY, I18N.lang); } catch (e) {}
      apply(document);
    },
    apply: apply
  };

  document.documentElement.lang = I18N.lang;
  // Pages normally call I18N.apply() as their script starts; this catches the rest.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { apply(document); });
  } else {
    apply(document);
  }
})();
