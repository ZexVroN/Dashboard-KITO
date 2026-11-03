/* Kartu "Informasi Sales Akuisisi Cabang" (halaman Informasi Sales): profil pegawai inbranch + ringkasan sales.
   Sumber: KITO_SALES_PEGAWAI (sales-pegawai-data.js) dan KITO_SP_RINGKAS (pegawai.js). */
(()=>{'use strict';
 if(typeof URUTAN==='undefined'||typeof D==='undefined')return;
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
 function kartuInfografisCabang(){
   const b=D.B[st.b];if(!b)return '';
   const kode=String(b[0]??'').replace(/\D/g,'');
   return `<div class="cd info-cabang"><h2>Informasi Sales Akuisisi Cabang</h2>
     <p class="info-caption">Data MTD cabang: <b>${esc(b[1])}</b> · ${esc(b[2])}</p>
     ${profilPegawai(kode)}
     ${typeof window.KITO_SP_RINGKAS==='function'?window.KITO_SP_RINGKAS():''}
   </div>`;
 }
 // dipindahkan dari halaman Cabang ke halaman Informasi Sales (dirender oleh sales.js)
 (window.KITO_SALES_CARDS=window.KITO_SALES_CARDS||[]).push(kartuInfografisCabang);render();
})();
