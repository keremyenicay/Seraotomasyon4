/* Çevrimdışı çalışma için önbellek */
const SURUM = 'sera-v1.4.0';
const DOSYALAR = [
  './',
  'index.html',
  'css/app.css',
  'js/store.js',
  'js/excel.js',
  'js/app.js',
  'js/defter.js',
  'js/harita.js',
  'js/sema.js',
  'vendor/leaflet.js',
  'vendor/leaflet.css',
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
      .then((anahtarlar) => Promise.all(anahtarlar.filter((k) => k !== SURUM && k !== KARO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Harita karoları: önce önbellek (sahada internetsiz görüntülemek için), en fazla KARO_SINIR adet
const KARO = 'sera-karo-v1';
const KARO_SINIR = 3000;
const KARO_HOSTLAR = ['server.arcgisonline.com', 'tile.openstreetmap.org'];
let karoSayac = 0;
async function karoGetir(req) {
  const c = await caches.open(KARO);
  const var_ = await c.match(req);
  if (var_) return var_;
  const yanit = await fetch(req);
  if (yanit.ok) {
    await c.put(req, yanit.clone());
    if (++karoSayac % 50 === 0) {
      const anahtarlar = await c.keys();
      const fazla = anahtarlar.length - KARO_SINIR;
      for (let i = 0; i < fazla; i++) await c.delete(anahtarlar[i]);
    }
  }
  return yanit;
}

// Önce ağ (güncel sürüm), ağ yoksa önbellek
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (KARO_HOSTLAR.includes(url.hostname)) {
    e.respondWith(karoGetir(e.request));
    return;
  }
  if (url.origin !== location.origin) return;
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
