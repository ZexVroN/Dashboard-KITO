"""Penghubung data dashboard KITO: SEMUA data ada di satu file JSON, data/kito.json.

Isi file = satu objek; tiap kunci menjadi variabel global di browser (assets/js/muat-data.js):
    D                   antrian, O2O, NBDS per cabang (dulu assets/js/data.js)
    KITO_AREA_KELOMPOK  kelompok waktu tunggu per cabang (dulu area-kelompok-data.js)
    KITO_AREA_O2O       O2O per area/segmen (dulu area-o2o-data.js)
    KITO_AREA_WAKTU     waktu tunggu per area (dulu area-waktu-data.js)
    KITO_AREA_NBDS      utilisasi NBDS per area (dulu area-nbds-data.js)
    KITO_REGION         12 region + nasional (dulu region-data.js)
    KITO_ARSIP_BULAN    arsip O2O akhir bulan (dulu arsip-bulan-data.js)
    KITO_SALES_PEGAWAI  sales pegawai (dulu sales-pegawai-data.js)
    KITO_DTI            DTI Dana & Cendup (dulu dti-data.js)
    KITO_KPI            KPI (dulu kpi-data.js)
    KITO_PIMPINAN       BM & BOM/BOS (dulu pimpinan-data.js)
    KITO_ASM            Area Service Manager (dulu asm-data.js)
    KITO_EMAS           Program Emas: Tabungan Emas & Cetak Emas per region / cabang / pegawai (tools/build_emas.py)

Semua tools memakai modul ini. Nama file lama (mis. "assets/js/region-data.js") tetap diterima sebagai alamat bagian,
sehingga argumen --out/OUT lama masih berlaku. Browser selalu memeriksa versi terbaru data/kito.json
(Cache-Control: no-cache), jadi index.html tidak perlu diubah setelah update data.
"""
import json
import os
import re

BERKAS = "data/kito.json"
PETA = {
    "data.js": "D",
    "area-kelompok-data.js": "KITO_AREA_KELOMPOK",
    "area-o2o-data.js": "KITO_AREA_O2O",
    "area-waktu-data.js": "KITO_AREA_WAKTU",
    "area-nbds-data.js": "KITO_AREA_NBDS",
    "region-data.js": "KITO_REGION",
    "arsip-bulan-data.js": "KITO_ARSIP_BULAN",
    "sales-pegawai-data.js": "KITO_SALES_PEGAWAI",
    "dti-data.js": "KITO_DTI",
    "kpi-data.js": "KITO_KPI",
    "pimpinan-data.js": "KITO_PIMPINAN",
    "asm-data.js": "KITO_ASM",
    "emas-data.js": "KITO_EMAS",
}
URUTAN = list(PETA.values())


def kunci(nama):
    """'assets/js/region-data.js', 'region-data.js', atau 'KITO_REGION' -> 'KITO_REGION'."""
    dasar = os.path.basename(str(nama))
    if dasar in PETA:
        return PETA[dasar]
    if dasar in URUTAN:
        return dasar
    raise KeyError(f"Bagian data tidak dikenal: {nama}")


def _muat_semua():
    if not os.path.exists(BERKAS):
        return {}
    with open(BERKAS, encoding="utf-8") as f:
        return json.load(f)


def _simpan_semua(semua):
    os.makedirs(os.path.dirname(BERKAS), exist_ok=True)
    kunci_urut = [k for k in URUTAN if k in semua] + sorted(k for k in semua if k not in URUTAN)
    baris = [json.dumps(k) + ":" + json.dumps(semua[k], ensure_ascii=False, separators=(",", ":")) for k in kunci_urut]
    sementara = BERKAS + ".tmp"
    with open(sementara, "w", encoding="utf-8", newline="\n") as f:
        f.write("{\n" + ",\n".join(baris) + "\n}\n")
    os.replace(sementara, BERKAS)


def ada(nama):
    return kunci(nama) in _muat_semua()


def baca(nama):
    """Ambil satu bagian data (dict/list)."""
    semua = _muat_semua()
    k = kunci(nama)
    if k not in semua:
        raise FileNotFoundError(f"{k} belum ada di {BERKAS}")
    return semua[k]


def tulis(nama, data):
    """Ganti satu bagian data lalu simpan data/kito.json."""
    semua = _muat_semua()
    semua[kunci(nama)] = data
    _simpan_semua(semua)


# ---- kompatibel dengan gaya lama tools ("window.X={...};" / "const D = {...};") ----
def baca_js(path, awalan=None, newline=False):
    """Pengganti baca_js lama. newline=True -> kembalikan (data, True) seperti update_harian_p95.py."""
    data = baca(path)
    return (data, True) if newline else data


def tulis_js(path, awalan=None, data=None, newline=None):
    tulis(path, data)


def tulis_teks_js(path, teks):
    """Untuk tools yang menyusun teks 'window.X={...};' utuh: ambil JSON-nya dan simpan ke bagian yang sesuai."""
    t = re.sub(r"/\*.*?\*/", "", teks, flags=re.S).strip()
    m = re.match(r"^(?:window\.\w+|const\s+\w+|var\s+\w+|let\s+\w+)\s*=\s*(.*?);?\s*$", t, flags=re.S)
    if not m:
        raise ValueError(f"Format data tidak dikenali untuk {path}")
    tulis(path, json.loads(m.group(1)))


def baca_teks_js(path, awalan="window.X="):
    """Untuk tools yang membaca teks file data lama: kembalikan 'awalan + JSON;'."""
    return awalan + json.dumps(baca(path), ensure_ascii=False, separators=(",", ":")) + ";"
