"""Membuat data/kito.json [KITO_DTI] (menu "DTI Dana & Cendup" di halaman Cabang) dari
"Dashboard dan Data Detail NTB <tgl>.xlsx".

Pemakaian (dari folder Dashboard-KITO):
    python tools/build_dti.py <Dashboard_dan_Data_Detail_NTB_....xlsx>

Sheet yang dibaca:
    Cabang                       : DTI Score 2026 + progres NTB/ETB (Data Error CIF Dana, D01 Slik emas,
                                   Cendup Weekly) + User SSIM per cabang (baris area = kode 3 digit)
    Area                         : ringkasan yang sama per area + baris total Region II
    CIF Dana NTB Bulan Berjalan  : detail error CIF nasabah baru (disimpan per baris)
    CIF Dana ETB.                : detail error CIF nasabah lama (± 81 ribu baris -> diringkas per cabang)
    Cendup NTB Bulan Berjalan    : detail CIF duplikat nasabah baru (per baris)
    Cendup ETB                   : detail CIF duplikat nasabah lama (per baris)
    USER SSIM R2                 : user SSIM per cabang

Data pribadi: nama nasabah, KD_DUPLIKASI (berisi nama + tanggal lahir) dan nomor ID TIDAK diekspor.
No CIF dan NIP disamarkan (******1234). Grup duplikat diganti kode pendek hasil hash KD_DUPLIKASI.
"""

import hashlib
import json
import re
import sys
from collections import Counter, defaultdict

import openpyxl

import kito_data  # data/kito.json

SRC = sys.argv[1] if len(sys.argv) > 1 else sys.exit("Pemakaian: python tools/build_dti.py <xlsx>")
OUT = sys.argv[2] if len(sys.argv) > 2 else "KITO_DTI"
TARGET_DTI = 98.5

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)


def num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        try:
            v = float(str(v).strip())
        except (TypeError, ValueError):
            return None
    v = round(float(v), 4)
    return int(v) if v.is_integer() else v


def kode(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip() if v not in (None, "") else ""


def samar(v):
    s = re.sub(r"\D", "", str(v or ""))
    return "******" + s[-4:] if len(s) >= 4 else ""


def iso(v):
    s = re.sub(r"\D", "", str(v or ""))[:8]
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) == 8 else None


def teks(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def pesan(v):
    """Pesan error dirapikan: kode/nomor unik di ujung pesan (mis. 'KD0490025905') dibuang
    supaya pesan sejenis terhitung satu jenis, dan tidak ada nomor identitas yang ikut terekspor."""
    t = re.sub(r"\b[A-Z]{0,3}\d{6,}\b", "", teks(v))
    return re.sub(r"\s+", " ", t).strip(" :;,-")


# ---------- kamus teks berulang (hemat ukuran file) ----------
KAMUS = []
_idx = {}


def k(t):
    t = teks(t)
    if t not in _idx:
        _idx[t] = len(KAMUS)
        KAMUS.append(t)
    return _idx[t]


# ---------- 1. ringkasan per cabang / area ----------
def pasang(r, i):
    return [num(r[i]), num(r[i + 1])]


cabang, area_kode = {}, {}
area_skrg = None
for r in wb["Cabang"].iter_rows(min_row=4, values_only=True):
    r = list(r) + [None] * 40
    nama, kd = teks(r[1]), kode(r[2])
    if not nama or not kd:
        continue
    if len(kd) <= 3:                       # baris area
        area_skrg = nama
        area_kode[nama] = kd
        continue
    cabang[kd] = {
        "rk": num(r[0]), "n": nama, "a": area_skrg, "kls": teks(r[3]),
        "dti": [num(r[5]), num(r[6]), num(r[7]), num(r[8])],     # ETB, terkini, sebelumnya, September
        "ntb": {"err": pasang(r, 12), "slik": pasang(r, 15), "cd": pasang(r, 18)},
        "etb": {"err": pasang(r, 25), "cd": pasang(r, 28)},
        "ssim": [num(r[35]), num(r[36])],
    }

area = {}
for r in wb["Area"].iter_rows(min_row=4, values_only=True):
    r = list(r) + [None] * 45
    nama = teks(r[1])
    key = nama or "REGION II"
    if not nama and num(r[6]) is None:
        continue
    area[key] = {
        "rk": num(r[0]), "kd": area_kode.get(nama, ""),
        "dti": [num(r[5]), num(r[6]), num(r[7]), num(r[8])],
        "ntb": {"err": pasang(r, 12), "slik": pasang(r, 15), "cd": pasang(r, 18)},
        "etb": {"err": pasang(r, 25), "cd": [num(r[31]), num(r[32])]},
        "ssim": [num(r[38]), num(r[39])],
    }


def baris(sheet):
    it = wb[sheet].iter_rows(values_only=True)
    h = [teks(x) for x in next(it)]
    for r in it:
        if any(v is not None for v in r):
            yield dict(zip(h, r))


# ---------- 2. CIF Dana NTB (per baris) ----------
ntb, tgl_data = defaultdict(list), set()
for d in baris("CIF Dana NTB Bulan Berjalan"):
    kd = kode(d["KD_CABANG"])
    tgl_data.add(iso(d["TGL_DATA"]))
    errs = list(dict.fromkeys(k(pesan(e)) for e in str(d["ERROR_MSG"] or "").split(";") if pesan(e)))
    ntb[kd].append([samar(d["NO_CIF"]), teks(d["CFCLAS"]), iso(d["TGL_BUKA"]), errs,
                    num(d["umur_data_error"]), k(d["CFVUSR"]), 1 if teks(d["Progress"]) == "Done" else 0])

# ---------- 3. CIF Dana ETB (ringkasan per cabang) ----------
etb = defaultdict(lambda: {"th": defaultdict(lambda: [0, 0]), "err": Counter(), "umur": Counter(), "ch": Counter()})
UMUR = [(0, "0 hari"), (30, "1–30 hari"), (90, "31–90 hari"), (10 ** 9, "> 90 hari")]
for d in baris("CIF Dana ETB."):
    kd = kode(d["KD_CABANG"])
    e = etb[kd]
    done = teks(d["Progress"]) == "Done"
    th = teks(d["STATUS_CIF"]).split(":")[-1].strip() or "–"
    e["th"][th][0 if done else 1] += 1
    if not done:
        for x in {pesan(x) for x in str(d["ERROR_MSG"] or "").split(";")}:
            if x:
                e["err"][x] += 1
        u = num(d["umur_data_error"]) or 0
        e["umur"][next(i for i, (b, _) in enumerate(UMUR) if u <= b)] += 1
        e["ch"][k(d["CFVUSR"])] += 1
etb_out = {}
for kd, e in etb.items():
    etb_out[kd] = {
        "th": {t: v for t, v in sorted(e["th"].items())},
        "err": [[k(t), n] for t, n in e["err"].most_common(12)], "errLain": sum(e["err"].values()) - sum(n for _, n in e["err"].most_common(12)),
        "umur": [e["umur"].get(i, 0) for i in range(len(UMUR))],
        "ch": e["ch"].most_common(),
    }

# ---------- 4. Cendup NTB & ETB (per baris) ----------
def grup(v):
    return hashlib.sha1(str(v or "").encode()).hexdigest()[:5].upper() if v else ""


cendup = {"ntb": defaultdict(list), "etb": defaultdict(list)}
tgl_cd = set()
for key, sheet in (("ntb", "Cendup NTB Bulan Berjalan"), ("etb", "Cendup ETB")):
    for d in baris(sheet):
        kd = kode(d["KD_CABANG"])
        tgl_cd.add(iso(d["Tgl_Proses"]))
        ket = teks(d["KETERANGAN"]).replace("Field yang sama :", "").strip(" ,")
        cendup[key][kd].append([samar(d["CIF"]), grup(d["KD_DUPLIKASI"]), teks(d["JNS_NASABAH"]), iso(d["CREATE_DATE"]),
                                num(d["JMLH_DUPLIKAT"]), k(ket), k(d["SOURCE"]), num(d["umur_data"]),
                                1 if teks(d["Progress"]) == "Done" else 0])

# ---------- 5. User SSIM ----------
ssim = defaultdict(list)
for d in baris("USER SSIM R2"):
    kd = kode(d["KD_CABANG"])
    if not kd:
        continue
    ssim[kd].append([teks(d["USER"]), samar(d["NIP"]), teks(d["POSITION"]), teks(d["USER_TYPE"]), str(d["CREATED"] or "")[:10]])

# ---------- 6. cek konsistensi ringkasan vs detail ----------
cek = Counter()
for kd, c in cabang.items():
    rows = ntb.get(kd, [])
    if [sum(r[6] for r in rows), len(rows)] != c["ntb"]["err"]:
        cek["ntb err"] += 1
    for key in ("ntb", "etb"):
        rows = cendup[key].get(kd, [])
        if [sum(r[8] for r in rows), len(rows)] != c[key]["cd"]:
            cek[f"{key} cendup"] += 1
    e = etb_out.get(kd)
    if e and [sum(v[0] for v in e["th"].values()), sum(sum(v) for v in e["th"].values())] != c["etb"]["err"]:
        cek["etb err"] += 1

out = {
    "periode": {"ntb": max(t for t in tgl_data if t), "cendup": max(t for t in tgl_cd if t)},
    "targetDti": TARGET_DTI,
    "sumber": SRC.replace("\\", "/").split("/")[-1],
    "umur": [u for _, u in UMUR],
    "kamus": KAMUS,
    "cabang": cabang, "area": area,
    "ntb": ntb, "etb": etb_out, "cendup": cendup, "ssim": ssim,
}
js = "window.KITO_DTI=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
kito_data.tulis_teks_js(OUT, js)
print(f"{len(cabang)} cabang, {len(area)} area/region, NTB {sum(map(len, ntb.values()))} baris, "
      f"Cendup NTB {sum(map(len, cendup['ntb'].values()))} / ETB {sum(map(len, cendup['etb'].values()))}, "
      f"user SSIM {sum(map(len, ssim.values()))}, kamus {len(KAMUS)} -> {OUT} ({len(js):,} byte)")
print("Cabang yang ringkasannya tidak sama dengan detail:", dict(cek) or "tidak ada")
