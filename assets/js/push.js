/* Lonceng 🔔 di header: keluhan cabang, rencana pegawai tidak masuk, daftar notifikasi terbaru, dan status notifikasi.
   Izin notifikasi, pendaftaran perangkat, dan topik TIDAK lagi diatur dari sini: semuanya otomatis saat aplikasi dibuka
   (assets/js/notif-otomatis.js, window.KITO_NOTIF). Di sini pengguna hanya bisa melihat status, mengirim tes, mematikan, atau mengaktifkan kembali.
   Server: push-php/, alamat diatur di assets/js/push-config.js. Gaya: assets/css/push.css */
(() => {
  'use strict';
  const API = (window.KITO_PUSH?.api || '').replace(/\/+$/, '');
  const btnTema = document.getElementById('tema');
  if (!API || !btnTema) return;

  // aplikasi Android TWA (Chrome di dalam APK KITO): penanda sesi dipakai pantau.js dan notif-otomatis.js
  const isTWA = document.referrer.startsWith('android-app://') || sessionStorage.getItem('kitoTWA') === '1';
  if (isTWA) { try { sessionStorage.setItem('kitoTWA', '1'); } catch (e) {} }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (method, path, body) => {
    let r;
    try {
      r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      // offline: perubahan pengaturan (simpan topik / matikan) diantre dan dikirim otomatis lewat Background Sync
      const bisaAntre = (method === 'PUT' || method === 'DELETE') && navigator.serviceWorker?.controller;
      if (!bisaAntre) throw new Error(navigator.onLine ? 'server tidak bisa dihubungi' : 'perangkat sedang offline');
      navigator.serviceWorker.controller.postMessage({ type: 'kito-antre', item: { url: API + path, method, body: body ? JSON.stringify(body) : null } });
      return { ok: true, diantre: true, topics: body?.topics || [] };
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'server tidak merespons (' + r.status + ')');
    return j;
  };

  // pilihan dashboard saat ini (variabel global dari script.js)
  const pilihan = () => {
    const b = typeof D !== 'undefined' && typeof st !== 'undefined' ? D.B[st.b] : null;
    const area = typeof st !== 'undefined' && st.a && st.a !== 'Semua Area Region II' ? st.a : b?.[2];
    return { area, kode: b ? String(b[0]) : null, cabang: b ? b[1] : null };
  };
  const topikArea = (a) => 'area:' + String(a).toLowerCase().replace(/\s+/g, ' ').trim();

  /* ---------- tombol & panel ---------- */
  const bell = document.createElement('button');
  bell.type = 'button'; bell.id = 'kito-bell'; bell.className = 'tema kito-bell';
  bell.setAttribute('aria-label', 'Notifikasi'); bell.innerHTML = '🔔<i></i>';
  btnTema.before(bell);

  const sheet = document.createElement('div');
  sheet.className = 'knp-wrap'; sheet.hidden = true;
  sheet.innerHTML = '<div class="knp-bg" data-knp-tutup></div><section class="knp" role="dialog" aria-modal="true" aria-labelledby="knp-h"><div class="knp-head"><h2 id="knp-h">🔔 Notifikasi</h2><button type="button" class="knp-x" data-knp-tutup aria-label="Tutup">×</button></div><div class="knp-body"></div></section>';
  document.body.appendChild(sheet);
  const body = sheet.querySelector('.knp-body');

  let pesan = '', sibuk = false, riwayatNotif = null;
  const NT = () => window.KITO_NOTIF || null;   // notif-otomatis.js (dimuat setelah file ini; dibaca saat dipakai)

  // titik hijau di lonceng = notifikasi aktif di perangkat ini (push atau dalam aplikasi)
  function tandaiBell() {
    const st0 = NT()?.state();
    const aktif = !!st0 && (st0.mode === 'push' || st0.mode === 'dalam-aplikasi');
    bell.classList.toggle('on', aktif);
    bell.title = aktif ? 'Notifikasi · aktif' : 'Notifikasi';
  }

  // bagian atas panel: lapor masalah operasional cabang (form Keluhan Cabang di masukan.js)
  function bagianLapor() {
    if (!window.KITO_MASUKAN) return '';
    const p = pilihan();
    return `<button type="button" class="knp-lapor" data-knp-lapor><b>⚠️ Laporkan masalah operasional cabang</b><small>${p.kode ? esc(p.kode + ' ' + (p.cabang || '')) + ' · ' : ''}Ketuk untuk isi form Keluhan Cabang</small></button>`;
  }


  /* ---------- keluhan & feedback cabang + tindak lanjut (balasan ROH / SQO Region / SQO Area / ASM) ---------- */
  const PEMBALAS = ['roh', 'sqor', 'sqoa', 'asm'];
  const NM_STATUS = { baru: 'Baru', diproses: 'Diproses', selesai: 'Selesai', ditolak: 'Ditolak' };
  const kel = { kode: null, list: null, err: '', muat: false, buka: null, kirim: false, pesanBalas: '' };
  const akun = () => { try { return window.KITO_AKUN?.kini() || null; } catch (e) { return null; } };
  const bisaBalas = () => { const a = akun(); return !!a && PEMBALAS.includes(a.jab); };
  const wib = (s) => {
    if (!s) return '';
    const d = new Date(String(s).replace(' ', 'T') + (/[zZ+]/.test(s) ? '' : 'Z'));
    return isNaN(d) ? s : d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB';
  };
  const terbuka = (r) => r.status === 'baru' || r.status === 'diproses';
  // penerima keluhan cabang: ASM & SQO Area area cabang (KITO_ASM), SQO Region, dan ROH
  const kunciArea = (x) => String(x || '').toUpperCase().replace(/^\s*AREA\s+/, '').replace(/[^A-Z0-9]/g, '');
  const judulArea = (x) => String(x || '').replace(/^AREA\s+/i, '').toLowerCase().replace(/(^|\s)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  function penerima(area) {
    const A = window.KITO_ASM || {}, x = A.data?.[kunciArea(area)];
    const sqor = (A.sqor || [])[0]?.nama;
    return [x?.nama && `ASM ${x.nama}`, x?.sqoa && `SQO Area ${x.sqoa}`, sqor ? `SQO Region ${sqor}` : 'SQO Region', 'ROH'].filter(Boolean);
  }
  const areaCabang = () => { try { return D.B[st.b]?.[2] || ''; } catch (e) { return ''; } };
  // kotak masuk: pembalas yang login dengan cakupan jelas (ROH/SQO Region = Region II; ASM/SQO Area = areanya)
  const modeMasuk = () => { const a = akun(); return !!a && PEMBALAS.includes(a.jab) && (a.jab === 'roh' || a.jab === 'sqor' || !!a.sub); };
  const namaCakupan = (a) => (a.jab === 'roh' || a.jab === 'sqor' ? 'Region II' : 'Area ' + judulArea((window.KITO_ASM?.data?.[a.sub] || {}).area || a.sub));

  async function muatKeluhan(paksa) {
    // pembalas: kotak masuk sesuai cakupan · akun lain (mis. BOM-BOS): hanya keluhan yang dikirim akun itu · tamu: tidak ada daftar
    const masuk = modeMasuk(), a = akun();
    const kode = a ? (masuk ? 'masuk:' : 'saya:') + a.kunci : null;
    if (!kode) { kel.kode = null; kel.list = []; tandaiJumlah(); return; }
    if (!paksa && kel.kode === kode && kel.list) return;
    kel.muat = true; kel.err = '';
    if (kel.kode !== kode) { kel.list = null; kel.buka = null; }
    kel.kode = kode;
    try {
      const r = masuk
        ? await api('POST', '/api/feedback/masuk', a.kred)
        : await api('POST', '/api/feedback/saya', a.kred);
      if (kel.kode === kode) kel.list = r.keluhan || [];
    } catch (e) {
      if (kel.kode === kode) { kel.err = /password salah/i.test(e.message) ? 'Sesi login tidak berlaku lagi. Silakan logout lalu login ulang.' : e.message; kel.list = kel.list || []; }
    }
    kel.muat = false;
    tandaiJumlah();
  }
  // angka di lonceng = keluhan yang masih Baru / Diproses (cabang ini, atau kotak masuk pembalas)
  function tandaiJumlah() {
    const n = (kel.list || []).filter(terbuka).length;
    let c = bell.querySelector('.knp-cnt');
    if (!n) { c?.remove(); return; }
    if (!c) { c = document.createElement('b'); c.className = 'knp-cnt'; bell.appendChild(c); }
    c.textContent = n > 9 ? '9+' : String(n);
    bell.setAttribute('aria-label', `Notifikasi keluhan cabang, ${n} belum selesai`);
  }

  function bagianKeluhan() {
    const p = pilihan(), masuk = modeMasuk();
    const a = akun(), balas = masuk;
    if (!a) return `<p class="knp-g">Keluhan cabang</p><p class="knp-kosong">Keluhan cabang hanya dapat dibaca oleh akun pelapor dan tim tindak lanjut. Login untuk melihat keluhan cabang yang Anda kirim beserta balasannya.</p>`
      + (p.kode ? `<p class="knp-note knp-as">Laporan cabang ${esc(p.kode)} diteruskan ke <b>${esc(penerima(areaCabang()).join(', '))}</b>.</p>` : '');
    const nBuka = (kel.list || []).filter(terbuka).length;
    const judul = masuk
      ? `<p class="knp-g">📥 Keluhan cabang masuk · ${esc(namaCakupan(a))}${nBuka ? ` <span class="knp-nb">${nBuka} belum selesai</span>` : ''}</p>`
      : `<p class="knp-g">Keluhan cabang saya · ${esc(a.nama)}</p>`;
    if (kel.muat && !kel.list) return judul + '<p class="knp-note">Memuat keluhan…</p>';
    const list = kel.list || [];
    let info;
    if (masuk) info = `<p class="knp-note knp-as">Anda login sebagai <b>${esc(a.jabatan)}</b>. Keluhan cabang di ${esc(namaCakupan(a))} masuk ke sini dan dapat Anda balas.</p>`;
    else if (a && PEMBALAS.includes(a.jab)) info = `<p class="knp-msg">Untuk membalas, logout lalu login ulang sebagai ${esc(a.jab === 'asm' ? 'ASM' : 'SQO Area')} dengan memilih nama dan area Anda.</p>`;
    else info = `<p class="knp-note knp-as">Hanya akun Anda yang dapat membaca keluhan ini. Laporan diteruskan ke <b>${esc(penerima(areaCabang()).join(', '))}</b> untuk ditindaklanjuti.</p>`;
    if (!list.length) return judul + (kel.err ? `<p class="knp-msg">Keluhan tidak bisa dimuat: ${esc(kel.err)}</p>` : `<p class="knp-kosong">${masuk ? 'Belum ada keluhan cabang masuk' : 'Belum ada keluhan cabang yang Anda kirim'} dalam 120 hari terakhir.</p>`) + info;
    const item = (r) => {
      const jenis = r.jenis === 'cabang' ? 'Keluhan cabang' : 'Keluhan aplikasi';
      const bls = (r.balasan || []).map((b) => `<div class="knp-bl"><div class="knp-blh"><b>${esc(b.jabatan)}${b.nama ? ' · ' + esc(b.nama) : ''}</b><small>${esc(wib(b.created_at))}</small></div><p>${esc(b.pesan)}</p>${b.status ? `<span class="knp-st st-${esc(b.status)}">→ ${esc(NM_STATUS[b.status] || b.status)}</span>` : ''}</div>`).join('');
      const form = balas && kel.buka === r.id ? `
        <div class="knp-bf">
          <textarea id="knp-bt" maxlength="1000" rows="3" placeholder="Tulis tindak lanjut / arahan untuk cabang…">${esc(kel.pesanBalas)}</textarea>
          <div class="knp-bfr"><select id="knp-bs" aria-label="Status tindak lanjut">
            <option value="">Status: ${esc(NM_STATUS[r.status] || r.status)} (tetap)</option>
            <option value="diproses">Diproses</option><option value="selesai">Selesai</option><option value="ditolak">Ditolak</option></select>
            <button type="button" class="knp-btn" data-knp-kirim="${r.id}"${kel.kirim ? ' disabled' : ''}>${kel.kirim ? 'Mengirim…' : 'Kirim'}</button>
            <button type="button" class="knp-btn link" data-knp-balas="0">Batal</button></div>
        </div>` : '';
      return `<article class="knp-k ${terbuka(r) ? 'buka' : ''}">
        <div class="knp-kh"><span class="knp-jn">${esc(jenis)}</span>${r.urgensi ? `<span class="knp-ur ur-${esc(r.urgensi)}">${esc(r.urgensi)}</span>` : ''}<span class="knp-st st-${esc(r.status)}">${esc(NM_STATUS[r.status] || r.status)}</span></div>
        ${r.kode ? `<span class="knp-cab">🏢 ${esc(r.kode + ' ' + (r.cabang || ''))}</span>` : ''}
        ${r.kategori ? `<b class="knp-kat">${esc(r.kategori)}</b>` : ''}
        <p class="knp-ps">${esc(r.pesan || '')}</p>
        <small class="knp-mt">${esc(wib(r.created_at))}${r.nama ? ' · ' + esc(r.nama) : ''}${r.waktu_kejadian ? ' · kejadian ' + esc(String(r.waktu_kejadian).replace('T', ' ')) : ''}</small>
        ${bls ? `<div class="knp-bls">${bls}</div>` : ''}
        ${form || (balas ? `<button type="button" class="knp-balas" data-knp-balas="${r.id}">↩ Balas / tindak lanjut</button>` : '')}
      </article>`;
    };
    return judul + info + `<div class="knp-kl">${list.map(item).join('')}</div>` + (kel.err ? `<p class="knp-msg">${esc(kel.err)}</p>` : '');
  }

  /* ---------- rencana pegawai tidak masuk (data form Pegawai Cuti) ----------
     BOM-BOS = cabangnya · ASM & SQO Area = areanya · ROH, TOH, SQO Region, ATOM = Region II; tamu tidak melihat daftar. */
  const cu = { kunci: null, list: null, err: '', hariIni: null };
  const tglPendek = (t) => (t ? new Date(t + 'T00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) : '');
  const selisihHari = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);
  async function muatCuti(paksa) {
    const a = akun();
    if (!a) { cu.kunci = null; cu.list = null; return; }
    if (!paksa && cu.kunci === a.kunci && cu.list) return;
    if (cu.kunci !== a.kunci) cu.list = null;
    cu.kunci = a.kunci; cu.err = '';
    try { const r = await api('POST', '/api/feedback/cuti', a.kred); if (cu.kunci === a.kunci) { cu.list = r.cuti || []; cu.hariIni = r.hariIni; cu.cakupan = r.cakupan; } }
    catch (e) { if (cu.kunci === a.kunci) { cu.err = /password salah/i.test(e.message) ? 'Sesi login tidak berlaku lagi. Silakan logout lalu login ulang.' : e.message; cu.list = cu.list || []; } }
  }
  function bagianCuti() {
    const a = akun();
    if (!a) return '';
    // penerima: ROH & SQO Region (Region II), ASM & SQO Area (areanya); akun lain hanya melihat rencana yang dikirimnya
    const penerimaCuti = a.jab === 'roh' || a.jab === 'sqor' || ((a.jab === 'asm' || a.jab === 'sqoa') && !!a.sub);
    const cak = a.jab === 'roh' || a.jab === 'sqor' ? 'Region II' : penerimaCuti ? namaCakupan(a) : 'yang Anda kirim';
    const judul = `<p class="knp-g">📅 Rencana pegawai tidak masuk · ${esc(cak)}</p>`;
    if (!cu.list) return judul + '<p class="knp-note">Memuat…</p>';
    const infoPenerima = penerimaCuti ? '' : `<p class="knp-note knp-as">Rencana tidak masuk hanya terkirim ke ${esc(penerima(areaCabang()).join(', '))}.</p>`;
    if (!cu.list.length) return judul + (cu.err ? `<p class="knp-msg">${esc(cu.err)}</p>` : `<p class="knp-kosong">${penerimaCuti ? 'Tidak ada pegawai yang cuti hari ini maupun 60 hari ke depan.' : 'Belum ada rencana tidak masuk yang Anda kirim untuk hari ini maupun 60 hari ke depan.'}</p>`) + infoPenerima;
    const hi = cu.hariIni || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const sedang = cu.list.filter((r) => r.cuti_mulai <= hi), nanti = cu.list.filter((r) => r.cuti_mulai > hi);
    const item = (r) => {
      const jalan = r.cuti_mulai <= hi, sisa = selisihHari(hi, r.cuti_mulai);
      const tanda = jalan ? `<span class="knp-cu-t on">Tidak masuk${r.cuti_selesai > hi ? ' s.d. ' + esc(tglPendek(r.cuti_selesai)) : ' hari ini'}</span>`
        : `<span class="knp-cu-t">${sisa === 1 ? 'Mulai besok' : `Mulai ${sisa} hari lagi`}</span>`;
      return `<div class="knp-cu ${jalan ? 'on' : ''}">
        <div class="knp-cu-h"><b>${esc(r.nama || '–')}</b>${tanda}</div>
        <small>${esc([r.cuti_jabatan, `${r.kode} ${r.cabang || ''}`.trim()].filter(Boolean).join(' · '))}</small>
        <small>${esc(r.kategori || 'Cuti')} · ${esc(tglPendek(r.cuti_mulai))}${r.cuti_selesai !== r.cuti_mulai ? ' – ' + esc(tglPendek(r.cuti_selesai)) : ''}${r.cuti_hari != null ? ` · ${r.cuti_hari} hari kerja` : ''}</small>
        ${r.cuti_pengganti ? `<small>Pengganti: ${esc(r.cuti_pengganti)}</small>` : ''}
      </div>`;
    };
    return judul + `<p class="knp-note knp-as"><b>${sedang.length}</b> pegawai tidak masuk hari ini · <b>${nanti.length}</b> rencana cuti 60 hari ke depan.</p>`
      + `<div class="knp-cul">${sedang.map(item).join('')}${nanti.map(item).join('')}</div>` + infoPenerima + (cu.err ? `<p class="knp-msg">${esc(cu.err)}</p>` : '');
  }

  /* kartu "Rencana Pegawai Tidak Masuk" di halaman Cabang (di bawah kartu Lapor Masalah Operasional Cabang), selalu tampil.
     Ketuk kartu = form input rencana tidak masuk (masukan.js) · "Lihat daftar" = kotak 🔔 (rincian sesuai cakupan akun)
     × = sembunyikan sampai halaman dimuat ulang. Hanya tampil untuk akun login (tamu tidak); daftar nama sesuai cakupan akun. */
  const IKON_KAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="m9 14.5 2 2 4-4"/></svg>';
  const IKON_KANAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const IKON_TUTUP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  let kartuCutiTutup = false, kartuCutiEl = null, formCutiBuka = false;
  function segarKartuCuti() {
    const app = document.getElementById('app');
    let el = kartuCutiEl;   // elemen disimpan: isian form tidak hilang saat halaman digambar ulang
    const p = pilihan(), a = akun();
    const list = (cu.list || []).filter((r) => String(r.kode) === String(p.kode));
    // hanya untuk akun login; tamu (tanpa login) tidak melihat kartu ini
    if (!app || typeof tampil === 'undefined' || tampil !== 'cabang' || kartuCutiTutup || !p.kode || !a) { el?.remove(); return; }
    const hi = cu.hariIni || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const sedang = list.filter((r) => r.cuti_mulai <= hi), nanti = list.filter((r) => r.cuti_mulai > hi);
    if (!el) {
      el = document.createElement('div');
      el.id = 'knp-cuk'; el.className = 'kmk-notif knp-cuk'; el.setAttribute('role', 'group'); el.tabIndex = 0; kartuCutiEl = el;
      el.innerHTML = `<span class="kmk-n-ik">${IKON_KAL}</span>
        <span class="kmk-n-tx"><small>Rencana tidak masuk</small><b>Rencana Pegawai Tidak Masuk</b><em></em><span class="knp-cuk-n"></span>
          <button type="button" class="knp-cuk-lihat" data-cuk-lihat hidden>Lihat daftar ›</button></span>
        <span class="kmk-n-go">${IKON_KANAN}</span>
        <button type="button" class="kmk-n-x" aria-label="Tutup informasi rencana pegawai tidak masuk">${IKON_TUTUP}</button>
        <div class="knp-cuk-form" hidden></div>`;
      el.querySelector('.kmk-n-x').addEventListener('click', (e) => { e.stopPropagation(); kartuCutiTutup = true; el.remove(); });
      // ketuk kartu = buka / tutup form pengisian di dalam kartu
      const bukaInput = () => {
        const fc = el.querySelector('.knp-cuk-form');
        formCutiBuka = !formCutiBuka;
        fc.hidden = !formCutiBuka; el.classList.toggle('buka', formCutiBuka);
        if (formCutiBuka) {
          if (window.KITO_MASUKAN?.formCuti) { if (!fc.firstChild || fc.dataset.kode !== String(pilihan().kode)) window.KITO_MASUKAN.formCuti(fc); fc.querySelector('input')?.focus({ preventScroll: true }); }
          else fc.textContent = 'Form belum siap, coba lagi sebentar.';
        }
        segarKartuCuti();
      };
      el.addEventListener('click', (e) => {
        if (e.target.closest('.kmk-n-x') || e.target.closest('.knp-cuk-form')) return;
        if (e.target.closest('[data-cuk-lihat]')) { e.stopPropagation(); buka(); return; }
        bukaInput();
      });
      el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); bukaInput(); } });
    }
    const nama = (r) => `${r.nama}${r.cuti_jabatan ? ' (' + r.cuti_jabatan + ')' : ''} ${r.cuti_mulai <= hi ? 's.d. ' + tglPendek(r.cuti_selesai) : 'mulai ' + tglPendek(r.cuti_mulai)}`;
    let sub, isi;
    if (list.length) {
      sub = `${p.kode} ${p.cabang || ''} · ${sedang.length} tidak masuk hari ini · ${nanti.length} rencana cuti`;
      isi = list.slice(0, 3).map(nama).join(' · ') + (list.length > 3 ? ` · +${list.length - 3} lainnya` : '');
    } else {
      sub = formCutiBuka ? 'Isi formulir di bawah' : 'Ketuk untuk isi formulir';
      isi = '';
    }
    el.querySelector('em').textContent = sub;
    el.querySelector('.knp-cuk-n').textContent = isi;
    el.querySelector('[data-cuk-lihat]').hidden = !list.length;
    // ganti cabang saat form terbuka: form digambar ulang untuk cabang baru (isian tetap)
    const fc = el.querySelector('.knp-cuk-form');
    if (formCutiBuka && fc.dataset.kode && fc.dataset.kode !== String(p.kode) && window.KITO_MASUKAN?.formCuti && fc.querySelector('form')) window.KITO_MASUKAN.formCuti(fc);
    el.setAttribute('aria-label', `Rencana pegawai tidak masuk ${p.kode} ${p.cabang || ''}${list.length ? `: ${sedang.length} hari ini, ${nanti.length} rencana` : ''}. Ketuk untuk input rencana tidak masuk.`);
    // posisi: tepat di bawah kartu Lapor Masalah Operasional Cabang (masukan.js), atau paling atas bila kartu itu ditutup
    const lapor = document.getElementById('kmk-info');
    if (lapor && lapor.parentNode === app) { if (lapor.nextElementSibling !== el) lapor.after(el); }
    else if (app.firstElementChild !== el) app.prepend(el);
  }

  async function kirimBalasan(id) {
    const a = akun(), t = body.querySelector('#knp-bt'), s = body.querySelector('#knp-bs');
    if (!a || !t) return;
    kel.pesanBalas = t.value;
    if (!t.value.trim()) { t.focus(); return; }
    kel.kirim = true; kel.err = ''; gambar();
    try {
      await api('POST', `/api/feedback/${id}/balas`, { ...a.kred, nama: a.profil?.nama || (a.orang ? a.nama : null), pesan: kel.pesanBalas.trim(), status: s?.value || null });
      kel.buka = null; kel.pesanBalas = '';
      await muatKeluhan(true);
    } catch (e) {
      kel.err = /password salah/i.test(e.message) ? 'Sesi login tidak berlaku lagi. Silakan logout lalu login ulang.' : 'Balasan gagal dikirim: ' + e.message;
    }
    kel.kirim = false; gambar();
  }

  /* ---------- notifikasi: daftar terbaru + status (izin, pendaftaran, dan topik diurus otomatis oleh notif-otomatis.js) ---------- */
  const urlAman = (u) => { try { const x = new URL(u, location.href); return x.protocol === 'https:' || (x.protocol === 'http:' && location.protocol === 'http:') ? x.href : null; } catch (e) { return null; } };
  const namaTopik = (t) => {
    if (t === 'semua') return 'Semua notifikasi';
    const i = t.indexOf(':'), j = i < 0 ? '' : t.slice(0, i), v = i < 0 ? t : t.slice(i + 1);
    if (j === 'area') return 'Area ' + judulArea(v);
    if (j === 'jabatan') return 'Jabatan ' + v.toUpperCase();
    if (j === 'cabang') {
      let nama = '';
      try { nama = (D.B.find((x) => String(x[0]) === v) || [])[1] || ''; } catch (e) {}
      return 'Cabang ' + v + (nama ? ' ' + nama : '');
    }
    return t;
  };
  const caraIzin = (s) => (s.ios ? 'Pengaturan › Notifikasi › KITO' : s.android ? 'Pengaturan › Aplikasi › KITO (atau Chrome) › Notifikasi' : 'ikon gembok di samping alamat › Notifikasi › Izinkan');

  function itemNotif(r) {
    const href = urlAman(r.url), bisa = !!href && href !== location.href;
    const isi = `<b class="knp-nj">${esc(r.title)}</b>${r.body ? `<span class="knp-ni">${esc(r.body)}</span>` : ''}<small class="knp-nt">${esc(wib(r.waktu))}</small>`;
    return bisa ? `<button type="button" class="knp-n" data-knp-url="${esc(r.url)}">${isi}</button>` : `<div class="knp-n">${isi}</div>`;
  }
  function bagianNotifTerbaru() {
    const s0 = NT()?.state();
    let h;
    if (riwayatNotif === null) h = '<p class="knp-note">Memuat notifikasi…</p>';
    else if (!riwayatNotif.length) h = `<p class="knp-kosong">${s0?.mode === 'mati' ? 'Notifikasi dimatikan di perangkat ini.' : 'Belum ada notifikasi untuk perangkat ini dalam 14 hari terakhir.'}</p>`;
    else h = `<div class="knp-nl">${riwayatNotif.slice(0, 10).map(itemNotif).join('')}</div>`;
    return '<p class="knp-g">Notifikasi terbaru</p>' + h;
  }

  function bagianStatus() {
    const s = NT()?.state();
    const judul = '<p class="knp-g knp-sep">Status notifikasi</p>';
    if (!s) return judul + '<p class="knp-note">Modul notifikasi belum siap. Muat ulang halaman.</p>';
    const tes = '<button type="button" class="knp-btn sec" data-knp="tes">Kirim tes</button>';
    const matikan = '<button type="button" class="knp-btn link" data-knp="matikan">Matikan notifikasi</button>';
    let st, ok = false, info = '', tombolAksi = '';
    if (s.mode === 'mati') {
      st = '○ Dimatikan di perangkat ini';
      info = 'Notifikasi KITO tidak akan masuk ke perangkat ini sampai Anda mengaktifkannya kembali.';
      tombolAksi = '<button type="button" class="knp-btn" data-knp="aktifkan">Aktifkan kembali</button>';
    } else if (s.mode === 'push') {
      st = '● Aktif · notifikasi sistem'; ok = true;
      info = 'Notifikasi tetap masuk walau KITO ditutup' + (s.ios ? ' (selama KITO masih terpasang di Layar Utama).' : '.');
      tombolAksi = tes + matikan;
    } else if (s.mode === 'dalam-aplikasi') {
      st = '● Aktif · dalam aplikasi'; ok = true;
      const alasan = {
        webview: 'Aplikasi Android ini belum bisa menampilkan notifikasi sistem, jadi notifikasi tampil sebagai banner saat KITO terbuka dan tersimpan di daftar di atas. Untuk notifikasi saat aplikasi ditutup, buka KITO lewat Chrome atau pasang versi aplikasi terbaru.',
        'tidak-didukung': s.ios && !s.standalone ? 'Di iPhone/iPad, tambahkan KITO ke Layar Utama lalu buka dari sana agar notifikasi tetap masuk saat aplikasi ditutup. Sementara ini notifikasi tampil saat KITO terbuka.' : 'Browser ini belum mendukung notifikasi sistem. Notifikasi tampil sebagai banner saat KITO terbuka.',
        ditolak: `Notifikasi sistem diblokir untuk KITO. Izinkan lewat ${caraIzin(s)} lalu muat ulang halaman. Sementara ini notifikasi tampil saat KITO terbuka.`,
        menunggu: 'Izin notifikasi sistem belum diberikan. Sementara ini notifikasi tampil saat KITO terbuka.',
        'push-gagal': 'Layanan push tidak terjangkau dari jaringan ini (mis. jaringan kantor). Notifikasi tetap tampil saat KITO terbuka.',
        'push-ditolak': 'Server menolak pendaftaran push perangkat ini. Notifikasi tetap tampil saat KITO terbuka.',
      }[s.alasan];
      info = alasan || 'Notifikasi tampil sebagai banner saat KITO terbuka.';
      if (s.alasan === 'menunggu' && s.pushDidukung && s.izin === 'default') tombolAksi += '<button type="button" class="knp-btn" data-knp="aktifkan">Aktifkan notifikasi sistem</button>';
      else if (s.alasan === 'push-gagal' || s.alasan === 'push-ditolak') tombolAksi += '<button type="button" class="knp-btn" data-knp="aktifkan">Coba lagi</button>';
      tombolAksi += tes + matikan;
      // mode dalam-aplikasi tetapi server belum mengenal perangkat ini: jangan tampil "Aktif" (tidak akan menerima apa pun)
      if (!s.deviceId) {
        st = '⚠ Perangkat belum terdaftar'; ok = false;
        info = 'Aplikasi ini tidak bisa menyimpan ID perangkat, jadi notifikasi belum bisa diterima. Tutup lalu buka kembali KITO. Bila tetap muncul, buka KITO lewat Chrome.';
        tombolAksi = '<button type="button" class="knp-btn" data-knp="aktifkan">Coba lagi</button>';
      } else if (s.terdaftar === false) {
        st = '⚠ Belum terhubung ke server notifikasi'; ok = false;
        info = 'Pendaftaran perangkat ini belum berhasil (jaringan atau server). Dicoba lagi otomatis saat online, atau ketuk Coba lagi.';
        tombolAksi = '<button type="button" class="knp-btn" data-knp="aktifkan">Coba lagi</button>' + matikan;
      }
    } else {
      st = '○ Menyiapkan notifikasi…';
    }
    const topik = (s.topik || []).map(namaTopik);
    const chips = topik.length && s.mode !== 'mati' ? `<p class="knp-g">Menerima notifikasi untuk</p><div class="knp-chips">${topik.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : '';
    return judul + `<p class="knp-status ${ok ? 'ok' : ''}">${st}</p><p class="knp-note knp-as">${esc(info)}</p>${chips}`
      + (tombolAksi ? `<div class="knp-act">${tombolAksi}</div>` : '')
      + (s.mode === 'mati' ? '' : '<p class="knp-note">Izin dan pendaftaran perangkat berjalan otomatis saat KITO dibuka. Penerima mengikuti akun dan cabang Anda.</p>');
  }

  function gambar() {
    body.innerHTML = bagianLapor() + bagianNotifTerbaru() + bagianCuti() + bagianKeluhan() + bagianStatus() + (pesan ? `<p class="knp-msg">${esc(pesan)}</p>` : '');
    body.querySelectorAll('[data-knp]').forEach((b) => { b.disabled = sibuk; });
    tandaiBell();
  }
  const muatDaftarNotif = (paksa) => NT()?.riwayat(paksa).then((l) => { riwayatNotif = (l || []).filter((x) => x && x.tag !== 'kito-tes').slice(0, 10); if (!sheet.hidden) gambar(); }).catch(() => {});

  async function aksi(jenis) {
    const n = NT();
    if (sibuk || !n) return;
    sibuk = true; pesan = ''; gambar();   // n.aktifkan() dipanggil di dalam ketukan yang sama (syarat izin di iPhone/Safari/Firefox)
    try {
      if (jenis === 'aktifkan') {
        const s = await n.aktifkan();
        pesan = s.mode === 'push' ? 'Notifikasi sistem aktif di perangkat ini.'
          : s.mode === 'dalam-aplikasi' ? (s.alasan === 'ditolak' ? 'Izin ditolak. Notifikasi tetap tampil di dalam aplikasi.' : 'Notifikasi aktif di dalam aplikasi.')
          : 'Notifikasi diaktifkan kembali.';
      } else if (jenis === 'matikan') {
        await n.matikan(); riwayatNotif = []; pesan = 'Notifikasi dimatikan di perangkat ini.';
      } else if (jenis === 'tes') {
        const r = await n.tes();
        pesan = r.ok ? (n.state().kanal === 'push' ? 'Notifikasi tes dikirim. Periksa notifikasi perangkat.' : 'Notifikasi tes dikirim. Banner muncul sebentar lagi.') : 'Tes gagal dikirim; coba matikan lalu aktifkan lagi.';
      }
    } catch (e) { pesan = 'Gagal: ' + e.message; }
    sibuk = false; gambar();
    if (jenis !== 'matikan') muatDaftarNotif(true);
  }

  function buka() {
    sheet.hidden = false; document.body.classList.add('knp-open');
    pesan = ''; gambar();
    muatKeluhan(true).then(() => { if (!sheet.hidden) gambar(); });
    muatCuti(true).then(() => { if (!sheet.hidden) gambar(); segarKartuCuti(); });
    muatDaftarNotif(true);
    sheet.querySelector('.knp-x').focus();
  }
  const tutup = () => { sheet.hidden = true; document.body.classList.remove('knp-open'); bell.focus(); };

  bell.addEventListener('click', buka);
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-knp-tutup]')) return tutup();
    if (e.target.closest('[data-knp-lapor]')) { sheet.hidden = true; document.body.classList.remove('knp-open'); return window.KITO_MASUKAN?.laporCabang(); }
    const bl = e.target.closest('[data-knp-balas]');
    if (bl) {
      const t = body.querySelector('#knp-bt'); if (t) kel.pesanBalas = t.value;
      const id = +bl.dataset.knpBalas; if (kel.buka !== id) kel.pesanBalas = '';
      kel.buka = id || null; gambar(); body.querySelector('#knp-bt')?.focus(); return;
    }
    const kr = e.target.closest('[data-knp-kirim]'); if (kr) return kirimBalasan(+kr.dataset.knpKirim);
    const nu = e.target.closest('[data-knp-url]');
    if (nu) { const h = urlAman(nu.dataset.knpUrl); if (h) { tutup(); location.assign(h); } return; }
    const b = e.target.closest('[data-knp]'); if (b) aksi(b.dataset.knp);
  });
  // login / logout: perbarui daftar keluhan & angka di lonceng (daftar mengikuti akun, bukan cabang di header)
  window.addEventListener('kito-akun', () => {
    muatKeluhan().then(() => { if (!sheet.hidden) gambar(); });
    muatCuti().then(() => { if (!sheet.hidden) gambar(); segarKartuCuti(); });
    segarKartuCuti();
    if (!sheet.hidden) gambar();
  });
  // kartu rencana tidak masuk ikut digambar ulang setiap halaman berganti
  if (typeof render === 'function') {
    const renderAsli = render;
    render = function (...x) { const r = renderAsli.apply(this, x); try { segarKartuCuti(); } catch (e) {} return r; };
  }
  muatCuti().then(segarKartuCuti);
  // rencana baru dikirim dari form (masukan.js): muat ulang daftar & kartu
  window.addEventListener('kito-cuti', () => { muatCuti(true).then(() => { segarKartuCuti(); if (!sheet.hidden) gambar(); }); });
  muatKeluhan();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) tutup(); });

  // status notifikasi berubah (izin dijawab, beralih push <-> dalam aplikasi, dimatikan): titik di lonceng & panel ikut diperbarui
  window.addEventListener('kito-notif', () => {
    tandaiBell();
    if (!sheet.hidden) { const t = body.querySelector('#knp-bt'); if (t) kel.pesanBalas = t.value; gambar(); }
  });
  tandaiBell();
})();
