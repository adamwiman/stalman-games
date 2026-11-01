#!/usr/bin/env node
/* Tests for the pure game logic in games/hanoi.html (Tornet i Hanoi).
   Run with: node tests/hanoi.test.js
   Extracts the /*LOGIC-START*​/ … /*LOGIC-END*​/ block from the game file,
   so the game stays a single self-contained HTML file. */
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "games", "hanoi.html"), "utf8");
const m = html.match(/\/\*LOGIC-START\*\/([\s\S]*?)\/\*LOGIC-END\*\//);
if (!m) { console.error("LOGIC block not found in hanoi.html"); process.exit(1); }

const L = new Function(m[1] + `
  return { LEVELS, GOAL, minMoves, lvName, newGame, topDisc, canMove, move, undo, bestMove, movesLeft,
    starsFor, cleanProgress, recordWin, totalStars, maxStars, restoreGame, discsName, pegName, setLang };
`)();

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.error("FAIL: " + name); }
}
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) console.error(`FAIL: ${name}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`);
  ok ? passed++ : failed++;
}
// Plays the hint until the tower is moved; returns the number of moves.
function solveWithHints(g) {
  let guard = 0;
  while (!g.done && guard++ < 1000) {
    const mv = L.bestMove(g.pegs, g.n);
    if (!mv || !L.move(g, mv[0], mv[1])) return -1;
  }
  return g.moves;
}
// A small deterministic random generator for the "any position" tests.
function makeRand(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- 1. levels and a new game ----
eq("five levels with the same names as the other games", L.LEVELS.map((l) => l.id), ["latt", "mellan", "svar", "geni", "omojliga"]);
eq("Swedish names", L.LEVELS.map(L.lvName), ["Lätt", "Mellan", "Svår", "Geni", "Omöjliga"]);
eq("each level has one more disc, 3 to 7", L.LEVELS.map((l) => l.n), [3, 4, 5, 6, 7]);
eq("fewest moves is 2^n − 1", L.LEVELS.map((l) => L.minMoves(l.n)), [7, 15, 31, 63, 127]);
{
  const g = L.newGame(1);
  eq("a new game on Mellan has 4 discs on the first peg, biggest at the bottom", [g.level, g.n, g.pegs], [1, 4, [[4, 3, 2, 1], [], []]]);
  eq("and no moves", [g.moves, g.hints, g.done], [0, 0, false]);
}

// ---- 2. the rules ----
{
  const g = L.newGame(0);
  check("the top disc can move to an empty peg", L.canMove(g, 0, 2));
  check("an empty peg has nothing to move", !L.canMove(g, 1, 2));
  check("a disc can't move to its own peg", !L.canMove(g, 0, 0));
  check("pegs outside 0–2 are refused", !L.canMove(g, 0, 3) && !L.canMove(g, -1, 1) && !L.canMove(g, 0, NaN));
  check("move works", L.move(g, 0, 2));
  eq("after one move", [g.pegs, g.moves], [[[3, 2], [], [1]], 1]);
  check("a bigger disc may not go on a smaller one", !L.canMove(g, 0, 2) && !L.move(g, 0, 2));
  eq("a refused move changes nothing", [g.pegs, g.moves], [[[3, 2], [], [1]], 1]);
  check("a smaller disc may go on a bigger one", L.move(g, 2, 0) && L.topDisc(g, 0) === 1);
  check("undo takes back the last move", L.undo(g));
  eq("after undo", [g.pegs, g.moves, g.history], [[[3, 2], [], [1]], 1, [[0, 2]]]);
  L.undo(g);
  eq("undo back to the start", [g.pegs, g.moves], [[[3, 2, 1], [], []], 0]);
  check("nothing more to undo", !L.undo(g));
}

// ---- 3. solving ----
for (const [i, lv] of L.LEVELS.entries()) {
  const g = L.newGame(i);
  eq(`${lv.name}: the hint solves it in the fewest moves`, solveWithHints(g), L.minMoves(lv.n));
  check(`${lv.name}: solved means everything on the goal peg`, g.done && g.pegs[L.GOAL].length === lv.n && g.pegs[0].length === 0);
  check(`${lv.name}: no moves after it is solved, and no undo`, !L.canMove(g, 2, 0) && !L.undo(g));
}
{
  // all discs on the middle peg is not solved
  const g = L.newGame(0);
  for (const [a, b] of [[0, 1], [0, 2], [1, 2], [0, 1], [2, 0], [2, 1], [0, 1]]) L.move(g, a, b);
  eq("the tower on the middle peg", g.pegs, [[], [3, 2, 1], []]);
  check("is not solved", !g.done);
  eq("and needs 7 more moves", L.movesLeft(g.pegs, 3), 7);
}
{
  // from any position the hint is a legal move, movesLeft shrinks by one each time, and it ends solved
  const rand = makeRand(7);
  let bad = 0, tried = 0;
  for (let t = 0; t < 200; t++) {
    const lvl = Math.floor(rand() * L.LEVELS.length), g = L.newGame(lvl), n = g.n;
    for (let i = 0; i < 40; i++) { const a = Math.floor(rand() * 3), b = Math.floor(rand() * 3); L.move(g, a, b); if (g.done) break; }
    if (g.done) continue;
    tried++;
    let left = L.movesLeft(g.pegs, n);
    while (!g.done) {
      const mv = L.bestMove(g.pegs, n);
      if (!mv || !L.move(g, mv[0], mv[1])) { bad++; break; }
      const now = L.movesLeft(g.pegs, n);
      if (now !== left - 1) { bad++; break; }
      left = now;
    }
    if (left !== 0) bad++;
  }
  check("from random positions the hint always takes the shortest way home", bad === 0 && tried > 150);
}
eq("no hint when the tower is already moved", L.bestMove([[], [], [3, 2, 1]], 3), null);

// ---- 4. stars ----
eq("stars for 3 discs: 3 for 7 moves, 2 for at most 10, then 1", [7, 8, 10, 11, 40].map((mv) => L.starsFor(3, mv, 0)), [3, 2, 2, 1, 1]);
eq("stars for 7 discs", [127, 190, 191].map((mv) => L.starsFor(7, mv, 0)), [3, 2, 1]);
eq("hints give at most two stars", [L.starsFor(3, 7, 1), L.starsFor(3, 9, 2), L.starsFor(3, 30, 1)], [2, 2, 1]);

// ---- 5. progress and unlocking ----
{
  const p = L.cleanProgress(null);
  eq("fresh progress: only Lätt open", p, { unlocked: 0, stars: {}, best: {} });
  eq("solving Lätt unlocks Mellan", L.recordWin(p, 0, 9, 0), 1);
  eq("stars and best", [p.stars.latt, p.best.latt, L.totalStars(p)], [2, 9, 2]);
  eq("solving Lätt again unlocks nothing new", L.recordWin(p, 0, 7, 0), -1);
  eq("better stars and best are kept", [p.stars.latt, p.best.latt], [3, 7]);
  L.recordWin(p, 0, 20, 1);
  eq("a worse round does not lower them", [p.stars.latt, p.best.latt], [3, 7]);
  eq("solving Mellan unlocks Svår", L.recordWin(p, 1, 15, 0), 2);
  for (const i of [2, 3]) L.recordWin(p, i, L.minMoves(L.LEVELS[i].n), 0);
  eq("Omöjliga is the last level", [p.unlocked, L.recordWin(p, 4, 127, 0), p.unlocked], [4, -1, 4]);
  eq("all stars", [L.totalStars(p), L.maxStars()], [15, 15]);
  eq("cleanProgress keeps good values and drops bad ones",
    L.cleanProgress({ unlocked: 99, stars: { latt: 3, mellan: 7, svar: "2", x: 3 }, best: { latt: 5, mellan: 15, geni: "x" } }),
    { unlocked: 4, stars: { latt: 3, svar: 2 }, best: { mellan: 15 } });
  eq("a broken unlocked value starts from Lätt", L.cleanProgress({ unlocked: "two" }).unlocked, 0);
}

// ---- 6. a saved game ----
{
  const prog = L.cleanProgress({ unlocked: 1 });
  const g = L.newGame(1); L.move(g, 0, 1); L.move(g, 0, 2);
  const back = L.restoreGame(JSON.parse(JSON.stringify(g)), prog);
  eq("a saved game comes back", [back.level, back.n, back.pegs, back.moves, back.history], [1, 4, g.pegs, 2, [[0, 1], [0, 2]]]);
  check("bad saves are ignored", [null, {}, { level: 9, pegs: [[], [], []] }, { level: 0, pegs: [[1, 2, 3], [], []] },
    { level: 0, pegs: [[3, 2], [], []] }, { level: 0, pegs: [[3, 2, 2], [], []] }, { level: 0, pegs: [[3], [2], [1], []] },
    { level: 0, pegs: [[], [], [3, 2, 1]] }, { level: "0", pegs: [[3, 2, 1], [], []] }]
    .every((s) => L.restoreGame(s, prog) === null));
  check("a save on a level that is still locked is ignored", L.restoreGame(JSON.parse(JSON.stringify(L.newGame(3))), prog) === null);
  const odd = L.restoreGame({ level: 0, pegs: [[3, 2], [1], []], moves: 1, history: [[0, 1], [7, 1], "x"] }, prog);
  eq("broken undo steps are dropped", odd.history, [[0, 1]]);
}

// ---- 7. texts in both languages ----
eq("names in Swedish", [L.discsName(5), L.pegName(0), L.pegName(2)], ["5 brickor", "vänstra pinnen", "högra pinnen"]);
L.setLang("en");
eq("names in English", [L.discsName(5), L.pegName(1), L.pegName(2)], ["5 discs", "the middle peg", "the right peg"]);
eq("level names in English", L.LEVELS.map(L.lvName), ["Easy", "Medium", "Hard", "Genius", "Impossible"]);
L.setLang("sv");

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
