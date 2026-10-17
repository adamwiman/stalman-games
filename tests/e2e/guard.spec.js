// shared/guard.js inside every game: the time-left pill, counting playtime,
// and the "time's up" lock that blocks input but lets the back link work.
"use strict";
const { test, expect, press, swipe, seedStorage, today, loadGames } = require("./fixtures");

const GAMES = loadGames();
const lockOverlay = (page) => page.getByText("Time’s up for today!");

for (const g of GAMES) {
  test(`${g.title}: locked when today's time is used up, back link still works`, async ({ page, touch }) => {
    await seedStorage(page, {
      "hub.limits": { [g.id]: 1 },
      "hub.usage": { date: today(), byGame: { [g.id]: 60 } }
    });
    await page.goto(g.file);
    await expect(lockOverlay(page)).toBeVisible();
    await press(page.getByRole("link", { name: "← Back to games" }), touch);
    await expect(page).toHaveURL(/index\.html$/);
    await expect(page.locator(".game-card", { hasText: g.title })).toHaveClass(/locked/);
  });
}

test("2048: playtime is counted, the pill counts down and the game locks at the limit", async ({ page, touch }) => {
  await page.clock.install();
  await seedStorage(page, { "hub.limits": { "2048": 1 } });
  await page.goto("games/2048.html");
  const pill = page.getByText(/min left$/);
  await expect(pill).toHaveText("⏱ 1 min left");

  await page.clock.runFor(30000);
  const used = await page.evaluate(() => JSON.parse(localStorage.getItem("hub.usage")).byGame["2048"]);
  expect(used).toBe(30);
  await expect(lockOverlay(page)).toHaveCount(0);

  await page.clock.runFor(31000);
  await expect(lockOverlay(page)).toBeVisible();
  await expect(pill).toHaveCount(0);

  // keys and swipes no longer reach the game
  const before = await page.evaluate(() => JSON.stringify(allTiles(grid).map((t) => [t.r, t.c, t.v])));
  for (const k of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) await page.keyboard.press(k);
  if (touch) for (const [dx, dy] of [[-120, 0], [0, -120], [120, 0], [0, 120]]) await swipe(page, "#board", dx, dy);
  await page.clock.runFor(500);
  expect(await page.evaluate(() => JSON.stringify(allTiles(grid).map((t) => [t.r, t.c, t.v])))).toBe(before);
});

test("no pill and no lock when there is no limit", async ({ page }) => {
  await page.goto("games/numlings.html");
  await expect(page.getByText(/min left$/)).toHaveCount(0);
  await expect(lockOverlay(page)).toHaveCount(0);
});
