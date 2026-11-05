/* Notifikasi "7 Poin Penguatan Operasional" di halaman Cabang.
   - Kartu notifikasi di paling atas halaman Cabang: ketuk = buka detail, geser kiri/kanan atau tombol × = tutup.
   - Notifikasi yang ditutup muncul kembali setelah halaman dimuat ulang.
   - Detail: panel layar penuh berisi judul besar (ikon perisai) dan 7 kartu poin.
   Isi poin diedit langsung di array POIN di bawah. Add-on non-destruktif: menyisipkan kartu ke URUTAN. */
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
  return `<div class="pgn-notif" id="pgn-notif" role="button" tabindex="0" aria-label="Buka Highlight Issue: 7 Poin Kontrol Operasional">
    <span class="pgn-n-ik">${IKON.perisai}</span>
    <span class="pgn-n-tx"><small>HIGHLIGHT ISSUE !!!</small><b>${POIN.length} Poin Kontrol Operasional</b><em>WAJIB DIBACA · Ketuk untuk lihat detail</em></span>
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
function isiDetail(){
  const kartu=POIN.map((p,i)=>`<article class="pgn-k ${p.jenis==='inisiatif'?'pgn-k-sorot':''}">
      <div class="pgn-k-top"><span class="pgn-k-ik">${IKON[p.ik]||IKON.centang}</span><span class="pgn-k-no">${String(i+1).padStart(2,'0')}</span></div>
      <span class="pgn-k-kat">${esc(p.kat)}</span>
      <h3>${esc(p.judul)}</h3>
      <p>${tebal(p.isi)}</p>
      <span class="pgn-k-tanda">${IKON.centang}${esc(p.tanda)}</span>
    </article>`).join('');
  return `<div class="pgn-panel" role="dialog" aria-modal="true" aria-labelledby="pgn-judul">
    <div class="pgn-xbar"><button type="button" class="pgn-x" data-pgn-close aria-label="Tutup detail">${IKON.tutup}</button></div>
    <div class="pgn-hero">
      <span class="pgn-hero-ik">${IKON.perisai}</span>
      <span class="pgn-hero-lbl" id="pgn-judul">${esc(JUDUL.label)}</span>
      <p class="pgn-hero-intro">${tebal(JUDUL.intro)}</p>
      <div class="pgn-hero-jml"><strong>${POIN.length}</strong><span>${esc(JUDUL.ringkas)}</span></div>
    </div>
    <div class="pgn-grid">${kartu}${kartuKeterangan()}</div>
    <button type="button" class="pgn-ok" data-pgn-close>Saya mengerti</button>
  </div>`;
}
function bukaDetail(){
  if(panel)return;
  fokusSebelum=document.activeElement;
  panel=document.createElement('div');
  panel.className='pgn-latar';
  panel.innerHTML=isiDetail();
  document.body.appendChild(panel);
  document.documentElement.classList.add('pgn-kunci');
  requestAnimationFrame(()=>panel.classList.add('buka'));
  panel.querySelector('.pgn-x').focus();
  panel.addEventListener('click',e=>{if(e.target===panel||e.target.closest('[data-pgn-close]'))tutupDetail();});
}
function tutupDetail(){
  if(!panel)return;
  const p=panel;panel=null;
  p.classList.remove('buka');
  document.documentElement.classList.remove('pgn-kunci');
  setTimeout(()=>p.remove(),220);
  if(fokusSebelum&&fokusSebelum.focus)try{fokusSebelum.focus();}catch(e){}
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
