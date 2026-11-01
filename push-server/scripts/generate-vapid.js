#!/usr/bin/env node
'use strict';
/* Membuat pasangan kunci VAPID + token admin acak. Simpan hasilnya di .env (jangan di-commit). */
const crypto = require('node:crypto');
const { generateVapidKeys } = require('../src/webpush');

const k = generateVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}
VAPID_PRIVATE_KEY=${k.privateKey}
ADMIN_TOKEN=${crypto.randomBytes(32).toString('base64url')}`);
console.error('\nSalin baris di atas ke push-server/.env. Kunci publik juga dipakai dashboard (diambil otomatis dari /api/vapid-public-key).');
console.error('Jangan ganti kunci VAPID setelah ada pelanggan: semua langganan lama jadi tidak berlaku.');
