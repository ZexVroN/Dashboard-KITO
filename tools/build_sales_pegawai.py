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

Penyesuaian manual (tools/sales_penyesuaian.json, atau --penyesuaian <file>): pegawai di daftar "takeout" dibuang,
pegawai di daftar "pindah" dipindah ke kode cabang "ke", pegawai di daftar "jabatan" diganti jabatannya dan target +
target balance Ekstensifikasi/Intensifikasi-nya mengikuti standar jabatan baru (akuisisi & balance tetap). Diterapkan sebelum riwayat dicocokkan dan sebelum total
per cabang dihitung, jadi target & pencapaian cabang ikut menyesuaikan. Entri yang tidak ditemukan di laporan
dicetak sebagai PERINGATAN (mis. Excel sudah memperbarui datanya, entri boleh dihapus).
"""

import datetime as dt
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
ap.add_argument("--penyesuaian", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "sales_penyesuaian.json"),
                help="daftar takeout / pindah cabang pegawai (bawaan: tools/sales_penyesuaian.json)")
A = ap.parse_args()
SRC, OUT = A.xlsx, A.out
BULAN = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "mei": 5, "jun": 6, "jul": 7, "agu": 8, "agt": 8,
         "sep": 9, "okt": 10, "nov": 11, "des": 12}

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
# tahun untuk judul kolom tanpa tahun ("Akuisisi update 01 Nov"): ambil dari nama file / judul sheet pegawai
_m = re.search(r"(20\d{2})", os.path.basename(SRC))
SRC_TAHUN = (_m.group(1)[2:] if _m else "26")
# Dua format laporan:
#   lama : "Dashboard Sales Inbranch ..." -> sheet "Monitoring Ind Pegawai" (+ "Monitoring Cabang (All)")
#   baru : "Report Inbranch MTD - <tgl>"  -> sheet "By Individual Peg" (bankwide, disaring Region II)
#          + "Series New CIF" / "Series Add On" (akuisisi kumulatif per cabang per tanggal)
#          Ekstensifikasi = New CIF, Intensifikasi = New Acc ETB / Add On. Balance = Balance Rekening,
#          target balance = Target / Bln (sama dengan dasar kolom Achievement di laporan).
FORMAT_MTD = "Monitoring Ind Pegawai" not in wb.sheetnames and "By Individual Peg" in wb.sheetnames
REGION = "02"
ws = wb["By Individual Peg" if FORMAT_MTD else "Monitoring Ind Pegawai"]
rows = list(ws.iter_rows(min_row=1, values_only=True))
blok_baris, judul = (rows[8], rows[9]) if FORMAT_MTD else (rows[2], rows[4])

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

def iso_tgl(v):
    return v.date().isoformat() if hasattr(v, "date") else None

if FORMAT_MTD:
    def kj(pola, dari=0, sampai=None):
        sampai = sampai or len(judul)
        return next(i for i in range(dari, sampai) if judul[i] and re.search(pola, str(judul[i]).strip(), re.I))
    c_reg, c_nama, c_nip, c_jab = kj(r"^reg$"), kj(r"^nama pegawai"), kj(r"^nip$"), kj(r"^jabatan$")
    c_area, c_kode = kj(r"^kode area$"), kj(r"^kode cabang$")
    # tanggal laporan (D) dan D-1: sheet ringkasan region, sel C3 / C4
    ring = list(wb[wb.sheetnames[0]].iter_rows(min_row=3, max_row=4, values_only=True))
    TGL_D, TGL_D1 = iso_tgl(ring[0][2]), iso_tgl(ring[1][2])
    a_e = next(i for i, v in enumerate(blok_baris) if isinstance(v, str) and re.match(r"^akuisisi new cif \(mtd\)", v.strip(), re.I))
    a_i = next(i for i, v in enumerate(blok_baris) if isinstance(v, str) and re.match(r"^aku[s]?isi new acc etb", v.strip(), re.I))
    b_i = next(i for i, v in enumerate(blok_baris) if isinstance(v, str) and i > a_i)
    BL = {}
    for key, a, b, pbal in (("e", a_e, a_i, r"^balance rekening new cif"), ("i", a_i, b_i, r"^balance rekening etb")):
        BL[key] = {"akuisisi": [kj(r"^akuisisi \(day before\)", a, b), kj(r"^akuisisi$", a, b)],
                   "tgl": [TGL_D1, TGL_D], "target": kj(r"^target$", a, b), "bal": kj(pbal, a, b),
                   "tbal": kj(r"^target / bln", a, b)}
    print(f"Format Report Inbranch MTD · tanggal {TGL_D} (D-1 {TGL_D1}) · Region {REGION}")
    rows_peg = [r for r in rows[12:] if r[c_nama] and str(r[c_reg]).strip() == REGION]
else:
    rows_peg = None
BL = BL if FORMAT_MTD else {}
for key, nama in (() if FORMAT_MTD else (("e", "EKSTENSIFIKASI"), ("i", "INTENSIFIKASI"))):
    akuisisi = kol(nama, r"^akuisisi update", semua=True)
    BL[key] = {
        "akuisisi": akuisisi,
        "tgl": [tanggal(judul[i]) for i in akuisisi],
        "target": kol(nama, r"^target (eksten|inten)$"),
        "bal": kol(nama, r"^bal( inten)?$"),
        "tbal": kol(nama, r"^target bal"),
    }

if not FORMAT_MTD:
    P = "PROFILE PEGAWAI INBRANCH"
    c_nama, c_nip, c_jab = kol(P, r"^nama pegawai"), kol(P, r"^nip$"), kol(P, r"^jabatan")
    c_area, c_kode = kol(P, r"^area"), kol(P, r"^kode cabang")
    rows_peg = [r for r in rows[5:] if r[c_nama]]


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

# ---------- penyesuaian manual (takeout / pindah cabang) ----------
def _cocok(aturan, nama, kd):
    return aturan["nama"].strip().upper() == nama.upper() and (not aturan.get("dari") or str(aturan["dari"]) == kd)

ATUR = {"takeout": [], "pindah": [], "jabatan": []}
if A.penyesuaian and os.path.exists(A.penyesuaian):
    with open(A.penyesuaian, encoding="utf-8") as f:
        ATUR.update(json.load(f))
    print(f"Penyesuaian: {A.penyesuaian} · takeout {len(ATUR['takeout'])} · pindah {len(ATUR['pindah'])} · jabatan {len(ATUR['jabatan'])}")
dipakai = set()

# ---------- laporan baru ----------
pegawai = []
for r in rows_peg:
    p = {"id": [str(r[c_nama]).strip(), samar(r[c_nip]), str(r[c_jab] or "").strip(), kode(r[c_area]), kode(r[c_kode])]}
    nm, kd = p["id"][0], p["id"][4]
    t = next((i for i, a in enumerate(ATUR["takeout"]) if _cocok(a, nm, kd)), None)
    if t is not None:
        dipakai.add(("takeout", t))
        print(f"  takeout: {nm} ({kd})")
        continue
    pi = next((i for i, a in enumerate(ATUR["pindah"]) if _cocok(a, nm, kd)), None)
    if pi is not None:
        dipakai.add(("pindah", pi))
        p["id"][4] = str(ATUR["pindah"][pi]["ke"])
        print(f"  pindah : {nm} {kd} -> {p['id'][4]}")
    ji = next((i for i, a in enumerate(ATUR["jabatan"]) if _cocok(a, nm, kd)), None)
    if ji is not None:
        dipakai.add(("jabatan", ji))
        print(f"  jabatan: {nm} ({kd}) {p['id'][2]} -> {ATUR['jabatan'][ji]['jabatan']}")
        p["id"][2] = ATUR["jabatan"][ji]["jabatan"]
        p["ubah_jabatan"] = True
    for key in ("e", "i"):
        b = BL[key]
        p[key] = {"seri": dict(zip(b["tgl"], (num(r[i]) for i in b["akuisisi"]))),
                  "sisa": [num(r[b["target"]]), num(r[b["bal"]]), num(r[b["tbal"]])]}
    pegawai.append(p)
# ubah jabatan: target & target balance ikut standar jabatan baru (nilai terbanyak pegawai lain dengan jabatan itu
# di laporan yang sama); akuisisi & balance tetap pencapaian pegawai tersebut
if any(p.get("ubah_jabatan") for p in pegawai):
    from collections import Counter
    standar = {}
    for p in pegawai:
        if not p.get("ubah_jabatan"):
            standar.setdefault(p["id"][2], Counter())[(p["e"]["sisa"][0], p["e"]["sisa"][2], p["i"]["sisa"][0], p["i"]["sisa"][2])] += 1
    for p in pegawai:
        if p.pop("ubah_jabatan", False):
            s = standar.get(p["id"][2])
            if not s:
                print(f"  PERINGATAN jabatan: tidak ada pegawai lain berjabatan '{p['id'][2]}', target {p['id'][0]} tidak diubah")
                continue
            (p["e"]["sisa"][0], p["e"]["sisa"][2], p["i"]["sisa"][0], p["i"]["sisa"][2]), n = s.most_common(1)[0]
            print(f"           target {p['id'][0]} -> eksten {p['e']['sisa'][0]} (bal {p['e']['sisa'][2]}) · inten {p['i']['sisa'][0]} (bal {p['i']['sisa'][2]})"
                  f" · standar {n} pegawai {p['id'][2]}")
for jenis in ("takeout", "pindah", "jabatan"):
    for i, a in enumerate(ATUR[jenis]):
        if (jenis, i) not in dipakai:
            print(f"  PERINGATAN {jenis}: '{a['nama']}'" + (f" (cabang {a['dari']})" if a.get("dari") else "")
                  + " tidak ditemukan di laporan (sudah pindah/keluar di Excel? hapus dari daftar)")
# daftar induk (hanya acuan, tidak menyaring): bandingkan dengan laporan setelah takeout/pindah
if ATUR.get("pegawai"):
    induk = {(str(a["kode"]), a["nama"].strip().upper()) for a in ATUR["pegawai"]}
    induk |= {(str(a["ke"]), a["nama"].strip().upper()) for a in ATUR["pindah"]}
    lap = {(p["id"][4], p["id"][0].upper()) for p in pegawai}
    for k, n in sorted(lap - induk):
        print(f"  INFO pegawai baru / pindah cabang (tidak ada di daftar induk): {n} ({k})")
    for k, n in sorted(induk - lap):
        print(f"  INFO pegawai daftar induk tidak ada di laporan: {n} ({k})")

# ---------- total per cabang (sheet "Monitoring Cabang (All)") ----------
cab_seri = {}                     # kode -> {"e": {tgl: n}, "i": {tgl: n}}
if FORMAT_MTD:
    # akuisisi kumulatif MTD per cabang per tanggal (blok pertama "Akuisisi ... All"), hanya s.d. tanggal laporan
    for key, sh in (("e", "Series New CIF"), ("i", "Series Add On")):
        if sh not in wb.sheetnames:
            continue
        sr = list(wb[sh].iter_rows(min_row=1, values_only=True))
        sj = sr[3]
        kolt = [(i, iso_tgl(v)) for i, v in enumerate(sj) if iso_tgl(v)]
        a0 = kolt[0][0]
        kolt = [(i, t) for i, t in kolt if i < a0 + 32 and t <= TGL_D]
        for r in sr[5:]:
            if len(r) < 5 or str(r[3]).replace(" ", "") != "R" + REGION:
                continue
            cab_seri.setdefault(kode(r[0]), {"e": {}, "i": {}})[key] = {t: num(r[i]) for i, t in kolt}
    print(f"Sheet Series New CIF / Add On: {len(cab_seri)} cabang Region II, tanggal s.d. {TGL_D}")
elif "Monitoring Cabang (All)" in wb.sheetnames:
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
# Sabtu/Minggu tidak ditampilkan (laporan seri harian memuat akhir pekan dengan nilai kumulatif yang sama),
# kecuali hari kerja yang tersedia kurang dari jumlah tampil
_kerja = sorted(t for t in semua if dt.date.fromisoformat(t).weekday() < 5)
update = (_kerja if len(_kerja) >= A.tampil else sorted(semua))[-A.tampil:]
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
    "sumber": SRC.replace("\\", "/").split("/")[-1] + (" · sheet By Individual Peg (Region II)" if FORMAT_MTD else " · sheet Monitoring Ind Pegawai"),
    "kolom": ["nama", "nip", "jabatan", "area", "kode",
              "eAkuisisi", "eTarget", "eBal", "eTargetBal", "iAkuisisi", "iTarget", "iBal", "iTargetBal"],
    "rows": data,
    "cabang": cabang_out,
}
js = "window.KITO_SALES_PEGAWAI=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
kito_data.tulis_teks_js(OUT, js)
print(f"{len(data)} pegawai, {len({r[4] for r in data})} cabang, update {out['update']} -> {OUT} ({len(js):,} byte)")
