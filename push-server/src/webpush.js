'use strict';
/**
 * Web Push tanpa dependensi luar (hanya modul bawaan Node).
 *   - VAPID (RFC 8292): JWT ES256 di header Authorization: vapid t=..., k=...
 *   - Enkripsi payload (RFC 8291 + RFC 8188, "aes128gcm")
 * Satu protokol ini menjangkau Chrome/Edge/Firefox/Safari desktop, Android (Chrome, PWA),
 * dan iOS/iPadOS 16.4+ (PWA yang ditambahkan ke Layar Utama).
 */
const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url');

/* ---------- kunci VAPID ---------- */
function generateVapidKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

// kunci privat mentah (32 byte) + publik (65 byte) -> KeyObject untuk tanda tangan ES256
function vapidKeyObject(publicKey, privateKey) {
  const pub = unb64u(publicKey), priv = unb64u(privateKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY tidak valid (harus 65 byte, titik P-256 tak terkompresi)');
  if (priv.length !== 32) throw new Error('VAPID_PRIVATE_KEY tidak valid (harus 32 byte)');
  return crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: b64u(priv), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: 'jwk',
  });
}

function vapidJwt({ audience, subject, keyObject, expSeconds = 12 * 3600 }) {
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + expSeconds, sub: subject }));
  const input = `${header}.${claims}`;
  const sig = crypto.sign('sha256', Buffer.from(input), { key: keyObject, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64u(sig)}`;
}

/* ---------- enkripsi aes128gcm (RFC 8291) ---------- */
const RS = 4096;
const MAX_PAYLOAD = RS - 16 - 1 - 86; // batas aman per spesifikasi (~3993 byte)

function encrypt(payload, p256dh, auth, { salt, asKeys } = {}) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  if (uaPublic.length !== 65) throw new Error('p256dh tidak valid');
  if (authSecret.length < 16) throw new Error('auth tidak valid');
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  if (data.length > MAX_PAYLOAD) throw new Error(`payload terlalu besar (${data.length} > ${MAX_PAYLOAD} byte)`);

  const ecdh = crypto.createECDH('prime256v1');
  if (asKeys) ecdh.setPrivateKey(asKeys); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublic);
  salt = salt || crypto.randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', ecdhSecret, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([data, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(RS);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/* ---------- kirim ke push service ---------- */
/**
 * @param {{endpoint:string, keys:{p256dh:string, auth:string}}} sub
 * @param {string|object} payload
 * @param {{vapid:{publicKey,privateKey,subject,keyObject?}, ttl?:number, urgency?:string, topic?:string, timeoutMs?:number, allowInsecure?:boolean}} opt
 * @returns {Promise<{statusCode:number, body:string, retryAfter?:string}>}
 */
function send(sub, payload, opt) {
  const url = new URL(sub.endpoint);
  if (url.protocol !== 'https:' && !(opt.allowInsecure && url.protocol === 'http:')) {
    return Promise.reject(new Error('endpoint harus https'));
  }
  const keyObject = opt.vapid.keyObject || vapidKeyObject(opt.vapid.publicKey, opt.vapid.privateKey);
  const jwt = vapidJwt({ audience: url.origin, subject: opt.vapid.subject, keyObject });
  const body = payload == null ? null : encrypt(typeof payload === 'string' ? payload : JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth);
  const headers = {
    TTL: String(Math.max(0, Math.min(opt.ttl ?? 86400, 2419200))),
    Urgency: ['very-low', 'low', 'normal', 'high'].includes(opt.urgency) ? opt.urgency : 'normal',
    Authorization: `vapid t=${jwt}, k=${opt.vapid.publicKey}`,
  };
  if (opt.topic) headers.Topic = String(opt.topic).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  if (body) { headers['Content-Type'] = 'application/octet-stream'; headers['Content-Encoding'] = 'aes128gcm'; headers['Content-Length'] = body.length; }
  else headers['Content-Length'] = 0;

  const lib = url.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = lib.request(url, { method: 'POST', headers, timeout: opt.timeoutMs || 15000, agent: opt.agent }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { if (text.length < 2000) text += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: text, retryAfter: res.headers['retry-after'] }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/* ---------- dekripsi (dipakai pengujian, meniru browser) ---------- */
function decrypt(buf, uaPrivate, uaPublic, auth) {
  const salt = buf.subarray(0, 16), idlen = buf[20], asPublic = buf.subarray(21, 21 + idlen), ct = buf.subarray(21 + idlen);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.setPrivateKey(uaPrivate);
  const ecdhSecret = ecdh.computeSecret(asPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', ecdhSecret, auth, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = plain.length - 1; while (end >= 0 && plain[end] === 0) end--;
  if (plain[end] !== 2) throw new Error('delimiter record tidak valid');
  return plain.subarray(0, end);
}

module.exports = { generateVapidKeys, vapidKeyObject, vapidJwt, encrypt, decrypt, send, MAX_PAYLOAD, b64u, unb64u };
