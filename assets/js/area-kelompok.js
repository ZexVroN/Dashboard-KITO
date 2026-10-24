(()=>{'use strict';
const source=window.KITO_AREA_KELOMPOK||[];
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const buckets=[{label:'Under 5 Menit',className:'green'},{label:'5–10 Menit',className:'yellow'},{label:'10–15 Menit',className:'orange'},{label:'Over 15 Menit',className:'red'}];
const state={period:'all',service:'all'};
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const bucket=n=>n==null?-1:n<300?0:n<600?1:n<900?2:3;
const clock=n=>n==null?'–':`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.round(n%60)).padStart(2,'0')}`;
const rowData=()=>source.filter(r=>st.a==="Semua Area Region 2" || norm(r.area)===norm(st.a));
function areaGroups(){
 const all=rowData(), active=state.period,service=state.service;
 const tabs=`<div class="ak-tabs" role="group" aria-label="Periode">${[['all','Semua DtD & MtD'],['dtd','DtD 21 Okt'],['mtd','MTD Oktober']].map(([v,t])=>`<button type="button" data-ak-period="${v}" class="${active===v?'active':''}">${t}</button>`).join('')}</div>`;
 const services=`<div class="ak-tabs" role="group" aria-label="Jenis layanan">${[['all','All Trx'],['teller','Teller'],['cs','Customer Service']].map(([v,t])=>`<button type="button" data-ak-service="${v}" class="${service===v?'active':''}">${t}</button>`).join('')}</div>`;
 const periods=active==='all'?['dtd','mtd']:[active];
 const content=periods.map(p=>{let groups=[[],[],[],[]],missing=[];
  all.forEach(r=>{const n=r[p][service];const b=bucket(n);(b<0?missing:groups[b]).push({...r,n});});
  groups.forEach(g=>g.sort((a,b)=>b.n-a.n));
  return `<section class="cd ak-period"><div class="ak-period-head"><h2>${p==='dtd'?'DtD · 21 Oktober 2026':'MTD · Oktober 2026'}</h2><span>${all.length} cabang ${st.a==="Semua Area Region 2"?"di Region II":"di Area"}</span></div><div class="ak-summary">${buckets.map((b,i)=>`<div class="ak-count ${b.className}"><b>${groups[i].length}</b><span>${b.label}</span></div>`).join('')}</div><div class="ak-grid">${buckets.map((b,i)=>`<section class="ak-group ${b.className}"><h3><span class="ak-dot"></span>${b.label}<small>${groups[i].length} cabang</small></h3><div class="ak-items">${groups[i].length?groups[i].map(r=>`<button type="button" class="ak-branch" data-ak-code="${clean(r.kode)}"><span><b>${clean(r.nama)}</b><small>${clean(r.kode)} · ${clean(r.area)}</small></span><strong>${clock(r.n)}</strong></button>`).join(''):'<p class="ak-empty">Tidak ada cabang dalam kelompok ini.</p>'}</div></section>`).join('')}</div>${missing.length?`<p class="ak-foot">${missing.length} cabang tidak memiliki nilai ${p.toUpperCase()} untuk jenis layanan ini, sehingga tidak dimasukkan ke kelompok.</p>`:''}</section>`;
 }).join('');
 return `<section class="cd ak-heading"><span class="ak-eyebrow">KITO · MONITORING AREA</span><h2>Kelompok Waktu Tunggu Cabang</h2><p><b>${clean(st.a)}</b> · P90 sesuai sheet Oktober 2026 · Klik nama cabang untuk membuka detail.</p><div class="ak-controls">${tabs}${services}</div></section>${content}`;
}
const previous=render;
render=function(){previous();if(tampil==='area'){document.getElementById('app').innerHTML=areaGroups();document.body.classList.remove('maint');}};
document.getElementById('app').addEventListener('click',e=>{
 const p=e.target.closest('[data-ak-period]');if(p){state.period=p.dataset.akPeriod;render();return;}
 const s=e.target.closest('[data-ak-service]');if(s){state.service=s.dataset.akService;render();return;}
 const b=e.target.closest('[data-ak-code]');if(b){const i=D.B.findIndex(r=>String(r[0])===b.dataset.akCode);if(i>=0){st.b=i;st.a=D.B[i][2];tampil='cabang';fill();render();window.scrollTo(0,0);}}
});
render();
})();