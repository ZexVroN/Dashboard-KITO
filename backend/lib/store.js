'use strict';
// Penyimpanan JSON sederhana (tanpa database): tulis atomik + ditunda (debounce) agar ringan.
const fs = require('fs');
const path = require('path');

class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.cache = new Map();
    this.timers = new Map();
    const flush = () => this.flushAll();
    process.on('exit', flush);
    for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { flush(); process.exit(0); });
  }
  file(name) { return path.join(this.dir, name + '.json'); }
  get(name, def) {
    if (this.cache.has(name)) return this.cache.get(name);
    let v;
    try { v = JSON.parse(fs.readFileSync(this.file(name), 'utf8')); }
    catch { v = typeof def === 'function' ? def() : JSON.parse(JSON.stringify(def)); }
    this.cache.set(name, v);
    return v;
  }
  set(name, val) { this.cache.set(name, val); this.save(name); return val; }
  save(name) {
    clearTimeout(this.timers.get(name));
    this.timers.set(name, setTimeout(() => this.flush(name), 200));
  }
  flush(name) {
    clearTimeout(this.timers.get(name));
    this.timers.delete(name);
    if (!this.cache.has(name)) return;
    const f = this.file(name), tmp = f + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.cache.get(name)));
    fs.renameSync(tmp, f);
  }
  flushAll() { for (const n of [...this.timers.keys()]) this.flush(n); }
}
module.exports = { Store };
