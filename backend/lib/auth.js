'use strict';
// Autentikasi admin: password di-hash scrypt, sesi = cookie bertanda tangan HMAC (HttpOnly, SameSite=Strict).
const crypto = require('crypto');

function hashPassword(pw, salt = crypto.randomBytes(16)) {
  const h = crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64url')}$${h.toString('base64url')}`;
}
function verifyPassword(pw, stored) {
  const [alg, s, h] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const calc = crypto.scryptSync(pw, Buffer.from(s, 'base64url'), 32, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(h, 'base64url');
  return want.length === calc.length && crypto.timingSafeEqual(calc, want);
}

class Sessions {
  constructor(secret, ttlMs = 12 * 3600 * 1000) { this.secret = secret; this.ttl = ttlMs; }
  sign(p) { return crypto.createHmac('sha256', this.secret).update(p).digest('base64url'); }
  create() {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + this.ttl, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }
  valid(token) {
    if (!token || !token.includes('.')) return false;
    const [p, sig] = token.split('.');
    const want = this.sign(p);
    if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return false;
    try { return JSON.parse(Buffer.from(p, 'base64url').toString()).exp > Date.now(); } catch { return false; }
  }
}

class RateLimit {
  constructor(max, windowMs) { this.max = max; this.win = windowMs; this.hits = new Map(); }
  hit(key) {
    const now = Date.now();
    const arr = (this.hits.get(key) || []).filter((t) => now - t < this.win);
    arr.push(now);
    this.hits.set(key, arr);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.win)) this.hits.delete(k);
    return arr.length <= this.max;
  }
  reset(key) { this.hits.delete(key); }
}

function parseCookies(h) {
  const out = {};
  String(h || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
module.exports = { hashPassword, verifyPassword, Sessions, RateLimit, parseCookies };
