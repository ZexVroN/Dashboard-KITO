/* Dashboard Waktu Tunggu per Area (DtD & MTD) pada navigasi Area.
   Sumber data: assets/js/area-waktu-data.js (sheet "Area" · P90 · update 21 Oktober 2026).
   Mendaftarkan diri ke registri tampilan tab Area (lihat area-o2o.js). */
(()=>{'use strict';
const src=window.KITO_AREA_WAKTU;
const views=window.KITO_AREA_VIEWS;
if(!src||!views||typeof D==='undefined'||typeof st==='undefined'||typeof render!=='function')return;

const ALL='Semua Area Region II';
const IDX={teller:2,cs:5,all:6};                         // indeks nilai P90 pada data
const SVC=[['all','All Trx'],['teller','Teller'],['cs','Customer Service']];
const CAT=[['Under 5 Menit','ok'],['5 - 10 Menit','md'],['10 - 15 Menit','wr'],['Over 15 Menit','bd']];
const ui={svc:'all',per:'dtd',catPer:'dtd',kelSvc:'all',trend:'gab',tip:null};
const kel=window.KITO_AREA_KELOMPOK||[];          // P90 per cabang (DtD 21 Okt & MTD)
const KEL_ISO=src.tanggal;

const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').toLowerCase().replace(/^area\s+/,'').replace(/[^a-z0-9]/g,'');
const clock=s=>s==null?'–':String(Math.floor(Math.round(s)/60)).padStart(2,'0')+':'+String(Math.round(s)%60).padStart(2,'0');
const cls=s=>s==null?'n':s<300?'ok':s<600?'md':s<900?'wr':'bd';   // kelas warna kategori (untuk bar)
const K={ok:'ok',md:'mid',wr:'warn',bd:'bad',n:'n'};              // padanan kelas teks/chip bawaan aplikasi
const tk=s=>K[cls(s)];
const catText=s=>s==null?'–':s<300?'Under 5 Menit':s<600?'5 - 10 Menit':s<900?'10 - 15 Menit':'Over 15 Menit';
const region=src.region,areas=src.areas;
const isoLong=iso=>new Date(iso+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
const isoShort=iso=>iso.slice(8,10)+'/'+iso.slice(5,7);

function current(){
  if(st.a===ALL)return{e:region,isRegion:true};
  return{e:areas.find(a=>norm(a.name)===norm(st.a)),isRegion:false};
}
const dtdIso=()=>D.dates[st.d];                         // tanggal DtD mengikuti filter Tanggal di header
const valOf=(e,per,svc)=>{
  const arr=per==='mtd'?e.m:e.d[dtdIso()];
  return arr?arr[IDX[svc]]:null;
};
const dispName=e=>e===region?'Seluruh Area Region II':e.name;

function delta(v,ref,isRegion){
  if(isRegion||v==null||ref==null)return '';
  const d=v-ref;
  if(Math.abs(d)<1)return '<span class="wt-dl mu">≈ setara<small>vs Reg. II</small></span>';
  return `<span class="wt-dl ${d<0?'ok':'bad'}" title="${d<0?'Lebih cepat':'Lebih lambat'} ${clock(Math.abs(d))} dari Region II">${d<0?'▲':'▼'} ${clock(Math.abs(d))}<small>vs Reg. II</small></span>`;
}

function tile(name,per,e,isRegion,svc){
  const arr=per==='mtd'?e.m:e.d[dtdIso()];
  const refArr=per==='mtd'?region.m:region.d[dtdIso()];
  if(!arr)return `<div class="wt-tile"><b class="wt-nm">${name}</b><div class="wt-v n">–</div><span class="chip n">Tidak ada data</span></div>`;
  const i=IDX[svc],v=arr[i];
  const sub=svc==='all'?'P90 gabungan Teller + CS'
    :`Single ${clock(arr[i-2])} · Multipel ${clock(arr[i-1])}`;
  const ft=delta(v,refArr?refArr[i]:null,isRegion);
  // struktur seragam: nama · nilai · kategori · info · footer pembanding (footer selalu di dasar kotak)
  return `<div class="wt-tile"><b class="wt-nm">${name}</b><div class="wt-v ${tk(v)}">${clock(v)}</div><span class="chip ${tk(v)}">${catText(v)}</span><div class="wt-info"><small>${sub}</small></div>${ft?`<div class="wt-foot">${ft}</div>`:''}</div>`;
}

function periodCard(per,e,isRegion){
  const title=per==='dtd'?`DtD · ${isoLong(dtdIso())}`:'MTD · Oktober 2026';
  const has=per==='mtd'||e.d[dtdIso()];
  return `<section class="cd wt-period"><h2>${title}</h2>${has?'':`<p class="wt-warn">Data area untuk tanggal ini belum ada di laporan. Pilih tanggal lain di filter atas (tersedia: ${src.dates.map(isoShort).join(', ')}).</p>`}<div class="wt-tiles">${tile('Teller',per,e,isRegion,'teller')}${tile('CS',per,e,isRegion,'cs')}${tile('All Trx',per,e,isRegion,'all')}</div>${isRegion?'':'<p class="wt-note">▲ lebih cepat · ▼ lebih lambat dibanding Region II (semakin kecil semakin baik).</p>'}</section>`;
}

function hero(e,isRegion){
  return `<section class="cd wt-hero"><span class="wt-eyebrow">DASHBOARD WAKTU TUNGGU · ${isRegion?'REGION II':'AREA'}</span><h3>${clean(dispName(e))}</h3><p class="wt-sub">P90 waktu tunggu nasabah (mm:ss) · DtD dan MTD Oktober 2026 · update ${isoLong(src.tanggal)}</p><p class="wt-sub">Tanggal DtD mengikuti filter Tanggal di bagian atas. Target waktu tunggu: di bawah 5 menit.</p></section>`;
}

function ranking(e,isRegion){
  const svc=ui.svc,per=ui.per;
  const rows=areas.map(a=>({a,v:valOf(a,per,svc)})).filter(r=>r.v!=null).sort((x,y)=>x.v-y.v);
  const reg=valOf(region,per,svc);
  const max=Math.max(600,...rows.map(r=>r.v),reg||0)*1.08;
  const seg=(attr,list,cur)=>`<div class="seg">${list.map(([k,t])=>`<button type="button" data-wt-${attr}="${k}" class="${k===cur?'on':''}">${t}</button>`).join('')}</div>`;
  const list=rows.map((r,i)=>{
    const me=!isRegion&&e&&r.a.name===e.name;
    return `<button type="button" class="wt-row ${me?'me':''}" data-wt-area="${clean(r.a.name)}" aria-label="Buka ${clean(r.a.name)}"><span class="wt-no">${i+1}</span><span class="wt-mid"><span class="wt-nm">${clean(r.a.name)}</span><span class="wt-bar"><i class="${cls(r.v)}" style="width:${r.v/max*100}%"></i><u class="t5" style="left:${300/max*100}%"></u>${reg!=null?`<u class="rg" style="left:${reg/max*100}%"></u>`:''}</span></span><span class="wt-val ${tk(r.v)}">${clock(r.v)}</span></button>`;
  }).join('');
  const svcName=SVC.find(x=>x[0]===svc)[1];
  const perName=per==='dtd'?`DtD ${isoShort(dtdIso())}`:'MTD Oktober';
  return `<section class="cd"><h2>Ranking Area · ${svcName} · ${perName}</h2>${seg('per',[['dtd','DtD'],['mtd','MTD']],per)}${seg('svc',SVC,svc)}${rows.length?`<div>${list}</div>`:'<p class="wt-warn">Belum ada data untuk periode ini.</p>'}<div class="wt-legend"><span><i class="ok"></i>&lt; 5 mnt</span><span><i class="md"></i>5–10</span><span><i class="wr"></i>10–15</span><span><i class="bd"></i>&gt; 15</span><span><u class="t5"></u>Batas 5 menit</span><span><u class="rg"></u>Region II ${clock(reg)}</span></div><p class="wt-note">Urut dari tercepat. Ketuk area untuk membuka dashboard-nya.</p></section>`;
}

const TCOL={teller:'var(--c1)',cs:'var(--c2)',all:'var(--c3)'};
const TNAME={teller:'Teller',cs:'Customer Service',all:'All Trx'};
const TMODE=[['gab','Gabungan'],['teller','Teller'],['cs','CS'],['all','All Trx']];

// kotak info waktu pada tanggal yang diketuk (grafik Gabungan)
function tipHtml(e,i){
  const iso=src.dates[i],arr=e.d[iso];
  if(!arr)return `<b>${isoLong(iso)}</b><span class="wt-dl mu">Tidak ada data</span>`;
  const item=k=>`<span><i style="background:${TCOL[k]}"></i>${k==='cs'?'CS':TNAME[k]}<b class="${tk(arr[IDX[k]])}">${clock(arr[IDX[k]])}</b></span>`;
  const rg=e!==region&&region.d[iso]?`<span><u class="dash"></u>All Region II<b>${clock(region.d[iso][6])}</b></span>`:'';
  return `<b>${isoLong(iso)}</b><div class="wt-tip-g">${['teller','cs','all'].map(item).join('')}${rg}</div>`;
}

function trend(e){
  const dates=src.dates,n=dates.length,mode=ui.trend,single=mode!=='gab';
  const keys=single?[mode]:['teller','cs','all'];
  const L=38,R=14,T=22,Bt=28,H=210,PAD=single?16:0,GAP=36;
  const W0=lebarGrafik();
  const W=single?Math.max(W0,L+R+2*PAD+(n-1)*GAP):W0;
  const sp=(W-L-R-2*PAD)/Math.max(n-1,1);
  const X=i=>L+PAD+i*sp;
  const valsAll=[];
  keys.forEach(k=>dates.forEach(d=>{if(e.d[d]&&e.d[d][IDX[k]]!=null)valsAll.push(e.d[d][IDX[k]]);}));
  if(e!==region)dates.forEach(d=>{if(region.d[d]){const rk2=single?IDX[mode]:6;if(region.d[d][rk2]!=null)valsAll.push(region.d[d][rk2]);}});
  const mx=Math.max(300,...valsAll),stp=mx<=600?120:300,top=Math.ceil(mx*1.05/stp)*stp;
  const Y=v=>T+(H-T-Bt)*(1-v/top);
  let g='';
  for(let v=0;v<=top;v+=stp)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--ln)"/><text x="${L-4}" y="${Y(v)+3}" font-size="9" text-anchor="end" fill="var(--mu)">${clock(v)}</text>`;
  g+=`<line x1="${L}" x2="${W-R}" y1="${Y(300)}" y2="${Y(300)}" stroke="var(--bd)" stroke-dasharray="4 3" opacity=".7"/><text x="${W-R}" y="${Y(300)-4}" font-size="8" text-anchor="end" fill="var(--bd)">5 menit</text>`;
  const step=single?1:Math.max(1,Math.ceil(30/Math.max(sp,1)));
  const tipIdx=ui.tip!=null?ui.tip:(dates.indexOf(dtdIso())>=0?dates.indexOf(dtdIso()):n-1);
  dates.forEach((d,i)=>{const on=single?d===dtdIso():i===tipIdx;if((n-1-i)%step===0||on)g+=`<text ${single?'':`data-wt-dl="${i}"`} x="${X(i)}" y="${H-9}" font-size="9" text-anchor="middle" fill="${on?'var(--tx)':'var(--mu)'}" font-weight="${on?700:400}">${isoShort(d)}</text>`;});
  const line=(arr,color,dash,w,label)=>{
    const p=arr.map((v,i)=>v==null?null:[X(i),Y(v),v]).filter(Boolean);
    if(!p.length)return '';
    let o=`<polyline fill="none" stroke="${color}" stroke-width="${w}" ${dash?'stroke-dasharray="5 4"':''} stroke-linejoin="round" points="${p.map(q=>q[0]+','+q[1]).join(' ')}"/>`;
    if(!dash)o+=p.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="${label?3.4:2.6}" fill="${color}"/>`).join('');
    if(label)o+=p.map(q=>{const up=q[1]>T+10;return `<text x="${q[0]}" y="${up?q[1]-8:q[1]+15}" font-size="9" font-weight="700" text-anchor="middle" fill="var(--tx)" stroke="var(--cd)" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${clock(q[2])}</text>`;}).join('');
    return o;
  };
  const seriesOf=(ent,k)=>dates.map(d=>ent.d[d]?ent.d[d][IDX[k]]:null);
  if(e!==region)g+=line(seriesOf(region,single?mode:'all'),'var(--mu)',true,1.6,false);
  keys.forEach(k=>{g+=line(seriesOf(e,k),TCOL[k],false,2.3,single);});
  let hit='',tip='';
  if(single){
    const di=dates.indexOf(dtdIso());
    if(di>=0)g+=`<line x1="${X(di)}" x2="${X(di)}" y1="${T}" y2="${H-Bt}" stroke="var(--mu)" stroke-dasharray="3 3"/>`;
  }else{
    g+=`<line id="wt-cur" x1="${X(tipIdx)}" x2="${X(tipIdx)}" y1="${T}" y2="${H-Bt}" stroke="var(--tx)" stroke-dasharray="3 3"/>`;
    const hw=Math.max(sp,24);
    hit=dates.map((d,i)=>`<rect data-wt-tp="${i}" data-cx="${X(i)}" x="${X(i)-hw/2}" y="${T}" width="${hw}" height="${H-T-Bt}" fill="transparent" style="cursor:pointer"/>`).join('');
    tip=`<div id="wt-tip" class="wt-tip" aria-live="polite">${tipHtml(e,tipIdx)}</div>`;
  }
  const lg=keys.map(k=>`<span><i style="background:${TCOL[k]}"></i>${TNAME[k]}</span>`).join('')+(e!==region?`<span><u class="dash"></u>${single?TNAME[mode]:'All Trx'} Region II</span>`:'');
  const svg=single
    ?`<div class="wt-trend-sc"><svg width="${W}" height="${H}" style="width:${W}px;max-width:none;height:${H}px" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren P90 ${TNAME[mode]}">${g}</svg></div>`
    :`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren P90 waktu tunggu harian">${g}${hit}</svg>`;
  const tabs=`<div class="seg" role="group" aria-label="Kategori tren">${TMODE.map(([k,t])=>`<button type="button" data-wt-trend="${k}" class="${k===mode?'on':''}">${t}</button>`).join('')}</div>`;
  const note=single?'Angka di atas titik = P90 (mm:ss). Geser grafik ke samping untuk melihat tanggal lainnya; garis putus-putus vertikal = tanggal DtD terpilih.'
    :'Ketuk grafik pada sebuah tanggal untuk melihat waktu Teller, CS, dan All Trx.';
  if(single)setTimeout(()=>{const sc=document.querySelector('.wt-trend-sc');if(sc)sc.scrollLeft=sc.scrollWidth;},0);
  return `<section class="cd"><h2>Tren Harian P90 · ${clean(dispName(e))}</h2>${tabs}${svg}${tip}<div class="wt-legend">${lg}</div><p class="wt-note">${note}</p></section>`;
}

const bk=n=>n==null?-1:n<300?0:n<600?1:n<900?2:3;
const KB=[['Under 5 Menit','green','ok'],['5–10 Menit','yellow','md'],['10–15 Menit','orange','wr'],['Over 15 Menit','red','bd']];
const kelRows=isRegion=>kel.filter(r=>isRegion||norm(r.area)===norm(st.a));
const perName=per=>per==='dtd'?`DtD · ${isoLong(KEL_ISO)}`:'MTD · Oktober 2026';
function perSeg(cur){
  return `<div class="seg wt-perseg" role="group" aria-label="Periode">${[['dtd','DtD'],['mtd','MTD']].map(([k,t])=>`<button type="button" data-wt-cat="${k}" class="${k===cur?'on':''}">${t}</button>`).join('')}</div>`;
}

function kategori(e,isRegion){
  const rows=kelRows(isRegion),per=ui.catPer;
  const blok=[['Teller','teller'],['Customer Service','cs'],['All Trx','all']].map(([n,svc])=>{
    const c=[0,0,0,0];let nd=0;
    rows.forEach(r=>{const i=bk(r[per][svc]);if(i<0)nd++;else c[i]++;});
    const tot=c.reduce((a,b)=>a+b,0)+nd||1;
    const seg=c.map((v,i)=>v?`<i class="${KB[i][2]}" style="flex:${v}">${v}</i>`:'').join('')+(nd?`<i class="nd" style="flex:${nd}">${nd}</i>`:'');
    const lg=c.map((v,i)=>`<span><i class="${KB[i][2]}"></i>${KB[i][0]} <b>${v}</b></span>`).join('')+(nd?`<span><i class="nd"></i>Tanpa data <b>${nd}</b></span>`:'');
    return `<div class="wt-cat"><div class="wt-cat-h"><b>${n}</b><span>${tot} cabang</span></div><div class="wt-stack">${seg}</div><div class="wt-cat-lg">${lg}</div></div>`;
  }).join('');
  return `<section class="cd"><h2>Jumlah Cabang per Kategori</h2>${perSeg(per)}<p class="wt-sub">${perName(per)} · P90 per cabang di ${isRegion?'Region II':'area ini'}.${per==='dtd'?' DtD memakai tanggal laporan terbaru.':''}</p>${blok}</section>`;
}

function kelompok(e,isRegion){
  const rows=kelRows(isRegion),per=ui.catPer,svc=ui.kelSvc;
  const g=[[],[],[],[]],miss=[];
  rows.forEach(r=>{const n=r[per][svc],i=bk(n);(i<0?miss:g[i]).push({...r,n});});
  g.forEach(x=>x.sort((a,b)=>b.n-a.n));
  const svcTabs=`<div class="seg" role="group" aria-label="Jenis layanan">${SVC.map(([k,t])=>`<button type="button" data-wt-ksvc="${k}" class="${k===svc?'on':''}">${t}</button>`).join('')}</div>`;
  const summary=`<div class="ak-summary">${KB.map((b,i)=>`<div class="ak-count ${b[1]}"><b>${g[i].length}</b><span>${b[0]}</span></div>`).join('')}</div>`;
  const grid=`<div class="ak-grid">${KB.map((b,i)=>`<section class="ak-group ${b[1]}"><h3><span class="ak-dot"></span>${b[0]}<small>${g[i].length} cabang</small></h3><div class="ak-items">${g[i].length?g[i].map(r=>`<button type="button" class="ak-branch" data-ak-code="${clean(r.kode)}"><span><b>${clean(r.nama)}</b><small>${clean(r.kode)}${isRegion?' · '+clean(r.area):''}</small></span><strong>${clock(r.n)}</strong></button>`).join(''):'<p class="ak-empty">Tidak ada cabang dalam kelompok ini.</p>'}</div></section>`).join('')}</div>`;
  const foot=miss.length?`<p class="ak-foot">${miss.length} cabang tidak memiliki nilai ${per.toUpperCase()} untuk jenis layanan ini, sehingga tidak dimasukkan ke kelompok.</p>`:'';
  return `<section class="cd"><h2>Kelompok Waktu Tunggu Cabang</h2>${perSeg(per)}${svcTabs}<p class="wt-sub">${perName(per)} · ${rows.length} cabang · P90 ${SVC.find(x=>x[0]===svc)[1]}. Ketuk nama cabang untuk membuka detailnya.</p>${summary}${grid}${foot}</section>`;
}

function tabel(e){
  const rowHtml=(label,arr,ref,on)=>`<tr class="${on?'on':''}"><td>${label}</td>${[2,5,6].map(i=>`<td class="${tk(arr?arr[i]:null)}"><b>${clock(arr?arr[i]:null)}</b></td>`).join('')}<td class="mu">${e===region?'–':clock(ref?ref[6]:null)}</td></tr>`;
  const body=[rowHtml('<b>MTD Oktober</b>',e.m,region.m,false)].concat(src.dates.slice().reverse().map(d=>rowHtml(isoLong(d),e.d[d],region.d[d],d===dtdIso()))).join('');
  return `<section class="cd"><h2>Detail P90 per Tanggal</h2><div class="tw"><table><tr><th>Tanggal</th><th>Teller</th><th>CS</th><th>All Trx</th><th>All Reg. II</th></tr>${body}</table></div><p class="wt-note">Format mm:ss. Teller/CS = P90 overall; All Trx = P90 gabungan. Sumber: ${clean(src.sumber)}.</p></section>`;
}

function page(){
  const {e,isRegion}=current();
  if(!e)return `<section class="cd"><p class="wt-warn">Data waktu tunggu untuk <b>${clean(st.a)}</b> tidak ditemukan pada sheet Area.</p></section>`;
  return `${hero(e,isRegion)}<div class="wt-pair">${periodCard('dtd',e,isRegion)}${periodCard('mtd',e,isRegion)}</div>${ranking(e,isRegion)}${trend(e)}${kategori(e,isRegion)}${kelompok(e,isRegion)}${tabel(e)}`;
}

views.push({key:'waktu',order:10,label:'⏱ Dashboard Waktu Tunggu',html:page});

document.getElementById('app').addEventListener('click',ev=>{
  const sv=ev.target.closest('[data-wt-svc]');if(sv){ui.svc=sv.dataset.wtSvc;render();return;}
  const pr=ev.target.closest('[data-wt-per]');if(pr){ui.per=pr.dataset.wtPer;render();return;}
  const tm=ev.target.closest('[data-wt-trend]');if(tm){ui.trend=tm.dataset.wtTrend;render();return;}
  const tp=ev.target.closest('[data-wt-tp]');
  if(tp){ui.tip=+tp.dataset.wtTp;const c=current();const cur=document.getElementById('wt-cur'),box=document.getElementById('wt-tip');
    if(cur){cur.setAttribute('x1',tp.dataset.cx);cur.setAttribute('x2',tp.dataset.cx);}
    document.querySelectorAll('[data-wt-dl]').forEach(t=>{const on=+t.dataset.wtDl===ui.tip;t.setAttribute('font-weight',on?700:400);t.setAttribute('fill',on?'var(--tx)':'var(--mu)');});
    if(box&&c.e)box.innerHTML=tipHtml(c.e,ui.tip);return;}
  const ct=ev.target.closest('[data-wt-cat]');if(ct){ui.catPer=ct.dataset.wtCat;render();return;}
  const ks=ev.target.closest('[data-wt-ksvc]');if(ks){ui.kelSvc=ks.dataset.wtKsvc;render();return;}
  const ar=ev.target.closest('[data-wt-area]');
  if(ar){const hit=D.B.find(b=>norm(b[2])===norm(ar.dataset.wtArea));if(hit){st.a=hit[2];fill();render();window.scrollTo({top:0,behavior:'smooth'});}}
});
render();
})();
