# Source Code Android WebView KITO (Dengan Dukungan Push Notifikasi)

Folder ini berisi kode sumber Android Studio untuk **Dashboard KITO versi 1.1 (versionCode 2)** dengan integrasi **Push Notifikasi Native Android WebView**.

---

## 🌟 Cara Kerja Notifikasi di Android WebView

Aplikasi Android WebView biasa tidak mendukung Web Push standar (`PushManager`). Solusi ini menggabungkan:

1. **Jembatan JavaScript Interface (`KitoAndroid`)**:
   - `getDeviceId()`: Menyimpan UUID unik perangkat Android.
   - `requestPermission()`: Menampilkan dialog izin notifikasi sistem (Android 13+ / API 33+).
   - `showNotification(title, body, url)`: Memunculkan notifikasi native di status bar Android.
   - `saveTopics(topicsJson)`: Menyimpan topik langganan (mis. `semua`, `area:jambi`, `cabang:11000`).

2. **Pengecekan di Latar Belakang (*Background Worker*)**:
   - Dijalankan oleh Android `WorkManager` (`KitoNotificationWorker`) secara periodik (setiap 15 menit).
   - Memeriksa pembaruan ke server: `https://inbranch.region2.co.id/push-php/api/webview/poll?device_id=...&since_id=...`.
   - Jika ada notifikasi baru yang sesuai dengan topik langganan perangkat, Android akan langsung membunyikan suara dan menampilkan notifikasi di status bar, **meskipun aplikasi sedang ditutup / tidak dibuka**.

3. **In-App Toast & Notifikasi Saat Aplikasi Dibuka**:
   - Saat aplikasi sedang dibuka (*foreground*), `push.js` melakukan polling aktif tiap 45 detik.
   - Memunculkan banner mengambang dengan suara *chime* lembut dan tombol "Buka" yang langsung mengarahkan ke halaman/filter terkait.

---

## 🚀 Panduan Build APK di Android Studio

1. **Buka Project di Android Studio**:
   - Buka Android Studio › **Open**.
   - Pilih folder project Android Anda (atau salin file di folder `tools/android-webview-src/app/` ke project Android Studio yang sudah ada).

2. **File-file Utama yang Perlu Dimasukkan**:
   - `app/src/main/java/com/zexvron/dashboardkito/MainActivity.kt`
   - `app/src/main/java/com/zexvron/dashboardkito/KitoBridge.kt`
   - `app/src/main/java/com/zexvron/dashboardkito/KitoNotificationWorker.kt`
   - `app/src/main/AndroidManifest.xml`
   - `app/build.gradle.kts` (Pastikan dependensi `androidx.work:work-runtime-ktx` terpasang)

3. **Sinkronkan Gradle**:
   - Klik tombol **Sync Project with Gradle Files** di pojok kanan atas.

4. **Build APK Release**:
   - Menu **Build** › **Generate Signed Bundle / APK** (atau **Build APK(s)** untuk testing).
   - Pilih **APK**.
   - Masukkan Keystore signing key Anda.
   - Klik **Release**.

5. **Letakkan APK Baru di Dashboard**:
   - Salin file APK hasil build ke: `download/Dashboard-Kito.apk`.
   - Perbarui versi di `assets/js/apk-config.js`:
     ```js
     window.KITO_APK = {
       versi: '1.1',
       kode: 2, // Naikkan ke 2 agar banner pembaruan APK muncul di dashboard
       paket: 'com.zexvron.dashboardkito',
       file: 'download/Dashboard-Kito.apk',
       ukuran: '6,2 MB',
       tanggal: '2026-11-04',
     };
     ```

---

## 🧪 Cara Menguji Notifikasi

1. Buka aplikasi di HP Android.
2. Ikon **🔔** di pojok kanan atas bar header akan tampil dan bisa diketuk.
3. Ketuk **🔔** › Pilih topik yang diinginkan › Ketuk **Aktifkan notifikasi**.
4. Izinkan notifikasi saat dialog Android muncul.
5. Ketuk **Kirim tes**: Notifikasi akan langsung muncul di layar dan di bar status Android!
6. Saat ada rilis data harian baru lewat `update_harian_p95.py` atau pengiriman dari admin `push-php`, HP Android akan menerima notifikasi secara otomatis.
