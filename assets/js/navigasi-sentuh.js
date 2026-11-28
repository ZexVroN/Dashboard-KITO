/* Navigasi sentuh (geser kiri/kanan pindah halaman, geser kanan di subhalaman = kembali)
   dan pintasan kembali ke atas. Pasangannya: assets/css/navigasi-sentuh.css */
(() => {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  if (!app || !nav) return;

  const html = document.documentElement;
  const mobile = window.matchMedia('(max-width: 768px)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ===== 1. Tombol kembali ke atas ===== */
  const atas = document.createElement('button');
  atas.type = 'button';
  atas.className = 'scroll-atas';
  atas.setAttribute('aria-label', 'Kembali ke atas');
  atas.title = 'Kembali ke atas';
  atas.textContent = '↑';
  document.body.appendChild(atas);

  // tombol Masukan ikut sembunyi saat menggulir turun, sama seperti navigasi bawah (animasi.js memberi #nav kelas "nav-sembunyi")
  const ikutNav = window.matchMedia('(max-width: 720px) and (prefers-reduced-motion: no-preference)');
  const navTurun = () => ikutNav.matches && nav.classList.contains('nav-sembunyi');

  // jaga agar tidak menabrak tombol Masukan (.kmk-fab): jika tombol itu tampil, naik di atasnya;
  // jika tombol itu sedang sembunyi (gulir turun), turun menempati posisinya
  const JARAK = 12;
  const posisi = () => {
    const fab = document.querySelector('.kmk-fab');
    let bawah = null;
    if (fab && !fab.hidden && getComputedStyle(fab).display !== 'none') {
      const dasar = parseFloat(getComputedStyle(fab).bottom) || 0;
      bawah = navTurun() ? dasar : dasar + fab.offsetHeight + JARAK;
    }
    atas.style.bottom = bawah ? Math.round(bawah) + 'px' : '';
  };
  const ikuti = () => {
    html.classList.toggle('nav-turun', navTurun());
    posisi();
  };
  new MutationObserver(ikuti).observe(nav, { attributes: true, attributeFilter: ['class'] });
  ikutNav.addEventListener('change', ikuti);
  const perbarui = () => {
    const tampil = mobile.matches && window.scrollY >= 400;
    atas.classList.toggle('tampil', tampil);
    atas.tabIndex = tampil ? 0 : -1;
    atas.setAttribute('aria-hidden', String(!tampil));
    if (tampil) posisi();
  };
  window.addEventListener('scroll', perbarui, { passive: true });
  window.addEventListener('resize', perbarui, { passive: true });
  // tombol Masukan dibuat oleh masukan.js dan bisa disembunyikan/ditampilkan kapan saja
  new MutationObserver(posisi).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'], childList: true });
  ikuti();
  perbarui();
  atas.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' }));

  /* ===== 2. Geser untuk pindah / kembali halaman ===== */
  const AMBANG = 80;        // jarak minimum (px) agar pindah halaman
  const AMBANG_CEPAT = 40;  // jarak minimum bila digeser cepat
  const KECEPATAN = 0.5;    // px/ms
  const KELILING = 2 * Math.PI * 21; // keliling cincin progres (r = 21)

  // cahaya lembut di tepi layar
  const tepi = document.createElement('div');
  tepi.className = 'geser-tepi';
  tepi.setAttribute('aria-hidden', 'true');
  // indikator: bulatan dengan cincin progres + panah, dan label halaman tujuan
  const ind = document.createElement('div');
  ind.className = 'geser-ind';
  ind.setAttribute('aria-hidden', 'true');
  ind.innerHTML =
    '<span class="geser-bul">' +
      '<svg class="geser-ring" viewBox="0 0 48 48" width="48" height="48"><circle class="geser-jalur" cx="24" cy="24" r="21"/>' +
      '<circle class="geser-cincin" cx="24" cy="24" r="21" stroke-dasharray="' + KELILING.toFixed(2) + '"/></svg>' +
      '<svg class="geser-panah" viewBox="0 0 24 24" width="22" height="22"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '</span>' +
    '<span class="geser-lbl"><span class="geser-lbl-ik"></span><span class="geser-lbl-tx"><b></b><small></small></span></span>';
  document.body.append(tepi, ind);
  const cincin = ind.querySelector('.geser-cincin');
  const lblIk = ind.querySelector('.geser-lbl-ik');
  const lblNama = ind.querySelector('.geser-lbl-tx b');
  const lblInfo = ind.querySelector('.geser-lbl-tx small');

  const tombolTab = () => Array.from(nav.querySelectorAll('button[data-v]'));
  const namaTombol = (b) => (b.querySelector('span:last-child') || b).textContent.trim();
  const ikonTombol = (b) => (b.querySelector('.ik') || {}).textContent || '';

  // tujuan untuk arah geser: dx < 0 = halaman berikutnya, dx > 0 = sebelumnya / kembali
  function cariTujuan(arahKiri) {
    const kembali = app.querySelector('.sl-back, .dt-back');
    if (kembali) {
      if (arahKiri) return null;
      const tab = nav.querySelector('button[data-v="' + kembali.dataset.v + '"]');
      return { el: kembali, nama: 'Kembali', info: 'ke ' + (tab ? namaTombol(tab) : 'halaman sebelumnya'), ikon: '↩', tab };
    }
    const t = tombolTab();
    const aktif = t.findIndex((b) => b.classList.contains('on'));
    const el = aktif >= 0 ? t[aktif + (arahKiri ? 1 : -1)] : null;
    return el ? { el, nama: namaTombol(el), info: '', ikon: ikonTombol(el), tab: el } : null;
  }

  let g = null; // keadaan geser yang sedang berjalan
  let sibuk = false;
  let tabSorot = null;

  function sorotTab(tab) {
    if (tabSorot === tab) return;
    if (tabSorot) tabSorot.classList.remove('geser-tuju');
    tabSorot = tab || null;
    if (tabSorot) tabSorot.classList.add('geser-tuju');
  }

  function bersihkan() {
    app.style.transition = app.style.transform = app.style.opacity = app.style.transformOrigin = '';
    html.classList.remove('geser-jalan');
    ind.className = 'geser-ind';
    tepi.className = 'geser-tepi';
    sorotTab(null);
  }

  function tampilkanInd(dx, y, tujuan) {
    const kiri = dx < 0;
    const p = Math.min(Math.abs(dx) / AMBANG, 1);
    const siap = p >= 1 && !!tujuan;
    const kelas = ' aktif ' + (kiri ? 'kanan' : 'kiri') + (siap ? ' siap' : '') + (tujuan ? '' : ' buntu');
    ind.className = 'geser-ind' + kelas;
    tepi.className = 'geser-tepi' + kelas;
    ind.style.setProperty('--p', p.toFixed(3));
    tepi.style.setProperty('--p', p.toFixed(3));
    // indikator mengikuti tinggi jari, tetap di dalam layar
    const top = Math.min(Math.max(y, 110), window.innerHeight - 150);
    ind.style.top = top + 'px';
    tepi.style.setProperty('--y', top + 'px');
    cincin.style.strokeDashoffset = (KELILING * (1 - (tujuan ? p : p * 0.35))).toFixed(2);
    if (tujuan) {
      lblIk.textContent = tujuan.ikon;
      lblNama.textContent = tujuan.nama;
      lblInfo.textContent = siap ? 'Lepas untuk membuka' : (tujuan.info || 'Geser terus');
    } else {
      lblIk.textContent = '⦸';
      lblNama.textContent = kiri ? 'Halaman terakhir' : 'Halaman pertama';
      lblInfo.textContent = '';
    }
    sorotTab(siap ? tujuan.tab : null);
  }

  app.addEventListener('touchstart', (event) => {
    g = null;
    if (sibuk || !mobile.matches || event.touches.length !== 1) return;
    if (event.target.closest('input, select, textarea, [contenteditable], [role="dialog"], .kmk-notif, #pgn-notif, .kito-pctl-top')) return;
    for (let el = event.target; el && el !== app; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return;
    }
    const s = event.touches[0];
    g = { x: s.clientX, y: s.clientY, t: performance.now(), dx: 0, mode: null, tujuan: null, siap: false };
  }, { passive: true });

  app.addEventListener('touchmove', (event) => {
    if (!g || g.mode === 'batal') return;
    const s = event.touches[0];
    const dx = s.clientX - g.x, dy = s.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) { g.mode = 'batal'; return; }
      g.mode = 'geser';
      html.classList.add('geser-jalan');
    }
    if (event.cancelable) event.preventDefault(); // kunci gulir vertikal selama geser horizontal
    g.dx = dx;
    g.tujuan = cariTujuan(dx < 0);
    const siap = Math.abs(dx) >= AMBANG && !!g.tujuan;
    if (siap && !g.siap && navigator.vibrate) navigator.vibrate(8);
    g.siap = siap;
    if (!reduce.matches) {
      // dengan tujuan: halaman ikut jari, sedikit mengecil dan memudar; tanpa tujuan: hambatan kuat (efek mentok)
      const p = Math.min(Math.abs(dx) / (window.innerWidth * 0.8), 1);
      const geser = g.tujuan ? dx * 0.5 : Math.sign(dx) * Math.min(Math.abs(dx) * 0.16, 30);
      app.style.transition = 'none';
      app.style.transformOrigin = (dx < 0 ? '0%' : '100%') + ' ' + Math.round(window.scrollY + s.clientY) + 'px';
      app.style.transform = 'translate3d(' + geser + 'px,0,0) scale(' + (g.tujuan ? 1 - p * 0.05 : 1) + ')';
      app.style.opacity = g.tujuan ? String(1 - p * 0.35) : '';
    }
    tampilkanInd(dx, s.clientY, g.tujuan);
  }, { passive: false });

  function selesaiGeser() {
    if (!g || g.mode !== 'geser') { g = null; return; }
    const { dx, tujuan } = g;
    const v = Math.abs(dx) / Math.max(performance.now() - g.t, 1);
    g = null;
    const pindah = tujuan && (Math.abs(dx) >= AMBANG || (Math.abs(dx) >= AMBANG_CEPAT && v >= KECEPATAN));

    if (!pindah) {
      // pegas kembali ke posisi semula
      ind.classList.remove('aktif', 'siap');
      tepi.classList.remove('aktif', 'siap');
      sorotTab(null);
      if (reduce.matches) { bersihkan(); return; }
      app.style.transition = 'transform .4s cubic-bezier(.2,.9,.3,1.2), opacity .3s ease';
      app.style.transform = 'translate3d(0,0,0) scale(1)';
      app.style.opacity = '1';
      setTimeout(bersihkan, 420);
      return;
    }

    sibuk = true;
    ind.classList.add('siap', 'lepas');
    tepi.classList.add('siap', 'lepas');
    const kiri = dx < 0;
    const buka = () => {
      bersihkan();
      tujuan.el.click(); // render() + animasi.js memutar animasi kartu halaman baru
      if (reduce.matches) { sibuk = false; return; }
      // halaman baru masuk dari sisi berlawanan
      app.style.transition = 'none';
      app.style.transform = 'translate3d(' + (kiri ? 56 : -56) + 'px,0,0)';
      app.style.opacity = '0';
      void app.offsetWidth;
      app.style.transition = 'transform .45s cubic-bezier(.22,1,.36,1), opacity .35s ease-out';
      app.style.transform = 'translate3d(0,0,0)';
      app.style.opacity = '1';
      setTimeout(() => { bersihkan(); sibuk = false; }, 460);
    };
    if (reduce.matches) { buka(); return; }
    app.style.transition = 'transform .22s cubic-bezier(.4,0,1,1), opacity .22s ease-in';
    app.style.transform = 'translate3d(' + (kiri ? -40 : 40) + '%,0,0) scale(.94)';
    app.style.opacity = '0';
    setTimeout(buka, 220);
  }

  app.addEventListener('touchend', selesaiGeser, { passive: true });
  app.addEventListener('touchcancel', () => { if (g) g.dx = 0; selesaiGeser(); }, { passive: true });
})();
