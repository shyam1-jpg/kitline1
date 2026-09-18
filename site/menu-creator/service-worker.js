const CACHE_NAME = "menu-creator-kiteline-v13";
const APP_BUILD = "v13";
const ASSETS = [
  "/menu-creator/",
  "/menu-creator/index.html",
  "/menu-creator/vedanta-menu-creator.html",
  "/menu-creator/install.html",
  "/menu-creator/manifest.json",
  "/menu-creator/icons/icon-192.png",
  "/menu-creator/icons/icon-512.png",
  "/menu-creator/icons/apple-touch-icon.png",
  "/menu-creator/icons/icon-192.svg",
  "/menu-creator/icons/icon-512.svg",
  "/menu-creator/assets/vedanta-logo.png",
  "/menu-creator/assets/qr-thevedanta.png"
];
const NAV_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Precache individually so one missing file cannot fail the whole install
    // (addAll is all-or-nothing and can leave the worker stuck "installing").
    await Promise.all(ASSETS.map((url) => cache.add(url).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isNavigation(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isServiceWorkerScript(url) {
  return url.pathname.endsWith("/service-worker.js");
}

function networkWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { cache: "no-store", signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function cacheKeyForPath(pathname) {
  if (pathname.endsWith("vedanta-menu-creator.html")) return "/menu-creator/vedanta-menu-creator.html";
  if (pathname.endsWith("install.html")) return "/menu-creator/install.html";
  return "/menu-creator/index.html";
}

async function cachedPage(pathname) {
  const key = cacheKeyForPath(pathname || "/");
  return (await caches.match(key)) || (await caches.match("/menu-creator/index.html")) || (await caches.match("/menu-creator/"));
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Never intercept the worker script: lets updates apply and avoids SPA
  // fallbacks poisoning the cache with HTML-as-JS.
  if (isServiceWorkerScript(url)) return;

  event.respondWith(handleFetch(event.request, url));
});

async function handleFetch(request, url) {
  if (isNavigation(request)) {
    try {
      // Fetch by URL (not the navigation Request) so a reload cannot deadlock
      // against precache/install of the same document.
      const fresh = await networkWithTimeout(url.href, NAV_TIMEOUT_MS);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(cacheKeyForPath(url.pathname), fresh.clone());
        return fresh;
      }
    } catch (_) { /* timeout, abort, or offline — use cache */ }
    return (await cachedPage(url.pathname)) || fetch(url.href);
  }

  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      const type = response.headers.get("content-type") || "";
      // Do not cache HTML under icon/manifest/other URLs (SPA 200 fallbacks).
      const isHtml = type.includes("text/html");
      const wantHtml = request.destination === "document" || url.pathname.endsWith(".html");
      if (!isHtml || wantHtml) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
    }
    return response;
  } catch (_) {
    return (await caches.match(request)) || (await cachedPage(url.pathname)) || Response.error();
  }
}
