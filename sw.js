/* ============================================================
   Service worker — makes the hub fully offline.
   IMPORTANT: whenever you change any file (or add a game),
   bump CACHE_VERSION so devices pick up the new files.
   ============================================================ */
const CACHE_VERSION = "game-hub-v9";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./config.js",
  "./manifest.webmanifest",
  "./shared/guard.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  // ---- games (add every new game file here) ----
  "./games/2048.html",
  "./games/goopipes.html",
  "./games/numlings.html",
  "./games/gangertabell.html",
  "./games/detektiven.html",
  "./games/jordenrunt.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first; anything fetched while online is added to the cache too,
// so even a game you forgot to precache becomes offline-available after
// its first visit.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
