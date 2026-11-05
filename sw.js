/* Service worker KITO: push notification + dukungan offline + background sync.
   Didaftarkan oleh assets/js/offline.js / assets/js/push.js sebagai sw.js?api=<alamat backend notifikasi>.

   Offline:
   - Halaman (navigasi): network-first (batas 4 detik) -> cache -> offline.html.
   - Data dashboard (satu file data/kito.json): network-first, sehingga online selalu terbaru dan offline memakai data terakhir.
   - CSS/JS/gambar/font: stale-while-revalidate (cepat dari cache, diperbarui di latar belakang).
   - API notifikasi & situs lain: tidak di-cache.
   Background sync:
   - 'kito-antrean': permintaan pengaturan notifikasi yang gagal saat offline diantre di IndexedDB lalu dikirim saat online.
   - periodicsync 'kito-segarkan': memperbarui cache halaman & data di latar belakang (Chrome Android, aplikasi terpasang). */
'use strict';
const API = new URL(self.location).searchParams.get('api') || '';
const ICON = 'assets/images/ios/icon-192.png';
const VERSI = 'kito-v9';
const SHELL = `${VERSI}-shell`, RUNTIME = `${VERSI}-runtime`, DATA = `${VERSI}-data`;
const MAKS_RUNTIME = 180;
const scope = () => self.registration.scope;
const lokal = (u) => u.origin === self.location.origin;
const isData = (u) => /\/data\/kito\.json$/.test(u.pathname);

/* ---------- install: simpan kerangka aplikasi (HTML + semua CSS/JS lokal dari index.html) ---------- */
async function simpanShell() {
  const c = await caches.open(SHELL);
  const dasar = ['./', 'index.html', 'offline.html', 'manifest.json', 'assets/images/ios/icon-192.png', 'assets/images/ios/icon-512.png', 'assets/images/ios/apple-touch-icon.png', 'assets/images/ios/favicon-32.png'];
  await Promise.allSettled(dasar.map((p) => c.add(new Request(p, { cache: 'reload' }))));
  try {
    const html = await (await fetch('index.html', { cache: 'no-store' })).text();
    const aset = [...html.matchAll(/(?:src|href)="(assets\/(?:js|css)\/[^"]+)"/g)].map((m) => m[1]);
    const dc = await caches.open(DATA);
    await dc.add(new Request('data/kito.json', { cache: 'reload' })).catch(() => {});
    await Promise.allSettled([...new Set(aset)].map((p) => (isData(new URL(p, scope())) ? dc : c).add(new Request(p, { cache: 'reload' }))));
  } catch (e) { /* offline saat install: cukup dasar */ }
}

self.addEventListener('install', (e) => { e.waitUntil(simpanShell().then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('kito-') && !k.startsWith(VERSI)) await caches.delete(k);
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch (er) {} }
    await self.clients.claim();
  })());
});

/* ---------- strategi cache ---------- */
async function batasiCache(nama, maks) {
  const c = await caches.open(nama); const k = await c.keys();
  for (let i = 0; i < k.length - maks; i++) await c.delete(k[i]);
}
function denganBatasWaktu(p, ms) { return Promise.race([p, new Promise((_, tolak) => setTimeout(() => tolak(new Error('timeout')), ms))]); }

async function halaman(event) {
  const req = event.request;
  try {
    const pre = event.preloadResponse ? await event.preloadResponse : null;
    const res = pre || await denganBatasWaktu(fetch(req), 4000);
    if (res && res.ok) { const c = await caches.open(SHELL); c.put(new URL(req.url).pathname.endsWith('/') ? 'index.html' : req, res.clone()); }
    return res;
  } catch (e) {
    const c = await caches.open(SHELL);
    return (await c.match(req, { ignoreSearch: true })) || (await c.match('index.html')) || (await c.match('offline.html')) || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req, nama) {
  const c = await caches.open(nama);
  try {
    const res = await denganBatasWaktu(fetch(req), 6000);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (e) {
    return (await c.match(req)) || (await c.match(req, { ignoreSearch: true })) || Response.error();
  }
}

async function staleWhileRevalidate(event, nama) {
  const req = event.request, c = await caches.open(nama);
  const ada = (await c.match(req)) || (await caches.match(req));
  const baru = fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) { c.put(req, res.clone()); batasiCache(nama, MAKS_RUNTIME); }
    return res;
  }).catch(() => null);
  if (ada) { event.waitUntil(baru); return ada; }
  return (await baru) || (await c.match(req, { ignoreSearch: true })) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (API && req.url.startsWith(API)) return; // API notifikasi: selalu langsung ke server
  if (req.mode === 'navigate' && lokal(u)) return event.respondWith(halaman(event));
  if (lokal(u)) {
    if (u.pathname.endsWith('/sw.js') || u.pathname.includes('/push-php/') || u.pathname.includes('/.well-known/') || u.pathname.includes('/download/')) return; // APK & halaman unduh: langsung ke server, tidak di-cache
    if (isData(u)) return event.respondWith(networkFirst(req, DATA));
    return event.respondWith(staleWhileRevalidate(event, RUNTIME));
  }
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return event.respondWith(staleWhileRevalidate(event, RUNTIME));
});

/* ---------- antrean background sync (IndexedDB) ---------- */
function db() {
  return new Promise((ok, gagal) => {
    const r = indexedDB.open('kito-sync', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('antrean', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => ok(r.result); r.onerror = () => gagal(r.error);
  });
}
async function antre(item) {
  const d = await db();
  await new Promise((ok, gagal) => { const t = d.transaction('antrean', 'readwrite'); t.objectStore('antrean').add({ ...item, waktu: Date.now() }); t.oncomplete = ok; t.onerror = () => gagal(t.error); });
  if (self.registration.sync) { try { await self.registration.sync.register('kito-antrean'); } catch (e) {} }
}
let sedangKirim = null; // cegah pengiriman ganda (sync bawaan + cadangan 'online' bersamaan)
function kirimAntrean() {
  if (!sedangKirim) sedangKirim = kirimAntreanSekali().finally(() => { sedangKirim = null; });
  return sedangKirim;
}
async function kirimAntreanSekali() {
  const d = await db();
  const semua = await new Promise((ok) => { const q = d.transaction('antrean').objectStore('antrean').getAll(); q.onsuccess = () => ok(q.result || []); });
  let sisa = 0;
  for (const it of semua) {
    try {
      const res = await fetch(it.url, { method: it.method, headers: { 'Content-Type': 'application/json' }, body: it.body });
      if (res.ok || (res.status >= 400 && res.status < 500)) { // terkirim, atau ditolak permanen: buang dari antrean
        await new Promise((ok) => { const t = d.transaction('antrean', 'readwrite'); t.objectStore('antrean').delete(it.id); t.oncomplete = ok; });
      } else sisa++;
    } catch (e) { sisa++; }
  }
  if (sisa) throw new Error(`${sisa} permintaan belum terkirim`); // browser akan mencoba lagi nanti
  const cl = await self.clients.matchAll({ type: 'window' });
  cl.forEach((c) => c.postMessage({ type: 'kito-antrean-terkirim', jumlah: semua.length }));
}

async function segarkanData() {
  await simpanShell(); // ambil index.html terbaru + semua data & aset yang dirujuknya
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'kito-antrean') event.waitUntil(kirimAntrean());
  if (event.tag === 'kito-segarkan') event.waitUntil(segarkanData());
});
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'kito-segarkan') event.waitUntil(segarkanData());
});

// pesan dari halaman: antre permintaan, minta penyegaran, atau cek ukuran antrean
self.addEventListener('message', (event) => {
  const m = event.data || {};
  if (m.type === 'kito-antre' && m.item) event.waitUntil(antre(m.item));
  if (m.type === 'kito-kirim-antrean') event.waitUntil(kirimAntrean().catch(() => {}));
  if (m.type === 'kito-segarkan') event.waitUntil(segarkanData());
});

/* ---------- push notification ---------- */
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
  // notifikasi update data: sekalian perbarui cache agar data baru langsung tersedia offline
  event.waitUntil(Promise.all([self.registration.showNotification(title, opt), d.tag === 'kito-update' ? segarkanData().catch(() => {}) : null]));
});

// ketuk notifikasi: fokus ke tab/aplikasi KITO yang sudah terbuka, atau buka baru
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // tombol aksi diketuk: buka tautan milik tombol itu; selain itu tautan utama notifikasi
  const tujuan = (event.action && data.actions && data.actions[event.action]) || data.url || './';
  const target = new URL(tujuan, scope()).href;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(scope()) && 'focus' in c) {
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
    const item = { url: API + '/api/subscriptions', method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), oldEndpoint }) };
    try { const r = await fetch(item.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: item.body }); if (!r.ok && r.status >= 500) await antre(item); }
    catch (e) { await antre(item); } // offline: kirim nanti lewat background sync
  })());
});
