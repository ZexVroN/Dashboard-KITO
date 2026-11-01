"""Kirim notifikasi push setelah data waktu tunggu diperbarui (ke backend KITO Push, folder push-php/).

Pemakaian (dari folder Dashboard-KITO):
    python tools/kirim_notifikasi.py                 # tanggal terbaru di data.js
    python tools/kirim_notifikasi.py --tanggal 2026-10-28 --uji   # tampilkan saja, tidak dikirim

Butuh environment variable:
    KITO_PUSH_URL    alamat push-php, mis. https://domain-anda/push-php
    KITO_PUSH_TOKEN  token admin push-php
    KITO_DASH_URL    (opsional) alamat dashboard untuk tautan notifikasi, default ./index.html

Yang dikirim (satu permintaan batch):
  - topik "semua"          : data tanggal X sudah diperbarui + ringkasan Region II (P95, jumlah cabang < 5 menit)
  - topik "area:<nama>"    : ringkasan area (P95 All, P100 All, reservasi)
  - topik "cabang:<kode>"  : peringatan hanya untuk cabang dengan P95 All >= 10 menit atau P100 All >= 30 menit
Dipanggil otomatis di akhir update_harian_p95.py bila KITO_PUSH_URL dan KITO_PUSH_TOKEN terisi.
"""

import argparse
import json
import os
import sys
import urllib.request

JS = "assets/js/"
BATAS_P95 = 600     # 10 menit
BATAS_P100 = 1800   # 30 menit
BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def baca(path, awalan):
    t = open(path, encoding="utf-8").read().strip()
    return json.loads(t[len(awalan):-1])


def jam(s):
    if s is None:
        return "–"
    s = int(round(s))
    return f"{s // 3600}:{s // 60 % 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60:02d}:{s % 60:02d}"


def tgl_pendek(iso):
    y, m, d = iso.split("-")
    return f"{int(d)} {BULAN[int(m) - 1]}"


def susun(tanggal=None, dash_url="./index.html"):
    D = baca(JS + "data.js", "const D = ")
    W = baca(JS + "area-waktu-data.js", "window.KITO_AREA_WAKTU=")
    tgl = tanggal or D["dates"][-1]
    if tgl not in D["dates"]:
        sys.exit(f"Tanggal {tgl} tidak ada di data.js")
    j = D["dates"].index(tgl)
    tp = tgl_pendek(tgl)
    url = f"{dash_url}{'&' if '?' in dash_url else '?'}tgl={tgl}"
    pesan = []

    # 1. semua: ringkasan Region II
    r2 = W["region"]["d"].get(tgl)
    q = [D["Q"][i][j] for i in range(len(D["B"])) if D["Q"][i][j] and D["Q"][i][j][2] is not None]
    hijau = sum(1 for v in q if v[2] < 300)
    rx = W["region"].get("x", {}).get(tgl)
    isi = f"P95 Region II {jam(r2[6]) if r2 else '–'} · {hijau} dari {len(q)} cabang di bawah 5 menit"
    if rx:
        isi += f" · {rx['n'][2]:,} reservasi".replace(",", ".")
    pesan.append({"title": f"Data waktu tunggu {tp} sudah diperbarui", "body": isi, "url": url,
                  "topics": ["semua"], "tag": "kito-update", "ttl": 86400})

    # 2. per area
    for a in W["areas"]:
        v, x = a["d"].get(tgl), a.get("x", {}).get(tgl)
        if not v:
            continue
        nama = a["name"]
        isi = f"P95 All {jam(v[6])} (Teller {jam(v[2])}, CS {jam(v[5])})"
        if x:
            isi += f" · P100 {jam(x['p'][2])} · {x['n'][2]:,} reservasi".replace(",", ".")
        pesan.append({"title": f"Area {nama.title()} · {tp}", "body": isi, "url": url,
                      "topics": ["area:" + " ".join(nama.lower().split())], "tag": "kito-area", "ttl": 86400})

    # 3. peringatan per cabang
    peringatan = 0
    for i, b in enumerate(D["B"]):
        v = D["Q"][i][j]
        p = (D.get("QP") or [[]] * len(D["B"]))[i]
        p = p[j] if j < len(p) else None
        p95 = v[2] if v else None
        p100 = p[2] if p else None
        if (p95 or 0) < BATAS_P95 and (p100 or 0) < BATAS_P100:
            continue
        sebab = []
        if (p95 or 0) >= BATAS_P95:
            sebab.append(f"P95 {jam(p95)}")
        if (p100 or 0) >= BATAS_P100:
            sebab.append(f"P100 {jam(p100)}")
        pesan.append({"title": f"⚠️ Waktu tunggu tinggi · {b[1]}", "body": f"{tp}: {' · '.join(sebab)}. Mohon dicek.",
                      "url": url, "topics": [f"cabang:{b[0]}"], "tag": f"kito-cabang-{b[0]}", "urgency": "high", "ttl": 86400})
        peringatan += 1
    return tgl, pesan, peringatan


def kirim(pesan, server, token):
    req = urllib.request.Request(server.rstrip("/") + "/api/notifications/batch", method="POST",
                                 data=json.dumps({"notifications": pesan, "source": "skrip"}).encode(),
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def jalankan(tanggal=None, uji=False):
    server, token = os.environ.get("KITO_PUSH_URL"), os.environ.get("KITO_PUSH_TOKEN")
    tgl, pesan, peringatan = susun(tanggal, os.environ.get("KITO_DASH_URL", "./index.html"))
    print(f"Notifikasi {tgl}: {len(pesan)} pesan (1 ringkasan, {len(pesan) - 1 - peringatan} area, {peringatan} peringatan cabang)")
    if uji:
        for p in pesan:
            print(f"  [{', '.join(p['topics'])}] {p['title']} — {p['body']}")
        return
    if not server or not token:
        print("  dilewati: KITO_PUSH_URL / KITO_PUSH_TOKEN belum diisi")
        return
    hasil = kirim(pesan, server, token)
    total = sum(h["sent"] for h in hasil["hasil"])
    print(f"  terkirim ke {total} perangkat (total semua pesan)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--tanggal")
    ap.add_argument("--uji", action="store_true", help="tampilkan isi notifikasi tanpa mengirim")
    a = ap.parse_args()
    jalankan(a.tanggal, a.uji)
