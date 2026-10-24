/* Dashboard Infografis O2O pada navigasi Area.
   Sumber data: assets/js/area-o2o-data.js (sheet "Area Okt" · 21 Oktober 2026).
   Modul ini membungkus render() tanpa mengubah modul lain. */
(()=>{'use strict';
const src=window.KITO_AREA_O2O;
if(!src||typeof D==='undefined'||typeof st==='undefined'||typeof render!=='function')return;

const ALL='Semua Area Region II';
const SEG_STYLE={gold:'#c9971c',platinum:'#5b6b8c',silver:'#8a94a6',overall:'#2563eb'};
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').toLowerCase().replace(/^area\s+/,'').replace(/[^a-z0-9]/g,'');
const num=n=>Number(n||0).toLocaleString('id-ID');
const pct=p=>p==null?'–':(p*100).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const shortName=n=>String(n||'').replace(/^AREA\s+/i,'');
const tgl=new Date(src.tanggal+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});

const ui={sub:'waktu',rank:'overall',sdAll:false};  // sub: kunci tampilan terdaftar ('waktu' | 'o2o'); selain itu tampilan lama
const segs=src.segments;
const region=src.region,bank=src.bankwide,areas=src.areas;

// peringkat area per segmen (persentase tertinggi = peringkat 1)
const rankOf={};
segs.forEach(({key})=>{
  const sorted=areas.slice().sort((a,b)=>b.s[key][3]-a.s[key][3]);
  rankOf[key]=new Map(sorted.map((a,i)=>[a.name,i+1]));
});

function current(){
  if(st.a===ALL)return{e:region,isRegion:true};
  const e=areas.find(a=>norm(a.name)===norm(st.a));
  return{e,isRegion:false};
}

function gapChip(diff,label){
  const pp=diff*100,up=pp>=0;
  return `<span class="chip ${up?'ok':'bad'}">${up?'▲':'▼'} ${Math.abs(pp).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})} pp vs ${label}</span>`;
}

function donut(p,color){
  const r=52,C=2*Math.PI*r,v=Math.max(0,Math.min(1,p||0));
  return `<svg class="o2o-donut" viewBox="0 0 140 140" role="img" aria-label="Utilisasi O2O ${pct(p)}"><circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--ln)" stroke-width="16"/><circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${v*C} ${C}" transform="rotate(-90 70 70)"/><text x="70" y="68" text-anchor="middle" font-size="26" font-weight="800" fill="var(--tx)">${pct(p)}</text><text x="70" y="88" text-anchor="middle" font-size="10" font-weight="700" fill="var(--mu)">Overall O2O</text></svg>`;
}

// Registri tampilan tab Area: modul lain (mis. area-waktu.js) mendaftarkan tampilannya di sini.
const views=(window.KITO_AREA_VIEWS=window.KITO_AREA_VIEWS||[]);
views.push({key:'o2o',order:30,label:'📊 Dashboard Infografis O2O',html:page});
function subNav(){
  const all=views.slice().sort((a,b)=>a.order-b.order);
  return `<div class="seg o2o-subnav" role="group" aria-label="Tampilan Area">${all.map(v=>`<button type="button" data-o2o-sub="${clean(v.key)}" class="${ui.sub===v.key?'on':''}">${clean(v.label)}</button>`).join('')}</div>`;
}

function hero(e,isRegion){
  const o=e.s.overall;
  const chips=isRegion
    ? gapChip(o[3]-bank.s.overall[3],'Bankwide (BMRI)')
    : gapChip(o[3]-region.s.overall[3],'Region II')+gapChip(o[3]-bank.s.overall[3],'Bankwide');
  const posisi=isRegion
    ? `${areas.length} area · rata-rata Region II`
    : `Peringkat #${e.rank} dari ${areas.length} area di Region II`;
  return `<section class="cd o2o-hero"><span class="o2o-eyebrow">DASHBOARD INFOGRAFIS O2O · ${isRegion?'REGION II':'AREA'}</span><h3>${clean(isRegion?"Seluruh Area Region II":shortName(e.name))}</h3><p class="o2o-sub">Utilisasi Livin O2O per ${tgl} · ${posisi}</p><div class="o2o-hero-body">${donut(o[3],SEG_STYLE.overall)}<div class="o2o-kv"><div><span>Livin O2O</span><b>${num(o[0])}</b></div><div><span>New BDS</span><b>${num(o[1])}</b></div><div><span>Total Transaksi</span><b>${num(o[2])}</b></div></div></div><div class="o2o-chips">${chips}</div></section>`;
}

function cmpRow(label,p,me){
  return `<div class="o2o-cmp ${me?'me':''}"><span>${clean(label)}</span><div class="o2o-track"><i style="width:${Math.max(0,Math.min(100,(p||0)*100))}%"></i></div><b>${pct(p)}</b></div>`;
}

function segCard(seg,e,isRegion){
  const [o,n,t,p,k]=e.s[seg.key];
  const total=o+n||1;
  const ket=k==='above'?'ok':'bad';
  const base=isRegion?bank.s[seg.key][3]:region.s[seg.key][3];
  const pp=(p-base)*100;
  const ppText=(pp>=0?'+':'−')+Math.abs(pp).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+' pp';
  const ketChip=`<span class="chip ${ket}">${k==='above'?'▲ Above':'▼ Below'} Avg ${isRegion?'Bankwide':'Region II'} · ${ppText}</span>`;
  const rk=isRegion?'':`<span class="chip n">#${rankOf[seg.key].get(e.name)} / ${areas.length}</span>`;
  const rows=[cmpRow(isRegion?'Region II':shortName(e.name),p,true)];
  if(!isRegion)rows.push(cmpRow('Region II',region.s[seg.key][3],false));
  rows.push(cmpRow('Bankwide',bank.s[seg.key][3],false));
  const gaps=ketChip+(isRegion?'':gapChip(p-bank.s[seg.key][3],'Bankwide'));
  return `<div class="o2o-seg" style="--sc:${SEG_STYLE[seg.key]}"><div class="o2o-seg-h"><span class="o2o-dot"></span><b>${clean(seg.label)}</b>${rk}</div><div class="o2o-pct">${pct(p)}</div><div class="o2o-split" role="img" aria-label="Proporsi Livin O2O ${pct(p)}"><i class="a" style="flex:${o}"></i><i class="b" style="flex:${n}"></i></div><div class="o2o-split-lg"><span>Livin O2O <b>${num(o)}</b></span><span>New BDS <b>${num(n)}</b></span><span>Total <b>${num(t)}</b></span></div>${rows.join('')}<div class="o2o-gap">${gaps}</div></div>`;
}

function segments(e,isRegion){
  return `<section class="cd"><h2>Utilisasi O2O per Segmen</h2><p class="o2o-sub">Persentase = Livin O2O ÷ (Livin O2O + New BDS). Bar membandingkan ${isRegion?'Region II dengan Bankwide':'Area dengan Region II dan Bankwide'}.</p><div class="o2o-grid">${segs.map(s=>segCard(s,e,isRegion)).join('')}</div></section>`;
}

function ranking(e,isRegion){
  const key=ui.rank,seg=segs.find(s=>s.key===key)||segs[3];
  const rows=areas.slice().sort((a,b)=>b.s[key][3]-a.s[key][3]);
  const reg=region.s[key][3],bw=bank.s[key][3];
  const tabs=`<div class="seg">${segs.map(s=>`<button type="button" data-o2o-rank="${s.key}" class="${s.key===key?'on':''}">${clean(s.label)}</button>`).join('')}</div>`;
  const list=rows.map((a,i)=>{
    const p=a.s[key][3],me=!isRegion&&e&&a.name===e.name;
    return `<button type="button" class="o2o-rank-row ${me?'me':''} ${p>=reg?'ok-row':'bd-row'}" data-o2o-area="${clean(a.name)}" aria-label="Buka ${clean(shortName(a.name))}"><span class="o2o-rank-no">${i+1}</span><span><span class="o2o-rank-nm">${clean(shortName(a.name))}<small>${num(a.s[key][2])} trx</small></span><span class="o2o-rank-bar"><i style="width:${p*100}%"></i><u class="reg" style="left:${reg*100}%"></u><u class="bw" style="left:${bw*100}%"></u></span></span><span class="o2o-rank-v">${pct(p)}</span></button>`;
  }).join('');
  return `<section class="cd"><h2>Ranking Area · ${clean(seg.label)}</h2>${tabs}<div>${list}</div><div class="o2o-legend"><span><i style="background:var(--ok)"></i>Di atas rata-rata Region II</span><span><i style="background:var(--bd)"></i>Di bawah rata-rata Region II</span><span><u style="background:var(--wr)"></u>Region II ${pct(reg)}</span><span><u style="background:var(--tx)"></u>Bankwide ${pct(bw)}</span></div><p class="o2o-note">Ketuk area untuk membuka infografisnya.</p></section>`;
}

/* ===== Shifting Digital level Area =====
   Rumus sama dengan kartu Shifting Digital di tab Cabang: (O2O + CSM) ÷ (O2O + NBDS + CSM + OBDS).
   Angka area/Region = jumlah data cabang (D.M, per D.mdate), bukan rata-rata persentase cabang.
   Catatan: hasil penjumlahan O2O dan NBDS cabang sama persis dengan sheet "Area Okt". */
const SD_PART=[['O2O',0,'sh-o2o'],['CSM',2,'sh-csm'],['NBDS',1,'sh-nbds'],['OBDS',3,'sh-obds']]; // [label, indeks D.M, kelas warna]
// s = [O2O, NBDS ganti kartu, CSM, OBDS]; NBDS memakai D.M[10] (kanal ganti kartu) bila ada, selain itu D.M[1]
const sdSum=idx=>{const s=[0,0,0,0];idx.forEach(i=>{const m=D.M[i];if(!m)return;s[0]+=Number(m[0])||0;s[1]+=Number(m[10]??m[1])||0;s[2]+=Number(m[2])||0;s[3]+=Number(m[3])||0;});return s;};
const sdTot=s=>s[0]+s[1]+s[2]+s[3];
const sdPct=s=>sdTot(s)?(s[0]+s[2])/sdTot(s):null;
const sdTgl=new Date(D.mdate+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
const SD_LIM=5;
function sdAreas(){
  return [...new Set(D.B.map(b=>b[2]))].map(a=>{
    const idx=D.B.map((b,i)=>i).filter(i=>D.B[i][2]===a),s=sdSum(idx);
    return{a,idx,s,p:sdPct(s)};
  }).filter(r=>r.p!=null).sort((x,y)=>y.p-x.p);
}
function shifting(e,isRegion){
  const list=sdAreas();
  const regS=sdSum(D.B.map((b,i)=>i)),reg=sdPct(regS);
  const me=isRegion?null:list.find(r=>norm(r.a)===norm(e.name));
  if(!isRegion&&!me)return '';
  const s=isRegion?regS:me.s,p=isRegion?reg:me.p,tot=sdTot(s);
  const nama=isRegion?'Region II':shortName(e.name);
  const chips=isRegion
    ?`<span class="chip n">${list.length} area · ${num(D.B.length)} cabang</span>`
    :gapChip(p-reg,'Region II')+`<span class="chip n">Peringkat #${list.indexOf(me)+1} dari ${list.length} area</span>`;
  const bar=SD_PART.map(([,k,c])=>s[k]?`<i class="${c}" style="flex:${s[k]}"></i>`:'').join('');
  const leg=SD_PART.map(([n,k,c])=>`<div class="sh-it"><i class="${c}"></i><span>${n}</span><b>${num(s[k])}</b><small>${pct(tot?s[k]/tot:null)} dari total</small></div>`).join('');
  const csmNol=tot&&!s[2]?`<p class="o2o-note sd-warn">⚠ CSM ${isRegion?'Region II':'area ini'} bernilai 0 di seluruh cabang pada data sumber, sehingga Shifting Digital hanya berasal dari O2O. Mohon cek ulang data CSM.</p>`:'';
  // ranking 7 area
  const rows=list.map((r,i)=>{
    const m=r===me;
    return `<button type="button" class="o2o-rank-row ${m?'me':''} ${r.p>=reg?'ok-row':'bd-row'}" data-o2o-area="${clean(r.a)}" aria-label="Buka ${clean(shortName(r.a))}"><span class="o2o-rank-no">${i+1}</span><span><span class="o2o-rank-nm">${clean(shortName(r.a))}<small>${num(r.s[0]+r.s[2])} / ${num(sdTot(r.s))} trx</small></span><span class="o2o-rank-bar"><i style="width:${r.p*100}%"></i><u class="reg" style="left:${reg*100}%"></u></span></span><span class="o2o-rank-v">${pct(r.p)}</span></button>`;
  }).join('');
  // cabang terendah di area (atau Region II); nilai sama -> volume transaksi lebih besar ditampilkan dulu
  const cab=(isRegion?D.B.map((b,i)=>i):me.idx).map(i=>{const x=sdSum([i]);return{i,s:x,p:sdPct(x)};})
    .filter(r=>r.p!=null).sort((x,y)=>x.p-y.p||sdTot(y.s)-sdTot(x.s));
  const tampilCab=ui.sdAll?cab:cab.slice(0,SD_LIM);
  const cabRows=tampilCab.map((r,j)=>{const b=D.B[r.i];return `<button type="button" class="o2o-rank-row ${r.p>=reg?'ok-row':'bd-row'}" data-sd-code="${clean(b[0])}" aria-label="Buka ${clean(b[1])}"><span class="o2o-rank-no">${j+1}</span><span><span class="o2o-rank-nm">${clean(b[1])}<small class="sd-sub">${isRegion?clean(b[2])+' · ':''}O2O ${num(r.s[0])} · CSM ${num(r.s[2])} · NBDS ${num(r.s[1])} · OBDS ${num(r.s[3])}</small></span><span class="o2o-rank-bar"><i style="width:${r.p*100}%"></i><u class="reg" style="left:${reg*100}%"></u></span></span><span class="o2o-rank-v">${pct(r.p)}</span></button>`;}).join('');
  const more=cab.length>SD_LIM?`<button type="button" class="sd-more" data-sd-all="1">${ui.sdAll?`Tampilkan ${SD_LIM} terendah`:`Tampilkan semua cabang (${cab.length})`}</button>`:'';
  return `<section class="cd sd-card"><h2>Shifting Digital · ${clean(nama)} · ${sdTgl}</h2>
    <div class="sh-atas"><div class="sh-n">${pct(p)}</div><div class="sh-t">${tot?`<b>${num(s[0]+s[2])}</b> dari <b>${num(tot)}</b> transaksi lewat O2O dan CSM`:'Belum ada data transaksi'}</div></div>
    <div class="o2o-chips sd-chips">${chips}</div>
    ${tot?`<div class="sh-bar">${bar}</div><div class="sh-grid">${leg}</div>`:''}${csmNol}
    <p class="o2o-note">Rumus: (O2O + CSM) ÷ (O2O + NBDS + CSM + OBDS); NBDS = seluruh transaksi ganti kartu lewat New BDS. Angka ${isRegion?'Region II':'area'} = jumlah seluruh cabang, bukan rata-rata persentase.</p>
    <h3 class="sd-h">Ranking Area · Shifting Digital</h3><div>${rows}</div>
    <div class="o2o-legend"><span><i style="background:var(--ok)"></i>≥ Region II</span><span><i style="background:var(--bd)"></i>&lt; Region II</span><span><u style="background:var(--wr)"></u>Region II ${pct(reg)}</span></div>
    <h3 class="sd-h">Cabang Shifting Digital Terendah · ${clean(nama)}</h3><div>${cabRows}</div>${more}
    <p class="o2o-note">Ketuk area untuk membuka infografisnya; ketuk cabang untuk membuka dashboard cabang.</p></section>`;
}

function page(){
  const {e,isRegion}=current();
  if(!e)return `<section class="cd"><p class="o2o-empty">Data O2O untuk <b>${clean(st.a)}</b> tidak ditemukan pada sheet Area Okt.</p></section>`;
  return `${hero(e,isRegion)}${shifting(e,isRegion)}${segments(e,isRegion)}${ranking(e,isRegion)}<section class="cd"><p class="o2o-note" style="margin:0">Sumber: ${clean(src.sumber)} · data per ${tgl}. Keterangan "Above/Below Avg" membandingkan persentase ${isRegion?'Region II terhadap rata-rata Bankwide':'area terhadap rata-rata Region II'}. Selisih ditulis dalam poin persentase (pp).</p></section>`;
}

const previous=render;
render=function(){
  previous();
  if(tampil!=='area')return;
  const app=document.getElementById('app');
  if(!app)return;
  const v=views.find(x=>x.key===ui.sub);
  if(v)app.innerHTML=subNav()+v.html();
  else app.insertAdjacentHTML('afterbegin',subNav());
};

document.getElementById('app').addEventListener('click',e=>{
  const s=e.target.closest('[data-o2o-sub]');
  if(s){ui.sub=s.dataset.o2oSub;render();return;}
  const r=e.target.closest('[data-o2o-rank]');
  if(r){ui.rank=r.dataset.o2oRank;render();return;}
  if(e.target.closest('[data-sd-all]')){ui.sdAll=!ui.sdAll;render();return;}
  const c=e.target.closest('[data-sd-code]');
  if(c){
    const i=D.B.findIndex(b=>String(b[0])===c.dataset.sdCode);
    if(i>=0){st.b=i;st.a=D.B[i][2];tampil='cabang';fill();render();window.scrollTo(0,0);}
    return;
  }
  const a=e.target.closest('[data-o2o-area]');
  if(a){
    const hit=D.B.find(b=>norm(b[2])===norm(a.dataset.o2oArea));
    if(hit){st.a=hit[2];fill();render();window.scrollTo({top:0,behavior:'smooth'});}
  }
});

render();
})();
