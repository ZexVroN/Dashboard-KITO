"""Nomor HP/WhatsApp Kepala Cabang per cabang -> push-php/data/kontak-kc.php
(HANYA di server: tidak di data/kito.json, tidak di git; hanya ditampilkan untuk akun ROH).

Pemakaian (dari folder Dashboard-KITO):
    python tools/build_kontak_kc.py <Self_Assessment_Aspek_Fisik_Cabang.xlsx>

Sumber: Google Form "Self Assessment Aspek Fisik Cabang" (sheet "Form Responses 1"), kolom
"Kode Cabang", "Nama Cabang", "Nama Kepala Cabang", "No HP" (dicari dari judul kolom, bukan posisi).
- Satu cabang bisa mengisi beberapa kali: dipakai isian TERBARU (Timestamp) yang nomornya valid.
- Kode cabang yang salah ketik (mis. "11406DB", NIP, "1488") dicocokkan lewat nama cabang.
- Nomor dinormalkan: tampilan "0812-3456-7890", WhatsApp "6281234567890".
Hasil diunggah manual ke hosting: push-php/data/kontak-kc.php. Dibaca oleh POST /api/kontak/bom
(lib/kontak.php) dan hanya dikirim ke akun ROH (field "kc").
"""
import json
import os
import re
import sys

import openpyxl

if len(sys.argv) != 2:
    sys.exit(__doc__)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import kito_data  # noqa: E402

OUT = os.path.join(ROOT, "push-php", "data", "kontak-kc.php")
B = {str(b[0]): str(b[1]) for b in kito_data.baca("D")["B"]}
PIMPINAN = (kito_data.baca("KITO_PIMPINAN") or {}).get("data", {})


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


def bersih(t):
    return re.sub(r"\s+", " ", str(t or "")).strip()


def kunci_nama(t):
    t = bersih(t).lower()
    t = re.sub(r"^(kcp|kc|kk|cabang)\s+", "", t)
    return re.sub(r"[^a-z0-9]", "", t)


NAMA_KE_KODE = {}
for kd, nm in B.items():
    NAMA_KE_KODE.setdefault(kunci_nama(nm), kd)


def cari_kode(kode, nama_cab):
    kd = str(int(kode)) if isinstance(kode, float) else bersih(kode)
    if kd in B:
        return kd
    k = kunci_nama(nama_cab)

    def nama_cocok(c):
        n = kunci_nama(B[c])
        return bool(k) and (k == n or (len(n) >= 6 and n in k) or (len(k) >= 6 and k in n))

    # salah ketik kode: "11406DB" -> 11406, "1488" -> 11488 (hanya bila nama cabangnya juga cocok)
    calon = re.findall(r"\d+", kd)
    for c in ([calon[0][:5]] if calon else []) + (["1" + calon[0]] if calon and len(calon[0]) == 4 else []):
        if c in B and nama_cocok(c):
            return c
    if k:
        cocok = [c for c in B if nama_cocok(c)]
        if len(cocok) == 1:
            return cocok[0]
    return None


ws = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)["Form Responses 1"]
it = ws.iter_rows(values_only=True)
hdr = [bersih(h).lower() for h in next(it)]


def kol(*nama):
    for n in nama:
        if n in hdr:
            return hdr.index(n)
    sys.exit(f"Kolom {nama} tidak ditemukan di sheet Form Responses 1")


I_TS, I_KD, I_CAB = kol("timestamp"), kol("kode cabang"), kol("nama cabang")
I_NKC, I_HP = kol("nama kepala cabang"), kol("no hp")

data, waktu, gagal_kode, gagal_no = {}, {}, [], []
for r in it:
    if not r or not any(r):
        continue
    kd = cari_kode(r[I_KD], r[I_CAB])
    if not kd:
        gagal_kode.append((r[I_KD], bersih(r[I_CAB])))
        continue
    n = nomor(r[I_HP])
    if not n:
        gagal_no.append(kd)
        continue
    ts = r[I_TS]
    if kd in waktu and ts is not None and waktu[kd] is not None and ts < waktu[kd]:
        continue
    nama = bersih(r[I_NKC])
    nama = " ".join(w.capitalize() if (w.islower() or w.isupper()) and len(w) > 2 else w for w in nama.split())
    data[kd], waktu[kd] = [nama, n[0], n[1]], ts

data = dict(sorted(data.items()))
php = ("<?php\n/* Nomor HP Kepala Cabang per cabang: kode => [nama, nomor tampilan, nomor WhatsApp]. "
       "Dibuat tools/build_kontak_kc.py.\n   RAHASIA: hanya untuk akun ROH. Jangan di-commit, jangan disalin ke data/kito.json. */\nreturn "
       + json.dumps(data, ensure_ascii=False, indent=0).replace("{", "[").replace("}", "]").replace('":', '" =>').replace("$", "\\$")
       + ";\n")
with open(OUT, "w", encoding="utf-8") as f:
    f.write(php)

beda = [kd for kd, v in data.items() if PIMPINAN.get(kd) and PIMPINAN[kd][0]
        and kunci_nama(PIMPINAN[kd][0])[:6] != kunci_nama(v[0])[:6]]
print(f"{len(data)} dari {len(B)} cabang punya nomor Kepala Cabang -> {os.path.relpath(OUT, ROOT)}")
print("cabang tanpa isian:", sorted(set(B) - set(data)) or "tidak ada")
if gagal_kode:
    print("kode/nama cabang tidak dikenali:", gagal_kode)
if gagal_no:
    print("nomor tidak valid:", gagal_no)
print(f"nama Kepala Cabang di form berbeda dengan Branch Manager di dashboard: {len(beda)} cabang (nama dari form ikut ditampilkan)")
