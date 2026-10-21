# stalman-games

An ad-free, offline-capable game collection for kids' iPads. One web app,
installed via "Add to Home Screen", with on-device high scores and
PIN-protected daily time limits per game.

- **Play:** <https://adamwiman.github.io/stalman-games/>
- **Repository:** <https://github.com/adamwiman/stalman-games>

## The games

| Game | Language | What it is |
| ---- | -------- | ---------- |
| 🔢 [2048](#2048-notes) | English | slide and merge tiles to reach 2048 |
| 🧪 [Slemrören](#slemrören-notes) | Swedish | lay pipes before the goo starts flowing, three difficulties |
| 🧮 [Numlingarnas resa](#numlingarnas-resa-notes) | Swedish | logic and number puzzles on a journey to Numeria |
| ✖️ [Gångertabellen](#gångertabellen-notes) | Swedish | times tables 1–10 practice |
| 🕵️ [Detektiven](#detektiven-notes) | Swedish | who is the criminal? Logic puzzles with clues |

Every game works offline, saves its best score for the hub card and obeys
the daily time limits. Notes on each game are at the end of this file.

## Publish on GitHub Pages

The site is published from this repository with GitHub Pages:
**Settings → Pages → Source: Deploy from a branch**, `main` / `(root)`.
Every push to `main` is live at
<https://adamwiman.github.io/stalman-games/> a minute later.

All paths in the project are relative, so it works at any URL, including
project subpaths (and a fork works the same way at
`https://<username>.github.io/stalman-games/`).

## Install on the kids' iPads

1. Open <https://adamwiman.github.io/stalman-games/> in **Safari** (must be
   Safari for home-screen install).
2. Tap the share button → **Add to Home Screen**.
3. Open it once from the home screen icon **while online** — this installs
   the offline cache. After that it works with no internet.

Each installed copy has its own storage: scores, PIN, and time limits are
per device.

## Parental controls

- Tap the ⚙️ gear → first time you'll create a PIN.
- Set **minutes per day** per game (empty = no limit). Counters reset at
  midnight. You can also reset today's playtime or clear high scores.
- Note: this is friendly, on-device enforcement — a determined teenager
  could clear website data to reset it. For hard limits, additionally use
  iOS **Screen Time** on the Safari/home-screen app.

## Add a new game (the AI workflow)

Three steps:

1. Ask an AI to generate the game as a **single HTML file** (prompt
   template below) and save it as `games/<id>.html`.
2. Add an entry to `GAMES` in **config.js**.
3. Add `"./games/<id>.html"` to `ASSETS` in **sw.js** and bump
   `CACHE_VERSION` (e.g. `game-hub-v5` → `game-hub-v6`; the cache name
   keeps the `game-hub-` prefix). Commit and push.

Devices pick up new files the next time the app is opened with internet.

### Prompt template for generating a game

> Create a single self-contained HTML file game for my kids' game hub.
> Hard requirements:
> - All CSS and JS inline in the one file; no external network resources
>   (no CDNs, no web fonts) — it must work fully offline.
> - Touch-first controls sized for an iPad; also support keyboard.
> - Visual style: background #ddf1ff, ink #17335b, accents #ffc63f,
>   #ff6b6b, #38d9a9; rounded corners; font-family
>   `ui-rounded,"SF Pro Rounded",system-ui,sans-serif`.
> - At the top of `<body>`, a back link:
>   `<a class="back" href="../index.html">← Games</a>`
> - Save the best score to localStorage under the key `score.GAME_ID`
>   (a single number where higher is better) and show score + best.
> - As the LAST line before `</body>`, include exactly:
>   `<script src="../shared/guard.js" data-game="GAME_ID"></script>`
> - Register the service worker with
>   `navigator.serviceWorker.register("../sw.js")`.
>
> Replace GAME_ID with: `mathtrainer`
> The game: addition and subtraction practice for a 7-year-old, with
> three difficulty levels, 10 questions per round, score based on speed
> and correct answers.

### Updating an existing game

Edit or regenerate the game file, bump `CACHE_VERSION` in `sw.js`, push.

## File map

```
index.html            hub page (game grid + parent settings)
styles.css            hub styles
app.js                hub logic (cards, PIN, limits display)
config.js             ⟵ the game list — edit this to add/remove games
sw.js                 offline cache — keep ASSETS + CACHE_VERSION updated
manifest.webmanifest  PWA install metadata
shared/guard.js       playtime tracking + "time's up" lock (used by all games)
games/2048.html       the 2048 game (fully self-contained)
games/goopipes.html   Slemrören (formerly Goo Pipes) — pipe-laying game, in Swedish (fully self-contained)
games/numlings.html   Numlingarnas resa — logic & number puzzles, in Swedish (fully self-contained)
games/gangertabell.html  Gångertabellen — times tables 1–10 practice, in Swedish (fully self-contained)
games/detektiven.html    Detektiven — who is the criminal? Logic puzzles in Swedish (fully self-contained)
tests/                logic, consistency and browser tests (see "Tests")
package.json          test tooling only — the site itself has no build step
playwright.config.js  browser test setup (desktop Chrome/Safari, iPad)
icons/                app icons
```

## Tests

The site needs no build or install; the tests do. One-time setup:

```sh
npm install
npx playwright install chromium webkit
```

Then `npm test` runs everything:

- `npm run test:unit` — plain Node, no browser:
  `tests/goopipes.test.js` (Slemrören game logic, difficulties and piece bag),
  `tests/gangertabell.test.js` (Gångertabellen question order and
  counting), `tests/detektiven.test.js` (Detektiven clue texts, case
  generator, solver, difficulty and unlocking) and `tests/integrity.test.js` (every game is in `config.js` and precached in
  `sw.js`, has the back link, `guard.js`, service worker and score key, and
  loads nothing from the network).
- `npm run test:e2e` — Playwright, `tests/e2e/`: the hub, parent settings,
  time limits and lock, offline via the service worker, and real play in
  every game. Runs on desktop Chrome, desktop Safari (WebKit) and iPad
  (WebKit with touch) in portrait, landscape and iPad mini landscape. Any
  page error or request outside the site fails the test.

Run a single device with e.g. `npx playwright test --project=ipad-portrait`.
These are emulated browsers; still try a new game on a real iPad before
handing it over.

## Storage keys (all localStorage, on device)

| Key          | Meaning                                        |
| ------------ | ---------------------------------------------- |
| `hub.pin`    | hashed parent PIN                              |
| `hub.limits` | `{gameId: minutesPerDay}`                      |
| `hub.usage`  | `{date, byGame:{gameId: secondsPlayedToday}}`  |
| `score.<id>` | each game's best score                         |
| `state.<id>` | optional saved game-in-progress (2048 and Numlingarnas resa use it; Gångertabellen keeps the last chosen tables there and Slemrören the last difficulty; Detektiven keeps unlocked levels and the case in progress) |

## 2048 notes

The classic sliding-tile game, in English. Swipe on the iPad (or use the
arrow keys) to slide all tiles; two equal tiles merge into their sum. Reach
the 2048 tile to win, and keep going for a higher score if you like.

- **Score:** the hub trophy is the best score.
- **Saved:** `state.2048` holds the board, score and whether 2048 has been
  reached, so leaving and coming back continues the same game. It is cleared
  when the game is over. **New game** starts over.

## Slemrören notes

A pipe-laying game in Swedish (it was called Goo Pipes; the id, file
name and `score.goopipes` are unchanged, so old records still count). Slime
starts flowing from the pump after a countdown. Tap squares to lay the next
pipe from the queue of five (**NÄSTA**), and build a pipe at least as long as
the level's goal (**RÖR**) before the slime reaches an open end.

Pick a difficulty when the game starts (and with **Nytt spel**; the round in
progress waits behind the picker and **Fortsätt** goes back to it):

| Difficulty | Level 1: pipe goal / time per pipe / countdown | Gets harder per level until |
| ---------- | ---------------------------------------------- | --------------------------- |
| Lätt       | 5 / 4.4 s / 20 s                               | 16 pipes, 1.6 s, 10 s       |
| Mellan     | 6 / 3.4 s / 16 s                               | 20 pipes, 1.1 s, 6 s        |
| Svår       | 8 / 2.6 s / 12 s (the original game)           | 24 pipes, 0.7 s, 4 s        |

- Pieces: straight, four corners and a cross (the slime can pass a cross
  twice, once in each direction, for extra points). The queue draws from a
  shuffled bag holding each of the seven pieces once, so every piece turns
  up at least once in every 13, and the same piece never comes three times
  in a row (plain random picks did that about once every 50 pieces).
- Tapping a pipe the slime has not reached yet replaces it (costs 50 points).
- **⏩ Snabbt** makes the slime flow fast for the rest of the round, for
  bonus points per pipe. A pipe longer than the goal gives a distance bonus.
- The cursor and the faint preview of the next piece only show with a mouse
  or the keyboard, and the preview only on an empty square (over a pipe that
  would be replaced the cursor turns orange). With a finger nothing is drawn
  over the board, so the next piece is never shown on top of one just laid.
- **Score:** the hub trophy is the best score, on any difficulty.
- **Saved:** `state.goopipes` remembers the last difficulty, which the picker
  suggests next time.

## Numlingarnas resa notes

A logic and number puzzle journey in Swedish for strong young math thinkers
(around age 7–10). Kids build a troupe of up to 10 numlingar and lead them
to Numeria. Each journey visits 6 of the 10 puzzle stops, least-played
first, so journeys vary:

| Stop | Practices |
| ---- | --------- |
| Viskportarna | finding a hidden rule from examples (parity, divisibility, primes, AND/OR) |
| Ballongfärden | exact sums; evaluating an expression first at higher levels |
| Mönsterbäcken | number sequences |
| Näckrosdammen | Venn-diagram sorting with secret rules |
| Kompisflotten | arranging neighbors under a rule |
| Ugglans dörr | code-breaking (Mastermind-style deduction) |
| Talmaskinen | function machine: find the rule from in/out pairs |
| Trädgårdslandet | grid with row, column and diagonal sums |
| Bärbusken | division, remainders and reverse problems |
| Bergsstigen | chaining +, −, ·, / to hit a target |

- **Score:** the hub trophy shows how many numlingar live in Numeria. It
  grows with every finished journey. "Reset high scores" in the hub only
  clears the trophy; the game's own **Inställningar → Radera alla
  framsteg** resets everything.
- **Difficulty:** 4 levels, chosen on first play. Before each stop the map
  suggests a level and the child may pick an easier one. A stop's
  suggested level rises when the whole troupe clears it at that level.
  Levels can also be set by hand in the game's settings, which also list
  what each stop practices.
- **Saved progress:** `state.numlings` (troupe, journey route, levels,
  sound). Saves from the earlier English version are migrated.

## Gångertabellen notes

Times tables 1–10 practice in Swedish. The child types the answer on a big
on-screen number pad (or a keyboard) — there is no clock and no time limit
in the game itself. Three ways to practice:

| Mode | What comes |
| ---- | ---------- |
| Fri träning | questions from all tables 1–10 in random order, until the child taps **Avsluta** |
| Tabellmix | pick one or more tables; every question in them comes exactly once, shuffled (two tables = 20 questions) |
| Tabelltrappan | pick one table and go through it in order: 7 · 1, 7 · 2 … 7 · 10 |

- Questions are written with the table first (`7 · 3` is in the 7 table),
  so in Tabellmix with the 3 and 5 tables both `3 · 5` and `5 · 3` come once.
- Fri träning draws from a shuffled deck of all 100 questions and reshuffles
  when it runs out, so everything comes up before anything repeats, and the
  same question never comes twice in a row.
- A wrong answer shows the right one, and the child taps **Nästa** to go on.
- Questions answered, correct answers and the current run of correct answers
  are shown during play; the end screen repeats them and lists the questions
  to practice more.
- **Score:** the hub trophy is the record for most correct answers in a row.
- **Saved:** `state.gangertabell` remembers the last chosen tables.

## Detektiven notes

A logic puzzle in Swedish. Twenty people stand in a grid, columns A–D and
rows 1–5. Everyone is either a **skurk** (criminal) or **oskyldig**
(innocent), and everyone tells the truth. One person starts revealed. Tapping
somebody and choosing correctly reveals them. Only some people have a clue;
the others just say something ("Hurra, jag är fri!"). Guessing is not
allowed: the game only accepts what the revealed clues prove, and a guess or
the opposite of what the clues prove counts as a **misstag** (mistake).

Pick a level for every new case. A level unlocks when you have solved a case
on the level before it.

A step is as hard as the number of clues you must combine to take it. The
game's solver plays each case, always taking the easiest step, and counts
the steps. Averages per case:

| Level    | Steps needing 2 / 3 / 4+ clues          | People with a clue | Criminals |
| -------- | --------------------------------------- | ------------------ | --------- |
| Lätt     | 0 / 0 / 0, and often several to pick    | 11–15              | 5–9       |
| Mellan   | 0.8 / 0 / 0                             | 9–12               | 6–11      |
| Svår     | 4.0 / 0 / 0                             | 10–14              | 7–14      |
| Geni     | 4.6 / 2.4 / 0.4                         | 8–12               | 6–15      |
| Omöjliga | 4.1 / 3.4 / 2.0                         | 10–13              | 9–16      |

- **New cases are made in the game**, so they never run out. While a case is
  made, the solver plays it through and decides for each person whether they
  get a clue, and which one, so the case lands on the level's mix of steps.
  Every case has exactly one answer, and whatever order you solve it in, you
  never need more clues at once than the hardest step in the solver's order.
- **Clues:** counts and "at least" in rows, columns, someone's grannar
  (neighbours, diagonals included), above/below/left/right of someone,
  between two people, on the edge, in the corners, among a job, and
  combinations ("Klara har exakt 2 skurkgrannar som är kockar", "Det finns
  inga kockar som är skurkar till höger om Saga"); comparisons of two areas
  or two jobs; odd/even; "hänger ihop" (connected) and "Båda … hänger ihop";
  "Den enda skurken till höger om Filip finns på kanten"; "… och exakt 1 av
  dem är kock"; most/only/each for rows and columns; the job or person with
  the most; "Bara en person i hörnen har …"; "direkt till vänster om sig".
  Harder levels use more kinds.
- **💡 Tips:** the first press highlights the clues to look at, the second
  the people you can then work out. Hints are counted on the result screen.
- **Notes:** an unknown person can get a colour mark (just for the player).
  Tap a revealed clue to dim it when it is no longer useful.
- **Score:** the hub trophy counts solved cases on all levels. "Reset high
  scores" in the hub only clears the trophy, not the unlocked levels.
- **Saved:** `state.detektiven` holds `prog` (unlocked level and solved
  cases per level) and `game` (the case in progress: the case itself, who has
  been revealed in which order, mistakes, hints, time, dimmed clues and marks).
  A saved case is only used if its clues are true and give exactly its answer.
