"""Membuat assets/js/sales-pegawai-data.js dari "Dashboard_Sales_Inbranch_R2*.xlsx" (sheet "Monitoring Ind Pegawai").

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
"""

import json
import re
import sys

import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else sys.exit("Pemakaian: python tools/build_sales_pegawai.py <xlsx>")
OUT = sys.argv[2] if len(sys.argv) > 2 else "assets/js/sales-pegawai-data.js"
BULAN = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "mei": 5, "jun": 6, "jul": 7, "agu": 8, "agt": 8,
         "sep": 9, "okt": 10, "nov": 11, "des": 12}

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
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
assert BL["e"]["tgl"] == BL["i"]["tgl"], "tanggal update Ekstensifikasi dan Intensifikasi berbeda"

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

data = []
for r in rows[5:]:
    if not r[c_nama]:
        continue
    row = [str(r[c_nama]).strip(), samar(r[c_nip]), str(r[c_jab] or "").strip(), kode(r[c_area]), kode(r[c_kode])]
    for key in ("e", "i"):
        b = BL[key]
        row += [[num(r[i]) for i in b["akuisisi"]], num(r[b["target"]]), num(r[b["bal"]]), num(r[b["tbal"]])]
    data.append(row)

out = {
    "tanggal": BL["e"]["tgl"][-1],
    "update": BL["e"]["tgl"],
    "sumber": SRC.replace("\\", "/").split("/")[-1] + " · sheet Monitoring Ind Pegawai",
    "kolom": ["nama", "nip", "jabatan", "area", "kode",
              "eAkuisisi", "eTarget", "eBal", "eTargetBal", "iAkuisisi", "iTarget", "iBal", "iTargetBal"],
    "rows": data,
}
js = "window.KITO_SALES_PEGAWAI=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write(js)
print(f"{len(data)} pegawai, {len({r[4] for r in data})} cabang, update {out['update']} -> {OUT} ({len(js):,} byte)")
