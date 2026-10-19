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
      ? ["<70%", "bad"]
      : p <= 0.8
        ? ["70-80%", "warn"]
        : p <= 0.9
          ? [">80-90%", "mid"]
          : [">90-100%", "ok"];

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
  if (!cs.some((x) => x[1] === st.b)) st.b = cs[0][1];
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
        ? `<span class="ok">▲ Membaik ${-dd} dtk</span>`
        : dd > 0
          ? `<span class="bad">▼ Memburuk ${dd} dtk</span>`
          : '<span class="mu">Tetap</span>';
  return `<div class="q"><div class="t">${name}</div><div class="v">${f(cur)}</div>${chip(m, c)}<div class="d">${dh}</div><div class="m">MtD ${f(mtd)}</div></div>`;
}

// grafik gabungan: tiga garis dalam satu grafik
function chart() {
  const s = D.Q[st.b],
    W = 340,
    H = 190,
    L = 34,
    R = 10,
    T = 12,
    Bt = 26,
    col = ["var(--c1)", "var(--c2)", "var(--c3)"],
    nm = ["Teller", "CS", "Semua TRX"];
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

// grafik satu kategori, dengan nilai di setiap titik
function chart1(k, nama, warna) {
  const s = D.Q[st.b],
    W = 340,
    H = 160,
    L = 34,
    R = 18,
    T = 22,
    Bt = 30;
  const vals = s.map((x) => x?.[k]).filter((x) => x != null);
  const top = Math.ceil(Math.max(60, ...vals) / 60) * 60;
  const PX = 14; // jarak titik pertama/terakhir dari tepi grafik
  const X = (i) =>
      L + PX + (D.dates.length < 2 ? 0 : (i * (W - L - R - 2 * PX)) / (D.dates.length - 1)),
    Y = (v) => T + (H - T - Bt) * (1 - v / top);
  let g = "";
  for (let i = 0; i <= 2; i++) {
    const v = (top * i) / 2;
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--ln)"/><text x="${L - 4}" y="${Y(v) + 3}" font-size="9" text-anchor="end" fill="var(--mu)">${f(v)}</text>`;
  }
  D.dates.forEach((d, i) => {
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
      g +=
        `<circle cx="${p[0]}" cy="${p[1]}" r="${p[3] === st.d ? 4 : 2.8}" fill="${warna}"/>` +
        `<text x="${p[0]}" y="${ly}" font-size="8" font-weight="${p[3] === st.d ? 700 : 600}" text-anchor="middle" fill="var(--tx)" stroke="var(--cd)" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${f(p[2])}</text>`;
    });
  }
  return `<div class="u"><b>${nama}</b><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren ${nama}">${g}</svg></div>`;
}

// baris utilisasi dengan bar warna
function util(label, n, o) {
  const p = pc(n, o),
    [c, cc] = club(p);
  const warna = cc === "n" ? "mu" : cc === "mid" ? "md" : cc === "warn" ? "wr" : cc === "bad" ? "bd" : "ok";
  return `<div class="u"><div class="row" style="justify-content:space-between"><b>${label}</b>${chip(c, cc)}</div>
  <div class="bar"><b style="width:${(p || 0) * 100}%;background:var(--${warna})"></b></div>
  <div class="row sub" style="justify-content:space-between"><span>NBDS <b>${n ?? "–"}</b> · Old BDS <b>${o ?? "–"}</b></span><b>${P(p)}${p != null && p >= 0.98 ? " · ≥98%" : ""}</b></div></div>`;
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
const METRIK = [
  { n: "Teller", tinggi: false, f: (i) => D.Q[i][st.d]?.[0] },
  { n: "CS", tinggi: false, f: (i) => D.Q[i][st.d]?.[1] },
  { n: "Semua TRX", tinggi: false, f: (i) => D.Q[i][st.d]?.[2] },
  {
    n: "O2O %",
    tinggi: true,
    f: (i) => {
      const m = D.M[i];
      return m && m[0] + m[1] > 0 ? m[0] / (m[0] + m[1]) : null;
    },
  },
];

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
  const [o2o, nb, csm, old] = m,
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
    <div class="note">Rumus: (O2O + CSM) ÷ (O2O + NBDS + CSM + OBDS)</div>
  </div>`;
}

// Utilisasi NBDS: tiga baris dengan bar
function kartuUtilisasi() {
  const m = D.M[st.b];
  if (!m) return "";
  const [, , , , fpn, fpo, fnn, fno, nfn, nfo] = m;
  return `<div class="cd"><h2>Utilisasi NBDS</h2>${util("Financial Perorangan", fpn, fpo)}${util("Financial Non Perorangan", fnn, fno)}${util("Non Financial", nfn, nfo)}</div>`;
}




// Ranking cabang: terbaik di kiri, terburuk di kanan
function kartuRanking() {
  const M = METRIK[rk.m],
    fmt = (v) => (M.tinggi ? P(v) : f(v)),
    kelas = (v) => (M.tinggi ? club(v) : mp(v))[1];
  const rows = D.B.map((b, i) => ({ i, b, v: M.f(i) }))
    .filter((r) => r.v != null && r.v > 0 && (rk.s === "region" || r.b[2] === st.a))
    .sort((x, y) => (M.tinggi ? y.v - x.v : x.v - y.v));
  const n = Math.min(10, Math.floor(rows.length / 2));
  const terbaik = rows.slice(0, n),
    terburuk = rows.slice(rows.length - n).reverse();
  const item = (r, j) =>
    `<div class="rk" data-b="${r.i}"><span class="no">${j + 1}</span><span class="nm">${esc(r.b[1])}<small>${esc(r.b[2])}</small></span><b class="${kelas(r.v)}">${fmt(r.v)}</b></div>`;
  const pasang = terbaik.map((r, j) => item(r, j) + item(terburuk[j], j)).join("");
  const tombol = (attr, val, teks, aktif) =>
    `<button type="button" data-${attr}="${val}" class="${aktif ? "on" : ""}">${esc(teks)}</button>`;
  const tgl = M.tinggi ? D.mdate : D.dates[st.d];
  return `<div class="cd"><h2>Ranking Cabang · ${dlong(tgl)}</h2>
    <div class="seg">${METRIK.map((x, j) => tombol("m", j, x.n, j === rk.m)).join("")}</div>
    <div class="seg">${tombol("s", "region", "Seluruh Region II", rk.s === "region")}${tombol("s", "area", "Area: " + st.a, rk.s === "area")}</div>
    ${n ? `<div class="rk2"><div class="rk-judul ok">▲ ${n} Terbaik</div><div class="rk-judul bad">▼ ${n} Terburuk</div>${pasang}</div>` : '<div class="sub">Data belum cukup untuk dibuat ranking.</div>'}
  </div>`;
}

// Tabel transaksi Old BDS untuk cabang terpilih
function kartuOldBds() {
  const ob = D.O.filter((x) => x[0] === st.b);
  return `<div class="cd"><h2>Detail Data Old BDS (${ob.length})</h2>${ob.length ? `<div class="tw"><table><tr><th>Transaksi</th><th>Nasabah</th><th>Kategori</th><th>User ID</th></tr>${ob.map((x) => `<tr><td>${esc(x[1])}</td><td>${esc(x[2])}</td><td>${chip(x[4] || "–", x[4] === "Finansial" ? "ok" : "n")}</td><td>${esc(x[3])}</td></tr>`).join("")}</table></div>` : '<div class="sub">Tidak ada transaksi Old BDS.</div>'}</div>`;
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
  kartuRanking,
  kartuDetailAntrian,
];

function render() {
  $("#app").innerHTML = URUTAN.map((kartu) => kartu()).join("");
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
  scrollTo(0, 0);
});
$("#sc").addEventListener("change", (e) => {
  st.b = +e.target.value;
  render();
  scrollTo(0, 0);
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
    scrollTo(0, 0);
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
  scrollTo(0, 0);
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
    const rows = D.B.map((b, i) => ({ b, v: M.f(i) }))
      .filter((r) => r.v != null && r.v > 0 && (rk.s === "region" || r.b[2] === st.a))
      .sort((x, y) => (M.tinggi ? y.v - x.v : x.v - y.v));
    csv("ranking-" + namaFile(M.n) + "-" + (rk.s === "region" ? "region" : namaFile(st.a)), [
      ["Peringkat", "Cabang", "Area", M.n],
      ...rows.map((r, j) => [j + 1, r.b[1], r.b[2], M.tinggi ? P(r.v) : f(r.v)]),
    ]);
  },
  oldbds() {
    const b = D.B[st.b];
    csv("old-bds-" + namaFile(b[1]), [
      ["Cabang", "Transaksi", "Nasabah", "Kategori", "User ID"],
      ...D.O.filter((x) => x[0] === st.b).map((x) => [b[1], x[1], x[2], x[4], x[3]]),
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

/* ===== MULAI ===== */
fill();
render();