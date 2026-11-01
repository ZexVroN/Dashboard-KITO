'use strict';
/* Penyimpanan langganan & riwayat notifikasi (SQLite bawaan Node: node:sqlite). */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function open(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      platform TEXT,            -- android | ios | windows | macos | linux | lainnya
      browser TEXT,             -- chrome | edge | firefox | safari | samsung | lainnya
      standalone INTEGER DEFAULT 0, -- 1 = dibuka sebagai aplikasi (PWA terpasang)
      user_agent TEXT,
      label TEXT,               -- mis. nama cabang / nama pengguna (opsional)
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_success_at TEXT,
      fail_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS subscription_topics (
      subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      PRIMARY KEY (subscription_id, topic)
    );
    CREATE INDEX IF NOT EXISTS idx_topic ON subscription_topics(topic);
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      url TEXT,
      target TEXT NOT NULL,     -- JSON: {"topics":[...]} atau {"all":true}
      sent INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      removed INTEGER NOT NULL DEFAULT 0,
      source TEXT,              -- admin | api | skrip
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS scheduled (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payload TEXT NOT NULL,    -- JSON notifikasi lengkap (judul, isi, target, dst.)
      send_at TEXT NOT NULL,    -- ISO UTC
      status TEXT NOT NULL DEFAULT 'menunggu', -- menunggu | terkirim | dibatalkan | gagal
      notification_id INTEGER,
      result TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sched ON scheduled(status, send_at);
  `);

  const q = {
    upsert: db.prepare(`INSERT INTO subscriptions (endpoint, p256dh, auth, platform, browser, standalone, user_agent, label)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth, platform=excluded.platform,
        browser=excluded.browser, standalone=excluded.standalone, user_agent=excluded.user_agent,
        label=COALESCE(excluded.label, subscriptions.label), updated_at=datetime('now'), fail_count=0
      RETURNING id`),
    byEndpoint: db.prepare('SELECT * FROM subscriptions WHERE endpoint = ?'),
    delEndpoint: db.prepare('DELETE FROM subscriptions WHERE endpoint = ?'),
    delId: db.prepare('DELETE FROM subscriptions WHERE id = ?'),
    clearTopics: db.prepare('DELETE FROM subscription_topics WHERE subscription_id = ?'),
    addTopic: db.prepare('INSERT OR IGNORE INTO subscription_topics (subscription_id, topic) VALUES (?, ?)'),
    topicsOf: db.prepare('SELECT topic FROM subscription_topics WHERE subscription_id = ? ORDER BY topic'),
    ok: db.prepare("UPDATE subscriptions SET last_success_at = datetime('now'), fail_count = 0 WHERE id = ?"),
    fail: db.prepare('UPDATE subscriptions SET fail_count = fail_count + 1 WHERE id = ? RETURNING fail_count'),
    all: db.prepare('SELECT * FROM subscriptions'),
    logNotif: db.prepare('INSERT INTO notifications (title, body, url, target, source) VALUES (?, ?, ?, ?, ?) RETURNING id'),
    doneNotif: db.prepare('UPDATE notifications SET sent = ?, failed = ?, removed = ? WHERE id = ?'),
    history: db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT ?'),
    addSched: db.prepare('INSERT INTO scheduled (payload, send_at) VALUES (?, ?) RETURNING id'),
    dueSched: db.prepare("UPDATE scheduled SET status = 'mengirim' WHERE status = 'menunggu' AND send_at <= ? RETURNING *"),
    doneSched: db.prepare('UPDATE scheduled SET status = ?, notification_id = ?, result = ? WHERE id = ?'),
    cancelSched: db.prepare("UPDATE scheduled SET status = 'dibatalkan' WHERE id = ? AND status = 'menunggu'"),
    listSched: db.prepare('SELECT * FROM scheduled ORDER BY (status = \'menunggu\') DESC, send_at DESC LIMIT ?'),
    resetSched: db.prepare("UPDATE scheduled SET status = 'menunggu' WHERE status = 'mengirim'"),
  };

  const tx = (fn) => (...a) => { db.exec('BEGIN'); try { const r = fn(...a); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };

  return {
    raw: db,
    saveSubscription: tx(({ endpoint, p256dh, auth, platform, browser, standalone, userAgent, label, topics }) => {
      const { id } = q.upsert.get(endpoint, p256dh, auth, platform, browser, standalone ? 1 : 0, userAgent, label ?? null);
      q.clearTopics.run(id);
      for (const t of topics) q.addTopic.run(id, t);
      return id;
    }),
    setTopics: tx((endpoint, topics) => {
      const s = q.byEndpoint.get(endpoint);
      if (!s) return false;
      q.clearTopics.run(s.id);
      for (const t of topics) q.addTopic.run(s.id, t);
      return true;
    }),
    getSubscription(endpoint) {
      const s = q.byEndpoint.get(endpoint);
      return s ? { ...s, topics: q.topicsOf.all(s.id).map((r) => r.topic) } : null;
    },
    deleteByEndpoint: (endpoint) => q.delEndpoint.run(endpoint).changes > 0,
    deleteById: (id) => q.delId.run(id),
    // target: {all:true} | {topics:[...]} | {endpoints:[...]} ; bisa dipersempit dengan platform:[...]
    findTargets(target) {
      let rows;
      if (target.endpoints) {
        rows = target.endpoints.map((e) => q.byEndpoint.get(e)).filter(Boolean);
      } else if (target.all) {
        rows = q.all.all();
      } else {
        const t = target.topics || [];
        if (!t.length) return [];
        rows = db.prepare(`SELECT DISTINCT s.* FROM subscriptions s JOIN subscription_topics st ON st.subscription_id = s.id
          WHERE st.topic IN (${t.map(() => '?').join(',')})`).all(...t);
      }
      if (target.platforms?.length) rows = rows.filter((r) => target.platforms.includes(r.platform));
      return rows;
    },
    markOk: (id) => q.ok.run(id),
    markFail: (id) => q.fail.get(id)?.fail_count ?? 0,
    logNotification: (n) => q.logNotif.get(n.title, n.body ?? null, n.url ?? null, JSON.stringify(n.target), n.source ?? 'api').id,
    finishNotification: (id, r) => q.doneNotif.run(r.sent, r.failed, r.removed, id),
    schedule: (n, sendAt) => q.addSched.get(JSON.stringify(n), sendAt).id,
    takeDue: (nowIso) => q.dueSched.all(nowIso).map((r) => ({ ...r, payload: JSON.parse(r.payload) })),
    finishScheduled: (id, status, notifId, result) => q.doneSched.run(status, notifId ?? null, result ? JSON.stringify(result) : null, id),
    cancelScheduled: (id) => q.cancelSched.run(id).changes > 0,
    listScheduled: (limit = 50) => q.listSched.all(Math.min(Math.max(1, limit), 500)).map((r) => {
      const p = JSON.parse(r.payload);
      return { id: r.id, sendAt: r.send_at, status: r.status, title: p.title, body: p.body, target: p.target, notificationId: r.notification_id, result: r.result ? JSON.parse(r.result) : null, createdAt: r.created_at };
    }),
    resetInterrupted: () => q.resetSched.run().changes, // jadwal yang terputus saat server mati diulang
    history: (limit = 50) => q.history.all(Math.min(Math.max(1, limit), 500)).map((r) => ({ ...r, target: JSON.parse(r.target) })),
    stats() {
      const one = (sql) => db.prepare(sql).all();
      return {
        total: db.prepare('SELECT COUNT(*) n FROM subscriptions').get().n,
        perPlatform: one("SELECT COALESCE(platform, 'lainnya') platform, COUNT(*) n FROM subscriptions GROUP BY 1 ORDER BY 2 DESC"),
        perBrowser: one("SELECT COALESCE(browser, 'lainnya') browser, COUNT(*) n FROM subscriptions GROUP BY 1 ORDER BY 2 DESC"),
        terpasang: db.prepare('SELECT COUNT(*) n FROM subscriptions WHERE standalone = 1').get().n,
        perTopic: one('SELECT topic, COUNT(*) n FROM subscription_topics GROUP BY topic ORDER BY 2 DESC LIMIT 200'),
        notifikasi: db.prepare('SELECT COUNT(*) n FROM notifications').get().n,
      };
    },
    close: () => db.close(),
  };
}

module.exports = { open };
