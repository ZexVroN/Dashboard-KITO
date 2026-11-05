"""Arsip akhir bulan di bagian KITO_ARSIP_BULAN (data/kito.json), dipakai periode-bulan.js saat bulan lama dipilih.

  KITO_ARSIP_BULAN["2026-10"] = {
      mdate, bw, M, areaO2O, region   -> O2O & Shifting Digital (laporan Ganti Kartu terakhir bulan itu)
      nbds: {...}                     -> Utilisasi NBDS (laporan NBDS terakhir bulan itu)
  }

update_harian_p95.py memanggil modul ini OTOMATIS sebelum menimpa data dengan laporan bulan baru. Manual:
    python tools/arsip_bulan.py            # arsip O2O (bulan D.mdate) dan NBDS (bulan KITO_AREA_NBDS.bulan)
    python tools/arsip_bulan.py --o2o      # hanya O2O
    python tools/arsip_bulan.py --nbds     # hanya NBDS
    python tools/arsip_bulan.py --nbds-dari LAPORAN.xlsx --bulan 2026-10
        # lengkapi arsip NBDS bulan lampau dari laporan NBDS yang lebih baru (mis. laporan s.d. 3 Nov masih memuat
        # kolom harian 1-30 Okt): DtD s.d. 30 Okt dan MTD Oktober ikut diperbarui. Rincian Old BDS per transaksi
        # (sheet Raw) hanya ada untuk tanggal laporan, jadi rincian arsip lama dipertahankan.
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


def arsip_nbds_dari_laporan(path, bulan):
    import os
    import re
    import convert_nbds_bankwide as C
    import update_harian_p95 as U
    N, nilai_dm, D_O, ada_raw = C.hitung(path, bulan)
    reg, tgl_reg, bln_reg, lalu_reg = U.baca_nbds_region(path, bulan)
    arsip = _arsip()
    lama = (arsip.get(bulan) or {}).get("nbds") or {}
    if not ada_raw and lama:
        # Raw tidak memuat tanggal bulan lampau: pertahankan rincian Old BDS arsip sebelumnya
        N["oldbds"] = lama.get("area", {}).get("oldbds", [])
        D_O = lama.get("O", [])
        N["oldbdsTanggal"] = lama.get("area", {}).get("oldbdsTanggal") or lama.get("area", {}).get("tanggal")
    nama = re.sub(r".*[\\/]", "", path)
    N["sumber"] = nama + f" · kolom harian {bulan} · sheet Cab F P, Cab F NP, Cab NF"
    r = kito_data.baca("KITO_REGION")
    data_reg = {}
    for e in r["regions"] + [dict(r["nasional"], id="NASIONAL")]:
        data_reg[e["id"]] = reg.get(e["id"], (lama.get("region", {}).get("data", {}) or {}).get(e["id"]))
    arsip.setdefault(bulan, {})["nbds"] = {
        "M": nilai_dm,
        "O": D_O,
        "area": N,
        "region": {"tglNbds": tgl_reg, "bulan": bln_reg, "bulanLalu": lalu_reg,
                   "sumberNbds": f"{nama} · sheet Region · kolom harian {bulan} · DtD dan MTD s.d. {tgl_reg[-1]}",
                   "data": data_reg},
    }
    _simpan(arsip)
    print(f"Arsip NBDS {bulan} dari {nama}: {len(N['dates'])} tanggal s.d. {N['tanggal']}, "
          f"{len(N['cabang'])} cabang, region s.d. {tgl_reg[-1]}"
          + ("" if ada_raw else f" · rincian Old BDS tetap per {N.get('oldbdsTanggal') or '-'}"))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--o2o", action="store_true")
    ap.add_argument("--nbds", action="store_true")
    ap.add_argument("--nbds-dari", help="laporan NBDS yang masih memuat kolom harian bulan --bulan")
    ap.add_argument("--bulan", help="YYYY-MM, dipakai bersama --nbds-dari")
    a = ap.parse_args()
    if a.nbds_dari:
        if not a.bulan:
            ap.error("--nbds-dari perlu --bulan YYYY-MM")
        arsip_nbds_dari_laporan(a.nbds_dari, a.bulan)
        raise SystemExit
    semua = not (a.o2o or a.nbds)
    if a.o2o or semua:
        arsip_o2o()
    if a.nbds or semua:
        arsip_nbds()
    print("Bulan di arsip:", ", ".join(f"{k} ({'+'.join(x for x in ('O2O', 'NBDS') if (x == 'O2O' and 'mdate' in v) or (x == 'NBDS' and 'nbds' in v))})" for k, v in sorted(_arsip().items())))
