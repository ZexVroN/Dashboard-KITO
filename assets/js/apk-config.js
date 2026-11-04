/* Info aplikasi Android KITO yang bisa diunduh (dipakai assets/js/unduh-apk.js dan download/index.html).
   Saat ada APK baru: ganti file download/Dashboard-Kito.apk, lalu perbarui versi, kode, ukuran, dan tanggal di sini.
   Notifikasi unduh muncul lagi untuk semua pengguna Android bila "kode" berubah. */
window.KITO_APK = {
  versi: '1.0',
  kode: 1,                                  // versionCode APK
  paket: 'com.zexvron.dashboardkito',
  file: 'download/Dashboard-Kito.apk',      // relatif terhadap akar website
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
    kodeTerpasang: aplikasi ? Number((ua.match(/KITO-Android\/(\d+)/) || [])[1] || 1) : null,   // APK 1.0 tanpa penanda = 1
  };
};
