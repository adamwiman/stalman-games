// Glosjakten: the menu, picking words and a level, whole rounds through the real
// UI (taps on iPad, clicks on desktop), the on-screen keyboard and the real one,
// stickers in the album, My misses, the hub trophy, and that everything fits.
"use strict";
const { test, expect, press, seedStorage, expectNoHorizontalOverflow } = require("./fixtures");

// skips the pop/shake/confetti animations; game logic is unchanged
test.use({ reducedMotion: "reduce" });

const level = (page, i) => page.locator(`.level[data-lvl="${i}"]`);
const chip = (page, id) => page.locator(`.chip[data-act="area"][data-v="${id}"]`);
const stat = (page, i) => page.locator(".bar .stat .n").nth(i);
const question = (page) => page.evaluate(() => { const q = currentQ(activeRound()); return { target: q.target, answer: q.answer, options: q.options, slots: q.slots, en: BY[q.target].en, sv: BY[q.target].sv }; });
const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("state.glosor")));

async function expectTapTargets(page, selector, min = 44) {
  const small = await page.evaluate(({ selector, min }) => [...document.querySelectorAll(selector)]
    .filter((el) => el.offsetParent !== null)
    .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.getAttribute("aria-label") || el.textContent).trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((b) => b.w < min || b.h < min), { selector, min });
  expect(small, `tap targets smaller than ${min}px`).toEqual([]);
}
// Everything a question needs (and the keyboard) is on the screen without scrolling.
async function expectFits(page, label, selector) {
  await expectNoHorizontalOverflow(page, label);
  const box = await page.locator(selector).boundingBox();
  expect(box.y + box.height, `${label}: ${selector} fits vertically`).toBeLessThanOrEqual(page.viewportSize().height);
}
async function next(page, touch) {
  await expect.poll(() => page.evaluate(() => Date.now() >= guardUntil)).toBe(true);
  await press(page.locator('.sheet [data-act="next"]'), touch);
}
async function pick(page, touch, text) {
  await press(page.locator(".opts .opt", { hasText: new RegExp(`^${text}$`) }), touch);
}
// Opens a mode, picks the words and the level.
async function open(page, touch, mode, area, lvl) {
  await press(page.locator(`.mode[data-mode="${mode}"]`), touch);
  if (area) await press(chip(page, area), touch);
  await press(level(page, lvl), touch);
  await expect(page.locator(".play")).toBeVisible();
}
async function typeOnScreen(page, touch, text) {
  for (const ch of text) await press(page.locator(`.kbd .key[data-k="${ch}"]`), touch);
}

test("menu is in Swedish, shows the five ways to practise, fits the screen and links back to the hub", async ({ page, touch }) => {
  await page.goto("games/glosor.html");
  await expect(page).toHaveTitle("Glosjakten");
  await expect(page.locator("h1")).toHaveText("Glosjakten");
  await expect(page.locator(".mode .nm")).toHaveText(["Bilder", "Engelska → svenska", "Svenska → engelska", "Skriv klart", "Skriv ordet"]);
  await expect(page.locator(".mode .tag")).toHaveText(Array(5).fill("🐣 Lätt"));
  await expect(page.locator(".record")).toHaveText("📒 Svara rätt på ett ord tre gånger så får du ditt första klistermärke!");
  await expect(page.locator(".hubnav a.back")).toHaveText("← Spel");
  await expectNoHorizontalOverflow(page, "menu");
  await expectTapTargets(page, ".mode, .hubnav a.back, .menu .btn");

  await press(page.locator('[data-act="about"]'), touch);
  await expect(page.locator(".modal h3")).toHaveText("📖 Om spelet");
  await expect(page.locator(".modal li")).toHaveCount(7);
  await press(page.locator('.modal [data-m="close"]'), touch);

  // the setup: which words and the level
  await press(page.locator('.mode[data-mode="bilder"]'), touch);
  await expect(page.locator(".topbar h2")).toHaveText("🖼️ Bilder");
  await expect(page.locator('.chip[data-act="area"]')).toHaveCount(12);
  await expect(chip(page, "alla")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "missar")).toBeDisabled();
  await expect(chip(page, "missar")).toHaveText("🎯 Mina missar (0)");
  await expect(page.locator(".level .nm")).toHaveText(["Lätt", "Mellan", "Svår", "Geni", "Omöjliga"]);
  await expect(level(page, 0).locator(".ds")).toHaveText("3 svar att välja på · de lättaste orden");
  for (let i = 1; i < 5; i++) await expect(level(page, i)).toHaveClass(/locked/);
  await press(level(page, 2), touch);
  await expect(page.locator(".menumsg")).toHaveText("Svår är låst. Klara Mellan först!");
  await expect(page.locator(".rules")).toHaveText("ℹ️ 10 frågor. För att klara en nivå och låsa upp nästa: Lätt 7, Mellan 8, Svår 8, Geni 9, Omöjliga 10 rätt.");
  await expectNoHorizontalOverflow(page, "setup");
  await expectTapTargets(page, ".chip, .level, .topbar .btn");
  // the choice of words is remembered
  await press(chip(page, "djur"), touch);
  await expect(chip(page, "djur")).toHaveAttribute("aria-pressed", "true");
  await press(page.locator('[data-act="menu"]'), touch);
  await press(page.locator('.mode[data-mode="bilder"]'), touch);
  await expect(chip(page, "djur")).toHaveAttribute("aria-pressed", "true");
});

test("a whole round of Bilder on Lätt: right and wrong answers, the result, Mellan unlocks", async ({ page, touch }) => {
  await page.goto("games/glosor.html");
  await open(page, touch, "bilder", "djur", 0);
  await expect(page.locator(".ptitle b")).toHaveText("🖼️ Bilder");
  await expect(page.locator(".ptitle small")).toHaveText("🐣 Lätt · Djur");
  await expect(page.locator(".ask")).toHaveText("Vilket engelskt ord passar bilden?");
  await expect(page.locator(".opts .opt")).toHaveCount(3);
  await expect(page.locator(".hubnav a.back")).toBeHidden();
  await expectFits(page, "question", ".opts");
  await expectTapTargets(page, ".opt, .bar .btn");

  for (let i = 0; i < 10; i++) {
    const q = await question(page);
    expect(q.options).toContain(q.en);
    if (i === 3) {
      // a wrong answer: the right one is shown, with the word card
      const wrong = q.options.find((o) => o !== q.en);
      await pick(page, touch, wrong);
      await expect(page.locator(".sheet.bad .msg")).toHaveText("❌ Inte riktigt");
      await expect(page.locator(".sheet .why")).toHaveText(`Bilden är ”${q.en}” (${q.sv}). Du valde ”${wrong}”.`);
      await expect(page.locator(".opt.right")).toHaveText(new RegExp(`^${q.en}`));
      await expect(page.locator(".opt.wrong")).toHaveText(new RegExp(`^${wrong}`));
    } else {
      await pick(page, touch, q.en);
      await expect(page.locator(".sheet.ok")).toBeVisible();
    }
    await expect(page.locator(".sheet .wcard b")).toHaveText(q.en);
    await expect(page.locator(".sheet .wcard .info span").first()).toHaveText(`🇸🇪 ${q.sv}`);
    await expect(stat(page, 0)).toHaveText(`${i + 1}/10`);
    if (i === 0) await expectFits(page, "answer", ".sheet");
    await next(page, touch);
  }
  await expect(page.locator(".summary h2")).toHaveText("Nivån är klarad!");
  await expect(page.locator(".summary .lead")).toHaveText("Du hade 9 av 10 rätt på Lätt.");
  await expect(page.locator(".summary .unlock")).toHaveText("🔓 Du har låst upp 🎒 Mellan!");
  await expect(page.locator(".summary .btn")).toHaveText(["Prova Mellan", "Spela igen", "Byt nivå", "Meny"]);
  await expect(page.locator(".summary h3.practise")).toHaveText("Öva mer på");
  await expect(page.locator(".missed.practise .stile")).toHaveCount(1);
  const s = await save(page);
  expect(s.prog.bilder).toEqual({ u: 1, b: [9, 0, 0, 0, 0], c: [1, 0, 0, 0, 0] });
  // the missed word is a miss, unless it came back later in the round and was answered right twice
  expect(Object.keys(s.miss).length).toBeLessThanOrEqual(1);

  await press(page.locator('.summary [data-act="nextlvl"]'), touch);
  await expect(page.locator(".ptitle small")).toHaveText("🎒 Mellan · Djur");
  await expect(page.locator(".opts .opt")).toHaveCount(4);
});

test("stickers: the third right answer gives one, the album shows it, and the hub trophy counts them", async ({ page, touch }) => {
  await seedStorage(page, { "state.glosor": { album: { dog: 2, cat: 2, horse: 2, cow: 2, pig: 2, bird: 2, fish: 2 }, pref: { sven: { area: "djur" } } } });
  await page.goto("games/glosor.html");
  await open(page, touch, "sven", null, 0);
  const q = await question(page);
  await expect(page.locator(".ask")).toHaveText(`Vad heter ${q.sv} på engelska?`);
  await pick(page, touch, q.en);
  await expect(page.locator(".sheet .wcard .new")).toHaveText("⭐ Nytt klistermärke!");
  expect(await page.evaluate(() => localStorage.getItem("score.glosor"))).toBe("1");

  // a round that is stopped early keeps the sticker
  await press(page.locator('[data-act="quit"]'), touch);
  await expect(page.locator(".modal h3")).toHaveText("Avsluta?");
  await press(page.locator('.modal [data-m="quit"]'), touch);
  await press(page.locator('[data-act="menu"]'), touch);
  await expect(page.locator(".record")).toHaveText("📒 Klistermärken i albumet: 1 av 176");

  await press(page.locator('[data-act="album"]'), touch);
  await expect(page.locator(".topbar h2")).toHaveText("📒 Mitt album");
  await expect(page.locator(".albumpage .record")).toHaveText("1 av 176 klistermärken · 🏅 0 av 10 medaljer");
  const animals = page.locator('section[data-cat="djur"]');
  await expect(animals.locator("h3")).toHaveText("🐾 Djur 1 av 23");
  await expect(animals.locator(`.stile[data-w="${q.target}"]`)).toHaveClass(/yes/);
  await expect(animals.locator('.stile.no[data-w="owl"] .dots')).toHaveText("○○○");
  await expect(animals.locator(".stile.no").first().locator(".dots")).toHaveText(/●●○|○○○/);
  await expectNoHorizontalOverflow(page, "album");
  await press(animals.locator('.stile[data-w="owl"]'), touch);
  await expect(page.locator(".modal .wcard.big b")).toHaveText("owl");
  await expect(page.locator(".modal .wcard.big .info span").first()).toHaveText("🇸🇪 uggla");
  await press(page.locator('.modal [data-m="close"]'), touch);

  await page.goto("index.html");
  await expect(page.locator(".game-card", { hasText: "Glosjakten" }).locator(".chip").first()).toHaveText("🏆 1");
});

test("a whole category gives its medal", async ({ page }) => {
  const album = {};
  for (const w of ["red", "blue", "green", "yellow", "black", "white", "pink", "brown", "grey", "purple", "turquoise", "dark blue", "light green"]) album[w] = 3;
  await seedStorage(page, { "state.glosor": { album } });
  await page.goto("games/glosor.html");
  await page.evaluate(() => showAlbum());
  await expect(page.locator('section[data-cat="farger"] .done')).toHaveText("🏅 Medalj!");
  await expect(page.locator('section[data-cat="djur"] .done')).toHaveCount(0);
  await expect(page.locator(".albumpage .record")).toHaveText("13 av 176 klistermärken · 🏅 1 av 10 medaljer");
  await page.evaluate(() => showSetup("bilder"));
  await expect(chip(page, "farger")).toHaveText("🎨 Färger 🏅");
});

test("Skriv klart: the missing letters with the on-screen keyboard, delete, and a wrong answer", async ({ page, touch }) => {
  await page.goto("games/glosor.html");
  await open(page, touch, "luckor", "djur", 0);
  let q = await question(page);
  await expect(page.locator(".ask")).toHaveText(`Skriv klart det engelska ordet för ${q.sv}`);
  await expect(page.locator(".slots .slot")).toHaveCount(q.en.length);
  await expect(page.locator(".slots .slot.given").first()).toHaveText(q.en[0]);
  await expect(page.locator('.kbd [data-act="submit"]')).toBeDisabled();
  await expect(page.locator('.kbd .key[data-k=" "]')).toHaveCount(0);     // spaces are given
  await expectFits(page, "keyboard", ".kbd");
  await expectTapTargets(page, ".key");
  const missing = q.slots.map((s, i) => (s === null ? q.en[i] : "")).join("");
  await typeOnScreen(page, touch, "x");
  await expect(page.locator(".slots .slot:not(.given)").first()).toHaveText("x");
  await press(page.locator('.kbd .key[data-k="back"]'), touch);
  await expect(page.locator(".slots .slot.cur")).toHaveCount(1);
  await typeOnScreen(page, touch, missing);
  await expect(page.locator('.kbd [data-act="submit"]')).toBeEnabled();
  await press(page.locator('.kbd [data-act="submit"]'), touch);
  await expect(page.locator(".sheet.ok")).toBeVisible();
  await expect(page.locator(".slots.right")).toBeVisible();
  await expect(page.locator(".kbd")).toHaveCount(0);
  await next(page, touch);

  // a wrong letter
  q = await question(page);
  const blanks = q.slots.filter((s) => s === null).length;
  await typeOnScreen(page, touch, "z".repeat(blanks));
  await press(page.locator('.kbd [data-act="submit"]'), touch);
  await expect(page.locator(".sheet.bad .why")).toHaveText(new RegExp(`^Du skrev ”.+”\\. Det stavas ”${q.en}”\\.$`));
  await expect(page.locator(".slots.wrong")).toBeVisible();
});

test("Skriv ordet with the real keyboard: spaces, Backspace, Enter and American spelling", async ({ page, touch }) => {
  test.skip(touch, "the real keyboard is tested on desktop; the on-screen one on iPad");
  await seedStorage(page, { "state.glosor": { prog: { stava: { u: 2 } }, pref: { stava: { area: "farger" } } } });
  await page.goto("games/glosor.html");
  await open(page, false, "stava", null, 2);
  await page.evaluate(() => { const q = currentQ(activeRound()); q.target = "grey"; renderPlay(); });
  await expect(page.locator(".ask")).toHaveText("Skriv grå på engelska");
  await expect(page.locator(".typed")).toBeVisible();
  await expect(page.locator(".slots")).toHaveCount(0);
  await page.keyboard.type("grax");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("Y");
  await expect(page.locator(".typed")).toHaveText("gray");
  await page.keyboard.press("Enter");
  await expect(page.locator(".sheet.ok .why")).toHaveText("Det räknas! I brittisk engelska skriver man oftast ”grey”.");
  await page.keyboard.press("Enter");     // Enter on the sheet goes on (after the short guard)
  await expect.poll(async () => { await page.keyboard.press("Enter"); return page.locator(".sheet").count(); }).toBe(0);

  await page.evaluate(() => { const q = currentQ(activeRound()); q.target = "dark blue"; renderPlay(); });
  await page.keyboard.type("dark  blue");
  await expect(page.locator(".typed")).toHaveText("dark blue");
  await page.keyboard.press("Enter");
  await expect(page.locator(".sheet.ok")).toBeVisible();
  await expect(stat(page, 1)).toHaveText("2");
});

test("Mina missar opens with six missed words and only asks about them", async ({ page, touch }) => {
  const miss = { owl: 2, frog: 2, snake: 2, tiger: 2, spider: 3, turtle: 2, rabbit: 1 };
  await seedStorage(page, { "state.glosor": { miss } });
  await page.goto("games/glosor.html");
  await press(page.locator('.mode[data-mode="ensv"]'), touch);
  await expect(chip(page, "missar")).toBeEnabled();
  await expect(chip(page, "missar")).toHaveText("🎯 Mina missar (6)");   // tiger is not a word in the game
  await press(chip(page, "missar"), touch);
  await press(level(page, 0), touch);
  await expect(page.locator(".ptitle small")).toHaveText("🐣 Lätt · Mina missar");
  const asked = new Set();
  for (let i = 0; i < 4; i++) {
    const q = await question(page);
    asked.add(q.target);
    await expect(page.locator(".word span").first()).toHaveText(q.en);
    await pick(page, touch, q.sv);
    await next(page, touch);
  }
  expect([...asked].every((w) => ["owl", "frog", "snake", "spider", "turtle", "rabbit"].includes(w))).toBe(true);
});

test("Omöjliga: six answers fit the screen, and a misspelling is explained", async ({ page, touch }) => {
  await seedStorage(page, { "state.glosor": { prog: { sven: { u: 4 } }, pref: { sven: { area: "djur" } } } });
  await page.goto("games/glosor.html");
  await open(page, touch, "sven", null, 4);
  await expect(page.locator(".opts .opt")).toHaveCount(6);
  await expectFits(page, "Omöjliga", ".opts");
  const q = await question(page);
  const wrong = await page.evaluate(() => { const q = currentQ(activeRound()); return q.options.find((o) => o !== q.answer && !BY[o]); });
  await pick(page, touch, wrong);
  await expect(page.locator(".sheet .why")).toHaveText(`”${wrong}” är felstavat. Det stavas ”${q.en}”.`);
});

test("every way of practising fits the screen on its hardest level", async ({ page }) => {
  await seedStorage(page, { "state.glosor": { prog: { bilder: { u: 4 }, ensv: { u: 4 }, sven: { u: 4 }, luckor: { u: 4 }, stava: { u: 4 } } } });
  await page.goto("games/glosor.html");
  for (const mode of ["bilder", "ensv", "sven", "luckor", "stava"]) {
    for (const lvl of [0, 4]) {
      await page.evaluate(({ mode, lvl }) => startRound(mode, lvl), { mode, lvl });
      const sel = mode === "luckor" || mode === "stava" ? ".kbd" : ".opts";
      await expectFits(page, `${mode} ${lvl}`, sel);
    }
  }
});
