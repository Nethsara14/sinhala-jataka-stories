/* Service worker - app eka offline wada karanna.
   Shell (html/css/js) : network-first (online nam hamadama aluth version eka), offline nam cache eken.
   Data/<id>.json      : cache-first (eka parak load unama offline thiyenawa).
   Code update kalama VERSION eka wenas karanna (optional - network-first nisa auto update wenawa). */
const VERSION = 'v13';
const SHELL_CACHE = 'jk-shell-' + VERSION;
const DATA_CACHE = 'jk-data-v1';
const SHELL = [
  './',
  'index.html',
  'app-info.json',
  'css/style.css',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'Data/index.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('jk-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, cacheName, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true });
    const timer = setTimeout(() => {
      fromCache().then((hit) => { if (hit && !settled) { settled = true; resolve(hit); } });
    }, timeoutMs);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(req, copy));
      }
      if (!settled) { settled = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then((hit) => { if (!settled) { settled = true; resolve(hit || Response.error()); } });
    });
  });
}

function cacheFirst(req, cacheName) {
  return caches.match(req).then((hit) => {
    if (hit) return hit;
    return fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(req, copy));
      }
      return res;
    });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Page open karanawa (index.html)
  if (req.mode === 'navigate') {
    e.respondWith(
      networkFirst(new Request('index.html'), SHELL_CACHE, 3000)
        .then((res) => res || caches.match('index.html'))
    );
    return;
  }

  // Story files: Data/12.json
  if (/\/Data\/\d+\.json$/.test(url.pathname)) {
    e.respondWith(cacheFirst(req, DATA_CACHE));
    return;
  }

  // Index + shell assets
  e.respondWith(networkFirst(req, SHELL_CACHE, 3000));
});
