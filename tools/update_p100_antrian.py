"""Tambah P100 dan jumlah Antrian / Reservasi Nasabah dari laporan antrian format P95 (satu hari).

Pemakaian (dari folder Dashboard-KITO):
    python tools/update_p100_antrian.py <DDMMYYYY_Dashboard_Antrian_Cabang.xlsx>

Dipanggil otomatis oleh update_harian_p95.py; bisa juga dijalankan sendiri untuk mengisi
tanggal yang sudah ada (mis. 27 Okt) tanpa file O2O / NBDS.

Sejak 27 Oktober 2026 kotak Waktu Antrian menampilkan:
  - Antrian / Reservasi Nasabah (menggantikan Single / Multipel)
  - P100 = waktu tunggu maksimum (menggantikan MtD rata-rata)

Yang ditulis:
  data.js            : D.QP[cabang][tanggal] = [P100 Teller, P100 CS, P100 All] (detik)
                       D.QN[cabang][tanggal] = [Antrian Teller, Antrian CS, Antrian All]
                       D.QW[cabang][tanggal] = [Reservasi All, Reservasi wait < 10 detik]  (sheet "Wait <10 Detik")
  area-waktu-data.js : x[tanggal] = {"p": [P100 T, CS, All], "n": [Antrian T, CS, All], "w": [All, <10 dtk]}
                       per area + Region II
  region-data.js     : waktu.p[tanggal] = P100 [T, CS, All], waktu.w[tanggal] = [All, <10 dtk],
                       waktu.n[tanggal] = Antrian [T, CS, All]  untuk 12 region + nasional
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import openpyxl  # noqa: E402

from update_harian_p95 import JS, R2, angka, baca_js, detik, nama_file, norm, tulis_js  # noqa: E402

import datetime as dt  # noqa: E402
import re  # noqa: E402


def _p(nilai, jumlah):
    return detik(nilai) if jumlah else None


def baca_p100(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    v = next(wb["RAW"].iter_rows(min_row=2, max_row=2, values_only=True))[0]
    tgl = v.date().isoformat() if isinstance(v, dt.datetime) else (v.isoformat() if isinstance(v, dt.date) else str(v)[:10])
    m = re.match(r"(\d{2})(\d{2})(\d{4})", nama_file(path))
    if m and f"{m.group(3)}-{m.group(2)}-{m.group(1)}" != tgl:
        sys.exit(f"Tanggal RAW ({tgl}) tidak sama dengan tanggal pada nama file ({nama_file(path)}).")

    def ambil(r, o):  # o = kolom 'Antrian' Total; Teller o+3, CS o+6
        n = [angka(r[o + 3]), angka(r[o + 6]), angka(r[o])]
        p = [_p(r[o + 5], n[0]), _p(r[o + 8], n[1]), _p(r[o + 2], n[2])]
        p95 = [_p(r[o + 4], n[0]), _p(r[o + 7], n[1]), _p(r[o + 1], n[2])]
        return {"p": p, "n": n, "p95": p95}

    cab = {str(r[4]): ambil(r, 7) for r in wb["Cabang"].iter_rows(min_row=6, values_only=True)
           if r[1] == R2 and r[4] is not None}
    area = {norm(r[3]): ambil(r, 6) for r in wb["Area"].iter_rows(min_row=6, values_only=True)
            if r[1] == R2 and r[3]}
    regs = {r[3].strip(): ambil(r, 6) for r in wb["Region"].iter_rows(min_row=6, values_only=True)
            if isinstance(r[3], str) and r[3].strip().upper().startswith("REGION")}
    r = next(wb["Bankwide"].iter_rows(min_row=6, max_row=6, values_only=True))
    regs["NASIONAL"] = ambil(r, 6)

    # sheet "Wait <10 Detik": reservasi unik per cabang (seluruh bank) dan yang wait < 10 detik
    wait = {}
    for r in wb["Wait <10 Detik"].iter_rows(min_row=4, values_only=True):
        if r[0] is None:
            continue
        wait[str(r[0])] = {"area": r[2], "region": str(r[3] or "").strip(), "w": [angka(r[4]), angka(r[5])]}
    for k, x in regs.items():
        ws = [v["w"] for v in wait.values() if k == "NASIONAL" or v["region"] == k]
        x["w"] = [sum(a for a, _ in ws), sum(b for _, b in ws)]
    for k, x in area.items():
        ws = [v["w"] for v in wait.values() if v["region"] == R2 and norm(v["area"]) == k]
        x["w"] = [sum(a for a, _ in ws), sum(b for _, b in ws)]
    return tgl, cab, area, regs, wait


def terapkan(path):
    tgl, cab, area, regs, wait = baca_p100(path)
    reg = regs.get(R2)

    D, nl_d = baca_js(JS + "data.js", "const D = ")
    if tgl not in D["dates"]:
        sys.exit(f"Tanggal {tgl} belum ada di data.js; jalankan update_harian_p95.py dulu.")
    j, n_tgl = D["dates"].index(tgl), len(D["dates"])
    for key in ("QP", "QN", "QW"):
        arr = D.setdefault(key, [])
        while len(arr) < len(D["B"]):
            arr.append([])
        for s in arr:
            while len(s) < n_tgl:
                s.append(None)
    beda_p95 = 0
    for i, b in enumerate(D["B"]):
        x = cab.get(str(b[0]))
        D["QP"][i][j] = x["p"] if x else None
        D["QN"][i][j] = x["n"] if x else None
        D["QW"][i][j] = wait[str(b[0])]["w"] if str(b[0]) in wait else None
        if x and D["Q"][i][j] is not None and D["Q"][i][j] != x["p95"]:
            beda_p95 += 1
    tulis_js(JS + "data.js", "const D = ", D, nl_d)

    W, nl_w = baca_js(JS + "area-waktu-data.js", "window.KITO_AREA_WAKTU=")
    for ent in W["areas"]:
        x = area.get(norm(ent["name"]))
        if x is None:
            print("PERINGATAN: area tidak ditemukan:", ent["name"])
            continue
        ent.setdefault("x", {})[tgl] = {"p": x["p"], "n": x["n"], "w": x["w"]}
    if reg:
        W["region"].setdefault("x", {})[tgl] = {"p": reg["p"], "n": reg["n"], "w": reg["w"]}
    tulis_js(JS + "area-waktu-data.js", "window.KITO_AREA_WAKTU=", W, nl_w)

    R, nl_r = baca_js(JS + "region-data.js", "window.KITO_REGION=")
    for e in R["regions"] + [R["nasional"]]:
        key = "NASIONAL" if e is R["nasional"] else e["id"]
        x = regs.get(key)
        if not x:
            print("PERINGATAN: region tidak ditemukan:", key)
            continue
        wk = e["waktu"]
        wk.setdefault("p", {})[tgl] = x["p"]
        wk.setdefault("w", {})[tgl] = x["w"]
        wk.setdefault("n", {})[tgl] = x["n"]
    tulis_js(JS + "region-data.js", "window.KITO_REGION=", R, nl_r)

    ada = sum(1 for s in D["QP"] if s[j])
    print(f"P100 & Antrian {tgl}: {ada}/{len(D['B'])} cabang, {len(area)} area, {len(regs) - 1} region + nasional, wait<10 dtk {len(wait)} cabang")
    if beda_p95:
        print(f"  PERINGATAN: P95 di file berbeda dengan data.js untuk {beda_p95} cabang (file tanggal sama?)")
    return tgl


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    terapkan(sys.argv[1])
