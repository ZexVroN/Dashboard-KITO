'use strict';
/* Entry file untuk hosting (Hostinger "Entry file: server.js", cPanel/Plesk Node.js, dsb.). Sama dengan: npm start.
   Semua error start dicetak jelas ke log (Hostinger: Runtime logs / stderr.log). */
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });
process.on('uncaughtException', (e) => { console.error('[KITO Push] error tidak tertangani:', e); });
process.on('unhandledRejection', (e) => { console.error('[KITO Push] promise ditolak:', e); });
console.log(`[KITO Push] start · Node ${process.versions.node} · PORT=${process.env.PORT || '(kosong)'} · cwd ${process.cwd()}`);
try {
  const srv = require('./src/server').start();
  srv.on('error', (e) => console.error('[KITO Push] gagal listen di PORT', process.env.PORT, ':', e));
} catch (e) {
  console.error('[KITO Push] gagal memuat server:', e);
  // tetap jawab permintaan agar penyebab terlihat di browser, bukan 503 kosong
  require('node:http').createServer((q, r) => { r.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); r.end('KITO Push gagal start:\n' + (e && e.stack || e)); })
    .listen(/^\d+$/.test(String(process.env.PORT || '')) ? Number(process.env.PORT) : (process.env.PORT || 8080));
}
