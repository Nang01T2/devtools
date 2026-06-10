/*
 * GadgetForge service worker — offline support for a static-export site.
 *
 * Strategy (chosen to be deploy-safe — a buggy SW must never "brick" the site):
 *  - Navigations (HTML): NETWORK-FIRST, fall back to cache, then /offline.html.
 *    So an online user always gets fresh content; a deploy can never get stuck
 *    behind a stale cached page.
 *  - Same-origin static assets (_next/static, /vendor, /locales, /icons, fonts,
 *    .wasm, images): STALE-WHILE-REVALIDATE — instant from cache, refreshed in
 *    the background. This is what makes tools (incl. the WASM codecs) work
 *    offline after one visit.
 *  - Cross-origin (CDN, the image proxy, Google Analytics): never intercepted.
 *
 * Bump CACHE_VERSION to invalidate everything on the next activation.
 */
const CACHE_VERSION = "v1";
const CACHE = `gadgetforge-${CACHE_VERSION}`;
const PRECACHE = ["/", "/offline.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("gadgetforge-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  // Only handle our own origin — leave CDN/proxy/analytics to the network.
  if (url.origin !== self.location.origin) return;

  // Navigations → network-first with offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => {});
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((cached) => cached || caches.match("/offline.html"))
            .then((res) => res || caches.match("/")),
        ),
    );
    return;
  }

  // Static assets → stale-while-revalidate.
  // Intentionally unbounded: caching the WASM codecs / locale JSON / chunks is
  // exactly what makes the tools work offline. There's no LRU cap — the browser
  // evicts under storage pressure, and quota-exceeded `put`s are swallowed
  // below, so growth degrades gracefully rather than breaking.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          // Only cache complete, same-origin (basic) 200 responses.
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
