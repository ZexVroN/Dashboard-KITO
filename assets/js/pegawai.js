/* Add-on pegawai: tidak mengubah script.js atau fitur existing. */
(()=>{'use strict';
const data=window.KITO_PEGAWAI_DATA;
if(!data||typeof URUTAN==='undefined'||typeof D==='undefined')return;
const map=new Map();
for(const r of data.rows){const k=String(r.kode).replace(/\D/g,'');if(!map.has(k))map.set(k,[]);map.get(k).push(r)}
const fields=[['cif','New CIF'],['etb','Akuisisi ETB'],['pebisnis','Rek Pebisnis'],['individu','Rek Individu'],['prioritas','Rek Prioritas'],['payroll','Rek Payroll']];
const fmt=n=>n==null?'–':Math.ceil(Number(n)).toLocaleString('id-ID',{maximumFractionDigits:0});
const pct=(a,t)=>t>0&&a!=null?Math.ceil(a/t*100)+'%':'–';
const cls=(a,t)=>t==null||t<=0||a==null?'netral':a>=t?'tercapai':a/t>=.8?'mendekati':'kurang';
function kartuPegawai(){
 const b=D.B[st.b];if(!b)return '';
 const key=String(b[0]??'').replace(/\D/g,'');const list=map.get(key)||[];
 const buttons=fields.map(([k,n],i)=>`<button type="button" class="pg-tab ${i===0?'on':''}" data-pg-m="${k}">${n}</button>`).join('');
 return `<section class="cd pg-card" id="pegawai-cabang"><h2>Informasi Pegawai & Akuisisi · 23 Oktober 2026</h2><p class="pg-desc">Mapping pegawai untuk <b>${esc(b[1])}</b> · Kode ${esc(key)} · ${list.length} pegawai</p>${list.length?`<div class="pg-tabs" role="group" aria-label="Jenis akuisisi">${buttons}</div><div class="pg-summary" id="pg-summary"></div><div class="tw"><table class="pg-table"><thead><tr><th>Pegawai / Jabatan</th><th class="ang">Akuisisi</th><th class="ang">Target</th><th class="ang">Gap</th><th class="ang">Ach.</th></tr></thead><tbody id="pg-rows"></tbody></table></div><p class="pg-desc">Warna: hijau ≥100% target, kuning 80–&lt;100%, merah &lt;80%. Target 0 ditampilkan netral. Gap sesuai sheet pegawai.</p>`:'<p class="pg-desc">Tidak ada mapping pegawai pada sheet pegawai untuk kode cabang ini.</p>'}</section>`;
}
URUTAN.splice(URUTAN.indexOf(kartuDetailAntrian),0,kartuPegawai);
const originalRender=render;
render=function(){originalRender();showPegawai('cif')};
function showPegawai(metric){
 const tbody=document.getElementById('pg-rows');if(!tbody)return;
 const b=D.B[st.b],list=map.get(String(b[0]??'').replace(/\D/g,''))||[];
 const m=fields.find(x=>x[0]===metric)||fields[0];
 let sa=0,stg=0,sg=0;
 tbody.innerHTML=list.map(r=>{
  const [a,t,g]=r.metrics[m[0]]||[];
  if(a!=null)sa+=a;if(t!=null)stg+=t;if(g!=null)sg+=g;
  const status=cls(a,t);
  return `<tr><td><b>${esc(r.nama)}</b><small class="pg-job">${esc(r.jabatan||'–')}</small></td><td class="ang">${fmt(a)}</td><td class="ang">${fmt(t)}</td><td class="ang pg-gap ${g==null?'':g<0?'neg':g>0?'pos':''}">${fmt(g)}</td><td class="ang"><span class="pg-chip ${status}">${pct(a,t)}</span></td></tr>`;
 }).join('');
 const sum=document.getElementById('pg-summary');
 sum.innerHTML=`<div><small>Total Akuisisi</small><strong>${fmt(sa)}</strong></div><div><small>Total Target</small><strong>${fmt(stg)}</strong></div><div><small>Total Gap</small><strong class="${sg<0?'neg':sg>0?'pos':''}">${fmt(sg)}</strong></div><div><small>Achievement</small><strong class="pg-chip ${cls(sa,stg)}">${pct(sa,stg)}</strong></div>`;
 document.querySelectorAll('.pg-tab').forEach(x=>x.classList.toggle('on',x.dataset.pgM===m[0]));
}
document.getElementById('app').addEventListener('click',e=>{const btn=e.target.closest('[data-pg-m]');if(btn)showPegawai(btn.dataset.pgM)});
render();
})();
