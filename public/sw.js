/* AgriFlow AI service worker
 * - Offline app shell: /offline page + its static assets are precached.
 * - Static build assets (/_next/static) are cache-first (immutable, contain no user data).
 * - Public marketing pages are network-first with a cached fallback.
 * - Authenticated pages and all /api requests are NEVER cached (private data stays off-device caches);
 *   when offline they fall back to the /offline page, which works from IndexedDB drafts.
 */
const VERSION = "agriflow-v3";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const PUBLIC_PAGES = ["/", "/about", "/how-it-works", "/features", "/farmers", "/marketplace", "/suppliers", "/logistics", "/contact", "/faq", "/privacy", "/terms"];

/** Only the app's own public artwork may be cached — never user uploads. */
function isPublicImage(url) {
  const PUBLIC = ["/brand/", "/images/", "/icons/"];
  if (PUBLIC.some((p) => url.pathname.startsWith(p))) return true;
  if (url.pathname === "/_next/image") {
    const src = url.searchParams.get("url") || "";
    return PUBLIC.some((p) => src.startsWith(p));
  }
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      try {
        const res = await fetch("/offline", { credentials: "same-origin" });
        if (res.ok) {
          const html = await res.clone().text();
          await cache.put("/offline", res);
          const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])];
          // Optimised versions of public brand images used by the offline screen (logo etc.)
          for (const m of html.match(/\/_next\/image\?url=[^"'\s)]+/g) || []) {
            const u = m.replace(/&amp;/g, "&");
            if (isPublicImage(new URL(u, self.location.origin))) assets.push(u);
          }
          const staticCache = await caches.open(STATIC);
          await Promise.all(assets.map((a) => staticCache.add(a).catch(() => null)));
        }
        await cache.addAll(["/icon.svg", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/favicon.ico", "/brand/agriflow-mark.png", "/brand/agriflow-logo.png"]).catch(() => null);
      } catch (e) {
        /* offline during install — will retry next time */
      }
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache API responses

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg" || isPublicImage(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        // Look in every AgriFlow cache: the shell precache also holds icons and brand images.
        const hit = (await cache.match(req)) || (await caches.match(req));
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return new Response("", { status: 504, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  if (req.mode === "navigate") {
    const isPublic = PUBLIC_PAGES.includes(url.pathname) || url.pathname === "/offline";
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (isPublic && res.ok && !res.redirected) {
            const cache = await caches.open(SHELL);
            cache.put(url.pathname, res.clone());
          }
          return res;
        } catch (e) {
          const cache = await caches.open(SHELL);
          if (isPublic) {
            const hit = await cache.match(url.pathname);
            if (hit) return hit;
          }
          const offline = await cache.match("/offline");
          return offline || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })(),
    );
  }
});
