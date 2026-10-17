// Numlingarnas resa: the whole journey through the real UI, every station at
// every level, the number pad, save migration and the hub trophy.
"use strict";
const { test, expect, press, seedStorage, expectNoHorizontalOverflow } = require("./fixtures");

// Shortens the balloon flight and skips confetti; game logic is unchanged.
test.use({ reducedMotion: "reduce" });

const ALL = ["gates", "balloon", "stones", "venn", "raft", "lock", "machine", "garden", "share", "path"];
const act = (page, name) => page.locator(`#app [data-act="${name}"]`).first();
const modalBtn = (page, m) => page.locator(`.modal-back [data-m="${m}"]`);

// Title → difficulty → builder → random troupe of 10 → map.
// `first` moves that station to the front of the journey's route.
async function startJourney(page, touch, first) {
  await page.goto("games/numlings.html");
  await press(act(page, "new"), touch);
  if (await page.locator('#app [data-act="lv"]').count()) await press(page.locator('#app [data-act="lv"][data-v="1"]'), touch);
  await expect(page.locator("#app h2")).toHaveText("Bygg din trupp");
  await press(act(page, "fill"), touch);
  await expect(page.locator("#app .count")).toHaveText("10 / 10");
  await press(act(page, "start"), touch);
  await expect(page.locator("#app h2")).toHaveText("Vägen till Numeria");
  if (first) {
    await page.evaluate((k) => {
      const r = S.journey.route.filter((x) => x !== k);
      S.journey.route = [k, ...r].slice(0, 6);
      save(); showMap();
    }, first);
  }
}

async function expectTapTargets(page, selector, min = 40) {
  const small = await page.evaluate(({ selector, min }) => [...document.querySelectorAll(selector)]
    .filter((el) => el.offsetParent !== null)
    .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.getAttribute("aria-label") || el.textContent).trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((b) => b.w < min || b.h < min), { selector, min });
  expect(small, `tap targets smaller than ${min}px`).toEqual([]);
}

test("title screen is in Swedish, fits the screen and links back to the hub", async ({ page, touch }) => {
  await page.goto("games/numlings.html");
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.locator(".logo")).toHaveAttribute("aria-label", "Numlingarnas resa");
  await expect(act(page, "new")).toHaveText("Starta en resa");
  await expect(page.locator(".hubnav a.back")).toBeVisible();
  await expect(page.locator(".hubnav a.back")).toHaveText("← Spel");
  await expectNoHorizontalOverflow(page, "title");
  await expectTapTargets(page, "#app .btn, .hubnav a.back");
  if (touch) {
    // no sticky hover on iPad: every :hover rule sits behind (hover:hover)
    expect(await page.evaluate(() => matchMedia("(hover: hover)").matches)).toBe(false);
  }
});

test("troupe builder: pick a look, add, reject duplicates, remove, fill", async ({ page, touch }) => {
  await page.goto("games/numlings.html");
  await press(act(page, "new"), touch);
  await expect(page.locator("#app h2")).toHaveText("Hur svåra ska gåtorna vara från början?");
  await press(page.locator('#app [data-act="lv"][data-v="2"]'), touch);
  await expect(page.locator("#app h2")).toHaveText("Bygg din trupp");
  expect(await page.evaluate(() => S.levels.gates)).toBe(2);

  await press(page.locator('#app [data-act="shape"][data-v="hexagon"]'), touch);
  await press(page.locator('#app [data-act="color"][data-v="purple"]'), touch);
  await press(page.locator('#app [data-act="eyes"][data-v="3"]'), touch);
  await press(page.locator('#app [data-act="num"][data-v="23"]'), touch);
  await press(act(page, "add"), touch);
  await expect(page.locator("#app .count")).toHaveText("1 / 10");
  await expect(page.locator('#app .slot .cr[aria-label="lila sexhörning, 3 ögon, talet 23"]')).toHaveCount(1);
  await expect(act(page, "start")).toBeDisabled(); // needs 4

  await press(act(page, "add"), touch); // same look again
  await expect(page.locator("#app .bmsg")).toContainText("redan en numling");
  await expect(page.locator("#app .count")).toHaveText("1 / 10");

  await press(page.locator('#app [data-act="rm"]').first(), touch);
  await expect(page.locator("#app .count")).toHaveText("0 / 10");

  await press(act(page, "fill"), touch);
  await expect(page.locator("#app .count")).toHaveText("10 / 10");
  await expect(act(page, "add")).toBeDisabled();
  await expect(act(page, "start")).toBeEnabled();
  await expectNoHorizontalOverflow(page, "builder");
  await expectTapTargets(page, "#app .chip, #app .num, #app .btn:not(.sm)");
  await expectTapTargets(page, "#app .btn.sm", 32); // small secondary buttons such as "Tillbaka"
});

test("map: six stops, level picker allows easier but not harder", async ({ page, touch }) => {
  await startJourney(page, touch);
  await expect(page.locator(".mapnode")).toHaveCount(6);
  const j = await page.evaluate(() => S.journey);
  expect(j.route).toHaveLength(6);
  expect(new Set(j.route).size).toBe(6);
  expect(j.troupe).toHaveLength(10);
  await expect(page.locator(".lvopt").nth(0)).toBeEnabled();
  await expect(page.locator(".lvopt").nth(1)).toBeDisabled(); // suggested level is 1
  await expectNoHorizontalOverflow(page, "map");
});

test("Ballongen: solve every trip by tapping numlingar, all 10 cross, level goes up", async ({ page, touch }) => {
  await startJourney(page, touch, "balloon");
  await press(act(page, "go"), touch);
  await expect(page.locator(".station.st-balloon")).toBeVisible();
  await expectNoHorizontalOverflow(page, "balloon");

  for (let trip = 0; trip < 10; trip++) {
    const st = await page.evaluate(() => ({ target: CUR.target, count: CUR.count, waiting: CUR.waiting.map((c) => ({ id: c.id, n: c.n })), done: CUR.done }));
    if (st.done) break;
    // find numlingar whose numbers add up to the sign (any group, or exactly `count`)
    let pickIds = null;
    const n = st.waiting.length;
    for (let mask = 1; mask < 1 << n && !pickIds; mask++) {
      const g = st.waiting.filter((_, i) => mask & (1 << i));
      if (g.length > 6 || (st.count && g.length !== st.count)) continue;
      if (g.reduce((s, c) => s + c.n, 0) === st.target) pickIds = g.map((c) => c.id);
    }
    expect(pickIds, `a group adds up to ${st.target}`).not.toBeNull();
    for (const id of pickIds) await press(page.locator(`.tray .cr.dr[data-id="${id}"]`), touch);
    await expect(page.locator(".basket .cr")).toHaveCount(pickIds.length);
    await press(act(page, "lift"), touch);
    await expect.poll(() => page.evaluate(() => CUR.flying)).toBe(false);
  }
  await expect(modalBtn(page, "next")).toHaveText("Fortsätt");
  await expect(page.locator(".modal-back")).toContainText("10 av 10");
  await press(modalBtn(page, "next"), touch);
  await expect(page.locator("#app h2")).toHaveText("Vägen till Numeria");

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("state.numlings")));
  expect(saved.levels.balloon).toBe(2); // perfect run → suggested level rises
  expect(saved.journey.station).toBe(1);
  expect(saved.played.balloon).toBe(1);
});

test("Ballongen: wrong weight costs a heart", async ({ page, touch }) => {
  await startJourney(page, touch, "balloon");
  await press(act(page, "go"), touch);
  const st = await page.evaluate(() => ({ target: CUR.target, hearts: CUR.hearts, w: CUR.waiting.map((c) => ({ id: c.id, n: c.n })) }));
  const wrong = st.w.find((c) => c.n !== st.target);
  await press(page.locator(`.tray .cr.dr[data-id="${wrong.id}"]`), touch);
  await press(act(page, "lift"), touch);
  await expect(page.locator(".say.bad")).toBeVisible();
  expect(await page.evaluate(() => CUR.hearts)).toBe(st.hearts - 1);
});

test("Mönsterbäcken: number pad enters multi-digit answers with no lost or doubled digits", async ({ page, touch }) => {
  await startJourney(page, touch, "stones");
  await press(act(page, "go"), touch);
  await expect(page.locator(".station.st-stones")).toBeVisible();
  await expectNoHorizontalOverflow(page, "stones");
  await expectTapTargets(page, ".numpad .key", 44);

  for (let round = 0; round < 30; round++) {
    const st = await page.evaluate(() => ({ done: CUR.done, solved: CUR.solved, ans: CUR.solved ? null : CUR.seq[CUR.blanks[CUR.bi]] }));
    if (st.done) break;
    if (st.solved) { await press(act(page, "next"), touch); continue; }
    const digits = String(st.ans).split("");
    if (touch) {
      // quick finger taps straight after each other, as a child would type
      // (raw taps don't scroll, so bring the whole pad on screen first)
      await page.locator('.numpad .key[data-v="✓"]').scrollIntoViewIfNeeded();
      for (const d of digits) {
        const b = await page.locator(`.numpad .key[data-v="${d}"]`).boundingBox();
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      }
    } else {
      await page.keyboard.type(String(st.ans));
    }
    expect(await page.evaluate(() => CUR.input), "every digit registered exactly once").toBe(String(st.ans));
    if (touch) await press(page.locator('.numpad .key[data-v="✓"]'), touch);
    else await page.keyboard.press("Enter");
  }
  await expect(page.locator(".modal-back")).toContainText("10 av 10");
});

test("Mönsterbäcken: backspace on the pad, and a wrong answer costs a heart", async ({ page, touch }) => {
  await startJourney(page, touch, "stones");
  await press(act(page, "go"), touch);
  const key = (v) => page.locator(`.numpad .key[data-v="${v}"]`);
  await press(key("4"), touch); await press(key("2"), touch);
  expect(await page.evaluate(() => CUR.input)).toBe("42");
  await press(key("⌫"), touch);
  expect(await page.evaluate(() => CUR.input)).toBe("4");
  const { ans, hearts } = await page.evaluate(() => ({ ans: CUR.seq[CUR.blanks[CUR.bi]], hearts: CUR.hearts }));
  await press(key("⌫"), touch);
  for (const d of String(ans + 1)) await press(key(d), touch);
  await press(key("✓"), touch);
  expect(await page.evaluate(() => CUR.hearts)).toBe(hearts - 1);
});

test("every station renders at every level, fits the screen, and has help", async ({ page, touch }) => {
  test.setTimeout(120000);
  await startJourney(page, touch);
  for (const key of ALL) {
    for (let L = 1; L <= 4; L++) {
      await page.evaluate(({ key, L }) => {
        closeModal();
        S.levels[key] = 4;
        S.journey.route = [key, ...S.journey.route.filter((x) => x !== key)].slice(0, 6);
        S.journey.station = 0;
        startStation(0, L);
      }, { key, L });
      const station = page.locator(`.station.st-${key}`);
      await expect(station, `${key} L${L}`).toBeVisible();
      await expect(station.locator(".stars")).toHaveAttribute("aria-label", `nivå ${L} av 4`);
      await expectNoHorizontalOverflow(page, `${key} L${L}`);
      await expectTapTargets(page, ".station .iconbtn, .station .btn:not(.sm), .station .key", 40);
      // not a failure, but worth knowing: controls a child has to scroll down to reach
      const below = await page.evaluate(() => [...document.querySelectorAll(".station button")]
        .filter((b) => b.offsetParent && b.getBoundingClientRect().bottom > innerHeight + scrollY)
        .map((b) => b.getAttribute("aria-label") || b.textContent.trim()).filter(Boolean));
      if (below.length) {
        test.info().annotations.push({ type: "below the fold", description: `${key} L${L}: ${[...new Set(below)].join(", ")}` });
      }
      if (L === 1) {
        await press(page.locator('.station [data-act="help"]'), touch);
        await expect(page.locator(".modal-back h3")).toContainText("Så spelar du");
        await press(modalBtn(page, "close"), touch);
        await expect(page.locator(".modal-back")).toHaveCount(0);
      }
    }
  }
});

test("leaving a station asks first and returns to the map", async ({ page, touch }) => {
  await startJourney(page, touch, "gates");
  await press(act(page, "go"), touch);
  await press(page.locator('.station [data-act="leave"]'), touch);
  await press(modalBtn(page, "close"), touch); // "Fortsätt spela"
  await expect(page.locator(".station.st-gates")).toBeVisible();
  await press(page.locator('.station [data-act="leave"]'), touch);
  await press(modalBtn(page, "map"), touch);
  await expect(page.locator("#app h2")).toHaveText("Vägen till Numeria");
});

test("a full journey reaches Numeria and the hub card shows the trophy", async ({ page, touch }) => {
  test.setTimeout(90000);
  await startJourney(page, touch);
  for (let i = 0; i < 6; i++) {
    await press(act(page, "go"), touch);
    await expect(page.locator(".station")).toBeVisible();
    // clear the station instantly (each station's own puzzles are covered above)
    await page.evaluate(() => { CUR.across.push(...CUR.waiting); CUR.waiting = []; CUR.win(); });
    const next = modalBtn(page, "next");
    await expect(next).toHaveText(i === 5 ? "Vidare till Numeria!" : "Fortsätt");
    await press(next, touch);
  }
  await expect(page.locator("#app h2")).toHaveText("Välkommen till Numeria!");
  await expect(page.locator("#app")).toContainText("10 av 10");
  expect(await page.evaluate(() => localStorage.getItem("score.numlings"))).toBe("10");
  await expectNoHorizontalOverflow(page, "arrival");

  await press(act(page, "title"), touch);
  await expect(act(page, "home")).toHaveText("Besök Numeria (10)");
  await press(page.locator(".hubnav a.back"), touch);
  await expect(page.locator(".game-card", { hasText: "Numlingarnas resa" }).locator(".chip").first()).toHaveText("🏆 10");
});

test("a troupe that fails a station goes back to camp and can try again", async ({ page, touch }) => {
  await startJourney(page, touch);
  await press(act(page, "go"), touch);
  // nobody made it (some stations send a few numlingar across at the start as examples)
  await page.evaluate(() => { CUR.waiting.push(...CUR.across); CUR.across = []; CUR.done = true; finishStation(CUR); });
  await expect(modalBtn(page, "next")).toHaveText("Tillbaka till lägret");
  await press(modalBtn(page, "next"), touch);
  await expect(page.locator("#app h2")).toHaveText("Tillbaka till lägret");
  expect(await page.evaluate(() => [S.camp.length, S.journey])).toEqual([10, null]);
  await press(act(page, "new"), touch);
  await expect(page.locator("#app .count")).toHaveText("10 / 10");
  await expect(page.locator("#app .slot .tent")).toHaveCount(10);
});

test("progress survives a reload and a save from the earlier English build is migrated", async ({ page, touch }) => {
  const cr = (id, n) => ({ id, shape: "circle", color: "red", eyes: 2, n });
  await seedStorage(page, {
    "state.numlings": {
      nextId: 30, camp: [cr(20, 4)], home: [cr(1, 5), cr(2, 6)],
      levels: { gates: 2, balloon: 3, stones: 2, venn: 2, raft: 2, lock: 2 }, // only the six old stations
      sound: false, chosen: true,
      journey: { troupe: [cr(10, 1), cr(11, 2), cr(12, 3), cr(13, 9)], station: 1, start: 4, lost: 0 } // no route
    },
    "score.numlings": "2"
  });
  await page.goto("games/numlings.html");
  await expect(act(page, "cont")).toHaveText("Fortsätt resan");
  await expect(act(page, "home")).toHaveText("Besök Numeria (2)");
  const s = await page.evaluate(() => ({ route: S.journey.route, levels: S.levels }));
  expect(s.route).toEqual(["gates", "balloon", "stones", "venn", "raft", "lock"]);
  expect(s.levels.balloon).toBe(3);
  expect(s.levels.machine).toBe(2); // new stations start at the lowest old level

  await press(act(page, "cont"), touch);
  await expect(page.locator(".panel.next h3")).toContainText("Nästa stopp:");
  expect(await page.evaluate(() => S.journey.route[S.journey.station])).toBe("balloon");

  await page.reload();
  await expect(act(page, "cont")).toHaveText("Fortsätt resan");
});

test("corrupt saved data does not break the game", async ({ page }) => {
  await seedStorage(page, { "state.numlings": "{not json" });
  await page.goto("games/numlings.html");
  await expect(act(page, "new")).toHaveText("Starta en resa");
});
