/* inbranch sales cabang: tambahan indikator target/gap/achievement tanpa mengubah modul lain. */
(()=>{'use strict';
 const source=window.KITO_INFO_DATA;
 if(!source||typeof URUTAN==='undefined'||typeof D==='undefined')return;
 const byCode=new Map(source.rows.map(r=>[String(r.kode).replace(/\D/g,''),r]));
 const byName=new Map(source.rows.map(r=>[String(r.cabang).trim().toLowerCase(),r]));
 const pegawai=window.KITO_PEGAWAI_DATA?.rows||[];
 const byPegawai=new Map();
 for(const r of pegawai){const k=String(r.kode).replace(/\D/g,'');if(!byPegawai.has(k))byPegawai.set(k,[]);byPegawai.get(k).push(r)}
 const fmt=v=>v==null||!Number.isFinite(Number(v))?'–':Math.ceil(Number(v)).toLocaleString('id-ID',{maximumFractionDigits:0});
 const fields=[['cakra','Input CAKRA'],['cif','Akuisisi New CIF'],['pebisnis','Akuisisi Rek Pebisnis'],['payroll','New CIF Payroll']];
 function kartuInfografisCabang(){
   const b=D.B[st.b];if(!b)return '';
   const kode=String(b[0]??'').replace(/\D/g,'');
   const r=byCode.get(kode)||byName.get(String(b[1]).trim().toLowerCase());
   const list=byPegawai.get(kode)||[];
   const target=(key)=>{
     if(key==='cakra')return null;
     if(list.length){const nums=list.map(x=>x.metrics?.[key]?.[1]).filter(x=>x!=null&&Number.isFinite(Number(x)));if(nums.length)return nums.reduce((a,b)=>a+Number(b),0)}
     if(key==='cif'&&r?.target_cif!=null)return Number(r.target_cif);
     return null;
   };
   return `<div class="cd info-cabang"><h2>Informasi Akuisisi Cabang · 16 Oktober 2026</h2>
     <p class="info-caption">Data MTD cabang: <b>${esc(b[1])}</b> · ${esc(b[2])}</p>
     ${r?`<div class="info-kpis">${fields.map(([key,label])=>{
       const a=r[key]==null?null:Number(r[key]);
       const t=target(key);
       const gap=a!=null&&t!=null?a-t:null;
       return `<div class="info-kpi"><small>${label}</small><strong>${fmt(a)}</strong><div class="info-meta"><span>${key==='cakra'?'Jumlah Pegawai':'Target'}</span><b>${fmt(key==='cakra'?r.pegawai:t)}</b></div><div class="info-meta"><span>Gap</span><b class="${gap==null?'':gap<0?'info-neg':'info-pos'}">${fmt(gap)}</b></div></div>`;
     }).join('')}</div>`:'<p class="info-caption">Data akuisisi cabang tidak ditemukan pada laporan.</p>'}
     <p class="info-note">Target New CIF, Rek Pebisnis, dan Payroll diambil dari penjumlahan target pegawai pada cabang terpilih (fallback target New CIF cabang bila data pegawai tidak tersedia). Gap = Akuisisi − Target. Target/Gap CAKRA tidak ditampilkan karena tidak tersedia pada data sumber.</p>
   </div>`;
 }
 URUTAN.push(kartuInfografisCabang);render();
})();
