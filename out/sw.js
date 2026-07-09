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
const CACHE_VERSION = "v2";
const CACHE = `gadgetforge-${CACHE_VERSION}`;
const PRECACHE = ["/", "/offline.html", "/manifest.webmanifest"];
// Soft cap on the stale-while-revalidate cache so it can't grow without bound
// (WASM codecs / locale JSON / chunks add up). The precache shell above is
// never evicted; oldest runtime entries are trimmed first. Generous enough to
// keep a typical multi-tool offline session intact.
const MAX_ENTRIES = 120;

// COOP/COEP(credentialless) header injection for navigation responses — makes
// the document crossOriginIsolated, unlocking multi-threaded WASM
// (aiWorker.ts/visionWorker.ts gate numThreads on this) — see
// mememaker-web-performance-design.md's Phase 2 C1 for the spike that ruled
// out a second, separate coi-serviceworker (it fought this same SW for scope
// control) in favor of merging the header injection in here. credentialless
// mode does NOT require CORP headers on cross-origin resources (unlike
// require-corp), so HF CDN/GA/font requests are untouched and keep working
// exactly as before — verified in the spike.
//
// CORRECTION (2026-07-09): this comment used to claim "dedicated Workers
// spawned from a crossOriginIsolated page inherit it, no per-worker-script
// header needed" — verified FALSE against the real production deploy. Once
// the document is isolated, Chrome also enforces COEP on a classic worker's
// own top-level script response, and GitHub Pages can't set that header
// itself — the fetch handler below has its own `req.destination === "worker"`
// branch applying the exact same `withCoiHeaders` wrapping for that case.
// This function's "only the document" framing is kept only insofar as it's
// the ORIGINAL header source; both call sites below now reuse it.
//
// Skips redirected responses: constructing a new Response always produces an
// empty internal URL list, so wrapping a redirected response (e.g. GitHub
// Pages' automatic trailing-slash redirect) would make the browser display
// the pre-redirect request URL instead of the canonical one. Trading away
// cross-origin isolation for THAT ONE navigation (falling back to
// single-threaded WASM until the next page load) is a better trade than a
// wrong address bar.
function withCoiHeaders(res) {
  if (!res || res.redirected) return res;
  const headers = new Headers(res.headers);
  headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

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

  // Navigations → network-first with offline fallback. See withCoiHeaders'
  // own comment (top of file) for why the response is wrapped here.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => {});
          return withCoiHeaders(res);
        })
        .catch(() =>
          caches
            .match(req)
            .then((cached) => cached || caches.match("/offline.html"))
            .then((res) => res || caches.match("/"))
            .then((res) => (res ? withCoiHeaders(res) : res)),
        ),
    );
    return;
  }

  // Worker script requests → same COOP/COEP header injection as navigations.
  // CORRECTS a wrong assumption in this file's original comment ("dedicated
  // Workers spawned from a crossOriginIsolated page inherit it, no per-
  // worker-script header needed") — verified FALSE against the real
  // production deploy (2026-07-09): once the document is crossOriginIsolated,
  // Chrome requires a CLASSIC worker's own top-level script response to also
  // satisfy COEP, or the browser refuses to instantiate the worker at all
  // (`net::ERR_BLOCKED_BY_RESPONSE` on the worker's bootstrap script — GitHub
  // Pages can't set this header itself, and this fetch previously fell
  // through to the plain stale-while-revalidate branch below with no header
  // injection). `aiWorker.ts`/`visionWorker.ts` are compiled by Turbopack
  // into a shared CLASSIC bootstrap chunk (`turbopack-worker-*.js`, see
  // ai-integration.md's "Multiple Module Workers" section) — `req.destination
  // === "worker"` catches that chunk AND the real chunks it `importScripts`-
  // loads (those requests carry the same destination). No redirect concern
  // here (unlike the navigate branch — GH Pages only redirects on the
  // trailing-slash-less HTML route, never on `_next/static/**` asset URLs).
  if (req.destination === "worker" || req.destination === "sharedworker") {
    event.respondWith(
      fetch(req)
        .then((res) => withCoiHeaders(res))
        .catch(() => caches.match(req)),
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
