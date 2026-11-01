'use strict';
/**
 * KITO Push Server — backend notifikasi push untuk website, desktop, Android, dan iOS (Web Push / VAPID).
 *
 * API publik (dipanggil dashboard dari browser, dibatasi CORS + rate limit):
 *   GET    /api/health
 *   GET    /api/vapid-public-key
 *   POST   /api/subscriptions            {subscription, topics?, label?, standalone?, oldEndpoint?}
 *   PUT    /api/subscriptions/topics     {endpoint, topics}
 *   POST   /api/subscriptions/status     {endpoint}            -> topik yang sedang diikuti
 *   DELETE /api/subscriptions            {endpoint}
 *   POST   /api/subscriptions/test       {endpoint}            -> kirim notifikasi uji ke perangkat itu sendiri
 *
 * API admin (header Authorization: Bearer <ADMIN_TOKEN>):
 *   POST   /api/notifications            {title, body?, url?, tag?, icon?, image?, ttl?, urgency?, topics?|all?|endpoints?, platforms?}
 *   POST   /api/notifications/batch      {notifications:[...]}  (maks 300)
 *   GET    /api/notifications?limit=50   riwayat
 *   GET    /api/stats                    jumlah langganan per platform/browser/topik
 *   GET    /api/scheduled                notifikasi terjadwal (sendAt di POST /api/notifications)
 *   DELETE /api/scheduled/<id>           batalkan jadwal yang belum terkirim
 *
 * Halaman admin: GET /admin  (form kirim notifikasi + statistik)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { config: defaultConfig, validate } = require('./config');
const { open } = require('./db');
const { createSender } = require('./sender');
const { detect, normTopics, hostAllowed, safeEqual, rateLimiter } = require('./util');

const MAX_BODY = 64 * 1024;
const ADMIN_HTML = path.join(__dirname, '..', 'public', 'admin.html');

<<<<<<< HEAD
/* ---------- diagnosis: /status (tanpa nilai rahasia) ---------- */
function statusInfo({ mode, store, errs = [], galat = null }) {
  const c = defaultConfig;
  const ada = (v) => (v ? 'terisi' : 'KOSONG');
  return {
    mode,                                   // normal | setup | darurat
    node: process.versions.node,
    sqliteBawaan: require('./db').sqliteTersedia(),
    penyimpanan: store ? { driver: store.driver, lokasi: store.path, peringatan: store.peringatan } : null,
    env: {
      VAPID_PUBLIC_KEY: ada(c.vapid.publicKey), VAPID_PRIVATE_KEY: ada(c.vapid.privateKey), ADMIN_TOKEN: c.adminToken ? `terisi (${c.adminToken.length} karakter)` : 'KOSONG',
      VAPID_SUBJECT: c.vapid.subject, ALLOWED_ORIGINS: c.allowedOrigins.join(', ') || 'KOSONG', DB_PATH: c.dbPath, PORT: String(c.port), TRUST_PROXY: c.trustProxy ? '1' : '0',
    },
    halamanAdminAda: fs.existsSync(ADMIN_HTML),
    masalah: [...errs, ...(galat ? [galat] : [])],
    waktu: new Date().toISOString(),
  };
}
function halamanStatus(res, s) {
  const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const baris = (k, v, buruk) => `<tr><td>${esc(k)}</td><td class="${buruk ? 'bad' : ''}">${esc(v)}</td></tr>`;
  const warnaMode = s.mode === 'normal' ? 'ok' : 'bad';
  const ket = { normal: 'Server berjalan normal. Halaman admin: <a href="/admin">/admin</a>', setup: 'Environment Variables belum lengkap: buka <a href="/setup">/setup</a>', darurat: 'Server gagal start; lihat Masalah di bawah' }[s.mode];
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  res.end(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KITO Push · Status</title>
<style>body{font:14px/1.55 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:18px;background:#f3f5fa;color:#13203d}h1{font-size:19px}.cd{background:#fff;border:1px solid #e1e6f0;border-radius:14px;padding:14px 16px;margin:12px 0}table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #eef1f6;vertical-align:top;word-break:break-all}td:first-child{color:#66728c;width:42%;word-break:normal}.ok{color:#12a150;font-weight:700}.bad{color:#d92d20;font-weight:700}li{margin:4px 0}</style></head><body>
<h1>KITO Push Server · Status</h1>
<div class="cd"><b class="${warnaMode}">Mode: ${esc(s.mode)}</b><br>${ket}</div>
${s.masalah.length || s.penyimpanan?.peringatan?.length ? `<div class="cd"><b>Masalah / peringatan</b><ul>${[...s.masalah, ...(s.penyimpanan?.peringatan || [])].map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}
<div class="cd"><table>
${baris('Versi Node.js', s.node)}${baris('SQLite bawaan Node', s.sqliteBawaan ? 'ada' : 'tidak ada (memakai file JSON, tetap berfungsi)')}
${s.penyimpanan ? baris('Penyimpanan', `${s.penyimpanan.driver} · ${s.penyimpanan.lokasi}`) : baris('Penyimpanan', 'belum dibuka', true)}
${Object.entries(s.env).map(([k, v]) => baris(k, v, String(v).startsWith('KOSONG'))).join('')}
${baris('File public/admin.html', s.halamanAdminAda ? 'ada' : 'TIDAK ADA (unggah ulang zip lengkap)', !s.halamanAdminAda)}
</table></div><p style="color:#66728c;font-size:12px">Halaman ini tidak menampilkan kunci atau token. ${esc(s.waktu)}</p></body></html>`);
}

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function createServer(config = defaultConfig, { log = console } = {}) {
  const store = open(config.dbPath);
  const db = store.db;
  store.peringatan.forEach((p) => log.warn?.('[db] ' + p));
=======
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function createServer(config = defaultConfig, { log = console } = {}) {
  const db = open(config.dbPath);
>>>>>>> b131f11426a8e56bd4894ea31a637dd69b90539d
  const sender = createSender({ db, config, log });
  const limitPublic = rateLimiter(60);  // per IP per menit
  const limitTest = rateLimiter(5);
  const limitAdminFail = rateLimiter(10);

  const ip = (req) => (config.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';

  function cors(req, res) {
    const origin = req.headers.origin;
    if (origin && (config.allowedOrigins.includes('*') || config.allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      res.setHeader('Access-Control-Max-Age', '600');
    }
  }

  function send(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new HttpError(413, 'body terlalu besar')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'JSON tidak valid')); }
      });
      req.on('error', reject);
    });
  }

  function requireAdmin(req) {
    const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
    if (!m || !safeEqual(m[1], config.adminToken)) {
      if (!limitAdminFail(ip(req))) throw new HttpError(429, 'terlalu banyak percobaan');
      throw new HttpError(401, 'token admin salah');
    }
  }

  function parseSubscription(s) {
    if (!s || typeof s !== 'object' || typeof s.endpoint !== 'string' || !s.keys) throw new HttpError(400, 'subscription tidak valid');
    if (s.endpoint.length > 1024) throw new HttpError(400, 'endpoint terlalu panjang');
    if (!hostAllowed(s.endpoint, config.pushHosts, config.allowInsecurePush)) throw new HttpError(400, 'push service tidak dikenal');
    const { p256dh, auth } = s.keys;
    if (typeof p256dh !== 'string' || Buffer.from(p256dh, 'base64url').length !== 65) throw new HttpError(400, 'kunci p256dh tidak valid');
    if (typeof auth !== 'string' || Buffer.from(auth, 'base64url').length < 16) throw new HttpError(400, 'kunci auth tidak valid');
    return { endpoint: s.endpoint, p256dh, auth };
  }

  function topicsOrDefault(t) {
    if (t === undefined) return ['semua'];
    const n = normTopics(t, config.maxTopicsPerSub);
    if (!n) throw new HttpError(400, `topik tidak valid (maks ${config.maxTopicsPerSub}; huruf/angka/:_-.)`);
    return n;
  }

  function parseNotification(b) {
    if (!b || typeof b.title !== 'string' || !b.title.trim()) throw new HttpError(400, 'title wajib diisi');
    const target = {};
    if (b.all === true) target.all = true;
    else if (Array.isArray(b.endpoints)) target.endpoints = b.endpoints.slice(0, 1000).map(String);
    else {
      const t = normTopics(b.topics ?? [], 100);
      if (!t || !t.length) throw new HttpError(400, 'isi topics (mis. ["semua"]) atau all:true');
      target.topics = t;
    }
    if (Array.isArray(b.platforms) && b.platforms.length) target.platforms = b.platforms.map((p) => String(p).toLowerCase());
    const urlOk = (u) => !u || /^(https?:\/\/|\.?\/|#|\?)/.test(u);
    if (!urlOk(b.url)) throw new HttpError(400, 'url tidak valid');
    if (b.image && !/^https:\/\//.test(b.image)) throw new HttpError(400, 'image harus URL https');
    let actions;
    if (b.actions !== undefined) {
      if (!Array.isArray(b.actions) || b.actions.length > 2) throw new HttpError(400, 'actions maksimal 2 tombol');
      actions = b.actions.filter((x) => x && String(x.title || '').trim()).map((x) => {
        if (!urlOk(x.url)) throw new HttpError(400, 'url tombol aksi tidak valid');
        return { title: String(x.title).trim().slice(0, 40), url: x.url || b.url || './' };
      });
    }
    return {
      title: b.title.trim(), body: b.body, url: b.url, icon: b.icon, badge: b.badge, image: b.image, tag: b.tag, actions,
      renotify: b.renotify, requireInteraction: b.requireInteraction, data: b.data,
      ttl: Number.isFinite(b.ttl) ? b.ttl : 86400, urgency: b.urgency, collapseKey: b.collapseKey, target,
    };
  }

  const routes = {
    'GET /api/health': async () => ({ ok: true, waktu: new Date().toISOString() }),
<<<<<<< HEAD
    'GET /api/status': async () => statusInfo({ mode: 'normal', store }),
=======
>>>>>>> b131f11426a8e56bd4894ea31a637dd69b90539d
    'GET /api/vapid-public-key': async () => ({ publicKey: config.vapid.publicKey }),

    'POST /api/subscriptions': async (req, body) => {
      const s = parseSubscription(body.subscription);
      // langganan diperbarui browser (pushsubscriptionchange): topik lama ikut dipindahkan
      const lama = body.oldEndpoint && body.topics === undefined ? db.getSubscription(String(body.oldEndpoint)) : null;
      const topics = lama ? lama.topics : topicsOrDefault(body.topics);
      const ua = String(req.headers['user-agent'] || '').slice(0, 400);
      const { platform, browser } = detect(ua);
      if (body.oldEndpoint && body.oldEndpoint !== s.endpoint) db.deleteByEndpoint(String(body.oldEndpoint));
      const id = db.saveSubscription({ ...s, platform, browser, standalone: !!body.standalone, userAgent: ua,
        label: body.label ? String(body.label).slice(0, 120) : null, topics });
      return [201, { ok: true, id, platform, browser, topics }];
    },
    'PUT /api/subscriptions/topics': async (req, body) => {
      const topics = topicsOrDefault(body.topics);
      if (!db.setTopics(String(body.endpoint || ''), topics)) throw new HttpError(404, 'langganan tidak ditemukan');
      return { ok: true, topics };
    },
    'POST /api/subscriptions/status': async (req, body) => {
      const s = db.getSubscription(String(body.endpoint || ''));
      return s ? { terdaftar: true, topics: s.topics, platform: s.platform, sejak: s.created_at } : { terdaftar: false, topics: [] };
    },
    'DELETE /api/subscriptions': async (req, body) => ({ ok: true, dihapus: db.deleteByEndpoint(String(body.endpoint || '')) }),
    'POST /api/subscriptions/test': async (req, body) => {
      if (!limitTest(ip(req))) throw new HttpError(429, 'tunggu sebentar sebelum mengirim tes lagi');
      const s = db.getSubscription(String(body.endpoint || ''));
      if (!s) throw new HttpError(404, 'langganan tidak ditemukan');
      const r = await sender.dispatch({ title: 'Notifikasi KITO aktif ✅', body: `Perangkat ini akan menerima notifikasi untuk: ${s.topics.join(', ') || '–'}.`,
        tag: 'kito-tes', target: { endpoints: [s.endpoint] }, ttl: 600 }, 'tes');
      return { ok: r.sent === 1, ...r };
    },

    'POST /api/notifications': async (req, body) => {
      requireAdmin(req);
      const n = parseNotification(body);
      if (body.sendAt) { // dijadwalkan
        const t = new Date(body.sendAt);
        if (Number.isNaN(t.getTime())) throw new HttpError(400, 'sendAt bukan waktu yang valid (pakai ISO 8601, mis. 2026-11-02T08:00:00+07:00)');
        if (t.getTime() > Date.now() + 15000) {
          if (t.getTime() > Date.now() + 90 * 86400000) throw new HttpError(400, 'jadwal maksimal 90 hari ke depan');
          const id = db.schedule({ ...n, source: body.source || 'admin' }, t.toISOString());
          return [201, { ok: true, dijadwalkan: true, scheduledId: id, sendAt: t.toISOString() }];
        }
      }
      return sender.dispatch(n, body.source || 'admin');
    },
    'POST /api/notifications/batch': async (req, body) => {
      requireAdmin(req);
      const list = Array.isArray(body.notifications) ? body.notifications : null;
      if (!list || !list.length || list.length > 300) throw new HttpError(400, 'notifications harus berisi 1–300 item');
      const parsed = list.map(parseNotification); // validasi semua dulu
      const hasil = [];
      for (const n of parsed) hasil.push(await sender.dispatch(n, body.source || 'skrip'));
      return { ok: true, jumlah: hasil.length, hasil };
    },
    'GET /api/notifications': async (req, body, url) => { requireAdmin(req); return { riwayat: db.history(Number(url.searchParams.get('limit')) || 50) }; },
    'GET /api/stats': async (req) => { requireAdmin(req); return db.stats(); },
    'GET /api/scheduled': async (req, body, url) => { requireAdmin(req); return { jadwal: db.listScheduled(Number(url.searchParams.get('limit')) || 50) }; },
  };

<<<<<<< HEAD
  let terakhirTick = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    // hosting yang menidurkan aplikasi saat sepi (mis. Hostinger): setiap permintaan ikut mengecek jadwal
    if (Date.now() - terakhirTick > 30000) { terakhirTick = Date.now(); setImmediate(() => tick().catch(() => {})); }
=======
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
>>>>>>> b131f11426a8e56bd4894ea31a637dd69b90539d
    try {
      cors(req, res);
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (req.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' https: data:" });
        return fs.createReadStream(ADMIN_HTML).pipe(res);
      }
<<<<<<< HEAD
      if (req.method === 'GET' && url.pathname === '/status') return halamanStatus(res, statusInfo({ mode: 'normal', store }));
      if (req.method === 'GET' && url.pathname === '/') { res.writeHead(302, { Location: '/admin' }); return res.end(); }
=======
>>>>>>> b131f11426a8e56bd4894ea31a637dd69b90539d
      const m = url.pathname.match(/^\/api\/scheduled\/(\d+)$/);
      if (m && req.method === 'DELETE') {
        requireAdmin(req);
        if (!db.cancelScheduled(Number(m[1]))) throw new HttpError(404, 'jadwal tidak ditemukan atau sudah terkirim');
        return send(res, 200, { ok: true, dibatalkan: Number(m[1]) });
      }
      const handler = routes[`${req.method} ${url.pathname}`];
      if (!handler) throw new HttpError(404, 'tidak ditemukan');
      if (url.pathname.startsWith('/api/subscriptions') && !limitPublic(ip(req))) throw new HttpError(429, 'terlalu banyak permintaan');
      const body = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await readJson(req) : {};
      const out = await handler(req, body, url);
      if (Array.isArray(out)) send(res, out[0], out[1]); else send(res, 200, out);
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) log.error?.('[server]', e);
      send(res, status, { ok: false, error: status === 500 ? 'kesalahan server' : e.message });
    }
  });

  // penjadwal: cek notifikasi terjadwal yang sudah jatuh tempo
  db.resetInterrupted();
  let berjalan = false;
  async function tick() {
    if (berjalan) return;
    berjalan = true;
    try {
      for (const j of db.takeDue(new Date().toISOString())) {
        try {
          const { source, ...n } = j.payload;
          const r = await sender.dispatch(n, (source || 'admin') + ' (jadwal)');
          db.finishScheduled(j.id, 'terkirim', r.id, r);
        } catch (e) {
          log.error?.('[jadwal]', e);
          db.finishScheduled(j.id, 'gagal', null, { error: e.message });
        }
      }
    } finally { berjalan = false; }
  }
  const timer = setInterval(tick, config.schedulerMs || 15000);
  timer.unref();
<<<<<<< HEAD
  setTimeout(() => tick().catch(() => {}), 1000).unref(); // jadwal yang terlewat saat server tidur langsung dikirim
  server.on('close', () => { clearInterval(timer); db.close(); });
  return { server, db, sender, tick, store };
}

/* Mode setup: bila konfigurasi belum lengkap, server tetap hidup dan menampilkan /setup
   (kunci VAPID & token admin acak untuk ditempel ke Environment Variables hosting). Tidak ada yang disimpan. */
function setupServer(errs) {
  const { generateVapidKeys } = require('./webpush');
  const crypto = require('node:crypto');
  const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/health') { res.writeHead(503, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: false, setup: true, error: 'konfigurasi belum lengkap, buka /setup' })); }
    if (url.pathname === '/status') return halamanStatus(res, statusInfo({ mode: 'setup', errs }));
    if (url.pathname === '/api/status') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(statusInfo({ mode: 'setup', errs }))); }
    if (url.pathname !== '/setup') { res.writeHead(302, { Location: '/setup' }); return res.end(); }
    const k = generateVapidKeys(), tok = crypto.randomBytes(32).toString('base64url');
    const env = `VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}\nADMIN_TOKEN=${tok}\nVAPID_SUBJECT=mailto:email-anda@domain.id\nALLOWED_ORIGINS=https://alamat-dashboard-anda\nDB_PATH=/home/USER-HOSTINGER/kito-push-data/push.db\nTRUST_PROXY=1`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    res.end(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KITO Push · Setup</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:20px;color:#13203d;background:#f3f5fa}h1{font-size:20px}pre{background:#0e1527;color:#e8edf8;padding:14px;border-radius:12px;overflow:auto;font-size:13px}.cd{background:#fff;border:1px solid #e1e6f0;border-radius:14px;padding:16px;margin:12px 0}li{margin:4px 0}code{background:#e8ecf5;padding:1px 5px;border-radius:5px}</style></head><body>
<h1>KITO Push Server · perlu disetel</h1>
<div class="cd"><b>Yang belum lengkap:</b><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>
<div class="cd"><b>1. Salin pengaturan ini</b> (dibuat acak setiap halaman dibuka dan tidak disimpan di server):<pre>${esc(env)}</pre>
<ul><li>Ganti <code>VAPID_SUBJECT</code> dengan email pengelola.</li><li>Ganti <code>ALLOWED_ORIGINS</code> dengan alamat dashboard, mis. <code>https://zexvron.github.io</code>.</li>
<li>Ganti <code>USER-HOSTINGER</code> dengan nama user hosting Anda (terlihat di File Manager, mis. <code>u123456789</code>). Database harus di luar folder aplikasi supaya tidak terhapus saat deploy ulang.</li></ul></div>
<div class="cd"><b>2.</b> Di hPanel buka Node.js app ini › <b>Environment Variables</b>, tambahkan setiap baris di atas, simpan, lalu <b>Restart</b>/<b>Redeploy</b>.<br><b>3.</b> Buka <code>/admin</code> dan masuk dengan <code>ADMIN_TOKEN</code> tadi. Simpan token di tempat aman.<br><br><small>Penting: setelah ada pelanggan, jangan ganti kunci VAPID.</small></div>
</body></html>`);
  });
}

function start() {
  const errs = validate();
  const port = defaultConfig.port, host = defaultConfig.host;
  // listen persis di PORT dari hosting; host hanya dipakai bila diisi dan PORT berupa angka
  const dengar = (srv, cb) => (host && typeof port === 'number' ? srv.listen(port, host, cb) : srv.listen(port, cb));
  const alamat = typeof port === 'number' ? `port ${port}` : `socket ${port}`;
  if (errs.length) {
    console.error('Konfigurasi belum lengkap (mode setup, buka /setup):\n - ' + errs.join('\n - '));
    const srv = setupServer(errs);
    dengar(srv, () => console.log(`KITO Push Server (mode setup) di ${alamat} · buka /setup atau /status`));
    return srv;
  }
  let server, store;
  try {
    ({ server, store } = createServer());
  } catch (e) {
    // jangan crash (hosting akan menampilkan 503 tanpa keterangan): sajikan /status berisi penyebabnya
    console.error('Server gagal start (mode darurat, buka /status):', e);
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      if (u.pathname === '/status') return halamanStatus(res, statusInfo({ mode: 'darurat', galat: e.message }));
      res.writeHead(u.pathname.startsWith('/api/') ? 503 : 302, u.pathname.startsWith('/api/') ? { 'Content-Type': 'application/json' } : { Location: '/status' });
      res.end(u.pathname.startsWith('/api/') ? JSON.stringify({ ok: false, error: 'server gagal start, buka /status' }) : '');
    });
    dengar(srv, () => console.log(`KITO Push Server (mode darurat) di ${alamat} · buka /status`));
    return srv;
  }
  dengar(server, () => console.log(`KITO Push Server berjalan di ${alamat} (admin: /admin) · Node ${process.versions.node} · penyimpanan ${store.driver}: ${store.path}`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  return server;
}

if (require.main === module) start();

module.exports = { createServer, start };
=======
  server.on('close', () => { clearInterval(timer); db.close(); });
  return { server, db, sender, tick };
}

if (require.main === module) {
  const errs = validate();
  if (errs.length) { console.error('Konfigurasi belum lengkap:\n - ' + errs.join('\n - ')); process.exit(1); }
  const { server } = createServer();
  server.listen(defaultConfig.port, defaultConfig.host, () => console.log(`KITO Push Server berjalan di http://${defaultConfig.host}:${defaultConfig.port} (admin: /admin)`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}

module.exports = { createServer };
>>>>>>> b131f11426a8e56bd4894ea31a637dd69b90539d
