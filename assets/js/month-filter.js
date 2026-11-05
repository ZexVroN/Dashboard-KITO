/* Periode bulan: pilihan bulan di filter atas. Data tiap bulan dipisah (periode-bulan.js);
   mengganti bulan memperbarui dashboard tanpa memuat ulang halaman. Pilihan tanggal hanya berisi tanggal bulan itu. */
(()=>{
 const B=window.KITO_BULAN,month=document.getElementById('sm');
 if(!B||!month)return;
 const fmt=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});
 month.innerHTML=B.semua.slice().reverse().map(m=>`<option value="${m}" ${m===B.aktif?'selected':''}>${fmt.format(new Date(m+'-01T00:00:00Z'))}</option>`).join('');
 month.value=B.aktif;
 month.addEventListener('change',()=>B.ganti(month.value));
})();
