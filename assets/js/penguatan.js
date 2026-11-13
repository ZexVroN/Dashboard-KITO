/* Notifikasi "Informasi Highlight Issue Operasional" di halaman Cabang.
   - Kartu notifikasi di paling atas halaman Cabang: ketuk = buka halaman informasi, geser kiri/kanan atau tombol × = tutup.
   - Notifikasi yang ditutup muncul kembali setelah halaman dimuat ulang.
   - Halaman informasi berbentuk daftar berita (array BERITA). Ketuk berita = pindah ke halaman detailnya:
     "Penguatan Operasional" (7 kartu poin, array POIN) dan "Waspada Setor Angin" (objek SETOR).
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

/* ----- daftar berita di halaman Informasi Highlight Issue Operasional (paling baru di atas) ----- */
const INFO={
  label:'Highlight Issue',
  judul:'Informasi Highlight Issue Operasional',
  intro:'Kumpulan informasi & pengingat kewaspadaan **operasional cabang**. Ketuk informasi untuk membaca selengkapnya.',
};
const BERITA=[
  {id:'setor', ik:'angin', warna:'merah', baru:true, kat:'Reminder Kewaspadaan', tgl:'5 November 2026',
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
const HALAMAN={daftar:isiDaftar,penguatan:isiPenguatan,setor:isiSetor};
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
