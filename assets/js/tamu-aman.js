/* Perlindungan halaman untuk pengguna TANPA LOGIN (tamu). Pasangannya: assets/css/tamu-aman.css
   - Tombol "⬇ CSV" dan "🖨 Cetak / Simpan PDF" disembunyikan, kliknya diblokir, dan Ctrl/Cmd+P serta cetak dari menu
     browser hanya menghasilkan halaman kosong berisi pemberitahuan.
   - Screenshot:
     · Aplikasi Android KITO: diblokir sungguhan (FLAG_SECURE lewat KitoAndroid.setSecure; APK sudah aman secara bawaan).
     · Browser (HP & komputer): halaman web TIDAK bisa memblokir tombol screenshot milik sistem operasi. Yang dilakukan:
       konten ditutup saat tombol PrintScreen ditekan, saat jendela kehilangan fokus (mis. Snipping Tool / Win+Shift+S)
       atau tab disembunyikan; papan klip dikosongkan setelah PrintScreen; klik kanan, seleksi teks, dan drag dimatikan.
   Setelah login semua pembatasan dilepas. Status akun dibaca dari KITO_AKUN (kpi-login.js), event 'kito-akun'. */
(() => {
  'use strict';
  const html = document.documentElement;
  const tamu = () => { try { return !(window.KITO_AKUN && window.KITO_AKUN.kini()); } catch (e) { return true; } };

  // tirai penutup konten
  const tirai = document.createElement('div');
  tirai.className = 'tamu-tirai';
  tirai.setAttribute('aria-hidden', 'true');
  tirai.innerHTML = '<div><b>🔒 Konten dilindungi</b><span>Login untuk menyimpan, mencetak, atau mengambil gambar halaman ini.</span></div>';
  document.body.appendChild(tirai);
  // watermark: screenshot yang tetap lolos (mis. difoto dengan HP lain) tetap bertanda sumber & waktunya
  const tanda = document.createElement('div');
  tanda.className = 'tamu-tanda';
  tanda.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tanda);
  function gambarTanda() {
    const w = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const teks = `KITO · Tamu (tanpa login) · ${w} WIB`.replace(/[&<>]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200"><text x="180" y="100" text-anchor="middle" transform="rotate(-24 180 100)" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#64748b">${teks}</text></svg>`;
    tanda.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }
  gambarTanda();
  setInterval(() => { if (html.classList.contains('tamu')) gambarTanda(); }, 60000);
  let tmrTirai = 0;
  const tutup = (ms) => {
    if (!html.classList.contains('tamu')) return;
    html.classList.add('tamu-tutup');
    clearTimeout(tmrTirai);
    if (ms) tmrTirai = setTimeout(buka, ms);
  };
  const buka = () => { clearTimeout(tmrTirai); html.classList.remove('tamu-tutup'); };

  function terapkan() {
    const t = tamu();
    html.classList.toggle('tamu', t);
    if (!t) buka();
    try { window.KitoAndroid && typeof window.KitoAndroid.setSecure === 'function' && window.KitoAndroid.setSecure(t); } catch (e) {}
  }

  const BLOKIR = '#cetak, .cetak, .unduh, [data-ex], [data-rg-csv], [data-rg-pcsv], [data-rx-csv], [data-nb-csv]';
  // fase capture: berjalan sebelum handler ekspor/cetak bawaan
  document.addEventListener('click', (e) => {
    if (!html.classList.contains('tamu') || !e.target.closest || !e.target.closest(BLOKIR)) return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!html.classList.contains('tamu')) return;
    const k = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 's')) { e.preventDefault(); e.stopImmediatePropagation(); return; }   // cetak / simpan halaman
    if (k === 'printscreen') { tutup(1500); kosongkanPapanKlip(); }
    // Win+Shift+S (Windows) / Cmd+Shift+3/4/5 (macOS): sistem membekukan layar begitu kombinasi lengkap, jadi konten
    // ditutup SAAT tombol Win/Cmd mulai ditekan (sebelum Shift+S menyusul) dan baru dibuka lagi setelah tombolnya dilepas.
    if (k === 'meta' || k === 'os' || e.metaKey) { tutup(); menahanMeta = true; }
  }, true);
  let menahanMeta = false;
  document.addEventListener('keyup', (e) => {
    if (!html.classList.contains('tamu')) return;
    const k = (e.key || '').toLowerCase();
    if (k === 'printscreen') { tutup(1500); kosongkanPapanKlip(); }
    if (k === 'meta' || k === 'os') {
      menahanMeta = false;
      // alat tangkap layar mengambil fokus (blur) -> tetap tertutup sampai jendela aktif lagi
      setTimeout(() => { if (!menahanMeta && document.hasFocus() && !document.hidden) buka(); }, 450);
    }
  }, true);
  function kosongkanPapanKlip() {
    try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText('').catch(() => {}); } catch (e) {}
  }

  // jendela kehilangan fokus / tab disembunyikan: tutup konten sampai kembali
  window.addEventListener('blur', () => tutup());
  window.addEventListener('focus', () => { if (!menahanMeta) buka(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) tutup(); else buka(); });

  // klik kanan, drag, salin
  ['contextmenu', 'dragstart', 'copy', 'cut'].forEach((ev) => document.addEventListener(ev, (e) => {
    if (!html.classList.contains('tamu')) return;
    if (ev !== 'contextmenu' || !e.target.closest('input, textarea, [contenteditable]')) e.preventDefault();
  }, true));

  // cetak lewat menu browser: isi halaman disembunyikan oleh CSS @media print (html.tamu)
  window.addEventListener('beforeprint', () => { if (html.classList.contains('tamu')) html.classList.add('tamu-cetak'); });
  window.addEventListener('afterprint', () => html.classList.remove('tamu-cetak'));

  window.addEventListener('kito-akun', terapkan);
  window.addEventListener('pageshow', terapkan);
  terapkan();
  // sesi login dipulihkan dari sessionStorage tanpa event: periksa lagi setelah semua skrip dimuat
  if (document.readyState === 'complete') setTimeout(terapkan, 0); else window.addEventListener('load', terapkan);
})();
