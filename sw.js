// Service Worker — คลังสื่อ ครูหนังสือ
const CACHE_NAME = 'khlang-suea-v1';

// ไฟล์ static ที่จะ cache ไว้ (shell ของแอป)
const STATIC_ASSETS = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  'https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap',
];

// ---- Install: cache ไฟล์ static ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ---- Activate: ลบ cache เก่า ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ---- Fetch: Strategy ตามประเภท request ----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Google Sheet CSV / gviz → Network First (ต้องการข้อมูลสด)
  if (
    url.hostname === 'docs.google.com' ||
    url.hostname === 'sheets.googleapis.com'
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() => new Response('[]', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // ไฟล์ static → Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          // cache ไว้สำหรับครั้งถัดไป
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      );
    })
  );
});
