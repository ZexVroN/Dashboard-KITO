<?php
/* Akun login dashboard (profil & password), dipakai ikon Profil di dashboard (assets/js/kpi-login.js).
   Akun = jabatan (roh, toh, atom), ASM & SQO Area per area ("asm:<kunci area>", "sqoa:<kunci area>"), SQO Region per region ("sqor:<kunci region>") atau BOM-BOS per cabang ("bom:<kode cabang>").
   Klien tidak pernah mengirim password asli: yang dikirim SHA-256("jabatan:password") seperti login KPI selama ini.
   Server menyimpan password baru sebagai password_hash() dari nilai itu. Akun yang belum pernah ganti password
   memakai hash bawaan (KP_AKUN_BAWAAN, harus sama dengan KPI_AKUN di kpi-login.js).
   Publik (dibatasi per IP): POST /api/akun/login · POST /api/akun/password · POST /api/akun/profil */
declare(strict_types=1);

const KP_AKUN_BAWAAN = [
    'roh'  => '032c695954206ed50b9a46b1fe48d9987ac7af6d74306f1f16d79b1391a76c20',
    'toh'  => 'e0361a47dc818641e4416531b3e93e5dacdda4f2ab5e650e8f83b92e59755016',
    'sqor' => '33351e7dec57007b5994aab663b8b081065ba2960e22b71b37e6af8ec6400505',
    'asm'  => 'b4ebbc99b49ce77bfe4076b26f296e26c5979e6b80c3f90a22c5d22f3e6cd7b0',
    'sqoa' => '23f3f56febdbbd7ff579b7ddfd577928d1f99fc40856fe8e9eb72ff8683a81da',
    'atom' => '24194830a2ecb9b2d9b384d0fe184d59c327e175bf59779d34551fb67794d7e0',
    'bom'  => '4e88c3acbfdf57bd8a6634d2d4110a8a51b00b48fe3f0609815fb63a97ac1d50',
];
const KP_AKUN_FOTO_MAKS = 60000;   // panjang data URL foto (±44 KB gambar; body JSON dibatasi 64 KB)

function kp_akun_db(): PDO {
    static $siap = false;
    $db = kp_db();
    if (!$siap) {
        $db->exec("CREATE TABLE IF NOT EXISTS akun (kunci TEXT PRIMARY KEY, hash TEXT, nama TEXT, foto TEXT,
            password_at TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')))");
        $siap = true;
    }
    return $db;
}

/** [kunci akun, jabatan] dari body; null bila tidak valid */
function kp_akun_kunci(array $b): ?array {
    $jab = strtolower(trim((string)($b['jabatan'] ?? '')));
    if (!isset(KP_AKUN_BAWAAN[$jab])) return null;
    if (in_array($jab, ['asm', 'sqoa', 'sqor'], true)) {   // per area / region (kunci KITO_ASM, mis. PALEMBANGARIEF); tanpa area = akun jabatan
        $area = strtoupper(trim((string)($b['area'] ?? '')));
        if ($area === '') return [$jab, $jab];
        return preg_match('/^[A-Z0-9]{2,40}$/', $area) ? [$jab . ':' . $area, $jab] : null;
    }
    if ($jab !== 'bom') return [$jab, $jab];
    $kode = trim((string)($b['cabang'] ?? ''));
    if (!preg_match('/^\d{3,6}$/', $kode)) return null;
    return ['bom:' . $kode, $jab];
}

function kp_akun_hash_ok($h): bool { return is_string($h) && preg_match('/^[0-9a-f]{64}$/', $h) === 1; }

function kp_akun_baris(string $kunci): ?array {
    $q = kp_akun_db()->prepare('SELECT * FROM akun WHERE kunci = ?');
    $q->execute([$kunci]);
    return $q->fetch(PDO::FETCH_ASSOC) ?: null;
}

/** cek hash password klien terhadap akun; mengembalikan baris akun (atau array kosong bila memakai bawaan) */
function kp_akun_cek(array $b): array {
    $k = kp_akun_kunci($b);
    if (!$k) kp_fail(400, 'jabatan atau cabang tidak valid');
    [$kunci, $jab] = $k;
    $h = $b['hash'] ?? '';
    if (!kp_akun_hash_ok($h)) kp_fail(400, 'password tidak valid');
    $row = kp_akun_baris($kunci);
    $ok = $row && $row['hash'] ? password_verify($h, $row['hash']) : hash_equals(KP_AKUN_BAWAAN[$jab], $h);
    if (!$ok) {
        if (!kp_rate('akunfail:' . kp_ip(), 10)) kp_fail(429, 'terlalu banyak percobaan, coba lagi sebentar lagi');
        kp_fail(401, 'password salah');
    }
    return [$kunci, $row ?: []];
}

function kp_akun_profil(array $row): array {
    return ['nama' => $row['nama'] ?? null, 'foto' => $row['foto'] ?? null, 'gantiPassword' => $row['password_at'] ?? null];
}

function kp_akun_login(array $b): array {
    [, $row] = kp_akun_cek($b);
    return ['ok' => true, 'profil' => kp_akun_profil($row)];
}

function kp_akun_password(array $b): array {
    [$kunci] = kp_akun_cek($b);
    $baru = $b['baru'] ?? '';
    if (!kp_akun_hash_ok($baru)) kp_fail(400, 'password baru tidak valid');
    if (hash_equals((string)$b['hash'], $baru)) kp_fail(400, 'password baru sama dengan password lama');
    $db = kp_akun_db();
    $db->prepare("INSERT INTO akun (kunci, hash, password_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(kunci) DO UPDATE SET hash = excluded.hash, password_at = excluded.password_at, updated_at = excluded.updated_at")
       ->execute([$kunci, password_hash($baru, PASSWORD_DEFAULT)]);
    return ['ok' => true, 'profil' => kp_akun_profil(kp_akun_baris($kunci) ?? [])];
}

function kp_akun_simpan_profil(array $b): array {
    [$kunci] = kp_akun_cek($b);
    $nama = trim(preg_replace('/[\x00-\x1F\x7F]+/', '', (string)($b['nama'] ?? '')));
    $nama = $nama === '' ? null : mb_substr($nama, 0, 80);
    $foto = $b['foto'] ?? null;
    if ($foto !== null && $foto !== '') {
        if (!is_string($foto) || !preg_match('#^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$#', $foto)) kp_fail(400, 'format foto tidak didukung');
        if (strlen($foto) > KP_AKUN_FOTO_MAKS) kp_fail(413, 'ukuran foto terlalu besar');
    } else $foto = null;
    $db = kp_akun_db();
    $db->prepare("INSERT INTO akun (kunci, nama, foto, updated_at) VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(kunci) DO UPDATE SET nama = excluded.nama, foto = excluded.foto, updated_at = excluded.updated_at")
       ->execute([$kunci, $nama, $foto]);
    return ['ok' => true, 'profil' => kp_akun_profil(kp_akun_baris($kunci) ?? [])];
}
