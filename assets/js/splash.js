/* Splash KITO dengan animasi loading (perkiraan ± 6 detik), hanya saat dibuka di browser.
   - Bilah progres 0 → 100% dalam ±6 detik, persentase, tahapan muat, dan sisa waktu.
   - Splash ditutup setelah progres 100% DAN dashboard sudah tergambar.
     Jika dashboard belum siap tepat 6 detik, progres ditahan di 95% sampai siap (paling lama 12 detik).
   - Setelah tertutup, <html> diberi kelas "kito-siap" (dipakai animasi.css untuk memunculkan navigasi). */
(function () {
  'use strict';
  var DURASI = 6000;       // perkiraan waktu loading (ms)
  var BATAS = 12000;       // batas aman: splash tetap ditutup walau dashboard belum siap
  var root = document.documentElement;
  var splash = document.getElementById('kito-splash');
  if (!splash) { root.classList.add('kito-siap'); return; }

  // Alamat lama (GitHub Pages): splash tetap tampil sebagai pemberitahuan pindah alamat
  var ALAMAT_BARU = 'https://inbranch.region2.co.id/';
  var DETIK_ALIH = 10;     // hitung mundur sebelum dialihkan otomatis
  var jalur = location.pathname.replace(/\/+$/, '/');
  if (location.hostname === 'zexvron.github.io' && (jalur === '/' || /^\/Dashboard-KITO(\/|$)/i.test(jalur))) {
    root.classList.add('kito-pindah');
    splash.setAttribute('aria-label', 'Dashboard KITO telah pindah alamat');
    splash.setAttribute('role', 'alertdialog');
    var info = document.createElement('div');
    info.className = 'kito-update';
    info.innerHTML =
      '<span class="kito-update-lencana">UPDATE</span>' +
      '<h2 class="kito-update-judul">Dashboard KITO telah pindah alamat</h2>' +
      '<p class="kito-update-teks">Mulai sekarang dashboard diakses melalui alamat baru. Alamat ini tidak diperbarui lagi.</p>' +
      '<a class="kito-update-url" href="' + ALAMAT_BARU + '">inbranch.region2.co.id</a>' +
      '<a class="kito-update-btn" href="' + ALAMAT_BARU + '">Buka Dashboard Baru →</a>' +
      '<small class="kito-update-eta">Dialihkan otomatis dalam <b>' + DETIK_ALIH + '</b> detik</small>';
    splash.appendChild(info);
    var elDetik = info.querySelector('.kito-update-eta b');
    var sisaAlih = DETIK_ALIH;
    var hitung = setInterval(function () {
      sisaAlih--;
      if (sisaAlih <= 0) { clearInterval(hitung); location.replace(ALAMAT_BARU); return; }
      elDetik.textContent = sisaAlih;
    }, 1000);
    info.querySelector('.kito-update-btn').focus();
    return;
  }

  // mode aplikasi (PWA): lewati splash, sistem sudah menampilkan layar pembuka sendiri
  if (root.classList.contains('pwa')) {
    if (splash.parentNode) splash.parentNode.removeChild(splash);
    root.classList.add('kito-siap');
    return;
  }

  var TAHAP = [
    [0, 'Menyiapkan dashboard…'],
    [20, 'Memuat data waktu antri…'],
    [45, 'Memuat utilisasi NBDS…'],
    [65, 'Memuat O2O & Shifting Digital…'],
    [82, 'Menyusun ranking region & cabang…'],
    [97, 'Hampir selesai…'],
  ];

  // elemen loading disisipkan lewat JS supaya index.html tidak perlu diubah
  var box = document.createElement('div');
  box.className = 'kito-load';
  box.setAttribute('role', 'progressbar');
  box.setAttribute('aria-valuemin', '0');
  box.setAttribute('aria-valuemax', '100');
  box.setAttribute('aria-label', 'Memuat dashboard');
  box.innerHTML =
    '<div class="kito-load-top"><span class="kito-load-txt">' + TAHAP[0][1] + '</span><b class="kito-load-pct">0%</b></div>' +
    '<div class="kito-load-bar"><i></i></div>' +
    '<small class="kito-load-eta">Perkiraan ± 6 detik</small>';
  splash.appendChild(box);
  var elTxt = box.querySelector('.kito-load-txt'),
    elPct = box.querySelector('.kito-load-pct'),
    elBar = box.querySelector('.kito-load-bar i'),
    elEta = box.querySelector('.kito-load-eta');

  var mulai = Date.now(), siap = false, selesai = false, tampil = -1;

  function dashboardSiap() {
    var app = document.getElementById('app');
    if (!app) return false;
    var t = (app.textContent || '').trim();
    return !!t && t !== 'Memuat dashboard…' && t !== 'Memuat dashboard...';
  }

  // kurva halus: cepat di awal, melambat di akhir (ease-out)
  function progres(ms) {
    var x = Math.min(1, ms / DURASI);
    return 1 - Math.pow(1 - x, 2.2);
  }

  function tulis(p) {
    var n = Math.floor(p * 100);
    if (n === tampil) return;
    tampil = n;
    elBar.style.width = n + '%';
    elPct.textContent = n + '%';
    box.setAttribute('aria-valuenow', String(n));
    for (var i = TAHAP.length - 1; i >= 0; i--) {
      if (n >= TAHAP[i][0]) { elTxt.textContent = TAHAP[i][1]; break; }
    }
    var sisa = Math.max(0, Math.ceil((DURASI - (Date.now() - mulai)) / 1000));
    elEta.textContent = n >= 100 ? 'Siap' : sisa > 0 ? 'Perkiraan sisa ± ' + sisa + ' detik' : 'Menyelesaikan…';
  }

  function tutup() {
    if (selesai) return;
    selesai = true;
    tulis(1);
    setTimeout(function () {
      splash.classList.add('is-hidden');
      root.classList.add('kito-siap');
      setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 600);
    }, 250);
  }

  function langkah() {
    if (selesai) return;
    var ms = Date.now() - mulai;
    if (!siap) siap = dashboardSiap();
    var p = progres(ms);
    if (!siap) p = Math.min(p, 0.95);       // tahan di 95% sampai dashboard tergambar
    if (ms >= DURASI && siap) return tutup();
    if (ms >= BATAS) return tutup();
    tulis(p);
    requestAnimationFrame(langkah);
  }
  tulis(0);
  requestAnimationFrame(langkah);
  // cadangan bila requestAnimationFrame dihentikan (tab di latar belakang)
  setTimeout(function () { siap = siap || dashboardSiap(); if (siap) tutup(); }, DURASI + 200);
  setTimeout(tutup, BATAS);
})();
