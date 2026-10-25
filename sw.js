/* KITO Service Worker — khusus Push Notification (tanpa cache agar data dashboard selalu segar).
   Letakkan di akar situs (sejajar index.html). Backend: lihat backend/README.md */
'use strict';
const SCOPE = self.registration.scope;
const abs = (p) => { try { return new URL(String(p || '').replace(/^\//, ''), SCOPE).href; } catch (e) { return SCOPE; } };

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  const icon = d.icon ? abs(d.icon) : abs('assets/images/ios/icon-192.png');
  const opts = {
    body: d.body || '',
    icon,
    badge: abs('assets/images/ios/favicon-32.png'),
    tag: d.tag || undefined,
    renotify: !!d.tag,
    requireInteraction: !!d.requireInteraction,
    timestamp: d.ts || Date.now(),
    data: { url: abs(d.url || '/'), id: d.id || null },
    lang: 'id',
  };
  if (d.image) opts.image = abs(d.image);
  // userVisibleOnly: setiap push WAJIB menampilkan notifikasi (syarat Chrome/Safari)
  event.waitUntil(self.registration.showNotification(d.title || 'KITO', opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || SCOPE;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(SCOPE) && 'focus' in c) {
        await c.focus();
        c.postMessage({ type: 'kito-open', url });         // halaman membuka tab yang dituju tanpa memuat ulang
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});

// langganan dibuat ulang oleh browser (kunci kedaluwarsa) → daftarkan lagi ke backend
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const old = event.oldSubscription;
      const sub = event.newSubscription || (old && await self.registration.pushManager.subscribe(old.options));
      if (!sub) return;
      await fetch(abs('api/push/subscribe'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
    } catch (e) { /* diam: akan diperbarui saat dashboard dibuka berikutnya */ }
  })());
});
