'use strict';
/**
 * KITO Backend — server tunggal tanpa dependensi npm (Node ≥ 18).
 *   • melayani dashboard (file statis) + API publik Push (langganan, banner pengumuman)
 *   • halaman admin  /admin/  : kirim push custom (Android, iOS, Desktop, Website), jadwal, riwayat, perangkat, update data Excel
 * Jalankan:  KITO_ADMIN_PASSWORD='…' node backend/server.js     (lihat backend/README.md)
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Store } = require('./lib/store');
const wp = require('./lib/webpush');
const { hashPassword, verifyPassword, Sessions, RateLimit, parseCookies } = require('./lib/auth');
const { Updater, SLOTS } = require('./lib/updater');
const { makeZip } = require('./lib/zip');

// ---------- konfigurasi
const SITE = path.resolve(process.env.KITO_SITE_DIR || path.join(__dirname, '..'));
const DATA = path.resolve(process.env.KITO_DATA_DIR || path.join(__dirname, 'data'));
const PORT = Number(process.env.PORT || process.env.KITO_PORT || 8080);
const HOST = process.env.KITO_HOST || '0.0.0.0';
const SUBJECT = process.env.KITO_VAPID_SUBJECT || 'mailto:admin@example.com';
const EXTRA_HOSTS = (process.env.KITO_PUSH_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean).map((h) => new RegExp('(^|\\.)' + h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
const TRUST_PROXY = process.env.KITO_TRUST_PROXY === '1';
const TLS = process.env.KITO_TLS_KEY && process.env.KITO_TLS_CERT ? { key: fs.readFileSync(process.env.KITO_TLS_KEY), cert: fs.readFileSync(process.env.KITO_TLS_CERT) } : null;
const AREAS = ['JAMBI', 'PADANG', 'PALEMBANG SUDIRMAN', 'PALEMBANG ARIEF', 'BANDARLAMPUNG', 'PANGKAL PINANG', 'BENGKULU'];
const PLATFORMS = ['android', 'ios', 'desktop'];

fs.mkdirSync(DATA, { recursive: true });
const store = new Store(DATA);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- rahasia, VAPID, admin
const secretFile = path.join(DATA, 'secret.key');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const sessions = new Sessions(fs.readFileSync(secretFile, 'utf8'));
let vapid = store.get('vapid', null);
if (!vapid) { vapid = store.set('vapid', wp.generateVapid()); store.flush('vapid'); try { fs.chmodSync(store.file('vapid'), 0o600); } catch {} log('Kunci VAPID dibuat.'); }

function adminHash() {
  if (process.env.KITO_ADMIN_PASSWORD) return hashPassword(process.env.KITO_ADMIN_PASSWORD, Buffer.from(fs.readFileSync(secretFile, 'utf8').slice(0, 32)));
  const a = store.get('admin', null);
  if (a && a.hash) return a.hash;
  const pw = crypto.randomBytes(9).toString('base64url');
  store.set('admin', { hash: hashPassword(pw), createdAt: new Date().toISOString() }); store.flush('admin');
  console.log(`\n  ┌─ PASSWORD ADMIN (ditampilkan sekali) ─────────────\n  │  ${pw}\n  └─ ganti lewat Pengaturan, atau set KITO_ADMIN_PASSWORD\n`);
  return store.get('admin').hash;
}
let ADMIN_HASH = adminHash();
const envPw = !!process.env.KITO_ADMIN_PASSWORD;

const updater = new Updater({ siteDir: SITE, dataDir: DATA, store, log });
const loginLimit = new RateLimit(6, 15 * 60 * 1000);
const subLimit = new RateLimit(20, 60 * 60 * 1000);
const pubLimit = new RateLimit(120, 60 * 1000);

// ---------- util HTTP
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const ip = (req) => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
const isHttps = (req) => !!TLS || (TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https');
const SEC_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' };
function send(res, code, body, headers = {}) {
  const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
  const data = isObj ? JSON.stringify(body) : body;
  res.writeHead(code, { ...SEC_HEADERS, ...(isObj ? { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } : {}), ...headers });
  res.end(data);
}
function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('Body terlalu besar'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(Object.assign(new Error('JSON tidak valid'), { code: 400 })); } });
    req.on('error', reject);
  });
}
const err = (res, e) => send(res, e.code && e.code < 600 ? e.code : 500, { error: e.message || String(e) });

// ---------- platform & perangkat
function detect(ua = '', hint = {}) {
  const U = String(ua);
  let platform = 'desktop';
  if (/Android/i.test(U)) platform = 'android';
  else if (/iPhone|iPad|iPod/i.test(U) || (hint.platform === 'ios')) platform = 'ios';
  else if (/Macintosh/i.test(U) && hint.touch) platform = 'ios'; // iPadOS menyamar sebagai Mac
  const browser = /Edg\//.test(U) ? 'Edge' : /OPR\/|Opera/.test(U) ? 'Opera' : /SamsungBrowser/.test(U) ? 'Samsung Internet' : /Firefox\//.test(U) ? 'Firefox' : /Chrome\/|CriOS/.test(U) ? 'Chrome' : /Safari\//.test(U) ? 'Safari' : 'Lainnya';
  const os = /Windows/.test(U) ? 'Windows' : /Android/.test(U) ? 'Android' : /iPhone|iPad|iPod/.test(U) ? 'iOS' : /Mac OS X/.test(U) ? (platform === 'ios' ? 'iPadOS' : 'macOS') : /Linux/.test(U) ? 'Linux' : /CrOS/.test(U) ? 'ChromeOS' : '–';
  return { platform, browser, os };
}
const subs = () => store.get('subscribers', []);
const hist = () => store.get('history', []);
const scheduled = () => store.get('scheduled', []);
const anns = () => store.get('announcements', []);
const templates = () => store.get('templates', () => [
  { id: 'data-baru', name: 'Data terbaru tersedia', title: 'Data dashboard diperbarui', body: 'Data KITO terbaru sudah tersedia. Cek waktu tunggu, O2O, dan NBDS Region II.', url: '/', tag: 'data-baru' },
  { id: 'ranking', name: 'Ranking mingguan', title: 'Ranking Region II diperbarui', body: 'Lihat posisi area dan cabang Anda pada ranking terbaru.', url: '/?tab=ranking', tag: 'ranking' },
  { id: 'waktu', name: 'Pengingat waktu tunggu', title: 'Waktu tunggu di atas 5 menit', body: 'Periksa cabang dengan P90 waktu tunggu di atas target.', url: '/?tab=area', tag: 'waktu' },
]);

function audience(t = {}) {
  const pl = t.platforms && t.platforms.length ? t.platforms : PLATFORMS;
  const ar = t.areas && t.areas.length ? t.areas : null;
  return subs().filter((s) => pl.includes(s.platform) && (!ar || (s.area && ar.includes(s.area))));
}
function cleanText(v, max) { return String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max); }
function safeUrl(u) {
  u = String(u || '/').trim();
  if (/^\/(?!\/)/.test(u)) return u.slice(0, 500);               // jalur relatif di situs ini
  try { const x = new URL(u); if (x.protocol === 'https:' || x.protocol === 'http:') return x.href.slice(0, 500); } catch {}
  return '/';
}
function buildPayload(m, id) {
  const p = { id, title: cleanText(m.title, 80) || 'KITO', body: cleanText(m.body, 300), url: safeUrl(m.url), tag: cleanText(m.tag, 40) || undefined, requireInteraction: !!m.requireInteraction, ts: Date.now() };
  for (const k of ['icon', 'image', 'badge']) if (m[k]) p[k] = safeUrl(m[k]);
  return p;
}

async function sendBatch(targetSubs, payload, opts, onProgress) {
  const res = { total: targetSubs.length, sent: 0, failed: 0, removed: 0, byPlatform: {}, errors: {} };
  const queue = targetSubs.slice();
  const gone = new Set();
  const worker = async () => {
    for (let s; (s = queue.shift());) {
      const r = await wp.send(s, payload, { vapid, subject: SUBJECT, ttl: opts.ttl, urgency: opts.urgency, topic: opts.topic }).catch((e) => ({ ok: false, status: 0, detail: e.message }));
      const bp = (res.byPlatform[s.platform] ||= { sent: 0, failed: 0 });
      if (r.ok) { res.sent++; bp.sent++; s.lastPush = new Date().toISOString(); }
      else { res.failed++; bp.failed++; const k = r.status + ''; res.errors[k] = (res.errors[k] || 0) + 1; if (r.gone) gone.add(s.id); }
      if (onProgress) onProgress(res);
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, queue.length || 1) }, worker));
  if (gone.size) { store.set('subscribers', subs().filter((s) => !gone.has(s.id))); res.removed = gone.size; } else store.save('subscribers');
  return res;
}

async function dispatch(msg) { // msg: {title, body, url, ..., targets, ttl, urgency, inApp, inAppDays}
  const id = crypto.randomBytes(6).toString('hex');
  const payload = buildPayload(msg, id);
  const target = audience(msg.targets);
  const rec = { id, at: new Date().toISOString(), title: payload.title, body: payload.body, url: payload.url, targets: msg.targets || {}, status: 'sending', total: target.length, sent: 0, failed: 0, removed: 0, by: msg.by || 'admin' };
  const h = hist(); h.unshift(rec); store.set('history', h.slice(0, 300));
  if (msg.inApp) {
    const a = anns(); const days = Math.min(30, Math.max(1, Number(msg.inAppDays) || 3));
    a.unshift({ id, title: payload.title, body: payload.body, url: payload.url, createdAt: rec.at, expiresAt: new Date(Date.now() + days * 864e5).toISOString(), areas: (msg.targets && msg.targets.areas) || [] });
    store.set('announcements', a.filter((x) => new Date(x.expiresAt) > new Date()).slice(0, 20));
  }
  const r = await sendBatch(target, payload, { ttl: Math.min(2419200, Math.max(60, Number(msg.ttl) || 86400)), urgency: ['very-low', 'low', 'normal', 'high'].includes(msg.urgency) ? msg.urgency : 'normal', topic: msg.collapse ? payload.tag : undefined }, null);
  Object.assign(rec, { status: 'done', sent: r.sent, failed: r.failed, removed: r.removed, byPlatform: r.byPlatform, errors: r.errors });
  store.save('history');
  log(`Push "${payload.title}" → ${r.sent}/${r.total} terkirim, ${r.removed} dihapus`);
  return rec;
}

// penjadwal
setInterval(async () => {
  const list = scheduled(); const now = Date.now();
  const due = list.filter((x) => new Date(x.when).getTime() <= now);
  if (!due.length) return;
  store.set('scheduled', list.filter((x) => !due.includes(x)));
  for (const d of due) await dispatch({ ...d.msg, by: 'jadwal' }).catch((e) => log('Jadwal gagal:', e.message));
}, 15000).unref();

// ---------- router
const routes = [];
const route = (method, pattern, handler, opts = {}) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, ...opts });

// publik
route('GET', '/api/push/key', (req, res) => send(res, 200, { publicKey: vapid.publicKey, areas: AREAS }), { pub: true });
route('POST', '/api/push/subscribe', async (req, res) => {
  if (!subLimit.hit(ip(req))) return send(res, 429, { error: 'Terlalu banyak permintaan' });
  const b = await readJson(req);
  const s = b.subscription || {};
  if (!s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth) return send(res, 400, { error: 'Langganan tidak lengkap' });
  if (!wp.endpointAllowed(s.endpoint, EXTRA_HOSTS)) return send(res, 400, { error: 'Layanan push tidak dikenal' });
  try { wp.encrypt('x', s.keys.p256dh, s.keys.auth); } catch (e) { return send(res, 400, { error: 'Kunci langganan tidak valid' }); }
  const d = detect(req.headers['user-agent'], b);
  const area = AREAS.includes(b.area) ? b.area : '';
  const list = subs();
  let rec = list.find((x) => x.endpoint === s.endpoint);
  const now = new Date().toISOString();
  if (rec) Object.assign(rec, { keys: s.keys, ...d, area, standalone: !!b.standalone, lastSeen: now });
  else { rec = { id: crypto.createHash('sha1').update(s.endpoint).digest('hex').slice(0, 12), endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, ...d, area, standalone: !!b.standalone, createdAt: now, lastSeen: now }; list.push(rec); }
  store.set('subscribers', list);
  send(res, 200, { ok: true, id: rec.id, platform: rec.platform });
}, { pub: true });
route('POST', '/api/push/unsubscribe', async (req, res) => {
  const b = await readJson(req);
  store.set('subscribers', subs().filter((x) => x.endpoint !== b.endpoint));
  send(res, 200, { ok: true });
}, { pub: true });
route('POST', '/api/push/prefs', async (req, res) => {
  const b = await readJson(req);
  const r = subs().find((x) => x.endpoint === b.endpoint);
  if (!r) return send(res, 404, { error: 'Langganan tidak ditemukan' });
  r.area = AREAS.includes(b.area) ? b.area : ''; r.lastSeen = new Date().toISOString(); store.save('subscribers');
  send(res, 200, { ok: true, area: r.area });
}, { pub: true });
route('GET', '/api/announcements', (req, res) => {
  const now = new Date(); const area = new URL(req.url, 'http://x').searchParams.get('area') || '';
  const list = anns().filter((a) => new Date(a.expiresAt) > now && (!a.areas.length || !area || a.areas.includes(area)));
  send(res, 200, { items: list.slice(0, 5).map(({ id, title, body, url, createdAt }) => ({ id, title, body, url, createdAt })) }, { 'Cache-Control': 'public, max-age=60' });
}, { pub: true });

// admin
route('POST', '/api/admin/login', async (req, res) => {
  const k = ip(req);
  if (!loginLimit.hit(k)) return send(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' });
  const b = await readJson(req, 2048);
  if (!verifyPassword(String(b.password || ''), ADMIN_HASH)) { await new Promise((r) => setTimeout(r, 600)); return send(res, 401, { error: 'Password salah' }); }
  loginLimit.reset(k);
  const c = `kito_admin=${sessions.create()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${12 * 3600}${isHttps(req) ? '; Secure' : ''}`;
  send(res, 200, { ok: true }, { 'Set-Cookie': c });
}, { pub: true });
route('POST', '/api/admin/logout', (req, res) => send(res, 200, { ok: true }, { 'Set-Cookie': 'kito_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }), { pub: true });
route('GET', '/api/admin/me', (req, res) => send(res, 200, { ok: true, envPassword: envPw, publicKey: vapid.publicKey, subject: SUBJECT, areas: AREAS, https: isHttps(req), python: updater.python }));

route('GET', '/api/admin/stats', (req, res) => {
  const list = subs(), by = (f) => list.reduce((m, s) => { const k = f(s) || '(semua area)'; m[k] = (m[k] || 0) + 1; return m; }, {});
  const h = hist().slice(0, 30);
  const d7 = Date.now() - 7 * 864e5;
  send(res, 200, { total: list.length, platform: by((s) => s.platform), area: by((s) => s.area), browser: by((s) => s.browser), standalone: list.filter((s) => s.standalone).length, baru7: list.filter((s) => new Date(s.createdAt).getTime() > d7).length, terkirim30: h.reduce((a, x) => a + (x.sent || 0), 0), terjadwal: scheduled().length, kirimTerakhir: hist()[0] || null });
});
route('GET', '/api/admin/subscribers', (req, res) => send(res, 200, { items: subs().map(({ id, platform, browser, os, area, standalone, createdAt, lastSeen, lastPush, endpoint }) => ({ id, platform, browser, os, area, standalone, createdAt, lastSeen, lastPush, host: new URL(endpoint).hostname })).sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen))) }));
route('DELETE', '/api/admin/subscribers/:id', (req, res, p) => { store.set('subscribers', subs().filter((s) => s.id !== p.id)); send(res, 200, { ok: true }); });
route('GET', '/api/admin/history', (req, res) => send(res, 200, { items: hist(), scheduled: scheduled() }));
route('GET', '/api/admin/audience', (req, res) => { const q = new URL(req.url, 'http://x').searchParams; send(res, 200, { count: audience({ platforms: (q.get('platforms') || '').split(',').filter(Boolean), areas: (q.get('areas') || '').split(',').filter(Boolean) }).length }); });
route('POST', '/api/admin/push/send', async (req, res) => {
  const b = await readJson(req);
  if (!cleanText(b.title, 80) || !cleanText(b.body, 300)) return send(res, 400, { error: 'Judul dan isi wajib diisi' });
  const msg = { title: b.title, body: b.body, url: b.url, icon: b.icon, image: b.image, tag: b.tag, requireInteraction: b.requireInteraction, ttl: b.ttl, urgency: b.urgency, collapse: b.collapse, inApp: b.inApp, inAppDays: b.inAppDays, targets: { platforms: (b.platforms || []).filter((x) => PLATFORMS.includes(x)), areas: (b.areas || []).filter((x) => AREAS.includes(x)) } };
  if (b.when) {
    const t = new Date(b.when).getTime();
    if (!Number.isFinite(t) || t < Date.now() + 30000) return send(res, 400, { error: 'Waktu jadwal harus minimal 30 detik ke depan' });
    const rec = { id: crypto.randomBytes(6).toString('hex'), when: new Date(t).toISOString(), msg, createdAt: new Date().toISOString() };
    store.set('scheduled', [...scheduled(), rec]);
    return send(res, 200, { scheduled: true, id: rec.id, when: rec.when });
  }
  if (!audience(msg.targets).length) return send(res, 400, { error: 'Tidak ada perangkat yang cocok dengan target ini' });
  send(res, 200, await dispatch(msg));
});
route('POST', '/api/admin/push/test', async (req, res) => {
  const b = await readJson(req);
  const s = subs().find((x) => x.endpoint === b.endpoint);
  if (!s) return send(res, 404, { error: 'Perangkat ini belum berlangganan' });
  const payload = buildPayload({ title: cleanText(b.title, 80) || 'Uji notifikasi KITO', body: cleanText(b.body, 300) || 'Jika Anda melihat ini, push berfungsi di perangkat ini ✓', url: b.url, tag: 'uji' }, 'test');
  const r = await wp.send(s, payload, { vapid, subject: SUBJECT, ttl: 300, urgency: 'high' });
  if (r.gone) store.set('subscribers', subs().filter((x) => x.id !== s.id));
  send(res, r.ok ? 200 : 502, r.ok ? { ok: true } : { error: `Layanan push menolak (HTTP ${r.status}) ${r.detail || ''}`.trim() });
});
route('DELETE', '/api/admin/scheduled/:id', (req, res, p) => { store.set('scheduled', scheduled().filter((x) => x.id !== p.id)); send(res, 200, { ok: true }); });
route('GET', '/api/admin/templates', (req, res) => send(res, 200, { items: templates() }));
route('POST', '/api/admin/templates', async (req, res) => {
  const b = await readJson(req);
  if (!cleanText(b.name, 60)) return send(res, 400, { error: 'Nama template wajib diisi' });
  const t = { id: crypto.randomBytes(4).toString('hex'), name: cleanText(b.name, 60), title: cleanText(b.title, 80), body: cleanText(b.body, 300), url: safeUrl(b.url), tag: cleanText(b.tag, 40) };
  store.set('templates', [...templates(), t]); send(res, 200, t);
});
route('DELETE', '/api/admin/templates/:id', (req, res, p) => { store.set('templates', templates().filter((t) => t.id !== p.id)); send(res, 200, { ok: true }); });
route('POST', '/api/admin/password', async (req, res) => {
  if (envPw) return send(res, 400, { error: 'Password diatur lewat KITO_ADMIN_PASSWORD; ubah di sana.' });
  const b = await readJson(req, 2048);
  if (!verifyPassword(String(b.current || ''), ADMIN_HASH)) return send(res, 401, { error: 'Password saat ini salah' });
  if (String(b.next || '').length < 10) return send(res, 400, { error: 'Password baru minimal 10 karakter' });
  store.set('admin', { hash: hashPassword(b.next), changedAt: new Date().toISOString() }); ADMIN_HASH = store.get('admin').hash;
  send(res, 200, { ok: true });
});

// update data
route('GET', '/api/admin/update/status', (req, res) => send(res, 200, { slots: updater.status(), running: updater.running, history: updater.history().slice(0, 15), backups: updater.backups().slice(0, 15) }));
route('PUT', '/api/admin/update/upload/:slot', async (req, res, p) => {
  const name = decodeURIComponent(new URL(req.url, 'http://x').searchParams.get('filename') || '');
  send(res, 200, { ok: true, file: await updater.receive(p.slot, name, req) });
}, { raw: true });
route('POST', '/api/admin/update/run', async (req, res) => { const b = await readJson(req); send(res, 200, { job: updater.start(Array.isArray(b.slots) ? b.slots : []) }); });
route('GET', '/api/admin/update/jobs/:id', (req, res, p) => { const j = updater.getJob(p.id); if (!j) return send(res, 404, { error: 'Job tidak ditemukan' }); send(res, 200, updater.publicJob(j, Number(new URL(req.url, 'http://x').searchParams.get('from') || 0))); });
route('POST', '/api/admin/update/jobs/:id/publish', async (req, res, p) => {
  const b = await readJson(req);
  const rec = updater.publish(p.id);
  let notif = null;
  if (b.notify) {
    const tgl = (rec.summary.antrian && rec.summary.antrian.tanggalLaporanO2O) || (rec.summary.antrian && rec.summary.antrian.tanggalTerakhir) || '';
    notif = await dispatch({ title: cleanText(b.title, 80) || 'Data dashboard diperbarui', body: cleanText(b.body, 300) || `Data KITO${tgl ? ' per ' + tgl : ''} sudah tersedia.`, url: '/', tag: 'data-baru', collapse: true, inApp: true, inAppDays: 2, targets: {}, by: 'update-data' });
  }
  send(res, 200, { ok: true, record: rec, notification: notif && { sent: notif.sent, total: notif.total } });
});
route('POST', '/api/admin/update/rollback', async (req, res) => { const b = await readJson(req); send(res, 200, { ok: true, record: updater.rollback(b.id) }); });
route('GET', '/api/admin/update/export', (req, res) => {
  const job = new URL(req.url, 'http://x').searchParams.get('job') || 'live';
  const zip = makeZip(updater.exportFiles(job));
  send(res, 200, zip, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="kito-data-${job === 'live' ? 'tayang' : 'staging'}-${new Date().toISOString().slice(0, 10)}.zip"`, 'Cache-Control': 'no-store' });
});

// ---------- file statis
const BLOCKED = /^\/(backend|tools|\.git|node_modules)(\/|$)|(^|\/)\.|\.(md|py|xlsx|log)$/i;
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.includes('\0')) return send(res, 400, 'Bad request');
  if (rel.endsWith('/')) rel += 'index.html';
  const full = path.resolve(path.join(rel.startsWith('/admin/') ? path.join(__dirname) : SITE, rel));
  const root = rel.startsWith('/admin/') ? path.join(__dirname, 'admin') : SITE;
  if (rel.startsWith('/admin/')) { if (!full.startsWith(root + path.sep) && full !== root) return send(res, 403, 'Forbidden'); }
  else if (!full.startsWith(SITE + path.sep) || BLOCKED.test(rel)) return send(res, 404, 'Not found');
  fs.stat(full, (e, st) => {
    if (e || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(full).toLowerCase();
    const headers = { ...SEC_HEADERS, 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Last-Modified': st.mtime.toUTCString() };
    headers['Cache-Control'] = ext === '.html' || path.basename(full) === 'sw.js' ? 'no-cache' : 'public, max-age=3600';
    if (path.basename(full) === 'sw.js') headers['Service-Worker-Allowed'] = '/';
    if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(Math.floor(st.mtimeMs / 1000) * 1000)) return send(res, 304, '', headers);
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(full).pipe(res);
  });
}

async function handler(req, res) {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) {
      const r = routes.find((x) => x.method === req.method && x.re.test(u.pathname));
      if (!r) return send(res, req.method === 'OPTIONS' ? 204 : 404, req.method === 'OPTIONS' ? '' : { error: 'Endpoint tidak ada' });
      if (r.pub) { if (!pubLimit.hit(ip(req))) return send(res, 429, { error: 'Terlalu banyak permintaan' }); }
      else {
        const tok = parseCookies(req.headers.cookie).kito_admin;
        if (!sessions.valid(tok)) return send(res, 401, { error: 'Belum login' });
        if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'kito') return send(res, 403, { error: 'Permintaan ditolak' });
      }
      return await r.handler(req, res, r.re.exec(u.pathname).groups || {});
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    if (u.pathname === '/admin') return send(res, 302, '', { Location: '/admin/' });
    serveStatic(req, res, u.pathname);
  } catch (e) { if (!res.headersSent) err(res, e); else res.end(); if (!e.code) log('Error:', e.stack || e.message); }
}

const server = TLS ? https.createServer(TLS, handler) : http.createServer(handler);
server.requestTimeout = 0;           // unggahan Excel besar (ratusan MB) tidak boleh dipotong
server.headersTimeout = 30000;
server.listen(PORT, HOST, () => {
  log(`KITO backend aktif di ${TLS ? 'https' : 'http'}://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}   (dashboard: /   admin: /admin/)`);
  log(`Situs: ${SITE}`);
  if (!TLS && !TRUST_PROXY) log('Catatan: Web Push di perangkat sungguhan WAJIB lewat HTTPS (pakai reverse proxy + KITO_TRUST_PROXY=1, atau KITO_TLS_KEY/KITO_TLS_CERT). localhost dikecualikan.');
});
module.exports = { server, detect, buildPayload, safeUrl };
