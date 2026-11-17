/* Notifikasi KITO OTOMATIS: izin & pendaftaran langsung saat aplikasi dibuka (tanpa menu di ikon 🔔), satu input admin untuk semua perangkat.

   Dua kanal, dipilih sendiri oleh perangkat:
   - PUSH (Web Push): Chrome, Edge, Firefox, Safari/PWA iPhone, dan aplikasi Android TWA. Sampai walau aplikasi ditutup.
       Izin diminta otomatis saat aplikasi dibuka. Chrome/Edge/TWA langsung menampilkan permintaan izin; Firefox, Safari, dan iPhone
       mewajibkan ketukan pengguna, jadi muncul kartu "Aktifkan notifikasi" sekali ketuk (bukan lewat ikon 🔔).
   - DALAM APLIKASI: APK WebView (Android WebView tidak punya Push API), iPhone di Safari, izin ditolak, jaringan kantor yang memblokir
       layanan push. Notifikasi yang sama diambil lewat polling ke backend (push-php/lib/inbox.php) dan tampil sebagai banner saat KITO terbuka.
   Topik otomatis: "semua", jabatan akun login, cabang & area (akun BOM/ASM/SQO Area) atau cabang terakhir yang dibuka (tamu).
   Dimatikan pengguna lewat 🔔 › Status notifikasi (tersimpan di perangkat, tidak diminta lagi).
   Bila suatu saat APK dibangun ulang dari tools/android-webview-src (jembatan window.KitoAndroid), modul ini otomatis memakainya:
   ID perangkat "wv-…" dan izin Android 13 lewat jembatan, sehingga worker APK ikut mengambil notifikasi di latar belakang.
   API untuk push.js: window.KITO_NOTIF = { state(), aktifkan(), matikan(), tes(), riwayat(), bukaDaftar() } + event "kito-notif". Gaya: assets/css/push.css (.kn-*) */
(() => {
  'use strict';
  const API = (window.KITO_PUSH?.api || '').replace(/\/+$/, '');
  if (!API || !window.fetch) return;

  /* ---------- lingkungan ---------- */
  const root = document.documentElement;
  const ua = navigator.userAgent;
  const bridge = (() => { try { const b = window.KitoAndroid; return b && typeof b.getDeviceId === 'function' ? b : null; } catch (e) { return null; } })();
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isFirefox = /Firefox\//.test(ua);
  const isSafariDesktop = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|CriOS|Edg\/|OPR\/|Android/.test(ua) && !isIOS;
  const isAndroid = /Android/.test(ua);
  const isTWA = (() => { try { return document.referrer.startsWith('android-app://') || sessionStorage.getItem('kitoTWA') === '1'; } catch (e) { return document.referrer.startsWith('android-app://'); } })();
  if (isTWA) { try { sessionStorage.setItem('kitoTWA', '1'); } catch (e) {} }
  const standalone = isTWA || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  const isWebView = !isTWA && (!!bridge || /; wv\)|KITO-Android/.test(ua));   // aplikasi Android berbasis WebView (APK KITO)
  const app = isTWA ? 'twa' : isWebView ? 'apk' : standalone ? 'pwa' : 'web';
  // WebView tidak punya Push API / Notifications API walau sebagian peramban dalam-aplikasi menampilkannya: selalu kanal dalam-aplikasi
  const pushDidukung = !isWebView && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext !== false;
  const perluGesture = isIOS || isFirefox || isSafariDesktop;   // izin hanya boleh diminta dari ketukan pengguna

  /* ---------- penyimpanan lokal (tahan terhadap mode privat) ---------- */
  const LS = {
    g(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    s(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    d(k) { try { localStorage.removeItem(k); } catch (e) {} },
    j(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    sj(k, v) { return LS.s(k, JSON.stringify(v)); },
  };
  const lsAda = (() => { try { localStorage.setItem('kito-notif-uji', '1'); localStorage.removeItem('kito-notif-uji'); return true; } catch (e) { return false; } })();
  const K = { mati: 'kito-notif-off', since: 'kito-notif-since', reg: 'kito-notif-reg', coba: 'kito-notif-coba', nanti: 'kito-notif-nanti', hint: 'kito-notif-hint', log: 'kito-notif-log' };
  const ID_OK = /^[A-Za-z0-9_-]{8,64}$/;
  const acak = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^A-Za-z0-9-]/g, '');
  const deviceId = (() => {
    if (bridge) { try { const v = String(bridge.getDeviceId() || ''); if (ID_OK.test(v)) return v; } catch (e) {} }   // "wv-<uuid>": sama dengan yang dipakai worker APK
    if (!lsAda) return null;   // tanpa penyimpanan ID berganti tiap halaman dibuka: jangan mendaftarkan perangkat
    let v = LS.g('kito-device-id');
    if (!v || !ID_OK.test(v)) { v = acak(); LS.s('kito-device-id', v); }
    return v;
  })();
  const mati = () => LS.g(K.mati) === '1';

  /* ---------- jaringan ---------- */
  const http = async (method, path, body, ms = 15000) => {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    let r;
    try {
      r = await fetch(API + path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: c.signal, cache: 'no-store', credentials: 'omit' });
    } catch (e) {
      // offline saat mematikan: antre lewat service worker (Background Sync) supaya server tetap tahu
      if (method === 'DELETE' && navigator.serviceWorker?.controller) { navigator.serviceWorker.controller.postMessage({ type: 'kito-antre', item: { url: API + path, method, body: JSON.stringify(body) } }); return { ok: true, diantre: true }; }
      throw new Error(navigator.onLine ? 'server tidak bisa dihubungi' : 'perangkat sedang offline');
    } finally { clearTimeout(t); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'server tidak merespons (' + r.status + ')'); e.status = r.status; throw e; }
    return j;
  };
  const enc = encodeURIComponent;
  const batas = (p, ms, pesan) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(pesan || 'waktu habis')), ms))]);
  const keyBytes = (b64) => { const r = atob(b64.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
  const siapUI = () => new Promise((ok) => {   // banner baru tampil setelah splash selesai
    if (root.classList.contains('kito-siap')) return ok();
    const mo = new MutationObserver(() => { if (root.classList.contains('kito-siap')) { mo.disconnect(); ok(); } });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    setTimeout(() => { mo.disconnect(); ok(); }, 14000);
  });

  /* ---------- topik otomatis ---------- */
  const slug = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const kunciArea = (x) => String(x || '').toUpperCase().replace(/^\s*AREA\s+/, '').replace(/[^A-Z0-9]/g, '');
  const akun = () => { try { return window.KITO_AKUN?.kini() || null; } catch (e) { return null; } };
  const cabangData = () => { try { return typeof D !== 'undefined' && Array.isArray(D.B) ? D.B : []; } catch (e) { return []; } };
  const cabangDipilih = () => { try { const b = typeof st !== 'undefined' ? cabangData()[st.b] : null; return b ? { kode: String(b[0]), nama: b[1], area: b[2] } : null; } catch (e) { return null; } };
  function topikSaatIni() {
    const t = new Set(['semua']);
    const a = akun(), B = cabangData();
    if (a) {
      if (/^[a-z]{2,10}$/.test(a.jab || '')) t.add('jabatan:' + a.jab);                    // admin bisa menyasar satu jabatan: topik "jabatan:bom", "jabatan:asm", ...
      if (a.jab === 'bom' && a.cab) {                                                       // BOM-BOS: cabangnya sendiri + areanya
        t.add('cabang:' + a.cab);
        const b = B.find((x) => String(x[0]) === String(a.cab));
        if (b?.[2]) t.add('area:' + slug(b[2]));
      } else if ((a.jab === 'asm' || a.jab === 'sqoa') && a.area) {                         // ASM & SQO Area: areanya
        const nama = [...new Set(B.map((x) => x[2]))].find((n) => kunciArea(n) === a.area);
        if (nama) t.add('area:' + slug(nama));
      }
    } else {                                                                                // tamu: cabang yang terakhir dibuka di dashboard
      const p = cabangDipilih();
      if (p) { t.add('cabang:' + p.kode); if (p.area) t.add('area:' + slug(p.area)); }
    }
    return [...t].filter((x) => /^[a-z0-9][a-z0-9:_.\- ]{0,63}$/.test(x)).sort();
  }
  const labelPerangkat = () => { const a = akun(); return String(a ? (a.jabatan || a.jab || '') : (cabangDipilih()?.nama || '')).slice(0, 120) || null; };

  /* ---------- keadaan ---------- */
  const S = { mode: 'memulai', alasan: null, kanal: null, sub: null, reg: null, topik: [], jeda: 60 };
  const izinSekarang = () => ('Notification' in window ? Notification.permission : 'tidak-ada');
  function state() {
    return { mode: S.mode, alasan: S.alasan, kanal: S.kanal, izin: izinSekarang(), app, ios: isIOS, android: isAndroid, standalone, bridge: !!bridge, pushDidukung, topik: S.topik.slice(), deviceId, mati: mati() };
  }
  function setMode(mode, alasan) {
    if (S.mode === mode && S.alasan === (alasan || null)) return;
    S.mode = mode; S.alasan = alasan || null;
    try { window.dispatchEvent(new CustomEvent('kito-notif', { detail: state() })); } catch (e) {}
  }

  /* ---------- pendaftaran ke server ---------- */
  let perluUlang = false;
  const regSegar = (kanal, ep) => { const r = LS.j(K.reg); return !!r && r.ch === kanal && r.ep === ep && r.top === S.topik.join(',') && Date.now() - r.ts < 7 * 864e5; };
  async function daftar(kanal, sub, paksa) {
    if (!S.topik.length) S.topik = topikSaatIni();   // jangan pernah mendaftar tanpa topik (tidak akan menerima apa pun)
    const ep = kanal === 'push' ? sub.endpoint : 'inapp:' + deviceId;
    if (!paksa && regSegar(kanal, ep)) return;
    const label = labelPerangkat();
    const j = kanal === 'push'
      ? await http('POST', '/api/subscriptions', { subscription: sub.toJSON(), topics: S.topik, standalone, deviceId: deviceId || undefined, app, label })
      : await http('POST', '/api/inapp/register', { deviceId, topics: S.topik, standalone, app, label });
    LS.sj(K.reg, { ch: kanal, ep, top: S.topik.join(','), ts: Date.now() });
    if (kanal === 'inapp' && !LS.g(K.since)) LS.s(K.since, String(j.latestId || 0));   // perangkat baru: mulai dari notifikasi terbaru, riwayat lama tidak jadi banner
    if (j.jeda) S.jeda = Math.max(30, Math.min(600, +j.jeda || 60));
    perluUlang = false;
  }

  /* ---------- kanal PUSH ---------- */
  async function swSiap() {
    const reg = await navigator.serviceWorker.register('sw.js?api=' + enc(API), { scope: './' });
    await batas(navigator.serviceWorker.ready, 10000, 'service worker belum siap');
    return reg;
  }
  const samaKunci = (sub, kunci) => {
    try { const k = sub.options?.applicationServerKey; if (!k) return true; const a = new Uint8Array(k); return a.length === kunci.length && a.every((v, i) => v === kunci[i]); } catch (e) { return true; }
  };
  // langganan push yang sah untuk kunci VAPID server saat ini (kunci server berganti = langganan lama harus dibuat ulang)
  async function pastikanLangganan(reg, sub) {
    let kunci;
    try { kunci = keyBytes((await http('GET', '/api/vapid-public-key')).publicKey); }
    catch (e) { if (sub) { perluUlang = true; return sub; } throw e; }   // server belum terjangkau (mis. offline) tetapi langganan sudah ada: tetap jalur push, diperiksa & didaftarkan ulang saat online
    if (sub && !samaKunci(sub, kunci)) { try { await sub.unsubscribe(); } catch (e) {} sub = null; }
    return sub || await batas(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunci }), 25000, 'layanan push tidak menjawab');
  }
  let pushJalan = null;
  const aktifPush = () => pushJalan || (pushJalan = aktifPushInti().finally(() => { pushJalan = null; }));   // satu proses sekaligus (ketukan, permissionchange, dan alur awal bisa bersamaan)
  async function aktifPushInti() {
    let sub;
    try {
      const reg = await swSiap(); S.reg = reg;
      sub = await reg.pushManager.getSubscription();
      if (!(sub && regSegar('push', sub.endpoint))) sub = await pastikanLangganan(reg, sub);
    } catch (e) { return dalamAplikasi('push-gagal'); }   // mis. jaringan kantor memblokir layanan push (FCM): tetap dapat banner dalam aplikasi
    S.sub = sub; S.kanal = 'push'; berhentiPoll(); setMode('push');
    try { await daftar('push', sub); }
    catch (e) {
      if (e.status >= 400 && e.status < 500 && e.status !== 429) { try { await sub.unsubscribe(); } catch (er) {} return dalamAplikasi('push-ditolak'); }   // server menolak langganan ini
      perluUlang = true;   // jaringan/server bermasalah: dicoba lagi saat online / buka berikutnya
    }
    muatRiwayat(false);
  }

  /* ---------- kanal DALAM APLIKASI ---------- */
  async function dalamAplikasi(alasan) {
    if (mati()) return;
    S.kanal = 'inapp'; S.sub = null; setMode('dalam-aplikasi', alasan);
    if (!deviceId) return;
    try { await daftar('inapp'); } catch (e) { perluUlang = true; }
    mulaiPoll();
    if (alasan === 'tidak-didukung' && isIOS && !standalone) petunjukIOS();
  }

  let timerPoll = null, sedangPoll = false;
  const jedaPoll = () => S.jeda * 1000 + Math.random() * 4000;
  function berhentiPoll() { clearTimeout(timerPoll); timerPoll = null; }
  function mulaiPoll() { berhentiPoll(); if (S.kanal === 'inapp' && !mati()) timerPoll = setTimeout(() => poll(), 1500 + Math.random() * 2500); }
  async function poll(segera) {
    if (S.kanal !== 'inapp' || mati() || sedangPoll || !deviceId) return;
    if (document.visibilityState !== 'visible' || !navigator.onLine) return;   // dilanjutkan oleh visibilitychange / online
    sedangPoll = true; clearTimeout(timerPoll);
    try {
      const since = parseInt(LS.g(K.since) || '0', 10) || 0;
      const r = await http('GET', `/api/inbox/poll?device_id=${enc(deviceId)}&since_id=${since}`);
      if (r.terdaftar === false) {   // server tidak mengenal baris dalam-aplikasi perangkat ini: dibersihkan, basis data direset, atau tab lain sudah beralih ke push
        if (pushDidukung && izinSekarang() === 'granted') { sedangPoll = false; return aktifPush(); }   // JANGAN mendaftar ulang dalam-aplikasi: itu menghapus langganan push tab lain
        await daftar('inapp', null, true);
      }
      if (r.jeda) S.jeda = Math.max(30, Math.min(600, +r.jeda || 60));
      if (typeof r.latestId === 'number' && r.latestId !== since) LS.s(K.since, String(r.latestId));
      if ((r.notifications || []).length) { catatLog(r.notifications); await siapUI(); tampilToast(r.notifications, r.lebih || 0); }
    } catch (e) { S.jeda = Math.min(300, S.jeda + 30); }   // gagal: perlambat sementara
    sedangPoll = false;
    if (S.kanal === 'inapp' && !mati() && document.visibilityState === 'visible') timerPoll = setTimeout(() => poll(), jedaPoll());
  }
  document.addEventListener('visibilitychange', () => {
    if (S.kanal !== 'inapp') return;
    if (document.visibilityState === 'visible') { clearTimeout(timerPoll); timerPoll = setTimeout(() => poll(), 400); }   // susul yang terlewat saat aplikasi di latar belakang
    else berhentiPoll();
  });
  addEventListener('online', () => {
    if (mati()) return;
    if (perluUlang) { if (S.kanal === 'push' && S.sub) aktifPush().catch(() => {}); else if (S.kanal === 'inapp') daftar('inapp', null, true).catch(() => {}); }   // push: periksa kunci server lalu daftar ulang
    if (S.kanal === 'inapp') { clearTimeout(timerPoll); timerPoll = setTimeout(() => poll(), 800); }
  });

  /* ---------- riwayat ---------- */
  // daftar "Notifikasi terbaru": 10 terakhir, tanpa notifikasi tes (tes hanya tampil langsung kepada yang menekan "Kirim tes")
  const MAKS_RIWAYAT = 10;
  const bukanTes = (x) => !!x && x.tag !== 'kito-tes';
  const catatLog = (daftarBaru) => {
    const lama = LS.j(K.log) || [];
    const ids = new Set(daftarBaru.map((x) => x.id));
    LS.sj(K.log, [...daftarBaru.filter(bukanTes).slice().reverse(), ...lama.filter((x) => !ids.has(x.id) && bukanTes(x))].slice(0, MAKS_RIWAYAT));
  };
  let muatSedang = null;
  function muatRiwayat(paksa) {
    if (!deviceId || mati()) return Promise.resolve((LS.j(K.log) || []).filter(bukanTes).slice(0, MAKS_RIWAYAT));
    if (muatSedang && !paksa) return muatSedang;
    muatSedang = http('GET', `/api/inbox?device_id=${enc(deviceId)}&limit=${MAKS_RIWAYAT}`).then((r) => { const l = (r.riwayat || []).filter(bukanTes).slice(0, MAKS_RIWAYAT); if (r.terdaftar) LS.sj(K.log, l); return l; })
      .catch(() => (LS.j(K.log) || []).filter(bukanTes).slice(0, MAKS_RIWAYAT)).finally(() => { setTimeout(() => { muatSedang = null; }, 3000); });
    return muatSedang;
  }

  /* ---------- tampilan: banner dalam aplikasi, kartu izin, petunjuk ---------- */
  const el = (tag, cls, teks) => { const e = document.createElement(tag); if (cls) e.className = cls; if (teks != null) e.textContent = teks; return e; };
  const wadah = () => {
    let w = document.getElementById('kn-wadah');
    if (!w) { w = el('div', 'kn-wadah'); w.id = 'kn-wadah'; document.body.appendChild(w); }
    return w;
  };
  const urlAman = (u) => { try { const x = new URL(u, location.href); return x.protocol === 'https:' || (x.protocol === 'http:' && location.protocol === 'http:') ? x.href : null; } catch (e) { return null; } };
  const bukaUrl = (u) => { const h = urlAman(u); if (h && h !== location.href) location.assign(h); };
  const kartu = (kelas, judul, isi, role) => {
    const k = el('section', 'kn-kartu ' + kelas); k.setAttribute('role', role || 'status');
    const ik = el('img', 'kn-ik'); ik.src = 'assets/images/ios/icon-192.png'; ik.alt = ''; ik.width = 36; ik.height = 36;
    const tx = el('div', 'kn-tx'); tx.appendChild(el('b', 'kn-jd', judul)); if (isi) tx.appendChild(el('p', 'kn-is', isi));
    const x = el('button', 'kn-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Tutup');
    k.append(ik, tx, x);
    return { k, tx, x };
  };
  const tombol = (teks, kelas, fn) => { const b = el('button', 'kn-btn ' + (kelas || ''), teks); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const lepas = (k) => { if (!k) return; k.classList.add('keluar'); setTimeout(() => k.remove(), 220); };

  // banner notifikasi (kanal dalam aplikasi): yang terbaru ditampilkan, sisanya dihitung "+N lainnya" dan ada di daftar 🔔
  let toast = null, toastTimer = null;
  function tutupToast() { clearTimeout(toastTimer); lepas(toast); toast = null; }
  function tampilToast(list, lebih) {
    const n = list[list.length - 1], lain = list.length - 1 + lebih;
    tutupToast();
    const tinggi = n.urgensi === 'high';
    const { k, tx, x } = kartu('kn-toast' + (tinggi ? ' tinggi' : ''), n.title, n.body, tinggi ? 'alert' : 'status');
    const meta = el('small', 'kn-mt', 'KITO · baru saja' + (lain > 0 ? ` · +${lain} notifikasi lain` : '')); tx.appendChild(meta);
    const aksi = el('div', 'kn-ak');
    const aksiDaftar = Array.isArray(n.aksi) && n.aksi.length ? n.aksi.slice(0, 2) : (urlAman(n.url) && urlAman(n.url) !== location.href ? [{ title: 'Buka', url: n.url }] : []);
    aksiDaftar.forEach((a) => aksi.appendChild(tombol(String(a.title || 'Buka').slice(0, 40), '', () => { tutupToast(); bukaUrl(a.url || n.url); })));
    if (lain > 0) aksi.appendChild(tombol('Lihat semua', 'sec', () => { tutupToast(); bukaDaftar(); }));
    if (aksi.children.length) tx.appendChild(aksi);
    x.addEventListener('click', tutupToast);
    k.addEventListener('click', (e) => { if (!e.target.closest('button') && urlAman(n.url)) { tutupToast(); bukaUrl(n.url); } });
    wadah().appendChild(k); toast = k;
    try { if (navigator.userActivation?.hasBeenActive && navigator.vibrate) navigator.vibrate(tinggi ? [120, 60, 120] : 80); } catch (e) {}
    if (!n.tetap) toastTimer = setTimeout(tutupToast, tinggi ? 30000 : 12000);
  }

  // kartu izin: hanya untuk peramban yang mewajibkan ketukan pengguna, atau bila permintaan otomatis belum dijawab
  let kartuIzin = null;
  const sembunyiIzin = () => { lepas(kartuIzin); kartuIzin = null; };
  async function tampilIzin() {
    if (kartuIzin || mati() || S.kanal === 'push' || izinSekarang() !== 'default') return;
    if (Date.now() < (+LS.g(K.nanti) || 0)) return;
    await siapUI();
    if (kartuIzin || mati() || S.kanal === 'push' || izinSekarang() !== 'default') return;
    const { k, tx, x } = kartu('kn-izin', 'Aktifkan notifikasi KITO', 'Dapatkan update data harian dan peringatan cabang, juga saat aplikasi ditutup.');
    const aksi = el('div', 'kn-ak');
    aksi.appendChild(tombol('Aktifkan', '', () => { const p = mintaIzin(); sembunyiIzin(); p.then(terapkanIzin); }));   // mintaIzin() dipanggil langsung dari ketukan (syarat iOS/Safari/Firefox)
    aksi.appendChild(tombol('Nanti', 'sec', () => { LS.s(K.nanti, String(Date.now() + 3 * 864e5)); sembunyiIzin(); }));
    tx.appendChild(aksi);
    x.addEventListener('click', () => { LS.s(K.nanti, String(Date.now() + 3 * 864e5)); sembunyiIzin(); });
    wadah().appendChild(k); kartuIzin = k;
  }

  // petunjuk satu kali (maks. tiap 14 hari)
  async function petunjuk(kunci, judul, isi) {
    if (Date.now() < (+LS.g(K.hint + ':' + kunci) || 0)) return;
    await siapUI();
    const { k, tx, x } = kartu('kn-petunjuk', judul, isi);
    const tutup = () => { LS.s(K.hint + ':' + kunci, String(Date.now() + 14 * 864e5)); lepas(k); };
    const aksi = el('div', 'kn-ak'); aksi.appendChild(tombol('Mengerti', '', tutup)); tx.appendChild(aksi);
    x.addEventListener('click', tutup);
    wadah().appendChild(k);
    setTimeout(() => { if (k.isConnected) tutup(); }, 20000);
  }
  const caraIzin = () => (isIOS ? 'Pengaturan › Notifikasi › KITO' : isTWA || isAndroid ? 'Pengaturan › Aplikasi › KITO (atau Chrome) › Notifikasi' : 'ikon gembok di samping alamat › Notifikasi › Izinkan');
  const petunjukDitolak = () => petunjuk('ditolak', 'Notifikasi sistem diblokir', `Anda tetap menerima notifikasi di dalam aplikasi. Agar notifikasi juga masuk saat aplikasi ditutup, izinkan lewat ${caraIzin()}.`);
  const petunjukIOS = () => petunjuk('ios', 'Pasang KITO di Layar Utama', 'Agar notifikasi tetap masuk saat aplikasi ditutup: ketuk tombol Bagikan lalu Tambah ke Layar Utama, dan buka KITO dari sana.');

  /* ---------- izin ---------- */
  const mintaIzin = () => new Promise((ok) => {
    let p;
    try { p = Notification.requestPermission(ok); } catch (e) { return ok(izinSekarang()); }   // bentuk callback untuk Safari lama; bentuk promise untuk yang baru
    if (p && p.then) p.then(ok, () => ok(izinSekarang()));
  });
  function terapkanIzin(izin) {   // mengembalikan promise: aktifkan() menunggu hasil akhirnya
    if (mati()) return Promise.resolve();
    if (izin === 'granted') { sembunyiIzin(); return S.kanal !== 'push' ? aktifPush() : Promise.resolve(); }
    if (izin === 'denied') { sembunyiIzin(); petunjukDitolak(); return dalamAplikasi('ditolak'); }
    LS.s(K.nanti, String(Date.now() + 3 * 864e5)); sembunyiIzin();   // ditutup tanpa memilih
    return S.kanal !== 'inapp' ? dalamAplikasi('menunggu') : Promise.resolve();
  }
  // permintaan otomatis saat aplikasi dibuka: maks. 3 kali, minimal 12 jam sekali (agar tidak memicu pemblokiran otomatis peramban)
  const bolehCoba = () => { const c = LS.j(K.coba) || { n: 0, ts: 0 }; return c.n < 3 && Date.now() - c.ts > 12 * 3600e3; };
  const catatCoba = () => { const c = LS.j(K.coba) || { n: 0, ts: 0 }; LS.sj(K.coba, { n: c.n + 1, ts: Date.now() }); };
  async function izinOtomatis() {
    if (!bolehCoba()) { await dalamAplikasi('menunggu'); return tampilIzin(); }
    catatCoba();
    // permintaan tidak terlihat / belum dijawab (mis. ikon izin senyap di Chrome): sediakan kartu sendiri, jawaban permintaan asli tetap diproses
    const t = setTimeout(() => { if (izinSekarang() === 'default' && S.kanal !== 'push') { dalamAplikasi('menunggu'); tampilIzin(); } }, 6000);
    mintaIzin().then((izin) => { clearTimeout(t); terapkanIzin(izin); });
  }
  try { navigator.permissions?.query({ name: 'notifications' }).then((p) => { p.onchange = () => terapkanIzin(izinSekarang()); }).catch(() => {}); } catch (e) {}

  /* ---------- alur utama ---------- */
  let antri = Promise.resolve();
  const berurutan = (fn) => (antri = antri.then(fn, fn).catch(() => {}));
  async function mulai() {
    if (mati()) { setMode('mati'); return; }
    S.topik = topikSaatIni();
    if (bridge) { try { bridge.requestPermission(); } catch (e) {} try { bridge.saveTopics(JSON.stringify(S.topik)); } catch (e) {} }   // jembatan APK (bila ada): izin Android 13 + topik untuk worker
    if (!pushDidukung) return dalamAplikasi(isWebView ? 'webview' : 'tidak-didukung');
    const izin = izinSekarang();
    if (izin === 'granted') return aktifPush();
    if (izin === 'denied') { await dalamAplikasi('ditolak'); return petunjukDitolak(); }
    if (perluGesture) { await dalamAplikasi('menunggu'); return tampilIzin(); }
    return izinOtomatis();
  }

  // login / logout / ganti profil: topik mengikuti akun
  let tundaTopik = null;
  addEventListener('kito-akun', () => {
    clearTimeout(tundaTopik);
    tundaTopik = setTimeout(() => berurutan(async () => {
      if (mati() || S.mode === 'memulai') return;
      const baru = topikSaatIni();
      if (baru.join(',') === S.topik.join(',')) return;
      S.topik = baru;
      if (bridge) { try { bridge.saveTopics(JSON.stringify(S.topik)); } catch (e) {} }
      try { if (S.kanal === 'push' && S.sub) await daftar('push', S.sub); else if (S.kanal === 'inapp') await daftar('inapp', null, true); } catch (e) { perluUlang = true; }
    }), 1500);
  });

  /* ---------- API untuk push.js ---------- */
  function bukaDaftar() { document.getElementById('kito-bell')?.click(); }
  async function aktifkan() {
    LS.d(K.mati); LS.d(K.nanti); LS.d(K.coba);
    if (pushDidukung && izinSekarang() === 'default') { const izin = await mintaIzin(); S.topik = topikSaatIni(); await terapkanIzin(izin); return state(); }   // mintaIzin() dipanggil di dalam ketukan pengguna
    await berurutan(mulai);
    return state();
  }
  async function matikan() {
    LS.s(K.mati, '1'); berhentiPoll(); tutupToast(); sembunyiIzin();
    let ep = S.sub?.endpoint;
    try {
      const reg = S.reg || (pushDidukung ? await navigator.serviceWorker.getRegistration() : null);
      const sub = S.sub || (reg ? await reg.pushManager.getSubscription() : null);
      if (sub) { ep = sub.endpoint; await sub.unsubscribe().catch(() => {}); }
    } catch (e) {}
    try { if (ep) await http('DELETE', '/api/subscriptions', { endpoint: ep }); } catch (e) {}
    try { if (deviceId) await http('DELETE', '/api/subscriptions', { endpoint: 'inapp:' + deviceId }); } catch (e) {}
    LS.d(K.reg); S.sub = null; S.kanal = null; setMode('mati');
    return state();
  }
  async function tes() {
    const ep = S.kanal === 'push' && S.sub ? S.sub.endpoint : deviceId ? 'inapp:' + deviceId : null;
    if (!ep) throw new Error('perangkat belum terdaftar');
    const r = await http('POST', '/api/subscriptions/test', { endpoint: ep });
    if (S.kanal === 'inapp') setTimeout(() => poll(true), 1200);   // notifikasi tes segera diambil
    return r;
  }

  window.KITO_NOTIF = { state, aktifkan, matikan, tes, riwayat: muatRiwayat, bukaDaftar };

  const awal = () => setTimeout(() => berurutan(mulai), 900 + Math.random() * 1200);   // jeda acak: banyak perangkat membuka aplikasi bersamaan
  document.readyState === 'complete' ? awal() : addEventListener('load', awal);
})();
