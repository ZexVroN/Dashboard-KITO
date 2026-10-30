/* Periode bulan: filter pilihan tanggal tanpa mengubah dataset / chart historis. */
(()=>{
 const dates=Array.isArray(window.D?.dates)?window.D.dates:(typeof D!=='undefined'&&Array.isArray(D.dates)?D.dates:[]);
 const month=document.getElementById('sm'),day=document.getElementById('sd');
 if(!month||!day||!dates.length)return;
 const months=[...new Set(dates.map(d=>String(d).slice(0,7)))].sort();
 const fmt=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});
 month.innerHTML=months.map(m=>`<option value="${m}">${fmt.format(new Date(m+'-01T00:00:00Z'))}</option>`).join('');
 const selectedDate=()=>dates[Number(day.value)]||dates[dates.length-1];
 const apply=(preferred)=>{
   const m=month.value, indices=dates.map((d,i)=>[d,i]).filter(([d])=>d.startsWith(m));
   if(!indices.length)return;
   const wanted=indices.some(([,i])=>i===preferred)?preferred:indices[indices.length-1][1];
   day.innerHTML=indices.map(([d,i])=>`<option value="${i}">${new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'))}</option>`).join('');
   day.value=String(wanted);
   if(typeof st!=='undefined'&&st.d!==wanted){day.dispatchEvent(new Event('change',{bubbles:true}));}
   else day.dispatchEvent(new Event('kito-month-sync'));
 };
 month.value=selectedDate().slice(0,7);
 apply(Number(day.value));
 month.addEventListener('change',()=>apply(-1));
 day.addEventListener('change',()=>{const d=selectedDate();if(d&&month.value!==d.slice(0,7))month.value=d.slice(0,7)});
 /* Other dashboard functions may rebuild the date select; restore the active month. */
 const observer=new MutationObserver(()=>{
   const m=month.value;
   if(!m||[...day.options].every(o=>dates[Number(o.value)]?.startsWith(m)))return;
   observer.disconnect();apply(Number(day.value));observer.observe(day,{childList:true});
 });
 observer.observe(day,{childList:true});
})();
