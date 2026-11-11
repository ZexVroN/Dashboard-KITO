<?php
/* Masukan pengguna dari halaman Cabang dashboard: rating aplikasi (1–5 bintang), keluhan, dan keluhan cabang
   (laporan masalah operasional di cabang: jenis masalah, urgensi, waktu kejadian, pelapor wajib).
   Publik : POST /api/feedback
   Admin  : GET /api/feedback · GET /api/feedback/summary · PUT /api/feedback/<id> · GET /api/feedback/export (CSV) · halaman /admin/masukan */
declare(strict_types=1);

const KP_FB_KATEGORI = ['Data tidak sesuai', 'Data terlambat diperbarui', 'Aplikasi lambat / error', 'Tampilan sulit dibaca', 'Notifikasi', 'Login / akses', 'Lainnya'];
const KP_FB_ASPEK = ['Kecepatan', 'Tampilan', 'Akurasi data', 'Kemudahan', 'Kelengkapan', 'Notifikasi'];
const KP_FB_STATUS = ['baru', 'diproses', 'selesai', 'ditolak'];
// keluhan cabang (harus sama dengan KATEGORI_CABANG di assets/js/masukan.js)
const KP_FB_KATEGORI_CABANG = ['Waktu Tunggu Antrian', 'Utilisasi O2O', 'Utilisasi NBDS', 'Aspek Fisik Cabang', 'Akuisisi Inbranch', 'Lainnya'];
const KP_FB_URGENSI = ['rendah', 'sedang', 'tinggi', 'kritis'];
const KP_FB_JENIS = ['rating', 'keluhan', 'cabang', 'cuti'];
// pegawai cuti (harus sama dengan JENIS_CUTI di assets/js/masukan.js)
// hari libur untuk menghitung lama cuti (hari kerja = tanpa Sabtu, Minggu, dan tanggal ini; sama dengan LIBUR di assets/js/masukan.js)
// "MM-DD" berlaku tiap tahun; tambahkan "YYYY-MM-DD" untuk libur nasional / cuti bersama tahun tertentu
const KP_FB_LIBUR = ['01-01', '05-01', '06-01', '08-17', '12-25'];
const KP_FB_JENIS_CUTI = ['Cuti Tahunan', 'Cuti Sakit', 'Cuti Melahirkan', 'Cuti Alasan Penting', 'Cuti Besar', 'Cuti di Luar Tanggungan', 'Lainnya'];

function kp_fb_db(): PDO {
    static $siap = false;
    $db = kp_db();
    if ($siap) return $db;
    $db->exec("
      CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, jenis TEXT NOT NULL, rating INTEGER, kategori TEXT, aspek TEXT, pesan TEXT,
        nama TEXT, kontak TEXT, device_id TEXT, jabatan TEXT, area TEXT, kode TEXT, cabang TEXT, tanggal_data TEXT, app TEXT, platform TEXT, browser TEXT,
        versi TEXT, ip TEXT, status TEXT NOT NULL DEFAULT 'baru', catatan TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_fb_waktu ON feedback(created_at);
      CREATE INDEX IF NOT EXISTS idx_fb_status ON feedback(jenis, status);
    ");
    // kolom tambahan untuk keluhan cabang (database lama ditambah otomatis)
    $ada = $db->query('PRAGMA table_info(feedback)')->fetchAll(PDO::FETCH_COLUMN, 1);
    foreach (['urgensi' => 'TEXT', 'waktu_kejadian' => 'TEXT', 'akun' => 'TEXT', 'pengguna' => 'TEXT',
        'cuti_jabatan' => 'TEXT', 'cuti_mulai' => 'TEXT', 'cuti_selesai' => 'TEXT', 'cuti_pengganti' => 'TEXT', 'cuti_hari' => 'INTEGER'] as $kol => $tipe) if (!in_array($kol, $ada, true)) $db->exec("ALTER TABLE feedback ADD COLUMN $kol $tipe");
    // lama cuti hari kerja untuk data cuti yang belum punya cuti_hari
    $lama = $db->query("SELECT id, cuti_mulai, cuti_selesai FROM feedback WHERE jenis = 'cuti' AND cuti_hari IS NULL AND cuti_mulai IS NOT NULL LIMIT 500")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($lama as $r) $db->prepare('UPDATE feedback SET cuti_hari = ? WHERE id = ?')->execute([kp_fb_hari_kerja($r['cuti_mulai'], $r['cuti_selesai']), $r['id']]);
    $siap = true;
    return $db;
}

/** jumlah hari kerja dari mulai s.d. selesai (YYYY-MM-DD), tanpa Sabtu, Minggu, dan KP_FB_LIBUR */
function kp_fb_hari_kerja(?string $mulai, ?string $selesai): int {
    if (!$mulai || !$selesai || $selesai < $mulai) return 0;
    $n = 0; $t = strtotime($mulai . ' 00:00:00 UTC'); $akhir = strtotime($selesai . ' 00:00:00 UTC');
    for ($i = 0; $t <= $akhir && $i < 400; $t += 86400, $i++) {
        $iso = gmdate('Y-m-d', $t); $h = (int)gmdate('w', $t);
        if ($h === 0 || $h === 6 || in_array(substr($iso, 5), KP_FB_LIBUR, true) || in_array($iso, KP_FB_LIBUR, true)) continue;
        $n++;
    }
    return $n;
}

function kp_fb_teks($v, int $max): ?string {
    if ($v === null || is_array($v) || is_object($v)) return null;
    $s = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/', '', str_replace("\r\n", "\n", (string)$v)));
    return $s === '' ? null : mb_substr($s, 0, $max);
}

function kp_fb_simpan(array $b): array {
    $jenis = $b['jenis'] ?? '';
    if (!in_array($jenis, KP_FB_JENIS, true)) return [400, 'jenis harus rating, keluhan, cabang, atau cuti'];
    if ($jenis !== 'rating' && isset($b['kontak']) && $b['kontak'] !== '') {
        if (!is_string($b['kontak']) || !preg_match('/^[0-9]{1,80}$/D', $b['kontak'])) return [400, 'NIP hanya boleh berisi angka (maksimal 80 digit)'];
    }
    $rating = null; $kategori = null; $aspek = null; $urgensi = null; $waktuKejadian = null; $cuti = [null, null, null, null, null];
    $pesan = kp_fb_teks($b['pesan'] ?? null, 2000);
    if ($jenis === 'rating') {
        $rating = (int)($b['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) return [400, 'rating harus 1 sampai 5'];
        if (is_array($b['aspek'] ?? null)) $aspek = implode(', ', array_values(array_intersect(KP_FB_ASPEK, array_map('strval', $b['aspek'])))) ?: null;
    } elseif ($jenis === 'keluhan') {
        $kategori = in_array($b['kategori'] ?? '', KP_FB_KATEGORI, true) ? $b['kategori'] : 'Lainnya';
        if ($pesan === null || mb_strlen($pesan) < 5) return [400, 'tuliskan keluhan minimal 5 karakter'];
    } elseif ($jenis === 'cuti') {   // pegawai cuti
        if (kp_fb_teks($b['kode'] ?? null, 20) === null) return [400, 'pilih cabang terlebih dahulu'];
        if (kp_fb_teks($b['nama'] ?? null, 80) === null) return [400, 'nama pegawai wajib diisi'];
        if (!preg_match('/^[0-9]{3,20}$/D', (string)($b['kontak'] ?? ''))) return [400, 'NIP pegawai wajib diisi (angka)'];
        if (!in_array($b['kategori'] ?? '', KP_FB_JENIS_CUTI, true)) return [400, 'pilih alasan tidak masuk'];
        $kategori = $b['kategori'];
        $tgl = function ($v) { return is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) && strtotime($v . ' 00:00:00 UTC') !== false ? $v : null; };
        $mulai = $tgl($b['cuti_mulai'] ?? null); $selesai = $tgl($b['cuti_selesai'] ?? null);
        if (!$mulai || !$selesai) return [400, 'tanggal mulai dan selesai cuti wajib diisi'];
        if ($selesai < $mulai) return [400, 'tanggal selesai tidak boleh sebelum tanggal mulai'];
        if ((strtotime($selesai) - strtotime($mulai)) / 86400 > 366) return [400, 'lama cuti maksimal 1 tahun'];
        $hariKerja = kp_fb_hari_kerja($mulai, $selesai);   // dihitung ulang di server (tidak memakai angka dari perangkat)
        if ($hariKerja < 1) return [400, 'rentang tanggal cuti hanya berisi hari libur'];
        $cuti = [kp_fb_teks($b['cuti_jabatan'] ?? null, 60), $mulai, $selesai, kp_fb_teks($b['cuti_pengganti'] ?? null, 80), $hariKerja];
    } else {   // keluhan cabang
        if (kp_fb_teks($b['kode'] ?? null, 20) === null) return [400, 'pilih cabang terlebih dahulu'];
        $kategori = in_array($b['kategori'] ?? '', KP_FB_KATEGORI_CABANG, true) ? $b['kategori'] : 'Lainnya';
        $urgensi = in_array($b['urgensi'] ?? '', KP_FB_URGENSI, true) ? $b['urgensi'] : 'sedang';
        if ($pesan === null || mb_strlen($pesan) < 10) return [400, 'uraikan masalah cabang minimal 10 karakter'];
        if (kp_fb_teks($b['nama'] ?? null, 80) === null || kp_fb_teks($b['kontak'] ?? null, 80) === null) return [400, 'nama pelapor dan NIP wajib diisi'];
        // waktu kejadian dari perangkat (ISO dengan zona waktu) disimpan UTC; tidak boleh di masa depan atau lebih dari 30 hari lalu
        $t = strtotime((string)($b['waktu_kejadian'] ?? ''));
        if ($t !== false && $t <= time() + 300 && $t >= time() - 30 * 86400) $waktuKejadian = gmdate('Y-m-d H:i:s', $t);
    }
    $dev = preg_match('/^[A-Za-z0-9_-]{8,64}$/', (string)($b['d'] ?? '')) ? $b['d'] : null;
    // satu rating per perangkat per hari: rating baru menggantikan rating hari itu
    $db = kp_fb_db();
    $ua = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 400); [$pl, $br] = kp_detect($ua);
    $nilai = [$jenis, $rating, $kategori, $aspek, $pesan, kp_fb_teks($b['nama'] ?? null, 80), kp_fb_teks($b['kontak'] ?? null, 80), $dev,
        ($j = kp_fb_teks($b['jabatan'] ?? null, 20)) ? strtoupper($j) : null, kp_fb_teks($b['area'] ?? null, 80), kp_fb_teks($b['kode'] ?? null, 20),
        kp_fb_teks($b['cabang'] ?? null, 120), kp_fb_teks($b['tanggal'] ?? null, 10),
        in_array($b['app'] ?? '', ['web', 'pwa', 'apk'], true) ? $b['app'] : 'web', $pl, $br, kp_fb_teks($b['versi'] ?? null, 40), kp_ip(), $urgensi, $waktuKejadian,
        // akun login pelapor (mis. "bom:11325"): keluhan hanya dapat dibaca akun ini + pembalas sesuai cakupan
        $jenis !== 'rating' && function_exists('kp_akun_valid') ? kp_akun_valid($b['akun'] ?? null) : null,
        kp_fb_teks($b['pengguna'] ?? null, 80),   // nama pengguna akun login yang menginput (null = tanpa login)
        $cuti[0], $cuti[1], $cuti[2], $cuti[3], $cuti[4]];
    if ($jenis === 'rating' && $dev) {
        $q = $db->prepare("SELECT id FROM feedback WHERE jenis = 'rating' AND device_id = ? AND date(created_at, '+7 hours') = date('now', '+7 hours')");
        $q->execute([$dev]);
        if ($id = $q->fetchColumn()) {
            $db->prepare("UPDATE feedback SET rating = ?, aspek = ?, pesan = ?, nama = COALESCE(?, nama), kontak = COALESCE(?, kontak), pengguna = COALESCE(?, pengguna),
                kode = COALESCE(?, kode), cabang = COALESCE(?, cabang), area = COALESCE(?, area), updated_at = datetime('now') WHERE id = ?")
               ->execute([$rating, $aspek, $pesan, $nilai[5], $nilai[6], $nilai[21], $nilai[10], $nilai[11], $nilai[9], $id]);
            return [200, ['ok' => true, 'id' => (int)$id, 'diperbarui' => true]];
        }
    }
    $db->prepare('INSERT INTO feedback (jenis, rating, kategori, aspek, pesan, nama, kontak, device_id, jabatan, area, kode, cabang, tanggal_data, app, platform, browser, versi, ip, urgensi, waktu_kejadian, akun, pengguna,
        cuti_jabatan, cuti_mulai, cuti_selesai, cuti_pengganti, cuti_hari) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute($nilai);
    return [201, ['ok' => true, 'id' => (int)$db->lastInsertId()]];
}

/** rentang waktu (UTC) dari filter admin: dari & sampai = tanggal WIB (YYYY-MM-DD), atau days = N hari terakhir */
function kp_fb_rentang(array $g): array {
    $tgl = function ($v) { return is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) && strtotime($v . ' 00:00:00 UTC') !== false ? $v : null; };
    $dari = $tgl($g['dari'] ?? null); $sampai = $tgl($g['sampai'] ?? null);
    if ($dari || $sampai) {
        $dari = $dari ?: '2000-01-01'; $sampai = $sampai ?: gmdate('Y-m-d', time() + 7 * 3600);
        if ($dari > $sampai) [$dari, $sampai] = [$sampai, $dari];
        // 00:00 WIB = 17:00 UTC hari sebelumnya
        return [gmdate('Y-m-d H:i:s', strtotime($dari . ' 00:00:00 UTC') - 7 * 3600), gmdate('Y-m-d H:i:s', strtotime($sampai . ' 00:00:00 UTC') + 17 * 3600), $dari, $sampai];
    }
    $hari = max(1, min(3650, (int)($g['days'] ?? 90)));
    return [gmdate('Y-m-d H:i:s', time() - $hari * 86400), gmdate('Y-m-d H:i:s', time() + 86400), null, null];
}

function kp_fb_list(array $g): array {
    $db = kp_fb_db();
    [$mulai, $akhir] = kp_fb_rentang($g);
    $w = ['created_at >= ?', 'created_at < ?']; $p = [$mulai, $akhir];
    if (in_array($g['jenis'] ?? '', KP_FB_JENIS, true)) { $w[] = 'jenis = ?'; $p[] = $g['jenis']; }
    if (in_array($g['urgensi'] ?? '', KP_FB_URGENSI, true)) { $w[] = 'urgensi = ?'; $p[] = $g['urgensi']; }
    if (in_array($g['status'] ?? '', KP_FB_STATUS, true)) { $w[] = 'status = ?'; $p[] = $g['status']; }
    if (($q = trim((string)($g['q'] ?? ''))) !== '') {
        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $q) . '%';
        $w[] = "(pesan LIKE ? ESCAPE '\\' OR kategori LIKE ? ESCAPE '\\' OR area LIKE ? ESCAPE '\\' OR kode LIKE ? ESCAPE '\\' OR cabang LIKE ? ESCAPE '\\' OR nama LIKE ? ESCAPE '\\' OR jabatan LIKE ? ESCAPE '\\' OR kontak LIKE ? ESCAPE '\\')";
        array_push($p, ...array_fill(0, 8, $like));   // kontak = NIP pelapor
    }
    $lim = max(1, min(5000, (int)($g['limit'] ?? 500)));
    $urut = ($g['urut'] ?? '') === 'lama' ? 'ASC' : 'DESC';   // terbaru dulu (bawaan) / terlama dulu
    $st = $db->prepare('SELECT * FROM feedback WHERE ' . implode(' AND ', $w) . " ORDER BY created_at $urut, id $urut LIMIT $lim");
    $st->execute($p);
    return array_map(function ($r) { $r['id'] = (int)$r['id']; $r['rating'] = $r['rating'] === null ? null : (int)$r['rating']; return $r; }, $st->fetchAll());
}

function kp_fb_summary($g): array {
    $db = kp_fb_db();
    if (!is_array($g)) $g = ['days' => (int)$g];
    [$mulai, $akhir, $dari, $sampai] = kp_fb_rentang($g);
    $hari = (int)($g['days'] ?? 90);
    // semua kueri ringkasan memakai rentang yang sama
    $rg = function (string $sql) { return str_replace("created_at >= datetime('now', ?)", 'created_at >= ? AND created_at < ?', $sql); };
    $satu = function (string $sql) use ($db, $mulai, $akhir, $rg) { $q = $db->prepare($rg($sql)); $q->execute([$mulai, $akhir]); return $q->fetch(); };
    $banyak = function (string $sql) use ($db, $mulai, $akhir, $rg) { $q = $db->prepare($rg($sql)); $q->execute([$mulai, $akhir]);
        return array_map(function ($r) { foreach (['n', 'rating', 'bintang'] as $k) if (isset($r[$k]) && is_numeric($r[$k])) $r[$k] = $k === 'rating' ? round((float)$r[$k], 2) : (int)$r[$k]; return $r; }, $q->fetchAll()); };
    $r = $satu("SELECT COUNT(*) n, AVG(rating) rata, SUM(rating >= 4) puas, SUM(rating <= 2) kecewa FROM feedback WHERE jenis = 'rating' AND created_at >= datetime('now', ?)");
    $k = $satu("SELECT COUNT(*) n, SUM(status = 'baru') baru, SUM(status = 'diproses') diproses, SUM(status = 'selesai') selesai FROM feedback WHERE jenis = 'keluhan' AND created_at >= datetime('now', ?)");
    // aspek disimpan "A, B": dihitung di PHP
    $aspek = [];
    foreach ($banyak("SELECT aspek, rating FROM feedback WHERE jenis = 'rating' AND aspek IS NOT NULL AND created_at >= datetime('now', ?)") as $row)
        foreach (explode(', ', $row['aspek']) as $a) { $aspek[$a] = $aspek[$a] ?? ['nama' => $a, 'n' => 0, 'total' => 0]; $aspek[$a]['n']++; $aspek[$a]['total'] += $row['rating']; }
    $aspek = array_values(array_map(function ($a) { return ['nama' => $a['nama'], 'n' => $a['n'], 'rating' => round($a['total'] / $a['n'], 2)]; }, $aspek));
    usort($aspek, function ($a, $b) { return $b['n'] <=> $a['n']; });
    $c = $satu("SELECT COUNT(*) n, SUM(status = 'baru') baru, SUM(status = 'diproses') diproses, SUM(status = 'selesai') selesai,
        SUM(urgensi IN ('tinggi', 'kritis') AND status IN ('baru', 'diproses')) mendesak FROM feedback WHERE jenis = 'cabang' AND created_at >= datetime('now', ?)");
    $cu = $satu("SELECT COUNT(*) n, COUNT(DISTINCT kontak) pegawai, SUM(cuti_hari) hari FROM feedback WHERE jenis = 'cuti' AND created_at >= datetime('now', ?)");
    $hariIni = gmdate('Y-m-d', time() + 7 * 3600);
    $qc = $db->prepare("SELECT COUNT(DISTINCT COALESCE(kontak, id)) FROM feedback WHERE jenis = 'cuti' AND status <> 'ditolak' AND cuti_mulai <= ? AND cuti_selesai >= ?");
    $qc->execute([$hariIni, $hariIni]);
    $n = (int)$r['n'];
    return [
        'hari' => $hari, 'dari' => $dari, 'sampai' => $sampai,
        'rating' => ['n' => $n, 'rata' => $n ? round((float)$r['rata'], 2) : null, 'puasPersen' => $n ? round($r['puas'] / $n * 100) : null, 'kecewaPersen' => $n ? round($r['kecewa'] / $n * 100) : null],
        'keluhan' => ['n' => (int)$k['n'], 'baru' => (int)$k['baru'], 'diproses' => (int)$k['diproses'], 'selesai' => (int)$k['selesai']],
        'cuti' => ['n' => (int)$cu['n'], 'pegawai' => (int)$cu['pegawai'], 'hari' => (int)$cu['hari'], 'hariIni' => (int)$qc->fetchColumn(),
            'perJenis' => $banyak("SELECT kategori nama, COUNT(*) n FROM feedback WHERE jenis = 'cuti' AND created_at >= datetime('now', ?) GROUP BY 1 ORDER BY 2 DESC")],
        'cabang' => ['n' => (int)$c['n'], 'baru' => (int)$c['baru'], 'diproses' => (int)$c['diproses'], 'selesai' => (int)$c['selesai'], 'mendesak' => (int)$c['mendesak']],
        'perKategoriCabang' => $banyak("SELECT kategori nama, COUNT(*) n FROM feedback WHERE jenis = 'cabang' AND created_at >= datetime('now', ?) GROUP BY 1 ORDER BY 2 DESC"),
        'perUrgensi' => $banyak("SELECT urgensi nama, COUNT(*) n FROM feedback WHERE jenis = 'cabang' AND created_at >= datetime('now', ?) GROUP BY 1
            ORDER BY CASE urgensi WHEN 'kritis' THEN 1 WHEN 'tinggi' THEN 2 WHEN 'sedang' THEN 3 ELSE 4 END"),
        'perCabangKeluhan' => $banyak("SELECT kode || ' · ' || COALESCE(cabang, '') nama, COUNT(*) n FROM feedback WHERE jenis = 'cabang' AND created_at >= datetime('now', ?)
            GROUP BY 1 ORDER BY 2 DESC LIMIT 50"),
        'sebaranBintang' => $banyak("SELECT rating bintang, COUNT(*) n FROM feedback WHERE jenis = 'rating' AND created_at >= datetime('now', ?) GROUP BY rating ORDER BY rating DESC"),
        'aspek' => $aspek,
        'perKategori' => $banyak("SELECT kategori nama, COUNT(*) n FROM feedback WHERE jenis = 'keluhan' AND created_at >= datetime('now', ?) GROUP BY 1 ORDER BY 2 DESC"),
        'perArea' => $banyak("SELECT COALESCE(area, 'Tidak diketahui') nama, COUNT(*) n, AVG(rating) rating FROM feedback WHERE created_at >= datetime('now', ?) GROUP BY 1 ORDER BY 2 DESC LIMIT 50"),
        'perCabang' => $banyak("SELECT COALESCE(kode || ' · ' || COALESCE(cabang, ''), 'Tidak diketahui') nama, COUNT(*) n, AVG(rating) rating, SUM(jenis = 'keluhan') keluhan
            FROM feedback WHERE created_at >= datetime('now', ?) GROUP BY 1 ORDER BY 2 DESC LIMIT 50"),
        'perHari' => $banyak("SELECT date(created_at, '+7 hours') tanggal, COUNT(*) n, AVG(rating) rating FROM feedback WHERE created_at >= datetime('now', ?) GROUP BY 1 ORDER BY 1"),
    ];
}

/** admin: hapus masukan (beserta balasan tindak lanjutnya); mengembalikan jumlah yang terhapus */
function kp_fb_hapus(array $ids): int {
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids), function ($x) { return $x > 0; })));
    if (!$ids) return 0;
    $ids = array_slice($ids, 0, 1000);
    $db = kp_fb_balasan_db();
    $tanda = implode(',', array_fill(0, count($ids), '?'));
    $db->beginTransaction();
    $db->prepare("DELETE FROM feedback_balasan WHERE feedback_id IN ($tanda)")->execute($ids);
    $q = $db->prepare("DELETE FROM feedback WHERE id IN ($tanda)"); $q->execute($ids);
    $db->commit();
    return $q->rowCount();
}

function kp_fb_update(int $id, array $b): bool {
    $set = []; $p = [];
    if (array_key_exists('status', $b)) { if (!in_array($b['status'], KP_FB_STATUS, true)) return false; $set[] = 'status = ?'; $p[] = $b['status']; }
    if (array_key_exists('catatan', $b)) { $set[] = 'catatan = ?'; $p[] = kp_fb_teks($b['catatan'], 1000); }
    if (!$set) return false;
    $p[] = $id;
    $q = kp_fb_db()->prepare('UPDATE feedback SET ' . implode(', ', $set) . ", updated_at = datetime('now') WHERE id = ?"); $q->execute($p);
    return $q->rowCount() > 0;
}

function kp_fb_export(array $g): array {
    $wib = function ($s) { return $s ? gmdate('Y-m-d H:i:s', strtotime($s . ' UTC') + 7 * 3600) : ''; };
    $nmJenis = ['rating' => 'Rating', 'keluhan' => 'Keluhan aplikasi', 'cabang' => 'Keluhan cabang', 'cuti' => 'Pegawai cuti'];
    $rows = [['No', 'Waktu lapor (WIB)', 'Jenis', 'Rating', 'Kategori keluhan', 'Urgensi', 'Waktu kejadian (WIB)', 'Aspek dinilai', 'Pesan', 'Nama pelapor', 'NIP', 'Jabatan', 'Area', 'Kode cabang', 'Cabang',
              'Tanggal data dilihat', 'Aplikasi', 'OS', 'Browser', 'Status', 'Catatan admin', 'Diperbarui (WIB)', 'Jumlah balasan', 'Balasan tindak lanjut', 'Nama pengguna (akun login)',
              'Jabatan pegawai cuti', 'Mulai cuti', 'Selesai cuti', 'Lama cuti (hari kerja)', 'Pegawai pengganti']];
    $teksBalasan = function (array $bs) use ($wib) {
        return implode("\n", array_map(function ($b) use ($wib) {
            return '[' . $wib($b['created_at']) . '] ' . $b['jabatan'] . ($b['nama'] ? ' · ' . $b['nama'] : '') . ($b['status'] ? ' (-> ' . $b['status'] . ')' : '') . ': ' . $b['pesan'];
        }, $bs));
    };
    foreach (kp_fb_lengkapi(kp_fb_list($g + ['limit' => 5000])) as $r) $rows[] = [$r['id'], $wib($r['created_at']), $nmJenis[$r['jenis']] ?? $r['jenis'], $r['rating'], $r['kategori'],
        $r['urgensi'], $wib($r['waktu_kejadian']), $r['aspek'], $r['pesan'],
        $r['nama'], $r['kontak'], $r['jabatan'], $r['area'], $r['kode'], $r['cabang'], $r['tanggal_data'], $r['app'], $r['platform'], $r['browser'], $r['status'], $r['catatan'], $wib($r['updated_at']), count($r['balasan']), $teksBalasan($r['balasan']), $r['pengguna'] ?? ($r['jenis'] === 'rating' ? 'Tanpa login' : ''),
        $r['cuti_jabatan'] ?? '', $r['cuti_mulai'] ?? '', $r['cuti_selesai'] ?? '',
        !empty($r['cuti_mulai']) ? ($r['cuti_hari'] !== null ? (int)$r['cuti_hari'] : kp_fb_hari_kerja($r['cuti_mulai'], $r['cuti_selesai'])) : '', $r['cuti_pengganti'] ?? ''];
    return ['masukan-' . ($g['jenis'] ?? 'semua') . '-' . gmdate('Ymd-Hi', time() + 7 * 3600) . '.csv', $rows];
}

/* ---------- tindak lanjut di kotak 🔔 dashboard ----------
   Hanya KELUHAN CABANG yang masuk ke kotak 🔔 (kotak masuk pembalas & "Keluhan saya"); keluhan aplikasi hanya di backend admin.
   Privasi: keluhan hanya dapat dibaca akun pelapor (kolom akun, mis. BOM-BOS "bom:<kode>") dan pembalas sesuai cakupan.
   Login  : POST /api/feedback/saya {jabatan, cabang?, area?, hash} -> keluhan yang dikirim akun ini + balasannya
            (NIP pelapor, IP, dan data perangkat tidak ditampilkan)
   Login  : POST /api/feedback/masuk {jabatan, area?, hash}  -> kotak masuk keluhan sesuai cakupan pengguna
            POST /api/feedback/<id>/balas {jabatan, area?, hash, pesan, status?, nama?}
            hanya jabatan KP_FB_PEMBALAS; password dicek lewat akun login (lib/akun.php).
   Cakupan: ROH & SQO Region = semua keluhan Region II; ASM & SQO Area = hanya keluhan dari cabang di areanya
            (area akun = kunci area KITO_ASM yang dipilih saat login, dicocokkan dengan kolom area keluhan). */
const KP_FB_PEMBALAS = ['roh' => 'ROH', 'sqor' => 'SQO Region', 'sqoa' => 'SQO Area', 'asm' => 'ASM'];

function kp_fb_balasan_db(): PDO {
    static $siap = false;
    $db = kp_fb_db();
    if (!$siap) {
        $db->exec("CREATE TABLE IF NOT EXISTS feedback_balasan (id INTEGER PRIMARY KEY AUTOINCREMENT, feedback_id INTEGER NOT NULL,
            jabatan TEXT NOT NULL, nama TEXT, pesan TEXT NOT NULL, status TEXT, ip TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
          CREATE INDEX IF NOT EXISTS idx_fbb_fb ON feedback_balasan(feedback_id, id);");
        $siap = true;
    }
    return $db;
}

/** kunci area seperti KITO_ASM: "AREA PALEMBANG ARIEF" / "PALEMBANG ARIEF" -> "PALEMBANGARIEF" */
function kp_fb_kunci_area(?string $s): string {
    return preg_replace('/[^A-Z0-9]/', '', preg_replace('/^\s*AREA\s+/', '', strtoupper((string)$s)));
}

/** kunci area sebenarnya dari kode cabang (data/kito.json D.B = [kode, nama, area]); cadangan: kolom area keluhan */
function kp_fb_area_keluhan(array $r): string {
    static $peta = null;
    if ($peta === null) {
        $peta = [];
        $raw = @file_get_contents(KP_DIR . '/../data/kito.json');
        $j = $raw ? json_decode($raw, true) : null;
        foreach ($j['D']['B'] ?? [] as $b) $peta[(string)$b[0]] = kp_fb_kunci_area((string)($b[2] ?? ''));
    }
    return $peta[(string)($r['kode'] ?? '')] ?? kp_fb_kunci_area($r['area'] ?? '');
}

/** cek akun pembalas; mengembalikan [jabatan, kunci area (null = seluruh Region II)] */
function kp_fb_cakupan(array $b): array {
    $jab = strtolower(trim((string)($b['jabatan'] ?? '')));
    if (!isset(KP_FB_PEMBALAS[$jab])) kp_fail(403, 'hanya ROH, SQO Region, SQO Area, dan ASM yang dapat membalas');
    [$kunci] = kp_akun_cek($b);   // gagal -> 401
    if ($jab === 'roh' || $jab === 'sqor') return [$jab, null];
    $area = strpos($kunci, ':') !== false ? substr($kunci, strpos($kunci, ':') + 1) : '';
    if ($area === '') kp_fail(403, 'login ulang dengan memilih nama dan area ' . KP_FB_PEMBALAS[$jab]);
    return [$jab, $area];
}

/** tambahkan daftar balasan ke tiap keluhan */
function kp_fb_lengkapi(array $rows): array {
    if (!$rows) return [];
    $db = kp_fb_balasan_db();
    $ids = array_map(function ($r) { return (int)$r['id']; }, $rows);
    $per = [];
    foreach (array_chunk($ids, 500) as $pot) {   // dipecah agar tidak melewati batas variabel SQLite
        $b = $db->prepare('SELECT id, feedback_id, jabatan, nama, pesan, status, created_at FROM feedback_balasan WHERE feedback_id IN (' . implode(',', array_fill(0, count($pot), '?')) . ') ORDER BY id');
        $b->execute($pot);
        foreach ($b->fetchAll(PDO::FETCH_ASSOC) as $x) { $fid = (int)$x['feedback_id']; unset($x['feedback_id']); $x['id'] = (int)$x['id']; $per[$fid][] = $x; }
    }
    foreach ($rows as &$r) { $r['id'] = (int)$r['id']; $r['balasan'] = $per[$r['id']] ?? []; }
    return $rows;
}

const KP_FB_KOLOM_PUBLIK = 'id, jenis, kategori, urgensi, waktu_kejadian, pesan, nama, jabatan, area, kode, cabang, status, created_at, updated_at';

/** kotak masuk pembalas: keluhan cabang & aplikasi 120 hari terakhir dalam cakupan, yang belum selesai di atas */
function kp_fb_masuk(array $b): array {
    [$jab, $area] = kp_fb_cakupan($b);
    $q = kp_fb_balasan_db()->query("SELECT " . KP_FB_KOLOM_PUBLIK . " FROM feedback WHERE jenis = 'cabang'
        AND created_at >= datetime('now', '-120 days') ORDER BY (status IN ('baru', 'diproses')) DESC, id DESC LIMIT 2000");
    $rows = [];
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
        if ($area !== null && kp_fb_area_keluhan($r) !== $area) continue;
        $rows[] = $r;
        if (count($rows) >= 60) break;
    }
    return ['ok' => true, 'cakupan' => $area ?? 'REGION', 'keluhan' => kp_fb_lengkapi($rows)];
}

/** rencana pegawai tidak masuk (data Pegawai Cuti): cuti yang sedang berjalan / akan datang (60 hari).
    Penerima HANYA: ASM & SQO Area area cabang yang bersangkutan, SQO Region, dan ROH.
    Akun lain (BOM-BOS, TOH, ATOM, atau ASM/SQO Area tanpa pilihan area) hanya melihat rencana yang dikirim akunnya sendiri. */
function kp_fb_rencana_cuti(array $b): array {
    [$kunci] = kp_akun_cek($b);   // gagal -> 401
    [$jab, $sub] = array_pad(explode(':', $kunci, 2), 2, '');
    $area = null; $milik = null;
    if ($jab === 'roh' || $jab === 'sqor') { /* seluruh Region II */ }
    elseif (($jab === 'asm' || $jab === 'sqoa') && $sub !== '') $area = $sub;
    else $milik = $kunci;   // bukan penerima: hanya rencana yang dikirim akun ini
    $hariIni = gmdate('Y-m-d', time() + 7 * 3600); $batas = gmdate('Y-m-d', time() + 7 * 3600 + 60 * 86400);
    $sql = "SELECT id, kode, cabang, area, nama, cuti_jabatan, kategori, cuti_mulai, cuti_selesai, cuti_hari, cuti_pengganti, status, pesan
        FROM feedback WHERE jenis = 'cuti' AND status <> 'ditolak' AND cuti_selesai >= ? AND cuti_mulai <= ?" . ($milik ? ' AND akun = ?' : '') . "
        ORDER BY cuti_mulai, cuti_selesai, id LIMIT 1000";
    $q = kp_fb_db()->prepare($sql); $q->execute($milik ? [$hariIni, $batas, $milik] : [$hariIni, $batas]);
    $rows = [];
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
        if ($area !== null && kp_fb_area_keluhan($r) !== $area) continue;
        $r['id'] = (int)$r['id']; $r['cuti_hari'] = $r['cuti_hari'] === null ? null : (int)$r['cuti_hari'];
        $rows[] = $r;
        if (count($rows) >= 100) break;
    }
    return ['ok' => true, 'cakupan' => $milik ? 'SAYA' : ($area ?? 'REGION'), 'hariIni' => $hariIni, 'cuti' => $rows];
}

/** keluhan milik akun login (pelapor) */
function kp_fb_saya(array $b): array {
    [$kunci] = kp_akun_cek($b);   // gagal -> 401
    $q = kp_fb_balasan_db()->prepare("SELECT " . KP_FB_KOLOM_PUBLIK . " FROM feedback WHERE akun = ? AND jenis = 'cabang'
        AND created_at >= datetime('now', '-120 days') ORDER BY id DESC LIMIT 40");
    $q->execute([$kunci]);
    return ['ok' => true, 'keluhan' => kp_fb_lengkapi($q->fetchAll(PDO::FETCH_ASSOC))];
}

function kp_fb_balas(int $id, array $b): array {
    [$jab, $area] = kp_fb_cakupan($b);
    $pesan = kp_fb_teks($b['pesan'] ?? null, 1000);
    if ($pesan === null) kp_fail(400, 'isi balasan wajib diisi');
    $status = $b['status'] ?? null;
    if ($status !== null && $status !== '' && !in_array($status, ['diproses', 'selesai', 'ditolak'], true)) kp_fail(400, 'status tidak valid');
    $db = kp_fb_balasan_db();
    $ada = $db->prepare("SELECT status, area, kode FROM feedback WHERE id = ? AND jenis = 'cabang'"); $ada->execute([$id]);
    $fb = $ada->fetch(PDO::FETCH_ASSOC);
    if (!$fb) kp_fail(404, 'keluhan tidak ditemukan');
    if ($area !== null && kp_fb_area_keluhan($fb) !== $area) kp_fail(403, 'keluhan ini dari area lain; hanya ' . KP_FB_PEMBALAS[$jab] . ' area tersebut yang dapat membalas');
    $lama = $fb['status'];
    $baru = $status ?: ($lama === 'baru' ? 'diproses' : null);   // balasan pertama otomatis menandai "diproses"
    $nama = kp_fb_teks($b['nama'] ?? null, 80);
    $db->prepare('INSERT INTO feedback_balasan (feedback_id, jabatan, nama, pesan, status, ip) VALUES (?, ?, ?, ?, ?, ?)')
       ->execute([$id, KP_FB_PEMBALAS[$jab], $nama, $pesan, $baru, kp_ip()]);
    if ($baru && $baru !== $lama) $db->prepare("UPDATE feedback SET status = ?, updated_at = datetime('now') WHERE id = ?")->execute([$baru, $id]);
    return ['ok' => true, 'status' => $baru ?: $lama];
}
