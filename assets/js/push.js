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
  // perangkat/browser tanpa Web Push (mis. APK lama berbasis WebView): ikon 🔔 tidak ditampilkan.
  // Kecuali Safari iOS: push tersedia setelah dashboard ditambahkan ke Layar Utama, jadi panduannya tetap ditampilkan.
  if (!didukung && !(isIOS && !standalone)) return;
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
  bell.setAttribute('aria-label', 'Pengaturan notifikasi'); bell.innerHTML = '🔔<i></i>';
  btnTema.before(bell);

  const sheet = document.createElement('div');
  sheet.className = 'knp-wrap'; sheet.hidden = true;
  sheet.innerHTML = '<div class="knp-bg" data-knp-tutup></div><section class="knp" role="dialog" aria-modal="true" aria-labelledby="knp-h"><div class="knp-head"><h2 id="knp-h">🔔 Notifikasi KITO</h2><button type="button" class="knp-x" data-knp-tutup aria-label="Tutup">×</button></div><div class="knp-body"></div></section>';
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
    bell.title = aktif ? 'Notifikasi aktif' : 'Aktifkan notifikasi';
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

  function gambar() {
    const izin = didukung ? Notification.permission : 'unsupported';
    let h = '';
    if (isIOS && !standalone) {
      h = `<p class="knp-lead">Di iPhone/iPad, notifikasi hanya bisa diterima dari <b>aplikasi KITO di Layar Utama</b> (iOS 16.4 ke atas).</p>
        <ol class="knp-steps"><li>Buka dashboard ini di <b>Safari</b>.</li><li>Ketuk tombol <b>Bagikan</b> <span aria-hidden="true">⬆︎</span>.</li><li>Pilih <b>Tambah ke Layar Utama</b>, lalu <b>Tambah</b>.</li><li>Buka <b>KITO</b> dari Layar Utama, lalu ketuk 🔔 lagi.</li></ol>`;
    } else if (izin === 'denied') {
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
    body.innerHTML = h + (pesan ? `<p class="knp-msg">${esc(pesan)}</p>` : '');
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
    try { if (didukung && !reg) await siapkanSW(); else if (reg) sub = await reg.pushManager.getSubscription(); await segarkanStatus(); }
    catch (e) { pesan = 'Gagal menyiapkan notifikasi: ' + e.message; }
    gambar();
    sheet.querySelector('.knp-x').focus();
  }
  const tutup = () => { sheet.hidden = true; document.body.classList.remove('knp-open'); bell.focus(); };

  bell.addEventListener('click', buka);
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-knp-tutup]')) return tutup();
    const b = e.target.closest('[data-knp]'); if (b) aksi(b.dataset.knp);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) tutup(); });

  // status lonceng saat halaman dibuka (tanpa meminta izin)
  if (didukung) siapkanSW().then(segarkanStatus).then(tandaiBell).catch(() => {});
})();
