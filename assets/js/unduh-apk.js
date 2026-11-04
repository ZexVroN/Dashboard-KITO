/* Notifikasi "Unduh Aplikasi KITO untuk Android" di atas halaman Cabang.
   - Hanya untuk HP/tablet Android yang membuka website lewat browser (bukan dari dalam aplikasi KITO).
     iPhone/iPad/PC tidak melihat apa pun dan tetap memakai website.
   - Ketuk "Unduh" = unduh APK; geser kiri/kanan atau × = sembunyikan sampai ada versi APK baru (KITO_APK.kode).
   Info APK: assets/js/apk-config.js. Add-on non-destruktif: menyisipkan kartu ke URUTAN. */
(()=>{'use strict';
const A=window.KITO_APK;
if(!A||typeof URUTAN==='undefined'||typeof render!=='function')return;
const ua=navigator.userAgent||'';
const android=/Android/i.test(ua), diAplikasi=/; wv\)|KITO-Android/i.test(ua);
if(!android||diAplikasi)return;
const app=document.getElementById('app');if(!app)return;
const KUNCI='kito-apk-tutup';
const ditutup=()=>{try{return localStorage.getItem(KUNCI)===String(A.kode);}catch(e){return false;}};
const tutup=()=>{try{localStorage.setItem(KUNCI,String(A.kode));}catch(e){}};
const nama=A.file.split('/').pop();

function kartuApk(){
  if(ditutup())return '';
  return `<div class="apk-notif" id="apk-notif">
    <img src="assets/images/ios/icon-192.png" alt="" width="44" height="44" />
    <span class="apk-tx"><small>Aplikasi Android</small><b>KITO versi ${esc(A.versi)} tersedia</b><em>${esc(A.ukuran||'')} · pasang langsung di HP Android</em></span>
    <a class="apk-btn" href="${esc(A.file)}" download="${esc(nama)}" data-apk-unduh>Unduh</a>
    <button type="button" class="apk-x" data-apk-tutup aria-label="Sembunyikan">×</button>
  </div>`;
}
URUTAN.splice(0,0,kartuApk);

function buang(el,arah){
  if(!el||el.dataset.dibuang)return;el.dataset.dibuang='1';tutup();
  el.style.transition='transform .22s ease, opacity .22s ease';el.style.transform=`translateX(${arah*110}%)`;el.style.opacity='0';
  setTimeout(()=>{el.style.height=el.offsetHeight+'px';el.offsetHeight;el.style.transition='height .2s ease, margin .2s ease, padding .2s ease';
    el.style.height='0';el.style.margin='0';el.style.padding='0';el.style.borderWidth='0';setTimeout(()=>el.remove(),220);},220);
}
let g=null;
app.addEventListener('pointerdown',e=>{const el=e.target.closest('#apk-notif');if(!el||e.target.closest('[data-apk-tutup],[data-apk-unduh]'))return;g={el,x0:e.clientX,y0:e.clientY,dx:0,k:null,id:e.pointerId};});
app.addEventListener('pointermove',e=>{
  if(!g||e.pointerId!==g.id)return;const dx=e.clientX-g.x0,dy=e.clientY-g.y0;
  if(g.k===null&&(Math.abs(dx)>8||Math.abs(dy)>8))g.k=Math.abs(dx)>Math.abs(dy)?'x':'y';
  if(g.k!=='x')return;g.dx=dx;try{g.el.setPointerCapture(e.pointerId);}catch(_){}
  g.el.style.transition='none';g.el.style.transform=`translateX(${dx}px)`;g.el.style.opacity=String(Math.max(.25,1-Math.abs(dx)/260));
});
const lepas=e=>{if(!g||e.pointerId!==g.id)return;const {el,dx,k}=g;g=null;
  if(k==='x'&&Math.abs(dx)>90)return buang(el,Math.sign(dx));
  el.style.transition='transform .2s ease, opacity .2s ease';el.style.transform='';el.style.opacity='';};
app.addEventListener('pointerup',lepas);app.addEventListener('pointercancel',lepas);
app.addEventListener('click',e=>{const x=e.target.closest('[data-apk-tutup]');if(x){e.stopPropagation();buang(x.closest('#apk-notif'),1);}});
if(typeof tampil!=='undefined'&&tampil==='cabang')render();
})();
