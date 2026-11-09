<?php
/* Masukan pengguna dari halaman Cabang dashboard: rating aplikasi (1–5 bintang) dan keluhan.
   Publik : POST /api/feedback
   Admin  : GET /api/feedback · GET /api/feedback/summary · PUT /api/feedback/<id> · GET /api/feedback/export (CSV) · halaman /admin/masukan */
declare(strict_types=1);

// kategori keluhan data Inbranch cabang (harus sama dengan KATEGORI di assets/js/masukan.js)
const KP_FB_KATEGORI = ['Waktu tunggu (P95/P100) tidak sesuai', 'Waktu layanan Teller/CS tidak sesuai', 'Jumlah antrian / transaksi tidak sesuai',
    'Data reservasi (O2O) tidak sesuai', 'Data cabang kosong / tidak muncul', 'Data belum diperbarui', 'Nama / kode / area cabang salah', 'Lainnya'];
const KP_FB_ASPEK = ['Kecepatan', 'Tampilan', 'Akurasi data', 'Kemudahan', 'Kelengkapan', 'Notifikasi'];
const KP_FB_STATUS = ['baru', 'diproses', 'selesai', 'ditolak'];

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
    $siap = true;
    return $db;
}

function kp_fb_teks($v, int $max): ?string {
    if ($v === null || is_array($v) || is_object($v)) return null;
    $s = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/', '', str_replace("\r\n", "\n", (string)$v)));
    return $s === '' ? null : mb_substr($s, 0, $max);
}

function kp_fb_simpan(array $b): array {
    $jenis = $b['jenis'] ?? '';
    if (!in_array($jenis, ['rating', 'keluhan'], true)) return [400, 'jenis harus rating atau keluhan'];
    $rating = null; $kategori = null; $aspek = null;
    $pesan = kp_fb_teks($b['pesan'] ?? null, 2000);
    if ($jenis === 'rating') {
        $rating = (int)($b['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) return [400, 'rating harus 1 sampai 5'];
        if (is_array($b['aspek'] ?? null)) $aspek = implode(', ', array_values(array_intersect(KP_FB_ASPEK, array_map('strval', $b['aspek'])))) ?: null;
    } else {
        $kategori = in_array($b['kategori'] ?? '', KP_FB_KATEGORI, true) ? $b['kategori'] : 'Lainnya';
        if ($pesan === null || mb_strlen($pesan) < 5) return [400, 'tuliskan keluhan minimal 5 karakter'];
    }
    $dev = preg_match('/^[A-Za-z0-9_-]{8,64}$/', (string)($b['d'] ?? '')) ? $b['d'] : null;
    // satu rating per perangkat per hari: rating baru menggantikan rating hari itu
    $db = kp_fb_db();
    $ua = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 400); [$pl, $br] = kp_detect($ua);
    $nilai = [$jenis, $rating, $kategori, $aspek, $pesan, kp_fb_teks($b['nama'] ?? null, 80), kp_fb_teks($b['kontak'] ?? null, 80), $dev,
        ($j = kp_fb_teks($b['jabatan'] ?? null, 20)) ? strtoupper($j) : null, kp_fb_teks($b['area'] ?? null, 80), kp_fb_teks($b['kode'] ?? null, 20),
        kp_fb_teks($b['cabang'] ?? null, 120), kp_fb_teks($b['tanggal'] ?? null, 10),
        in_array($b['app'] ?? '', ['web', 'pwa', 'apk'], true) ? $b['app'] : 'web', $pl, $br, kp_fb_teks($b['versi'] ?? null, 40), kp_ip()];
    if ($jenis === 'rating' && $dev) {
        $q = $db->prepare("SELECT id FROM feedback WHERE jenis = 'rating' AND device_id = ? AND date(created_at, '+7 hours') = date('now', '+7 hours')");
        $q->execute([$dev]);
        if ($id = $q->fetchColumn()) {
            $db->prepare("UPDATE feedback SET rating = ?, aspek = ?, pesan = ?, nama = COALESCE(?, nama), kontak = COALESCE(?, kontak), updated_at = datetime('now') WHERE id = ?")
               ->execute([$rating, $aspek, $pesan, $nilai[5], $nilai[6], $id]);
            return [200, ['ok' => true, 'id' => (int)$id, 'diperbarui' => true]];
        }
    }
    $db->prepare('INSERT INTO feedback (jenis, rating, kategori, aspek, pesan, nama, kontak, device_id, jabatan, area, kode, cabang, tanggal_data, app, platform, browser, versi, ip)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute($nilai);
    return [201, ['ok' => true, 'id' => (int)$db->lastInsertId()]];
}

function kp_fb_list(array $g): array {
    $db = kp_fb_db();
    $hari = max(1, min(3650, (int)($g['days'] ?? 90)));
    $w = ["created_at >= datetime('now', ?)"]; $p = ['-' . $hari . ' days'];
    if (in_array($g['jenis'] ?? '', ['rating', 'keluhan'], true)) { $w[] = 'jenis = ?'; $p[] = $g['jenis']; }
    if (in_array($g['status'] ?? '', KP_FB_STATUS, true)) { $w[] = 'status = ?'; $p[] = $g['status']; }
    if (($q = trim((string)($g['q'] ?? ''))) !== '') {
        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $q) . '%';
        $w[] = "(pesan LIKE ? ESCAPE '\\' OR kategori LIKE ? ESCAPE '\\' OR area LIKE ? ESCAPE '\\' OR kode LIKE ? ESCAPE '\\' OR cabang LIKE ? ESCAPE '\\' OR nama LIKE ? ESCAPE '\\' OR jabatan LIKE ? ESCAPE '\\')";
        array_push($p, ...array_fill(0, 7, $like));
    }
    $lim = max(1, min(5000, (int)($g['limit'] ?? 500)));
    $st = $db->prepare('SELECT * FROM feedback WHERE ' . implode(' AND ', $w) . " ORDER BY id DESC LIMIT $lim");
    $st->execute($p);
    return array_map(function ($r) { $r['id'] = (int)$r['id']; $r['rating'] = $r['rating'] === null ? null : (int)$r['rating']; return $r; }, $st->fetchAll());
}

function kp_fb_summary(int $hari): array {
    $db = kp_fb_db();
    $sejak = '-' . max(1, min(3650, $hari)) . ' days';
    $satu = function (string $sql) use ($db, $sejak) { $q = $db->prepare($sql); $q->execute([$sejak]); return $q->fetch(); };
    $banyak = function (string $sql) use ($db, $sejak) { $q = $db->prepare($sql); $q->execute([$sejak]);
        return array_map(function ($r) { foreach (['n', 'rating', 'bintang'] as $k) if (isset($r[$k]) && is_numeric($r[$k])) $r[$k] = $k === 'rating' ? round((float)$r[$k], 2) : (int)$r[$k]; return $r; }, $q->fetchAll()); };
    $r = $satu("SELECT COUNT(*) n, AVG(rating) rata, SUM(rating >= 4) puas, SUM(rating <= 2) kecewa FROM feedback WHERE jenis = 'rating' AND created_at >= datetime('now', ?)");
    $k = $satu("SELECT COUNT(*) n, SUM(status = 'baru') baru, SUM(status = 'diproses') diproses, SUM(status = 'selesai') selesai FROM feedback WHERE jenis = 'keluhan' AND created_at >= datetime('now', ?)");
    // aspek disimpan "A, B": dihitung di PHP
    $aspek = [];
    foreach ($banyak("SELECT aspek, rating FROM feedback WHERE jenis = 'rating' AND aspek IS NOT NULL AND created_at >= datetime('now', ?)") as $row)
        foreach (explode(', ', $row['aspek']) as $a) { $aspek[$a] = $aspek[$a] ?? ['nama' => $a, 'n' => 0, 'total' => 0]; $aspek[$a]['n']++; $aspek[$a]['total'] += $row['rating']; }
    $aspek = array_values(array_map(function ($a) { return ['nama' => $a['nama'], 'n' => $a['n'], 'rating' => round($a['total'] / $a['n'], 2)]; }, $aspek));
    usort($aspek, function ($a, $b) { return $b['n'] <=> $a['n']; });
    $n = (int)$r['n'];
    return [
        'hari' => $hari,
        'rating' => ['n' => $n, 'rata' => $n ? round((float)$r['rata'], 2) : null, 'puasPersen' => $n ? round($r['puas'] / $n * 100) : null, 'kecewaPersen' => $n ? round($r['kecewa'] / $n * 100) : null],
        'keluhan' => ['n' => (int)$k['n'], 'baru' => (int)$k['baru'], 'diproses' => (int)$k['diproses'], 'selesai' => (int)$k['selesai']],
        'sebaranBintang' => $banyak("SELECT rating bintang, COUNT(*) n FROM feedback WHERE jenis = 'rating' AND created_at >= datetime('now', ?) GROUP BY rating ORDER BY rating DESC"),
        'aspek' => $aspek,
        'perKategori' => $banyak("SELECT kategori nama, COUNT(*) n FROM feedback WHERE jenis = 'keluhan' AND created_at >= datetime('now', ?) GROUP BY 1 ORDER BY 2 DESC"),
        'perArea' => $banyak("SELECT COALESCE(area, 'Tidak diketahui') nama, COUNT(*) n, AVG(rating) rating FROM feedback WHERE created_at >= datetime('now', ?) GROUP BY 1 ORDER BY 2 DESC LIMIT 50"),
        'perCabang' => $banyak("SELECT COALESCE(kode || ' · ' || COALESCE(cabang, ''), 'Tidak diketahui') nama, COUNT(*) n, AVG(rating) rating, SUM(jenis = 'keluhan') keluhan
            FROM feedback WHERE created_at >= datetime('now', ?) GROUP BY 1 ORDER BY 2 DESC LIMIT 50"),
        'perHari' => $banyak("SELECT date(created_at, '+7 hours') tanggal, COUNT(*) n, AVG(rating) rating FROM feedback WHERE created_at >= datetime('now', ?) GROUP BY 1 ORDER BY 1"),
    ];
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
    $rows = [['No', 'Waktu (WIB)', 'Jenis', 'Rating', 'Kategori keluhan', 'Aspek dinilai', 'Pesan', 'Nama', 'Kontak', 'Jabatan', 'Area', 'Kode cabang', 'Cabang',
              'Tanggal data dilihat', 'Aplikasi', 'OS', 'Browser', 'Status', 'Catatan admin', 'Diperbarui (WIB)']];
    foreach (kp_fb_list($g + ['limit' => 5000]) as $r) $rows[] = [$r['id'], $wib($r['created_at']), $r['jenis'], $r['rating'], $r['kategori'], $r['aspek'], $r['pesan'],
        $r['nama'], $r['kontak'], $r['jabatan'], $r['area'], $r['kode'], $r['cabang'], $r['tanggal_data'], $r['app'], $r['platform'], $r['browser'], $r['status'], $r['catatan'], $wib($r['updated_at'])];
    return ['masukan-' . ($g['jenis'] ?? 'semua') . '-' . gmdate('Ymd-Hi', time() + 7 * 3600) . '.csv', $rows];
}
