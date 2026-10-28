/* Dashboard Utilisasi NBDS per Area (DtD & MTD) pada navigasi Area.
   Sumber data: assets/js/area-nbds-data.js (dibuat oleh tools/convert_nbds.py dari laporan
   "Dashboard Monitoring Utilisasi NBDS Region 2 DtD").
   Mendaftarkan diri ke registri tampilan tab Area (lihat area-o2o.js); tidak mengubah modul lain.
   Utilisasi NBDS = New BDS ÷ (New BDS + Old BDS); target ≥ 98%. */
(()=>{'use strict';
const src=window.KITO_AREA_NBDS;
if(!src||typeof D==='undefined'||typeof st==='undefined'||typeof render!=='function')return;
const views=(window.KITO_AREA_VIEWS=window.KITO_AREA_VIEWS||[]);

const ALL='Semua Area Region II';
const TGT=src.target;                                    // 0.98
const KANAL=src.kanal;                                   // [{key,label,short}]
const KEYS=KANAL.map(k=>k.key);                          // ['fp','fnp','nf']
const KNAME=Object.fromEntries(KANAL.map(k=>[k.key,k.label]));
const KSHORT=Object.fromEntries(KANAL.map(k=>[k.key,k.short]));
const KCOL={fp:'var(--c1)',fnp:'var(--c2)',nf:'var(--c3)'};
const PER=[['dtd','DtD'],['mtd','MTD']];
const ui={per:'dtd',kanal:'fp',trend:'gab',tip:null,catPer:'dtd',prKanal:'fp',prPer:'dtd',semua:false,
  svcK:'all',svcOpen:null,svcAll:false};             // svcOpen: 'kanal|layanan' yang sedang dibuka, '*' = semua

/* ----- utilitas ----- */
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').toLowerCase().replace(/^area\s+/,'').replace(/[^a-z0-9]/g,'');
const num=n=>Number(n||0).toLocaleString('id-ID');
// persen dipotong (bukan dibulatkan) ke 1 desimal, supaya 97,96% tidak tampil "98,0%" padahal belum capai target
const pct=p=>{if(p==null)return '–';const v=Math.floor(p*1000+1e-9)/10;return v.toLocaleString('id-ID',{minimumFractionDigits:v%1?1:0,maximumFractionDigits:1})+'%';};
const ppTxt=d=>(d>=0?'+':'−')+Math.abs(d*100).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+' %';
const util=pr=>pr&&pr[0]+pr[1]>0?pr[0]/(pr[0]+pr[1]):null;
// jumlah transaksi Old BDS yang harus dialihkan ke NBDS agar utilisasi ≥ target
const need=pr=>pr?Math.max(0,Math.ceil(TGT*(pr[0]+pr[1])-pr[0]-1e-9)):0;
const cls=p=>p==null?'n':p>=TGT?'ok':p>=.9?'md':p>=.8?'wr':'bd';  // kelas bar
const K={ok:'ok',md:'mid',wr:'warn',bd:'bad',n:'n'};               // kelas teks/chip bawaan
const tk=p=>K[cls(p)];
const BUCKET=[['ok','≥ 98% (target)'],['md','90 – <98%'],['wr','80 – <90%'],['bd','< 80%']];
const isoLong=iso=>new Date(iso+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
const isoShort=iso=>iso.slice(8,10)+'/'+iso.slice(5,7);
const bulanTxt=ym=>new Date(ym+'-01T00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
const BULAN=bulanTxt(src.bulan),BULAN_LALU=bulanTxt(src.bulanLalu).split(' ')[0];
const sumPairs=list=>{const a=list.filter(Boolean);return a.length?[a.reduce((s,p)=>s+p[0],0),a.reduce((s,p)=>s+p[1],0)]:null;};

/* ----- Region II = jumlah seluruh area ----- */
const region={name:'Region II',d:{},m:{},mp:{}};
KEYS.forEach(k=>{
  region.d[k]=src.dates.map((_,i)=>sumPairs(src.areas.map(a=>a.d[k][i])));
  region.m[k]=sumPairs(src.areas.map(a=>a.m[k]));
  region.mp[k]=sumPairs(src.areas.map(a=>a.mp[k]));
});
const allPair=(e,per)=>sumPairs(KEYS.map(k=>pairOf(e,per,k)));  // gabungan 3 kanal

function current(){
  if(st.a===ALL)return{e:region,isRegion:true};
  return{e:src.areas.find(a=>norm(a.name)===norm(st.a)),isRegion:false};
}
const dtdIso=()=>D.dates[st.d];                          // DtD mengikuti filter Tanggal di header
const dIdx=()=>src.dates.indexOf(dtdIso());
function pairOf(e,per,k){
  if(per==='mtd')return e.m[k];
  const i=dIdx();return i<0?null:e.d[k][i];
}
const dispName=(e,isRegion)=>isRegion?'Seluruh Area Region II':e.name;
const perLabel=per=>per==='mtd'?`MTD ${BULAN.split(' ')[0]}`:`DtD ${isoShort(dtdIso())}`;
const seg=(attr,list,cur)=>`<div class="seg" role="group">${list.map(([k,t])=>`<button type="button" data-nb-${attr}="${k}" class="${k===cur?'on':''}">${clean(t)}</button>`).join('')}</div>`;
const kanalTabs=(attr,cur)=>seg(attr,KANAL.map(k=>[k.key,k.label]),cur);

/* ----- 1. Hero ----- */
function hero(e,isRegion){
  const dtd=KEYS.map(k=>util(pairOf(e,'dtd',k)));
  const capai=dtd.filter(p=>p!=null&&p>=TGT).length,ada=dtd.filter(p=>p!=null).length;
  const chips=ada?`<span class="chip ${capai===ada?'ok':capai?'mid':'bad'}">${capai}/${ada} kanal capai target · DtD ${isoShort(dtdIso())}</span>`:'';
  return `<section class="cd wt-hero"><span class="wt-eyebrow">DASHBOARD UTILISASI NBDS · ${isRegion?'REGION II':'AREA'}</span><h3>${clean(dispName(e,isRegion))}</h3><p class="wt-sub">Utilisasi = New BDS ÷ (New BDS + Old BDS) · target ≥ ${pct(TGT)} · update ${isoLong(src.tanggal)}</p><p class="wt-sub">Tanggal DtD mengikuti filter Tanggal di bagian atas.</p><div class="nb-chips">${chips}</div></section>`;
}

/* ----- 2. Kartu DtD dan MTD ----- */
function tile(k,per,e,isRegion){
  const pr=pairOf(e,per,k),p=util(pr);
  if(!pr||p==null)return `<div class="wt-tile nb-tile"><b class="wt-nm">${clean(KNAME[k])}</b><div class="wt-v n">–</div><span class="chip n">Tanpa transaksi</span></div>`;
  const ref=util(pairOf(region,per,k));
  // selisih < 0,05 % ditulis "≈ setara" (bukan "−0,0 %")
  // dua baris tetap (nilai · "vs pembanding") agar footer semua kotak sama tinggi
  const banding=(a,b,lbl)=>Math.abs(a-b)<0.0005?`<span class="wt-dl mu">≈ setara<small>vs ${lbl}</small></span>`:`<span class="wt-dl ${a>=b?'ok':'bad'}">${a>=b?'▲':'▼'} ${ppTxt(a-b)}<small>vs ${lbl}</small></span>`;
  const vsReg=!isRegion&&ref!=null?banding(p,ref,'Reg. II'):'';
  const lalu=per==='mtd'?util(e.mp[k]):null;
  const vsLalu=lalu!=null?banding(p,lalu,BULAN_LALU):'';
  const n=need(pr);
  // struktur seragam: nama · nilai · status · info (NBDS/Old BDS, perlu dialihkan) · footer pembanding di dasar kotak
  const info=`<small>NBDS ${num(pr[0])} · Old BDS ${num(pr[1])}</small>`+(n?`<small class="nb-need-s">Perlu alihkan <b>${num(n)}</b> trx</small>`:`<small class="nb-need-s ok-s">✓ Tanpa pengalihan</small>`);
  return `<div class="wt-tile nb-tile"><b class="wt-nm">${clean(KNAME[k])}</b><div class="wt-v ${tk(p)}">${pct(p)}</div><span class="chip ${tk(p)}">${p>=TGT?'✓ Capai target':'Di bawah target'}</span><div class="wt-info">${info}</div>${vsReg||vsLalu?`<div class="wt-foot">${vsReg}${vsLalu}</div>`:''}</div>`;
}
function periodCard(per,e,isRegion){
  const has=per==='mtd'||dIdx()>=0;
  const title=per==='dtd'?`DtD · ${isoLong(dtdIso())}`:`MTD · ${BULAN}`;
  const tot=allPair(e,per),total=KEYS.reduce((s,k)=>s+need(pairOf(e,per,k)),0);
  const ringkas=tot?`<div class="nb-total"><span>Gabungan 3 kanal</span><b class="${tk(util(tot))}">${pct(util(tot))}</b><small>${num(tot[1])} transaksi masih lewat Old BDS${total?` · <b>${num(total)}</b> perlu dialihkan ke NBDS agar semua kanal ≥ ${pct(TGT)}`:''}</small></div>`:'';
  return `<section class="cd wt-period"><h2>${title}</h2>${has?'':`<p class="wt-warn">Data utilisasi untuk tanggal ini belum ada di laporan. Pilih tanggal lain di filter atas (tersedia: ${src.dates.map(isoShort).join(', ')}).</p>`}<div class="wt-tiles">${KEYS.map(k=>tile(k,per,e,isRegion)).join('')}</div>${ringkas}</section>`;
}

/* ----- 3. Ranking area ----- */
function ranking(e,isRegion){
  const per=ui.per,k=ui.kanal;
  const rows=src.areas.map(a=>({a,pr:pairOf(a,per,k)})).map(r=>({...r,p:util(r.pr)})).filter(r=>r.p!=null).sort((x,y)=>y.p-x.p);
  const reg=util(pairOf(region,per,k));
  // skala bar dimulai dari kelipatan 5% di bawah nilai terendah, supaya selisih kecil antar area terlihat
  const lo=Math.min(TGT,reg??1,...rows.map(r=>r.p));
  const min=Math.max(0,Math.floor((lo-.02)*20)/20);
  const x=p=>Math.max(0,Math.min(100,(p-min)/(1-min)*100));
  const list=rows.map((r,i)=>{
    const me=!isRegion&&e&&r.a.name===e.name;
    return `<button type="button" class="wt-row nb-row ${me?'me':''}" data-nb-area="${clean(r.a.name)}" aria-label="Buka ${clean(r.a.name)}"><span class="wt-no">${i+1}</span><span class="wt-mid"><span class="wt-nm">${clean(r.a.name)}<small class="nb-meta">Old BDS ${num(r.pr[1])}</small></span><span class="wt-bar"><i class="${cls(r.p)}" style="width:${x(r.p)}%"></i><u class="t5" style="left:${x(TGT)}%"></u>${reg!=null?`<u class="rg" style="left:${x(reg)}%"></u>`:''}</span></span><span class="wt-val ${tk(r.p)}">${pct(r.p)}</span></button>`;
  }).join('');
  return `<section class="cd"><h2>Ranking Area · ${clean(KNAME[k])} · ${perLabel(per)}</h2>${seg('per',PER,per)}${kanalTabs('kanal',k)}${rows.length?`<div>${list}</div>`:'<p class="wt-warn">Belum ada data untuk periode ini.</p>'}<div class="wt-legend">${BUCKET.map(([c,t])=>`<span><i class="${c}"></i>${t}</span>`).join('')}<span><u class="t5"></u>Target ${pct(TGT)}</span><span><u class="rg"></u>Region II ${pct(reg)}</span></div><p class="wt-note">Urut dari utilisasi tertinggi. Skala bar dimulai dari ${pct(min)} agar selisih antar area terlihat. Ketuk area untuk membuka dashboard-nya.</p></section>`;
}

/* ----- 4. Tren harian ----- */
function tipHtml(e,i,isRegion){
  const iso=src.dates[i];
  const item=k=>{const pr=e.d[k][i],p=util(pr);return `<span><i style="background:${KCOL[k]}"></i>${clean(KSHORT[k])}<b class="${tk(p)}">${pct(p)}</b>${pr&&pr[1]?`<small>${num(pr[1])} Old</small>`:''}</span>`;};
  const rg=!isRegion?`<span><u class="dash"></u>Gabungan Reg. II<b>${pct(util(sumPairs(KEYS.map(k=>region.d[k][i]))))}</b></span>`:'';
  return `<b>${isoLong(iso)}</b><div class="wt-tip-g">${KEYS.map(item).join('')}${rg}</div>`;
}
function trend(e,isRegion){
  const dates=src.dates,n=dates.length,mode=ui.trend,single=mode!=='gab';
  const keys=single?[mode]:KEYS;
  const L=42,R=14,T=22,Bt=28,H=210,PAD=single?16:0,GAP=40;
  const W0=lebarGrafik(),W=single?Math.max(W0,L+R+2*PAD+(n-1)*GAP):W0;
  const sp=(W-L-R-2*PAD)/Math.max(n-1,1),X=i=>L+PAD+i*sp;
  const ser=(ent,k)=>ent.d[k].map(util);
  const refSer=!isRegion?(single?ser(region,mode):dates.map((_,i)=>util(sumPairs(KEYS.map(k=>region.d[k][i]))))):null;
  const vals=[];keys.forEach(k=>ser(e,k).forEach(v=>v!=null&&vals.push(v)));
  if(refSer)refSer.forEach(v=>v!=null&&vals.push(v));
  // skala Y dari persentil 10 agar satu hari anomali (mis. gangguan NBDS) tidak memipihkan grafik;
  // nilai di bawah skala digambar di dasar grafik sebagai titik berongga + angka merah
  const srt=vals.slice().sort((a,b)=>a-b),p10=srt.length?srt[Math.floor(srt.length*.1)]:TGT;
  const lo=Math.min(TGT,p10),stp=1-lo>.2?.1:.05;
  const bottom=Math.max(0,Math.floor((lo-.01)/stp)*stp);
  const Y=v=>T+(H-T-Bt)*(1-(Math.max(v,bottom)-bottom)/(1-bottom));
  const luar=vals.some(v=>v<bottom);
  let g='';
  for(let v=bottom;v<=1.0001;v+=stp)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--ln)"/><text x="${L-4}" y="${Y(v)+3}" font-size="9" text-anchor="end" fill="var(--mu)">${Math.round(v*100)}%</text>`;
  g+=`<line x1="${L}" x2="${W-R}" y1="${Y(TGT)}" y2="${Y(TGT)}" stroke="var(--bd)" stroke-dasharray="4 3" opacity=".75"/><text x="${W-R}" y="${Y(TGT)+11}" font-size="8" text-anchor="end" fill="var(--bd)">Target ${pct(TGT)}</text>`;
  const di=dIdx(),tipIdx=ui.tip!=null?ui.tip:(di>=0?di:n-1);
  const step=single?1:Math.max(1,Math.ceil(30/Math.max(sp,1)));
  dates.forEach((d,i)=>{const on=single?i===di:i===tipIdx;if((n-1-i)%step===0||on)g+=`<text ${single?'':`data-nb-dl="${i}"`} x="${X(i)}" y="${H-9}" font-size="9" text-anchor="middle" fill="${on?'var(--tx)':'var(--mu)'}" font-weight="${on?700:400}">${isoShort(d)}</text>`;});
  const line=(arr,color,dash,w,label,slot=0)=>{
    const p=arr.map((v,i)=>v==null?null:[X(i),Y(v),v]).filter(Boolean);if(!p.length)return '';
    let o=`<polyline fill="none" stroke="${color}" stroke-width="${w}" ${dash?'stroke-dasharray="5 4"':''} stroke-linejoin="round" points="${p.map(q=>q[0]+','+q[1]).join(' ')}"/>`;
    if(!dash)o+=p.map(q=>q[2]<bottom
      ?`<circle cx="${q[0]}" cy="${q[1]}" r="3.6" fill="var(--cd)" stroke="${color}" stroke-width="2"/>`
      :`<circle cx="${q[0]}" cy="${q[1]}" r="${label?3.4:2.6}" fill="${color}"/>`).join('');
    const teks=(q,y,warna)=>`<text x="${q[0]}" y="${y}" font-size="9" font-weight="700" text-anchor="middle" fill="${warna}" stroke="var(--cd)" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${pct(q[2]).replace('%','')}</text>`;
    if(label)o+=p.map(q=>q[2]<bottom?teks(q,q[1]-8-slot*11,'var(--bd)'):teks(q,q[1]>T+10?q[1]-8:q[1]+15,'var(--tx)')).join('');
    else if(!dash)o+=p.filter(q=>q[2]<bottom).map(q=>teks(q,q[1]-8-slot*11,'var(--bd)')).join(''); // label bertingkat agar tidak bertumpuk
    return o;
  };
  if(refSer)g+=line(refSer,'var(--mu)',true,1.6,false);
  keys.forEach((k,j)=>{g+=line(ser(e,k),KCOL[k],false,2.3,single,j);});
  let hit='',tip='';
  if(single){if(di>=0)g+=`<line x1="${X(di)}" x2="${X(di)}" y1="${T}" y2="${H-Bt}" stroke="var(--mu)" stroke-dasharray="3 3"/>`;}
  else{
    g+=`<line id="nb-cur" x1="${X(tipIdx)}" x2="${X(tipIdx)}" y1="${T}" y2="${H-Bt}" stroke="var(--tx)" stroke-dasharray="3 3"/>`;
    const hw=Math.max(sp,24);
    hit=dates.map((d,i)=>`<rect data-nb-tp="${i}" data-cx="${X(i)}" x="${X(i)-hw/2}" y="${T}" width="${hw}" height="${H-T-Bt}" fill="transparent" style="cursor:pointer"/>`).join('');
    tip=`<div id="nb-tip" class="wt-tip" aria-live="polite">${tipHtml(e,tipIdx,isRegion)}</div>`;
  }
  const lg=keys.map(k=>`<span><i style="background:${KCOL[k]}"></i>${clean(KNAME[k])}</span>`).join('')+(refSer?`<span><u class="dash"></u>${single?clean(KSHORT[mode]):'Gabungan'} Region II</span>`:'');
  const svg=single
    ?`<div class="wt-trend-sc nb-trend-sc"><svg width="${W}" height="${H}" style="width:${W}px;max-width:none;height:${H}px" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren utilisasi ${clean(KNAME[mode])}">${g}</svg></div>`
    :`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren utilisasi NBDS harian">${g}${hit}</svg>`;
  const tabs=seg('trend',[['gab','Gabungan'],...KANAL.map(k=>[k.key,k.short])],mode);
  const note=(single?'Angka di atas titik = utilisasi (%). Geser grafik ke samping untuk tanggal lainnya; garis putus-putus vertikal = tanggal DtD terpilih.'
    :'Ketuk grafik pada sebuah tanggal untuk melihat utilisasi tiap kanal.')
    +(luar?` Titik berongga di dasar grafik = nilai di bawah ${Math.round(bottom*100)}% (angka merah), misalnya hari dengan lonjakan Old BDS.`:'');
  if(single)setTimeout(()=>{const sc=document.querySelector('.nb-trend-sc');if(sc)sc.scrollLeft=sc.scrollWidth;},0);
  return `<section class="cd"><h2>Tren Harian Utilisasi · ${clean(dispName(e,isRegion))}</h2>${tabs}${svg}${tip}<div class="wt-legend">${lg}<span><u class="t5"></u>Target ${pct(TGT)}</span></div><p class="wt-note">${note}</p></section>`;
}

/* ----- 5. Sebaran cabang per kategori ----- */
const cabangOf=isRegion=>src.cabang.filter(c=>isRegion||norm(c.area)===norm(st.a));
const cabPair=(c,per,k)=>per==='mtd'?c.m[k]:(dIdx()<0?null:c.d[k][dIdx()]);
function kategori(e,isRegion){
  const rows=cabangOf(isRegion),per=ui.catPer;
  const blok=KEYS.map(k=>{
    const cnt={ok:0,md:0,wr:0,bd:0};let nd=0;
    rows.forEach(c=>{const p=util(cabPair(c,per,k));if(p==null)nd++;else cnt[cls(p)]++;});
    const stack=BUCKET.map(([c])=>cnt[c]?`<i class="${c}" style="flex:${cnt[c]}">${cnt[c]}</i>`:'').join('')+(nd?`<i class="nd" style="flex:${nd}">${nd}</i>`:'');
    const lg=BUCKET.map(([c,t])=>`<span><i class="${c}"></i>${t} <b>${cnt[c]}</b></span>`).join('')+(nd?`<span><i class="nd"></i>Tanpa transaksi <b>${nd}</b></span>`:'');
    const tot=rows.length-nd;
    return `<div class="wt-cat"><div class="wt-cat-h"><b>${clean(KNAME[k])}</b><span>${cnt.ok}/${tot} cabang capai target (${tot?pct(cnt.ok/tot):'–'})</span></div><div class="wt-stack">${stack}</div><div class="wt-cat-lg">${lg}</div></div>`;
  }).join('');
  return `<section class="cd"><h2>Jumlah Cabang per Kategori Utilisasi</h2>${seg('cat',PER,per)}<p class="wt-sub">${per==='mtd'?`MTD ${BULAN}`:`DtD ${isoLong(dtdIso())}`} · ${rows.length} cabang di ${isRegion?'Region II':'area ini'}.</p>${blok}</section>`;
}

/* ----- 6. Cabang prioritas: di bawah target, urut jumlah transaksi yang perlu dialihkan ----- */
function prioritas(e,isRegion){
  const k=ui.prKanal,per=ui.prPer;
  const all=cabangOf(isRegion).map(c=>{const pr=cabPair(c,per,k);return{c,pr,p:util(pr),n:need(pr)};})
    .filter(r=>r.p!=null&&r.p<TGT).sort((a,b)=>b.n-a.n||b.pr[1]-a.pr[1]);
  const LIM=10,rows=ui.semua?all:all.slice(0,LIM);
  const totNeed=all.reduce((s,r)=>s+r.n,0),totOb=all.reduce((s,r)=>s+r.pr[1],0);
  const list=rows.map((r,i)=>`<button type="button" class="wt-row nb-row" data-nb-code="${clean(r.c.kode)}" aria-label="Buka ${clean(r.c.nama)}"><span class="wt-no">${i+1}</span><span class="wt-mid"><span class="wt-nm">${clean(r.c.nama)}<small class="nb-meta">${clean(r.c.kode)}${isRegion?' · '+clean(r.c.area):''} · NBDS ${num(r.pr[0])} · Old BDS ${num(r.pr[1])}</small></span><span class="nb-need-bar"><i style="width:${all[0].n?Math.max(4,r.n/all[0].n*100):0}%"></i><em>alihkan ${num(r.n)} trx</em></span></span><span class="wt-val ${tk(r.p)}">${pct(r.p)}</span></button>`).join('');
  const more=all.length>LIM?`<button type="button" class="nb-more" data-nb-all="1">${ui.semua?'Tampilkan 10 teratas':`Tampilkan semua (${all.length} cabang)`}</button>`:'';
  const sum=`<div class="ak-summary nb-sum"><div class="ak-count red"><b>${num(all.length)}</b><span>Cabang di bawah target</span></div><div class="ak-count orange"><b>${num(totOb)}</b><span>Transaksi Old BDS</span></div><div class="ak-count yellow"><b>${num(totNeed)}</b><span>Perlu dialihkan</span></div></div>`;
  return `<section class="cd"><h2>Cabang Prioritas · ${clean(KNAME[k])} · ${perLabel(per)}</h2>${seg('pp',PER,per)}${kanalTabs('pk',k)}<p class="wt-sub">Cabang dengan utilisasi di bawah ${pct(TGT)}, diurutkan dari jumlah transaksi Old BDS yang perlu dialihkan ke NBDS agar mencapai target. Ketuk cabang untuk membuka detailnya.</p>${all.length?sum+`<div>${list}</div>${more}`:`<p class="nb-ok">✓ Semua cabang ${isRegion?'di Region II':'di area ini'} sudah mencapai target untuk kanal dan periode ini.</p>`}</section>`;
}

/* ----- 7. Layanan yang masih lewat Old BDS (Raw Data, DtD tanggal laporan) ----- */
// baris Raw Data: [kode, area, kanal, layanan(fitur), jenis transaksi, nasabah, user ID tersamar, total]
const OB={kode:0,area:1,k:2,f:3,jenis:4,nas:5,uid:6,n:7};
const namaCabang=new Map(src.cabang.map(c=>[c.kode,c.nama]));
const SEMUA='*';                                          // kunci "semua layanan" untuk panel detail
const obRows=(e,isRegion)=>src.oldbds.filter(r=>(isRegion||norm(r[OB.area])===norm(e.name))&&(ui.svcK==='all'||r[OB.k]===ui.svcK));
const svcKey=r=>r[OB.k]+'|'+r[OB.f];
const groupSum=(rows,keyFn)=>{const m=new Map();rows.forEach(r=>{const k=keyFn(r);m.set(k,(m.get(k)||0)+r[OB.n]);});return [...m].sort((a,b)=>b[1]-a[1]);};

// panel rincian satu layanan (atau semua): jenis transaksi, cabang, dan Detail Data Old BDS
function panelLayanan(rows,isRegion){
  const tot=rows.reduce((s,r)=>s+r[OB.n],0);
  const jenis=groupSum(rows,r=>r[OB.jenis]);
  const cabang=groupSum(rows,r=>r[OB.kode]);
  const jenisHtml=jenis.map(([j,n])=>`<li><span>${clean(j)}</span><b>${num(n)}</b></li>`).join('');
  const cabHtml=cabang.map(([kode,n])=>{
    const rr=rows.filter(r=>r[OB.kode]===kode);
    const rinci=groupSum(rr,r=>r[OB.jenis]).map(([j,c])=>`${clean(j)} <b>×${num(c)}</b>`).join(' · ');
    return `<button type="button" class="nb-cab" data-nb-code="${clean(kode)}"><span class="nb-cab-nm"><b>${clean(namaCabang.get(kode)||kode)}</b><small>${clean(kode)}${isRegion?' · '+clean(rr[0][OB.area]):''}</small><small class="nb-cab-j">${rinci}</small></span><span class="nb-cab-v">${num(n)}<small>trx</small></span></button>`;
  }).join('');
  // tabel bersama dengan tab Cabang (script.js): No · Cabang · Transaksi · Nasabah · Kategori · User ID · Total
  const baris=rows.slice().sort((a,b)=>(namaCabang.get(a[OB.kode])||'').localeCompare(namaCabang.get(b[OB.kode])||'')||b[OB.n]-a[OB.n])
    .map(r=>({cabang:namaCabang.get(r[OB.kode])||r[OB.kode],kode:r[OB.kode],transaksi:r[OB.jenis],fitur:r[OB.f],nasabah:r[OB.nas],kanal:r[OB.k],uid:r[OB.uid],n:r[OB.n]}));
  const tabel=typeof tabelOldBds==='function'?tabelOldBds(baris,{cabang:true,gulir:true}):'';
  return `<div class="nb-svc-panel"><div class="nb-svc-ring"><span><b>${num(tot)}</b> transaksi</span><span><b>${num(cabang.length)}</b> cabang</span><span><b>${num(jenis.length)}</b> jenis transaksi</span></div>
    <h4>Jenis Transaksi</h4><ul class="nb-jenis">${jenisHtml}</ul>
    <h4>Cabang <small>ketuk untuk membuka dashboard cabang</small></h4><div>${cabHtml}</div>
    <h4 class="nb-h4-row">Detail Data Old BDS (${num(rows.length)})<button type="button" class="unduh" data-nb-csv="1">⬇ CSV</button></h4>${tabel}
    <p class="wt-note">Total ${num(tot)} transaksi dari ${num(rows.length)} baris. User ID disamarkan.</p></div>`;
}

function layanan(e,isRegion){
  const rows=obRows(e,isRegion);
  const svc=groupSum(rows,svcKey).map(([key,n])=>{const [k,f]=key.split('|');return{key,k,f,n,cab:new Set(rows.filter(r=>svcKey(r)===key).map(r=>r[OB.kode])).size};});
  const tot=rows.reduce((s,r)=>s+r[OB.n],0),max=svc[0]?.n||1;
  const LIM=8,tampil=ui.svcAll?svc:svc.slice(0,LIM);
  // layanan yang sedang dibuka tetap ditampilkan walau di luar 8 teratas
  if(!ui.svcAll&&ui.svcOpen&&ui.svcOpen!==SEMUA&&!tampil.some(s=>s.key===ui.svcOpen)){const s=svc.find(s=>s.key===ui.svcOpen);if(s)tampil.push(s);}
  const list=tampil.map(r=>{
    const open=ui.svcOpen===r.key;
    return `<button type="button" class="nb-svc ${open?'open':''}" data-nb-svc="${clean(r.key)}" aria-expanded="${open}"><span class="nb-svc-nm"><b>${clean(r.f)}</b><small><i style="background:${KCOL[r.k]}"></i>${clean(KNAME[r.k])} · ${r.cab} cabang</small></span><span class="nb-svc-bar"><i style="width:${r.n/max*100}%;background:${KCOL[r.k]}"></i></span><span class="nb-svc-v">${num(r.n)}<small>${pct(r.n/tot)}</small></span><span class="nb-chev" aria-hidden="true">›</span></button>${open?panelLayanan(rows.filter(x=>svcKey(x)===r.key),isRegion):''}`;
  }).join('');
  const more=svc.length>LIM?`<button type="button" class="nb-more" data-nb-svcall="1">${ui.svcAll?'Tampilkan 8 teratas':`Tampilkan semua layanan (${svc.length})`}</button>`:'';
  const semuaOpen=ui.svcOpen===SEMUA;
  const semua=rows.length?`<button type="button" class="nb-more nb-all-ob ${semuaOpen?'on':''}" data-nb-svc="${SEMUA}" aria-expanded="${semuaOpen}">📋 ${semuaOpen?'Tutup':'Lihat'} Detail Data Old BDS seluruh layanan (${num(rows.length)} baris)</button>${semuaOpen?panelLayanan(rows,isRegion):''}`:'';
  const filter=seg('svck',[['all','Semua kanal'],...KANAL.map(k=>[k.key,k.short])],ui.svcK);
  return `<section class="cd" id="nb-layanan"><h2>Layanan Masih Lewat Old BDS · ${isoShort(src.tanggal)}</h2>${filter}<p class="wt-sub">${num(tot)} transaksi Old BDS pada ${isoLong(src.tanggal)} di ${isRegion?'Region II':clean(e.name)}. Ketuk layanan untuk melihat cabang, jenis transaksi, dan Detail Data Old BDS.</p>${svc.length?`<div class="nb-svc-list">${list}</div>${more}${semua}`:'<p class="nb-ok">✓ Tidak ada transaksi Old BDS untuk pilihan ini.</p>'}<p class="wt-note">Sumber: sheet Raw Data (transaksi eligible) tanggal ${isoLong(src.tanggal)}; tidak mengikuti filter Tanggal.</p></section>`;
}

// unduh CSV rincian layanan yang sedang dibuka
function unduhLayanan(){
  const {e,isRegion}=current();if(!e||typeof csv!=='function')return;
  let rows=obRows(e,isRegion);
  if(ui.svcOpen&&ui.svcOpen!==SEMUA)rows=rows.filter(r=>svcKey(r)===ui.svcOpen);
  const nama=(isRegion?'region-ii':norm(e.name))+(ui.svcOpen&&ui.svcOpen!==SEMUA?'-'+norm(ui.svcOpen.split('|')[1]):'');
  csv('old-bds-'+nama+'-'+src.tanggal,[
    ['No','Tanggal','Area','Kode Cabang','Cabang','Kanal','Layanan','Jenis Transaksi','Nasabah','User ID','Total Transaksi'],
    ...rows.map((r,j)=>[j+1,src.tanggal,r[OB.area],r[OB.kode],namaCabang.get(r[OB.kode])||'',KNAME[r[OB.k]],r[OB.f],r[OB.jenis],r[OB.nas],r[OB.uid],r[OB.n]]),
  ]);
}

/* ----- 8. Tabel per tanggal ----- */
function tabel(e,isRegion){
  const cell=pr=>{const p=util(pr);return `<td class="${tk(p)}"><b>${pct(p)}</b></td>`;};
  const row=(label,get,attr,on)=>`<tr ${attr} class="${on?'on':''}"><td>${label}</td>${KEYS.map(k=>cell(get(k))).join('')}<td class="mu">${isRegion?'–':pct(util(sumPairs(KEYS.map(k=>get(k,true)))))}</td></tr>`;
  const ent=(k,ref)=>ref?region:e;
  const hari=iso=>new Date(iso+'T00:00').toLocaleDateString('id-ID',{weekday:'short'});
  const body=[
    row(`<b>MTD ${BULAN.slice(0,3)}</b>`,(k,r)=>ent(k,r).m[k],'',false),
    row(`MTD ${BULAN_LALU.slice(0,3)}`,(k,r)=>ent(k,r).mp[k],'',false),
    ...src.dates.map((d,i)=>[d,i]).reverse().map(([d,i])=>{const j=D.dates.indexOf(d);return row(`${isoShort(d)} <small class="nb-hari">${hari(d)}</small>`,(k,r)=>ent(k,r).d[k][i],j>=0?`data-nb-d="${j}"`:'',d===dtdIso());}),
  ].join('');
  const TH={fp:'T. Perorangan',fnp:'T. Badan',nf:'CS'};
  return `<section class="cd"><h2>Detail Utilisasi per Tanggal</h2><div class="tw"><table class="nb-tbl"><tr><th>Tanggal</th>${KEYS.map(k=>`<th>${TH[k]||clean(KSHORT[k])}</th>`).join('')}<th>Gab. Reg. II</th></tr>${body}</table></div><p class="wt-note">T. = Teller. Ketuk baris tanggal untuk mengganti tanggal DtD. Kolom terakhir = utilisasi gabungan 3 kanal Region II sebagai pembanding.</p></section>`;
}

function page(){
  const {e,isRegion}=current();
  if(!e)return `<section class="cd"><p class="wt-warn">Data utilisasi NBDS untuk <b>${clean(st.a)}</b> tidak ditemukan pada laporan.</p></section>`;
  return `${hero(e,isRegion)}<div class="wt-pair">${periodCard('dtd',e,isRegion)}${periodCard('mtd',e,isRegion)}</div>${ranking(e,isRegion)}${trend(e,isRegion)}${kategori(e,isRegion)}${prioritas(e,isRegion)}${layanan(e,isRegion)}${tabel(e,isRegion)}<section class="cd"><p class="wt-note nb-src" style="margin:0">Sumber: ${clean(src.sumber)} · data per ${isoLong(src.tanggal)}. Angka area dan Region II = jumlah New BDS dan Old BDS seluruh cabang (bukan rata-rata persentase). Persentase dipotong ke 1 desimal agar nilai di bawah target tidak tampil sebagai ${pct(TGT)}.${src.metodeMTD?` MTD = ${clean(src.metodeMTD)}.`:''}</p></section>`;
}

views.push({key:'nbds',order:20,label:'🖥️ Dashboard Utilisasi NBDS',html:page});

/* ----- Kategori "Utilisasi NBDS" pada kartu Ranking Cabang (script.js) -----
   Nilai DtD mengikuti filter Tanggal; cabang tanpa transaksi tidak ikut ranking.
   Nilai sama (mis. banyak cabang 100%): yang selisih NBDS − Old BDS-nya lebih besar dianggap lebih baik. */
if(typeof METRIK!=='undefined'&&Array.isArray(METRIK)){
  const byKode=new Map(src.cabang.map(c=>[c.kode,c]));
  const pairCab=(i,k)=>{const c=byKode.get(String(D.B[i][0])),j=dIdx();return c&&j>=0?c.d[k][j]:null;};
  KANAL.forEach(kn=>METRIK.push({
    n:kn.label,g:'Utilisasi NBDS',tinggi:true,
    f:i=>util(pairCab(i,kn.key)),
    fmt:pct,kelas:tk,valid:v=>v!=null,
    tgl:()=>D.dates[st.d],
    tie:i=>{const p=pairCab(i,kn.key);return p?p[0]-p[1]:0;},
    sub:i=>{const p=pairCab(i,kn.key);return p?`Old BDS ${num(p[1])}/${num(p[0]+p[1])}`:'';},  // singkat: kolom ranking sempit di HP
  }));
}

/* ----- interaksi ----- */
let dSebelum=st.d;
const tutupTip=()=>{if(st.d!==dSebelum){ui.tip=null;dSebelum=st.d;}};
const sebelumnya=render;
render=function(){
  tutupTip();sebelumnya();
  // tombol "⬇ CSV" bawaan dipasang script.js sebelum tampilan Area ditimpa modul lain; pasang ulang di sini
  if(tampil==='area'&&typeof pasangUnduh==='function'&&!document.querySelector('#app [data-ex]'))pasangUnduh();
};

function bukaCabang(kode){
  const i=D.B.findIndex(b=>String(b[0])===String(kode));if(i<0)return;
  st.b=i;st.a=D.B[i][2];tampil='cabang';fill();render();window.scrollTo(0,0);
}
document.getElementById('app').addEventListener('click',ev=>{
  const t=ev.target;
  const a=(s)=>t.closest('[data-nb-'+s+']');
  let x;
  if((x=a('per'))){ui.per=x.dataset.nbPer;render();return;}
  if((x=a('kanal'))){ui.kanal=x.dataset.nbKanal;render();return;}
  if((x=a('trend'))){ui.trend=x.dataset.nbTrend;render();return;}
  if((x=a('cat'))){ui.catPer=x.dataset.nbCat;render();return;}
  if((x=a('pp'))){ui.prPer=x.dataset.nbPp;ui.semua=false;render();return;}
  if((x=a('pk'))){ui.prKanal=x.dataset.nbPk;ui.semua=false;render();return;}
  if((x=a('all'))){ui.semua=!ui.semua;render();return;}
  if((x=a('svck'))){ui.svcK=x.dataset.nbSvck;ui.svcOpen=null;render();return;}
  if((x=a('svcall'))){ui.svcAll=!ui.svcAll;render();return;}
  if((x=a('csv'))){unduhLayanan();return;}
  if((x=a('svc'))){
    const key=x.dataset.nbSvc;ui.svcOpen=ui.svcOpen===key?null:key;render();
    // jaga posisi: gulir ke baris layanan yang diketuk
    const el=document.querySelector(`[data-nb-svc="${CSS.escape(key)}"]`);
    if(el&&ui.svcOpen){const top=el.getBoundingClientRect().top;if(top<120||top>innerHeight-80)el.scrollIntoView({block:'center'});}
    return;
  }
  if((x=a('tp'))){
    // ganti isi kotak info tanpa menggambar ulang halaman
    ui.tip=+x.dataset.nbTp;const c=current();
    const cur=document.getElementById('nb-cur'),box=document.getElementById('nb-tip');
    if(cur){cur.setAttribute('x1',x.dataset.cx);cur.setAttribute('x2',x.dataset.cx);}
    document.querySelectorAll('[data-nb-dl]').forEach(l=>{const on=+l.dataset.nbDl===ui.tip;l.setAttribute('font-weight',on?700:400);l.setAttribute('fill',on?'var(--tx)':'var(--mu)');});
    if(box&&c.e)box.innerHTML=tipHtml(c.e,ui.tip,c.isRegion);
    return;
  }
  if((x=a('d'))){st.d=+x.dataset.nbD;fill();render();return;}
  if((x=a('code'))){bukaCabang(x.dataset.nbCode);return;}
  if((x=a('area'))){
    const hit=D.B.find(b=>norm(b[2])===norm(x.dataset.nbArea));
    if(hit){st.a=hit[2];fill();render();window.scrollTo({top:0,behavior:'smooth'});}
  }
});
render();
})();
