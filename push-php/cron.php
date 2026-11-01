<?php
/* Mengirim notifikasi terjadwal yang jatuh tempo. Panggil tiap 5 menit dari Cron Job:
     curl -s "https://domain/push/cron.php?key=<cron_key>" >/dev/null
   atau dari perintah PHP: php /home/<user>/public_html/push/cron.php */
declare(strict_types=1);
require __DIR__ . '/lib/app.php';
header('Content-Type: text/plain; charset=utf-8');
$cfg = kp_config();
if (!$cfg) { http_response_code(503); exit("belum disetel\n"); }
if (PHP_SAPI !== 'cli' && !hash_equals((string)$cfg['cron_key'], (string)($_GET['key'] ?? ''))) { http_response_code(403); exit("key salah\n"); }
$n = kp_run_due();
echo 'ok · ', $n, " jadwal diproses · ", gmdate('c'), "\n";
