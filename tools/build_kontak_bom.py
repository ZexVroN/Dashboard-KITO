"""Nomor HP BOM/BOS per cabang -> push-php/data/kontak-bom.php (HANYA di server, tidak di data/kito.json, tidak di git).

Pemakaian (dari folder Dashboard-KITO):
    python tools/build_kontak_bom.py <BOMdanBOS.xlsx>

Excel: kolom A Kode Cabang, E Nama BOM/BOS, F No Contact (data mulai baris 4). Nomor dinormalkan:
tampilan "0812-3456-7890", WhatsApp "6281234567890"; isian bukan nomor ("BOS", "-") dilewati.
Hasil diunggah manual ke hosting: push-php/data/kontak-bom.php (folder data ditolak untuk akses langsung,
dan berkas .php tidak menampilkan isi bila dibuka). Dibaca oleh POST /api/kontak/bom (lib/kontak.php):
hanya ROH & SQO Region (seluruh Region II) serta ASM & SQO Area (hanya cabang di areanya).
"""
import json
import os
import re
import sys

import openpyxl

if len(sys.argv) != 2:
    sys.exit(__doc__)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "push-php", "data", "kontak-bom.php")
kode_r2 = {str(b[0]) for b in json.load(open(os.path.join(ROOT, "data", "kito.json"), encoding="utf-8"))["D"]["B"]}


def nomor(v):
    s = re.sub(r"\D", "", str(int(v)) if isinstance(v, float) else str(v or ""))
    if s.startswith("62"):
        s = "0" + s[2:]
    elif s.startswith("8"):
        s = "0" + s
    if not re.fullmatch(r"08\d{8,11}", s):
        return None
    tampil = "-".join([s[:4], s[4:8], s[8:]]) if len(s) > 8 else s
    return tampil, "62" + s[1:]


ws = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True).active
data, lewat, luar = {}, [], []
for r in ws.iter_rows(min_row=4, values_only=True):
    if not r or r[0] is None:
        continue
    kode = str(r[0]).strip().split(".")[0]
    if kode not in kode_r2:
        luar.append(kode)
        continue
    nama = re.sub(r"\s+", " ", str(r[4] or "")).strip()
    if nama.lower() in ("(belum ada data)", "-", "bom", "bos"):
        nama = ""
    n = nomor(r[5] if len(r) > 5 else None)
    if not n:
        lewat.append(kode)
        continue
    data[kode] = [nama, n[0], n[1]]

php = "<?php\n/* Nomor HP BOM/BOS per cabang: kode => [nama, nomor tampilan, nomor WhatsApp]. Dibuat tools/build_kontak_bom.py.\n   RAHASIA: jangan di-commit, jangan disalin ke data/kito.json. */\nreturn " + json.dumps(data, ensure_ascii=False, indent=0).replace("{", "[").replace("}", "]").replace('":', '" =>').replace('$', '\\$') + ";\n"
with open(OUT, "w", encoding="utf-8") as f:
    f.write(php)
print(f"{len(data)} cabang dengan nomor -> {os.path.relpath(OUT, ROOT)}")
print(f"tanpa nomor valid: {len(lewat)} {lewat}" + (f" · bukan Region II: {luar}" if luar else ""))
