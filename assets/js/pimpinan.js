/* Kartu cabang (tab Cabang): tambahan nama Branch Manager dan BOM/BOS di bawah nama cabang.
   Data: data/kito.json [KITO_PIMPINAN] (tools/build_pimpinan.py dari BOS-BM.xlsx).
   Nomor HP BOM/BOS + tombol Telepon & WhatsApp: hanya untuk akun login ROH & SQO Region (semua cabang) serta
   ASM & SQO Area (hanya cabang di areanya). Nomor TIDAK ada di data publik: diambil dari server (POST /api/kontak/bom,
   push-php/lib/kontak.php) memakai kredensial akun login, disimpan di memori saja, hilang saat logout/muat ulang.
   Nomor HP/WhatsApp Kepala Cabang: HANYA akun ROH (server mengirim field "kc" khusus ROH; data/kontak-kc.php).
   Add-on non-destruktif: membungkus kartuCabang di URUTAN, tidak mengubah script.js. */
(()=>{'use strict';
const P=window.KITO_PIMPINAN;
if(!P||typeof URUTAN==='undefined'||typeof kartuCabang!=='function'||typeof D==='undefined')return;
const i=URUTAN.indexOf(kartuCabang);if(i<0)return;
// dibaca saat dipakai: push-config.js dimuat setelah file ini
const API=()=>(window.KITO_PUSH?.api||'').replace(/\/+$/,'');
const BOLEH=['admin','roh','sqor','sqoa','asm'];
const akun=()=>{try{return window.KITO_AKUN?.kini()||null;}catch(e){return null;}};
const SVG=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IK_TEL=SVG('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>');
const IK_WA=SVG('<path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4.1-1.1L3.5 20.5z"/><path d="M9 8.5c0 3.3 2.6 6.4 6 6.5l1-1.6-2-1-1 .9c-1-.4-2.2-1.6-2.6-2.6l.9-1-1-2L9 8.5z"/>');

/* nomor HP dari server, per akun login */
let K={kunci:null,data:null,kc:null,err:'',muat:false};
async function muatKontak(){
  const a=akun();
  if(!a||!BOLEH.includes(a.jab)||!API()){if(K.kunci!==null){K={kunci:null,data:null,err:'',muat:false};}return;}
  if(K.kunci===a.kunci)return;
  K={kunci:a.kunci,data:null,err:'',muat:true};
  const kunci=a.kunci;let data=null,kc=null,err='';
  try{
    const r=await fetch(API()+'/api/kontak/bom',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a.kred),cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(r.status===401?'Sesi login tidak berlaku lagi. Silakan logout lalu login ulang.':(j.error||'server tidak merespons ('+r.status+')'));
    data=j.kontak||{};kc=a.jab==='roh'&&j.kc?j.kc:null;
  }catch(e){err=e.message||'server tidak bisa dihubungi';}
  if(K.kunci!==kunci)return;
  K={kunci,data,kc,err,muat:false};
  if(typeof tampil==='undefined'||tampil==='cabang')render();
}
window.addEventListener('kito-akun',()=>{K={kunci:null,data:null,err:'',muat:false};muatKontak();if(typeof tampil==='undefined'||tampil==='cabang')render();});

function blokKontak(kode,namaBom){
  const a=akun();
  if(!a||!BOLEH.includes(a.jab)||!API())return '';
  if(K.kunci!==a.kunci){setTimeout(muatKontak,0);return `<div class="pm-hp pm-hp-info">Memuat nomor HP BOM/BOS…</div>`;}
  if(K.muat)return `<div class="pm-hp pm-hp-info">Memuat nomor HP BOM/BOS…</div>`;
  if(K.err)return `<div class="pm-hp pm-hp-info">${esc(K.err)}</div>`;
  const k=K.data&&K.data[kode];
  if(!k){
    const luar=(a.jab==='asm'||a.jab==='sqoa');
    return `<div class="pm-hp pm-hp-info">${luar&&Object.keys(K.data||{}).length?'Nomor HP hanya ditampilkan untuk cabang di area Anda.':'Nomor HP BOM/BOS cabang ini belum tersedia.'}</div>`;
  }
  return `<div class="pm-hp">
    <span class="pm-hp-no"><small>No. HP BOM / BOS${k.nama&&String(k.nama).toLowerCase()!==String(namaBom||'').toLowerCase()?' · '+esc(k.nama):''}</small><b>${esc(k.hp)}</b></span>
    <span class="pm-hp-ak">
      <a class="pm-btn" href="tel:+${esc(k.wa)}" aria-label="Telepon ${esc(k.nama||'BOM/BOS')}">${IK_TEL}<span>Telepon</span></a>
      <a class="pm-btn pm-wa" href="https://wa.me/${esc(k.wa)}" target="_blank" rel="noopener" aria-label="WhatsApp ${esc(k.nama||'BOM/BOS')}">${IK_WA}<span>WhatsApp</span></a>
    </span>
  </div>`;
}

/* nomor Kepala Cabang: khusus akun ROH */
function blokKc(kode,namaBm){
  const a=akun();
  if(!a||a.jab!=='roh'||K.kunci!==a.kunci||K.muat||K.err||!K.data)return '';
  const k=K.kc&&K.kc[kode];
  if(!K.kc)return `<div class="pm-hp pm-hp-info">Nomor HP Kepala Cabang belum diunggah ke server.</div>`;
  if(!k)return `<div class="pm-hp pm-hp-info">Nomor HP Kepala Cabang cabang ini belum tersedia.</div>`;
  const nm=k.nama&&String(k.nama).toLowerCase()!==String(namaBm||'').toLowerCase()?' · '+esc(k.nama):'';
  return `<div class="pm-hp pm-hp-kc">
    <span class="pm-hp-no"><small>No. HP Kepala Cabang${nm}</small><b>${esc(k.hp)}</b></span>
    <span class="pm-hp-ak">
      <a class="pm-btn" href="tel:+${esc(k.wa)}" aria-label="Telepon Kepala Cabang ${esc(k.nama||'')}">${IK_TEL}<span>Telepon</span></a>
      <a class="pm-btn pm-wa" href="https://wa.me/${esc(k.wa)}" target="_blank" rel="noopener" aria-label="WhatsApp Kepala Cabang ${esc(k.nama||'')}">${IK_WA}<span>WhatsApp</span></a>
    </span>
  </div>`;
}

const orang=(jabatan,nama)=>`<div class="pm"><small>${jabatan}</small><b class="${nama?'':'pm-kosong'}">${nama?esc(nama):'Belum ada data'}</b></div>`;
function kartuCabangPimpinan(){
  const html=kartuCabang();
  const b=D.B[st.b];if(!b)return html;
  const p=P.data[String(b[0])];if(!p)return html;
  const blok=`<div class="pm-row">${orang('Branch Manager',p[0])}${orang('BOM / BOS',p[1])}</div>${blokKc(String(b[0]),p[0])}${blokKontak(String(b[0]),p[1])}`;
  const j=html.lastIndexOf('</div>');            // sisipkan di dalam kartu hero, sebelum penutupnya
  return j<0?html:html.slice(0,j)+blok+html.slice(j);
}
URUTAN[i]=kartuCabangPimpinan;
window.KITO_KARTU_CABANG=kartuCabangPimpinan;   // dipakai juga di halaman Informasi Sales cabang (sales.js)
render();
})();
