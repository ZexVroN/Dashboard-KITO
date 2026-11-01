# KITO Push Server

Backend notifikasi push untuk Dashboard KITO: **website, desktop, Android, dan iOS** lewat satu standar, **Web Push (VAPID)**.
Tanpa dependensi luar: cukup Node.js 22.13+ (memakai `crypto`, `http`, dan `node:sqlite` bawaan).

| Platform | Cara menerima | Syarat |
|---|---|---|
| Website / Desktop (Windows, macOS, Linux) | Chrome, Edge, Firefox, Safari 16+ | Izinkan notifikasi |
| Android | Chrome / Edge / Samsung Internet, juga saat KITO dipasang sebagai aplikasi | Izinkan notifikasi |
| iPhone / iPad | Aplikasi KITO di Layar Utama | iOS/iPadOS **16.4+**, KITO harus **ditambahkan ke Layar Utama** dulu (aturan Apple), lalu izinkan dari dalam aplikasi |

Tidak perlu akun Firebase, sertifikat Apple, atau aplikasi native. Push service milik Google, Mozilla, Apple, dan Microsoft dihubungi langsung dengan kunci VAPID.

## Cara kerja

```
Dashboard (🔔)  --berlangganan-->  KITO Push Server  --simpan-->  SQLite
                                         |
Admin (/admin) / skrip update harian  --kirim-->  push service (FCM / Mozilla / Apple / WNS)  -->  perangkat (sw.js menampilkan)
```

Topik langganan:
- `semua`: pemberitahuan data harian sudah diperbarui, dengan ringkasan Region II.
- `area:<nama area>`, mis. `area:jambi` atau `area:palembang arief`: ringkasan area.
- `cabang:<kode>`, mis. `cabang:11000`: peringatan bila waktu tunggu cabang tinggi (P95 ≥ 10 menit atau P100 ≥ 30 menit).

## Menjalankan

### 1. Buat kunci

```bash
cd push-server
cp .env.example .env
npm run vapid          # salin 3 baris hasilnya ke .env
```

Lengkapi juga `VAPID_SUBJECT` (email pengelola) dan `ALLOWED_ORIGINS` (alamat dashboard, mis. `https://zexvron.github.io`).
**Jangan ganti kunci VAPID setelah ada pelanggan**: semua langganan lama akan berhenti berlaku.

### 2a. Docker (disarankan, sudah termasuk HTTPS otomatis)

Arahkan subdomain (mis. `push.domain-anda.id`) ke IP server, ganti nama domain di `Caddyfile`, lalu:

```bash
docker compose up -d
```

### 2b. Tanpa Docker

```bash
npm start              # port 8080; pasang di belakang Nginx/Caddy dengan HTTPS
```

Web Push **wajib HTTPS**, baik untuk dashboard maupun server ini. Dashboard di GitHub Pages sudah HTTPS.

### 3. Sambungkan dashboard

Isi alamat server di `assets/js/push-config.js`:

```js
window.KITO_PUSH = { api: 'https://push.domain-anda.id' };
```

Selama masih kosong, tombol 🔔 tidak tampil.

### 4. Cek kesiapan (wajib sekali setelah pasang)

Jalankan di server tempat push-server dipasang:

```bash
npm run cek -- --url https://push.domain-anda.id --origin https://zexvron.github.io
```

Yang dicek: `.env` lengkap, pasangan kunci VAPID, database bisa ditulis, koneksi keluar ke push service **Google, Mozilla, Apple, dan Microsoft** (Google sekaligus memeriksa JWT VAPID Anda), HTTPS, CORS untuk dashboard, token admin, dan halaman `/admin`. Semua harus ✔. Setelah itu buka dashboard di HP/laptop, lalu ketuk 🔔 › **Aktifkan** › **Kirim tes**.

### 5. Kirim notifikasi

- **Halaman admin** (notifikasi custom): buka `https://push.domain-anda.id/admin` lalu masukkan `ADMIN_TOKEN`. Isinya:
  - template cepat: Update data, Peringatan cabang, Pengumuman;
  - pratinjau langsung (Android/desktop dan iPhone);
  - gambar besar dan **2 tombol aksi** dengan tautan masing-masing;
  - target: topik (dengan saran topik dan perkiraan jangkauan), semua perangkat, atau per platform;
  - urgensi, tag, masa berlaku;
  - **kirim sekarang atau jadwalkan** (bisa dibatalkan sebelum terkirim);
  - statistik dan riwayat.
- **Terminal**: `npm run send -- --title "Judul" --body "Isi" --topic area:jambi`
- **Otomatis setiap update data**: set environment variable di komputer yang menjalankan update harian:
  ```bash
  set KITO_PUSH_URL=https://push.domain-anda.id      # Windows (PowerShell: $env:KITO_PUSH_URL="...")
  set KITO_PUSH_TOKEN=<ADMIN_TOKEN>
  python tools/update_harian_p95.py --antrian ... --o2o ... --nbds ...
  ```
  `update_harian_p95.py` lalu memanggil `tools/kirim_notifikasi.py`. Untuk melihat isi pesan tanpa mengirim: `python tools/kirim_notifikasi.py --uji`.

## API

Publik (dari browser dashboard; dibatasi CORS `ALLOWED_ORIGINS` dan 60 permintaan/menit per IP):

| Metode | Path | Body |
|---|---|---|
| GET | `/api/health` | |
| GET | `/api/vapid-public-key` | |
| POST | `/api/subscriptions` | `{subscription, topics?, label?, standalone?, oldEndpoint?}` |
| PUT | `/api/subscriptions/topics` | `{endpoint, topics}` |
| POST | `/api/subscriptions/status` | `{endpoint}` |
| DELETE | `/api/subscriptions` | `{endpoint}` |
| POST | `/api/subscriptions/test` | `{endpoint}`, kirim tes ke perangkat itu sendiri (5/menit) |

Admin (header `Authorization: Bearer <ADMIN_TOKEN>`):

| Metode | Path | Body |
|---|---|---|
| POST | `/api/notifications` | `{title, body?, url?, tag?, icon?, image?, actions?: [{title, url}] (maks 2), requireInteraction?, urgency?, ttl?, sendAt?: "2026-11-02T08:00:00+07:00", topics: [...] \| all: true \| endpoints: [...], platforms?: ["ios","android",...]}` |
| POST | `/api/notifications/batch` | `{notifications: [ ...maks 300 ]}` |
| GET | `/api/notifications?limit=50` | riwayat |
| GET | `/api/stats` | jumlah langganan per platform, browser, dan topik |
| GET | `/api/scheduled` | daftar notifikasi terjadwal & statusnya |
| DELETE | `/api/scheduled/<id>` | batalkan jadwal yang belum terkirim |

Catatan dukungan: tombol aksi dan gambar besar tampil di Chrome/Edge (desktop & Android). Safari dan iPhone menampilkan judul dan isi saja. Jadwal tersimpan di database, sehingga tetap jalan setelah server restart.

Contoh:

```bash
curl -X POST https://push.domain-anda.id/api/notifications \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Data 28 Okt sudah diperbarui","body":"P95 Region II 03:58","topics":["semua"],"url":"./index.html"}'
```

## Keamanan dan perawatan

- Endpoint langganan hanya diterima dari push service resmi (Google, Mozilla, Apple, Microsoft) untuk mencegah penyalahgunaan server sebagai proxy (SSRF).
- Token admin dibandingkan secara *timing-safe*; percobaan salah dibatasi.
- Langganan yang dicabut atau kedaluwarsa (respons 404/410), atau gagal 5 kali berturut-turut, otomatis dihapus.
- Server tidak menyimpan data nasabah. Yang disimpan hanya endpoint push, kunci enkripsi perangkat, topik, platform, dan riwayat judul notifikasi.
- Cadangkan folder `data/` (`push.db`) dan file `.env`.

## Pengujian

```bash
npm test
```

Isi pengujian: vektor uji resmi RFC 8291 untuk enkripsi; alur lengkap berlangganan → kirim per topik → dekripsi di "perangkat" tiruan; pembersihan langganan 410; validasi; batch; tombol aksi dan gambar; filter platform; serta jadwal (kirim saat jatuh tempo dan pembatalan).
