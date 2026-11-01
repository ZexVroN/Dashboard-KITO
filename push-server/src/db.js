'use strict';
/* Memilih penyimpanan dan lokasinya secara otomatis.
   - Driver: SQLite bawaan Node (node:sqlite, Node 22.13+) bila tersedia; selain itu file JSON (db-json.js).
     Bisa dipaksa dengan DB_DRIVER=sqlite|json.
   - Lokasi: DB_PATH; bila tidak bisa dibuat/ditulis (mis. masih berisi contoh), coba ~/kito-push-data/,
     lalu ./data/ di folder aplikasi (peringatan: folder aplikasi di sebagian hosting ditimpa saat deploy). */
const os = require('node:os');
const path = require('node:path');

function sqliteTersedia() {
  try { return !!require('node:sqlite').DatabaseSync; } catch { return false; }
}

function pilihDriver(pref) {
  if (pref === 'json') return 'json';
  if (pref === 'sqlite') return 'sqlite';
  return sqliteTersedia() ? 'sqlite' : 'json';
}

function bukaSatu(driver, dbPath) {
  if (driver === 'json') {
    const p = dbPath === ':memory:' ? dbPath : dbPath.replace(/\.(db|sqlite3?)$/i, '') + '.json';
    return { db: require('./db-json').open(p), path: p };
  }
  const db = require('./db-sqlite').open(dbPath);
  db.driver = 'sqlite';
  return { db, path: dbPath };
}

/** @returns {{db, driver, path, peringatan: string[]}} */
function open(dbPath, { driver: pref = process.env.DB_DRIVER, appDir = path.join(__dirname, '..') } = {}) {
  const driver = pilihDriver(pref);
  const peringatan = [];
  if (driver === 'json' && pref !== 'json') peringatan.push(`node:sqlite tidak tersedia di Node ${process.versions.node}; memakai penyimpanan file JSON (tetap berfungsi). Untuk SQLite pilih Node 22.13+ / 24.`);
  if (dbPath === ':memory:') return { ...bukaSatu(driver, dbPath), driver, peringatan };
  const kandidat = [...new Set([dbPath, path.join(os.homedir(), 'kito-push-data', 'push.db'), path.join(appDir, 'data', 'push.db')])];
  let galat = null;
  for (const p of kandidat) {
    try {
      const r = bukaSatu(driver, p);
      if (p !== dbPath) {
        peringatan.push(`DB_PATH "${dbPath}" tidak bisa dipakai (${galat?.code || galat?.message}); database dipindah ke ${r.path}.`
          + (p.startsWith(appDir) ? ' Lokasi ini di dalam folder aplikasi dan bisa terhapus saat deploy ulang: perbaiki DB_PATH.' : ''));
      }
      return { ...r, driver, peringatan };
    } catch (e) { galat = galat || e; }
  }
  throw new Error(`Database tidak bisa dibuat di lokasi mana pun (${kandidat.join(', ')}): ${galat?.message}`);
}

module.exports = { open, sqliteTersedia };
