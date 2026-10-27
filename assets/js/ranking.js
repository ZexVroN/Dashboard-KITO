/* Menu "Ranking" (navigasi bawah): peringkat Cabang dan Area untuk semua indikator
   Waktu Antrian, O2O & Shifting Digital, dan Utilisasi NBDS.
   Add-on non-destruktif: membungkus render() seperti modul lain. Muat setelah semua modul data/area,
   sebelum animasi.js. Pasangannya: assets/css/ranking.css */
(()=>{'use strict';
if(typeof D==='undefined'||typeof st==='undefined'||typeof render!=='function')return;
const app=document.getElementById('app');if(!app)return;

const W=window.KITO_AREA_WAKTU;        // P90 waktu tunggu per area (DtD per tanggal + MTD)
const K=window.KITO_AREA_KELOMPOK||[]; // P90 waktu tunggu per cabang (MTD)
const N=window.KITO_AREA_NBDS;         // utilisasi NBDS per cabang/area (DtD + MTD)

/* ----- utilitas ----- */
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').toLowerCase().replace(/^area\s+/,'').replace(/[^a-z0-9]/g,'');
const num=n=>Number(n||0).toLocaleString('id-ID');
const clock=s=>s==null?'–':String(Math.floor(Math.round(s)/60)).padStart(2,'0')+':'+String(Math.round(s)%60).padStart(2,'0');
// persen dipotong ke 1 desimal (konsisten dengan dashboard NBDS: 97,96% tidak tampil 98,0%)
const pct=p=>{if(p==null)return '–';const v=Math.floor(p*1000+1e-9)/10;return v.toLocaleString('id-ID',{minimumFractionDigits:v%1?1:0,maximumFractionDigits:1})+'%';};
// O2O & Shifting: dibulatkan 1 desimal (sama dengan kartu O2O/Shifting di tab Area & Cabang)
const pctR=p=>p==null?'–':(p*100).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const isoLong=iso=>new Date(iso+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
const isoShort=iso=>new Date(iso+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'});
const AREAS=[...new Set(D.B.map(b=>b[2]))].sort();
const IDX_CAB=new Map(D.B.map((b,i)=>[String(b[0]),i]));
const kelK=new Map(K.map(r=>[String(r.kode),r]));
const nbCab=new Map((N?.cabang||[]).map(c=>[c.kode,c]));
const cabOfArea=a=>D.B.map((b,i)=>i).filter(i=>D.B[i][2]===a);
const iso=()=>D.dates[st.d];

/* ----- penjumlahan O2O/Shifting dari data cabang (D.M) ----- */
// s = [O2O, NBDS O2O, CSM, OBDS, NBDS ganti kartu (D.M[10], fallback D.M[1])]
const mSum=idx=>{const s=[0,0,0,0,0];idx.forEach(i=>{const m=D.M[i];if(!m)return;for(let k=0;k<4;k++)s[k]+=Number(m[k])||0;s[4]+=Number(m[10]??m[1])||0;});return s;};
const o2oP=s=>s[0]+s[1]>0?s[0]/(s[0]+s[1]):null;
const shP=s=>{const t=s[0]+s[4]+s[2]+s[3];return t?(s[0]+s[2])/t:null;};

/* ----- utilisasi NBDS ----- */
const nbU=p=>p&&p[0]+p[1]>0?p[0]/(p[0]+p[1]):null;
const nbIdx=()=>N?N.dates.indexOf(iso()):-1;
const nbPair=(ent,k,per)=>{if(!ent)return null;if(per==='mtd')return ent.m[k];const j=nbIdx();return j<0?null:ent.d[k][j];};
const nbSum=(list)=>{const a=list.filter(Boolean);return a.length?[a.reduce((s,p)=>s+p[0],0),a.reduce((s,p)=>s+p[1],0)]:null;};
const nbArea=a=>N?.areas.find(x=>norm(x.name)===norm(a));
const nbRegion=(k,per)=>N?nbSum(N.areas.map(a=>nbPair(a,k,per))):null;
const TGT=N?.target??0.98;

/* ----- waktu tunggu ----- */
const WIDX={teller:2,cs:5,all:6};
const wArea=a=>W?.areas.find(x=>norm(x.name)===norm(a));
const wVal=(ent,key,per)=>{if(!ent)return null;const arr=per==='mtd'?ent.m:ent.d[iso()];return arr?arr[WIDX[key]]:null;};

/* ----- kelas warna ----- */
const kWaktu=v=>mp(v)[1];                                            // ok/mid/warn/bad (bawaan script.js)
const kNbds=v=>v==null?'n':v>=TGT?'ok':v>=.9?'mid':v>=.8?'warn':'bad';
const kRel=(v,ref)=>v==null||ref==null?'n':v>=ref?'ok':'bad';

/* ----- daftar indikator -----
   cab(i,per) nilai cabang ke-i · area(a,per) nilai area · reg(per) nilai Region II
   per: periode yang tersedia ('dtd','mtd') atau ['tgl'] = satu tanggal laporan saja */
const MET=[];
const waktu=(key,n,s)=>({key:'w-'+key,g:'Waktu Antrian',n,s,tinggi:false,jenis:'waktu',per:['dtd','mtd'],
  cab:(i,per)=>{if(per==='mtd'){const r=kelK.get(String(D.B[i][0]));return r?.mtd?.[key]??null;}return D.Q[i]?.[st.d]?.[{teller:0,cs:1,all:2}[key]]??null;},
  area:(a,per)=>wVal(wArea(a),key,per),
  reg:per=>wVal(W?.region,key,per),
  kelas:v=>kWaktu(v),fmt:clock,
  sumber:per=>per==='mtd'?'P90 MTD Oktober 2026':'P90 DtD'});
MET.push(waktu('teller','Teller','Teller'),waktu('cs','Customer Service','CS'),waktu('all','Semua Transaksi','All Trx'));
MET.push({key:'o2o',g:'O2O & Digital',n:'Overall O2O',s:'O2O',tinggi:true,jenis:'pct',per:['tgl'],
  cab:i=>o2oP(mSum([i])),area:a=>o2oP(mSum(cabOfArea(a))),reg:()=>o2oP(mSum(D.B.map((b,i)=>i))),
  kelas:v=>kRel(v,D.bw),fmt:pctR,ket:`Hijau = di atas rata-rata Bankwide ${pctR(D.bw)}`,sumber:()=>'Livin O2O ÷ (O2O + NBDS)'});
MET.push({key:'shift',g:'O2O & Digital',n:'Shifting Digital',s:'Shifting',tinggi:true,jenis:'pct',per:['tgl'],
  cab:i=>shP(mSum([i])),area:a=>shP(mSum(cabOfArea(a))),reg:()=>shP(mSum(D.B.map((b,i)=>i))),
  kelas:(v,ref)=>kRel(v,ref),fmt:pctR,ket:'Hijau = di atas Region II',sumber:()=>'(O2O + CSM) ÷ total'});
if(N)N.kanal.forEach(kn=>MET.push({key:'nb-'+kn.key,g:'Utilisasi NBDS',n:kn.label,s:{fp:'NBDS T. Prg',fnp:'NBDS T. Bdn',nf:'NBDS CS'}[kn.key]||kn.short,tinggi:true,jenis:'nbds',per:['dtd','mtd'],
  cab:(i,per)=>nbU(nbPair(nbCab.get(String(D.B[i][0])),kn.key,per)),
  area:(a,per)=>nbU(nbPair(nbArea(a),kn.key,per)),
  reg:per=>nbU(nbRegion(kn.key,per)),
  tie:(i,per)=>{const p=nbPair(nbCab.get(String(D.B[i][0])),kn.key,per);return p?p[0]-p[1]:0;},
  kelas:v=>kNbds(v),fmt:pct,ket:`Target ≥ ${pct(TGT)}`,sumber:()=>'New BDS ÷ (New BDS + Old BDS)'}));
const metOf=k=>MET.find(m=>m.key===k)||MET[2];
const perOf=(m,per)=>m.per.includes(per)?per:m.per[0];
const perLabel=(m,per)=>{const p=perOf(m,per);return p==='mtd'?'MTD Oktober':p==='dtd'?`DtD ${isoShort(iso())}`:`per ${isoShort(D.mdate)}`;};

/* ----- state ----- */
const ui={level:'cabang',m:'w-all',per:'dtd',semua:false,rekapSemua:false,fokus:false}; // fokus: lingkup "Cabang"
// Lingkup: Seluruh Region II (st.a = ALL) · Area (st.a = nama area) · Cabang (ui.fokus, st.a = area cabang)
// Tombol lingkup dan dropdown Area di header selalu sinkron.
const ALL='Semua Area Region II';                       // nilai yang sama dengan tab Area (area-kelompok.js)
const isRegion=()=>!AREAS.includes(st.a);
const areaAktif=()=>AREAS.includes(st.a)?st.a:null;

/* ----- hitung peringkat: nilai sama = peringkat sama (1, 1, 3, ...) ----- */
function peringkat(rows,m,per){
  rows.sort((a,b)=>(m.tinggi?b.v-a.v:a.v-b.v)||((m.tie&&a.i!=null)?m.tie(b.i,per)-m.tie(a.i,per):0));
  let prev,r=0;rows.forEach((x,j)=>{if(j===0||x.v!==prev){r=j+1;prev=x.v;}x.rk=r;});
  return rows;
}
const valid=(m,v)=>v!=null&&Number.isFinite(v)&&(m.jenis!=='waktu'||v>0);
const SEMUA_IDX=D.B.map((b,i)=>i);
const idxLingkup=()=>isRegion()?SEMUA_IDX:cabOfArea(areaAktif());
function barisCabangIdx(m,per,idx){
  const p=perOf(m,per);
  return peringkat(idx.map(i=>({i,id:String(D.B[i][0]),nama:D.B[i][1],area:D.B[i][2],v:m.cab(i,p)})).filter(r=>valid(m,r.v)),m,p);
}
const barisCabang=(m,per)=>barisCabangIdx(m,per,idxLingkup());
// peringkat gabungan (rata-rata peringkat semua indikator) untuk sekumpulan cabang
function gabunganCabang(idx,per){
  const cols=MET.map(m=>{const rows=barisCabangIdx(m,per,idx);return{m,n:rows.length,map:new Map(rows.map(r=>[r.id,r]))};});
  const ents=idx.map(i=>({id:String(D.B[i][0]),nama:D.B[i][1],area:D.B[i][2]}));
  ents.forEach(e=>{const r=cols.map(c=>c.map.get(e.id)?.rk).filter(x=>x!=null);e.cnt=r.length;e.avg=r.length?r.reduce((a,b)=>a+b,0)/r.length:null;});
  const ada=ents.filter(e=>e.avg!=null).sort((a,b)=>a.avg-b.avg||b.cnt-a.cnt);
  let prev,r=0;ada.forEach((e,j)=>{const v=Math.round(e.avg*100);if(j===0||v!==prev){r=j+1;prev=v;}e.rk=r;});
  return{cols,ada};
}
function barisArea(m,per){
  const p=perOf(m,per);
  return peringkat(AREAS.map(a=>({id:a,nama:a,v:m.area(a,p)})).filter(r=>valid(m,r.v)),m,p);
}
const barisAktif=(m,per)=>ui.level==='area'?barisArea(m,per):barisCabang(m,per);

/* ----- tampilan ----- */
const seg=(attr,list,cur)=>`<div class="seg" role="group">${list.map(([k,t])=>`<button type="button" data-rg-${attr}="${clean(k)}" class="${k===cur?'on':''}">${t}</button>`).join('')}</div>`;

function hero(){
  const area=areaAktif(),b=D.B[st.b],areaTombol=area||b[2];
  const lingkupAktif=ui.fokus?'cabang':area?'area':'region';
  const lingkup=ui.fokus?`Rapor peringkat <b>${clean(b[1])}</b> di semua indikator`
    :ui.level==='area'?`${AREAS.length} area Region II`
    :area?`${cabOfArea(area).length} cabang di Area ${clean(area)}`:`${D.B.length} cabang Seluruh Region II`;
  const judul=ui.fokus?'Rapor Peringkat Cabang':`Ranking ${ui.level==='area'?'Area':'Cabang'}`;
  return `<section class="cd rg-hero"><span class="rg-eyebrow">KITO · RANKING REGION II</span><h3>${judul}</h3><p class="rg-sub">${lingkup} · Waktu Antrian, O2O &amp; Shifting Digital, dan Utilisasi NBDS. Lingkup juga bisa dipilih lewat dropdown Area/Cabang di atas.</p>
    ${seg('level',[['cabang','🏢 Cabang'],['area','📍 Area']],ui.fokus?'':ui.level)}
    <div class="rg-lingkup"><span class="rg-g">Lingkup</span>${seg('lingkup',[['region','🌏 Seluruh Region II'],['area','📍 Area: '+clean(areaTombol)],['cabang','🏢 Cabang: '+clean(b[1])]],lingkupAktif)}</div></section>`;
}

function pilihPeriode(){
  return `<section class="cd"><div class="rg-per rg-per-only"><span class="rg-g">Periode</span>${seg('per',[['dtd',`DtD ${isoShort(iso())}`],['mtd','MTD Oktober']],ui.per==='mtd'?'mtd':'dtd')}</div><p class="rg-note">O2O dan Shifting Digital hanya tersedia per ${isoShort(D.mdate)} (tanggal laporan).</p></section>`;
}

/* Rapor satu cabang: nilai + peringkat di Region II dan di area, untuk semua indikator */
function rapor(){
  const i=st.b,b=D.B[i],id=String(b[0]),area=b[2],idxArea=cabOfArea(area);
  const q=(rk,n)=>{const x=n>1?(rk-1)/(n-1):0;return x<=.25?'q1':x<=.5?'q2':x<=.75?'q3':'q4';};
  const gReg=gabunganCabang(SEMUA_IDX,ui.per),gArea=gabunganCabang(idxArea,ui.per);
  const meReg=gReg.ada.find(e=>e.id===id),meArea=gArea.ada.find(e=>e.id===id);
  let atas=0,total=0;
  const baris=MET.map((m,j)=>{
    const p=perOf(m,ui.per),v=m.cab(i,p),ref=m.reg(p);
    const rR=gReg.cols[j].map.get(id),rA=gArea.cols[j].map.get(id),nR=gReg.cols[j].n,nA=gArea.cols[j].n;
    if(rR){total++;if(q(rR.rk,nR)==='q1')atas++;}
    const sel=(r,n,lbl)=>r?`<span class="rg-pf-rk rg-c ${q(r.rk,n)}"><b>#${r.rk}</b><small>dari ${n} ${lbl}</small></span>`:`<span class="rg-pf-rk rg-na"><b>–</b><small>${lbl}</small></span>`;
    const grup=j===0||MET[j-1].g!==m.g?`<div class="rg-pf-g">${clean(m.g)}</div>`:'';
    return `${grup}<button type="button" class="rg-pf" data-rg-pf="${m.key}" aria-label="Lihat ranking ${clean(m.n)}"><span class="rg-pf-nm"><b>${clean(m.n)}</b><small>${perLabel(m,ui.per)} · Region ${clean(m.fmt(ref))}</small></span><span class="rg-pf-v ${valid(m,v)?m.kelas(v,ref):'n'}">${valid(m,v)?m.fmt(v):'–'}</span>${sel(rR,nR,'Region')}${sel(rA,nA,'Area')}</button>`;
  }).join('');
  const kotak=(lbl,me,n,sub)=>`<div><small>${lbl}</small><b>${me?'#'+me.rk:'–'}</b><span>dari ${n} cabang${sub?' · '+sub:''}</span></div>`;
  return `<section class="cd"><h2>Rapor Peringkat · ${clean(b[1])}</h2><p class="rg-sub">${clean(area)}${b[3]?' · Kelas '+clean(b[3]):''} · kode ${clean(id)}</p>
    <div class="rg-sum">${kotak('Gabungan Region II',meReg,gReg.ada.length,'')}${kotak('Gabungan Area',meArea,gArea.ada.length,clean(area))}<div><small>25% Teratas</small><b>${atas}/${total}</b><span>indikator di level Region</span></div></div>
    <div class="rg-pf-head"><span>Indikator</span><span>Nilai</span><span>Region II</span><span>Area</span></div>${baris}
    <div class="rg-leg"><span><i class="q1"></i>25% teratas</span><span><i class="q2"></i>25–50%</span><span><i class="q3"></i>50–75%</span><span><i class="q4"></i>25% terbawah</span></div>
    <button type="button" class="rg-more" data-rg-code="${clean(id)}">🏢 Buka dashboard ${clean(b[1])}</button>
    <p class="rg-note">Ketuk indikator untuk melihat daftar ranking Seluruh Region II dengan posisi cabang ini ditandai. Peringkat gabungan = rata-rata peringkat ${MET.length} indikator.</p></section>`;
}

function pilihIndikator(){
  const m=metOf(ui.m),grup=[...new Set(MET.map(x=>x.g))];
  const tombol=grup.map(g=>`<div class="seg rg-seg"><span class="rg-g">${clean(g)}</span>${MET.filter(x=>x.g===g).map(x=>`<button type="button" data-rg-m="${x.key}" class="${x.key===m.key?'on':''}">${clean(x.n)}</button>`).join('')}</div>`).join('');
  const per=m.per.length>1?seg('per',[['dtd',`DtD ${isoShort(iso())}`],['mtd','MTD Oktober']],perOf(m,ui.per)):`<p class="rg-sub">Indikator ini hanya tersedia ${perLabel(m,ui.per)} (tanggal laporan).</p>`;
  return `<section class="cd"><h2>Indikator</h2>${tombol}<div class="rg-per"><span class="rg-g">Periode</span>${per}</div></section>`;
}

function barRow(r,m,ref,skala,me,attr){
  const w=m.jenis==='waktu'?Math.min(100,r.v/skala.max*100):Math.max(0,Math.min(100,(r.v-skala.min)/(1-skala.min)*100));
  const refX=ref==null?null:m.jenis==='waktu'?Math.min(100,ref/skala.max*100):Math.max(0,Math.min(100,(ref-skala.min)/(1-skala.min)*100));
  const medal=r.rk<=3?['🥇','🥈','🥉'][r.rk-1]:'';
  const k=m.kelas(r.v,ref);
  return `<button type="button" class="rg-row ${me?'me':''}" ${attr} aria-label="Buka ${clean(r.nama)}"><span class="rg-no ${r.rk<=3?'top':''}">${medal||r.rk}</span><span class="rg-mid"><span class="rg-nm">${clean(r.nama)}${r.area&&isRegion()?`<small>${clean(r.area)}</small>`:''}</span><span class="rg-bar"><i class="${k}" style="width:${w}%"></i>${refX!=null?`<u style="left:${refX}%"></u>`:''}</span></span><span class="rg-val ${k}">${m.fmt(r.v)}</span></button>`;
}

function daftar(){
  const m=metOf(ui.m),per=perOf(m,ui.per),rows=barisAktif(m,ui.per),ref=m.reg(per);
  const isArea=ui.level==='area';
  const vals=rows.map(r=>r.v).concat(ref!=null?[ref]:[]);
  const skala=m.jenis==='waktu'?{max:Math.max(300,...vals)*1.06}:{min:m.jenis==='nbds'?Math.max(0,Math.floor((Math.min(TGT,...vals)-.02)*20)/20):0};
  const attr=r=>isArea?`data-rg-area="${clean(r.id)}"`:`data-rg-code="${clean(r.id)}"`;
  const meId=isArea?areaAktif():String(D.B[st.b][0]);
  const meRow=rows.find(r=>r.id===meId);
  const judul=`Ranking ${isArea?'Area':'Cabang'} · ${clean(m.g)} ${clean(m.n)} · ${perLabel(m,ui.per)}`;
  if(!rows.length)return `<section class="cd"><h2>${judul}</h2><p class="rg-warn">Data ${clean(m.n)} belum tersedia untuk ${perLabel(m,ui.per)}. Pilih tanggal lain di filter atas atau periode MTD.</p></section>`;
  const best=rows[0],worst=rows[rows.length-1];
  const ringkas=`<div class="rg-sum"><div><small>Terbaik</small><b class="${m.kelas(best.v,ref)}">${m.fmt(best.v)}</b><span>${clean(best.nama)}</span></div><div><small>Region II</small><b>${m.fmt(ref)}</b><span>${m.jenis==='waktu'?'P90 Region':'Jumlah seluruh cabang'}</span></div><div><small>Terendah</small><b class="${m.kelas(worst.v,ref)}">${m.fmt(worst.v)}</b><span>${clean(worst.nama)}</span></div></div>`;
  const pin=meRow?`<p class="rg-pin">📌 <b>${clean(meRow.nama)}</b> di peringkat <b>#${meRow.rk}</b> dari ${rows.length} ${isArea?'area':'cabang'} · ${m.fmt(meRow.v)}</p>`:'';
  let isi;
  if(isArea||ui.semua||rows.length<=20){
    isi=`<div>${rows.map(r=>barRow(r,m,ref,skala,r.id===meId,attr(r))).join('')}</div>`;
  }else{
    const n=10;
    isi=`<div class="rg-judul ok">▲ ${n} Terbaik</div><div>${rows.slice(0,n).map(r=>barRow(r,m,ref,skala,r.id===meId,attr(r))).join('')}</div>
      <div class="rg-judul bad">▼ ${n} Terendah</div><div>${rows.slice(-n).reverse().map(r=>barRow(r,m,ref,skala,r.id===meId,attr(r))).join('')}</div>`;
  }
  const more=!isArea&&rows.length>20?`<button type="button" class="rg-more" data-rg-semua="1">${ui.semua?'Tampilkan 10 terbaik & 10 terendah':`Tampilkan semua ${rows.length} cabang berurutan`}</button>`:'';
  const ket=[m.jenis==='waktu'?'Semakin kecil semakin baik (mm:ss)':'Semakin besar semakin baik',m.ket,`garis tegak = Region II`,`nilai sama = peringkat sama`].filter(Boolean).join(' · ');
  return `<section class="cd"><h2>${judul}<button type="button" class="unduh" data-rg-csv="1">⬇ CSV</button></h2>${ringkas}${pin}${isi}${more}<p class="rg-note">${clean(m.sumber(per))} · ${ket}. Ketuk ${isArea?'area untuk melihat ranking cabang di area tersebut':'cabang untuk membuka dashboard-nya'}.</p></section>`;
}

/* Rekap: peringkat setiap indikator + peringkat gabungan.
   - Kolom Rata² (rata-rata peringkat) ditampilkan; urut menaik (peringkat gabungan 1 → terbesar).
   - Baris diambil berdasarkan kotak pencarian di header (nama / kode cabang, atau nama area);
     bila pencarian kosong tampil 15 teratas (+ cabang terpilih) dan tombol "Tampilkan semua". */
const kataCari=()=>{const q=document.getElementById('q');return q?q.value.trim().toLowerCase().split(/\s+/).filter(Boolean):[];};
function rekap(){
  const isArea=ui.level==='area'&&!ui.fokus;
  let cols,ada;
  if(isArea){
    cols=MET.map(m=>{const rows=barisArea(m,ui.per);return{m,n:rows.length,map:new Map(rows.map(r=>[r.id,r]))};});
    const ents=AREAS.map(a=>({id:a,nama:a}));
    ents.forEach(e=>{const r=cols.map(c=>c.map.get(e.id)?.rk).filter(x=>x!=null);e.cnt=r.length;e.avg=r.length?r.reduce((a,b)=>a+b,0)/r.length:null;});
    ada=ents.filter(e=>e.avg!=null).sort((a,b)=>a.avg-b.avg||b.cnt-a.cnt);
    let prev,r=0;ada.forEach((e,j)=>{const v=Math.round(e.avg*100);if(j===0||v!==prev){r=j+1;prev=v;}e.rk=r;});
  }else({cols,ada}=gabunganCabang(idxLingkup(),ui.per));
  const meId=isArea?areaAktif():String(D.B[st.b][0]);
  const kata=kataCari(),cariAktif=kata.length>0;
  // urut menaik berdasarkan peringkat gabungan (nama sebagai pembeda bila sama)
  ada=ada.slice().sort((a,b)=>a.rk-b.rk||String(a.nama).localeCompare(String(b.nama)));
  const LIM=15;
  let tbl;
  if(cariAktif){
    tbl=ada.filter(e=>{const t=(e.nama+' '+(isArea?'':e.id)).toLowerCase();return kata.every(w=>t.includes(w));});
  }else{
    tbl=isArea||ui.rekapSemua?ada:ada.slice(0,LIM);
    if(!isArea&&!ui.rekapSemua&&!tbl.some(e=>e.id===meId)){const me=ada.find(e=>e.id===meId);if(me)tbl=tbl.concat(me);}
  }
  // warna sel: kuartil peringkat di indikator itu
  const sel=(c,e)=>{const x=c.map.get(e.id);if(!x)return '<td class="rg-na">–</td>';const q=c.n>1?(x.rk-1)/(c.n-1):0;const k=q<=.25?'q1':q<=.5?'q2':q<=.75?'q3':'q4';return `<td class="rg-c ${k}" title="${clean(c.m.n)}: ${clean(c.m.fmt(x.v))}">${x.rk}</td>`;};
  const head=`<tr><th class="rg-sticky">#</th><th class="rg-sticky2">${isArea?'Area':'Cabang'}</th>${cols.map(c=>`<th title="${clean(c.m.g+' · '+c.m.n)}">${clean(c.m.s)}</th>`).join('')}<th>Rata²</th></tr>`;
  const body=tbl.map(e=>`<tr class="${e.id===meId?'on':''}" ${isArea?`data-rg-area="${clean(e.id)}"`:`data-rg-code="${clean(e.id)}"`}><td class="rg-sticky"><b>${e.rk}</b></td><td class="rg-sticky2"><b>${clean(e.nama)}</b>${e.area&&isRegion()?`<small>${clean(e.area)}</small>`:''}</td>${cols.map(c=>sel(c,e)).join('')}<td><b>${e.avg.toLocaleString('id-ID',{maximumFractionDigits:1})}</b>${e.cnt<cols.length?`<small>${e.cnt}/${cols.length}</small>`:''}</td></tr>`).join('')
    ||`<tr><td colspan="${cols.length+3}" class="rg-na" style="padding:16px;text-align:center">Tidak ada ${isArea?'area':'cabang'} yang cocok dengan pencarian.</td></tr>`;
  const more=!isArea&&!cariAktif&&ada.length>LIM?`<button type="button" class="rg-more" data-rg-rekap="1">${ui.rekapSemua?`Tampilkan ${LIM} teratas`:`Tampilkan semua ${ada.length} cabang`}</button>`:'';
  const perTxt=ui.per==='mtd'?'MTD Oktober (O2O & Shifting per tanggal laporan)':`DtD ${isoShort(iso())} (O2O & Shifting per ${isoShort(D.mdate)})`;
  const info=cariAktif?`Menampilkan <b>${tbl.length}</b> ${isArea?'area':'cabang'} sesuai pencarian`:`Cari nama/kode ${isArea?'area':'cabang'} di kotak pencarian atas untuk menyaring tabel`;
  return `<section class="cd" id="rg-rekap"><h2>Rekap Peringkat Semua Indikator</h2><p class="rg-sub">${perTxt}. Angka di sel = peringkat ${isArea?'area':'cabang'} pada indikator tersebut; kolom # = peringkat gabungan dan Rata² = rata-rata peringkat; diurutkan dari yang terkecil (naik). ${info}.</p><div class="tw rg-tw"><table class="rg-tbl">${head}${body}</table></div>${more}<div class="rg-leg"><span><i class="q1"></i>25% teratas</span><span><i class="q2"></i>25–50%</span><span><i class="q3"></i>50–75%</span><span><i class="q4"></i>25% terbawah</span><span><i class="rg-na-i"></i>tidak ada data</span></div><p class="rg-note">Peringkat gabungan memberi bobot sama pada ${cols.length} indikator. Kolom "Rata²" menampilkan x/${cols.length} bila sebagian indikator tidak tersedia. Ketuk baris untuk membuka ${isArea?'ranking cabang area tersebut':'dashboard cabang'}.</p></section>`;
}

const page=()=>ui.fokus?hero()+pilihPeriode()+rapor()+rekap():hero()+pilihIndikator()+daftar()+rekap();

/* ----- bungkus render() ----- */

/* ----- dropdown Area di header: tambah opsi "Seluruh Region II" saat tab Ranking -----
   fill() bawaan (dan pembungkus area-kelompok.js) mengembalikan st.a ke area cabang bila tab bukan Area;
   di tab Ranking pilihan Seluruh Region II dipertahankan. */
const fillLama=fill;
fill=function(){
  const pilihRegion=tampil==='ranking'&&st.a===ALL;
  fillLama();
  if(tampil!=='ranking')return;
  if(pilihRegion)st.a=ALL;
  const sa=document.getElementById('sa');if(!sa)return;
  [...sa.options].filter(o=>o.value===ALL).forEach(o=>o.remove());
  const opt=document.createElement('option');opt.value=ALL;opt.textContent='Seluruh Region II';
  sa.insertBefore(opt,sa.firstChild);
  sa.value=pilihRegion?ALL:st.a;
  // Seluruh Region II: dropdown Cabang berisi semua cabang (dikelompokkan per area)
  const sc=document.getElementById('sc');
  if(pilihRegion&&sc){
    sc.innerHTML=AREAS.map(a=>`<optgroup label="${clean(a)}">${cabOfArea(a).sort((x,y)=>D.B[x][1].localeCompare(D.B[y][1])).map(i=>`<option value="${i}" ${i===st.b?'selected':''}>${clean(D.B[i][1])}</option>`).join('')}</optgroup>`).join('');
  }
};

let pernahMasuk=false;
const sebelumnya=render;
render=function(){
  if(tampil==='ranking'&&!pernahMasuk){pernahMasuk=true;st.a=ALL;fill();}  // bawaan saat pertama dibuka: Seluruh Region II
  if(tampil==='ranking'&&st.a===ALL)ui.fokus=false;
  sebelumnya();
  if(tampil!=='ranking')return;
  app.innerHTML=page();
  document.body.classList.remove('maint');
};

/* ----- interaksi ----- */
function unduh(){
  if(typeof csv!=='function')return;
  const m=metOf(ui.m),per=perOf(m,ui.per),rows=barisAktif(m,ui.per),isArea=ui.level==='area';
  const nama=['ranking',isArea?'area':'cabang',m.key,per==='tgl'?D.mdate:per==='mtd'?'mtd':iso(),!isArea&&!isRegion()?norm(areaAktif()):'region'].join('-');
  csv(nama,[
    ['Peringkat',isArea?'Area':'Cabang',...(isArea?[]:['Kode','Area']),m.g+' '+m.n+' ('+perLabel(m,ui.per)+')'],
    ...rows.map(r=>[r.rk,r.nama,...(isArea?[]:[r.id,r.area]),m.fmt(r.v)]),
  ]);
}
app.addEventListener('click',e=>{
  if(tampil!=='ranking')return;
  const t=e.target,a=s=>t.closest('[data-rg-'+s+']');let x;
  if((x=a('level'))){ui.level=x.dataset.rgLevel;ui.fokus=false;ui.semua=false;ui.rekapSemua=false;render();return;}
  if((x=a('lingkup'))){
    const v=x.dataset.rgLingkup;ui.semua=false;ui.rekapSemua=false;
    if(v==='region'){st.a=ALL;ui.fokus=false;}
    else if(v==='area'){st.a=areaAktif()||D.B[st.b][2];ui.fokus=false;}
    else{st.a=D.B[st.b][2];ui.fokus=true;}
    fill();render();return;
  }
  if((x=a('pf'))){ui.m=x.dataset.rgPf;ui.fokus=false;ui.level='cabang';ui.semua=false;st.a=ALL;fill();render();window.scrollTo({top:0,behavior:'smooth'});return;}
  if((x=a('m'))){ui.m=x.dataset.rgM;ui.semua=false;render();return;}
  if((x=a('per'))){ui.per=x.dataset.rgPer;render();return;}
  if((x=a('semua'))){ui.semua=!ui.semua;render();return;}
  if((x=a('rekap'))){ui.rekapSemua=!ui.rekapSemua;render();return;}
  if((x=a('csv'))){unduh();return;}
  if((x=a('code'))){
    const i=IDX_CAB.get(x.dataset.rgCode);if(i==null)return;
    st.b=i;st.a=D.B[i][2];tampil='cabang';fill();render();window.scrollTo(0,0);return;
  }
  if((x=a('area'))){
    // ketuk area: lihat ranking cabang di area tersebut
    st.a=x.dataset.rgArea;ui.level='cabang';ui.fokus=false;ui.semua=false;ui.rekapSemua=false;
    if(D.B[st.b][2]!==st.a)st.b=cabOfArea(st.a)[0];
    fill();render();window.scrollTo({top:0,behavior:'smooth'});
  }
});

// tabel rekap ikut tersaring saat mengetik di kotak pencarian header
(function(){
  const qEl=document.getElementById('q');if(!qEl)return;
  const segarkan=()=>{if(tampil!=='ranking')return;const el=document.getElementById('rg-rekap');if(el)el.outerHTML=rekap();};
  qEl.addEventListener('input',segarkan);
  qEl.addEventListener('keydown',e=>{if(e.key==='Escape')setTimeout(segarkan,0);});
})();

render();
})();
