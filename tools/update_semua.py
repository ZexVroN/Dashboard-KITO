"""Satu perintah untuk memperbarui seluruh data harian dashboard KITO dari 3 laporan bankwide.

Pemakaian (dari folder Dashboard-KITO):
    python tools/update_semua.py --antrian <DDMMYYYY_Dashboard_Antrian_Cabang.xlsx> \
        --o2o <Dashboard_Monitoring_Ganti_Kartu_DD_Okt_26.xlsx> \
        --nbds <Monitoring_Utilisasi_NBDS_sd_DD_Oktober_2026.xlsx>

Urutan (penting, karena saling memakai data.js):
    1. update_antrian_o2o.py   -> data.js (antrian, O2O, Shifting), area-waktu, area-kelompok, area-o2o
    2. convert_nbds_bankwide.py -> area-nbds-data.js, data.js (D.M[4..9], D.O)
    3. build_region.py         -> region-data.js (Dashboard Region)
Setelah selesai, naikkan angka ?v= file data di index.html agar browser memuat data baru.
"""

import argparse
import subprocess
import sys

ap = argparse.ArgumentParser()
ap.add_argument("--antrian", required=True)
ap.add_argument("--o2o", required=True)
ap.add_argument("--nbds", required=True)
a = ap.parse_args()

langkah = [
    ["tools/update_antrian_o2o.py", "--antrian", a.antrian, "--o2o", a.o2o],
    ["tools/convert_nbds_bankwide.py", a.nbds],
    ["tools/build_region.py", "--antrian", a.antrian, "--o2o", a.o2o, "--nbds", a.nbds],
]
for cmd in langkah:
    print(">>", cmd[0])
    hasil = subprocess.run([sys.executable] + cmd)
    if hasil.returncode != 0:
        sys.exit(f"Gagal di {cmd[0]}; data berikutnya tidak diproses.")
print("Selesai. Ingat menaikkan ?v= pada file data di index.html.")
