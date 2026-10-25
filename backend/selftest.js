'use strict';
// Uji mandiri: node backend/selftest.js
const assert = require('assert');
const crypto = require('crypto');
const wp = require('./lib/webpush');
const { hashPassword, verifyPassword, Sessions } = require('./lib/auth');
const { makeZip } = require('./lib/zip');
let ok = 0;
const t = (n, f) => { try { f(); ok++; console.log('  ✓', n); } catch (e) { console.log('  ✗', n, '\n   ', e.message); process.exitCode = 1; } };

console.log('Web Push');
t('vektor uji RFC 8291 Lampiran A', () => {
  const body = wp.encrypt('When I grow up, I want to be a watermelon',
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', 'BTBZMqHH6r4Tts7J_aSIgg',
    { asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', salt: 'DGv6ra1nlYgDCS1FRnbzlw' });
  const want = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
  assert.strictEqual(body.toString('base64url'), want);
});
t('enkripsi → dekripsi (kunci acak)', () => {
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const msg = JSON.stringify({ title: 'Tes ✓', body: 'Data 22 Okt 2026 sudah diperbarui' });
  const enc = wp.encrypt(msg, wp.b64u(ua.getPublicKey()), wp.b64u(auth));
  const plain = wp.decrypt(enc, wp.b64u(ua.getPrivateKey()), wp.b64u(ua.getPublicKey()), wp.b64u(auth));
  assert.strictEqual(plain.toString(), msg);
});
t('VAPID: JWT ES256 dapat diverifikasi', () => {
  const v = wp.generateVapid();
  const h = wp.vapidHeader('https://fcm.googleapis.com/fcm/send/abc', v, 'mailto:a@b.id');
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(h);
  assert.ok(m, 'format header');
  const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: wp.b64u(wp.fromB64u(v.publicKey).subarray(1, 33)), y: wp.b64u(wp.fromB64u(v.publicKey).subarray(33)) }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(m[1] + '.' + m[2]), { key: pub, dsaEncoding: 'ieee-p1363' }, wp.fromB64u(m[3])));
  assert.strictEqual(JSON.parse(wp.fromB64u(m[2])).aud, 'https://fcm.googleapis.com');
  assert.strictEqual(wp.fromB64u(v.publicKey).length, 65);
});
t('send() memakai header benar & menandai 410 sebagai gone', async () => {});
t('allowlist endpoint', () => {
  assert.ok(wp.endpointAllowed('https://fcm.googleapis.com/fcm/send/x'));
  assert.ok(wp.endpointAllowed('https://updates.push.services.mozilla.com/wpush/v2/x'));
  assert.ok(wp.endpointAllowed('https://web.push.apple.com/x'));
  assert.ok(wp.endpointAllowed('https://wns2-par02p.notify.windows.com/x'));
  assert.ok(!wp.endpointAllowed('http://fcm.googleapis.com/x'));
  assert.ok(!wp.endpointAllowed('https://evil.example.com/x'));
  assert.ok(!wp.endpointAllowed('https://fcm.googleapis.com.evil.com/x'));
  assert.ok(!wp.endpointAllowed('https://127.0.0.1/x'));
});
console.log('Auth');
t('hash/verify password', () => { const h = hashPassword('rahasia123'); assert.ok(verifyPassword('rahasia123', h)); assert.ok(!verifyPassword('salah', h)); });
t('sesi bertanda tangan', () => { const s = new Sessions('k'); const tk = s.create(); assert.ok(s.valid(tk)); assert.ok(!s.valid(tk.slice(0, -2) + 'xx')); assert.ok(!new Sessions('lain').valid(tk)); });
console.log('ZIP');
t('zip dapat dibaca python', () => {
  const fs = require('fs'), cp = require('child_process');
  const f = '/tmp/kito_selftest.zip';
  fs.writeFileSync(f, makeZip([{ name: 'a.js', data: 'window.A=1;\n'.repeat(500) }, { name: 'sub/b.txt', data: 'halo ✓' }]));
  const out = cp.execFileSync('python3', ['-c', `import zipfile;z=zipfile.ZipFile('${f}');print(z.testzip(),sorted(z.namelist()),z.read('sub/b.txt').decode())`]).toString();
  assert.ok(out.includes("None") && out.includes('halo ✓'), out);
});
(async () => {
  // send() dengan transport tiruan
  const v = wp.generateVapid(), ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/z', keys: { p256dh: wp.b64u(ua.getPublicKey()), auth: wp.b64u(auth) } };
  let seen;
  const r1 = await wp.send(sub, { title: 'x' }, { vapid: v, subject: 'mailto:a@b.id', ttl: 60, urgency: 'high', topic: 'data-baru!', transport: async (e, h, b) => { seen = { e, h, b }; return { status: 201, body: '' }; } });
  t('send(): 201 → ok, header lengkap', () => { assert.ok(r1.ok); assert.strictEqual(seen.h['Content-Encoding'], 'aes128gcm'); assert.strictEqual(seen.h.TTL, '60'); assert.strictEqual(seen.h.Urgency, 'high'); assert.strictEqual(seen.h.Topic, 'data-baru'); assert.strictEqual(seen.h['Content-Length'], seen.b.length); });
  const r2 = await wp.send(sub, { title: 'x' }, { vapid: v, subject: 'mailto:a@b.id', transport: async () => ({ status: 410, body: 'gone' }) });
  t('send(): 410 → gone', () => { assert.ok(!r2.ok && r2.gone); });
  console.log(`\n${ok} uji lulus${process.exitCode ? ' — ADA YANG GAGAL' : ''}`);
})();
