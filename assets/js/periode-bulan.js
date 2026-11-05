/* Periode bulan: dashboard menampilkan SATU bulan saja (Oktober 2026, November 2026, ...).
   Dimuat setelah semua file data dan sebelum script.js. Bulan dipilih lewat ?bulan=YYYY-MM (atau pilihan terakhir
   di sessionStorage); bawaan = bulan data terbaru. Saat bulan diganti, halaman dimuat ulang (month-filter.js).

   Yang dipisah per bulan:
   - kito.json [D]        : dates, Q, QP, QN, QW, QD (dipotong ke tanggal bulan terpilih), queueMetricByDate
   - area-waktu     : dates, d/x per area & Region II, metricByDate, tanggal
   - region-data    : tglWaktu, waktu.d/n/p/w per region & nasional, queueMetricByDate, tanggal
   - kelompok area  : DtD = tanggal terakhir bulan terpilih (dari D.Q)
   - O2O & Shifting : bulan lama memakai arsip akhir bulan (kito.json [KITO_ARSIP_BULAN])
   - MTD waktu antri (P90) hanya ada untuk Oktober 2026; bulan lain tampil "–".
   Utilisasi NBDS tidak dipotong: memakai laporan NBDS terakhir (DtD & MTD dengan tanggal/bulannya sendiri). */
(function () {
  'use strict';
  if (typeof D === 'undefined' || !Array.isArray(D.dates) || !D.dates.length) return;
  var SEMUA = D.dates.slice();
  var bulanList = SEMUA.map(function (d) { return d.slice(0, 7); }).filter(function (m, i, a) { return a.indexOf(m) === i; }).sort();
  var terbaru = bulanList[bulanList.length - 1];
  var MTD_P90 = '2026-10';                       // bulan yang punya MTD P90 waktu antri di laporan lama

  var pilih = null;
  try { pilih = new URLSearchParams(location.search).get('bulan'); } catch (e) {}
  if (!pilih) { try { pilih = sessionStorage.getItem('kito-bulan'); } catch (e) {} }
  if (bulanList.indexOf(pilih) < 0) pilih = terbaru;
  try { sessionStorage.setItem('kito-bulan', pilih); } catch (e) {}

  var namaBulan = function (m, gaya) {
    return new Date(m + '-01T00:00:00').toLocaleDateString('id-ID', gaya === 'pendek' ? { month: 'long' } : { month: 'long', year: 'numeric' });
  };
  var idx = [];
  SEMUA.forEach(function (d, i) { if (d.slice(0, 7) === pilih) idx.push(i); });
  var tglAkhir = SEMUA[idx[idx.length - 1]];
  var adaMtd = pilih === MTD_P90;

  window.KITO_BULAN = {
    aktif: pilih, terbaru: terbaru, semua: bulanList, tanggalAkhir: tglAkhir,
    nama: namaBulan(pilih), namaPendek: namaBulan(pilih, 'pendek'),
    adaMtdWaktu: adaMtd,
    mtdLabel: 'MTD ' + namaBulan(pilih, 'pendek'),
    ganti: function (m) {
      if (bulanList.indexOf(m) < 0 || m === pilih) return;
      try {
        sessionStorage.setItem('kito-bulan', m);
        // kembali ke tab, area, dan cabang yang sama setelah dimuat ulang (dipulihkan di month-filter.js)
        sessionStorage.setItem('kito-bulan-kembali', JSON.stringify({ tab: typeof tampil !== 'undefined' ? tampil : 'cabang',
          a: typeof st !== 'undefined' ? st.a : null, b: typeof st !== 'undefined' ? st.b : null, y: window.scrollY || 0 }));
      } catch (e) {}
      var u = new URL(location.href);
      if (m === terbaru) u.searchParams.delete('bulan'); else u.searchParams.set('bulan', m);
      location.replace(u.toString());
    },
  };

  var potong = function (arr) { return Array.isArray(arr) ? idx.map(function (i) { return arr[i]; }) : arr; };
  var saringKunci = function (obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var hasil = {};
    Object.keys(obj).forEach(function (k) { if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || k.slice(0, 7) === pilih) hasil[k] = obj[k]; });
    return hasil;
  };
  var kosongkan = function (arr) { return Array.isArray(arr) ? arr.map(function () { return null; }) : arr; };

  /* ---------- kito.json [D] ---------- */
  D.dates = potong(SEMUA);
  ['Q', 'QP', 'QN', 'QW', 'QD'].forEach(function (k) {
    if (Array.isArray(D[k])) D[k] = D[k].map(function (baris) { return Array.isArray(baris) ? potong(baris) : baris; });
  });
  if (D.queueMetricByDate) D.queueMetricByDate = saringKunci(D.queueMetricByDate);
  if (!adaMtd && Array.isArray(D.QDM)) D.QDM = D.QDM.map(kosongkan);

  /* ---------- O2O & Shifting: arsip akhir bulan untuk bulan lama ---------- */
  var arsip = pilih !== terbaru && window.KITO_ARSIP_BULAN && window.KITO_ARSIP_BULAN[pilih];
  if (arsip) {
    D.mdate = arsip.mdate; D.bw = arsip.bw;
    D.B.forEach(function (b, i) {
      var m = arsip.M[String(b[0])], row = D.M[i];
      if (!m || !row) return;
      row[0] = m[0]; row[1] = m[1]; row[2] = m[2]; row[3] = m[3]; row[10] = m[4];
    });
    if (arsip.areaO2O) window.KITO_AREA_O2O = arsip.areaO2O;
  }

  /* ---------- kito.json [KITO_AREA_WAKTU] ---------- */
  var KW = window.KITO_AREA_WAKTU;
  if (KW) {
    if (Array.isArray(KW.dates)) KW.dates = KW.dates.filter(function (d) { return d.slice(0, 7) === pilih; });
    KW.tanggal = tglAkhir;
    if (KW.metricByDate) KW.metricByDate = saringKunci(KW.metricByDate);
    (KW.region ? [KW.region] : []).concat(KW.areas || []).forEach(function (e) {
      if (e.d) e.d = saringKunci(e.d);
      if (e.x) e.x = saringKunci(e.x);
      if (!adaMtd && e.m) e.m = kosongkan(e.m);
    });
  }

  /* ---------- kito.json [KITO_AREA_KELOMPOK]: DtD = tanggal terakhir bulan terpilih ---------- */
  var KK = window.KITO_AREA_KELOMPOK;
  if (Array.isArray(KK)) {
    var posisi = {};
    D.B.forEach(function (b, i) { posisi[String(b[0])] = i; });
    var j = D.dates.length - 1;
    KK.forEach(function (r) {
      var i = posisi[String(r.kode)];
      if (pilih !== terbaru && i != null) {
        var q = D.Q[i] && D.Q[i][j];
        r.dtd = { teller: q ? q[0] : null, cs: q ? q[1] : null, all: q ? q[2] : null };
      }
      if (!adaMtd) r.mtd = { teller: null, cs: null, all: null };
    });
  }

  /* ---------- kito.json [KITO_REGION] ---------- */
  var R = window.KITO_REGION;
  if (R) {
    if (Array.isArray(R.tglWaktu)) R.tglWaktu = R.tglWaktu.filter(function (d) { return d.slice(0, 7) === pilih; });
    if (R.queueMetricByDate) R.queueMetricByDate = saringKunci(R.queueMetricByDate);
    R.tanggal = tglAkhir;
    (R.regions || []).concat(R.nasional ? [R.nasional] : []).forEach(function (e) {
      var w = e.waktu;
      if (w) {
        ['d', 'n', 'p', 'w'].forEach(function (k) { if (w[k]) w[k] = saringKunci(w[k]); });
        if (!adaMtd) { w.m = kosongkan(w.m); if (w.mn) w.mn = kosongkan(w.mn); }
      }
      if (arsip && arsip.region) {
        var a = arsip.region.data[e.id];
        if (a) { e.o2o = a.o2o; e.ch = a.ch; }
      }
    });
    if (arsip && arsip.region) {
      R.tglO2O = arsip.region.tglO2O;
      if (R.sumber) R.sumber.o2o = arsip.region.sumberO2O;
    }
  }
})();
