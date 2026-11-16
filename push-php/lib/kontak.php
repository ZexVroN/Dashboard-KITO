<?php
/* Nomor HP BOM/BOS per cabang untuk pimpinan (kartu cabang, tombol Telepon & WhatsApp).
   Data: data/kontak-bom.php (tools/build_kontak_bom.py, hanya di server; tidak ada di data/kito.json maupun git).
   POST /api/kontak/bom {jabatan, area?, hash, bukti?}
   Akses : ROH & SQO Region = seluruh Region II; ASM & SQO Area = hanya cabang di areanya (aturan cakupan keluhan, lib/masukan.php).
   Aman  : akun yang masih memakai password bawaan hanya dilayani bila bukti bawaan sudah diaktifkan
           (tools/amankan_password_bawaan.py), karena hash bawaan tertulis di kpi-login.js yang publik. */
declare(strict_types=1);

const KP_KONTAK_BERKAS = KP_DIR . '/data/kontak-bom.php';

function kp_kontak_bom(array $b): array {
    if (!isset(KP_FB_PEMBALAS[strtolower(trim((string)($b['jabatan'] ?? '')))])) kp_fail(403, 'nomor HP BOM/BOS hanya untuk ROH, SQO Region, ASM, dan SQO Area');
    [$jab, $area] = kp_fb_cakupan($b);          // 403 bila bukan ROH/SQO Region/SQO Area/ASM, 401 bila password salah
    [$kunci] = kp_akun_kunci($b);
    $row = kp_akun_baris($kunci);
    if (!($row && $row['hash']) && empty(KP_AKUN_BUKTI[$jab])) {
        kp_fail(403, 'Demi keamanan nomor HP, ganti dulu password bawaan akun ini (ikon Profil › Ganti password), lalu buka lagi.');
    }
    if (!is_file(KP_KONTAK_BERKAS)) kp_fail(404, 'data nomor HP BOM/BOS belum diunggah ke server');
    $semua = require KP_KONTAK_BERKAS;
    $out = [];
    foreach (is_array($semua) ? $semua : [] as $kode => $v) {
        if ($area !== null && kp_fb_area_keluhan(['kode' => (string)$kode]) !== $area) continue;
        $out[(string)$kode] = ['nama' => $v[0] ?: null, 'hp' => $v[1], 'wa' => $v[2]];
    }
    return ['ok' => true, 'cakupan' => $area ?? 'REGION', 'kontak' => $out];
}
