const VERSION = "v14";
const CACHE = `finance-pwa-${VERSION}`;

const SCOPE = self.registration.scope;
const U = (p) => new URL(p, SCOPE).toString();

const ASSETS = [
  U("./"),
  U("./index.html"),
  U("./expenses.html"),
  U("./reports.html"),
  U("./manifest.webmanifest"),

  U("./static/styles.css"),
  U("./static/main.js"),

  U("./static/vendor/bootstrap.min.css"),
  U("./static/vendor/bootstrap.bundle.min.js"),
  U("./static/vendor/chart.umd.min.js"),

  U("./static/icons/icon-192.png"),
  U("./static/icons/icon-512.png")
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.mode === "navigate") {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).catch(() => caches.match(U("./index.html"))))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
