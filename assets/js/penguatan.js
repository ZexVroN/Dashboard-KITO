/* Notifikasi "Informasi Highlight Issue Operasional" di halaman Cabang.
   - Kartu notifikasi di paling atas halaman Cabang: ketuk = buka halaman informasi, geser kiri/kanan atau tombol × = tutup.
   - Notifikasi yang ditutup muncul kembali setelah halaman dimuat ulang.
   - Halaman informasi berbentuk daftar berita (array BERITA). Ketuk berita = pindah ke halaman detailnya:
     "Penguatan Operasional" (7 kartu poin, array POIN), "Waspada Setor Angin" (objek SETOR) dan
     "Saling Ingatkan Bahaya Penipuan Digital" (objek PENIPUAN, dengan tombol bagikan WhatsApp/salin),
     "Sikap Akhir Layanan & Edukasi Klik Livin’ Food" (objek LIVIN) dan
     "Penegasan Mekanisme Pelaksanaan, Persetujuan & Pemeriksaan Transaksi" (objek MEKANISME, SE OPT.OB1/GH.1128/2026).
   Tombol ‹ Kembali di halaman detail = kembali ke daftar informasi. Add-on non-destruktif: menyisipkan kartu ke URUTAN. */
(()=>{'use strict';
if(typeof URUTAN==='undefined'||typeof render!=='function')return;
const app=document.getElementById('app');if(!app)return;


/* ----- isi: teks **tebal** ditandai dengan dua bintang ----- */
const JUDUL={
  label:'Penguatan Operasional',
  intro:'Sebagai upaya untuk peningkatan kewaspadaan atas **risiko operasional dan layanan cabang**, berikut adalah poin – poin yang perlu dilakukan.',
  ringkas:'poin peningkatan kewaspadaan risiko operasional & layanan cabang',
};
/* jenis: 'inisiatif' = Inisiatif Penjagaan (kartu biru muda); selain itu Arahan Operasional (kartu putih) */
const KETERANGAN=[
  {jenis:'inisiatif', judul:'Inisiatif Penjagaan', isi:'Penguatan kontrol dan sistem yang dijalankan'},
  {jenis:'arahan',    judul:'Arahan Operasional',  isi:'Ketentuan yang wajib dipatuhi seluruh pegawai cabang'},
];
const POIN=[
  {ik:'kunci',  kat:'Akses & Perangkat', judul:'Kerahasiaan User ID & OTP',
   isi:'Pegawai **tidak diperbolehkan sharing password User ID atau OTP** pada sistem layanan cabang.',
   tanda:'Dilarang berbagi akses'},
  {ik:'tablet', kat:'Akses & Perangkat', judul:'Tablet Tidak Dipinjamkan',
   isi:'Pegawai cabang **tidak diperkenankan saling meminjamkan tablet** dalam kondisi tablet login.',
   tanda:'Berlaku saat tablet login'},
  {ik:'gembok', jenis:'inisiatif', kat:'Akses & Perangkat', judul:'Pembatasan Transaksi Pegawai',
   isi:'Penguatan pengamanan sistem dengan **menutup akses reservasi dan transaksi pegawai di cabang sendiri**.',
   tanda:'Penutupan akses reservasi & transaksi pegawai'},
  {ik:'timbangan', kat:'Pengendalian Kas', judul:'Kesesuaian Fisik Kas & Sistem',
   isi:'Teller wajib memastikan **fisik uang tunai sesuai dengan sistem** saat meninggalkan counter Teller dan pada akhir hari, sesuai dokumen Aktivitas Operasional Cabang.',
   tanda:'Saat tinggalkan counter & akhir hari'},
  {ik:'kaca', jenis:'inisiatif', kat:'Pengendalian Kas', judul:'Rekonsiliasi Transaksi',
   isi:'BOM/BOS wajib melakukan **rekonsiliasi transaksi selama jam layanan** di luar cash opname akhir hari.',
   tanda:'Rekonsiliasi min. 2× per hari'},
  {ik:'dokumen', kat:'Pengendalian Kas', judul:'Berita Acara Cash Opname',
   isi:'Hasil cash opname akhir hari dibuatkan **berita acara** dan **ditandatangani oleh BOM, diketahui oleh BM**.',
   tanda:'Ditandatangani BOM, diketahui BM'},
  {ik:'kalender', kat:'Pengendalian Kas', judul:'Penyelesaian Selisih',
   isi:'Jika terjadi selisih, **wajib diselesaikan pada hari yang sama** dan dituangkan dalam Berita Acara Selisih.',
   tanda:'Selesai di hari yang sama'},
];

/* ----- Waspada Transaksi "Setor Angin" (Surat SOR.DSC/473/2026) ----- */
const SETOR={
  label:'Reminder Kewaspadaan',
  judul:'Waspada Transaksi “Setor Angin”',
  intro:'Modus fraud kas di Cabang/Unit Kerja yang berpotensi menimbulkan **kerugian nominal signifikan** — kenali modusnya, cegah bersama.',
  ref:'Surat SOR Distribution & Consumer No. SOR.DSC/473/2026 · 5 November 2026 · Untuk Regional I–XII, Area Head, Kepala Cabang & Pengelola Pooling Cash',
  definisi:'Tindakan inisiator/pelaku **memposting transaksi setoran tunai ke rekening tertentu tanpa disertai penerimaan fisik uang tunai** — mengakibatkan **selisih kas kurang** di Cabang/Unit Kerja.',
  alur:[{j:'Posting setoran',k:'di sistem'},{j:'Tanpa uang fisik',k:'tidak ada uang diterima',m:1},{j:'Saldo rekening bertambah',k:'rekening tertentu'},{j:'Selisih kas kurang',k:'kerugian Bank',m:1}],
  dampak:[
    {ik:'turun',     j:'Kerugian langsung', k:'Selisih kas kurang di Cabang/Unit Kerja.'},
    {ik:'peringatan',j:'Pemicu fraud lain', k:'Pencurian kas & ilegal debet; eksposur kerugian & penyalahgunaan aset meningkat.'},
    {ik:'putar',     j:'Recovery sulit',    k:'Walau terdeteksi saat opname kas akhir hari, pemulihan kerugian sulit dilakukan.'},
    {ik:'perisaiX',  j:'Risiko reputasi',   k:'Berdampak ke kinerja Unit Kerja, Area, Region & reputasi Bank.'},
  ],
  modus:[
    {siapa:'Kepala Cabang / Pegawai Senior', isi:'Meminta **teller kriya/junior/baru** memposting setor angin, dengan janji fisik uang diberikan sebelum akhir hari.'},
    {siapa:'Teller', isi:'Posting setor angin lalu **approval sendiri** memakai User ID/Tablet New BDS pegawai lain yang dicuri, dipinjam, atau hasil **sharing password**.'},
    {siapa:'Teller + BOM/BOS', isi:'Teller posting setor angin, minta approval BOM/BOS, namun:', poin:['Approval dilakukan **remote** — tidak melihat fisik uang di counter','Melihat fisik uang, tapi **tidak menghitung detail**']},
    {siapa:'Pegawai Non-Teller', isi:'Melakukan posting & approval setor angin dengan **User ID posting dan User ID approval milik pegawai lain**.'},
  ],
  cegah:[
    {ik:'kas', siapa:'Area Head & Branch Manager', j:'Surprise Cash Opname', poin:[
      'Pantau saldo & limit tunai; cek kesesuaian **Buku Besar Kas Utama, Laporan Stok Uang Tunai & fisik** secara tidak terjadwal',
      'Cek kerapihan kemasan uang (brick, brood, plastik, kantong koin)',
      'Total denominasi = saldo Buku Besar Kas Utama',
      'Isi **Berita Acara Pemeriksaan** Uang Rupiah & Valas']},
    {ik:'gembokS', siapa:'Seluruh Pegawai', j:'Keamanan User ID, Password & OTP', poin:[
      '**Dilarang sharing** password User ID/OTP maupun tablet New BDS yang sedang login — dengan alasan apa pun',
      'Pelanggaran dikenai **sanksi berat** meskipun tidak terjadi fraud',
      'Jaga kerahasiaan agar tidak dicuri, diintip, atau dipakai orang lain']},
    {ik:'mata', siapa:'BOM / BOS', j:'Approval & Rekonsiliasi', poin:[
      'Approval **tidak boleh remote** — lihat langsung teller & nasabah',
      '**Hitung** uang setoran di counter teller',
      'Rekonsiliasi Cash on Hand teller secara surprise, **min. 2× sehari** di luar opname akhir hari',
      'Alokasi kas (BOM/BOS ↔ Teller, antar Teller) dihitung teliti & akurat']},
    {ik:'centang', siapa:'Teller', j:'Fisik Sesuai Sistem', poin:[
      'Pastikan fisik uang tunai **sesuai sistem** saat meninggalkan counter (istirahat, minta approval FR ke BOM/BOS, dll.)',
      'Pastikan kesesuaian pada **aktivitas akhir hari**']},
    {ik:'orang', siapa:'Area', j:'Awareness Pegawai Kriya/Teller Junior', poin:[
      'Pembekalan berkala agar berani **tidak mengikuti perintah atasan** yang mengarah ke fraud',
      'Forum rutin berbagi info & knowledge pencegahan fraud',
      'Sosialisasi mekanisme **whistleblowing**',
      'Kepala Cabang tanpa background operasional ikut pengayaan & continuous education bersama RBC/ABC']},
    {ik:'gedung', siapa:'RCEO & Area Head', j:'Infrastruktur Pengamanan Kas', chip:[
      'CCTV (coverage, titik, retensi)','Alarm / Panic Button','Kunci & duplikat kluis','Lemari besi & ruang kluis',
      'Kunci laci & box teller','Restricted area / access door','APAR & smoke detector']},
  ],
  gejala:{j:'Kenali gejala pendorong fraud — monitor & eskalasi', k:'Setiap pegawai berkewajiban menjaga rekan kerja maupun atasan dengan memonitor perilaku berikut:',
    chip:['Judi online','Pinjol','Narkoba','Investasi bodong','Trading forex / kripto mengarah ke judi']},
  jangan:['Memposting setoran tanpa menerima fisik uang','Meminjamkan User ID, password, OTP, tablet',
    'Meminjamkan email, nomor HP, atau rekening untuk menampung/lalu lintas transaksi fraud',
    'Diam saat melihat fraud — tidak eskalasi = **pembiaran fraud** & dikenai sanksi'],
  lakukan:['**Tolak** perintah rekan/atasan yang tidak sesuai prosedur, termasuk posting tanpa fisik uang',
    'Ada intimidasi/tekanan? Segera **laporkan ke RBC/ABC**','Eskalasi kejadian fraud sekecil apa pun di **kesempatan pertama**',
    'Gunakan saluran **whistleblowing**'],
  zero:'Bank Mandiri tidak memberikan toleransi kepada pelaku fraud maupun pegawai yang membantu atau memungkinkan fraud tersebut terjadi.',
  sumber:'SOR Distribution & Consumer · PT Bank Mandiri (Persero) Tbk. · Untuk kalangan internal',
};

/* ----- berita "Saling Ingatkan Bahaya Penipuan Digital" (#GEBERPK) ----- */
const PENIPUAN={
  label:'Edukasi Nasabah · #GEBERPK',
  judul:'Satu pesan kecil bisa menyelamatkan orang terdekat dari penipuan digital 💙',
  intro:'Yuk, **saling mengingatkan**:',
  tips:[
    {ik:'gembokS', j:'Rahasiakan OTP, PIN & kata sandi', k:'Jangan bagikan **OTP, PIN, atau kata sandi** kepada siapa pun, termasuk yang mengaku petugas bank.'},
    {ik:'peringatan', j:'Waspadai tautan & desakan transfer', k:'Waspadai **tautan asing** dan **permintaan transfer yang mendesak**.'},
    {ik:'perisai', j:'Verifikasi lewat kanal resmi', k:'Selalu **verifikasi identitas pengirim** melalui kanal resmi.'},
  ],
  ajakan:'Teruskan pengingat ini ke keluarga dan teman terdekatmu. 📢',
  tagar:['#GEBERPK','#KalauRaguStopDulu'],
};
/* ----- berita "Sikap Akhir Layanan & Edukasi Klik Livin’ Food" (24 Nov 2026) ----- */
const LIVIN={
  label:'Customer Journey · wajib disampaikan pada Morning Briefing',
  judul:'Sikap Akhir Layanan & Edukasi Klik Livin’ Food',
  intro:'Setiap interaksi dengan nasabah adalah kesempatan memberi pengalaman layanan yang berkesan, termasuk saat nasabah selesai bertransaksi dan hendak meninggalkan cabang. Security tidak hanya memberi **salam penutup yang hangat**, tetapi juga **proaktif mengedukasi** kemudahan memesan makanan favorit lewat fitur **Livin’ Food** di Livin’ by Mandiri.',
  poin:[
    'Security **wajib** memberikan Sikap Akhir Layanan dengan ramah dan penuh senyum.',
    '**Konfirmasi** apakah nasabah sudah menggunakan Livin’ by Mandiri.',
    '**Informasikan** dan tawarkan bantuan kepada nasabah untuk mengakses fitur Livin’ Food.',
    '**Pandu** nasabah untuk Klik Livin’ Food pada aplikasi Livin’ by Mandiri apabila berkenan.',
    'Pastikan interaksi **ditutup** dengan ucapan terima kasih dan salam yang hangat.',
  ],
  perluasan:[
    ['Selesai transaksi Ganti Kartu Debit O2O','Bagian dari edukasi layanan digital setelah penggantian kartu debit.'],
    ['Nasabah menunggu antrean CS & Teller','Manfaatkan waktu tunggu untuk memperkenalkan dan memandu akses fitur Livin’ Food, tanpa membuat nasabah melewatkan panggilan.'],
  ],
  catatan:'Edukasi dilakukan secara ramah, proaktif, dan **tidak memaksa**, dengan tetap mengutamakan kenyamanan nasabah. Mohon dukungan Bapak/Ibu **BOM/BOS** meneruskan informasi ini ke seluruh cabang dan memastikan materi disampaikan pada Morning Briefing.',
  penutup:'Security bukan sekadar menyambut dan melepas nasabah, tetapi bagian dari pengalaman layanan yang berkesan sekaligus menghadirkan kemudahan digital Bank Mandiri.',
  tagar:['Service yang Me-Menangkan 💪🏻','#Salam1ServiceMandiri'],
  gambar:'assets/images/livin-food-sikap-akhir.jpg',
};
const PESAN_LIVIN=`✨ Semangat pagi, Bapak, Ibu, dan Kakak-Kakak Leader Service yang Me-Menangkan.

Terlampir panduan “Sikap Akhir Layanan & Edukasi Klik Livin’ Food” yang wajib disampaikan pada Morning Briefing di seluruh cabang.

Setiap interaksi dengan nasabah adalah kesempatan untuk memberikan pengalaman layanan yang berkesan, termasuk saat nasabah selesai bertransaksi dan hendak meninggalkan cabang.

Melalui Sikap Akhir Layanan, Security diharapkan tidak hanya memberikan salam penutup yang hangat, tetapi juga secara proaktif mengedukasi nasabah mengenai kemudahan memesan makanan favorit melalui fitur Livin’ Food pada aplikasi Livin’ by Mandiri.

📌 Poin Penguatan:
1. Security wajib memberikan Sikap Akhir Layanan dengan ramah dan penuh senyum.
2. Konfirmasi apakah nasabah sudah menggunakan Livin’ by Mandiri.
3. Informasikan dan tawarkan bantuan kepada nasabah untuk mengakses fitur Livin’ Food.
4. Pandu nasabah untuk Klik Livin’ Food pada aplikasi Livin’ by Mandiri apabila berkenan.
5. Pastikan interaksi ditutup dengan ucapan terima kasih dan salam yang hangat.

📌 Perluasan Aktivitas Edukasi Klik Livin’ Food

Selain pada saat Sikap Akhir Layanan, aktivitas edukasi Klik Livin’ Food juga dapat dilakukan kepada nasabah:
1. Selesai Transaksi Ganti Kartu Debit O2O, sebagai bagian dari edukasi layanan digital setelah penggantian kartu debit.
2. Nasabah yang sedang menunggu antrean CS dan Teller, dengan memanfaatkan waktu tunggu untuk memperkenalkan serta memandu nasabah mengakses fitur Livin’ Food.

Pastikan edukasi dilakukan secara ramah, proaktif, dan tidak memaksa, dengan tetap mengutamakan kenyamanan nasabah.

Mohon dukungan Bapak Ibu BOM/BOS untuk meneruskan informasi ini ke seluruh cabang dan memastikan materi disampaikan pada Morning Briefing.

Security bukan sekadar menyambut dan melepas nasabah, tetapi menjadi bagian dari pengalaman layanan yang berkesan sekaligus menghadirkan kemudahan digital Bank Mandiri.

Service yang Me-Menangkan 💪🏻

#Salam1ServiceMandiri 🙏`;

/* ----- berita "Penegasan Mekanisme Pelaksanaan, Pemberian Persetujuan & Pemeriksaan Transaksi"
   (Surat Edaran OPT.OB1/GH.1128/2026, 19 Nov 2026) ----- */
const MEKANISME={
  label:'Ringkasan Surat Edaran · Operasional Cabang',
  judul:'Penegasan Mekanisme Pelaksanaan, Pemberian Persetujuan & Pemeriksaan Transaksi',
  intro:'Cabang kini menjalankan **dua sistem secara paralel**. Perbedaan desain keduanya membuat mekanisme persetujuan, pemeriksaan & laporan juga berbeda — surat ini menyeragamkan pelaksanaan oleh **BOM / BOS / CSO / CS Spv** agar kontrol optimal.',
  ref:'Nomor OPT.OB1/GH.1128/2026 · 19 November 2026 · Outserve & Branch Operations Group 1 & 2',
  pdf:'assets/dokumen/se-mekanisme-transaksi-opt-ob1-gh-1128-2026.pdf',
  sistem:[
    {tag:'Sistem Baru', j:'New BDS', baru:true, k:'Untuk transaksi yang fiturnya sudah tersedia. Nasabah menginisiasi & menyetujui sendiri via **e-form, Livin’ atau Kopra by Mandiri**.',
     alur:[['Happy Flow','Verifikasi data otomatis melalui integrasi sistem'],['Exception Flow','Verifikasi manual untuk kondisi / transaksi tertentu']]},
    {tag:'Sistem Lama', j:'Old BDS', k:'Untuk transaksi/layanan yang fiturnya **belum tersedia** di New BDS.',
     alur:[['Posting oleh Teller/CSR','Berdasarkan slip / formulir / surat perintah nasabah'],['Eyeballing','Pemeriksaan selama & pasca transaksi']]},
  ],
  userid:[
    {ik:'orang', j:'Wajib Dimiliki', poin:['BOM, BOS, CSO, CS Spv, Teller & CSR wajib punya **kedua user ID**','Pegawai baru: lampirkan **sertifikat training** (sudah ikut training & lulus tes)']},
    {ik:'gembokS', j:'Personal & Rahasia', poin:['**Dilarang berbagi** user ID, password, atau perangkat dalam kondisi log in','**Kunci layar & log off** saat meninggalkan meja','Tanggung jawab penuh atas tiap transaksi dengan ID sendiri']},
    {ik:'putar', j:'Review & Sanksi', poin:['ASM/BOM/BOS review user ID & akses level **min. 1×/bulan**','Segera sesuaikan saat rotasi / mutasi / resign','Penyalahgunaan user ID **dikenakan sanksi**']},
  ],
  useridCat:'Tata cara pembuatan user ID New BDS via IT Remedy → Lampiran 1',
  transaksi:[
    {j:'Dalam kewenangan Teller/CSR', k:'Selesai tanpa persetujuan penyelia',
     old:'Dijalankan berdasarkan **slip/formulir** nasabah. Teller/CSR wajib memastikan nasabah **berwenang** (identitas asli, spesimen tanda tangan, data sistem).',
     baru:'Diinisiasi nasabah via **e-form / Livin’ / Kopra**. Teller/CSR memastikan **status verifikasi** nasabah & kesesuaian dengan data di sistem.'},
    {j:'Di atas kewenangan Teller/CSR', k:'Wajib persetujuan BOM / BOS / CSO / CS Spv', atas:true,
     old:'Penyelia **menghampiri** Teller/CSR, cek kelengkapan data & dokumen, serta cocokkan detail transaksi dengan slip/perintah nasabah.',
     baru:'Penyelia **menghampiri** Teller/CSR, periksa detail transaksi, lalu menyetujui via:',
     metode:[['Face Recognition','Wajib · mekanisme utama'],['OTP','Hanya fallback, mis. FR terkendala integrasi',1]]},
  ],
  transaksiCat:'Penyelia bertanggung jawab penuh atas setiap persetujuan & dilarang berbagi password → Lampiran 2a & 2b',
  periksa:[
    {tag:'Old BDS', j:'Cocokkan Laporan Akhir Hari', k:'Teller/CSR mencocokkan perintah nasabah (slip/formulir) dengan **laporan transaksi akhir hari** — mis. transaksi sukses, gagal, tertunda, dikoreksi, posisi kas.', cat:'Daftar laporan → Lampiran 3a'},
    {tag:'New BDS · Happy Flow', j:'Periksa Warkat Sebelum Proses', k:'Tidak perlu pemeriksaan manual, **kecuali** transaksi dengan warkat (cek, bilyet giro, LOA, dll): periksa **keaslian fisik & syarat formal** sebelum diproses, lalu administrasikan dokumen dengan tertib.'},
    {tag:'New BDS · Exception Flow', j:'Exception Report Harian', k:'Tercatat di **Web Branch Admin**. BOM/BOS wajib memeriksa **seluruh** transaksi di exception report **setiap hari**.', sorot:true},
  ],
  checklist:['Jenis transaksi, nominal, rekening sumber & rekening/nama penerima','Status transaksi','Status verifikasi nasabah (OCR KTP / FR / OTP)','Alasan approval',
    'Metode approval penyelia','Status approval penyelia','Dokumen pendukung & foto nasabah'],
  checklistCat:'Klasifikasi eksepsi (non finansial, finansial, back office) & panduan → Lampiran 3b',
  kas:[
    {ik:'jam', j:'Selama Jam Layanan', poin:['BOM/BOS melakukan **cash on hand reconciliation mendadak min. 2×** selama jam layanan','Pastikan fisik uang tunai = saldo di sistem','Hasil dilaporkan **setiap hari** melalui tautan Microsoft Forms']},
    {ik:'bulan', j:'Akhir Hari', poin:['**Teller:** cocokkan saldo sistem vs fisik uang, alokasikan sisa ke BOM/BOS','**CSR:** cocokkan fisik kartu debit, alokasikan sisa ke pengelola kartu','**CSR/CSO/CS Spv:** cocokkan surat berharga, alokasikan sisa ke BOM/BOS']},
  ],
  kalender:[
    {n:'2×', f:'per hari', poin:['Cash on hand reconciliation mendadak (BOM/BOS)']},
    {n:'1×', f:'per hari', poin:['Cash Opname: Cashier Box tiap Teller + seluruh uang di kluis','Periksa exception report','Lapor hasil rekonsiliasi']},
    {n:'2×', f:'per bulan (min.)', poin:['Cross Opname acak/tidak terjadwal oleh BM cabang lain / pejabat independen yang ditunjuk Area Head']},
    {n:'1×', f:'per bulan (min.)', poin:['Opname Stok Besar: surat berharga & kartu debit','Review user ID & akses level']},
  ],
  kalenderCat:'Tata cara opname → Lampiran 4 · Berita Acara Pemeriksaan Cross Opname → Lampiran 5 & 6',
  tindak:[
    '**Regional Operations Head & Area Service Manager** memastikan seluruh pegawai terkait memahami & konsisten menjalankan persetujuan dan pemeriksaan.',
    '**CCTV di area kluis** wajib terpasang di tiap cabang — merekam seluruh aktivitas & uang **tanpa blind spot**, termasuk depan & dalam pintu kluis. Retensi rekaman sesuai PTO Pengamanan Korporasi.',
    '**BOM / BOS / CSO / CS Spv / Teller / CSR** wajib menjalankan verifikasi, persetujuan & pemeriksaan transaksi sesuai ketentuan.',
  ],
  sanksi:'Pegawai yang terbukti melakukan **penyalahgunaan, pelanggaran, atau penyimpangan** wajib bertanggung jawab dan dikenakan **sanksi serta proses hukum** sesuai ketentuan.',
  sumber:'Diterbitkan oleh Outserve & Branch Operations Group 1 & 2 · PT Bank Mandiri (Persero) Tbk. Infografis ini adalah ringkasan — untuk rincian, prosedur lengkap dan lampiran, rujuk surat asli Nomor OPT.OB1/GH.1128/2026.',
};

/* teks yang dibagikan (WhatsApp / bagikan bawaan HP) */
const PESAN_PENIPUAN_ASLI=`Satu pesan kecil bisa menyelamatkan orang terdekat dari penipuan digital. 💙

Yuk, saling mengingatkan:
* Jangan bagikan OTP, PIN, atau kata sandi kepada siapa pun.
* Waspadai tautan asing dan permintaan transfer yang mendesak.
* Selalu verifikasi identitas pengirim melalui kanal resmi.

Teruskan pengingat ini ke keluarga dan teman terdekatmu. 📢

#GEBERPK #KalauRaguStopDulu`;

/* ----- daftar berita di halaman Informasi Highlight Issue Operasional (paling baru di atas) ----- */
const INFO={
  label:'Highlight Issue',
  judul:'Informasi Highlight Issue Operasional',
  intro:'Kumpulan informasi & pengingat kewaspadaan **operasional cabang**. Ketuk informasi untuk membaca selengkapnya.',
};
const BERITA=[
  {id:'mekanisme', ik:'stempel', warna:'hijau', baru:true, kat:'Surat Edaran · Operasional Cabang', tgl:'19 Nov 2026',
   judul:'Penegasan Mekanisme Pelaksanaan, Persetujuan & Pemeriksaan Transaksi',
   ringkas:'Old BDS & New BDS berjalan paralel: aturan user ID, persetujuan penyelia via Face Recognition (OTP hanya fallback), exception report harian, serta kalender kontrol kas, kartu debit & surat berharga.'},
  {id:'livin', ik:'pesan', warna:'emas', baru:true, kat:'Customer Journey · Morning Briefing', tgl:'24 Nov 2026',
   judul:'Sikap Akhir Layanan & Edukasi Klik Livin’ Food',
   ringkas:'Panduan wajib Morning Briefing: Security menutup layanan dengan hangat dan mengedukasi nasabah fitur Livin’ Food, juga saat selesai ganti kartu O2O dan saat menunggu antrean CS/Teller.'},
  {id:'penipuan', ik:'pesan', warna:'biru', kat:'Edukasi Nasabah', tgl:'16 Nov 2026',
   judul:'Saling Ingatkan Bahaya Penipuan Digital',
   ringkas:'Jangan bagikan OTP, PIN, atau kata sandi; waspadai tautan asing & permintaan transfer mendesak; verifikasi lewat kanal resmi. Teruskan ke keluarga & teman.'},
  {id:'setor', ik:'angin', warna:'merah', kat:'Reminder Kewaspadaan', tgl:'',
   judul:'Waspada Transaksi “Setor Angin”',
   ringkas:'Modus fraud kas: posting setoran tunai tanpa fisik uang yang mengakibatkan selisih kas kurang. Kenali 4 modusnya & langkah pencegahan wajib.'},
  {id:'penguatan', ik:'perisai', warna:'navy', kat:'Penguatan Operasional', tgl:'',
   judul:`${POIN.length} Poin Kontrol Operasional`,
   ringkas:'Poin peningkatan kewaspadaan risiko operasional & layanan cabang: akses & perangkat serta pengendalian kas.'},
];

/* ----- ikon garis sederhana (SVG, warna mengikuti currentColor) ----- */
const S=(d)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IKON={
  perisai:S('<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M12 7v10" opacity=".55"/>'),
  kunci:S('<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>'),
  tablet:S('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>'),
  gembok:S('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5 1.2 0 2.2.3 3 .9"/><rect x="14" y="14" width="7" height="6" rx="1.2"/><path d="M15.5 14v-1.5a2 2 0 014 0V14"/>'),
  timbangan:S('<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-2.5 6a3 3 0 005 0L5 7zM19 7l-2.5 6a3 3 0 005 0L19 7z"/>'),
  kaca:S('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/><path d="M10.5 7.5v6M12.3 8.6c-.4-.6-1.1-.9-1.8-.9-1 0-1.8.6-1.8 1.4 0 1.9 3.6 1 3.6 2.9 0 .8-.8 1.4-1.8 1.4-.8 0-1.5-.3-1.9-.9"/>'),
  dokumen:S('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path d="M14 3v5h5"/><path d="M9 16l5.5-5.5 1.5 1.5L10.5 17.5H9V16z"/>'),
  kalender:S('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M9 15l2 2 4-4"/>'),
  centang:S('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/>'),
  tutup:S('<path d="M6 6l12 12M18 6L6 18"/>'),
  kembali:S('<path d="M15 6l-6 6 6 6"/>'),
  angin:S('<path d="M3 8h10a3 3 0 10-3-3M3 12h15a3 3 0 11-3 3M3 16h7"/>'),
  berita:S('<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h2a1 1 0 011 1v9a2 2 0 01-4 0"/><path d="M7 8h7M7 12h7M7 16h4"/>'),
  turun:S('<path d="M3 7l6 6 4-4 8 8"/><path d="M21 11v6h-6"/>'),
  peringatan:S('<path d="M12 4l9 16H3l9-16z"/><path d="M12 10v4M12 17v.01"/>'),
  putar:S('<path d="M4 12a8 8 0 108-8c-2.4 0-4.5 1-6 2.7"/><path d="M4 4v4h4"/>'),
  perisaiX:S('<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>'),
  kas:S('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>'),
  gembokS:S('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/><path d="M12 15v2"/>'),
  mata:S('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  orang:S('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14c2.2 0 3.7 1.6 4 4"/>'),
  gedung:S('<path d="M3 10l9-6 9 6"/><path d="M5 10v9M19 10v9M9.5 10v9M14.5 10v9M3 20h18"/>'),
  bendera:S('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  panah:S('<path d="M9 6l6 6-6 6"/>'),
  kiri:S('<path d="M15 6l-6 6 6 6"/>'),
  pesan:S('<path d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H9l-5 4V6a1 1 0 011-1z"/><path d="M12 14.2l-2.6-2.5a1.6 1.6 0 012.6-1.9 1.6 1.6 0 012.6 1.9L12 14.2z"/>'),
  bagikan:S('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
  unduh:S('<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>'),
  salin:S('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>'),
  stempel:S('<path d="M9 3h6l-1 7h-4L9 3z"/><path d="M5 14a2 2 0 012-2h10a2 2 0 012 2v3H5v-3z"/><path d="M4 21h16"/>'),
  jam:S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  bulan:S('<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>'),
  pdf:S('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
};
const tebal=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');

/* Status hanya berlaku hingga halaman dimuat ulang. */
let tertutup=false;
const ditutup=()=>tertutup;
const tutupNotif=()=>{tertutup=true;};

/* ===== kartu notifikasi di halaman Cabang ===== */
function kartuPenguatan(){
  if(ditutup())return '';
  return `<div class="pgn-notif" id="pgn-notif" role="button" tabindex="0" aria-label="Buka Informasi Highlight Issue Operasional">
    <span class="pgn-n-ik">${IKON.perisai}</span>
    <span class="pgn-n-tx"><small>HIGHLIGHT ISSUE !!!</small><b>Informasi Highlight Issue Operasional</b><em>${BERITA.length} informasi · WAJIB DIBACA · Ketuk untuk lihat</em></span>
    <span class="pgn-n-go">${IKON.panah}</span>
    <button type="button" class="pgn-n-x" data-pgn-tutup aria-label="Tutup notifikasi">${IKON.tutup}</button>
  </div>`;
}
URUTAN.splice(0,0,kartuPenguatan);

/* ===== panel detail ===== */
let panel=null,fokusSebelum=null;
function kartuKeterangan(){
  const nomor=j=>POIN.map((p,i)=>((p.jenis==='inisiatif')===(j==='inisiatif'))?i+1:0).filter(Boolean);
  const daftar=n=>n.length>1?n.slice(0,-1).join(', ')+' & '+n[n.length-1]:String(n[0]||'–');
  return `<aside class="pgn-ket" aria-label="Keterangan">
    <div class="pgn-ket-h"><span class="pgn-ket-i" aria-hidden="true">i</span><b>Keterangan</b></div>
    ${KETERANGAN.map(k=>`<div class="pgn-ket-r"><span class="pgn-ket-w ${k.jenis==='inisiatif'?'sorot':''}" aria-hidden="true"></span>
      <div><b>${esc(k.judul)}</b><p>${esc(k.isi)}</p><small>Poin ${daftar(nomor(k.jenis))}</small></div></div>`).join('')}
  </aside>`;
}
function isiPenguatan(){
  const kartu=POIN.map((p,i)=>`<article class="pgn-k ${p.jenis==='inisiatif'?'pgn-k-sorot':''}">
      <div class="pgn-k-top"><span class="pgn-k-ik">${IKON[p.ik]||IKON.centang}</span><span class="pgn-k-no">${String(i+1).padStart(2,'0')}</span></div>
      <span class="pgn-k-kat">${esc(p.kat)}</span>
      <h3>${esc(p.judul)}</h3>
      <p>${tebal(p.isi)}</p>
      <span class="pgn-k-tanda">${IKON.centang}${esc(p.tanda)}</span>
    </article>`).join('');
  return `<div class="pgn-hero">
      <span class="pgn-hero-ik">${IKON.perisai}</span>
      <span class="pgn-hero-lbl" id="pgn-judul" tabindex="-1">${esc(JUDUL.label)}</span>
      <p class="pgn-hero-intro">${tebal(JUDUL.intro)}</p>
      <div class="pgn-hero-jml"><strong>${POIN.length}</strong><span>${esc(JUDUL.ringkas)}</span></div>
    </div>
    <div class="pgn-grid">${kartu}${kartuKeterangan()}</div>`;
}
/* halaman daftar berita */
function isiDaftar(){
  const kartu=BERITA.map(b=>`<button type="button" class="pgn-brt pgn-brt-${b.warna}" data-pgn-buka="${b.id}">
      <span class="pgn-brt-th">${IKON[b.ik]||IKON.berita}</span>
      <span class="pgn-brt-tx">
        <span class="pgn-brt-meta">${b.baru?'<span class="pgn-brt-baru">Baru</span>':''}<span class="pgn-brt-kat">${esc(b.kat)}</span>${b.tgl?`<span class="pgn-brt-tgl">${esc(b.tgl)}</span>`:''}</span>
        <span class="pgn-brt-j">${esc(b.judul)}</span>
        <span class="pgn-brt-r">${esc(b.ringkas)}</span>
        <span class="pgn-brt-go">Baca selengkapnya ${IKON.panah}</span>
      </span>
    </button>`).join('');
  return `<div class="pgn-hero pgn-hero-info">
      <span class="pgn-hero-ik">${IKON.berita}</span>
      <span class="pgn-hero-lbl">${esc(INFO.label)}</span>
      <h2 class="pgn-hero-j" id="pgn-judul" tabindex="-1">${esc(INFO.judul)}</h2>
      <p class="pgn-hero-intro">${tebal(INFO.intro)}</p>
    </div>
    <div class="pgn-brt-list">${kartu}</div>`;
}
/* halaman berita Waspada Setor Angin */
function isiSetor(){
  const s=SETOR,li=a=>`<ul>${a.map(t=>`<li>${tebal(t)}</li>`).join('')}</ul>`,chip=a=>`<div class="sa-chip">${a.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`;
  const sub=t=>`<h3 class="sa-sub">${esc(t)}</h3>`;
  return `<div class="pgn-hero sa-hero">
      <span class="sa-tag">${esc(s.label)}</span>
      <h2 class="pgn-hero-j" id="pgn-judul" tabindex="-1">${esc(s.judul)}</h2>
      <p class="pgn-hero-intro">${tebal(s.intro)}</p>
      <p class="sa-ref">Ref: ${esc(s.ref)}</p>
    </div>
    ${sub('Apa itu Setor Angin?')}
    <div class="sa-def"><span class="sa-def-ik">${IKON.angin}</span><p>${tebal(s.definisi)}</p></div>
    <ol class="sa-alur">${s.alur.map(a=>`<li class="${a.m?'m':''}"><b>${esc(a.j)}</b><small>${esc(a.k)}</small></li>`).join('')}</ol>
    ${sub('Dampaknya')}
    <div class="sa-g4">${s.dampak.map(d=>`<div class="sa-dmp"><span class="sa-dmp-ik">${IKON[d.ik]}</span><b>${esc(d.j)}</b><p>${esc(d.k)}</p></div>`).join('')}</div>
    ${sub('4 Modus yang Perlu Dikenali')}
    <div class="sa-g2">${s.modus.map((m,i)=>`<div class="sa-mod"><span class="sa-mod-no">${i+1}</span><span class="sa-siapa">${esc(m.siapa)}</span><p>${tebal(m.isi)}</p>${m.poin?li(m.poin):''}</div>`).join('')}</div>
    ${sub('Langkah Pencegahan Wajib')}
    <div class="sa-g2">${s.cegah.map(c=>`<div class="sa-cg"><div class="sa-cg-h"><span class="sa-cg-ik">${IKON[c.ik]}</span><div><span class="sa-siapa">${esc(c.siapa)}</span><b>${esc(c.j)}</b></div></div>${c.poin?li(c.poin):chip(c.chip)}</div>`).join('')}</div>
    <div class="sa-gjl"><span class="sa-gjl-ik">${IKON.bendera}</span><div><b>${esc(s.gejala.j)}</b><p>${esc(s.gejala.k)}</p>${chip(s.gejala.chip)}</div></div>
    <div class="sa-g2">
      <div class="sa-jl sa-no"><b>✕ Jangan</b>${li(s.jangan)}</div>
      <div class="sa-jl sa-ya"><b>✓ Lakukan</b>${li(s.lakukan)}</div>
    </div>
    <div class="sa-zero"><strong>Zero<br>Tolerance</strong><p>${esc(s.zero)}</p></div>
    <p class="sa-src">${esc(s.sumber)}</p>`;
}
/* halaman berita Saling Ingatkan Bahaya Penipuan Digital */
function isiPenipuan(){
  const s=PENIPUAN;
  return `<div class="pgn-hero pn-hero">
      <span class="pgn-hero-ik">${IKON.pesan}</span>
      <span class="pgn-hero-lbl">${esc(s.label)}</span>
      <h2 class="pgn-hero-j" id="pgn-judul" tabindex="-1">${esc(s.judul)}</h2>
      <p class="pgn-hero-intro">${tebal(s.intro)}</p>
    </div>
    <div class="pn-list">${s.tips.map((t,i)=>`<article class="pn-tip"><span class="pn-tip-ik">${IKON[t.ik]}</span>
      <div><span class="pn-tip-no">${i+1}</span><b>${esc(t.j)}</b><p>${tebal(t.k)}</p></div></article>`).join('')}</div>
    <div class="pn-ajak"><span class="pn-ajak-ik">${IKON.bagikan}</span><div><b>${esc(s.ajakan)}</b>
      <div class="pn-tagar">${s.tagar.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div></div>
    <div class="pn-aksi">
      <button type="button" class="pn-btn pn-wa" data-pgn-bagikan="wa">${IKON.pesan}<span>Bagikan</span></button>
      <button type="button" class="pn-btn" data-pgn-bagikan="salin">${IKON.salin}<span>Salin pesan</span></button>
    </div>
    <p class="pn-status" role="status" aria-live="polite"></p>`;
}
/* tombol bagikan: lembar bagikan bawaan HP bila ada, selain itu WhatsApp; "Salin pesan" ke papan klip */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-pgn-bagikan]');if(!b)return;
  const PESAN_PENIPUAN=b.dataset.pgnTeks==='livin'?PESAN_LIVIN:PESAN_PENIPUAN_ASLI;   // teks yang dibagikan sesuai beritanya
  const st=b.closest('.pgn-panel,body').querySelector('.pn-status');
  const lapor=t=>{if(st){st.textContent=t;clearTimeout(st._t);st._t=setTimeout(()=>{st.textContent='';},3500);}};
  const salin=()=>{
    const cadangan=()=>{const ta=document.createElement('textarea');ta.value=PESAN_PENIPUAN;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();
      let ok=false;try{ok=document.execCommand('copy');}catch(_){}ta.remove();lapor(ok?'Pesan disalin. Tempel di WhatsApp atau aplikasi lain.':'Tidak bisa menyalin otomatis di perangkat ini.');};
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(PESAN_PENIPUAN).then(()=>lapor('Pesan disalin. Tempel di WhatsApp atau aplikasi lain.'),cadangan);else cadangan();
  };
  if(b.dataset.pgnBagikan==='salin'){salin();return;}
  const wa=()=>{const w=window.open('https://wa.me/?text='+encodeURIComponent(PESAN_PENIPUAN),'_blank','noopener');if(!w)location.href='https://wa.me/?text='+encodeURIComponent(PESAN_PENIPUAN);};
  if(navigator.share)navigator.share({text:PESAN_PENIPUAN}).catch(err=>{if(err&&err.name!=='AbortError')wa();});else wa();
});
/* halaman berita Sikap Akhir Layanan & Edukasi Klik Livin’ Food */
function isiLivin(){
  const s=LIVIN;
  return `<div class="pgn-hero lv-hero">
      <span class="pgn-hero-ik">${IKON.pesan}</span>
      <span class="pgn-hero-lbl">${esc(s.label)}</span>
      <h2 class="pgn-hero-j" id="pgn-judul" tabindex="-1">${esc(s.judul)}</h2>
      <p class="pgn-hero-intro">${tebal(s.intro)}</p>
    </div>
    <a class="lv-gbr" href="${s.gambar}" data-pgn-gambar="${s.gambar}" data-pgn-nama="Sikap-Akhir-Layanan-Livin-Food.jpg"><img src="${s.gambar}" alt="Infografis Customer Journey: Sikap Akhir Layanan dan Edukasi Klik Livin’ Food, 4 langkah dari skenario awal interaksi sampai sikap akhir layanan" loading="lazy" width="900" height="1600"><span>Ketuk untuk membuka, zoom &amp; unduh infografis</span></a>
    <h3 class="lv-j">📌 Poin Penguatan</h3>
    <div class="pn-list">${s.poin.map((t,i)=>`<article class="pn-tip"><span class="pn-tip-no lv-no">${i+1}</span><div><p>${tebal(t)}</p></div></article>`).join('')}</div>
    <h3 class="lv-j">📌 Perluasan Aktivitas Edukasi Klik Livin’ Food</h3>
    <div class="pn-list">${s.perluasan.map((t,i)=>`<article class="pn-tip"><span class="pn-tip-no lv-no">${i+1}</span><div><b>${esc(t[0])}</b><p>${esc(t[1])}</p></div></article>`).join('')}</div>
    <div class="pn-ajak"><span class="pn-ajak-ik">${IKON.bagikan}</span><div><p class="lv-p">${tebal(s.catatan)}</p><p class="lv-p"><b>${esc(s.penutup)}</b></p>
      <div class="pn-tagar">${s.tagar.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div></div>
    <div class="pn-aksi">
      <button type="button" class="pn-btn pn-wa" data-pgn-bagikan="wa" data-pgn-teks="livin">${IKON.pesan}<span>Bagikan</span></button>
      <button type="button" class="pn-btn" data-pgn-bagikan="salin" data-pgn-teks="livin">${IKON.salin}<span>Salin pesan</span></button>
    </div>
    <p class="pn-status" role="status" aria-live="polite"></p>`;
}
/* halaman berita Penegasan Mekanisme Pelaksanaan, Persetujuan & Pemeriksaan Transaksi */
function isiMekanisme(){
  const s=MEKANISME,li=a=>`<ul>${a.map(t=>`<li>${tebal(t)}</li>`).join('')}</ul>`;
  const sub=(no,t,k)=>`<h3 class="sa-sub mk-sub"><span class="mk-no">${esc(no)}</span><span>${esc(t)}${k?`<small>${esc(k)}</small>`:''}</span></h3>`;
  const cat=t=>`<p class="mk-cat">${esc(t)}</p>`;
  const sistem=s.sistem.map(x=>`<div class="mk-sis ${x.baru?'mk-sis-baru':''}">
      <span class="mk-tag">${esc(x.tag)}</span><b class="mk-sis-j">${esc(x.j)}</b><p>${tebal(x.k)}</p>
      <div class="mk-sis-alur">${x.alur.map(a=>`<div><b>${esc(a[0])}</b><small>${esc(a[1])}</small></div>`).join('')}</div>
    </div>`).join('');
  const transaksi=s.transaksi.map(t=>`<div class="mk-trx ${t.atas?'mk-trx-atas':''}">
      <div class="mk-trx-h"><b>${esc(t.j)}</b><small>${esc(t.k)}</small></div>
      <div class="mk-trx-g">
        <div class="mk-trx-s"><span class="mk-tag">Old BDS</span><p>${tebal(t.old)}</p></div>
        <div class="mk-trx-s"><span class="mk-tag mk-tag-baru">New BDS</span><p>${tebal(t.baru)}</p>
          ${t.metode?`<div class="mk-met">${t.metode.map(m=>`<div class="${m[2]?'mk-met-otp':'mk-met-fr'}"><b>${esc(m[0])}</b><small>${esc(m[1])}</small></div>`).join('')}</div>`:''}</div>
      </div>
    </div>`).join('');
  return `<div class="pgn-hero sa-hero mk-hero">
      <span class="sa-tag">${esc(s.label)}</span>
      <h2 class="pgn-hero-j" id="pgn-judul" tabindex="-1">${esc(s.judul)}</h2>
      <p class="pgn-hero-intro">${tebal(s.intro)}</p>
      <p class="sa-ref">${esc(s.ref)}</p>
    </div>
    <a class="mk-pdf" href="${s.pdf}" target="_blank" rel="noopener">${IKON.pdf}<span><b>Buka infografis lengkap (PDF)</b><small>Ringkasan surat edaran · 1 halaman</small></span>${IKON.panah}</a>
    ${sub('A','Latar Belakang','Cabang kini berjalan dengan dua sistem secara paralel')}
    <div class="sa-g2">${sistem}</div>
    ${sub('1','User ID Old BDS & New BDS')}
    <div class="mk-g3">${s.userid.map(c=>`<div class="sa-cg"><div class="sa-cg-h"><span class="sa-cg-ik">${IKON[c.ik]}</span><b>${esc(c.j)}</b></div>${li(c.poin)}</div>`).join('')}</div>
    ${cat(s.useridCat)}
    ${sub('2','Pelaksanaan Transaksi','Siapa melakukan apa, berdasarkan kewenangan & sistem')}
    <div class="mk-trx-list">${transaksi}</div>
    ${cat(s.transaksiCat)}
    ${sub('3','Pemeriksaan Transaksi','Memastikan transaksi sesuai perintah nasabah & ketentuan')}
    <div class="mk-g3">${s.periksa.map(p=>`<div class="mk-prk ${p.sorot?'mk-prk-sorot':''}"><span class="mk-tag ${p.tag==='Old BDS'?'':'mk-tag-baru'}">${esc(p.tag)}</span><b>${esc(p.j)}</b><p>${tebal(p.k)}</p>${p.cat?`<small>${esc(p.cat)}</small>`:''}</div>`).join('')}</div>
    <div class="mk-cek"><b>Checklist pemeriksaan Exception Report oleh BOM/BOS</b>
      <ul>${s.checklist.map(t=>`<li>${IKON.centang}<span>${esc(t)}</span></li>`).join('')}</ul>
      <small>${esc(s.checklistCat)}</small></div>
    ${sub('4','Kontrol Kas, Kartu Debit & Surat Berharga')}
    <div class="sa-g2">${s.kas.map(c=>`<div class="sa-cg"><div class="sa-cg-h"><span class="sa-cg-ik">${IKON[c.ik]}</span><b>${esc(c.j)}</b></div>${li(c.poin)}</div>`).join('')}</div>
    <h4 class="mk-kal-j">Kalender kontrol yang wajib dijalankan</h4>
    <div class="mk-kal">${s.kalender.map(k=>`<div class="mk-kal-k"><div class="mk-kal-h"><strong>${esc(k.n)}</strong><span>${esc(k.f)}</span></div>${li(k.poin)}</div>`).join('')}</div>
    ${cat(s.kalenderCat)}
    ${sub('C','Tindak Lanjut')}
    <div class="sa-g2">${s.tindak.map((t,i)=>`<div class="mk-tl"><span class="mk-tl-no">${i+1}</span><p>${tebal(t)}</p></div>`).join('')}
      <div class="mk-tl mk-tl-sanksi"><span class="mk-tl-no">!</span><p>${tebal(s.sanksi)}</p></div></div>
    <p class="sa-src">${esc(s.sumber)}</p>`;
}
const HALAMAN={daftar:isiDaftar,penguatan:isiPenguatan,setor:isiSetor,penipuan:isiPenipuan,livin:isiLivin,mekanisme:isiMekanisme};
function isiDetail(hal){
  const detail=hal!=='daftar';
  return `<div class="pgn-xbar">${detail?`<button type="button" class="pgn-back" data-pgn-kembali aria-label="Kembali ke Informasi Highlight Issue Operasional">${IKON.kembali}<span>Kembali</span></button>`:''}
      <button type="button" class="pgn-x" data-pgn-close aria-label="Tutup">${IKON.tutup}</button></div>
    ${HALAMAN[hal]()}
    <button type="button" class="pgn-ok" ${detail?'data-pgn-kembali':'data-pgn-close'}>${detail?'Saya mengerti':'Tutup'}</button>`;
}
/* pindah halaman di dalam panel (daftar <-> detail berita) */
function gantiHalaman(hal){
  if(!panel||!HALAMAN[hal])return;
  const isi=panel.querySelector('.pgn-panel');
  isi.dataset.hal=hal;
  isi.innerHTML=isiDetail(hal);
  isi.scrollTop=0;
  const j=isi.querySelector('#pgn-judul');if(j)try{j.focus({preventScroll:true});}catch(e){}
}
function bukaDetail(){
  if(panel)return;
  fokusSebelum=document.activeElement;
  panel=document.createElement('div');
  panel.className='pgn-latar';
  panel.innerHTML=`<div class="pgn-panel" role="dialog" aria-modal="true" aria-labelledby="pgn-judul" data-hal="daftar">${isiDetail('daftar')}</div>`;
  document.body.appendChild(panel);
  document.documentElement.classList.add('pgn-kunci');
  requestAnimationFrame(()=>panel.classList.add('buka'));
  panel.querySelector('.pgn-x').focus();
  panel.addEventListener('click',e=>{
    if(e.target===panel||e.target.closest('[data-pgn-close]')){tutupDetail();return;}
    const b=e.target.closest('[data-pgn-buka]');if(b){gantiHalaman(b.dataset.pgnBuka);return;}
    if(e.target.closest('[data-pgn-kembali]'))gantiHalaman('daftar');
  });
  pasangGeserDetail(panel);
}
/* Tarik dari posisi scroll teratas; scroll isi tetap mengikuti browser. */
function pasangGeserDetail(latar){
  const isi=latar.querySelector('.pgn-panel');
  let tarik=null;
  const reset=()=>{
    tarik=null;
    isi.style.transition='';isi.style.transform='';latar.style.backgroundColor='';
  };
  isi.addEventListener('touchstart',e=>{
    if(!window.matchMedia('(max-width:759px)').matches||e.touches.length!==1||isi.scrollTop>0||e.target.closest('button,a,input,select,textarea'))return;
    const t=e.touches[0];
    tarik={x:t.clientX,y:t.clientY,dy:0,kunci:null};
  },{passive:true});
  isi.addEventListener('touchmove',e=>{
    if(!tarik)return;
    if(e.touches.length!==1){reset();return;}
    const t=e.touches[0],dx=t.clientX-tarik.x,dy=t.clientY-tarik.y;
    if(tarik.kunci===null){
      if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;
      if(dy<=0||Math.abs(dx)>=dy||isi.scrollTop>0){reset();return;}
      tarik.kunci=true;
    }
    if(!e.cancelable){reset();return;}
    e.preventDefault();
    tarik.dy=Math.max(0,dy);
    isi.style.transition='none';
    isi.style.transform=`translateY(${tarik.dy}px)`;
    latar.style.backgroundColor=`rgba(6,16,40,${.55*Math.max(0,1-tarik.dy/isi.clientHeight)})`;
  },{passive:false});
  isi.addEventListener('touchend',()=>{
    const tutup=tarik&&tarik.kunci&&tarik.dy>=90;
    if(tutup){
      tarik=null;
      // Lanjutkan dari posisi jari terakhir tanpa kembali ke posisi awal.
      tutupDetail(true);
    }else reset();
  });
  isi.addEventListener('touchcancel',reset);
}
function tutupDetail(digeser=false){
  if(!panel)return;
  const p=panel;panel=null;
  const isi=p.querySelector('.pgn-panel');
  const durasi=window.matchMedia('(prefers-reduced-motion:reduce)').matches?0:320;
  if(digeser){
    // Pastikan posisi tarik sudah dirender sebelum transisi penutupan.
    isi.getBoundingClientRect();
    isi.style.transition='';
    isi.style.transform='translate3d(0,100%,0)';
  }
  p.classList.remove('buka');
  const fokus=fokusSebelum;
  setTimeout(()=>{
    p.remove();
    if(!panel){
      document.documentElement.classList.remove('pgn-kunci');
      if(fokus&&fokus.focus)try{fokus.focus({preventScroll:true});}catch(e){}
    }
  },durasi);
}
/* ----- penampil gambar: zoom (pas layar / 100% / + / −), unduh, kembali ----- */
let lihat=null;
function bukaGambar(src,nama,alt){
  tutupGambar();
  const el=document.createElement('div');
  el.className='lg';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Pratinjau gambar');
  el.innerHTML=`<div class="lg-bar">
      <button type="button" class="lg-btn lg-kembali" data-lg="kembali" aria-label="Kembali ke halaman">${IKON.kiri}<span>Kembali</span></button>
      <span class="lg-judul">${esc(alt||'Infografis')}</span>
      <div class="lg-zoom" role="group" aria-label="Zoom gambar">
        <button type="button" class="lg-btn" data-lg="kecil" aria-label="Perkecil">−</button>
        <button type="button" class="lg-btn lg-pct" data-lg="pas" aria-label="Pas layar / 100%">Pas</button>
        <button type="button" class="lg-btn" data-lg="besar" aria-label="Perbesar">+</button>
        <button type="button" class="lg-btn lg-100" data-lg="100" aria-label="Ukuran asli 100%">100%</button>
      </div>
      <a class="lg-btn lg-unduh" href="${src}" download="${esc(nama)}" aria-label="Unduh gambar">${IKON.unduh}<span>Unduh</span></a>
    </div>
    <div class="lg-area"><img src="${src}" alt="${esc(alt||'')}" draggable="false"></div>
    <div class="lg-tip" aria-hidden="true">Cubit 2 jari untuk zoom · ketuk 2x untuk perbesar</div>`;
  document.body.appendChild(el);
  const img=el.querySelector('img'),area=el.querySelector('.lg-area'),pct=el.querySelector('.lg-pct');
  const st={z:0,pas:true};
  const pasZ=()=>Math.min(1,(area.clientWidth-16)/img.naturalWidth,(area.clientHeight-16)/img.naturalHeight);
  // atur(z, pas, titik) — titik {x,y} (koordinat layar) dipertahankan di bawah jari/kursor
  const atur=(z,pas,titik)=>{
    const ra=area.getBoundingClientRect(),ri=img.getBoundingClientRect();
    const tx=titik?titik.x:ra.left+area.clientWidth/2, ty=titik?titik.y:ra.top+area.clientHeight/2;
    const fx=ri.width?(tx-ri.left)/ri.width:.5, fy=ri.height?(ty-ri.top)/ri.height:.5;
    st.pas=!!pas; st.z=pas?pasZ():Math.max(.1,Math.min(4,z));
    const w=Math.round(img.naturalWidth*st.z),h=Math.round(img.naturalHeight*st.z);
    img.style.width=w+'px';
    pct.textContent=st.pas?'Pas':Math.round(st.z*100)+'%';
    area.classList.toggle('lg-tengah',img.offsetWidth<=area.clientWidth);
    area.scrollLeft=img.offsetLeft+fx*w-(tx-ra.left);
    area.scrollTop=img.offsetTop+fy*h-(ty-ra.top);
  };
  const siap=()=>atur(0,true);
  if(img.complete&&img.naturalWidth)siap();else img.addEventListener('load',siap,{once:true});
  el.addEventListener('click',e=>{
    const b=e.target.closest('[data-lg]');if(!b)return;
    const k=b.dataset.lg;
    if(k==='kembali')return tutupGambar();
    if(k==='kecil'){const z=st.z/1.25;z<pasZ()&&!st.pas&&st.z>pasZ()+.001?atur(0,true):atur(z);}
    if(k==='besar')atur(st.z*1.25);
    if(k==='100')atur(1);
    if(k==='pas')st.pas?atur(1):atur(0,true);
  });
  const zoomKe=t=>st.pas?atur(Math.max(1,pasZ()*2.5),false,t):atur(0,true);
  img.addEventListener('dblclick',e=>zoomKe({x:e.clientX,y:e.clientY}));
  // khusus layar sentuh: cubit (2 jari) untuk zoom, ketuk 2x untuk perbesar/pas, 1 jari menggeser (gulir bawaan)
  let cubit=null,ketukAkhir=0;
  const jarak=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  const tengah=t=>({x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2});
  area.addEventListener('touchstart',e=>{
    if(e.touches.length===2){cubit={d:jarak(e.touches),z:st.z};e.preventDefault();return;}
    if(e.touches.length===1&&!cubit){
      const now=Date.now(),t=e.touches[0];
      if(now-ketukAkhir<300){e.preventDefault();ketukAkhir=0;zoomKe({x:t.clientX,y:t.clientY});}
      else ketukAkhir=now;
    }
  },{passive:false});
  area.addEventListener('touchmove',e=>{
    if(!cubit||e.touches.length<2)return;
    e.preventDefault();ketukAkhir=0;
    const z=cubit.z*jarak(e.touches)/cubit.d;
    if(Math.abs(z-st.z)>.004)atur(z,false,tengah(e.touches));
  },{passive:false});
  const akhirCubit=e=>{
    if(!cubit||e.touches.length>=2)return;
    cubit=null;
    if(st.z<=pasZ()+.001)atur(0,true);   // terlalu kecil → kembali pas layar
  };
  area.addEventListener('touchend',akhirCubit);area.addEventListener('touchcancel',akhirCubit);
  el.addEventListener('gesturestart',e=>e.preventDefault());   // iOS Safari: cegah zoom halaman
  el.addEventListener('gesturechange',e=>e.preventDefault());
  // geser dengan mouse
  let tarik=null;
  area.addEventListener('mousedown',e=>{tarik={x:e.clientX,y:e.clientY,l:area.scrollLeft,t:area.scrollTop};area.classList.add('lg-tarik');e.preventDefault();});
  window.addEventListener('mousemove',lihat_gerak=e=>{if(!tarik)return;area.scrollLeft=tarik.l-(e.clientX-tarik.x);area.scrollTop=tarik.t-(e.clientY-tarik.y);});
  window.addEventListener('mouseup',lihat_lepas=()=>{tarik=null;area.classList.remove('lg-tarik');});
  window.addEventListener('resize',lihat_ukur=()=>{if(st.pas)atur(0,true);});
  const tip=el.querySelector('.lg-tip'),hilangTip=()=>tip&&tip.classList.add('lg-tip-hilang');
  setTimeout(hilangTip,3500);area.addEventListener('touchstart',hilangTip,{passive:true,once:true});
  lihat={el,fokus:document.activeElement};
  document.documentElement.classList.add('lg-buka');
  el.querySelector('.lg-kembali').focus();
}
let lihat_gerak,lihat_lepas,lihat_ukur;
function tutupGambar(){
  if(!lihat)return;
  window.removeEventListener('mousemove',lihat_gerak);window.removeEventListener('mouseup',lihat_lepas);window.removeEventListener('resize',lihat_ukur);
  const f=lihat.fokus;lihat.el.remove();lihat=null;document.documentElement.classList.remove('lg-buka');
  if(f&&f.focus)f.focus();
}
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-pgn-gambar]');if(!a)return;
  e.preventDefault();bukaGambar(a.dataset.pgnGambar,a.dataset.pgnNama||'gambar.jpg',a.querySelector('img')?.alt);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&lihat){tutupGambar();e.stopImmediatePropagation();}},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel)tutupDetail();});

/* ===== tutup notifikasi (geser / tombol ×) =====
   Berlaku untuk notifikasi Penguatan Operasional, Waktu Antrian, dan Utilisasi NBDS. */
const GESER='#pgn-notif,.kito-pctl-top';
function buangNotif(el,arah){
  if(!el||el.dataset.dibuang)return;
  el.dataset.dibuang='1';                         // klik yang menyusul gerakan geser diabaikan
  const pctl=el.matches('.kito-pctl-top');
  if(!pctl)tutupNotif();
  el.style.transition='transform .22s ease, opacity .22s ease';
  el.style.transform=`translateX(${arah*110}%)`;el.style.opacity='0';
  setTimeout(()=>{
    el.style.height=el.offsetHeight+'px';el.offsetHeight;   // lalu ciutkan tinggi agar konten di bawah naik halus
    el.style.transition='height .2s ease, margin .2s ease, padding .2s ease';
    el.style.height='0';el.style.margin='0';el.style.padding='0';el.style.borderWidth='0';
    // Pakai tombol × masing-masing informasi agar status tertutup ikut tersimpan.
    setTimeout(()=>{const x=pctl&&el.querySelector('.kito-pctl-close');if(x)x.click();else el.remove();},220);
  },220);
}
let geser=null;   // {el,x0,y0,dx,arahKunci}
app.addEventListener('pointerdown',e=>{
  const el=e.target.closest(GESER);if(!el||e.target.closest('[data-pgn-tutup],.kito-pctl-close'))return;
  geser={el,x0:e.clientX,y0:e.clientY,dx:0,kunci:null,id:e.pointerId};
});
app.addEventListener('pointermove',e=>{
  if(!geser||e.pointerId!==geser.id)return;
  const dx=e.clientX-geser.x0,dy=e.clientY-geser.y0;
  if(geser.kunci===null&&(Math.abs(dx)>8||Math.abs(dy)>8))geser.kunci=Math.abs(dx)>Math.abs(dy)?'x':'y';
  if(geser.kunci!=='x')return;
  geser.dx=dx;
  try{geser.el.setPointerCapture(e.pointerId);}catch(_){}
  geser.el.style.transition='none';
  geser.el.style.transform=`translateX(${dx}px)`;
  geser.el.style.opacity=String(Math.max(.25,1-Math.abs(dx)/260));
});
const lepas=e=>{
  if(!geser||e.pointerId!==geser.id)return;
  const {el,dx,kunci}=geser;geser=null;
  if(kunci==='x'&&Math.abs(dx)>90){buangNotif(el,Math.sign(dx));return;}
  el.style.transition='transform .2s ease, opacity .2s ease';el.style.transform='';el.style.opacity='';
  if(kunci==='x')el.dataset.barusajaGeser='1';
};
app.addEventListener('pointerup',lepas);
app.addEventListener('pointercancel',lepas);
app.addEventListener('click',e=>{
  const x=e.target.closest('[data-pgn-tutup]');
  if(x){e.stopPropagation();buangNotif(x.closest('#pgn-notif'),1);return;}
  const n=e.target.closest('#pgn-notif');
  if(!n||n.dataset.dibuang)return;
  if(n.dataset.barusajaGeser){delete n.dataset.barusajaGeser;return;}   // akhir gerakan geser bukan ketukan
  bukaDetail();
});
app.addEventListener('keydown',e=>{
  const n=e.target.closest&&e.target.closest('#pgn-notif');
  if(n&&e.target===n&&(e.key==='Enter'||e.key===' ')){e.preventDefault();bukaDetail();}
  if(n&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();buangNotif(n,1);}
});

if(typeof tampil!=='undefined'&&tampil==='cabang')render();
})();
