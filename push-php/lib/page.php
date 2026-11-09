<?php
/* Kerangka halaman sederhana untuk setup.php & status.php */
declare(strict_types=1);

function kp_h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

function kp_base_url(): string {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir;
}

/**
 * Menu bar bersama untuk semua halaman backend (admin notifikasi, perangkat, masukan).
 * $aktif: notifikasi | perangkat | masukan
 * $app:   alamat rute aplikasi (index.php). Default "<folder>/index.php" yang selalu berfungsi, dengan atau tanpa rewrite.
 * status.php dan setup.php tidak ada di menu (hanya untuk pemasangan/diagnosis lewat alamat langsung).
 */
const KP_DASHBOARD_URL = 'https://inbranch.region2.co.id/';

function kp_menu(string $aktif, ?string $app = null): string {
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    $app = $app ?? $dir . '/index.php';
    $cfg = function_exists('kp_config') ? kp_config() : null;
    $item = $cfg ? [
        'notifikasi' => ['🔔', 'Notifikasi', $app . '/admin'],
        'perangkat'  => ['📱', 'Perangkat & Lokasi', $app . '/admin/perangkat'],
        'masukan'    => ['💬', 'Masukan', $app . '/admin/masukan'],
    ] : [];   // belum disetel: menu kosong, halaman setup tetap bisa dibuka langsung
    $dash = KP_DASHBOARD_URL;
    $h = '<nav class="kpm" aria-label="Menu backend"><div class="kpm-in"><a class="kpm-brand" href="' . kp_h($cfg ? $app . '/admin' : $dir . '/setup.php') . '">KITO <span>Backend</span></a><div class="kpm-list">';
    foreach ($item as $k => [$ic, $label, $url]) {
        $on = $k === $aktif;
        $h .= '<a href="' . kp_h($url) . '"' . ($on ? ' class="on" aria-current="page"' : '') . '><span aria-hidden="true">' . $ic . '</span>' . kp_h($label) . '</a>';
    }
    if ($dash) $h .= '<a href="' . kp_h($dash) . '" target="_blank" rel="noopener"><span aria-hidden="true">📊</span>Dashboard ↗</a>';
    $h .= '</div>';
    // token admin tersimpan di sessionStorage tab ini; Keluar menghapusnya
    if ($cfg) $h .= '<button type="button" class="kpm-out" onclick="try{sessionStorage.removeItem(\'kitoPushToken\')}catch(e){}location.href=' . kp_h(json_encode($app . '/admin')) . '">Keluar</button>';
    return $h . '</div></nav>' . kp_menu_css();
}

function kp_menu_css(): string {
    return '<style>
.kpm{position:sticky;top:0;z-index:50;background:#001645;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18)}
.kpm-in{max-width:1180px;margin:0 auto;padding:0 12px;display:flex;align-items:center;gap:10px;min-height:52px}
.kpm-brand{color:#fff;text-decoration:none;font-weight:800;font-size:15px;white-space:nowrap;letter-spacing:.3px}
.kpm-brand span{font-weight:500;opacity:.7}
.kpm-list{display:flex;gap:4px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.kpm-list::-webkit-scrollbar{display:none}
.kpm-list a{display:inline-flex;align-items:center;gap:6px;color:#dbe4ff;text-decoration:none;font:600 13.5px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:10px 12px;border-radius:9px;white-space:nowrap}
.kpm-list a:hover{background:rgba(255,255,255,.1);color:#fff}
.kpm-list a.on{background:#fff;color:#002060}
.kpm-out{flex:none;background:transparent;border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:9px;padding:7px 12px;font:600 13px system-ui,sans-serif;cursor:pointer}
.kpm-out:hover{background:rgba(255,255,255,.12)}
@media (max-width:560px){.kpm-brand span{display:none}.kpm-list a{padding:9px 10px;font-size:13px}}
</style>';
}

function kp_page_start(string $title, string $aktif = ''): void {
    header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('X-Frame-Options: DENY');
    echo '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . kp_h($title) . '</title><style>
:root{--bg:#f3f5fa;--cd:#fff;--tx:#13203d;--mu:#66728c;--ln:#e1e6f0;--c1:#002060;--ok:#12a150;--bd:#d92d20}
@media (prefers-color-scheme:dark){:root{--bg:#0e1527;--cd:#16213b;--tx:#e8edf8;--mu:#9aa6c2;--ln:#26324f;--c1:#7aa2ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{background:#002060;color:#fff;padding:18px 16px}header h1{margin:0;font-size:19px}header p{margin:4px 0 0;opacity:.8;font-size:13px}
main{max-width:760px;margin:0 auto;padding:16px}.cd{background:var(--cd);border:1px solid var(--ln);border-radius:14px;padding:16px;margin:0 0 14px}
h2{margin:0 0 10px;font-size:13px;letter-spacing:.5px;text-transform:uppercase;color:var(--mu)}label{display:block;font-weight:600;font-size:13px;margin:10px 0 4px}
input[type=text],input[type=email]{width:100%;padding:10px 12px;border:1px solid var(--ln);border-radius:10px;background:var(--bg);color:var(--tx);font:inherit}
button,.btn{display:inline-block;border:0;border-radius:10px;padding:10px 16px;font:600 14px inherit;background:var(--c1);color:#fff;cursor:pointer;text-decoration:none}
.sec{background:transparent;color:var(--tx);border:1px solid var(--ln)}small,.mu{color:var(--mu);font-size:12.5px}
ul.ck{list-style:none;padding:0;margin:0}ul.ck li{padding:6px 0;border-bottom:1px solid var(--ln)}ul.ck li:last-child{border:0}
.ok{color:var(--ok);font-weight:700}.bad{color:var(--bd);font-weight:700}
pre,code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}pre{background:#0e1527;color:#e8edf8;padding:12px;border-radius:10px;overflow:auto;white-space:pre-wrap;word-break:break-all}
code{background:var(--bg);padding:1px 5px;border-radius:5px}.tok{font-size:15px;font-weight:700;letter-spacing:.3px}
ol li{margin:6px 0}</style></head><body>' . kp_menu($aktif) . '<header><h1>' . kp_h($title) . '</h1><p>KITO Push · backend notifikasi (versi PHP)</p></header><main>';
}
function kp_page_end(): void { echo '</main></body></html>'; }

function kp_checklist(array $checks): bool {
    $all = true; echo '<ul class="ck">';
    foreach ($checks as [$name, $ok, $fix]) { $all = $all && $ok; echo '<li><span class="' . ($ok ? 'ok">✔' : 'bad">✖') . '</span> ' . kp_h($name) . ($ok ? '' : '<br><small>Perbaiki: ' . kp_h($fix) . '</small>') . '</li>'; }
    echo '</ul>'; return $all;
}
