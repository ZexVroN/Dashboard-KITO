'use strict';
/* Konfigurasi dari environment variable (lihat .env.example). */
const fs = require('node:fs');
const path = require('node:path');

// muat .env sederhana bila ada (tanpa dependensi dotenv)
const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

const config = {
  port: Number(process.env.PORT || 8080),
  host: process.env.HOST || '0.0.0.0',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'push.db'),
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  },
  adminToken: process.env.ADMIN_TOKEN || '',
  // origin dashboard yang boleh memanggil API dari browser (CORS), mis. https://zexvron.github.io
  allowedOrigins: list(process.env.ALLOWED_ORIGINS),
  // host push service yang diizinkan (cegah SSRF). Default: Google/FCM, Mozilla, Apple, Microsoft.
  pushHosts: list(process.env.PUSH_HOST_ALLOWLIST || 'fcm.googleapis.com,android.googleapis.com,updates.push.services.mozilla.com,push.services.mozilla.com,*.push.apple.com,*.notify.windows.com'),
  allowInsecurePush: process.env.ALLOW_INSECURE_PUSH === '1', // hanya untuk pengujian lokal
  trustProxy: process.env.TRUST_PROXY === '1', // pakai X-Forwarded-For (di belakang Nginx/Caddy)
  defaultIcon: process.env.DEFAULT_ICON || '',
  defaultUrl: process.env.DEFAULT_URL || '',
  concurrency: Number(process.env.SEND_CONCURRENCY || 25),
  maxTopicsPerSub: 30,
};

function validate() {
  const err = [];
  if (!config.vapid.publicKey || !config.vapid.privateKey) err.push('VAPID_PUBLIC_KEY dan VAPID_PRIVATE_KEY wajib diisi (jalankan: npm run vapid)');
  if (!config.adminToken || config.adminToken.length < 24) err.push('ADMIN_TOKEN wajib diisi, minimal 24 karakter acak');
  if (!/^(mailto:|https:)/.test(config.vapid.subject)) err.push('VAPID_SUBJECT harus diawali mailto: atau https:');
  return err;
}

module.exports = { config, validate };
