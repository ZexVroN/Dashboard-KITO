/* Halaman "Informasi Sales" (view tersendiri: tampil==='sales').
   Menampung kartu yang dipindahkan dari halaman Cabang:
     1) "Informasi Sales Akuisisi Cabang"  (infografis.js → kartuInfografisCabang)
     2) "Informasi Sales Pegawai & Akuisisi" (pegawai.js   → kartuPegawai)
   Kedua kartu diekspor lewat window.KITO_SALES_CARDS dan dirender di sini.
   Add-on non-destruktif: membungkus render() + menambah tombol menu di atas halaman Cabang.
   Karena filter header disembunyikan di luar tab Cabang, halaman ini punya selektor cabang sendiri. */
(()=>{'use strict';
if(typeof URUTAN==='undefined'||typeof D==='undefined'||typeof render!=='function')return;
const app=document.getElementById('app');if(!app)return;
const kartu=()=>window.KITO_SALES_CARDS||[];   // diisi infografis.js & pegawai.js

// Satu label periode seragam untuk kedua kartu (menggantikan tanggal berbeda di tiap judul kartu).
function periode(){
  const iso=window.KITO_SALES_PEGAWAI?.tanggal;
  if(!iso)return 'Periode MTD Oktober 2026';
  const d=new Date(iso+'T00:00');
  const bln=d.toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  const tgl=d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  return `Periode MTD ${bln} · update s.d. ${tgl}`;
}

function page(){
  // cabang & periode dipilih lewat dropdown header (ditampilkan di mode-sales via sales.css)
  const kartuHtml=kartu().map(fn=>{try{return fn()||'';}catch(e){return '';}}).join('');
  return `<section class="sl-head"><button type="button" class="sl-back" data-v="cabang">‹ Kembali ke Cabang</button>
    <h2>📈 Informasi Sales</h2>
    <p>Informasi Sales Akuisisi Cabang &amp; Sales Pegawai per cabang terpilih.</p>
    <p class="sl-per">📅 ${periode()}</p></section>
    ${kartuHtml||'<p class="sl-note">Data sales tidak tersedia untuk cabang ini.</p>'}`;
}

/* tombol menu "Informasi Sales" di atas halaman Cabang (bukan di navigasi bawah) */
function kartuSalesLink(){
  if(!D.B[st.b])return '';
  const sales=`<button type="button" class="sales-open" data-v="sales"><span class="sales-open-ik">📈</span><span class="sales-open-tx"><b>Informasi Sales</b><small>Cabang &amp; Pegawai</small></span><span class="sales-open-go">›</span></button>`;
  // tombol menu lain (mis. DTI dari dti.js) ikut satu baris; digeser ke samping bila layar sempit
  const lain=(window.KITO_MENU_LINKS||[]).map(f=>f()).join('');
  return `<div class="menu-geser" role="group" aria-label="Menu cabang">${sales}${lain}</div>`;
}
URUTAN.splice(0,0,kartuSalesLink);

/* bungkus render() */
const sebelumnya=render;
render=function(){
  sebelumnya();
  document.body.classList.toggle('mode-sales',tampil==='sales');
  if(tampil!=='sales')return;
  // halaman Sales bagian dari Cabang: tandai tab Cabang di navigasi bawah (teks putih di atas kapsul)
  document.querySelector('#nav button[data-v="cabang"]')?.classList.add('on');
  app.innerHTML=page();
};
if(tampil==='sales')render();
})();
