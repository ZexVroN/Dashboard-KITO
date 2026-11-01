'use strict';
const crypto = require('node:crypto');

// deteksi platform & browser dari User-Agent (untuk statistik dan target per platform)
function detect(ua = '') {
  const u = String(ua);
  let platform = 'lainnya';
  if (/iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && /Mobile\//.test(u))) platform = 'ios';
  else if (/Android/.test(u)) platform = 'android';
  else if (/Windows/.test(u)) platform = 'windows';
  else if (/Macintosh|Mac OS X/.test(u)) platform = 'macos';
  else if (/CrOS|Linux|X11/.test(u)) platform = 'linux';
  let browser = 'lainnya';
  if (/Edg\//.test(u)) browser = 'edge';
  else if (/SamsungBrowser/.test(u)) browser = 'samsung';
  else if (/OPR\//.test(u)) browser = 'opera';
  else if (/Firefox\//.test(u)) browser = 'firefox';
  else if (/Chrome\//.test(u) || /CriOS/.test(u)) browser = 'chrome';
  else if (/Safari\//.test(u)) browser = 'safari';
  return { platform, browser };
}

// topik: huruf kecil, mis. "semua", "area:jambi", "cabang:11000", "region:r2"
const TOPIC_RE = /^[a-z0-9][a-z0-9:_.\- ]{0,63}$/;
function normTopic(t) {
  const s = String(t ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return TOPIC_RE.test(s) ? s : null;
}
function normTopics(list, max) {
  if (!Array.isArray(list)) return null;
  const out = [...new Set(list.map(normTopic))];
  if (out.some((t) => t === null) || out.length > max) return null;
  return out;
}

function hostAllowed(endpoint, patterns, allowInsecure) {
  let u;
  try { u = new URL(endpoint); } catch { return false; }
  if (u.protocol !== 'https:' && !(allowInsecure && u.protocol === 'http:')) return false;
  if (allowInsecure && ['localhost', '127.0.0.1'].includes(u.hostname)) return true;
  return patterns.some((p) => (p.startsWith('*.') ? u.hostname.endsWith(p.slice(1)) : u.hostname === p));
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// pembatas laju sederhana per kunci (IP), jendela geser 1 menit
function rateLimiter(perMinute) {
  const hits = new Map();
  setInterval(() => { const t = Date.now() - 60000; for (const [k, v] of hits) { const f = v.filter((x) => x > t); f.length ? hits.set(k, f) : hits.delete(k); } }, 60000).unref();
  return (key) => {
    const now = Date.now(), arr = (hits.get(key) || []).filter((x) => x > now - 60000);
    arr.push(now); hits.set(key, arr);
    return arr.length <= perMinute;
  };
}

// menjalankan tugas async dengan batas paralel
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

module.exports = { detect, normTopic, normTopics, hostAllowed, safeEqual, rateLimiter, pool };
