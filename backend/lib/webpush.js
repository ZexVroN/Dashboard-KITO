'use strict';
// Web Push tanpa dependensi: VAPID (RFC 8292) + enkripsi payload aes128gcm (RFC 8291) memakai modul crypto bawaan Node.
const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

const b64u = (b) => Buffer.from(b).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url');

function generateVapid() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const prv = privateKey.export({ format: 'jwk' });
  const raw = Buffer.concat([Buffer.from([4]), fromB64u(pub.x), fromB64u(pub.y)]);
  return { publicKey: b64u(raw), privateJwk: prv };
}

function vapidHeader(endpoint, vapid, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const key = crypto.createPrivateKey({ key: vapid.privateJwk, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${vapid.publicKey}`;
}

// RFC 8291 §3.4 — satu record (payload ≤ 3993 byte)
function encrypt(payload, p256dh, authSecret, opts = {}) {
  const uaPublic = fromB64u(p256dh);
  const auth = fromB64u(authSecret);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('p256dh tidak valid');
  if (auth.length !== 16) throw new Error('auth secret tidak valid');
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  if (data.length > 3993) throw new Error('payload terlalu besar (maks 3993 byte)');

  const ecdh = crypto.createECDH('prime256v1');
  if (opts.asPrivate) ecdh.setPrivateKey(fromB64u(opts.asPrivate)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPublic);
  const salt = opts.salt ? fromB64u(opts.salt) : crypto.randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, auth, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const enc = Buffer.concat([cipher.update(Buffer.concat([data, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, enc]);
}

// kebalikan encrypt() — dipakai untuk uji mandiri (sisi browser)
function decrypt(body, uaPrivate, uaPublic, authSecret) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const enc = body.subarray(21 + idlen);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(fromB64u(uaPrivate));
  const secret = ecdh.computeSecret(asPublic);
  const auth = fromB64u(authSecret), ua = fromB64u(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, auth, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(enc.subarray(enc.length - 16));
  const plain = Buffer.concat([d.update(enc.subarray(0, enc.length - 16)), d.final()]);
  let i = plain.length - 1;
  while (i > 0 && plain[i] === 0) i--;
  return plain.subarray(0, i);
}

function request(endpoint, headers, body, timeout = 15000, agent) {
  return new Promise((resolve, reject) => {
    const u = new URL(endpoint);
    const req = https.request({ method: 'POST', hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, headers, timeout, agent }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8').slice(0, 300) }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

/** Kirim satu notifikasi. Mengembalikan {ok, status, gone}. gone=true → langganan sudah tidak berlaku. */
async function send(sub, payload, { vapid, subject, ttl = 86400, urgency = 'normal', topic, transport = request } = {}) {
  const body = encrypt(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth);
  const headers = {
    Authorization: vapidHeader(sub.endpoint, vapid, subject),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    'Content-Length': body.length,
    TTL: String(ttl),
    Urgency: urgency,
  };
  if (topic) headers.Topic = String(topic).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  let res;
  try { res = await transport(sub.endpoint, headers, body); }
  catch (e) { res = await transport(sub.endpoint, headers, body).catch((e2) => ({ status: 0, body: String(e2.message || e) })); }
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500));
    try { res = await transport(sub.endpoint, headers, body); } catch (e) { res = { status: 0, body: String(e.message) }; }
  }
  return { ok: res.status >= 200 && res.status < 300, status: res.status, gone: res.status === 404 || res.status === 410, detail: res.body };
}

// Host layanan push resmi (cegah server dipakai untuk meminta alamat sembarang / SSRF)
const ALLOWED_PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)windows\.com$/, /(^|\.)apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/];
function endpointAllowed(endpoint, extra = []) {
  let u;
  try { u = new URL(endpoint); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  return [...ALLOWED_PUSH_HOSTS, ...extra].some((re) => re.test(u.hostname));
}

module.exports = { generateVapid, vapidHeader, encrypt, decrypt, send, endpointAllowed, b64u, fromB64u };
