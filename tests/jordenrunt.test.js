#!/usr/bin/env node
/* Tests for the pure game logic and data in games/jordenrunt.html.
   Run with: node tests/jordenrunt.test.js
   Extracts the /*LOGIC-START*​/ … /*LOGIC-END*​/ block and the FLAGS table from the
   game file, so the game stays a single self-contained HTML file. */
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "games", "jordenrunt.html"), "utf8");
const m = html.match(/\/\*LOGIC-START\*\/([\s\S]*?)\/\*LOGIC-END\*\//);
if (!m) { console.error("LOGIC block not found in jordenrunt.html"); process.exit(1); }
const fm = html.match(/const FLAGS=(\{[\s\S]*?\});\n/);
if (!fm) { console.error("FLAGS table not found in jordenrunt.html"); process.exit(1); }
const FLAGS = JSON.parse(fm[1]);

const L = new Function(m[1] + `
  return { COUNTRIES, BY, CONTINENTS, CONT, TWINS, twin, LEVELS, MODES, MODE, METRICS, AREAS, DUEL_LEN,
    CLUES_MAX, STAMP, MISS_MIN, makeRand, shuffle, ratio, poolFor, decoyPool, areaAll, missCount,
    makeOptions, pickSpread, newRound, nextQuestion, currentQ, roundOver, roundScore, roundCleared,
    answer, guessMystery, moreClue, fmtPop, fmtArea, timesText, compareText, listSv, cluesFor,
    searchCountries, cleanProgress, recordRound, applyTouched, stampCount };
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
const NB = " "; // numbers are grouped with non-breaking spaces
const C = L.COUNTRIES, BY = L.BY;
const codes = C.map((c) => c.c);

// ---- 1. the countries ----
eq("195 countries: the 193 UN members plus the Vatican and Palestine", C.length, 195);
check("country codes are unique two-letter codes", new Set(codes).size === 195 && codes.every((c) => /^[a-z]{2}$/.test(c)));
check("names are unique", new Set(C.map((c) => c.n)).size === 195);
check("every country has a name, a capital, a known continent, area, population and tier",
  C.every((c) => c.n && c.cap && L.CONT[c.k] && c.a > 0 && c.p > 0 && [1, 2, 3, 4].includes(c.t)));
check("second continents are known and differ from the first", C.every((c) => !c.x || c.x.every((k) => L.CONT[k] && k !== c.k)));
check("neighbours are other countries in the game", C.every((c) => c.b.every((b) => BY[b] && b !== c.c)));
check("being neighbours goes both ways", C.every((c) => c.b.every((b) => BY[b].b.includes(c.c))));
check("lookalike flags are other countries in the game", C.every((c) => c.s.every((s) => BY[s] && s !== c.c)));
const COLORS = ["röd", "vit", "blå", "grön", "gul", "svart", "orange", "lila"];
check("every flag has 1–6 colours, named in Swedish", C.every((c) => c.f.length >= 1 && c.f.length <= 6 && c.f.every((f) => COLORS.includes(f))));
check("capitals in the capital quiz are unique", new Set(C.filter((c) => !c.nc).map((c) => c.cap)).size === C.filter((c) => !c.nc).length);
check("'same' capitals really have the country's name", C.filter((c) => c.same).every((c) => c.cap === c.n && c.nc));
eq("left out of the capital quiz: same name as the country, or disputed",
  C.filter((c) => c.nc).map((c) => c.c).sort(), ["dj", "il", "kw", "lu", "mc", "ps", "sg", "sm", "va"]);
eq("countries in two continents", C.filter((c) => c.x).map((c) => c.c + ":" + c.k + "+" + c.x.join("+")).sort(),
  ["am:as+eu", "az:as+eu", "cy:eu+as", "eg:af+as", "ge:as+eu", "kz:as+eu", "ru:eu+as", "tr:as+eu"]);
const perCont = {}; for (const c of C) perCont[c.k] = (perCont[c.k] || 0) + 1;
eq("countries per continent", perCont, { as: 47, eu: 45, af: 54, na: 23, sa: 12, oc: 14 });
eq("Swedish names and capitals", ["se", "fi", "dk", "no", "is", "ua", "us", "gb", "cn", "gq", "ch", "za"].map((c) => BY[c].n + ":" + BY[c].cap),
  ["Sverige:Stockholm", "Finland:Helsingfors", "Danmark:Köpenhamn", "Norge:Oslo", "Island:Reykjavik", "Ukraina:Kyjiv",
    "USA:Washington", "Storbritannien:London", "Kina:Peking", "Ekvatorialguinea:Ciudad de la Paz", "Schweiz:Bern", "Sydafrika:Pretoria"]);
check("island countries have no neighbours", ["jp", "is", "nz", "au", "mg", "lk", "cu", "mt"].every((c) => BY[c].b.length === 0));
eq("Sweden's neighbours", BY.se.b.slice().sort(), ["fi", "no"]);
check("the best-known tier holds the big, well-known countries", ["se", "us", "cn", "br", "au", "eg"].every((c) => BY[c].t === 1));
eq("countries per tier", [1, 2, 3, 4].map((t) => C.filter((c) => c.t === t).length), [41, 69, 47, 38]);

// ---- 2. the flags ----
eq("one flag per country, no extra flags", Object.keys(FLAGS).sort(), codes.slice().sort());
check("every flag is an SVG in the same 4:3 format", Object.values(FLAGS).every((s) => s.startsWith("<svg") && /viewBox="0 0 640 480"/.test(s) && s.trim().endsWith("</svg>")));
check("flags load nothing from outside", Object.values(FLAGS).every((s) => !/(href|src)="https?:/.test(s) && !/url\(\s*["']?https?:/.test(s)));
const flagBytes = Object.values(FLAGS).reduce((n, s) => n + s.length, 0);
check(`all flags together are under 700 kB (${Math.round(flagBytes / 1024)} kB)`, flagBytes < 700 * 1024);
check("twins are real lookalikes of each other", L.TWINS.every(([a, b]) => L.twin(a, b) && L.twin(b, a) && BY[a].s.includes(b)));

// ---- 3. levels and modes ----
eq("level names", L.LEVELS.map((l) => l.name), ["Lätt", "Mellan", "Svår", "Geni", "Omöjliga"]);
eq("answer options grow with the level", L.LEVELS.map((l) => l.opts), [3, 4, 5, 6, 6]);
eq("countries to sort grow with the level", L.LEVELS.map((l) => l.sortN), [3, 4, 4, 5, 6]);
check("sorting and higher/lower get closer with the level",
  L.LEVELS.every((l, i) => i === 0 || (l.sortMin < L.LEVELS[i - 1].sortMin && l.hilo[0] < L.LEVELS[i - 1].hilo[0])));
eq("the six modes", L.MODES.map((m) => m.name), ["Flaggor", "Huvudstäder", "Storleksordning", "Världsdelar", "Högre eller lägre", "Mysterielandet"]);

// ---- 4. which countries come up ----
eq("Lätt, whole world: the best-known countries", L.poolFor("flaggor", "world", 0, null).length, 41);
eq("Geni, whole world: all countries", L.poolFor("flaggor", "world", 3, null).length, 195);
eq("Lätt in Oceania borrows less known countries until there are at least 8",
  L.poolFor("flaggor", "oc", 0, null).map((c) => c.c).sort(), C.filter((c) => c.k === "oc").map((c) => c.c).sort());
check("an area only gives its own countries", L.poolFor("flaggor", "af", 2, null).every((c) => c.k === "af"));
check("the capital quiz never asks about left-out capitals", [0, 1, 2, 3, 4].every((lv) => L.poolFor("huvudstader", "world", lv, null).every((c) => !c.nc)));
check("Världsdelar on Lätt and Mellan leaves out countries in two continents",
  [0, 1].every((lv) => L.poolFor("varldsdelar", "world", lv, null).every((c) => !c.x)) &&
  L.poolFor("varldsdelar", "world", 2, null).some((c) => c.x));
const miss = { se: 2, jp: 1, ps: 1 };
eq("Mina missar: just the missed countries (that fit the mode)", L.poolFor("huvudstader", "missar", 0, miss).map((c) => c.c).sort(), ["jp", "se"]);
eq("missCount counts the missed countries that fit the mode", [L.missCount("flaggor", miss), L.missCount("huvudstader", miss)], [3, 2]);

// ---- 5. answer options ----
{
  let bad = [], similarHits = 0, similarTries = 0;
  for (let seed = 1; seed <= 300; seed++) {
    for (const [lv, Lv] of L.LEVELS.entries()) {
      const rand = L.makeRand(seed * 31 + lv);
      for (const kind of ["flag", "cap", "land"]) {
        const modeId = kind === "cap" ? "huvudstader" : "flaggor";
        const area = ["world", "eu", "oc", "sa"][seed % 4];
        const pool = L.poolFor(modeId, area, lv, null);
        const target = pool[seed % pool.length].c;
        const opts = L.makeOptions(rand, kind, target, L.decoyPool(modeId, area, lv), Lv, Lv.opts);
        if (opts.length !== Lv.opts || !opts.includes(target) || new Set(opts).size !== opts.length) bad.push(`${kind} ${lv} ${target} ${opts}`);
        if (kind === "flag" && opts.some((a) => opts.some((b) => L.twin(a, b)))) bad.push("twins " + opts);
        if (kind === "cap" && (opts.some((c) => BY[c].nc) || new Set(opts.map((c) => BY[c].cap)).size !== opts.length)) bad.push("caps " + opts);
        if (kind === "flag" && Lv.pick === "similar" && area === "world" && BY[target].s.filter((s) => !L.twin(s, target)).length) {
          similarTries++; if (opts.some((c) => BY[target].s.includes(c))) similarHits++;
        }
      }
    }
  }
  eq("options: right count, contain the answer, no doubles, no twin flags, unique capitals", bad.slice(0, 3), []);
  check("Omöjliga flags use lookalike flags as wrong answers", similarTries > 0 && similarHits === similarTries);
  // Lätt picks its wrong answers from the best-known countries
  const rand = L.makeRand(5);
  const opts = L.makeOptions(rand, "land", "se", L.decoyPool("flaggor", "world", 0), L.LEVELS[0], 3);
  check("Lätt wrong answers are well-known countries", opts.every((c) => BY[c].t === 1));
  // Svår: at least half of the wrong answers from the same continent
  let same = 0, total = 0;
  for (let s = 1; s <= 100; s++) {
    const o = L.makeOptions(L.makeRand(s), "land", "ke", L.decoyPool("flaggor", "world", 2), L.LEVELS[2], 5).filter((c) => c !== "ke");
    same += o.filter((c) => BY[c].k === "af").length; total += o.length;
  }
  check("Svår: at least half of the wrong answers come from the same continent", same / total >= 0.5);
}

// ---- 6. whole rounds, answered right ----
function rightAnswer(R, q) {
  if (q.type === "choice") return q.target;
  if (q.type === "continent") return BY[q.target].k;
  if (q.type === "sort") return q.answer;
  if (q.type === "hilo") return BY[q.pair[0]][q.metric] > BY[q.pair[1]][q.metric] ? q.pair[0] : q.pair[1];
  return null;
}
{
  const problems = [];
  for (const M of L.MODES) {
    for (const [lv, Lv] of L.LEVELS.entries()) {
      for (const area of ["world", "eu", "as", "af", "na", "sa", "oc"]) {
        if (M.worldOnly && area !== "world") continue;
        for (let seed = 1; seed <= 6; seed++) {
          const cfg = { mode: M.id, lvl: lv, area, dir: M.dirs ? M.dirs[seed % 3].id : undefined, metric: M.metric ? ["p", "a", "mix"][seed % 3] : undefined };
          const R = L.newRound(cfg, seed * 977 + lv, {}, M.kind === "hilo" ? 15 : undefined);
          const targets = [];
          while (!L.roundOver(R)) {
            const q = L.nextQuestion(R);
            if (!q) { problems.push(`${M.id} ${lv} ${area}: no question`); break; }
            if (q.type === "choice") {
              targets.push(q.target);
              if (q.options.length !== Lv.opts) problems.push(`${M.id} ${lv}: ${q.options.length} options`);
              if (M.id === "flaggor" && !["f2n", "n2f"].includes(q.dir)) problems.push("flag dir " + q.dir);
              if (M.id === "huvudstader" && !["n2c", "c2n"].includes(q.dir)) problems.push("cap dir " + q.dir);
              if (cfg.dir !== "mix" && q.dir !== cfg.dir) problems.push("dir not kept " + q.dir);
            }
            if (q.type === "sort") {
              if (q.items.length !== Lv.sortN) problems.push(`sort ${lv}: ${q.items.length} items`);
              const v = q.answer.map((c) => BY[c][q.metric]);
              if (v.some((x, i) => i && v[i - 1] < x * Lv.sortMin - 1e-9)) problems.push(`sort ${lv} too close: ${q.answer}`);
              if (cfg.metric !== "mix" && q.metric !== cfg.metric) problems.push("metric not kept");
            }
            if (q.type === "hilo") {
              const r = L.ratio(BY[q.pair[0]][q.metric], BY[q.pair[1]][q.metric]);
              if (r < Lv.hilo[0] || r > Lv.hilo[1]) problems.push(`hilo ${lv} ratio ${r}`);
            }
            if (q.type === "mystery") {
              targets.push(q.target);
              if (q.clues.length !== L.CLUES_MAX || q.shown !== 1) problems.push("mystery clues");
              if (Lv.mysOpts ? q.options.length !== Lv.mysOpts || !q.options.includes(q.target) : !q.domain.includes(q.target)) problems.push("mystery options");
              const res = L.guessMystery(R, q.target);
              if (!res || res.q.points !== L.CLUES_MAX) problems.push("mystery points");
              continue;
            }
            if (q.type === "continent") targets.push(q.target);
            const res = L.answer(R, rightAnswer(R, q));
            if (!res || !res.q.ok) problems.push(`${M.id} ${lv} ${area}: right answer not accepted`);
          }
          if (area !== "world" && M.kind !== "sort" && M.kind !== "hilo" && targets.some((c) => BY[c].k !== area)) problems.push(`${M.id} ${area}: country outside the area`);
          if (M.kind !== "hilo" && new Set(targets).size !== targets.length && R.pool.length >= R.len) problems.push(`${M.id} ${lv} ${area}: same country twice`);
          if (!L.roundCleared(R)) problems.push(`${M.id} ${lv} ${area}: all right but not cleared`);
          if (M.kind === "mystery" && R.points !== M.len * L.CLUES_MAX) problems.push("mystery total");
        }
      }
    }
  }
  eq("every mode, level and area: valid questions, right answers accepted, round cleared", problems.slice(0, 5), []);
}

// ---- 7. wrong answers ----
{
  const R = L.newRound({ mode: "flaggor", lvl: 0, area: "world", dir: "f2n" }, 42, {});
  const q = L.nextQuestion(R);
  const wrong = q.options.find((c) => c !== q.target);
  eq("an answer that isn't an option is ignored", L.answer(R, "zz"), null);
  const res = L.answer(R, wrong);
  eq("a wrong answer: not ok, the target is touched as wrong", [res.q.ok, res.touched], [false, [[q.target, false]]]);
  eq("answering twice is ignored", L.answer(R, q.target), null);
  eq("the target is in the missed list", R.missed, [q.target]);
  eq("score after one wrong answer", [R.answered, R.right, L.roundOver(R)], [1, 0, false]);
}
{
  // Högre eller lägre without a length goes on until the first wrong answer
  const R = L.newRound({ mode: "hogrelagre", lvl: 0, area: "world", metric: "p" }, 7, {});
  eq("higher/lower plays until a wrong answer", R.len, 0);
  for (let i = 0; i < 12; i++) { const q = L.nextQuestion(R); L.answer(R, rightAnswer(R, q)); }
  check("12 in a row clears the level", R.best === 12 && L.roundCleared(R) && !L.roundOver(R));
  const q = L.nextQuestion(R);
  const small = rightAnswer(R, q) === q.pair[0] ? q.pair[1] : q.pair[0];
  L.answer(R, small);
  eq("a wrong answer ends it and keeps the best streak", [L.roundOver(R), R.streak, L.roundScore(R)], [true, 0, 12]);
}
{
  // Mysterielandet: a wrong guess or a new clue costs a point; after 8 clues a wrong guess loses
  const R = L.newRound({ mode: "mysterium", lvl: 1, area: "world" }, 9, {});
  const q = L.nextQuestion(R);
  const wrong = q.options.filter((c) => c !== q.target);
  check("a new clue shows one more", L.moreClue(R) && q.shown === 2);
  const r1 = L.guessMystery(R, wrong[0]);
  check("a wrong guess shows the next clue and does not end the country", r1 && !r1.q.done && q.shown === 3 && q.wrong.includes(wrong[0]));
  eq("guessing the same wrong country again is ignored", L.guessMystery(R, wrong[0]), null);
  eq("a country that is not an option is ignored", L.guessMystery(R, "zz"), null);
  const r2 = L.guessMystery(R, q.target);
  eq("found after 3 clues gives 6 points", [r2.q.ok, r2.q.points, R.points], [true, 6, 6]);
  const q2 = L.nextQuestion(R);
  while (q2.shown < L.CLUES_MAX) L.moreClue(R);
  check("no more clues after the last", !L.moreClue(R));
  const r3 = L.guessMystery(R, q2.options.find((c) => c !== q2.target));
  eq("a wrong guess with all clues shown loses the country", [r3.q.done, r3.q.ok, r3.q.points, R.points], [true, false, 0, 6]);
}
{
  // Världsdelar: both continents count for countries in two
  const R = L.newRound({ mode: "varldsdelar", lvl: 2, area: "world" }, 3, {});
  let q; do { q = L.nextQuestion(R); if (!BY[q.target].x) L.answer(R, BY[q.target].k); } while (!BY[q.target].x && !L.roundOver(R));
  if (BY[q.target].x) {
    const res = L.answer(R, BY[q.target].x[0]);
    check("the second continent of a country in two is also right", res.q.ok);
  } else check("found a country in two continents on Svår", false);
}

// ---- 8. numbers and texts ----
eq("population", [10596620, 1463865525, 800, 392404, 5646436, 123366734, 1000000].map(L.fmtPop),
  ["10,6 miljoner", "1,46 miljarder", "800", "392" + NB + "000", "5,6 miljoner", "123 miljoner", "1 miljon"]);
eq("area", [450295, 0.44, 2.02, 17098242, 316, 41284, 1000000].map(L.fmtArea),
  ["450" + NB + "000 km²", "0,44 km²", "2,02 km²", "17,1 miljoner km²", "316 km²", "41" + NB + "300 km²", "1 miljon km²"]);
eq("comparisons", [L.compareText("ru", "se", "a"), L.compareText("se", "no", "p"), L.compareText("in", "cn", "p")],
  ["Ryssland är ungefär 38 gånger så stort som Sverige.", "Sverige har ungefär 1,9 gånger så många invånare som Norge.",
    "Indien och Kina har nästan lika många invånare."]);
eq("lists", [L.listSv(["a"]), L.listSv(["a", "b"]), L.listSv(["a", "b", "c"])], ["a", "a och b", "a, b och c"]);
eq("clues for Sweden", L.cluesFor(BY.se).map((c) => c.text), [
  "Landet ligger i Europa.",
  "I landet bor ungefär 10,6 miljoner människor.",
  "Landet är 450" + NB + "000 km² stort – ungefär 1,3 gånger så stort som Finland.",
  "Landet har kust mot havet och 2 grannländer.",
  "Flaggan har färgerna blå och gul.",
  "Ett av grannländerna är Finland.",
  "Huvudstaden börjar på S.",
  "Landets namn har 7 bokstäver och börjar på S."]);
check("clues for an island country", L.cluesFor(BY.jp)[3].text.includes("inga grannländer") && L.cluesFor(BY.jp)[5].text === "Huvudstaden har 5 bokstäver.");
eq("clues for a landlocked country with one neighbour", [L.cluesFor(BY.ls)[3].text, L.cluesFor(BY.ls)[5].text],
  ["Landet har ingen kust mot havet och har ett grannland.", "Landets enda grannland är Sydafrika."]);
eq("clue when the capital has the country's name", L.cluesFor(BY.mc)[6].text, "Huvudstaden heter samma sak som landet!");
eq("clue for a country in two continents", L.cluesFor(BY.ru)[0].text, "Landet ligger i både Europa och Asien.");
check("every country gets 8 clues without undefined or NaN", C.every((c) => { const t = L.cluesFor(c).map((x) => x.text).join(" "); return L.cluesFor(c).length === 8 && !/undefined|NaN|Infinity/.test(t); }));
const all = codes.slice();
eq("search: start of the name first", L.searchCountries(all, "sver"), ["se"]);
eq("search ignores case and accents", L.searchCountries(all, "OSTERR"), ["at"]);
check("search also finds the middle of a name", L.searchCountries(all, "afrika").includes("za") && L.searchCountries(all, "afrika")[0] === "cf");
eq("empty search gives nothing", L.searchCountries(all, "  "), []);

// ---- 9. progress, passport and misses ----
{
  const p = L.cleanProgress({ flaggor: { u: 9, b: [3, "x", -1], c: [1] }, bogus: {} });
  eq("cleanProgress caps the level and fixes bad numbers", p.flaggor, { u: 4, b: [3, 0, 0, 0, 0], c: [1, 0, 0, 0, 0] });
  eq("cleanProgress gives every mode", Object.keys(p), L.MODES.map((m) => m.id));
  const q = L.cleanProgress(null);
  eq("a round that is not cleared unlocks nothing", L.recordRound(q, "storlek", 0, 3, false), -1);
  eq("the best score is kept", q.storlek.b[0], 3);
  eq("clearing Lätt unlocks Mellan", L.recordRound(q, "storlek", 0, 5, true), 1);
  eq("clearing Lätt again unlocks nothing new", L.recordRound(q, "storlek", 0, 4, true), -1);
  eq("best score and cleared count", [q.storlek.b[0], q.storlek.c[0], q.storlek.u], [5, 2, 1]);
  eq("each mode unlocks on its own", q.flaggor.u, 0);
  for (let lv = 1; lv < 5; lv++) L.recordRound(q, "storlek", lv, 5, true);
  eq("Omöjliga is the last level", q.storlek.u, 4);
}
{
  const pass = {}, miss = { se: 3 };
  L.applyTouched(pass, miss, [["se", true], ["no", false]]);
  eq("a right answer counts towards the stamp and takes away a miss", [pass.se, miss.se], [1, 2]);
  eq("a wrong answer adds two misses", miss.no, 2);
  L.applyTouched(pass, miss, [["se", true], ["se", true]]);
  eq("three right answers give a stamp, and the misses are gone", [L.stampCount(pass), miss.se], [1, undefined]);
  for (let i = 0; i < 5; i++) L.applyTouched(pass, miss, [["dk", false]]);
  eq("misses stop at 5", miss.dk, 5);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
