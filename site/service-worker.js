const CACHE = "market-ledger-v4";
const APP_SHELL = ["./", "index.html", "browse.html", "trends.html", "styles.css?v=market-terminal-4", "app.js?v=market-terminal-4", "trends.js", "manifest.webmanifest", "icon.svg", "data/history.csv", "data/status.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((response) => response || caches.match("index.html"))));
});
