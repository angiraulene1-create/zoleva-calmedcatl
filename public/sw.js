const CACHE = 'zoleva-v5';
const CORE = [
  '/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest',
  '/favicon.ico', '/apple-touch-icon.png', '/icon.svg',
  '/icons/app-icon.svg', '/icons/app-icon-detail.svg', '/icons/wordmark.svg', '/icons/wordmark-alt.svg',
  '/icons/icon-192.png', '/icons/icon-512.png',
  '/tutors/owl.svg', '/tutors/wolf.svg', '/tutors/eagle.svg', '/tutors/fox.svg', '/tutors/tlamatinime.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html'))),
  );
});
