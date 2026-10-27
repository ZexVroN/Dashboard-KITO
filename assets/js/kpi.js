/* KITO: navigasi KPI sementara menampilkan halaman pengembangan.
   Tidak mengubah modul Region, Area, Cabang, ataupun data KPI tersimpan. */
(() => {
  const renderSebelumnya = render;
  render = function (...args) {
    renderSebelumnya.apply(this, args);
    document.body.classList.toggle('mode-kpi', tampil === 'kpi');
    if (tampil !== 'kpi') return;
    document.querySelector('#app').innerHTML = `
      <section class="cd mt" role="status" aria-label="Halaman KPI dalam pengembangan">
        <div class="mt-ik" aria-hidden="true">🚧</div>
        <h3>Halaman KPI Sedang Dalam Pengembangan</h3>
        <p>Informasi KPI sedang kami siapkan dan akan tersedia pada pembaruan berikutnya.</p>
        <button type="button" class="btn" data-v="cabang">Buka Dashboard Cabang</button>
      </section>`;
  };
  if (tampil === 'kpi') render();
})();
