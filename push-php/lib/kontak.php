<?php
/* Nomor HP BOM/BOS per cabang untuk pimpinan (kartu cabang, tombol Telepon & WhatsApp).
   Data: data/kontak-bom.php (tools/build_kontak_bom.py, hanya di server; tidak ada di data/kito.json maupun git).
   POST /api/kontak/bom {jabatan, area?, hash, bukti?}
   Nomor HP Kepala Cabang (data/kontak-kc.php): hanya untuk akun ROH & SQO Region (field "kc" pada respons yang sama).
   Akses : ROH & SQO Region = seluruh Region II; ASM & SQO Area = hanya cabang di areanya (aturan cakupan keluhan, lib/masukan.php).
   Aman  : akun yang masih memakai password bawaan hanya dilayani bila bukti bawaan sudah diaktifkan
           (tools/amankan_password_bawaan.py), karena hash bawaan tertulis di kpi-login.js yang publik. */
declare(strict_types=1);

const KP_KONTAK_BERKAS = KP_DIR . '/data/kontak-bom.php';
// Nomor HP Kepala Cabang (tools/build_kontak_kc.py): HANYA dikirim ke akun ROH & SQO Region, field "kc".
const KP_KONTAK_KC_JAB = ['roh', 'sqor'];
const KP_KONTAK_KC_BERKAS = KP_DIR . '/data/kontak-kc.php';

function kp_kontak_bom(array $b): array {
    if (!isset(KP_FB_PEMBALAS[strtolower(trim((string)($b['jabatan'] ?? '')))])) kp_fail(403, 'nomor HP BOM/BOS hanya untuk ROH, SQO Region, ASM, dan SQO Area');
    [$jab, $area] = kp_fb_cakupan($b);          // 403 bila bukan ROH/SQO Region/SQO Area/ASM, 401 bila password salah
    [$kunci] = kp_akun_kunci($b);
    $row = kp_akun_baris($kunci);
    if (!($row && $row['hash']) && empty(KP_AKUN_BUKTI[$jab])) {
        kp_fail(403, 'Demi keamanan nomor HP, ganti dulu password bawaan akun ini (ikon Profil › Ganti password), lalu buka lagi.');
    }
    if (!is_file(KP_KONTAK_BERKAS)) kp_fail(404, 'data nomor HP BOM/BOS belum diunggah ke server');
    if (function_exists('opcache_invalidate')) @opcache_invalidate(KP_KONTAK_BERKAS, true);
    $semua = require KP_KONTAK_BERKAS;
    $out = [];
    foreach (is_array($semua) ? $semua : [] as $kode => $v) {
        if ($area !== null && kp_fb_area_keluhan(['kode' => (string)$kode]) !== $area) continue;
        $out[(string)$kode] = ['nama' => $v[0] ?: null, 'hp' => $v[1], 'wa' => $v[2]];
    }
    $res = ['ok' => true, 'versi' => 2, 'cakupan' => $area ?? 'REGION', 'kontak' => $out];
    if (in_array($jab, KP_KONTAK_KC_JAB, true)) {
        // selalu kirim field kc untuk ROH & SQO Region: null + kcStatus bila berkas belum ada, agar dashboard bisa menjelaskan sebabnya
        $res['kc'] = null;
        $res['kcStatus'] = 'tidak-ada';
        if (is_file(KP_KONTAK_KC_BERKAS)) {
            if (function_exists('opcache_invalidate')) @opcache_invalidate(KP_KONTAK_KC_BERKAS, true);   // berkas baru diunggah ulang
            $semuaKc = require KP_KONTAK_KC_BERKAS;
            $kc = [];
            foreach (is_array($semuaKc) ? $semuaKc : [] as $kode => $v) {
                $kc[(string)$kode] = ['nama' => $v[0] ?: null, 'hp' => $v[1], 'wa' => $v[2]];
            }
            $res['kc'] = $kc;
            $res['kcStatus'] = $kc ? 'ok' : 'kosong';
        }
    }
    return $res;
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
