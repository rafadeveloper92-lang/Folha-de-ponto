const CACHE_NAME = 'gsi-tracker-v3';
const PRECACHE = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request)),
  );
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let id = `push-${Date.now()}`;
      let title = 'GSI Tracker';
      let body = 'Nova informação';
      let data = {};
      if (event.data) {
        try {
          const json = await event.data.json();
          if (json.id != null) id = String(json.id);
          if (json.title) title = String(json.title);
          if (json.body) body = String(json.body);
          data = json.data && typeof json.data === 'object' ? json.data : json;
        } catch {
          try {
            const t = event.data.text();
            if (t) body = t;
          } catch {
            /* ignore */
          }
        }
      }
      const createdAt = Date.now();
      const msg = {id, title, body, createdAt, read: false, source: 'push'};
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const c of clients) {
        try {
          c.postMessage({type: 'PUSH_MESSAGE', message: msg});
        } catch {
          /* ignore */
        }
      }
      await self.registration.showNotification(title, {
        body,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        data: {...data, gsiMessageId: id},
        vibrate: [120, 80, 120],
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL('./', self.location.href).href;
  const nid =
    event.notification.data && event.notification.data.gsiMessageId != null
      ? String(event.notification.data.gsiMessageId)
      : null;
  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((clientList) => {
      for (const c of clientList) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          try {
            c.postMessage({
              type: 'NOTIFICATION_CLICK',
              messageId: nid,
              title: event.notification.title,
              body: event.notification.body,
            });
          } catch {
            /* ignore */
          }
          return c.focus();
        }
      }
      if (self.clients.openWindow)
        return self.clients.openWindow(url + (nid ? `#msg=${encodeURIComponent(nid)}` : ''));
    }),
  );
});
