/*
 * GadgetForge service worker — offline support for a static-export site.
 *
 * Strategy (chosen to be deploy-safe — a buggy SW must never "brick" the site):
 *  - Navigations (HTML): NETWORK-FIRST, fall back to cache, then /offline.html.
 *    So an online user always gets fresh content; a deploy can never get stuck
 *    behind a stale cached page.
 *  - Locale JSON (/locales/**): NETWORK-FIRST, fall back to cache. Fixed URLs
 *    (no content hash) mean stale-while-revalidate would silently serve the old
 *    deploy's strings until the second reload; network-first makes updates
 *    instant for online users while offline users still get the cached copy.
 *  - Same-origin static assets (_next/static, /vendor, /icons, fonts,
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
// Soft cap on the stale-while-revalidate cache so it can't grow without bound
// (WASM codecs / locale JSON / chunks add up). The precache shell above is
// never evicted; oldest runtime entries are trimmed first. Generous enough to
// keep a typical multi-tool offline session intact.
const MAX_ENTRIES = 120;

/** Trim the cache to MAX_ENTRIES, evicting oldest non-shell entries first. */
async function trimCache() {
  try {
    const cache = await caches.open(CACHE);
    const keys = await cache.keys();
    const shell = new Set(
      PRECACHE.map((p) => new URL(p, self.location.origin).href),
    );
    const evictable = keys.filter((req) => !shell.has(req.url));
    let over = keys.length - MAX_ENTRIES;
    for (let i = 0; i < evictable.length && over > 0; i++, over--) {
      await cache.delete(evictable[i]); // cache.keys() is insertion-ordered → oldest first
    }
  } catch {
    // Trimming is best-effort — never let it break a fetch.
  }
}

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

  // Locale JSON → network-first. These files sit at fixed URLs (no content
  // hash), so stale-while-revalidate would silently serve the previous deploy's
  // translations until the *second* reload. Network-first ensures the UI always
  // reflects the latest strings; cached copy is the offline fallback.
  if (url.pathname.startsWith("/locales/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((c) => c.put(req, copy))
              .then(() => trimCache())
              .catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (cached) =>
              cached ||
              new Response("{}", {
                status: 503,
                headers: { "Content-Type": "application/json" },
              }),
          ),
        ),
    );
    return;
  }

  // Static assets → stale-while-revalidate. Caching the WASM codecs /
  // chunks is what makes the tools work offline; the cache is bounded by
  // MAX_ENTRIES (trimmed below) so it can't grow without limit, and the browser
  // still evicts under storage pressure / quota-exceeded `put`s are swallowed.
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
              .then(() => trimCache())
              .catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
