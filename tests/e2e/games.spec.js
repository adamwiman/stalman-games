// 2048 and Goo Pipes: real input (keyboard on desktop, touch on iPad),
// scores reaching the hub, saved games, and layout.
"use strict";
const { test, expect, press, swipe, expectNoHorizontalOverflow } = require("./fixtures");

const tiles2048 = (page) => page.evaluate(() =>
  allTiles(grid).map((t) => `${t.r},${t.c}=${t.v}`).sort().join(" "));

test.describe("2048", () => {
  test("starts with two tiles and fits the screen", async ({ page }) => {
    await page.goto("games/2048.html");
    await expect(page.locator("#board .tile")).toHaveCount(2);
    await expectNoHorizontalOverflow(page, "2048");
    const board = await page.locator("#board").boundingBox();
    const vp = page.viewportSize();
    expect(board.y + board.height, "board fits vertically").toBeLessThanOrEqual(vp.height);
  });

  test("moves tiles with swipes on iPad / arrow keys on desktop, and saves best + game", async ({ page, touch }) => {
    await page.goto("games/2048.html");
    let moves = 0;
    const dirs = touch
      ? [[0, 120], [-120, 0], [0, -120], [120, 0]] // down, left, up, right
      : ["ArrowDown", "ArrowLeft", "ArrowUp", "ArrowRight"];
    for (let i = 0; i < 40; i++) {
      const before = await tiles2048(page);
      const d = dirs[i % 4];
      if (touch) await swipe(page, "#board", d[0], d[1]);
      else await page.keyboard.press(d);
      await page.waitForTimeout(170); // move animation is 130 ms
      if ((await tiles2048(page)) !== before) moves++;
      if (await page.locator("#modal.show").count()) break;
    }
    expect(moves, "at least some swipes/keys moved the board").toBeGreaterThan(5);

    const score = await page.evaluate(() => score);
    const stored = await page.evaluate(() => Number(localStorage.getItem("score.2048") || 0));
    expect(stored).toBeGreaterThanOrEqual(score);

    // a short swipe is ignored (under the 24px threshold)
    if (touch) {
      const before = await tiles2048(page);
      await swipe(page, "#board", 10, 0);
      await page.waitForTimeout(170);
      expect(await tiles2048(page)).toBe(before);
    }

    // leaving and coming back restores the same board
    const snapshot = await tiles2048(page);
    if (!(await page.locator("#modal.show").count())) {
      await page.goto("index.html");
      await expect(page.locator(".game-card", { hasText: "2048" }).locator(".chip").first()).not.toHaveText("🏆 —");
      await page.goto("games/2048.html");
      expect(await tiles2048(page)).toBe(snapshot);
    }

    // New game resets
    await press(page.locator("#new"), touch);
    await expect(page.locator("#board .tile")).toHaveCount(2);
    await expect(page.locator("#score")).toHaveText("0");
  });
});

test.describe("Goo Pipes", () => {
  const boardCount = (page) => page.evaluate(() => game.board.flat().filter((p) => p && p.type !== "S").length);

  test("fits the screen with the whole board visible", async ({ page }) => {
    await page.goto("games/goopipes.html");
    await expectNoHorizontalOverflow(page, "goopipes");
    const box = await page.locator("#board").boundingBox();
    const vp = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    // a cell must be big enough to hit with a finger
    const cell = await page.evaluate(() => cellPx);
    expect(cell).toBeGreaterThanOrEqual(44);
  });

  test("places pipes by tapping/clicking squares and by keyboard", async ({ page, touch }) => {
    await page.goto("games/goopipes.html");
    const box = await page.locator("#board").boundingBox();
    const cell = await page.evaluate(() => cellPx);
    const start = await page.evaluate(() => game.startPos);
    // pick three empty cells away from the pump
    const targets = [[0, 0], [6, 9], [0, 9]].filter(([r, c]) => r !== start.r || c !== start.c);
    for (const [r, c] of targets) {
      const nextType = await page.evaluate(() => game.queue[0]);
      const x = box.x + c * cell + cell / 2, y = box.y + r * cell + cell / 2;
      if (touch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      expect(await page.evaluate(([r, c]) => game.board[r][c] && game.board[r][c].type, [r, c])).toBe(nextType);
    }
    expect(await boardCount(page)).toBe(targets.length);

    if (!touch) {
      // keyboard: move the cursor to an empty square and press Enter
      await page.evaluate(() => { cursor.r = 3; cursor.c = 0; });
      if (start.r === 3 && start.c === 1) await page.keyboard.press("ArrowDown");
      else await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      expect(await boardCount(page)).toBe(targets.length + 1);
    }
  });

  test("a round ends when the goo escapes, and New game restarts", async ({ page, touch }) => {
    await page.goto("games/goopipes.html");
    await press(page.locator("#fast"), touch); // fast goo, no pipes laid → spills almost at once
    await expect(page.locator("#modal.show")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("#modalBtns button").first()).toBeVisible();
    await press(page.locator("#modalBtns button").first(), touch);
    await expect(page.locator("#modal.show")).toHaveCount(0);
    expect(await page.evaluate(() => game.phase)).not.toBe("done");
  });
});
