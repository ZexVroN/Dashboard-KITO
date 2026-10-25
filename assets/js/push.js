/* Push Notification KITO (Web Push) — Android (Chrome/Edge/Firefox/Samsung), iOS/iPadOS 16.4+ (PWA di Layar Utama),
   Desktop (Chrome/Edge/Firefox/Safari). Juga menampilkan banner pengumuman dari halaman admin.
   Butuh backend (backend/server.js). Dibuka langsung dari file:// → fitur ini otomatis nonaktif.
   Backend di domain lain? set sebelum skrip ini:  window.KITO_PUSH_API = 'https://push.contoh.go.id';  */
(() => {
  'use strict';
  if (location.protocol === 'file:') return;
  const API = (window.KITO_PUSH_API || '').replace(/\/$/, '');
  const TABS = ['ranking', 'region', 'area', 'cabang'];
  const LS = { area: 'kito_push_area', day: 'kito_push_day', seen: 'kito_ann_seen' };
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const $ = (s, r = document) => r.querySelector(s);

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone = (() => { try { return navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches; } catch (e) { return false; } })();
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const needsInstall = isIOS && !standalone;   // Safari iOS: push hanya jika dashboard dipasang di Layar Utama

  const api = (path, opt = {}) => fetch(API + path, { credentials: 'omit', ...opt, headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) } })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; });
  const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
  const swUrl = new URL('sw.js', document.baseURI).href;

  let reg = null, sub = null, areas = [], key = null;

  async function getReg() {
    if (reg) return reg;
    await navigator.serviceWorker.register(swUrl);
    reg = await navigator.serviceWorker.ready;
    return reg;
  }
  async function current() { try { return supported ? (await (await getReg()).pushManager.getSubscription()) : null; } catch (e) { return null; } }
  const prefArea = () => ls.get(LS.area) || '';
  const body = (s, area) => JSON.stringify({ subscription: s.toJSON(), area: area == null ? prefArea() : area, standalone, touch: navigator.maxTouchPoints > 1, platform: isIOS ? 'ios' : undefined });

  /* ---------- UI: tombol di header ---------- */
  const tema = $('#tema');
  if (!tema) return;
  const bell = document.createElement('button');
  bell.type = 'button'; bell.id = 'notif'; bell.className = 'tema notif off';
  bell.setAttribute('aria-label', 'Pengaturan notifikasi'); bell.setAttribute('aria-haspopup', 'dialog');
  bell.innerHTML = '🔔<i class="dot"></i>';
  const grp = document.createElement('div'); grp.className = 'kito-act';
  tema.parentNode.insertBefore(grp, tema); grp.append(bell, tema);

  /* ---------- UI: panel ---------- */
  const sheet = document.createElement('div');
  sheet.className = 'pn-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'pn-t');
  sheet.innerHTML = `<div class="pn-card">
    <h3 id="pn-t">🔔 Notifikasi KITO</h3>
    <div><span class="pn-state" id="pn-state">Memeriksa…</span></div>
    <p id="pn-desc">Dapatkan pemberitahuan saat data dashboard diperbarui atau ada pengumuman dari admin.</p>
    <div class="pn-help" id="pn-help" hidden></div>
    <div class="pn-row" id="pn-area-row"><label for="pn-area">Fokus area</label><select id="pn-area"><option value="">Semua area</option></select></div>
    <div class="pn-msg" id="pn-msg" role="status" aria-live="polite"></div>
    <button class="pn-btn" id="pn-main" type="button">Aktifkan notifikasi</button>
    <button class="pn-btn ghost" id="pn-close" type="button">Tutup</button>
  </div>`;
  document.body.appendChild(sheet);
  const el = { state: $('#pn-state', sheet), desc: $('#pn-desc', sheet), help: $('#pn-help', sheet), area: $('#pn-area', sheet), areaRow: $('#pn-area-row', sheet), msg: $('#pn-msg', sheet), main: $('#pn-main', sheet) };
  let lastFocus = null;
  const open = () => { lastFocus = document.activeElement; sheet.classList.add('open'); refresh(); setTimeout(() => el.main.focus(), 50); };
  const close = () => { sheet.classList.remove('open'); if (lastFocus) lastFocus.focus(); };
  bell.addEventListener('click', open);
  $('#pn-close', sheet).addEventListener('click', close);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('open')) close(); });

  const say = (t, err) => { el.msg.textContent = t || ''; el.msg.className = 'pn-msg' + (err ? ' err' : ''); };
  function setState(txt, cls) { el.state.textContent = txt; el.state.className = 'pn-state ' + (cls || ''); }

  async function loadKey() {
    if (key) return key;
    const j = await api('/api/push/key'); key = j.publicKey; areas = j.areas || [];
    if (!el.area.dataset.filled) { areas.forEach((a) => el.area.add(new Option(a, a))); el.area.dataset.filled = '1'; }
    el.area.value = prefArea();
    return key;
  }

  async function refresh() {
    say('');
    el.help.hidden = true; el.areaRow.hidden = false; el.main.disabled = false;
    if (needsInstall) {
      setState('Perlu dipasang di Layar Utama', 'err');
      el.desc.textContent = 'Di iPhone/iPad, notifikasi hanya bisa diaktifkan setelah KITO ditambahkan ke Layar Utama.';
      el.help.hidden = false;
      el.help.innerHTML = '<b>Caranya:</b> buka di <b>Safari</b> → ketuk <b>Bagikan</b> ⎋ → <b>Tambah ke Layar Utama</b> → buka KITO dari ikon di Layar Utama → ketuk 🔔 lalu <b>Aktifkan</b>. (Perlu iOS/iPadOS 16.4 atau lebih baru.)';
      el.areaRow.hidden = true; el.main.hidden = true; return;
    }
    el.main.hidden = false;
    if (!supported) { setState('Tidak didukung', 'err'); el.desc.textContent = 'Browser ini belum mendukung notifikasi push. Gunakan Chrome, Edge, Firefox, atau Safari versi terbaru.'; el.areaRow.hidden = true; el.main.hidden = true; return; }
    try { await loadKey(); } catch (e) { setState('Server notifikasi tidak terhubung', 'err'); el.desc.textContent = 'Layanan notifikasi belum aktif di server ini.'; el.areaRow.hidden = true; el.main.hidden = true; return; }
    if (Notification.permission === 'denied') {
      setState('Diblokir di browser', 'err');
      el.desc.textContent = 'Izin notifikasi untuk situs ini ditolak.';
      el.help.hidden = false; el.help.textContent = 'Buka pengaturan situs/aplikasi di browser Anda (ikon gembok di bilah alamat, atau Pengaturan → Notifikasi), ubah ke “Izinkan”, lalu muat ulang halaman.';
      el.main.disabled = true; el.areaRow.hidden = true; return;
    }
    sub = await current();
    if (sub) {
      setState('Aktif di perangkat ini', 'on'); bell.classList.remove('off');
      el.desc.textContent = 'Anda akan menerima notifikasi dari admin KITO. Atur area yang paling Anda pantau agar pengumuman lebih relevan.';
      el.main.textContent = 'Matikan notifikasi';
    } else {
      setState('Belum aktif'); bell.classList.add('off');
      el.desc.textContent = 'Dapatkan pemberitahuan saat data dashboard diperbarui atau ada pengumuman dari admin.';
      el.main.textContent = 'Aktifkan notifikasi';
    }
  }

  async function subscribe() {
    el.main.disabled = true; say('Meminta izin…');
    try {
      const k = await loadKey();
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { say(perm === 'denied' ? 'Izin ditolak.' : 'Izin belum diberikan.', true); return refresh(); }
      const r = await getReg();
      let s = await r.pushManager.getSubscription();
      if (!s) s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(k) });
      ls.set(LS.area, el.area.value);
      await api('/api/push/subscribe', { method: 'POST', body: body(s, el.area.value) });
      ls.set(LS.day, new Date().toISOString().slice(0, 10));
      say('Notifikasi diaktifkan ✓');
    } catch (e) { say('Gagal mengaktifkan: ' + e.message, true); }
    el.main.disabled = false; await refresh();
  }
  async function unsubscribe() {
    el.main.disabled = true;
    try {
      const s = await current();
      if (s) { await api('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: s.endpoint }) }).catch(() => {}); await s.unsubscribe(); }
      say('Notifikasi dimatikan.');
    } catch (e) { say('Gagal mematikan: ' + e.message, true); }
    el.main.disabled = false; await refresh();
  }
  el.main.addEventListener('click', async () => { (await current()) ? unsubscribe() : subscribe(); });
  el.area.addEventListener('change', async () => {
    ls.set(LS.area, el.area.value);
    const s = await current();
    if (s) { try { await api('/api/push/prefs', { method: 'POST', body: JSON.stringify({ endpoint: s.endpoint, area: el.area.value }) }); say('Fokus area disimpan ✓'); } catch (e) { say(e.message, true); } }
  });

  /* ---------- sinkron status awal & segarkan langganan harian ---------- */
  (async () => {
    if (needsInstall || !supported) return;
    const s = await current();
    if (!s) return;
    bell.classList.remove('off');
    const today = new Date().toISOString().slice(0, 10);
    if (ls.get(LS.day) !== today && Notification.permission === 'granted') {
      try { await api('/api/push/subscribe', { method: 'POST', body: body(s) }); ls.set(LS.day, today); } catch (e) {}
    }
  })();

  /* ---------- tautan dalam (?tab=area) & klik notifikasi ---------- */
  function openTab(urlLike) {
    try {
      const u = new URL(urlLike, location.href);
      if (u.origin !== location.origin) { location.href = u.href; return; }
      const t = u.searchParams.get('tab');
      if (t && TABS.includes(t) && typeof bukaTab === 'function') bukaTab(t);
      else if (u.pathname !== location.pathname) location.href = u.href;
    } catch (e) {}
  }
  window.addEventListener('load', () => { const t = new URLSearchParams(location.search).get('tab'); if (t) setTimeout(() => openTab(location.href), 1500); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'kito-open') openTab(e.data.url); });

  /* ---------- banner pengumuman ---------- */
  (async () => {
    try {
      const j = await api('/api/announcements?area=' + encodeURIComponent(prefArea()));
      const seen = (ls.get(LS.seen) || '').split(',');
      const a = (j.items || []).find((x) => !seen.includes(x.id));
      const app = $('#app');
      if (!a || !app) return;
      const b = document.createElement('div');
      b.className = 'pn-banner'; b.setAttribute('role', 'status');
      const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      b.innerHTML = `<div class="t"><b>📣 ${esc(a.title)}</b><span>${esc(a.body)}</span></div><button type="button" aria-label="Tutup pengumuman">✕</button>`;
      $('button', b).addEventListener('click', () => { seen.push(a.id); ls.set(LS.seen, seen.filter(Boolean).slice(-30).join(',')); b.remove(); });
      $('.t', b).addEventListener('click', () => { if (a.url && a.url !== '/') openTab(a.url); });
      app.parentNode.insertBefore(b, app);
    } catch (e) { /* tanpa backend: diam */ }
  })();
})();
