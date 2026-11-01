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

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function createServer(config = defaultConfig, { log = console } = {}) {
  const db = open(config.dbPath);
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

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      cors(req, res);
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (req.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' https: data:" });
        return fs.createReadStream(ADMIN_HTML).pipe(res);
      }
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
