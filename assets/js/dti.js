/* Halaman "DTI Dana & Cendup" (view tersendiri: tampil==='dti'), dibuka dari tombol menu di atas halaman Cabang.
   Data: assets/js/dti-data.js (tools/build_dti.py dari "Dashboard dan Data Detail NTB <tgl>.xlsx").
   Isi per cabang terpilih (dropdown Area/Cabang di header):
     1) DTI Score 2026 vs target 98,50
     2) Progres perbaikan data NTB & ETB: Data Error CIF Dana, D01 Slik emas, Cendup Weekly, User SSIM
     3) Detail Data Error CIF Dana (NTB per nasabah, ETB diringkas per jenis error / tahun pembukaan)
     4) Detail Cendup (CIF duplikat) NTB & ETB
     5) User SSIM cabang
   Add-on non-destruktif: membungkus render() + menambah tombol menu di atas halaman Cabang (seperti sales.js). */
(()=>{'use strict';
const T=window.KITO_DTI;
if(!T||typeof URUTAN==='undefined'||typeof D==='undefined'||typeof render!=='function')return;
const app=document.getElementById('app');if(!app)return;

/* ----- utilitas ----- */
const K=i=>T.kamus[i]??'';
const nf=(v,d=0)=>v==null||!Number.isFinite(+v)?'–':(+v).toLocaleString('id-ID',{maximumFractionDigits:d,minimumFractionDigits:d});
const pc=(a,b)=>b>0&&a!=null?a/b:null;
const pct=v=>v==null?'–':(v*100).toLocaleString('id-ID',{maximumFractionDigits:0})+'%';
const tgl=(iso,o={day:'numeric',month:'short',year:'numeric'})=>iso?new Date(iso+'T00:00').toLocaleDateString('id-ID',o):'–';
const titel=s=>String(s||'').toLowerCase().replace(/(^|[\s(/-])([a-z])/g,(m,a,b)=>a+b.toUpperCase());
const kodeCab=()=>String(D.B[st.b]?.[0]??'').replace(/\D/g,'');
const kelasPct=p=>p==null?'n':p>=1?'ok':p>=.7?'md':p>=.4?'wr':'bd';
const statusChip=d=>d?'<span class="dt-st ok">Selesai</span>':'<span class="dt-st bd">Belum</span>';

/* ----- state ----- */
const ui={dana:'ntb',danaF:'0',cd:'ntb',cdF:'0',semuaNtb:false,semuaCd:false};
let kodeSebelum=null;
const LIM=30;   // baris awal tabel detail; sisanya lewat tombol "Tampilkan semua"

/* ===== 1. DTI Score ===== */
function kartuSkor(c){
  const [etb,skor,okt,sep]=c.dti,tgt=T.targetDti,g=skor!=null&&okt!=null?skor-okt:null;
  const A=T.area[c.a]||{},R=T.area['REGION II']||{};
  const atas=skor!=null&&skor>=tgt;
  const pos=v=>v==null?0:Math.max(0,Math.min(100,(v-90)/10*100));    // skala 90–100
  const mini=(n,v,ket='')=>`<div class="dt-mini"><small>${n}</small><b>${nf(v,2)}</b>${ket?`<em>${ket}</em>`:''}</div>`;
  return `<section class="cd dt-hero">
    <div class="dt-eyebrow">DTI SCORE 2026 · ${esc(titel(c.a))}</div>
    <h2>${esc(c.n)} <small>Kode ${esc(kodeCab())}${c.kls?` · Kelas ${esc(c.kls)}`:''}</small></h2>
    <div class="dt-skor"><strong>${nf(skor,2)}</strong>
      <span class="dt-tgt ${atas?'ok':'bd'}">${atas?'▲ Di atas':'▼ Di bawah'} target ${nf(tgt,2)}</span>
      ${g!=null?`<span class="dt-g ${g>=0?'ok':'bd'}">${g>=0?'+':''}${nf(g,2)} vs Oktober</span>`:''}</div>
    <div class="dt-skala"><i style="left:${pos(tgt)}%" class="dt-skala-t" title="Target ${nf(tgt,2)}"></i><b style="width:${pos(skor)}%"></b><span>90</span><span>100</span></div>
    <div class="dt-minis">${mini('ETB',etb)}${mini('Oktober',okt)}${mini('September',sep)}${mini('Rata-rata Area',A.dti?.[1])}${mini('Region II',R.dti?.[1])}</div>
    ${c.rk!=null?`<p class="dt-rk">Peringkat progres NTB <b>#${c.rk}</b> di ${esc(titel(c.a))}</p>`:''}
  </section>`;
}

/* ===== 2. Progres perbaikan ===== */
function barProg(nama,p,ref,ket=''){
  const [d,t]=p||[],r=pc(d,t);
  if(!t)return `<div class="dt-pr dt-pr-nol"><div class="dt-pr-t"><b>${nama}</b><span>tidak ada target</span></div></div>`;
  const rr=ref?pc(ref[0],ref[1]):null;
  return `<div class="dt-pr"><div class="dt-pr-t"><b>${nama}</b><span><b>${nf(d)}</b> / ${nf(t)} selesai</span><em class="${kelasPct(r)}">${pct(r)}</em></div>
    <div class="dt-bar"><i class="${kelasPct(r)}" style="width:${Math.min(1,r||0)*100}%"></i>${rr!=null?`<u style="left:${Math.min(1,rr)*100}%" title="Area ${pct(rr)}"></u>`:''}</div>
    <small>${t-d>0?`${nf(t-d)} belum diperbaiki`:'Semua sudah diperbaiki'}${rr!=null?` · Area ${pct(rr)}`:''}${ket}</small></div>`;
}
function kartuProgres(c){
  const A=T.area[c.a]||{};
  const tot=o=>Object.values(o).reduce((s,p)=>[s[0]+(p[0]||0),s[1]+(p[1]||0)],[0,0]);
  const kolom=(judul,sub,isi)=>`<div class="dt-col"><div class="dt-col-h"><b>${judul}</b><small>${sub}</small></div>${isi}</div>`;
  return `<section class="cd"><h2>Progres Perbaikan Data</h2>
    <div class="dt-cols">
      ${kolom('NTB','Nasabah baru · Oktober 2026',barProg('Data Error CIF Dana',c.ntb.err,A.ntb?.err)+barProg('D01 Slik emas Reporting',c.ntb.slik,A.ntb?.slik)+barProg('Cendup Weekly',c.ntb.cd,A.ntb?.cd)+barProg('Total NTB',tot(c.ntb),A.ntb&&tot(A.ntb)))}
      ${kolom('ETB','Nasabah lama · Oktober 2026',barProg('Data Error CIF Dana',c.etb.err,A.etb?.err)+barProg('Cendup Weekly',c.etb.cd,A.etb?.cd)+barProg('Total ETB',tot(c.etb),A.etb&&tot(A.etb))+barProg('User SSIM',c.ssim,A.ssim))}
    </div>
    <p class="dt-note">Selesai = status <i>Done</i> di data detail. Garis tipis pada bar = capaian rata-rata Area.</p></section>`;
}

/* ===== 3. Data Error CIF Dana ===== */
const seg=(attr,val,items)=>`<div class="seg dt-seg">${items.map(([v,t])=>`<button type="button" data-${attr}="${v}" class="${v===val?'on':''}">${t}</button>`).join('')}</div>`;
const saring=(attr,val,rows,idx)=>{const sel=rows.filter(r=>r[idx]===1).length;return `<div class="dt-filter">${[['0','Belum',rows.length-sel,'bd'],['1','Selesai',sel,'ok'],['all','Semua',rows.length,'']].map(([v,t,n,k])=>`<button type="button" data-${attr}="${v}" class="${v===val?'on':''} ${k}">${t} <b>${nf(n)}</b></button>`).join('')}</div>`;};
function daftarTop(pairs,total,lain){
  const max=Math.max(1,...pairs.map(p=>p[1]));
  return `<div class="dt-top">${pairs.map(([t,n])=>`<div class="dt-top-r"><span title="${esc(t)}">${esc(t)}</span><b>${nf(n)}</b><i style="width:${n/max*100}%"></i></div>`).join('')}${lain?`<div class="dt-top-r lain"><span>Jenis error lainnya</span><b>${nf(lain)}</b></div>`:''}</div>${total!=null?`<p class="dt-note">Satu nasabah bisa punya lebih dari satu jenis error.</p>`:''}`;
}
function danaNtb(kd){
  const all=T.ntb[kd]||[];
  const rows=ui.danaF==='all'?all:all.filter(r=>String(r[6])===ui.danaF);
  const cnt=new Map();rows.forEach(r=>r[3].forEach(i=>cnt.set(i,(cnt.get(i)||0)+1)));
  const top=[...cnt].sort((a,b)=>b[1]-a[1]);const top6=top.slice(0,6).map(([i,n])=>[K(i),n]);
  const lain=top.slice(6).reduce((s,x)=>s+x[1],0);
  if(!all.length)return '<p class="dt-kosong">Tidak ada data error CIF Dana NTB untuk cabang ini.</p>';
  const urut=rows.slice().sort((a,b)=>a[6]-b[6]||(b[4]??0)-(a[4]??0));
  const tampil=ui.semuaNtb?urut:urut.slice(0,LIM);
  const body=tampil.map((r,j)=>`<tr><td class="ob-no">${j+1}</td><td><b class="dt-mono">${esc(r[0]||'–')}</b><small>Kelas ${esc(r[1]||'–')} · buka ${tgl(r[2],{day:'numeric',month:'short'})}</small></td><td class="dt-err">${r[3].map(i=>`<span>${esc(K(i))}</span>`).join('')}</td><td class="ang">${nf(r[4])}<small>hari</small></td><td>${esc(K(r[5]))}</td><td class="ang">${statusChip(r[6])}</td></tr>`).join('');
  return `${saring('dt-df',ui.danaF,all,6)}
    ${rows.length?`<h3 class="dt-h3">Jenis error terbanyak</h3>${daftarTop(top6,rows.length,lain)}
    <div class="tw"><table class="dt-tbl"><thead><tr><th class="ob-no">No</th><th>CIF</th><th>Error</th><th class="ang">Umur</th><th>Dibuat via</th><th class="ang">Status</th></tr></thead><tbody>${body}</tbody></table></div>
    ${urut.length>LIM?`<button type="button" class="dt-more" data-dt-more="ntb">${ui.semuaNtb?'Tampilkan lebih sedikit':`Tampilkan semua ${nf(urut.length)} baris`}</button>`:''}`:'<p class="dt-kosong">Tidak ada data untuk pilihan ini.</p>'}`;
}
function danaEtb(kd){
  const e=T.etb[kd];if(!e)return '<p class="dt-kosong">Tidak ada data error CIF Dana ETB untuk cabang ini.</p>';
  const th=Object.entries(e.th);
  const tot=th.reduce((s,[,v])=>[s[0]+v[0],s[1]+v[1]],[0,0]);
  const tr=([n,[d,b]])=>{const r=pc(d,d+b);return `<tr><td>${esc(n)}</td><td class="ang">${nf(d)}</td><td class="ang">${nf(b)}</td><td class="ang">${nf(d+b)}</td><td class="ang ${kelasPct(r)}"><b>${pct(r)}</b></td></tr>`;};
  const umur=e.umur.map((n,i)=>`<div><small>${esc(T.umur[i])}</small><b>${nf(n)}</b></div>`).join('');
  const ch=e.ch.map(([i,n])=>`<span class="dt-ch">${esc(K(i))} <b>${nf(n)}</b></span>`).join('');
  return `<p class="dt-note dt-note-top">Data ETB ± 81 ribu baris se-Region II, jadi di sini ditampilkan ringkasannya per cabang.</p>
    <h3 class="dt-h3">Per tahun pembukaan CIF</h3>
    <div class="tw"><table class="dt-tbl dt-tbl-s"><thead><tr><th>Tahun pembukaan</th><th class="ang">Selesai</th><th class="ang">Belum</th><th class="ang">Total</th><th class="ang">%</th></tr></thead><tbody>${th.map(tr).join('')}${tr(['Total',tot])}</tbody></table></div>
    <h3 class="dt-h3">Jenis error yang belum diperbaiki</h3>${daftarTop(e.err.map(([i,n])=>[K(i),n]),tot[1],e.errLain)}
    <h3 class="dt-h3">Umur data error (belum diperbaiki)</h3><div class="dt-umur">${umur}</div>
    ${ch?`<h3 class="dt-h3">Dibuat via</h3><div class="dt-chs">${ch}</div>`:''}`;
}
function kartuDana(){
  const kd=kodeCab();
  return `<section class="cd" id="dt-dana"><h2>Detail Data Error CIF Dana</h2>
    ${seg('dt-dana',ui.dana,[['ntb','NTB · Nasabah baru'],['etb','ETB · Nasabah lama']])}
    ${ui.dana==='ntb'?danaNtb(kd):danaEtb(kd)}</section>`;
}

/* ===== 4. Cendup ===== */
function kartuCendup(){
  const kd=kodeCab(),all=T.cendup[ui.cd][kd]||[];
  const rows=ui.cdF==='all'?all:all.filter(r=>String(r[8])===ui.cdF);
  const urut=rows.slice().sort((a,b)=>a[8]-b[8]||String(a[1]).localeCompare(String(b[1]))||String(a[3]).localeCompare(String(b[3])));
  const tampil=ui.semuaCd?urut:urut.slice(0,LIM);
  const fld=new Map();rows.forEach(r=>fld.set(r[5],(fld.get(r[5])||0)+1));
  const top=[...fld].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([i,n])=>['Sama: '+K(i),n]);
  const body=tampil.map((r,j)=>`<tr><td class="ob-no">${j+1}</td><td><b class="dt-mono">${esc(r[0]||'–')}</b><small>Jenis ${esc(r[2]||'–')} · dibuat ${tgl(r[3])}</small></td><td><span class="dt-grp">${esc(r[1]||'–')}</span><small>${nf(r[4])} CIF</small></td><td class="dt-err"><span>${esc(K(r[5]))}</span></td><td>${esc(K(r[6]))}</td><td class="ang">${nf(r[7])}<small>hari</small></td><td class="ang">${statusChip(r[8])}</td></tr>`).join('');
  return `<section class="cd" id="dt-cendup"><h2>Detail Cendup · CIF Duplikat</h2>
    ${seg('dt-cd',ui.cd,[['ntb','NTB · Nasabah baru'],['etb','ETB · Nasabah lama']])}
    ${all.length?`${saring('dt-cf',ui.cdF,all,8)}
      ${rows.length?`<h3 class="dt-h3">Field yang sama (terbanyak)</h3>${daftarTop(top)}
      <div class="tw"><table class="dt-tbl"><thead><tr><th class="ob-no">No</th><th>CIF</th><th>Grup</th><th>Field yang sama</th><th>Sumber</th><th class="ang">Umur</th><th class="ang">Status</th></tr></thead><tbody>${body}</tbody></table></div>
      ${urut.length>LIM?`<button type="button" class="dt-more" data-dt-more="cd">${ui.semuaCd?'Tampilkan lebih sedikit':`Tampilkan semua ${nf(urut.length)} baris`}</button>`:''}`:'<p class="dt-kosong">Tidak ada data untuk pilihan ini.</p>'}`
      :`<p class="dt-kosong">Tidak ada data Cendup ${ui.cd.toUpperCase()} untuk cabang ini.</p>`}
    <p class="dt-note">Grup = kode pengelompokan CIF yang terdeteksi duplikat satu sama lain (CIF dengan grup sama adalah satu pasangan duplikat). Data per ${tgl(T.periode.cendup)}.</p></section>`;
}

/* ===== 5. User SSIM ===== */
function kartuSsim(c){
  const us=T.ssim[kodeCab()]||[],[j,t]=c.ssim||[];
  return `<section class="cd"><h2>User SSIM</h2>
    <p class="dt-note dt-note-top"><b>${nf(j)}</b> dari target <b>${nf(t)}</b> user${t?` · ${pct(pc(j,t))}`:''}</p>
    ${us.length?`<div class="tw"><table class="dt-tbl dt-tbl-s"><thead><tr><th>Nama</th><th>Posisi</th><th>Tipe</th><th class="ang">Dibuat</th></tr></thead><tbody>${us.map(u=>`<tr><td><b>${esc(u[0])}</b><small class="dt-mono">${esc(u[1]||'–')}</small></td><td>${esc(u[2]||'–')}</td><td>${esc(u[3]||'–')}</td><td class="ang">${tgl(u[4])}</td></tr>`).join('')}</tbody></table></div>`:'<p class="dt-kosong">Tidak ada user SSIM tercatat untuk cabang ini.</p>'}</section>`;
}

/* ===== halaman ===== */
function page(){
  const kd=kodeCab(),c=T.cabang[kd];
  if(kd!==kodeSebelum){kodeSebelum=kd;ui.semuaNtb=ui.semuaCd=false;}
  const head=`<section class="dt-head"><button type="button" class="dt-back" data-v="cabang">‹ Kembali ke Cabang</button>
    <h2>🛡️ DTI Dana &amp; Cendup</h2>
    <p>Data Trust Index, perbaikan Data Error CIF Dana dan Cendup (CIF duplikat) cabang terpilih.</p>
    <p class="dt-per">📅 Data error CIF s.d. ${tgl(T.periode.ntb)} · Cendup s.d. ${tgl(T.periode.cendup)}</p></section>`;
  if(!c)return head+'<p class="dt-kosong">Data DTI tidak tersedia untuk cabang ini.</p>';
  return head+kartuSkor(c)+kartuProgres(c)+kartuDana()+kartuCendup()+kartuSsim(c)+
    `<p class="dt-note dt-foot">Sumber: ${esc(T.sumber)}. Nama nasabah tidak ditampilkan; No CIF dan NIP disamarkan.</p>`;
}

/* tombol menu di atas halaman Cabang (di samping tombol Informasi Sales) */
function kartuDtiLink(){
  if(!D.B[st.b])return '';
  return `<button type="button" class="dti-open" data-v="dti"><span>🛡️</span><b>DTI Dana &amp; Cendup</b><span class="dti-open-go">›</span></button>`;
}
const iSales=URUTAN.findIndex(f=>f.name==='kartuSalesLink');
URUTAN.splice(iSales>=0?iSales+1:0,0,kartuDtiLink);

/* bungkus render() */
const sebelumnya=render;
render=function(){
  const tetap=tampil==='dti'&&!!app.querySelector('.dt-head');
  const y=tetap?window.scrollY:null;
  sebelumnya();
  document.body.classList.toggle('mode-dti',tampil==='dti');
  if(tampil!=='dti')return;
  document.body.classList.remove('maint');
  app.innerHTML=page();
  if(y!=null&&Math.abs(window.scrollY-y)>1)window.scrollTo({top:y,behavior:'instant'});
};
const ganti=(id,fn)=>{const el=document.getElementById(id);if(el)el.outerHTML=fn();};
app.addEventListener('click',e=>{
  if(tampil!=='dti')return;
  const a=s=>e.target.closest('[data-'+s+']');let x;
  if((x=a('dt-dana'))){ui.dana=x.dataset.dtDana;ganti('dt-dana',kartuDana);return;}
  if((x=a('dt-df'))){ui.danaF=x.dataset.dtDf;ui.semuaNtb=false;ganti('dt-dana',kartuDana);return;}
  if((x=a('dt-cd'))){ui.cd=x.dataset.dtCd;ui.semuaCd=false;ganti('dt-cendup',kartuCendup);return;}
  if((x=a('dt-cf'))){ui.cdF=x.dataset.dtCf;ui.semuaCd=false;ganti('dt-cendup',kartuCendup);return;}
  if((x=a('dt-more'))){if(x.dataset.dtMore==='ntb'){ui.semuaNtb=!ui.semuaNtb;ganti('dt-dana',kartuDana);}else{ui.semuaCd=!ui.semuaCd;ganti('dt-cendup',kartuCendup);}}
});
render();
})();
