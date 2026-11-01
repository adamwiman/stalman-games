// Tornet i Hanoi: the level picker and unlocking, a whole tower moved through
// the real UI (taps on iPad, clicks on desktop), wrong moves, undo, hints,
// dragging, the keyboard, saved towers, the hub trophy, and that the board fits.
"use strict";
const { test, expect, press, seedStorage, expectNoHorizontalOverflow } = require("./fixtures");

// skips the shake/confetti animations and the short pause before the result; game logic is unchanged
test.use({ reducedMotion: "reduce" });

const level = (page, i) => page.locator(`.level[data-lvl="${i}"]`);
const peg = (page, p) => page.locator(`.peg[data-p="${p}"]`);
const discs = (page, p) => peg(page, p).locator(".disc");
const moves = (page) => page.locator('[data-stat="moves"] .n');
// The fewest moves for n discs from peg a to peg c.
function solution(n, a = 0, b = 1, c = 2) {
  return n ? [...solution(n - 1, a, c, b), [a, c], ...solution(n - 1, b, a, c)] : [];
}
async function tapMove(page, touch, [from, to]) {
  await press(peg(page, from), touch);
  await press(peg(page, to), touch);
}
async function expectTapTargets(page, selector, min = 44) {
  const small = await page.evaluate(({ selector, min }) => [...document.querySelectorAll(selector)]
    .filter((el) => el.offsetParent !== null)
    .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.getAttribute("aria-label") || el.textContent).trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((b) => b.w < min || b.h < min), { selector, min });
  expect(small, `tap targets smaller than ${min}px`).toEqual([]);
}
// The board, the buttons under it and the biggest disc all fit on the screen.
async function expectBoardFits(page, label) {
  await expectNoHorizontalOverflow(page, label);
  const vp = page.viewportSize();
  const keys = await page.locator(".keys").boundingBox();
  expect(keys.y + keys.height, `${label}: the buttons fit vertically`).toBeLessThanOrEqual(vp.height);
  const wide = await page.evaluate(() => [...document.querySelectorAll(".disc")].filter((d) => {
    const r = d.getBoundingClientRect(), p = d.closest(".peg").getBoundingClientRect();
    return r.left < p.left - 1 || r.right > p.right + 1;
  }).length);
  expect(wide, `${label}: discs wider than their peg`).toBe(0);
}

test("menu is in Swedish, shows the five levels with only Lätt open, fits the screen and links back to the hub", async ({ page, touch }) => {
  await page.goto("games/hanoi.html");
  await expect(page).toHaveTitle("Tornet i Hanoi");
  await expect(page.locator("h1")).toHaveText("Tornet i Hanoi");
  await expect(page.locator(".level .nm")).toHaveText(["Lätt", "Mellan", "Svår", "Geni", "Omöjliga"]);
  await expect(level(page, 0).locator(".ds")).toHaveText("3 brickor · minst 7 drag");
  await expect(level(page, 0).locator(".tag")).toHaveText("Inte klarad än");
  for (let i = 1; i < 5; i++) await expect(level(page, i)).toHaveClass(/locked/);
  await expect(level(page, 1).locator(".ds")).toHaveText("Flytta tornet på Lätt för att låsa upp.");
  await expect(page.locator(".hubnav a.back")).toHaveText("← Spel");
  await expectNoHorizontalOverflow(page, "menu");
  await expectTapTargets(page, ".level, .hubnav a.back, .menu .btn");

  // a locked level says why, and stays on the menu
  await press(level(page, 2), touch);
  await expect(page.locator(".menumsg")).toHaveText("Svår är låst. Flytta tornet på Mellan först!");
  await expect(page.locator(".board")).toHaveCount(0);

  await press(page.locator('[data-act="rules"]'), touch);
  await expect(page.locator(".modal h3")).toHaveText("📖 Så spelar du");
  await press(page.locator('.modal [data-m="close"]'), touch);
  await expect(page.locator(".modal-back")).toHaveCount(0);
});

test("a whole tower on Lätt: wrong moves, undo, three stars, Mellan unlocks and the hub trophy", async ({ page, touch }) => {
  await page.goto("games/hanoi.html");
  await press(level(page, 0), touch);
  await expect(page.locator(".title b")).toHaveText("🐣 Lätt");
  await expect(page.locator(".hubnav a.back")).toBeHidden();
  await expect(discs(page, 0)).toHaveText(["3", "2", "1"]);
  await expect(page.locator('[data-act="undo"]')).toBeDisabled();
  await expectBoardFits(page, "Lätt");
  await expectTapTargets(page, ".peg, .keys .btn, .bar .btn");

  // an empty peg can't be lifted
  await press(peg(page, 1), touch);
  await expect(page.locator(".msg")).toHaveText("Den pinnen är tom. Välj en pinne med en bricka på.");
  // lift and put back
  await press(peg(page, 0), touch);
  await expect(peg(page, 0)).toHaveClass(/sel/);
  await expect(discs(page, 0).last()).toHaveClass(/lifted/);
  await press(peg(page, 0), touch);
  await expect(peg(page, 0)).not.toHaveClass(/sel/);

  // a bigger disc may not go on a smaller one, and that is not a move
  await tapMove(page, touch, [0, 2]);
  await tapMove(page, touch, [0, 2]);
  await expect(page.locator(".msg")).toHaveText("Bricka 2 får inte ligga på bricka 1. En större bricka får aldrig ligga på en mindre.");
  await expect(moves(page)).toHaveText("1");
  // undo takes the move back
  await press(page.locator('[data-act="undo"]'), touch);
  await expect(moves(page)).toHaveText("0");
  await expect(discs(page, 0)).toHaveText(["3", "2", "1"]);

  for (const mv of solution(3)) await tapMove(page, touch, mv);
  await expect(discs(page, 2)).toHaveText(["3", "2", "1"]);
  await expect(moves(page)).toHaveText("7");
  await expect(page.locator(".modal h2")).toHaveText("Perfekt!");
  await expect(page.locator(".modal .bigstars")).toHaveAttribute("aria-label", "3 av 3 stjärnor");
  await expect(page.locator(".modal .lead")).toHaveText("Du flyttade tornet på 7 drag – det minsta som går!");
  await expect(page.locator(".modal .unlock")).toHaveText("🔓 Du har låst upp 🧗 Mellan!");
  await expect(page.locator(".modal .btn")).toHaveText(["Prova Mellan", "Spela igen", "Meny"]);
  expect(await page.evaluate(() => localStorage.getItem("score.hanoi"))).toBe("3");

  await press(page.locator('.modal [data-m="menu"]'), touch);
  await expect(level(page, 0).locator(".tag")).toHaveText("⭐⭐⭐");
  await expect(level(page, 1)).not.toHaveClass(/locked/);
  await expect(level(page, 2)).toHaveClass(/locked/);
  await expect(page.locator(".record")).toHaveText("⭐ Stjärnor: 3 av 15");

  await press(page.locator(".hubnav a.back"), touch);
  await expect(page.locator(".game-card", { hasText: "Tornet i Hanoi" }).locator(".chip").first()).toHaveText("🏆 3");
});

test("hints show the best move and cap the stars at two; more moves than needed give fewer stars", async ({ page, touch }) => {
  await page.goto("games/hanoi.html");
  await press(level(page, 0), touch);
  await press(page.locator('[data-act="hint"]'), touch);
  await expect(page.locator(".msg")).toHaveText("💡 Flytta bricka 1 från vänstra pinnen till högra pinnen. Härifrån behövs minst 7 drag till.");
  await expect(peg(page, 0)).toHaveClass(/from/);
  await expect(peg(page, 2)).toHaveClass(/to/);
  for (const mv of solution(3)) await tapMove(page, touch, mv);
  await expect(page.locator(".modal h2")).toHaveText("Snyggt!");
  await expect(page.locator(".modal .bigstars")).toHaveAttribute("aria-label", "2 av 3 stjärnor");
  await expect(page.locator(".modal .lead")).toHaveText("Du flyttade tornet på 7 drag – det minsta som går! Med tips blir det som mest två stjärnor.");

  // eleven moves (four extra) give one star
  await press(page.locator('.modal [data-m="again"]'), touch);
  for (const mv of [[0, 1], [1, 0], [0, 1], [1, 0]]) await tapMove(page, touch, mv);
  for (const mv of solution(3)) await tapMove(page, touch, mv);
  await expect(page.locator(".modal .bigstars")).toHaveAttribute("aria-label", "1 av 3 stjärnor");
  await expect(page.locator(".modal .lead")).toHaveText("Du flyttade tornet på 11 drag. Det går på 7.");
  // the best result is kept
  await press(page.locator('.modal [data-m="menu"]'), touch);
  await expect(level(page, 0).locator(".tag")).toHaveText("⭐⭐☆");
});

test("discs can be dragged, and the keys 1–3 move them too", async ({ page, touch }) => {
  test.skip(touch, "drag with the mouse and keys on desktop; taps are covered on iPad");
  await page.goto("games/hanoi.html");
  await press(level(page, 0), false);
  // drag disc 1 to the right peg
  const from = await discs(page, 0).last().boundingBox(), to = await peg(page, 2).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await expect(page.locator(".disc.ghost")).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator(".disc.ghost")).toHaveCount(0);
  await expect(discs(page, 2)).toHaveText(["1"]);
  await expect(moves(page)).toHaveText("1");
  // a drag dropped back on its own peg is no move
  const d2 = await discs(page, 0).last().boundingBox();
  await page.mouse.move(d2.x + d2.width / 2, d2.y + d2.height / 2);
  await page.mouse.down();
  await page.mouse.move(d2.x + d2.width / 2 + 5, d2.y - 60, { steps: 5 });
  await page.mouse.up();
  await expect(moves(page)).toHaveText("1");
  await expect(peg(page, 0)).not.toHaveClass(/sel/);
  // keys: 1 then 2 moves disc 2 to the middle; Backspace undoes it
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  await expect(discs(page, 1)).toHaveText(["2"]);
  await page.keyboard.press("Backspace");
  await expect(discs(page, 1)).toHaveCount(0);
  await expect(moves(page)).toHaveText("1");
});

test("a tower in progress is saved, and starting another level asks first", async ({ page, touch }) => {
  await seedStorage(page, { "state.hanoi": { prog: { unlocked: 1, stars: { latt: 3 } }, game: null } });
  await page.goto("games/hanoi.html");
  await press(level(page, 1), touch);
  await expect(discs(page, 0)).toHaveCount(4);
  await tapMove(page, touch, [0, 1]);
  await tapMove(page, touch, [0, 2]);
  await page.reload();
  await expect(page.locator(".resume b")).toHaveText("Fortsätt tornet");
  await expect(page.locator(".resume")).toContainText("Mellan · 4 brickor · 2 drag");
  await press(level(page, 0), touch);
  await expect(page.locator(".modal h3")).toHaveText("Börja ett nytt torn?");
  await press(page.locator('.modal [data-m="old"]'), touch);
  await expect(discs(page, 1)).toHaveText(["1"]);
  await expect(discs(page, 2)).toHaveText(["2"]);
  await expect(moves(page)).toHaveText("2");
  await expect(page.locator('[data-act="undo"]')).toBeEnabled();

  // start over asks, and puts every disc back
  await press(page.locator('[data-act="restart"]'), touch);
  await press(page.locator('.modal [data-m="yes"]'), touch);
  await expect(discs(page, 0)).toHaveCount(4);
  await expect(moves(page)).toHaveText("0");
});

test("the biggest tower fits the screen", async ({ page }) => {
  await seedStorage(page, { "state.hanoi": { prog: { unlocked: 4 }, game: null } });
  await page.goto("games/hanoi.html");
  for (let i = 1; i < 5; i++) await expect(level(page, i)).not.toHaveClass(/locked/);
  await page.locator(".levels").scrollIntoViewIfNeeded();
  await press(level(page, 4), false);
  await expect(page.locator(".title b")).toHaveText("💀 Omöjliga");
  await expect(discs(page, 0)).toHaveCount(7);
  await expectBoardFits(page, "Omöjliga");
});
