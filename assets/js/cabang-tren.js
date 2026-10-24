/* Tren Waktu Antrian (tab Cabang): tampilan disamakan dengan Tren Harian P90 pada dashboard Area.
   - tombol kategori: Gabungan | Teller | CS | Semua TRX
   - per kategori: angka waktu di tiap titik, grafik bisa digeser
   - Gabungan: ketuk tanggal untuk melihat waktu Teller, CS, Semua TRX
   Memakai gaya .wt-* dari area-waktu.css dan menggantikan kartuTren di URUTAN. */
(()=>{'use strict';
if(typeof URUTAN==='undefined'||typeof kartuTren!=='function'||typeof D==='undefined'||typeof st==='undefined')return;
const ui={mode:'gab',tip:null};
const COL=['var(--c1)','var(--c2)','var(--c3)'];
const NAME=['Teller','Customer Service','Semua TRX'];
const TABS=[['gab','Gabungan'],[0,'Teller'],[1,'CS'],[2,'Semua TRX']];
const clk=s=>s==null?'–':f(s);
const kls=s=>mp(s)[1];                                  // ok | mid | warn | bad | n
const norm=s=>String(s||'').toLowerCase().replace(/^area\s+/,'').replace(/[^a-z0-9]/g,'');
const long=iso=>dlong(iso);

// pembanding: P90 All Trx area dari data dashboard Area (jika tersedia)
function areaSeries(){
  const w=window.KITO_AREA_WAKTU;if(!w)return null;
  const a=w.areas.find(x=>norm(x.name)===norm(D.B[st.b][2]));if(!a)return null;
  return D.dates.map(d=>a.d[d]?a.d[d][6]:null);
}
const series=k=>D.Q[st.b].map(x=>x?.[k]??null);

function tipHtml(i){
  const iso=D.dates[i],q=D.Q[st.b][i];
  if(!q||q.every(v=>v==null))return `<b>${long(iso)}</b><span class="wt-dl mu">Tidak ada data</span>`;
  const it=k=>`<span><i style="background:${COL[k]}"></i>${k===1?'CS':NAME[k]}<b class="${kls(q[k])}">${clk(q[k])}</b></span>`;
  const ar=areaSeries(),av=ar?ar[i]:null;
  return `<b>${long(iso)}</b><div class="wt-tip-g">${[0,1,2].map(it).join('')}${av!=null?`<span><u class="dash"></u>All Trx Area<b>${clk(av)}</b></span>`:''}</div>`;
}

function kartuTrenBaru(){
  const dates=D.dates,n=dates.length,mode=ui.mode,single=mode!=='gab';
  const keys=single?[mode]:[0,1,2];
  const L=38,R=14,T=22,Bt=28,H=210,PAD=single?16:0,GAP=36;
  const W0=lebarGrafik(),W=single?Math.max(W0,L+R+2*PAD+(n-1)*GAP):W0;
  const sp=(W-L-R-2*PAD)/Math.max(n-1,1),X=i=>L+PAD+i*sp;
  const ar=areaSeries();
  const vals=[];keys.forEach(k=>series(k).forEach(v=>v!=null&&vals.push(v)));
  if(ar&&(!single||mode===2))ar.forEach(v=>v!=null&&vals.push(v));
  const mx=Math.max(300,...vals),stp=mx<=600?120:300,top=Math.ceil(mx*1.05/stp)*stp;
  const Y=v=>T+(H-T-Bt)*(1-v/top);
  let g='';
  for(let v=0;v<=top;v+=stp)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--ln)"/><text x="${L-4}" y="${Y(v)+3}" font-size="9" text-anchor="end" fill="var(--mu)">${f(v)}</text>`;
  g+=`<line x1="${L}" x2="${W-R}" y1="${Y(300)}" y2="${Y(300)}" stroke="var(--bd)" stroke-dasharray="4 3" opacity=".7"/><text x="${W-R}" y="${Y(300)-4}" font-size="8" text-anchor="end" fill="var(--bd)">5 menit</text>`;
  const tipIdx=ui.tip!=null?ui.tip:st.d;
  const step=single?1:Math.max(1,Math.ceil(30/Math.max(sp,1)));
  dates.forEach((d,i)=>{const on=single?i===st.d:i===tipIdx;if((n-1-i)%step===0||on)g+=`<text ${single?'':`data-ct-dl="${i}"`} x="${X(i)}" y="${H-9}" font-size="9" text-anchor="middle" fill="${on?'var(--tx)':'var(--mu)'}" font-weight="${on?700:400}">${dl(d)}</text>`;});
  const line=(arr,color,dash,w,label)=>{
    const p=arr.map((v,i)=>v==null?null:[X(i),Y(v),v]).filter(Boolean);if(!p.length)return '';
    let o=`<polyline fill="none" stroke="${color}" stroke-width="${w}" ${dash?'stroke-dasharray="5 4"':''} stroke-linejoin="round" points="${p.map(q=>q[0]+','+q[1]).join(' ')}"/>`;
    if(!dash)o+=p.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="${label?3.4:2.6}" fill="${color}"/>`).join('');
    if(label)o+=p.map(q=>{const up=q[1]>T+10;return `<text x="${q[0]}" y="${up?q[1]-8:q[1]+15}" font-size="9" font-weight="700" text-anchor="middle" fill="var(--tx)" stroke="var(--cd)" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${f(q[2])}</text>`;}).join('');
    return o;
  };
  const showAr=ar&&(!single||mode===2);
  if(showAr)g+=line(ar,'var(--mu)',true,1.6,false);
  keys.forEach(k=>{g+=line(series(k),COL[k],false,2.3,single);});
  let hit='',tip='';
  if(single){g+=`<line x1="${X(st.d)}" x2="${X(st.d)}" y1="${T}" y2="${H-Bt}" stroke="var(--mu)" stroke-dasharray="3 3"/>`;}
  else{
    g+=`<line id="ct-cur" x1="${X(tipIdx)}" x2="${X(tipIdx)}" y1="${T}" y2="${H-Bt}" stroke="var(--tx)" stroke-dasharray="3 3"/>`;
    const hw=Math.max(sp,24);
    hit=dates.map((d,i)=>`<rect data-ct-tp="${i}" data-cx="${X(i)}" x="${X(i)-hw/2}" y="${T}" width="${hw}" height="${H-T-Bt}" fill="transparent" style="cursor:pointer"/>`).join('');
    tip=`<div id="ct-tip" class="wt-tip" aria-live="polite">${tipHtml(tipIdx)}</div>`;
  }
  const lg=keys.map(k=>`<span><i style="background:${COL[k]}"></i>${NAME[k]}</span>`).join('')+(showAr?'<span><u class="dash"></u>All Trx Area</span>':'');
  const svg=single
    ?`<div class="wt-trend-sc"><svg width="${W}" height="${H}" style="width:${W}px;max-width:none;height:${H}px" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren ${NAME[mode]}">${g}</svg></div>`
    :`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren waktu antrian">${g}${hit}</svg>`;
  const tabs=`<div class="seg" role="group" aria-label="Kategori tren">${TABS.map(([k,t])=>`<button type="button" data-ct-mode="${k}" class="${k===mode?'on':''}">${t}</button>`).join('')}</div>`;
  const note=single?'Angka di atas titik = waktu antrian (mm:ss). Geser grafik ke samping untuk tanggal lainnya; garis putus-putus vertikal = tanggal terpilih.'
    :'Ketuk grafik pada sebuah tanggal untuk melihat waktu Teller, CS, dan Semua TRX.';
  if(single)setTimeout(()=>{const sc=document.querySelector('.wt-trend-sc');if(sc)sc.scrollLeft=sc.scrollWidth;},0);
  return `<div class="cd"><h2>Tren Waktu Antrian</h2>${tabs}${svg}${tip}<div class="wt-legend">${lg}</div><p class="wt-note">${note}</p></div>`;
}

URUTAN[URUTAN.indexOf(kartuTren)]=kartuTrenBaru;

document.getElementById('app').addEventListener('click',e=>{
  const m=e.target.closest('[data-ct-mode]');
  if(m){const v=m.dataset.ctMode;ui.mode=v==='gab'?'gab':+v;render();return;}
  const t=e.target.closest('[data-ct-tp]');
  if(t){ui.tip=+t.dataset.ctTp;
    const cur=document.getElementById('ct-cur'),box=document.getElementById('ct-tip');
    if(cur){cur.setAttribute('x1',t.dataset.cx);cur.setAttribute('x2',t.dataset.cx);}
    document.querySelectorAll('[data-ct-dl]').forEach(x=>{const on=+x.dataset.ctDl===ui.tip;x.setAttribute('font-weight',on?700:400);x.setAttribute('fill',on?'var(--tx)':'var(--mu)');});
    if(box)box.innerHTML=tipHtml(ui.tip);
  }
});
render();
})();
