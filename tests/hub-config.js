/* Reads the hub's real configuration (config.js and sw.js) for the tests,
   so they never drift from what the site actually ships. No dependencies. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

// The GAMES registry from config.js.
function loadGames() {
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "config.js"), "utf8") + ";this.GAMES = GAMES;", ctx);
  return ctx.GAMES;
}
// ASSETS and CACHE_VERSION from sw.js.
function loadServiceWorkerConfig() {
  const ctx = { self: { addEventListener() {} } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8") +
    ";this.ASSETS = ASSETS; this.CACHE_VERSION = CACHE_VERSION;", ctx);
  return { ASSETS: ctx.ASSETS, CACHE_VERSION: ctx.CACHE_VERSION };
}

module.exports = { ROOT, loadGames, loadServiceWorkerConfig };
