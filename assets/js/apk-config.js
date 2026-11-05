/* Info aplikasi Android KITO yang bisa diunduh (dipakai assets/js/unduh-apk.js dan download/index.html).
   Saat ada APK baru: ganti file download/Dashboard-Kito.apk, lalu perbarui versi, kode, ukuran, dan tanggal di sini.
   Notifikasi unduh muncul lagi untuk semua pengguna Android bila "kode" berubah. */
window.KITO_APK = {
  versi: '1.1',
  kode: 2,                                  // versionCode APK
  paket: 'com.zexvron.dashboardkito',
  file: 'download/Dashboard-Kitov1.1.apk', // relatif terhadap akar website
  ukuran: '6,0 MB',
  tanggal: '2026-11-04',
};

/* Deteksi perangkat untuk fitur unduh APK (dipakai unduh-apk.js dan download/index.html).
   chromeAndroid = Google Chrome di HP/tablet Android (bukan WebView aplikasi, Samsung Internet, Firefox, Opera, Edge,
   browser bawaan Xiaomi/Oppo/Vivo, atau browser di dalam aplikasi lain seperti WhatsApp/Instagram/Facebook). */
window.KITO_PERANGKAT = function () {
  var ua = navigator.userAgent || '';
  var android = /Android/i.test(ua);
  var aplikasi = /; wv\)|KITO-Android/i.test(ua);
  var brands = (navigator.userAgentData && navigator.userAgentData.brands) || null;
  var chrome = brands
    ? brands.some(function (b) { return b.brand === 'Google Chrome'; })
    : /Chrome\/\d+/.test(ua) && !/Version\/\d|SamsungBrowser|EdgA|EdgiOS|OPR\/|Opera|OPT\/|Firefox|FxiOS|UCBrowser|YaBrowser|MiuiBrowser|XiaoMi|HeyTapBrowser|OppoBrowser|VivoBrowser|HuaweiBrowser|Vivaldi|DuckDuckGo|Puffin|Silk|OculusBrowser|FBAN|FBAV|Instagram|Line\/|WhatsApp|KAKAOTALK|Snapchat|GSA\//i.test(ua);
  return {
    android: android,
    aplikasi: android && aplikasi,
    chromeAndroid: android && !aplikasi && chrome,
    // APK 1.0 hanya memakai WebViewClient polos (tanpa DownloadListener): tautan unduhan diabaikan diam-diam.
    // APK berikutnya menambahkan "KITO-Android/<versionCode>" di user agent dan menangani unduhan sendiri.
    bisaUnduh: !(android && aplikasi) || /KITO-Android\//i.test(ua),
    kodeTerpasang: aplikasi ? Number((ua.match(/KITO-Android\/(\d+)/) || [])[1] || 1) : null,   // APK 1.0 tanpa penanda = 1
  };
};

/* Panduan "Unduh lewat Chrome" untuk aplikasi KITO yang belum bisa mengunduh file (APK 1.0).
   Menyalin alamat halaman unduh, lalu menampilkan langkah singkat. Dipakai unduh-apk.js dan pindah.html. */
window.KITO_APK_LEWAT_CHROME = function () {
  var alamat = 'https://inbranch.region2.co.id/download/';
  var pendek = alamat.replace(/^https:\/\//, '');
  function salin() {
    var ok = false;
    try {
      var t = document.createElement('textarea');
      t.value = alamat; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(t); t.select(); t.setSelectionRange(0, alamat.length);
      ok = document.execCommand('copy'); t.remove();
    } catch (e) {}
    try { if (navigator.clipboard) navigator.clipboard.writeText(alamat).then(function () {}, function () {}); } catch (e) {}
    return ok;
  }
  if (!document.getElementById('kapk-gaya')) {
    var g = document.createElement('style'); g.id = 'kapk-gaya';
    g.textContent =
      '.kapk-latar{position:fixed;inset:0;z-index:2000;display:flex;align-items:flex-end;justify-content:center;background:rgba(6,16,40,.55);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
      '.kapk{width:100%;max-width:440px;background:#fff;color:#14213d;border-radius:22px 22px 0 0;padding:22px 20px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(0,0,0,.25);text-align:left}' +
      '@media(min-width:560px){.kapk-latar{align-items:center}.kapk{border-radius:22px}}' +
      '.kapk h2{margin:0 0 6px;font-size:19px;font-weight:800;line-height:1.3}' +
      '.kapk p{margin:0 0 14px;font-size:13.5px;line-height:1.5;color:#45577a}' +
      '.kapk-al{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;border:1.5px solid #b9d0f5;border-radius:12px;background:#f3f7ff;margin-bottom:6px}' +
      '.kapk-al code{flex:1;min-width:0;font:700 12.5px ui-monospace,Menlo,Consolas,monospace;color:#002060;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.kapk-al button{flex:none;border:0;border-radius:9px;background:#002060;color:#fff;font-size:13px;font-weight:700;padding:8px 12px;cursor:pointer;font-family:inherit}' +
      '.kapk-st{min-height:18px;margin:0 0 12px;font-size:12.5px;font-weight:700;color:#1a8f50}' +
      '.kapk ol{margin:0 0 16px;padding-left:20px;font-size:13.5px;line-height:1.5;color:#2f3f5f}.kapk li+li{margin-top:6px}' +
      '.kapk-ok{display:block;width:100%;border:0;border-radius:999px;background:linear-gradient(90deg,#002060,#0057ae);color:#fff;font-size:15px;font-weight:800;padding:13px;cursor:pointer;font-family:inherit}';
    document.head.appendChild(g);
  }
  var lama = document.getElementById('kapk'); if (lama) lama.remove();
  var ok = salin();
  var w = document.createElement('div');
  w.className = 'kapk-latar'; w.id = 'kapk';
  w.innerHTML =
    '<div class="kapk" role="dialog" aria-modal="true" aria-labelledby="kapk-j">' +
      '<h2 id="kapk-j">Unduh APK lewat Chrome</h2>' +
      '<p>Aplikasi KITO versi lama belum bisa mengunduh file. Buka alamat ini di <b>Google Chrome</b>, unduhan langsung tersedia:</p>' +
      '<div class="kapk-al"><code>' + pendek + '</code><button type="button" data-kapk-salin>Salin</button></div>' +
      '<div class="kapk-st" aria-live="polite">' + (ok ? '✓ Alamat sudah disalin' : '') + '</div>' +
      '<ol><li>Buka <b>Chrome</b>, ketuk kolom alamat, lalu <b>tempel</b> (atau ketik alamat di atas).</li>' +
      '<li>Ketuk <b>Unduh APK</b>, lalu buka file <b>Dashboard-Kito.apk</b> yang terunduh.</li>' +
      '<li>Ketuk <b>Update/Pasang</b>. Data login tetap aman.</li></ol>' +
      '<button type="button" class="kapk-ok" data-kapk-tutup>Mengerti</button>' +
    '</div>';
  document.body.appendChild(w);
  w.addEventListener('click', function (e) {
    if (e.target === w || e.target.closest('[data-kapk-tutup]')) { w.remove(); return; }
    if (e.target.closest('[data-kapk-salin]')) w.querySelector('.kapk-st').textContent = salin() ? '✓ Alamat sudah disalin' : 'Tekan lama alamat di atas untuk menyalin';
  });
  return ok;
};
