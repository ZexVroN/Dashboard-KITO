/* inbranch sales cabang: tambahan indikator target/gap/achievement tanpa mengubah modul lain. */
(()=>{'use strict';
 const source=window.KITO_INFO_DATA;
 if(!source||typeof URUTAN==='undefined'||typeof D==='undefined')return;
 const byCode=new Map(source.rows.map(r=>[String(r.kode).replace(/\D/g,''),r]));
 const byName=new Map(source.rows.map(r=>[String(r.cabang).trim().toLowerCase(),r]));
 const pegawai=window.KITO_PEGAWAI_DATA?.rows||[];
 const byPegawai=new Map();
 for(const r of pegawai){const k=String(r.kode).replace(/\D/g,'');if(!byPegawai.has(k))byPegawai.set(k,[]);byPegawai.get(k).push(r)}
 // Profil Pegawai Inbranch (dipindahkan dari kartu Pegawai): dari KITO_SALES_PEGAWAI agar jumlahnya sama.
 // Dibaca lazy karena sales-pegawai-data.js dimuat SETELAH script ini (urutan di index.html).
 let spByKode=null;
 function indeksSP(){
   if(spByKode)return spByKode;
   const m=new Map(),SP=window.KITO_SALES_PEGAWAI;
   if(SP)for(const r of SP.rows){const k=String(r[4]).replace(/\D/g,'');if(!m.has(k))m.set(k,[]);m.get(k).push(r)}
   if(SP)spByKode=m;              // simpan hanya bila data sudah tersedia
   return m;
 }
 // kelompok jabatan → warna (dipakai bar komposisi dan tile jabatan)
 const KEL=[['tl','Teller',j=>/^teller/i.test(j)],['cs','Customer Service',j=>/^customer service/i.test(j)],
   ['bo','Branch Operation',j=>/^branch/i.test(j)],['gb','General Banker',j=>/^general banker/i.test(j)],['ln','Lainnya',()=>true]];
 const kelOf=j=>KEL.find(k=>k[2](j));
 function profilPegawai(kode){
   const rows=indeksSP().get(kode)||[];if(!rows.length)return '';
   const per=new Map();rows.forEach(r=>{const j=r[2]||'–';per.set(j,(per.get(j)||0)+1)});
   const tot=rows.length;
   const jabs=[...per].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
   const kel=KEL.map(k=>[k,jabs.filter(([j])=>kelOf(j)===k).reduce((s,x)=>s+x[1],0)]).filter(x=>x[1]);
   const bar=kel.map(([k,n])=>`<i class="pp-${k[0]}" style="flex:${n}" title="${k[1]}: ${n}"></i>`).join('');
   const leg=kel.map(([k,n])=>`<span><i class="pp-${k[0]}"></i>${k[1]} <b>${n}</b></span>`).join('');
   const tiles=jabs.map(([j,n])=>{const k=kelOf(j);return `<div class="pp-tile pp-${k[0]}"><span class="pp-nm">${esc(j)}</span><b>${n}</b></div>`;}).join('');
   return `<div class="sp-profil pp"><div class="pp-head"><span class="pp-tt"><b>Profil Pegawai Inbranch</b><small>${per.size} jabatan · ${kel.length} kelompok</small></span><strong>${tot}<small>pegawai</small></strong></div>
     <div class="pp-bar">${bar}</div><div class="pp-leg">${leg}</div><div class="pp-tiles">${tiles}</div></div>`;
 }
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
   return `<div class="cd info-cabang"><h2>Informasi Sales Akuisisi Cabang</h2>
     <p class="info-caption">Data MTD cabang: <b>${esc(b[1])}</b> · ${esc(b[2])}</p>
     ${profilPegawai(kode)}
     ${typeof window.KITO_SP_RINGKAS==='function'?window.KITO_SP_RINGKAS():''}
   </div>`;
 }
 // dipindahkan dari halaman Cabang ke halaman Informasi Sales (dirender oleh sales.js)
 (window.KITO_SALES_CARDS=window.KITO_SALES_CARDS||[]).push(kartuInfografisCabang);render();
})();
