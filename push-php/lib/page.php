<?php
/* Kerangka halaman sederhana untuk setup.php & status.php */
declare(strict_types=1);

function kp_h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

function kp_base_url(): string {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir;
}

function kp_page_start(string $title): void {
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
ol li{margin:6px 0}</style></head><body><header><h1>' . kp_h($title) . '</h1><p>KITO Push · backend notifikasi (versi PHP)</p></header><main>';
}
function kp_page_end(): void { echo '</main></body></html>'; }

function kp_checklist(array $checks): bool {
    $all = true; echo '<ul class="ck">';
    foreach ($checks as [$name, $ok, $fix]) { $all = $all && $ok; echo '<li><span class="' . ($ok ? 'ok">✔' : 'bad">✖') . '</span> ' . kp_h($name) . ($ok ? '' : '<br><small>Perbaiki: ' . kp_h($fix) . '</small>') . '</li>'; }
    echo '</ul>'; return $all;
}
