/* Tabel versi mobile: di layar <= 640px, tabel yang lebih lebar dari kartunya diubah menjadi
   kartu per baris (sel pertama = judul, sel lain = label kolom + nilai). Tabel yang sudah muat tetap tabel.
   Berlaku otomatis untuk semua tabel di #app (Cabang, Sales, DTI, Area, Region, Ranking).
   Pasangan gaya: assets/css/mobile-table.css */
(() => {
  'use strict';
  const MAX = 640;
  const app = document.getElementById('app');
  if (!app) return;

  const teks = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

  function siapkan(t) {
    if (t.dataset.mtSiap) return;
    t.dataset.mtSiap = '1';
    const baris = [...t.rows];
    const head = t.tHead?.rows[0] || baris.find((r) => r.cells.length && [...r.cells].every((c) => c.tagName === 'TH'));
    if (!head) return;
    head.classList.add('mt-h');
    // label per posisi kolom (memperhitungkan colspan)
    const label = [];
    [...head.cells].forEach((c) => { for (let k = 0; k < (c.colSpan || 1); k++) label.push(teks(c)); });
    const noCol = /^(no|#)$/i.test(label[0] || '');
    baris.forEach((r) => {
      if (r === head || r.parentElement?.tagName === 'THEAD') return;
      let pos = 0, judul = false;
      [...r.cells].forEach((c) => {
        const span = c.colSpan || 1;
        if (span >= label.length) c.classList.add('mt-full');
        else if (pos === 0 && noCol) c.classList.add('mt-no');
        else if (!judul) { c.classList.add('mt-t'); judul = true; }
        else {
          c.dataset.label = label[pos] || '';
          if (teks(c).length > 20) c.classList.add('mt-w'); // teks panjang memakai 2 kolom kartu
        }
        pos += span;
      });
    });
  }

  function cek(t) {
    siapkan(t);
    if (!t.querySelector('.mt-h')) return;
    t.classList.remove('mt');
    if (window.innerWidth > MAX) return;
    const wadah = t.closest('.tw') || t.parentElement;
    if (t.scrollWidth > wadah.clientWidth + 2) t.classList.add('mt');
  }

  let antre = false;
  const semua = () => {
    if (antre) return;
    antre = true;
    requestAnimationFrame(() => { antre = false; app.querySelectorAll('table').forEach(cek); });
  };
  new MutationObserver(semua).observe(app, { childList: true, subtree: true });
  let lebar = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth !== lebar) { lebar = window.innerWidth; semua(); } });
  semua();
})();
