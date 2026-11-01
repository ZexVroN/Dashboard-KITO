'use strict';
/* Penyimpanan cadangan berbasis satu file JSON, untuk Node yang belum punya node:sqlite
   (Node 18/20, atau 22 sebelum 22.13; misalnya versi bawaan sebagian hosting).
   API sama dengan db-sqlite.js. Cocok untuk ribuan langganan; ditulis atomik (tmp + rename). */
const fs = require('node:fs');
const path = require('node:path');

function open(filePath) {
  const mem = filePath === ':memory:';
  if (!mem) fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let d = { seq: { sub: 0, notif: 0, sched: 0 }, subs: [], notifs: [], sched: [] };
  if (!mem && fs.existsSync(filePath)) d = { ...d, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19); // format sama dengan SQLite datetime('now')

  let timer = null;
  const flush = () => {
    timer = null;
    if (mem) return;
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(d));
    fs.renameSync(tmp, filePath);
  };
  const save = () => { if (!timer) timer = setTimeout(flush, 200); };
  if (!mem) { fs.writeFileSync(filePath + '.tmp', JSON.stringify(d)); fs.renameSync(filePath + '.tmp', filePath); } // uji bisa ditulis sejak awal

  const byEp = (e) => d.subs.find((s) => s.endpoint === e);
  const pub = (s) => (s ? { ...s, topics: [...s.topics].sort() } : null);
  const MAX_NOTIF = 2000;

  return {
    driver: 'json',
    saveSubscription({ endpoint, p256dh, auth, platform, browser, standalone, userAgent, label, topics }) {
      let s = byEp(endpoint);
      if (s) Object.assign(s, { p256dh, auth, platform, browser, standalone: standalone ? 1 : 0, user_agent: userAgent, label: label ?? s.label, updated_at: now(), fail_count: 0, topics: [...new Set(topics)] });
      else d.subs.push(s = { id: ++d.seq.sub, endpoint, p256dh, auth, platform, browser, standalone: standalone ? 1 : 0, user_agent: userAgent, label: label ?? null, created_at: now(), updated_at: now(), last_success_at: null, fail_count: 0, topics: [...new Set(topics)] });
      save(); return s.id;
    },
    setTopics(endpoint, topics) { const s = byEp(endpoint); if (!s) return false; s.topics = [...new Set(topics)]; save(); return true; },
    getSubscription: (endpoint) => pub(byEp(endpoint)),
    deleteByEndpoint(endpoint) { const n = d.subs.length; d.subs = d.subs.filter((s) => s.endpoint !== endpoint); save(); return d.subs.length < n; },
    deleteById(id) { d.subs = d.subs.filter((s) => s.id !== id); save(); },
    findTargets(target) {
      let rows;
      if (target.endpoints) rows = target.endpoints.map(byEp).filter(Boolean);
      else if (target.all) rows = d.subs.slice();
      else { const t = new Set(target.topics || []); rows = t.size ? d.subs.filter((s) => s.topics.some((x) => t.has(x))) : []; }
      if (target.platforms?.length) rows = rows.filter((r) => target.platforms.includes(r.platform));
      return rows;
    },
    markOk(id) { const s = d.subs.find((x) => x.id === id); if (s) { s.last_success_at = now(); s.fail_count = 0; save(); } },
    markFail(id) { const s = d.subs.find((x) => x.id === id); if (!s) return 0; s.fail_count++; save(); return s.fail_count; },
    logNotification(n) {
      const id = ++d.seq.notif;
      d.notifs.push({ id, title: n.title, body: n.body ?? null, url: n.url ?? null, target: n.target, sent: 0, failed: 0, removed: 0, source: n.source ?? 'api', created_at: now() });
      if (d.notifs.length > MAX_NOTIF) d.notifs.splice(0, d.notifs.length - MAX_NOTIF);
      save(); return id;
    },
    finishNotification(id, r) { const n = d.notifs.find((x) => x.id === id); if (n) Object.assign(n, { sent: r.sent, failed: r.failed, removed: r.removed }); save(); },
    history: (limit = 50) => d.notifs.slice(-Math.min(Math.max(1, limit), 500)).reverse(),
    stats() {
      const count = (key) => Object.entries(d.subs.reduce((a, s) => { const k = s[key] || 'lainnya'; a[k] = (a[k] || 0) + 1; return a; }, {})).map(([k, n]) => ({ [key]: k, n })).sort((a, b) => b.n - a.n);
      const topik = {}; d.subs.forEach((s) => s.topics.forEach((t) => { topik[t] = (topik[t] || 0) + 1; }));
      return {
        total: d.subs.length, perPlatform: count('platform'), perBrowser: count('browser'),
        terpasang: d.subs.filter((s) => s.standalone).length,
        perTopic: Object.entries(topik).map(([topic, n]) => ({ topic, n })).sort((a, b) => b.n - a.n).slice(0, 200),
        notifikasi: d.seq.notif,
      };
    },
    schedule(n, sendAt) { const id = ++d.seq.sched; d.sched.push({ id, payload: n, send_at: sendAt, status: 'menunggu', notification_id: null, result: null, created_at: now() }); save(); return id; },
    takeDue(nowIso) { const due = d.sched.filter((j) => j.status === 'menunggu' && j.send_at <= nowIso); due.forEach((j) => { j.status = 'mengirim'; }); if (due.length) save(); return due.map((j) => ({ ...j })); },
    finishScheduled(id, status, notifId, result) { const j = d.sched.find((x) => x.id === id); if (j) Object.assign(j, { status, notification_id: notifId ?? null, result: result ?? null }); save(); },
    cancelScheduled(id) { const j = d.sched.find((x) => x.id === id && x.status === 'menunggu'); if (!j) return false; j.status = 'dibatalkan'; save(); return true; },
    listScheduled(limit = 50) {
      return d.sched.slice().sort((a, b) => (b.status === 'menunggu') - (a.status === 'menunggu') || (a.send_at < b.send_at ? 1 : -1)).slice(0, Math.min(Math.max(1, limit), 500))
        .map((r) => ({ id: r.id, sendAt: r.send_at, status: r.status, title: r.payload.title, body: r.payload.body, target: r.payload.target, notificationId: r.notification_id, result: r.result, createdAt: r.created_at }));
    },
    resetInterrupted() { let n = 0; d.sched.forEach((j) => { if (j.status === 'mengirim') { j.status = 'menunggu'; n++; } }); if (n) save(); return n; },
    // dipakai pengujian: majukan waktu jadwal
    _setSendAt(id, iso) { const j = d.sched.find((x) => x.id === id); if (j) j.send_at = iso; },
    close() { if (timer) { clearTimeout(timer); flush(); } },
  };
}

module.exports = { open };
