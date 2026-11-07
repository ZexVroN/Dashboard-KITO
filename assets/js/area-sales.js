/* Informasi Sales pada navigasi Area: ringkasan Ekstensifikasi & Intensifikasi pegawai inbranch per Area / Region II.
   Sumber: data/kito.json [KITO_SALES_PEGAWAI] (sama dengan halaman Informasi Sales tab Cabang), dikelompokkan
   per Area lewat kode cabang (D.B). Aturan sama dengan pegawai.js:
     Ekstensifikasi : % = Akuisisi ÷ Target;          status dari Akuisisi vs Target
     Intensifikasi  : % = Balance ÷ Target Balance;   status dari Balance vs Target Balance
     Status         : 0 / kosong = IGD · di bawah target = Rawat Jalan · ≥ target = Bugar
   Mendaftarkan diri ke registri tampilan tab Area (lihat area-o2o.js). */
(()=>{'use strict';
const S=window.KITO_SALES_PEGAWAI;
const views=window.KITO_AREA_VIEWS;
if(!S||!views||typeof D==='undefined'||typeof st==='undefined'||typeof render!=='function')return;

const ALL='Semua Area Region II';
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').toLowerCase().replace(/^area\s+/,'').replace(/[^a-z0-9]/g,'');
const nf=(v,d=0)=>v==null||!Number.isFinite(+v)?'–':(+v).toLocaleString('id-ID',{maximumFractionDigits:d});
const pc=v=>v==null||!Number.isFinite(v)?'–':Math.round(v*100).toLocaleString('id-ID')+'%';
const tg=iso=>new Date(iso+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'});
const tgL=iso=>new Date(iso+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
const last=a=>a?.[a.length-1]??null;
const gapCls=g=>g==null?'':g<0?'neg':g>0?'pos':'';
const gapTxt=(g,d=0)=>g==null?'–':(g>0?'+':'')+nf(g,d);

const ST={BUGAR:['Bugar','bugar'],'RAWAT JALAN':['Rawat Jalan','rawat'],IGD:['IGD','igd']};
const URUT=['BUGAR','RAWAT JALAN','IGD'];
const status=(v,t)=>v==null||t==null?null:(v===0?'IGD':v<t?'RAWAT JALAN':'BUGAR');
const KAT={
  e:{judul:'Ekstensifikasi',sub:'Akuisisi New CIF',dasar:'Akuisisi ÷ Target',dec:0,
     nilai:r=>({a:last(r[5]),t:r[6],seri:r[5]}),val:x=>x.a,tar:x=>x.t},
  i:{judul:'Intensifikasi',sub:'Balance New Acc ETB',dasar:'Balance ÷ Target Balance',dec:2,
     nilai:r=>({bal:r[11],tbal:r[12],seri:r[9]}),val:x=>x.bal,tar:x=>x.tbal},
};

// kode cabang -> {nama, area}
const cab=new Map(D.B.map(b=>[String(b[0]).replace(/\D/g,''),{nama:b[1],area:b[2]}]));
const rows=S.rows.map(r=>({r,kode:String(r[4]).replace(/\D/g,'')})).filter(x=>cab.has(x.kode));
const areaOf=kode=>cab.get(kode).area;

const KEL=[['tl','Teller',j=>/^teller/i.test(j)],['cs','Customer Service',j=>/^customer service/i.test(j)],
  ['bo','Branch Operation',j=>/^branch/i.test(j)],['gb','General Banker',j=>/^general banker/i.test(j)],['ln','Lainnya',()=>true]];
const kelOf=j=>KEL.find(q=>q[2](j));
const ui={tab:'e',jab:'all',pj:'all',lim:20};

// ringkasan satu kelompok pegawai untuk satu kategori
function ringkas(list,k){
  const K=KAT[k],xs=list.map(x=>K.nilai(x.r));
  const sum=f=>xs.reduce((s,x)=>s+(x[f]||0),0);
  const a=k==='e'?sum('a'):sum('bal'),t=k==='e'?sum('t'):sum('tbal');
  const seri=S.update.map((_,j)=>xs.reduce((s,x)=>s+(x.seri?.[j]||0),0));
  const n={BUGAR:0,'RAWAT JALAN':0,IGD:0,lain:0};
  xs.forEach(x=>{n[status(K.val(x),K.tar(x))||'lain']++;});
  return {a,t,gap:a-t,pct:t>0?a/t:null,seri,n,jml:list.length};
}

function current(){
  if(st.a===ALL)return{nama:'Seluruh Area Region II',isRegion:true,list:rows};
  const list=rows.filter(x=>norm(areaOf(x.kode))===norm(st.a));
  return{nama:st.a,isRegion:false,list};
}

const meter=p=>`<div class="as-meter"><i style="width:${Math.min(1,p??0)*100}%"></i></div>`;
const chipSt=s=>s?`<span class="sp-st ${ST[s][1]}">${ST[s][0]}</span>`:'<span class="sp-st kosong">–</span>';

function hero(c){
  const cabs=new Set(c.list.map(x=>x.kode)).size;
  return `<section class="cd wt-hero"><span class="wt-eyebrow">INFORMASI SALES · ${c.isRegion?'REGION II':'AREA'}</span><h3>${clean(c.nama)}</h3><p class="wt-sub">${nf(c.list.length)} pegawai inbranch · ${nf(cabs)} cabang · update ${S.update.map(tg).join(', ')} (data s.d. ${tgL(S.tanggal)})</p><p class="wt-sub">Ekstensifikasi = akuisisi New CIF · Intensifikasi = balance New Acc ETB. Status mengikuti aturan halaman Informasi Sales cabang.</p></section>`;
}

function blok(k,R,pembanding){
  const K=KAT[k],tot=R.jml;
  const d=K.dec;
  const dt=R.seri.length>1?R.seri[R.seri.length-1]-R.seri[R.seri.length-2]:null;
  const bar=URUT.map(s=>R.n[s]?`<i class="${ST[s][1]}" style="flex:${R.n[s]}" title="${ST[s][0]}: ${R.n[s]}"></i>`:'').join('');
  const leg=URUT.map(s=>`<span><i class="${ST[s][1]}"></i>${ST[s][0]} <b>${R.n[s]}</b></span>`).join('');
  const tren=S.update.map((u,j)=>`<span><small>${tg(u)}</small><b>${nf(R.seri[j],d)}</b></span>`).join('<i>→</i>');
  const vs=pembanding!=null&&R.pct!=null?`<small class="as-vs ${R.pct>=pembanding?'pos':'neg'}">${R.pct>=pembanding?'▲':'▼'} ${nf(Math.abs(R.pct-pembanding)*100,1)} poin vs Region II</small>`:'';
  return `<section class="cd as-blok as-${k}"><h2>${K.judul} <small class="as-sub">${K.sub}</small></h2>
    <div class="as-angka"><strong>${nf(R.a,d)}</strong><span>dari target <b>${nf(R.t,d)}</b></span><em class="${gapCls(R.gap)}">Gap ${gapTxt(R.gap,d)}</em></div>
    <div class="as-pct">${meter(R.pct)}<b>${pc(R.pct)}</b><small>${K.dasar}</small>${vs}</div>
    <div class="as-tren"><small class="as-cap">Akuisisi</small>${tren}${dt!=null?`<small class="${gapCls(dt)}">${dt>0?'▲ +':dt<0?'▼ ':''}${dt===0?'tetap':nf(dt,d)} sejak ${tg(S.update[S.update.length-2])}</small>`:''}</div>
    <div class="as-sts"><div class="as-stbar">${bar}</div><div class="as-leg">${leg}</div><small>Status ${tot} pegawai${R.n.lain?` · ${R.n.lain} tanpa data`:''}</small></div></section>`;
}

function profil(c){
  const per=new Map();c.list.forEach(x=>{const j=x.r[2]||'–';per.set(j,(per.get(j)||0)+1);});
  const kel=KEL.map(k=>[k,[...per].filter(([j])=>kelOf(j)===k).reduce((s,[,n])=>s+n,0)]).filter(x=>x[1]);
  const bar=kel.map(([k,n])=>`<i class="pp-${k[0]}" style="flex:${n}" title="${k[1]}: ${n}"></i>`).join('');
  const leg=kel.map(([k,n])=>`<span><i class="pp-${k[0]}"></i>${k[1]} <b>${n}</b></span>`).join('');
  return `<section class="cd"><h2>Profil Pegawai Inbranch</h2><div class="as-prof"><strong>${nf(c.list.length)}<small>pegawai</small></strong><div class="as-prof-r"><div class="pp-bar">${bar}</div><div class="pp-leg">${leg}</div></div></div></section>`;
}

// ranking: per area (Region II) atau per cabang (satu area), diurutkan menurut kategori terpilih
function ranking(c,regPct){
  const k=ui.tab,K=KAT[k];
  const tabs=`<div class="seg">${['e','i'].map(v=>`<button type="button" data-as-tab="${v}" class="${v===k?'on':''}">${KAT[v].judul}</button>`).join('')}</div>`;
  if(ui.jab!=='all'&&!c.list.some(x=>kelOf(x.r[2]||'')[0]===ui.jab))ui.jab='all';
  const jabTabs=`<div class="seg" role="group" aria-label="Jabatan">${[['all','Semua Jabatan',c.list.length]].concat(KEL.map(k=>[k[0],k[1],c.list.filter(x=>kelOf(x.r[2]||'')===k).length]).filter(x=>x[2])).map(([v,t,n])=>`<button type="button" data-as-jab="${v}" class="${v===ui.jab?'on':''}">${t} <small>${n}</small></button>`).join('')}</div>`;
  const pilih=ui.jab==='all'?c.list:c.list.filter(x=>kelOf(x.r[2]||'')[0]===ui.jab);
  const grup=new Map();
  pilih.forEach(x=>{const key=c.isRegion?areaOf(x.kode):x.kode;if(!grup.has(key))grup.set(key,[]);grup.get(key).push(x);});
  const baris=[...grup].map(([key,list])=>({key,list,R:ringkas(list,k)})).sort((a,b)=>(b.R.pct??-1)-(a.R.pct??-1)||b.R.a-a.R.a);
  const body=baris.map((b,i)=>{
    const R=b.R,nm=c.isRegion?b.key:cab.get(b.key).nama;
    const attr=c.isRegion?`data-as-area="${clean(b.key)}"`:`data-ak-code="${clean(b.key)}"`;
    const bar=URUT.map(s=>R.n[s]?`<i class="${ST[s][1]}" style="flex:${R.n[s]}"></i>`:'').join('');
    return `<button type="button" class="as-row ${R.pct!=null&&regPct!=null&&R.pct>=regPct?'ok-row':'bd-row'}" ${attr} aria-label="Buka ${clean(nm)}"><span class="as-no">${i+1}</span><span class="as-mid"><span class="as-nm">${clean(nm)}</span><span class="as-sm">${b.list.length} pegawai · ${nf(R.a,K.dec)} / ${nf(R.t,K.dec)} · Gap <b class="${gapCls(R.gap)}">${gapTxt(R.gap,K.dec)}</b></span><span class="as-stbar as-mini">${bar}</span></span><span class="as-val">${pc(R.pct)}</span></button>`;
  }).join('');
  return `<section class="cd"><h2>Ranking ${c.isRegion?'Area':'Cabang'} · ${K.judul}${ui.jab==='all'?'':' · '+KEL.find(q=>q[0]===ui.jab)[1]}</h2>${tabs}${jabTabs}<p class="wt-note">${K.dasar}${ui.jab==='all'?'':', hanya pegawai berjabatan '+KEL.find(q=>q[0]===ui.jab)[1]}. Hijau = di atas rata-rata Region II (${pc(regPct)}), merah = di bawah. Ketuk untuk membuka ${c.isRegion?'dashboard area':'cabang'}.</p><div>${body||'<p class="wt-warn">Tidak ada data pegawai untuk pilihan ini.</p>'}</div></section>`;
}

// ranking per pegawai berdasarkan jabatan (kelompok jabatan), lintas cabang di Area / Region II
function rankPegawai(c){
  const k=ui.tab,K=KAT[k];
  if(ui.pj!=='all'&&!c.list.some(x=>kelOf(x.r[2]||'')[0]===ui.pj))ui.pj='all';
  const tabs=`<div class="seg">${['e','i'].map(v=>`<button type="button" data-as-tab="${v}" class="${v===k?'on':''}">${KAT[v].judul}</button>`).join('')}</div>`;
  const jabTabs=`<div class="seg" role="group" aria-label="Jabatan pegawai">${[['all','Semua Jabatan',c.list.length]].concat(KEL.map(q=>[q[0],q[1],c.list.filter(x=>kelOf(x.r[2]||'')===q).length]).filter(x=>x[2])).map(([v,t,n])=>`<button type="button" data-as-pj="${v}" class="${v===ui.pj?'on':''}">${t} <small>${n}</small></button>`).join('')}</div>`;
  const pilih=ui.pj==='all'?c.list:c.list.filter(x=>kelOf(x.r[2]||'')[0]===ui.pj);
  const xs=pilih.map(x=>{const n=K.nilai(x.r),v=K.val(n),t=K.tar(n);return {x,v:v??0,t:t??0,pct:t>0&&v!=null?v/t:null,s:status(v,t)};})
    .sort((a,b)=>(b.pct??-1)-(a.pct??-1)||b.v-a.v||String(a.x.r[0]).localeCompare(String(b.x.r[0])));
  const tampil=xs.slice(0,ui.lim);
  const body=tampil.map((p,i)=>{
    const r=p.x.r,gap=p.v-p.t;
    return `<button type="button" class="as-row" data-ak-code="${clean(p.x.kode)}" aria-label="Buka ${clean(cab.get(p.x.kode).nama)}"><span class="as-no">${i+1}</span><span class="as-mid"><span class="as-nm">${clean(r[0])}</span><span class="as-sm">${clean(r[2]||'–')} · ${clean(cab.get(p.x.kode).nama)}${c.isRegion?' · '+clean(areaOf(p.x.kode)):''}</span><span class="as-sm">${nf(p.v,K.dec)} / ${nf(p.t,K.dec)} · Gap <b class="${gapCls(gap)}">${gapTxt(gap,K.dec)}</b> ${chipSt(p.s)}</span></span><span class="as-val ${p.s==='BUGAR'?'ok':p.s==='IGD'?'bd':''}">${pc(p.pct)}</span></button>`;
  }).join('');
  const lagi=xs.length>ui.lim?`<button type="button" class="as-more" data-as-more="1">Tampilkan ${Math.min(20,xs.length-ui.lim)} berikutnya · ${xs.length-ui.lim} lagi</button>`:(ui.lim>20?`<button type="button" class="as-more" data-as-more="0">Tampilkan lebih sedikit</button>`:'');
  const nm=ui.pj==='all'?'Semua Jabatan':KEL.find(q=>q[0]===ui.pj)[1];
  return `<section class="cd"><h2>Ranking Pegawai · ${K.judul} · ${clean(nm)}</h2>${tabs}${jabTabs}<p class="wt-note">${nf(xs.length)} pegawai · ${K.dasar}. Urut dari persentase tertinggi; status Bugar ≥ target, IGD belum ada realisasi. Ketuk pegawai untuk membuka cabangnya.</p><div>${body||'<p class="wt-warn">Tidak ada pegawai untuk pilihan ini.</p>'}</div>${lagi}</section>`;
}

function page(){
  const c=current();
  if(!c.list.length)return `<section class="cd"><p class="wt-warn">Data sales pegawai untuk <b>${clean(c.nama)}</b> tidak ditemukan.</p></section>`;
  const reg={e:ringkas(rows,'e'),i:ringkas(rows,'i')};
  const R={e:c.isRegion?reg.e:ringkas(c.list,'e'),i:c.isRegion?reg.i:ringkas(c.list,'i')};
  const regJab=ringkas(ui.jab==='all'?rows:rows.filter(x=>kelOf(x.r[2]||'')[0]===ui.jab),ui.tab);
  return `${hero(c)}<div class="wt-pair">${blok('e',R.e,c.isRegion?null:reg.e.pct)}${blok('i',R.i,c.isRegion?null:reg.i.pct)}</div>${profil(c)}${ranking(c,regJab.pct)}${rankPegawai(c)}`;
}

views.push({key:'sales',order:40,label:'📈 Informasi Sales',html:page});

document.getElementById('app').addEventListener('click',e=>{
  const pj=e.target.closest('[data-as-pj]');
  if(pj){ui.pj=pj.dataset.asPj;ui.lim=20;render();return;}
  const mr=e.target.closest('[data-as-more]');
  if(mr){ui.lim=mr.dataset.asMore==='1'?ui.lim+20:20;render();return;}
  const j=e.target.closest('[data-as-jab]');
  if(j){ui.jab=j.dataset.asJab;render();return;}
  const t=e.target.closest('[data-as-tab]');
  if(t){ui.tab=t.dataset.asTab;render();return;}
  const a=e.target.closest('[data-as-area]');
  if(a){const hit=D.B.find(b=>norm(b[2])===norm(a.dataset.asArea));if(hit){st.a=hit[2];fill();render();window.scrollTo({top:0,behavior:'smooth'});}}
});
})();
