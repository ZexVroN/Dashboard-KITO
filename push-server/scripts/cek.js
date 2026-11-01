#!/usr/bin/env node
'use strict';
/**
 * Cek kesiapan KITO Push Server. Jalankan DI SERVER tempat push-server dipasang:
 *   npm run cek                                   # konfigurasi + koneksi ke push service resmi
 *   npm run cek -- --url https://push.domain-anda.id --origin https://zexvron.github.io
 *                                                 # + cek server yang sedang berjalan (HTTPS, CORS, admin)
 * Hasil: ✔ lulus · ! perlu perhatian · ✖ gagal (kode keluar 1 bila ada yang gagal).
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { config, validate } = require('../src/config');
const wp = require('../src/webpush');

const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : undefined; };
let gagal = 0, perhatian = 0;
const ok = (m) => console.log('  \x1b[32m✔\x1b[0m ' + m);
const warn = (m) => { perhatian++; console.log('  \x1b[33m!\x1b[0m ' + m); };
const bad = (m) => { gagal++; console.log('  \x1b[31m✖\x1b[0m ' + m); };

function post(url, headers) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'POST', headers: { 'Content-Length': 0, ...headers }, timeout: 10000 }, (res) => {
      let t = ''; res.setEncoding('utf8'); res.on('data', (c) => { if (t.length < 600) t += c; }); res.on('end', () => resolve({ status: res.statusCode, body: t }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ error: e.code || e.message }));
    req.end();
  });
}

(async () => {
  console.log('\nKITO Push Server · cek kesiapan\n');

  console.log('1. Konfigurasi (.env)');
  const errs = validate();
  errs.forEach(bad);
  if (!errs.length) ok('variabel wajib terisi');
  if (!config.allowedOrigins.length) bad('ALLOWED_ORIGINS kosong: dashboard tidak akan bisa berlangganan');
  else config.allowedOrigins.forEach((o) => (o === '*' ? warn('ALLOWED_ORIGINS="*" mengizinkan semua situs; isi alamat dashboard saja')
    : /^https:\/\/[^/]+$/.test(o) ? ok(`origin dashboard: ${o}`) : warn(`origin "${o}" sebaiknya berbentuk https://domain tanpa garis miring/path`)));
  if (config.allowInsecurePush) bad('ALLOW_INSECURE_PUSH=1 hanya untuk pengujian; hapus di server produksi');

  console.log('\n2. Kunci VAPID');
  let keyObject = null;
  try {
    keyObject = wp.vapidKeyObject(config.vapid.publicKey, config.vapid.privateKey);
    const e = crypto.createECDH('prime256v1'); e.setPrivateKey(wp.unb64u(config.vapid.privateKey));
    if (wp.b64u(e.getPublicKey()) === config.vapid.publicKey) ok('kunci publik dan privat berpasangan');
    else bad('VAPID_PUBLIC_KEY bukan pasangan VAPID_PRIVATE_KEY (buat ulang dengan npm run vapid)');
    const jwt = wp.vapidJwt({ audience: 'https://fcm.googleapis.com', subject: config.vapid.subject, keyObject });
    const [h, c, s] = jwt.split('.');
    const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: wp.b64u(wp.unb64u(config.vapid.publicKey).subarray(1, 33)), y: wp.b64u(wp.unb64u(config.vapid.publicKey).subarray(33)) }, format: 'jwk' });
    crypto.verify('sha256', Buffer.from(h + '.' + c), { key: pub, dsaEncoding: 'ieee-p1363' }, wp.unb64u(s)) ? ok('tanda tangan JWT ES256 valid') : bad('tanda tangan JWT tidak valid');
  } catch (e) { bad('kunci VAPID tidak bisa dipakai: ' + e.message); }

  console.log('\n3. Database');
  try {
    if (config.dbPath !== ':memory:') fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
<<<<<<< HEAD
    const r = require('../src/db').open(config.dbPath);
    const st = r.db.stats(); r.db.close();
    r.peringatan.forEach(warn);
    ok(`${r.path} dapat dibuka (penyimpanan ${r.driver}) · ${st.total} langganan · ${st.notifikasi} notifikasi`);
=======
    const db = require('../src/db').open(config.dbPath);
    const st = db.stats(); db.close();
    ok(`${config.dbPath} dapat dibuka · ${st.total} langganan · ${st.notifikasi} notifikasi`);
>>>>>>> b131f11426a8e56bd4894ea31a637dd69b90539d
  } catch (e) { bad('database tidak bisa dibuka/ditulis: ' + e.message); }

  console.log('\n4. Koneksi ke push service resmi (dari server ini)');
  // Endpoint palsu: push service yang terjangkau akan menjawab 4xx (token tidak dikenal).
  // Google FCM memeriksa JWT VAPID lebih dulu: 401/403 berarti kunci/JWT ditolak.
  const id = crypto.randomBytes(12).toString('hex');
  const target = [
    ['Google (Chrome, Edge, Android)', `https://fcm.googleapis.com/fcm/send/kito-cek-${id}`, true],
    ['Mozilla (Firefox)', `https://updates.push.services.mozilla.com/wpush/v2/kito-cek-${id}`, false],
    ['Apple (Safari macOS, iPhone/iPad)', `https://web.push.apple.com/kito-cek-${id}`, false],
    ['Microsoft (Edge lama / Windows)', `https://wns2-par02p.notify.windows.com/w/?token=kito-cek-${id}`, false],
  ];
  for (const [nama, url, cekJwt] of target) {
    const u = new URL(url);
    const headers = keyObject ? { TTL: '60', Authorization: `vapid t=${wp.vapidJwt({ audience: u.origin, subject: config.vapid.subject, keyObject })}, k=${config.vapid.publicKey}` } : { TTL: '60' };
    const r = await post(url, headers);
    if (r.error) { bad(`${nama}: tidak terjangkau (${r.error}). Buka akses keluar HTTPS ke ${u.host}`); continue; }
    const tolakJwt = cekJwt && (r.status === 401 || r.status === 403) && /jwt|vapid|authori|crypto-key|signature/i.test(r.body);
    if (tolakJwt) bad(`${nama}: terhubung, tetapi JWT VAPID DITOLAK (HTTP ${r.status}: ${r.body.slice(0, 120).replace(/\s+/g, ' ')})`);
    else if (r.status >= 400 && r.status < 500) ok(`${nama}: terhubung (HTTP ${r.status} untuk endpoint uji${cekJwt ? ', JWT tidak ditolak' : ''})`);
    else if (r.status >= 200 && r.status < 300) warn(`${nama}: menjawab HTTP ${r.status} untuk endpoint palsu (tidak biasa, tapi terhubung)`);
    else warn(`${nama}: menjawab HTTP ${r.status}; coba lagi beberapa saat`);
  }

  const url = (arg('url') || '').replace(/\/+$/, '');
  if (url) {
    console.log(`\n5. Server berjalan: ${url}`);
    if (!url.startsWith('https://')) warn('alamat server bukan https: browser menolak berlangganan dari dashboard https');
    try {
      const h = await fetch(url + '/api/health'); (await h.json()).ok ? ok('/api/health menjawab') : bad('/api/health tidak normal');
      const k = await (await fetch(url + '/api/vapid-public-key')).json();
      k.publicKey === config.vapid.publicKey ? ok('kunci publik server = kunci di .env ini') : warn('kunci publik server berbeda dengan .env di folder ini');
      const origin = arg('origin') || config.allowedOrigins[0];
      if (origin) {
        const p = await fetch(url + '/api/subscriptions', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } });
        p.headers.get('access-control-allow-origin') === origin ? ok(`CORS mengizinkan ${origin}`) : bad(`CORS TIDAK mengizinkan ${origin} (periksa ALLOWED_ORIGINS di server)`);
      }
      const a = await fetch(url + '/api/stats', { headers: { Authorization: 'Bearer ' + config.adminToken } });
      a.ok ? ok('token admin diterima server') : bad(`token admin ditolak (HTTP ${a.status})`);
      const ad = await fetch(url + '/admin'); ad.ok ? ok('halaman /admin tersedia') : warn(`/admin menjawab HTTP ${ad.status}`);
    } catch (e) { bad('server tidak bisa dihubungi: ' + e.message); }
  }

  console.log(`\nHasil: ${gagal ? `\x1b[31m${gagal} gagal\x1b[0m` : '\x1b[32mtidak ada yang gagal\x1b[0m'}${perhatian ? ` · ${perhatian} perlu perhatian` : ''}`);
  if (!url) console.log('Tambahkan --url https://push.domain-anda.id untuk mengecek server yang sedang berjalan.');
  console.log('Langkah terakhir: buka dashboard di HP/laptop, ketuk 🔔 › Aktifkan › Kirim tes.\n');
  process.exit(gagal ? 1 : 0);
})();
