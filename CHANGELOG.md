# CHANGELOG — Dashboard KITO (Key Inbranch Tracking & Overview)

Ringkasan semua perubahan dari versi awal (`KITO_Dashboard_Animasi.zip`) sampai versi data **22 Oktober 2026**.
Format: setiap tahap berisi **apa yang berubah**, **file yang disentuh**, dan **catatan** bila ada keputusan metode.
Panduan arsitektur dan cara pembaruan data ada di [`DEVELOPER.md`](DEVELOPER.md).

---

## [v1.11] Deteksi offline + hapus tombol refresh
- **Halaman offline** (`offline.html`): tampil otomatis saat tidak ada koneksi internet dengan animasi, saran troubleshooting, dan deteksi kembali online.
- Skrip di `<head>` index.html: `navigator.onLine` diperiksa; jika offline, redirect ke `offline.html`; listener `offline` untuk perubahan status real-time.
- **Tombol ⟳ muat ulang** (v1.10) dihapus dari header — user dapat refresh lewat browser atau sistem operasi.
- **offline.html** support tema gelap/terang (sinkron dengan `localStorage`), safe-area padding iOS, dan tombol "Coba Lagi".
- File baru: `offline.html`. Diubah: `index.html`, `assets/css/pwa.css`.
- Catatan: fitur offline memerlukan browser yang support `navigator.onLine` (semua browser modern).

## [v1.10] iOS: layar penuh dari "Tambah ke Layar Utama"
- Meta iOS: `apple-mobile-web-app-capable`, status bar `black-translucent` (konten sampai ke bawah status bar; header sudah memakai `env(safe-area-inset-top)`), judul aplikasi **KITO**.
- `manifest.webmanifest` (display `standalone`, `display_override: fullscreen`), ikon 180/192/512 + maskable, favicon 32 px (menggantikan logo 1,2 MB).
- Layar pembuka iOS (`apple-touch-startup-image`) untuk 12 ukuran iPhone potret, dari `splash-portrait.png` (JPEG, hanya satu yang diunduh per perangkat).
- Mode aplikasi (`html.pwa`): tombol **⟳ Muat ulang** di header (tidak ada tombol refresh Safari), tanpa efek pantul layar, jarak aman poni saat landscape.
- File baru: `manifest.webmanifest`, `assets/css/pwa.css`, `assets/images/ios/*`. Diubah: `index.html`.
- Catatan: fitur ini hanya bekerja bila dashboard di-hosting lewat **HTTPS** (bukan dibuka sebagai file lokal).

## [v1.9] Kotak kanal rata tengah · Single/Multipel di tab Cabang
- Isi kotak kanal di Area → Waktu Tunggu dan Utilisasi NBDS (DtD & MTD) **rata tengah**.
- Tab Cabang → kartu *Waktu Antrian*: Teller & CS menampilkan **Single / Multipel** (P90) sesuai filter Tanggal; Semua TRX menampilkan "Gabungan Teller + CS".
- Format Single/Multipel di Area Waktu Tunggu disamakan (2 baris, angka tebal).
- Kartu *Utilisasi NBDS* tab Cabang: label "Teller Perusahaan" → **Teller Badan** (konsisten dengan menu lain).
- Data baru `D.QD` (harian) dan `D.QDM` (MTD): `[Teller single, Teller multipel, CS single, CS multipel]` per cabang.
- File: `assets/js/data.js`, `script.js`, `area-waktu.js`, `assets/css/style.css`, `area-waktu.css`, `tools/update_antrian_o2o.py`, `index.html`.
- Verifikasi: 856/856 nilai Single/Multipel 22 Okt = sheet *Per Cabang*.

## [v1.8] Detail Data Old BDS — format seragam + nomor urut
- Satu pembuat tabel bersama `tabelOldBds(rows, opt)` di `script.js`, dipakai oleh:
  - tab Cabang → kartu *Detail Data Old BDS*;
  - Area → Dashboard Utilisasi NBDS → rincian *Layanan Masih Lewat Old BDS*.
- Kolom: **No** · (Cabang) · Transaksi (+ nama layanan) · Nasabah · Kategori (chip kanal) · User ID · Total.
- Kartu tab Cabang: keterangan tanggal DtD + ringkasan jumlah per kanal; baris diurutkan per kanal.
- CSV kedua tabel kini memuat kolom No, Layanan, Kategori kanal.
- File: `script.js`, `area-nbds.js`, `style.css` (kelas `.ob-*`), `index.html`.

## [v1.7] Rapikan kotak kanal + animasi loading splash (± 6 detik)
- Kotak kanal (Area Waktu Tunggu & NBDS): struktur seragam `nama · nilai · status · info · footer`; footer pembanding selalu di dasar kotak, dua baris tetap ("▲ +0,8 pp" / "vs Reg. II"); selisih < 0,05 pp ditulis "≈ setara".
- Splash: bilah progres + persentase + tahapan muat + perkiraan sisa waktu. Ditutup saat progres 100% (6 dtk) **dan** dashboard sudah tergambar; ditahan di 95% bila belum siap; batas aman 12 dtk.
- Navigasi bawah baru muncul setelah splash ditutup (`html.kito-siap`).
- File: `splash.js` (ditulis ulang), `splash.css`, `animasi.css`, `area-waktu.js/.css`, `area-nbds.js`, `index.html`.

## [v1.6] Perbaikan Dashboard Region
- Desktop: kartu indikator disusun **satu kolom** (sebelumnya 3 kolom ≥1100 px → teks bertumpuk).
- Posisi gulir **tetap** saat ganti kategori/periode/pembanding (sebelumnya meloncat ke atas karena `render()` bawaan sempat mengisi `#app` dengan konten pendek).
- File: `region.js`, `region.css`, `index.html`.

## [v1.5] Data 22 Okt + menu **Region** (Region II vs 11 region lain)
- **Data per 22 Okt** untuk Waktu Antri, O2O/Shifting, Utilisasi NBDS (cabang, area, region).
- **Dashboard Region** (menu 🗺️ Region, sebelumnya halaman "dalam pengembangan"):
  - ringkasan peringkat Region II per kelompok indikator, pilihan DtD/MTD, dropdown **Bandingkan dengan** (Nasional / region lain);
  - 3 kartu skor: Waktu Antri (All/Teller/CS), Utilisasi NBDS (Agregat/T. Perorangan/T. Badan/CS), O2O & Shifting;
  - tabel *Region II vs pembanding* (9 indikator), daftar 12 region per indikator (+CSV), tren harian (Region II tebal, pembanding oranye, Nasional putus-putus, region lain abu-abu), rekap peringkat 12 region.
  - di tab Region header hanya menampilkan filter Tanggal.
- Konverter NBDS untuk **format bankwide** (`tools/convert_nbds_bankwide.py`) dan pembangun data region (`tools/build_region.py`), plus `tools/update_semua.py` (satu perintah).
- `update_antrian_o2o.py` diperluas: `area-kelompok-data.js`, `area-o2o-data.js`, `D.mdate`, tanggal laporan.
- ⚠️ **Perubahan metode MTD NBDS**: laporan bankwide tidak punya MTD s.d. tanggal laporan (hanya "1-19Okt26"), maka **MTD = jumlah harian 1 s.d. tanggal laporan** (konsisten dengan kolom bulanan "Sep26"). Angka MTD jadi lebih rendah dari metode lama (contoh JAMBI T. Perorangan 96,4% → 94,0%). Dicatat di `KITO_AREA_NBDS.metodeMTD` dan ditampilkan di catatan dashboard.
- File baru: `assets/js/region-data.js`, `region.js`, `assets/css/region.css`, `tools/convert_nbds_bankwide.py`, `tools/build_region.py`, `tools/update_semua.py`.

## [v1.4] Sinkronisasi data 21 Okt dengan 3 Excel bankwide
- Validasi: antrian (8.346 nilai), O2O, CSM, Old BDS, NBDS harian (9.630 sel) **identik** dengan Excel.
- Ditambahkan: antrian cabang **1 Okt**, antrian area **15 Okt** (dari sheet *Calc*).
- Kelas 3 cabang diperbarui (KCP PENDOPO, KCP TUGU MULYO, KCP SEKAYU: B.3 → B.4.1).
- **Shifting Digital** memakai NBDS seluruh transaksi ganti kartu (`D.M[i][10]`, sheet *Cabang by Channel*) sesuai rumus resmi; fallback ke `D.M[i][1]`. Region II 59,2% → 58,6% (= Excel).
- `D.bw` (rata-rata O2O Bankwide) 55,95% → 56,14%.
- O2O & Shifting di menu Ranking dibulatkan (bukan dipotong) agar sama dengan kartu lain.
- File baru: `tools/update_antrian_o2o.py`.

## [v1.3] Menu **Ranking** (Cabang & Area, semua indikator)
- Menu 🏆 Ranking di navigasi bawah (posisi paling kiri): level Cabang/Area, lingkup **Seluruh Region II · Area · Cabang** (sinkron dengan dropdown Area di header yang mendapat opsi "Seluruh Region II").
- 8 indikator: Waktu Antrian (Teller, CS, Semua TRX; DtD/MTD), Overall O2O, Shifting Digital, Utilisasi NBDS (T. Perorangan, T. Badan, CS; DtD/MTD).
- Ringkasan terbaik/Region II/terendah, posisi cabang terpilih (📌), 10 terbaik & 10 terendah / semua, CSV, **Rekap Peringkat** (matriks peringkat semua indikator + rata-rata peringkat).
- Lingkup **Cabang** = *Rapor Peringkat Cabang*: nilai + peringkat di Region & Area untuk semua indikator.
- Peringkat kompetisi (nilai sama = peringkat sama).
- Kartu "Ranking Cabang" di Area → Waktu Tunggu **dihapus** (digantikan menu Ranking).
- File baru: `assets/js/ranking.js`, `assets/css/ranking.css`.

## [v1.2] Shifting Digital level Area + Kategori NBDS di Ranking Cabang
- Area → Dashboard Infografis O2O: kartu **Shifting Digital** level area/Region II (rumus, peringkat 7 area, cabang terendah).
- Kartu Ranking Cabang (script.js) dibuat generik: metrik boleh membawa `fmt`, `kelas`, `valid`, `tgl`, `tie`, `sub`; tombol dikelompokkan per grup.
- File: `area-o2o.js/.css`, `script.js`, `style.css`.

## [v1.1] Rincian Layanan Old BDS
- Layanan Masih Lewat Old BDS bisa diketuk → jenis transaksi, cabang (klik → dashboard cabang), Detail Data Old BDS, CSV; filter kanal; "lihat semua".
- Tombol CSV bawaan kini juga muncul di tab Area.

## [v1.0] Dashboard **Utilisasi NBDS** di tab Area
- Sub-tampilan baru di registri `KITO_AREA_VIEWS`: kartu DtD/MTD, ranking area, tren harian, sebaran kategori cabang, cabang prioritas, layanan Old BDS, tabel per tanggal.
- Utilisasi = New BDS ÷ (New BDS + Old BDS), target ≥ 98%. Persentase NBDS **dipotong** 1 desimal (97,96% tidak tampil 98,0%).
- Tren: skala Y dari persentil 10; nilai di bawah skala (mis. anomali 8 Okt) digambar di dasar grafik dengan angka merah.
- File baru: `assets/js/area-nbds.js`, `area-nbds-data.js`, `assets/css/area-nbds.css`, `tools/convert_nbds.py`.

---

### Temuan data yang perlu dikonfirmasi ke pemilik laporan
- **8 Okt**: utilisasi NBDS anjlok di seluruh region (Nasional ±26–37%) → dugaan gangguan sistem; data antrian 8 Okt tidak ada di sumber.
- **CSM Area BENGKULU = 0** di semua cabang (sumber), sehingga Shifting Bengkulu murni dari O2O.
- Laporan NBDS Region 2 (format lama, 21 Okt): Old BDS MTD Customer Service di sheet *Area* tidak sama dengan Σ cabang → saat itu dipakai Σ cabang.
