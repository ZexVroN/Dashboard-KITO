<?php
declare(strict_types=1);

/** Direktori pengguna dari sumber dashboard; kredensial tetap dikelola login KPI. */
function kp_pengguna(): array {
    $raw = file_get_contents(KP_DIR . '/../data/kito.json');
    if ($raw === false) throw new RuntimeException('Data pengguna tidak dapat dibaca');
    $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    $levels = ['roh' => 'ROH', 'toh' => 'TOH', 'sqor' => 'SQO Region', 'asm' => 'ASM', 'sqoa' => 'SQO Area', 'atom' => 'ATOM', 'bom' => 'BOM-BOS'];
    $rows = [];
    foreach ($levels as $code => $label) {
        if ($code === 'bom') continue;
        $rows[] = ['nama' => $label, 'jabatan' => $label, 'level' => $label, 'login' => $label, 'kode' => '', 'cabang' => '', 'area' => ''];
    }
    $names = $data['KITO_PIMPINAN']['data'] ?? [];
    foreach ($data['D']['B'] ?? [] as $branch) {
        $code = (string)$branch[0];
        $rows[] = ['nama' => trim((string)($names[$code][1] ?? '')), 'jabatan' => 'BOM-BOS', 'level' => 'BOM-BOS',
            'login' => 'BOM-BOS', 'kode' => $code, 'cabang' => (string)$branch[1], 'area' => (string)$branch[2]];
    }
    return ['levels' => array_values($levels), 'pengguna' => $rows];
}
