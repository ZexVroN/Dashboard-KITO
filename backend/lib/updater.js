'use strict';
// Update data dashboard dari file Excel: unggah → proses (skrip Python di tools/) di folder staging → pratinjau → publikasi/rollback.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { spawn } = require('child_process');

const SLOTS = {
  antrian: { label: 'Waktu Tunggu Antrian', hint: 'DDMMYYYY_Dashboard_Antrian_Cabang.xlsx', sheets: ['Calc', 'Per Cabang'] },
  o2o: { label: 'Utilisasi O2O (Ganti Kartu)', hint: 'Dashboard_Monitoring_Ganti_Kartu_DD_Okt_26.xlsx', sheets: ['Cabang O2O', 'Cabang by Channel', 'Area O2O', 'Region O2O', 'Regional by Channel'] },
  nbds: { label: 'Utilisasi NBDS', hint: 'Monitoring_Utilisasi_NBDS_sd_DD_Oktober_2026.xlsx', sheets: ['Cab F P', 'Cab F NP', 'Cab NF', 'Raw', 'Region'] },
  inbranch: { label: 'Report Inbranch (MTD)', hint: 'Report Inbranch (MTD) - DD Oktober.xlsx', sheets: ['Laporan Cabang', 'pegawai'] },
};
const DATA_FILES = ['data.js', 'area-waktu-data.js', 'area-kelompok-data.js', 'area-o2o-data.js', 'area-nbds-data.js', 'region-data.js', 'infografis-data.js', 'pegawai-data.js'];
const GLOBALS = { 'area-waktu-data.js': 'KITO_AREA_WAKTU', 'area-kelompok-data.js': 'KITO_AREA_KELOMPOK', 'area-o2o-data.js': 'KITO_AREA_O2O', 'area-nbds-data.js': 'KITO_AREA_NBDS', 'region-data.js': 'KITO_REGION', 'infografis-data.js': 'KITO_INFO_DATA', 'pegawai-data.js': 'KITO_PEGAWAI_DATA' };

// hash isi berkas dengan mengabaikan perbedaan akhir baris (CRLF/LF) & spasi di ujung — agar tidak ada "perubahan palsu"
const sha = (f) => { try { return crypto.createHash('sha256').update(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').trimEnd()).digest('hex'); } catch { return null; } };
const rid = () => crypto.randomBytes(5).toString('hex');
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

class Updater {
  constructor({ siteDir, dataDir, store, python = process.env.KITO_PYTHON || 'python3', maxUploadMB = 400, log = console.log }) {
    this.site = siteDir; this.dir = dataDir; this.store = store; this.python = python; this.maxBytes = maxUploadMB * 1048576; this.log = log;
    this.src = path.join(dataDir, 'sources'); this.stg = path.join(dataDir, 'staging'); this.bak = path.join(dataDir, 'backups');
    for (const d of [this.src, this.stg, this.bak]) fs.mkdirSync(d, { recursive: true });
    this.jobs = new Map(); this.running = null;
    this.meta = () => this.store.get('sources', {});
    this.history = () => this.store.get('updates', []);
  }

  // ---------- sumber (file unggahan terakhir per slot)
  status() {
    const m = this.meta();
    return Object.entries(SLOTS).map(([k, s]) => ({ slot: k, label: s.label, hint: s.hint, file: m[k] || null }));
  }
  srcPath(slot) { return path.join(this.src, slot + '.xlsx'); }

  /** Terima unggahan mentah (stream) → simpan ke disk tanpa memuat penuh ke memori. */
  receive(slot, filename, req) {
    return new Promise((resolve, reject) => {
      if (!SLOTS[slot]) return reject(Object.assign(new Error('Slot tidak dikenal'), { code: 400 }));
      const len = Number(req.headers['content-length'] || 0);
      if (len > this.maxBytes) return reject(Object.assign(new Error(`File terlalu besar (maks ${this.maxBytes / 1048576} MB)`), { code: 413 }));
      if (this.running) return reject(Object.assign(new Error('Proses update sedang berjalan; tunggu selesai'), { code: 409 }));
      const part = this.srcPath(slot) + '.part';
      const out = fs.createWriteStream(part);
      let n = 0, head = Buffer.alloc(0), failed = false;
      const fail = (e) => { if (failed) return; failed = true; out.destroy(); fs.rm(part, { force: true }, () => {}); reject(e); };
      req.on('data', (c) => {
        n += c.length;
        if (head.length < 4) head = Buffer.concat([head, c]).subarray(0, 4);
        if (n > this.maxBytes) { req.destroy(); fail(Object.assign(new Error('File melebihi batas ukuran'), { code: 413 })); }
      });
      req.on('error', fail);
      req.on('aborted', () => fail(new Error('Unggahan dibatalkan')));
      out.on('error', fail);
      out.on('finish', () => {
        if (failed) return;
        if (n < 100 || head.toString('latin1') !== 'PK\u0003\u0004') return fail(Object.assign(new Error('Bukan file Excel (.xlsx) yang valid'), { code: 400 }));
        fs.renameSync(part, this.srcPath(slot));
        const m = this.meta();
        m[slot] = { name: String(filename || slot + '.xlsx').replace(/[^\w .()\-]/g, '_').slice(0, 120), size: n, uploadedAt: new Date().toISOString(), sheets: null };
        this.store.set('sources', m);
        resolve(m[slot]);
      });
      req.pipe(out);
    });
  }

  run(cmd, args, cwd, onLine, timeoutMs = 45 * 60 * 1000) {
    return new Promise((resolve) => {
      const p = spawn(cmd, args, { cwd, env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' } });
      const feed = (c) => String(c).split(/\r?\n/).filter(Boolean).forEach(onLine);
      p.stdout.on('data', feed); p.stderr.on('data', feed);
      const to = setTimeout(() => { onLine('! Batas waktu terlampaui, proses dihentikan'); p.kill('SIGKILL'); }, timeoutMs);
      p.on('error', (e) => { clearTimeout(to); onLine('! ' + e.message); resolve(127); });
      p.on('close', (code) => { clearTimeout(to); resolve(code); });
    });
  }

  async inspect(slot) { // baca daftar sheet (tanpa openpyxl: cukup zipfile)
    let out = '';
    const code = await this.run(this.python, ['tools/inspect_xlsx.py', this.srcPath(slot)], this.site, (l) => { out += l; });
    if (code !== 0) throw new Error(out || 'Gagal membaca file Excel');
    return JSON.parse(out);
  }

  // ---------- job: validasi + proses di staging
  start(slots) {
    if (this.running) throw Object.assign(new Error('Proses update lain sedang berjalan'), { code: 409 });
    const m = this.meta();
    const baru = slots.filter((s) => SLOTS[s]);
    if (!baru.length) throw Object.assign(new Error('Pilih minimal satu jenis data'), { code: 400 });
    const perlu = new Set();
    const antrianO2o = baru.includes('antrian') || baru.includes('o2o');
    const harian = antrianO2o || baru.includes('nbds');
    if (harian) ['antrian', 'o2o', 'nbds'].forEach((s) => perlu.add(s));
    if (baru.includes('inbranch')) perlu.add('inbranch');
    const kurang = [...perlu].filter((s) => !m[s]);
    if (kurang.length) throw Object.assign(new Error('File belum diunggah: ' + kurang.map((s) => SLOTS[s].label).join(', ') + '. Pembaruan harian memerlukan Antrian, O2O, dan NBDS (file yang pernah diunggah dipakai ulang).'), { code: 400 });

    const job = { id: rid(), createdAt: new Date().toISOString(), status: 'running', slots: baru, log: [], steps: [], published: false, summary: null, changes: [] };
    this.jobs.set(job.id, job); this.running = job.id;
    const line = (l) => { job.log.push(l); if (job.log.length > 4000) job.log.splice(0, 500); };
    this._execute(job, { antrianO2o, nbds: baru.includes('nbds'), harian, inbranch: baru.includes('inbranch') }, line)
      .catch((e) => { line('! ' + (e.message || e)); job.status = 'error'; })
      .finally(() => { job.finishedAt = new Date().toISOString(); this.running = null; });
    return job.id;
  }

  async _execute(job, plan, line) {
    const root = path.join(this.stg, job.id);
    fs.mkdirSync(path.join(root, 'assets', 'js'), { recursive: true });
    fs.cpSync(path.join(this.site, 'tools'), path.join(root, 'tools'), { recursive: true });
    for (const f of DATA_FILES) if (fs.existsSync(path.join(this.site, 'assets/js', f))) fs.copyFileSync(path.join(this.site, 'assets/js', f), path.join(root, 'assets/js', f));
    line('› Staging dibuat: ' + job.id);

    // validasi sheet
    const dipakai = new Set([...(plan.harian ? ['antrian', 'o2o', 'nbds'] : []), ...(plan.inbranch ? ['inbranch'] : [])]);
    for (const s of dipakai) {
      line(`› Memeriksa ${SLOTS[s].label}…`);
      const info = await this.inspect(s);
      const ada = info.sheets.map((x) => x.trim());
      const hilang = SLOTS[s].sheets.filter((x) => !ada.includes(x));
      if (hilang.length) throw new Error(`${SLOTS[s].label}: sheet wajib tidak ditemukan → ${hilang.join(', ')}. Sheet di file: ${info.sheets.join(', ')}`);
      line(`  ✓ ${info.sheets.length} sheet, semua sheet wajib ada`);
    }
    const a = this.srcPath('antrian'), o = this.srcPath('o2o'), n = this.srcPath('nbds');
    const step = async (judul, args) => {
      line(`› ${judul}`);
      const t0 = Date.now();
      const code = await this.run(this.python, args, root, (l) => line('  ' + l));
      job.steps.push({ judul, ok: code === 0, detik: Math.round((Date.now() - t0) / 1000) });
      if (code !== 0) throw new Error(`Langkah gagal: ${judul} (kode ${code})`);
    };
    if (plan.antrianO2o || plan.harian) await step('Waktu tunggu antrian + Utilisasi O2O', ['tools/update_antrian_o2o.py', '--antrian', a, '--o2o', o]);
    if (plan.harian) await step('Utilisasi NBDS', ['tools/convert_nbds_bankwide.py', n]);
    if (plan.harian) await step('Dashboard Region', ['tools/build_region.py', '--antrian', a, '--o2o', o, '--nbds', n]);
    if (plan.inbranch) await step('Report Inbranch (MTD)', ['tools/convert_inbranch.py', this.srcPath('inbranch'), '--source-name', (this.meta().inbranch || {}).name || 'inbranch.xlsx', '--out', path.join(root, 'assets/js')]);

    // validasi hasil + ringkasan perubahan
    line('› Memeriksa hasil…');
    job.changes = DATA_FILES.map((f) => {
      const s = path.join(root, 'assets/js', f), l = path.join(this.site, 'assets/js', f);
      const hs = sha(s), hl = sha(l);
      return { file: f, status: hs === hl ? 'sama' : hl ? 'berubah' : 'baru', size: fs.existsSync(s) ? fs.statSync(s).size : 0, oldSize: fs.existsSync(l) ? fs.statSync(l).size : 0 };
    });
    const bad = [];
    job.summary = this.summarize(path.join(root, 'assets/js'), bad);
    job.live = this.summarize(path.join(this.site, 'assets/js'), []);
    if (bad.length) throw new Error('Hasil tidak valid: ' + bad.join('; '));
    for (const w of job.summary.warnings || []) line('  ! ' + w);
    line(`✓ Selesai. ${job.changes.filter((c) => c.status !== 'sama').length} file berubah.`);
    job.status = 'ready';
  }

  /** Baca file data yang dihasilkan dan ringkas (tanggal, jumlah) — sekaligus memastikan file dapat dimuat. */
  summarize(dir, bad) {
    const out = { warnings: [] };
    const load = (f, expr) => {
      const p = path.join(dir, f);
      if (!fs.existsSync(p)) { bad.push(f + ' tidak ada'); return null; }
      try { return vm.runInNewContext(fs.readFileSync(p, 'utf8') + '\n;' + expr, { window: {} }, { timeout: 8000 }); }
      catch (e) { bad.push(`${f}: ${String(e.message).slice(0, 80)}`); return null; }
    };
    const D = load('data.js', 'D');
    if (D) {
      out.antrian = { tanggalTerakhir: D.dates && D.dates[D.dates.length - 1], tanggalLaporanO2O: D.mdate, jumlahCabang: D.B && D.B.length, jumlahTanggal: D.dates && D.dates.length };
      if (!D.B || D.B.length < 50) bad.push('data.js: jumlah cabang tidak wajar');
      if (D.Q && D.B && D.Q.length !== D.B.length) bad.push('data.js: Q tidak sinkron dengan daftar cabang');
    }
    for (const [f, g] of Object.entries(GLOBALS)) {
      const v = load(f, `window.${g}`);
      if (!v) continue;
      const tgl = v.tanggal || (v.dates && v.dates[v.dates.length - 1]) || (v.region && v.region.tanggal) || null;
      out[f] = { tanggal: tgl, baris: Array.isArray(v.rows) ? v.rows.length : Array.isArray(v.cabang) ? v.cabang.length : Array.isArray(v.areas) ? v.areas.length : Array.isArray(v) ? v.length : undefined };
    }
    return out;
  }

  getJob(id) { return this.jobs.get(id); }
  publicJob(j, from = 0) {
    return j && { id: j.id, status: j.status, createdAt: j.createdAt, finishedAt: j.finishedAt, slots: j.slots, steps: j.steps, changes: j.changes, summary: j.summary, live: j.live, published: j.published, log: j.log.slice(from), logTotal: j.log.length };
  }

  // ---------- publikasi
  publish(id) {
    const j = this.jobs.get(id);
    if (!j || j.status !== 'ready') throw Object.assign(new Error('Job belum siap dipublikasikan'), { code: 400 });
    if (j.published) throw Object.assign(new Error('Job ini sudah dipublikasikan'), { code: 409 });
    const root = path.join(this.stg, id, 'assets/js');
    const diff = j.changes.filter((c) => c.status !== 'sama');
    if (!diff.length) throw Object.assign(new Error('Tidak ada perubahan untuk dipublikasikan'), { code: 400 });
    const bid = stamp() + '-' + id;
    const bdir = path.join(this.bak, bid);
    fs.mkdirSync(bdir, { recursive: true });
    const index = path.join(this.site, 'index.html');
    fs.copyFileSync(index, path.join(bdir, 'index.html'));
    for (const c of diff) {
      const live = path.join(this.site, 'assets/js', c.file);
      if (fs.existsSync(live)) fs.copyFileSync(live, path.join(bdir, c.file));
    }
    for (const c of diff) { // tulis atomik
      const live = path.join(this.site, 'assets/js', c.file);
      fs.copyFileSync(path.join(root, c.file), live + '.new'); fs.renameSync(live + '.new', live);
    }
    const bumped = this.bumpVersions(diff.map((c) => c.file));
    j.published = true;
    const rec = { id: bid, jobId: id, at: new Date().toISOString(), files: diff.map((c) => c.file), bumped, summary: { antrian: j.summary.antrian, inbranch: (j.summary['infografis-data.js'] || {}).tanggal }, slots: j.slots, sources: Object.fromEntries(j.slots.map((s) => [s, (this.meta()[s] || {}).name])) };
    const h = this.history(); h.unshift(rec); this.store.set('updates', h.slice(0, 100));
    this.pruneBackups();
    return rec;
  }

  bumpVersions(files) {
    const index = path.join(this.site, 'index.html');
    let html = fs.readFileSync(index, 'utf8'), bumped = {};
    for (const f of files) {
      const re = new RegExp(`(assets/js/${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?v=)(\\d+)`);
      html = html.replace(re, (_, p, v) => { bumped[f] = Number(v) + 1; return p + (Number(v) + 1); });
    }
    fs.writeFileSync(index + '.new', html); fs.renameSync(index + '.new', index);
    return bumped;
  }

  rollback(bid) {
    const bdir = path.join(this.bak, path.basename(String(bid)));
    if (!fs.existsSync(bdir)) throw Object.assign(new Error('Backup tidak ditemukan'), { code: 404 });
    if (this.running) throw Object.assign(new Error('Proses update sedang berjalan'), { code: 409 });
    const files = fs.readdirSync(bdir).filter((f) => DATA_FILES.includes(f));
    for (const f of files) { const live = path.join(this.site, 'assets/js', f); fs.copyFileSync(path.join(bdir, f), live + '.new'); fs.renameSync(live + '.new', live); }
    const bumped = this.bumpVersions(files); // naikkan ?v= agar browser memuat ulang berkas lama yang dipulihkan
    const rec = { id: 'rollback-' + stamp(), at: new Date().toISOString(), files, bumped, rollbackOf: bid };
    const h = this.history(); h.unshift(rec); this.store.set('updates', h.slice(0, 100));
    return rec;
  }
  pruneBackups(keep = 15) {
    const all = fs.readdirSync(this.bak).sort();
    for (const d of all.slice(0, Math.max(0, all.length - keep))) fs.rmSync(path.join(this.bak, d), { recursive: true, force: true });
    const js = [...this.jobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const j of js.slice(0, Math.max(0, js.length - 5))) { fs.rmSync(path.join(this.stg, j.id), { recursive: true, force: true }); this.jobs.delete(j.id); }
  }

  /** Berkas untuk "Export data": dari staging (job) atau dari data yang sedang tayang. */
  exportFiles(jobId) {
    const base = jobId && jobId !== 'live' ? path.join(this.stg, path.basename(jobId), 'assets/js') : path.join(this.site, 'assets/js');
    if (!fs.existsSync(base)) throw Object.assign(new Error('Sumber export tidak ditemukan'), { code: 404 });
    return DATA_FILES.filter((f) => fs.existsSync(path.join(base, f))).map((f) => ({ name: 'assets/js/' + f, data: fs.readFileSync(path.join(base, f)) }));
  }
  backups() { return fs.readdirSync(this.bak).sort().reverse().map((d) => ({ id: d, files: fs.readdirSync(path.join(this.bak, d)).filter((f) => f !== 'index.html') })); }
}
module.exports = { Updater, SLOTS, DATA_FILES };
