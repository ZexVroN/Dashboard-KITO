/* Halaman KPI (navigasi "KPI"): infografis skor KPI September 2026 per jabatan.
   Data: assets/js/kpi-data.js (dibuat oleh tools/build_kpi.py dari file Excel KPI). Add-on non-destruktif: membungkus render(). */
(()=>{'use strict';
const K=window.KITO_KPI;
if(!K||typeof D==='undefined'||typeof render!=='function')return;
const app=document.getElementById('app');if(!app)return;
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f2=n=>n==null?'–':Number(n).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});
const f1=n=>n==null?'–':Number(n).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1});
const pc=n=>n==null?'–':(n*100).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const JAB=K.jabatan,PER=[['c','Customer','#2563eb'],['i','Internal Process','#0e9f8e'],['f','Financial','#e8a700'],['d','Development & Growth','#7c4dff']];
const REGIONAL=new Set(['ROH','TOH','SQOR']);
const ak=x=>String(x).toUpperCase().replace(/^AREA\s+/,'').replace(/\s+/g,'');   // kunci nama area (tanpa spasi)
const AREAS2=new Set(D.B.map(b=>ak(b[2])));   // area Region II dari data cabang
const isR2=(j,u)=>REGIONAL.has(j.key)?u.n===K.fokus:AREAS2.has(ak(u.n));
const titel=s=>s.replace(/^(REGION|AREA)\s+/,m=>m).replace(/\s*\/\s*/g,' · ').toLowerCase().replace(/(^|[\s·])([a-z])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii)\b/g,x=>x.toUpperCase());

const ui={j:'ROH',unit:null};
const jab=()=>JAB.find(j=>j.key===ui.j);
const key=u=>u.k||u.n;   // identitas unit: kode area (dari Data ASM / Data SQO) bila ada
const kodeTxt=u=>u.k?` · Kode ${u.k}`:'';
const unitAktif=j=>j.unit.find(u=>key(u)===ui.unit)||j.unit.find(u=>isR2(j,u))||j.unit[0];

/* bobot (poin maksimum 100%) tiap perspektif untuk jabatan j: dari rincian KPI regional atau butir KPI area */
function bobot(j){
  const out={c:0,i:0,f:0,d:0};let cur=null;
  const idx=name=>{const pp=PER.find(p=>name.toLowerCase().startsWith(p[1].toLowerCase().slice(0,5)));return pp&&pp[0];};
  const rows=REGIONAL.has(j.key)?K.detail[j.key]:(K.areaDetail[j.key]||{}).items;
  if(!rows)return null;
  rows.forEach(x=>{if(x.p)cur=idx(x.p);else if(cur&&x.w!=null)out[cur]+=x.w*100;});
  return out;
}
/* hero: infografis per kategori (perspektif) untuk unit terpilih */
const WARNA_HERO={c:'#6db0ff',i:'#3fe0c8',f:'#ffd54a',d:'#c3aeff'};
function gauge(p,val,bw){
  const r=34,C=2*Math.PI*r,rasio=bw?val/bw:0,fill=Math.min(rasio/1.3,1)*C,tick=100/130*2*Math.PI;
  const tx=40+r*Math.sin(tick),ty=40-r*Math.cos(tick);
  return `<div class="kp-g"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" class="kp-gb"/><circle cx="40" cy="40" r="${r}" class="kp-gf" style="stroke:${WARNA_HERO[p[0]]}" stroke-dasharray="${fill} ${C}" transform="rotate(-90 40 40)"/><circle cx="${tx}" cy="${ty}" r="2.6" class="kp-gt"/><text x="40" y="45" text-anchor="middle">${f2(val)}</text></svg><b>${clean(p[1])}</b><small>${bw?`${pc(rasio)} dari bobot ${f1(bw)}`:''}</small></div>`;
}
function hero(j,u){
  const bw=bobot(j)||{};
  return `<section class="kp-hero"><div class="kp-h1"><span>📊 KPI ${clean(K.periode)} · ${clean(j.nama)}</span><h2>${clean(titel(u.n))}${u.k?` <small>Kode ${clean(u.k)}</small>`:''}</h2><p>Poin KPI per kategori perspektif. Titik di cincin = 100% bobot kategori.</p></div><div class="kp-gs">${PER.map(p=>gauge(p,u[p[0]],bw[p[0]])).join('')}</div></section>`;
}
function tabs(){
  return `<div class="kp-tabs" role="tablist">${JAB.map(j=>`<button type="button" role="tab" class="${j.key===ui.j?'on':''}" data-kp-j="${j.key}">${clean(j.key==='SQOR'?'SQO Region':j.key==='SQOA'?'SQO Area':j.key)}</button>`).join('')}</div><p class="kp-jn">${clean(jab().nama)}</p>`;
}
function komposisi(j,u){
  const bw=bobot(j),tot=PER.reduce((a,p)=>a+u[p[0]],0);
  const seg=PER.map(p=>`<i style="width:${u[p[0]]/tot*100}%;background:${p[2]}" title="${p[1]}: ${f2(u[p[0]])}"></i>`).join('');
  const leg=PER.map(p=>`<div><i style="background:${p[2]}"></i><span>${p[1]}</span><b>${f2(u[p[0]])}</b>${bw&&bw[p[0]]?`<small>dari bobot ${f1(bw[p[0]])}</small>`:''}</div>`).join('');
  const r2=j.unit.filter(x=>isR2(j,x));const rr=r2.indexOf(u)+1;
  return `<section class="cd kp-comp"><h3>Komposisi skor · ${clean(titel(u.n))}${kodeTxt(u)}</h3><div class="kp-sc"><b>${f2(u.s)}</b><span>Peringkat <b>#${u.rk}</b> dari ${j.unit.length}${!REGIONAL.has(j.key)&&rr?` · <b>#${rr}</b> dari ${r2.length} di Region II`:''}</span></div><div class="kp-st">${seg}</div><div class="kp-lg">${leg}</div></section>`;
}
function papan(j){
  const max=Math.max(...j.unit.map(u=>u.s));
  const reg=REGIONAL.has(j.key);
  // ROH/TOH/SQO Region: semua region. ASM & SQO Area: hanya area Region II (nomor tetap = peringkat bankwide).
  const rows=j.unit.filter(u=>reg||isR2(j,u)).sort((a,b)=>a.rk-b.rk);
  const list=rows.map(u=>{const on=isR2(j,u),sel=!reg&&key(u)===key(unitAktif(j));
    const seg=PER.map(p=>`<i style="width:${u[p[0]]/max*100}%;background:${p[2]}"></i>`).join('');
    const tg=reg?'div':'button',at=reg?'':` type="button" data-kp-u="${clean(key(u))}"`;
    return `<${tg}${at} class="kp-r ${on?'r2':''} ${sel?'sel':''} ${reg?'kp-static':''}"><em>${u.rk}</em><span class="kp-n">${clean(titel(u.n))}${u.k?`<small>${clean(u.k)}</small>`:''}</span><span class="kp-bar">${seg}</span><b>${f2(u.s)}</b></${tg}>`;}).join('');
  const ket=reg?'Baris biru = Region II.':`Nomor = peringkat dari ${j.unit.length} area bankwide. Ketuk baris untuk melihat komposisi dan rincian KPI-nya.`;
  return `<section class="cd kp-board"><h3>Peringkat ${clean(j.nama)}${reg?'':' · Region II'}</h3><div class="kp-rl">${list||'<p class="kp-no">Tidak ada data.</p>'}</div><p class="kp-note">Garis berwarna = kontribusi tiap perspektif. ${ket}</p></section>`;
}
/* ---- rincian KPI Region II ---- */
const pendek=n=>{const m=String(n).match(/^Pencapaian Target bisnis (In-Branch)\b[^(]*\((.+)\)/i);return m?m[1]+' · '+m[2]:pendek0(n);};
const pendek0=n=>String(n).replace(/\s*\n.*/s,'').split(/ dari | menjadi | naik | min | maks|\(/)[0].replace(/\s*[:\-–]\s*$/,'').trim()||n;
function fmtV(it,v){
  if(v==null)return '–';
  if(/^waktu/i.test(it.n))return f2(v)+' mnt';
  if(it.r<=1.5&&it.t<=1.5)return pc(v);
  return f2(v);
}
/* baris rincian untuk jabatan area (ASM, SQO Area): hitung nilai dari realisasi/target/% di kunci nama area */
function barisArea(j,u){
  const AD=K.areaDetail&&K.areaDetail[j.key],v=AD&&AD.vals[u.k];if(!v)return null;
  const rows=[];let k=0;
  AD.items.forEach(m=>{
    if(m.p){rows.push({p:m.p,tot:0});return;}
    const [r,t,a0]=v[k++],a=a0==null?0:a0;let n=a>m.th?1.3*m.w*100:a*m.w*100;if(m.fl&&n<0)n=0;
    rows.push({g:m.g,n:m.n,w:m.w,r,t,a,v:n,kosong:a0==null});
  });
  let cur=null;rows.forEach(x=>{if(x.p)cur=x;else if(cur)cur.tot+=x.v;});
  return rows;
}
function rincian(j,u){
  const reg=REGIONAL.has(j.key);
  const d=reg?K.detail[j.key]:barisArea(j,u);
  if(!d)return `<section class="cd"><h3>Rincian KPI</h3><p class="kp-note">Rincian KPI belum tersedia untuk unit ini.</p></section>`;
  const judul=reg?K.fokus:u.n;
  const total=d.filter(x=>x.p).reduce((a,x)=>a+x.tot,0);
  const mini=d.filter(x=>x.p).map(x=>{const pp=PER.find(p=>x.p.toLowerCase().startsWith(p[1].toLowerCase().slice(0,5)))||PER[0];return `<span style="--pc:${pp[2]}"><i></i>${clean(pp[1].split(' ')[0])} <b>${f2(x.tot)}</b></span>`;}).join('');
  const totBox=(cls)=>`<div class="kp-tot ${cls||''}"><span>Total Skor KPI</span><b>${f2(total)}</b><div class="kp-mini">${mini}</div></div>`;
  const dup=!reg&&K.areaDetail[j.key].dupes[u.n];
  const beda=!reg&&Math.abs(total-u.s)>0.5?`<p class="kp-warn">⚠ Skor di rekap Excel (${f2(u.s)}) berbeda dari jumlah rincian kode ${clean(u.k)} (${f2(total)})${dup?`: nama area ini dipakai oleh ${dup.length} kode (${dup.map(clean).join(', ')}) di sheet Data ${j.key==='ASM'?'ASM':'SQO'}`:''}.</p>`:'';
  let h='',grp=null;
  d.forEach(x=>{
    if(x.p){const pp=PER.find(p=>x.p.toLowerCase().startsWith(p[1].toLowerCase().slice(0,5)))||PER[0];grp=null;h+=`<div class="kp-ph" style="--pc:${pp[2]}"><span>${clean(x.p)}</span><b>${f2(x.tot)}</b></div>`;return;}
    if(x.g!==grp){grp=x.g;h+=`<div class="kp-gh">${clean(grp||'')}</div>`;}
    const a=x.a,w=Math.min(a/1.3,1)*100,k=a>=1?'kp-ok':a>=0.9?'kp-md':'kp-bd';
    h+=`<div class="kp-it ${k}" title="${clean(x.n)}"><div class="kp-t"><span>${clean(pendek(x.n))}</span><em>${f1(x.w*100)}%</em></div><div class="kp-m"><i style="width:${w}%"></i><u style="left:${100/1.3}%"></u></div><div class="kp-v"><span>${x.kosong?'Data belum tersedia':`Real ${fmtV(x,x.r)} · Target ${fmtV(x,x.t)}`}</span><b>${x.kosong?'–':pc(a)}</b><small>nilai ${f2(x.v)}</small></div></div>`;
  });
  return `<section class="cd kp-det" id="kp-det"><h3>Rincian KPI ${clean(titel(judul))}${reg?'':kodeTxt(u)}</h3>${totBox()}${beda}<div class="kp-leg"><span><i class="kp-ok"></i>≥ 100%</span><span><i class="kp-md"></i>90–99%</span><span><i class="kp-bd"></i>&lt; 90%</span><span class="kp-ln">│ garis = 100%</span></div>${h}${totBox('kp-bt')}<p class="kp-note">% = pencapaian terhadap target (maks. 130%). Nilai = kontribusi ke skor KPI sesuai bobot.${reg?'':' Ketuk area lain di papan peringkat untuk mengganti rincian.'}</p></section>`;
}
const page=()=>{const j=jab(),u=unitAktif(j);return tabs()+hero(j,u)+komposisi(j,u)+papan(j)+rincian(j,u);};

/* ---- bungkus render() ---- */
const sebelumnya=render;
render=function(){
  const tetap=tampil==='kpi'&&!!app.querySelector('.kp-hero'),y=tetap?window.scrollY:null;
  sebelumnya();
  document.body.classList.toggle('mode-kpi',tampil==='kpi');
  if(tampil!=='kpi')return;
  app.innerHTML=page();
  if(y!=null&&Math.abs(window.scrollY-y)>1)window.scrollTo({top:y,behavior:'instant'});
};
app.addEventListener('click',e=>{
  if(tampil!=='kpi')return;const a=s=>e.target.closest('[data-kp-'+s+']');let x;
  if((x=a('j'))){if(ui.j!==x.dataset.kpJ){ui.j=x.dataset.kpJ;ui.unit=null;}render();return;}
  if((x=a('u'))&&!REGIONAL.has(ui.j)){ui.unit=x.dataset.kpU;render();document.querySelector(REGIONAL.has(ui.j)?'.kp-comp':'#kp-det')?.scrollIntoView({behavior:'smooth',block:'start'});}
});
if(tampil==='kpi')render();
})();
