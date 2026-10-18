// Gångertabellen: the three practice modes through the real UI (number pad
// with quick finger taps on iPad, keyboard on desktop), the counters, wrong
// answers, the end screen, saved choices and the hub trophy.
"use strict";
const { test, expect, press, seedStorage, expectNoHorizontalOverflow } = require("./fixtures");

// skips confetti; game logic is unchanged
test.use({ reducedMotion: "reduce" });

const act = (page, name) => page.locator(`#app [data-act="${name}"]`).first();
const stat = (page, name) => page.locator(`[data-stat="${name}"] .n`);
const big = (page, name) => page.locator(`[data-sum="${name}"] b`);
const key = (page, k) => page.locator(`.numpad .key[data-k="${k}"]`);
const table = (page, t) => page.locator(`.tgrid .tbtn[data-v="${t}"]`);

async function question(page) {
  const q = page.locator(".q");
  await expect(q).toHaveText(/^\d+ · \d+$/);
  const a = Number(await q.getAttribute("data-a"));
  const b = Number(await q.getAttribute("data-b"));
  await expect(q).toHaveText(`${a} · ${b}`);
  return { a, b, answer: a * b, key: a + "x" + b };
}

// Type and send an answer: quick finger taps on the number pad on iPad
// (as a child would type), the keyboard on desktop.
async function sendAnswer(page, touch, value) {
  const digits = String(value);
  if (touch) {
    // raw taps don't scroll, so make sure the whole pad is on screen first
    await key(page, "ok").scrollIntoViewIfNeeded();
    for (const d of digits) {
      const b = await key(page, d).boundingBox();
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    }
    await expect(page.locator(".ans"), "every digit registered exactly once").toHaveText(digits);
    await press(key(page, "ok"), touch);
  } else {
    await page.keyboard.type(digits);
    await expect(page.locator(".ans")).toHaveText(digits);
    await page.keyboard.press("Enter");
  }
}

// A pad tap that ends a round swallows the screen's next click for a moment
// (so the same finger can't hit a button on the result screen by accident).
async function waitForGhostGuard(page) {
  await expect.poll(() => page.evaluate(() => Date.now() >= ghostUntil)).toBe(true);
}

async function expectTapTargets(page, selector, min = 44) {
  const small = await page.evaluate(({ selector, min }) => [...document.querySelectorAll(selector)]
    .filter((el) => el.offsetParent !== null)
    .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.getAttribute("aria-label") || el.textContent).trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((b) => b.w < min || b.h < min), { selector, min });
  expect(small, `tap targets smaller than ${min}px`).toEqual([]);
}

// The question and the whole number pad are on screen without scrolling.
async function expectPlayFits(page, label) {
  await expectNoHorizontalOverflow(page, label);
  const vp = page.viewportSize();
  for (const sel of [".bar", ".question", ".numpad"]) {
    const box = await page.locator(sel).boundingBox();
    expect(box.y, `${label}: ${sel} top`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${label}: ${sel} fits vertically`).toBeLessThanOrEqual(vp.height);
  }
  await expectTapTargets(page, ".numpad .key, .bar .btn", 44);
}

test("menu is in Swedish, offers the three modes, fits the screen and links back to the hub", async ({ page }) => {
  await page.goto("games/gangertabell.html");
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.locator("h1")).toHaveText("Gångertabellen");
  await expect(page.locator(".mode .nm")).toHaveText(["Fri träning", "Tabellmix", "Tabelltrappan"]);
  await expect(page.locator(".sub")).toContainText("ingen klocka");
  await expect(page.locator(".hubnav a.back")).toBeVisible();
  await expect(page.locator(".hubnav a.back")).toHaveText("← Spel");
  await expect(page.locator(".record")).toContainText("Hur många rätt i rad");
  await expectNoHorizontalOverflow(page, "menu");
  await expectTapTargets(page, ".mode, .hubnav a.back");
});

test("Fri träning: counters, a wrong answer shows the right one, quitting shows the result and the record", async ({ page, touch }) => {
  test.setTimeout(60000);
  await page.goto("games/gangertabell.html");
  await press(act(page, "free"), touch);
  await expect(page.locator(".modename")).toContainText("Fri träning");
  await expect(page.locator(".modename small")).toHaveText("Alla tabeller 1–10");
  await expect(page.locator(".progress")).toHaveCount(0); // no end, so no progress bar
  await expect(stat(page, "asked")).toHaveText("0");
  await expect(stat(page, "correct")).toHaveText("0");
  await expect(stat(page, "streak")).toHaveText("0");
  await expect(page.locator(".hubnav a.back")).toBeHidden(); // during play you leave with Avsluta
  await expectPlayFits(page, "free");

  const seen = [];
  for (let i = 1; i <= 5; i++) {
    const q = await question(page);
    seen.push(q.key);
    await sendAnswer(page, touch, q.answer);
    await expect(stat(page, "asked")).toHaveText(String(i));
    await expect(stat(page, "correct")).toHaveText(String(i));
    await expect(stat(page, "streak")).toHaveText(String(i));
    await expect(page.locator(".feedback.ok")).toContainText(`${q.a} · ${q.b} = ${q.answer}`);
  }
  expect(await page.evaluate(() => localStorage.getItem("score.gangertabell")), "record saved as you go").toBe("5");

  // a wrong answer: counted, the right answer is shown, the pad waits for Nästa
  const miss = await question(page);
  seen.push(miss.key);
  await sendAnswer(page, touch, miss.answer + 1);
  await expect(stat(page, "asked")).toHaveText("6");
  await expect(stat(page, "correct")).toHaveText("5");
  await expect(stat(page, "streak")).toHaveText("0");
  await expect(page.locator(".feedback.bad")).toContainText(`Inte riktigt. ${miss.a} · ${miss.b} = ${miss.answer}`);
  await expect(page.locator(".ans.bad")).toHaveText(String(miss.answer + 1));
  await expect(page.locator(".q")).toHaveText(`${miss.a} · ${miss.b}`);
  await expect(key(page, "5")).toBeDisabled();
  if (!touch) {
    await page.keyboard.type("7"); // ignored while the right answer is shown
    await expect(page.locator(".ans")).toHaveText(String(miss.answer + 1));
  }
  await expectPlayFits(page, "free, wrong answer");
  await press(act(page, "next"), touch);
  await expect(page.locator(".feedback")).toHaveText("");
  await expect(page.locator(".ans")).toHaveText("?");
  await expect(key(page, "5")).toBeEnabled();
  seen.push((await question(page)).key);
  expect(seen.every((k, i) => i === 0 || k !== seen[i - 1]), "never the same question twice in a row").toBe(true);

  // Avsluta asks first; "Fortsätt räkna" goes back to the same question
  const before = await question(page);
  await press(act(page, "quit"), touch);
  await expect(page.locator(".modal h3")).toHaveText("Vill du sluta nu?");
  await expect(page.locator(".modal")).toContainText("6 frågor");
  await expect(page.locator(".modal")).toContainText("5 rätt");
  await press(page.locator('.modal [data-m="close"]'), touch);
  await expect(page.locator(".modal-back")).toHaveCount(0);
  expect((await question(page)).key).toBe(before.key);

  await press(act(page, "quit"), touch);
  await press(page.locator('.modal [data-m="stop"]'), touch);
  await expect(page.locator(".summary h2")).toHaveText("Snyggt jobbat!");
  await expect(page.locator(".summary .lead")).toHaveText("Du svarade på 6 frågor och fick 5 rätt.");
  await expect(big(page, "asked")).toHaveText("6");
  await expect(big(page, "correct")).toHaveText("5");
  await expect(big(page, "streak")).toHaveText("5");
  await expect(page.locator(".newrec")).toHaveText("🏆 Nytt rekord: 5 rätt i rad!");
  await expect(page.locator(".missed li")).toHaveText([`${miss.a} · ${miss.b} = ${miss.answer}`]);
  await expectNoHorizontalOverflow(page, "summary");
  await expectTapTargets(page, ".summary .btn");

  await press(act(page, "menu"), touch);
  await expect(page.locator(".record")).toHaveText("🏆 Ditt rekord: 5 rätt i rad");
  await press(page.locator(".hubnav a.back"), touch);
  await expect(page.locator(".game-card", { hasText: "Gångertabellen" }).locator(".chip").first()).toHaveText("🏆 5");
});

test("Tabellmix: pick tables, every question comes exactly once, then the result", async ({ page, touch }) => {
  test.setTimeout(90000);
  await page.goto("games/gangertabell.html");
  await press(act(page, "mix"), touch);
  await expect(page.locator(".picker h2")).toContainText("Tabellmix");
  await expect(act(page, "start")).toBeDisabled();
  await expect(act(page, "start")).toHaveText("Välj minst en tabell");
  await expectNoHorizontalOverflow(page, "mix picker");
  await expectTapTargets(page, ".tbtn, .picker .btn");

  await press(table(page, 3), touch);
  await press(table(page, 7), touch);
  await expect(table(page, 3)).toHaveAttribute("aria-pressed", "true");
  await expect(table(page, 7)).toHaveAttribute("aria-pressed", "true");
  await expect(table(page, 5)).toHaveAttribute("aria-pressed", "false");
  await expect(act(page, "start")).toHaveText("Starta – 20 frågor");
  await press(table(page, 3), touch); // tap again to unpick
  await expect(act(page, "start")).toHaveText("Starta – 10 frågor");
  await press(act(page, "all"), touch);
  await expect(act(page, "start")).toHaveText("Starta – 100 frågor");
  await press(act(page, "none"), touch);
  await expect(act(page, "start")).toBeDisabled();
  await press(table(page, 7), touch);
  await press(table(page, 3), touch);
  await press(act(page, "start"), touch);

  await expect(page.locator(".modename small")).toHaveText("Tabell 3 och 7");
  await expect(page.locator(".progress .ptext")).toHaveText("0 av 20 klara");
  await expectPlayFits(page, "mix");

  const seen = [];
  for (let i = 0; i < 20; i++) {
    const q = await question(page);
    expect([3, 7], `${q.a} · ${q.b} is from a chosen table`).toContain(q.a);
    seen.push(q.key);
    const wrong = i === 4 || i === 19; // one in the middle, and the very last
    await sendAnswer(page, touch, wrong ? q.answer + 10 : q.answer);
    if (wrong) {
      await expect(act(page, "next")).toHaveText(i === 19 ? "Se resultatet" : "Nästa");
      await expect(page.locator(".progress .ptext")).toHaveText(`${i + 1} av 20 klara`);
      if (touch) await waitForGhostGuard(page);
      await press(act(page, "next"), touch);
    } else if (i < 19) {
      await expect(page.locator(".progress .ptext")).toHaveText(`${i + 1} av 20 klara`);
    }
  }
  expect(new Set(seen).size, "no question twice").toBe(20);
  const expected = [];
  for (const t of [3, 7]) for (let b = 1; b <= 10; b++) expected.push(t + "x" + b);
  expect([...seen].sort()).toEqual(expected.sort());
  expect(seen.join(), "shuffled, not in table order").not.toBe(expected.join());

  await expect(page.locator(".summary h2")).toHaveText("Snyggt jobbat!");
  await expect(page.locator(".summary .lead")).toHaveText("Du svarade på alla 20 frågorna och fick 18 rätt.");
  await expect(big(page, "asked")).toHaveText("20");
  await expect(big(page, "correct")).toHaveText("18");
  await expect(page.locator(".missed li")).toHaveCount(2);
  await expectNoHorizontalOverflow(page, "mix summary");

  // Spela igen: same tables, fresh counters
  await press(act(page, "again"), touch);
  await expect(page.locator(".modename small")).toHaveText("Tabell 3 och 7");
  await expect(page.locator(".progress .ptext")).toHaveText("0 av 20 klara");
  await expect(stat(page, "asked")).toHaveText("0");

  // the chosen tables are remembered, also after a reload
  await page.reload();
  await press(act(page, "mix"), touch);
  await expect(table(page, 3)).toHaveAttribute("aria-pressed", "true");
  await expect(table(page, 7)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.tbtn[aria-pressed="true"]')).toHaveCount(2);
});

test("Tabelltrappan: one table in order from 1 to 10, then the next table is offered", async ({ page, touch }) => {
  test.setTimeout(60000);
  await page.goto("games/gangertabell.html");
  await press(act(page, "ladder"), touch);
  await expect(page.locator(".picker h2")).toContainText("Tabelltrappan");
  await expectNoHorizontalOverflow(page, "ladder picker");
  await press(table(page, 7), touch);

  await expect(page.locator(".modename small")).toHaveText("7:ans tabell");
  await expect(page.locator(".progress .ptext")).toHaveText("0 av 10 klara");
  await expect(page.locator(".steps .step")).toHaveCount(10);
  await expect(page.locator(".steps .step.cur")).toHaveText("7·1");
  await expectPlayFits(page, "ladder");

  for (let b = 1; b <= 10; b++) {
    const q = await question(page);
    expect([q.a, q.b], "in order").toEqual([7, b]);
    await sendAnswer(page, touch, q.answer);
    if (b < 10) {
      await expect(page.locator(".steps .step.ok")).toHaveCount(b);
      await expect(page.locator(".steps .step.ok").last()).toHaveText(`7·${b}=${7 * b}`);
      await expect(page.locator(".steps .step.cur")).toHaveText(`7·${b + 1}`);
    }
  }
  await expect(page.locator(".summary h2")).toHaveText("Alla rätt! 🌟");
  await expect(page.locator(".summary .lead")).toHaveText("Du gick hela vägen uppför 7:ans tabell och fick 10 av 10 rätt.");
  await expect(big(page, "streak")).toHaveText("10");
  await expect(page.locator(".missed")).toHaveCount(0);
  if (touch) {
    expect(await page.evaluate(() => ghostUntil > 0), "the last pad tap changed the screen, so its click is guarded").toBe(true);
    await waitForGhostGuard(page);
  }

  await expect(act(page, "nexttable")).toHaveText("Ta 8:ans tabell");
  await press(act(page, "nexttable"), touch);
  await expect(page.locator(".modename small")).toHaveText("8:ans tabell");
  expect((await question(page)).key).toBe("8x1");

  // the picker marks the table you played last
  await press(act(page, "quit"), touch); // nothing answered → straight to the menu
  await expect(page.locator("h1")).toHaveText("Gångertabellen");
  await press(act(page, "ladder"), touch);
  await expect(table(page, 8).locator(".tag")).toHaveText("senast");
});

test("a wrong answer in Tabelltrappan is marked on the steps", async ({ page, touch }) => {
  await page.goto("games/gangertabell.html");
  await press(act(page, "ladder"), touch);
  await press(table(page, 9), touch);
  await sendAnswer(page, touch, 9);
  await sendAnswer(page, touch, 17);
  await expect(page.locator(".steps .step.bad")).toHaveText("9·2=18");
  await expect(page.locator(".steps .step.cur")).toHaveCount(0); // not moved on yet
  await press(act(page, "next"), touch);
  await expect(page.locator(".steps .step.cur")).toHaveText("9·3");
  await expect(stat(page, "asked")).toHaveText("2");
  await expect(stat(page, "correct")).toHaveText("1");
});

test("number pad and keyboard: backspace, max three digits, empty answers are not counted", async ({ page, touch }) => {
  await page.goto("games/gangertabell.html");
  await press(act(page, "ladder"), touch);
  await press(table(page, 10), touch); // every answer has 2–3 digits
  await expect(key(page, "ok")).toBeDisabled();
  await expect(key(page, "del")).toBeDisabled();
  const ans = page.locator(".ans");
  await expect(ans).toHaveText("?");

  if (!touch) {
    await page.keyboard.press("Enter"); // empty: nothing happens
    await expect(stat(page, "asked")).toHaveText("0");
  }
  for (const d of ["4", "2"]) await press(key(page, d), touch);
  await expect(ans).toHaveText("42");
  await press(key(page, "del"), touch);
  await expect(ans).toHaveText("4");
  for (const d of ["5", "6", "7"]) await press(key(page, d), touch);
  await expect(ans).toHaveText("456"); // at most three digits
  if (!touch) {
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await expect(ans).toHaveText("?");
    await page.keyboard.type("0");
    await page.keyboard.type("5");
    await expect(ans).toHaveText("5"); // a leading zero is replaced
    await page.keyboard.press("Backspace");
    // clicking pad keys with the mouse doesn't leave focus on them, so Enter sends the answer
    await page.locator('.numpad .key[data-k="1"]').click();
    await page.locator('.numpad .key[data-k="0"]').click();
    await page.keyboard.press("Enter");
  } else {
    for (let i = 0; i < 3; i++) await press(key(page, "del"), touch);
    await expect(ans).toHaveText("?");
    await press(key(page, "1"), touch);
    await press(key(page, "0"), touch);
    await press(key(page, "ok"), touch);
  }
  await expect(stat(page, "asked")).toHaveText("1");
  await expect(stat(page, "correct")).toHaveText("1"); // 10 · 1 = 10
  expect((await question(page)).key).toBe("10x2");
});

test("quitting before answering goes straight back to the menu; Escape asks on desktop", async ({ page, touch }) => {
  await page.goto("games/gangertabell.html");
  await press(act(page, "free"), touch);
  await press(act(page, "quit"), touch);
  await expect(page.locator(".modal-back")).toHaveCount(0);
  await expect(page.locator("h1")).toHaveText("Gångertabellen");
  await expect(page.locator(".hubnav a.back")).toBeVisible();

  if (!touch) {
    await press(act(page, "free"), touch);
    const q = await question(page);
    await sendAnswer(page, touch, q.answer);
    await page.keyboard.press("Escape");
    await expect(page.locator(".modal h3")).toHaveText("Vill du sluta nu?");
    await page.keyboard.press("Escape");
    await expect(page.locator(".modal-back")).toHaveCount(0);
    await page.keyboard.type("1");
    await expect(page.locator(".ans")).toHaveText("1"); // typing works again after closing
  }
});

test("corrupt saved data does not break the game", async ({ page, touch }) => {
  await seedStorage(page, { "state.gangertabell": "{not json", "score.gangertabell": "abc" });
  await page.goto("games/gangertabell.html");
  await expect(page.locator(".record")).toContainText("Hur många rätt i rad");
  await press(act(page, "mix"), touch);
  await expect(page.locator('.tbtn[aria-pressed="true"]')).toHaveCount(0);
});
