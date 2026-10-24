// Jorden runt: every mode through the real UI (taps on iPad, clicks on desktop),
// levels unlocking, wrong answers, Mina missar, the passport, the hub trophy,
// that the flags look like the originals, and that the screens fit without
// sideways scrolling.
"use strict";
const { test, expect, press, seedStorage, expectNoHorizontalOverflow } = require("./fixtures");

// skips confetti and animations; game logic is unchanged
test.use({ reducedMotion: "reduce" });

const GAME = "games/jordenrunt.html";
const STATE = "state.jordenrunt";

// The current question, read from the game.
const question = (page) => page.evaluate(() => {
  const Q = activeRound(), q = currentQ(Q);
  return q && Object.assign({}, q, { big: q.type === "hilo" ? (BY[q.pair[0]][q.metric] > BY[q.pair[1]][q.metric] ? q.pair[0] : q.pair[1]) : null, k: BY[q.target] ? BY[q.target].k : null });
});
// A tap that answers swallows the next tap for a moment (ghost-tap guard).
const waitGuard = (page) => expect.poll(() => page.evaluate(() => Date.now() >= guardUntil)).toBe(true);

async function answerRight(page, touch) {
  const q = await question(page);
  if (q.type === "choice") await press(page.locator(`.opts [data-act="pick"][data-c="${q.target}"]`), touch);
  else if (q.type === "continent") await press(page.locator(`[data-act="cont"][data-k="${q.k}"]`), touch);
  else if (q.type === "hilo") await press(page.locator(`[data-act="hilo"][data-c="${q.big}"]`), touch);
  else if (q.type === "mystery") await press(page.locator(`[data-act="guess"][data-c="${q.target}"]`), touch);
  else if (q.type === "sort") {
    for (const c of q.answer) await press(page.locator(`[data-act="sortpick"][data-c="${c}"]`), touch);
    await press(page.locator('[data-act="sortdone"]'), touch);
  }
  await expect(page.locator(".sheet.ok")).toBeVisible();
  return q;
}
async function next(page, touch) {
  await waitGuard(page);
  await press(page.locator('.sheet [data-act="next"]'), touch);
}
async function openMode(page, touch, mode) {
  await press(page.locator(`.mode[data-mode="${mode}"]`), touch);
  await expect(page.locator(".setup h2")).toBeVisible();
}
async function startLevel(page, touch, lvl) {
  await press(page.locator(`.level[data-lvl="${lvl}"]`), touch);
  await expect(page.locator(".play")).toBeVisible();
}
const saved = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), STATE);

// Every visible button is big enough for a finger.
async function expectTapTargets(page, selector, min = 44) {
  const small = await page.evaluate(({ selector, min }) => [...document.querySelectorAll(selector)]
    .filter((el) => el.offsetParent !== null)
    .map((el) => { const r = el.getBoundingClientRect(); return { t: el.textContent.trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((b) => b.w < min || b.h < min), { selector, min });
  expect(small, `tap targets smaller than ${min}px`).toEqual([]);
}
// Everything you answer with is on screen without scrolling.
async function expectOnScreen(page, selector, label) {
  const vp = page.viewportSize();
  const boxes = await page.locator(selector).evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
  expect(boxes.length, label).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.top, `${label}: top`).toBeGreaterThanOrEqual(0);
    expect(b.bottom, `${label}: fits vertically`).toBeLessThanOrEqual(vp.height + 1);
  }
}

test("menu is in Swedish, shows the six games and links back to the hub", async ({ page }) => {
  await page.goto(GAME);
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page).toHaveTitle("Jorden runt");
  await expect(page.locator("h1")).toHaveText("Jorden runt");
  await expect(page.locator(".mode .nm")).toHaveText(["Flaggor", "Huvudstäder", "Storleksordning", "Världsdelar", "Högre eller lägre", "Mysterielandet"]);
  await expect(page.locator(".mode .tag")).toHaveText(Array(6).fill("🐣 Lätt"));
  await expect(page.locator(".hubnav a.back")).toHaveText("← Spel");
  await expect(page.locator(".tools .btn")).toHaveText(["🛂 Mitt pass", "📖 Om spelet"]);
  await expectNoHorizontalOverflow(page, "menu");
  await expectTapTargets(page, ".mode, .tools .btn, a.back");
});

test("Flaggor: a perfect round on Lätt unlocks Mellan and fills the passport", async ({ page, touch }) => {
  await page.goto(GAME);
  await openMode(page, touch, "flaggor");
  await expect(page.locator(".level .nm")).toHaveText(["Lätt", "Mellan", "Svår", "Geni", "Omöjliga"]);
  await expect(page.locator(".level.locked")).toHaveCount(4);
  // a locked level only explains itself
  await press(page.locator('.level[data-lvl="2"]'), touch);
  await expect(page.locator(".menumsg")).toHaveText("Svår är låst. Klara Mellan först!");
  await expectNoHorizontalOverflow(page, "setup");

  await startLevel(page, touch, 0);
  const seen = [];
  for (let i = 1; i <= 10; i++) {
    await expect(page.locator(".stat .n").first()).toHaveText(`${i}/10`);
    const q = await question(page);
    expect(q.dir).toBe("f2n");
    await expect(page.locator(".ask")).toHaveText("Vilket land har den här flaggan?");
    await expect(page.locator(".opts .opt")).toHaveCount(3);
    if (i === 1) {
      await expectNoHorizontalOverflow(page, "flag question");
      await expectOnScreen(page, ".bigflag, .opts .opt", "flag question");
      await expectTapTargets(page, ".opts .opt, .bar .btn");
    }
    seen.push((await answerRight(page, touch)).target);
    await expect(page.locator(".opt.right")).toHaveAttribute("data-c", seen[seen.length - 1]);
    if (i === 1) await expectOnScreen(page, '.sheet [data-act="next"]', "Nästa button");
    await next(page, touch);
  }
  expect(new Set(seen).size, "ten different countries").toBe(10);
  await expect(page.locator(".summary h2")).toHaveText("Alla rätt – perfekt!");
  await expect(page.locator('[data-sum="right"] b')).toHaveText("10/10");
  await expect(page.locator(".unlock")).toHaveText("🔓 Du har låst upp 🎒 Mellan!");
  const s = await saved(page);
  expect(s.prog.flaggor).toEqual({ u: 1, b: [10, 0, 0, 0, 0], c: [1, 0, 0, 0, 0] });
  expect(Object.keys(s.pass).sort()).toEqual(seen.slice().sort());

  await press(page.locator('[data-act="setup"]'), touch);
  await expect(page.locator(".level.locked")).toHaveCount(3);
  await expect(page.locator('.level[data-lvl="0"] .tag')).toHaveText("✓ Bäst: 10 av 10");
  await press(page.locator('[data-act="menu"]'), touch);
  await expect(page.locator(".mode[data-mode=flaggor] .tag")).toHaveText("🎒 Mellan");
});

test("Flaggor: land → flagga shows flags to pick from, and a wrong answer explains itself", async ({ page, touch }) => {
  await seedStorage(page, { [STATE]: { pref: { flaggor: { dir: "n2f" } }, prog: { flaggor: { u: 3 } } } });
  await page.goto(GAME);
  await openMode(page, touch, "flaggor");
  await expect(page.locator('.chip[data-act="dir"][aria-pressed="true"]')).toHaveText("Land → flagga");
  await startLevel(page, touch, 3);   // Geni: 6 flags
  const q = await question(page);
  await expect(page.locator(".ask")).toContainText("Vilken flagga har");
  await expect(page.locator(".opts.flags .opt")).toHaveCount(6);
  await expectNoHorizontalOverflow(page, "flag options");
  await expectOnScreen(page, ".opts.flags .opt", "six flags");
  const wrong = q.options.find((c) => c !== q.target);
  await press(page.locator(`.opts [data-c="${wrong}"]`), touch);
  await expect(page.locator(".sheet.bad .msg")).toHaveText("❌ Inte riktigt");
  await expect(page.locator(".sheet .why")).toContainText("Det var");
  await expect(page.locator(".opt.wrong")).toHaveAttribute("data-c", wrong);
  await expect(page.locator(".opt.right")).toHaveAttribute("data-c", q.target);
  await expect(page.locator(".sheet .lcard b")).toHaveText(await page.evaluate((c) => BY[c].n, q.target));
  expect((await saved(page)).miss).toEqual({ [q.target]: 2 });
  // the guard: Nästa right after the answer does nothing, a moment later it works
  await page.evaluate(() => { guardUntil = Date.now() + 100000; });
  await press(page.locator('.sheet [data-act="next"]'), touch);
  await expect(page.locator(".stat .n").first()).toHaveText("1/10");
  await page.evaluate(() => { guardUntil = 0; });
  await next(page, touch);
  await expect(page.locator(".stat .n").first()).toHaveText("2/10");
  await expect(page.locator(".stat.good .n")).toHaveText("0");
  // leaving in the middle asks first
  await press(page.locator('[data-act="quit"]'), touch);
  await expect(page.locator(".modal h3")).toHaveText("Avsluta?");
  await press(page.locator('.modal [data-m="quit"]'), touch);
  await expect(page.locator(".setup h2")).toHaveText("🚩 Flaggor");
});

test("Huvudstäder: both directions, and the capital quiz stays in the chosen continent", async ({ page, touch }) => {
  await page.goto(GAME);
  await openMode(page, touch, "huvudstader");
  await press(page.locator('.chip[data-act="area"][data-v="eu"]'), touch);
  await expect(page.locator('.chip[data-act="area"][data-v="eu"]')).toHaveAttribute("aria-pressed", "true");
  await press(page.locator('.chip[data-act="dir"][data-v="mix"]'), touch);
  await startLevel(page, touch, 0);
  await expect(page.locator(".ptitle small")).toHaveText("🐣 Lätt · Europa");
  const dirs = new Set();
  for (let i = 0; i < 10; i++) {
    const q = await question(page);
    dirs.add(q.dir);
    expect(q.k).toBe("eu");
    const name = await page.evaluate((c) => BY[c].n, q.target), cap = await page.evaluate((c) => BY[c].cap, q.target);
    if (q.dir === "n2c") {
      await expect(page.locator(".ask")).toHaveText(`Vad heter huvudstaden i ${name}?`);
      await expect(page.locator(`.opts [data-c="${q.target}"]`)).toHaveText(cap);
    } else {
      await expect(page.locator(".ask")).toHaveText(`${cap} är huvudstad i vilket land?`);
      await expect(page.locator(`.opts [data-c="${q.target}"]`)).toContainText(name);
      await expect(page.locator(`.opts [data-c="${q.target}"] img.flag`)).toHaveCount(1);
    }
    await answerRight(page, touch);
    await next(page, touch);
  }
  expect(dirs.size, "Blanda gives both directions").toBe(2);
  await expect(page.locator(".summary h2")).toHaveText("Alla rätt – perfekt!");
  expect((await saved(page)).pref.huvudstader).toEqual({ area: "eu", dir: "mix", metric: undefined });
});

test("Storleksordning: tap in order, undo, check and see the numbers", async ({ page, touch }) => {
  await page.goto(GAME);
  await openMode(page, touch, "storlek");
  await press(page.locator('.chip[data-act="metric"][data-v="a"]'), touch);
  await startLevel(page, touch, 0);
  let q = await question(page);
  expect(q.metric).toBe("a");
  await expect(page.locator(".ask")).toHaveText("Sortera från störst till minst yta");
  await expect(page.locator(".sitem")).toHaveCount(3);
  await expect(page.locator('[data-act="sortdone"]')).toBeDisabled();
  // tap two, undo the first: the second becomes number 1
  await press(page.locator(`[data-act="sortpick"][data-c="${q.items[0]}"]`), touch);
  await press(page.locator(`[data-act="sortpick"][data-c="${q.items[1]}"]`), touch);
  await expect(page.locator(`[data-c="${q.items[1]}"] .num`)).toHaveText("2");
  await press(page.locator(`[data-act="sortpick"][data-c="${q.items[0]}"]`), touch);
  await expect(page.locator(`[data-c="${q.items[1]}"] .num`)).toHaveText("1");
  await press(page.locator('[data-act="sortclear"]'), touch);
  await expect(page.locator(".sitem.picked")).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "sort");
  await expectTapTargets(page, ".sitem");

  // a wrong order: the smallest first
  for (const c of q.answer.slice().reverse()) await press(page.locator(`[data-act="sortpick"][data-c="${c}"]`), touch);
  await press(page.locator('[data-act="sortdone"]'), touch);
  await expect(page.locator(".sheet.bad")).toBeVisible();
  await expect(page.locator(".sitem")).toHaveCount(3);
  await expect(page.locator(".sitem .val").first()).toContainText("km²");
  await expect(page.locator(".sheet .why")).toContainText("så stort som");
  await expect(page.locator(".sheet .why")).toContainText("Rätt ordning:");
  await next(page, touch);
  for (let i = 2; i <= 5; i++) { await answerRight(page, touch); await next(page, touch); }
  await expect(page.locator(".summary h2")).toHaveText("Nivån är klarad!");
  await expect(page.locator('[data-sum="right"] b')).toHaveText("4/5");
  await expect(page.locator(".unlock")).toBeVisible();
  await expect(page.locator(".missed .mtile")).toHaveCount(2);   // the two countries out of place
  await press(page.locator(".missed .mtile").first(), touch);
  await expect(page.locator(".modal .lcard.big")).toBeVisible();
});

test("Världsdelar: the right basket collects the flag; on Svår both continents of Russia count", async ({ page, touch }) => {
  await seedStorage(page, { [STATE]: { prog: { varldsdelar: { u: 2 } } } });
  await page.goto(GAME);
  await openMode(page, touch, "varldsdelar");
  await expect(page.locator('.chip[data-act="area"]')).toHaveText(["🌐 Hela världen", "🎯 Mina missar (0)"]);
  await startLevel(page, touch, 0);
  await expect(page.locator(".basket")).toHaveCount(6);
  await expectNoHorizontalOverflow(page, "baskets");
  await expectTapTargets(page, ".basket");
  const q = await answerRight(page, touch);
  await expect(page.locator(`.basket[data-k="${q.k}"] .mini img`)).toHaveCount(1);
  await next(page, touch);
  await expect(page.locator(`.basket[data-k="${q.k}"] .mini img`)).toHaveCount(1);

  // Svår: make the next question Russia and answer Asien
  await press(page.locator('[data-act="quit"]'), touch);
  await press(page.locator('.modal [data-m="quit"]'), touch);
  await startLevel(page, touch, 2);
  await page.evaluate(() => { const Q = activeRound(); Q.qs[Q.i] = { type: "continent", target: "ru" }; renderPlay(); });
  await expect(page.locator(".ask")).toHaveText("I vilken världsdel ligger Ryssland?");
  await press(page.locator('[data-act="cont"][data-k="as"]'), touch);
  await expect(page.locator(".sheet.ok .why")).toHaveText("Ryssland ligger i både Europa och Asien. Båda svaren är rätt.");
  await expect(page.locator(".basket.right")).toHaveCount(2);
});

test("Högre eller lägre: ten in a row unlocks the next level, a miss ends the round", async ({ page, touch }) => {
  await page.goto(GAME);
  await openMode(page, touch, "hogrelagre");
  await startLevel(page, touch, 0);
  await expect(page.locator(".stat .l")).toHaveText(["i rad", "rekord"]);
  await expect(page.locator(".hcard")).toHaveCount(2);
  await expectNoHorizontalOverflow(page, "higher/lower");
  await expectOnScreen(page, ".hcard", "both countries");
  for (let i = 1; i <= 10; i++) {
    await answerRight(page, touch);
    await expect(page.locator(".hcard .val").first()).not.toBeEmpty();
    await expect(page.locator(".stat.good .n")).toHaveText(String(i));
    await next(page, touch);
  }
  const q = await question(page);
  const small = q.pair.find((c) => c !== q.big);
  await press(page.locator(`[data-act="hilo"][data-c="${small}"]`), touch);
  await expect(page.locator(".sheet.bad")).toBeVisible();
  await expect(page.locator('.sheet [data-act="next"]')).toHaveText("Se resultat");
  await next(page, touch);
  await expect(page.locator(".summary h2")).toHaveText("Nivån är klarad!");
  await expect(page.locator('[data-sum="best"] b')).toHaveText("10");
  await expect(page.locator(".unlock")).toHaveText("🔓 Du har låst upp 🎒 Mellan!");
  expect((await saved(page)).prog.hogrelagre.b[0]).toBe(10);
});

test("Mysterielandet: clues cost points, wrong guesses show the next clue; Omöjliga has a search box", async ({ page, touch }) => {
  await seedStorage(page, { [STATE]: { prog: { mysterium: { u: 4 } } } });
  await page.goto(GAME);
  await openMode(page, touch, "mysterium");
  await startLevel(page, touch, 1);   // Mellan: 6 countries to choose from
  let q = await question(page);
  await expect(page.locator(".clues li")).toHaveCount(1);
  await expect(page.locator(".pts")).toHaveText("Ger nu 8 poäng");
  await expect(page.locator('.opts [data-act="guess"]')).toHaveCount(6);
  await press(page.locator('[data-act="clue"]'), touch);
  await expect(page.locator(".clues li")).toHaveCount(2);
  const wrong = q.options.find((c) => c !== q.target);
  await press(page.locator(`[data-act="guess"][data-c="${wrong}"]`), touch);
  await expect(page.locator(".clues li")).toHaveCount(3);
  await expect(page.locator(`[data-act="guess"][data-c="${wrong}"]`)).toBeDisabled();
  await expect(page.locator(".pts")).toHaveText("Ger nu 6 poäng");
  await expectNoHorizontalOverflow(page, "mystery");
  await answerRight(page, touch);
  await expect(page.locator(".sheet .why")).toContainText("Du fick 6 poäng.");
  await expect(page.locator(".stat.good .n")).toHaveText("6");

  // Omöjliga: type the country
  await press(page.locator('[data-act="quit"]'), touch);
  await press(page.locator('.modal [data-m="quit"]'), touch);
  await startLevel(page, touch, 4);
  q = await question(page);
  await expect(page.locator(".search")).toBeVisible();
  await expect(page.locator(".results .none")).toHaveText("Börja skriva så kommer förslag.");
  const name = await page.evaluate((c) => BY[c].n, q.target);
  await page.locator(".search").fill("qqq");
  await expect(page.locator(".results .none")).toHaveText("Inget land heter så.");
  await page.locator(".search").fill(name);
  await expect(page.locator(`.results [data-c="${q.target}"]`)).toBeVisible();
  await press(page.locator(`.results [data-c="${q.target}"]`), touch);
  await expect(page.locator(".sheet.ok .why")).toHaveText(`Det var ${name}! Du fick 8 poäng.`);
});

test("Mina missar: needs six missed countries, then asks only about them", async ({ page, touch }) => {
  const miss = { se: 2, no: 2, dk: 2, fi: 2, is: 2, ee: 2 };
  await seedStorage(page, { [STATE]: { miss } });
  await page.goto(GAME);
  await openMode(page, touch, "flaggor");
  const chip = page.locator('.chip[data-act="area"][data-v="missar"]');
  await expect(chip).toHaveText("🎯 Mina missar (6)");
  await expect(chip).toBeEnabled();
  await press(chip, touch);
  await startLevel(page, touch, 0);
  for (let i = 0; i < 6; i++) {
    const q = await answerRight(page, touch);
    expect(Object.keys(miss)).toContain(q.target);
    await next(page, touch);
  }
  // a right answer takes a miss away
  expect(Object.values((await saved(page)).miss).every((v) => v === 1)).toBe(true);
});

test("the passport shows stamps per continent, and the hub trophy counts them", async ({ page, touch }) => {
  await seedStorage(page, { [STATE]: { pass: { se: 3, no: 5, jp: 2, br: 3 } }, "score.jordenrunt": "3" });
  await page.goto(GAME);
  await expect(page.locator(".record")).toHaveText("🛂 Stämplar i passet: 3 av 195");
  await press(page.locator('[data-act="pass"]'), touch);
  await expect(page.locator(".passpage .record")).toHaveText("3 av 195 stämplar");
  await expect(page.locator(".ptile")).toHaveCount(195);
  await expect(page.locator(".ptile.yes")).toHaveCount(3);
  await expect(page.locator('.ptile[data-c="jp"] .dots')).toHaveText("●●○");
  await expect(page.locator(".passpage h3").first()).toContainText("Europa 2 av 45");
  await expectNoHorizontalOverflow(page, "passport");
  await press(page.locator('.ptile[data-c="jp"]'), touch);
  await expect(page.locator(".modal .lcard.big b")).toHaveText("Japan");
  await expect(page.locator(".modal .lcard.big")).toContainText("Huvudstad: Tokyo");
  await expect(page.locator(".modal .lcard.big")).toContainText("Inga grannländer på land");
  await press(page.locator('.modal [data-m="close"]'), touch);

  // a third right answer about Japan gives a new stamp and updates the trophy
  await press(page.locator('[data-act="menu"]'), touch);
  await openMode(page, touch, "flaggor");
  await startLevel(page, touch, 0);
  await page.evaluate(() => { const Q = activeRound(); Q.qs[Q.i] = { type: "choice", dir: "f2n", target: "jp", options: ["jp", "se", "br"] }; renderPlay(); });
  await answerRight(page, touch);
  expect(await page.evaluate(() => localStorage.getItem("score.jordenrunt"))).toBe("4");
  await page.goto("index.html");
  await expect(page.locator(".game-card", { hasText: "Jorden runt" }).locator(".chip").first()).toHaveText("🏆 4");
});

// Points that the old, too-rounded flags drew wrong (China's stars, Myanmar's star), with the
// colour each has in the flag-icons original. Drawn at 160×120.
const FLAG_POINTS = {
  cn: [[67, 13, "#ee1c25"], [75, 18, "#ee1c25"], [18, 26, "#ffff00"], [37, 26, "#ffff00"]],
  mm: [[79, 27, "#ffffff"], [76, 37, "#ffffff"], [84, 42, "#ffffff"], [73, 48, "#ffffff"]]
};
test("flags are drawn like the originals: China's and Myanmar's stars keep their shape", async ({ page }) => {
  await page.goto(GAME);
  const got = await page.evaluate(async (pts) => {
    const c = document.createElement("canvas"); c.width = 160; c.height = 120;
    const g = c.getContext("2d", { willReadFrequently: true });
    const out = {};
    for (const code of Object.keys(pts)) {
      const im = new Image(); im.src = flagSrc(code); await im.decode();
      g.clearRect(0, 0, 160, 120); g.drawImage(im, 0, 0, 160, 120);
      out[code] = pts[code].map(([x, y]) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)]);
    }
    return out;
  }, FLAG_POINTS);
  for (const [code, list] of Object.entries(FLAG_POINTS)) list.forEach(([x, y, hex], i) => {
    const want = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    const off = want.reduce((n, v, j) => n + Math.abs(v - got[code][i][j]), 0);
    expect(off, `${code} at ${x},${y}: got rgb(${got[code][i]}), want ${hex}`).toBeLessThan(60);
  });
});

test("a save from the build with the duel keeps its progress", async ({ page, touch }) => {
  await seedStorage(page, { [STATE]: { prog: { flaggor: { u: 2 } }, pass: { se: 3 }, names: ["Alva", "Pappa"], duel: { mode: "varldsdelar", lv: [0, 4] } } });
  await page.goto(GAME);
  await expect(page.locator('.mode[data-mode="flaggor"] .tag')).toHaveText("🧭 Svår");
  await expect(page.locator(".record")).toContainText("Stämplar i passet: 1");
  await openMode(page, touch, "flaggor");
  await startLevel(page, touch, 0);
  await answerRight(page, touch);
  const s = await saved(page);
  expect(s.prog.flaggor.u).toBe(2);
  expect(s.names).toBeUndefined();
  expect(s.duel).toBeUndefined();
});

test("about: rules and the sources and licences of flags and data", async ({ page, touch }) => {
  await page.goto(GAME);
  await press(page.locator('[data-act="about"]'), touch);
  await expect(page.locator(".about h3")).toHaveText("📖 Om spelet");
  await expect(page.locator(".about .src")).toContainText("flag-icons (MIT-licens)");
  await expect(page.locator(".about .src")).toContainText("Världsbanken");
  await expect(page.locator(".about .src")).toContainText("ODbL");
  await press(page.locator('.modal [data-m="close"]'), touch);
  await expect(page.locator(".modal")).toHaveCount(0);
});

test("keyboard: number keys answer and Enter goes on", async ({ page, touch }) => {
  test.skip(touch, "keyboard play is for desktop");
  await page.goto(GAME);
  await openMode(page, false, "flaggor");
  await startLevel(page, false, 0);
  const q = await question(page);
  const n = q.options.indexOf(q.target) + 1;
  await page.keyboard.press(String(n));
  await expect(page.locator(".sheet.ok")).toBeVisible();
  await waitGuard(page);
  await page.keyboard.press("Enter");
  await expect(page.locator(".stat .n").first()).toHaveText("2/10");
});
