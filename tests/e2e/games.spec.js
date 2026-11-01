// 2048 and Rörmokaren (formerly Slemrören / Goo Pipes): real input (keyboard on desktop, touch on iPad),
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

test.describe("Rörmokaren (formerly Slemrören / Goo Pipes)", () => {
  const boardCount = (page) => page.evaluate(() => game.board.flat().filter((p) => p && p.type !== "S").length);
  const diffButton = (page, id) => page.locator(`#levels .level[data-diff="${id}"]`);
  async function pick(page, touch, id) {
    await press(diffButton(page, id), touch);
    await expect(page.locator("#play")).toBeVisible();
    await expect(page.locator("#modal")).toBeHidden();
  }
  async function spill(page, touch) {
    await press(page.locator("#fast"), touch); // fast water, no pipes laid → spills almost at once
    await expect(page.locator("#modal")).toBeVisible({ timeout: 20000 });
  }

  test("starts on a menu in the hub's style: the name, the three difficulties and the record", async ({ page, touch }) => {
    await page.goto("games/goopipes.html");
    await expect(page.locator("html")).toHaveAttribute("lang", "sv");
    await expect(page).toHaveTitle("Rörmokaren");
    await expect(page.locator("h1")).toHaveText("Rörmokaren");
    await expect(page.locator(".hubnav a.back")).toHaveText("← Spel");
    // the hub's sky-blue page, with the thick ink borders of the other games
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(221, 241, 255)");
    expect(await page.evaluate(() => getComputedStyle(document.querySelector(".level")).borderTopWidth)).toBe("3px");
    await expect(page.locator(".pickh")).toHaveText("Välj svårighet");
    await expect(page.locator("#levels .level .nm")).toHaveText(["Lätt", "Mellan", "Svår"]);
    await expect(page.locator("#levels .level .ds")).toHaveText(["Lugnt vatten och korta rör", "Lite snabbare vatten", "Snabbt vatten och långa rör"]);
    // Lätt is suggested the first time, nothing runs until you pick
    await expect(diffButton(page, "latt")).toHaveClass(/pref/);
    await expect(diffButton(page, "latt").locator(".tag")).toHaveText("Senast");
    await expect(page.locator("#resume")).toBeHidden();
    await expect(page.locator("#record")).toHaveText("🏆 Hur långt kan du leda vattnet?");
    expect(await page.evaluate(() => game)).toBeNull();
    await expectNoHorizontalOverflow(page, "menu");

    await press(page.locator("#rules"), touch);
    await expect(page.locator("#modalTitle")).toHaveText("📖 Så spelar du");
    await expect(page.locator("#modal li")).toHaveCount(7);
    await press(page.locator("#modalBtns .btn"), touch);
    await expect(page.locator("#modal")).toBeHidden();
  });

  test("Meny pauses the round, Fortsätt spelet goes back, and the last difficulty is remembered", async ({ page, touch }) => {
    await page.goto("games/goopipes.html");
    await pick(page, touch, "mellan");
    await expect(page.locator(".hubnav a.back")).toBeHidden();
    await expect(page.locator("#diff")).toHaveText("🚿 Mellan");
    await expect(page.locator("#dist")).toHaveText("0/6");
    await expect(page.locator(".stat .l")).toHaveText(["poäng", "rekord", "nivå", "rör"]);
    await expect(page.locator("#status")).toHaveText(/^VATTNET KOMMER OM 1[56] s$/);
    expect(await page.evaluate(() => game.params)).toEqual({ required: 6, fillMs: 3400, countdownMs: 16000, fastMs: 110 });

    // the menu: the round waits behind it, and Fortsätt spelet goes back to it
    await press(page.locator("#menuBtn"), touch);
    await expect(page.locator("#menu")).toBeVisible();
    await expect(page.locator(".pickh")).toHaveText("Eller börja om");
    await expect(page.locator("#resume")).toContainText("Fortsätt spelet");
    await expect(page.locator("#resume")).toContainText("Mellan · nivå 1 · 0 poäng");
    await expect(diffButton(page, "mellan")).toHaveClass(/pref/);
    const left = await page.evaluate(() => game.countLeft);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => game.countLeft)).toBe(left);
    await press(page.locator("#resume"), touch);
    await expect(page.locator("#play")).toBeVisible();
    await expect.poll(() => page.evaluate(() => game.countLeft)).toBeLessThan(left);

    // with points on the board, a new difficulty asks first
    await page.evaluate(() => addScore(150));
    await press(page.locator("#menuBtn"), touch);
    await press(diffButton(page, "svar"), touch);
    await expect(page.locator("#modalTitle")).toHaveText("Börja ett nytt spel?");
    await expect(page.locator("#modalText")).toHaveText("Du är på nivå 1 med 150 poäng. Det spelet försvinner om du börjar om.");
    await press(page.locator("#modalBtns .btn", { hasText: "Fortsätt det gamla" }), touch);
    await expect(page.locator("#play")).toBeVisible();
    expect(await page.evaluate(() => [game.difficulty, game.score])).toEqual(["mellan", 150]);

    // the last choice is remembered
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("state.goopipes")))).toEqual({ difficulty: "mellan" });
    await page.reload();
    await expect(diffButton(page, "mellan")).toHaveClass(/pref/);
    await expect(page.locator("#record")).toHaveText("🏆 Rekord: 150");
    await pick(page, touch, "svar");
    await expect(page.locator("#dist")).toHaveText("0/8");
  });

  test("fits the screen with the whole board visible", async ({ page, touch }) => {
    await page.goto("games/goopipes.html");
    await expectNoHorizontalOverflow(page, "plumber menu");
    await pick(page, touch, "latt");
    await expectNoHorizontalOverflow(page, "plumber");
    const box = await page.locator("#board").boundingBox();
    const vp = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    expect(box.y + box.height, "the board fits vertically").toBeLessThanOrEqual(vp.height);
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
      // nothing can be laid while the menu shows
      await page.keyboard.press("Escape");
      await expect(page.locator("#menu")).toBeVisible();
      await page.evaluate(() => tryPlace(6, 0));
      expect(await boardCount(page)).toBe(targets.length + 1);
    }
  });

  test("a round ends when the water spills: Försök igen keeps the difficulty, Byt svårighet goes to the menu", async ({ page, touch }) => {
    await page.goto("games/goopipes.html");
    await pick(page, touch, "latt");
    await spill(page, touch);
    await expect(page.locator("#modalTitle")).toHaveText("Vattnet rann ut! 💦");
    await expect(page.locator("#modalText")).toHaveText("Röret blev 0 långt, men målet var 5.");
    await expect(page.locator("#status")).toHaveText("RUNDAN ÄR SLUT");
    await expect(page.locator("#modalBtns .btn")).toHaveText(["Försök igen", "Byt svårighet"]);
    await press(page.locator("#modalBtns .btn").first(), touch);
    await expect(page.locator("#modal")).toBeHidden();
    expect(await page.evaluate(() => [game.phase, game.difficulty])).toEqual(["countdown", "latt"]);

    await spill(page, touch);
    await press(page.locator("#modalBtns .btn", { hasText: "Byt svårighet" }), touch);
    await expect(page.locator("#menu")).toBeVisible();
    await expect(page.locator(".pickh")).toHaveText("Välj svårighet");
    await expect(page.locator("#resume")).toBeHidden();
    await pick(page, touch, "svar");
    expect(await page.evaluate(() => [game.phase, game.difficulty, game.level, game.score])).toEqual(["countdown", "svar", 1, 0]);
  });

  test("a level is cleared when the pipe is long enough", async ({ page, touch }) => {
    await page.goto("games/goopipes.html");
    await pick(page, touch, "latt");
    // a straight pipe of six from the pump (the goal on Lätt level 1 is five)
    await page.evaluate(() => {
      const s = { r: 3, c: 1, dir: "R" };
      game.board = emptyBoard(); game.startPos = s; game.board[3][1] = makeStart("R");
      for (let c = 2; c <= 7; c++) game.board[3][c] = makePiece("H");
    });
    await press(page.locator("#fast"), touch);
    await expect(page.locator("#modalTitle")).toHaveText("Nivå 1 klar! 🎉", { timeout: 20000 });
    await expect(page.locator("#modalText")).toHaveText("Röret blev 6 långt (målet var 5) – längdbonus +100. Nu blir vattnet snabbare …");
    await press(page.locator("#modalBtns .btn", { hasText: "Nästa nivå" }), touch);
    await expect(page.locator("#level")).toHaveText("2");
    await expect(page.locator("#dist")).toHaveText("0/6");
  });
});
