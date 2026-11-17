#!/usr/bin/env python3
"""Amankan password bawaan akun login KITO (akun yang belum pernah ganti password).

Masalah yang ditutup: hash SHA-256("jabatan:password") bawaan tertulis di assets/js/kpi-login.js (bisa dibaca publik)
dan server menerima hash itu apa adanya. Artinya siapa pun yang membuka kode situs bisa login sebagai akun bawaan
TANPA tahu password-nya.

Alat ini meminta password bawaan per jabatan (boleh sama dengan password sekarang, pengguna tidak perlu diberi tahu apa pun),
lalu menulis "bukti" baru ke dua tempat:
  - assets/js/kpi-login.js   -> KPI_BUKTI[jabatan]   (untuk cek login offline)
  - push-php/lib/akun.php    -> KP_AKUN_BUKTI[jabatan] (untuk server)
Yang ditulis hanya SHA-256 dari PBKDF2-SHA256(password, "kito-akun-v2:<jabatan>", 150000), sehingga nilai publik tidak bisa
dipakai untuk login. Hash lama jabatan itu dikosongkan di kedua file.

Password diketik di komputer Anda sendiri dan tidak disimpan di mana pun.

Pakai (dari folder Dashboard-KITO):
    python3 tools/amankan_password_bawaan.py            # semua jabatan, satu per satu (Enter = lewati)
    python3 tools/amankan_password_bawaan.py bom asm    # hanya jabatan tertentu
Setelah itu unggah ulang kpi-login.js DAN push-php/lib/akun.php bersamaan, lalu commit & push.
"""
import getpass
import hashlib
import re
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
JS = AKAR / 'assets' / 'js' / 'kpi-login.js'
PHP = AKAR / 'push-php' / 'lib' / 'akun.php'
JABATAN = ['roh', 'toh', 'sqor', 'asm', 'sqoa', 'atom', 'bom', 'admin']
ITERASI = 150000


def bukti(jab: str, pw: str) -> str:
    return hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), ('kito-akun-v2:' + jab).encode('utf-8'), ITERASI).hex()


def blok(teks: str, pola: str) -> re.Match:
    m = re.search(pola, teks, re.S)
    if not m:
        sys.exit(f'Blok tidak ditemukan: {pola}')
    return m


def baca_peta(isi: str, pemisah: str) -> dict:
    # baris "  kunci: 'nilai'," (JS) atau "  'kunci' => 'nilai'," (PHP)
    if pemisah == ':':
        return dict(re.findall(r"^\s*(\w+):\s*'([0-9a-f]*)'", isi, re.M))
    return dict(re.findall(r"^\s*'(\w+)'\s*=>\s*'([0-9a-f]*)'", isi, re.M))


def main() -> None:
    js, php = JS.read_text(encoding='utf-8'), PHP.read_text(encoding='utf-8')
    m_akun_js = blok(js, r"(const KPI_AKUN = \{\n)(.*?)(\n  \};)")
    m_bukti_js = blok(js, r"(const KPI_BUKTI = \{\n)(.*?)(\s*\};)")
    m_akun_php = blok(php, r"(const KP_AKUN_BAWAAN = \[\n)(.*?)(\n\];)")
    m_bukti_php = blok(php, r"(const KP_AKUN_BUKTI = \[\n)(.*?)(\s*\];)")
    lama = baca_peta(m_akun_js.group(2), ':')
    sudah = baca_peta(m_bukti_js.group(2), ':')
    sudah.update(baca_peta(m_bukti_php.group(2), '=>'))

    pilih = [j.lower() for j in sys.argv[1:]] or JABATAN
    for j in pilih:
        if j not in JABATAN:
            sys.exit(f'Jabatan tidak dikenal: {j} (pilihan: {", ".join(JABATAN)})')

    baru = {}
    for j in pilih:
        while True:
            pw = getpass.getpass(f'Password bawaan {j.upper()} (Enter = lewati): ')
            if not pw:
                break
            # bila hash lama masih ada, pastikan password yang diketik cocok (mencegah salah ketik mengunci semua akun bawaan)
            if lama.get(j) and hashlib.sha256(f'{j}:{pw}'.encode('utf-8')).hexdigest() != lama[j]:
                ya = input('  Tidak cocok dengan password bawaan saat ini. Pakai sebagai password bawaan BARU? (y/N) ').strip().lower()
                if ya != 'y':
                    continue
            if getpass.getpass('  Ulangi password: ') != pw:
                print('  Tidak sama, ulangi.')
                continue
            baru[j] = hashlib.sha256(bukti(j, pw).encode('ascii')).hexdigest()
            break
    if not baru:
        print('Tidak ada perubahan.')
        return

    sudah.update(baru)
    urut = [j for j in JABATAN if j in sudah]
    isi_js = ''.join(f"\n    {j}: '{sudah[j]}'," for j in urut)
    isi_php = ''.join(f"\n    '{j}' => '{sudah[j]}'," for j in urut)
    # kosongkan hash lama untuk jabatan yang sudah diamankan (kunci tetap ada agar daftar jabatan tidak berubah)
    akun_js = re.sub(r"^(\s*(\w+):\s*)'[0-9a-f]*'", lambda m: m.group(1) + ("''" if m.group(2) in sudah else m.group(0)[len(m.group(1)):]), m_akun_js.group(2), flags=re.M)
    akun_php = re.sub(r"^(\s*'(\w+)'\s*=>\s*)'[0-9a-f]*'", lambda m: m.group(1) + ("''" if m.group(2) in sudah else m.group(0)[len(m.group(1)):]), m_akun_php.group(2), flags=re.M)

    js = js[:m_akun_js.start(2)] + akun_js + js[m_akun_js.end(2):]
    m_bukti_js = blok(js, r"(const KPI_BUKTI = \{\n)(.*?)(\s*\};)")
    js = js[:m_bukti_js.start(1)] + 'const KPI_BUKTI = {' + isi_js + '\n  };' + js[m_bukti_js.end(3):]
    php = php[:m_akun_php.start(2)] + akun_php + php[m_akun_php.end(2):]
    m_bukti_php = blok(php, r"(const KP_AKUN_BUKTI = \[\n)(.*?)(\s*\];)")
    php = php[:m_bukti_php.start(1)] + 'const KP_AKUN_BUKTI = [' + isi_php + '\n];' + php[m_bukti_php.end(3):]
    JS.write_text(js, encoding='utf-8')
    PHP.write_text(php, encoding='utf-8')
    print('Diamankan:', ', '.join(j.upper() for j in baru))
    print('Unggah kpi-login.js dan push-php/lib/akun.php bersamaan, lalu commit & push.')


if __name__ == '__main__':
    main()
