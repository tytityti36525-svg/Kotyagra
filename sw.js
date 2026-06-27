// КотяГра — Service Worker (PWA: офлайн-старт + кеш).
// Стратегія: network-first для свого коду (щоб бачити оновлення),
// з відкатом на кеш, коли немає інтернету. Firebase/CDN — завжди мережа.
const CACHE = 'kotyagra-v5-2026-06';
const ASSETS = [
  './', './index.html', './style.css', './app.js',
  './pets.js', './assets.js', './manifest.json',
  './icon-192.png', './icon-512.png',
  './season-spring.jpg', './season-summer.jpg', './season-autumn.jpg', './season-winter.jpg'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // лише свій домен кешуємо; Firebase/Google CDN — напряму в мережу
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});

// ── клік по сповіщенню → відкрити/сфокусувати гру ──
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
      for (const c of list){ if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
