<?php
/* Nomor HP pimpinan cabang (BOM/BOS dan Kepala Cabang) untuk kartu cabang di dashboard + halaman backend /admin/kontak.

   Sumber data:
     data/kontak-bom.php  nomor BOM/BOS per cabang   (tools/build_kontak_bom.py, hanya di server; tidak ada di kito.json maupun git)
     data/kontak-kc.php   nomor Kepala Cabang        (tools/build_kontak_kc.py, idem)
     tabel kontak_ubah    nomor hasil edit (backend admin atau dashboard). Menimpa nomor dari berkas; berkas tidak diubah,
                          sehingga build ulang berkas tidak menghapus hasil edit. hp NULL = nomor dihapus.

   Rute:
     POST /api/kontak/bom   {jabatan, area?, hash, bukti?}            -> nomor BOM/BOS (+ "kc" Kepala Cabang untuk ROH & SQO Region)
     POST /api/kontak/ubah  {jabatan, area?, hash, bukti?, jenis, kode, hp, nama?}   -> edit nomor dari dashboard
     GET  /api/kontak/admin (token admin)                              -> daftar kontak semua cabang untuk backend
     PUT  /api/kontak/admin (token admin) {jenis, kode, hp, nama?}     -> edit nomor dari backend
   Akses lihat & edit dashboard: BOM/BOS = ROH, SQO Region & Admin (semua cabang), ASM & SQO Area (cabang di areanya);
     Kepala Cabang = hanya ROH & SQO Region (KP_KONTAK_KC_JAB).
   Aman: akun yang masih memakai password bawaan hanya dilayani bila bukti bawaan sudah diaktifkan
         (tools/amankan_password_bawaan.py), karena hash bawaan tertulis di kpi-login.js yang publik. */
declare(strict_types=1);

const KP_KONTAK_BERKAS = KP_DIR . '/data/kontak-bom.php';
// Nomor HP Kepala Cabang (tools/build_kontak_kc.py): HANYA dikirim ke akun ROH & SQO Region, field "kc".
const KP_KONTAK_KC_BERKAS = KP_DIR . '/data/kontak-kc.php';
const KP_KONTAK_KC_JAB = ['roh', 'sqor'];
const KP_KONTAK_JENIS = ['bom' => 'BOM/BOS', 'kc' => 'Kepala Cabang'];

function kp_kontak_db(): PDO {
    static $siap = false;
    $db = kp_db();
    if (!$siap) {
        $db->exec("CREATE TABLE IF NOT EXISTS kontak_ubah (jenis TEXT NOT NULL, kode TEXT NOT NULL, nama TEXT, hp TEXT, wa TEXT,
            oleh TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (jenis, kode))");
        $siap = true;
    }
    return $db;
}

/** isi berkas kontak: kode => [nama, hp tampilan, wa]; null bila berkas belum ada */
function kp_kontak_berkas(string $jenis): ?array {
    static $cache = [];
    if (array_key_exists($jenis, $cache)) return $cache[$jenis];
    $f = $jenis === 'kc' ? KP_KONTAK_KC_BERKAS : KP_KONTAK_BERKAS;
    if (!is_file($f)) return $cache[$jenis] = null;
    if (function_exists('opcache_invalidate')) @opcache_invalidate($f, true);   // berkas bisa diunggah ulang
    $d = require $f;
    return $cache[$jenis] = is_array($d) ? $d : [];
}

/** nomor gabungan berkas + hasil edit: kode => {nama, hp, wa, ubah?: {oleh, at}} (nomor yang dihapus tidak disertakan) */
function kp_kontak_gabung(string $jenis): array {
    $out = [];
    foreach (kp_kontak_berkas($jenis) ?? [] as $kode => $v) {
        if (!empty($v[1])) $out[(string)$kode] = ['nama' => $v[0] ?: null, 'hp' => $v[1], 'wa' => $v[2]];
    }
    $q = kp_kontak_db()->prepare('SELECT kode, nama, hp, wa, oleh, updated_at FROM kontak_ubah WHERE jenis = ?');
    $q->execute([$jenis]);
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $kode = (string)$r['kode'];
        if ($r['hp'] === null || $r['hp'] === '') { unset($out[$kode]); continue; }
        $out[$kode] = ['nama' => $r['nama'] ?: ($out[$kode]['nama'] ?? null), 'hp' => $r['hp'], 'wa' => $r['wa'],
            'ubah' => ['oleh' => $r['oleh'], 'at' => $r['updated_at']]];
    }
    return $out;
}

/** normalisasi nomor HP Indonesia -> [tampilan "0812-3456-7890", wa "6281234567890"]; null bila tidak valid */
function kp_kontak_norm(string $hp): ?array {
    $d = preg_replace('/\D+/', '', $hp);
    if (strpos($d, '62') === 0) $d = '0' . substr($d, 2);
    elseif (strpos($d, '8') === 0) $d = '0' . $d;
    if (!preg_match('/^08\d{7,11}$/', $d)) return null;
    $tampil = substr($d, 0, 4) . '-' . substr($d, 4, 4) . (strlen($d) > 8 ? '-' . substr($d, 8) : '');
    return [$tampil, '62' . substr($d, 1)];
}

/** simpan hasil edit. hp kosong = hapus nomor. Mengembalikan nomor yang berlaku. */
function kp_kontak_simpan(string $jenis, string $kode, $hp, $nama, string $oleh): array {
    if (!isset(KP_KONTAK_JENIS[$jenis])) kp_fail(400, 'jenis kontak harus bom atau kc');
    if (!preg_match('/^\d{3,6}$/', $kode)) kp_fail(400, 'kode cabang tidak valid');
    $hp = trim((string)($hp ?? ''));
    $tampil = null; $wa = null;
    if ($hp !== '') {
        $n = kp_kontak_norm($hp);
        if (!$n) kp_fail(400, 'Nomor HP tidak valid. Contoh: 0812-3456-7890');
        [$tampil, $wa] = $n;
    }
    $nama = trim(preg_replace('/[\x00-\x1F\x7F]+/', '', (string)($nama ?? '')));
    $nama = $nama === '' ? null : mb_substr($nama, 0, 80);
    kp_kontak_db()->prepare("INSERT INTO kontak_ubah (jenis, kode, nama, hp, wa, oleh, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(jenis, kode) DO UPDATE SET nama = excluded.nama, hp = excluded.hp, wa = excluded.wa, oleh = excluded.oleh, updated_at = excluded.updated_at")
        ->execute([$jenis, $kode, $nama, $tampil, $wa, mb_substr($oleh, 0, 120)]);
    $k = kp_kontak_gabung($jenis)[$kode] ?? null;
    return ['ok' => true, 'jenis' => $jenis, 'kode' => $kode, 'kontak' => $k];
}

/** kembalikan ke nomor dari berkas (hapus hasil edit) */
function kp_kontak_pulihkan(string $jenis, string $kode): array {
    if (!isset(KP_KONTAK_JENIS[$jenis])) kp_fail(400, 'jenis kontak harus bom atau kc');
    kp_kontak_db()->prepare('DELETE FROM kontak_ubah WHERE jenis = ? AND kode = ?')->execute([$jenis, $kode]);
    return ['ok' => true, 'jenis' => $jenis, 'kode' => $kode, 'kontak' => kp_kontak_gabung($jenis)[$kode] ?? null];
}

/** akun dashboard yang boleh melihat/mengedit nomor: [jabatan, area|null, kunci akun] */
function kp_kontak_akses(array $b): array {
    if (!isset(KP_FB_PEMBALAS[strtolower(trim((string)($b['jabatan'] ?? '')))])) kp_fail(403, 'nomor HP BOM/BOS hanya untuk ROH, SQO Region, ASM, dan SQO Area');
    [$jab, $area] = kp_fb_cakupan($b);          // 403 bila bukan ROH/SQO Region/SQO Area/ASM, 401 bila password salah
    [$kunci] = kp_akun_kunci($b);
    $row = kp_akun_baris($kunci);
    if (!($row && $row['hash']) && empty(KP_AKUN_BUKTI[$jab])) {
        kp_fail(403, 'Demi keamanan nomor HP, ganti dulu password bawaan akun ini (ikon Profil › Ganti password), lalu buka lagi.');
    }
    return [$jab, $area, $kunci, $row];
}

function kp_kontak_bom(array $b): array {
    [$jab, $area] = kp_kontak_akses($b);
    $ubah = (int)kp_kontak_db()->query("SELECT COUNT(*) FROM kontak_ubah WHERE jenis = 'bom'")->fetchColumn();
    if (kp_kontak_berkas('bom') === null && !$ubah) kp_fail(404, 'data nomor HP BOM/BOS belum diunggah ke server');
    $out = [];
    foreach (kp_kontak_gabung('bom') as $kode => $v) {
        if ($area !== null && kp_fb_area_keluhan(['kode' => (string)$kode]) !== $area) continue;
        $out[$kode] = $v;
    }
    $res = ['ok' => true, 'versi' => 3, 'cakupan' => $area ?? 'REGION', 'kontak' => $out, 'bisaUbah' => true];
    if (in_array($jab, KP_KONTAK_KC_JAB, true)) {
        // selalu kirim field kc: null + kcStatus bila berkas belum ada, agar dashboard bisa menjelaskan sebabnya
        $kc = kp_kontak_gabung('kc');
        $adaBerkas = kp_kontak_berkas('kc') !== null;
        $res['kc'] = ($adaBerkas || $kc) ? $kc : null;
        $res['kcStatus'] = !$adaBerkas && !$kc ? 'tidak-ada' : ($kc ? 'ok' : 'kosong');
    }
    return $res;
}

/** edit nomor dari dashboard (kartu cabang) */
function kp_kontak_ubah(array $b): array {
    [$jab, $area, $kunci, $row] = kp_kontak_akses($b);
    $jenis = (string)($b['jenis'] ?? '');
    $kode = trim((string)($b['kode'] ?? ''));
    if ($jenis === 'kc' && !in_array($jab, KP_KONTAK_KC_JAB, true)) kp_fail(403, 'nomor Kepala Cabang hanya dapat diubah ROH dan SQO Region');
    if ($area !== null && kp_fb_area_keluhan(['kode' => $kode]) !== $area) kp_fail(403, 'cabang ini di luar area Anda');
    $oleh = KP_FB_PEMBALAS[$jab] . (($row['nama'] ?? '') !== '' ? ' · ' . $row['nama'] : ($area ? ' · ' . $area : ''));
    return kp_kontak_simpan($jenis, $kode, $b['hp'] ?? '', $b['nama'] ?? null, $oleh);
}

/** backend admin: daftar semua cabang dengan nama & nomor Kepala Cabang dan BOM/BOS */
function kp_kontak_admin_list(): array {
    $raw = @file_get_contents(KP_DIR . '/../data/kito.json');
    $data = $raw ? json_decode($raw, true) : [];
    $pim = $data['KITO_PIMPINAN']['data'] ?? [];
    $bom = kp_kontak_gabung('bom'); $kc = kp_kontak_gabung('kc');
    $berkasBom = kp_kontak_berkas('bom') ?? []; $berkasKc = kp_kontak_berkas('kc') ?? [];
    $rows = [];
    foreach ($data['D']['B'] ?? [] as $b) {
        $kode = (string)$b[0];
        $asal = function ($v) { return $v && !empty($v[1]) ? ['nama' => $v[0] ?: null, 'hp' => $v[1]] : null; };
        $rows[] = ['kode' => $kode, 'cabang' => (string)$b[1], 'area' => (string)$b[2],
            'bm' => $pim[$kode][0] ?? null, 'bomNama' => $pim[$kode][1] ?? null,
            'kc' => $kc[$kode] ?? null, 'bom' => $bom[$kode] ?? null,
            'kcAsal' => $asal($berkasKc[$kode] ?? null), 'bomAsal' => $asal($berkasBom[$kode] ?? null)];
    }
    return ['ok' => true, 'berkas' => ['bom' => kp_kontak_berkas('bom') !== null, 'kc' => kp_kontak_berkas('kc') !== null], 'kontak' => $rows];
}

/** backend admin: edit / pulihkan nomor */
function kp_kontak_admin_ubah(array $b): array {
    $jenis = (string)($b['jenis'] ?? ''); $kode = trim((string)($b['kode'] ?? ''));
    if (!empty($b['pulihkan'])) return kp_kontak_pulihkan($jenis, $kode);
    return kp_kontak_simpan($jenis, $kode, $b['hp'] ?? '', $b['nama'] ?? null, 'Admin backend');
}

/** ringkasan untuk status.php (tanpa menampilkan nomor) */
function kp_kontak_ringkas(): array {
    $hasil = [];
    foreach (['BOM/BOS' => KP_KONTAK_BERKAS, 'Kepala Cabang (khusus ROH & SQO Region)' => KP_KONTAK_KC_BERKAS] as $label => $f) {
        $n = 0;
        if (is_file($f)) { $d = require $f; $n = is_array($d) ? count($d) : 0; }
        $hasil[] = [$label, basename($f), is_file($f), $n];
    }
    return $hasil;
}
