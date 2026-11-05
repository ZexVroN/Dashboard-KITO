"""Membuat data/kito.json [KITO_ASM]: nama Area Service Manager (ASM) per area untuk halaman Area.

Pemakaian (dari folder Dashboard-KITO):
    python tools/build_asm.py <asm.xlsx>

Sheet pertama, kolom dicari dari judul: "Area", "SQO" (jabatan: ASM / SQO Area / SQO Region), "Nama".
Yang diambil hanya jabatan ASM. Nomor HP sengaja tidak diekspor.
"""
import json
import re
import sys

import openpyxl

import kito_data  # data/kito.json

SRC = sys.argv[1] if len(sys.argv) > 1 else sys.exit("Pemakaian: python tools/build_asm.py <asm.xlsx>")
OUT = sys.argv[2] if len(sys.argv) > 2 else "KITO_ASM"

ws = openpyxl.load_workbook(SRC, read_only=True, data_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
hi = next(i for i, r in enumerate(rows) if any(str(v or "").strip().lower() == "nama" for v in r))
judul = [str(v or "").strip().lower() for v in rows[hi]]
c_area, c_jab, c_nama = judul.index("area"), judul.index("sqo"), judul.index("nama")

kunci = lambda s: re.sub(r"[^A-Z0-9]", "", re.sub(r"^\s*AREA\s+", "", str(s or "").upper()))
asm = {}
for r in rows[hi + 1:]:
    if str(r[c_jab] or "").strip().upper() != "ASM" or not r[c_nama]:
        continue
    asm[kunci(r[c_area])] = {"area": str(r[c_area]).strip(), "nama": re.sub(r"\s+", " ", str(r[c_nama])).strip()}

kito_data.tulis(OUT, {"sumber": SRC.replace("\\", "/").split("/")[-1], "data": asm})
print(f"{len(asm)} ASM -> {OUT}: " + ", ".join(f"{v['area']}={v['nama']}" for v in asm.values()))
