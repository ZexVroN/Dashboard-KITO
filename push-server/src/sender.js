'use strict';
/* Mengirim satu notifikasi ke banyak langganan: paralel terbatas, retry sekali, bersihkan langganan mati. */
const webpush = require('./webpush');
const { pool } = require('./util');

const MAX_FAIL = 5; // langganan dihapus setelah gagal beruntun sebanyak ini (selain 404/410 yang langsung dihapus)

function createSender({ db, config, log = console }) {
  const vapid = { ...config.vapid, keyObject: webpush.vapidKeyObject(config.vapid.publicKey, config.vapid.privateKey) };

  // isi notifikasi yang dibaca service worker (sw.js)
  function buildPayload(n) {
    return {
      title: String(n.title).slice(0, 120),
      body: n.body ? String(n.body).slice(0, 500) : '',
      url: n.url || config.defaultUrl || './',
      icon: n.icon || config.defaultIcon || undefined,
      badge: n.badge || undefined,
      image: n.image || undefined,
      tag: n.tag || undefined,
      renotify: !!n.tag && n.renotify !== false,
      requireInteraction: !!n.requireInteraction,
      // tombol aksi (maks 2): tampil di Chrome/Edge desktop & Android; iOS/Safari mengabaikannya
      actions: n.actions?.length ? n.actions.map((x, i) => ({ action: 'a' + i, title: x.title })) : undefined,
      data: { ...(n.data && typeof n.data === 'object' ? n.data : {}), ...(n.actions?.length ? { actions: Object.fromEntries(n.actions.map((x, i) => ['a' + i, x.url])) } : {}) },
      ts: Date.now(),
    };
  }

  async function sendOne(sub, payload, opt) {
    const target = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    const o = { vapid, ttl: opt.ttl, urgency: opt.urgency, topic: opt.topic, allowInsecure: config.allowInsecurePush };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await webpush.send(target, payload, o);
        if (r.statusCode >= 200 && r.statusCode < 300) { db.markOk(sub.id); return 'sent'; }
        if (r.statusCode === 404 || r.statusCode === 410) { db.deleteById(sub.id); return 'removed'; } // kedaluwarsa / dicabut
        if ((r.statusCode === 429 || r.statusCode >= 500) && attempt === 0) {
          const wait = Math.min(Number(r.retryAfter) * 1000 || 1500, 10000);
          await new Promise((res) => setTimeout(res, wait));
          continue;
        }
        log.warn?.(`[push] ${r.statusCode} ${new URL(sub.endpoint).host}: ${r.body.slice(0, 200)}`);
        break;
      } catch (e) {
        if (attempt === 0) continue;
        log.warn?.(`[push] error ${new URL(sub.endpoint).host}: ${e.message}`);
      }
    }
    if (db.markFail(sub.id) >= MAX_FAIL) { db.deleteById(sub.id); return 'removed'; }
    return 'failed';
  }

  /**
   * @param n {title, body?, url?, icon?, tag?, data?, ttl?, urgency?, target:{all|topics|endpoints, platforms?}}
   */
  async function dispatch(n, source = 'api') {
    const subs = db.findTargets(n.target);
    const id = db.logNotification({ ...n, source });
    const payload = JSON.stringify(buildPayload(n));
    const res = await pool(subs, config.concurrency, (s) => sendOne(s, payload, { ttl: n.ttl, urgency: n.urgency, topic: n.collapseKey }));
    const r = { id, targets: subs.length, sent: 0, failed: 0, removed: 0 };
    for (const x of res) r[x]++;
    db.finishNotification(id, r);
    log.info?.(`[push] #${id} "${n.title}" -> ${r.targets} target, ${r.sent} terkirim, ${r.failed} gagal, ${r.removed} dihapus`);
    return r;
  }

  return { dispatch, buildPayload };
}

module.exports = { createSender };
