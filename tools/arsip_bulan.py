"""Simpan posisi akhir bulan O2O & Shifting Digital ke bagian KITO_ARSIP_BULAN di data/kito.json.

Jalankan SEBELUM memasukkan data bulan baru (mis. sebelum update data 1 Desember), selagi bagian D,
KITO_AREA_O2O, dan KITO_REGION di data/kito.json masih berisi laporan Ganti Kartu terakhir bulan sebelumnya:
    python tools/arsip_bulan.py
Bulan arsip = bulan D.mdate. Dipakai periode-bulan.js saat bulan lama dipilih di filter "Periode Bulan".
Waktu antri tidak perlu diarsip: riwayat hariannya tetap ada di D / KITO_AREA_WAKTU / KITO_REGION.
"""
import kito_data  # data/kito.json


d, o, r = kito_data.baca("D"), kito_data.baca("KITO_AREA_O2O"), kito_data.baca("KITO_REGION")
bulan = d["mdate"][:7]
reg = {x["id"]: {"o2o": x["o2o"], "ch": x["ch"]} for x in r["regions"]}
reg["NASIONAL"] = {"o2o": r["nasional"]["o2o"], "ch": r["nasional"]["ch"]}
baru = {
    "mdate": d["mdate"], "bw": d["bw"],
    "M": {str(b[0]): [d["M"][i][k] for k in (0, 1, 2, 3, 10)] for i, b in enumerate(d["B"])},
    "areaO2O": o,
    "region": {"tglO2O": r["tglO2O"], "sumberO2O": r["sumber"]["o2o"], "data": reg},
}

arsip = kito_data.baca("KITO_ARSIP_BULAN") if kito_data.ada("KITO_ARSIP_BULAN") else {}
arsip[bulan] = baru
kito_data.tulis("KITO_ARSIP_BULAN", dict(sorted(arsip.items())))
print(f"Arsip O2O {bulan} (MTD s.d. {d['mdate']}) disimpan. Bulan di arsip: {', '.join(sorted(arsip))}")
