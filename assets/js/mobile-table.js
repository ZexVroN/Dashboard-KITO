/* Tabel versi mobile: di layar <= 640px, tabel lebar menjadi kartu per baris.
   Judul dan dua nilai ditampilkan; kolom selebihnya dibuka melalui Lihat detail.
   Berlaku otomatis untuk semua tabel di #app (Cabang, Sales, DTI, Area, Region, Ranking).
   Pasangan gaya: assets/css/mobile-table.css */
(() => {
  'use strict';
  const MAX = 640;
  const app = document.getElementById('app');
  if (!app) return;

  const teks = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

  let nomorDetail = 0;
  function siapkan(t) {
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
      if (r.dataset.mtSiap) return;
      r.dataset.mtSiap = '1';
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
      const judulSel = r.querySelector('.mt-t');
      const nilai = [...r.cells].filter((c) => c.hasAttribute('data-label'));
      // Dua nilai utama tetap terlihat; kolom lainnya dibuka sesuai kebutuhan.
      if (!judulSel || nilai.length <= 2) return;
      nilai.slice(0, 2).forEach((c) => c.classList.add('mt-summary'));
      const detail = nilai.slice(2);
      detail.forEach((c) => {
        c.classList.add('mt-detail');
        c.id = c.id || `mt-detail-${++nomorDetail}`;
      });
      const aksi = document.createElement('td');
      aksi.className = 'mt-actions';
      const tombol = document.createElement('button');
      tombol.type = 'button';
      tombol.className = 'mt-toggle';
      tombol.textContent = 'Lihat detail';
      tombol.setAttribute('aria-expanded', 'false');
      tombol.setAttribute('aria-controls', detail.map((c) => c.id).join(' '));
      tombol.setAttribute('aria-label', `Lihat detail ${teks(judulSel)}`);
      tombol.addEventListener('click', (event) => {
        event.stopPropagation();
        const buka = r.classList.toggle('mt-open');
        tombol.setAttribute('aria-expanded', String(buka));
        tombol.textContent = buka ? 'Tutup detail' : 'Lihat detail';
        tombol.setAttribute('aria-label', `${buka ? 'Tutup' : 'Lihat'} detail ${teks(judulSel)}`);
      });
      aksi.append(tombol);
      r.append(aksi);
    });
  }

  function cek(t) {
    siapkan(t);
    if (!t.querySelector('.mt-h')) return;
    t.classList.remove('mt');
    if (window.innerWidth > MAX) return;
    const wadah = t.closest('.tw') || t.parentElement;
    if (t.scrollWidth > wadah.clientWidth + 2 || t.querySelector('.mt-toggle')) t.classList.add('mt');
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
