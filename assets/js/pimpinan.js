/* Kartu cabang (tab Cabang): tambahan nama Branch Manager dan BOM/BOS di bawah nama cabang.
   Data: data/kito.json [KITO_PIMPINAN] (tools/build_pimpinan.py dari BOS-BM.xlsx).
   Add-on non-destruktif: membungkus kartuCabang di URUTAN, tidak mengubah script.js. */
(()=>{'use strict';
const P=window.KITO_PIMPINAN;
if(!P||typeof URUTAN==='undefined'||typeof kartuCabang!=='function'||typeof D==='undefined')return;
const i=URUTAN.indexOf(kartuCabang);if(i<0)return;
const orang=(jabatan,nama)=>`<div class="pm"><small>${jabatan}</small><b class="${nama?'':'pm-kosong'}">${nama?esc(nama):'Belum ada data'}</b></div>`;
function kartuCabangPimpinan(){
  const html=kartuCabang();
  const b=D.B[st.b];if(!b)return html;
  const p=P.data[String(b[0])];if(!p)return html;
  const blok=`<div class="pm-row">${orang('Branch Manager',p[0])}${orang('BOM / BOS',p[1])}</div>`;
  const j=html.lastIndexOf('</div>');            // sisipkan di dalam kartu hero, sebelum penutupnya
  return j<0?html:html.slice(0,j)+blok+html.slice(j);
}
URUTAN[i]=kartuCabangPimpinan;
window.KITO_KARTU_CABANG=kartuCabangPimpinan;   // dipakai juga di halaman Informasi Sales cabang (sales.js)
render();
})();
