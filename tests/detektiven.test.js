#!/usr/bin/env node
/* Tests for the pure game logic in games/detektiven.html.
   Run with: node tests/detektiven.test.js
   Extracts the /*LOGIC-START*​/ … /*LOGIC-END*​/ block from the game file,
   so the game stays a single self-contained HTML file. */
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "games", "detektiven.html"), "utf8");
const m = html.match(/\/\*LOGIC-START\*\/([\s\S]*?)\/\*LOGIC-END\*\//);
if (!m) { console.error("LOGIC block not found in detektiven.html"); process.exit(1); }

const L = new Function(m[1] + `
  return { COLS, ROWS, N, ALL, ROW, COL, NEI, ABOVE, BELOW, LEFT, RIGHT, EDGE, CORNERS, NAMES, JOBS,
    makeRand, pc, bitsOf, cellName, betweenMask, gen, makePeople, peopleCtx, regionMask, clueLogic,
    clueText, flavorText, FLAVOR_INNO, FLAVOR_CRIM, connected, dirCell, buildClue, makePool, localSolve, solverOf, solverIdentify, solverReveal, deductions,
    nextStep, exactForced, bruteForced, LEVELS, generatePuzzle, newGame, reveal, isKnown, isCriminal,
    provable, mark, findHint, validPuzzle, restoreGame, saveGame, cleanProgress, recordSolved,
    totalSolved };
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
const cell = (name) => "ABCD".indexOf(name[0]) + 4 * (Number(name.slice(1)) - 1);
const mask = (...names) => names.reduce((m, n) => m | (1 << cell(n)), 0);
const knownTiers = (pz) => { const c = {}; for (const t of pz.tiers) c[t] = (c[t] || 0) + 1; return c; };

// ---- 1. the grid ----
eq("4 columns × 5 rows", [L.COLS, L.ROWS, L.N], [4, 5, 20]);
eq("cell names", [0, 3, 4, 19].map(L.cellName), ["A1", "D1", "A2", "D5"]);
eq("corner A1 has 3 neighbours (diagonals count)", L.bitsOf(L.NEI[cell("A1")]).map(L.cellName), ["B1", "A2", "B2"]);
eq("edge B1 has 5 neighbours", L.pc(L.NEI[cell("B1")]), 5);
eq("inside B3 has 8 neighbours", L.pc(L.NEI[cell("B3")]), 8);
check("nobody is their own neighbour", L.NEI.every((m, i) => !((m >>> i) & 1)));
check("being neighbours goes both ways", L.NEI.every((m, i) => L.bitsOf(m).every((j) => (L.NEI[j] >>> i) & 1)));
eq("the edge is 14 people", L.pc(L.EDGE), 14);
eq("the corners", L.bitsOf(L.CORNERS).map(L.cellName), ["A1", "D1", "A5", "D5"]);
eq("above C4 is the same column", L.bitsOf(L.ABOVE[cell("C4")]).map(L.cellName), ["C1", "C2", "C3"]);
eq("below C4", L.bitsOf(L.BELOW[cell("C4")]).map(L.cellName), ["C5"]);
eq("left of C2 is the same row", L.bitsOf(L.LEFT[cell("C2")]).map(L.cellName), ["A2", "B2"]);
eq("right of A2", L.bitsOf(L.RIGHT[cell("A2")]).map(L.cellName), ["B2", "C2", "D2"]);
eq("between A3 and D3 (not the two themselves)", L.bitsOf(L.betweenMask(cell("A3"), cell("D3"))).map(L.cellName), ["B3", "C3"]);
eq("between B5 and B1, either order", L.betweenMask(cell("B5"), cell("B1")), mask("B2", "B3", "B4"));
eq("between people in different rows and columns is nobody", L.betweenMask(cell("A1"), cell("B2")), 0);

// ---- 2. names and jobs ----
{
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ";
  for (let s = 1; s <= 30; s++) {
    const p = L.makePeople(L.makeRand(s));
    const first = p.names.map((n) => n[0]);
    if (new Set(first).size !== 20 || first.some((f, i) => i && letters.indexOf(f) < letters.indexOf(first[i - 1]))) {
      check(`seed ${s}: 20 names with different first letters, in alphabetical order`, false); break;
    }
    const sizes = p.jobs.map((_, k) => p.jobOf.filter((x) => x === k).length);
    if (p.jobs.length < 6 || p.jobs.length > 8 || sizes.some((n) => n < 2 || n > 4)) {
      check(`seed ${s}: 6–8 jobs with 2–4 people each`, false); break;
    }
  }
  check("people: names and jobs look right for 30 seeds", true);
  check("every name list entry starts with its letter", Object.entries(L.NAMES).every(([k, v]) => v.every((n) => n[0] === k)));
  eq("genitive", ["Klara", "Nils", "Max", "Zakarias", "Åke"].map(L.gen), ["Klaras", "Nils", "Max", "Zakarias", "Åkes"]);
}

// ---- 3. clue texts in Swedish (fixed people) ----
const P = L.peopleCtx({
  names: ["Alma", "Bruno", "Cleo", "David", "Elsa", "Filip", "Greta", "Hugo", "Ida", "Jack",
    "Klara", "Leo", "Maja", "Nils", "Olle", "Petra", "Rut", "Saga", "Tove", "Ulf"],
  jobs: ["kock", "polis", "bonde", "pilot", "lakare", "brandman"],
  jobOf: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 0, 1]
});
const T = (sp) => L.clueText(sp, P);
const row = (r) => ({ k: "row", a: r - 1 }), col = (c) => ({ k: "col", a: "ABCD".indexOf(c) });
const nb = (n) => ({ k: "nb", a: cell(n) }), job = (k) => ({ k: "job", a: k });
eq("count in a row", T({ t: "cnt", R: row(3), s: 1, n: 2 }), "Det finns exakt 2 skurkar i rad 3.");
eq("count 1", T({ t: "cnt", R: col("B"), s: 0, n: 1 }), "Det finns exakt 1 oskyldig i kolumn B.");
eq("none", T({ t: "cnt", R: row(1), s: 1, n: 0 }), "Det finns inga skurkar i rad 1.");
eq("everybody", T({ t: "cnt", R: col("D"), s: 0, n: 5 }), "Alla i kolumn D är oskyldiga.");
eq("neighbours", T({ t: "cnt", R: nb("C3"), s: 1, n: 3 }), "Klara har exakt 3 skurkgrannar.");
eq("one innocent neighbour", T({ t: "cnt", R: nb("C3"), s: 0, n: 1 }), "Klara har exakt 1 oskyldig granne.");
eq("no criminal neighbours, name ending in s", T({ t: "cnt", R: nb("B4"), s: 1, n: 0 }), "Nils har inga skurkgrannar.");
eq("all neighbours", T({ t: "cnt", R: nb("A1"), s: 0, n: 3 }), "Alla Almas grannar är oskyldiga.");
eq("above", T({ t: "cnt", R: { k: "above", a: cell("C4") }, s: 1, n: 2 }), "Det finns exakt 2 skurkar ovanför Olle.");
eq("between", T({ t: "cnt", R: { k: "between", a: cell("A3"), b: cell("D3") }, s: 0, n: 0 }), "Det finns inga oskyldiga mellan Ida och Leo.");
eq("edge", T({ t: "cnt", R: { k: "edge" }, s: 1, n: 6 }), "Det finns exakt 6 skurkar på kanten.");
eq("a job", T({ t: "cnt", R: job(0), s: 1, n: 1 }), "Exakt 1 av de 4 kockarna är skurk.");
eq("a job, none", T({ t: "cnt", R: job(4), s: 1, n: 0 }), "Ingen av läkarna är skurk.");
eq("common neighbours", T({ t: "cnt", R: { k: "common", a: cell("A1"), b: cell("C1") }, s: 1, n: 1 }), "Alma och Cleo har exakt 1 gemensam skurkgranne.");
eq("odd", T({ t: "par", R: row(2), s: 1, odd: 1 }), "Det finns ett udda antal skurkar i rad 2.");
eq("even neighbours", T({ t: "par", R: nb("B2"), s: 0, odd: 0 }), "Filip har ett jämnt antal oskyldiga grannar.");
eq("more criminals than innocents", T({ t: "cmpS", R: col("A"), s: 1, eq: false }), "Det finns fler skurkar än oskyldiga i kolumn A.");
eq("half of the neighbours", T({ t: "cmpS", R: nb("B2"), s: 1, eq: true }), "Hälften av Filips grannar är skurkar.");
eq("two rows compared", T({ t: "cmpR", R: row(1), R2: row(5), s: 1, eq: false }), "Det finns fler skurkar i rad 1 än i rad 5.");
eq("two columns equal", T({ t: "cmpR", R: col("A"), R2: col("D"), s: 0, eq: true }), "Det finns lika många oskyldiga i kolumn A som i kolumn D.");
eq("two people's neighbours", T({ t: "cmpR", R: nb("B2"), R2: nb("C4"), s: 1, eq: false }), "Filip har fler skurkgrannar än Olle.");
eq("one of n in a row", T({ t: "member", p: cell("B3"), R: row(3), s: 1, n: 2 }), "Jack är en av 2 skurkar i rad 3.");
eq("the only one", T({ t: "member", p: cell("B3"), R: col("B"), s: 0, n: 1 }), "Jack är den enda oskyldiga i kolumn B.");
eq("one of somebody's neighbours", T({ t: "member", p: cell("B3"), R: nb("C3"), s: 1, n: 3 }), "Jack är en av Klaras 3 skurkgrannar.");
eq("the only innocent of a job", T({ t: "member", p: cell("A1"), R: job(0), s: 0, n: 1 }), "Alma är den enda oskyldiga kocken.");
eq("connected", T({ t: "conn", R: col("C"), s: 1 }), "Alla skurkar i kolumn C hänger ihop.");
eq("all in … are neighbours of", T({ t: "allIn", R: row(3), s: 1, R2: nb("B4") }), "Alla skurkar i rad 3 är grannar till Nils.");
eq("all of somebody's criminal neighbours are …", T({ t: "allIn", R: nb("B2"), s: 1, R2: job(2) }), "Alla Filips skurkgrannar är bönder.");
eq("both", T({ t: "subcnt", R: row(2), s: 1, k: 2, R2: nb("A4"), n: 2 }), "Båda skurkarna i rad 2 är grannar till Maja.");
eq("both innocents", T({ t: "subcnt", R: col("B"), s: 0, k: 2, R2: job(3), n: 2 }), "Båda de oskyldiga i kolumn B är piloter.");
eq("exactly n of them", T({ t: "subcnt", R: row(4), s: 1, k: 3, R2: job(4), n: 1 }), "Det finns exakt 3 skurkar i rad 4, och exakt 1 av dem är läkare.");
eq("none of them", T({ t: "subcnt", R: nb("C2"), s: 0, k: 2, R2: nb("A1"), n: 0 }), "Greta har exakt 2 oskyldiga grannar, men ingen av dem är granne till Alma.");
eq("the most", T({ t: "most", lines: "col", s: 1, idx: 2 }), "Kolumn C har flest skurkar.");
eq("the only row", T({ t: "only", lines: "row", s: 0, n: 2, idx: 3 }), "Rad 4 är den enda raden med exakt 2 oskyldiga.");
eq("the only column without", T({ t: "only", lines: "col", s: 1, n: 0, idx: 0 }), "Kolumn A är den enda kolumnen utan skurkar.");
eq("each row", T({ t: "each", lines: "row", s: 1, n: 1 }), "Varje rad har minst 1 skurk.");
eq("total", T({ t: "total", s: 1, n: 9 }), "Det finns totalt 9 skurkar.");
// more clue types: at least, both/connected, the only one, combinations, directions
const and = (A, B) => ({ k: "and", A, B }), dir = (k, n) => ({ k, a: cell(n) });
eq("at least, in a row", T({ t: "min", R: row(1), s: 1, n: 1 }), "Det finns minst 1 skurk i rad 1.");
eq("at least, neighbours", T({ t: "min", R: nb("B4"), s: 0, n: 3 }), "Nils har minst 3 oskyldiga grannar.");
eq("both connected, column", T({ t: "both", R: col("B"), s: 1 }), "Båda skurkarna i kolumn B hänger ihop.");
eq("both connected, below someone", T({ t: "both", R: dir("below", "A1"), s: 0 }), "Båda de oskyldiga nedanför Alma hänger ihop.");
eq("both connected, a job", T({ t: "both", R: job(1), s: 1 }), "Båda poliserna som är skurkar hänger ihop.");
eq("all connected, the edge", T({ t: "conn", R: { k: "edge" }, s: 1 }), "Alla skurkar på kanten hänger ihop.");
eq("the only one … is on the edge", T({ t: "subcnt", R: dir("right", "B2"), s: 1, k: 1, R2: { k: "edge" }, n: 1 }), "Den enda skurken till höger om Filip finns på kanten.");
eq("someone's only … is not in a row", T({ t: "subcnt", R: nb("B2"), s: 0, k: 1, R2: row(1), n: 0 }), "Filips enda oskyldiga granne finns inte i rad 1.");
eq("neighbours in a row", T({ t: "cnt", R: and(nb("C3"), row(3)), s: 0, n: 1 }), "Klara har exakt 1 oskyldig granne i rad 3.");
eq("neighbours with a job", T({ t: "cnt", R: and(nb("C3"), job(0)), s: 1, n: 2 }), "Klara har exakt 2 skurkgrannar som är kockar.");
eq("neighbours on the edge, odd", T({ t: "par", R: and(nb("B2"), { k: "edge" }), s: 1, odd: 1 }), "Filip har ett udda antal skurkgrannar på kanten.");
eq("a job to the right of someone", T({ t: "cnt", R: and(dir("right", "B5"), job(0)), s: 1, n: 0 }), "Det finns inga kockar som är skurkar till höger om Saga.");
eq("corners of a row", T({ t: "cnt", R: and({ k: "corners" }, row(5)), s: 1, n: 1 }), "Exakt en av de två i hörnen i rad 5 är skurk.");
eq("common neighbours, odd", T({ t: "par", R: { k: "common", a: cell("B2"), b: cell("B4") }, s: 1, odd: 1 }), "Filip och Nils har ett udda antal gemensamma skurkgrannar.");
eq("two jobs compared", T({ t: "cmpR", R: job(0), R2: job(4), s: 0, eq: false }), "Fler kockar än läkare är oskyldiga.");
eq("a row and a column compared", T({ t: "cmpR", R: row(2), R2: col("C"), s: 1, eq: true }), "Det finns lika många skurkar i rad 2 som i kolumn C.");
eq("one of n below someone", T({ t: "member", p: cell("A4"), R: dir("below", "A1"), s: 1, n: 2 }), "Maja är en av 2 skurkar nedanför Alma.");
eq("the job with the most", T({ t: "mostR", R: job(4), s: 1 }), "Läkarna har flest skurkar av alla yrken.");
eq("the most neighbours of all", T({ t: "mostR", R: nb("C3"), s: 0 }), "Klara har flest oskyldiga grannar av alla.");
eq("the only one with n neighbours", T({ t: "onlyNb", p: cell("D5"), s: 1, n: 1 }), "Ulf är den enda som har exakt 1 skurkgranne.");
eq("only one row has n", T({ t: "oneHas", fam: "row", s: 1, n: 1 }), "Bara en rad har exakt 1 skurk.");
eq("only one person has n neighbours", T({ t: "oneHas", fam: "nb", s: 0, n: 7 }), "Bara en person har exakt 7 oskyldiga grannar.");
eq("directly to the right", T({ t: "dirnb", R: row(3), s1: 0, d: "r", s2: 1, n: 1 }), "Bara en oskyldig i rad 3 har en skurk direkt till höger om sig.");
eq("directly to the left, anyone", T({ t: "dirnb", R: row(5), s1: null, d: "l", s2: 1, n: 3 }), "Exakt 3 personer i rad 5 har en skurk direkt till vänster om sig.");
eq("directly above, a job", T({ t: "dirnb", R: job(1), s1: null, d: "u", s2: 0, n: 1 }), "Bara en polis har en oskyldig direkt ovanför sig.");
eq("nobody … directly below", T({ t: "dirnb", R: col("A"), s1: 1, d: "d", s2: 1, n: 0 }), "Ingen skurk i kolumn A har en skurk direkt nedanför sig.");
eq("only one in the corners", T({ t: "onlyOneNb", R: { k: "corners" }, s: 0, n: 1 }), "Bara en person i hörnen har exakt 1 oskyldig granne.");
eq("only one of a job", T({ t: "onlyOneNb", R: job(0), s: 1, n: 2 }), "Bara en av kockarna har exakt 2 skurkgrannar.");
{
  const P2 = L.peopleCtx({ names: P.names, jobs: ["kock"], jobOf: new Array(20).fill(0), seed: 5 });
  check("people without a clue say something friendly, criminals something else",
    L.FLAVOR_INNO.includes(L.flavorText(P2, 3, 0)) && L.FLAVOR_CRIM.includes(L.flavorText(P2, 3, 1)));
}

// ---- 4. what clues mean ----
{
  const t = (sp, m) => L.buildClue(sp, P).test(m);
  check("exact count", t({ t: "cnt", R: row(3), s: 1, n: 2 }, mask("A3", "C3")) && !t({ t: "cnt", R: row(3), s: 1, n: 2 }, mask("A3")));
  check("innocents are counted too", t({ t: "cnt", R: row(3), s: 0, n: 2 }, mask("A3", "C3")));
  check("connected: in a row without gaps", t({ t: "conn", R: col("C"), s: 1 }, mask("C2", "C3", "C4")));
  check("connected: a gap breaks it", !t({ t: "conn", R: col("C"), s: 1 }, mask("C2", "C4")));
  check("connected: 'alla' needs at least one", !t({ t: "conn", R: col("C"), s: 1 }, 0));
  check("'alla … är grannar till' needs at least one", !t({ t: "allIn", R: row(3), s: 1, R2: nb("B4") }, 0));
  check("'alla … är grannar till'", t({ t: "allIn", R: row(3), s: 1, R2: nb("B4") }, mask("A3", "C3")) && !t({ t: "allIn", R: row(3), s: 1, R2: nb("B4") }, mask("D3")));
  check("the most is uniquely the most", t({ t: "most", lines: "col", s: 1, idx: 2 }, mask("C1", "C2")) && !t({ t: "most", lines: "col", s: 1, idx: 2 }, mask("C1", "A1")));
  check("even includes zero", t({ t: "par", R: row(2), s: 1, odd: 0 }, 0));
  check("member: the person is one of them", t({ t: "member", p: cell("B3"), R: row(3), s: 1, n: 2 }, mask("B3", "D3")) && !t({ t: "member", p: cell("B3"), R: row(3), s: 1, n: 2 }, mask("A3", "D3")));
  check("both: exactly two, side by side", t({ t: "both", R: col("B"), s: 1 }, mask("B2", "B3")) && !t({ t: "both", R: col("B"), s: 1 }, mask("B1", "B3")) && !t({ t: "both", R: col("B"), s: 1 }, mask("B1", "B2", "B3")));
  check("connected along the edge, round the corner", t({ t: "conn", R: { k: "edge" }, s: 1 }, mask("B1", "A1", "A2")) && !t({ t: "conn", R: { k: "edge" }, s: 1 }, mask("A1", "C1")));
  check("diagonal is not connected", !L.connected(mask("B2", "C3")) && L.connected(mask("B2", "C2", "C3")));
  check("at least", t({ t: "min", R: row(1), s: 1, n: 2 }, mask("A1", "B1", "C1")) && !t({ t: "min", R: row(1), s: 1, n: 2 }, mask("A1")));
  eq("directly to the left: B5, C5, D5 have someone there", L.dirCell(cell("B5"), "l"), cell("A5"));
  check("directly to the left counts the person next to them", t({ t: "dirnb", R: row(5), s1: null, d: "l", s2: 1, n: 2 }, mask("A5", "B5")));
  check("the only one with n neighbours", t({ t: "onlyNb", p: cell("A1"), s: 1, n: 3 }, mask("B1", "A2", "B2")) && !t({ t: "onlyNb", p: cell("A1"), s: 1, n: 3 }, 0));
  check("only one person in the corners", t({ t: "onlyOneNb", R: { k: "corners" }, s: 1, n: 1 }, mask("B1")) && !t({ t: "onlyOneNb", R: { k: "corners" }, s: 1, n: 1 }, mask("B1", "D4")));
}

// ---- 5. every true clue for random answers: really true, reads only its area, sensible text ----
{
  let bad = 0, total = 0;
  for (let k = 0; k < 25; k++) {
    const rand = L.makeRand(100 + k);
    const PP = L.peopleCtx(L.makePeople(rand));
    let truth = 0; for (let i = 0; i < 20; i++) if (rand() < 0.45) truth |= 1 << i;
    for (const e of L.makePool(truth, PP)) {
      total++;
      const c = L.buildClue(e.sp, PP), txt = L.clueText(e.sp, PP);
      if (!c.test(truth)) { bad++; console.error("false clue", JSON.stringify(e.sp)); }
      if (!/^[A-ZÅÄÖ][^?]*\.$/.test(txt) || /undefined|NaN|  /.test(txt)) { bad++; console.error("odd text", txt); }
      const outside = ~c.scope & L.ALL;
      for (let r = 0; r < 6 && outside; r++) {
        const m = Math.floor(rand() * (1 << 20)), flip = m ^ (Math.floor(rand() * (1 << 20)) & outside);
        if (c.test(m) !== c.test(flip)) { bad++; console.error("reads outside its area", JSON.stringify(e.sp)); break; }
      }
    }
  }
  check(`${total} pool clues are true, read only their area and read well`, bad === 0);
}

// ---- 6. generated cases for every level ----
const SEEDS = [11, 22, 33, 44];
let clueless = 0;
for (let level = 0; level < L.LEVELS.length; level++) {
  const lv = L.LEVELS[level];
  const t0 = Date.now();
  const cases = SEEDS.map((s) => L.generatePuzzle(level, s));
  const ms = (Date.now() - t0) / SEEDS.length;
  check(`${lv.name}: a case is made for every seed`, cases.every(Boolean));
  check(`${lv.name}: made fast enough (${Math.round(ms)} ms each)`, ms < 4000);
  eq(`${lv.name}: the same seed gives the same case`, L.generatePuzzle(level, SEEDS[0]), cases[0]);
  for (const pz of cases) {
    if (!pz) continue;
    const tag = `${lv.name} #${pz.seed}`;
    const PP = L.peopleCtx(pz);
    const clues = pz.clues.map((sp) => sp && L.buildClue(sp, PP));
    const real = pz.clues.filter(Boolean), crim = L.pc(pz.truth);
    check(`${tag}: passes validPuzzle`, L.validPuzzle(pz));
    check(`${tag}: ${crim} criminals within ${lv.crim}`, crim >= lv.crim[0] && crim <= lv.crim[1]);
    check(`${tag}: ${real.length} people have a clue, within ${lv.clues} (the rest only say something)`, real.length >= lv.clues[0] && real.length <= lv.clues[1]);
    check(`${tag}: the starting person has a clue`, !!clues[pz.start]);
    clueless += 20 - real.length;
    check(`${tag}: all clues are true`, clues.every((c) => !c || c.test(pz.truth)));
    check(`${tag}: no clue is used twice`, new Set(real.map((sp) => JSON.stringify(sp))).size === real.length);
    // all clues together, with the starting person known, leave exactly one answer
    const all = L.solverOf(PP);
    L.solverIdentify(all, pz.start, (pz.truth >>> pz.start) & 1);
    clues.forEach((c, p) => c && L.solverReveal(all, p, c));
    const f = L.exactForced(all.states) || L.bruteForced(all.states, all.known, all.vals);
    eq(`${tag}: all clues together decide everybody`, [f.crim | (pz.truth & (1 << pz.start)), f.inno | (~pz.truth & (1 << pz.start))], [pz.truth, ~pz.truth & L.ALL]);

    // re-grade: always take the easiest step, as in the game's hint
    const S = L.solverOf(PP);
    L.solverIdentify(S, pz.start, (pz.truth >>> pz.start) & 1); L.solverReveal(S, pz.start, clues[pz.start]);
    const tiers = [], opts = [];
    while (S.known !== L.ALL) {
      const st = L.nextStep(S, 4);
      if (!st) break;
      tiers.push(st.tier);
      if (L.pc(~S.known & L.ALL) > 3) opts.push(L.pc(st.cells));
      const p = L.bitsOf(st.cells)[0];
      L.solverIdentify(S, p, (pz.truth >>> p) & 1); if (clues[p]) L.solverReveal(S, p, clues[p]);
    }
    check(`${tag}: solvable step by step without guessing`, S.known === L.ALL);
    check(`${tag}: never needs more than level ${lv.maxTier}`, Math.max(...tiers) <= lv.maxTier);
    const c = knownTiers(pz);
    for (const t of Object.keys(lv.quota)) {
      const n = c[t] || 0;
      check(`${tag}: needs ${t} clues together ${n} times, within ${lv.quota[t]}`, n >= lv.quota[t][0] && n <= lv.quota[t][1]);
    }
    const avg = opts.reduce((a, b) => a + b, 0) / opts.length;
    if (level === 0) check(`${tag}: usually several people to choose between (on average ${avg.toFixed(1)})`, avg >= 2.5);
    check(`${tag}: only the level's clue types`, real.every((sp) => lv.types[sp.t]));
  }
}
check("Lätt never needs two clues at once", L.LEVELS[0].maxTier === 1);
check(`some people have no clue, they only say something (${clueless} in ${SEEDS.length * L.LEVELS.length} cases)`, clueless > 0);
eq("most clues needed at once, per level", L.LEVELS.map((l) => l.maxTier), [1, 2, 2, 4, 4]);

// any order works: a player who takes any provable person, in random order, always finishes
for (let level = 0; level < L.LEVELS.length; level++) {
  const pz = L.generatePuzzle(level, 77);
  for (let run = 0; run < 4; run++) {
    const rand = L.makeRand(run * 13 + level);
    const G = L.newGame(pz);
    let steps = 0;
    while (!G.done && steps < 30) {
      const f = L.provable(G), cells = L.bitsOf(f.crim | f.inno);
      if (!cells.length) break;
      const p = cells[Math.floor(rand() * cells.length)];
      if (L.mark(G, p, (f.crim >>> p) & 1) !== "ok") break;
      steps++;
    }
    check(`${L.LEVELS[level].name}: random order ${run} finishes without guessing`, G.done && G.mistakes === 0 && steps === 19);
  }
}

// ---- 7. playing: right, wrong, guess, hints ----
{
  const pz = L.generatePuzzle(2, 5);
  const G = L.newGame(pz);
  check("the starting person is known, with a clue", L.isKnown(G, pz.start) && G.S.states.length === 1);
  eq("starting person's mark is ignored", L.mark(G, pz.start, 1), "known");
  const f = L.provable(G), sure = L.bitsOf(f.crim | f.inno)[0], truth = (pz.truth >>> sure) & 1;
  const guess = L.bitsOf(L.ALL & ~G.S.known & ~(f.crim | f.inno))[0];
  eq("a guess is not allowed", L.mark(G, guess, 1), "unproven");
  eq("the opposite of what the clues prove is wrong", L.mark(G, sure, 1 - truth), "wrong");
  eq("both count as mistakes", [G.mistakes, G.missOn[guess], G.missOn[sure]], [2, 1, 1]);
  eq("the right answer is accepted", L.mark(G, sure, truth), "ok");
  check("…and reveals that person's clue", L.isKnown(G, sure) && G.S.states.length === 2);

  // hints, all the way through a hard case
  const H = L.newGame(L.generatePuzzle(4, 3));
  let ok = true, tiers = new Set();
  while (!H.done) {
    const h = L.findHint(H), pr = L.provable(H);
    if (!h || !h.cells.length) { ok = false; break; }
    tiers.add(h.tier);
    if (!h.owners.every((o) => L.isKnown(H, o))) ok = false;
    if (!h.cells.every((p) => ((pr.crim | pr.inno) >>> p) & 1)) ok = false;
    for (const p of h.cells) if (!L.isKnown(H, p)) L.mark(H, p, (H.pz.truth >>> p) & 1);
  }
  check("every hint points at revealed clues and at people that can be proven", ok && H.mistakes === 0);
  check("a hard case needs hints that combine several clues", [...tiers].some((t) => t >= 3));
  check("no hint when the case is solved", L.findHint(H) === null);
}

// ---- 8. saving and loading ----
{
  const pz = L.generatePuzzle(1, 9);
  const G = L.newGame(pz);
  for (let i = 0; i < 5; i++) { const f = L.provable(G), p = L.bitsOf(f.crim | f.inno)[0]; L.mark(G, p, (f.crim >>> p) & 1); }
  L.mark(G, L.bitsOf(L.ALL & ~G.S.known)[0], 1); // maybe a mistake, maybe not
  const saved = JSON.parse(JSON.stringify(L.saveGame(G)));
  const R = L.restoreGame(saved);
  check("a saved case comes back", R && R.S.known === G.S.known && R.mistakes === G.mistakes && JSON.stringify(R.missOn) === JSON.stringify(G.missOn));
  eq("…with the same order", R.order, G.order);
  check("nothing saved → no case", L.restoreGame(undefined) === null && L.restoreGame({}) === null);
  check("garbage → no case", L.restoreGame({ pz: { v: 1, names: "x" } }) === null);
  const lie = JSON.parse(JSON.stringify(saved)); lie.pz.truth ^= 1 << 7;
  check("a changed answer makes a clue false → rejected", L.restoreGame(lie) === null);
  const skip = JSON.parse(JSON.stringify(saved)); skip.order = [pz.start, L.bitsOf(L.ALL & ~(1 << pz.start)).find((p) => !((L.provable(L.newGame(pz)).crim | L.provable(L.newGame(pz)).inno) >>> p & 1))];
  check("an order that skips the logic is rejected", L.restoreGame(skip) === null);
  const neg = JSON.parse(JSON.stringify(saved)); neg.mistakes = -4; neg.hints = "abc";
  eq("bad counters are cleaned", [L.restoreGame(neg).mistakes, L.restoreGame(neg).hints], [0, 0]);
}

// ---- 9. levels unlock one at a time ----
{
  eq("fresh start: only Lätt", L.cleanProgress(undefined), { unlocked: 0, solved: [0, 0, 0, 0, 0] });
  eq("garbage is cleaned (solving Mellan unlocked Svår)", L.cleanProgress({ unlocked: "x", solved: [-1, "3", null] }), { unlocked: 2, solved: [0, 3, 0, 0, 0] });
  eq("can't be above the last level", L.cleanProgress({ unlocked: 99 }).unlocked, 4);
  const prog = L.cleanProgress({});
  eq("solving Lätt unlocks Mellan", L.recordSolved(prog, 0), 1);
  eq("solving Lätt again unlocks nothing new", L.recordSolved(prog, 0), -1);
  eq("solving Mellan unlocks Svår", L.recordSolved(prog, 1), 2);
  eq("solved count per level", prog.solved, [2, 1, 0, 0, 0]);
  L.recordSolved(prog, 2); L.recordSolved(prog, 3);
  eq("solving Omöjliga unlocks nothing more", L.recordSolved(prog, 4), -1);
  eq("all unlocked", prog.unlocked, 4);
  eq("total solved (the hub trophy)", L.totalSolved(prog), 6);
  eq("level names", L.LEVELS.map((l) => l.name), ["Lätt", "Mellan", "Svår", "Geni", "Omöjliga"]);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
