// 2048 and Slemrören (Goo Pipes): real input (keyboard on desktop, touch on iPad),
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

test.describe("Slemrören (Goo Pipes)", () => {
  const boardCount = (page) => page.evaluate(() => game.board.flat().filter((p) => p && p.type !== "S").length);
  const diffButton = (page, id) => page.locator(`#modalBtns button.diff[data-diff="${id}"]`);
  async function pick(page, touch, id) {
    await press(diffButton(page, id), touch);
    await expect(page.locator("#modal.show")).toHaveCount(0);
  }

  test("is in Swedish on a white background, and asks for a difficulty first", async ({ page, touch }) => {
    await page.goto("games/goopipes.html");
    await expect(page.locator("html")).toHaveAttribute("lang", "sv");
    await expect(page).toHaveTitle("Slemrören");
    await expect(page.locator("a.back")).toHaveText("← Spel");
    await expect(page.locator(".box .lbl")).toHaveText(["POÄNG", "REKORD", "NIVÅ", "RÖR"]);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(255, 255, 255)");

    // the picker: Lätt is suggested the first time, nothing runs until you pick
    await expect(page.locator("#modalTitle")).toHaveText("Välj svårighet");
    await expect(page.locator("#modalBtns button.diff span")).toHaveText(["Lätt", "Mellan", "Svår"]);
    await expect(diffButton(page, "latt")).toHaveClass(/pref/);
    await expect(page.locator("#modalBtns button", { hasText: "Fortsätt" })).toHaveCount(0);
    expect(await page.evaluate(() => game)).toBeNull();

    await pick(page, touch, "mellan");
    await expect(page.locator("#diff")).toHaveText("MELLAN");
    await expect(page.locator("#dist")).toHaveText("0/6");
    await expect(page.locator("#status")).toHaveText(/^SLEMMET KOMMER OM 1[56] s$/);
    expect(await page.evaluate(() => game.params)).toEqual({ required: 6, fillMs: 3400, countdownMs: 16000, fastMs: 110 });

    // Nytt spel opens the picker and the round waits behind it; Fortsätt goes back
    await press(page.locator("#new"), touch);
    await expect(diffButton(page, "mellan")).toHaveClass(/pref/);
    const left = await page.evaluate(() => game.countLeft);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => game.countLeft)).toBe(left);
    await press(page.locator("#modalBtns button", { hasText: "Fortsätt" }), touch);
    await expect(page.locator("#modal.show")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => game.countLeft)).toBeLessThan(left);

    // the last choice is remembered
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("state.goopipes")))).toEqual({ difficulty: "mellan" });
    await page.reload();
    await expect(diffButton(page, "mellan")).toHaveClass(/pref/);
    await pick(page, touch, "svar");
    await expect(page.locator("#dist")).toHaveText("0/8");
  });

  test("fits the screen with the whole board visible", async ({ page, touch }) => {
    await page.goto("games/goopipes.html");
    await expectNoHorizontalOverflow(page, "goopipes picker");
    await pick(page, touch, "latt");
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
    await pick(page, touch, "latt");
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
      // with a finger nothing is drawn over the pipe just laid; with the mouse the
      // cursor stays there and shows it would be replaced, without a preview piece
      expect(await page.evaluate(() => cursorAim())).toEqual(touch ? null : { r, c, mode: "replace" });
    }
    expect(await boardCount(page)).toBe(targets.length);

    if (!touch) {
      // keyboard: move the cursor to an empty square and press Enter
      await page.evaluate(() => { cursor.r = 3; cursor.c = 0; });
      if (start.r === 3 && start.c === 1) await page.keyboard.press("ArrowDown");
      else await page.keyboard.press("ArrowRight");
      const aim = await page.evaluate(() => cursorAim());
      expect(aim.mode).toBe("place");
      await page.keyboard.press("Enter");
      expect(await boardCount(page)).toBe(targets.length + 1);
    }
  });

  test("a round ends when the goo escapes: Försök igen keeps the difficulty, Byt svårighet asks again", async ({ page, touch }) => {
    await page.goto("games/goopipes.html");
    await pick(page, touch, "latt");
    await press(page.locator("#fast"), touch); // fast goo, no pipes laid → spills almost at once
    await expect(page.locator("#modal.show")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("#modalTitle")).toHaveText("Slemmet rann ut! ☠️");
    await expect(page.locator("#status")).toHaveText("RUNDAN ÄR SLUT");
    await expect(page.locator("#modalBtns button")).toHaveText(["Försök igen", "Byt svårighet"]);
    await press(page.locator("#modalBtns button").first(), touch);
    await expect(page.locator("#modal.show")).toHaveCount(0);
    expect(await page.evaluate(() => [game.phase, game.difficulty])).toEqual(["countdown", "latt"]);

    await press(page.locator("#fast"), touch);
    await expect(page.locator("#modal.show")).toBeVisible({ timeout: 20000 });
    await press(page.locator("#modalBtns button", { hasText: "Byt svårighet" }), touch);
    await expect(page.locator("#modalTitle")).toHaveText("Välj svårighet");
    await expect(page.locator("#modalBtns button", { hasText: "Fortsätt" })).toHaveCount(0);
    await pick(page, touch, "svar");
    expect(await page.evaluate(() => [game.phase, game.difficulty, game.level, game.score])).toEqual(["countdown", "svar", 1, 0]);
  });
});
