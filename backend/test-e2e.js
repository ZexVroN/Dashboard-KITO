'use strict';
// Uji end-to-end (tanpa jaringan): node backend/test-e2e.js [path-xlsx-inbranch]
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), https = require('https'), http = require('http');
const assert = require('assert');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kito-e2e-'));
const site = path.join(tmp, 'site');
fs.mkdirSync(path.join(site, 'assets/js'), { recursive: true });
const root = path.join(__dirname, '..');
fs.copyFileSync(path.join(root, 'index.html'), path.join(site, 'index.html'));
fs.copyFileSync(path.join(root, 'sw.js'), path.join(site, 'sw.js'));
fs.cpSync(path.join(root, 'tools'), path.join(site, 'tools'), { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'assets/js'))) fs.copyFileSync(path.join(root, 'assets/js', f), path.join(site, 'assets/js', f));
fs.mkdirSync(path.join(site, 'secret')); fs.writeFileSync(path.join(site, 'secret/x.txt'), 'x');
Object.assign(process.env, { KITO_SITE_DIR: site, KITO_DATA_DIR: path.join(tmp, 'data'), KITO_ADMIN_PASSWORD: 'uji-password-123', PORT: '0', KITO_HOST: '127.0.0.1' });

// push service palsu: tangkap request ke host push
const captured = [];
const realReq = https.request;
https.request = (opts, cb) => {
  const { EventEmitter } = require('events'); const req = new EventEmitter();
  const chunks = [];
  req.end = (b) => { captured.push({ host: opts.hostname, path: opts.path, headers: opts.headers, body: b });
    const res = new EventEmitter(); res.statusCode = /gone/.test(opts.path) ? 410 : 201; res.headers = {}; cb(res); res.emit('data', Buffer.from('')); res.emit('end'); };
  req.destroy = () => {}; return req;
};
const { server } = require('./server');
const wp = require('./lib/webpush');

let ok = 0; const t = async (n, f) => { try { await f(); ok++; console.log('  ✓', n); } catch (e) { console.log('  ✗', n, '\n    ', String(e.message).slice(0, 400)); process.exitCode = 1; } };
let base, cookie = '';
const call = (method, p, body, hdr = {}) => new Promise((res, rej) => {
  const data = body === undefined ? null : (Buffer.isBuffer(body) ? body : JSON.stringify(body));
  const r = http.request(base + p, { method, headers: { ...(data && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie, 'X-Requested-With': 'kito' } : {}), ...hdr } }, (x) => {
    const c = []; x.on('data', (d) => c.push(d)); x.on('end', () => { const raw = Buffer.concat(c); let j = null; try { j = JSON.parse(raw); } catch {} res({ status: x.statusCode, json: j, raw, headers: x.headers }); }); });
  r.on('error', rej); if (data) r.write(data); r.end();
});
const mkSub = (host = 'fcm.googleapis.com', ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/120') => {
  const e = crypto.createECDH('prime256v1'); e.generateKeys(); const auth = crypto.randomBytes(16);
  return { ecdh: e, auth, ua, sub: { endpoint: `https://${host}/fcm/send/${crypto.randomBytes(6).toString('hex')}`, keys: { p256dh: wp.b64u(e.getPublicKey()), auth: wp.b64u(auth) } } };
};

server.on('listening', async () => {
  base = 'http://127.0.0.1:' + server.address().port;
  console.log('Publik');
  await t('file statis: index.html & sw.js tersaji', async () => { const a = await call('GET', '/'); assert.strictEqual(a.status, 200); assert.ok(a.raw.toString().includes('push.js')); const s = await call('GET', '/sw.js'); assert.strictEqual(s.status, 200); assert.strictEqual(s.headers['service-worker-allowed'], '/'); });
  await t('berkas sensitif tidak tersaji (backend/, tools/, .py, .md, data.json)', async () => { for (const p of ['/backend/server.js', '/tools/update_semua.py', '/DEVELOPER.md', '/../backend/data/vapid.json', '/%2e%2e/backend/server.js', '/backend/data/vapid.json']) { const r = await call('GET', p); assert.ok([404, 403, 400].includes(r.status), p + ' → ' + r.status); } });
  await t('path traversal ditolak', async () => { const r = await call('GET', '/admin/..%2f..%2fserver.js'); assert.ok(r.status !== 200, 'status ' + r.status); });
  await t('GET /api/push/key', async () => { const r = await call('GET', '/api/push/key'); assert.strictEqual(wp.fromB64u(r.json.publicKey).length, 65); assert.strictEqual(r.json.areas.length, 7); });
  const A = mkSub(), I = mkSub('web.push.apple.com', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/605'), D = mkSub('updates.push.services.mozilla.com', 'Mozilla/5.0 (Windows NT 10.0) Firefox/121'), G = mkSub('fcm.googleapis.com/gone', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120');
  G.sub.endpoint = 'https://fcm.googleapis.com/gone/' + crypto.randomBytes(4).toString('hex');
  await t('subscribe: deteksi platform Android/iOS/Desktop', async () => {
    for (const [d, area, pl] of [[A, 'JAMBI', 'android'], [I, 'PADANG', 'ios'], [D, '', 'desktop'], [G, 'JAMBI', 'desktop']]) { const r = await call('POST', '/api/push/subscribe', { subscription: d.sub, area, standalone: true }, { 'User-Agent': d.ua }); assert.strictEqual(r.status, 200); assert.strictEqual(r.json.platform, pl); }
  });
  await t('subscribe menolak host tak dikenal / http / kunci rusak', async () => {
    const bad = mkSub('evil.example.com'); assert.strictEqual((await call('POST', '/api/push/subscribe', { subscription: bad.sub })).status, 400);
    const bad2 = mkSub(); bad2.sub.keys.p256dh = 'abc'; assert.strictEqual((await call('POST', '/api/push/subscribe', { subscription: bad2.sub })).status, 400);
    const bad3 = mkSub(); bad3.sub.endpoint = 'http://fcm.googleapis.com/x'; assert.strictEqual((await call('POST', '/api/push/subscribe', { subscription: bad3.sub })).status, 400);
  });
  await t('subscribe ulang tidak menggandakan', async () => { await call('POST', '/api/push/subscribe', { subscription: A.sub, area: 'BENGKULU' }, { 'User-Agent': A.ua }); cookie = ''; });

  console.log('Admin');
  await t('endpoint admin tanpa login → 401', async () => { assert.strictEqual((await call('GET', '/api/admin/stats')).status, 401); });
  await t('login salah → 401, benar → cookie HttpOnly SameSite=Strict', async () => {
    assert.strictEqual((await call('POST', '/api/admin/login', { password: 'salah' })).status, 401);
    const r = await call('POST', '/api/admin/login', { password: 'uji-password-123' }); assert.strictEqual(r.status, 200);
    const c = r.headers['set-cookie'][0]; assert.ok(/HttpOnly/.test(c) && /SameSite=Strict/.test(c)); cookie = c.split(';')[0];
  });
  await t('CSRF: POST admin tanpa X-Requested-With ditolak', async () => { const r = await new Promise((res) => { const q = http.request(base + '/api/admin/push/send', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' } }, (x) => { x.resume(); res(x.statusCode); }); q.end('{}'); }); assert.strictEqual(r, 403); });
  await t('stats: 3 platform terhitung', async () => { const s = (await call('GET', '/api/admin/stats')).json; assert.strictEqual(s.total, 4); assert.strictEqual(s.platform.android, 1); assert.strictEqual(s.platform.ios, 1); assert.strictEqual(s.platform.desktop, 2); assert.strictEqual(s.area.BENGKULU, 1); });
  await t('audience: filter platform & area', async () => { assert.strictEqual((await call('GET', '/api/admin/audience?platforms=ios')).json.count, 1); assert.strictEqual((await call('GET', '/api/admin/audience?areas=JAMBI')).json.count, 1); assert.strictEqual((await call('GET', '/api/admin/audience?platforms=desktop&areas=JAMBI')).json.count, 1); });
  await t('kirim push → terenkripsi benar, dapat didekripsi perangkat; 410 dibersihkan', async () => {
    captured.length = 0;
    const r = await call('POST', '/api/admin/push/send', { title: 'Data diperbarui ✓', body: 'Data 22 Okt 2026', url: '/?tab=area', platforms: ['android', 'ios', 'desktop'], areas: [], tag: 'data-baru', inApp: true, inAppDays: 2, urgency: 'high', ttl: 600 });
    assert.strictEqual(r.status, 200, JSON.stringify(r.json)); assert.strictEqual(r.json.total, 4); assert.strictEqual(r.json.sent, 3); assert.strictEqual(r.json.removed, 1);
    const mine = captured.find((c) => c.path === new URL(A.sub.endpoint).pathname);
    const plain = JSON.parse(wp.decrypt(mine.body, wp.b64u(A.ecdh.getPrivateKey()), A.sub.keys.p256dh, A.sub.keys.auth));
    assert.strictEqual(plain.title, 'Data diperbarui ✓'); assert.strictEqual(plain.url, '/?tab=area'); assert.strictEqual(plain.tag, 'data-baru');
    assert.strictEqual(mine.headers.TTL, '600'); assert.strictEqual(mine.headers.Urgency, 'high'); assert.ok(/^vapid t=.+, k=.+$/.test(mine.headers.Authorization));
    assert.strictEqual((await call('GET', '/api/admin/stats')).json.total, 3);
  });
  await t('target platform: hanya iOS', async () => { captured.length = 0; const r = await call('POST', '/api/admin/push/send', { title: 'iOS saja', body: 'x', platforms: ['ios'] }); assert.strictEqual(r.json.total, 1); assert.strictEqual(captured.length, 1); assert.strictEqual(captured[0].host, 'web.push.apple.com'); });
  await t('URL berbahaya (javascript:) dinetralkan', async () => { captured.length = 0; await call('POST', '/api/admin/push/send', { title: 'x', body: 'y', url: 'javascript:alert(1)', platforms: ['android'] }); const p = JSON.parse(wp.decrypt(captured[0].body, wp.b64u(A.ecdh.getPrivateKey()), A.sub.keys.p256dh, A.sub.keys.auth)); assert.strictEqual(p.url, '/'); });
  await t('banner pengumuman publik', async () => { const r = await call('GET', '/api/announcements'); assert.ok(r.json.items.some((x) => x.title === 'Data diperbarui ✓')); assert.ok(!('areas' in r.json.items[0])); });
  await t('jadwal: tolak waktu lampau; terima & batalkan', async () => {
    assert.strictEqual((await call('POST', '/api/admin/push/send', { title: 'a', body: 'b', when: new Date(Date.now() - 1000).toISOString() })).status, 400);
    const r = await call('POST', '/api/admin/push/send', { title: 'Nanti', body: 'b', when: new Date(Date.now() + 3600e3).toISOString() }); assert.ok(r.json.scheduled);
    assert.strictEqual((await call('GET', '/api/admin/history')).json.scheduled.length, 1);
    await call('DELETE', '/api/admin/scheduled/' + r.json.id); assert.strictEqual((await call('GET', '/api/admin/history')).json.scheduled.length, 0);
  });
  await t('template: tambah & hapus', async () => { const r = await call('POST', '/api/admin/templates', { name: 'Uji', title: 'T', body: 'B', url: '/' }); assert.strictEqual(r.status, 200); const l = (await call('GET', '/api/admin/templates')).json.items; assert.ok(l.length >= 4); await call('DELETE', '/api/admin/templates/' + r.json.id); });
  await t('rate limit login', async () => { cookie = ''; let last; for (let i = 0; i < 8; i++) last = await call('POST', '/api/admin/login', { password: 'x' }); assert.strictEqual(last.status, 429); });
  await t('unsubscribe', async () => { assert.strictEqual((await call('POST', '/api/push/unsubscribe', { endpoint: D.sub.endpoint })).status, 200); });

  console.log('Update data');
  const xl = process.argv[2];
  if (xl && fs.existsSync(xl)) {
    // pulihkan sesi (rate limit login diset ulang lewat proses baru tidak mungkin; buat cookie langsung)
    const { Sessions } = require('./lib/auth'); cookie = 'kito_admin=' + new Sessions(fs.readFileSync(path.join(tmp, 'data/secret.key'), 'utf8')).create();
    const before = fs.readFileSync(path.join(site, 'assets/js/infografis-data.js'), 'utf8');
    await t('unggah: tolak bukan-xlsx', async () => { const r = await call('PUT', '/api/admin/update/upload/inbranch?filename=a.xlsx', Buffer.from('bukan excel sungguhan, hanya teks biasa yang cukup panjang untuk lewat batas minimum ukuran 100 byte ya ya ya ya ya'), { 'Content-Type': 'application/octet-stream' }); assert.strictEqual(r.status, 400); });
    await t('unggah: slot tak dikenal ditolak', async () => { const r = await call('PUT', '/api/admin/update/upload/hacker?filename=a.xlsx', Buffer.from('PK\u0003\u0004' + 'x'.repeat(200))); assert.strictEqual(r.status, 400); });
    await t('unggah Report Inbranch asli (stream ke disk)', async () => { const r = await call('PUT', '/api/admin/update/upload/inbranch?filename=Report%20Inbranch%20(MTD)%20-%2016%20Oktober(3).xlsx', fs.readFileSync(xl)); assert.strictEqual(r.status, 200, JSON.stringify(r.json)); });
    await t('run tanpa file harian → pesan jelas', async () => { const r = await call('POST', '/api/admin/update/run', { slots: ['nbds'] }); assert.strictEqual(r.status, 400); assert.ok(/belum diunggah/.test(r.json.error)); });
    let job;
    await t('proses Inbranch → status ready, hasil sama dengan data tayang', async () => {
      const r = await call('POST', '/api/admin/update/run', { slots: ['inbranch'] }); assert.strictEqual(r.status, 200, JSON.stringify(r.json)); job = r.json.job;
      let j; for (let i = 0; i < 120; i++) { await new Promise((x) => setTimeout(x, 500)); j = (await call('GET', '/api/admin/update/jobs/' + job)).json; if (j.status !== 'running') break; }
      assert.strictEqual(j.status, 'ready', (j.log || []).slice(-6).join('\n')); assert.ok(j.steps.every((s) => s.ok));
      assert.strictEqual(j.summary['infografis-data.js'].tanggal, '2026-10-16'); assert.strictEqual(j.summary['pegawai-data.js'].baris, 1032);
      assert.ok(j.changes.find((c) => c.file === 'infografis-data.js') && j.changes.every((c) => c.status === 'sama' || c.file === 'infografis-data.js'), JSON.stringify(j.changes.filter((c) => c.status !== 'sama')));
    });
    await t('export staging berupa zip valid', async () => { const r = await call('GET', '/api/admin/update/export?job=' + job); assert.strictEqual(r.status, 200); fs.writeFileSync(path.join(tmp, 'e.zip'), r.raw); const out = require('child_process').execFileSync('python3', ['-c', `import zipfile;z=zipfile.ZipFile('${path.join(tmp, 'e.zip')}');print(z.testzip(),len(z.namelist()))`]).toString(); assert.ok(out.startsWith('None'), out); });
    await t('publish tanpa perubahan → ditolak dengan pesan jelas', async () => { const r = await call('POST', `/api/admin/update/jobs/${job}/publish`, {}); assert.strictEqual(r.status, 400); assert.ok(/Tidak ada perubahan/.test(r.json.error)); });
    // ubah data tayang agar ada perbedaan → publish → rollback
    fs.writeFileSync(path.join(site, 'assets/js/infografis-data.js'), before.replace('"tanggal":"2026-10-16"', '"tanggal":"2026-10-09"'));
    const job2 = (await call('POST', '/api/admin/update/run', { slots: ['inbranch'] })).json.job;
    for (let i = 0; i < 120; i++) { await new Promise((x) => setTimeout(x, 500)); if ((await call('GET', '/api/admin/update/jobs/' + job2)).json.status !== 'running') break; }
    await t('publish: backup dibuat, berkas diganti, ?v= naik, push pemberitahuan terkirim', async () => {
      const v0 = /infografis-data\.js\?v=(\d+)/.exec(fs.readFileSync(path.join(site, 'index.html'), 'utf8'))[1];
      captured.length = 0;
      const r = await call('POST', `/api/admin/update/jobs/${job2}/publish`, { notify: true }); assert.strictEqual(r.status, 200, JSON.stringify(r.json));
      assert.strictEqual(fs.readFileSync(path.join(site, 'assets/js/infografis-data.js'), 'utf8').trimEnd(), before.trimEnd());
      assert.strictEqual(/infografis-data\.js\?v=(\d+)/.exec(fs.readFileSync(path.join(site, 'index.html'), 'utf8'))[1], String(Number(v0) + 1));
      assert.ok(r.json.notification.total >= 1); assert.ok(captured.length >= 1);
      assert.strictEqual((await call('POST', `/api/admin/update/jobs/${job2}/publish`, {})).status, 409);
    });
    await t('rollback memulihkan berkas sebelumnya', async () => {
      const st = (await call('GET', '/api/admin/update/status')).json; assert.ok(st.backups.length === 1);
      const r = await call('POST', '/api/admin/update/rollback', { id: st.backups[0].id }); assert.strictEqual(r.status, 200);
      assert.ok(fs.readFileSync(path.join(site, 'assets/js/infografis-data.js'), 'utf8').includes('"tanggal":"2026-10-09"'));
      assert.strictEqual((await call('POST', '/api/admin/update/rollback', { id: '../../etc' })).status, 404);
    });
  } else console.log('  (dilewati: berikan path xlsx Inbranch sebagai argumen)');
  console.log(`\n${ok} uji lulus${process.exitCode ? ' — ADA YANG GAGAL' : ''}`);
  https.request = realReq; server.close(); setTimeout(() => process.exit(process.exitCode || 0), 300);
});
