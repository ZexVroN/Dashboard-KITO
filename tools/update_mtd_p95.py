"""MTD waktu antri P95 (mulai November 2026) untuk navigasi Area.

Pemakaian (dari folder Dashboard-KITO):
    python tools/update_mtd_p95.py <DDMMYYYY_Dashboard_Antrian_Cabang.xlsx>

Dipanggil otomatis oleh update_harian_p95.py; bisa dijalankan sendiri.

Yang ditulis (kunci "mb" = MTD per bulan "YYYY-MM", P95; MTD Oktober tetap P90 di "m"/"mtd"):
  KITO_AREA_WAKTU    : areas[].mb / region.mb = rata-rata P95 harian bulan itu [.., Teller(2), .., .., CS(5), All(6)]
                       (rata-rata nilai harian di data, sama dengan definisi "Average ... P95" di laporan cabang)
  KITO_REGION        : regions[].waktu.mb / nasional.waktu.mb = rata-rata P95 harian [Teller, CS, All]
  KITO_AREA_KELOMPOK : [].mb = {teller, cs, all} dari kolom "MTD <Bulan> 26 (... P95)" sheet cabang laporan antrian
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import openpyxl  # noqa: E402

import kito_data  # noqa: E402
from update_harian_p95 import BULAN_PANJANG, detik  # noqa: E402

JS = "assets/js/"


def _rata(vals):
    v = [x for x in vals if x is not None]
    return round(sum(v) / len(v), 1) if v else None


def mtd_area(W):
    """Isi mb untuk setiap bulan yang punya tanggal P95 di KITO_AREA_WAKTU. Kembalikan daftar bulan."""
    mb_metrik = W.get("metricByDate", {})
    bulan = sorted({t[:7] for t, m in mb_metrik.items() if m == "P95" and t >= "2026-11-01"})
    for b in bulan:
        tgl = [t for t in W["dates"] if t.startswith(b) and mb_metrik.get(t) == "P95"]
        for ent in W["areas"] + [W["region"]]:
            mb = ent.setdefault("mb", {})
            baris = [None] * 7
            for i in (2, 5, 6):
                baris[i] = _rata([(ent["d"].get(t) or [None] * 7)[i] for t in tgl])
            mb[b] = baris
    return bulan


def mtd_region(R, bulan):
    """waktu.mb[bulan] = rata-rata P95 harian [Teller, CS, All] untuk 12 region + nasional."""
    qm = R.get("queueMetricByDate", {})
    for b in bulan:
        tgl = [t for t in R["tglWaktu"] if t.startswith(b) and qm.get(t) == "P95"]
        for e in R["regions"] + [R["nasional"]]:
            w = e["waktu"]
            w.setdefault("mb", {})[b] = [_rata([(w["d"].get(t) or [None] * 3)[i] for t in tgl]) for i in range(3)]


def mtd_cabang(path, K, bulan):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    nama = next(n for n in wb.sheetnames if n not in ("Area", "RAW"))
    ws = wb[nama]
    judul = list(ws.iter_rows(min_row=3, max_row=3, values_only=True))[0]
    kol = {}
    for j, x in enumerate(judul):
        m = isinstance(x, str) and re.match(r"MTD ([A-Za-z]+) (\d{2})\b.*P95", x)
        if m and m.group(1).lower() in BULAN_PANJANG:
            kol[f"20{m.group(2)}-{BULAN_PANJANG[m.group(1).lower()]:02d}"] = j
    # urutan kolom per blok: Antrian, P100, P95, club | Antrian(+5), P100, P95 CS | Antrian(+10), P100, P95 All
    off = {"teller": 2, "cs": 7, "all": 12}
    per_kode = {str(r["kode"]): r for r in K}
    n = 0
    for r in ws.iter_rows(min_row=7, values_only=True):
        kode = str(r[1]) if r[1] is not None else None
        if kode not in per_kode:
            continue
        for b in bulan:
            if b not in kol:
                continue
            per_kode[kode].setdefault("mb", {})[b] = {k: detik(r[kol[b] + o]) for k, o in off.items()}
        n += 1
    return n, sorted(kol)


def terapkan(path):
    W = kito_data.baca(JS + "area-waktu-data.js")
    K = kito_data.baca(JS + "area-kelompok-data.js")
    bulan = mtd_area(W)
    R = kito_data.baca(JS + "region-data.js")
    mtd_region(R, bulan)
    kito_data.tulis(JS + "region-data.js", R)
    n, ada = mtd_cabang(path, K, bulan)
    kito_data.tulis(JS + "area-waktu-data.js", W)
    kito_data.tulis(JS + "area-kelompok-data.js", K)
    print(f"MTD P95 : bulan {bulan} · area {len(W['areas'])}+Region II (rata-rata harian) · {n} cabang dari {os.path.basename(path)} (kolom MTD: {ada})")


if __name__ == "__main__":
    terapkan(sys.argv[1])
