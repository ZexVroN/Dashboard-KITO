#!/usr/bin/env node
'use strict';
/**
 * Kirim notifikasi dari terminal lewat API server.
 *   node scripts/send.js --title "Judul" [--body "Isi"] [--url ./index.html] [--topic semua --topic area:jambi | --all]
 *                        [--platform ios] [--tag update] [--urgency high] [--server http://localhost:8080] [--token ...]
 * Server & token default dari PUSH_SERVER / ADMIN_TOKEN (atau .env).
 */
require('../src/config');
const args = process.argv.slice(2);
const opt = { topics: [], platforms: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i], v = args[i + 1];
  if (a === '--all') opt.all = true;
  else if (a === '--topic') { opt.topics.push(v); i++; }
  else if (a === '--platform') { opt.platforms.push(v); i++; }
  else if (a.startsWith('--')) { opt[a.slice(2)] = v; i++; }
}
if (!opt.title) { console.error('Wajib: --title'); process.exit(1); }
const server = opt.server || process.env.PUSH_SERVER || `http://localhost:${process.env.PORT || 8080}`;
const token = opt.token || process.env.ADMIN_TOKEN;
const body = { title: opt.title, body: opt.body, url: opt.url, tag: opt.tag, urgency: opt.urgency, platforms: opt.platforms };
if (opt.all) body.all = true; else body.topics = opt.topics.length ? opt.topics : ['semua'];

fetch(server + '/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })
  .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); console.log(j); })
  .catch((e) => { console.error('Gagal:', e.message); process.exit(1); });
