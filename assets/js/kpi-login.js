/* KITO: gerbang login untuk navigasi KPI (latar memakai gambar splash).
   Add-on non-destruktif: dimuat SETELAH kpi.js dan membungkus render().
   CATATAN: ini gerbang sisi-klien (situs statis), bukan pengamanan server.
   Ganti akun: hitung SHA-256 dari "username:password" (username huruf kecil) lalu isi KPI_AKUN. */
(() => {
  'use strict';
  if (typeof render !== 'function') return;
  const KPI_AKUN = ['4e6e5782b4cf0d27d201ed5e20b30a756906f5b962af1fb96cdc7266938e11c5'];
  const KUNCI = 'kito-kpi-masuk';

  const sudahMasuk = () => {
    try { return KPI_AKUN.includes(sessionStorage.getItem(KUNCI)); } catch (e) { return false; }
  };
  const sha256 = async (teks) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const halamanLogin = () => `
    <section class="kl" aria-label="Login KPI">
      <picture class="kl-bg" aria-hidden="true">
        <source media="(orientation: portrait)" srcset="assets/images/splash-portrait.png" />
        <source media="(min-width: 1600px)" srcset="assets/images/splash-widescreen.png" />
        <img src="assets/images/splash-landscape.png" alt="" decoding="async" />
      </picture>
      <form class="kl-card" id="kl-form" novalidate>
        <h2>Login KPI</h2>
        <p>Masuk untuk melihat halaman KPI.</p>
        <label>Username<input id="kl-u" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required /></label>
        <label>Password
          <span class="kl-pw"><input id="kl-p" type="password" autocomplete="current-password" required /><button type="button" id="kl-lihat" aria-label="Tampilkan password">👁</button></span>
        </label>
        <small class="kl-err" id="kl-err" role="alert"></small>
        <button type="submit" class="kl-btn">Masuk</button>
      </form>
    </section>`;

  function pasangLogin() {
    const form = document.querySelector('#kl-form');
    if (!form) return;
    const u = form.querySelector('#kl-u'), p = form.querySelector('#kl-p'), err = form.querySelector('#kl-err');
    form.querySelector('#kl-lihat').addEventListener('click', (e) => {
      const lihat = p.type === 'password';
      p.type = lihat ? 'text' : 'password';
      e.currentTarget.setAttribute('aria-label', lihat ? 'Sembunyikan password' : 'Tampilkan password');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (!u.value.trim() || !p.value) { err.textContent = 'Username dan password wajib diisi.'; return; }
      if (!window.crypto || !crypto.subtle) { err.textContent = 'Browser tidak mendukung login (butuh HTTPS).'; return; }
      const h = await sha256(u.value.trim().toLowerCase() + ':' + p.value);
      if (!KPI_AKUN.includes(h)) {
        err.textContent = 'Username atau password salah.';
        p.value = '';
        p.focus();
        form.classList.remove('kl-goyang');
        void form.offsetWidth;
        form.classList.add('kl-goyang');
        return;
      }
      try { sessionStorage.setItem(KUNCI, h); } catch (e2) {}
      render();
    });
  }

  // tombol Keluar di bawah halaman KPI
  function pasangKeluar() {
    const app = document.querySelector('#app');
    if (!app || app.querySelector('#kl-keluar')) return;
    const div = document.createElement('div');
    div.className = 'kl-aksi';
    div.innerHTML = '<button type="button" class="btn kl-keluar" id="kl-keluar">🔒 Keluar dari KPI</button>';
    div.querySelector('button').addEventListener('click', () => {
      try { sessionStorage.removeItem(KUNCI); } catch (e) {}
      render();
    });
    app.appendChild(div);
  }

  const renderSebelumnya = render;
  render = function (...args) {
    renderSebelumnya.apply(this, args);
    const kunci = tampil === 'kpi' && !sudahMasuk();
    document.body.classList.toggle('mode-kpi-login', kunci);
    if (tampil !== 'kpi') return;
    if (kunci) {
      document.querySelector('#app').innerHTML = halamanLogin();
      pasangLogin();
    } else {
      pasangKeluar();
    }
  };
  if (tampil === 'kpi') render();
})();
