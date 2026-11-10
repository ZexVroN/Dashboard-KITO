"""Program Emas (Tabungan Emas & Cetak Emas di ATM) -> data/kito.json [KITO_EMAS].

    python tools/build_emas.py "Monitoring_Emas_1-9_November_2026.xlsx"

Sumber (laporan "Monitoring Emas"):
  - sheet Monitoring  (area kerja, kolom AA..AW) : 12 region: pegawai, partisipasi, Tab. Emas & Cetak Emas MTD vs target, rank
  - sheet Detail Cabang                         : cabang Region II: pegawai, sudah input, Tab. Emas D-1 / D / target, Cetak D / target
  - sheet Data Pegawai                          : pegawai in-branch Region II (NIP, nama, jabatan, kode cabang)
  - sheet Data by Form                          : transaksi yang DIHITUNG (kolom Dihitung = 1) s.d. D dan s.d. D-1,
                                                  dijumlah per pegawai (Kunci NIP) dan layanan
  - sheet Target                                : target per orang / bulan (Tab. Emas BOM/BOS/CS 5, Teller 3, Cetak 2)
Yang disimpan hanya jumlah per pegawai/cabang/region. Nama nasabah dan nomor rekening TIDAK disimpan; NIP disamarkan
(******1234) seperti data sales pegawai.
"""
import collections
import datetime as dt
import os
import re
import sys

import openpyxl

import kito_data  # data/kito.json

SRC = sys.argv[1] if len(sys.argv) > 1 else None
if not SRC:
    sys.exit(__doc__)
wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)


def num(v):
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return int(v) if float(v).is_integer() else float(v)
    try:
        return float(str(v).replace(",", "."))
    except ValueError:
        return None


def iso(v):
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    return None


def kode(v):
    if v is None:
        return ""
    if isinstance(v, float):
        v = int(v)
    return re.sub(r"\D", "", str(v))


def samar(nip):
    d = re.sub(r"\D", "", str(nip or ""))
    return "******" + d[-4:] if d else ""


# ---------- periode & target per orang ----------
dash = list(wb["Dashboard"].iter_rows(min_row=1, max_row=8, values_only=True))
tanggal = iso(dash[3][3])
awal = iso(dash[4][3])
kali = num(dash[6][3]) or 1
tgt = {"tabBom": 5, "tabTeller": 3, "cetak": 2}
for r in wb["Target"].iter_rows(min_row=17, max_row=24, values_only=True):
    lbl = str(r[1] or "").lower()
    v = num(r[2])
    if v is None:
        continue
    if "tabungan" in lbl and "teller" in lbl:
        tgt["tabTeller"] = v
    elif "tabungan" in lbl:
        tgt["tabBom"] = v
    elif "cetak" in lbl:
        tgt["cetak"] = v
tgt = {k: v * kali for k, v in tgt.items()}

# ---------- 12 region (sheet Monitoring, area kerja) ----------
regions = []
for r in wb["Monitoring"].iter_rows(min_row=5, max_row=20, values_only=True):
    if len(r) < 49 or not (isinstance(r[27], str) and re.match(r"^R\d\d$", r[27])):
        continue
    regions.append({
        "kode": r[27], "nama": str(r[28]).strip(), "pegawai": num(r[30]), "input": num(r[31]), "inputD1": num(r[33]),
        "tab": {"t": num(r[36]), "v": num(r[37]), "dod": num(r[39]), "cabBelum": num(r[40])},
        "cetak": {"t": num(r[41]), "v": num(r[42]), "dod": num(r[44]), "cabBelum": num(r[45])},
        "rank": {"part": num(r[46]), "tab": num(r[47]), "cetak": num(r[48])},
    })

# ---------- cabang Region II (sheet Detail Cabang) ----------
cabang = []
for r in wb["Detail Cabang"].iter_rows(min_row=6, values_only=True):
    if len(r) < 19 or not str(r[2] or "").upper().startswith("REGION II "):
        continue
    cabang.append({
        "kode": kode(r[0]), "nama": str(r[4]).strip(), "kelas": r[1], "area": str(r[3] or "").strip(),
        "pegawai": {"bom": num(r[5]), "teller": num(r[6]), "total": num(r[7]), "input": num(r[8])},
        "tab": {"d1": num(r[9]), "v": num(r[10]), "tambah": num(r[11]), "t": num(r[12])},
        "cetak": {"v": num(r[15]), "t": num(r[16])},
        "status": r[18],
    })
kode_r2 = {c["kode"] for c in cabang}

# ---------- transaksi dihitung per NIP (sheet Data by Form) ----------
# NIP dinormalkan tanpa nol di depan (form: "0985328590", Data Pegawai: 985328590). Bila NIP tidak dikenal,
# dicocokkan lewat nama di kode cabang yang sama; sisanya dicatat per cabang sebagai input di luar daftar pegawai.
nipn = lambda v: re.sub(r"^0+", "", re.sub(r"\D", "", str(v or "")))
entri = []   # (nipn, nama, kode, jabatan, k, d, d1)
form = list(wb["Data by Form"].iter_rows(min_row=1, values_only=True))
jd = {str(v).strip().lower(): i for i, v in enumerate(form[0]) if v}
I = {k: jd[k] for k in ("layanan", "kunci nip", "dihitung", "periode s.d. d", "periode s.d. d-1", "kode cabang",
                         "nama pegawai", "jabatan pegawai")}
tanpa_pegawai = collections.Counter()
for r in form[1:]:
    if r is None or len(r) <= max(I.values()) or num(r[I["dihitung"]]) != 1:
        continue
    lay = str(r[I["layanan"]] or "").lower()
    k = "cetak" if "cetak" in lay else "tab" if "tabungan" in lay else None
    if not k:
        continue
    entri.append((nipn(re.sub(r"^N", "", str(r[I["kunci nip"]] or "").strip())),
                  str(r[I["nama pegawai"]] or "").strip(), kode(r[I["kode cabang"]]), str(r[I["jabatan pegawai"]] or "").strip(),
                  k, num(r[I["periode s.d. d"]]) == 1, num(r[I["periode s.d. d-1"]]) == 1))

# ---------- pegawai Region II (sheet Data Pegawai) ----------
daftar = []
for r in wb["Data Pegawai"].iter_rows(min_row=3, values_only=True):
    if len(r) < 9 or str(r[1]).strip() not in ("2", "2.0") or kode(r[2]) not in kode_r2:
        continue
    daftar.append((nipn(r[6]), r))
per_nip = {n: r for n, r in daftar}
per_nama = {(str(r[7] or "").strip().upper(), kode(r[2])): n for n, r in daftar}
hit = collections.defaultdict(lambda: {"tab": 0, "tabD1": 0, "cetak": 0, "cetakD1": 0})
lain = collections.defaultdict(lambda: collections.defaultdict(lambda: {"tab": 0, "cetak": 0}))
for n, nama, kd, jab, k, d, d1 in entri:
    if n not in per_nip:
        n = per_nama.get((nama.upper(), kd), n)
    if n in per_nip:
        hit[n][k] += d
        hit[n][k + "D1"] += d1
    elif kd in kode_r2 and d:
        lain[kd][(nama.title(), jab)][k] += 1
pegawai = []
for nip, r in daftar:
    teller = str(r[8] or "").strip().lower() == "teller"
    h = hit.get(nip, {"tab": 0, "tabD1": 0, "cetak": 0, "cetakD1": 0})
    pegawai.append([str(r[7] or "").strip(), samar(nip), str(r[8] or "").strip(), kode(r[2]),
                    "T" if teller else "B",
                    h["tab"], tgt["tabTeller"] if teller else tgt["tabBom"], h["tab"] - h["tabD1"],
                    h["cetak"], tgt["cetak"], h["cetak"] - h["cetakD1"]])

# cek: jumlah per cabang dari pegawai vs sheet Detail Cabang
per_kode = collections.Counter()
for p in pegawai:
    per_kode[p[3]] += p[5]
beda = [(c["kode"], c["nama"], per_kode[c["kode"]], c["tab"]["v"]) for c in cabang if per_kode[c["kode"]] != (c["tab"]["v"] or 0)]
r2 = next((x for x in regions if x["kode"] == "R02"), None)
out = {
    "sumber": os.path.basename(SRC),
    "awal": awal, "tanggal": tanggal,
    "target": tgt,
    "kolom": ["nama", "nip", "jabatan", "kode", "kelompok (B=BOM/BOS/CS, T=Teller)",
              "tab", "tabTarget", "tabHariIni", "cetak", "cetakTarget", "cetakHariIni"],
    "regions": regions, "cabang": cabang, "pegawai": pegawai,
    # input pegawai yang tidak ada di daftar pegawai Region II (nama/NIP tidak dikenal), per kode cabang input
    "lain": {kd: [[nm, jab, v["tab"], v["cetak"]] for (nm, jab), v in sorted(x.items())] for kd, x in sorted(lain.items())},
}
kito_data.tulis("KITO_EMAS", out)
tot_tab = sum(p[5] for p in pegawai)
tot_cetak = sum(p[8] for p in pegawai)
print(f"Program Emas {awal} s.d. {tanggal}: {len(regions)} region · Region II {len(cabang)} cabang, {len(pegawai)} pegawai")
print(f"  Tab. Emas pegawai R2 {tot_tab} (sheet region {r2 and r2['tab']['v']}) · Cetak {tot_cetak} (sheet {r2 and r2['cetak']['v']})"
      f" · partisipasi {sum(1 for p in pegawai if p[5] or p[8])} (sheet {r2 and r2['input']})")
print(f"  input di luar daftar pegawai: {sum(v[2] + v[3] for x in out['lain'].values() for v in x)} transaksi, {sum(len(x) for x in out['lain'].values())} nama")
for b in beda[:10]:
    print("  BEDA cabang (pegawai vs Detail Cabang):", b)
print(f"Target per orang: {tgt}")
