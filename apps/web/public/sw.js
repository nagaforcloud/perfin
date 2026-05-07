const CACHE_NAME = 'perfin-v1';

const PRECACHE_URLS = [
  '/',
  '/app',
  '/app/transactions',
  '/app/accounts',
  '/app/ask',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((self as unknown as ServiceWorkerGlobalScope).clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request),
    ),
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() as { title: string; body: string; url: string } | undefined;
  if (!data) return;
  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).clients.openWindow(url),
  );
});
