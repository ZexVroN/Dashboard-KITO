"""Membuat data/kito.json [KITO_SALES_PEGAWAI] dari "Dashboard_Sales_Inbranch_R2*.xlsx" (sheet "Monitoring Ind Pegawai").

Pemakaian (dari folder Dashboard-KITO):
    python tools/build_sales_pegawai.py <Dashboard_Sales_Inbranch_R2.xlsx>

Sheet "Monitoring Ind Pegawai" punya tiga blok:
    PROFILE PEGAWAI INBRANCH : No, Nama Pegawai, NIP, Jabatan, Area, Kode Cabang
    EKSTENSIFIKASI (New CIF) : Akuisisi per tanggal update, Target, Gap, Bal, Target Bal, Gap Bal, %, Status
    INTENSIFIKASI (New Acc ETB): susunan kolom sama dengan Ekstensifikasi
Kolom dicari dari judul (baris 3 = blok, baris 5 = kolom), bukan dari posisi tetap.

Yang disimpan per pegawai (Gap, %, dan Status dihitung ulang di browser dengan aturan Excel):
    [nama, NIP disamarkan, jabatan, kode area, kode cabang,
     [akuisisi eksten per tanggal], target eksten, bal eksten, target bal eksten,
     [akuisisi inten per tanggal],  target inten,  bal inten,  target bal inten]
NIP disamarkan (******1234), sama seperti User ID pada data Old BDS.

Riwayat tanggal: laporan baru sering hanya memuat tanggal update terakhir. Nilai tanggal sebelumnya diambil dari
data yang sudah ada (data/kito.json [KITO_SALES_PEGAWAI]), dicocokkan per pegawai (kode cabang + nama), lalu
ditampilkan N tanggal terakhir (bawaan 3). Target, balance, dan target balance selalu dari laporan terbaru.

Total per cabang (kunci "cabang"): sheet "Monitoring Cabang (All)" sering memuat tanggal yang tidak ada di sheet
pegawai (mis. update 01 Nov dan 02 Nov, sedangkan sheet pegawai hanya 02 Nov). Akuisisi Ekstensifikasi &
Intensifikasi per cabang per tanggal disimpan di
    cabang = {kode: {"e": [akuisisi per tanggal update], "i": [...]}}
Tanggal yang ada di sheet pegawai / riwayat = jumlah pegawai cabang itu (konsisten dengan target & tabel pegawai);
sheet cabang hanya dipakai untuk tanggal yang tidak ada di sheet pegawai. Ringkasan cabang/area/Region II
memakai total ini; tabel per pegawai tetap memakai nilai pegawai (tanggal tanpa data pegawai = kosong).

    python tools/build_sales_pegawai.py <xlsx> [--tampil 3] [--ganti-label 2026-10-28=2026-10-30]
    --ganti-label  memperbaiki label tanggal di riwayat (mis. kolom berjudul "28 Okt" yang ternyata data 30 Okt)
"""

import json
import re
import sys

import openpyxl

import argparse
import os

import kito_data  # data/kito.json

ap = argparse.ArgumentParser()
ap.add_argument("xlsx")
ap.add_argument("--out", default="KITO_SALES_PEGAWAI")
ap.add_argument("--riwayat", help="data lama untuk tanggal sebelumnya (bawaan: file --out yang sudah ada)")
ap.add_argument("--tampil", type=int, default=3, help="jumlah tanggal update yang ditampilkan (bawaan 3)")
ap.add_argument("--ganti-label", action="append", default=[], metavar="LAMA=BARU",
                help="ganti label tanggal di riwayat, mis. 2026-10-28=2026-10-30")
A = ap.parse_args()
SRC, OUT = A.xlsx, A.out
BULAN = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "mei": 5, "jun": 6, "jul": 7, "agu": 8, "agt": 8,
         "sep": 9, "okt": 10, "nov": 11, "des": 12}

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
# tahun untuk judul kolom tanpa tahun ("Akuisisi update 01 Nov"): ambil dari nama file / judul sheet pegawai
_m = re.search(r"(20\d{2})", os.path.basename(SRC))
SRC_TAHUN = (_m.group(1)[2:] if _m else "26")
ws = wb["Monitoring Ind Pegawai"]
rows = list(ws.iter_rows(min_row=1, values_only=True))
blok_baris, judul = rows[2], rows[4]

# kolom awal tiap blok
blok = {}
for i, v in enumerate(blok_baris):
    if isinstance(v, str) and v.strip():
        blok[v.strip().upper()] = i
awal = sorted(blok.values())
def rentang(nama):
    a = blok[nama]
    b = next((x for x in awal if x > a), len(judul))
    return a, b

def kol(nama_blok, pola, semua=False):
    a, b = rentang(nama_blok)
    hasil = [i for i in range(a, b) if judul[i] and re.search(pola, str(judul[i]), re.I)]
    if not hasil:
        sys.exit(f"Kolom '{pola}' tidak ditemukan di blok {nama_blok}")
    return hasil if semua else hasil[0]

def tanggal(teks):
    m = re.search(r"(\d{1,2})\s+([A-Za-z]{3})\w*\s*'?(\d{2})", str(teks))
    d, b, y = m.groups()
    return f"20{y}-{BULAN[b.lower()]:02d}-{int(d):02d}"

P = "PROFILE PEGAWAI INBRANCH"
c_nama, c_nip, c_jab = kol(P, r"^nama pegawai"), kol(P, r"^nip$"), kol(P, r"^jabatan")
c_area, c_kode = kol(P, r"^area"), kol(P, r"^kode cabang")
BL = {}
for key, nama in (("e", "EKSTENSIFIKASI"), ("i", "INTENSIFIKASI")):
    akuisisi = kol(nama, r"^akuisisi update", semua=True)
    BL[key] = {
        "akuisisi": akuisisi,
        "tgl": [tanggal(judul[i]) for i in akuisisi],
        "target": kol(nama, r"^target (eksten|inten)$"),
        "bal": kol(nama, r"^bal( inten)?$"),
        "tbal": kol(nama, r"^target bal"),
    }

def num(v):
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        return None
    v = round(float(v), 4)
    return int(v) if v.is_integer() else v

def samar(nip):
    s = re.sub(r"\D", "", str(nip or ""))
    return "******" + s[-4:] if len(s) >= 4 else ""

def kode(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip() if v is not None else ""

# ---------- riwayat (data lama) ----------
ganti = dict(x.split("=", 1) for x in A.ganti_label)
riwayat = {}                      # (kode, nama) -> {"e": {tgl: nilai}, "i": {tgl: nilai}}
path_riwayat = A.riwayat or (OUT if kito_data.ada(OUT) else None)
if path_riwayat:
    if os.path.exists(path_riwayat) and not path_riwayat.endswith("kito.json"):
        teks = open(path_riwayat, encoding="utf-8").read()   # file data lama (.js) sebagai riwayat
        lama = json.loads(teks[teks.index("{"):teks.rindex("}") + 1])
    else:
        lama = kito_data.baca(path_riwayat)
    tgl_lama = [ganti.get(t, t) for t in lama["update"]]
    for r in lama["rows"]:
        riwayat[(r[4], r[0].upper())] = {"e": dict(zip(tgl_lama, r[5])), "i": dict(zip(tgl_lama, r[9]))}
    print(f"Riwayat: {path_riwayat} · tanggal {tgl_lama}" + (f" (label diganti {ganti})" if ganti else ""))

# ---------- laporan baru ----------
pegawai = []
for r in rows[5:]:
    if not r[c_nama]:
        continue
    p = {"id": [str(r[c_nama]).strip(), samar(r[c_nip]), str(r[c_jab] or "").strip(), kode(r[c_area]), kode(r[c_kode])]}
    for key in ("e", "i"):
        b = BL[key]
        p[key] = {"seri": dict(zip(b["tgl"], (num(r[i]) for i in b["akuisisi"]))),
                  "sisa": [num(r[b["target"]]), num(r[b["bal"]]), num(r[b["tbal"]])]}
    pegawai.append(p)

# ---------- total per cabang (sheet "Monitoring Cabang (All)") ----------
cab_seri = {}                     # kode -> {"e": {tgl: n}, "i": {tgl: n}}
if "Monitoring Cabang (All)" in wb.sheetnames:
    cr = list(wb["Monitoring Cabang (All)"].iter_rows(min_row=1, values_only=True))
    cblok, cjudul = cr[2], cr[4]
    cb = {str(v).strip().upper(): i for i, v in enumerate(cblok) if isinstance(v, str) and v.strip()}
    cawal = sorted(cb.values())
    def crentang(nama):
        a = cb[nama]
        return a, next((x for x in cawal if x > a), len(cjudul))
    ckode = next(i for i, v in enumerate(cjudul) if v and re.match(r"^kode cabang", str(v), re.I))
    ckol = {}
    for key, nama in (("e", "EKSTENSIFIKASI"), ("i", "INTENSIFIKASI")):
        a, b = crentang(nama)
        ckol[key] = [(i, tanggal(str(cjudul[i]) + " '" + SRC_TAHUN)) for i in range(a, b)
                     if cjudul[i] and re.match(r"^akuisisi update", str(cjudul[i]), re.I)]
    for r in cr[5:]:
        k = kode(r[ckode]) if r[ckode] is not None else ""
        if not k or not k.isdigit():
            continue
        cab_seri[k] = {key: {t: num(r[i]) for i, t in ckol[key]} for key in ("e", "i")}
    print(f"Sheet Monitoring Cabang (All): {len(cab_seri)} cabang · Ekstensifikasi {[t for _, t in ckol['e']]}"
          f" · Intensifikasi {[t for _, t in ckol['i']]}")

# tanggal yang ditampilkan: gabungan laporan baru + sheet cabang + riwayat, ambil N terakhir
semua = set(BL["e"]["tgl"]) | set(BL["i"]["tgl"])
for v in cab_seri.values():
    semua |= set(v["e"]) | set(v["i"])
for v in riwayat.values():
    semua |= set(v["e"]) | set(v["i"])
update = sorted(semua)[-A.tampil:]
tanpa_riwayat = 0
data = []
for p in pegawai:
    h = riwayat.get((p["id"][4], p["id"][0].upper()))
    if h is None:
        tanpa_riwayat += 1
    row = list(p["id"])
    for key in ("e", "i"):
        seri = [p[key]["seri"].get(t, (h or {}).get(key, {}).get(t)) for t in update]
        row += [seri] + p[key]["sisa"]
    data.append(row)
# total per cabang sejajar dengan `update`: sheet cabang bila ada, selain itu jumlah pegawai (termasuk riwayat)
cabang_out = {}
for row in data:
    k = row[4]
    c = cabang_out.setdefault(k, {"e": [0] * len(update), "i": [0] * len(update), "_ada": {"e": [False] * len(update), "i": [False] * len(update)}})
    for key, idx in (("e", 5), ("i", 9)):
        for j, v in enumerate(row[idx]):
            if v is not None:
                c[key][j] += v
                c["_ada"][key][j] = True
for k, c in cabang_out.items():
    for key in ("e", "i"):
        for j, t in enumerate(update):
            # tanggal yang ada di sheet pegawai: total = jumlah pegawai (sama dengan target & tabel pegawai);
            # sheet cabang hanya mengisi tanggal yang tidak ada di sheet pegawai (mis. 01 Nov)
            v = cab_seri.get(k, {}).get(key, {}).get(t)
            if not c["_ada"][key][j]:
                c[key][j] = v
    del c["_ada"]
print(f"Ekstensifikasi di laporan: {BL['e']['tgl']} · Intensifikasi: {BL['i']['tgl']}")
print(f"Ditampilkan: {update} · pegawai tanpa riwayat (titik lama kosong): {tanpa_riwayat}")

out = {
    "tanggal": update[-1],
    "update": update,
    "sumber": SRC.replace("\\", "/").split("/")[-1] + " · sheet Monitoring Ind Pegawai",
    "kolom": ["nama", "nip", "jabatan", "area", "kode",
              "eAkuisisi", "eTarget", "eBal", "eTargetBal", "iAkuisisi", "iTarget", "iBal", "iTargetBal"],
    "rows": data,
    "cabang": cabang_out,
}
js = "window.KITO_SALES_PEGAWAI=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
kito_data.tulis_teks_js(OUT, js)
print(f"{len(data)} pegawai, {len({r[4] for r in data})} cabang, update {out['update']} -> {OUT} ({len(js):,} byte)")
