/* Masukan pengguna di halaman Cabang: tombol "💬 Masukan" + popup dua tab.
   - ⭐ Rating aplikasi: 1–5 bintang, aspek yang dinilai, komentar (opsional).
   - 📝 Keluhan: kategori + uraian, nama/kontak opsional.
   Cabang, area, tanggal data, dan jabatan login yang sedang dilihat ikut terkirim agar keluhan mudah ditindaklanjuti.
   Popup rating juga muncul sendiri sesekali (paling cepat setelah 3 hari pemakaian, lalu tiap 30 hari bila belum menilai).
   Bila offline, kiriman diantre di perangkat dan dikirim otomatis saat online.
   Backend: push-php (POST /api/feedback); alamat dari window.KITO_PUSH.api. Admin: <api>/admin/masukan. Gaya: assets/css/masukan.css */
(() => {
  'use strict';
  const API = (window.KITO_PUSH?.api || '').replace(/\/+$/, '');
  if (!API || typeof render !== 'function') return;
  const URL_FB = API + '/api/feedback';

  const KATEGORI = ['Data tidak sesuai', 'Data terlambat diperbarui', 'Aplikasi lambat / error', 'Tampilan sulit dibaca', 'Notifikasi', 'Login / akses', 'Lainnya'];
  const ASPEK = ['Kecepatan', 'Tampilan', 'Akurasi data', 'Kemudahan', 'Kelengkapan', 'Notifikasi'];
  const LABEL_BINTANG = ['', 'Sangat buruk 😞', 'Kurang 🙁', 'Cukup 😐', 'Baik 🙂', 'Sangat baik 🤩'];
  const K_STATE = 'kito-masukan', K_ANTRE = 'kito-masukan-antre';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const baca = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const tulis = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const hariIni = () => new Date().toLocaleDateString('sv-SE');
  const diCabang = () => typeof tampil !== 'undefined' && tampil === 'cabang';

  const ua = navigator.userAgent;
  const app = document.referrer.startsWith('android-app://') || /; wv\)/.test(ua) || (() => { try { return sessionStorage.getItem('kitoTWA') === '1'; } catch (e) { return false; } })() ? 'apk'
    : (matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true ? 'pwa' : 'web');

  // konteks halaman cabang yang sedang dilihat
  const konteks = () => {
    const k = {};
    try {
      const b = D.B[st.b];
      if (b) { k.kode = String(b[0]); k.cabang = b[1]; k.area = b[2]; }
      if (st.a && st.a !== 'Semua Area Region II') k.area = st.a;
      k.tanggal = D.dates[st.d];
    } catch (e) {}
    try { k.jabatan = sessionStorage.getItem('kito-kpi-jabatan') || undefined; } catch (e) {}
    try { k.d = localStorage.getItem('kito-device-id') || undefined; } catch (e) {}
    return k;
  };

  /* ---------- kirim + antrean offline ---------- */
  const post = (isi) => fetch(URL_FB, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(isi), credentials: 'omit' })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || 'server menolak (' + r.status + ')'); e.tetap = r.status < 500 && r.status !== 429; throw e; } return j; });
  async function kirim(isi) {
    try { return await post(isi); }
    catch (e) {
      if (e.tetap) throw e;                 // data tidak valid: tampilkan pesan, jangan diantre
      const q = baca(K_ANTRE, []); q.push({ ...isi, diantre: Date.now() }); tulis(K_ANTRE, q.slice(-20));
      return { ok: true, diantre: true };
    }
  }
  async function kirimAntrean() {
    const q = baca(K_ANTRE, []); if (!q.length || !navigator.onLine) return;
    const sisa = [];
    for (const it of q) { try { const { diantre, ...isi } = it; await post(isi); } catch (e) { if (!e.tetap && Date.now() - it.diantre < 14 * 864e5) sisa.push(it); } }
    tulis(K_ANTRE, sisa);
  }
  addEventListener('online', kirimAntrean);
  setTimeout(kirimAntrean, 4000);

  /* ---------- tombol mengambang ---------- */
  const fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'kmk-fab'; fab.hidden = true;
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.innerHTML = '<span aria-hidden="true">💬</span>Masukan';
  fab.addEventListener('click', () => buka('rating'));
  document.body.appendChild(fab);
  const segarFab = () => { fab.hidden = !diCabang(); };
  const renderAsli = render;
  render = function () { const r = renderAsli.apply(this, arguments); segarFab(); return r; };   // eslint-disable-line no-global-assign
  segarFab();

  /* ---------- popup ---------- */
  const wrap = document.createElement('div');
  wrap.className = 'kmk-wrap'; wrap.hidden = true;
  wrap.innerHTML = `<div class="kmk-bg" data-kmk-tutup></div>
    <section class="kmk" role="dialog" aria-modal="true" aria-labelledby="kmk-h">
      <div class="kmk-head"><div><h2 id="kmk-h">Masukan untuk KITO</h2><p class="kmk-ctx" id="kmk-ctx"></p></div>
        <button type="button" class="kmk-x" data-kmk-tutup aria-label="Tutup">×</button></div>
      <div class="kmk-body"></div>
    </section>`;
  document.body.appendChild(wrap);
  const body = wrap.querySelector('.kmk-body');
  let tab = 'rating', otomatis = false, fokusSebelum = null;
  const draf = { rating: 0, aspek: [], pesanR: '', kategori: '', pesanK: '', nama: '', kontak: '' };

  const tabs = () => `<div class="kmk-tabs" role="tablist">
      <button type="button" role="tab" data-kmk-tab="rating" aria-selected="${tab === 'rating'}">⭐ Rating aplikasi</button>
      <button type="button" role="tab" data-kmk-tab="keluhan" aria-selected="${tab === 'keluhan'}">📝 Keluhan</button></div>`;

  const formRating = () => `${tabs()}
    <form id="kmk-f" novalidate>
      <p class="kmk-q">${otomatis ? 'Bagaimana pengalaman Anda memakai dashboard KITO?' : 'Seberapa puas Anda dengan aplikasi ini?'}</p>
      <fieldset class="kmk-stars" aria-label="Rating 1 sampai 5 bintang">
        ${[1, 2, 3, 4, 5].map((n) => `<label data-n="${n}" class="${n <= draf.rating ? 'on' : ''}" title="${LABEL_BINTANG[n].replace(/ \S+$/, '')}"><input type="radio" name="r" value="${n}" ${n === draf.rating ? 'checked' : ''} aria-label="${n} bintang"><span aria-hidden="true">★</span></label>`).join('')}
      </fieldset>
      <div class="kmk-stars-lbl" id="kmk-sl" aria-live="polite">${draf.rating ? LABEL_BINTANG[draf.rating] : 'Ketuk bintang untuk menilai'}</div>
      <span class="kmk-l">Yang paling Anda perhatikan <small>(boleh lebih dari satu)</small></span>
      <div class="kmk-chips">${ASPEK.map((a) => `<label><input type="checkbox" name="a" value="${esc(a)}" ${draf.aspek.includes(a) ? 'checked' : ''}>${esc(a)}</label>`).join('')}</div>
      <label class="kmk-l" for="kmk-pr">Saran atau komentar <small>(opsional)</small></label>
      <textarea id="kmk-pr" maxlength="2000" placeholder="Apa yang perlu ditingkatkan?">${esc(draf.pesanR)}</textarea>
      <p class="kmk-err" id="kmk-err" role="alert"></p>
      <div class="kmk-act">${otomatis ? '<button type="button" class="kmk-btn sec" data-kmk-nanti>Nanti saja</button>' : ''}<button type="submit" class="kmk-btn">Kirim rating</button></div>
    </form>`;

  const formKeluhan = () => `${tabs()}
    <form id="kmk-f" novalidate>
      <label class="kmk-l" for="kmk-kat">Jenis keluhan</label>
      <select id="kmk-kat" required><option value="" disabled ${draf.kategori ? '' : 'selected'}>— Pilih jenis keluhan —</option>
        ${KATEGORI.map((k) => `<option ${k === draf.kategori ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
      <label class="kmk-l" for="kmk-pk">Uraian keluhan</label>
      <textarea id="kmk-pk" maxlength="2000" required placeholder="Contoh: P95 cabang ini tanggal 7 Nov tidak sama dengan laporan harian.">${esc(draf.pesanK)}</textarea>
      <div class="kmk-hit"><span id="kmk-n">${draf.pesanK.length}</span>/2000</div>
      <div class="kmk-row">
        <div><label class="kmk-l" for="kmk-nm">Nama <small>(opsional)</small></label><input type="text" id="kmk-nm" maxlength="80" autocomplete="name" value="${esc(draf.nama)}"></div>
        <div><label class="kmk-l" for="kmk-kt">No. HP / email <small>(opsional)</small></label><input type="text" id="kmk-kt" maxlength="80" autocomplete="email" value="${esc(draf.kontak)}"></div>
      </div>
      <p class="kmk-note">Cabang, area, dan tanggal data yang sedang Anda lihat ikut terkirim agar keluhan mudah dicek. Isi kontak bila ingin dihubungi balik.</p>
      <p class="kmk-err" id="kmk-err" role="alert"></p>
      <div class="kmk-act"><button type="submit" class="kmk-btn">Kirim keluhan</button></div>
    </form>`;

  const selesai = (jenis, diantre) => `<div class="kmk-ok">
      <b aria-hidden="true">${jenis === 'rating' ? (draf.rating >= 4 ? '🎉' : '🙏') : '✅'}</b>
      <h3>${jenis === 'rating' ? 'Terima kasih atas penilaian Anda!' : 'Keluhan Anda sudah kami terima'}</h3>
      <p>${diantre ? 'Perangkat sedang offline. Masukan disimpan dan akan terkirim otomatis saat kembali online.'
        : jenis === 'rating' ? 'Masukan Anda membantu kami membuat KITO lebih baik.' : 'Tim Operation Region II akan menindaklanjuti secepatnya.'}</p>
      <button type="button" class="kmk-btn" data-kmk-tutup>Tutup</button></div>`;

  function tampilkan() {
    const k = konteks();
    wrap.querySelector('#kmk-ctx').textContent = [k.kode && `${k.kode} ${k.cabang || ''}`.trim(), k.area].filter(Boolean).join(' · ');
    body.innerHTML = tab === 'rating' ? formRating() : formKeluhan();
  }
  function buka(t, auto = false) {
    tab = t; otomatis = auto; fokusSebelum = document.activeElement;
    tampilkan(); wrap.hidden = false; document.body.classList.add('kmk-open');
    (body.querySelector('.kmk-stars input:checked, .kmk-stars input, select') || body.querySelector('button'))?.focus({ preventScroll: true });
  }
  function tutup() {
    if (wrap.hidden) return;
    if (otomatis) catatTanya();
    wrap.hidden = true; document.body.classList.remove('kmk-open');
    fokusSebelum?.focus?.({ preventScroll: true });
  }

  const warnaiBintang = (n) => body.querySelectorAll('.kmk-stars label').forEach((l) => l.classList.toggle('on', +l.dataset.n <= n));
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-kmk-tutup]') || e.target.closest('[data-kmk-nanti]')) return tutup();
    const t = e.target.closest('[data-kmk-tab]');
    if (t) { tab = t.dataset.kmkTab; tampilkan(); body.querySelector(`[data-kmk-tab="${tab}"]`)?.focus(); }
  });
  wrap.addEventListener('mouseover', (e) => { const l = e.target.closest('.kmk-stars label'); if (l) warnaiBintang(+l.dataset.n); });
  wrap.addEventListener('mouseout', (e) => { if (e.target.closest('.kmk-stars')) warnaiBintang(draf.rating); });
  wrap.addEventListener('input', (e) => {
    const el = e.target;
    if (el.name === 'r') { draf.rating = +el.value; warnaiBintang(draf.rating); body.querySelector('#kmk-sl').textContent = LABEL_BINTANG[draf.rating]; body.querySelector('#kmk-err').textContent = ''; }
    else if (el.name === 'a') draf.aspek = [...body.querySelectorAll('input[name=a]:checked')].map((x) => x.value);
    else if (el.id === 'kmk-pr') draf.pesanR = el.value;
    else if (el.id === 'kmk-pk') { draf.pesanK = el.value; body.querySelector('#kmk-n').textContent = el.value.length; }
    else if (el.id === 'kmk-kat') draf.kategori = el.value;
    else if (el.id === 'kmk-nm') draf.nama = el.value;
    else if (el.id === 'kmk-kt') draf.kontak = el.value;
  });
  wrap.addEventListener('change', (e) => { if (e.target.id === 'kmk-kat') draf.kategori = e.target.value; });
  document.addEventListener('keydown', (e) => {
    if (wrap.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); tutup(); }
    if (e.key === 'Tab') {   // fokus tetap di dalam popup
      const f = [...wrap.querySelectorAll('button, input, select, textarea')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  wrap.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = body.querySelector('#kmk-err'), btn = body.querySelector('button[type=submit]');
    err.textContent = '';
    let isi;
    if (tab === 'rating') {
      if (!draf.rating) { err.textContent = 'Pilih jumlah bintang dulu.'; body.querySelector('.kmk-stars input')?.focus(); return; }
      isi = { jenis: 'rating', rating: draf.rating, aspek: draf.aspek, pesan: draf.pesanR.trim() || undefined };
    } else {
      if (!draf.kategori) { err.textContent = 'Pilih jenis keluhan.'; body.querySelector('#kmk-kat').focus(); return; }
      if (draf.pesanK.trim().length < 5) { err.textContent = 'Tuliskan uraian keluhan (minimal 5 karakter).'; body.querySelector('#kmk-pk').focus(); return; }
      isi = { jenis: 'keluhan', kategori: draf.kategori, pesan: draf.pesanK.trim(), nama: draf.nama.trim() || undefined, kontak: draf.kontak.trim() || undefined };
    }
    btn.disabled = true; btn.textContent = 'Mengirim…';
    try {
      const r = await kirim({ ...isi, ...konteks(), app });
      const s = baca(K_STATE, {});
      if (tab === 'rating') { s.rating = Date.now(); s.nilai = draf.rating; draf.pesanR = ''; draf.aspek = []; }
      else { draf.pesanK = ''; draf.kategori = ''; }
      s.tanya = Date.now(); tulis(K_STATE, s);
      otomatis = false;
      body.innerHTML = selesai(tab, r.diantre);
      body.querySelector('[data-kmk-tutup]')?.focus();
    } catch (er) {
      err.textContent = 'Gagal mengirim: ' + er.message;
      btn.disabled = false; btn.textContent = tab === 'rating' ? 'Kirim rating' : 'Kirim keluhan';
    }
  });

  /* ---------- tawaran rating otomatis (jarang & sopan) ---------- */
  function catatTanya() { const s = baca(K_STATE, {}); s.tanya = Date.now(); tulis(K_STATE, s); }
  (() => {
    const s = baca(K_STATE, {});
    const h = hariIni(); s.hari = [...new Set([...(s.hari || []), h])].slice(-10); tulis(K_STATE, s);
    const HARI = 864e5;
    if (s.hari.length < 3) return;                                  // baru dipakai kurang dari 3 hari
    if (s.rating && Date.now() - s.rating < 60 * HARI) return;      // sudah menilai 60 hari terakhir
    if (s.tanya && Date.now() - s.tanya < 30 * HARI) return;        // sudah ditawari 30 hari terakhir
    let detik = 0;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible' || !diCabang()) return;
      if (++detik < 90) return;                                     // setelah 90 detik di halaman Cabang
      clearInterval(t);
      if (wrap.hidden && !document.body.classList.contains('knp-open') && !document.querySelector('.kl')) buka('rating', true);
    }, 1000);
  })();
})();
