"""Buang tanggal Utilisasi NBDS yang dikecualikan (tools/nbds_kecuali.json) dari data/kito.json.

Pemakaian (dari folder Dashboard-KITO):  python tools/nbds_kecualikan.py
Dipanggil otomatis oleh tools/update_harian_p95.py setelah laporan NBDS dibaca.

Yang diubah: KITO_AREA_NBDS (dates, areas[].d/m, cabang[].d/m) dan KITO_REGION (tglNbds, regions[]/nasional nbds .d/.m).
MTD (m) = jumlah harian, jadi angka hari yang dibuang ikut dikurangi. Idempoten: tanggal yang sudah tidak ada dilewati.
Alasan disimpan di KITO_AREA_NBDS.kecuali dan KITO_REGION.nbdsKecuali ({tanggal: alasan}) untuk ditampilkan di halaman.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kito_data  # noqa: E402

BERKAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nbds_kecuali.json")


def kurangi(m, hari):
    if hari is None or m is None:
        return m
    return [m[0] - (hari[0] or 0), m[1] - (hari[1] or 0)]


def jalankan():
    kecuali = {k: v for k, v in json.load(open(BERKAS, encoding="utf-8")).items() if not k.startswith("_")}
    N = kito_data.baca("KITO_AREA_NBDS")
    R = kito_data.baca("KITO_REGION")
    dibuang = []
    for t in sorted(kecuali):
        if t in N.get("dates", []):
            i = N["dates"].index(t)
            N["dates"].pop(i)
            for e in N["areas"] + N["cabang"]:
                for k in list(e["d"]):
                    hari = e["d"][k].pop(i)
                    e["m"][k] = kurangi(e["m"][k], hari)
            dibuang.append(t)
        if t in R.get("tglNbds", []):
            j = R["tglNbds"].index(t)
            R["tglNbds"].pop(j)
            for e in R["regions"] + [R["nasional"]]:
                for v in e.get("nbds", {}).values():
                    hari = v["d"].pop(j)
                    v["m"] = kurangi(v["m"], hari)
    bulan = {t: a for t, a in kecuali.items() if t[:7] in {d[:7] for d in N["dates"]}}
    N["kecuali"] = bulan
    R["nbdsKecuali"] = bulan
    kito_data.tulis("KITO_AREA_NBDS", N)
    kito_data.tulis("KITO_REGION", R)
    print(f"NBDS dikecualikan: {', '.join(f'{t} ({a})' for t, a in kecuali.items())}"
          + (f" · dibuang dari laporan ini: {', '.join(dibuang)}" if dibuang else " · tidak ada di laporan ini"))


if __name__ == "__main__":
    jalankan()
