/* Periode bulan: dashboard menampilkan SATU bulan saja (Oktober 2026, November 2026, ...).
   Dimuat setelah semua file data dan sebelum script.js. Bulan dipilih lewat ?bulan=YYYY-MM (atau pilihan terakhir
   di sessionStorage); bawaan = bulan data terbaru. Pergantian bulan memperbarui data dan render tanpa navigasi.

   Yang dipisah per bulan:
   - kito.json [D]        : dates, Q, QP, QN, QW, QD (dipotong ke tanggal bulan terpilih), queueMetricByDate
   - area-waktu     : dates, d/x per area & Region II, metricByDate, tanggal
   - region-data    : tglWaktu, waktu.d/n/p/w per region & nasional, queueMetricByDate, tanggal
   - kelompok area  : DtD = tanggal terakhir bulan terpilih (dari D.Q)
   - O2O & Shifting : bulan lama memakai arsip akhir bulan (kito.json [KITO_ARSIP_BULAN])
   - MTD waktu antri: Oktober 2026 = P90 (laporan lama); mulai November 2026 = P95 (rata-rata P95 harian, kunci "mb"
     per bulan pada area-waktu & kelompok area); bulan tanpa data MTD tampil "–".
   - Utilisasi NBDS : bulan lama memakai arsip NBDS akhir bulan (KITO_ARSIP_BULAN[bulan].nbds); bila bulan terpilih
     belum punya laporan NBDS, tampil laporan NBDS terakhir (DtD & MTD dengan tanggal/bulannya sendiri). */
(function () {
  'use strict';
  if (typeof D === 'undefined' || !Array.isArray(D.dates) || !D.dates.length) return;
  var SEMUA = D.dates.slice();
  var bulanList = SEMUA.map(function (d) { return d.slice(0, 7); }).filter(function (m, i, a) { return a.indexOf(m) === i; }).sort();
  var terbaru = bulanList[bulanList.length - 1];
  var MTD_P90 = '2026-10';                       // bulan yang punya MTD P90 waktu antri di laporan lama
  var bagian = ['D', 'KITO_AREA_WAKTU', 'KITO_AREA_KELOMPOK', 'KITO_AREA_O2O', 'KITO_AREA_NBDS', 'KITO_REGION'];
  var asli = {};
  bagian.forEach(function (k) { if (window[k]) asli[k] = window[k]; });
  asli = JSON.stringify(asli);

  // Pertahankan referensi objek yang dipakai modul tampilan dan indeks cabang/area.
  function salinKe(target, sumber) {
    Object.keys(target).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(sumber, k)) delete target[k]; });
    Object.keys(sumber).forEach(function (k) {
      var v = sumber[k], lama = target[k];
      if (v && typeof v === 'object') {
        if (!lama || typeof lama !== 'object' || Array.isArray(lama) !== Array.isArray(v)) lama = target[k] = Array.isArray(v) ? [] : {};
        salinKe(lama, v);
      } else target[k] = v;
    });
    if (Array.isArray(sumber)) target.length = sumber.length;
  }

  var pilih = null;
  try { pilih = new URLSearchParams(location.search).get('bulan'); } catch (e) {}
  if (!pilih) { try { pilih = sessionStorage.getItem('kito-bulan'); } catch (e) {} }
  if (bulanList.indexOf(pilih) < 0) pilih = terbaru;
  try { sessionStorage.setItem('kito-bulan', pilih); } catch (e) {}

  var namaBulan = function (m, gaya) {
    return new Date(m + '-01T00:00:00').toLocaleDateString('id-ID', gaya === 'pendek' ? { month: 'long' } : { month: 'long', year: 'numeric' });
  };
  function terapkan(m) {
  pilih = m;
  var data = JSON.parse(asli), D = data.D;
  var idx = [];
  SEMUA.forEach(function (d, i) { if (d.slice(0, 7) === pilih) idx.push(i); });
  var tglAkhir = SEMUA[idx[idx.length - 1]];
  var adaMtd = pilih === MTD_P90;

  Object.assign(window.KITO_BULAN, {
    aktif: pilih, terbaru: terbaru, semua: bulanList, tanggalAkhir: tglAkhir,
    nama: namaBulan(pilih), namaPendek: namaBulan(pilih, 'pendek'),
    adaMtdWaktu: adaMtd,
    mtdMetrik: adaMtd ? 'P90' : 'P95',             // Oktober: MTD P90; mulai November: MTD P95 (rata-rata P95 harian)
    mtdLabel: 'MTD ' + namaBulan(pilih, 'pendek'),
  });

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
    if (arsip.areaO2O) data.KITO_AREA_O2O = arsip.areaO2O;
  }

  /* ---------- Utilisasi NBDS: arsip akhir bulan bila bulan terpilih bukan bulan laporan NBDS terakhir ---------- */
  var arsipNb = window.KITO_ARSIP_BULAN && window.KITO_ARSIP_BULAN[pilih] && window.KITO_ARSIP_BULAN[pilih].nbds;
  if (arsipNb && !(data.KITO_AREA_NBDS && data.KITO_AREA_NBDS.bulan === pilih)) {
    D.B.forEach(function (b, i) {
      var m = arsipNb.M[String(b[0])], row = D.M[i];
      if (!m || !row) return;
      for (var k = 0; k < 6; k++) row[4 + k] = m[k];
    });
    D.O = arsipNb.O;
    data.KITO_AREA_NBDS = arsipNb.area;
  } else arsipNb = null;

  /* ---------- kito.json [KITO_AREA_WAKTU] ---------- */
  var KW = data.KITO_AREA_WAKTU;
  if (KW) {
    if (Array.isArray(KW.dates)) KW.dates = KW.dates.filter(function (d) { return d.slice(0, 7) === pilih; });
    KW.tanggal = tglAkhir;
    if (KW.metricByDate) KW.metricByDate = saringKunci(KW.metricByDate);
    (KW.region ? [KW.region] : []).concat(KW.areas || []).forEach(function (e) {
      if (e.d) e.d = saringKunci(e.d);
      if (e.x) e.x = saringKunci(e.x);
      if (!adaMtd) e.m = (e.mb && e.mb[pilih]) || (e.m ? kosongkan(e.m) : e.m);
      delete e.mb;
    });
  }

  /* ---------- kito.json [KITO_AREA_KELOMPOK]: DtD = tanggal terakhir bulan terpilih ---------- */
  var KK = data.KITO_AREA_KELOMPOK;
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
      if (!adaMtd) r.mtd = (r.mb && r.mb[pilih]) || { teller: null, cs: null, all: null };
      delete r.mb;
    });
  }

  /* ---------- kito.json [KITO_REGION] ---------- */
  var R = data.KITO_REGION;
  if (R) {
    if (Array.isArray(R.tglWaktu)) R.tglWaktu = R.tglWaktu.filter(function (d) { return d.slice(0, 7) === pilih; });
    if (R.queueMetricByDate) R.queueMetricByDate = saringKunci(R.queueMetricByDate);
    R.tanggal = tglAkhir;
    (R.regions || []).concat(R.nasional ? [R.nasional] : []).forEach(function (e) {
      var w = e.waktu;
      if (w) {
        ['d', 'n', 'p', 'w'].forEach(function (k) { if (w[k]) w[k] = saringKunci(w[k]); });
        if (!adaMtd) { w.m = (w.mb && w.mb[pilih]) || kosongkan(w.m); if (w.mn) w.mn = kosongkan(w.mn); }
        delete w.mb;
      }
      if (arsip && arsip.region) {
        var a = arsip.region.data[e.id];
        if (a) { e.o2o = a.o2o; e.ch = a.ch; }
      }
    });
    if (arsipNb) {
      var rn = arsipNb.region;
      (R.regions || []).forEach(function (e) { if (rn.data[e.id] !== undefined) e.nbds = rn.data[e.id]; });
      if (R.nasional && rn.data.NASIONAL !== undefined) R.nasional.nbds = rn.data.NASIONAL;
      R.tglNbds = rn.tglNbds; R.bulan = rn.bulan; R.bulanLalu = rn.bulanLalu;
      if (R.sumber) R.sumber.nbds = rn.sumberNbds;
    }
    if (arsip && arsip.region) {
      R.tglO2O = arsip.region.tglO2O;
      if (R.sumber) R.sumber.o2o = arsip.region.sumberO2O;
    }
  }
  bagian.forEach(function (k) { if (data[k]) salinKe(window[k], data[k]); });
  }

  window.KITO_BULAN = {
    ganti: function (m) {
      if (bulanList.indexOf(m) < 0 || m === pilih) return;
      terapkan(m);
      try { sessionStorage.setItem('kito-bulan', m); } catch (e) {}
      try {
        var u = new URL(location.href);
        if (m === terbaru) u.searchParams.delete('bulan'); else u.searchParams.set('bulan', m);
        history.replaceState(null, '', u.toString());
      } catch (e) {}
      if (typeof st !== 'undefined') st.d = D.dates.length - 1;
      var month = document.getElementById('sm');
      if (month) month.value = m;
      window.dispatchEvent(new Event('kito:bulan'));
      if (typeof fill === 'function') fill();
      if (typeof render === 'function') render();
    },
  };
  terapkan(pilih);
})();
