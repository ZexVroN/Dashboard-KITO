"""Perbarui data antrian dan O2O/Shifting Digital dashboard KITO dari laporan Excel bankwide.

Pemakaian (dari folder Dashboard-KITO):
    python tools/update_antrian_o2o.py --antrian <Dashboard_Antrian_Cabang.xlsx> --o2o <Dashboard_Monitoring_Ganti_Kartu.xlsx>

Yang diperbarui (hanya Region II / Sumatera 2):
  assets/js/data.js
    - D.dates + D.Q  : P90 Teller / CS / Semua TRX per cabang per tanggal   (sheet "Calc", kunci C|kode|tgl)
    - D.B[i][3]      : kelas cabang                                          (sheet "Per Cabang")
    - D.M[i][0..3]   : Livin O2O, NBDS O2O, CSM, Old BDS                      ("Cabang O2O" + "Cabang by Channel")
    - D.M[i][10]     : NBDS seluruh transaksi ganti kartu (penyebut Shifting Digital resmi, "Cabang by Channel")
    - D.bw           : rata-rata O2O Bankwide                                 ("Region O2O", baris GRAND TOTAL)
  assets/js/area-waktu-data.js
    - P90 per area & Region II per tanggal + MTD                             (sheet "Calc", kunci A|… dan R|…)
  assets/js/area-kelompok-data.js
    - P90 per cabang: DtD tanggal terakhir + MTD ("Gabungan")                (sheet "Calc", kunci C|…)
  assets/js/area-o2o-data.js
    - Utilisasi O2O per segmen: area Region II, Region II, Bankwide          ("Area O2O", "Region O2O")
  D.mdate = tanggal laporan O2O ("Mtd sd 22 Okt 26'").
Data lain (NBDS, pegawai, infografis, Old BDS) tidak disentuh.
Nilai yang sudah ada dan sama dengan Excel tetap; tanggal yang belum ada ditambahkan.
"""

import argparse
import datetime as dt
import json
import re

import openpyxl

R2 = "REGION II / SUMATERA 2"
JS = "assets/js/"
BULAN = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "Mei": 5, "Jun": 6, "Jul": 7, "Agu": 8, "Agt": 8,
         "Sep": 9, "Okt": 10, "Nov": 11, "Des": 12}
# sheet Calc: indeks kolom (0-based) nilai P90 per jenis
P90 = {"ts": 7, "cs1": 12, "tm": 17, "csm": 22, "all": 27, "teller": 32, "cs": 37}
WAKTU_URUT = ["ts", "tm", "teller", "cs1", "csm", "cs", "all"]  # urutan "fields" di area-waktu-data.js


def detik(v):
    """Nilai waktu Excel (time / timedelta / pecahan hari) -> detik, dibulatkan 1 desimal."""
    if v is None or isinstance(v, str):
        return None
    if isinstance(v, (dt.time, dt.datetime)):
        s = v.hour * 3600 + v.minute * 60 + v.second + v.microsecond / 1e6
    elif isinstance(v, dt.timedelta):
        s = v.total_seconds()
    elif isinstance(v, (int, float)):
        s = float(v) * 86400
    else:
        return None
    return round(s, 1)


def angka(v):
    return int(round(v)) if isinstance(v, (int, float)) and not isinstance(v, bool) else 0


def norm(s):
    return re.sub(r"[^a-z0-9]", "", re.sub(r"^area\s+", "", str(s or "").lower()))


def baca_js(path, awalan):
    teks = open(path, encoding="utf-8").read().strip()
    assert teks.startswith(awalan) and teks.endswith(";"), path
    return json.loads(teks[len(awalan):-1])


def tulis_js(path, awalan, data):
    with open(path, "w", encoding="utf-8") as f:
        f.write(awalan + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")


def tanggal_calc(lbl, tahun):
    if lbl == "Gabungan":
        return "MTD"
    d, m = lbl.split()
    return f"{tahun}-{BULAN[m]:02d}-{int(d):02d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--antrian", required=True)
    ap.add_argument("--o2o", required=True)
    a = ap.parse_args()

    D = baca_js(JS + "data.js", "const D = ")
    W = baca_js(JS + "area-waktu-data.js", "window.KITO_AREA_WAKTU=")
    tahun = D["dates"][-1][:4]
    kode_ke_i = {str(b[0]): i for i, b in enumerate(D["B"])}

    # ===== 1. Antrian =====
    wb = openpyxl.load_workbook(a.antrian, read_only=True, data_only=True)
    cab, area, reg = {}, {}, {}
    for r in wb["Calc"].iter_rows(min_row=2, values_only=True):
        k = r[2]
        if not isinstance(k, str):
            continue
        p = k.split("|")
        if p[0] == "C" and p[1] in kode_ke_i:
            tgt = cab.setdefault(p[1], {})
        elif p[0] == "A":
            tgt = area.setdefault(norm(p[1]), {})
        elif p[0] == "R" and p[1] == R2:
            tgt = reg
        else:
            continue
        tgt[tanggal_calc(p[2], tahun)] = {f: detik(r[c]) for f, c in P90.items()}

    kelas = {}
    for r in wb["Per Cabang"].iter_rows(min_row=6, values_only=True):
        if r[3] == R2 and r[2]:
            kelas[str(r[0])] = str(r[2]).strip()

    tgl_calc = sorted({t for x in cab.values() for t in x if t != "MTD"})
    lama = D["dates"]
    baru = sorted(set(lama) | set(tgl_calc))
    tambah = [t for t in baru if t not in lama]
    Q = []
    beda_q = 0
    for i, b in enumerate(D["B"]):
        x = cab.get(str(b[0]), {})
        seri = []
        for t in baru:
            j = lama.index(t) if t in lama else None
            old = D["Q"][i][j] if j is not None else None
            if t in x:
                v = [x[t]["teller"], x[t]["cs"], x[t]["all"]]
                # tanpa data tetap ditulis [null, null, null] (format data.js yang sudah ada)
                if j is not None and old != v and not (old and v and all(
                        (p is None and q is None) or (p is not None and q is not None and abs(p - q) < 0.6)
                        for p, q in zip(old, v))):
                    beda_q += 1
                seri.append(v if j is None else old if old == v else v)
            else:
                seri.append(old)
        Q.append(seri)
    D["dates"], D["Q"] = baru, Q

    kelas_beda = []
    for i, b in enumerate(D["B"]):
        k = kelas.get(str(b[0]))
        if k and k != b[3]:
            kelas_beda.append(f"{b[1]}: {b[3]} -> {k}")
            b[3] = k

    # area-waktu: per area dan Region II
    def baris(x):
        return [x.get(f) for f in WAKTU_URUT]
    w_tgl = sorted(set(W["dates"]) | {t for x in area.values() for t in x if t != "MTD"})
    w_tambah = [t for t in w_tgl if t not in W["dates"]]
    for ent in W["areas"]:
        x = area.get(norm(ent["name"]))
        if not x:
            print("PERINGATAN: area tidak ditemukan di Calc:", ent["name"])
            continue
        for t in w_tgl:
            if t in x:
                ent["d"][t] = baris(x[t])
        if "MTD" in x:
            ent["m"] = baris(x["MTD"])
    for t in w_tgl:
        if t in reg:
            W["region"]["d"][t] = baris(reg[t])
    if "MTD" in reg:
        W["region"]["m"] = baris(reg["MTD"])
    W["dates"] = w_tgl
    W["tanggal"] = w_tgl[-1]

    # kelompok cabang (DtD tanggal terakhir + MTD)
    K = baca_js(JS + "area-kelompok-data.js", "window.KITO_AREA_KELOMPOK=")
    akhir = tgl_calc[-1]
    for r in K:
        x = cab.get(str(r["kode"]), {})
        if akhir in x:
            r["dtd"] = {f: x[akhir][f] for f in ("teller", "cs", "all")}
        if "MTD" in x:
            r["mtd"] = {f: x["MTD"][f] for f in ("teller", "cs", "all")}
    W["sumber"] = a.antrian.replace("\\", "/").split("/")[-1] + " · sheet Calc (P90 per area & tanggal)"

    # ===== 2. O2O & Shifting Digital =====
    wb = openpyxl.load_workbook(a.o2o, read_only=True, data_only=True)
    o2o, ch = {}, {}
    for r in wb["Cabang O2O"].iter_rows(min_row=5, values_only=True):
        if r[2] == R2:
            o2o[str(r[1])] = (angka(r[35]), angka(r[36]))          # AJ / AK: Overall O2O Livin, New BDS
    for r in wb["Cabang by Channel"].iter_rows(min_row=5, values_only=True):
        if r[2] == R2:
            ch[str(r[1])] = {"csm": angka(r[9]), "old": angka(r[12]), "new": angka(r[13])}  # J, M, N
    bw = None
    for r in wb["Region O2O"].iter_rows(min_row=5, max_row=40, values_only=True):
        if isinstance(r[1], str) and r[1].strip().upper() == "GRAND TOTAL":
            lv, nb = angka(r[30]), angka(r[31])                    # AE / AF: Overall O2O
            bw = lv / (lv + nb) if lv + nb else None
    # tanggal laporan O2O dari judul "Mtd sd 22 Okt 26'"
    judul = " ".join(str(v) for v in next(wb["Cabang O2O"].iter_rows(min_row=1, max_row=1, values_only=True)) if v)
    mt = re.search(r"sd\s+(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{2})", judul)
    tgl_o2o = f"20{mt.group(3)}-{BULAN[mt.group(2).title()]:02d}-{int(mt.group(1)):02d}" if mt else D["mdate"]

    # area-o2o-data.js: segmen per area Region II, Region II, Bankwide (GRAND TOTAL)
    O = baca_js(JS + "area-o2o-data.js", "window.KITO_AREA_O2O=")
    A_COL = {"gold": 11, "platinum": 23, "silver": 27, "overall": 31}   # L, X, AB, AF (kolom LIVIN O2O; +1 = NEW BDS)
    R_COL = {"gold": 10, "platinum": 22, "silver": 26, "overall": 30}   # K, W, AA, AE

    def segmen(row, cols, banding=None):
        out = {}
        for k, c in cols.items():
            lv, nb = angka(row[c]), angka(row[c + 1])
            t = lv + nb
            p = lv / t if t else 0
            ket = "avg" if banding is None else ("above" if p >= banding[k][3] else "below")
            out[k] = [lv, nb, t, p, ket]
        return out
    bank, reg2, area_rows = None, None, []
    for r in wb["Region O2O"].iter_rows(min_row=5, max_row=40, values_only=True):
        if isinstance(r[1], str) and r[1].strip().upper() == "GRAND TOTAL":
            bank = segmen(r, R_COL)
        elif r[1] == R2:
            reg2_row = r
    for r in wb["Area O2O "].iter_rows(min_row=4, values_only=True):
        if r[1] == R2 and r[2]:
            area_rows.append(r)
    if bank:
        reg2 = segmen(reg2_row, R_COL, bank)
        areas_o2o = [{"name": str(r[2]).strip(), "rank": None, "s": segmen(r, A_COL, reg2)} for r in area_rows]
        areas_o2o.sort(key=lambda a: -a["s"]["overall"][3])
        for i, a2 in enumerate(areas_o2o, 1):
            a2["rank"] = i
        O["region"]["s"], O["bankwide"]["s"], O["areas"] = reg2, bank, areas_o2o
        O["tanggal"] = tgl_o2o
        O["sumber"] = a.o2o.replace("\\", "/").split("/")[-1] + " · sheet Area O2O & Region O2O"

    beda_m = 0
    for kode, i in kode_ke_i.items():
        m = D["M"][i]
        if m is None:
            continue
        lama_m = list(m[:4])
        if kode in o2o:
            m[0], m[1] = o2o[kode]
        if kode in ch:
            m[2], m[3] = ch[kode]["csm"], ch[kode]["old"]
            while len(m) < 11:
                m.append(0)
            m[10] = ch[kode]["new"]                                   # NBDS kanal ganti kartu
        beda_m += lama_m != list(m[:4])
    if bw is not None:
        D["bw"] = bw
    D["mdate"] = tgl_o2o

    tulis_js(JS + "data.js", "const D = ", D)
    tulis_js(JS + "area-waktu-data.js", "window.KITO_AREA_WAKTU=", W)
    tulis_js(JS + "area-kelompok-data.js", "window.KITO_AREA_KELOMPOK=", K)
    tulis_js(JS + "area-o2o-data.js", "window.KITO_AREA_O2O=", O)
    print(f"data.js           : tanggal antrian ditambah {tambah or '-'} · nilai antrian berubah {beda_q} · "
          f"kelas berubah {len(kelas_beda)} {kelas_beda} · O2O/CSM/OldBDS berubah {beda_m} cabang · "
          f"D.M[10] (NBDS kanal) diisi {len(ch)} cabang · bankwide O2O {bw:.4%}")
    print(f"area-waktu-data.js: tanggal ditambah {w_tambah or '-'} · tanggal laporan {W['tanggal']}")
    print(f"area-kelompok-data: DtD {akhir} + MTD · area-o2o-data: {len(O['areas'])} area, tanggal {O['tanggal']} · D.mdate {D['mdate']}")


if __name__ == "__main__":
    main()
