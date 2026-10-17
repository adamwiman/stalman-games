#!/usr/bin/env node
/* Tests for the pure game logic in games/goopipes.html.
   Run with: node tests/goopipes.test.js
   Extracts the /*LOGIC-START*​/ … /*LOGIC-END*​/ block from the game file,
   so the game stays a single self-contained HTML file. */
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "games", "goopipes.html"), "utf8");
const m = html.match(/\/\*LOGIC-START\*\/([\s\S]*?)\/\*LOGIC-END\*\//);
if (!m) { console.error("LOGIC block not found in goopipes.html"); process.exit(1); }

const L = new Function(m[1] + `
  return { COLS, ROWS, SIDES, OPPOSITE, DELTA, CONNECT, PIECE_TYPES,
    exitSide, axisOf, inBounds, emptyBoard, makePiece, makeStart, isFlooded,
    placement, tryEnter, advanceFlow, simulateFlow, roundOutcome, segmentScore,
    levelParams, randomType, randomStart, makeRand };
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

// ---- 1. exitSide: every piece type, every valid entry direction, and all invalid ones ----
const EXPECTED = {
  H:  { L: "R", R: "L", U: null, D: null },
  V:  { U: "D", D: "U", L: null, R: null },
  UR: { U: "R", R: "U", D: null, L: null },
  RD: { R: "D", D: "R", U: null, L: null },
  DL: { D: "L", L: "D", U: null, R: null },
  LU: { L: "U", U: "L", D: null, R: null },
  X:  { U: "D", D: "U", L: "R", R: "L" }
};
for (const type of Object.keys(EXPECTED)) {
  for (const side of ["U", "R", "D", "L"]) {
    eq(`exitSide(${type}, ${side})`, L.exitSide(type, side), EXPECTED[type][side]);
  }
}
eq("exitSide on start piece is null (goo can't re-enter the pump)", L.exitSide("S", "L"), null);
eq("axisOf L/R = h", [L.axisOf("L"), L.axisOf("R")], ["h", "h"]);
eq("axisOf U/D = v", [L.axisOf("U"), L.axisOf("D")], ["v", "v"]);

// ---- 2. tryEnter: end-of-round causes ----
{
  const b = L.emptyBoard();
  // board edge
  eq("exit off top edge", L.tryEnter(b, 0, 4, "U").reason, "edge");
  eq("exit off left edge", L.tryEnter(b, 3, 0, "L").reason, "edge");
  eq("exit off bottom edge", L.tryEnter(b, L.ROWS - 1, 4, "D").reason, "edge");
  eq("exit off right edge", L.tryEnter(b, 3, L.COLS - 1, "R").reason, "edge");
  // empty cell
  eq("exit into empty cell", L.tryEnter(b, 3, 3, "R").reason, "empty");
  // mismatched connection (dead end): moving right into a vertical pipe
  b[3][4] = L.makePiece("V");
  eq("mismatched connection blocks", L.tryEnter(b, 3, 3, "R").reason, "blocked");
  // already-flooded piece
  b[3][4] = L.makePiece("H");
  b[3][4].filled.h = b[3][4].filled.v = true;
  eq("re-entering a flooded piece fails", L.tryEnter(b, 3, 3, "R").reason, "filled");
}

// ---- 3. tryEnter: valid entries for each piece type from every valid direction ----
{
  // moveDir that makes the goo enter via side `enter`
  const moveFor = { U: "D", R: "L", D: "U", L: "R" };
  for (const type of L.PIECE_TYPES) {
    for (const enter of ["U", "R", "D", "L"]) {
      const b = L.emptyBoard();
      b[3][4] = L.makePiece(type);
      const moveDir = moveFor[enter];
      const d = L.DELTA[moveDir];
      const res = L.tryEnter(b, 3 - d[0], 4 - d[1], moveDir);
      if (EXPECTED[type][enter]) {
        check(`${type} accepts entry from ${enter}`, res.ok);
        eq(`${type} entry ${enter} → exit`, res.exit, EXPECTED[type][enter]);
        eq(`${type} entry ${enter} enterSide`, res.enterSide, enter);
      } else {
        eq(`${type} rejects entry from ${enter}`, res.reason, "blocked");
      }
    }
  }
}

// ---- 4. cross piece: two passes, one per axis ----
{
  const b = L.emptyBoard();
  b[3][4] = L.makePiece("X");
  const first = L.tryEnter(b, 3, 3, "R"); // horizontal pass
  check("cross first pass ok", first.ok && !first.secondPass);
  b[3][4].filled.h = true; // as advanceFlow would mark it
  const second = L.tryEnter(b, 2, 4, "D"); // vertical pass
  check("cross second pass ok", second.ok);
  check("cross second pass flagged", second.secondPass === true);
  eq("cross same-axis re-entry fails", L.tryEnter(b, 3, 5, "L").reason, "filled");
  b[3][4].filled.v = true;
  eq("cross fully flooded rejects both axes", L.tryEnter(b, 2, 4, "D").reason, "filled");
}

// ---- 5. full flow simulation: straights + all four elbows, ends on flooded pipe ----
{
  // S(3,1)→R, H(3,2), DL(3,3): enters L exits D, LU(4,3): enters U exits L,
  // UR(4,2): enters R exits U → hits the flooded H(3,2) from below, which is
  // a mismatched connection → round ends "blocked"
  const b = L.emptyBoard();
  b[3][1] = L.makeStart("R");
  b[3][2] = L.makePiece("H");
  b[3][3] = L.makePiece("DL");
  b[4][3] = L.makePiece("LU");
  b[4][2] = L.makePiece("UR");
  const res = L.simulateFlow(b, { r: 3, c: 1 });
  eq("snake path cells", res.path.map(p => [p.r, p.c]), [[3, 2], [3, 3], [4, 3], [4, 2]]);
  eq("snake distance", res.distance, 4);
  eq("snake ends blocked at the flooded pipe", res.reason, "blocked");
  check("flooded pieces are marked", L.isFlooded(b[3][2]) && L.isFlooded(b[4][2]));
}

// ---- 6. full flow: cross double-pass scores/counts twice ----
{
  // S(1,1)→R, X(1,2) horizontal, DL(1,3), LU(2,3), UR(2,2), then X(1,2)
  // vertical (second pass), exits up into empty (0,2).
  const b = L.emptyBoard();
  b[1][1] = L.makeStart("R");
  b[1][2] = L.makePiece("X");
  b[1][3] = L.makePiece("DL");
  b[2][3] = L.makePiece("LU");
  b[2][2] = L.makePiece("UR");
  const res = L.simulateFlow(b, { r: 1, c: 1 });
  eq("loop path", res.path.map(p => [p.r, p.c]), [[1, 2], [1, 3], [2, 3], [2, 2], [1, 2]]);
  eq("cross counted twice in distance", res.distance, 5);
  eq("loop ends in empty cell", res.reason, "empty");
  check("first cross pass is not flagged second", res.path[0].secondPass === false);
  check("second cross pass is flagged second", res.path[4].secondPass === true);
  check("cross both axes flooded after", b[1][2].filled.h && b[1][2].filled.v);
}

// ---- 7. flow ending at the board edge and in a dead end ----
{
  const b = L.emptyBoard();
  b[0][5] = L.makeStart("U");
  eq("start facing edge → edge", L.simulateFlow(b, { r: 0, c: 5 }).reason, "edge");

  const b2 = L.emptyBoard();
  b2[2][2] = L.makeStart("R");
  b2[2][3] = L.makePiece("V"); // dead end: V can't be entered from the left
  const res2 = L.simulateFlow(b2, { r: 2, c: 2 });
  eq("dead end reason", res2.reason, "blocked");
  eq("dead end distance", res2.distance, 0);
}

// ---- 8. placement rules ----
{
  const b = L.emptyBoard();
  b[0][0] = L.makeStart("R");
  b[1][1] = L.makePiece("H");
  b[2][2] = L.makePiece("X");
  b[2][2].filled.h = true; // goo has reached it
  eq("empty cell → place", L.placement(b, 5, 5), "place");
  eq("un-flooded piece → replace", L.placement(b, 1, 1), "replace");
  eq("start piece → locked", L.placement(b, 0, 0), null);
  eq("flooded piece → locked", L.placement(b, 2, 2), null);
}

// ---- 9. round outcome + scoring ----
{
  eq("distance == required → level complete", L.roundOutcome(8, 8), "level");
  eq("distance > required → level complete", L.roundOutcome(12, 8), "level");
  eq("distance < required → game over", L.roundOutcome(7, 8), "over");
  eq("plain segment", L.segmentScore(false, false), 50);
  eq("cross second pass doubles", L.segmentScore(true, false), 100);
  eq("fast-forward bonus", L.segmentScore(false, true), 100);
  eq("fast second pass", L.segmentScore(true, true), 150);
}

// ---- 10. generators ----
{
  const rand = L.makeRand(1234);
  for (let i = 0; i < 500; i++) {
    const s = L.randomStart(rand);
    const d = L.DELTA[s.dir];
    check(`randomStart #${i} never faces the edge`,
      L.inBounds(s.r, s.c) && L.inBounds(s.r + d[0], s.c + d[1]));
    check(`randomType #${i} is a known type`, L.PIECE_TYPES.includes(L.randomType(rand)));
  }
  const p1 = L.levelParams(1), p5 = L.levelParams(5), p20 = L.levelParams(20);
  check("required distance grows", p1.required < p5.required && p5.required <= p20.required);
  check("goo speeds up per level", p1.fillMs > p5.fillMs && p5.fillMs >= p20.fillMs && p20.fillMs >= 700);
  check("countdown shrinks but never below 4s",
    p1.countdownMs > p5.countdownMs && p20.countdownMs >= 4000);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
