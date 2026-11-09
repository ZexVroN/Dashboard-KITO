/* Pemantauan perangkat KITO: heartbeat ringan ke backend (push-php) agar admin bisa melihat
   perangkat yang sedang aktif, halaman yang dibuka, dan sebaran lokasi akses (perkiraan dari IP, tanpa GPS).
   - ID perangkat acak disimpan di localStorage (tidak berisi data pribadi); ID sesi per tab di sessionStorage.
   - Heartbeat tiap 60 detik hanya saat tab terlihat; saat tab disembunyikan/ditutup dikirim tanda selesai.
   - Ikut dikirim: jabatan login KPI, area/cabang yang dipilih, tab yang dibuka, jenis aplikasi (web/PWA/APK).
   Alamat backend sama dengan notifikasi: window.KITO_PUSH.api (assets/js/push-config.js).
   Admin: <api>/admin/perangkat */
(() => {
  'use strict';
  const API = (window.KITO_PUSH?.api || '').replace(/\/+$/, '');
  if (!API || !window.fetch) return;
  const URL_PING = API + '/api/presence/ping';
  const JEDA = 60000;

  const acak = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^A-Za-z0-9-]/g, '');
  const ambil = (store, k) => {
    try { let v = store.getItem(k); if (!v) { v = acak(); store.setItem(k, v); } return v; } catch (e) { return null; }
  };
  const perangkat = ambil(localStorage, 'kito-device-id') || acak();
  const sesi = ambil(sessionStorage, 'kito-session-id') || acak();

  const ua = navigator.userAgent;
  const twa = document.referrer.startsWith('android-app://') || (() => { try { return sessionStorage.getItem('kitoTWA') === '1'; } catch (e) { return false; } })();
  const app = twa || /; wv\)/.test(ua) ? 'apk'
    : (matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true ? 'pwa' : 'web');

  // konteks dashboard saat ini (variabel global dari script.js & kpi-login.js)
  const konteks = () => {
    let area = null, kode = null, cabang = null, jabatan = null;
    try {
      const b = typeof D !== 'undefined' && typeof st !== 'undefined' ? D.B[st.b] : null;
      area = typeof st !== 'undefined' && st.a && st.a !== 'Semua Area Region II' ? st.a : (b?.[2] || null);
      if (b) { kode = String(b[0]); cabang = b[1]; }
    } catch (e) {}
    try { jabatan = sessionStorage.getItem('kito-kpi-jabatan'); } catch (e) {}
    const tab = document.querySelector('#nav button.on');
    return { area, kode, cabang, jabatan, page: tab?.dataset.v || tab?.textContent.trim() || null };
  };

  let mulai = false;
  const kirim = (e) => {
    if (!navigator.onLine) return;
    const isi = JSON.stringify({ d: perangkat, s: sesi, e, app, scr: screen.width + 'x' + screen.height, lang: navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone, ...konteks() });
    // text/plain = "simple request": tidak perlu preflight CORS, dan sendBeacon tetap jalan saat tab ditutup
    if (e === 'end' && navigator.sendBeacon) { navigator.sendBeacon(URL_PING, new Blob([isi], { type: 'text/plain' })); return; }
    fetch(URL_PING, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: isi, keepalive: true, credentials: 'omit' }).catch(() => {});
  };

  let timer = null;
  const jalan = () => {
    clearInterval(timer);
    kirim(mulai ? 'ping' : 'start'); mulai = true;
    timer = setInterval(() => { if (document.visibilityState === 'visible') kirim('ping'); }, JEDA);
  };
  const berhenti = () => { clearInterval(timer); timer = null; if (mulai) kirim('end'); };

  document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? jalan() : berhenti()));
  addEventListener('pagehide', berhenti);
  addEventListener('online', () => { if (document.visibilityState === 'visible') jalan(); });

  // pindah tab/area/cabang: kabari server (dibatasi agar tidak berlebihan)
  let tunda = null;
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('#nav button, select, [data-v]')) return;
    clearTimeout(tunda); tunda = setTimeout(() => kirim('ping'), 1500);
  });
  document.addEventListener('change', () => { clearTimeout(tunda); tunda = setTimeout(() => kirim('ping'), 1500); });

  const awal = () => { if (document.visibilityState === 'visible') jalan(); };
  document.readyState === 'complete' ? setTimeout(awal, 1500) : addEventListener('load', () => setTimeout(awal, 1500));
})();
