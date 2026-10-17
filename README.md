# Game Hub

An ad-free, offline-capable game collection for kids' iPads. One web app,
installed via "Add to Home Screen", with on-device high scores and
PIN-protected daily time limits per game.

## Publish on GitHub Pages

1. Create a repository (e.g. `game-hub`) and push these files to the root
   of the `main` branch.
2. In the repo: **Settings → Pages → Source: Deploy from a branch**,
   select `main` / `(root)`, save.
3. After a minute the site is live at
   `https://<username>.github.io/game-hub/`.

All paths in the project are relative, so it works at any URL, including
project subpaths.

## Install on the kids' iPads

1. Open the URL in **Safari** (must be Safari for home-screen install).
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
   `CACHE_VERSION` (e.g. `game-hub-v2`). Commit and push.

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
games/goopipes.html   the Goo Pipes game (fully self-contained)
tests/                Node-runnable logic tests (node tests/goopipes.test.js)
icons/                app icons
```

## Storage keys (all localStorage, on device)

| Key          | Meaning                                        |
| ------------ | ---------------------------------------------- |
| `hub.pin`    | hashed parent PIN                              |
| `hub.limits` | `{gameId: minutesPerDay}`                      |
| `hub.usage`  | `{date, byGame:{gameId: secondsPlayedToday}}`  |
| `score.<id>` | each game's best score                         |
| `state.<id>` | optional saved game-in-progress (2048 uses it) |
