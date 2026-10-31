/* Add-on pegawai (tab Cabang): kartu "Informasi Sales Pegawai & Akuisisi".
   Data: assets/js/sales-pegawai-data.js (tools/build_sales_pegawai.py, sheet "Monitoring Ind Pegawai"):
     PROFILE PEGAWAI INBRANCH · EKSTENSIFIKASI (New CIF) · INTENSIFIKASI (New Acc ETB).
   Aturan sama dengan Excel:
     Ekstensifikasi : % = Akuisisi ÷ Target;          Status dari Akuisisi vs Target
     Intensifikasi  : % = Balance ÷ Target Balance;   Status dari Balance vs Target Balance
     Status         : 0 / kosong = IGD · di bawah target = RAWAT JALAN · ≥ target = BUGAR
     Gap            = nilai − target (negatif = masih kurang), memakai update terakhir.
   Tidak mengubah script.js; KITO_PEGAWAI_DATA lama tetap dipakai kartu infografis. */
(()=>{'use strict';
const S=window.KITO_SALES_PEGAWAI;
if(!S||typeof URUTAN==='undefined'||typeof D==='undefined')return;
const app=document.getElementById('app');

/* ----- data per cabang ----- */
const byKode=new Map();
for(const r of S.rows){
  const p={nama:r[0],nip:r[1],jab:r[2],area:r[3],kode:r[4],
    e:{a:r[5],t:r[6],bal:r[7],tbal:r[8]},i:{a:r[9],t:r[10],bal:r[11],tbal:r[12]}};
  if(!byKode.has(p.kode))byKode.set(p.kode,[]);byKode.get(p.kode).push(p);
}
const kodeCabang=()=>String(D.B[st.b]?.[0]??'').replace(/\D/g,'');

/* ----- format & aturan ----- */
const nf=(v,d=0)=>v==null||!Number.isFinite(+v)?'–':(+v).toLocaleString('id-ID',{maximumFractionDigits:d});
const nb=v=>nf(v,2);                                   // balance
const pc=v=>v==null||!Number.isFinite(v)?'–':Math.round(v*100).toLocaleString('id-ID')+'%';
const tg=(iso,opt={day:'numeric',month:'short'})=>new Date(iso+'T00:00').toLocaleDateString('id-ID',opt);
const last=a=>a?.[a.length-1]??null;
const ST={BUGAR:['Bugar','bugar'],'RAWAT JALAN':['Rawat Jalan','rawat'],IGD:['IGD','igd']};
const URUT_ST=['BUGAR','RAWAT JALAN','IGD'];
const status=(v,t)=>v==null||t==null?null:(v===0?'IGD':v<t?'RAWAT JALAN':'BUGAR');
const KAT={
  e:{judul:'Ekstensifikasi',sub:'Akuisisi New CIF',
     nilai:p=>({a:last(p.e.a),t:p.e.t,bal:p.e.bal,tbal:p.e.tbal,seri:p.e.a}),
     pct:x=>x.t>0&&x.a!=null?x.a/x.t:null, st:x=>status(x.a,x.t),
     dasar:'Akuisisi ÷ Target'},
  i:{judul:'Intensifikasi',sub:'Akuisisi New Acc ETB',
     nilai:p=>({a:last(p.i.a),t:p.i.t,bal:p.i.bal,tbal:p.i.tbal,seri:p.i.a}),
     pct:x=>x.tbal>0&&x.bal!=null?x.bal/x.tbal:null, st:x=>status(x.bal,x.tbal),
     dasar:'Balance ÷ Target Balance'},
};
const gapCls=g=>g==null?'':g<0?'neg':g>0?'pos':'';
const gapTxt=g=>g==null?'–':(g>0?'+':'')+nf(g,2);
const chipSt=s=>s?`<span class="sp-st ${ST[s][1]}">${ST[s][0]}</span>`:'<span class="sp-st kosong">–</span>';

/* ----- state ----- */
const ui={tab:'e',st:'all'};
let kodeSebelum=null;

/* ringkasan satu kategori untuk daftar pegawai */
function ringkas(list,k){
  const K=KAT[k],xs=list.map(K.nilai);
  const sum=f=>xs.reduce((s,x)=>s+(x[f]||0),0);
  const a=sum('a'),t=sum('t'),bal=sum('bal'),tbal=sum('tbal');
  const seri=S.update.map((_,j)=>xs.reduce((s,x)=>s+(x.seri?.[j]||0),0));
  const n={BUGAR:0,'RAWAT JALAN':0,IGD:0,lain:0};
  xs.forEach(x=>{const s=K.st(x);n[s||'lain']++;});
  const ag={a,t,bal,tbal};
  return {a,t,bal,tbal,seri,n,pct:K.pct(ag),gap:a-t,gapBal:bal-tbal};
}

function blok(k,R,aktif){
  const K=KAT[k],total=R.n.BUGAR+R.n['RAWAT JALAN']+R.n.IGD+R.n.lain;
  const lebar=Math.min(1,R.pct??0)*100;
  const dt=R.seri.length>1?R.seri[R.seri.length-1]-R.seri[R.seri.length-2]:null;
  const tren=S.update.map((d,j)=>`<span><small>${tg(d)}</small><b>${nf(R.seri[j])}</b></span>`).join('<i>→</i>');
  const bar=URUT_ST.map(s=>R.n[s]?`<i class="${ST[s][1]}" style="flex:${R.n[s]}" title="${ST[s][0]}: ${R.n[s]}"></i>`:'').join('');
  const leg=URUT_ST.map(s=>`<button type="button" data-sp-f="${k}|${s}"><i class="${ST[s][1]}"></i>${ST[s][0]} <b>${R.n[s]}</b></button>`).join('');
  return `<section class="sp-blok ${aktif?'on':''}" data-sp-k="${k}">
    <div class="sp-bh"><b>${K.judul}</b><small>${K.sub}</small></div>
    <div class="sp-angka"><strong>${nf(R.a)}</strong><span>dari target <b>${nf(R.t)}</b></span><em class="${gapCls(R.gap)}">Gap ${gapTxt(R.gap)}</em></div>
    <div class="sp-tren">${tren}${dt!=null?`<small class="${dt>0?'pos':dt<0?'neg':''}">${dt>0?'▲ +':dt<0?'▼ ':''}${dt===0?'tetap':nf(dt)} sejak ${tg(S.update[S.update.length-2])}</small>`:''}</div>
    <div class="sp-bal"><span>Balance <b>${nb(R.bal)}</b> / target <b>${nb(R.tbal)}</b></span><em class="${gapCls(R.gapBal)}">Gap ${gapTxt(R.gapBal)}</em></div>
    <div class="sp-pct"><div class="sp-meter"><i style="width:${lebar}%"></i></div><b>${pc(R.pct)}</b><small>${K.dasar}</small></div>
    <div class="sp-sts"><div class="sp-stbar">${bar}</div><div class="sp-leg">${leg}</div><small>Status ${total} pegawai${R.n.lain?` · ${R.n.lain} tanpa data`:''}</small></div>
  </section>`;
}

function profil(list){
  const per=new Map();list.forEach(p=>per.set(p.jab||'–',(per.get(p.jab||'–')||0)+1));
  const chips=[...per].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([j,n])=>`<span class="sp-jab">${esc(j)} <b>${n}</b></span>`).join('');
  return `<div class="sp-profil"><div class="sp-h"><b>Profil Pegawai Inbranch</b><small>${list.length} pegawai</small></div><div class="sp-jabs">${chips}</div></div>`;
}

function tabel(list){
  if(ui.tab==='p'){
    const rows=list.map((p,j)=>{const xe=KAT.e.nilai(p),xi=KAT.i.nilai(p);
      return `<tr><td class="ob-no">${j+1}</td><td><b>${esc(p.nama)}</b><small class="pg-job">${esc(p.nip||'–')}</small></td><td>${esc(p.jab||'–')}</td><td class="ang">${chipSt(KAT.e.st(xe))}</td><td class="ang">${chipSt(KAT.i.st(xi))}</td></tr>`;}).join('');
    return `<div class="tw"><table class="pg-table sp-tbl"><thead><tr><th class="ob-no">No</th><th>Nama / NIP</th><th>Jabatan</th><th class="ang">Eksten</th><th class="ang">Inten</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  const K=KAT[ui.tab];
  let xs=list.map(p=>{const x=K.nilai(p);return {p,x,s:K.st(x),pct:K.pct(x)};});
  if(ui.st!=='all')xs=xs.filter(r=>r.s===ui.st);
  xs.sort((a,b)=>(b.pct??-1)-(a.pct??-1)||(b.x.a??0)-(a.x.a??0)||a.p.nama.localeCompare(b.p.nama));
  const rows=xs.map(({p,x,s,pct})=>{
    const d=x.seri&&x.seri.length>1&&x.seri[x.seri.length-1]!=null&&x.seri[x.seri.length-2]!=null?x.seri[x.seri.length-1]-x.seri[x.seri.length-2]:null;
    const g=x.a!=null&&x.t!=null?x.a-x.t:null,gb=x.bal!=null&&x.tbal!=null?x.bal-x.tbal:null;
    return `<tr><td><b>${esc(p.nama)}</b><small class="pg-job">${esc(p.jab||'–')} · ${esc(p.nip||'–')}</small></td>
      <td class="ang"><b>${nf(x.a)}</b>${d?`<small class="sp-d ${d>0?'pos':'neg'}">${d>0?'+':''}${nf(d)}</small>`:''}</td>
      <td class="ang">${nf(x.t)}</td><td class="ang pg-gap ${gapCls(g)}">${gapTxt(g)}</td>
      <td class="ang">${nb(x.bal)}<small class="sp-sub">/ ${nb(x.tbal)}</small><small class="sp-sub pg-gap ${gapCls(gb)}">${gapTxt(gb)}</small></td>
      <td class="ang"><b>${pc(pct)}</b></td><td class="ang">${chipSt(s)}</td></tr>`;}).join('');
  const kosong=`<tr><td colspan="7" class="sp-kosong">Tidak ada pegawai dengan status ini.</td></tr>`;
  return `<div class="tw"><table class="pg-table sp-tbl"><thead><tr><th>Pegawai</th><th class="ang">Akuisisi<small>${tg(S.tanggal)}</small></th><th class="ang">Target</th><th class="ang">Gap</th><th class="ang">Balance<small>/ target · gap</small></th><th class="ang">%<small>${ui.tab==='e'?'akuisisi':'balance'}</small></th><th class="ang">Status</th></tr></thead><tbody>${rows||kosong}</tbody></table></div>`;
}

function isiKartu(){
  const b=D.B[st.b];if(!b)return '';
  const kode=kodeCabang();
  if(kode!==kodeSebelum){kodeSebelum=kode;ui.st='all';}
  const list=(byKode.get(kode)||[]).slice();
  const judul=`<h2>Informasi Sales Pegawai & Akuisisi · ${tg(S.tanggal,{day:'numeric',month:'long',year:'numeric'})}</h2>`;
  if(!list.length)return `${judul}<p class="pg-desc">Tidak ada data pegawai inbranch untuk kode cabang ${esc(kode)}.</p>`;
  const Re=ringkas(list,'e'),Ri=ringkas(list,'i');
  const tabs=[['e','Ekstensifikasi'],['i','Intensifikasi'],['p','Profil Pegawai']].map(([v,t])=>`<button type="button" class="pg-tab ${ui.tab===v?'on':''}" data-sp-tab="${v}">${t}</button>`).join('');
  const R=ui.tab==='i'?Ri:Re;
  const filter=ui.tab==='p'?'':`<div class="sp-filter" role="group" aria-label="Saring status">${[['all','Semua',list.length]].concat(URUT_ST.map(s=>[s,ST[s][0],R.n[s]])).map(([v,t,n])=>`<button type="button" class="${ui.st===v?'on':''} ${v==='all'?'':ST[v][1]}" data-sp-st="${v}">${t} <b>${n}</b></button>`).join('')}</div>`;
  return `${judul}
    <p class="pg-desc"><b>${esc(b[1])}</b> · Kode ${esc(kode)} · update ${S.update.map(d=>tg(d)).join(', ')}</p>
    ${profil(list)}
    <div class="sp-grid">${blok('e',Re,ui.tab==='e')}${blok('i',Ri,ui.tab==='i')}</div>
    <div class="pg-tabs" role="tablist">${tabs}</div>${filter}
    ${tabel(list)}
    <p class="pg-desc sp-note">Status: <b>Bugar</b> ≥ target · <b>Rawat Jalan</b> di bawah target · <b>IGD</b> belum ada realisasi. Ekstensifikasi dinilai dari jumlah akuisisi, Intensifikasi dari balance. Gap = nilai − target, memakai update ${tg(S.tanggal)}. NIP disamarkan.</p>`;
}
function kartuPegawai(){
  if(!D.B[st.b])return '';
  return `<section class="cd pg-card sp-card" id="pegawai-cabang">${isiKartu()}</section>`;
}
function gambarUlang(){const el=document.getElementById('pegawai-cabang');if(el)el.innerHTML=isiKartu();}

URUTAN.splice(URUTAN.indexOf(kartuDetailAntrian),0,kartuPegawai);
app.addEventListener('click',e=>{
  if(!e.target.closest('#pegawai-cabang'))return;
  const t=e.target.closest('[data-sp-tab]');if(t){ui.tab=t.dataset.spTab;ui.st='all';gambarUlang();return;}
  const s=e.target.closest('[data-sp-st]');if(s){ui.st=s.dataset.spSt;gambarUlang();return;}
  const f=e.target.closest('[data-sp-f]');if(f){const [k,v]=f.dataset.spF.split('|');ui.tab=k;ui.st=v;gambarUlang();
    document.querySelector('#pegawai-cabang .pg-tabs')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  const k=e.target.closest('[data-sp-k]');if(k&&ui.tab!==k.dataset.spK){ui.tab=k.dataset.spK;ui.st='all';gambarUlang();}
});
render();
})();
