/* Kiteline service worker — offline app shell caching */
const CACHE = 'kiteline-v40';
const ASSETS = [
  '/css/styles.css',
  '/kiteline-logo.png?v=mark3',
  '/manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never intercept API or HTML app shell — always use live network (avoids stale blank pages).
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/app' || url.pathname.startsWith('/app/')) return;
  if (url.pathname === '/' || url.pathname.endsWith('.html')) return;
  if (url.origin !== self.location.origin) return;

  // Static assets only: network-first, cache as fallback
  const isStatic = /^\/(js|css)\//.test(url.pathname) || /kiteline-logo\.png/.test(url.pathname);
  if (!isStatic) return;

  e.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
