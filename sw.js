/* Service worker KITO: menerima & menampilkan push notification (website, desktop, Android, iOS PWA).
   Didaftarkan oleh assets/js/push.js sebagai sw.js?api=<alamat push-server>.
   Tidak menyimpan cache halaman, supaya data dashboard selalu yang terbaru. */
'use strict';
const API = new URL(self.location).searchParams.get('api') || '';
const ICON = 'assets/images/ios/icon-192.png';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'KITO', body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'KITO · Dashboard Inbranch';
  const opt = {
    body: d.body || '',
    icon: d.icon || ICON,
    badge: d.badge || ICON,
    image: d.image,
    tag: d.tag,
    renotify: !!(d.tag && d.renotify),
    requireInteraction: !!d.requireInteraction,
    timestamp: d.ts || Date.now(),
    actions: Array.isArray(d.actions) ? d.actions.slice(0, 2) : undefined, // tombol aksi (Chrome/Edge/Android)
    data: { url: d.url || './', ...(d.data || {}) },
  };
  event.waitUntil(self.registration.showNotification(title, opt));
});

// ketuk notifikasi: fokus ke tab/aplikasi KITO yang sudah terbuka, atau buka baru
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // tombol aksi diketuk: buka tautan milik tombol itu; selain itu tautan utama notifikasi
  const tujuan = (event.action && data.actions && data.actions[event.action]) || data.url || './';
  const target = new URL(tujuan, self.registration.scope).href;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
        await c.focus();
        if ('navigate' in c && c.url !== target) { try { await c.navigate(target); } catch (e) {} }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

// browser memperbarui langganan (kunci kedaluwarsa): daftar ulang dan kabari server; topik dipindahkan server
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    if (!API) return;
    const oldEndpoint = event.oldSubscription?.endpoint;
    let sub = event.newSubscription;
    if (!sub) {
      const { publicKey } = await (await fetch(API + '/api/vapid-public-key')).json();
      const raw = atob(publicKey.replace(/-/g, '+').replace(/_/g, '/'));
      sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
    }
    await fetch(API + '/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), oldEndpoint }) });
  })());
});
