"""Membuat assets/js/pimpinan-data.js: nama Branch Manager dan BOM/BOS per cabang (kartu cabang, tab Cabang).

Pemakaian (dari folder Dashboard-KITO):
    python tools/build_pimpinan.py <BOS-BM.xlsx>

Sheet pertama: kolom "Kode Cabang", "Nama Cabang", "Nama BOM BOS", "Branch Manager" (dicari dari judul kolom).
Nama dirapikan ke huruf kapital di awal kata (data Excel bercampur huruf besar/kecil).
"""
import json
import re
import sys

import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else sys.exit("Pemakaian: python tools/build_pimpinan.py <BOS-BM.xlsx>")
OUT = sys.argv[2] if len(sys.argv) > 2 else "assets/js/pimpinan-data.js"

ws = openpyxl.load_workbook(SRC, read_only=True, data_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
hi = next(i for i, r in enumerate(rows) if any(str(v or "").strip().lower() == "kode cabang" for v in r))
judul = [str(v or "").strip().lower() for v in rows[hi]]
c_kode = judul.index("kode cabang")
c_bom = next(i for i, j in enumerate(judul) if "bom" in j or "bos" in j)
c_bm = judul.index("branch manager")


def nama(v):
    t = re.sub(r"\s+", " ", str(v or "")).strip()
    if not t or t in ("-", "–"):
        return ""
    return " ".join(w[:1].upper() + w[1:].lower() if w.isalpha() or "." not in w else w.upper() for w in t.split(" "))


data = {}
for r in rows[hi + 1:]:
    k = r[c_kode]
    if k is None or str(k).strip() == "":
        continue
    kode = str(int(k)) if isinstance(k, float) else str(k).strip()
    data[kode] = [nama(r[c_bm]), nama(r[c_bom])]          # [Branch Manager, BOM/BOS]

out = {"sumber": SRC.replace("\\", "/").split("/")[-1], "data": data}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.KITO_PIMPINAN=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
kosong_bm = [k for k, v in data.items() if not v[0]]
kosong_bom = [k for k, v in data.items() if not v[1]]
print(f"{len(data)} cabang -> {OUT}; tanpa BM: {kosong_bm}; tanpa BOM/BOS: {kosong_bom}")
