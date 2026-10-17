/* Shared fixtures for the e2e tests.
   Every test automatically fails if the page throws, logs a console error,
   or requests anything outside the local server (the hub must work offline). */
"use strict";
const base = require("@playwright/test");
const { ROOT, loadGames, loadServiceWorkerConfig } = require("../hub-config");

const test = base.test.extend({
  problems: [async ({ page, baseURL }, use) => {
    const problems = [];
    const origin = new URL(baseURL).origin;
    page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error") problems.push("console.error: " + m.text()); });
    page.on("request", (r) => {
      const u = r.url();
      if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) problems.push("external request: " + u);
    });
    await use(problems);
    base.expect(problems, "page errors / external requests").toEqual([]);
  }, { auto: true }],

  // true on the iPad projects
  touch: async ({ hasTouch }, use) => { await use(!!hasTouch); }
});

// Tap on touch devices, click with the mouse elsewhere.
async function press(locator, touch) {
  if (touch) await locator.tap();
  else await locator.click();
}

// WebKit forbids `new Touch()`, so build plain events carrying the touch lists
// the game reads (touches / changedTouches with clientX/clientY).
async function swipe(page, selector, dx, dy) {
  await page.evaluate(({ selector, dx, dy }) => {
    const el = document.querySelector(selector);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const fire = (type, px, py, active) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      const t = [{ identifier: 1, clientX: px, clientY: py, target: el }];
      Object.defineProperty(ev, "touches", { value: active ? t : [] });
      Object.defineProperty(ev, "changedTouches", { value: t });
      el.dispatchEvent(ev);
    };
    fire("touchstart", x, y, true);
    fire("touchend", x + dx, y + dy, false);
  }, { selector, dx, dy });
}

// Set localStorage before any page script runs (for the whole test).
async function seedStorage(page, entries) {
  await page.addInitScript((e) => {
    if (sessionStorage.getItem("__seeded")) return; // only on the first load
    sessionStorage.setItem("__seeded", "1");
    for (const [k, v] of Object.entries(e)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, entries);
}

const today = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

// No element may stick out past the right edge of the viewport (iPad: no sideways scroll).
async function expectNoHorizontalOverflow(page, label = "") {
  const res = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const wide = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed") continue;
      if (el.closest(".confetti")) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.right > vw + 1) wide.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} right=${Math.round(r.right)}`);
    }
    return { vw, scrollW: document.documentElement.scrollWidth, wide: wide.slice(0, 5) };
  });
  base.expect(res.scrollW, `page scrolls sideways ${label} ${JSON.stringify(res.wide)}`).toBeLessThanOrEqual(res.vw);
  base.expect(res.wide, `elements past the right edge ${label}`).toEqual([]);
}

module.exports = { test, expect: base.expect, press, swipe, seedStorage, today, loadGames, loadServiceWorkerConfig, expectNoHorizontalOverflow, ROOT };
