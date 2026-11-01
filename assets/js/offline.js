/* Dukungan offline & background sync di halaman dashboard (pasangan sw.js).
   - Mendaftarkan service worker (juga bila notifikasi belum dikonfigurasi), dengan URL yang sama seperti push.js.
   - Penanda "Offline" saat koneksi putus; dashboard tetap tampil dengan data terakhir yang tersimpan.
   - Periodic Background Sync 'kito-segarkan' (Chrome Android, aplikasi terpasang): data diperbarui di latar belakang.
   - Saat online kembali: antrean pengaturan notifikasi dikirim (cadangan bila Background Sync tidak didukung). */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  const api = (window.KITO_PUSH?.api || '').replace(/\/+$/, '');
  const swUrl = 'sw.js' + (api ? '?api=' + encodeURIComponent(api) : '');

  // penanda offline
  const pill = document.createElement('div');
  pill.id = 'kito-offline';
  pill.setAttribute('role', 'status');
  pill.style.cssText = 'position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9998;background:#1f2937;color:#fff;font:600 12.5px/1.3 Inter,system-ui,sans-serif;padding:8px 14px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.25);display:none;max-width:calc(100% - 32px);text-align:center';
  const tampil = (teks, ms) => {
    pill.textContent = teks; pill.style.display = 'block';
    clearTimeout(tampil.t); if (ms) tampil.t = setTimeout(() => { if (navigator.onLine) pill.style.display = 'none'; }, ms);
  };
  const cekStatus = () => {
    if (!document.body.contains(pill)) document.body.appendChild(pill);
    if (!navigator.onLine) tampil('⚡ Offline · menampilkan data terakhir yang tersimpan');
    else pill.style.display = 'none';
  };
  window.addEventListener('offline', cekStatus);
  window.addEventListener('online', () => {
    tampil('✓ Kembali online', 2500);
    navigator.serviceWorker.controller?.postMessage({ type: 'kito-kirim-antrean' });
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'kito-antrean-terkirim' && e.data.jumlah) tampil(`✓ ${e.data.jumlah} perubahan notifikasi terkirim`, 3500);
  });

  window.addEventListener('load', async () => {
    cekStatus();
    try {
      const reg = await navigator.serviceWorker.register(swUrl, { scope: './' });
      // Periodic Background Sync: tersedia untuk aplikasi terpasang (PWA/APK TWA) di Chrome Android
      if ('periodicSync' in reg && navigator.permissions) {
        const st = await navigator.permissions.query({ name: 'periodic-background-sync' }).catch(() => null);
        if (st && st.state === 'granted') {
          const tags = await reg.periodicSync.getTags();
          if (!tags.includes('kito-segarkan')) await reg.periodicSync.register('kito-segarkan', { minInterval: 6 * 60 * 60 * 1000 });
        }
      }
    } catch (e) { /* tanpa service worker dashboard tetap berjalan online */ }
  });
})();
