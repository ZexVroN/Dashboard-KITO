/* Penghubung data KITO: memuat SEMUA data dashboard dari satu file JSON (data/kito.json) sebelum skrip lain berjalan.
   Tiap kunci di JSON menjadi variabel global (D, KITO_REGION, KITO_AREA_WAKTU, KITO_KPI, ...), sama seperti dulu
   saat data dipecah di assets/js/*-data.js. Isi JSON dibuat/diperbarui oleh tools (lihat tools/kito_data.py).
   Dimuat sinkron agar urutan skrip tetap; "Cache-Control: no-cache" membuat browser selalu memeriksa versi terbaru.
   Permintaan sinkron tidak melewati service worker, jadi salinan terakhir yang berhasil dimuat disimpan di
   localStorage ('kito-data') dan dipakai saat offline / server tidak bisa dihubungi. */
(function () {
  'use strict';
  var URL_DATA = 'data/kito.json', SIMPAN = 'kito-data', TANDA = 'kito-data-tanda';
  var teks = null, tanda = '';
  try {
    var x = new XMLHttpRequest();
    x.open('GET', URL_DATA, false);
    x.setRequestHeader('Cache-Control', 'no-cache');
    x.send(null);
    if (x.status >= 200 && x.status < 300 && x.responseText) {
      teks = x.responseText;
      tanda = (x.getResponseHeader('ETag') || x.getResponseHeader('Last-Modified') || '') + '|' + teks.length;
    }
  } catch (e) { teks = null; }

  var isi = null;
  if (teks) {
    try { isi = JSON.parse(teks); } catch (e) { isi = null; }
    if (isi) {
      // simpan salinan untuk offline (hanya bila berubah)
      try { if (localStorage.getItem(TANDA) !== tanda) { localStorage.setItem(SIMPAN, teks); localStorage.setItem(TANDA, tanda); } } catch (e) {}
    }
  }
  if (!isi) {
    try { var lama = localStorage.getItem(SIMPAN); if (lama) { isi = JSON.parse(lama); window.KITO_DATA_OFFLINE = true; } } catch (e) { isi = null; }
  }
  if (!isi || typeof isi !== 'object') {
    window.KITO_DATA_GAGAL = true;
    document.addEventListener('DOMContentLoaded', function () {
      var p = document.createElement('div');
      p.setAttribute('role', 'alert');
      p.style.cssText = 'position:fixed;left:16px;right:16px;top:16px;z-index:99999;padding:14px 16px;border-radius:12px;background:#b42318;color:#fff;font:600 14px/1.45 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)';
      p.textContent = 'Data dashboard gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.';
      document.body.appendChild(p);
    });
    return;
  }
  Object.keys(isi).forEach(function (k) { window[k] = isi[k]; });
})();
