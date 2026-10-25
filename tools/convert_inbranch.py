"""Report Inbranch (MTD) -> assets/js/infografis-data.js + assets/js/pegawai-data.js

Pemakaian (dari folder dashboard):
    python tools/convert_inbranch.py "Report Inbranch (MTD) - 16 Oktober.xlsx" [--reg 02] [--out assets/js]

Membaca:
    - sheet "Laporan Cabang": akuisisi per cabang (Input CAKRA, New CIF, Prioritas, Pebisnis, Individu, Payroll, target New CIF)
    - sheet "pegawai"      : target/capaian per pegawai (New CIF, Pebisnis, Individu, Wealth=Prioritas, Payroll, ETB)
Tanggal laporan diambil dari kolom tanggal terakhir di header sheet "Laporan Cabang".
Hanya baris Region II (kolom Reg = '02') yang ditulis. Nilai pegawai dibulatkan ke atas (ceil) agar
konsisten dengan data sebelumnya. Nama pegawai ditulis apa adanya seperti di laporan.
"""
import argparse, datetime, json, math, os, sys
from openpyxl import load_workbook


def ceil_num(v):
    if v is None or isinstance(v, str):
        return 0
    return math.ceil(v) if abs(v - round(v)) > 1e-9 else int(round(v))


def num(v):
    if v is None or isinstance(v, str):
        return 0
    return int(v) if float(v).is_integer() else v


def laporan_cabang(ws, reg):
    rows = list(ws.iter_rows(values_only=True))
    # header blok ada di baris ke-2, tanggal/label di baris ke-3
    blok_row, tgl_row = rows[1], rows[2]
    blok = {}
    for j, v in enumerate(blok_row):
        if isinstance(v, str) and v.strip():
            blok[v.strip()] = j

    def kolom_terakhir(nama):
        if nama not in blok:
            raise SystemExit(f"Blok '{nama}' tidak ditemukan di sheet Laporan Cabang.")
        j = blok[nama]
        last = None
        while j < len(tgl_row) and isinstance(tgl_row[j], datetime.datetime):
            last = j
            j += 1
        if last is None:
            raise SystemExit(f"Kolom tanggal untuk blok '{nama}' tidak ditemukan.")
        return last, j  # j = kolom setelah tanggal terakhir (biasanya 'Target'/'DoD')

    c_cakra, _ = kolom_terakhir("Input CAKRA")
    c_cif, c_after = kolom_terakhir("Akuisisi New CIF All")
    c_prio, _ = kolom_terakhir("Akuisisi New CIF Rek Prioritas")
    c_pebi, _ = kolom_terakhir("Akuisisi New CIF Rek Pebisnis")
    c_indi, _ = kolom_terakhir("Akuisisi New CIF Rek Individu")
    c_pay, _ = kolom_terakhir("Akuisisi New CIF Rek Payroll")
    if str(tgl_row[c_after]).strip().lower() != "target":
        raise SystemExit("Kolom 'Target' New CIF tidak ditemukan tepat setelah kolom tanggal terakhir.")
    tanggal = tgl_row[c_cif].date().isoformat()

    out = []
    for r in rows[3:]:
        if not r or r[0] is None or not str(r[0]).strip().isdigit():
            continue
        if str(r[4]).strip() != reg:
            continue
        out.append({
            "kode": str(r[0]).strip(), "area": r[5], "cabang": r[6],
            "pegawai": num(r[13]), "cakra": num(r[c_cakra]), "cif": num(r[c_cif]),
            "prioritas": num(r[c_prio]), "pebisnis": num(r[c_pebi]), "individu": num(r[c_indi]),
            "payroll": num(r[c_pay]), "target_cif": ceil_num(r[c_after]),
        })
    return tanggal, out


def pegawai(ws, reg):
    # cari baris header "Kode Cabang" (kolom 7) agar tahan terhadap pergeseran baris
    head = None
    buf = []
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        buf.append(r)
        if head is None and r and len(r) > 13 and r[7] == "Kode Cabang" and r[12] == "Nama Pegawai":
            head = i
    if head is None:
        raise SystemExit("Header sheet 'pegawai' (Kode Cabang / Nama Pegawai) tidak ditemukan.")
    # blok metrik: (akuisisi, target, gap) per indikator, dibaca dari header baris atas (nama blok) & baris header
    judul = buf[head - 1]
    def cari(label, mulai=0):
        for j in range(mulai, len(judul)):
            if isinstance(judul[j], str) and judul[j].strip().lower().startswith(label.lower()):
                return j
        raise SystemExit(f"Judul kolom '{label}' tidak ditemukan di sheet pegawai.")
    # urutan blok di sheet: New CIF(MTD) -> New Acc ETB -> Pebisnis -> Individu -> Prioritas(Wealth) -> Payroll
    # kolom "Akuisisi" = judul-blok + 5 (di laporan ini: 25->30, 35->36, 41->42, ...). Pakai posisi relatif ke header "Target".
    hdr = buf[head]
    target_cols = [j for j, v in enumerate(hdr) if v == "Target"][:6]
    if len(target_cols) < 6:
        raise SystemExit("Kolom 'Target' New CIF/ETB/Pebisnis/Individu/Prioritas/Payroll kurang dari 6.")
    nama_ind = ["cif", "etb", "pebisnis", "individu", "prioritas", "payroll"]
    posisi = {k: (t - 1, t, t + 2) for k, t in zip(nama_ind, target_cols)}   # akuisisi, target, gap
    urut = ["cif", "pebisnis", "individu", "prioritas", "payroll", "etb"]
    out = []
    for r in buf[head + 3:]:
        if not r or r[7] is None or str(r[3]).strip() != reg:
            continue
        if not str(r[7]).strip().isdigit():
            continue
        m = {k: [ceil_num(r[posisi[k][0]]), ceil_num(r[posisi[k][1]]), ceil_num(r[posisi[k][2]])] for k in urut}
        out.append({"kode": str(r[7]).strip(), "cabang": r[9], "nama": r[12], "jabatan": r[13], "metrics": m})
    return out


def tulis(path, nama_var, obj):
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"window.{nama_var}=" + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + ";\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--reg", default="02")
    ap.add_argument("--source-name", default=None, help="nama file asli yang dicatat di field source (default: nama file xlsx)")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "js"))
    a = ap.parse_args()
    wb = load_workbook(a.xlsx, read_only=True, data_only=True)
    for s in ("Laporan Cabang", "pegawai"):
        if s not in wb.sheetnames:
            sys.exit(f"Sheet '{s}' tidak ada di {os.path.basename(a.xlsx)}. Sheet tersedia: {wb.sheetnames}")
    nama = a.source_name or os.path.basename(a.xlsx)
    tanggal, rows = laporan_cabang(wb["Laporan Cabang"], a.reg)
    peg = pegawai(wb["pegawai"], a.reg)
    if not rows:
        sys.exit("Tidak ada baris Region II di Laporan Cabang.")
    tulis(os.path.join(a.out, "infografis-data.js"), "KITO_INFO_DATA",
          {"tanggal": tanggal, "source": f"{nama} · Laporan Cabang", "rows": rows})
    tulis(os.path.join(a.out, "pegawai-data.js"), "KITO_PEGAWAI_DATA", {"tanggal": tanggal, "rows": peg, "source": f"{nama} · pegawai"})
    print(f"Inbranch MTD {tanggal}: {len(rows)} cabang, {len(peg)} pegawai -> {os.path.normpath(a.out)}")


if __name__ == "__main__":
    main()
