/* ===== 1. UTILITAS FORMAT ===== */
const $ = (s) => document.querySelector(s);

const esc = (t) =>
  String(t ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

// detik -> mm:ss
const f = (s) => {
  if (s == null) return "–";
  s = Math.round(s);
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
};

const pc = (a, b) => (a == null || b == null || a + b === 0 ? null : a / (a + b));
const P = (x) => (x == null ? "–" : Math.round(x * 100) + "%");

const dl = (s) => {
  const [y, m, d] = s.split("-");
  return d + "/" + m;
};
const dlong = (s) =>
  new Date(s + "T00:00").toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// kategori waktu antrian -> [teks, kelas warna]
const mp = (s) =>
  s == null
    ? ["–", "n"]
    : s < 300
      ? ["Under 5 Menit", "ok"]
      : s < 600
        ? ["5 - 10 Menit", "mid"]
        : s < 900
          ? ["10 - 15 Menit", "warn"]
          : ["Over 15 Menit", "bad"];

// kategori utilisasi -> [teks, kelas warna]
const club = (p) =>
  p == null
    ? ["–", "n"]
    : p < 0.7
      ? ["Target : 98%", "bad"]
      : p <= 0.8
        ? ["Target : 98%", "warn"]
        : p <= 0.9
          ? ["Target : 98%", "mid"]
          : ["Target : 98%", "ok"];

const chip = (t, c) => `<span class="chip ${c}">${esc(t)}</span>`;

const ket = (k) =>
  chip(
    k === "Membaik" ? "▲ Membaik" : k === "Memburuk" ? "▼ Memburuk" : k || "Tetap",
    k === "Membaik" ? "ok" : k === "Memburuk" ? "bad" : "n",
  );

/* ===== 2. STATE DAN FILTER ===== */
// st.a = area, st.b = nomor cabang, st.d = nomor tanggal
let st = { a: "", b: 0, d: D.dates.length - 1 };
try {
  const o = JSON.parse(localStorage.getItem("dbm") || "{}");
  if (o.b != null && D.B[o.b]) {
    st.b = o.b;
    st.a = D.B[o.b][2];
  }
} catch (e) {}
if (!st.a) st.a = D.B[0][2];

const areas = [...new Set(D.B.map((b) => b[2]))].sort();

// mengisi tiga pilihan di header (Area, Cabang, Tanggal)
function fill() {
  $("#sa").innerHTML = areas
    .map((a) => `<option ${a === st.a ? "selected" : ""}>${esc(a)}</option>`)
    .join("");
  const cs = D.B.map((b, i) => [b, i])
    .filter((x) => x[0][2] === st.a)
    .sort((x, y) => x[0][1].localeCompare(y[0][1]));
  if (cs.length && !cs.some((x) => x[1] === st.b)) st.b = cs[0][1];
  $("#sc").innerHTML = cs
    .map(([b, i]) => `<option value="${i}" ${i === st.b ? "selected" : ""}>${esc(b[1])}</option>`)
    .join("");
  $("#sd").innerHTML = D.dates
    .map((d, i) => `<option value="${i}" ${i === st.d ? "selected" : ""}>${dlong(d)}</option>`)
    .join("");
}

/* ===== 3. GRAFIK DAN KOMPONEN ===== */

// kotak kecil Teller / CS / Semua TRX di kartu Waktu Antrian
function qcard(name, k) {
  const s = D.Q[st.b],
    cur = s[st.d]?.[k];
  let prev = null;
  for (let i = st.d - 1; i >= 0; i--)
    if (s[i]?.[k] != null) {
      prev = s[i][k];
      break;
    }
  const v = s
      .slice(0, st.d + 1)
      .map((x) => x?.[k])
      .filter((x) => x != null),
    mtd = v.length ? v.reduce((a, b) => a + b) / v.length : null;
  const dd = cur != null && prev != null ? Math.round(cur - prev) : null,
    [m, c] = mp(cur);
  const dh =
    dd == null
      ? ""
      : dd < 0
        ? `<span class="ok">▲ Membaik ${-dd} detik</span>`
        : dd > 0
          ? `<span class="bad">▼ Memburuk ${dd} detik</span>`
          : '<span class="mu">Tetap</span>';
  // rincian Single / Multipel tanggal terpilih (D.QD: [Teller single, Teller multipel, CS single, CS multipel])
  const r = D.QD?.[st.b]?.[st.d];
  const rinci =
    k === 2
      ? "Gabungan<br>Teller + CS"
      : r && (r[k * 2] != null || r[k * 2 + 1] != null)
        ? `Single <b>${f(r[k * 2])}</b><br>Multipel <b>${f(r[k * 2 + 1])}</b>`
        : "Single –<br>Multipel –";
  return `<div class="q"><div class="t">${name}</div><div class="v">${f(cur)}</div>${chip(m, c)}<div class="s">${rinci}</div><div class="d">${dh}</div><div class="m">MtD ${f(mtd)}</div></div>`;
}

// lebar grafik mengikuti lebar frame (kartu) di layar
function lebarGrafik() {
  const vw = document.documentElement.clientWidth || 360;
  const sisi = vw >= 720 ? 72 : 56; // padding halaman + padding kartu (kiri dan kanan)
  return Math.max(260, Math.round(Math.min(vw, 720) - sisi - 2));
}

// memilih tanggal mana yang diberi label agar tidak saling menumpuk:
// label dipasang tiap beberapa titik sesuai ruang yang tersedia, dihitung dari tanggal terakhir;
// tanggal terpilih selalu diberi label
function idxLabel(n, spasi, minGap, pilih) {
  const langkah = Math.max(1, Math.ceil(minGap / Math.max(spasi, 1)));
  const tampil = new Set();
  for (let i = n - 1; i >= 0; i -= langkah) tampil.add(i);
  [...tampil].forEach((i) => {
    if (i !== pilih && Math.abs(i - pilih) * spasi < minGap) tampil.delete(i);
  });
  tampil.add(pilih);
  return tampil;
}

// grafik gabungan: tiga garis dalam satu grafik
function chart() {
  const s = D.Q[st.b],
    W = lebarGrafik(),
    H = 190,
    L = 34,
    R = 14,
    T = 12,
    Bt = 26,
    col = ["var(--c1)", "var(--c2)", "var(--c3)"],
    nm = ["Teller", "CS", "Semua TRX"];
  const n = D.dates.length,
    spasi = n < 2 ? W : (W - L - R) / (n - 1),
    tglTampil = idxLabel(n, spasi, 30, st.d);
  const all = s.flat().filter((x) => x != null),
    mx = Math.max(60, ...all),
    top = Math.ceil(mx / 120) * 120 || 120;
  const X = (i) => L + (D.dates.length < 2 ? 0 : (i * (W - L - R)) / (D.dates.length - 1)),
    Y = (v) => T + (H - T - Bt) * (1 - v / top);
  let g = "";
  for (let i = 0; i <= 3; i++) {
    const v = (top * i) / 3;
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--ln)"/><text x="${L - 4}" y="${Y(v) + 3}" font-size="9" text-anchor="end" fill="var(--mu)">${f(v)}</text>`;
  }
  D.dates.forEach((d, i) => {
    if (!tglTampil.has(i)) return;
    g += `<text x="${X(i)}" y="${H - 8}" font-size="9" text-anchor="middle" fill="${i === st.d ? "var(--tx)" : "var(--mu)"}" font-weight="${i === st.d ? 700 : 400}">${dl(d)}</text>`;
  });
  [0, 1, 2].forEach((k) => {
    const pts = s.map((x, i) => (x?.[k] == null ? null : [X(i), Y(x[k])])).filter(Boolean);
    if (pts.length)
      g +=
        `<polyline fill="none" stroke="${col[k]}" stroke-width="2.4" stroke-linejoin="round" points="${pts.map((p) => p.join(",")).join(" ")}"/>` +
        pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${col[k]}"/>`).join("");
  });
  g += `<line x1="${X(st.d)}" x2="${X(st.d)}" y1="${T}" y2="${H - Bt}" stroke="var(--mu)" stroke-dasharray="3 3"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren waktu antrian">${g}</svg><div class="lg">${nm.map((n, k) => `<span><i style="background:${col[k]}"></i>${n}</span>`).join("")}</div>`;
}

// grafik satu kategori, dengan nilai di titik-titik yang cukup lega
function chart1(k, nama, warna) {
  const s = D.Q[st.b],
    W = lebarGrafik(),
    H = 160,
    L = 34,
    R = 18,
    T = 22,
    Bt = 30;
  const PX = 14; // jarak titik pertama/terakhir dari tepi grafik
  const n = D.dates.length,
    spasi = n < 2 ? W : (W - L - R - 2 * PX) / (n - 1),
    tglTampil = idxLabel(n, spasi, 30, st.d),
    nilaiTampil = idxLabel(n, spasi, 30, st.d);
  const vals = s.map((x) => x?.[k]).filter((x) => x != null);
  const top = Math.ceil(Math.max(60, ...vals) / 60) * 60;
  const X = (i) =>
      L + PX + (D.dates.length < 2 ? 0 : (i * (W - L - R - 2 * PX)) / (D.dates.length - 1)),
    Y = (v) => T + (H - T - Bt) * (1 - v / top);
  let g = "";
  for (let i = 0; i <= 2; i++) {
    const v = (top * i) / 2;
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--ln)"/><text x="${L - 4}" y="${Y(v) + 3}" font-size="9" text-anchor="end" fill="var(--mu)">${f(v)}</text>`;
  }
  D.dates.forEach((d, i) => {
    if (!tglTampil.has(i)) return;
    g += `<text x="${X(i)}" y="${H - 8}" font-size="9" text-anchor="middle" fill="${i === st.d ? "var(--tx)" : "var(--mu)"}" font-weight="${i === st.d ? 700 : 400}">${dl(d)}</text>`;
  });
  const pts = s
    .map((x, i) => (x?.[k] == null ? null : [X(i), Y(x[k]), x[k], i]))
    .filter(Boolean);
  if (pts.length) {
    g += `<polyline fill="none" stroke="${warna}" stroke-width="2.2" stroke-linejoin="round" points="${pts.map((p) => p[0] + "," + p[1]).join(" ")}"/>`;
    pts.forEach((p, j) => {
      // angka ditaruh di atas titik kalau tetangganya lebih rendah di layar, selain itu di bawah
      const nb = [pts[j - 1], pts[j + 1]].filter(Boolean).map((q) => q[1]);
      const atas = nb.length ? nb.reduce((a, b) => a + b) / nb.length >= p[1] : true;
      const ly = atas ? p[1] - 7 : p[1] + 13;
      g += `<circle cx="${p[0]}" cy="${p[1]}" r="${p[3] === st.d ? 4 : 2.8}" fill="${warna}"/>`;
      if (nilaiTampil.has(p[3]))
        g += `<text x="${p[0]}" y="${ly}" font-size="8" font-weight="${p[3] === st.d ? 700 : 600}" text-anchor="middle" fill="var(--tx)" stroke="var(--cd)" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${f(p[2])}</text>`;
    });
  }
  return `<div class="u"><b>${nama}</b><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren ${nama}">${g}</svg></div>`;
}

// baris utilisasi dengan bar warna
function util(label, n, o) {
  const p = pc(n, o),
    [c, cc] = club(p);
  const warna = cc === "n" ? "mu" : cc === "mid" ? "md" : cc === "warn" ? "wr" : cc === "bad" ? "bd" : "ok";
  return `<div class="u"><div class="row" style="justify-content:space-between"><b>${label}</b>${chip(c,cc)}</div>
  <div class="bar"><b style="width:${(p || 0) * 100}%;background:var(--${warna})"></b></div>
  <div class="row sub" style="justify-content:space-between"><span>NBDS <b>${n ?? "–"}</b> · Old BDS <b>${o ?? "–"}</b></span><b>${P(p)}${p != null && p >= 0.98 ? " " : ""}</b></div></div>`;
}

// lingkaran O2O
function donut(a, b) {
  const t = a + b,
    p = t ? a / t : 0,
    r = 42,
    C = 2 * Math.PI * r;
  return `<svg viewBox="0 0 110 110" style="width:110px;flex:none"><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--ln)" stroke-width="14"/><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--c1)" stroke-width="14" stroke-dasharray="${p * C} ${C}" transform="rotate(-90 55 55)"/><text x="55" y="61" text-anchor="middle" font-size="19" font-weight="800" fill="var(--tx)">${P(p)}</text></svg>`;
}

/* ===== 4. PENGATURAN RANKING ===== */
const rk = { m: 2, s: "region" }; // m: nomor metrik, s: cakupan ("region" atau "area")
/* Setiap metrik:
   n       nama tombol, g: grup tombol (judul kecil di depan baris tombol)
   tinggi  true = nilai besar lebih baik
   f(i)    nilai untuk cabang ke-i (null = tidak ikut ranking)
   Opsional (modul tambahan, mis. area-nbds.js, boleh mengisi):
   fmt(v)  teks nilai · kelas(v) kelas warna · valid(v) ikut ranking? (bawaan: v > 0)
   tgl()   tanggal ISO di judul · tie(i) pembanding saat nilai sama (besar = lebih baik)
   sub(i)  keterangan kecil di bawah nama cabang */
const METRIK = [
  { n: "Teller", g: "Waktu Antrian", tinggi: false, f: (i) => D.Q[i][st.d]?.[0] },
  { n: "CS", g: "Waktu Antrian", tinggi: false, f: (i) => D.Q[i][st.d]?.[1] },
  { n: "Semua TRX", g: "Waktu Antrian", tinggi: false, f: (i) => D.Q[i][st.d]?.[2] },
  {
    n: "O2O %",
    g: "Utilisasi",
    tinggi: true,
    f: (i) => {
      const m = D.M[i];
      return m && m[0] + m[1] > 0 ? m[0] / (m[0] + m[1]) : null;
    },
  },
];

// baris ranking (terbaik -> terburuk) untuk metrik dan cakupan aktif; dipakai kartu dan ekspor CSV
function barisRanking() {
  const M = METRIK[rk.m],
    valid = M.valid || ((v) => v != null && v > 0);
  return D.B.map((b, i) => ({ i, b, v: M.f(i) }))
    .filter((r) => valid(r.v) && (rk.s === "region" || r.b[2] === st.a))
    .sort((x, y) => (M.tinggi ? y.v - x.v : x.v - y.v) || (M.tie ? M.tie(y.i) - M.tie(x.i) : 0));
}
const fmtRanking = (M, v) => (M.fmt ? M.fmt(v) : M.tinggi ? P(v) : f(v));

/* ===== 5. KARTU-KARTU HALAMAN =====
   Setiap fungsi mengembalikan teks HTML satu kartu.
   Fungsi yang mengembalikan "" berarti kartu itu tidak tampil. */

// Nama cabang, area, kelas, dan PIC (kalau datanya ada)
function kartuCabang() {
  const b = D.B[st.b];
  const digit = (b[5] || "").replace(/\D/g, "");
  const wa = digit.length < 9 ? "" : digit.startsWith("62") ? digit : "62" + digit.replace(/^0/, "");
  const pic =
    b[4] || b[5]
      ? `<div class="row" style="margin-top:10px"><span class="sub">PIC: <b>${esc(b[4] || "–")}</b></span>${b[5] ? `<a class="btn" href="tel:${esc(b[5])}">Telepon</a>${wa ? `<a class="btn w" href="https://wa.me/${wa}">WhatsApp</a>` : ""}` : ""}</div>`
      : "";
  return `<div class="cd hero"><h3>${esc(b[1])}</h3><div class="row sub"><span>${esc(b[2])}</span>${b[3] ? chip("Kelas " + b[3], "n") : ""}</div>${pic}</div>`;
}

// Tiga kotak: Teller, CS, Semua TRX pada tanggal terpilih
function kartuAntrian() {
  return `<div class="cd"><h2>Waktu Antrian · ${dlong(D.dates[st.d])}</h2><div class="g3">${qcard("TELLER", 0)}${qcard("CS", 1)}${qcard("SEMUA TRX", 2)}</div></div>`;
}

// Grafik tren yang bisa digeser: Gabungan, Teller, CS, Semua TRX
function kartuTren() {
  return `<div class="cd"><h2>Tren Waktu Antrian</h2><div class="seg" id="dots"><button type="button" class="on">Gabungan</button><button type="button">Teller</button><button type="button">CS</button><button type="button">Semua TRX</button></div><div class="slider" id="sl"><div class="sl"><div class="u"><b>Teller · CS · Semua TRX</b>${chart()}</div></div><div class="sl">${chart1(0, "Teller", "var(--c1)")}</div><div class="sl">${chart1(1, "Customer Service", "var(--c2)")}</div><div class="sl">${chart1(2, "Semua TRX", "var(--c3)")}</div></div></div>`;
}

// Data Kelompok: kotak Teller dan CS, masing-masing dua periode
function kartuKelompok() {
  const b = D.B[st.b];
  return `<div class="cd"><h2>Data Kelompok</h2><div class="kel-grid">${[
    ["Teller", 6, 7, 8],
    ["Customer Service", 9, 10, 11],
  ]
    .map(
      ([n, i, j, k]) =>
        `<div class="kel ${b[k] === "Membaik" ? "ok" : b[k] === "Memburuk" ? "bad" : "n"}"><div class="kel-t">${n}</div><div class="kel-dua"><div class="kel-b"><small>${D.kl[0]}</small><b>${b[i] ?? "–"}</b></div><span class="kel-pn">→</span><div class="kel-b baru"><small>${D.kl[1]}</small><b>${b[j] ?? "–"}</b></div></div>${ket(b[k])}</div>`,
    )
    .join("")}</div></div>`;
}

// Overall O2O: lingkaran, jumlah, dan perbandingan dengan rata-rata Bankwide
function kartuO2O() {
  const m = D.M[st.b];
  if (!m) return "";
  const [o2o, nb] = m,
    tot = o2o + nb,
    abv = tot && o2o / tot > D.bw;
  return `<div class="cd"><h2>Overall O2O · ${dlong(D.mdate)}</h2><div class="row">${donut(o2o, nb)}<div style="flex:1;min-width:150px">
     <div class="kv"><span>Livin O2O</span><b>${o2o}</b></div><div class="kv"><span>NBDS</span><b>${nb}</b></div><div class="kv"><span>Total</span><b>${tot}</b></div></div></div>
     <div class="note">Avg Bankwide ${P(D.bw)} · ${tot ? (abv ? '<b class="ok">⬆ Above Avg</b>' : '<b class="bad">⬇ Below Avg</b>') : ""}</div></div>`;
}

// Shifting Digital: (O2O + CSM) / total, dengan rincian empat bagian
function kartuShifting() {
  const m = D.M[st.b];
  if (!m) return "";
  // NBDS untuk Shifting = seluruh transaksi ganti kartu lewat New BDS (D.M[10], laporan Ganti Kartu "Cabang by Channel");
  // bila belum ada, pakai NBDS O2O (D.M[1]) seperti sebelumnya
  const [o2o, , csm, old] = m,
    nb = m[10] ?? m[1],
    sh = o2o + nb + csm + old,
    dig = o2o + csm;
  const bagian = [
    ["O2O", o2o, "sh-o2o"],
    ["CSM", csm, "sh-csm"],
    ["NBDS", nb, "sh-nbds"],
    ["OBDS", old, "sh-obds"],
  ];
  const pct = (v) => (sh ? Math.round((v / sh) * 100) + "%" : "–");
  const bar = bagian.map(([n, v, c]) => (v ? `<i class="${c}" style="flex:${v}"></i>` : "")).join("");
  const leg = bagian
    .map(([n, v, c]) => `<div class="sh-it"><i class="${c}"></i><span>${n}</span><b>${v}</b><small>${pct(v)} dari total</small></div>`)
    .join("");
  return `<div class="cd"><h2>Shifting Digital · ${dlong(D.mdate)}</h2>
    <div class="sh-atas"><div class="sh-n">${sh ? P(dig / sh) : "–"}</div>
      <div class="sh-t">${sh ? `<b>${dig}</b> dari <b>${sh}</b> transaksi lewat O2O dan CSM` : "Belum ada data transaksi"}</div></div>
    ${sh ? `<div class="sh-bar">${bar}</div><div class="sh-grid">${leg}</div>` : ""}
    <div class="note">Rumus: (O2O + CSM) ÷ (O2O + NBDS + CSM + OBDS) · NBDS = seluruh transaksi ganti kartu lewat New BDS</div>
  </div>`;
}

// Utilisasi NBDS: tiga baris dengan bar
function kartuUtilisasi() {
  const m = D.M[st.b];
  if (!m) return "";
  const [, , , , fpn, fpo, fnn, fno, nfn, nfo] = m;
  return `<div class="cd"><h2>Utilisasi NBDS</h2>${util("Teller Perorangan", fpn, fpo)}${util("Teller Badan", fnn, fno)}${util("Customer Service", nfn, nfo)}</div>`;
}




// Ranking cabang: terbaik di kiri, terburuk di kanan
function kartuRanking() {
  if (!METRIK[rk.m]) rk.m = 2;
  const M = METRIK[rk.m],
    fmt = (v) => fmtRanking(M, v),
    kelas = M.kelas || ((v) => (M.tinggi ? club(v) : mp(v))[1]);
  const rows = barisRanking();
  const n = Math.min(10, Math.floor(rows.length / 2));
  const terbaik = rows.slice(0, n),
    terburuk = rows.slice(rows.length - n).reverse();
  const item = (r, j) =>
    `<div class="rk" data-b="${r.i}"><span class="no">${j + 1}</span><span class="nm">${esc(r.b[1])}<small>${esc(r.b[2])}${M.sub ? " · " + esc(M.sub(r.i)) : ""}</small></span><b class="${kelas(r.v)}">${fmt(r.v)}</b></div>`;
  const pasang = terbaik.map((r, j) => item(r, j) + item(terburuk[j], j)).join("");
  const tombol = (attr, val, teks, aktif) =>
    `<button type="button" data-${attr}="${val}" class="${aktif ? "on" : ""}">${esc(teks)}</button>`;
  const tgl = M.tgl ? M.tgl() : M.tinggi ? D.mdate : D.dates[st.d];
  // tombol metrik dikelompokkan per grup (Waktu Antrian, Utilisasi, Utilisasi NBDS, ...)
  const grup = [...new Set(METRIK.map((x) => x.g || ""))];
  const segMetrik = grup
    .map(
      (g) =>
        `<div class="seg rk-seg">${g ? `<span class="rk-g">${esc(g)}</span>` : ""}${METRIK.map((x, j) => [x, j])
          .filter(([x]) => (x.g || "") === g)
          .map(([x, j]) => tombol("m", j, x.n, j === rk.m))
          .join("")}</div>`,
    )
    .join("");
  return `<div class="cd"><h2>Ranking Cabang · ${esc(M.g ? M.g + " " + M.n : M.n)} · ${dlong(tgl)}</h2>
    ${segMetrik}
    <div class="seg">${tombol("s", "region", "Seluruh Region II", rk.s === "region")}${tombol("s", "area", "Area: " + st.a, rk.s === "area")}</div>
    ${n ? `<div class="rk2"><div class="rk-judul ok">▲ ${n} Terbaik</div><div class="rk-judul bad">▼ ${n} Terburuk</div>${pasang}</div>` : '<div class="sub">Data belum cukup untuk dibuat ranking.</div>'}
  </div>`;
}

/* --- Detail Data Old BDS ---
   Format seragam dengan rincian Layanan di dashboard Utilisasi NBDS (tab Area):
   No · Transaksi (layanan di bawahnya) · Nasabah · Kategori (kanal) · User ID · Total */
const KANAL_OB = { fp: "Teller Perorangan", fnp: "Teller Badan", nf: "Customer Service" };
const URUT_OB = ["fp", "fnp", "nf"];
// kanal dari kategori + jenis nasabah (sama dengan penggolongan laporan NBDS)
function kanalOb(kategori, nasabah) {
  if (/customer|non finansial/i.test(kategori || "")) return "nf";
  return String(nasabah || "").toLowerCase() === "perorangan" ? "fp" : "fnp";
}
// baris Old BDS satu cabang; nama layanan (fitur) diambil dari data NBDS bila tersedia
function barisOldBds(i) {
  const kode = String(D.B[i][0]);
  const fitur = new Map(((window.KITO_AREA_NBDS || {}).oldbds || []).filter((r) => r[0] === kode).map((r) => [r[4], r[3]]));
  return D.O.filter((x) => x[0] === i)
    .map((x) => ({ transaksi: x[1], fitur: fitur.get(x[1]) || "", nasabah: x[2], kanal: kanalOb(x[4], x[2]), uid: x[3], n: x[6] || 0 }))
    .sort((a, b) => URUT_OB.indexOf(a.kanal) - URUT_OB.indexOf(b.kanal) || a.transaksi.localeCompare(b.transaksi) || b.n - a.n);
}
// tabel bersama (dipakai juga oleh area-nbds.js); opt.cabang = tampilkan kolom cabang, opt.gulir = tinggi terbatas
function tabelOldBds(rows, opt = {}) {
  const nas = (t) => { const s = String(t || "–"); return s.charAt(0).toUpperCase() + s.slice(1); };
  const head = `<tr><th class="ob-no">No</th>${opt.cabang ? "<th>Cabang</th>" : ""}<th>Transaksi</th><th>Nasabah</th><th>Kategori</th><th>User ID</th><th class="ang">Total</th></tr>`;
  const body = rows.map((r, j) => `<tr><td class="ob-no">${j + 1}</td>${opt.cabang ? `<td class="ob-cab"><b>${esc(r.cabang)}</b><small>${esc(r.kode)}</small></td>` : ""}<td class="ob-trx"><b>${esc(r.transaksi)}</b>${r.fitur ? `<small>${esc(r.fitur)}</small>` : ""}</td><td class="ob-nas">${esc(nas(r.nasabah))}</td><td><span class="chip ob-k ob-k-${r.kanal}">${KANAL_OB[r.kanal] || "–"}</span></td><td class="ob-uid">${esc(r.uid || "–")}</td><td class="ang ob-n"><b>${r.n}</b></td></tr>`).join("");
  return `<div class="tw ob-tw ${opt.gulir ? "gulir" : ""}"><table class="ob-tbl">${head}${body}</table></div>`;
}
// ringkasan jumlah transaksi per kanal
function ringkasOldBds(rows) {
  return `<div class="ob-ring">${URUT_OB.map((k) => { const n = rows.filter((r) => r.kanal === k).reduce((s, r) => s + r.n, 0); return n ? `<span class="chip ob-k ob-k-${k}">${KANAL_OB[k]} · ${n}</span>` : ""; }).join("")}</div>`;
}

// Tabel transaksi Old BDS untuk cabang terpilih
function kartuOldBds() {
  const ob = barisOldBds(st.b);
  const total = ob.reduce((a, x) => a + x.n, 0);
  const tgl = (window.KITO_AREA_NBDS || {}).tanggal || D.mdate;
  return `<div class="cd"><h2>Detail Data Old BDS (${ob.length})</h2>${ob.length ? `<p class="sub ob-sub">Transaksi yang masih lewat Old BDS · DtD ${dlong(tgl)}</p>${ringkasOldBds(ob)}${tabelOldBds(ob)}<div class="note">Total ${total} transaksi dari ${ob.length} baris · User ID disamarkan</div>` : '<div class="sub">Tidak ada transaksi Old BDS.</div>'}</div>`;
}

// Tabel waktu antrian per tanggal (ketuk baris untuk ganti tanggal)
function kartuDetailAntrian() {
  const s = D.Q[st.b];
  return `<div class="cd"><h2>Detail Waktu Antrian</h2><div class="tw"><table><tr><th>Tanggal</th><th>Teller</th><th>CS</th><th>Semua</th></tr>${D.dates
    .map((d, i) => [d, i])
    .reverse()
    .map(
      ([d, i]) =>
        `<tr data-d="${i}" class="${i === st.d ? "on" : ""}"><td>${dlong(d)}</td>${[0, 1, 2]
          .map((k) => {
            const v = s[i]?.[k];
            return `<td class="${mp(v)[1]}"><b>${f(v)}</b></td>`;
          })
          .join("")}</tr>`,
    )
    .join("")}</table></div><div class="note">Ketuk baris untuk ganti tanggal.</div></div>`;
}

// Halaman Region dan Area: tampilan "sedang dalam pengembangan"
function kartuMaintenance(nama) {
  return `<div class="cd mt"><div class="mt-ik">🚧</div><h3>Halaman ${nama} sedang dalam pengembangan</h3><p>Tampilan ${nama} sedang kami siapkan. Sementara itu, data lengkap per cabang sudah bisa dilihat di tab Cabang.</p><button type="button" class="btn" data-v="cabang">Buka Cabang</button></div>`;
}


/* ===== 6. URUTAN HALAMAN =====
   Pindahkan baris ke atas atau bawah untuk mengubah posisi kartu.
   Beri // di depan sebuah baris untuk menyembunyikan kartunya. */
const URUTAN = [
  kartuCabang,
  kartuAntrian,
  kartuTren,
  kartuKelompok,
  kartuO2O,
  kartuShifting,
  kartuUtilisasi,
  kartuOldBds,
  kartuDetailAntrian,
];

// Tab yang sedang dibuka: "region", "area", atau "cabang"
let tampil = "cabang";

function render() {
  document.body.classList.toggle("maint", tampil !== "cabang");
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.v === tampil));
  $("#app").innerHTML =
    tampil === "cabang"
      ? URUTAN.map((kartu) => kartu()).join("")
      : kartuMaintenance(tampil === "region" ? "Region" : "Area");
  pasangSlider();
  pasangUnduh();
  try {
    localStorage.setItem("dbm", JSON.stringify({ b: st.b }));
  } catch (e) {}
}

/* ===== 7. INTERAKSI ===== */
$("#sa").addEventListener("change", (e) => {
  st.a = e.target.value;
  fill();
  render();
  window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
});
$("#sc").addEventListener("change", (e) => {
  st.b = +e.target.value;
  render();
  window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
});
$("#sd").addEventListener("change", (e) => {
  st.d = +e.target.value;
  render();
});

// Semua klik di dalam halaman ditangani di sini
$("#app").addEventListener("click", (e) => {
  // tombol CSV
  const ex = e.target.closest("[data-ex]");
  if (ex) return EKSPOR[ex.dataset.ex]();

  // baris tabel tanggal
  const tr = e.target.closest("tr[data-d]");
  if (tr) {
    st.d = +tr.dataset.d;
    fill();
    render();
    return;
  }

  // tombol dan baris ranking
  const t = e.target.closest("[data-m],[data-s],[data-b]");
  if (!t) return;
  if (t.dataset.m != null) {
    rk.m = +t.dataset.m;
    render();
  } else if (t.dataset.s) {
    rk.s = t.dataset.s;
    render();
  } else if (t.dataset.b != null) {
    st.b = +t.dataset.b;
    st.a = D.B[st.b][2];
    fill();
    render();
    window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  }
});

/* ===== 8. FITUR TAMBAHAN ===== */

/* --- Footer: keterangan tanggal data --- */
const ft = $("#ft");
if (ft) {
  ft.innerHTML =
    "Antrian s.d. <b>" + dlong(D.dates[D.dates.length - 1]) +
    "</b> · Utilisasi per <b>" + dlong(D.mdate) +
    "</b><br>Dashboard Monitoring Inbranch · Region II";
}

/* --- Tema terang / gelap --- */
const tombolTema = $("#tema");
function setTema(t) {
  document.documentElement.dataset.theme = t;
  tombolTema.textContent = t === "dark" ? "☀️" : "🌙";
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = t === "dark" ? "#0a1a40" : "#002060";
  try {
    localStorage.setItem("tema", t);
  } catch (e) {}
}
if (tombolTema) {
  setTema(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  tombolTema.addEventListener("click", () =>
    setTema(document.documentElement.dataset.theme === "dark" ? "light" : "dark"),
  );
}

/* --- Pencarian cabang --- */
const qi = $("#q"),
  hs = $("#hasil");
let hasilCari = [];

function cari() {
  const kata = qi.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!kata.length) {
    hs.hidden = true;
    hasilCari = [];
    return;
  }
  hasilCari = D.B.map((b, i) => [b, i])
    .filter(([b]) => {
      const teks = (b[1] + " " + b[0]).toLowerCase();
      return kata.every((w) => teks.includes(w));
    })
    .sort((x, y) => x[0][1].localeCompare(y[0][1]))
    .slice(0, 30);
  hs.innerHTML = hasilCari.length
    ? hasilCari
        .map(([b, i]) => `<div data-i="${i}">${esc(b[1])}<small>${esc(b[2])} · ${esc(b[0])}</small></div>`)
        .join("")
    : '<div class="kosong">Cabang tidak ditemukan</div>';
  hs.hidden = false;
}

function bukaCabang(i) {
  st.b = i;
  st.a = D.B[i][2];
  qi.value = "";
  hs.hidden = true;
  qi.blur();
  goSlide(0);
  fill();
  render();
  window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
}

if (qi) {
  qi.addEventListener("input", cari);
  qi.addEventListener("focus", cari);
  qi.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && hasilCari.length) bukaCabang(hasilCari[0][1]);
    if (e.key === "Escape") {
      qi.value = "";
      hs.hidden = true;
    }
  });
  hs.addEventListener("click", (e) => {
    const r = e.target.closest("[data-i]");
    if (r) bukaCabang(+r.dataset.i);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".cari, #hasil")) hs.hidden = true;
  });
}

/* --- Header geser: halaman Filter dan Cari --- */
const gs = $("#geser"),
  tabs = document.querySelectorAll(".tab-geser button");

function goSlide(i) {
  if (gs) gs.scrollTo({ left: i * gs.clientWidth, behavior: "smooth" });
}

if (gs) {
  gs.addEventListener(
    "scroll",
    () => {
      const i = Math.round(gs.scrollLeft / gs.clientWidth);
      tabs.forEach((t, j) => t.classList.toggle("on", j === i));
      if (i === 0) hs.hidden = true;
    },
    { passive: true },
  );
  tabs.forEach((t, j) =>
    t.addEventListener("click", () => {
      goSlide(j);
      if (j === 1) setTimeout(() => qi.focus(), 300);
    }),
  );
}

/* --- Ekspor CSV --- */
function csv(nama, baris) {
  const sel = (v) => {
    let t = String(v ?? "");
    if (/^[=+\-@]/.test(t)) t = "'" + t;
    return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  const teks = "\uFEFF" + baris.map((r) => r.map(sel).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([teks], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nama + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const namaFile = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const EKSPOR = {
  antrian() {
    const s = D.Q[st.b],
      b = D.B[st.b];
    csv("antrian-" + namaFile(b[1]), [
      ["Cabang", "Tanggal", "Teller (mm:ss)", "CS (mm:ss)", "Semua TRX (mm:ss)"],
      ...D.dates.map((d, i) => [b[1], d, ...[0, 1, 2].map((k) => (s[i]?.[k] == null ? "" : f(s[i][k])))]),
    ]);
  },
  ranking() {
    const M = METRIK[rk.m];
    const rows = barisRanking();
    const judul = M.g ? M.g + " " + M.n : M.n;
    csv("ranking-" + namaFile(judul) + "-" + (rk.s === "region" ? "region" : namaFile(st.a)), [
      ["Peringkat", "Cabang", "Area", judul, ...(M.sub ? ["Keterangan"] : [])],
      ...rows.map((r, j) => [j + 1, r.b[1], r.b[2], fmtRanking(M, r.v), ...(M.sub ? [M.sub(r.i)] : [])]),
    ]);
  },
   oldbds() {
    const b = D.B[st.b];
    csv("old-bds-" + namaFile(b[1]), [
      ["No", "Cabang", "Transaksi", "Layanan", "Nasabah", "Kategori", "User ID", "Total Transaksi"],
      ...barisOldBds(st.b).map((r, j) => [j + 1, b[1], r.transaksi, r.fitur, r.nasabah, KANAL_OB[r.kanal], r.uid, r.n]),
    ]);
  },
};

// menempelkan tombol CSV ke judul kartu setelah halaman digambar
function pasangUnduh() {
  const peta = [
    ["Detail Waktu Antrian", "antrian"],
    ["Ranking Cabang", "ranking"],
    ["Detail Data Old BDS", "oldbds"],
  ];
  document.querySelectorAll("#app .cd h2").forEach((h2) => {
    const p = peta.find(([awal]) => h2.textContent.startsWith(awal));
    if (!p) return;
    if (p[1] === "oldbds" && !D.O.some((x) => x[0] === st.b)) return;
    h2.insertAdjacentHTML("beforeend", `<button type="button" class="unduh" data-ex="${p[1]}">⬇ CSV</button>`);
  });
}

/* --- Cetak --- */
let temaSebelum = null;
window.addEventListener("beforeprint", () => {
  temaSebelum = document.documentElement.dataset.theme;
  document.documentElement.dataset.theme = "light"; // cetak selalu terang
});
window.addEventListener("afterprint", () => {
  if (temaSebelum) document.documentElement.dataset.theme = temaSebelum;
});
const cetak = $("#cetak");
if (cetak) cetak.addEventListener("click", () => window.print());

/* --- Slider grafik tren --- */
let slIdx = 0;
function pasangSlider() {
  const sl = $("#sl");
  if (!sl) return;
  const dots = document.querySelectorAll("#dots button");
  const tandai = (i) => dots.forEach((d, j) => d.classList.toggle("on", j === i));
  sl.scrollLeft = slIdx * sl.clientWidth;
  tandai(slIdx);
  sl.addEventListener(
    "scroll",
    () => {
      slIdx = Math.round(sl.scrollLeft / sl.clientWidth);
      tandai(slIdx);
    },
    { passive: true },
  );
  dots.forEach((d, j) =>
    d.addEventListener("click", () => sl.scrollTo({ left: j * sl.clientWidth, behavior: "smooth" })),
  );
}


/* --- Navigasi: Region, Area, Cabang --- */
function bukaTab(v) {
  if (v === tampil) return;
  tampil = v;
  render();
  window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-v]");
  if (t) bukaTab(t.dataset.v);
});

/* --- Grafik menyesuaikan lebar frame saat layar diputar atau diubah ukurannya --- */
let lebarSaatRender = lebarGrafik(),
  tmrUkuran;
window.addEventListener("resize", () => {
  clearTimeout(tmrUkuran);
  tmrUkuran = setTimeout(() => {
    const w = lebarGrafik();
    if (w !== lebarSaatRender) {
      lebarSaatRender = w;
      render();
    }
  }, 200);
});


/* ===== MULAI ===== */



fill();
render();