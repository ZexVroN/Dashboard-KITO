/* Informasi Sales: angka berkoma dibulatkan ke ATAS per pegawai, sebelum dipakai halaman mana pun.
   Kolom yang dibulatkan (kito.json [KITO_SALES_PEGAWAI].rows, lihat .kolom):
     6 eTarget · 7 eBal · 8 eTargetBal · 10 iTarget · 11 iBal · 12 iTargetBal
   Akuisisi sudah bilangan bulat. Total cabang / area / Region II = jumlah nilai pegawai yang sudah dibulatkan,
   sehingga Gap, %, dan status (Bugar / Rawat Jalan / IGD) dihitung dari angka yang tampil.
   Toleransi 1e-9 agar nilai seperti 2,0000000001 (sisa pembulatan desimal) tidak naik menjadi 3. */
(function () {
  'use strict';
  var S = window.KITO_SALES_PEGAWAI;
  if (!S || !Array.isArray(S.rows) || S.dibulatkan) return;
  var KOLOM = [6, 7, 8, 10, 11, 12];
  var atas = function (v) {
    if (typeof v !== 'number' || !isFinite(v)) return v;
    var b = Math.round(v);
    return Math.abs(v - b) < 1e-9 ? b : Math.ceil(v);
  };
  S.rows.forEach(function (r) { KOLOM.forEach(function (i) { r[i] = atas(r[i]); }); });
  S.dibulatkan = 'ke atas per pegawai: target, balance, target balance';
})();
