<?php
declare(strict_types=1);

/* Direktori akun login dashboard untuk halaman admin /admin/pengguna.
   Akun mengikuti login di dashboard (assets/js/kpi-login.js + lib/akun.php):
     ROH, TOH, ATOM          : satu akun per jabatan ("roh", "toh", "atom")
     SQO Region              : per region dari KITO_ASM.sqor ("sqor:<kunci region>")
     ASM, SQO Area           : per area dari KITO_ASM.data ("asm:<kunci area>", "sqoa:<kunci area>")
     BOM-BOS                 : per cabang dari D.B, nama dari KITO_PIMPINAN ("bom:<kode cabang>")
   Admin : GET /api/pengguna · PUT /api/pengguna {kunci, nama} · POST /api/pengguna/password {kunci, baru?}
           baru = SHA-256("jabatan:password"); tanpa baru = kembali ke password bawaan jabatan. */

function kp_pengguna_kunci_area(string $s): string {
    return preg_replace('/[^A-Z0-9]/', '', preg_replace('/^\s*AREA\s+/', '', strtoupper($s)));
}

/** semua akun yang dikenal: kunci => [nama, jabatan, level, login, kode, cabang, area] */
function kp_pengguna_akun(): array {
    static $akun = null;
    if ($akun !== null) return $akun;
    $raw = file_get_contents(KP_DIR . '/../data/kito.json');
    if ($raw === false) throw new RuntimeException('Data pengguna tidak dapat dibaca');
    $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    $akun = [];
    $tambah = function (string $kunci, string $jab, string $level, string $nama, string $area = '', string $kode = '', string $cabang = '') use (&$akun) {
        $akun[$kunci] = ['kunci' => $kunci, 'jab' => $jab, 'nama' => $nama, 'jabatan' => $level, 'level' => $level, 'login' => $level,
            'kode' => $kode, 'cabang' => $cabang, 'area' => $area];
    };
    $tambah('roh', 'roh', 'ROH', 'Regional Operation Head', 'Region II');
    $tambah('toh', 'toh', 'TOH', 'Transaction Operation Head', 'Region II');
    foreach ($data['KITO_ASM']['sqor'] ?? [] as $x) {
        $tambah('sqor:' . kp_pengguna_kunci_area((string)$x['region']), 'sqor', 'SQO Region', trim((string)$x['nama']), (string)$x['region']);
    }
    if (empty($data['KITO_ASM']['sqor'])) $tambah('sqor', 'sqor', 'SQO Region', 'SQO Region', 'Region II');
    $area = $data['KITO_ASM']['data'] ?? [];
    ksort($area);
    foreach ($area as $k => $x) if (!empty($x['nama'])) $tambah('asm:' . $k, 'asm', 'ASM', trim((string)$x['nama']), (string)$x['area']);
    foreach ($area as $k => $x) if (!empty($x['sqoa'])) $tambah('sqoa:' . $k, 'sqoa', 'SQO Area', trim((string)$x['sqoa']), (string)$x['area']);
    $tambah('atom', 'atom', 'ATOM', 'Area Transaction Operation Manager', 'Region II');
    $names = $data['KITO_PIMPINAN']['data'] ?? [];
    foreach ($data['D']['B'] ?? [] as $b) {
        $kode = (string)$b[0];
        $tambah('bom:' . $kode, 'bom', 'BOM-BOS', trim((string)($names[$kode][1] ?? '')), 'AREA ' . (string)$b[2], $kode, (string)$b[1]);
    }
    return $akun;
}

function kp_pengguna(): array {
    $simpan = [];
    foreach (kp_akun_db()->query('SELECT kunci, hash, nama, foto IS NOT NULL AS ada_foto, password_at, updated_at FROM akun')->fetchAll(PDO::FETCH_ASSOC) as $r) $simpan[$r['kunci']] = $r;
    $rows = [];
    foreach (kp_pengguna_akun() as $kunci => $a) {
        $s = $simpan[$kunci] ?? null;
        $a['namaProfil'] = $s['nama'] ?? null;               // nama dari Edit profil (dashboard) atau admin
        $a['foto'] = !empty($s['ada_foto']);
        $a['password'] = $s && $s['hash'] ? 'diganti' : 'bawaan';
        $a['passwordAt'] = $s && $s['hash'] ? $s['password_at'] : null;
        $rows[] = $a;
    }
    return ['levels' => ['ROH', 'TOH', 'SQO Region', 'ASM', 'SQO Area', 'ATOM', 'BOM-BOS'], 'pengguna' => $rows];
}

function kp_pengguna_cari(array $b): array {
    $kunci = trim((string)($b['kunci'] ?? ''));
    $a = kp_pengguna_akun()[$kunci] ?? null;
    if (!$a) kp_fail(404, 'akun tidak ditemukan');
    return $a;
}

/** admin: ubah nama tampilan akun (kosong = kembali ke nama bawaan) */
function kp_pengguna_edit(array $b): array {
    $a = kp_pengguna_cari($b);
    $nama = trim(preg_replace('/[\x00-\x1F\x7F]+/', '', (string)($b['nama'] ?? '')));
    $nama = $nama === '' ? null : mb_substr($nama, 0, 80);
    kp_akun_db()->prepare("INSERT INTO akun (kunci, nama, updated_at) VALUES (?, ?, datetime('now'))
        ON CONFLICT(kunci) DO UPDATE SET nama = excluded.nama, updated_at = excluded.updated_at")->execute([$a['kunci'], $nama]);
    return ['ok' => true, 'kunci' => $a['kunci'], 'nama' => $nama];
}

/** admin: reset password. baru = hash SHA-256("jabatan:password"); kosong = kembali ke password bawaan jabatan */
function kp_pengguna_password(array $b): array {
    $a = kp_pengguna_cari($b);
    $baru = $b['baru'] ?? null;
    $db = kp_akun_db();
    if ($baru === null || $baru === '') {
        $db->prepare("UPDATE akun SET hash = NULL, password_at = NULL, updated_at = datetime('now') WHERE kunci = ?")->execute([$a['kunci']]);
        return ['ok' => true, 'kunci' => $a['kunci'], 'password' => 'bawaan'];
    }
    if (!kp_akun_hash_ok($baru)) kp_fail(400, 'password baru tidak valid');
    $db->prepare("INSERT INTO akun (kunci, hash, password_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(kunci) DO UPDATE SET hash = excluded.hash, password_at = excluded.password_at, updated_at = excluded.updated_at")
       ->execute([$a['kunci'], password_hash($baru, PASSWORD_DEFAULT)]);
    return ['ok' => true, 'kunci' => $a['kunci'], 'password' => 'diganti', 'jab' => $a['jab']];
}
