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
const kartu=()=>window.KITO_SALES_CARDS||[];   // diisi infografis.js & pegawai.js (akuisisi) dan emas.js (fn.tab='emas')
// tombol halaman: "Akuisisi Cabang & Pegawai" | "Program Emas" (pilihan diingat selama sesi tab)
const TAB=[['akuisisi','📊','Akuisisi Cabang & Pegawai','Informasi Sales Akuisisi Cabang & Sales Pegawai per cabang terpilih.'],
           ['emas','🪙','Program Emas','Tabungan Emas & Cetak Emas di ATM per cabang dan pegawai.']];
let tab='akuisisi';try{const t=sessionStorage.getItem('kito-sales-tab');if(TAB.some(x=>x[0]===t))tab=t;}catch(e){}
const tabKartu=fn=>fn.tab||'akuisisi';

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
  const ada=TAB.filter(t=>kartu().some(fn=>tabKartu(fn)===t[0]));
  if(!ada.some(t=>t[0]===tab))tab=(ada[0]||TAB[0])[0];
  const kartuHtml=kartu().filter(fn=>tabKartu(fn)===tab).map(fn=>{try{return fn()||'';}catch(e){return '';}}).join('');
  const aktif=TAB.find(t=>t[0]===tab);
  // kartu identitas cabang (nama, area, kelas, Branch Manager & BOM/BOS) seperti di halaman Cabang
  const fnHero=window.KITO_KARTU_CABANG||(typeof kartuCabang==='function'?kartuCabang:null);
  let heroCabang='';try{heroCabang=D.B[st.b]&&fnHero?fnHero():'';}catch(e){heroCabang='';}
  const tombol=ada.length>1?`<div class="sl-tabs" role="tablist" aria-label="Halaman Informasi Sales">${ada.map(t=>
    `<button type="button" role="tab" data-sl-tab="${t[0]}" aria-selected="${t[0]===tab}" class="${t[0]===tab?'on':''}"><span aria-hidden="true">${t[1]}</span>${t[2]}</button>`).join('')}</div>`:'';
  return `<section class="sl-head"><button type="button" class="sl-back" data-v="cabang">‹ Kembali ke Cabang</button>
    <h2>📈 Informasi Sales</h2>
    <p>${aktif[3].replace(/&/g,'&amp;')}</p>
    ${tombol}
    ${tab==='akuisisi'?`<p class="sl-per">📅 ${periode()}</p>`:''}</section>
    ${heroCabang}
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
app.addEventListener('click',e=>{
  const b=tampil==='sales'&&e.target.closest('[data-sl-tab]');if(!b||b.dataset.slTab===tab)return;
  tab=b.dataset.slTab;try{sessionStorage.setItem('kito-sales-tab',tab);}catch(x){}
  render();
  document.querySelector(`[data-sl-tab="${tab}"]`)?.focus({preventScroll:true});
});
/* Buka halaman Informasi Sales untuk satu cabang dari halaman mana pun (Ranking, Area · Informasi Sales, ...).
   Pakai atribut: data-sales-kode="<kode cabang>" [data-sales-tab="akuisisi"|"emas"].
   Juga tersedia sebagai window.KITO_BUKA_SALES(kode, tab). */
const kodeAngka=x=>String(x??'').replace(/\D/g,'');
function bukaSales(kode,t){
  const i=D.B.findIndex(b=>kodeAngka(b[0])===kodeAngka(kode));if(i<0)return false;
  st.b=i;st.a=D.B[i][2];
  if(t&&TAB.some(x=>x[0]===t)){tab=t;try{sessionStorage.setItem('kito-sales-tab',tab);}catch(x){}}
  tampil='sales';
  if(typeof fill==='function')fill();
  render();window.scrollTo(0,0);return true;
}
window.KITO_BUKA_SALES=bukaSales;
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-sales-kode]');if(!b)return;
  e.preventDefault();e.stopPropagation();
  bukaSales(b.dataset.salesKode,b.dataset.salesTab);
},true);
if(tampil==='sales')render();
})();
