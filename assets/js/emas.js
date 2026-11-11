/* Program Emas (Tabungan Emas & Cetak Emas di ATM) di Informasi Sales.
   Sumber: data/kito.json [KITO_EMAS] (tools/build_emas.py dari laporan "Monitoring Emas").
     - Halaman Informasi Sales cabang : kartu cabang + pencapaian target per pegawai (KITO_SALES_CARDS)
     - Halaman Informasi Sales Area   : infografis Region II vs 12 region, per area, status pegawai, top pegawai
   Target per orang / bulan: Tab. Emas BOM/BOS/CS 5 · Teller 3 · Cetak Emas 2 (KITO_EMAS.target).
   Status pegawai: Tercapai = Tab. Emas & Cetak Emas ≥ target · Berjalan = sudah ada input · Belum input = 0. */
(()=>{'use strict';
const E=window.KITO_EMAS;
if(!E||typeof D==='undefined'||typeof st==='undefined'||typeof render!=='function')return;

const ALL='Semua Area Region II';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').toLowerCase().replace(/^area\s+/,'').replace(/[^a-z0-9]/g,'');
const nf=v=>v==null||!Number.isFinite(+v)?'–':(+v).toLocaleString('id-ID');
const rasio=(v,t)=>t?v/t:null;
// persen dibulatkan ke atas (selaras pembulatan Informasi Sales); di bawah 1% tetap tampil 1 desimal agar tidak 0%
const pc=p=>{if(p==null||!Number.isFinite(p))return '–';const x=p*100;if(x<=0)return '0%';if(x>0&&x<1)return x.toFixed(1).replace('.',',')+'%';return Math.ceil(x-1e-9).toLocaleString('id-ID')+'%';};
const tgS=iso=>new Date(iso+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'});
const tgL=iso=>new Date(iso+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
const periode=`${tgS(E.awal)} – ${tgL(E.tanggal)}`;
const kodeOf=b=>String(b?.[0]??'').replace(/\D/g,'');
const areaOfKode=new Map(D.B.map(b=>[kodeOf(b),b[2]]));
const CAB=new Map(E.cabang.map(c=>[c.kode,c]));
// pegawai: [nama, nip, jabatan, kode, kel, tab, tabT, tabHariIni, cetak, cetakT, cetakHariIni]
const P=E.pegawai.map(r=>({nama:r[0],nip:r[1],jab:r[2],kode:r[3],kel:r[4],tab:r[5],tabT:r[6],tabH:r[7],cetak:r[8],cetakT:r[9],cetakH:r[10]}));
const statusP=p=>p.tab>=p.tabT&&p.cetak>=p.cetakT?'ok':p.tab||p.cetak?'jalan':'belum';
const ST={ok:['Tercapai','em-ok'],jalan:['Berjalan','em-jl'],belum:['Belum input','em-bl']};
const jabPendek=j=>String(j||'').replace(/Customer Service/i,'CS').replace(/Branch Operation/i,'BO').replace(/General Banker/i,'GB').replace(/Representative/i,'Rep.').replace(/Administrative/i,'Adm.').replace(/Supervisor/i,'Spv').replace(/Manager/i,'Mgr');
const bar=(p,cls='')=>`<span class="em-bar ${cls}"><b style="width:${Math.min(100,Math.max(0,(p||0)*100))}%"></b></span>`;

/* ================= kartu cabang (halaman Informasi Sales) ================= */
const ui={st:'all',lim:12};
function tile(judul,v,t,sub,dari='dari target'){
  const p=rasio(v,t);
  return `<div class="em-tile"><span class="em-tl">${judul}</span><b class="em-big">${nf(v)}<small> / ${nf(t)}</small></b>${bar(p)}<span class="em-ts">${pc(p)} ${dari}${sub?` · ${sub}`:''}</span></div>`;
}
function isiCabang(){
  const b=D.B[st.b];if(!b)return '';
  const kode=kodeOf(b),c=CAB.get(kode);
  if(!c)return `<h2>🪙 Program Emas</h2><p class="pg-desc">Data Program Emas untuk cabang ini tidak ada di laporan ${esc(E.sumber)}.</p>`;
  const list=P.filter(p=>p.kode===kode);
  const lain=(E.lain?.[kode]||[]);
  const n={ok:0,jalan:0,belum:0};list.forEach(p=>n[statusP(p)]++);
  const tampil=list.filter(p=>ui.st==='all'||statusP(p)===ui.st)
    .sort((a,b)=>(b.tab+b.cetak)-(a.tab+a.cetak)||rasio(b.tab,b.tabT)-rasio(a.tab,a.tabT)||a.nama.localeCompare(b.nama));
  // daftar berbentuk baris grid (bukan <table>) agar di HP keempat kolom tetap terlihat
  const baris=tampil.slice(0,ui.lim).map(p=>{const s=statusP(p);return `<div class="em-pr">
      <span class="em-nm">${esc(p.nama)}<small>${esc(jabPendek(p.jab))} · ${esc(p.nip)}</small></span>
      <span class="em-rv"><b>${nf(p.tab)}<i>/${nf(p.tabT)}</i></b>${p.tabH?`<small class="em-plus">+${nf(p.tabH)} hari ini</small>`:''}</span>
      <span class="em-rv"><b>${nf(p.cetak)}<i>/${nf(p.cetakT)}</i></b></span>
      <span class="em-st ${ST[s][1]}">${ST[s][0]}</span></div>`;}).join('');
  const lainRows=ui.st==='all'||ui.st==='jalan'?lain.map(x=>`<div class="em-pr em-lain"><span class="em-nm">${esc(x[0])}<small>${esc(x[1])} · di luar daftar pegawai</small></span><span class="em-rv"><b>${nf(x[2])}</b></span><span class="em-rv"><b>${nf(x[3])}</b></span><span class="em-st em-jl">Input</span></div>`).join(''):'';
  const more=tampil.length>ui.lim?`<button type="button" class="em-more" data-em-more="1">Tampilkan ${Math.min(12,tampil.length-ui.lim)} lagi (${tampil.length-ui.lim} tersisa)</button>`:(ui.lim>12?`<button type="button" class="em-more" data-em-more="0">Ringkas</button>`:'');
  const chip=(v,t,j,cls='')=>`<button type="button" class="${ui.st===v?'on':''} ${cls}" data-em-st="${v}">${t} <b>${j}</b></button>`;
  return `<h2>🪙 Program Emas · Tabungan &amp; Cetak Emas</h2>
    <p class="pg-desc"><b>${esc(b[1])}</b> · MTD ${periode} · target per orang: Tab. Emas ${nf(E.target.tabBom)} (BOM/BOS/CS) · ${nf(E.target.tabTeller)} (Teller) · Cetak Emas ${nf(E.target.cetak)}</p>
    <div class="em-tiles">${tile('Tabungan Emas',c.tab.v,c.tab.t,c.tab.tambah?`+${nf(c.tab.tambah)} hari ini`:'')}${tile('Cetak Emas di ATM',c.cetak.v,c.cetak.t)}${tile('Partisipasi Pegawai',c.pegawai.input,c.pegawai.total,'','pegawai sudah input')}</div>
    <h3 class="em-h3">Pencapaian Target per Pegawai</h3>
    <div class="em-chips" role="group" aria-label="Saring status pegawai">${chip('all','Semua',list.length)}${chip('ok','Tercapai',n.ok,'em-ok')}${chip('jalan','Berjalan',n.jalan,'em-jl')}${chip('belum','Belum input',n.belum,'em-bl')}</div>
    <div class="em-list" role="list"><div class="em-prh"><span>Pegawai</span><span>Tab. Emas</span><span>Cetak</span><span>Status</span></div>${baris||'<p class="em-kosong">Tidak ada pegawai dengan status ini.</p>'}${lainRows}</div>
    ${more}
    <p class="pg-desc em-note">Tercapai = Tab. Emas dan Cetak Emas ≥ target · Berjalan = sudah ada input · Belum input = belum ada transaksi dihitung. Angka cabang mengikuti sheet Detail Cabang (per kode cabang input); angka pegawai dihitung per NIP. Sumber: ${esc(E.sumber)}, posisi ${tgL(E.tanggal)}. NIP disamarkan.</p>`;
}
function kartuCabang(){if(!D.B[st.b])return '';return `<section class="cd em-card" id="emas-cabang">${isiCabang()}</section>`;}
kartuCabang.tab='emas';   // tampil di tombol "Program Emas" halaman Informasi Sales (sales.js)
(window.KITO_SALES_CARDS=window.KITO_SALES_CARDS||[]).push(kartuCabang);

/* ================= infografis Area / Region II (halaman Informasi Sales Area) ================= */
function scope(){
  const a=st.a;const isRegion=!a||a===ALL;
  const kodes=new Set(E.cabang.filter(c=>isRegion||norm(areaOfKode.get(c.kode))===norm(a)).map(c=>c.kode));
  return {isRegion,nama:isRegion?'Region II':'Area '+String(a).replace(/^area\s+/i,''),kodes};
}
function jumlah(cabs){
  const s={cab:0,peg:0,inp:0,tab:0,tabT:0,tabH:0,cetak:0,cetakT:0};
  cabs.forEach(c=>{s.cab++;s.peg+=c.pegawai.total||0;s.inp+=c.pegawai.input||0;s.tab+=c.tab.v||0;s.tabT+=c.tab.t||0;s.tabH+=c.tab.tambah||0;s.cetak+=c.cetak.v||0;s.cetakT+=c.cetak.t||0;});
  return s;
}
function heroArea(sc){
  const R2=E.regions.find(r=>r.kode==='R02');
  const s=jumlah(E.cabang.filter(c=>sc.kodes.has(c.kode)));
  const rk=sc.isRegion&&R2?`<div class="em-rank"><span>Peringkat Region II</span><b>#${nf(R2.rank.tab)}</b><small>dari ${E.regions.length} region (Tab. Emas)</small></div>`:'';
  // kartu judul seperti Informasi Sales Area (nama ASM disisipkan asm.js ke .wt-hero)
  const judul=`<section class="cd wt-hero em-judul"><span class="wt-eyebrow">PROGRAM EMAS · ${sc.isRegion?'REGION II':'AREA'}</span><h3>${esc(sc.isRegion?'Seluruh Area Region II':String(st.a).replace(/^area\s+/i,''))}</h3>
    <p class="wt-sub">${nf(s.peg)} pegawai inbranch · ${nf(s.cab)} cabang · MTD ${periode} (data s.d. ${tgL(E.tanggal)})</p>
    <p class="wt-sub">Tabungan Emas &amp; Cetak Emas di ATM · target per orang/bulan: Tab. Emas ${nf(E.target.tabBom)} (BOM/BOS/CS) · ${nf(E.target.tabTeller)} (Teller) · Cetak Emas ${nf(E.target.cetak)}. Sumber ${esc(E.sumber)}.</p></section>`;
  return judul+`<section class="cd em-hero"><span class="wt-eyebrow">PENCAPAIAN MTD · ${esc(sc.nama.toUpperCase())}</span>
    <h3>Tabungan Emas &amp; Cetak Emas di ATM</h3>
    <div class="em-tiles em-tiles-h">${tile('Tabungan Emas',s.tab,s.tabT,s.tabH?`+${nf(s.tabH)} hari ini`:'')}${tile('Cetak Emas di ATM',s.cetak,s.cetakT)}${tile('Partisipasi Pegawai',s.inp,s.peg,'','pegawai sudah input')}${rk}</div></section>`;
}
function regionRank(){
  const rows=E.regions.map(r=>({...r,p:rasio(r.tab.v,r.tab.t),pp:rasio(r.input,r.pegawai)})).sort((a,b)=>b.p-a.p);
  const mx=Math.max(...rows.map(r=>r.p||0))||1;
  const body=rows.map((r,i)=>`<div class="em-rr ${r.kode==='R02'?'em-me':''}"><span class="em-no">${i+1}</span><span class="em-nm">${esc(r.nama)}</span>
      <span class="em-rb"><b style="width:${(r.p||0)/mx*100}%"></b></span><span class="em-rv"><b>${pc(r.p)}</b><small>${nf(r.tab.v)}/${nf(r.tab.t)}</small></span><span class="em-rv"><b>${pc(r.pp)}</b><small>partisipasi</small></span></div>`).join('');
  return `<section class="cd"><h2>Posisi Region II di 12 Region</h2><p class="wt-note">Urut menurut % Tabungan Emas terhadap target MTD. Kolom kanan = % pegawai yang sudah input.</p>${body}</section>`;
}
function perArea(sc){
  const g=new Map();E.cabang.forEach(c=>{const a=areaOfKode.get(c.kode)||c.area;if(!g.has(a))g.set(a,[]);g.get(a).push(c);});
  const rows=[...g].map(([a,l])=>({a,s:jumlah(l)})).map(x=>({...x,p:rasio(x.s.tab,x.s.tabT),pc2:rasio(x.s.cetak,x.s.cetakT),pp:rasio(x.s.inp,x.s.peg)})).sort((x,y)=>y.p-x.p);
  const body=rows.map((r,i)=>`<button type="button" class="em-ar ${!sc.isRegion&&norm(r.a)===norm(st.a)?'em-me':''}" data-em-area="${esc(r.a)}"><span class="em-no">${i+1}</span><span class="em-nm">${esc(String(r.a).replace(/^area\s+/i,''))}<small>${nf(r.s.cab)} cabang · ${nf(r.s.peg)} pegawai</small></span><span class="em-rv"><b>${pc(r.p)}</b><small>${nf(r.s.tab)}/${nf(r.s.tabT)}</small></span><span class="em-rv"><b>${pc(r.pc2)}</b><small>${nf(r.s.cetak)}/${nf(r.s.cetakT)}</small></span><span class="em-rv"><b>${pc(r.pp)}</b><small>${nf(r.s.inp)}/${nf(r.s.peg)}</small></span></button>`).join('');
  return `<section class="cd"><h2>Program Emas per Area</h2><div class="em-arh"><span>Area</span><span>Tab. Emas</span><span>Cetak</span><span>Partisipasi</span></div>${body}</section>`;
}
function statusPegawai(sc){
  const list=P.filter(p=>sc.kodes.has(p.kode));
  const grup=[['Semua',list],['BOM/BOS/CS',list.filter(p=>p.kel==='B')],['Teller',list.filter(p=>p.kel==='T')]];
  const rows=grup.map(([nm,l])=>{const n={ok:0,jalan:0,belum:0};l.forEach(p=>n[statusP(p)]++);const t=l.length||1;
    return `<div class="em-sp"><span class="em-nm">${nm}<small>${nf(l.length)} pegawai</small></span><span class="em-stack" role="img" aria-label="Tercapai ${n.ok}, berjalan ${n.jalan}, belum input ${n.belum}"><i class="em-ok" style="width:${n.ok/t*100}%"></i><i class="em-jl" style="width:${n.jalan/t*100}%"></i><i class="em-bl" style="width:${n.belum/t*100}%"></i></span><span class="em-spv"><b class="em-okt">${nf(n.ok)}</b> · <b class="em-jlt">${nf(n.jalan)}</b> · <b>${nf(n.belum)}</b></span></div>`;}).join('');
  return `<section class="cd"><h2>Pencapaian Target per Pegawai · ${esc(sc.nama)}</h2><p class="wt-note"><span class="em-key em-ok"></span>Tercapai (Tab. Emas &amp; Cetak ≥ target) <span class="em-key em-jl"></span>Berjalan <span class="em-key em-bl"></span>Belum input</p>${rows}</section>`;
}
function topPegawai(sc){
  const list=P.filter(p=>sc.kodes.has(p.kode)&&(p.tab||p.cetak)).sort((a,b)=>(b.tab+b.cetak)-(a.tab+a.cetak)||rasio(b.tab,b.tabT)-rasio(a.tab,a.tabT)).slice(0,10);
  const nama=new Map(D.B.map(b=>[kodeOf(b),b[1]]));
  const body=list.map((p,i)=>`<div class="em-tp"><span class="em-no">${i+1}</span><span class="em-nm">${esc(p.nama)}<small>${esc(jabPendek(p.jab))} · ${esc(nama.get(p.kode)||p.kode)}</small></span><span class="em-rv"><b>${nf(p.tab)}</b><small>Tab ${pc(rasio(p.tab,p.tabT))}</small></span><span class="em-rv"><b>${nf(p.cetak)}</b><small>Cetak</small></span></div>`).join('');
  return `<section class="cd"><h2>Top Pegawai Program Emas · ${esc(sc.nama)}</h2>${body||'<p class="wt-note">Belum ada pegawai yang input pada periode ini.</p>'}</section>`;
}
function halamanArea(){
  const sc=scope();
  return `${heroArea(sc)}${sc.isRegion?regionRank():''}${perArea(sc)}${statusPegawai(sc)}${topPegawai(sc)}`;
}
const views=window.KITO_AREA_VIEWS;
const vSales=views&&views.find(v=>v.key==='sales');
// tombol halaman Informasi Sales Area: "Akuisisi Cabang & Pegawai" (area-sales.js) | "Program Emas" (halamanArea)
const TAB_AREA=[['akuisisi','📊','Akuisisi Cabang & Pegawai'],['emas','🪙','Program Emas']];
let tabArea='akuisisi';try{if(sessionStorage.getItem('kito-area-sales-tab')==='emas')tabArea='emas';}catch(e){}
const tombolArea=()=>`<div class="sl-tabs as-tabs" role="tablist" aria-label="Halaman Informasi Sales Area">${TAB_AREA.map(t=>
  `<button type="button" role="tab" data-em-tab="${t[0]}" aria-selected="${t[0]===tabArea}" class="${t[0]===tabArea?'on':''}"><span aria-hidden="true">${t[1]}</span>${t[2]}</button>`).join('')}</div>`;
if(vSales){const lama=vSales.html;vSales.html=function(){return tombolArea()+(tabArea==='emas'?halamanArea():lama.apply(this,arguments));};}

/* ================= interaksi ================= */
document.getElementById('app')?.addEventListener('click',e=>{
  const t=e.target.closest('[data-em-tab]');
  if(t){if(t.dataset.emTab!==tabArea){tabArea=t.dataset.emTab;try{sessionStorage.setItem('kito-area-sales-tab',tabArea);}catch(x){}render();document.querySelector(`[data-em-tab="${tabArea}"]`)?.focus({preventScroll:true});}return;}
  const s=e.target.closest('#emas-cabang [data-em-st]');
  if(s){ui.st=s.dataset.emSt;ui.lim=12;document.getElementById('emas-cabang').innerHTML=isiCabang();return;}
  const m=e.target.closest('#emas-cabang [data-em-more]');
  if(m){ui.lim=m.dataset.emMore==='1'?ui.lim+12:12;document.getElementById('emas-cabang').innerHTML=isiCabang();return;}
  const a=e.target.closest('[data-em-area]');
  if(a){const hit=D.B.find(b=>norm(b[2])===norm(a.dataset.emArea));if(hit){st.a=hit[2];if(typeof fill==='function')fill();render();}}
});
// cabang berganti -> kembali ke filter semua
let kodeTerakhir=null;
const lamaRender=render;
render=function(){const k=kodeOf(D.B[st.b]);if(k!==kodeTerakhir){ui.st='all';ui.lim=12;kodeTerakhir=k;}return lamaRender.apply(this,arguments);};
})();
