'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const crypto = require('node:crypto');
const wp = require('../src/webpush');
const { createServer } = require('../src/server');
const { detect } = require('../src/util');

const u = wp.unb64u, b = wp.b64u;

test('enkripsi aes128gcm sesuai vektor uji RFC 8291 Lampiran A', () => {
  const out = wp.encrypt(u('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'),
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', 'BTBZMqHH6r4Tts7J_aSIgg',
    { salt: u('DGv6ra1nlYgDCS1FRnbzlw'), asKeys: u('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw') });
  assert.strictEqual(b(out), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});

test('deteksi platform', () => {
  assert.strictEqual(detect('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1').platform, 'ios');
  assert.strictEqual(detect('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36').platform, 'android');
  assert.strictEqual(detect('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36 Edg/120').browser, 'edge');
});

// perangkat tiruan: kunci p256dh/auth seperti yang dibuat browser
function fakeDevice() {
  const e = crypto.createECDH('prime256v1'); e.generateKeys();
  return { priv: e.getPrivateKey(), pub: e.getPublicKey(), auth: crypto.randomBytes(16) };
}

test('alur lengkap: berlangganan, kirim per topik, dekripsi, hapus langganan 410', async (t) => {
  const devices = { a: fakeDevice(), b: fakeDevice(), c: fakeDevice() };
  const diterima = [];
  // push service tiruan: /a dan /b menerima (201), /c sudah kedaluwarsa (410)
  const push = http.createServer((req, res) => {
    const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
      const id = req.url.slice(1), d = devices[id];
      assert.match(req.headers.authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/);
      assert.strictEqual(req.headers['content-encoding'], 'aes128gcm');
      if (id === 'c') { res.writeHead(410); return res.end(); }
      diterima.push({ id, data: JSON.parse(wp.decrypt(Buffer.concat(chunks), d.priv, d.pub, d.auth).toString()), ttl: req.headers.ttl });
      res.writeHead(201); res.end();
    });
  }).listen(0);
  const pushUrl = `http://127.0.0.1:${push.address().port}`;
  const keys = wp.generateVapidKeys();
  const { server } = createServer({
    port: 0, dbPath: ':memory:', vapid: { ...keys, subject: 'mailto:tes@example.com' }, adminToken: 'x'.repeat(32),
    allowedOrigins: ['https://dash.example'], pushHosts: [], allowInsecurePush: true, concurrency: 5, maxTopicsPerSub: 30,
  }, { log: { info() {}, warn() {}, error: console.error } });
  await new Promise((r) => server.listen(0, r));
  t.after(() => { server.close(); push.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, body, token) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://dash.example', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, cors: r.headers.get('access-control-allow-origin'), json: await r.json() }));
  const sub = (id) => ({ endpoint: `${pushUrl}/${id}`, keys: { p256dh: b(devices[id].pub), auth: b(devices[id].auth) } });

  assert.strictEqual((await call('GET', '/api/vapid-public-key')).json.publicKey, keys.publicKey);
  let r = await call('POST', '/api/subscriptions', { subscription: sub('a'), topics: ['semua', 'Area:JAMBI', 'cabang:11000'] });
  assert.strictEqual(r.status, 201); assert.strictEqual(r.cors, 'https://dash.example');
  assert.deepStrictEqual(r.json.topics, ['semua', 'area:jambi', 'cabang:11000']);
  await call('POST', '/api/subscriptions', { subscription: sub('b'), topics: ['semua', 'area:padang'] });
  await call('POST', '/api/subscriptions', { subscription: sub('c'), topics: ['area:jambi'] });

  // validasi & keamanan
  assert.strictEqual((await call('POST', '/api/subscriptions', { subscription: { ...sub('a'), endpoint: 'https://evil.example/x' } })).status, 400);
  assert.strictEqual((await call('POST', '/api/notifications', { title: 'x', topics: ['semua'] }, 'salah')).status, 401);
  assert.strictEqual((await call('POST', '/api/notifications', { title: '', topics: ['semua'] }, 'x'.repeat(32))).status, 400);

  // kirim ke area:jambi -> a diterima, c (410) dihapus, b tidak menjadi target
  r = await call('POST', '/api/notifications', { title: 'Waktu tunggu Jambi', body: 'P95 04:15', url: './index.html', topics: ['area:jambi'], ttl: 3600 }, 'x'.repeat(32));
  assert.deepStrictEqual({ t: r.json.targets, s: r.json.sent, rm: r.json.removed }, { t: 2, s: 1, rm: 1 });
  assert.strictEqual(diterima.length, 1);
  assert.strictEqual(diterima[0].id, 'a'); assert.strictEqual(diterima[0].data.title, 'Waktu tunggu Jambi'); assert.strictEqual(diterima[0].ttl, '3600');
  assert.strictEqual((await call('POST', '/api/subscriptions/status', { endpoint: sub('c').endpoint })).json.terdaftar, false);

  // ubah topik, batch, status, statistik, riwayat, berhenti langganan
  await call('PUT', '/api/subscriptions/topics', { endpoint: sub('b').endpoint, topics: ['semua', 'cabang:11100'] });
  r = await call('POST', '/api/notifications/batch', { notifications: [{ title: 'Semua', topics: ['semua'] }, { title: 'Cabang 11100', topics: ['cabang:11100'] }] }, 'x'.repeat(32));
  assert.deepStrictEqual(r.json.hasil.map((h) => h.sent), [2, 1]);
  assert.deepStrictEqual((await call('POST', '/api/subscriptions/status', { endpoint: sub('b').endpoint })).json.topics, ['cabang:11100', 'semua']);
  r = await call('POST', '/api/subscriptions/test', { endpoint: sub('a').endpoint });
  assert.strictEqual(r.json.ok, true);
  const st = (await call('GET', '/api/stats', null, 'x'.repeat(32))).json;
  assert.strictEqual(st.total, 2);
  assert.strictEqual((await call('GET', '/api/notifications', null, 'x'.repeat(32))).json.riwayat.length, 4);
  assert.strictEqual((await call('DELETE', '/api/subscriptions', { endpoint: sub('a').endpoint })).json.dihapus, true);
  assert.strictEqual((await call('GET', '/api/stats', null, 'x'.repeat(32))).json.total, 1);
});

test('notifikasi custom: tombol aksi, gambar, jadwal, batal jadwal, filter platform', async (t) => {
  const dev = { hp: fakeDevice(), ios: fakeDevice() };
  const masuk = [];
  const push = http.createServer((req, res) => {
    const c = []; req.on('data', (x) => c.push(x)); req.on('end', () => {
      const d = dev[req.url.slice(1)];
      masuk.push({ id: req.url.slice(1), data: JSON.parse(wp.decrypt(Buffer.concat(c), d.priv, d.pub, d.auth).toString()), urgency: req.headers.urgency });
      res.writeHead(201); res.end();
    });
  }).listen(0);
  const pushUrl = `http://127.0.0.1:${push.address().port}`;
  const { server, tick, db } = createServer({
    port: 0, dbPath: ':memory:', vapid: { ...wp.generateVapidKeys(), subject: 'mailto:tes@example.com' }, adminToken: 'y'.repeat(32),
    allowedOrigins: [], pushHosts: [], allowInsecurePush: true, concurrency: 5, maxTopicsPerSub: 30, schedulerMs: 3600000,
  }, { log: { info() {}, warn() {}, error: console.error } });
  await new Promise((r) => server.listen(0, r));
  t.after(() => { server.close(); push.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, body, ua) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + 'y'.repeat(32), ...(ua ? { 'User-Agent': ua } : {}) }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, json: await r.json() }));
  const sub = (id) => ({ endpoint: `${pushUrl}/${id}`, keys: { p256dh: b(dev[id].pub), auth: b(dev[id].auth) } });
  await call('POST', '/api/subscriptions', { subscription: sub('hp'), topics: ['semua'] }, 'Mozilla/5.0 (Linux; Android 14) Chrome/124 Mobile');
  await call('POST', '/api/subscriptions', { subscription: sub('ios'), topics: ['semua'] }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Version/17.4 Mobile/15E148 Safari/604.1');

  // tombol aksi + gambar + urgensi
  let r = await call('POST', '/api/notifications', { title: 'Promo', body: 'Isi', topics: ['semua'], urgency: 'high', image: 'https://contoh.id/b.png',
    actions: [{ title: 'Buka dashboard', url: './index.html' }, { title: 'Lihat area', url: './index.html#area' }] });
  assert.strictEqual(r.json.sent, 2);
  const d0 = masuk[0].data;
  assert.deepStrictEqual(d0.actions, [{ action: 'a0', title: 'Buka dashboard' }, { action: 'a1', title: 'Lihat area' }]);
  assert.deepStrictEqual(d0.data.actions, { a0: './index.html', a1: './index.html#area' });
  assert.strictEqual(d0.image, 'https://contoh.id/b.png'); assert.strictEqual(masuk[0].urgency, 'high');
  assert.strictEqual((await call('POST', '/api/notifications', { title: 'x', topics: ['semua'], actions: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] })).status, 400);
  assert.strictEqual((await call('POST', '/api/notifications', { title: 'x', topics: ['semua'], image: 'http://tidak-aman/x.png' })).status, 400);

  // semua perangkat dipersempit ke iOS saja (sebelumnya bug: hasil kosong)
  masuk.length = 0;
  r = await call('POST', '/api/notifications', { title: 'Khusus iPhone', all: true, platforms: ['ios'] });
  assert.deepStrictEqual([r.json.targets, masuk.map((m) => m.id)], [1, ['ios']]);

  // jadwal: masa depan disimpan, lalu dikirim saat jatuh tempo; satu lagi dibatalkan
  masuk.length = 0;
  r = await call('POST', '/api/notifications', { title: 'Terjadwal', topics: ['semua'], sendAt: new Date(Date.now() + 3600000).toISOString() });
  assert.strictEqual(r.status, 201); assert.strictEqual(r.json.dijadwalkan, true);
  const idJadwal = r.json.scheduledId;
  const idBatal = (await call('POST', '/api/notifications', { title: 'Dibatalkan', topics: ['semua'], sendAt: new Date(Date.now() + 7200000).toISOString() })).json.scheduledId;
  assert.strictEqual((await call('DELETE', `/api/scheduled/${idBatal}`)).json.ok, true);
  assert.strictEqual((await call('DELETE', `/api/scheduled/${idBatal}`)).status, 404);
  assert.strictEqual((await call('POST', '/api/notifications', { title: 'x', topics: ['semua'], sendAt: 'besok pagi' })).status, 400);
  await tick();
  assert.strictEqual(masuk.length, 0); // belum jatuh tempo
  db._setSendAt(idJadwal, new Date(Date.now() - 1000).toISOString());
  await tick();
  assert.deepStrictEqual(masuk.map((m) => m.data.title).sort(), ['Terjadwal', 'Terjadwal']);
  const jadwal = (await call('GET', '/api/scheduled')).json.jadwal;
  assert.deepStrictEqual(jadwal.map((j) => [j.id, j.status, j.result?.sent ?? null]).sort(), [[idJadwal, 'terkirim', 2], [idBatal, 'dibatalkan', null]].sort());
  assert.ok((await call('GET', '/api/notifications')).json.riwayat.some((n) => n.title === 'Terjadwal' && n.source === 'admin (jadwal)'));
});
