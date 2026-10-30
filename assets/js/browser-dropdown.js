/* Browser desktop only: floating dropdown outside clipping/scroll ancestors. */
(()=>{
 const desktop=()=>matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)').matches;
 const ids=['sa','sc','sm','sd'];let current=null;
 const close=()=>{if(current){current.popup.remove();current.button.setAttribute('aria-expanded','false');current=null}};
 const sync=()=>{for(const id of ids){const s=document.getElementById(id);if(!s)continue;const wrap=s.closest('.kito-browser-select');if(!wrap)continue;const b=wrap.querySelector('.kito-browser-trigger');const o=s.selectedOptions[0];const label=o?o.textContent:'Pilih…';if(b.textContent!==label)b.textContent=label;if(b.disabled!==s.disabled)b.disabled=s.disabled;}};
 const open=(s,b)=>{
  if(current?.select===s){close();return}close();
  const pop=document.createElement('div');pop.className='kito-browser-popup';pop.setAttribute('role','listbox');
  const rect=b.getBoundingClientRect();const maxH=Math.min(320,Math.max(140,innerHeight-32));
  const pw=Math.max(190,Math.min(rect.width,480));
  pop.style.width=pw+'px';
  pop.style.left=Math.max(8,Math.min(rect.left,innerWidth-pw-8))+'px';
  const below=innerHeight-rect.bottom,above=rect.top;
  pop.style.maxHeight=Math.min(maxH,Math.max(120,Math.max(below,above)-12))+'px';
  if(below>=Math.min(250,above))pop.style.top=Math.min(innerHeight-120,rect.bottom+4)+'px';
  else pop.style.bottom=(innerHeight-rect.top+4)+'px';
  for(let i=0;i<s.options.length;i++){
   const opt=s.options[i],item=document.createElement('button');item.type='button';item.className='kito-browser-option';item.textContent=opt.textContent;item.setAttribute('role','option');item.setAttribute('aria-selected',String(i===s.selectedIndex));item.disabled=opt.disabled;
   item.addEventListener('click',()=>{s.selectedIndex=i;s.dispatchEvent(new Event('change',{bubbles:true}));close();sync();b.focus()});pop.append(item)
  }
  document.body.append(pop);b.setAttribute('aria-expanded','true');current={popup:pop,button:b,select:s};
  const selected=pop.querySelector('[aria-selected="true"]');if(selected)pop.scrollTop=Math.max(0,selected.offsetTop-pop.offsetTop-pop.clientHeight/2);
 };
 const setup=()=>{
  for(const id of ids){const s=document.getElementById(id);if(!s||s.closest('.kito-browser-select'))continue;
   const wrap=document.createElement('div');wrap.className='kito-browser-select';s.parentNode.insertBefore(wrap,s);wrap.append(s);
   const b=document.createElement('button');b.type='button';b.className='kito-browser-trigger';b.setAttribute('aria-haspopup','listbox');b.setAttribute('aria-expanded','false');b.setAttribute('aria-label',s.getAttribute('aria-label')||'Pilih');wrap.append(b);
   b.addEventListener('click',()=>open(s,b));b.addEventListener('keydown',e=>{if(['ArrowDown','Enter',' '].includes(e.key)){e.preventDefault();open(s,b)}});
   s.addEventListener('change',()=>{close();sync()});
  }sync();
 };
 document.addEventListener('pointerdown',e=>{if(current&&!current.popup.contains(e.target)&&!current.button.contains(e.target))close()},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 window.addEventListener('scroll',e=>{if(current && e.target!==current.popup && !current.popup.contains(e.target))close()},true);window.addEventListener('resize',()=>{close();sync()});
 const obs=new MutationObserver(()=>{if(desktop())sync()});
 const start=()=>{setup();for(const id of ids){const select=document.getElementById(id);if(select)obs.observe(select,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','selected']});}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
