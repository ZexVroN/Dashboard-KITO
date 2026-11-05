/* Periode bulan: pilihan bulan di filter atas. Data tiap bulan dipisah (periode-bulan.js);
   mengganti bulan memuat ulang dashboard dengan ?bulan=YYYY-MM. Pilihan tanggal hanya berisi tanggal bulan itu. */
(()=>{
 const B=window.KITO_BULAN,month=document.getElementById('sm');
 if(!B||!month)return;
 const fmt=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});
 month.innerHTML=B.semua.slice().reverse().map(m=>`<option value="${m}" ${m===B.aktif?'selected':''}>${fmt.format(new Date(m+'-01T00:00:00Z'))}</option>`).join('');
 month.value=B.aktif;
 month.addEventListener('change',()=>B.ganti(month.value));
 /* pulihkan tab/area/cabang sebelum bulan diganti */
 let k=null;try{k=JSON.parse(sessionStorage.getItem('kito-bulan-kembali')||'null');sessionStorage.removeItem('kito-bulan-kembali');}catch(e){}
 if(k&&typeof st!=='undefined'){
  if(k.b!=null&&D.B[k.b]){st.b=k.b;}
  if(k.a)st.a=k.a;
  try{if(typeof fill==='function')fill();}catch(e){}
  if(k.tab&&k.tab!=='cabang'&&typeof bukaTab==='function')bukaTab(k.tab);else if(typeof render==='function')render();
 }
})();
