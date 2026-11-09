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
- API dipakai bersama oleh dashboard dan skrip update harian.

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

## Pemantauan perangkat & lokasi akses

Dashboard memuat `assets/js/pantau.js`, yang mengirim heartbeat ringan ke `POST /api/presence/ping` tiap 60 detik selama tab terlihat (dan tanda selesai saat tab ditutup).

- **Halaman admin**: `https://domain-anda/push-php/admin/perangkat` (atau `…/index.php/admin/perangkat`), memakai token admin yang sama.
  Isinya: perangkat yang aktif sekarang, perangkat hari ini/periode, pembagian per provinsi, kota, ISP, area & cabang dashboard, OS, jenis aplikasi (browser/PWA/APK), jabatan login KPI, halaman, grafik per hari dan per jam (WIB), serta daftar semua perangkat (bisa diberi label atau dihapus).
- **Aktif** = ada heartbeat dalam 150 detik terakhir. Satu perangkat dengan beberapa tab dihitung satu perangkat.
- **Lokasi** diperkirakan dari IP (tingkat kota, bukan GPS; tidak ada izin lokasi yang diminta ke pengguna). IP dikirim ke layanan `ipwho.is` lalu disimpan di cache selama 30 hari. Pengisian lokasi berjalan saat halaman admin dibuka dan di `cron.php`. Untuk mematikannya, tambahkan `'geo' => 'off'` di `data/config.php`.
- **ID perangkat** berupa kode acak di `localStorage` browser. Jika pengguna menghapus data situs atau memakai mode penyamaran, perangkat itu tercatat sebagai perangkat baru.
- Riwayat sesi disimpan 180 hari, lalu dihapus otomatis.
- **Unduh data**: tombol ⬇ Perangkat, ⬇ Riwayat sesi, dan ⬇ Rekap lokasi di halaman admin. Hasilnya CSV untuk periode yang dipilih, bisa langsung dibuka di Excel (pemisah titik koma, waktu WIB). Lewat API: `GET /api/presence/export?jenis=perangkat|sesi|lokasi&days=30` dengan header `Authorization: Bearer <token admin>`.
- API admin: `GET /api/presence/summary?days=7`, `GET /api/presence/devices?days=30&q=…`, `PUT /api/presence/devices/<id>` `{label}`, `DELETE /api/presence/devices/<id>`.

## Masukan pengguna (rating & keluhan)

Di tab **Cabang** dashboard ada tombol **💬 Masukan** (kanan bawah) yang membuka popup dua tab:

- **⭐ Rating aplikasi**: 1–5 bintang, aspek yang dinilai (kecepatan, tampilan, akurasi data, dll.), komentar opsional. Satu perangkat hanya punya satu rating per hari; kirim ulang di hari yang sama akan memperbarui rating itu.
- **📝 Keluhan**: jenis keluhan, uraian (wajib), nama dan kontak (opsional).
- **🏢 Keluhan Cabang**: laporan masalah operasional di cabang yang sedang dipilih (mesin antrian/Inbranch error, printer tiket, layar display, jaringan, antrian menumpuk, petugas kurang, komplain nasabah, fasilitas). Isinya tingkat urgensi (rendah, sedang, tinggi, kritis), waktu kejadian, dan uraian. Nama pelapor dan kontak wajib diisi supaya bisa dihubungi balik.

Cabang, area, tanggal data yang dilihat, jabatan login KPI, dan jenis perangkat ikut terkirim. Popup rating juga muncul sendiri, paling cepat setelah pengguna membuka dashboard di 3 hari berbeda dan 90 detik di tab Cabang. Setelah itu paling sering sekali tiap 30 hari, dan tidak muncul lagi selama 60 hari setelah pengguna memberi rating. Kalau perangkat offline, kiriman disimpan dan terkirim otomatis saat kembali online.

Halaman admin: menu **💬 Masukan** (`…/admin/masukan`). Isinya rata-rata rating, persentase puas/kecewa, sebaran bintang, aspek, jenis keluhan, per area/cabang, dan daftar masukan. Status keluhan bisa diubah (baru, diproses, selesai, ditolak), catatan tindak lanjut bisa ditambahkan, dan daftar bisa diunduh sebagai CSV.

API: `POST /api/feedback` (publik, maks. 10 per menit per IP) · `GET /api/feedback?days=&jenis=&status=&q=` · `GET /api/feedback/summary?days=` · `PUT /api/feedback/<id>` `{status, catatan}` · `GET /api/feedback/export` (admin).
