#!/usr/bin/env node
/* Consistency checks across config.js, sw.js and the game files.
   Run with: node tests/integrity.test.js
   Catches the easy-to-forget steps of "add a game" from the README. */
"use strict";
const fs = require("fs");
const path = require("path");
const { loadGames, loadServiceWorkerConfig, ROOT } = require("./hub-config");

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; return; }
  failed++;
  console.error("FAIL: " + name + (detail ? "\n  " + detail : ""));
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const GAMES = loadGames();
const { ASSETS, CACHE_VERSION } = loadServiceWorkerConfig();

check("CACHE_VERSION looks like game-hub-vN", /^game-hub-v\d+$/.test(CACHE_VERSION), CACHE_VERSION);
check("GAMES is a non-empty array", Array.isArray(GAMES) && GAMES.length > 0);

// ---- every precached asset exists on disk ----
for (const a of ASSETS) {
  if (a === "./") continue;
  check(`sw.js asset exists: ${a}`, exists(a));
}
check("ASSETS has no duplicates", new Set(ASSETS).size === ASSETS.length);

// ---- every file in games/ is registered ----
const gameFiles = fs.readdirSync(path.join(ROOT, "games")).filter((f) => f.endsWith(".html"));
for (const f of gameFiles) {
  check(`games/${f} is in config.js`, GAMES.some((g) => g.file === "games/" + f));
}

// ---- each registered game follows the hub contract ----
const ids = new Set();
for (const g of GAMES) {
  const tag = `[${g.id}]`;
  check(`${tag} unique id`, !ids.has(g.id)); ids.add(g.id);
  for (const k of ["id", "title", "emoji", "blurb", "file", "scoreKey"]) {
    check(`${tag} has ${k}`, typeof g[k] === "string" && g[k].length > 0);
  }
  check(`${tag} scoreKey is score.<id>`, g.scoreKey === "score." + g.id, g.scoreKey);
  check(`${tag} file exists`, exists(g.file));
  check(`${tag} file is precached in sw.js`, ASSETS.includes("./" + g.file));
  if (!exists(g.file)) continue;

  const html = read(g.file);
  check(`${tag} has a viewport meta with viewport-fit=cover`, /<meta name="viewport"[^>]*viewport-fit=cover/.test(html));
  check(`${tag} back link to ../index.html`, /<a class="back" href="\.\.\/index\.html">/.test(html));
  check(`${tag} registers ../sw.js`, /serviceWorker\.register\(["']\.\.\/sw\.js["']\)/.test(html));
  const guard = html.match(/<script src="\.\.\/shared\/guard\.js" data-game="([^"]+)"><\/script>\s*<\/body>/);
  check(`${tag} guard.js is the last script, with data-game="${g.id}"`, guard && guard[1] === g.id, guard ? guard[1] : "missing");
  // either SCORE_KEY = "score.<id>" or SCORE_KEY = 'score.' + GAME_ID with GAME_ID = '<id>'
  const literalKey = new RegExp(`SCORE_KEY\\s*=\\s*["']${g.scoreKey.replace(".", "\\.")}["']`).test(html);
  const builtKey = /SCORE_KEY\s*=\s*["']score\.["']\s*\+\s*GAME_ID/.test(html) &&
    new RegExp(`GAME_ID\\s*=\\s*["']${g.id}["']`).test(html);
  check(`${tag} SCORE_KEY is "${g.scoreKey}"`, literalKey || builtKey);

  // fully offline: no external scripts, styles, fonts or images
  const external = (html.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/g) || [])
    .concat(html.match(/url\(\s*["']?https?:\/\/[^)]+\)/g) || [])
    .concat(html.match(/@import\s+["']?https?:/g) || [])
    .concat(html.match(/fetch\(\s*["']https?:/g) || []);
  check(`${tag} loads nothing from the network`, external.length === 0, external.join(", "));
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
