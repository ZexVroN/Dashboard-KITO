KITO update data dari Report Inbranch (MTD) - 20 Oktober(3).xlsx.
File runtime saja: index.html, CSS, JS, data.js, dan logo yang digunakan.
Pegawai dan infografis diperbarui dari Excel Region 02; nilai desimal dibulatkan ke atas.
Data waktu antrian/Old BDS dalam data.js tidak diubah karena sumber terbaru tidak menyediakan data penggantinya.
Buka melalui web server lokal (misalnya VS Code Live Server).

KITO Responsive Splash Screen

- Portrait (ponsel tegak): Pic/splash-portrait.png (9:16)
- Landscape (ponsel/tablet/desktop): Pic/splash-landscape.png (16:9)
- Desktop lebar >=1600px: Pic/splash-widescreen.png (16:9)
- Tampilan memenuhi layar menggunakan object-fit: cover; sebagian tepi dapat terpotong pada rasio ekstrem.
- Splash menghilang otomatis saat konten dashboard tampil (minimal 1,3 detik, maksimal 6 detik).


perapian data code
Dashboard-KITO/
|
-index.html
|
-assets/
|
-css/ — Seluruh stylesheet
|
-js/ — Script dan data dashboard
|
-images/ — Logo dan gambar Splash Screen



1. Penambahan Rank
2. Region
3. Area