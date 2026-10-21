// Detektiven: the level picker and unlocking, a whole case played through the
// real UI (taps on iPad, clicks on desktop), mistakes for guesses and wrong
// answers, hints, saved cases, the hub trophy, and that the board fits.
"use strict";
const { test, expect, press, seedStorage, expectNoHorizontalOverflow } = require("./fixtures");

// skips the flip/confetti animations and the short pause before the result; game logic is unchanged
test.use({ reducedMotion: "reduce" });

const card = (page, p) => page.locator(`.card[data-p="${p}"]`);
const level = (page, i) => page.locator(`.level[data-lvl="${i}"]`);
const stat = (page, name) => page.locator(`[data-stat="${name}"] .n`);

// Somebody the revealed clues prove, and what they are (asks the game's own solver).
const provableOne = (page) => page.evaluate(() => {
  const f = provable(G), p = bitsOf(f.crim | f.inno)[0];
  return { p, s: (f.crim >>> p) & 1, name: G.P.names[p] };
});
// Somebody the clues can't decide yet (or -1).
const unprovableOne = (page) => page.evaluate(() => {
  const f = provable(G), free = bitsOf(ALL & ~G.S.known & ~(f.crim | f.inno));
  return free.length ? free[0] : -1;
});

async function choose(page, touch, p, s) {
  await press(card(page, p), touch);
  await expect(page.locator(".modal h3")).toHaveText(/^Vad är /);
  await press(page.locator(`.modal [data-m="${s ? "crim" : "inno"}"]`), touch);
  await expect(page.locator(".modal-back")).toHaveCount(0);
}
async function startLevel(page, touch, i) {
  await press(level(page, i), touch);
  await expect(page.locator(".card")).toHaveCount(20, { timeout: 30000 });
}
async function expectTapTargets(page, selector, min = 44) {
  const small = await page.evaluate(({ selector, min }) => [...document.querySelectorAll(selector)]
    .filter((el) => el.offsetParent !== null)
    .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.getAttribute("aria-label") || el.textContent).trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((b) => b.w < min || b.h < min), { selector, min });
  expect(small, `tap targets smaller than ${min}px`).toEqual([]);
}
// No card cuts off its text, and every name shows in full, clear of the corner marks.
async function expectCardsFit(page, label) {
  const clipped = await page.evaluate(() => [...document.querySelectorAll(".card")]
    .filter((c) => c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1)
    .map((c) => c.querySelector(".nm").textContent));
  expect(clipped, `${label}: cards that cut off their text`).toEqual([]);
  const hidden = await page.evaluate(() => [...document.querySelectorAll(".card")].flatMap((c) => {
    const nm = c.querySelector(".nm"), n = nm.getBoundingClientRect(), box = c.getBoundingClientRect();
    const out = [];
    if (n.left < box.left || n.right > box.right) out.push(nm.textContent + " past the edge");
    for (const sel of [".badge", ".coord"]) {
      const e = c.querySelector(sel); if (!e) continue;
      const r = e.getBoundingClientRect();
      if (r.left < n.right - 1 && r.right > n.left + 1 && r.top < n.bottom - 1 && r.bottom > n.top + 1) out.push(`${nm.textContent} under ${sel}`);
    }
    return out;
  }));
  expect(hidden, `${label}: names that don't show in full`).toEqual([]);
}
// Everybody but one revealed (the hardest moment for the layout).
const revealAllButOne = (page) => page.evaluate(() => {
  let left = bitsOf(ALL & ~G.S.known);
  while (left.length > 1) { const f = provable(G), p = bitsOf(f.crim | f.inno)[0]; mark(G, p, (f.crim >>> p) & 1); left = bitsOf(ALL & ~G.S.known); }
  refreshBoard();
});

test("menu is in Swedish, shows the five levels with only Lätt open, fits the screen and links back to the hub", async ({ page, touch }) => {
  await page.goto("games/detektiven.html");
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.locator("h1")).toHaveText("Detektiven");
  await expect(page.locator(".level .nm")).toHaveText(["Lätt", "Mellan", "Svår", "Geni", "Omöjliga"]);
  await expect(page.locator(".level.locked")).toHaveCount(4);
  await expect(level(page, 0)).not.toHaveClass(/locked/);
  await expect(level(page, 1).locator(".ds")).toHaveText("Lös ett fall på Lätt för att låsa upp.");
  await expect(page.locator(".record")).toHaveText("🏆 Lös ditt första fall!");
  await expect(page.locator(".hubnav a.back")).toHaveText("← Spel");
  await expectNoHorizontalOverflow(page, "menu");
  await expectTapTargets(page, ".level, .hubnav a.back, .menu .btn");

  // a locked level only says what to do
  await press(level(page, 2), touch);
  await expect(page.locator(".menumsg")).toHaveText("Svår är låst. Lös ett fall på Mellan först!");
  await expect(page.locator(".card")).toHaveCount(0);

  // the rules
  await press(page.locator('[data-act="rules"]'), touch);
  await expect(page.locator(".rules h3").first()).toHaveText("📖 Så spelar du");
  await expect(page.locator(".rules")).toContainText("Du får inte gissa.");
  await expect(page.locator(".rules")).toContainText("skurkgranne");
  await press(page.locator('.modal [data-m="close"]'), touch);
  await expect(page.locator(".modal-back")).toHaveCount(0);
});

test("a whole Lätt case through the UI: guesses and wrong answers are mistakes, hints, dimming, the result, Mellan unlocks and the hub trophy", async ({ page, touch }) => {
  test.setTimeout(120000);
  await page.goto("games/detektiven.html");
  await startLevel(page, touch, 0);
  await expect(page.locator(".casename b")).toContainText("Lätt");
  await expect(page.locator(".casename small")).toHaveText("Fall 1");
  await expect(page.locator(".card.inno, .card.crim")).toHaveCount(1);
  await expect(stat(page, "found")).toHaveText("1");
  await expect(stat(page, "mistakes")).toHaveText("0");
  await expect(page.locator(".msg")).toContainText("Börja med ledtråden från");
  await expect(page.locator(".hubnav a.back")).toBeHidden();
  await expectNoHorizontalOverflow(page, "board");
  await expectTapTargets(page, ".card, .bar .btn");
  const start = await page.evaluate(() => G.pz.start);
  await expect(card(page, start).locator(".clue")).not.toBeEmpty();

  // a guess: the clues don't prove it yet → mistake, nothing revealed
  const guess = await unprovableOne(page);
  if (guess >= 0) {
    await choose(page, touch, guess, 1);
    await expect(page.locator(".msg.bad")).toContainText("Det går inte att bevisa än");
    await expect(stat(page, "mistakes")).toHaveText("1");
    await expect(card(page, guess)).not.toHaveClass(/inno|crim/);
  }
  // the opposite of what the clues prove → mistake
  const sure = await provableOne(page);
  await choose(page, touch, sure.p, 1 - sure.s);
  await expect(page.locator(".msg.bad")).toContainText(`Ledtrådarna säger något annat om ${sure.name}`);
  const mistakes = guess >= 0 ? 2 : 1;
  await expect(stat(page, "mistakes")).toHaveText(String(mistakes));
  // the right answer reveals the person and their clue
  await choose(page, touch, sure.p, sure.s);
  await expect(card(page, sure.p)).toHaveClass(sure.s ? /crim/ : /inno/);
  await expect(card(page, sure.p).locator(".clue")).not.toBeEmpty();
  await expect(page.locator(".msg.ok")).toContainText(`${sure.name} är ${sure.s ? "skurk" : "oskyldig"}`);
  await expect(stat(page, "found")).toHaveText("2");

  // a colour note on an unknown person, then cancel
  const other = await page.evaluate(() => bitsOf(ALL & ~G.S.known)[0]);
  await press(card(page, other), touch);
  await press(page.locator('.modal [data-note="bla"]'), touch);
  await expect(card(page, other)).toHaveClass(/n-bla/);
  await press(card(page, other), touch);
  await expect(page.locator('.modal [data-note="bla"]')).toHaveAttribute("aria-pressed", "true");
  await press(page.locator('.modal [data-m="close"]'), touch);

  // tapping a revealed clue dims it, tapping again brings it back
  await press(card(page, start), touch);
  await expect(card(page, start)).toHaveClass(/dim/);
  await expect(page.locator(".modal-back")).toHaveCount(0);
  await press(card(page, start), touch);
  await expect(card(page, start)).not.toHaveClass(/dim/);

  // hint: first the clues to look at, then the people
  await press(page.locator('[data-act="hint"]'), touch);
  await expect(page.locator(".msg.tip")).toContainText("💡 Titta noga på ledtråden från");
  expect(await page.locator(".card.hl-clue").count()).toBeGreaterThan(0);
  await expect(page.locator(".card.hl-cell")).toHaveCount(0);
  await press(page.locator('[data-act="hint"]'), touch);
  await expect(page.locator(".msg.tip")).toContainText("💡 Nu kan du lista ut vad");
  expect(await page.locator(".card.hl-cell").count()).toBeGreaterThan(0);
  await expect(page.locator('[data-act="hint"]')).toBeDisabled();
  const hinted = await page.evaluate(() => VIEW.hint.cells[0]);
  const hs = await page.evaluate((p) => (G.pz.truth >>> p) & 1, hinted);
  await choose(page, touch, hinted, hs);
  await expect(page.locator(".card.hl-clue, .card.hl-cell")).toHaveCount(0);
  await expect(page.locator('[data-act="hint"]')).toBeEnabled();

  // play the rest
  // the game clears G as soon as the case is solved; the board stays until the summary replaces it
  const solved = () => page.evaluate(() => !G);
  for (let i = 0; i < 20; i++) {
    if (await solved()) break;
    const next = await provableOne(page);
    await choose(page, touch, next.p, next.s);
    if (await solved()) break;
    await expect(card(page, next.p)).toHaveClass(next.s ? /crim/ : /inno/);
  }
  await expect(page.locator(".summary h2")).toHaveText("Fallet är löst!");
  await expect(page.locator(".summary .lead")).toHaveText(/^Du hittade alla \d+ skurkarna på nivå Lätt\.$/);
  await expect(page.locator('[data-sum="mistakes"] b')).toHaveText(String(mistakes));
  await expect(page.locator('[data-sum="hints"] b')).toHaveText("2");
  await expect(page.locator(".unlock")).toHaveText("🔓 Du har låst upp 🔎 Mellan!");
  await expect(page.locator(".solved span")).toHaveCount(20);
  await expect(page.locator(".solved span.miss")).toHaveCount(guess >= 0 && guess !== sure.p ? 2 : 1);
  await expectNoHorizontalOverflow(page, "summary");
  await expectTapTargets(page, ".summary .btn");
  expect(await page.evaluate(() => localStorage.getItem("score.detektiven"))).toBe("1");

  // back in the menu: Mellan is open, the case is gone, the trophy counts it
  await press(page.locator('[data-act="new"]'), touch);
  await expect(level(page, 1)).not.toHaveClass(/locked/);
  await expect(level(page, 2)).toHaveClass(/locked/);
  await expect(level(page, 0).locator(".tag")).toHaveText("1 löst fall");
  await expect(page.locator(".resume")).toHaveCount(0);
  await expect(page.locator(".record")).toHaveText("🏆 Lösta fall: 1");
  await press(page.locator(".hubnav a.back"), touch);
  await expect(page.locator(".game-card", { hasText: "Detektiven" }).locator(".chip").first()).toHaveText("🏆 1");
});

test("a case in progress is saved: reload, Fortsätt fallet, and starting a new one asks first", async ({ page, touch }) => {
  test.setTimeout(60000);
  await page.goto("games/detektiven.html");
  await startLevel(page, touch, 0);
  for (let i = 0; i < 3; i++) { const n = await provableOne(page); await choose(page, touch, n.p, n.s); }
  const guess = await unprovableOne(page);
  if (guess >= 0) await choose(page, touch, guess, 0);
  const before = await page.evaluate(() => ({ known: G.S.known, mistakes: G.mistakes, names: G.P.names }));

  await page.reload();
  await expect(page.locator(".resume")).toContainText("Fortsätt fallet");
  await expect(page.locator(".resume")).toContainText("Lätt · 4 av 20 avslöjade");
  await press(page.locator(".resume"), touch);
  await expect(page.locator(".card.inno, .card.crim")).toHaveCount(4);
  expect(await page.evaluate(() => ({ known: G.S.known, mistakes: G.mistakes, names: G.P.names }))).toEqual(before);
  await expect(stat(page, "mistakes")).toHaveText(String(before.mistakes));

  // Meny keeps the case; a new case asks first
  await press(page.locator('[data-act="menu"]'), touch);
  await press(level(page, 0), touch);
  await expect(page.locator(".modal h3")).toHaveText("Börja ett nytt fall?");
  await press(page.locator('.modal [data-m="close"]'), touch);
  expect(await page.evaluate(() => G.S.known)).toBe(before.known);
  await press(page.locator('[data-act="menu"]'), touch);
  await press(level(page, 0), touch);
  await press(page.locator('.modal [data-m="new"]'), touch);
  await expect(page.locator(".card.inno, .card.crim")).toHaveCount(1, { timeout: 30000 });
  await expect(stat(page, "mistakes")).toHaveText("0");
});

test("every level can be played once unlocked, and the board fits with every clue showing", async ({ page, touch }) => {
  test.setTimeout(120000);
  await seedStorage(page, { "state.detektiven": { prog: { unlocked: 4, solved: [1, 1, 1, 1, 0] } } });
  await page.goto("games/detektiven.html");
  await expect(page.locator(".level.locked")).toHaveCount(0);
  await expect(page.locator(".record")).toHaveText("🏆 Lösta fall: 4");
  for (let i = 0; i < 5; i++) {
    await press(level(page, i), touch);
    if (i > 0) { // the case from the level before is not solved, so it asks first
      await expect(page.locator(".modal h3")).toHaveText("Börja ett nytt fall?");
      await press(page.locator('.modal [data-m="new"]'), touch);
    }
    await expect(page.locator(".card")).toHaveCount(20, { timeout: 30000 });
    const name = await page.evaluate(() => LEVELS[G.pz.level].name);
    expect(name).toBe(["Lätt", "Mellan", "Svår", "Geni", "Omöjliga"][i]);
    await expect(page.locator(".casename b")).toContainText(name);
    await expectCardsFit(page, name + " at the start");
    await revealAllButOne(page);
    await expect(page.locator(".card.inno, .card.crim")).toHaveCount(19);
    await expectNoHorizontalOverflow(page, name);
    await expectCardsFit(page, name);
    const vp = page.viewportSize();
    const box = await page.locator(".board").boundingBox();
    if (vp.width > 640 && vp.height > 520) expect(box.y + box.height, `${name}: board fits on screen`).toBeLessThanOrEqual(vp.height + 1);
    await press(page.locator('[data-act="menu"]'), touch);
  }
});

test("corrupt saved data does not break the game", async ({ page, touch }) => {
  await seedStorage(page, { "state.detektiven": "{not json", "score.detektiven": "abc" });
  await page.goto("games/detektiven.html");
  await expect(page.locator(".level.locked")).toHaveCount(4);
  await expect(page.locator(".resume")).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem("state.detektiven", JSON.stringify({ prog: { unlocked: 2 }, game: { pz: { v: 1, truth: 5 }, order: [3] } })));
  await page.reload();
  await expect(page.locator(".level.locked")).toHaveCount(2);
  await expect(page.locator(".resume")).toHaveCount(0);
  await startLevel(page, touch, 2);
  await expect(page.locator(".casename b")).toContainText("Svår");
});

// Phones: names and clues must show in full (they used to be cut to "A…"),
// with the board scrolling instead. Run once per desktop engine at phone size.
for (const phone of [
  { name: "iPhone 15 Pro", viewport: { width: 393, height: 659 } },
  { name: "iPhone SE", viewport: { width: 375, height: 667 } }
]) {
  test.describe(`on a phone (${phone.name})`, () => {
    test.use({ viewport: phone.viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });

    test("every name and clue shows in full on every level, centred on the card", async ({ page, touch }, testInfo) => {
      test.skip(!testInfo.project.name.startsWith("desktop"), "phone sizes are tested from the desktop projects");
      test.setTimeout(120000);
      await seedStorage(page, { "state.detektiven": { prog: { unlocked: 4, solved: [1, 1, 1, 1, 0] } } });
      await page.goto("games/detektiven.html");
      await expectNoHorizontalOverflow(page, "menu");
      for (let i = 0; i < 5; i++) {
        await press(level(page, i), touch);
        if (i > 0) await press(page.locator('.modal [data-m="new"]'), touch);
        await expect(page.locator(".card")).toHaveCount(20, { timeout: 30000 });
        const name = ["Lätt", "Mellan", "Svår", "Geni", "Omöjliga"][i];
        await expectCardsFit(page, `${phone.name} ${name} at the start`);
        await revealAllButOne(page);
        await expectNoHorizontalOverflow(page, `${phone.name} ${name}`);
        await expectCardsFit(page, `${phone.name} ${name}`);
        await expectTapTargets(page, ".card, .bar .btn");
        // name, job and clue are centred on the card
        const offCentre = await page.evaluate(() => [...document.querySelectorAll(".card")].flatMap((c) => {
          const box = c.getBoundingClientRect(), mid = box.left + box.width / 2;
          return [".nm", ".job", ".clue"].map((sel) => c.querySelector(sel)).filter(Boolean)
            .filter((e) => { const r = e.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - mid) > 3; })
            .map((e) => `${c.querySelector(".nm").textContent} ${e.className}`);
        }));
        expect(offCentre, `${phone.name} ${name}: text that is not centred`).toEqual([]);
        await press(page.locator('[data-act="menu"]'), touch);
      }
    });
  });
}
