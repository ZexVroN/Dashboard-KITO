"""Data Kelompok cabang (kuadran Teller & CS, tab Cabang) per periode bulan -> data/kito.json [D].KL, D.kl, D.B[6..11].

Pemakaian (dari folder Dashboard-KITO):
    python tools/build_kelompok_cabang.py <Monitoring_Kelompok_Cabang.xlsx> 2026-10=260930:261030 2026-11=261030:261106

Setiap argumen BULAN=ACUAN:PEMBANDING memakai dua sheet bertanggal (YYMMDD) dari laporan "Monitoring Kelompok Cabang":
  - kuadran sebuah sheet = kolom "final_kuadran_*" bila ada (sudah memperhitungkan user NBDS), selain itu kolom
    "kuadran*" paling kanan (mis. "kuadran Sept", "kuadran_Nov")
  - acuan -> kuadran lama, pembanding -> kuadran baru; progres dihitung ulang: kuadran turun = Membaik,
    naik = Memburuk, sama = Tetap (selisih dengan kolom "Progres" di Excel dicetak sebagai catatan)
Hanya cabang Region II yang ada di D.B. Yang disimpan:
    D.KL = {"2026-10": {"kl": ["30 Sep", "30 Okt"], "b": {kode: [teller lama, teller baru, progres, cs lama, cs baru, progres]}}, ...}
Bulan terbaru juga ditulis ke D.kl dan D.B[i][6..11] (tampilan bawaan). Pergantian bulan: assets/js/periode-bulan.js.
"""
import re
import sys

import openpyxl

import kito_data

BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

if len(sys.argv) < 3:
    sys.exit(__doc__)
SRC = sys.argv[1]
periode = []
for a in sys.argv[2:]:
    m = re.fullmatch(r"(\d{4}-\d{2})=(\d{6}):(\d{6})", a)
    if not m:
        sys.exit(f"argumen tidak dikenali: {a}\n{__doc__}")
    periode.append(m.groups())

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
D = kito_data.baca("D")
kode_r2 = {int(b[0]) for b in D["B"]}


def label(sheet):
    return f"{sheet[4:6]} {BLN[int(sheet[2:4]) - 1]}"


def baca(sheet):
    if sheet not in wb.sheetnames:
        sys.exit(f"sheet {sheet} tidak ada di {SRC}")
    rows = wb[sheet].iter_rows(values_only=True)
    h = [str(x or "").strip() for x in next(rows)]
    final = [i for i, c in enumerate(h) if c.lower().startswith("final_kuadran")]
    biasa = [i for i, c in enumerate(h) if c.lower().startswith("kuadran")]
    ik = (final or biasa or [None])[-1]
    ip = next((i for i, c in enumerate(h) if c.lower() == "progres"), None)
    if ik is None:
        sys.exit(f"sheet {sheet}: kolom kuadran tidak ditemukan")
    out = {}
    for r in rows:
        if not r or r[1] is None:
            continue
        try:
            kode = int(r[1])
        except (TypeError, ValueError):
            continue
        if kode not in kode_r2:
            continue
        jenis = str(r[0] or "").strip().upper()
        k = r[ik]
        out[(kode, jenis)] = (int(k) if isinstance(k, (int, float)) else None, str(r[ip]).strip() if ip is not None and r[ip] else None)
    print(f"  sheet {sheet}: kuadran = kolom '{h[ik]}', {len(out)} baris Region II")
    return out


def progres(a, b):
    if a is None or b is None:
        return "Tetap"
    return "Membaik" if b < a else "Memburuk" if b > a else "Tetap"


KL = dict(D.get("KL") or {})
for bulan, acuan, banding in periode:
    print(f"{bulan}: {acuan} -> {banding}")
    A, B = baca(acuan), baca(banding)
    data, kurang, beda = {}, [], 0
    for kode in sorted(kode_r2):
        baris = []
        for jenis in ("TELLER", "CS"):
            a, b = A.get((kode, jenis)), B.get((kode, jenis))
            if a is None or b is None:
                kurang.append((kode, jenis))
            ka, kb = (a or (None,))[0], (b or (None,))[0]
            p = progres(ka, kb)
            if b and b[1] and b[1] != p:
                beda += 1
            baris += [ka, kb, p]
        data[str(kode)] = baris
    KL[bulan] = {"kl": [label(acuan), label(banding)], "sumber": f"{SRC.split('/')[-1]} · sheet {acuan} -> {banding}", "b": data}
    print(f"  {len(data)} cabang · tanpa data: {len(kurang)} {kurang[:5]} · progres beda dengan kolom Excel: {beda}")

D["KL"] = dict(sorted(KL.items()))
terbaru = max(D["KL"])
D["kl"] = D["KL"][terbaru]["kl"]
for b in D["B"]:
    v = D["KL"][terbaru]["b"].get(str(int(b[0])))
    if v:
        b[6:12] = v
kito_data.tulis("D", D)
print(f"D.KL: {list(D['KL'])} · bawaan {terbaru} {D['kl']}")
