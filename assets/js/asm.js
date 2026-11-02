/* Halaman Area: nama Area Service Manager (ASM) di kartu judul setiap tampilan Area
   (Waktu Tunggu, Utilisasi NBDS, O2O, Kelompok, ...). Saat "Semua Area Region II": daftar ASM tiap area.
   Data: assets/js/asm-data.js (tools/build_asm.py). Add-on non-destruktif: membungkus render(). */
(()=>{'use strict';
const A=window.KITO_ASM;
if(!A||typeof render!=='function'||typeof st==='undefined')return;
const app=document.getElementById('app');if(!app)return;
const kunci=s=>String(s||'').toUpperCase().replace(/^\s*AREA\s+/,'').replace(/[^A-Z0-9]/g,'');
const judulArea=s=>String(s||'').replace(/^AREA\s+/i,'').toLowerCase().replace(/(^|\s)([a-z])/g,(m,a,b)=>a+b.toUpperCase());
const HERO='.wt-hero,.o2o-hero,.ak-heading,.cd.hero';

function blok(){
  const r=A.data[kunci(st.a)];
  if(r)return `<div class="asm-box"><span class="asm-ik" aria-hidden="true">👤</span><span><small>Area Service Manager (ASM)</small><b>${esc(r.nama)}</b></span></div>`;
  // Seluruh Region II: semua ASM
  const semua=Object.values(A.data);
  if(!semua.length)return '';
  return `<div class="asm-list"><small>Area Service Manager (ASM)</small><div>${semua.map(x=>`<span><em>${esc(judulArea(x.area))}</em>${esc(x.nama)}</span>`).join('')}</div></div>`;
}
function pasang(){
  if(tampil!=='area')return;
  const h=app.querySelector(HERO);
  if(!h||h.querySelector('.asm-box,.asm-list'))return;
  const html=blok();if(!html)return;
  const judul=h.querySelector('h2,h3');
  if(judul)judul.insertAdjacentHTML('afterend',html);else h.insertAdjacentHTML('beforeend',html);
}
const sebelumnya=render;
render=function(){sebelumnya();pasang();};
// tampilan Area juga digambar ulang tanpa render() (ganti sub-tampilan, periode, dll.)
new MutationObserver(()=>pasang()).observe(app,{childList:true});
pasang();
})();
