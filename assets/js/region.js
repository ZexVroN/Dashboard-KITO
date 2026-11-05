/* Dashboard Region (navigasi "Region"): 12 region bankwide, fokus Region II / Sumatera 2.
   Tiga indikator: Waktu Antri (DtD P95 sejak 27 Okt; MTD dan riwayat P90), Utilisasi NBDS, O2O & Shifting Digital.
   Data: data/kito.json [KITO_REGION] (tools/build_region.py). Add-on non-destruktif: membungkus render().
   Pasangan gaya: assets/css/region.css (memakai juga .rg-* dari ranking.css dan .wt-* dari area-waktu.css). */
(()=>{'use strict';
const R=window.KITO_REGION;
if(!R||typeof D==='undefined'||typeof st==='undefined'||typeof render!=='function')return;
const app=document.getElementById('app');if(!app)return;

/* ----- utilitas ----- */
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n||0).toLocaleString('id-ID');
const clock=s=>{if(s==null)return '–';const t=Math.round(Math.abs(s)),h=Math.floor(t/3600),m=Math.floor(t/60)%60,d=t%60,p=x=>String(x).padStart(2,'0');return (s<0?'-':'')+(h?h+':'+p(m):p(m))+':'+p(d);};
const pctR=p=>p==null?'–':(p*100).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
// NBDS: dipotong ke 1 desimal agar 97,96% tidak tampil 98,0% (target 98%)
const pctT=p=>{if(p==null)return '–';const v=Math.floor(p*1000+1e-9)/10;return v.toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';};
const isoShort=iso=>new Date(iso+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'});
const isoLong=iso=>new Date(iso+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
// persentil waktu antri per tanggal (kito.json [KITO_REGION]: queueMetricByDate)
const QM=R.queueMetricByDate||{};
const metrikTgl=t=>QM[t]||'P90';
const rentangTanggalP95=()=>{const tglP95=Object.keys(QM).filter(k=>QM[k]==='P95').sort();return tglP95.length?(tglP95.length>1?`${isoShort(tglP95[0])}–${isoShort(tglP95[tglP95.length-1])}`:isoShort(tglP95[0])):'';};
let rentangP95=rentangTanggalP95();
window.addEventListener('kito:bulan',()=>{rentangP95=rentangTanggalP95();ui.tip=null;GRUP[0].ket=`DtD ${rentangP95}: P95 & P100 · riwayat dan MTD: P90 · semakin kecil semakin baik`;});
const BULAN=new Date(R.bulan+'-01T00:00').toLocaleDateString('id-ID',{month:'long'});
const util=p=>p&&p[0]+p[1]>0?p[0]/(p[0]+p[1]):null;
const TGT=0.98;

const REG=R.regions,NAS=R.nasional,FOKUS=REG.find(e=>e.id===R.fokus)||REG[1];
const nama=e=>e===NAS?'Nasional':`Region ${e.no}`;
const namaPanjang=e=>e===NAS?'Nasional (bankwide)':`Region ${e.no} · ${e.nama}`;
const entOf=id=>id==='NASIONAL'?NAS:REG.find(e=>e.id===id)||NAS;

/* ----- tanggal: DtD mengikuti filter Tanggal di header ----- */
const iso=()=>D.dates[st.d];
const wIdx=()=>R.tglWaktu.indexOf(iso());
const nIdx=()=>R.tglNbds.indexOf(iso());

/* ----- indikator -----
   val(e,per) nilai entitas · seri(e) nilai harian (untuk tren) · per: periode tersedia */
const WK={teller:0,cs:1,all:2};
const waktu=(k,n,s)=>({key:'w-'+k,g:'waktu',n,s,tinggi:false,jenis:'waktu',per:['dtd','mtd'],
  val:(e,per)=>per==='mtd'?e.waktu.m?.[WK[k]]??null:(wIdx()<0?null:e.waktu.d[iso()]?.[WK[k]]??null),
  seri:e=>R.tglWaktu.map(t=>e.waktu.d[t]?.[WK[k]]??null),tgl:R.tglWaktu,fmt:clock});
// P100 (waktu tunggu terlama) sejak 27 Okt: hanya DtD
const p100=(k,n,s)=>({key:'p-'+k,g:'waktu',n,s,tinggi:false,jenis:'waktu',per:['dtd'],
  val:e=>e.waktu.p?.[iso()]?.[WK[k]]??null,
  seri:e=>R.tglWaktu.map(t=>e.waktu.p?.[t]?.[WK[k]]??null),tgl:R.tglWaktu,fmt:clock});
const nbds=(k,n,s)=>({key:'nb-'+k,g:'nbds',n,s,tinggi:true,jenis:'nbds',per:['dtd','mtd'],
  val:(e,per)=>{const b=e.nbds[k];if(!b)return null;return util(per==='mtd'?b.m:(nIdx()<0?null:b.d[nIdx()]));},
  seri:e=>(e.nbds[k]?.d||[]).map(util),tgl:R.tglNbds,fmt:pctT});
const shift=e=>{const c=e.ch;if(!c||c.o2o==null)return null;const t=c.csm+c.o2o+c.old+c.new;return t?(c.csm+c.o2o)/t:null;};
const MET=[
  waktu('all','Semua Transaksi','All Trx'),waktu('teller','Teller','Teller'),waktu('cs','Customer Service','CS'),
  p100('all','P100 Semua Transaksi','P100 All'),p100('teller','P100 Teller','P100 T'),p100('cs','P100 Customer Service','P100 CS'),
  nbds('agg','Agregat (semua transaksi)','NBDS Agregat'),nbds('fp','Teller Perorangan','NBDS T. Prg'),nbds('fnp','Teller Badan','NBDS T. Bdn'),nbds('nf','Customer Service','NBDS CS'),
  {key:'o2o',g:'o2o',n:'Overall O2O',s:'O2O',tinggi:true,jenis:'o2o',per:['mtd'],val:e=>util(e.o2o?.overall),fmt:pctR},
  {key:'shift',g:'o2o',n:'Shifting Digital',s:'Shifting',tinggi:true,jenis:'o2o',per:['mtd'],val:e=>shift(e),fmt:pctR},
];
const GRUP=[
  {key:'waktu',ik:'⏱',n:'Waktu Antri',main:'w-all',pendek:'Waktu Antri',ket:`DtD ${rentangP95}: P95 & P100 · riwayat dan MTD: P90 · semakin kecil semakin baik`},
  {key:'nbds',ik:'🖥️',n:'Utilisasi NBDS',main:'nb-agg',pendek:'NBDS',ket:'New BDS ÷ (New BDS + Old BDS) · target ≥ 98%'},
  {key:'o2o',ik:'📊',n:'O2O & Shifting Digital',main:'o2o',pendek:'O2O',ket:'Transaksi ganti kartu · semakin besar semakin baik'},
];
const metOf=k=>MET.find(m=>m.key===k)||MET[0];
const perOf=(m,per)=>m.per.includes(per)?per:m.per[0];
const perLabel=(m,per)=>perOf(m,per)==='mtd'?(m.jenis==='o2o'?`MTD s.d. ${isoShort(R.tglO2O)}`:(m.jenis==='waktu'?`${window.KITO_BULAN?window.KITO_BULAN.mtdLabel:'MTD '+BULAN} · P90`:`MTD ${BULAN}`)):(m.jenis==='waktu'?`DtD ${isoShort(iso())} · ${metrikTgl(iso())}`:`DtD ${isoShort(iso())}`);
// tgl: tanggal nilai waktu (bawaan: DtD terpilih bila periode DtD); P95 memakai batas 20 menit, P90 & P100 15 menit
const kelas=(m,v,tgl=perOf(m,ui.per)==='dtd'?iso():null)=>{
  if(v==null)return 'n';
  if(m.jenis==='waktu')return mp(v,m.key.startsWith('w-')&&!!tgl&&metrikTgl(tgl)==='P95')[1];
  if(m.jenis==='nbds')return v>=TGT?'ok':v>=.9?'mid':v>=.8?'warn':'bad';
  const ref=m.val(NAS,'mtd');return ref==null?'n':v>=ref?'ok':'bad';
};

/* ----- peringkat 12 region (nilai sama = peringkat sama) ----- */
function peringkat(m,per){
  const p=perOf(m,per);
  const rows=REG.map(e=>({e,v:m.val(e,p)})).filter(r=>r.v!=null&&Number.isFinite(r.v));
  rows.sort((a,b)=>m.tinggi?b.v-a.v:a.v-b.v);
  let prev,r=0;rows.forEach((x,j)=>{if(j===0||x.v!==prev){r=j+1;prev=x.v;}x.rk=r;});
  return rows;
}
// selisih fokus terhadap pembanding, dengan arah "lebih baik/buruk"
function selisih(m,v,ref){
  if(v==null||ref==null)return null;
  const d=v-ref,baik=m.tinggi?d>0:d<0,sama=m.jenis==='waktu'?Math.abs(d)<1:Math.abs(d)<0.0005;
  const teks=m.jenis==='waktu'?`${d<0?'−':'+'}${clock(Math.abs(d))}`:`${d>=0?'+':'−'}${Math.abs(d*100).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})} %`;
  // versi kalimat untuk chip/tabel: waktu memakai "lebih cepat/lambat"
  const kata=m.jenis==='waktu'?`${clock(Math.abs(d))} ${d<0?'lebih cepat':'lebih lambat'}`:teks;
  return{d,baik,sama,teks,kata};
}
const chipSel=(s,lbl)=>!s?'':s.sama?`<span class="chip n">≈ setara ${clean(lbl)}</span>`:`<span class="chip ${s.baik?'ok':'bad'}">${s.baik?'▲':'▼'} ${s.kata} vs ${clean(lbl)}</span>`;

/* ----- state ----- */
const ui={per:'dtd',m:'w-all',cmp:'NASIONAL',tip:null};
const seg=(attr,list,cur)=>`<div class="seg" role="group">${list.map(([k,t])=>`<button type="button" data-rx-${attr}="${clean(k)}" class="${k===cur?'on':''}">${t}</button>`).join('')}</div>`;
const cmpEnt=()=>entOf(ui.cmp);

/* ===== 1. Hero ===== */
function hero(){
  const ranks=GRUP.map(g=>{const m=metOf(g.main),rows=peringkat(m,ui.per),me=rows.find(r=>r.e===FOKUS);return me?`<span class="chip ${me.rk<=3?'ok':me.rk<=8?'mid':'bad'}">${g.ik} ${clean(g.pendek)} #${me.rk}/${rows.length}</span>`:'';}).join('');
  const opsi=[['NASIONAL','Nasional (bankwide)'],...REG.filter(e=>e!==FOKUS).map(e=>[e.id,`Region ${e.no} · ${e.nama}`])];
  return `<section class="cd rx-hero"><span class="rg-eyebrow">DASHBOARD REGION · BANKWIDE</span>
    <h3>Region ${clean(FOKUS.no)} · ${clean(FOKUS.nama)} <small>vs 11 region lain</small></h3>
    <p class="rg-sub">Waktu Antri, Utilisasi NBDS, dan O2O. Tanggal DtD mengikuti filter Tanggal di atas · P95 pada ${rentangP95}, P90 pada riwayat sebelumnya · data s.d. ${isoLong(R.tanggal)}.</p>
    <div class="rx-chips">${ranks}</div>
    <div class="rx-ctrl"><div><span class="rg-g">Periode</span>${seg('per',[['dtd',`DtD ${isoShort(iso())}`],['mtd',`MTD ${BULAN}`]],ui.per)}</div>
    <label class="rx-cmp"><span class="rg-g">Bandingkan dengan</span><select data-rx-cmp aria-label="Pembanding">${opsi.map(([v,t])=>`<option value="${clean(v)}" ${v===ui.cmp?'selected':''}>${clean(t)}</option>`).join('')}</select></label></div>
    <p class="rg-note">O2O & Shifting Digital hanya tersedia MTD (s.d. ${isoLong(R.tglO2O)}).</p></section>`;
}

/* ===== 2. Kartu skor per indikator ===== */
function bandingFokus(m,v,fokus){
  const s=selisih(m,v,fokus);
  if(!s)return 'Data perbandingan belum tersedia';
  if(s.sama)return `Setara dengan ${nama(FOKUS)}`;
  const beda=m.jenis==='waktu'
    ? `${clock(Math.abs(s.d))} ${s.d<0?'lebih cepat':'lebih lambat'}`
    : `${Math.abs(s.d*100).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})} poin persentase ${s.d>0?'lebih tinggi':'lebih rendah'}`;
  return `${beda} dibanding ${nama(FOKUS)}`;
}
function strip(rows,cmp,m){
  const fokus=m.val(FOKUS,perOf(m,ui.per));
  return `<div class="rx-strip" role="group" aria-label="Posisi peringkat region">${rows.map(r=>{
    const identitas=r.e===FOKUS?'rx-focus-text':r.e===cmp?'rx-compare-text':'';
    const label=r.e===FOKUS?'Fokus':r.e===cmp?'Pembanding':'Region';
    const beda=r.e===FOKUS?`${namaPanjang(cmp)}: ${bandingFokus(m,m.val(cmp,perOf(m,ui.per)),fokus)}`:bandingFokus(m,r.v,fokus);
    const nilaiBanding=r.e===FOKUS?m.val(cmp,perOf(m,ui.per)):r.v;
    const hasil=selisih(m,nilaiBanding,fokus);
    const warnaWaktu=m.jenis==='waktu'&&hasil&&!hasil.sama?(hasil.d<0?'rx-time-fast':'rx-time-slow'):'';
    const detail=`${namaPanjang(r.e)} · ${label} · Peringkat #${r.rk} · ${m.n}: ${m.fmt(r.v)} · ${beda}`;
    return `<button type="button" class="rx-strip-box ${r.e===FOKUS?'me':r.e===cmp?'cmp':''}" aria-label="${clean(detail)}"><span aria-hidden="true">${r.e===FOKUS||r.e===cmp?clean(r.e.no):''}</span><span class="rx-strip-tip" aria-hidden="true"><strong class="${identitas}">${clean(namaPanjang(r.e))} · ${label}</strong><span>Peringkat #${r.rk} · ${clean(m.n)}: <b class="${r.e!==FOKUS?warnaWaktu:''}">${clean(m.fmt(r.v))}</b></span><span class="rx-focus-text">Fokus ${clean(nama(FOKUS))}: ${clean(m.fmt(fokus))}</span><span class="${warnaWaktu}">${clean(beda)}</span></span></button>`;
  }).join('')}</div><div class="rx-strip-lg"><span>#1 terbaik</span><span>#${rows.length}</span></div>`;
}
function kartuGrup(g){
  const subs=MET.filter(m=>m.g===g.key),cmp=cmpEnt();
  const m=metOf(g.main),per=perOf(m,ui.per),rows=peringkat(m,ui.per),me=rows.find(r=>r.e===FOKUS);
  const v=m.val(FOKUS,per),ref=m.val(cmp,per),best=rows[0];
  const vsCmp=chipSel(selisih(m,v,ref),nama(cmp));
  const vsBest=me&&best&&best.e!==FOKUS?chipSel(selisih(m,v,best.v),`#1 ${nama(best.e)}`):(me?'<span class="chip ok">🥇 Terbaik bankwide</span>':'');
  const baris=subs.map(s=>{
    const p=perOf(s,ui.per),rs=peringkat(s,ui.per),x=rs.find(r=>r.e===FOKUS),sv=s.val(FOKUS,p),sc=s.val(cmp,p),sl=selisih(s,sv,sc);
    return `<button type="button" class="rx-sub ${s.key===g.main?'main':''}" data-rx-m="${s.key}"><span>${clean(s.n)}</span><b class="${kelas(s,sv)}">${s.fmt(sv)}</b><span class="rx-rk">${x?'#'+x.rk:'–'}</span><span class="rx-d ${sl?(sl.sama?'mu':sl.baik?'ok':'bad'):'mu'}">${sl?sl.teks:'–'}</span></button>`;
  }).join('');
  return `<section class="cd rx-card"><div class="rx-card-h"><span class="rx-ik">${g.ik}</span><div><h2>${clean(g.n)}</h2><p class="rg-sub">${clean(g.ket)} · ${perLabel(m,ui.per)}</p></div></div>
    <div class="rx-big"><div><small>${clean(m.n)} · Region ${clean(FOKUS.no)}</small><b class="${kelas(m,v)}">${m.fmt(v)}</b></div><div class="rx-rank"><b>${me?'#'+me.rk:'–'}</b><small>dari ${rows.length} region</small></div></div>
    <div class="rx-vs">${vsCmp}${vsBest}</div>${strip(rows,cmp,m)}
    <div class="rx-subs"><div class="rx-sub-h"><span>Indikator</span><span>Region ${clean(FOKUS.no)}</span><span>Rank</span><span>vs ${clean(nama(cmp))}</span></div>${baris}</div></section>`;
}

/* ===== 3. Head-to-head: Region II vs pembanding ===== */
function versus(){
  const cmp=cmpEnt();let unggul=0,total=0;
  // P100 tidak ditampilkan di tabel head-to-head
  const rows=MET.filter(m=>m.key.slice(0,2)!=='p-').map(m=>{
    const p=perOf(m,ui.per),a=m.val(FOKUS,p),b=m.val(cmp,p),s=selisih(m,a,b);
    if(s&&!s.sama){total++;if(s.baik)unggul++;}else if(s)total++;
    const grp=GRUP.find(g=>g.key===m.g);
    return `<tr><td><b>${grp.ik} ${clean(m.s)}</b><small>${perLabel(m,ui.per)}</small></td><td class="${kelas(m,a)}"><b>${m.fmt(a)}</b></td><td class="${kelas(m,b)}">${m.fmt(b)}</td><td class="${s?(s.sama?'mu':s.baik?'ok':'bad'):'mu'}"><b>${s?(s.sama?'≈':s.baik?'▲ ':'▼ ')+(s.sama?'':s.teks):'–'}</b></td></tr>`;
  }).join('');
  return `<section class="cd"><h2>Region ${clean(FOKUS.no)} vs ${clean(nama(cmp))}</h2><p class="rx-score"><b>${unggul}</b> dari ${total} indikator Region ${clean(FOKUS.no)} lebih baik dari ${clean(namaPanjang(cmp))}.</p>
    <div class="tw"><table class="rx-tbl"><tr><th>Indikator</th><th>Reg. ${clean(FOKUS.no)}</th><th>${clean(nama(cmp))}</th><th>Selisih</th></tr>${rows}</table></div>
    <p class="rg-note">▲ = Region ${clean(FOKUS.no)} lebih baik (waktu lebih cepat / persentase lebih tinggi); selisih waktu dalam mm:ss, persentase dalam poin (pp). Ganti pembanding lewat pilihan di atas atau ketuk region pada daftar perbandingan.</p></section>`;
}

/* ===== 4. Perbandingan 12 region untuk satu indikator ===== */
function pilihMetrik(){
  return GRUP.map(g=>`<div class="seg rg-seg"><span class="rg-g">${g.ik} ${clean(g.n)}</span>${MET.filter(m=>m.g===g.key).map(m=>`<button type="button" data-rx-m="${m.key}" class="${m.key===ui.m?'on':''}">${clean(m.n)}</button>`).join('')}</div>`).join('');
}
// kotak ringkasan dengan selisih Region II terhadap nilainya
function kotakVs(m,me,judul,v,ket,kls){
  const s=selisih(m,me?.v,v);
  const sel=s?`<em class="${s.sama?'mu':s.baik?'ok':'bad'}">Reg. ${clean(FOKUS.no)} ${s.sama?'≈ setara':(s.baik?'▲ ':'▼ ')+s.kata}</em>`:'';
  return `<div class="${kls}"><small>${judul}</small><b class="${kelas(m,v)}">${m.fmt(v)}</b><span>${ket}</span>${sel}</div>`;
}
// kotak ke-3: pembanding terpilih (bawaan Nasional)
function kotakCmp(m,per,rows,me,cmp){
  if(cmp===NAS)return kotakVs(m,me,'Nasional',m.val(NAS,per),'bankwide','rx-sum-cmp');
  const r=rows.find(x=>x.e===cmp);
  return kotakVs(m,me,'Pembanding',m.val(cmp,per),`${clean(nama(cmp))} · ${r?`peringkat #${r.rk}`:'tidak ada data'}`,'rx-sum-cmp');
}
// kotak pertama: region terbaik
function kotakTerbaik(m,rows,me){
  const best=rows[0];
  if(best.e===FOKUS)return `<div><small>Terbaik</small><b class="${kelas(m,best.v)}">${m.fmt(best.v)}</b><span>${clean(nama(best.e))} · ${clean(best.e.nama)}</span><em class="ok">🥇 Region ${clean(FOKUS.no)} terbaik</em></div>`;
  return kotakVs(m,me,'Terbaik',best.v,`${clean(nama(best.e))} · ${clean(best.e.nama)}`,'');
}
function daftar(){
  const m=metOf(ui.m),per=perOf(m,ui.per),rows=peringkat(m,ui.per),cmp=cmpEnt(),ref=m.val(NAS,per);
  if(!rows.length)return `<section class="cd" id="rx-daftar"><h2>Perbandingan Region</h2>${pilihMetrik()}<p class="rg-warn">Data ${clean(m.n)} belum tersedia untuk ${perLabel(m,ui.per)}.</p></section>`;
  const vals=rows.map(r=>r.v).concat(ref!=null?[ref]:[]);
  const lo=Math.min(...vals),hi=Math.max(...vals);
  // skala: waktu dari 0; persen dari kelipatan 5% di bawah nilai terendah agar selisih terlihat
  const min=m.jenis==='waktu'?0:Math.max(0,Math.floor((Math.min(lo,m.jenis==='nbds'?TGT:lo)-.02)*20)/20);
  const max=m.jenis==='waktu'?hi*1.08:1;
  const x=v=>Math.max(0,Math.min(100,(v-min)/(max-min)*100));
  const list=rows.map(r=>{const k=kelas(m,r.v),me=r.e===FOKUS,c=r.e===cmp;return `<button type="button" class="rg-row rx-row ${me?'me':''} ${c?'cmp':''}" data-rx-pilih="${clean(r.e.id)}" aria-label="Bandingkan dengan ${clean(namaPanjang(r.e))}"><span class="rg-no ${r.rk<=3?'top':''}">${r.rk<=3?['🥇','🥈','🥉'][r.rk-1]:r.rk}</span><span class="rg-mid"><span class="rg-nm">${clean(nama(r.e))}<small>${clean(r.e.nama)}${me?' · fokus':c?' · pembanding':''}</small></span><span class="rg-bar"><i class="${me?k:'rx-grey'}" style="width:${x(r.v)}%"></i>${ref!=null?`<u style="left:${x(ref)}%"></u>`:''}${m.jenis==='nbds'?`<u class="tgt" style="left:${x(TGT)}%"></u>`:''}</span></span><span class="rg-val ${me?k:''}">${m.fmt(r.v)}</span></button>`;}).join('');
  const me=rows.find(r=>r.e===FOKUS),best=rows[0],worst=rows[rows.length-1];
  const ringkas=`<div class="rg-sum">${kotakTerbaik(m,rows,me)}<div class="rx-sum-me"><small>Region ${clean(FOKUS.no)}</small><b class="${kelas(m,me?.v)}">${me?m.fmt(me.v):'–'}</b><span>${me?`peringkat #${me.rk} dari ${rows.length}`:'tidak ada data'}</span></div>${kotakCmp(m,per,rows,me,cmp)}</div>`;
  const lg=`<div class="wt-legend"><span><i class="rx-dot-me"></i>Region ${clean(FOKUS.no)}</span><span><i class="rx-dot-cmp"></i>Pembanding</span><span><u class="rg"></u>Nasional ${m.fmt(ref)}</span>${m.jenis==='nbds'?`<span><u class="t5"></u>Target ${pctT(TGT)}</span>`:''}</div>`;
  return `<section class="cd" id="rx-daftar"><h2>Perbandingan Region · ${clean(m.n)} · ${perLabel(m,ui.per)}<button type="button" class="unduh" data-rx-csv="1">⬇ CSV</button></h2>${pilihMetrik()}${ringkas}<div>${list}</div>${lg}<p class="rg-note">${m.jenis==='waktu'?'Semakin kecil semakin baik.':'Semakin besar semakin baik.'} Nilai sama = peringkat sama. Ketuk region untuk menjadikannya pembanding.</p></section>`;
}

/* ===== 5. Tren harian: semua region (abu-abu), Region II tebal, pembanding, Nasional ===== */
function tren(){
  const m=metOf(ui.m);
  if(!m.seri)return `<section class="cd"><h2>Tren Harian · ${clean(m.n)}</h2><p class="rg-sub">Data O2O & Shifting Digital tersedia sebagai MTD, sehingga tren harian tidak ditampilkan. Pilih indikator Waktu Antri atau Utilisasi NBDS untuk melihat tren.</p></section>`;
  const tgl=m.tgl,n=tgl.length,cmp=cmpEnt();
  const L=40,Rr=12,T=16,Bt=26,H=230,W=lebarGrafik();
  const sp=(W-L-Rr)/Math.max(n-1,1),X=i=>L+i*sp;
  const semua=REG.map(e=>({e,s:m.seri(e)})),nas=m.seri(NAS);
  const vals=semua.flatMap(x=>x.s).concat(nas).filter(v=>v!=null);
  let lo,hi;
  if(m.jenis==='waktu'){lo=0;hi=Math.ceil(Math.max(300,...vals)*1.05/60)*60;}
  else{const srt=vals.slice().sort((a,b)=>a-b);const p10=srt[Math.floor(srt.length*.1)]??TGT;lo=Math.max(0,Math.floor((Math.min(TGT,p10)-.01)*20)/20);hi=1;}
  const Y=v=>T+(H-T-Bt)*(1-(Math.max(lo,Math.min(hi,v))-lo)/(hi-lo));
  const step=m.jenis==='waktu'?(hi<=600?120:300):((hi-lo)>.2?.1:.05);
  let g='';
  for(let v=lo;v<=hi+1e-9;v+=step)g+=`<line x1="${L}" x2="${W-Rr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--ln)"/><text x="${L-4}" y="${Y(v)+3}" font-size="9" text-anchor="end" fill="var(--mu)">${m.jenis==='waktu'?clock(v):Math.round(v*100)+'%'}</text>`;
  if(m.jenis==='waktu')g+=`<line x1="${L}" x2="${W-Rr}" y1="${Y(300)}" y2="${Y(300)}" stroke="var(--bd)" stroke-dasharray="4 3" opacity=".7"/>`;
  if(m.jenis==='nbds')g+=`<line x1="${L}" x2="${W-Rr}" y1="${Y(TGT)}" y2="${Y(TGT)}" stroke="var(--bd)" stroke-dasharray="4 3" opacity=".7"/>`;
  const tipIdx=ui.tip!=null&&ui.tip<n?ui.tip:(tgl.indexOf(iso())>=0?tgl.indexOf(iso()):n-1);
  const langkah=Math.max(1,Math.ceil(32/Math.max(sp,1)));
  tgl.forEach((d,i)=>{const on=i===tipIdx;if((n-1-i)%langkah===0||on)g+=`<text data-rx-dl="${i}" x="${X(i)}" y="${H-8}" font-size="9" text-anchor="middle" fill="${on?'var(--tx)':'var(--mu)'}" font-weight="${on?700:400}">${isoShort(d).replace(/\s\w+$/,'')}/${d.slice(5,7)}</text>`;});
  const garis=(arr,warna,lebar,dash,op)=>{const p=arr.map((v,i)=>v==null?null:[X(i),Y(v)]).filter(Boolean);return p.length?`<polyline fill="none" stroke="${warna}" stroke-width="${lebar}" ${dash?'stroke-dasharray="5 4"':''} opacity="${op}" stroke-linejoin="round" points="${p.map(q=>q.join(',')).join(' ')}"/>`:'';};
  semua.filter(x=>x.e!==FOKUS&&x.e!==cmp).forEach(x=>{g+=garis(x.s,'var(--mu)',1.2,false,.35);});
  g+=garis(nas,'var(--tx)',1.6,true,.8);
  if(cmp!==NAS){const cs=m.seri(cmp);g+=garis(cs,'var(--c2)',2.2,false,1);}
  const fs=m.seri(FOKUS);g+=garis(fs,'var(--c1)',3,false,1);
  fs.forEach((v,i)=>{if(v!=null)g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="${i===tipIdx?4.2:2.8}" fill="var(--c1)"/>`;});
  g+=`<line id="rx-cur" x1="${X(tipIdx)}" x2="${X(tipIdx)}" y1="${T}" y2="${H-Bt}" stroke="var(--tx)" stroke-dasharray="3 3"/>`;
  const hw=Math.max(sp,22);
  const hit=tgl.map((d,i)=>`<rect data-rx-tp="${i}" data-cx="${X(i)}" x="${X(i)-hw/2}" y="${T}" width="${hw}" height="${H-T-Bt}" fill="transparent" style="cursor:pointer"/>`).join('');
  return `<section class="cd"><h2>Tren Harian · ${clean(m.n)}</h2><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren harian ${clean(m.n)} per region">${g}${hit}</svg>
    <div id="rx-tip" class="wt-tip" aria-live="polite">${tipHtml(m,tipIdx)}</div>
    <div class="wt-legend"><span><i style="background:var(--c1)"></i>Region ${clean(FOKUS.no)}</span>${cmp!==NAS?`<span><i style="background:var(--c2)"></i>${clean(nama(cmp))}</span>`:''}<span><u class="dash"></u>Nasional</span><span><i style="background:var(--mu);opacity:.5"></i>Region lain</span>${m.jenis==='waktu'?'<span><u class="t5"></u>Batas 5 menit</span>':'<span><u class="t5"></u>Target 98%</span>'}</div>
    <p class="rg-note">Ketuk grafik pada sebuah tanggal untuk melihat nilai dan peringkat Region ${clean(FOKUS.no)} hari itu.</p></section>`;
}
function tipHtml(m,i){
  const t=m.tgl[i],cmp=cmpEnt();
  const rows=REG.map(e=>({e,v:m.seri(e)[i]})).filter(r=>r.v!=null).sort((a,b)=>m.tinggi?b.v-a.v:a.v-b.v);
  const me=rows.findIndex(r=>r.e===FOKUS);
  const it=(e,warna)=>{const v=m.seri(e)[i];return `<span><i style="background:${warna}"></i>${clean(nama(e))}<b class="${e===FOKUS?kelas(m,v,t):''}">${m.fmt(v)}</b></span>`;};
  return `<b>${isoLong(t)}${me>=0?` · Region ${clean(FOKUS.no)} peringkat #${me+1} dari ${rows.length}`:''}</b><div class="wt-tip-g">${it(FOKUS,'var(--c1)')}${cmp!==NAS?it(cmp,'var(--c2)'):''}<span><u class="dash"></u>Nasional<b>${m.fmt(m.seri(NAS)[i])}</b></span>${rows[0]?`<span>Terbaik ${clean(nama(rows[0].e))}<b>${m.fmt(rows[0].v)}</b></span>`:''}</div>`;
}

/* ===== 6. Rekap peringkat semua indikator =====
   Tanpa kolom rata-rata dan tanpa peringkat gabungan; baris urut menaik menurut nomor region (I → XII);
   baris diambil berdasarkan kotak pencarian di header (nama / nomor region), kosong = semua 12 region. */
const kataCari=()=>{const q=document.getElementById('q');return q?q.value.trim().toLowerCase().split(/\s+/).filter(Boolean):[];};
function rekap(){
  const cols=MET.map(m=>({m,rows:peringkat(m,ui.per)})).map(c=>({...c,map:new Map(c.rows.map(r=>[r.e,r])),n:c.rows.length}));
  // REG sudah berurutan Region I … XII; urutan itu dipakai apa adanya (naik menurut nomor region)
  const ents=REG.map(e=>({e,cnt:cols.filter(c=>c.map.has(e)).length})).filter(x=>x.cnt>0);
  const cmp=cmpEnt();
  const q=(r,n)=>{const z=n>1?(r-1)/(n-1):0;return z<=.25?'q1':z<=.5?'q2':z<=.75?'q3':'q4';};
  const kata=kataCari(),cariAktif=kata.length>0;
  const tbl=cariAktif?ents.filter(x=>{const t=(nama(x.e)+' '+x.e.nama).toLowerCase();return kata.every(w=>t.includes(w));}):ents;
  const head=`<tr><th class="rg-sticky2" style="left:0">Region</th>${cols.map(c=>`<th title="${clean(c.m.n)}">${clean(c.m.s)}</th>`).join('')}</tr>`;
  const body=tbl.map(x=>`<tr class="${x.e===FOKUS?'on':x.e===cmp?'rx-cmp-row':''}" data-rx-pilih="${clean(x.e.id)}"><td class="rg-sticky2" style="left:0"><b>${clean(nama(x.e))}</b><small>${clean(x.e.nama)}</small></td>${cols.map(c=>{const r=c.map.get(x.e);return r?`<td class="rg-c ${q(r.rk,c.n)}" title="${clean(c.m.n)}: ${clean(c.m.fmt(r.v))}">${r.rk}</td>`:'<td class="rg-na">–</td>';}).join('')}</tr>`).join('')
    ||`<tr><td colspan="${cols.length+1}" class="rg-na" style="padding:16px;text-align:center">Tidak ada region yang cocok dengan pencarian.</td></tr>`;
  const info=cariAktif?` Menampilkan <b>${tbl.length}</b> region sesuai pencarian.`:' Ketik nama/nomor region di kotak pencarian atas untuk menyaring tabel.';
  return `<section class="cd" id="rx-rekap"><h2>Rekap Peringkat 12 Region</h2><p class="rg-sub">${ui.per==='mtd'?`MTD ${BULAN}`:`DtD ${isoShort(iso())}`} (O2O & Shifting MTD). Angka di sel = peringkat region pada indikator tersebut; baris diurutkan menurut nomor region (I → XII).${info}</p><div class="tw rg-tw"><table class="rg-tbl">${head}${body}</table></div><div class="rg-leg"><span><i class="q1"></i>25% teratas</span><span><i class="q2"></i>25–50%</span><span><i class="q3"></i>50–75%</span><span><i class="q4"></i>25% terbawah</span></div><p class="rg-note">Ketuk baris untuk menjadikan region tersebut pembanding.</p></section>`;
}

/* ===== 7. Reservasi, P100 & Wait < 10 detik per region (sejak 27 Okt) ===== */
function antrian(){
  const t=iso();
  if(t<'2026-10-27')return '';
  const ents=[...REG,NAS];
  if(!ents.some(e=>e.waktu.n?.[t]||e.waktu.w?.[t]))return `<section class="cd"><h2>Reservasi & Wait &lt; 10 Detik</h2><p class="rg-warn">Data reservasi dan wait &lt; 10 detik untuk ${isoLong(t)} belum ada di laporan.</p></section>`;
  const pc=v=>v==null?'–':(v*100).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
  const wp=e=>{const w=e.waktu.w?.[t];return w&&w[0]?w[1]/w[0]:null;};
  const urut=REG.map(e=>({e,p:wp(e)})).filter(r=>r.p!=null).sort((a,b)=>b.p-a.p);
  const rk=new Map(urut.map((r,i)=>[r.e,i+1]));
  const row=e=>{const n=e.waktu.n?.[t],w=e.waktu.w?.[t];
    return `<tr class="${e===FOKUS?'on':''}"><td class="rg-sticky2" style="left:0"><b>${clean(nama(e))}</b><small>${clean(e===NAS?'bankwide':e.nama)}</small></td><td>${n?num(n[2]):'–'}</td><td>${w?num(w[1]):'–'}</td><td><b>${pc(wp(e))}</b>${rk.has(e)?`<small>#${rk.get(e)}</small>`:''}</td></tr>`;};
  // cabang Region II dengan persentase wait < 10 detik tertinggi (data cabang di kito.json [D])
  const j=st.d,cab=D.B.map((b,i)=>({b,w:D.QW?.[i]?.[j]})).filter(r=>r.w&&r.w[1]>0).map(r=>({...r,p:r.w[1]/r.w[0]})).sort((a,b)=>b.p-a.p||b.w[1]-a.w[1]);
  const top=cab.slice(0,10).map((r,k)=>`<tr><td class="mu">${k+1}</td><td style="text-align:left"><button type="button" class="wt-lnk" data-ak-code="${clean(r.b[0])}"><b>${clean(r.b[1])}</b><small>${clean(r.b[2])}</small></button></td><td>${num(r.w[0])}</td><td>${num(r.w[1])}</td><td><b>${pc(r.p)}</b></td></tr>`).join('');
  return `<section class="cd"><h2>Reservasi & Wait &lt; 10 Detik · ${isoLong(t)}</h2>
    <p class="rg-sub">Reservasi = jumlah reservasi unik nasabah; Wait &lt; 10 detik = reservasi dengan waktu tunggu di bawah 10 detik (sheet Wait &lt;10 Detik). # = peringkat persentase tertinggi.</p>
    <div class="tw rg-tw"><table class="rg-tbl rx-ant"><tr><th class="rg-sticky2" style="left:0">Region</th><th>Reservasi</th><th>&lt; 10 dtk</th><th>%</th></tr>${ents.map(row).join('')}</table></div>
    ${top?`<h2 style="margin-top:16px">Cabang Region ${clean(FOKUS.no)} · Wait &lt; 10 Detik Tertinggi</h2><div class="tw"><table class="rx-ant"><tr><th>#</th><th style="text-align:left">Cabang</th><th>Reservasi</th><th>&lt; 10 dtk</th><th>%</th></tr>${top}</table></div><p class="rg-note">${cab.length} cabang Region ${clean(FOKUS.no)} memiliki reservasi wait &lt; 10 detik. Daftar lengkap per area ada di tab Area · Dashboard Waktu Tunggu. Ketuk nama cabang untuk membuka detailnya.</p>`:''}</section>`;
}

function catatan(){
  return `<section class="cd"><p class="rg-note" style="margin:0">Sumber: ${clean(R.sumber.waktu)} · ${clean(R.sumber.nbds)} · ${clean(R.sumber.o2o)}. Waktu antri DtD ${rentangP95} = P95; tanggal sebelumnya dan MTD historis = P90 (tidak sebanding langsung); Utilisasi NBDS MTD = jumlah harian 1 s.d. tanggal laporan; Shifting Digital = (CSM + O2O) ÷ (CSM + O2O + Old BDS + New BDS) transaksi ganti kartu.</p></section>`;
}

const page=()=>hero()+`<div class="rx-grid">${GRUP.map(kartuGrup).join('')}</div>`+versus()+antrian()+daftar()+tren()+rekap()+catatan();

/* ----- bungkus render() ----- */
const sebelumnya=render;
render=function(){
  // Saat menggambar ulang di dalam tab Region (ganti kategori, periode, pembanding), posisi gulir dijaga:
  // render() bawaan sempat mengisi #app dengan konten pendek sehingga browser menggulir ke atas.
  const tetap=tampil==='region'&&!!app.querySelector('.rx-hero');
  const y=tetap?window.scrollY:null;
  sebelumnya();
  document.body.classList.toggle('mode-region',tampil==='region');
  if(tampil!=='region')return;
  app.innerHTML=page();
  document.body.classList.remove('maint');
  if(y!=null&&Math.abs(window.scrollY-y)>1)window.scrollTo({top:y,behavior:'instant'});
};

/* ----- interaksi ----- */
function unduh(){
  if(typeof csv!=='function')return;
  const m=metOf(ui.m),p=perOf(m,ui.per),rows=peringkat(m,ui.per);
  csv(`region-${m.key}-${p==='mtd'?'mtd':iso()}`,[['Peringkat','Region','Nama',`${m.n} (${perLabel(m,ui.per)})`],...rows.map(r=>[r.rk,nama(r.e),r.e.nama,m.fmt(r.v)]),['','Nasional','',m.fmt(m.val(NAS,p))]]);
}
app.addEventListener('click',e=>{
  if(tampil!=='region')return;
  const a=s=>e.target.closest('[data-rx-'+s+']');let x;
  if((x=a('per'))){ui.per=x.dataset.rxPer;render();return;}
  if((x=a('csv'))){unduh();return;}
  if((x=a('tp'))){
    ui.tip=+x.dataset.rxTp;const m=metOf(ui.m);
    const cur=document.getElementById('rx-cur'),box=document.getElementById('rx-tip');
    if(cur){cur.setAttribute('x1',x.dataset.cx);cur.setAttribute('x2',x.dataset.cx);}
    document.querySelectorAll('[data-rx-dl]').forEach(l=>{const on=+l.dataset.rxDl===ui.tip;l.setAttribute('font-weight',on?700:400);l.setAttribute('fill',on?'var(--tx)':'var(--mu)');});
    if(box)box.innerHTML=tipHtml(m,ui.tip);return;
  }
  if((x=a('m'))){ui.m=x.dataset.rxM;ui.tip=null;render();if(x.classList.contains('rx-sub'))document.getElementById('rx-daftar')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if((x=a('pilih'))){const id=x.dataset.rxPilih;if(id!==FOKUS.id){ui.cmp=ui.cmp===id?'NASIONAL':id;render();}return;}
});
app.addEventListener('change',e=>{
  if(tampil!=='region')return;
  const s=e.target.closest('[data-rx-cmp]');if(s){ui.cmp=s.value;render();}
});

// tabel rekap ikut tersaring saat mengetik di kotak pencarian header
(function(){
  const qEl=document.getElementById('q');if(!qEl)return;
  const segarkan=()=>{if(tampil!=='region')return;const el=document.getElementById('rx-rekap');if(el)el.outerHTML=rekap();};
  qEl.addEventListener('input',segarkan);
  qEl.addEventListener('keydown',e=>{if(e.key==='Escape')setTimeout(segarkan,0);});
})();

render();
})();
