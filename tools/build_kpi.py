"""Membuat data/kito.json [KITO_KPI] dari file KPI_OBO_*.xlsx (format "KPI_OBO_Final_Sept").

Pemakaian (dari folder Dashboard-KITO):
    python tools/build_kpi.py <KPI_OBO_Final_Sept.xlsx>

Sumber:
    Ranking Region-Area : skor per perspektif + skor total untuk ROH, TOH, SQO Region, ASM, SQO Area, ATOM
    Ranking BOM-BOS     : skor cabang bankwide (BOM-BOS); yang disimpan hanya cabang Region II
    KPI <jabatan>       : daftar butir KPI (bobot, ambang 130%/110%/100%, batas bawah 0) dan rumus SUMIF
    Data <jabatan>      : realisasi / target / % pencapaian per unit, sesuai kolom yang dirujuk rumus SUMIF

Lembar "KPI <jabatan>" hanya menampilkan SATU unit (kode yang dipilih di sel B2/B3), jadi nilainya
tidak dibaca langsung. Rumus SUMIF tiap butir dibaca untuk mengetahui kolom Realisasi/Target/Pencapaian
di lembar Data; dua kolom sesudahnya adalah Bobot dan Nilai. Nilai lembar Data inilah yang dijumlahkan
lembar Ranking (skor resmi), jadi bobot dan nilai diambil dari sana (bobot di lembar KPI BOM-BOS bisa berbeda).
Jumlah nilai tiap unit dicocokkan dengan skor di lembar Ranking; selisih dicetak di akhir.
"""

import json
import re
import sys

import openpyxl

import kito_data  # data/kito.json

SRC = sys.argv[1] if len(sys.argv) > 1 else sys.exit("Pemakaian: python tools/build_kpi.py <KPI_OBO_*.xlsx>")
OUT = sys.argv[2] if len(sys.argv) > 2 else "KITO_KPI"
FOKUS = "REGION II / SUMATERA 2"
FOKUS_KODE = "R02"
PERIODE = "September 2026"

wbv = openpyxl.load_workbook(SRC, data_only=True)   # nilai tersimpan
wbf = openpyxl.load_workbook(SRC)                   # rumus


def num(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def r3(v):
    return None if v is None else round(v, 5)


def kode(v):
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


# jabatan: kunci, nama, judul blok di "Ranking Region-Area", lembar KPI, tingkat (regional/area/cabang)
JAB = [
    ("ROH", "Regional Operation Head", "REGIONAL OPERATION HEAD", "KPI ROH", "regional"),
    ("TOH", "Transaction Operation Head", "TRANSACTION OPERATION HEAD", "KPI TOH", "regional"),
    ("SQOR", "SQO Region", "SQO REGION", "KPI SQO Region", "regional"),
    ("ASM", "Area Service Manager", "AREA SERVICE MANAGER", "KPI ASM", "area"),
    ("SQOA", "SQO Area", "SQO AREA", "KPI SQO Area", "area"),
    ("ATOM", "Area Transaction Operation Manager", "AREA TRANSACTION OPERATION MANAGER", "KPI ATOM", "area"),
    ("BOM", "Branch Operation Manager / Branch Operation Supervisor", None, "KPI BOM-BOS", "cabang"),
]

# ---------- 1. rekap skor ----------
rekap = {k: [] for k, *_ in JAB}
cur = None
for r in wbv["Ranking Region-Area"].iter_rows(min_row=4, values_only=True):
    a, b, c, d, e, f, g = (list(r) + [None] * 7)[:7]
    if isinstance(a, str) and not a.strip().isdigit():
        cur = next((k for k, _, p, *_ in JAB if p and a.strip().upper().startswith(p)), None)
        continue
    if cur and b and num(g) is not None:
        rekap[cur].append({"rk": int(a), "n": str(b).strip(), "c": r3(num(c)), "i": r3(num(d)),
                           "f": r3(num(e)), "d": r3(num(f)), "s": r3(num(g))})
for r in wbv["Ranking BOM-BOS"].iter_rows(min_row=4, values_only=True):
    a, k, n, c, d, e, f, g = (list(r) + [None] * 8)[:8]
    if k is None or num(g) is None:
        continue
    rekap["BOM"].append({"rk": int(a), "k": kode(k), "n": str(n).strip(), "c": r3(num(c)), "i": r3(num(d)),
                         "f": r3(num(e)), "d": r3(num(f)), "s": r3(num(g))})

# ---------- 2. butir KPI + nilai semua unit dari lembar Data ----------
RX_SUMIF = re.compile(r"SUMIF\('([^']+)'!\$([A-Z]+)\$(\d+):\$[A-Z]+\$(\d+),[^,]+,'[^']+'!([A-Z]+)\$")


def butir(sheet):
    """Daftar butir KPI lembar KPI <jabatan> + sumber datanya."""
    wv, wf = wbv[sheet], wbf[sheet]
    items, src, grp = [], None, None
    for r in range(7, wv.max_row + 1):
        b, d, j = (wv[f"{x}{r}"].value for x in "BDJ")
        fF = str(wf[f"F{r}"].value or "")
        if isinstance(b, str) and b.strip().isupper() and "SUMIF" not in fF and b.strip() != "PERSPECTIVES":
            items.append({"p": b.strip().title()})
            grp = None
            continue
        if "SUMIF" in fF:
            cols = []
            for x in "FGH":
                m = RX_SUMIF.search(str(wf[f"{x}{r}"].value))
                cols.append(m.group(5))
                if src is None:
                    src = (m.group(1), m.group(2), int(m.group(3)), int(m.group(4)))
            jf = str(wf[f"J{r}"].value)
            th = float(re.search(r"H\d+>(\d+)%", jf).group(1)) / 100
            items.append({"g": grp, "n": str(d).strip(), "w": round(num(wv[f"C{r}"].value) or 0, 6),
                          "th": th, "fl": 1 if "<0" in jf else 0, "_c": cols})
        elif d and wf[f"F{r}"].value is None and wf[f"J{r}"].value is None:
            grp = str(d).strip()
    return items, src


def nilai_unit(items, src, saring=None):
    """{kode: [[real, target, %, nilai], ...]} untuk semua unit di lembar Data (SUMIF: jumlah baris kode sama).
    Kolom Bobot dan Nilai = dua kolom setelah kolom Pencapaian. Bobot butir diisi dari lembar Data."""
    from openpyxl.utils import column_index_from_string as ci, get_column_letter as cl
    sh, kc, r0, r1 = src
    ws = wbv[sh]
    nc = cl(ci(kc) + 1)      # kolom nama unit = kolom setelah kode
    its = [x for x in items if "_c" in x]
    kol = [it["_c"] + [cl(ci(it["_c"][2]) + 2)] for it in its]
    bobot = [cl(ci(it["_c"][2]) + 1) for it in its]
    for it, b in zip(its, bobot):
        assert str(ws[f"{b}{r0 - 1}"].value).strip().lower() == "bobot", (sh, b)
    vals, names, wset = {}, {}, [None] * len(its)
    for r in range(r0, r1 + 1):
        k = kode(ws[f"{kc}{r}"].value)
        if not k or (saring and not saring(ws, r)):
            continue
        names.setdefault(k, str(ws[f"{nc}{r}"].value or "").strip())
        row = vals.setdefault(k, [[None] * 4 for _ in its])
        for i, cs in enumerate(kol):
            for j, c in enumerate(cs):
                v = num(ws[f"{c}{r}"].value)
                if v is not None:
                    row[i][j] = (row[i][j] or 0) + v
            if wset[i] is None:
                wset[i] = num(ws[f"{bobot[i]}{r}"].value)
    for it, w in zip(its, wset):
        if w is not None:
            it["w"] = round(w, 6)
    for row in vals.values():
        for x in row:
            x[:] = [r3(v) for v in x]
    return vals, names


def skor(items, v):
    return sum(x[3] or 0 for x in v)


region_cabang = {}
ws_bb = wbv["Data BOM-BOS"]
for r in range(6, ws_bb.max_row + 1):
    k = kode(ws_bb[f"D{r}"].value)
    if k:
        region_cabang[k] = (str(ws_bb[f"B{r}"].value or "").strip(), str(ws_bb[f"C{r}"].value or "").strip())

AD, DET, laporan = {}, {}, []
for key, nama, _, sheet, lvl in JAB:
    items, src = butir(sheet)
    if lvl == "cabang":   # hanya cabang Region II (ukuran file)
        vals, names = nilai_unit(items, src, lambda ws, r: str(ws[f"B{r}"].value or "").strip() == FOKUS)
    elif lvl == "area":
        vals, names = nilai_unit(items, src)
        vals = {k: v for k, v in vals.items() if names[k].upper().startswith("AREA")}
    else:
        vals, names = nilai_unit(items, src)
        vals = {k: v for k, v in vals.items() if names[k].upper().startswith("REGION")}
    # kode unit untuk rekap (area/regional dicocokkan lewat nama; nama kembar diberi kode sesuai urutan baris)
    if lvl != "cabang":
        by = {}
        for k in vals:
            by.setdefault(names[k], []).append(k)
        used = {}
        for u in rekap[key]:
            ks = by.get(u["n"], [])
            i = used.get(u["n"], 0)
            if i < len(ks):
                u["k"] = ks[i]
                used[u["n"]] = i + 1
        dupes = {nm: ks for nm, ks in by.items() if len(ks) > 1}
    else:
        dupes = {}
        rekap[key] = [u for u in rekap[key] if region_cabang.get(u["k"], ("",))[0] == FOKUS]
        for u in rekap[key]:
            u["a"] = region_cabang[u["k"]][1]
    beda = 0
    for u in rekap[key]:
        v = vals.get(u.get("k"))
        if v is None:
            beda += 1
            laporan.append(f"{key}: tanpa rincian {u['n']}")
            continue
        t = skor(items, v)
        if abs(t - u["s"]) > 0.02:
            beda += 1
            laporan.append(f"{key}: selisih {u.get('k')} {u['n']} hitung {t:.3f} vs ranking {u['s']}")
    meta = [{k: v for k, v in it.items() if k != "_c"} for it in items]
    AD[key] = {"items": meta, "vals": vals if lvl != "regional" else {k: vals[k] for k in vals},
               "dupes": dupes}
    if lvl == "regional":   # rincian Region II dalam format lama (dipakai halaman KPI)
        v, rows, k = vals[FOKUS_KODE], [], 0
        for it in meta:
            if "p" in it:
                rows.append({"p": it["p"], "tot": 0})
                continue
            rr, tt, aa, x = v[k]
            k += 1
            rows.append({"g": it["g"], "n": it["n"], "w": it["w"], "r": rr, "t": tt, "a": aa, "v": x or 0})
        cur = None
        for x in rows:
            if "p" in x:
                cur = x
            elif cur:
                cur["tot"] = round(cur["tot"] + x["v"], 5)
        DET[key] = rows
        del AD[key]
    print(f"{key}: {len(rekap[key])} unit, {len([i for i in meta if 'n' in i])} butir KPI, "
          f"{len(vals)} unit berrincian, selisih skor {beda}")

TOTAL_BOM = sum(1 for r in wbv["Ranking BOM-BOS"].iter_rows(min_row=4, values_only=True)
                if len(r) > 1 and r[1] is not None and num(r[7] if len(r) > 7 else None) is not None)
jab = []
for key, nama, _, _, lvl in JAB:
    j = {"key": key, "nama": nama, "lvl": lvl, "unit": rekap[key]}
    if lvl == "cabang":
        j["total"] = TOTAL_BOM
    jab.append(j)

js = "window.KITO_KPI=" + json.dumps(
    {"periode": PERIODE, "fokus": FOKUS, "sumber": SRC.replace("\\", "/").split("/")[-1],
     "jabatan": jab, "detail": DET, "areaDetail": AD},
    ensure_ascii=False, separators=(",", ":")) + ";\n"
kito_data.tulis_teks_js(OUT, js)
print(f"Tulis {OUT}: {len(js):,} byte")
for x in laporan[:40]:
    print("  ", x)
