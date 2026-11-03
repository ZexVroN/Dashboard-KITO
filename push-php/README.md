# KITO Push (versi PHP): backend notifikasi paling mudah

Backend push notification untuk Dashboard KITO, untuk **website, desktop, Android, dan iPhone/iPad (PWA)**.
Berjalan di **hosting PHP biasa**, termasuk semua paket Hostinger. Tidak perlu Node.js, terminal, Environment Variables, atau database terpisah.

| Butuh | Keterangan |
|---|---|
| PHP 7.4+ (disarankan 8.x) | ekstensi `openssl`, `curl`, `pdo_sqlite` (bawaan Hostinger) |
| HTTPS | Web Push wajib HTTPS; SSL gratis Hostinger sudah cukup |

## Pasang dalam 3 langkah

1. **Unggah**: hPanel › File Manager › `public_html`. Unggah `KITO-push-php.zip`, lalu klik kanan › **Extract**. Hasilnya folder `public_html/push/`.
   Bisa juga di subdomain, misalnya ekstrak di folder subdomain `api.region2.co.id`.
2. **Setup**: buka `https://domain-anda/push/setup.php` di browser.
   - Semua pemeriksaan harus ✔.
   - Isi email pengelola dan alamat dashboard, misalnya `https://zexvron.github.io`.
   - Klik **Aktifkan**, lalu **simpan token admin** yang tampil.
3. **Sambungkan dashboard**: isi `assets/js/push-config.js` dengan alamat yang ditampilkan halaman setup:
   ```js
   window.KITO_PUSH = { api: 'https://domain-anda/push' };
   ```
   Tombol 🔔 akan muncul di dashboard.

Selesai. Halaman admin ada di `https://domain-anda/push/admin` (atau `…/push/index.php/admin`).

### Disarankan

- **Cron Job** tiap 5 menit, agar notifikasi terjadwal terkirim tepat waktu (perintah lengkapnya ditampilkan di halaman setup):
  hPanel › Advanced › Cron Jobs › Custom: `curl -s "https://domain-anda/push/cron.php?key=…" >/dev/null`.
  Tanpa cron, jadwal tetap diproses saat ada aktivitas di backend.
- Buka `status.php` › **Uji koneksi push service** untuk memastikan hosting bisa menghubungi Google, Apple, Mozilla, dan Microsoft.
- Uji dari HP: dashboard › 🔔 › **Aktifkan** › **Kirim tes**. Untuk iPhone, tambahkan dashboard ke Layar Utama dulu (iOS 16.4+).

## Fitur

- Langganan per topik: `semua`, `area:<nama>`, `cabang:<kode>`.
- Halaman admin:
  - template, pratinjau Android/desktop & iPhone;
  - gambar dan 2 tombol aksi;
  - target topik, semua perangkat, atau per platform;
  - kirim sekarang atau **jadwalkan**, plus statistik dan riwayat.
- **Otomatis dari skrip update harian**: `KITO_PUSH_URL=https://domain-anda/push` dan `KITO_PUSH_TOKEN=<token admin>` lalu jalankan `tools/update_harian_p95.py`.
- API sama persis dengan versi Node (`push-server/`), jadi dashboard dan skrip tidak perlu diubah.

## Keamanan

- Kunci VAPID dan token admin tersimpan di `data/config.php`. Folder `data/` dan `lib/` ditolak dari browser lewat `.htaccess`.
- Hanya endpoint push service resmi yang diterima; token admin dibandingkan aman; percobaan salah dan permintaan publik dibatasi.
- Langganan yang kedaluwarsa (404/410) atau gagal 5 kali dihapus otomatis.
- **Lupa token?** Buka `data/config.php` lewat File Manager, lihat `admin_token`.
- **Jangan hapus** `data/config.php` setelah ada pelanggan: kunci baru membuat semua langganan lama tidak berlaku. Cadangkan folder `data/`.

## Bila ada masalah

Buka `status.php`. Halaman ini menunjukkan versi PHP, ekstensi, izin folder, konfigurasi (tanpa rahasia), apakah `/api/...` bekerja, serta tes koneksi ke push service.
- Kalau hanya `index.php/api/...` yang ✔, rewrite `.htaccess` tidak aktif. Isi `push-config.js` dengan `api: 'https://domain-anda/push/index.php'`.
- Error PHP tercatat di `error_log` dalam folder `push/` atau di log error hosting.
