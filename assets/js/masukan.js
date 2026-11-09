/* Masukan pengguna di halaman Cabang: tombol "💬 Masukan" + popup tiga tab.
   - ⭐ Rating aplikasi: 1–5 bintang, aspek yang dinilai, komentar (opsional).
   - 📝 Keluhan: kategori + uraian, nama/NIP opsional.
   - 🏢 Keluhan Cabang: laporan masalah operasional cabang (mesin antrian, printer tiket, jaringan, antrian menumpuk, dll.)
     dengan urgensi, waktu kejadian, serta nama pelapor + NIP (angka) wajib agar bisa ditindaklanjuti.
   NIP dikirim di field "kontak" (nama kolom database tetap).
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
  // keluhan cabang (harus sama dengan KP_FB_KATEGORI_CABANG di push-php/lib/masukan.php)
  const KATEGORI_CABANG = ['Mesin antrian / Inbranch error', 'Printer / tiket antrian bermasalah', 'Layar display antrian mati', 'Jaringan / koneksi cabang terputus',
    'Antrian nasabah menumpuk', 'Petugas Teller/CS kurang', 'Komplain nasabah', 'Fasilitas cabang (listrik, AC, gedung)', 'Lainnya'];
  const URGENSI = [['rendah', 'Rendah'], ['sedang', 'Sedang'], ['tinggi', 'Tinggi'], ['kritis', 'Kritis']];
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
  fab.addEventListener('click', () => buka(tabTerakhir));
  document.body.appendChild(fab);
  const segarFab = () => { fab.hidden = !diCabang(); };

  /* ---------- kartu notifikasi "Keluhan Cabang" di halaman Cabang ----------
     Gaya mengikuti kartu notifikasi Highlight Issue (penguatan.js: ikon, label, judul besar, panah, tombol ×),
     warna biru tua berkedip agar tidak tertukar dengan Highlight Issue. Ditaruh paling atas halaman Cabang
     (di atas Highlight Issue). Ketuk = buka form Keluhan Cabang; × = tutup hingga halaman dimuat ulang. */
  const IKON_CABANG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5"/><path d="M9 10h.01M15 10h.01"/></svg>';
  const IKON_PANAH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const IKON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  let infoTutup = false;
  function kartuInfo() {
    const app = document.getElementById('app');
    let el = document.getElementById('kmk-info');
    if (!app || !diCabang() || infoTutup) { el?.remove(); return; }
    const k = konteks();
    if (!el) {
      el = document.createElement('div');
      el.id = 'kmk-info'; el.className = 'kmk-notif'; el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.innerHTML = `<span class="kmk-n-ik">${IKON_CABANG}</span>
        <span class="kmk-n-tx"><small>KELUHAN CABANG</small><b>Lapor Masalah Operasional Cabang</b><em></em></span>
        <span class="kmk-n-go">${IKON_PANAH}</span>
        <button type="button" class="kmk-n-x" aria-label="Tutup notifikasi keluhan cabang">${IKON_X}</button>`;
      el.querySelector('.kmk-n-x').addEventListener('click', (e) => { e.stopPropagation(); buangKartu(el, 1); });
      el.addEventListener('click', (e) => {
        if (e.target.closest('.kmk-n-x')) return;
        if (el.dataset.barusajaGeser) { delete el.dataset.barusajaGeser; return; }   // klik sisa gerakan geser: jangan buka form
        tabTerakhir = 'cabang'; buka('cabang');
      });
      el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); tabTerakhir = 'cabang'; buka('cabang'); } });
      pasangGeser(el);
    }
    const sub = `${k.kode ? `${k.kode} ${k.cabang || ''} · ` : ''}Ketuk untuk lapor`;
    if (el.querySelector('em').textContent !== sub) el.querySelector('em').textContent = sub;
    el.setAttribute('aria-label', `Buka form Keluhan Cabang${k.kode ? ' untuk ' + k.kode + ' ' + (k.cabang || '') : ''}`);
    // posisi: kartu notifikasi paling atas halaman Cabang (di atas Highlight Issue)
    if (app.firstElementChild !== el) app.prepend(el);
  }
  /* tutup kartu: geser keluar ke samping lalu ciutkan tingginya (sama seperti kartu Highlight Issue) */
  function buangKartu(el, arah) {
    if (!el || el.dataset.dibuang) return;
    el.dataset.dibuang = '1'; infoTutup = true;
    const halus = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!halus) { el.remove(); return; }
    el.style.animation = 'none';
    el.style.transition = 'transform .22s ease, opacity .22s ease';
    el.style.transform = `translateX(${arah * 110}%)`; el.style.opacity = '0';
    setTimeout(() => {
      el.style.height = el.offsetHeight + 'px'; void el.offsetHeight;
      el.style.transition = 'height .2s ease, margin .2s ease, padding .2s ease';
      el.style.height = '0'; el.style.margin = '0'; el.style.padding = '0'; el.style.borderWidth = '0';
      setTimeout(() => el.remove(), 220);
    }, 220);
  }
  /* geser kiri/kanan > 90px = tutup; gerakan vertikal tetap menggulir halaman */
  function pasangGeser(el) {
    let g = null;   // { x0, y0, dx, kunci, id }
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.kmk-n-x') || (e.pointerType === 'mouse' && e.button !== 0)) return;
      g = { x0: e.clientX, y0: e.clientY, dx: 0, kunci: null, id: e.pointerId };
    });
    el.addEventListener('pointermove', (e) => {
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (g.kunci === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) g.kunci = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (g.kunci !== 'x') return;
      g.dx = dx;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      el.style.animation = 'none'; el.style.transition = 'none';
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(Math.max(0.25, 1 - Math.abs(dx) / 260));
    });
    const lepas = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const { dx, kunci } = g; g = null;
      if (kunci === 'x' && Math.abs(dx) > 90) { el.dataset.barusajaGeser = '1'; buangKartu(el, Math.sign(dx)); return; }
      el.style.transition = 'transform .2s ease, opacity .2s ease'; el.style.transform = ''; el.style.opacity = '';
      setTimeout(() => { if (!el.dataset.dibuang) { el.style.animation = ''; el.style.transition = ''; } }, 220);   // kedip kembali
      if (kunci === 'x') el.dataset.barusajaGeser = '1';
    };
    el.addEventListener('pointerup', lepas);
    el.addEventListener('pointercancel', lepas);
  }

  // kartu info lain disisipkan oleh MutationObserver setelah render; posisi dirapikan sesudahnya
  const segarInfo = () => { kartuInfo(); requestAnimationFrame(kartuInfo); };

  const renderAsli = render;
  render = function () { const r = renderAsli.apply(this, arguments); segarFab(); segarInfo(); return r; };   // eslint-disable-line no-global-assign
  segarFab();
  segarInfo();

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
  let tab = 'rating', tabTerakhir = 'rating', otomatis = false, fokusSebelum = null;
  const draf = { rating: 0, aspek: [], pesanR: '', kategori: '', pesanK: '', nama: '', kontak: '', katC: '', urgensi: 'sedang', waktu: '', pesanC: '' };
  // nilai input datetime-local untuk waktu sekarang (zona waktu perangkat)
  const sekarangLokal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  const tabs = () => `<div class="kmk-tabs" role="tablist">
      <button type="button" role="tab" data-kmk-tab="rating" aria-selected="${tab === 'rating'}">⭐ Rating aplikasi</button>
      <button type="button" role="tab" data-kmk-tab="keluhan" aria-selected="${tab === 'keluhan'}">📝 Keluhan</button>
      <button type="button" role="tab" data-kmk-tab="cabang" aria-selected="${tab === 'cabang'}">🏢 Keluhan Cabang</button></div>`;

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
        <div><label class="kmk-l" for="kmk-kt">NIP <small>(opsional)</small></label><input type="text" id="kmk-kt" maxlength="80" inputmode="numeric" pattern="[0-9]+" autocomplete="off" value="${esc(draf.kontak)}"></div>
      </div>
      <p class="kmk-note">Cabang, area, dan tanggal data yang sedang Anda lihat ikut terkirim agar keluhan mudah dicek. Isi NIP sebagai identitas pelapor.</p>
      <p class="kmk-err" id="kmk-err" role="alert"></p>
      <div class="kmk-act"><button type="submit" class="kmk-btn">Kirim keluhan</button></div>
    </form>`;

  const formCabang = () => {
    const k = konteks();
    if (!draf.waktu) draf.waktu = sekarangLokal();
    return `${tabs()}
    <form id="kmk-f" novalidate>
      <div class="kmk-cab">${k.kode ? `<b>🏢 ${esc(k.kode)} · ${esc(k.cabang || '')}</b><span>${esc(k.area || '')}</span>`
        : '<b>Belum ada cabang yang dipilih</b>'}<small>Laporan untuk cabang ini. Ganti cabang lewat pilihan cabang di bagian atas dashboard.</small></div>
      <label class="kmk-l" for="kmk-kc">Jenis masalah cabang</label>
      <select id="kmk-kc" required><option value="" disabled ${draf.katC ? '' : 'selected'}>— Pilih jenis masalah —</option>
        ${KATEGORI_CABANG.map((x) => `<option ${x === draf.katC ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      <span class="kmk-l">Tingkat urgensi</span>
      <div class="kmk-chips kmk-urg" role="radiogroup" aria-label="Tingkat urgensi">${URGENSI.map(([v, t]) => `<label class="u-${v}"><input type="radio" name="u" value="${v}" ${v === draf.urgensi ? 'checked' : ''}>${t}</label>`).join('')}</div>
      <label class="kmk-l" for="kmk-wk">Waktu kejadian</label>
      <input type="datetime-local" id="kmk-wk" value="${esc(draf.waktu)}" max="${sekarangLokal()}">
      <label class="kmk-l" for="kmk-pc">Uraian masalah</label>
      <textarea id="kmk-pc" maxlength="2000" required placeholder="Contoh: Mesin antrian mati sejak 09.15, tiket tidak keluar. Nasabah diarahkan antri manual, ±25 nasabah terdampak.">${esc(draf.pesanC)}</textarea>
      <div class="kmk-hit"><span id="kmk-nc">${draf.pesanC.length}</span>/2000</div>
      <div class="kmk-row">
        <div><label class="kmk-l" for="kmk-nm">Nama pelapor</label><input type="text" id="kmk-nm" maxlength="80" autocomplete="name" required value="${esc(draf.nama)}"></div>
        <div><label class="kmk-l" for="kmk-kt">NIP</label><input type="text" id="kmk-kt" maxlength="80" inputmode="numeric" pattern="[0-9]+" autocomplete="off" required value="${esc(draf.kontak)}"></div>
      </div>
      <p class="kmk-note">Urgensi <b>Kritis</b>: layanan cabang terhenti. <b>Tinggi</b>: layanan terganggu dan nasabah terdampak.</p>
      <p class="kmk-err" id="kmk-err" role="alert"></p>
      <div class="kmk-act"><button type="submit" class="kmk-btn">Kirim keluhan cabang</button></div>
    </form>`;
  };

  const TEKS_OK = {
    rating: ['Terima kasih atas penilaian Anda!', 'Masukan Anda membantu kami membuat KITO lebih baik.'],
    keluhan: ['Keluhan Anda sudah kami terima', 'Tim Operation Region II akan menindaklanjuti secepatnya.'],
    cabang: ['Laporan masalah cabang sudah diterima', 'Tim Operation Region II akan menindaklanjuti laporan ini. Status laporan dicatat atas NIP pelapor.'],
  };
  const selesai = (jenis, diantre) => `<div class="kmk-ok">
      <b aria-hidden="true">${jenis === 'rating' ? (draf.rating >= 4 ? '🎉' : '🙏') : '✅'}</b>
      <h3>${TEKS_OK[jenis][0]}</h3>
      <p>${diantre ? 'Perangkat sedang offline. Masukan disimpan dan akan terkirim otomatis saat kembali online.' : TEKS_OK[jenis][1]}</p>
      <button type="button" class="kmk-btn" data-kmk-tutup>Tutup</button></div>`;

  function tampilkan() {
    const k = konteks();
    wrap.querySelector('#kmk-ctx').textContent = [k.kode && `${k.kode} ${k.cabang || ''}`.trim(), k.area].filter(Boolean).join(' · ');
    body.innerHTML = tab === 'rating' ? formRating() : tab === 'keluhan' ? formKeluhan() : formCabang();
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
    if (t) { tab = t.dataset.kmkTab; if (!otomatis) tabTerakhir = tab; tampilkan(); body.querySelector(`[data-kmk-tab="${tab}"]`)?.focus(); }
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
    else if (el.id === 'kmk-kt') { el.value = el.value.replace(/[^0-9]/g, ''); draf.kontak = el.value; }
    else if (el.id === 'kmk-kc') draf.katC = el.value;
    else if (el.name === 'u') draf.urgensi = el.value;
    else if (el.id === 'kmk-wk') draf.waktu = el.value;
    else if (el.id === 'kmk-pc') { draf.pesanC = el.value; body.querySelector('#kmk-nc').textContent = el.value.length; }
  });
  wrap.addEventListener('change', (e) => {
    if (e.target.id === 'kmk-kat') draf.kategori = e.target.value;
    if (e.target.id === 'kmk-kc') draf.katC = e.target.value;
    if (e.target.id === 'kmk-wk') draf.waktu = e.target.value;
  });
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
    if (tab !== 'rating' && draf.kontak && !/^[0-9]+$/.test(draf.kontak)) { err.textContent = 'NIP hanya boleh berisi angka.'; body.querySelector('#kmk-kt').focus(); return; }
    let isi;
    if (tab === 'rating') {
      if (!draf.rating) { err.textContent = 'Pilih jumlah bintang dulu.'; body.querySelector('.kmk-stars input')?.focus(); return; }
      isi = { jenis: 'rating', rating: draf.rating, aspek: draf.aspek, pesan: draf.pesanR.trim() || undefined };
    } else if (tab === 'keluhan') {
      if (!draf.kategori) { err.textContent = 'Pilih jenis keluhan.'; body.querySelector('#kmk-kat').focus(); return; }
      if (draf.pesanK.trim().length < 5) { err.textContent = 'Tuliskan uraian keluhan (minimal 5 karakter).'; body.querySelector('#kmk-pk').focus(); return; }
      isi = { jenis: 'keluhan', kategori: draf.kategori, pesan: draf.pesanK.trim(), nama: draf.nama.trim() || undefined, kontak: draf.kontak.trim() || undefined };
    } else {
      const salah = (pesan, sel) => { err.textContent = pesan; body.querySelector(sel)?.focus(); };
      if (!konteks().kode) return salah('Pilih cabang dulu lewat pilihan cabang di bagian atas dashboard.', '#kmk-kc');
      if (!draf.katC) return salah('Pilih jenis masalah cabang.', '#kmk-kc');
      const wk = draf.waktu ? new Date(draf.waktu) : null;
      if (wk && wk.getTime() > Date.now() + 5 * 60000) return salah('Waktu kejadian tidak boleh di masa depan.', '#kmk-wk');
      if (draf.pesanC.trim().length < 10) return salah('Uraikan masalah cabang (minimal 10 karakter).', '#kmk-pc');
      if (!draf.nama.trim()) return salah('Isi nama pelapor.', '#kmk-nm');
      if (!draf.kontak.trim()) return salah('Isi NIP pelapor.', '#kmk-kt');
      isi = { jenis: 'cabang', kategori: draf.katC, urgensi: draf.urgensi, waktu_kejadian: wk && !isNaN(wk) ? wk.toISOString() : undefined,
        pesan: draf.pesanC.trim(), nama: draf.nama.trim(), kontak: draf.kontak.trim() };
      if (draf.urgensi === 'kritis' && !confirm('Laporkan sebagai KRITIS (layanan cabang terhenti)?')) return;
    }
    btn.disabled = true; btn.textContent = 'Mengirim…';
    try {
      const r = await kirim({ ...isi, ...konteks(), app });
      const s = baca(K_STATE, {});
      if (tab === 'rating') { s.rating = Date.now(); s.nilai = draf.rating; draf.pesanR = ''; draf.aspek = []; }
      else if (tab === 'keluhan') { draf.pesanK = ''; draf.kategori = ''; }
      else { draf.pesanC = ''; draf.katC = ''; draf.urgensi = 'sedang'; draf.waktu = ''; }
      s.tanya = Date.now(); tulis(K_STATE, s);
      otomatis = false;
      body.innerHTML = selesai(tab, r.diantre);
      body.querySelector('[data-kmk-tutup]')?.focus();
    } catch (er) {
      err.textContent = 'Gagal mengirim: ' + er.message;
      btn.disabled = false; btn.textContent = { rating: 'Kirim rating', keluhan: 'Kirim keluhan', cabang: 'Kirim keluhan cabang' }[tab];
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
