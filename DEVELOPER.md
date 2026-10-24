# Panduan Developer — Dashboard KITO

Dashboard monitoring layanan inbranch **Region II / Sumatera 2** (214 cabang, 7 area) dengan pembanding 12 region bankwide.
Riwayat perubahan per versi: [`CHANGELOG.md`](CHANGELOG.md).

| Aspek | Keterangan |
|---|---|
| Teknologi | HTML + vanilla JS (tanpa framework, tanpa build step) + CSS. Dibuka langsung dari `index.html`. |
| Data | Ditanam di file `assets/js/*-data.js` (dihasilkan skrip Python di `tools/`). Tidak ada backend/fetch. |
| Target layar | Mobile-first (uji di 360–390 px), juga desktop. Tema terang/gelap (`html[data-theme="dark"]`). |
| Data terakhir | **22 Oktober 2026** (antrian, O2O, NBDS); infografis & pegawai: 16 Oktober 2026. |

---

## 1. Peta fitur (navigasi bawah)

| Menu | Isi | Modul utama |
|---|---|---|
| 🏆 **Ranking** | Level Cabang/Area · lingkup Seluruh Region II / Area / **Cabang (Rapor Peringkat)** · 8 indikator · DtD/MTD · 10 terbaik/terendah · CSV · Rekap Peringkat (matriks + rata-rata peringkat) | `ranking.js` |
| 🗺️ **Region** | Region II vs 11 region lain: kartu skor 3 indikator, pembanding (Nasional/region), tabel head-to-head 9 indikator, daftar 12 region, tren harian, rekap peringkat | `region.js` |
| 📍 **Area** | Sub-tampilan (registri `KITO_AREA_VIEWS`): **⏱ Waktu Tunggu**, **🖥️ Utilisasi NBDS**, **📊 Infografis O2O** (+ Shifting Digital level area). Dropdown Area punya opsi "Semua Area Region II". | `area-waktu.js`, `area-nbds.js`, `area-o2o.js` |
| 🏢 **Cabang** | Kartu: identitas cabang, Waktu Antrian (+Single/Multipel), Tren, Data Kelompok, Overall O2O, Shifting Digital, Utilisasi NBDS, Detail Data Old BDS, Informasi Akuisisi, Pegawai & Akuisisi, Detail Waktu Antrian | `script.js` (+ `infografis.js`, `pegawai.js`, `cabang-tren.js`) |

Fitur umum: filter Area/Cabang/Tanggal + pencarian cabang (header), ekspor CSV, cetak/PDF, splash dengan loading ±6 dtk, animasi transisi, mode gelap, **mode aplikasi layar penuh iOS** (lihat §7).

### Indikator & rumus

| Indikator | Rumus / sumber | Arah | Tampilan |
|---|---|---|---|
| Waktu antri (Teller, CS, Semua TRX, Single, Multipel) | P90 waktu tunggu reservasi (detik → mm:ss) | kecil lebih baik | kategori: <5, 5–10, 10–15, >15 menit |
| Utilisasi NBDS (T. Perorangan, T. Badan, CS, Agregat) | New BDS ÷ (New BDS + Old BDS) | besar lebih baik | target **≥ 98%**; persen **dipotong** 1 desimal |
| Overall O2O | Livin O2O ÷ (Livin O2O + New BDS) — transaksi ganti kartu | besar lebih baik | dibulatkan 1 desimal; hijau ≥ rata-rata Bankwide |
| Shifting Digital | (O2O + CSM) ÷ (O2O + NBDS ganti kartu + CSM + Old BDS) | besar lebih baik | NBDS = `D.M[i][10]` (fallback `D.M[i][1]`) |

Angka **area/region = jumlah cabang** (bukan rata-rata persen), kecuali P90 waktu area/region yang memakai nilai resmi sheet *Calc*.
**MTD NBDS** = jumlah harian 1 s.d. tanggal laporan (lihat CHANGELOG v1.5). Peringkat memakai **peringkat kompetisi** (nilai sama = peringkat sama).

---

## 2. Arsitektur

### 2.1 Pola "add-on membungkus `render()`"
`script.js` adalah inti: state global + `render()` + daftar kartu `URUTAN[]`. Modul lain **tidak mengubah** `script.js`; mereka:
1. menyisipkan kartu ke `URUTAN` (tab Cabang), **atau**
2. membungkus `render()`:
   ```js
   const sebelumnya = render;
   render = function () { sebelumnya(); if (tampil !== 'xxx') return; app.innerHTML = page(); };
   ```
3. mendaftar ke registri tampilan Area: `window.KITO_AREA_VIEWS.push({ key, order, label, html })` (dirender oleh `area-o2o.js`).

**Urutan `<script>` di `index.html` menentukan urutan pembungkus** — modul yang dimuat belakangan membungkus paling luar. `animasi.js` harus selalu **terakhir**.

### 2.2 State global (dari `script.js`)
| Nama | Isi |
|---|---|
| `D` | data inti (lihat §3) |
| `st` | `{ a: area, b: indeks cabang di D.B, d: indeks tanggal di D.dates }` |
| `tampil` | tab aktif: `'ranking' \| 'region' \| 'area' \| 'cabang'` |
| `rk`, `METRIK` | kartu Ranking Cabang generik (metrik bisa ditambah modul lain) |
| `URUTAN` | urutan kartu tab Cabang |
| fungsi bersama | `fill()`, `render()`, `esc()`, `f()` (mm:ss), `mp()` (kategori waktu), `lebarGrafik()`, `csv()`, `tabelOldBds()`, `pasangUnduh()` |

`fill()` juga dibungkus (`area-kelompok.js`, `ranking.js`) untuk opsi "Semua Area / Seluruh Region II" pada dropdown Area.

### 2.3 Urutan muat & peran modul
| # | File | Peran | Bungkus `render()`? |
|---|---|---|---|
| 1 | `data.js` | data inti `D` | – |
| 2 | `script.js` | inti, tab Cabang, header, CSV, cetak, tema | (asal) |
| 3 | `infografis(-data).js` | kartu Informasi Akuisisi Cabang | sisip `URUTAN` |
| 4 | `pegawai(-data).js` | kartu Pegawai & Akuisisi | ya |
| 5 | `area.js` | tampilan Area lama (tertimpa — lihat §6) | ya |
| 6 | `splash.js` | splash + loading ±6 dtk | – |
| 7 | `area-kelompok(-data).js` | data P90 per cabang; opsi "Semua Area" | ya + `fill` |
| 8 | `area-o2o(-data).js` | registri `KITO_AREA_VIEWS`, Infografis O2O, Shifting level area | ya |
| 9 | `area-waktu(-data).js` | sub-tampilan Waktu Tunggu | daftar view |
| 10 | `area-nbds(-data).js` | sub-tampilan Utilisasi NBDS, metrik NBDS ke `METRIK` | ya |
| 11 | `cabang-tren.js` | mengganti kartu Tren tab Cabang | ganti `URUTAN` |
| 12 | `ranking.js` | menu Ranking | ya + `fill` |
| 13 | `region(-data).js` | menu Region | ya |
| 14 | `animasi.js` | transisi, kapsul nav, nav sembunyi saat gulir | ya (**terakhir**) |

### 2.4 Interaksi: event delegation di `#app`
Setiap modul memakai awalan atribut sendiri — gunakan awalan unik untuk modul baru.

| Awalan | Modul | Awalan | Modul |
|---|---|---|---|
| `data-d`, `data-b`, `data-m`, `data-s`, `data-ex`, `data-v` | script.js | `data-o2o-*`, `data-sd-*` | area-o2o.js |
| `data-wt-*` | area-waktu.js | `data-nb-*` | area-nbds.js |
| `data-ak-*` | area-kelompok.js | `data-rg-*` | ranking.js |
| `data-ct-*` | cabang-tren.js | `data-rx-*` | region.js |
| `data-pg-*` | pegawai.js | `data-area-branch` | area.js |

### 2.5 CSS
- Token warna di `:root` (`style.css`), override mode gelap di `:root[data-theme="dark"]`.
- Satu file CSS per modul dengan awalan kelas: `wt-` (kotak kanal & tren, dipakai bersama), `nb-`, `o2o-`/`sd-`, `rg-` (juga dipakai Region), `rx-`, `ob-` (tabel Old BDS bersama), `ak-`, `pg-`, `kito-load` (splash).
- Kotak kanal Area memakai struktur seragam: `.wt-tile > .wt-nm · .wt-v · .chip · .wt-info · .wt-foot`.

---

## 3. Skema data

### `assets/js/data.js` → `const D`
| Kunci | Bentuk | Keterangan |
|---|---|---|
| `dates` | `["2026-10-01", …]` | tanggal antrian (8 Okt tidak ada di sumber) |
| `mdate` | `"2026-10-22"` | tanggal laporan O2O |
| `bw` | number | rata-rata O2O Bankwide |
| `B[i]` | `[kode, nama, area, kelas, PIC, telp, kelT1, kelT2, ketT, kelCS1, kelCS2, ketCS]` | master cabang |
| `Q[i][d]` | `[teller, cs, all]` detik | P90 per cabang per tanggal |
| `QD[i][d]` | `[tellerSingle, tellerMultipel, csSingle, csMultipel]` | rincian Single/Multipel |
| `QDM[i]` | sama dengan `QD`, MTD | |
| `M[i]` | `[o2o, nbdsO2O, csm, oldbds, fpN, fpO, fnpN, fnpO, nfN, nfO, nbdsGantiKartu]` | O2O/Shifting MTD + NBDS DtD tanggal laporan |
| `O[]` | `[idxCabang, transaksi, nasabah, userIdTersamar, kategori, "OBDS", total]` | Old BDS DtD |
| `kl` | label periode Data Kelompok | |

### File data lain
| File | Global | Isi utama |
|---|---|---|
| `area-waktu-data.js` | `KITO_AREA_WAKTU` | `dates`, `region`/`areas[].d[iso]` & `.m` = `[T single, T multipel, Teller, CS single, CS multipel, CS, All]` |
| `area-kelompok-data.js` | `KITO_AREA_KELOMPOK` | per cabang `dtd`/`mtd` `{teller, cs, all}` |
| `area-o2o-data.js` | `KITO_AREA_O2O` | segmen `gold/platinum/silver/overall` = `[o2o, nbds, total, %, "above/below/avg"]` per area, region, bankwide |
| `area-nbds-data.js` | `KITO_AREA_NBDS` | `dates`, `cabang[].d/m` & `areas[].d/m/mp` per kanal `fp/fnp/nf` = `[newBDS, oldBDS]`, `oldbds[]` = `[kode, area, kanal, layanan, jenisTransaksi, nasabah, uid, total]`, `metodeMTD` |
| `region-data.js` | `KITO_REGION` | `regions[]` & `nasional`: `waktu.d[iso]/m` `[teller, cs, all]`, `nbds.{fp,fnp,nf,agg}.d/m/mp`, `o2o.{segmen}`, `ch.{livin, eci, csm, o2o, old, new}` |
| `infografis-data.js`, `pegawai-data.js` | `KITO_INFO_DATA`, `KITO_PEGAWAI_DATA` | laporan Inbranch MTD 16 Okt (belum ada pembaruan) |

---

## 4. Pembaruan data harian

Butuh 3 file Excel bankwide: `DDMMYYYY_Dashboard_Antrian_Cabang.xlsx`, `Dashboard_Monitoring_Ganti_Kartu_DD_Okt_26.xlsx`, `Monitoring_Utilisasi_NBDS_sd_DD_Oktober_2026.xlsx`.

```bash
pip install openpyxl
cd Dashboard-KITO
python tools/update_semua.py --antrian "<antrian>.xlsx" --o2o "<ganti_kartu>.xlsx" --nbds "<nbds>.xlsx"
```

| Skrip | Membaca | Menulis |
|---|---|---|
| `update_antrian_o2o.py` | Antrian: *Calc*, *Per Cabang* · Ganti Kartu: *Cabang O2O*, *Cabang by Channel*, *Area O2O*, *Region O2O* | `data.js` (Q, QD, QDM, kelas, M[0..3], M[10], bw, mdate), `area-waktu-data.js`, `area-kelompok-data.js`, `area-o2o-data.js` |
| `convert_nbds_bankwide.py` | NBDS: *Cab F P*, *Cab F NP*, *Cab NF*, *Raw* | `area-nbds-data.js`, `data.js` (M[4..9], O) |
| `build_region.py` | Antrian *Calc* (R\|, N\|), NBDS *Region*, Ganti Kartu *Region O2O*, *Regional by Channel* | `region-data.js` |
| `update_semua.py` | — | menjalankan 3 skrip di atas berurutan |
| `convert_nbds.py` | format **lama** "Dashboard Monitoring Utilisasi NBDS Region 2" | `area-nbds-data.js` (cadangan) |

Setelah pembaruan:
1. **Naikkan `?v=`** file data yang berubah di `index.html` (cache-busting manual).
2. Cek peringatan yang dicetak skrip (mis. selisih sheet Area vs Σ cabang, Raw ≠ sheet).
3. Buka dashboard dan cek checklist §5.

Skrip **tidak mengekspor** nama/no HP BOM-BOS; User ID disamarkan `******1234`.

---

## 5. Checklist uji manual
- [ ] Splash: progres 0→100% ±6 dtk, lalu tertutup; nav bawah muncul.
- [ ] Tab Cabang: ganti cabang/tanggal; kotak Teller/CS/Semua TRX sejajar dan ada Single/Multipel; CSV Old BDS & Detail Antrian.
- [ ] Area → 3 sub-tampilan; dropdown "Semua Area Region II"; kotak kanal rata tengah & sejajar.
- [ ] Area → NBDS → ketuk layanan Old BDS → panel rincian + CSV; ketuk cabang membuka tab Cabang.
- [ ] Ranking: lingkup Region/Area/Cabang sinkron dengan dropdown; ganti indikator & periode; CSV.
- [ ] Region: ganti periode & pembanding; ganti kategori di Perbandingan **tanpa** loncat gulir; tren & tooltip.
- [ ] Mode gelap, lebar 360 px (tidak ada gulir horizontal halaman), desktop ≥1280 px, cetak.

---

## 6. Isu yang diketahui / utang teknis
| Prioritas | Isu | Saran |
|---|---|---|
| Tinggi | Data internal (nama & capaian pegawai, User ID tersamar) terkirim ke browser tanpa login; `.gitignore` hanya menolak `.xlsx` | sajikan lewat backend berautentikasi bila diakses di luar jaringan internal |
| Tinggi | Gambar splash & logo ±10 MB PNG (logo 1,2 MB juga jadi favicon) | kompres ke WebP/AVIF, logo 180 px |
| Sedang | `pegawai.js` memanggil `showPegawai('cif')` di setiap `render()` → tab pegawai kembali ke "New CIF" | simpan pilihan tab di state |
| Sedang | Pekerjaan terbuang: `area.js` (`areaPage`) & `area-kelompok.js` (`areaGroups`) dirender lalu ditimpa `area-o2o.js` | hapus/nonaktifkan |
| Sedang | Saat muat, 11 modul masing-masing memanggil `render()` (halaman digambar 11 kali) | registri hook + satu `render()` di akhir |
| Rendah | Kode mati di `script.js`: `kartuTren`, `chart`, `chart1`, `pasangSlider` | hapus |
| Rendah | Teks tanggal tertulis langsung: "16 Oktober 2026" (`infografis.js`, `pegawai.js`), "MTD · Oktober 2026" (`area-waktu.js`), "DtD 21 Okt" (`area-kelompok.js`, tampilan tertimpa) | ambil dari data |
| Rendah | "MtD" di kotak antrian tab Cabang = rata-rata P90 harian (bukan P90 MTD resmi `D.QDM`/kelompok) | pakai MTD resmi bila tanggal = tanggal laporan |
| Info | Splash selalu ±6 dtk sesuai permintaan | ubah `DURASI` di `splash.js` |
| Info | Cache-busting `?v=` manual | otomatiskan di skrip pembaruan |

---

## 7. Mode aplikasi iOS (Tambah ke Layar Utama)
| Bagian | Lokasi | Catatan |
|---|---|---|
| Meta iOS | `<head>` `index.html` | `apple-mobile-web-app-capable=yes`, status bar `black-translucent`, judul `KITO` |
| Manifest | `manifest.webmanifest` | `display: standalone` (+ `display_override: fullscreen`), ikon di `assets/images/ios/` |
| Ikon | `assets/images/ios/apple-touch-icon.png` (180), `icon-192/512`, `icon-maskable-512`, `favicon-32` | dibuat dari `kito-logo.png` dengan latar putih |
| Layar pembuka | `assets/images/ios/startup-<W>x<H>.jpg` + 12 `<link rel="apple-touch-startup-image">` | potret; tambah ukuran baru bila ada iPhone baru (rumus: lebar CSS × rasio piksel) |
| Deteksi mode | skrip kecil di `<head>` → `html.pwa` | `navigator.standalone` (iOS) / `display-mode: standalone` |
| Gaya mode aplikasi | `assets/css/pwa.css` | tombol ⟳ Muat ulang, tanpa overscroll, safe-area kiri/kanan |

Syarat: dashboard harus diakses lewat **HTTPS**. Uji di iPhone: Safari → Bagikan → *Tambah ke Layar Utama* → buka dari ikon (tanpa bilah alamat Safari).
Setelah data diperbarui, pengguna mode aplikasi cukup menekan **⟳** (atau menutup–membuka aplikasi).
