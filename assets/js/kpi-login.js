/* KITO: gerbang login untuk navigasi KPI (latar memakai gambar splash).
   Add-on non-destruktif: dimuat SETELAH kpi.js dan membungkus render().
   CATATAN: ini gerbang sisi-klien (situs statis), bukan pengamanan server.
   Login per jabatan: pilih jabatan (dropdown) + password. Username = kode jabatan (huruf kecil).
   Ganti password: hitung SHA-256 dari "kode:password" (kode huruf kecil) lalu isi KPI_AKUN[kode]. */
(() => {
  'use strict';
  if (typeof render !== 'function') return;
  // daftar jabatan di dropdown login: [kode, label]
  const JABATAN = [['ROH', 'ROH'], ['TOH', 'TOH'], ['SQOR', 'SQO Region'], ['ASM', 'ASM'], ['SQOA', 'SQO Area'], ['ATOM', 'ATOM'], ['BOM', 'BOM-BOS']];
  // hash SHA-256 "kode:password" per jabatan (kode huruf kecil)
  const KPI_AKUN = {
    roh: '032c695954206ed50b9a46b1fe48d9987ac7af6d74306f1f16d79b1391a76c20',
    toh: 'e0361a47dc818641e4416531b3e93e5dacdda4f2ab5e650e8f83b92e59755016',
    sqor: '33351e7dec57007b5994aab663b8b081065ba2960e22b71b37e6af8ec6400505',
    asm: 'b4ebbc99b49ce77bfe4076b26f296e26c5979e6b80c3f90a22c5d22f3e6cd7b0',
    sqoa: '23f3f56febdbbd7ff579b7ddfd577928d1f99fc40856fe8e9eb72ff8683a81da',
    atom: '24194830a2ecb9b2d9b384d0fe184d59c327e175bf59779d34551fb67794d7e0',
    bom: '4e88c3acbfdf57bd8a6634d2d4110a8a51b00b48fe3f0609815fb63a97ac1d50',
  };
  // akses tab KPI per jabatan login: '*' = semua, selain itu daftar kunci jabatan (lihat kito.json [KITO_KPI])
  const AKSES = {
    roh: '*',
    sqor: ['SQOR', 'SQOA'],
    toh: ['TOH', 'ATOM'],
    asm: ['ASM', 'BOM'],
    sqoa: ['SQOA'],
    atom: ['ATOM'],
    bom: ['BOM'],
  };
  const HASH_VALID = new Set(Object.values(KPI_AKUN));
  const KUNCI = 'kito-kpi-masuk', KUNCI_AKSES = 'kito-kpi-akses';
  const simpanAkses = (kode) => {
    const a = AKSES[kode] || [String(kode).toUpperCase()];
    try { sessionStorage.setItem(KUNCI_AKSES, a === '*' ? '*' : JSON.stringify(a)); } catch (e) {}
  };

  const sudahMasuk = () => {
    try { return HASH_VALID.has(sessionStorage.getItem(KUNCI)); } catch (e) { return false; }
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
        <p>Pilih jabatan lalu masukkan password untuk melihat halaman KPI.</p>
        <label>Jabatan
          <span class="kl-sel"><select id="kl-u" autocomplete="username" required>
            <option value="" selected disabled>— Pilih jabatan —</option>
            ${JABATAN.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}
          </select></span>
        </label>
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
      if (!u.value.trim() || !p.value) { err.textContent = 'Jabatan dan password wajib diisi.'; return; }
      if (!window.crypto || !crypto.subtle) { err.textContent = 'Browser tidak mendukung login (butuh HTTPS).'; return; }
      const kode = u.value.trim().toLowerCase();
      const h = await sha256(kode + ':' + p.value);
      if (KPI_AKUN[kode] !== h) {
        err.textContent = 'Jabatan atau password salah.';
        p.value = '';
        p.focus();
        form.classList.remove('kl-goyang');
        void form.offsetWidth;
        form.classList.add('kl-goyang');
        return;
      }
      try { sessionStorage.setItem(KUNCI, h); } catch (e2) {}
      simpanAkses(kode);
      try { sessionStorage.setItem('kito-kpi-jabatan', kode); } catch (e2) {}   // dibaca pantau.js (pemantauan perangkat)
      render();
    });
  }

  const keluar = () => { try { sessionStorage.removeItem(KUNCI); sessionStorage.removeItem(KUNCI_AKSES); sessionStorage.removeItem('kito-kpi-jabatan'); } catch (e) {} render(); };
  // ikon Keluar di header paling atas (.bar-atas), di sebelah tombol tema
  function pasangKeluar() {
    const bar = document.querySelector('header .bar-atas');
    if (!bar || document.getElementById('kl-keluar')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'kl-keluar';
    b.className = 'tema kl-keluar';   // samakan gaya dengan tombol tema di header
    b.title = 'Keluar dari KPI';
    b.setAttribute('aria-label', 'Keluar dari KPI');
    b.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
    b.addEventListener('click', keluar);
    bar.insertBefore(b, bar.querySelector('#tema'));   // sebelum tombol tema (bulan)
  }
  const lepasKeluar = () => { const b = document.getElementById('kl-keluar'); if (b) b.remove(); };

  const renderSebelumnya = render;
  render = function (...args) {
    renderSebelumnya.apply(this, args);
    const kunci = tampil === 'kpi' && !sudahMasuk();
    document.body.classList.toggle('mode-kpi-login', kunci);
    if (tampil !== 'kpi') { lepasKeluar(); return; }
    if (kunci) {
      lepasKeluar();
      document.querySelector('#app').innerHTML = halamanLogin();
      pasangLogin();
    } else {
      pasangKeluar();
    }
  };
  if (tampil === 'kpi') render();
})();
