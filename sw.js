// Service worker: офлайн работа и бързо зареждане.
// При промяна на файловете увеличете VERSION, за да се обнови кешът.
const VERSION = 'evil-v14';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['./', './index.html', './css/app.css', './js/app.js'])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first за собствените файлове (винаги най-новата версия, кеш при офлайн),
// cache-first за шрифтовете.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  if (isFont) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }

  e.respondWith(
    // 'reload' заобикаля HTTP кеша на браузъра; копие се пази за офлайн режим.
    // (Заявка за навигация не може да се копира с нови настройки – затова по URL.)
    (req.mode === 'navigate' ? fetch(req.url, { cache: 'reload' }) : fetch(req, { cache: 'reload' }))
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
