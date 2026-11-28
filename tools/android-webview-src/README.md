# Sumber Android WebView KITO (untuk APK berikutnya, dengan notifikasi saat aplikasi ditutup)

Folder ini berisi kode sumber Android Studio untuk APK **berikutnya**. APK 1.0 yang saat ini beredar (`download/Dashboard-Kito.apk`, paket `com.zexvron.dashboardkito`) adalah WebView biasa **tanpa jembatan dan tanpa worker**. Sumber di folder ini belum dibangun maupun diuji di lingkungan pengembangan situs.

---

## Notifikasi KITO: apa yang sudah berjalan tanpa membuat APK baru

Semua ini berjalan dari situs dan server (`assets/js/notif-otomatis.js`, `push-php/`), termasuk untuk APK 1.0 yang sudah terpasang:

- Izin dan pendaftaran perangkat **otomatis saat aplikasi dibuka**, tidak lagi lewat ikon 🔔.
- Satu input admin (`/admin`, `POST /api/notifications`, atau `tools/kirim_notifikasi.py`) menjangkau semua jalur sekaligus: Web Push (Chrome, Edge, Firefox, Safari/PWA, aplikasi TWA) dan perangkat dalam-aplikasi.
- **APK 1.0 tidak mengaktifkan `setDomStorageEnabled`**, jadi `localStorage` bernilai `null` di dalamnya. `notif-otomatis.js` menyimpan ID perangkat dan kursor notifikasi di cookie sebagai cadangan; tanpa cadangan ini APK 1.0 tidak pernah terdaftar. APK baru dari sumber ini sudah mengaktifkan DOM storage.
- **APK 1.0 (WebView)** terdaftar sebagai perangkat dalam-aplikasi. Android WebView tidak punya Push API, jadi notifikasi tampil sebagai **banner saat KITO terbuka** (dicek tiap ±60 detik, dan saat aplikasi kembali ke layar) dan tersimpan di daftar 🔔. Saat aplikasi ditutup, notifikasi sistem tidak bisa muncul dari APK 1.0.

## Yang ditambahkan APK baru dari sumber ini

Notifikasi sistem di status bar **walau aplikasi ditutup**, lewat dua bagian:

1. **Jembatan JavaScript `window.KitoAndroid`** (`KitoBridge.kt`), yang otomatis dipakai `notif-otomatis.js` bila ada:
   - `getDeviceId()`: ID perangkat `wv-<uuid>`. Dipakai situs saat mendaftar, sehingga worker dan halaman memakai ID yang sama.
   - `requestPermission()`: dialog izin notifikasi Android 13+ (API 33+). Dipanggil otomatis saat aplikasi dibuka.
   - `saveTopics(topicsJson)`: topik terbaru (otomatis mengikuti login dan cabang).
   - `setLastNotifId(id)`: kursor notifikasi yang sudah diambil halaman, supaya worker tidak menampilkan ulang notifikasi yang sudah tampil sebagai banner.
   - `showNotification(title, body, url)`, `isNotificationEnabled()`, `getAppVersion()`.
   - User-Agent aplikasi berakhiran `KITO-Android/1`.
2. **Worker latar belakang** (`KitoNotificationWorker.kt`, `WorkManager`, tiap 15 menit): memanggil
   `https://inbranch.region2.co.id/push-php/api/webview/poll?device_id=...&since_id=...` dan menampilkan notifikasi native. Server mencocokkan topik perangkat yang didaftarkan situs lewat `POST /api/inapp/register`, jadi worker tidak perlu mengirim topik.

Kontrak endpoint (sudah ada di backend): `{ "ok": true, "notifications": [{ "id", "title", "body", "url" }], "latestId": 123 }`.

## Blokir screenshot untuk pengguna tanpa login (APK 1.1)

- `MainActivity.kt` memasang `FLAG_SECURE` **sejak aplikasi dibuka**: screenshot & rekam layar menghasilkan layar hitam,
  dan pratinjau di daftar aplikasi terbaru ikut hitam.
- `KitoBridge.setSecure(aktif)` dipanggil `assets/js/tamu-aman.js`: tetap aktif selama tanpa login, dilepas setelah login,
  aktif lagi setelah logout.
- **APK 1.0 tidak punya fitur ini**, dan halaman web tidak bisa memblokir screenshot sistem Android. Pemblokiran baru
  berlaku setelah pengguna memasang APK 1.1.
- `app/proguard-rules.pro` menjaga method `@JavascriptInterface` agar tidak dibuang R8 pada build release.
- Tanda tangani dengan **keystore yang sama dengan APK 1.0** supaya bisa dipasang menimpa versi lama. Keystore berbeda =
  Android menolak pembaruan, pengguna harus uninstall APK lama dulu.

---

## Panduan build APK di Android Studio

1. Buka Android Studio › **Open**, lalu pilih project Android Anda (atau salin isi `tools/android-webview-src/app/` ke project yang sudah ada).
2. File utama yang dimasukkan:
   - `app/src/main/java/com/zexvron/dashboardkito/MainActivity.kt`
   - `app/src/main/java/com/zexvron/dashboardkito/KitoBridge.kt`
   - `app/src/main/java/com/zexvron/dashboardkito/KitoNotificationWorker.kt`
   - `app/src/main/AndroidManifest.xml` (izin `POST_NOTIFICATIONS` dan `INTERNET`)
   - `app/build.gradle.kts` (dependensi `androidx.work:work-runtime-ktx`)
3. **Sync Project with Gradle Files**.
4. **Build** › **Generate Signed Bundle / APK** › **APK** › pilih keystore Anda › **Release**. Gunakan build release yang tidak `debuggable`. Keystore jangan dimasukkan ke repositori.
5. Salin APK ke `download/Dashboard-Kito.apk`, lalu naikkan versi di `assets/js/apk-config.js` (`versi`, `kode`, `ukuran`, `tanggal`) agar pengguna APK lama melihat banner pembaruan.

---

## Cara menguji

1. Pasang APK, lalu buka aplikasi. Dialog izin notifikasi Android muncul **otomatis** (Android 13+), tanpa membuka 🔔.
2. Di panel admin (`/admin`) kirim notifikasi ke topik `semua`.
3. Aplikasi terbuka: banner tampil dalam ±60 detik. Aplikasi ditutup: notifikasi status bar muncul dalam ±15 menit (batas minimum interval WorkManager).
4. Di 🔔 › **Kirim tes** untuk mencoba kapan saja. Panel admin menampilkan jumlah perangkat per jalur (Push, Dalam aplikasi) dan per jenis aplikasi (APK, TWA, PWA, Browser).
