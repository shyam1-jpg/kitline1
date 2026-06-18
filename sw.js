/* Kiteline service worker — offline app shell caching */
const CACHE = 'kiteline-v33';
const ASSETS = [
  '/app',
  '/index.html',
  '/css/styles.css',
  '/js/i18n.js',
  '/js/api.js',
  '/js/store.js',
  '/js/ui.js',
  '/js/register-form.js',
  '/js/views.js',
  '/js/app.js',
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
  // Never cache API calls — always go to network.
  if (url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return; // let CDN handle itself

  // JS/CSS/logo: network-first so updates land without hard refresh
  const networkFirst = /^\/(js|css)\//.test(url.pathname) || /kiteline-logo\.png/.test(url.pathname);
  e.respondWith(
    caches.match(req).then(cached => {
      const fetched = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return networkFirst ? fetched.catch(() => cached) : (cached || fetched);
    })
  );
});
