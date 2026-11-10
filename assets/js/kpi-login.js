/* KITO: gerbang login untuk navigasi KPI (latar memakai gambar splash).
   Add-on non-destruktif: dimuat SETELAH kpi.js dan membungkus render().
   Login tampil setelah loading page (gerbang, bisa dilewati) dan di tab KPI.
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
  const KUNCI = 'kito-kpi-masuk', KUNCI_AKSES = 'kito-kpi-akses', KUNCI_LEWATI = 'kito-kpi-lewati';
  const simpanAkses = (kode) => {
    const a = AKSES[kode] || [String(kode).toUpperCase()];
    try { sessionStorage.setItem(KUNCI_AKSES, a === '*' ? '*' : JSON.stringify(a)); } catch (e) {}
  };

  // sudah login: hash password tersimpan di sesi tab (hash bawaan atau hash password baru dari Reset password)
  const sudahMasuk = () => {
    try { return /^[0-9a-f]{64}$/.test(sessionStorage.getItem(KUNCI) || '') && !!sessionStorage.getItem('kito-kpi-jabatan'); } catch (e) { return false; }
  };
  // backend akun (push-php): login, ganti password, profil. Tanpa koneksi: cek lokal (hash terakhir yang berhasil / bawaan)
  const API = (window.KITO_PUSH?.api || '').replace(/\/+$/, '');
  const kunciAkun = (jab, kodeCab) => (jab === 'bom' ? 'bom:' + kodeCab : jab);
  const lsBaca = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsTulis = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  async function apiAkun(jalur, body) {
    if (!API) return { offline: true };
    let r;
    try { r = await fetch(API + '/api/akun/' + jalur, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) }); }
    catch (e) { return { offline: true }; }
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 || r.status >= 500) return { offline: true };   // backend belum diperbarui / gangguan server
    return { status: r.status, ...j };
  }
  async function verifikasi(jab, kodeCab, h) {
    const kunci = kunciAkun(jab, kodeCab);
    const r = await apiAkun('login', { jabatan: jab, cabang: kodeCab || undefined, hash: h });
    if (r.offline) return { ok: h === (lsBaca('kito-akun-h:' + kunci, null) || KPI_AKUN[jab]) };
    if (r.status === 200 && r.ok) {
      lsTulis('kito-akun-h:' + kunci, h);
      if (r.profil) lsTulis('kito-profil:' + kunci, r.profil);
      return { ok: true };
    }
    return { ok: false, pesan: r.status === 429 ? r.error : null };
  }
  const TAB_TERKUNCI = ['ranking', 'region', 'area', 'kpi'];   // terkunci untuk tamu (tanpa login)
  const tamu = () => !sudahMasuk();
  // BOM-BOS login per cabang: kode/nama cabang dipilih dari D.B ([kode, nama, area]); password tetap password BOM-BOS
  const KODE_CABANG = 'bom', KUNCI_CABANG = 'kito-kpi-cabang';
  const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const daftarCabang = () => (typeof D !== 'undefined' && Array.isArray(D.B) ? D.B : []);
  const teksCabang = (b) => `${b[0]} - ${b[1]}`;
  function cariCabang(teks) {
    const t = String(teks || '').trim().toLowerCase();
    if (!t) return -1;
    const B = daftarCabang();
    let i = B.findIndex((b) => teksCabang(b).toLowerCase() === t);
    if (i < 0) i = B.findIndex((b) => String(b[0]) === t.split(/[\s-]/)[0]);               // kode saja
    if (i < 0) { const m = B.map((b, k) => k).filter((k) => String(B[k][1]).toLowerCase() === t); if (m.length === 1) i = m[0]; }   // nama persis
    if (i < 0) { const m = B.map((b, k) => k).filter((k) => String(B[k][1]).toLowerCase().includes(t)); if (m.length === 1) i = m[0]; } // potongan nama yang unik
    return i;
  }
  // nama pengguna (hanya tampilan, tidak bisa diubah): BOM-BOS = nama BOM/BOS cabang dari [KITO_PIMPINAN];
  // jabatan lain = nama jabatan lengkap dari [KITO_KPI] (data nama orang per jabatan regional/area belum ada)
  function namaPengguna(jab, teksCab) {
    const k = String(jab || '').toUpperCase();
    if (!k) return '';
    if (k.toLowerCase() === KODE_CABANG) {
      const i = cariCabang(teksCab);
      if (i < 0) return '';
      const kode = String(D.B[i][0]), p = window.KITO_PIMPINAN?.data?.[kode];
      return p?.[1] || `BOM/BOS ${kode} ${D.B[i][1]} (nama belum ada di data)`;
    }
    const j = (window.KITO_KPI?.jabatan || []).find((x) => x.key === k);
    const label = (JABATAN.find((x) => x[0] === k) || [, k])[1];
    return j?.nama && j.nama !== label ? `${label} — ${j.nama}` : label;
  }
  function pilihCabang(i) {
    if (typeof st === 'undefined' || !D.B[i]) return;
    st.b = i; st.a = D.B[i][2];
    if (typeof fill === 'function') fill();
  }
  const sha256 = async (teks) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const halamanLogin = (p = 'kl', gerbang = false) => `
    <section class="kl${gerbang ? ' kl-gerbang' : ''}" id="${p}-wrap" aria-label="Login KPI"${gerbang ? ' role="dialog" aria-modal="true"' : ''}>
      <picture class="kl-bg" aria-hidden="true">
        <source media="(orientation: portrait)" srcset="assets/images/splash-portrait.png" />
        <source media="(min-width: 1600px)" srcset="assets/images/splash-widescreen.png" />
        <img src="assets/images/splash-landscape.png" alt="" decoding="async" />
      </picture>
      <form class="kl-card" id="${p}-form" novalidate>
        <h2>Login KPI</h2>
        <p>${gerbang ? 'Masuk dengan jabatan untuk membuka halaman KPI, atau lanjut tanpa login untuk halaman lainnya.' : 'Pilih jabatan lalu masukkan password untuk melihat halaman KPI.'}</p>
        <label>Jabatan
          <span class="kl-sel"><select id="${p}-u" autocomplete="username" required>
            <option value="" selected disabled>— Pilih jabatan —</option>
            ${JABATAN.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}
          </select></span>
        </label>
        <label class="kl-cab" hidden>Kode / nama cabang
          <input id="${p}-c" list="${p}-cl" type="text" autocomplete="off" placeholder="Ketik kode atau nama cabang" />
          <datalist id="${p}-cl"></datalist>
        </label>
        <label class="kl-nama">Nama pengguna
          <input id="${p}-n" type="text" disabled placeholder="Terisi otomatis" aria-live="polite" />
        </label>
        <label>Password
          <span class="kl-pw"><input id="${p}-p" type="password" autocomplete="current-password" required /><button type="button" data-kl-lihat aria-label="Tampilkan password">👁</button></span>
        </label>
        <small class="kl-err" role="alert"></small>
        <button type="submit" class="kl-btn">Masuk</button>
        ${gerbang ? '<button type="button" class="kl-lewati" data-kl-lewati>Lanjut tanpa login ›</button>' : ''}
      </form>
    </section>`;

  function pasangLogin(form, berhasil) {
    if (!form) return;
    const u = form.querySelector('select'), p = form.querySelector('input[type=password]'), err = form.querySelector('.kl-err');
    // BOM-BOS: login berdasarkan pilihan kode/nama cabang
    const cabWrap = form.querySelector('.kl-cab'), cab = cabWrap.querySelector('input'), cabList = cabWrap.querySelector('datalist');
    const nama = form.querySelector('.kl-nama input');
    const isiNama = () => { nama.value = namaPengguna(u.value, cab.value); };
    cab.addEventListener('input', isiNama);
    cab.addEventListener('change', isiNama);
    u.addEventListener('change', () => {
      const bom = u.value.toLowerCase() === KODE_CABANG;
      cabWrap.hidden = !bom;
      if (bom && !cabList.options.length) {
        cabList.innerHTML = daftarCabang().map((b) => `<option value="${esc(teksCabang(b))}"></option>`).join('');
        const kini = typeof st !== 'undefined' && D.B[st.b];
        if (kini && !cab.value) cab.value = teksCabang(kini);
      }
      isiNama();
      (bom ? cab : p).focus();
    });
    form.querySelector('[data-kl-lihat]').addEventListener('click', (e) => {
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
      let iCab = -1;
      if (kode === KODE_CABANG) {
        iCab = cariCabang(cab.value);
        if (iCab < 0) { err.textContent = cab.value.trim() ? 'Cabang tidak ditemukan. Pilih dari daftar.' : 'Pilih kode / nama cabang.'; cab.focus(); return; }
      }
      const h = await sha256(kode + ':' + p.value);
      const btn = form.querySelector('.kl-btn');
      btn.disabled = true; btn.textContent = 'Memeriksa…';
      const v = await verifikasi(kode, iCab >= 0 ? String(D.B[iCab][0]) : '', h);
      btn.disabled = false; btn.textContent = 'Masuk';
      if (!v.ok) {
        err.textContent = v.pesan || 'Jabatan atau password salah.';
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
      try { if (iCab >= 0) sessionStorage.setItem(KUNCI_CABANG, String(D.B[iCab][0])); else sessionStorage.removeItem(KUNCI_CABANG); } catch (e2) {}
      if (iCab >= 0) pilihCabang(iCab);
      (berhasil || render)();
      perbaruiProfil();
    });
  }

  let keluar = () => { try { sessionStorage.removeItem(KUNCI); sessionStorage.removeItem(KUNCI_AKSES); sessionStorage.removeItem('kito-kpi-jabatan'); } catch (e) {} render(); };
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
    b.addEventListener('click', () => keluar());
    bar.insertBefore(b, bar.querySelector('#tema'));   // sebelum tombol tema (bulan)
  }
  const lepasKeluar = () => { const b = document.getElementById('kl-keluar'); if (b) b.remove(); };

  const renderSebelumnya = render;
  render = function (...args) {
    renderSebelumnya.apply(this, args);
    if (typeof tandaiNav === 'function') tandaiNav();
    const kunci = tampil === 'kpi' && !sudahMasuk();
    document.body.classList.toggle('mode-kpi-login', kunci);
    if (tampil !== 'kpi') { lepasKeluar(); return; }
    lepasKeluar();   // ikon Keluar terpisah tidak dipakai lagi: Logout ada di menu Profil
    if (kunci) {
      document.querySelector('#app').innerHTML = halamanLogin();
      pasangLogin(document.querySelector('#kl-form'));
    }
  };
  if (tampil === 'kpi') render();

  /* Gerbang login: tampil di bawah splash, sehingga terlihat tepat setelah loading page selesai.
     Muncul sekali per sesi tab bila belum login dan belum memilih "Lanjut tanpa login".
     Tanpa login (tamu): hanya navigasi Cabang yang bisa dibuka (termasuk Informasi Sales & DTI di dalamnya);
     Ranking, Region, Area, dan KPI terkunci 🔒 dan membuka gerbang login bila diketuk. */
  const sudahLewati = () => { try { return sessionStorage.getItem(KUNCI_LEWATI) === '1'; } catch (e) { return false; } };

  function tandaiNav() {
    const t = tamu();
    document.body.classList.toggle('mode-tamu', t);
    document.querySelectorAll('#nav button[data-v]').forEach((b) => {
      const kunci = t && TAB_TERKUNCI.includes(b.dataset.v);
      b.classList.toggle('kl-kunci', kunci);
      if (kunci) { b.setAttribute('aria-disabled', 'true'); b.title = 'Login untuk membuka halaman ini'; }
      else { b.removeAttribute('aria-disabled'); b.removeAttribute('title'); }
    });
  }

  let gerbang = null;
  function bukaGerbang() {
    if (gerbang) return;
    const t = document.createElement('div');
    t.innerHTML = halamanLogin('klg', true);
    const g = gerbang = t.firstElementChild;
    document.body.appendChild(g);
    document.body.classList.add('mode-gerbang');
    const tutupGerbang = () => {
      gerbang = null;
      g.classList.add('kl-pergi');
      document.body.classList.remove('mode-gerbang');
      setTimeout(() => g.remove(), 300);
    };
    pasangLogin(g.querySelector('form'), () => { tutupGerbang(); render(); });
    g.querySelector('[data-kl-lewati]').addEventListener('click', () => {
      try { sessionStorage.setItem(KUNCI_LEWATI, '1'); } catch (e) {}
      tutupGerbang();
      if (TAB_TERKUNCI.includes(tampil)) { tampil = 'cabang'; render(); }
    });
    return g;
  }

  // tamu mengetuk tab terkunci: batalkan navigasi, tampilkan gerbang login (fase capture, sebelum script.js)
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-v]');
    if (!t || !tamu() || !TAB_TERKUNCI.includes(t.dataset.v)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const g = bukaGerbang();
    g?.querySelector('select')?.focus();
  }, true);

  // Keluar: kembali ke Cabang dan tampilkan gerbang login lagi
  keluar = () => {
    try { [KUNCI, KUNCI_AKSES, KUNCI_LEWATI, KUNCI_CABANG, 'kito-kpi-jabatan'].forEach((k) => sessionStorage.removeItem(k)); } catch (e) {}
    tutupProfil(); tampil = 'cabang'; render(); perbaruiProfil(); bukaGerbang();
  };


  /* ---------- Profil: ikon paling kanan atas header + kotak profil ---------- */
  const SVG_ORANG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
  function akunKini() {
    if (!sudahMasuk()) return null;
    let jab = '', cab = '', h = '';
    try { jab = sessionStorage.getItem('kito-kpi-jabatan') || ''; cab = sessionStorage.getItem(KUNCI_CABANG) || ''; h = sessionStorage.getItem(KUNCI) || ''; } catch (e) {}
    const kunci = kunciAkun(jab, cab);
    const profil = lsBaca('kito-profil:' + kunci, {}) || {};
    const b = cab ? daftarCabang().find((x) => String(x[0]) === cab) : null;
    const label = (JABATAN.find((x) => x[0].toLowerCase() === jab) || [, jab.toUpperCase()])[1];
    const namaBawaan = jab === KODE_CABANG ? (b ? namaPengguna('bom', teksCabang(b)) : 'BOM-BOS') : namaPengguna(jab, '');
    const jabKpi = (window.KITO_KPI?.jabatan || []).find((x) => x.key === jab.toUpperCase());
    return {
      jab, cab, h, kunci, profil,
      nama: profil.nama || namaBawaan, namaBawaan,
      jabatan: jab === KODE_CABANG && b ? `${label} · ${b[0]} ${b[1]}` : (jabKpi?.nama || label),
    };
  }
  const inisial = (n) => String(n || '').replace(/\(.*?\)|—.*$/g, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const avatar = (a, cls) => a?.profil?.foto
    ? `<span class="${cls}"><img src="${esc(a.profil.foto)}" alt=""></span>`
    : `<span class="${cls}${a ? ' kpf-ini' : ''}">${a ? esc(inisial(a.nama)) : SVG_ORANG}</span>`;

  let btnProfil = null, kotak = null, dialog = null;
  function pasangProfil() {
    const bar = document.querySelector('header .bar-atas');
    if (!bar || btnProfil) return;
    btnProfil = document.createElement('button');
    btnProfil.type = 'button'; btnProfil.id = 'kpf-btn'; btnProfil.className = 'tema kpf-btn';
    btnProfil.setAttribute('aria-haspopup', 'dialog'); btnProfil.setAttribute('aria-expanded', 'false');
    bar.appendChild(btnProfil);   // paling kanan
    btnProfil.addEventListener('click', (e) => { e.stopPropagation(); if (kotak) tutupProfil(); else bukaProfil(); });
    perbaruiProfil();
  }
  function perbaruiProfil() {
    if (!btnProfil) return;
    const a = akunKini();
    btnProfil.innerHTML = avatar(a, 'kpf-av');
    btnProfil.title = a ? `${a.nama} · ${a.jabatan}` : 'Profil (belum login)';
    btnProfil.setAttribute('aria-label', a ? `Profil ${a.nama}` : 'Profil, belum login');
    if (kotak) gambarKotak();
    try { window.dispatchEvent(new Event('kito-akun')); } catch (e) {}
  }
  function gambarKotak() {
    const a = akunKini();
    kotak.innerHTML = a ? `
      <div class="kpf-head">${avatar(a, 'kpf-av kpf-av-b')}<div class="kpf-id"><b>${esc(a.nama)}</b><small>${esc(a.jabatan)}</small></div></div>
      <div class="kpf-menu">
        <button type="button" data-kpf="edit"><span aria-hidden="true">✏️</span>Edit profil</button>
        <button type="button" data-kpf="sandi"><span aria-hidden="true">🔑</span>Reset password</button>
        <button type="button" data-kpf="keluar" class="kpf-out"><span aria-hidden="true">⎋</span>Logout</button>
      </div>` : `
      <div class="kpf-head">${avatar(null, 'kpf-av kpf-av-b')}<div class="kpf-id"><b>Tamu</b><small>Belum login · hanya halaman Cabang</small></div></div>
      <div class="kpf-menu"><button type="button" data-kpf="login"><span aria-hidden="true">🔐</span>Login</button></div>`;
  }
  function bukaProfil() {
    kotak = document.createElement('div');
    kotak.className = 'kpf-box'; kotak.setAttribute('role', 'dialog'); kotak.setAttribute('aria-label', 'Profil pengguna');
    gambarKotak();
    document.body.appendChild(kotak);
    const r = btnProfil.getBoundingClientRect();
    kotak.style.top = Math.round(r.bottom + 8) + 'px';
    btnProfil.setAttribute('aria-expanded', 'true');
    kotak.addEventListener('click', (e) => {
      const b = e.target.closest('[data-kpf]'); if (!b) return;
      const x = b.dataset.kpf; tutupProfil();
      if (x === 'keluar') keluar();
      else if (x === 'login') { const g = bukaGerbang(); if (g) g.querySelector('select')?.focus(); }
      else if (x === 'edit') dialogEdit();
      else if (x === 'sandi') dialogSandi();
    });
    kotak.querySelector('button')?.focus();
  }
  function tutupProfil() {
    if (!kotak) return;
    kotak.remove(); kotak = null;
    if (btnProfil) btnProfil.setAttribute('aria-expanded', 'false');
  }
  document.addEventListener('click', (e) => { if (kotak && !kotak.contains(e.target)) tutupProfil(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (dialog) tutupDialog(); else if (kotak) { tutupProfil(); btnProfil.focus(); }
  });
  window.addEventListener('resize', tutupProfil);

  /* dialog Edit profil & Reset password */
  function bukaDialog(judul, isi) {
    tutupDialog();
    dialog = document.createElement('div');
    dialog.className = 'kpf-wrap';
    dialog.innerHTML = `<div class="kpf-bg" data-kpf-tutup></div><form class="kpf-dlg" role="dialog" aria-modal="true" aria-label="${esc(judul)}" novalidate>
      <div class="kpf-dh"><h2>${esc(judul)}</h2><button type="button" class="kpf-x" data-kpf-tutup aria-label="Tutup">×</button></div>${isi}
      <small class="kpf-err" role="alert"></small>
      <div class="kpf-act"><button type="button" class="kpf-b2" data-kpf-tutup>Batal</button><button type="submit" class="kpf-b1">Simpan</button></div></form>`;
    document.body.appendChild(dialog);
    document.body.classList.add('kpf-open');
    dialog.addEventListener('click', (e) => { if (e.target.closest('[data-kpf-tutup]')) tutupDialog(); });
    return dialog.querySelector('form');
  }
  function tutupDialog() { if (dialog) { dialog.remove(); dialog = null; document.body.classList.remove('kpf-open'); } }
  const sibukForm = (f, ya, teks) => { const b = f.querySelector('.kpf-b1'); b.disabled = ya; b.textContent = ya ? teks : 'Simpan'; };

  // foto diperkecil menjadi 160×160 JPEG (dipotong tengah) agar ringan disimpan
  const kecilkanFoto = (file) => new Promise((ok, gagal) => {
    if (!file || !/^image\//.test(file.type)) { gagal(new Error('Pilih file gambar.')); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const S = 160, c = document.createElement('canvas'); c.width = c.height = S;
      const m = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('Gambar tidak bisa dibaca.')); };
    img.src = url;
  });

  function dialogEdit() {
    const a = akunKini(); if (!a) return;
    let foto = a.profil.foto || null;
    const f = bukaDialog('Edit profil', `
      <div class="kpf-foto"><span class="kpf-av kpf-av-b" id="kpf-prev"></span>
        <div><label class="kpf-up">📷 Ganti foto<input type="file" accept="image/*" id="kpf-file" hidden></label>
        <button type="button" class="kpf-link" id="kpf-hapus">Hapus foto</button></div></div>
      <label class="kpf-l">Nama pengguna<input type="text" id="kpf-nama" maxlength="80" value="${esc(a.profil.nama || '')}" placeholder="${esc(a.namaBawaan)}"></label>
      <label class="kpf-l">Jabatan<input type="text" value="${esc(a.jabatan)}" disabled></label>
      <p class="kpf-note">Kosongkan nama untuk memakai nama bawaan. Jabatan mengikuti akun login.</p>`);
    const prev = f.querySelector('#kpf-prev'), err = f.querySelector('.kpf-err'), inNama = f.querySelector('#kpf-nama');
    const lihat = () => {
      prev.className = 'kpf-av kpf-av-b' + (foto ? '' : ' kpf-ini');
      prev.innerHTML = foto ? `<img src="${esc(foto)}" alt="">` : esc(inisial(inNama.value || a.namaBawaan));
    };
    lihat();
    inNama.addEventListener('input', lihat);
    f.querySelector('#kpf-file').addEventListener('change', async (e) => {
      err.textContent = '';
      try { foto = await kecilkanFoto(e.target.files[0]); lihat(); } catch (x) { err.textContent = x.message; }
    });
    f.querySelector('#kpf-hapus').addEventListener('click', () => { foto = null; lihat(); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const nama = inNama.value.trim() || null;
      sibukForm(f, true, 'Menyimpan…');
      const r = await apiAkun('profil', { jabatan: a.jab, cabang: a.cab || undefined, hash: a.h, nama, foto });
      sibukForm(f, false);
      if (!r.offline && !(r.status === 200 && r.ok)) {
        err.textContent = r.status === 401 ? 'Sesi login tidak berlaku lagi (password sudah diganti). Silakan logout lalu login ulang.' : (r.error || 'Gagal menyimpan.');
        return;
      }
      lsTulis('kito-profil:' + a.kunci, r.profil || { ...a.profil, nama, foto });
      tutupDialog(); perbaruiProfil();
      toast(r.offline ? 'Profil disimpan di perangkat ini (server tidak terhubung).' : 'Profil disimpan.');
    });
    inNama.focus();
  }

  function dialogSandi() {
    const a = akunKini(); if (!a) return;
    const kolom = (id, label, ac) => `<label class="kpf-l">${label}<span class="kl-pw"><input type="password" id="${id}" autocomplete="${ac}" required><button type="button" data-kpf-lihat aria-label="Tampilkan password">👁</button></span></label>`;
    const f = bukaDialog('Reset password', `
      <p class="kpf-note">Akun: <b>${esc(a.jabatan)}</b></p>
      ${kolom('kpf-lama', 'Password saat ini', 'current-password')}
      ${kolom('kpf-baru', 'Password baru (min. 6 karakter)', 'new-password')}
      ${kolom('kpf-ulang', 'Ulangi password baru', 'new-password')}
      <p class="kpf-note">${a.jab === KODE_CABANG ? 'Password baru hanya berlaku untuk BOM-BOS cabang ini.' : 'Password baru berlaku untuk semua pengguna jabatan ini.'} Berlaku di semua perangkat setelah disimpan.</p>`);
    const err = f.querySelector('.kpf-err');
    f.addEventListener('click', (e) => {
      const b = e.target.closest('[data-kpf-lihat]'); if (!b) return;
      const i = b.previousElementSibling, lihat = i.type === 'password';
      i.type = lihat ? 'text' : 'password';
      b.setAttribute('aria-label', lihat ? 'Sembunyikan password' : 'Tampilkan password');
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const lama = f.querySelector('#kpf-lama').value, baru = f.querySelector('#kpf-baru').value, ulang = f.querySelector('#kpf-ulang').value;
      if (!lama || !baru) { err.textContent = 'Isi password saat ini dan password baru.'; return; }
      if (baru.length < 6) { err.textContent = 'Password baru minimal 6 karakter.'; return; }
      if (baru !== ulang) { err.textContent = 'Ulangi password baru tidak sama.'; return; }
      if (baru === lama) { err.textContent = 'Password baru harus berbeda dari password saat ini.'; return; }
      if (!window.crypto || !crypto.subtle) { err.textContent = 'Browser tidak mendukung (butuh HTTPS).'; return; }
      const hLama = await sha256(a.jab + ':' + lama), hBaru = await sha256(a.jab + ':' + baru);
      sibukForm(f, true, 'Menyimpan…');
      const r = await apiAkun('password', { jabatan: a.jab, cabang: a.cab || undefined, hash: hLama, baru: hBaru });
      sibukForm(f, false);
      if (r.offline) { err.textContent = 'Server tidak terhubung. Reset password butuh koneksi internet.'; return; }
      if (!(r.status === 200 && r.ok)) { err.textContent = r.status === 401 ? 'Password saat ini salah.' : (r.error || 'Gagal menyimpan password.'); return; }
      try { sessionStorage.setItem(KUNCI, hBaru); } catch (x) {}
      lsTulis('kito-akun-h:' + a.kunci, hBaru);
      tutupDialog(); toast('Password berhasil diganti.');
    });
    f.querySelector('#kpf-lama').focus();
  }

  function toast(t) {
    const el = document.createElement('div');
    el.className = 'kpf-toast'; el.setAttribute('role', 'status'); el.textContent = t;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('pergi'), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  pasangProfil();
  window.KITO_AKUN = { kini: akunKini };   // dipakai push.js (balasan keluhan cabang)

  if (tamu() && TAB_TERKUNCI.includes(tampil)) { tampil = 'cabang'; render(); }
  if (sudahMasuk()) {
    let kc = null; try { kc = sessionStorage.getItem(KUNCI_CABANG); } catch (e) {}
    const i = kc ? daftarCabang().findIndex((b) => String(b[0]) === kc) : -1;
    if (i >= 0 && i !== st.b) { pilihCabang(i); render(); }
  }
  tandaiNav();
  if (!sudahMasuk() && !sudahLewati()) bukaGerbang();
})();
