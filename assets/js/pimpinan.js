/* Kartu cabang (tab Cabang): tambahan nama Branch Manager dan BOM/BOS di bawah nama cabang.
   Data: data/kito.json [KITO_PIMPINAN] (tools/build_pimpinan.py dari BOS-BM.xlsx).
   Nomor HP BOM/BOS + tombol Telepon & WhatsApp: hanya untuk akun login ROH & SQO Region (semua cabang) serta
   ASM & SQO Area (hanya cabang di areanya). Nomor TIDAK ada di data publik: diambil dari server (POST /api/kontak/bom,
   push-php/lib/kontak.php) memakai kredensial akun login, disimpan di memori saja, hilang saat logout/muat ulang.
   Nomor HP/WhatsApp Kepala Cabang: HANYA akun ROH & SQO Region (server mengirim field "kc" khusus keduanya; data/kontak-kc.php).
   Tombol Edit / Tambah nomor: akun yang melihat nomor dapat mengubahnya (POST /api/kontak/ubah; cakupan sama dengan lihat).
   Add-on non-destruktif: membungkus kartuCabang di URUTAN, tidak mengubah script.js. */
(()=>{'use strict';
const P=window.KITO_PIMPINAN;
if(!P||typeof URUTAN==='undefined'||typeof kartuCabang!=='function'||typeof D==='undefined')return;
const i=URUTAN.indexOf(kartuCabang);if(i<0)return;
// dibaca saat dipakai: push-config.js dimuat setelah file ini
const API=()=>(window.KITO_PUSH?.api||'').replace(/\/+$/,'');
const BOLEH=['admin','roh','sqor','sqoa','asm'];
const BOLEH_KC=['roh','sqor'];   // nomor Kepala Cabang (harus sama dengan KP_KONTAK_KC_JAB di push-php/lib/kontak.php)
const akun=()=>{try{return window.KITO_AKUN?.kini()||null;}catch(e){return null;}};
const SVG=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IK_TEL=SVG('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>');
const IK_WA=SVG('<path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4.1-1.1L3.5 20.5z"/><path d="M9 8.5c0 3.3 2.6 6.4 6 6.5l1-1.6-2-1-1 .9c-1-.4-2.2-1.6-2.6-2.6l.9-1-1-2L9 8.5z"/>');
const IK_EDIT=SVG('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>');

/* nomor HP dari server, per akun login */
let K={kunci:null,data:null,kc:null,kcInfo:'',err:'',muat:false};
async function muatKontak(){
  const a=akun();
  if(!a||!BOLEH.includes(a.jab)||!API()){if(K.kunci!==null){K={kunci:null,data:null,err:'',muat:false};}return;}
  if(K.kunci===a.kunci)return;
  K={kunci:a.kunci,data:null,err:'',muat:true};
  const kunci=a.kunci;let data=null,kc=null,kcInfo='',err='';
  try{
    const r=await fetch(API()+'/api/kontak/bom',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a.kred),cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(r.status===401?'Sesi login tidak berlaku lagi. Silakan logout lalu login ulang.':(j.error||'server tidak merespons ('+r.status+')'));
    data=j.kontak||{};kc=BOLEH_KC.includes(a.jab)&&j.kc?j.kc:null;
    if(BOLEH_KC.includes(a.jab)&&!kc)kcInfo=!('kc' in j)?'Server belum diperbarui: unggah berkas push-php/lib/kontak.php terbaru ke hosting.'
      :j.kcStatus==='kosong'?'Berkas push-php/data/kontak-kc.php di server kosong. Unggah ulang berkas terbaru.'
      :'Berkas push-php/data/kontak-kc.php belum ada di server. Unggah ke folder push-php/data/ di hosting.';
  }catch(e){err=e instanceof TypeError?'Nomor HP belum bisa dimuat: server tidak bisa dihubungi. Akan dicoba lagi otomatis.':(e.message||'server tidak bisa dihubungi');}
  if(K.kunci!==kunci)return;
  K={kunci,data,kc,kcInfo,err,muat:false};
  if(typeof tampil==='undefined'||tampil==='cabang')render();
}
window.addEventListener('kito-akun',()=>{K={kunci:null,data:null,kc:null,kcInfo:'',err:'',muat:false};muatKontak();if(typeof tampil==='undefined'||tampil==='cabang')render();});
/* Setelah refresh, sesi login dipulihkan dari sessionStorage TANPA event 'kito-akun', dan push-config.js (alamat API)
   baru dimuat di akhir halaman: render pertama belum punya API sehingga nomor HP tidak tampil. Muat ulang setelah
   halaman siap, dan saat kembali online / tab aktif lagi bila sebelumnya gagal. */
function pulihkan(){
  const a=akun();
  if(!a||!BOLEH.includes(a.jab)||!API())return;
  if(K.kunci===a.kunci&&!K.err)return;
  if(K.err)K.kunci=null;
  muatKontak();
  if(typeof tampil==='undefined'||tampil==='cabang')render();
}
if(document.readyState==='complete')setTimeout(pulihkan,0);else window.addEventListener('load',pulihkan);
window.addEventListener('online',pulihkan);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pulihkan();});

/* Aplikasi Android KITO (WebView): APK 1.0 tidak bisa membuka tel: / whatsapp:// (wa.me dialihkan ke whatsapp://)
   sehingga muncul "net::ERR_UNKNOWN_URL_SCHEME". Di dalam APK:
   - APK baru (jembatan KitoAndroid.openExternal): dibuka langsung ke aplikasi Telepon / WhatsApp;
   - APK 1.0: tampil lembar kecil berisi nomor + tombol Salin, lalu pengguna menempelkannya di WhatsApp/Telepon.
   Browser biasa (Chrome, Safari, PWA) tidak terpengaruh. */
const DI_WEBVIEW=(()=>{const ua=navigator.userAgent||'';return /Android/.test(ua)&&/; wv\)|KITO-Android/.test(ua);})();
function jembatanBuka(){try{const b=window.KitoAndroid;return b&&typeof b.openExternal==='function'?b:null;}catch(e){return null;}}
async function salinTeks(t){
  try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(t);return true;}}catch(e){}
  try{const ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,t.length);const ok=document.execCommand('copy');ta.remove();return ok;}catch(e){return false;}
}
function lembarNomor(jenis,hp,wa,nama){
  document.querySelector('.pm-lembar')?.remove();
  const el=document.createElement('div');el.className='pm-lembar';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  const app=jenis==='wa'?'WhatsApp':'Telepon';
  el.innerHTML=`<div class="pm-lembar-k">
    <b class="pm-lembar-j">${jenis==='wa'?IK_WA:IK_TEL}<span>${app} ${esc(nama||'')}</span></b>
    <div class="pm-lembar-no">${esc(hp)}</div>
    <p>Aplikasi KITO versi ini belum bisa membuka ${app} langsung. Salin nomornya, lalu tempel di ${app}.</p>
    <div class="pm-lembar-ak">
      <button type="button" class="pm-btn pm-wa" data-pml="salin">Salin nomor</button>
      <button type="button" class="pm-btn" data-pml="tutup">Tutup</button>
    </div>
    <small class="pm-lembar-st" aria-live="polite"></small>
  </div>`;
  el.addEventListener('click',async e=>{
    const b=e.target.closest('[data-pml]');
    if(e.target===el||b?.dataset.pml==='tutup'){el.remove();return;}
    if(b?.dataset.pml==='salin'){
      const ok=await salinTeks(jenis==='wa'?'+'+wa:hp.replace(/-/g,''));
      el.querySelector('.pm-lembar-st').textContent=ok?`Nomor disalin. Buka ${app} lalu tempel.`:'Tidak bisa menyalin otomatis: tekan lama nomor di atas untuk menyalin.';
      b.textContent=ok?'Tersalin ✓':'Salin nomor';
    }
  });
  document.body.appendChild(el);
  el.querySelector('[data-pml="salin"]').focus();
}
document.addEventListener('click',e=>{
  const a=e.target.closest('a.pm-btn[data-pm-jenis]');
  if(!a||!DI_WEBVIEW)return;
  e.preventDefault();
  const j=a.dataset.pmJenis,wa=a.dataset.pmWa,br=jembatanBuka();
  if(br){try{br.openExternal(j==='wa'?'https://wa.me/'+wa:'tel:+'+wa);return;}catch(x){}}
  lembarNomor(j,a.dataset.pmHp,wa,(a.getAttribute('aria-label')||'').replace(/^(Telepon|WhatsApp)\s*/,''));
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.pm-lembar')?.remove();});

/* ----- edit nomor HP (Kepala Cabang: ROH & SQO Region; BOM/BOS: semua akun yang melihat nomor, sesuai cakupan).
   Disimpan di server (POST /api/kontak/ubah, tabel kontak_ubah) dan langsung berlaku untuk semua pengguna. ----- */
const JENIS_NM={bom:'BOM/BOS',kc:'Kepala Cabang'};
const kunciAreaPm=s=>String(s||'').toUpperCase().replace(/^\s*AREA\s+/,'').replace(/[^A-Z0-9]/g,'');
function dalamArea(kode){
  const a=akun();if(!a||(a.jab!=='asm'&&a.jab!=='sqoa'))return true;
  const b=D.B.find(x=>String(x[0])===String(kode));
  return !!b&&kunciAreaPm(b[2])===a.sub;
}
function tombolUbah(jenis,kode,hp,nama,mode){
  const tambah=mode==='tambah';
  return `<button type="button" class="pm-btn pm-edit${tambah?' pm-tambah':''}" data-pm-ubah="${jenis}" data-pm-kode="${esc(kode)}" data-pm-hpv="${esc(hp||'')}" data-pm-nama="${esc(nama||'')}" aria-label="${tambah?'Tambah':'Edit'} nomor HP ${JENIS_NM[jenis]}">${IK_EDIT}<span>${tambah?'Tambah nomor':'Edit'}</span></button>`;
}
function dialogUbah(jenis,kode,hp,nama){
  document.querySelector('.pm-ubah')?.remove();
  const b=D.B.find(x=>String(x[0])===String(kode));
  const el=document.createElement('div');el.className='pm-lembar pm-ubah';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','pm-ubah-j');
  el.innerHTML=`<form class="pm-lembar-k" novalidate>
    <b class="pm-lembar-j" id="pm-ubah-j">${IK_EDIT}<span>${hp?'Edit':'Tambah'} nomor HP ${JENIS_NM[jenis]}</span></b>
    <p class="pm-ubah-cab">${esc(kode)} ${esc(b?b[1]:'')}</p>
    <label>Nama ${JENIS_NM[jenis]} <small>(opsional)</small><input name="nama" maxlength="80" autocomplete="off" value="${esc(nama||'')}"></label>
    <label>Nomor HP / WhatsApp<input name="hp" inputmode="tel" maxlength="20" autocomplete="off" placeholder="0812-3456-7890" value="${esc(hp||'')}"></label>
    <small class="pm-ubah-tip">Kosongkan nomor untuk menghapus. Perubahan langsung berlaku untuk semua pengguna yang dapat melihat nomor ini.</small>
    <small class="pm-lembar-st pm-ubah-err" role="alert"></small>
    <div class="pm-lembar-ak">
      <button type="submit" class="pm-btn pm-wa">Simpan</button>
      <button type="button" class="pm-btn" data-pml="tutup">Batal</button>
    </div>
  </form>`;
  const f=el.querySelector('form'),err=el.querySelector('.pm-ubah-err'),btn=f.querySelector('[type=submit]');
  el.addEventListener('click',e=>{if(e.target===el||e.target.closest('[data-pml="tutup"]'))el.remove();});
  f.addEventListener('submit',async e=>{
    e.preventDefault();err.textContent='';
    const nilaiHp=f.hp.value.trim(),d=nilaiHp.replace(/\D/g,'').replace(/^62/,'0').replace(/^8/,'08');
    if(nilaiHp&&!/^08\d{7,11}$/.test(d)){err.textContent='Nomor HP tidak valid. Contoh: 0812-3456-7890';f.hp.focus();return;}
    if(!nilaiHp&&!confirm(`Hapus nomor HP ${JENIS_NM[jenis]} cabang ${kode}?`))return;
    const a=akun();if(!a){err.textContent='Sesi login berakhir. Silakan login ulang.';return;}
    btn.disabled=true;btn.textContent='Menyimpan…';
    try{
      const r=await fetch(API()+'/api/kontak/ubah',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
        body:JSON.stringify({...a.kred,jenis,kode:String(kode),hp:nilaiHp,nama:f.nama.value.trim()})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(r.status===401?'Sesi login tidak berlaku lagi. Silakan logout lalu login ulang.':(j.error||'Gagal menyimpan ('+r.status+')'));
      const tujuan=jenis==='kc'?(K.kc=K.kc||{}):(K.data=K.data||{});
      if(j.kontak)tujuan[String(kode)]=j.kontak;else delete tujuan[String(kode)];
      el.remove();render();
    }catch(x){err.textContent=x instanceof TypeError?'Server tidak bisa dihubungi. Coba lagi.':x.message;btn.disabled=false;btn.textContent='Simpan';}
  });
  document.body.appendChild(el);
  f.hp.focus();
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-pm-ubah]');if(!t)return;
  e.preventDefault();dialogUbah(t.dataset.pmUbah,t.dataset.pmKode,t.dataset.pmHpv,t.dataset.pmNama);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.pm-ubah')?.remove();});

function blokKontak(kode,namaBom){
  const a=akun();
  if(!a||!BOLEH.includes(a.jab)||!API())return '';
  if(K.kunci!==a.kunci){setTimeout(muatKontak,0);return `<div class="pm-hp pm-hp-info">Memuat nomor HP BOM/BOS…</div>`;}
  if(K.muat)return `<div class="pm-hp pm-hp-info">Memuat nomor HP BOM/BOS…</div>`;
  if(K.err)return `<div class="pm-hp pm-hp-info">${esc(K.err)}</div>`;
  const k=K.data&&K.data[kode];
  if(!k){
    // ASM / SQO Area: data hanya berisi cabang di areanya; cabang lain tidak bisa dilihat maupun diedit
    if(!dalamArea(kode))return `<div class="pm-hp pm-hp-info">Nomor HP hanya ditampilkan untuk cabang di area Anda.</div>`;
    return `<div class="pm-hp pm-hp-info pm-hp-tambah"><span>Nomor HP BOM/BOS cabang ini belum tersedia.</span>${tombolUbah('bom',kode,'',namaBom,'tambah')}</div>`;
  }
  return `<div class="pm-hp">
    <span class="pm-hp-no"><small>No. HP BOM / BOS${k.nama&&String(k.nama).toLowerCase()!==String(namaBom||'').toLowerCase()?' · '+esc(k.nama):''}</small><b>${esc(k.hp)}</b></span>
    <span class="pm-hp-ak">
      <a class="pm-btn" data-pm-jenis="tel" data-pm-hp="${esc(k.hp)}" data-pm-wa="${esc(k.wa)}" href="tel:+${esc(k.wa)}" aria-label="Telepon ${esc(k.nama||'BOM/BOS')}">${IK_TEL}<span>Telepon</span></a>
      <a class="pm-btn pm-wa" data-pm-jenis="wa" data-pm-hp="${esc(k.hp)}" data-pm-wa="${esc(k.wa)}" href="https://wa.me/${esc(k.wa)}" target="_blank" rel="noopener" aria-label="WhatsApp ${esc(k.nama||'BOM/BOS')}">${IK_WA}<span>WhatsApp</span></a>
      ${tombolUbah('bom',kode,k.hp,k.nama||namaBom)}
    </span>
  </div>`;
}

/* nomor Kepala Cabang: khusus akun ROH & SQO Region */
function blokKc(kode,namaBm){
  const a=akun();
  if(!a||!BOLEH_KC.includes(a.jab)||K.kunci!==a.kunci||K.muat||K.err||!K.data)return '';
  const k=K.kc&&K.kc[kode];
  if(!k)return `<div class="pm-hp pm-hp-info pm-hp-tambah pm-hp-kc"><span>Nomor HP Kepala Cabang cabang ini belum tersedia.${!K.kc&&K.kcInfo?' '+esc(K.kcInfo):''}</span>${tombolUbah('kc',kode,'',namaBm,'tambah')}</div>`;
  const nm=k.nama&&String(k.nama).toLowerCase()!==String(namaBm||'').toLowerCase()?' · '+esc(k.nama):'';
  return `<div class="pm-hp pm-hp-kc">
    <span class="pm-hp-no"><small>No. HP Kepala Cabang${nm}</small><b>${esc(k.hp)}</b></span>
    <span class="pm-hp-ak">
      <a class="pm-btn" data-pm-jenis="tel" data-pm-hp="${esc(k.hp)}" data-pm-wa="${esc(k.wa)}" href="tel:+${esc(k.wa)}" aria-label="Telepon Kepala Cabang ${esc(k.nama||'')}">${IK_TEL}<span>Telepon</span></a>
      <a class="pm-btn pm-wa" data-pm-jenis="wa" data-pm-hp="${esc(k.hp)}" data-pm-wa="${esc(k.wa)}" href="https://wa.me/${esc(k.wa)}" target="_blank" rel="noopener" aria-label="WhatsApp Kepala Cabang ${esc(k.nama||'')}">${IK_WA}<span>WhatsApp</span></a>
      ${tombolUbah('kc',kode,k.hp,k.nama||namaBm)}
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
