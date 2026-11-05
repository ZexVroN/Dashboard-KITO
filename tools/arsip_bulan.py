"""Arsip akhir bulan di bagian KITO_ARSIP_BULAN (data/kito.json), dipakai periode-bulan.js saat bulan lama dipilih.

  KITO_ARSIP_BULAN["2026-10"] = {
      mdate, bw, M, areaO2O, region   -> O2O & Shifting Digital (laporan Ganti Kartu terakhir bulan itu)
      nbds: {...}                     -> Utilisasi NBDS (laporan NBDS terakhir bulan itu)
  }

update_harian_p95.py memanggil modul ini OTOMATIS sebelum menimpa data dengan laporan bulan baru. Manual:
    python tools/arsip_bulan.py            # arsip O2O (bulan D.mdate) dan NBDS (bulan KITO_AREA_NBDS.bulan)
    python tools/arsip_bulan.py --o2o      # hanya O2O
    python tools/arsip_bulan.py --nbds     # hanya NBDS
Waktu antri tidak perlu diarsip: riwayat hariannya tetap ada di D / KITO_AREA_WAKTU / KITO_REGION.
"""
import argparse

import kito_data  # data/kito.json

KOLOM_O2O = (0, 1, 2, 3, 10)      # D.M: O2O, CSM, Old BDS, NBDS kanal, ... (lihat convert_nbds_bankwide.py)
KOLOM_NBDS = (4, 5, 6, 7, 8, 9)   # D.M: utilisasi NBDS per cabang


def _arsip():
    return kito_data.baca("KITO_ARSIP_BULAN") if kito_data.ada("KITO_ARSIP_BULAN") else {}


def _simpan(arsip):
    kito_data.tulis("KITO_ARSIP_BULAN", dict(sorted(arsip.items())))


def arsip_o2o():
    d, o, r = kito_data.baca("D"), kito_data.baca("KITO_AREA_O2O"), kito_data.baca("KITO_REGION")
    bulan = d["mdate"][:7]
    reg = {x["id"]: {"o2o": x["o2o"], "ch": x["ch"]} for x in r["regions"]}
    reg["NASIONAL"] = {"o2o": r["nasional"]["o2o"], "ch": r["nasional"]["ch"]}
    arsip = _arsip()
    e = arsip.setdefault(bulan, {})
    e.update({
        "mdate": d["mdate"], "bw": d["bw"],
        "M": {str(b[0]): [d["M"][i][k] for k in KOLOM_O2O] for i, b in enumerate(d["B"])},
        "areaO2O": o,
        "region": {"tglO2O": r["tglO2O"], "sumberO2O": r["sumber"]["o2o"], "data": reg},
    })
    _simpan(arsip)
    print(f"Arsip O2O {bulan} (MTD s.d. {d['mdate']}) disimpan.")
    return bulan


def arsip_nbds():
    d, n, r = kito_data.baca("D"), kito_data.baca("KITO_AREA_NBDS"), kito_data.baca("KITO_REGION")
    bulan = n["bulan"]
    reg = {x["id"]: x.get("nbds") for x in r["regions"]}
    reg["NASIONAL"] = r["nasional"].get("nbds")
    arsip = _arsip()
    arsip.setdefault(bulan, {})["nbds"] = {
        "M": {str(b[0]): [d["M"][i][k] for k in KOLOM_NBDS] for i, b in enumerate(d["B"])},
        "O": d.get("O", []),
        "area": n,
        "region": {"tglNbds": r.get("tglNbds"), "bulan": r.get("bulan"), "bulanLalu": r.get("bulanLalu"),
                   "sumberNbds": (r.get("sumber") or {}).get("nbds", ""), "data": reg},
    }
    _simpan(arsip)
    print(f"Arsip NBDS {bulan} (s.d. {n['tanggal']}) disimpan.")
    return bulan


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--o2o", action="store_true")
    ap.add_argument("--nbds", action="store_true")
    a = ap.parse_args()
    semua = not (a.o2o or a.nbds)
    if a.o2o or semua:
        arsip_o2o()
    if a.nbds or semua:
        arsip_nbds()
    print("Bulan di arsip:", ", ".join(f"{k} ({'+'.join(x for x in ('O2O', 'NBDS') if (x == 'O2O' and 'mdate' in v) or (x == 'NBDS' and 'nbds' in v))})" for k, v in sorted(_arsip().items())))
