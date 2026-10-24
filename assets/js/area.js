/* Dashboard Area KITO: tambahan non-destruktif pada navigasi Area. */
(()=>{'use strict';
if(typeof D==='undefined'||typeof render!=='function')return;
const app=document.getElementById('app');
const number=n=>Number(n||0).toLocaleString('id-ID');
const percent=(a,b)=>b>0?(100*a/b).toLocaleString('id-ID',{maximumFractionDigits:1})+'%':'–';
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const time=x=>x==null?'–':f(x);
const label=(s)=>esc(s||'–');
const safeMetric=(i,k)=>D.Q[i]&&D.Q[i][st.d]?D.Q[i][st.d][k]:null;
const branchRows=()=>D.B.map((b,i)=>({b,i})).filter(r=>r.b[2]===st.a);
const box=(name,value,note='')=>`<div class="area-stat"><span>${label(name)}</span><strong>${value}</strong>${note?`<small>${label(note)}</small>`:''}</div>`;
function areaPage(){
 const rows=branchRows(),ids=rows.map(r=>r.i), m=ids.map(i=>D.M[i]||[]);
 const sum=k=>m.reduce((s,r)=>s+(Number(r[k])||0),0);
 const o=sum(0),nb=sum(1),csm=sum(2),ob=sum(3),total=o+nb+csm+ob;
 const util=(a,b)=>percent(sum(a),sum(a)+sum(b));
 const avgs=[0,1,2].map(k=>avg(ids.map(i=>safeMetric(i,k)).filter(v=>v!=null)));
 const waitRows=rows.map(({b,i})=>({b,i,q:[0,1,2].map(k=>safeMetric(i,k)),m:D.M[i]||[]}));
 const sorted=waitRows.slice().sort((a,b)=>(b.q[2]??-1)-(a.q[2]??-1));
 return `<section class="cd hero"><div class="area-eyebrow">DASHBOARD KINERJA AREA · REGION II SUMATERA 2</div><h2>${label(st.a)}</h2><p class="sub">${rows.length} cabang · Waktu Antrian ${dlong(D.dates[st.d])} · O2O/NBDS ${dlong(D.mdate)}</p><p class="sub">Pilih Area dan Tanggal melalui filter di bagian atas.</p></section>
 <section class="cd"><h2>Ringkasan Waktu Antrian</h2><div class="area-stats">${box('Teller',time(avgs[0]),'Rata-rata indikator cabang')}${box('Customer Service',time(avgs[1]),'Rata-rata indikator cabang')}${box('All Trx',time(avgs[2]),'Rata-rata indikator cabang')}${box('Cabang Under 5 Menit',number(waitRows.filter(r=>r.q[2]!=null&&r.q[2]<300).length)+' / '+number(waitRows.filter(r=>r.q[2]!=null).length),'Berdasarkan All Trx')}</div><p class="area-note">Rata-rata waktu antrian dihitung dari nilai cabang yang tersedia, bukan P90 gabungan transaksi Area. P90 Area resmi tidak dapat dihitung hanya dengan merata-ratakan P90 cabang.</p></section>
 <section class="cd"><h2>Utilisasi O2O & Shifting Digital</h2><div class="area-stats">${box('Utilisasi O2O',percent(o,o+nb),'O2O ÷ (O2O + NBDS)')}${box('Livin O2O',number(o),'Transaksi')}${box('New BDS',number(nb),'Transaksi')}${box('Shifting Digital',percent(o+csm,total),'(O2O + CSM) ÷ Total')}</div><div class="area-stats">${box('CSM',number(csm))}${box('Old BDS',number(ob))}${box('Total Transaksi',number(total))}</div></section>
 <section class="cd"><h2>Utilisasi New BDS</h2><div class="area-stats">${box('Teller Perorangan (FP)',util(4,5))}${box('Teller Perusahaan (FNP)',util(6,7))}${box('Customer Service (NF)',util(8,9))}</div><p class="area-note">Persentase dihitung dari penjumlahan numerator dan denominator seluruh cabang Area, bukan rata-rata persentase cabang.</p></section>
 <section class="cd"><h2>Monitoring Cabang · All Trx</h2><p class="sub">Urut waktu antrian tertinggi. Ketuk cabang untuk membuka dashboard detail.</p><div class="tw"><table><thead><tr><th>Cabang</th><th>All Trx</th><th>O2O</th><th>NBDS FP</th><th>Aksi</th></tr></thead><tbody>${sorted.map(r=>{const v=r.q[2],x=r.m,den=(x[0]||0)+(x[1]||0);return `<tr><td><b>${label(r.b[1])}</b><small class="area-code">${label(r.b[0])}</small></td><td class="${mp(v)[1]}"><b>${time(v)}</b></td><td>${percent(x[0]||0,den)}</td><td>${percent(x[4]||0,(x[4]||0)+(x[5]||0))}</td><td><button type="button" class="area-open" data-area-branch="${r.i}">Detail</button></td></tr>`}).join('')}</tbody></table></div></section>`;
}
const previous=render;
render=function(){previous();if(tampil==='area'){app.innerHTML=areaPage();document.body.classList.remove('maint');}};
app.addEventListener('click',e=>{const btn=e.target.closest('[data-area-branch]');if(!btn)return;st.b=Number(btn.dataset.areaBranch);st.a=D.B[st.b][2];tampil='cabang';fill();render();window.scrollTo(0,0)});
render();
})();
