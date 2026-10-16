/* Çevrimdışı çalışma için önbellek */
const SURUM = 'sera-v1.1.0';
const DOSYALAR = [
  './',
  'index.html',
  'css/app.css',
  'js/store.js',
  'js/excel.js',
  'js/app.js',
  'js/defter.js',
  'vendor/exceljs.min.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((anahtarlar) => Promise.all(anahtarlar.filter((k) => k !== SURUM).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Önce ağ (güncel sürüm), ağ yoksa önbellek
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((yanit) => {
        const kopya = yanit.clone();
        caches.open(SURUM).then((c) => c.put(e.request, kopya));
        return yanit;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
