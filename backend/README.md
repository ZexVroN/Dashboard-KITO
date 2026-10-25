# KITO Backend — Push Notifikasi & Update Data

Server tunggal (Node ≥ 18, **tanpa `npm install`**) yang melayani dashboard sekaligus:

| Fitur | Di mana |
|---|---|
| **Push notifikasi custom** ke Android, iOS/iPadOS, Desktop, dan Website (banner dalam dashboard) | `/admin/` → *Kirim Notifikasi* |
| Jadwal kirim, template, riwayat, daftar perangkat, target per platform & per area | `/admin/` |
| **Update data dari Excel**: Waktu Tunggu Antrian, Utilisasi O2O, Utilisasi NBDS, Report Inbranch (MTD) | `/admin/` → *Update Data* |
| Export data (zip berkas `assets/js/*-data.js`) — hasil proses & data yang sedang tayang | `/admin/` → *Update Data* |

## 1. Menjalankan

```bash
# prasyarat: Node ≥ 18, Python 3 + openpyxl (untuk Update Data)
pip install openpyxl

cd Dashboard-KITO
KITO_ADMIN_PASSWORD='ganti-dengan-password-kuat' \
KITO_VAPID_SUBJECT='mailto:email-admin@bank.co.id' \
node backend/server.js
```

* Dashboard: `http://localhost:8080/` · Admin: `http://localhost:8080/admin/`
* Tanpa `KITO_ADMIN_PASSWORD`, password acak dibuat dan **dicetak sekali** di konsol (disimpan sebagai hash di `backend/data/admin.json`; bisa diganti di *Pengaturan*).
* Uji: `node backend/selftest.js` (kriptografi Web Push, termasuk vektor uji resmi RFC 8291) dan `node backend/test-e2e.js <Report_Inbranch.xlsx>` (alur lengkap tanpa jaringan).

### Variabel lingkungan
| Variabel | Default | Fungsi |
|---|---|---|
| `PORT` / `KITO_HOST` | `8080` / `0.0.0.0` | alamat dengar |
| `KITO_ADMIN_PASSWORD` | acak (dicetak) | password admin (menimpa yang tersimpan) |
| `KITO_VAPID_SUBJECT` | `mailto:admin@example.com` | kontak yang dilihat layanan push (**isi email asli**) |
| `KITO_SITE_DIR` | folder induk `backend/` | lokasi dashboard (berisi `index.html`) |
| `KITO_DATA_DIR` | `backend/data` | langganan, riwayat, kunci, unggahan, backup |
| `KITO_TLS_KEY`, `KITO_TLS_CERT` | – | HTTPS langsung dari Node |
| `KITO_TRUST_PROXY` | – | `1` bila di belakang reverse proxy (nginx/Caddy) yang meneruskan `X-Forwarded-*` |
| `KITO_PYTHON` | `python3` | perintah Python untuk skrip `tools/` |
| `KITO_PUSH_HOSTS` | – | tambahan host layanan push yang diizinkan (koma) |

## 2. Wajib HTTPS
Service Worker & Web Push hanya jalan di **HTTPS** (kecuali `localhost`). Pola yang disarankan: Node di `127.0.0.1:8080`, nginx/Caddy menangani TLS:

```nginx
server {
  listen 443 ssl http2; server_name kito.contoh.co.id;
  client_max_body_size 450m;          # unggahan Excel besar
  proxy_read_timeout 3600s; proxy_request_buffering off;
  location / { proxy_pass http://127.0.0.1:8080; proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Forwarded-For $remote_addr; }
}
```
lalu jalankan dengan `KITO_TRUST_PROXY=1`. **Batasi `/admin/` dan `/api/admin/`** ke jaringan internal/VPN bila memungkinkan.

## 3. Cara kerja per platform
Semua platform memakai standar **Web Push (VAPID)** — tidak perlu akun FCM/APNs atau aplikasi native.

| Platform | Syarat pengguna |
|---|---|
| **Android** (Chrome, Edge, Firefox, Samsung Internet) | buka dashboard → ketuk 🔔 → *Aktifkan*. Bisa juga dipasang ke Layar Utama. |
| **iOS / iPadOS** (≥ 16.4) | **wajib** *Tambah ke Layar Utama* (Safari → Bagikan), buka dari ikon, lalu ketuk 🔔 → *Aktifkan*. Di tab Safari biasa push tidak tersedia (batasan Apple). |
| **Desktop** (Chrome, Edge, Firefox, Safari 16+) | buka dashboard → 🔔 → *Aktifkan* → izinkan di browser. |
| **Website** | pengumuman yang dicentang *"tampilkan juga sebagai banner"* muncul di dashboard bagi siapa pun (termasuk yang tidak berlangganan). |

Perangkat dikelompokkan otomatis dari User-Agent saat berlangganan; pengguna juga bisa memilih **Fokus area** (mis. JAMBI) sehingga admin dapat menarget per area. Langganan yang sudah tidak berlaku (HTTP 404/410) dibersihkan otomatis saat kirim.

**Tautan dalam:** isi *Saat diketuk, buka* dengan `/?tab=ranking|region|area|cabang` — dashboard langsung membuka tab itu.

## 4. Update Data dari Excel
1. *Update Data* → unggah file export (xlsx, sampai 400 MB; dikirim sebagai stream ke disk).
2. Centang jenis data → **Proses & buat pratinjau**. Server menjalankan skrip di `tools/` pada salinan **staging** (data tayang tidak tersentuh), memvalidasi nama sheet, dan memuat ulang hasilnya untuk memastikan berkas valid.
3. Periksa ringkasan (tanggal lama → baru, jumlah cabang, berkas berubah) → **Publikasikan**. Otomatis: backup berkas lama, ganti berkas, dan naikkan `?v=` di `index.html` (cache-busting). Opsional kirim push "Data diperbarui".
4. Salah publish? *Backup → Pulihkan*.

| Jenis data | File Excel | Skrip | Menulis |
|---|---|---|---|
| Waktu Tunggu Antrian | `DDMMYYYY_Dashboard_Antrian_Cabang.xlsx` | `update_antrian_o2o.py`, `build_region.py` | `data.js`, `area-waktu-data.js`, `area-kelompok-data.js`, `region-data.js` |
| Utilisasi O2O | `Dashboard_Monitoring_Ganti_Kartu_DD_Okt_26.xlsx` | `update_antrian_o2o.py`, `build_region.py` | `data.js`, `area-o2o-data.js`, `region-data.js` |
| Utilisasi NBDS | `Monitoring_Utilisasi_NBDS_sd_DD_Oktober_2026.xlsx` | `convert_nbds_bankwide.py`, `build_region.py` | `area-nbds-data.js`, `data.js`, `region-data.js` |
| Report Inbranch (MTD) | `Report Inbranch (MTD) - DD Oktober.xlsx` | `convert_inbranch.py` (**baru**) | `infografis-data.js`, `pegawai-data.js` |

Pembaruan harian memakai **tiga file sekaligus** (Antrian + O2O + NBDS) karena skrip saling bergantung; file yang pernah diunggah dipakai ulang bila tidak diganti. Inbranch berdiri sendiri. Memproses file Antrian ±160 MB memakan beberapa menit; proses berjalan di server, halaman boleh ditutup.

Verifikasi: menjalankan pipeline pada file 22 Okt menghasilkan berkas data **identik byte-per-byte** dengan yang ada di dashboard; `convert_inbranch.py` juga identik dengan data 16 Okt.

## 5. Keamanan
* Admin: password di-hash scrypt; sesi cookie `HttpOnly; SameSite=Strict` (+`Secure` bila HTTPS), kedaluwarsa 12 jam; permintaan ubah-data wajib header `X-Requested-With` (anti-CSRF); login dibatasi 6×/15 menit/IP.
* Endpoint publik dibatasi laju; alamat langganan **hanya** diterima dari host layanan push resmi (Google/Mozilla/Microsoft/Apple) → server tidak bisa dipakai untuk meminta alamat sembarang (SSRF).
* URL tujuan notifikasi disaring (hanya jalur relatif atau http/https). `backend/`, `tools/`, `*.py`, `*.md`, `*.xlsx`, file tersembunyi **tidak** disajikan. Unggahan hanya `.xlsx` valid (magic bytes) ke slot yang dikenal.
* `backend/data/` berisi kunci VAPID privat & rahasia sesi — jangan di-commit/dibagikan (sudah di `.gitignore`). **Mengganti/menghapus kunci VAPID membuat semua langganan lama tidak valid.**
* Catatan: langganan push menyimpan jenis browser/OS dan fokus area, **tanpa** nama/identitas pengguna.

## 6. Struktur
```
backend/server.js          router, push, penjadwal, file statis
backend/lib/webpush.js     VAPID + enkripsi aes128gcm (RFC 8291/8292)
backend/lib/updater.js     unggah → staging → publikasi/rollback
backend/lib/{store,auth,zip}.js
backend/admin/             halaman admin (index.html, admin.css, admin.js)
sw.js                      service worker dashboard (push + klik notifikasi)
assets/js/push.js          tombol 🔔, panel izin, banner, tautan ?tab=
assets/css/push.css
tools/convert_inbranch.py  Report Inbranch → infografis/pegawai-data.js
tools/inspect_xlsx.py      baca daftar sheet xlsx tanpa memuat file
```
