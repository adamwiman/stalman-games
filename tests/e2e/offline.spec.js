// Offline: the service worker precaches every asset, and the hub and all games
// still load with the network switched off.
"use strict";
const { test, expect, loadGames, loadServiceWorkerConfig } = require("./fixtures");

const GAMES = loadGames();
const { ASSETS, CACHE_VERSION } = loadServiceWorkerConfig();

test("service worker precaches all assets and every game works offline", async ({ page, context, baseURL }) => {
  await page.goto("index.html");
  const swOk = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  test.skip(!swOk, "this browser build has no service worker support");

  // every asset from sw.js is in the current cache, and no stale caches remain
  const cached = await page.evaluate(async (name) => {
    const keys = await caches.keys();
    const cache = await caches.open(name);
    return { keys, urls: (await cache.keys()).map((r) => r.url) };
  }, CACHE_VERSION);
  expect(cached.keys).toEqual([CACHE_VERSION]);
  const expected = ASSETS.map((a) => new URL(a, baseURL).href).sort();
  expect(cached.urls.sort()).toEqual(expected);

  // a reload puts the page under the service worker's control
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator(".game-card")).toHaveCount(GAMES.length);
    for (const g of GAMES) {
      await page.goto(g.file);
      await expect(page.locator("a.back")).toHaveCount(1);
      await expect(page.locator("body")).not.toBeEmpty();
    }
  } finally {
    await context.setOffline(false);
  }
});
