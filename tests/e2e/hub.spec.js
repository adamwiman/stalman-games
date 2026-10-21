// The hub page: game cards, parent settings, time limits, and layout.
"use strict";
const { test, expect, press, seedStorage, today, loadGames, expectNoHorizontalOverflow } = require("./fixtures");

const GAMES = loadGames();

test("shows one card per game in config.js, linking to the right file", async ({ page }) => {
  await page.goto("index.html");
  const cards = page.locator(".game-card");
  await expect(cards).toHaveCount(GAMES.length);
  for (const [i, g] of GAMES.entries()) {
    await expect(cards.nth(i).locator("h2")).toHaveText(g.title);
    await expect(cards.nth(i)).toHaveAttribute("href", g.file);
  }
  await expectNoHorizontalOverflow(page, "hub");
});

test("each card opens its game and the back link returns to the hub", async ({ page, touch }) => {
  await page.goto("index.html");
  for (const g of GAMES) {
    await press(page.locator(".game-card", { hasText: g.title }), touch);
    await expect(page).toHaveURL(new RegExp(g.file.replace(".", "\\.") + "$"));
    await press(page.locator("a.back"), touch);
    await expect(page).toHaveURL(/index\.html$/);
    await expect(page.locator(".game-card")).toHaveCount(GAMES.length);
  }
});

test("cards show each game's best score from localStorage", async ({ page }) => {
  await seedStorage(page, { "score.2048": "4096", "score.goopipes": "12", "score.numlings": "7", "score.gangertabell": "23" });
  await page.goto("index.html");
  const chip = (title) => page.locator(".game-card", { hasText: title }).locator(".chip").first();
  // the thousands separator depends on the engine's locale
  await expect(chip("2048")).toHaveText(/4\D?096/);
  await expect(chip("Slemrören")).toHaveText(/12/);
  await expect(chip("Numlingarnas resa")).toHaveText(/7/);
  await expect(chip("Gångertabellen")).toHaveText(/23/);
});

test("parent PIN: create, wrong PIN rejected, limits saved and shown on cards", async ({ page, touch }) => {
  await page.goto("index.html");
  await press(page.locator("#gear"), touch);
  await expect(page.locator("#panel h2")).toHaveText("Create a parent PIN");

  // too short, then mismatch, then OK
  await page.fill("#pin1", "12"); await page.fill("#pin2", "12");
  await press(page.locator("#psave"), touch);
  await expect(page.locator("#pmsg")).toHaveText(/at least 4/);
  await page.fill("#pin1", "1234"); await page.fill("#pin2", "9999");
  await press(page.locator("#psave"), touch);
  await expect(page.locator("#pmsg")).toHaveText(/don't match/);
  await page.fill("#pin2", "1234");
  await press(page.locator("#psave"), touch);

  // settings: one row per game
  await expect(page.locator("input[data-game]")).toHaveCount(GAMES.length);
  await page.fill('input[data-game="numlings"]', "20");
  await page.fill('input[data-game="goopipes"]', "3");
  await press(page.locator("#save"), touch);
  await expect(page.locator("#smsg")).toHaveText("Saved.");
  await press(page.locator("#close"), touch);

  await expect(page.locator(".game-card", { hasText: "Numlingarnas resa" }).locator(".chip.time")).toHaveText("⏱ 20 min left");
  await expect(page.locator(".game-card", { hasText: "Slemrören" }).locator(".chip.time.low")).toHaveText("⏱ 3 min left");
  await expect(page.locator(".game-card", { hasText: "2048" }).locator(".chip.time")).toHaveCount(0);

  // reopen: wrong PIN, then right one
  await press(page.locator("#gear"), touch);
  await page.fill("#pin", "0000");
  await press(page.locator("#pgo"), touch);
  await expect(page.locator("#pmsg")).toHaveText("Wrong PIN.");
  await page.fill("#pin", "1234");
  await press(page.locator("#pgo"), touch);
  await expect(page.locator('input[data-game="numlings"]')).toHaveValue("20");

  // reset high scores clears every game's key
  await page.evaluate(() => { localStorage.setItem("score.2048", "100"); localStorage.setItem("score.numlings", "5"); });
  await press(page.locator("#resetScores"), touch);
  expect(await page.evaluate(() => [localStorage.getItem("score.2048"), localStorage.getItem("score.numlings")])).toEqual([null, null]);
});

test("a game whose daily time is used up is locked on the hub", async ({ page, touch }) => {
  await seedStorage(page, {
    "hub.limits": { numlings: 10 },
    "hub.usage": { date: today(), byGame: { numlings: 600 } }
  });
  await page.goto("index.html");
  const card = page.locator(".game-card", { hasText: "Numlingarnas resa" });
  await expect(card).toHaveClass(/locked/);
  await expect(card.locator(".chip.time")).toHaveText("Time's up today");
  await press(card, touch);
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/index\.html$/); // the click did not navigate
});

test("usage from an earlier day does not count", async ({ page }) => {
  await seedStorage(page, {
    "hub.limits": { numlings: 10 },
    "hub.usage": { date: "2000-01-01", byGame: { numlings: 9999 } }
  });
  await page.goto("index.html");
  await expect(page.locator(".game-card", { hasText: "Numlingarnas resa" })).not.toHaveClass(/locked/);
});
