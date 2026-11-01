#!/usr/bin/env node
/* Tests for the pure game logic in games/glosor.html (Glosjakten).
   Run with: node tests/glosor.test.js
   Extracts the /*LOGIC-START*​/ … /*LOGIC-END*​/ block from the game file,
   so the game stays a single self-contained HTML file. */
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "games", "glosor.html"), "utf8");
const m = html.match(/\/\*LOGIC-START\*\/([\s\S]*?)\/\*LOGIC-END\*\//);
if (!m) { console.error("LOGIC block not found in glosor.html"); process.exit(1); }

const L = new Function(m[1] + `
  return { CATS, WORDS, BY, TWINS, twin, LEVELS, MODES, MODE, AREAS, LEN, STICKER, MISS_MIN, setLang, tr,
    makeRand, shuffle, norm, isRightSpelling, textOf, editDistance, misspellings, inArea, poolFor, missCount,
    makeOptions, makeSlots, blanks, filled, newRound, nextQuestion, currentQ, roundOver, roundCleared,
    typeKey, canSubmit, answer, cleanProgress, cleanCounts, recordRound, applyTouched, hasSticker,
    stickerCount, catWords, catDone };
`)();

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; }
  else { failed++; console.error("FAIL: " + name + (detail ? "\n  " + detail : "")); }
}
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) console.error(`FAIL: ${name}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`);
  ok ? passed++ : failed++;
}
const all = (list, fn) => list.filter((x) => !fn(x));

// ---- 1. the words ----
eq("ten categories", L.CATS.map((c) => c.id), ["farger", "djur", "siffror", "mat", "klader", "kroppen", "hemma", "natur", "fordon", "gora"]);
eq("176 words", L.WORDS.length, 176);
eq("English words are unique", new Set(L.WORDS.map((w) => w.en)).size, L.WORDS.length);
eq("Swedish words are unique", new Set(L.WORDS.map((w) => w.sv)).size, L.WORDS.length);
eq("no word is the same in both languages", all(L.WORDS, (w) => L.norm(w.en) !== L.norm(w.sv)).map((w) => w.en), []);
eq("every picture is different", new Set(L.WORDS.map((w) => w.pic)).size, L.WORDS.length);
eq("English words are lower case a–z (and spaces)", all(L.WORDS, (w) => /^[a-z]+( [a-z]+)?$/.test(w.en)).map((w) => w.en), []);
eq("other spellings are lower case a–z and differ from the word", all(L.WORDS, (w) => w.alt.every((a) => /^[a-z ]+$/.test(a) && a !== w.en)).map((w) => w.en), []);
eq("no other spelling is another word", all(L.WORDS, (w) => w.alt.every((a) => !L.BY[a])).map((w) => w.en), []);
eq("Swedish words are lower case letters", all(L.WORDS, (w) => /^[a-zåäö]+$/.test(w.sv)).map((w) => w.en), []);
eq("difficulty is 1, 2 or 3", all(L.WORDS, (w) => [1, 2, 3].includes(w.t)).map((w) => w.en), []);
eq("pictures are an emoji, a colour or a number",
  all(L.WORDS, (w) => /^#[0-9a-f]{6}$/.test(w.pic) || /^\d+$/.test(w.pic) || /\p{Extended_Pictographic}/u.test(w.pic)).map((w) => w.en), []);
eq("colours have colour pictures, numbers have numbers",
  [L.catWords("farger").every((w) => w.pic[0] === "#"), L.catWords("siffror").every((w) => /^\d+$/.test(w.pic))], [true, true]);
for (const C of L.CATS) {
  const ws = L.catWords(C.id);
  check(`${C.id}: at least 5 of the easiest words and 13 in all`, ws.filter((w) => w.t === 1).length >= 5 && ws.length >= 13, ws.length);
  check(`${C.id}: has a Swedish and an English name`, C.name && C.en && C.icon);
}
check("twins are real words", L.TWINS.flat().every((id) => L.BY[id]));
check("twin works both ways", L.twin("ship", "boat") && L.twin("boat", "ship") && !L.twin("ship", "car"));

// ---- 2. levels and modes ----
eq("five levels with the same names as the other games", L.LEVELS.map((l) => l.name), ["Lätt", "Mellan", "Svår", "Geni", "Omöjliga"]);
eq("more answers to choose from on every level", L.LEVELS.map((l) => l.opts), [3, 4, 5, 6, 6]);
eq("right answers needed to clear a level", L.LEVELS.map((l) => l.need), [7, 8, 8, 9, 10]);
eq("five ways to practise", L.MODES.map((m) => m.name), ["Bilder", "Engelska → svenska", "Svenska → engelska", "Skriv klart", "Skriv ordet"]);
eq("areas: all words, the ten categories and my misses", L.AREAS.map((a) => a.id), ["alla", ...L.CATS.map((c) => c.id), "missar"]);

// ---- 3. which words come ----
{
  eq("Lätt, all words: only the easiest", [...new Set(L.poolFor("alla", 0).map((w) => w.t))], [1]);
  eq("Mellan: difficulty 1 and 2", [...new Set(L.poolFor("alla", 1).map((w) => w.t))].sort(), [1, 2]);
  eq("Svår and up: every word", [2, 3, 4].map((l) => L.poolFor("alla", l).length), [176, 176, 176]);
  check("one category only has its own words", L.poolFor("djur", 2).every((w) => w.k === "djur") && L.poolFor("djur", 2).length === 23);
  eq("My misses: the words answered wrong, of any difficulty", L.poolFor("missar", 0, { owl: 2, dog: 1, x: 3 }).map((w) => w.en).sort(), ["dog", "owl"]);
  eq("missCount ignores unknown words", L.missCount({ owl: 2, dog: 1, x: 3 }), 2);
}

// ---- 4. answers to choose from ----
{
  const rand = L.makeRand(11);
  let bad = [];
  for (const M of L.MODES.filter((m) => m.kind === "choice")) {
    for (const [lvl, Lv] of L.LEVELS.entries()) {
      for (const area of ["alla", "djur", "siffror", "farger"]) {
        for (const w of L.poolFor(area, lvl)) {
          const o = L.makeOptions(rand, M, Lv, area, w.id);
          const right = L.textOf(w, M.ans);
          if (o.length !== Lv.opts) bad.push(`${M.id}/${lvl}/${w.en}: ${o.length} answers`);
          if (o.filter((x) => x === right).length !== 1) bad.push(`${M.id}/${lvl}/${w.en}: the right answer is not there once`);
          if (new Set(o).size !== o.length) bad.push(`${M.id}/${lvl}/${w.en}: the same answer twice`);
          if (M.ask === "pic") {
            const ids = o.map((x) => L.WORDS.find((v) => v.en === x)).filter(Boolean).map((v) => v.id);
            if (ids.some((a, i) => ids.some((b, j) => i < j && L.twin(a, b)))) bad.push(`${M.id}/${lvl}/${w.en}: two pictures that look alike`);
          }
        }
      }
    }
  }
  eq("every choice question has the right number of different answers, the right one once", bad.slice(0, 5), []);

  const lv = (i) => L.LEVELS[i];
  const cats = (M, i, area, id) => L.makeOptions(L.makeRand(5), L.MODE[M], lv(i), area, id).map((x) => L.WORDS.find((v) => L.textOf(v, L.MODE[M].ans) === x)).filter(Boolean).map((v) => v.k);
  check("Svår, all words: wrong answers from the same category", cats("sven", 2, "alla", "lion").every((k) => k === "djur"));
  check("Lätt, all words: the easiest words as wrong answers", L.makeOptions(L.makeRand(3), L.MODE.sven, lv(0), "alla", "dog").every((x) => L.WORDS.find((v) => v.en === x).t === 1));
  {
    const o = L.makeOptions(L.makeRand(9), L.MODE.sven, lv(3), "djur", "bear");
    const near = o.filter((x) => x !== "bear").map((x) => L.editDistance(x, "bear"));
    check("Geni: wrong answers look like the right one", Math.min(...near) <= 2, o.join(", "));
  }
  {
    const o = L.makeOptions(L.makeRand(9), L.MODE.sven, lv(4), "djur", "elephant");
    check("Omöjliga, Swedish → English: the right spelling among misspellings", o.filter((x) => !L.BY[x]).length === 5 && o.includes("elephant"), o.join(", "));
    const o2 = L.makeOptions(L.makeRand(9), L.MODE.bilder, lv(4), "alla", "giraffe");
    check("Omöjliga, Pictures: misspellings too", o2.filter((x) => !L.BY[x]).length >= 4, o2.join(", "));
    const o3 = L.makeOptions(L.makeRand(9), L.MODE.ensv, lv(4), "djur", "elephant");
    check("Omöjliga, English → Swedish: real Swedish words that look alike", o3.every((x) => L.WORDS.some((v) => v.sv === x)), o3.join(", "));
  }
}

// ---- 5. misspellings ----
{
  const real = new Set(L.WORDS.flatMap((w) => [w.en, ...w.alt]));
  let bad = [];
  for (const w of L.WORDS) {
    const ms = L.misspellings(w.en);
    if (ms.some((s) => real.has(s) || s === w.en)) bad.push(w.en + ": a real word");
    if (ms.some((s) => !/^[a-z]+( [a-z]+)?$/.test(s))) bad.push(w.en + ": " + ms.find((s) => !/^[a-z]+( [a-z]+)?$/.test(s)));
    if (ms.some((s) => s[0] !== w.en[0])) bad.push(w.en + ": changes the first letter");
  }
  eq("misspellings are never real words, the word itself, or odd text", bad.slice(0, 5), []);
  // typical misspellings: a letter too few, a sound spelt another way, another vowel, a lost silent e
  check("rabbit → rabit", L.misspellings("rabbit").includes("rabit"));
  check("elephant → elefant", L.misspellings("elephant").includes("elefant"));
  check("sheep → sheap", L.misspellings("sheep").includes("sheap"));
  check("horse → hors", L.misspellings("horse").includes("hors"));
  check("grey's misspellings leave out gray, which is right", !L.misspellings("grey").includes("gray"));
}

// ---- 6. the boxes in Skriv klart and Skriv ordet ----
{
  const rand = L.makeRand(4);
  for (const [lvl, Lv] of L.LEVELS.entries()) {
    let bad = [];
    for (const w of L.WORDS) {
      const s = L.makeSlots(rand, w.en, Lv.hide);
      const letters = [...w.en].filter((c) => c !== " ").length, hidden = s.filter((x) => x === null).length;
      if (s.length !== w.en.length) bad.push(w.en + ": length");
      if (s[0] !== w.en[0]) bad.push(w.en + ": the first letter is hidden");
      if ([...w.en].some((c, i) => c === " " && s[i] !== " ")) bad.push(w.en + ": a space is hidden");
      if (s.some((x, i) => x !== null && x !== w.en[i])) bad.push(w.en + ": wrong given letter");
      if (hidden < 1) bad.push(w.en + ": nothing to type");
      if (Lv.hide === "first" && hidden !== letters - 1) bad.push(w.en + ": more than the first letter shows");
      if (Lv.hide !== "first" && hidden > Math.round(letters * Lv.hide) + 1) bad.push(w.en + ": too much hidden");
    }
    eq(`${Lv.name}: Skriv klart boxes`, bad.slice(0, 4), []);
  }
  eq("a third of 'elephant' is missing on Lätt", L.makeSlots(L.makeRand(1), "elephant", 1 / 3).filter((x) => x === null).length, 3);
  eq("only the first letter of 'ice cream' on Geni", L.makeSlots(L.makeRand(1), "ice cream", "first"), ["i", null, null, " ", null, null, null, null, null]);
  const q = { slots: ["c", null, null], typed: "a" };
  eq("filled puts the typed letters in the boxes", [L.filled(q, "a"), L.filled(q, "at"), L.blanks(q)], ["ca", "cat", 2]);
}

// ---- 7. a round ----
{
  // choice: right answers count, wrong ones are remembered
  const R = L.newRound({ mode: "sven", lvl: 0, area: "djur" }, 42, {});
  eq("a round has 10 questions", R.len, 10);
  for (let i = 0; i < 10; i++) {
    const q = L.nextQuestion(R);
    check(`question ${i + 1} is about an easy animal`, L.BY[q.target].k === "djur" && L.BY[q.target].t === 1);
    const pick = i < 7 ? q.answer : q.options.find((o) => o !== q.answer);
    const res = L.answer(R, pick);
    check(`answer ${i + 1} touches its word`, res && res.touched[0][0] === q.target && res.touched[0][1] === (i < 7));
    check(`question ${i + 1} can't be answered twice`, L.answer(R, pick) === null);
  }
  eq("7 of 10 right clears Lätt", [R.right, L.roundOver(R), L.roundCleared(R)], [7, true, true]);
  eq("the missed words are listed once", R.missed.length >= 1 && R.missed.length <= 3, true);
  check("a word never comes twice in a row", R.qs.every((q, i) => !i || q.target !== R.qs[i - 1].target));
  check("an answer that is not an option is ignored", (() => { const R2 = L.newRound({ mode: "sven", lvl: 0, area: "djur" }, 1, {}); L.nextQuestion(R2); return L.answer(R2, "banana") === null; })());
}
{
  // Skriv klart: type the missing letters, delete, answer
  const R = L.newRound({ mode: "luckor", lvl: 0, area: "djur" }, 7, {});
  const q = L.nextQuestion(R), w = L.BY[q.target];
  const missing = q.slots.map((s, i) => (s === null ? w.en[i] : "")).join("");
  check("only letters can be typed", !L.typeKey(R, "1") && !L.typeKey(R, "A") && !L.typeKey(R, " "));
  check("nothing to answer before every box is filled", !L.canSubmit(q) && L.answer(R) === null);
  for (const ch of missing) check(`typing ${ch}`, L.typeKey(R, ch));
  check("no more letters than boxes", !L.typeKey(R, "x"));
  check("backspace deletes the last letter, and it can be typed again", L.typeKey(R, "back") && L.typeKey(R, missing.slice(-1)));
  const res = L.answer(R);
  eq("the right letters give a right answer", [res.q.ok, res.q.pick], [true, w.en]);
}
{
  // Skriv ordet with no boxes: spaces, other spellings and wrong spelling
  const R = L.newRound({ mode: "stava", lvl: 2, area: "farger" }, 3, {});
  let q = L.nextQuestion(R);
  q.target = "grey";
  check("a space can't come first", !L.typeKey(R, " "));
  for (const ch of "gray") L.typeKey(R, ch);
  check("can answer when something is typed", L.canSubmit(q));
  eq("American spelling counts", L.answer(R).q.ok, true);
  q = L.nextQuestion(R); q.target = "dark blue";
  for (const ch of "dark  blue") L.typeKey(R, ch);
  eq("two spaces in a row are typed as one", q.typed, "dark blue");
  eq("two words with a space", L.answer(R).q.ok, true);
  q = L.nextQuestion(R); q.target = "turquoise";
  for (const ch of "turkos") L.typeKey(R, ch);
  const res = L.answer(R);
  eq("a misspelling is wrong, and the word goes to the misses", [res.q.ok, res.q.pick, R.missed.includes("turquoise")], [false, "turkos", true]);
}
{
  // Skriv ordet on Lätt and Mellan: boxes (and the first letter on Lätt)
  const R = L.newRound({ mode: "stava", lvl: 0, area: "djur" }, 5, {});
  const q = L.nextQuestion(R), w = L.BY[q.target];
  eq("Lätt: boxes for every letter, the first one given", [q.slots.length, q.slots[0], q.slots.slice(1).every((s) => s === null || s === " ")], [w.en.length, w.en[0], true]);
  const R2 = L.newRound({ mode: "stava", lvl: 1, area: "djur" }, 5, {});
  const q2 = L.nextQuestion(R2);
  check("Mellan: boxes but no letters", q2.slots.every((s) => s === null || s === " "));
  const R3 = L.newRound({ mode: "stava", lvl: 3, area: "djur" }, 5, {});
  check("Geni: no boxes", L.nextQuestion(R3).slots === null);
}
eq("norm ignores capitals, hyphens and extra spaces", L.norm("  Ice-Cream "), "ice cream");
check("isRightSpelling knows other spellings", L.isRightSpelling(L.BY["ice cream"], "icecream") && L.isRightSpelling(L.BY.plane, "Aeroplane") && !L.isRightSpelling(L.BY.plane, "plain"));

// ---- 8. progress, the album and misses ----
{
  const p = L.cleanProgress(null);
  eq("fresh progress: Lätt open in every mode", L.MODES.map((M) => p[M.id].u), [0, 0, 0, 0, 0]);
  eq("clearing Lätt unlocks Mellan", L.recordRound(p, "bilder", 0, 8, true), 1);
  eq("best and cleared rounds are kept", [p.bilder.b[0], p.bilder.c[0]], [8, 1]);
  eq("a round that is not cleared unlocks nothing", L.recordRound(p, "bilder", 1, 6, false), -1);
  eq("but its best counts", p.bilder.b[1], 6);
  eq("other modes are separate", p.sven.u, 0);
  for (const i of [1, 2, 3]) L.recordRound(p, "bilder", i, 10, true);
  eq("Omöjliga is the last level", [p.bilder.u, L.recordRound(p, "bilder", 4, 10, true), p.bilder.u], [4, -1, 4]);
  eq("cleanProgress keeps good values and drops bad ones",
    L.cleanProgress({ bilder: { u: 9, b: [12, "x", 3], c: [2] }, sven: "nope" }).bilder, { u: 4, b: [10, 0, 3, 0, 0], c: [2, 0, 0, 0, 0] });
  eq("cleanCounts drops unknown words and caps", L.cleanCounts({ dog: 120, x: 2, cat: -1, owl: "3" }, 99), { dog: 99, owl: 3 });
}
{
  const album = {}, miss = {};
  eq("two right answers: no sticker yet", [L.applyTouched(album, miss, [["dog", true]]), L.applyTouched(album, miss, [["dog", true]]), L.hasSticker(album, "dog")], [[], [], false]);
  eq("the third right answer gives the sticker", L.applyTouched(album, miss, [["dog", true]]), ["dog"]);
  eq("only once", L.applyTouched(album, miss, [["dog", true]]), []);
  L.applyTouched(album, miss, [["cat", false]]);
  eq("a wrong answer is a miss", miss.cat, 2);
  L.applyTouched(album, miss, [["cat", false], ["cat", false], ["cat", false]]);
  eq("misses are capped at 5", miss.cat, 5);
  L.applyTouched(album, miss, [["cat", true], ["cat", true], ["cat", true], ["cat", true], ["cat", true]]);
  eq("right answers take misses away", [miss.cat, L.stickerCount(album)], [undefined, 2]);
  for (const w of L.catWords("farger")) for (let i = 0; i < 3; i++) L.applyTouched(album, miss, [[w.id, true]]);
  eq("a whole category gives its medal", [L.catDone(album, "farger"), L.catDone(album, "djur"), L.stickerCount(album)], [true, false, 15]);
}

// ---- 9. both languages ----
L.setLang("en");
eq("modes in English", L.MODES.map((m) => m.name), ["Pictures", "English → Swedish", "Swedish → English", "Fill in the gaps", "Spell the word"]);
eq("levels in English", L.LEVELS.map((l) => l.name), ["Easy", "Medium", "Hard", "Genius", "Impossible"]);
eq("categories in English", L.CATS.map((c) => c.name).slice(0, 4), ["Colours", "Animals", "Numbers", "Food"]);
eq("areas in English", [L.AREAS[0].name, L.AREAS[L.AREAS.length - 1].name], ["All words", "My misses"]);
check("blurbs in English", L.MODES.every((m) => !/[åäö]/.test(m.blurb)));
L.setLang("sv");
eq("and back to Swedish", [L.MODES[0].name, L.CATS[0].name, L.LEVELS[0].name], ["Bilder", "Färger", "Lätt"]);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
