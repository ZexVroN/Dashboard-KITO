import sys, json, warnings
import pandas as pd

warnings.filterwarnings("ignore")

MASK_ID = True  # True = User ID di tabel Old BDS hanya tampil 4 digit terakhir
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "data.js"

dr = pd.read_excel(src, sheet_name="Data Raw")
ob = pd.read_excel(src, sheet_name="Raw Old BDS")
ls = pd.read_excel(src, sheet_name="Lists", usecols="A:L")
raw = pd.read_excel(src, sheet_name="Lists", header=None)
bw = float(raw.iat[19, 12]) / float(raw.iat[19, 14])  # Avg Bankwide O2O (M20/O20)


def sec(x):

    return (
        None
        if pd.isna(x)
        else round(x.hour * 3600 + x.minute * 60 + x.second + x.microsecond / 1e6, 1)
    )


def s(x):
    return "" if pd.isna(x) else str(x).strip()


def n(x):
    return None if pd.isna(x) else int(x)


dates = sorted(dr["Tanggal"].unique())
dstr = [pd.Timestamp(d).strftime("%Y-%m-%d") for d in dates]
mdate = pd.Timestamp(dr.dropna(subset=["O2O"])["Tanggal"].max()).strftime("%Y-%m-%d")

# Kolom kelompok dibaca berdasarkan urutan (kolom ke-5,6 untuk Teller, ke-8,9 untuk CS),
# jadi nama bulan di judul kolom boleh berubah.
kol = list(ls.columns)


def label(c):  # 'Kel_Tel_30_Sept' -> '30 Sept'
    return " ".join(str(c).split("_")[2:])


kl = [label(kol[4]), label(kol[5])]

B, idx = [], {}
for _, r in ls.iterrows():
    idx[r["Cabang"]] = len(B)
    B.append(
        [
            int(r["Kode Cabang"]),
            r["Cabang"],
            r["Area"],
            s(r["Kelas Cabang"]),
            "",  # NAMA
            "",  # NO HP
            n(r.iloc[4]),
            n(r.iloc[5]),
            s(r["Keterangan"]),
            n(r.iloc[7]),
            n(r.iloc[8]),
            s(r["Keterangan2"]),
        ]
    )

Q = [[None] * len(dates) for _ in B]
M = [None] * len(B)
cols = [
    "O2O",
    "NBDS",
    "CSM",
    "Old BDS",
    "FP_Nbds",
    "FP_Old",
    "FNP_NBDS",
    "FNP_Old",
    "NF_NBDS",
    "NF_Old",
]
for _, r in dr.iterrows():
    if r["Cabang"] not in idx:
        continue
    b = idx[r["Cabang"]]
    d = dstr.index(pd.Timestamp(r["Tanggal"]).strftime("%Y-%m-%d"))
    Q[b][d] = [
        sec(r["Waktu Teller"]),
        sec(r["Waktu CS"]),
        sec(r["Seluruh Waktu Antri"]),
    ]
    if pd.Timestamp(r["Tanggal"]).strftime("%Y-%m-%d") == mdate:
        M[b] = [n(r[c]) for c in cols]


def mask(v):
    v = s(v)
    return ("•••" + v[-4:]) if (MASK_ID and len(v) > 4) else v


O = []
for _, r in ob.iterrows():
    if r["nama_cabang"] in idx:
        O.append(
            [
                idx[r["nama_cabang"]],
                s(r["service"]),
                s(r["cif_class"]),
                mask(r["usrnam"] if s(r["usrnam"]) else r["user_id"]),
                s(r["Kategorisasi"]),
                s(r["flag_bds"]),
            ]
        )

data = dict(dates=dstr, mdate=mdate, bw=bw, B=B, Q=Q, M=M, O=O, kl=kl)
js = "const D = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
open(out, "w", encoding="utf8").write(js)
print(
    f"OK -> {out}  ({len(js) / 1024:.0f} KB, {len(B)} cabang, {len(dstr)} tanggal, data utilisasi: {mdate})"
)
