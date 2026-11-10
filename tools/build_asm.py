"""Membuat data/kito.json [KITO_ASM]: nama ASM & SQO Area per area dan SQO Region per region
(halaman Area dan pilihan nama pengguna di login dashboard).

Pemakaian (dari folder Dashboard-KITO):
    python tools/build_asm.py <asm.xlsx>

Sheet pertama, kolom dicari dari judul: "Area", "SQO" (jabatan: ASM / SQO Area / SQO Region), "Nama".
Hasil: data[kunci area] = {area, nama (ASM), sqoa (SQO Area)} · sqor = [{region, area, nama}].
Kolom "Region" dipakai untuk SQO Region. Nomor HP sengaja tidak diekspor.
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
c_reg = judul.index("region") if "region" in judul else None

kunci = lambda s: re.sub(r"[^A-Z0-9]", "", re.sub(r"^\s*AREA\s+", "", str(s or "").upper()))
asm, sqor = {}, []
rapi = lambda v: re.sub(r"\s+", " ", str(v or "")).strip()
for r in rows[hi + 1:]:
    jab = rapi(r[c_jab]).upper()
    if not r[c_nama] or jab not in ("ASM", "SQO AREA", "SQO REGION"):
        continue
    if jab == "SQO REGION":
        sqor.append({"region": rapi(r[c_reg]) if c_reg is not None else "", "area": rapi(r[c_area]), "nama": rapi(r[c_nama])})
        continue
    x = asm.setdefault(kunci(r[c_area]), {"area": rapi(r[c_area])})
    x["nama" if jab == "ASM" else "sqoa"] = rapi(r[c_nama])

kito_data.tulis(OUT, {"sumber": SRC.replace("\\", "/").split("/")[-1], "data": asm, "sqor": sqor})
print(f"{sum('nama' in v for v in asm.values())} ASM, {sum('sqoa' in v for v in asm.values())} SQO Area, {len(sqor)} SQO Region -> {OUT}")
for v in asm.values():
    print(f"  {v['area']}: ASM {v.get('nama', '-')} · SQO Area {v.get('sqoa', '-')}")
for v in sqor:
    print(f"  {v['region']}: SQO Region {v['nama']}")
