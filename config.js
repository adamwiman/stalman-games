// ============================================================
// GAME REGISTRY
// To add a game: drop the file in games/, add an entry here,
// then add the file path to ASSETS in sw.js and bump CACHE_VERSION.
// ============================================================
const GAMES = [
  {
    id: "2048",                    // unique id, used for time limits + scores
    title: "2048",
    emoji: "🔢",
    blurb: "Slide tiles. Make 2048!",
    file: "games/2048.html",
    scoreKey: "score.2048"         // localStorage key the game writes its best score to
  },
  {
    id: "goopipes",
    title: "Goo Pipes",
    emoji: "🧪",
    blurb: "Build the pipe before the goo escapes!",
    file: "games/goopipes.html",
    scoreKey: "score.goopipes"
  },
  {
    id: "numlings",
    title: "Numlingarnas resa",
    emoji: "🧮",
    blurb: "Mattegåtor. Led numlingarna hem!",
    file: "games/numlings.html",
    scoreKey: "score.numlings"     // Numlings living in Numeria (grows each journey)
  },
  {
    id: "gangertabell",
    title: "Gångertabellen",
    emoji: "✖️",
    blurb: "Träna tabellerna 1–10!",
    file: "games/gangertabell.html",
    scoreKey: "score.gangertabell" // record: most correct answers in a row
  },
  {
    id: "detektiven",
    title: "Detektiven",
    emoji: "🕵️",
    blurb: "Vem är skurk? Lös fallet med ledtrådar!",
    file: "games/detektiven.html",
    scoreKey: "score.detektiven"   // solved cases, all levels together
  }
];
