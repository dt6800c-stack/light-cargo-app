/**
 * Service Worker - オフラインキャッシュ戦略
 */
const CACHE_NAME = 'light-cargo-v2';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/geo.js',
  './js/api.js',
  './js/app.js',
  './manifest.json',
];

// インストール: アセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// アクティベート: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// フェッチ: ネットワークファースト（API）/ キャッシュファースト（静的アセット）
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // API リクエストはネットワークファースト
  if (request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ status: 'error', message: 'オフラインです。後ほど再試行してください。' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // 静的アセットはキャッシュファースト
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});

// 通知クリック時にアプリを開く
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('light-cargo-app') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});
