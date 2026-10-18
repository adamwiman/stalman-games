#!/usr/bin/env node
/* Tests for the pure game logic in games/gangertabell.html.
   Run with: node tests/gangertabell.test.js
   Extracts the /*LOGIC-START*​/ … /*LOGIC-END*​/ block from the game file,
   so the game stays a single self-contained HTML file. */
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "games", "gangertabell.html"), "utf8");
const m = html.match(/\/\*LOGIC-START\*\/([\s\S]*?)\/\*LOGIC-END\*\//);
if (!m) { console.error("LOGIC block not found in gangertabell.html"); process.exit(1); }

const L = new Function(m[1] + `
  return { TABLES, MAX_DIGITS, makeRand, shuffled, cleanTables, tableFacts, sameFact, formatFact,
    newRound, nextQuestion, parseAnswer, answer, stopRound, missedList, summary, verdict,
    tableName, listSv, plural };
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
const key = (q) => q.a + "x" + q.b;
// Play a whole round, answering with answerFor(question, index); returns the questions in order.
function playThrough(r, answerFor, limit = 1000) {
  const seen = [];
  for (let i = 0; i < limit && !r.finished; i++) {
    const q = r.current;
    seen.push(q);
    L.answer(r, answerFor(q, i));
    L.nextQuestion(r);
  }
  return seen;
}
const right = (q) => q.answer;

// ---- 1. tables and facts ----
eq("tables are 1–10", L.TABLES, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
eq("7 table: 7·1 … 7·10 in order", L.tableFacts(7).map((f) => [f.a, f.b, f.answer]),
  [[7, 1, 7], [7, 2, 14], [7, 3, 21], [7, 4, 28], [7, 5, 35], [7, 6, 42], [7, 7, 49], [7, 8, 56], [7, 9, 63], [7, 10, 70]]);
for (const t of L.TABLES) {
  const f = L.tableFacts(t);
  check(`table ${t} has 10 facts with correct products`, f.length === 10 && f.every((x, i) => x.a === t && x.b === i + 1 && x.answer === t * (i + 1)));
}
eq("formatFact uses a centered dot", L.formatFact({ a: 5, b: 6 }), "5 · 6");
eq("cleanTables: sorts, drops duplicates and invalid", L.cleanTables([5, "3", 5, 0, 11, 2.5, "x", null, 10]), [3, 5, 10]);
eq("cleanTables: not an array", L.cleanTables(undefined), []);

// ---- 2. parseAnswer ----
eq("parse 56", L.parseAnswer("56"), 56);
eq("parse 100", L.parseAnswer("100"), 100);
eq("parse with spaces", L.parseAnswer(" 7 "), 7);
eq("parse leading zero", L.parseAnswer("056"), 56);
eq("empty is not an answer", L.parseAnswer(""), null);
eq("null is not an answer", L.parseAnswer(null), null);
eq("letters are not an answer", L.parseAnswer("5a"), null);
eq("negative is not an answer", L.parseAnswer("-5"), null);
eq("more than 3 digits is not an answer", L.parseAnswer("1000"), null);

// ---- 3. Tabelltrappan (ladder): one table in order, ends after 10 ----
{
  const r = L.newRound("ladder", { table: 7 }, L.makeRand(1));
  eq("ladder total", r.total, 10);
  eq("ladder starts with 7·1", [r.current.a, r.current.b], [7, 1]);
  const seen = playThrough(r, right);
  eq("ladder comes in order 7·1 … 7·10", seen.map(key), L.tableFacts(7).map(key));
  check("ladder finishes after 10 answers", r.finished && !r.stopped && r.current === null);
  eq("ladder counts", [r.asked, r.correct, r.streak, r.bestStreak], [10, 10, 10, 10]);
  check("no more questions after the end", L.nextQuestion(r) === null);
  check("answering after the end is ignored", L.answer(r, 7) === null && r.asked === 10);
  const s = L.summary(r);
  eq("ladder summary", [s.asked, s.correct, s.wrong, s.total, s.complete, s.percent], [10, 10, 0, 10, true, 100]);
  eq("ladder verdict: all right", L.verdict(s), "Alla rätt! 🌟");
}
for (const t of L.TABLES) {
  const r = L.newRound("ladder", { table: String(t) });
  eq(`ladder for table ${t} (given as text)`, playThrough(r, right).map(key), L.tableFacts(t).map(key));
}
{
  let threw = false;
  try { L.newRound("ladder", { table: 11 }); } catch (e) { threw = true; }
  check("ladder needs a valid table", threw);
}

// ---- 4. Tabellmix: chosen tables, every fact exactly once, shuffled ----
{
  const r = L.newRound("mix", { tables: [5, 3] }, L.makeRand(42));
  eq("mix tables sorted", r.tables, [3, 5]);
  eq("mix total = 10 per table", r.total, 20);
  const seen = playThrough(r, right);
  eq("mix asks 20 questions", seen.length, 20);
  eq("mix: no question twice", new Set(seen.map(key)).size, 20);
  eq("mix: exactly the facts of the 3 and 5 tables",
    seen.map(key).sort(), L.tableFacts(3).concat(L.tableFacts(5)).map(key).sort());
  check("mix: 3·5 and 5·3 both come (each belongs to its own table)", seen.some((q) => q.a === 3 && q.b === 5) && seen.some((q) => q.a === 5 && q.b === 3));
  check("mix is shuffled, not in table order", seen.map(key).join() !== L.tableFacts(3).concat(L.tableFacts(5)).map(key).join());
  check("mix finished", r.finished && !r.stopped);
  eq("mix counts", [r.asked, r.correct], [20, 20]);
}
{
  const r = L.newRound("mix", { tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, L.makeRand(7));
  const seen = playThrough(r, right);
  eq("mix with all tables: 100 different questions", [seen.length, new Set(seen.map(key)).size], [100, 100]);
}
{
  const r = L.newRound("mix", { tables: [8, 8, 8] });
  eq("mix: a table listed twice is only used once", r.total, 10);
}
{
  // different seeds give different orders, same seed the same order
  const order = (seed) => playThrough(L.newRound("mix", { tables: [6, 7] }, L.makeRand(seed)), right).map(key).join();
  check("mix: same seed, same order", order(3) === order(3));
  check("mix: different seeds, different orders", order(3) !== order(4));
}
{
  let threw = false;
  try { L.newRound("mix", { tables: [] }); } catch (e) { threw = true; }
  check("mix needs at least one table", threw);
}

// ---- 5. Fri träning: all tables, never ends, never the same twice in a row ----
{
  const r = L.newRound("free", {}, L.makeRand(99));
  eq("free has no total", r.total, null);
  const seen = playThrough(r, right, 1000);
  eq("free keeps going (1000 questions)", seen.length, 1000);
  check("free never finishes by itself", !r.finished && r.current !== null);
  check("free: every question is from tables 1–10", seen.every((q) => q.a >= 1 && q.a <= 10 && q.b >= 1 && q.b <= 10 && q.answer === q.a * q.b));
  check("free: never the same question twice in a row", seen.every((q, i) => i === 0 || key(q) !== key(seen[i - 1])));
  eq("free: the first 100 questions cover all 100 facts", new Set(seen.slice(0, 100).map(key)).size, 100);
  eq("free: so do the next 100", new Set(seen.slice(100, 200).map(key)).size, 100);
  eq("free: every table is used", [...new Set(seen.map((q) => q.a))].sort((a, b) => a - b), L.TABLES);
  L.stopRound(r);
  check("free ends when stopped", r.finished && r.stopped && r.current === null);
  const s = L.summary(r);
  eq("free summary after stopping", [s.asked, s.correct, s.total, s.complete], [1000, 1000, null, false]);
  eq("free verdict: only right answers", L.verdict(s), "Bara rätt svar! 🌟");
}
{
  // the no-repeat rule must hold across reshuffles for many seeds
  let ok = true;
  for (let seed = 1; seed <= 200 && ok; seed++) {
    const r = L.newRound("free", {}, L.makeRand(seed));
    const seen = playThrough(r, right, 220);
    ok = seen.every((q, i) => i === 0 || key(q) !== key(seen[i - 1]));
  }
  check("free: no repeat in a row across deck reshuffles (200 seeds)", ok);
}

// ---- 6. counting right and wrong answers ----
{
  const r = L.newRound("ladder", { table: 4 });
  // right, right, wrong, right, right, right, wrong, wrong, right, right
  const pattern = [1, 1, 0, 1, 1, 1, 0, 0, 1, 1];
  const results = [];
  for (const okBit of pattern) {
    const q = r.current;
    results.push(L.answer(r, okBit ? q.answer : q.answer + 1));
    L.nextQuestion(r);
  }
  eq("answer() reports right/wrong", results.map((x) => x.ok), pattern.map(Boolean));
  eq("answer() reports the right answer", results[2].expected, 12);
  eq("answer() reports what was given", results[2].given, 13);
  eq("questions and right answers counted", [r.asked, r.correct], [10, 7]);
  eq("longest run of right answers", r.bestStreak, 3);
  eq("current run after the last two right", r.streak, 2);
  eq("missed questions in order", L.missedList(r).map(key), ["4x3", "4x7", "4x8"]);
  eq("history has every answer", r.history.length, 10);
  const s = L.summary(r);
  eq("summary", [s.asked, s.correct, s.wrong, s.percent, s.complete, s.bestStreak], [10, 7, 3, 70, true, 3]);
  eq("verdict at 70 %", L.verdict(s), "Bra kämpat!");
}
{
  const r = L.newRound("mix", { tables: [9] });
  check("an empty answer is not counted", L.answer(r, "") === null && r.asked === 0 && r.current !== null);
  check("a non-number is not counted", L.answer(r, "abc") === null && r.asked === 0);
  const q = r.current;
  check("a numeric string counts", L.answer(r, String(q.answer)).ok === true && r.asked === 1);
  check("answering twice before the next question is ignored", L.answer(r, 1) === null && r.asked === 1);
  L.nextQuestion(r);
  L.answer(r, 0);
  eq("a wrong answer counts as a question but not as right", [r.asked, r.correct, r.streak], [2, 1, 0]);
  L.stopRound(r);
  const s = L.summary(r);
  eq("stopping early: not complete", [s.asked, s.total, s.complete], [2, 10, false]);
  check("stopping twice is harmless", (L.stopRound(r), r.asked === 2 && r.finished));
}
{
  const r = L.newRound("free", {});
  const q = r.current;
  L.answer(r, q.answer + 1); L.nextQuestion(r);
  // force the same fact to be missed twice: the summary lists it once
  r.current = q; L.answer(r, 0);
  eq("missed list has no duplicates", L.missedList(r).map(key), [key(q)]);
}
eq("verdict 85 %", L.verdict({ asked: 20, correct: 17, percent: 85, complete: true }), "Snyggt jobbat!");
eq("verdict 30 %", L.verdict({ asked: 10, correct: 3, percent: 30, complete: true }), "Bra att du tränar!");
eq("verdict nothing answered", L.verdict({ asked: 0, correct: 0, percent: 0 }), "Ingen fråga besvarad");

// ---- 7. small Swedish text helpers ----
eq("table name", L.tableName(7), "7:ans");
eq("list of one", L.listSv([3]), "3");
eq("list of two", L.listSv([3, 5]), "3 och 5");
eq("list of three", L.listSv([3, 5, 7]), "3, 5 och 7");
eq("plural one", L.plural(1, "fråga", "frågor"), "1 fråga");
eq("plural many", L.plural(20, "fråga", "frågor"), "20 frågor");

{
  let threw = false;
  try { L.newRound("nope", {}); } catch (e) { threw = true; }
  check("unknown mode throws", threw);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
