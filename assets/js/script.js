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
  const p = (x) => String(x).padStart(2, "0");
  // di atas 1 jam (mis. P100) ditulis j:mm:ss
  if (s >= 3600) return Math.floor(s / 3600) + ":" + p(Math.floor(s / 60) % 60) + ":" + p(s % 60);
  return p(Math.floor(s / 60)) + ":" + p(s % 60);
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
    month: "long",
    year: "numeric",
  });

// tanggal yang waktu antriannya P95 (sejak 27 Okt); sebelumnya P90
const qP95 = (iso) => (D.queueMetricByDate?.[iso] || (iso >= "2026-10-27" ? "P95" : "P90")) === "P95";

// kategori waktu antrian -> [teks, kelas warna]; batas atas P90 15 menit, P95 20 menit (P100 tetap 15)
const mp = (s, p95 = false) => {
  const atas = p95 ? 20 : 15;
  return s == null
    ? ["–", "n"]
    : s < 300
      ? ["Under 5 Menit", "ok"]
      : s < 600
        ? ["5 - 10 Menit", "mid"]
        : s < atas * 60
          ? [`10 - ${atas} Menit`, "warn"]
          : [`Over ${atas} Menit`, "bad"];
};

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
const P100_MULAI = "2026-10-27"; // mulai tanggal ini: P100 & jumlah antrian menggantikan MtD & Single/Multipel
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
    [m, c] = mp(cur, qP95(D.dates[st.d]));
  const dh =
    dd == null
      ? ""
      : dd < 0
        ? `<span class="ok">▲ Membaik ${-dd} detik</span>`
        : dd > 0
          ? `<span class="bad">▼ Memburuk ${dd} detik</span>`
          : '<span class="mu">Tetap</span>';
  // sejak 27 Okt 2026: Reservasi dan P100 (D.QN, D.QP: [Teller, CS, Semua TRX])
  if (D.dates[st.d] >= P100_MULAI) {
    const n = D.QN?.[st.b]?.[st.d]?.[k],
      p = D.QP?.[st.b]?.[st.d]?.[k];
    const rinci = `Reservasi<br><b>${n == null ? "–" : n.toLocaleString("id-ID")}</b>`;
    return `<div class="q"><div class="t">${name}</div><div class="v">${f(cur)}</div>${chip(m, c)}<div class="s">${rinci}</div><div class="d">${dh}</div><div class="m">P100 ${f(p)}</div></div>`;
  }
  // tanggal sebelum 27 Okt: rincian Single / Multipel (D.QD: [Teller single, Teller multipel, CS single, CS multipel])
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

// baris utilisasi dengan bar warna
function util(label, n, o, lalu) {
  const p = pc(n, o),
    [c, cc] = club(p);
  const warna = cc === "n" ? "mu" : cc === "mid" ? "md" : cc === "warn" ? "wr" : cc === "bad" ? "bd" : "ok";
  // pembanding MTD bulan lalu (mis. MTD Oktober) bila ada: lalu = { lbl, n, o }
  const pl = lalu ? pc(lalu.n, lalu.o) : null;
  let vs = "";
  if (pl != null) {
    const sel = p != null ? p - pl : null,
      sama = sel != null && Math.abs(sel) < 0.0005,
      tanda = sel == null ? "" : sama ? '<span class="nb-vs-dl mu">≈ setara</span>' : `<span class="nb-vs-dl ${sel > 0 ? "ok" : "bd"}">${sel > 0 ? "▲" : "▼"} ${(Math.abs(sel) * 100).toFixed(1).replace(".", ",")} %</span>`;
    vs = `<div class="row sub nb-vs" style="justify-content:space-between"><span>vs ${lalu.lbl} <b>${P(pl)}</b> <small>(NBDS ${lalu.n ?? "–"} · Old BDS ${lalu.o ?? "–"})</small></span>${tanda}</div>`;
  }
  return `<div class="u"><div class="row" style="justify-content:space-between"><b>${label}</b>${chip(c,cc)}</div>
  <div class="bar"><b style="width:${(p || 0) * 100}%;background:var(--${warna})"></b></div>
  <div class="row sub" style="justify-content:space-between"><span>NBDS <b>${n ?? "–"}</b> · Old BDS <b>${o ?? "–"}</b></span><b>${P(p)}${p != null && p >= 0.98 ? " " : ""}</b></div>${vs}</div>`;
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

/* --- pilihan periode DtD / MTD per kartu (Waktu Antrian, Utilisasi NBDS) --- */
const perKartu = { q: "dtd", nb: "dtd" };
let BULAN_DATA = new Date(D.dates[D.dates.length - 1] + "T00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
window.addEventListener('kito:bulan', () => { BULAN_DATA = window.KITO_BULAN.nama; });
// tombol DtD | MTD; tanpaDtd = data harian tidak tersedia (tombol DtD nonaktif)
const segPer = (k, tanpaDtd) =>
  `<div class="seg seg-per" role="group" aria-label="Periode">${[
    ["dtd", "DtD"],
    ["mtd", "MTD"],
  ]
    .map(([v, t]) => {
      const mati = v === "dtd" && tanpaDtd;
      return `<button type="button" data-per="${k}" data-pv="${v}" class="${perKartu[k] === v ? "on" : ""}"${mati ? ' disabled title="Data DtD per cabang belum tersedia"' : ""}>${t}</button>`;
    })
    .join("")}</div>`;

// waktu antrian MTD (P90) per cabang dari kito.json [KITO_AREA_KELOMPOK]
const kelCabang = () => (window.KITO_AREA_KELOMPOK || []).find((r) => String(r.kode) === String(D.B[st.b][0]));
function qcardMtd(name, k) {
  const v = kelCabang()?.mtd?.[["teller", "cs", "all"][k]] ?? null,
    [m, c] = mp(v),
    dtd = D.Q[st.b][st.d]?.[k];
  return `<div class="q"><div class="t">${name}</div><div class="v">${f(v)}</div>${chip(m, c)}<div class="s">P90 MTD<br><b>${BULAN_DATA}</b></div><div class="d"></div><div class="m">DtD ${dl(D.dates[st.d])} ${f(dtd)}</div></div>`;
}

// Tiga kotak: Teller, CS, Semua TRX pada tanggal terpilih (DtD) atau MTD
function kartuAntrian() {
  const november = D.dates[st.d]?.slice(0, 7) === "2026-11";
  if (perKartu.q === "mtd")
    return `<div class="cd"><h2>Waktu Antrian · MTD ${BULAN_DATA} · ${november ? "P95" : "P90"}</h2>${segPer("q")}<div class="g3">${qcardMtd("TELLER", 0)}${qcardMtd("CS", 1)}${qcardMtd("SEMUA TRX", 2)}</div></div>`;
  return `<div class="cd"><h2>Waktu Antrian · ${dlong(D.dates[st.d])}${november ? " · P95" : ""}</h2>${segPer("q")}<div class="g3">${qcard("TELLER", 0)}${qcard("CS", 1)}${qcard("SEMUA TRX", 2)}</div>${wait10()}</div>`;
}

// sejak 27 Okt: reservasi dengan waktu tunggu < 10 detik (sheet "Wait <10 Detik"), peringkat di Region II
function wait10() {
  if (D.dates[st.d] < P100_MULAI) return "";
  const w = D.QW?.[st.b]?.[st.d];
  if (!w) return `<div class="w10"><span>Wait &lt; 10 detik</span><b>–</b><small>Data belum ada untuk tanggal ini</small></div>`;
  const p = w[0] ? w[1] / w[0] : null;
  const semua = D.QW.map((s) => s?.[st.d]).filter((x) => x && x[0]),
    rk = p == null ? null : 1 + semua.filter((x) => x[1] / x[0] > p).length;
  const pc = (v) => (v * 100).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  return `<div class="w10"><span>Wait &lt; 10 detik</span><b>${w[1].toLocaleString("id-ID")} <small>dari ${w[0].toLocaleString("id-ID")} reservasi</small></b><b class="w10-p">${p == null ? "–" : pc(p)}</b>${rk ? `<small>Peringkat ${rk} dari ${semua.length} cabang Region II (persentase tertinggi = 1)</small>` : ""}</div>`;
}

// Posisi kartu Tren Waktu Antrian; isinya digambar cabang-tren.js (mengganti fungsi ini di URUTAN)
function kartuTren() {
  return "";
}

// Data Kelompok: kotak Teller dan CS, masing-masing dua periode
function kartuKelompok() {
  if (window.KITO_BULAN && window.KITO_BULAN.aktif !== "2026-10") return ""; // kelompok 07 & 23 Okt hanya untuk Oktober
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
  return `<div class="cd"><h2>Overall O2O · MTD s.d. ${dlong(D.mdate)}</h2><div class="row">${donut(o2o, nb)}<div style="flex:1;min-width:150px">
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
  return `<div class="cd"><h2>Shifting Digital · MTD s.d. ${dlong(D.mdate)}</h2>
    <div class="sh-atas"><div class="sh-n">${sh ? P(dig / sh) : "–"}</div>
      <div class="sh-t">${sh ? `<b>${dig}</b> dari <b>${sh}</b> transaksi lewat O2O dan CSM` : "Belum ada data transaksi"}</div></div>
    ${sh ? `<div class="sh-bar">${bar}</div><div class="sh-grid">${leg}</div>` : ""}
    <div class="note">Rumus: (O2O + CSM) ÷ (O2O + NBDS + CSM + OBDS) · NBDS = seluruh transaksi ganti kartu lewat New BDS</div>
  </div>`;
}

// Utilisasi NBDS: tiga baris dengan bar. DtD = tanggal terpilih, MTD = akumulasi bulan berjalan (kito.json [KITO_AREA_NBDS])
function kartuUtilisasi() {
  const N = window.KITO_AREA_NBDS,
    c = N?.cabang?.find((x) => String(x.kode) === String(D.B[st.b][0]));
  const mtd = perKartu.nb === "mtd";
  let pasang, judul;
  if (c) {
    let j = N.dates.indexOf(D.dates[st.d]);
    // laporan NBDS bisa terbit lebih lambat dari antrian/O2O: tanggal terpilih yang lebih baru memakai data NBDS terakhir
    const terakhir = j < 0 && D.dates[st.d] > N.tanggal;
    if (terakhir) j = N.dates.indexOf(N.tanggal);
    pasang = (k) => (mtd ? c.m[k] : j < 0 ? null : c.d[k]?.[j]) || [null, null];
    judul = mtd ? `MTD s.d. ${dlong(N.tanggal)}` : terakhir ? `${dlong(N.tanggal)} (data terakhir)` : dlong(D.dates[st.d]);
  } else {
    // cadangan: D.M[4..9] = DtD tanggal laporan
    const m = D.M[st.b];
    if (!m) return "";
    pasang = (k) => ({ fp: [m[4], m[5]], fnp: [m[6], m[7]], nf: [m[8], m[9]] })[k];
    judul = dlong(D.mdate);
  }
  const ada = ["fp", "fnp", "nf"].some((k) => pasang(k)[0] != null);
  // MTD: pembanding MTD bulan sebelumnya dari arsip akhir bulan (kito.json [KITO_ARSIP_BULAN][bulanLalu].nbds)
  const blnLalu = N?.bulanLalu,
    cLalu = mtd && c && blnLalu ? window.KITO_ARSIP_BULAN?.[blnLalu]?.nbds?.area?.cabang?.find((x) => String(x.kode) === String(c.kode)) : null,
    tglLalu = cLalu ? window.KITO_ARSIP_BULAN[blnLalu].nbds.area.tanggal : null,
    lblLalu = cLalu ? `MTD ${new Date(blnLalu + "-01T00:00").toLocaleDateString("id-ID", { month: "long" })}` : "",
    lalu = (k) => (cLalu?.m?.[k] ? { lbl: lblLalu, n: cLalu.m[k][0], o: cLalu.m[k][1] } : null);
  const catLalu = cLalu ? `<div class="note">Pembanding ${lblLalu}: akumulasi s.d. ${dlong(tglLalu)} (laporan NBDS terakhir bulan itu).</div>` : "";
  return `<div class="cd"><h2>Utilisasi NBDS · ${judul}</h2>${segPer("nb", !c)}${util("Teller Perorangan", ...pasang("fp"), lalu("fp"))}${util("Teller Badan", ...pasang("fnp"), lalu("fnp"))}${util("Customer Service", ...pasang("nf"), lalu("nf"))}${catLalu}${ada ? "" : '<div class="note">Data utilisasi untuk tanggal ini belum ada di laporan.</div>'}</div>`;
}




// Ranking cabang: terbaik di kiri, terburuk di kanan
function kartuRanking() {
  if (!METRIK[rk.m]) rk.m = 2;
  const M = METRIK[rk.m],
    fmt = (v) => fmtRanking(M, v),
    kelas = M.kelas || ((v) => (M.tinggi ? club(v) : mp(v, qP95(D.dates[st.d])))[1]);
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
  // rincian Old BDS = tanggal laporan (arsip bulan lampau bisa lebih awal dari DtD NBDS: oldbdsTanggal)
  const tgl = (window.KITO_AREA_NBDS || {}).oldbdsTanggal || (window.KITO_AREA_NBDS || {}).tanggal || D.mdate;
  return `<div class="cd"><h2>Detail Data Old BDS (${ob.length})</h2>${ob.length ? `<p class="sub ob-sub">Transaksi yang masih lewat Old BDS · DtD ${dlong(tgl)}</p>${ringkasOldBds(ob)}${tabelOldBds(ob)}<div class="note">Total ${total} transaksi dari ${ob.length} baris · User ID disamarkan</div>` : '<div class="sub">Tidak ada transaksi Old BDS.</div>'}</div>`;
}

// Tabel waktu antrian per tanggal (ketuk baris untuk ganti tanggal)
function kartuDetailAntrian() {
  const s = D.Q[st.b],
    N = window.KITO_AREA_NBDS,
    c = N?.cabang?.find((x) => String(x.kode) === String(D.B[st.b][0])),
    kel = kelCabang(),
    KN = ["fp", "fnp", "nf"];
  const sel = (v, p95) => `<td class="${mp(v, p95)[1]}"><b>${f(v)}</b></td>`;
  const nb = (pair) => {
    const u = pair ? pc(pair[0], pair[1]) : null;
    return `<td class="${club(u)[1]}"><b>${P(u)}</b></td>`;
  };
  const mtd = `<tr><td><b>MTD ${BULAN_DATA}</b></td>${["teller", "cs", "all"].map((k) => sel(kel?.mtd?.[k] ?? null, false)).join("")}${KN.map((k) => nb(c?.m?.[k])).join("")}</tr>`;
  const harian = D.dates
    .map((d, i) => [d, i])
    .reverse()
    .map(([d, i]) => {
      const j = N ? N.dates.indexOf(d) : -1;
      return `<tr data-d="${i}" class="${i === st.d ? "on" : ""}"><td>${dlong(d)}</td>${[0, 1, 2].map((k) => sel(s[i]?.[k], qP95(d))).join("")}${KN.map((k) => nb(j < 0 ? null : c?.d?.[k]?.[j])).join("")}</tr>`;
    })
    .join("");
  return `<div class="cd"><h2>Detail Waktu Antrian & Utilisasi NBDS per Tanggal</h2><div class="tw"><table><tr><th>Tanggal</th><th>Teller</th><th>CS</th><th>Semua</th><th>NBDS T. Prg</th><th>NBDS T. Bdn</th><th>NBDS CS</th></tr>${mtd}${harian}</table></div><div class="note">Waktu antrian mm:ss (P95 sejak 27 Okt, sebelumnya dan MTD P90) · Utilisasi NBDS = New BDS ÷ (New BDS + Old BDS), target ≥ 98% · T. Prg = Teller Perorangan, T. Bdn = Teller Badan. Ketuk baris untuk ganti tanggal.</div></div>`;
}

// Detail O2O: cabang dibanding area, Region II, dan Bankwide (laporan Ganti Kartu, kumulatif MTD)
function kartuDetailO2O() {
  const m = D.M[st.b];
  if (!m) return "";
  // jumlah [O2O, NBDS O2O, CSM, OBDS, NBDS shifting] untuk sekumpulan cabang
  const jumlah = (idx) =>
    idx.reduce((a, i) => {
      const x = D.M[i];
      if (!x) return a;
      return [a[0] + (x[0] || 0), a[1] + (x[1] || 0), a[2] + (x[2] || 0), a[3] + (x[3] || 0), a[4] + (x[10] ?? x[1] ?? 0)];
    }, [0, 0, 0, 0, 0]);
  const semua = D.B.map((b, i) => i),
    area = D.B[st.b][2],
    diArea = semua.filter((i) => D.B[i][2] === area);
  const o2oP = (i) => {
    const x = D.M[i];
    return x && x[0] + x[1] > 0 ? x[0] / (x[0] + x[1]) : null;
  };
  // peringkat O2O % (tertinggi = 1) di antara sekumpulan cabang
  const peringkat = (idx) => {
    const v = o2oP(st.b),
      ada = idx.map(o2oP).filter((x) => x != null);
    return v == null ? null : [1 + ada.filter((x) => x > v).length, ada.length];
  };
  const bw = (window.KITO_AREA_O2O || {}).bankwide?.s?.overall;
  const kls = (p) => (p == null ? "n" : p >= D.bw ? "ok" : "bad");
  const baris = (nama, j, rk, on) => {
    const tot = j[0] + j[1],
      p = tot ? j[0] / tot : null,
      shTot = j[0] + j[2] + j[3] + j[4],
      sh = j[2] == null || !shTot ? null : (j[0] + j[2]) / shTot;
    return `<tr class="${on ? "on" : ""}"><td><b>${esc(nama)}</b>${rk ? `<small>#${rk[0]} dari ${rk[1]} cabang</small>` : ""}</td><td>${j[0].toLocaleString("id-ID")}</td><td>${j[1].toLocaleString("id-ID")}</td><td>${tot.toLocaleString("id-ID")}</td><td class="${kls(p)}"><b>${P(p)}</b></td><td>${P(sh)}</td></tr>`;
  };
  const rows = [
    baris("Cabang ini", jumlah([st.b]), null, true),
    baris(`Area ${area}`, jumlah(diArea), peringkat(diArea)),
    baris("Region II", jumlah(semua), peringkat(semua)),
    bw ? baris("Bankwide", [bw[0], bw[1], null, null, null], null) : "",
  ].join("");
  return `<div class="cd"><h2>Detail O2O · MTD s.d. ${dlong(D.mdate)}</h2><div class="tw"><table><tr><th>Cakupan</th><th>Livin O2O</th><th>NBDS</th><th>Total</th><th>O2O %</th><th>Shifting</th></tr>${rows}</table></div><div class="note">O2O % = Livin O2O ÷ (Livin O2O + NBDS); hijau = di atas rata-rata Bankwide ${P(D.bw)}. Shifting = (O2O + CSM) ÷ (O2O + NBDS + CSM + OBDS). # = peringkat O2O % cabang ini (tertinggi = 1).</div></div>`;
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
  kartuDetailO2O,
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

  // tombol periode DtD / MTD di kartu
  const pv = e.target.closest("[data-pv]");
  if (pv) {
    if (!pv.disabled) {
      perKartu[pv.dataset.per] = pv.dataset.pv;
      render();
    }
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
    "</b><br>Dashboard Monitoring Inbranch · Region II" +
    '<span class="kredit"><span class="credit-property">Property of Operation Region II Sumatera</span><span class="credit-attribution">© Credits by <a href="https://assyahid.github.io/" target="_blank" rel="noopener noreferrer">Assyahid Hasan Albana</a> | Desigen By Deni</span></span>';
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
  if (!gs) return;
  const desktop = window.matchMedia("(min-width: 769px) and (hover: hover) and (pointer: fine)").matches;
  if (desktop) {
    gs.classList.toggle("kito-cari-aktif", i === 1);
    tabs.forEach((t, j) => t.classList.toggle("on", j === i));
    if (i === 0) hs.hidden = true;
    return;
  }
  gs.scrollTo({ left: i * gs.clientWidth, behavior: "smooth" });
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
