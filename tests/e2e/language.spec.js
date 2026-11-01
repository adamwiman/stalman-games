// English: the language switch on the hub, and the hub, parent settings, the
// time's-up lock and every game played in English. Swedish is the default and
// is covered by the other specs.
"use strict";
const { test, expect, press, seedStorage, today, loadGames, expectNoHorizontalOverflow } = require("./fixtures");

// skips confetti and animations; game logic is unchanged
test.use({ reducedMotion: "reduce" });

const GAMES = loadGames();
const EN = { "hub.lang": "en" };
const english = (page) => seedStorage(page, EN);

// Visible text, labels and titles that are still Swedish. `ignore` lists words
// that are allowed (Detektiven's people have Swedish names).
async function expectNoSwedish(page, label, ignore = []) {
  const left = await page.evaluate((ignore) => {
    const parts = [document.title, document.body.innerText];
    for (const el of document.querySelectorAll("[aria-label],[title],[placeholder],[alt]")) {
      if (el.closest("[hidden]")) continue;
      for (const a of ["aria-label", "title", "placeholder", "alt"]) if (el.getAttribute(a)) parts.push(el.getAttribute(a));
    }
    let text = parts.join("\n");
    for (const w of ignore) text = text.split(w).join("");
    const sv = /[åäöÅÄÖ]|\b(och|är|inte|av|med|eller|för|det|som|på|Spel|nivå|Tillbaka)\b/;
    return text.split("\n").map((l) => l.trim()).filter((l) => sv.test(l)).slice(0, 5);
  }, ignore);
  expect(left, `${label}: Swedish text left`).toEqual([]);
}

// ---------- the hub ----------
test("the hub is Swedish by default and switches to English and back", async ({ page, touch }) => {
  await page.goto("index.html");
  const cards = page.locator(".game-card");
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page).toHaveTitle("Stalman games");
  await expect(page.locator("h1")).toHaveText("Stalman games.");
  await expect(page.locator("footer")).toHaveText("Fungerar utan internet · rekorden sparas på den här iPaden");
  await expect(page.locator('.lang [data-lang="sv"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.lang [data-lang="en"]')).toHaveAttribute("aria-pressed", "false");
  for (const [i, g] of GAMES.entries()) await expect(cards.nth(i).locator("h2")).toHaveText(g.title);
  await expectNoHorizontalOverflow(page, "hub in Swedish");

  await press(page.locator('.lang [data-lang="en"]'), touch);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // the name is the same in both languages
  await expect(page).toHaveTitle("Stalman games");
  await expect(page.locator("h1")).toHaveText("Stalman games.");
  await expect(page.locator("footer")).toHaveText("Works offline · high scores stay on this iPad");
  await expect(page.locator("#gear")).toHaveAttribute("aria-label", "Parent settings");
  await expect(page.locator('.lang [data-lang="en"]')).toHaveAttribute("aria-pressed", "true");
  for (const [i, g] of GAMES.entries()) {
    await expect(cards.nth(i).locator("h2")).toHaveText(g.en.title);
    await expect(cards.nth(i).locator(".blurb")).toHaveText(g.en.blurb);
  }
  expect(await page.evaluate(() => localStorage.getItem("hub.lang"))).toBe("en");
  await expectNoSwedish(page, "hub");
  await expectNoHorizontalOverflow(page, "hub in English");

  // the choice is remembered, and the games follow it
  await page.reload();
  await expect(page.locator(".blurb").first()).toHaveText(GAMES[0].en.blurb);
  await press(page.locator(".game-card", { hasText: "The Plumber" }), touch);
  await expect(page.locator("a.back")).toHaveText("← Games");
  await press(page.locator("a.back"), touch);
  await expect(page.locator(".blurb").first()).toHaveText(GAMES[0].en.blurb);

  await press(page.locator('.lang [data-lang="sv"]'), touch);
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.locator("footer")).toHaveText("Fungerar utan internet · rekorden sparas på den här iPaden");
  await expect(cards.first().locator(".blurb")).toHaveText(GAMES[0].blurb);
  expect(await page.evaluate(() => localStorage.getItem("hub.lang"))).toBe("sv");
});

test("parent settings and time limits in English", async ({ page, touch }) => {
  await english(page);
  await page.goto("index.html");
  await press(page.locator("#gear"), touch);
  await expect(page.locator("#panel h2")).toHaveText("Create a parent PIN");
  await page.fill("#pin1", "12"); await page.fill("#pin2", "12");
  await press(page.locator("#psave"), touch);
  await expect(page.locator("#pmsg")).toHaveText("PIN needs at least 4 digits.");
  await page.fill("#pin1", "1234"); await page.fill("#pin2", "1234");
  await press(page.locator("#psave"), touch);
  await expect(page.locator("#panel h2")).toHaveText("Parent settings");
  await expect(page.locator('input[data-game="numlings"]')).toHaveAttribute("placeholder", "No limit");
  await expect(page.locator(".limit-row span").nth(2)).toHaveText(/The Numlings' Journey$/);
  await page.fill('input[data-game="numlings"]', "20");
  await press(page.locator("#save"), touch);
  await expect(page.locator("#smsg")).toHaveText("Saved.");
  await expectNoSwedish(page, "parent settings");
  await press(page.locator("#close"), touch);
  await expect(page.locator(".game-card", { hasText: "The Numlings' Journey" }).locator(".chip.time")).toHaveText("⏱ 20 min left");
  await press(page.locator("#gear"), touch);
  await page.fill("#pin", "0000");
  await press(page.locator("#pgo"), touch);
  await expect(page.locator("#pmsg")).toHaveText("Wrong PIN.");
});

test("a game whose time is used up says so in English", async ({ page, touch }) => {
  await seedStorage(page, Object.assign({}, EN, {
    "hub.limits": { gangertabell: 10 },
    "hub.usage": { date: today(), byGame: { gangertabell: 600 } }
  }));
  await page.goto("index.html");
  await expect(page.locator(".game-card", { hasText: "Times Tables" }).locator(".chip.time")).toHaveText("Time's up today");
  await page.goto("games/gangertabell.html");
  await expect(page.getByText("Time’s up for today!")).toBeVisible();
  await expect(page.getByText("Great playing — come back tomorrow.")).toBeVisible();
  await press(page.getByRole("link", { name: "← Back to games" }), touch);
  await expect(page).toHaveURL(/index\.html$/);
});

test("the time-left pill in a game is in English", async ({ page }) => {
  await seedStorage(page, Object.assign({}, EN, { "hub.limits": { "2048": 3 } }));
  await page.goto("games/2048.html");
  await expect(page.getByText(/min left$/)).toHaveText("⏱ 3 min left");
});

// ---------- every game opens in English ----------
for (const g of GAMES) {
  test(`${g.en.title}: opens in English and fits the screen`, async ({ page }) => {
    await english(page);
    await page.goto(g.file);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle(g.en.title);
    await expect(page.locator("a.back")).toHaveText("← Games");
    await expect(page.locator("body")).not.toBeEmpty();
    await expectNoSwedish(page, g.en.title);
    await expectNoHorizontalOverflow(page, g.en.title);
  });
}

// ---------- 2048 ----------
test("2048 in English", async ({ page, touch }) => {
  await english(page);
  await page.goto("games/2048.html");
  await expect(page.locator(".box .lbl")).toHaveText(["SCORE", "BEST"]);
  await expect(page.locator("#new")).toHaveText("New game");
  await expect(page.locator(".hint")).toHaveText(/^Swipe/);
  await page.evaluate(() => {
    // two 1024 tiles side by side: the next move left makes 2048
    for (const id in tileEls) tileEls[id].remove();
    tileEls = {}; grid = emptyGrid();
    grid[0][0] = { id: nextId++, v: 1024, r: 0, c: 0 };
    grid[0][1] = { id: nextId++, v: 1024, r: 0, c: 1 };
    allTiles(grid).forEach((t) => addTileEl(t));
  });
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#modal.show")).toBeVisible();
  await expect(page.locator("#modalTitle")).toHaveText("You made 2048! 🎉");
  await expect(page.locator("#modalText")).toHaveText("Amazing! Want to keep going for an even bigger tile?");
  await expect(page.locator("#modalBtns button")).toHaveText(["Keep going", "New game"]);
  await press(page.locator("#modalBtns button", { hasText: "New game" }), touch);
  await expect(page.locator("#board .tile")).toHaveCount(2);
});

// ---------- The Plumber ----------
test("The Plumber in English: the menu, the rules, the game bar and the end of a round", async ({ page, touch }) => {
  await english(page);
  await page.goto("games/goopipes.html");
  await expect(page.locator("h1")).toHaveText("The Plumber");
  await expect(page.locator(".pickh")).toHaveText("Pick a difficulty");
  await expect(page.locator("#levels .level .nm")).toHaveText(["Easy", "Medium", "Hard"]);
  await expect(page.locator("#levels .level .ds")).toHaveText(["Calm water and short pipes", "Slightly faster water", "Fast water and long pipes"]);
  await expect(page.locator("#levels .level .tag")).toHaveText("Last time");
  await expect(page.locator("#record")).toHaveText("🏆 How far can you lead the water?");
  await press(page.locator("#rules"), touch);
  await expect(page.locator("#modalTitle")).toHaveText("📖 How to play");
  await expect(page.locator("#modalBtns .btn")).toHaveText("Let's go!");
  await expectNoSwedish(page, "rules");
  await press(page.locator("#modalBtns .btn"), touch);
  await expectNoSwedish(page, "menu");

  await press(page.locator('#levels .level[data-diff="mellan"]'), touch);
  await expect(page.locator("#diff")).toHaveText("🚿 Medium");
  await expect(page.locator(".stat .l")).toHaveText(["score", "best", "level", "pipe"]);
  await expect(page.locator(".qlbl")).toHaveText("NEXT");
  await expect(page.locator("#status")).toHaveText(/^WATER IN 1[56] s$/);
  await expect(page.locator("#fast")).toHaveText("⏩ Fast");
  await expect(page.locator("#menuBtn")).toHaveText("Menu");
  await expectNoSwedish(page, "game");
  await press(page.locator("#menuBtn"), touch);
  await expect(page.locator("#resume")).toContainText("Continue the game");
  await expect(page.locator("#resume")).toContainText("Medium · level 1 · 0 points");
  await expect(page.locator(".pickh")).toHaveText("Or start again");
  await press(page.locator("#resume"), touch);
  await press(page.locator("#fast"), touch);
  await expect(page.locator("#modal")).toBeVisible({ timeout: 20000 });
  await expect(page.locator("#modalTitle")).toHaveText("The water spilled! 💦");
  await expect(page.locator("#modalText")).toHaveText(/^The pipe was \d+ long, but the goal was 6\.$/);
  await expect(page.locator("#status")).toHaveText("ROUND OVER");
  await expect(page.locator("#modalBtns .btn")).toHaveText(["Try again", "Change difficulty"]);
  await expectNoSwedish(page, "The Plumber");
});

// ---------- Times Tables ----------
test("Times Tables in English: a ladder round with a right and a wrong answer", async ({ page, touch }) => {
  await english(page);
  await page.goto("games/gangertabell.html");
  await expect(page.locator("h1")).toHaveText("Times Tables");
  await expect(page.locator(".mode .nm")).toHaveText(["Free practice", "Table mix", "Table ladder"]);
  await expect(page.locator(".record")).toHaveText("🏆 How many right in a row can you get?");
  await press(page.locator('#app [data-act="mix"]'), touch);
  await expect(page.locator('#app [data-act="start"]')).toHaveText("Choose at least one table");
  await press(page.locator('.tgrid .tbtn[data-v="3"]'), touch);
  await expect(page.locator('#app [data-act="start"]')).toHaveText("Start – 10 questions");
  await expect(page.locator('.tgrid .tbtn[data-v="3"] small')).toHaveText("3 times table");
  await expectNoSwedish(page, "table mix");
  await press(page.locator('#app [data-act="back"]'), touch);

  await press(page.locator('#app [data-act="ladder"]'), touch);
  await press(page.locator('.tgrid .tbtn[data-v="7"]'), touch);
  await expect(page.locator(".modename small")).toHaveText("7 times table");
  await expect(page.locator(".progress .ptext")).toHaveText("0 of 10 done");
  await expect(page.locator("[data-stat] .l")).toHaveText(["questions", "right", "in a row"]);
  const key = (k) => page.locator(`.numpad .key[data-k="${k}"]`);
  await press(key("7"), touch); await press(key("ok"), touch);           // 7 · 1 = 7
  await expect(page.locator(".progress .ptext")).toHaveText("1 of 10 done");
  await press(key("1"), touch); await press(key("5"), touch); await press(key("ok"), touch); // 7 · 2 is not 15
  await expect(page.locator(".feedback .fbtext")).toHaveText("Not quite. 7 · 2 = 14");
  await expect(page.locator('.feedback [data-act="next"]')).toHaveText("Next");
  await expectNoSwedish(page, "ladder");
  await press(page.locator('.feedback [data-act="next"]'), touch);
  await press(page.locator('#app [data-act="quit"]'), touch);
  await expect(page.locator(".modal h3")).toHaveText("Do you want to stop now?");
  await press(page.locator('.modal [data-m="stop"]'), touch);
  await expect(page.locator(".summary h2")).toHaveText("Good effort!");
  await expect(page.locator(".summary .lead")).toHaveText("You answered 2 of 10 questions and got 1 right.");
  await expect(page.locator(".summary h3")).toHaveText("Practise these a little extra");
  await expectNoSwedish(page, "summary");
});

// ---------- The Numlings' Journey ----------
test("The Numlings' Journey in English: title, builder, map and every station at every level", async ({ page, touch }) => {
  test.setTimeout(120000);
  await english(page);
  await page.goto("games/numlings.html");
  await expect(page.locator("h1.logo")).toHaveAttribute("aria-label", "The Numlings' Journey");
  await expect(page.locator('#app [data-act="new"]')).toHaveText("Start a journey");
  await expectNoSwedish(page, "title");
  await press(page.locator('#app [data-act="new"]'), touch);
  await expect(page.locator("#app h2")).toHaveText("How hard should the puzzles be to start with?");
  await expect(page.locator(".choice b")).toHaveText(["Warm-up", "Tricky", "Clever", "Genius"]);
  await press(page.locator('#app [data-act="lv"][data-v="1"]'), touch);
  await expect(page.locator("#app h2")).toHaveText("Build your troupe");
  await expectNoSwedish(page, "builder");
  await press(page.locator('#app [data-act="fill"]'), touch);
  await press(page.locator('#app [data-act="start"]'), touch);
  await expect(page.locator("#app h2")).toHaveText("The road to Numeria");
  await expect(page.locator(".next h3")).toHaveText(/^Next stop: /);
  await expectNoSwedish(page, "map");

  for (const key of ["gates", "balloon", "stones", "venn", "raft", "lock", "machine", "garden", "share", "path"]) {
    for (let L = 1; L <= 4; L++) {
      await page.evaluate(({ key, L }) => {
        closeModal();
        S.levels[key] = 4;
        S.journey.route = [key, ...S.journey.route.filter((x) => x !== key)].slice(0, 6);
        S.journey.station = 0;
        startStation(0, L);
      }, { key, L });
      await expect(page.locator(`.station.st-${key} .stars`)).toHaveAttribute("aria-label", `level ${L} of 4`);
      await expectNoSwedish(page, `${key} L${L}`);
      await expectNoHorizontalOverflow(page, `${key} L${L}`);
      if (L === 1) {
        await press(page.locator('.station [data-act="help"]'), touch);
        await expect(page.locator(".modal-back h3")).toHaveText(/^How to play: /);
        await expectNoSwedish(page, `${key} help`);
        await press(page.locator('.modal-back [data-m="close"]'), touch);
      }
    }
  }
});

// ---------- The Detective ----------
test("The Detective in English: a whole Easy case, the rules and the result", async ({ page, touch }) => {
  test.setTimeout(90000);
  await english(page);
  await page.goto("games/detektiven.html");
  await expect(page.locator("h1")).toHaveText("The Detective");
  await expect(page.locator(".level .nm")).toHaveText(["Easy", "Medium", "Hard", "Genius", "Impossible"]);
  await expect(page.locator('.level[data-lvl="1"] .ds')).toHaveText("Solve a case on Easy to unlock.");
  await press(page.locator('.level[data-lvl="0"]'), touch);
  await expect(page.locator(".card")).toHaveCount(20, { timeout: 30000 });
  const names = await page.evaluate(() => G.P.names);
  await expect(page.locator(".msg")).toHaveText(/^Start with the clue from /);
  await expect(page.locator("[data-stat] .l")).toHaveText(["of 20", "mistakes"]);
  await expectNoSwedish(page, "board", names);

  await press(page.locator('[data-act="rules"]').first(), touch);
  await expect(page.locator(".rules h3").first()).toHaveText("📖 How to play");
  await expectNoSwedish(page, "rules", names);
  await press(page.locator('.modal [data-m="close"]'), touch);

  for (let i = 0; i < 25; i++) {
    const step = await page.evaluate(() => {
      if (!G) return null;
      const f = provable(G), p = bitsOf(f.crim | f.inno)[0];
      return { p, s: (f.crim >>> p) & 1 };
    });
    if (!step) break;
    await press(page.locator(`.card[data-p="${step.p}"]`), touch);
    await expect(page.locator(".modal h3")).toHaveText(/^What is /);
    await expect(page.locator(".modal .cbtns button")).toHaveText(["😇 Innocent", "🦹 Criminal"]);
    await press(page.locator(`.modal [data-m="${step.s ? "crim" : "inno"}"]`), touch);
    await expect(page.locator(".modal-back")).toHaveCount(0);
    if (i === 0) await expectNoSwedish(page, "after a step", names);
  }
  await expect(page.locator(".summary h2")).toHaveText("Perfect detective work!");
  await expect(page.locator(".summary .lead")).toHaveText(/^You found all \d+ criminals on Easy\.$/);
  await expect(page.locator(".summary .unlock")).toHaveText("🔓 You have unlocked 🔎 Medium!");
  await expectNoSwedish(page, "result", names);
});

// ---------- Around the World ----------
test("Around the World in English: flags, the country card, the result and the passport", async ({ page, touch }) => {
  test.setTimeout(90000);
  await english(page);
  await page.goto("games/jordenrunt.html");
  await expect(page.locator("h1")).toHaveText("Around the World");
  await expect(page.locator(".mode .nm")).toHaveText(["Flags", "Capitals", "Biggest first", "Continents", "Higher or lower", "Mystery country"]);
  await press(page.locator('.mode[data-mode="flaggor"]'), touch);
  await expect(page.locator(".setup h3")).toHaveText(["Where in the world?", "How do you want to play?", "Pick a level"]);
  await expect(page.locator('.chip[data-act="area"]').first()).toHaveText("🌐 The whole world");
  await expectNoSwedish(page, "setup");
  await press(page.locator('.chip[data-act="dir"][data-v="f2n"]'), touch);
  await press(page.locator('.level[data-lvl="0"]'), touch);
  const enNames = await page.evaluate(() => Object.values(COUNTRIES_EN).map((v) => v[0]));
  for (let i = 0; i < 10; i++) {
    await expect(page.locator(".ask")).toHaveText("Which country has this flag?");
    const opts = await page.locator(".opts .opt").allTextContents();
    expect(opts.every((o) => enNames.includes(o)), `English country names: ${opts}`).toBe(true);
    const target = await page.evaluate(() => currentQ(activeRound()).target);
    await press(page.locator(`.opts [data-act="pick"][data-c="${target}"]`), touch);
    await expect(page.locator(".sheet.ok")).toBeVisible();
    if (i === 0) {
      await expect(page.locator(".lcard span").first()).toHaveText(/^🏙️ Capital: /);
      await expectNoSwedish(page, "answer");
    }
    await expect.poll(() => page.evaluate(() => Date.now() >= guardUntil)).toBe(true);
    await press(page.locator('.sheet [data-act="next"]'), touch);
  }
  await expect(page.locator(".summary h2")).toHaveText("All right – perfect!");
  await expect(page.locator(".summary .lead")).toHaveText("You got 10 of 10 right on Easy.");
  await expectNoSwedish(page, "result");

  // Mystery country: the clues are English
  await press(page.locator('[data-act="menu"]'), touch);
  await press(page.locator('.mode[data-mode="mysterium"]'), touch);
  await press(page.locator('.level[data-lvl="0"]'), touch);
  await expect(page.locator(".ask")).toHaveText("Which country is it?");
  await expect(page.locator(".clues li").first()).toHaveText(/The country is in /);
  await press(page.locator('[data-act="clue"]'), touch);
  await expect(page.locator(".clues li").nth(1)).toHaveText(/people live in the country\.$/);
  await expectNoSwedish(page, "mystery");

  // the passport: English names, sorted in English
  await page.evaluate(() => showPass());
  await expect(page.locator(".passpage h2")).toHaveText("🛂 My passport");
  const europe = await page.locator(".group").first().locator(".ptile > span:not(.stamp):not(.dots)").allTextContents();
  expect(europe.slice(0, 3)).toEqual(["Albania", "Andorra", "Austria"]);
  await expectNoSwedish(page, "passport");
});

// ---------- Tower of Hanoi ----------
test("Tower of Hanoi in English: levels, a wrong move, a hint and a whole Easy tower", async ({ page, touch }) => {
  await english(page);
  await page.goto("games/hanoi.html");
  await expect(page.locator("h1")).toHaveText("Tower of Hanoi");
  await expect(page.locator(".level .nm")).toHaveText(["Easy", "Medium", "Hard", "Genius", "Impossible"]);
  await expect(page.locator('.level[data-lvl="0"] .ds')).toHaveText("3 discs · at least 7 moves");
  await expect(page.locator('.level[data-lvl="1"] .ds')).toHaveText("Move the tower on Easy to unlock.");
  await expect(page.locator(".record")).toHaveText("⭐ Move a tower to get your first stars!");
  await press(page.locator('[data-act="rules"]'), touch);
  await expect(page.locator(".modal h3")).toHaveText("📖 How to play");
  await expectNoSwedish(page, "rules");
  await press(page.locator('.modal [data-m="close"]'), touch);

  await press(page.locator('.level[data-lvl="0"]'), touch);
  await expect(page.locator(".title b")).toHaveText("🐣 Easy");
  await expect(page.locator(".msg")).toHaveText("Tap a peg to lift its top disc, then tap the peg where it should go.");
  await expect(page.locator('.peg[data-p="2"]')).toHaveAttribute("aria-label", "The right peg (the goal): empty");
  await expectNoSwedish(page, "board");
  const peg = (p) => page.locator(`.peg[data-p="${p}"]`);
  const tapMove = async ([a, b]) => { await press(peg(a), touch); await press(peg(b), touch); };
  await tapMove([0, 1]);
  await tapMove([0, 1]);
  await expect(page.locator(".msg")).toHaveText("Disc 2 may not sit on disc 1. A bigger disc may never sit on a smaller one.");
  await press(page.locator('[data-act="hint"]'), touch);
  await expect(page.locator(".msg")).toHaveText("💡 Move disc 1 from the middle peg to the right peg. From here you need at least 7 more moves.");
  await press(page.locator('[data-act="undo"]'), touch);
  for (const mv of [[0, 2], [0, 1], [2, 1], [0, 2], [1, 0], [1, 2], [0, 2]]) await tapMove(mv);
  await expect(page.locator(".modal h2")).toHaveText("Well done!");
  await expect(page.locator(".modal .lead")).toHaveText("You moved the tower in 7 moves – the fewest possible! With hints you get two stars at most.");
  await expect(page.locator(".modal .unlock")).toHaveText("🔓 You have unlocked 🧗 Medium!");
  await expect(page.locator(".modal .btn")).toHaveText(["Try Medium", "Play again", "Menu"]);
  await expectNoSwedish(page, "result");
  await press(page.locator('.modal [data-m="menu"]'), touch);
  await expect(page.locator(".record")).toHaveText("⭐ Stars: 2 of 15");
});
