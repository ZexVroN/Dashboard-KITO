/* Animasi KITO: navigasi bawah dan transisi halaman.
   Add-on non-destruktif: membungkus render() seperti modul lain, tidak mengubah file lain.
   Muat PALING AKHIR di index.html (setelah cabang-tren.js) agar membungkus rantai render terluar.
   Pasangannya: assets/css/animasi.css */
(() => {
  'use strict';
  if (typeof render !== 'function' || typeof st === 'undefined' || typeof tampil === 'undefined') return;

  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  if (!app || !nav) return;

  /* ----- Pengaturan ----- */
  const SEMBUNYIKAN_NAV_SAAT_GULIR = true; // false = nav bawah selalu terlihat
  const URUTAN_TAB = ['ranking', 'region', 'area', 'cabang', 'kpi']; // menentukan arah geser antar tab
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const html = document.documentElement;

  /* ----- 1. Kapsul penanda tab aktif ----- */
  const pill = document.createElement('span');
  pill.className = 'nav-pill';
  pill.setAttribute('aria-hidden', 'true');
  nav.prepend(pill);

  function gerakPill() {
    const on = nav.querySelector('button.on');
    if (!on) return;
    nav.style.setProperty('--px', on.offsetLeft + 'px');
    nav.style.setProperty('--pw', on.offsetWidth + 'px');
  }

  /* ----- 2. Transisi halaman ----- */
  const KELAS = ['an-maju', 'an-mundur', 'an-ganti', 'an-lembut'];
  let tmr;

  function selesai() {
    app.classList.remove(...KELAS);
    html.classList.remove('an-jalan');
  }

  function mulai(jenis) {
    clearTimeout(tmr);
    app.classList.remove(...KELAS);
    void app.offsetWidth; // paksa reflow supaya animasi bisa diputar ulang
    if (jenis !== 'lembut') {
      app.querySelectorAll('.cd').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 7)));
      html.classList.add('an-jalan');
    }
    app.classList.add('an-' + jenis);
    tmr = setTimeout(selesai, jenis === 'lembut' ? 320 : 950);
  }

  // keadaan terakhir yang sudah digambar, untuk mengetahui apa yang berubah
  let terakhir = { tab: tampil, b: st.b, a: st.a, d: st.d };
  let paksa = null; // jenis transisi yang diminta oleh klik tertentu
  let siap = false; // false selama render awal saat halaman dimuat

  const sebelumnya = render;
  render = function () {
    sebelumnya();
    // status dibaca SETELAH render, karena modul lain bisa merapikan st.a saat render
    const baru = { tab: tampil, b: st.b, a: st.a, d: st.d };
    gerakPill();

    let jenis = paksa;
    paksa = null;
    if (!jenis) {
      if (baru.tab !== terakhir.tab) {
        jenis = URUTAN_TAB.indexOf(baru.tab) > URUTAN_TAB.indexOf(terakhir.tab) ? 'maju' : 'mundur';
      } else if (baru.b !== terakhir.b || baru.a !== terakhir.a) jenis = 'ganti';
      else if (baru.d !== terakhir.d) jenis = 'lembut';
    }
    terakhir = baru;

    if (jenis && siap && !reduce.matches) mulai(jenis);
    if (jenis === 'maju' || jenis === 'mundur' || jenis === 'ganti') nav.classList.remove('nav-sembunyi');
  };

  // ganti tampilan di tab Area (Waktu Tunggu / Infografis O2O) tidak mengubah st, jadi ditandai lewat klik
  app.addEventListener(
    'click',
    (e) => {
      if (e.target.closest('[data-o2o-sub], [data-rg-level], [data-rg-lingkup], [data-rg-pf]')) paksa = 'ganti';
    },
    true, // fase capture: berjalan sebelum handler modul lain memanggil render()
  );

  /* ----- 3. Nav bawah: sembunyi saat menggulir turun ----- */
  if (SEMBUNYIKAN_NAV_SAAT_GULIR) {
    let y = window.scrollY,
      menunggu = false;
    window.addEventListener(
      'scroll',
      () => {
        if (menunggu) return;
        menunggu = true;
        requestAnimationFrame(() => {
          const n = window.scrollY,
            dy = n - y,
            dasar = window.innerHeight + n >= document.documentElement.scrollHeight - 8;
          if (n < 80 || dasar || dy < -6) nav.classList.remove('nav-sembunyi');
          else if (dy > 8) nav.classList.add('nav-sembunyi');
          if (Math.abs(dy) > 6) y = n;
          menunggu = false;
        });
      },
      { passive: true },
    );
  }

  /* ----- 4. Tombol tema: putar + warna berubah mulus ----- */
  const tombolTema = document.getElementById('tema');
  if (tombolTema) {
    // capture di document: berjalan SEBELUM handler tema mengganti warna, sehingga transisi aktif
    document.addEventListener(
      'click',
      (e) => {
        if (!e.target.closest('#tema') || reduce.matches) return;
        html.classList.add('tema-ganti');
        void html.offsetWidth;
        tombolTema.classList.remove('putar');
        void tombolTema.offsetWidth;
        tombolTema.classList.add('putar');
        setTimeout(() => html.classList.remove('tema-ganti'), 450);
      },
      true,
    );
  }

  /* ----- 5. Awal: posisi kapsul tanpa animasi, lalu aktifkan transisinya ----- */
  gerakPill();
  requestAnimationFrame(() => requestAnimationFrame(() => pill.classList.add('siap')));
  window.addEventListener('resize', gerakPill);
  window.addEventListener('orientationchange', () => setTimeout(gerakPill, 250));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(gerakPill);

  siap = true;

  // masuknya halaman pertama: tunggu splash terbuka agar animasinya terlihat
  const splash = document.getElementById('kito-splash');
  if (splash && !reduce.matches) {
    const mo = new MutationObserver(() => {
      if (splash.classList.contains('is-hidden')) {
        mo.disconnect();
        mulai('ganti');
      }
    });
    mo.observe(splash, { attributes: true, attributeFilter: ['class'] });
  } else if (!reduce.matches) {
    mulai('ganti');
  }
})();
