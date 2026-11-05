// Jalankan: node tools/test_periode_bulan.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'data/kito.json'), 'utf8'));
const code = fs.readFileSync(path.join(root, 'assets/js/periode-bulan.js'), 'utf8');
const parts = ['D', 'KITO_AREA_WAKTU', 'KITO_AREA_KELOMPOK', 'KITO_AREA_O2O', 'KITO_REGION'];
function setup(month) {
  const elements = { sm: {} }, storage = new Map(), events = [];
  const ctx = {
    ...JSON.parse(JSON.stringify(raw)), URL, URLSearchParams, Event,
    location: { search: '?bulan=' + month, href: 'http://localhost:8000/?bulan=' + month, replace() { throw Error('Halaman tidak boleh navigasi'); } },
    history: { replaceState(...args) { ctx.url = args[2]; } },
    sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    document: { getElementById: id => elements[id] },
    dispatchEvent: e => events.push(e.type),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  ctx.st = { a: raw.D.B[0][2], b: 0, d: 0 };
  ctx.tampil = 'area';
  ctx.fill = () => { ctx.fills = (ctx.fills || 0) + 1; };
  ctx.render = () => { ctx.renders = (ctx.renders || 0) + 1; };
  return { ctx, elements, storage, events };
}
const months = [...new Set(raw.D.dates.map(d => d.slice(0, 7)))].sort();
assert(months.length > 1, 'Butuh data lintas bulan untuk regresi');
const { ctx, elements, storage, events } = setup(months.at(-1));
const refs = [ctx.D, ctx.KITO_REGION.regions[0], ctx.KITO_AREA_WAKTU.areas[0], ctx.KITO_AREA_KELOMPOK[0], ctx.KITO_AREA_O2O.areas[0]];
let changes = 0;
for (const month of [...months, ...months.slice().reverse(), ...months]) {
  if (month !== ctx.KITO_BULAN.aktif) changes++;
  ctx.KITO_BULAN.ganti(month);
  const expected = setup(month).ctx;
  for (const key of parts) assert.equal(JSON.stringify(ctx[key]), JSON.stringify(expected[key]), key + ': ' + month);
  assert(ctx.D.dates.every(d => d.startsWith(month)));
  assert.equal(ctx.st.d, ctx.D.dates.length - 1);
  assert.equal(ctx.st.b, 0);
  assert.equal(ctx.st.a, raw.D.B[0][2]);
  assert.equal(ctx.tampil, 'area');
  assert.equal(elements.sm.value, month);
  assert.equal(storage.get('kito-bulan'), month);
  assert.equal(new URL(ctx.url).searchParams.get('bulan'), month === months.at(-1) ? null : month);
  [ctx.D, ctx.KITO_REGION.regions[0], ctx.KITO_AREA_WAKTU.areas[0], ctx.KITO_AREA_KELOMPOK[0], ctx.KITO_AREA_O2O.areas[0]].forEach((ref, i) => assert.equal(ref, refs[i]));
}
ctx.KITO_BULAN.ganti('invalid');
ctx.KITO_BULAN.ganti(ctx.KITO_BULAN.aktif);
assert.equal(ctx.renders, changes);
assert.equal(ctx.fills, changes);
assert.equal(events.length, changes);
console.log('PASS: perpindahan bulan berulang, data arsip/MTD pulih, referensi dan filter tetap, tanpa navigasi');
