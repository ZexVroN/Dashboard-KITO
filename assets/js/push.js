/* Notifikasi push KITO di dashboard: tombol 🔔 di header + panel berlangganan per topik.
   Topik: "semua" (update data harian & ringkasan Region II), "area:<nama area>", "cabang:<kode>".
   Website & desktop: Chrome/Edge/Firefox/Safari. Android: Chrome (juga saat dipasang).
   iOS/iPadOS 16.4+: hanya dari aplikasi yang sudah ditambahkan ke Layar Utama (aturan Apple).
   Server: folder push-server/, alamat diatur di assets/js/push-config.js. Gaya: assets/css/push.css */
(() => {
  'use strict';
  const API = (window.KITO_PUSH?.api || '').replace(/\/+$/, '');
  const btnTema = document.getElementById('tema');
  if (!API || !btnTema) return;

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // aplikasi Android TWA (Chrome di dalam APK KITO): push didukung penuh
  const isTWA = document.referrer.startsWith('android-app://') || sessionStorage.getItem('kitoTWA') === '1';
  if (isTWA) { try { sessionStorage.setItem('kitoTWA', '1'); } catch (e) {} }
  const standalone = isTWA || window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  const didukung = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  // perangkat/browser tanpa Web Push (APK lama berbasis WebView, browser lama, Safari iOS di luar Layar Utama):
  // ikon 🔔 tetap tampil; panel hanya berisi tombol lapor keluhan cabang + keterangan
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const keyBytes = (b64) => { const r = atob(b64.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
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
  bell.setAttribute('aria-label', 'Notifikasi keluhan cabang'); bell.innerHTML = '🔔<i></i>';
  btnTema.before(bell);

  const sheet = document.createElement('div');
  sheet.className = 'knp-wrap'; sheet.hidden = true;
  sheet.innerHTML = '<div class="knp-bg" data-knp-tutup></div><section class="knp" role="dialog" aria-modal="true" aria-labelledby="knp-h"><div class="knp-head"><h2 id="knp-h">🔔 Notifikasi Keluhan Cabang</h2><button type="button" class="knp-x" data-knp-tutup aria-label="Tutup">×</button></div><div class="knp-body"></div></section>';
  document.body.appendChild(sheet);
  const body = sheet.querySelector('.knp-body');

  let reg = null, sub = null, server = { terdaftar: false, topics: [] }, pesan = '', sibuk = false;

  async function siapkanSW() {
    if (!didukung) return null;
    reg = await navigator.serviceWorker.register('sw.js?api=' + encodeURIComponent(API), { scope: './' });
    await navigator.serviceWorker.ready;
    sub = await reg.pushManager.getSubscription();
    return reg;
  }

  async function segarkanStatus() {
    if (!sub) { server = { terdaftar: false, topics: [] }; return; }
    try { server = await api('POST', '/api/subscriptions/status', { endpoint: sub.endpoint }); }
    catch (e) { pesan = 'Tidak bisa menghubungi server notifikasi: ' + e.message; }
  }

  function tandaiBell() {
    const aktif = !!sub && server.terdaftar;
    bell.classList.toggle('on', aktif);
    bell.title = aktif ? 'Notifikasi keluhan cabang · aktif' : 'Notifikasi keluhan cabang';
  }

  function opsiTopik() {
    const p = pilihan();
    const ada = new Set(server.terdaftar ? server.topics : ['semua', p.area && topikArea(p.area), p.kode && 'cabang:' + p.kode].filter(Boolean));
    const opsi = [['semua', 'Update data harian', 'Pemberitahuan saat data dashboard diperbarui + ringkasan Region II']];
    if (p.area) opsi.push([topikArea(p.area), `Area ${p.area}`, 'Ringkasan waktu tunggu area ini']);
    if (p.kode) opsi.push(['cabang:' + p.kode, p.cabang, 'Peringatan bila waktu tunggu cabang ini tinggi']);
    // topik lain yang sudah diikuti (mis. area/cabang yang dipilih sebelumnya)
    for (const t of server.topics || []) if (!opsi.some((o) => o[0] === t)) opsi.push([t, t.replace(/^area:/, 'Area ').replace(/^cabang:/, 'Cabang '), 'Diikuti sebelumnya']);
    return opsi.map(([v, n, k]) => `<label class="knp-opt"><input type="checkbox" value="${esc(v)}" ${ada.has(v) ? 'checked' : ''}><span><b>${esc(n)}</b><small>${esc(k)}</small></span></label>`).join('');
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
    if (!a) return `<p class="knp-g">Keluhan &amp; feedback</p><p class="knp-kosong">Keluhan hanya dapat dibaca oleh akun pelapor dan tim tindak lanjut. Login untuk melihat keluhan yang Anda kirim beserta balasannya.</p>`
      + (p.kode ? `<p class="knp-note knp-as">Laporan cabang ${esc(p.kode)} diteruskan ke <b>${esc(penerima(areaCabang()).join(', '))}</b>.</p>` : '');
    const nBuka = (kel.list || []).filter(terbuka).length;
    const judul = masuk
      ? `<p class="knp-g">📥 Keluhan masuk · ${esc(namaCakupan(a))}${nBuka ? ` <span class="knp-nb">${nBuka} belum selesai</span>` : ''}</p>`
      : `<p class="knp-g">Keluhan saya · ${esc(a.nama)}</p>`;
    if (kel.muat && !kel.list) return judul + '<p class="knp-note">Memuat keluhan…</p>';
    const list = kel.list || [];
    let info;
    if (masuk) info = `<p class="knp-note knp-as">Anda login sebagai <b>${esc(a.jabatan)}</b>. Keluhan cabang di ${esc(namaCakupan(a))} masuk ke sini dan dapat Anda balas.</p>`;
    else if (a && PEMBALAS.includes(a.jab)) info = `<p class="knp-msg">Untuk membalas, logout lalu login ulang sebagai ${esc(a.jab === 'asm' ? 'ASM' : 'SQO Area')} dengan memilih nama dan area Anda.</p>`;
    else info = `<p class="knp-note knp-as">Hanya akun Anda yang dapat membaca keluhan ini. Laporan diteruskan ke <b>${esc(penerima(areaCabang()).join(', '))}</b> untuk ditindaklanjuti.</p>`;
    if (!list.length) return judul + (kel.err ? `<p class="knp-msg">Keluhan tidak bisa dimuat: ${esc(kel.err)}</p>` : `<p class="knp-kosong">${masuk ? 'Belum ada keluhan masuk' : 'Belum ada keluhan yang Anda kirim'} dalam 120 hari terakhir.</p>`) + info;
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

  function gambar() {
    let h = '';
    if (!didukung) {
      h = `<p class="knp-status">○ Notifikasi push belum didukung di ${isTWA ? 'versi aplikasi ini' : 'browser ini'}</p><p class="knp-note">${isIOS ? 'Di iPhone/iPad, tambahkan KITO ke Layar Utama lalu buka dari sana.' : 'Perbarui aplikasi KITO atau Google Chrome ke versi terbaru untuk menerima notifikasi.'}</p>`;
      body.innerHTML = bagianLapor() + bagianKeluhan() + '<p class="knp-g knp-sep">Pengaturan notifikasi push</p>' + h + (pesan ? `<p class="knp-msg">${esc(pesan)}</p>` : '');
      return;
    }
    const izin = Notification.permission;
    if (izin === 'denied') {
      h = `<p class="knp-lead">Notifikasi <b>diblokir</b> untuk situs ini.</p><p class="knp-note">Buka pengaturan situs di browser (ikon gembok di samping alamat${isIOS ? ', atau Pengaturan › Notifikasi › KITO di iPhone' : ''}), izinkan Notifikasi, lalu muat ulang halaman.</p>`;
    } else {
      const aktif = !!sub && server.terdaftar;
      h = `<p class="knp-status ${aktif ? 'ok' : ''}">${aktif ? '● Aktif di perangkat ini' : '○ Belum aktif di perangkat ini'}</p>
        <p class="knp-g">Terima notifikasi untuk</p><div class="knp-opts">${opsiTopik()}</div>
        <div class="knp-act">${aktif
          ? '<button type="button" class="knp-btn" data-knp="simpan">Simpan pilihan</button><button type="button" class="knp-btn sec" data-knp="tes">Kirim tes</button><button type="button" class="knp-btn link" data-knp="matikan">Matikan notifikasi</button>'
          : '<button type="button" class="knp-btn" data-knp="aktifkan">Aktifkan notifikasi</button>'}</div>
        <p class="knp-note">Pilihan area dan cabang mengikuti filter di atas. Notifikasi tetap masuk walau dashboard ditutup${isIOS ? ' (selama aplikasi KITO masih terpasang)' : ''}.</p>`;
    }
    body.innerHTML = bagianLapor() + bagianKeluhan() + '<p class="knp-g knp-sep">Pengaturan notifikasi push</p>' + h + (pesan ? `<p class="knp-msg">${esc(pesan)}</p>` : '');
    body.querySelectorAll('.knp-btn').forEach((b) => { b.disabled = sibuk; });
    tandaiBell();
  }

  const topikDipilih = () => [...body.querySelectorAll('.knp-opt input:checked')].map((i) => i.value);

  async function aksi(jenis) {
    if (sibuk) return;
    sibuk = true; pesan = ''; gambar();
    try {
      if (jenis === 'aktifkan') {
        const topics = topikDipilih();
        if (!topics.length) throw new Error('pilih minimal satu jenis notifikasi');
        const izin = await Notification.requestPermission(); // harus dari ketukan pengguna (wajib di iOS)
        if (izin !== 'granted') throw new Error(izin === 'denied' ? 'izin notifikasi ditolak' : 'izin notifikasi belum diberikan');
        if (!reg) await siapkanSW();
        const { publicKey } = await api('GET', '/api/vapid-public-key');
        sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
        const p = pilihan();
        await api('POST', '/api/subscriptions', { subscription: sub.toJSON(), topics, standalone, label: p.cabang || null });
        await segarkanStatus();
        pesan = 'Notifikasi aktif. Ketuk "Kirim tes" untuk mencoba.';
      } else if (jenis === 'simpan') {
        const topics = topikDipilih();
        if (!topics.length) throw new Error('pilih minimal satu, atau ketuk "Matikan notifikasi"');
        const r = await api('PUT', '/api/subscriptions/topics', { endpoint: sub.endpoint, topics });
        if (r.diantre) { server = { terdaftar: true, topics }; pesan = 'Sedang offline: pilihan disimpan dan dikirim otomatis saat online.'; }
        else { await segarkanStatus(); pesan = 'Pilihan disimpan.'; }
      } else if (jenis === 'tes') {
        const r = await api('POST', '/api/subscriptions/test', { endpoint: sub.endpoint });
        pesan = r.ok ? 'Notifikasi tes dikirim. Periksa notifikasi perangkat.' : 'Tes gagal dikirim; coba matikan lalu aktifkan lagi.';
      } else if (jenis === 'matikan') {
        const ep = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await api('DELETE', '/api/subscriptions', { endpoint: ep }).catch(() => {});
        sub = null; server = { terdaftar: false, topics: [] }; pesan = 'Notifikasi dimatikan di perangkat ini.';
      }
    } catch (e) { pesan = 'Gagal: ' + e.message; }
    sibuk = false; gambar();
  }

  async function buka() {
    sheet.hidden = false; document.body.classList.add('knp-open');
    pesan = ''; body.innerHTML = '<p class="knp-note">Memuat…</p>';
    muatKeluhan(true).then(() => { if (!sheet.hidden) gambar(); });
    try { if (didukung && !reg) await siapkanSW(); else if (reg) sub = await reg.pushManager.getSubscription(); await segarkanStatus(); }
    catch (e) { pesan = 'Gagal menyiapkan notifikasi: ' + e.message; }
    gambar();
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
    const b = e.target.closest('[data-knp]'); if (b) aksi(b.dataset.knp);
  });
  // login / logout: perbarui daftar keluhan & angka di lonceng (daftar mengikuti akun, bukan cabang di header)
  window.addEventListener('kito-akun', () => { muatKeluhan().then(() => { if (!sheet.hidden) gambar(); }); if (!sheet.hidden) gambar(); });
  muatKeluhan();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) tutup(); });

  // status lonceng saat halaman dibuka (tanpa meminta izin)
  if (didukung) siapkanSW().then(segarkanStatus).then(tandaiBell).catch(() => {});
})();
