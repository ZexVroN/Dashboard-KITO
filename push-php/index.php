<?php
/**
 * KITO Push (PHP): backend push notification untuk website, desktop, Android, dan iOS (Web Push/VAPID).
 * Cukup unggah folder ini ke hosting PHP mana pun (Hostinger, cPanel, dll.) lalu buka setup.php.
 *
 * Rute:
 *   /api/health · /api/vapid-public-key · /api/subscriptions (POST/DELETE) · /api/subscriptions/topics (PUT)
 *   /api/subscriptions/status · /api/subscriptions/test · /api/notifications (POST/GET, admin) · /api/notifications/batch
 *   /api/stats · /api/scheduled (GET) · /api/scheduled/<id> (DELETE) · /admin
 *   Pemantauan perangkat: /api/presence/ping (POST, publik) · /api/presence/summary · /api/presence/devices (GET, admin)
 *   /api/presence/devices/<id> (PUT label · DELETE, admin) · /api/presence/export?jenis=perangkat|sesi|lokasi&days=30 (CSV, admin)
 *   /admin/perangkat
 * Tanpa rewrite .htaccess, rute juga bisa dipanggil sebagai index.php/api/...
 */
declare(strict_types=1);
require __DIR__ . '/lib/app.php';
require __DIR__ . '/lib/presence.php';
require __DIR__ . '/lib/masukan.php';
require __DIR__ . '/lib/pengguna.php';

function kp_json(int $status, $data): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function kp_fail(int $status, string $msg): void { kp_json($status, ['ok' => false, 'error' => $msg]); }

// rute dari PATH_INFO (index.php/api/x) atau dari URL hasil rewrite (/push/api/x)
$route = $_SERVER['PATH_INFO'] ?? '';
if ($route === '') {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    $route = $base !== '' && strpos($path, $base) === 0 ? substr($path, strlen($base)) : $path;
    $route = preg_replace('#^/index\.php#', '', $route);
}
$route = '/' . trim($route, '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$cfg = kp_config();

if (!$cfg) {
    if ($route === '/api/health') kp_fail(503, 'belum disetel: buka setup.php');
    header('Location: setup.php'); exit;
}

// CORS untuk dashboard
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = $cfg['allowed_origins'] ?? [];
if ($origin && (in_array('*', $allowed, true) || in_array($origin, $allowed, true))) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token');
    header('Access-Control-Max-Age: 600');
}
if ($method === 'OPTIONS') { http_response_code(204); exit; }

// halaman admin (notifikasi & perangkat), keduanya dengan menu bar bersama dari lib/page.php
if ($route === '/') { header('Location: index.php/admin'); exit; } // selalu berfungsi, dengan atau tanpa rewrite
$halamanAdmin = ['/admin' => ['admin.html', 'notifikasi'], '/admin/perangkat' => ['perangkat.html', 'perangkat'], '/admin/masukan' => ['masukan.html', 'masukan']];
$halamanAdmin['/admin/pengguna'] = ['pengguna.html', 'pengguna'];
if (isset($halamanAdmin[$route])) {
    require_once __DIR__ . '/lib/page.php';
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store'); header('X-Frame-Options: DENY'); header('X-Robots-Tag: noindex');
    // alamat absolut: /push-php (rewrite aktif) atau /push-php/index.php (tanpa rewrite)
    $sn = $_SERVER['SCRIPT_NAME'] ?? '/index.php';
    $apiBase = strpos($_SERVER['REQUEST_URI'] ?? '', '/index.php') !== false ? $sn : rtrim(str_replace('\\', '/', dirname($sn)), '/');
    [$berkas, $menu] = $halamanAdmin[$route];
    $html = file_get_contents(__DIR__ . '/lib/' . $berkas);
    echo str_replace(['__KP_API_BASE__', '<!--KP_MENU-->'], [htmlspecialchars($apiBase, ENT_QUOTES), kp_menu($menu, $apiBase)], $html);
    exit;
}

// jadwal yang jatuh tempo ikut diproses pada permintaan biasa (cadangan bila cron belum dipasang)
if (strpos($route, '/api/') === 0 && $route !== '/api/presence/ping' && random_int(1, 4) === 1) { try { kp_run_due(); } catch (Throwable $e) { error_log('[KITO Push] jadwal: ' . $e->getMessage()); } }

function kp_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    if (strlen($raw) > 65536) kp_fail(413, 'body terlalu besar');
    $j = json_decode($raw, true);
    if (!is_array($j)) kp_fail(400, 'JSON tidak valid');
    return $j;
}

function kp_admin(): void {
    $cfg = kp_config();
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($h === '' && function_exists('getallheaders')) { foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $h = $v; }
    $tok = preg_match('/^Bearer\s+(.+)$/i', $h, $m) ? trim($m[1]) : trim($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '');
    if ($tok === '' || !hash_equals($cfg['admin_token'], $tok)) {
        if (!kp_rate('adminfail:' . kp_ip(), 10)) kp_fail(429, 'terlalu banyak percobaan');
        kp_fail(401, 'token admin salah');
    }
}

function kp_parse_sub($s): array {
    if (!is_array($s) || !is_string($s['endpoint'] ?? null) || !is_array($s['keys'] ?? null)) kp_fail(400, 'subscription tidak valid');
    if (strlen($s['endpoint']) > 1024) kp_fail(400, 'endpoint terlalu panjang');
    if (!kp_host_allowed($s['endpoint'])) kp_fail(400, 'push service tidak dikenal');
    $p = (string)($s['keys']['p256dh'] ?? ''); $a = (string)($s['keys']['auth'] ?? '');
    if (strlen(b64u_dec($p)) !== 65) kp_fail(400, 'kunci p256dh tidak valid');
    if (strlen(b64u_dec($a)) < 16) kp_fail(400, 'kunci auth tidak valid');
    return ['endpoint' => $s['endpoint'], 'p256dh' => $p, 'auth' => $a];
}

function kp_topics_or_default($t): array {
    if ($t === null) return ['semua'];
    $n = kp_topics($t, 30);
    if ($n === null) kp_fail(400, 'topik tidak valid (maks 30; huruf/angka/:_-.)');
    return $n;
}

function kp_parse_notif(array $b): array {
    if (!is_string($b['title'] ?? null) || trim($b['title']) === '') kp_fail(400, 'title wajib diisi');
    $target = [];
    if (($b['all'] ?? false) === true) $target['all'] = true;
    elseif (isset($b['endpoints']) && is_array($b['endpoints'])) $target['endpoints'] = array_slice(array_map('strval', $b['endpoints']), 0, 1000);
    else {
        $t = kp_topics($b['topics'] ?? [], 100);
        if (!$t) kp_fail(400, 'isi topics (mis. ["semua"]) atau all:true');
        $target['topics'] = $t;
    }
    if (!empty($b['platforms']) && is_array($b['platforms'])) $target['platforms'] = array_map(function ($p) { return strtolower((string)$p); }, $b['platforms']);
    $urlOk = function ($u) { return !$u || preg_match('#^(https?://|\.?/|\#|\?)#', (string)$u); };
    if (!$urlOk($b['url'] ?? null)) kp_fail(400, 'url tidak valid');
    if (!empty($b['image']) && strpos((string)$b['image'], 'https://') !== 0) kp_fail(400, 'image harus URL https');
    $actions = null;
    if (isset($b['actions'])) {
        if (!is_array($b['actions']) || count($b['actions']) > 2) kp_fail(400, 'actions maksimal 2 tombol');
        $actions = [];
        foreach ($b['actions'] as $a) {
            if (!is_array($a) || trim((string)($a['title'] ?? '')) === '') continue;
            if (!$urlOk($a['url'] ?? null)) kp_fail(400, 'url tombol aksi tidak valid');
            $actions[] = ['title' => mb_substr(trim((string)$a['title']), 0, 40), 'url' => ($a['url'] ?? '') ?: (($b['url'] ?? '') ?: './')];
        }
    }
    return ['title' => trim($b['title']), 'body' => isset($b['body']) ? (string)$b['body'] : null, 'url' => $b['url'] ?? null, 'icon' => $b['icon'] ?? null,
        'image' => $b['image'] ?? null, 'tag' => $b['tag'] ?? null, 'actions' => $actions, 'requireInteraction' => !empty($b['requireInteraction']),
        'ttl' => is_numeric($b['ttl'] ?? null) ? (int)$b['ttl'] : 86400, 'urgency' => $b['urgency'] ?? 'normal', 'target' => $target];
}

try {
    $public = strpos($route, '/api/subscriptions') === 0;
    if ($public && !kp_rate('pub:' . kp_ip(), 60)) kp_fail(429, 'terlalu banyak permintaan');

    switch ("$method $route") {
        case 'GET /api/pengguna': { kp_admin(); kp_json(200, kp_pengguna()); }
        case 'GET /api/health': kp_json(200, ['ok' => true, 'waktu' => gmdate('c'), 'backend' => 'php']);
        case 'GET /api/vapid-public-key': kp_json(200, ['publicKey' => $cfg['vapid_public']]);

        case 'POST /api/subscriptions': {
            $b = kp_body(); $s = kp_parse_sub($b['subscription'] ?? null);
            $lama = (!empty($b['oldEndpoint']) && !array_key_exists('topics', $b)) ? kp_sub_get((string)$b['oldEndpoint']) : null;
            $topics = $lama ? $lama['topics'] : kp_topics_or_default($b['topics'] ?? null);
            if (!empty($b['oldEndpoint']) && $b['oldEndpoint'] !== $s['endpoint']) kp_db()->prepare('DELETE FROM subscriptions WHERE endpoint = ?')->execute([(string)$b['oldEndpoint']]);
            $ua = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 400); [$pl, $br] = kp_detect($ua);
            $id = kp_sub_save($s + ['platform' => $pl, 'browser' => $br, 'standalone' => !empty($b['standalone']), 'user_agent' => $ua,
                'label' => !empty($b['label']) ? mb_substr((string)$b['label'], 0, 120) : null], $topics);
            kp_json(201, ['ok' => true, 'id' => $id, 'platform' => $pl, 'browser' => $br, 'topics' => $topics]);
        }
        case 'PUT /api/subscriptions/topics': {
            $b = kp_body(); $topics = kp_topics_or_default($b['topics'] ?? null); $s = kp_sub_get((string)($b['endpoint'] ?? ''));
            if (!$s) kp_fail(404, 'langganan tidak ditemukan');
            kp_set_topics_id((int)$s['id'], $topics); kp_json(200, ['ok' => true, 'topics' => $topics]);
        }
        case 'POST /api/subscriptions/status': {
            $b = kp_body(); $s = kp_sub_get((string)($b['endpoint'] ?? ''));
            kp_json(200, $s ? ['terdaftar' => true, 'topics' => $s['topics'], 'platform' => $s['platform'], 'sejak' => $s['created_at']] : ['terdaftar' => false, 'topics' => []]);
        }
        case 'DELETE /api/subscriptions': {
            $b = kp_body(); $q = kp_db()->prepare('DELETE FROM subscriptions WHERE endpoint = ?'); $q->execute([(string)($b['endpoint'] ?? '')]);
            kp_json(200, ['ok' => true, 'dihapus' => $q->rowCount() > 0]);
        }
        case 'POST /api/subscriptions/test': {
            if (!kp_rate('test:' . kp_ip(), 5)) kp_fail(429, 'tunggu sebentar sebelum mengirim tes lagi');
            $b = kp_body(); $s = kp_sub_get((string)($b['endpoint'] ?? ''));
            if (!$s) kp_fail(404, 'langganan tidak ditemukan');
            $r = kp_dispatch(['title' => 'Notifikasi KITO aktif ✅', 'body' => 'Perangkat ini akan menerima notifikasi untuk: ' . (implode(', ', $s['topics']) ?: '–') . '.',
                'tag' => 'kito-tes', 'ttl' => 600, 'target' => ['endpoints' => [$s['endpoint']]]], 'tes');
            kp_json(200, ['ok' => $r['sent'] === 1] + $r);
        }

        case 'POST /api/notifications': {
            kp_admin(); $b = kp_body(); $n = kp_parse_notif($b);
            if (!empty($b['sendAt'])) {
                $t = strtotime((string)$b['sendAt']);
                if ($t === false) kp_fail(400, 'sendAt bukan waktu yang valid (ISO 8601, mis. 2026-11-02T08:00:00+07:00)');
                if ($t > time() + 15) {
                    if ($t > time() + 90 * 86400) kp_fail(400, 'jadwal maksimal 90 hari ke depan');
                    $iso = gmdate('Y-m-d\TH:i:s.000\Z', $t);
                    kp_db()->prepare('INSERT INTO scheduled (payload, send_at) VALUES (?, ?)')->execute([json_encode($n + ['source' => $b['source'] ?? 'admin']), $iso]);
                    kp_json(201, ['ok' => true, 'dijadwalkan' => true, 'scheduledId' => (int)kp_db()->lastInsertId(), 'sendAt' => $iso]);
                }
            }
            kp_json(200, kp_dispatch($n, (string)($b['source'] ?? 'admin')));
        }
        case 'POST /api/notifications/batch': {
            kp_admin(); $b = kp_body(); $list = $b['notifications'] ?? null;
            if (!is_array($list) || !$list || count($list) > 300) kp_fail(400, 'notifications harus berisi 1–300 item');
            $parsed = array_map('kp_parse_notif', $list); $hasil = [];
            foreach ($parsed as $n) $hasil[] = kp_dispatch($n, (string)($b['source'] ?? 'skrip'));
            kp_json(200, ['ok' => true, 'jumlah' => count($hasil), 'hasil' => $hasil]);
        }
        case 'GET /api/notifications': {
            kp_admin(); $lim = max(1, min(500, (int)($_GET['limit'] ?? 50)));
            $q = kp_db()->prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT ?'); $q->bindValue(1, $lim, PDO::PARAM_INT); $q->execute();
            kp_json(200, ['riwayat' => array_map(function ($r) { $r['target'] = json_decode($r['target'], true); foreach (['id', 'sent', 'failed', 'removed'] as $k) $r[$k] = (int)$r[$k]; return $r; }, $q->fetchAll())]);
        }
        case 'GET /api/stats': kp_admin(); kp_json(200, kp_stats());

        /* ---------- pemantauan perangkat ---------- */
        case 'POST /api/presence/ping': {
            // satu kantor cabang bisa berbagi satu IP publik: batas per IP dibuat longgar
            if (!kp_rate('ping:' . kp_ip(), 240)) kp_fail(429, 'terlalu banyak permintaan');
            $r = kp_presence_ping(kp_body());
            kp_json($r['ok'] ? 200 : 400, $r);
        }
        case 'GET /api/presence/live': { kp_admin(); kp_json(200, kp_presence_live()); }
        case 'GET /api/presence/summary': {
            kp_admin();
            try { kp_geo_resolve(15); } catch (Throwable $e) { error_log('[KITO Presence] geo: ' . $e->getMessage()); }
            kp_json(200, kp_presence_summary($_GET));   // ?dari=&sampai= (WIB) atau ?days=
        }
        case 'GET /api/presence/export': {
            kp_admin();
            $jenis = in_array($_GET['jenis'] ?? '', ['perangkat', 'sesi', 'lokasi', 'harian', 'lokasi-harian'], true) ? $_GET['jenis'] : 'perangkat';
            [$nama, $rows] = kp_presence_export($jenis, $_GET);
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="kito-' . $nama . '"');
            header('Access-Control-Expose-Headers: Content-Disposition');
            header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
            echo kp_csv($rows); exit;
        }
        case 'GET /api/presence/devices': {
            kp_admin();
            kp_json(200, ['perangkat' => kp_presence_devices($_GET, trim((string)($_GET['q'] ?? '')), (int)($_GET['limit'] ?? 500))]);
        }
        case 'GET /api/scheduled': {
            kp_admin(); $lim = max(1, min(500, (int)($_GET['limit'] ?? 50)));
            $q = kp_db()->prepare("SELECT * FROM scheduled ORDER BY (status = 'menunggu') DESC, send_at DESC LIMIT ?"); $q->bindValue(1, $lim, PDO::PARAM_INT); $q->execute();
            kp_json(200, ['jadwal' => array_map(function ($r) { $p = json_decode($r['payload'], true);
                return ['id' => (int)$r['id'], 'sendAt' => $r['send_at'], 'status' => $r['status'], 'title' => $p['title'], 'body' => $p['body'] ?? null, 'target' => $p['target'],
                    'notificationId' => $r['notification_id'] ? (int)$r['notification_id'] : null, 'result' => $r['result'] ? json_decode($r['result'], true) : null, 'createdAt' => $r['created_at']]; }, $q->fetchAll())]);
        }
    }
    if ($method === 'DELETE' && preg_match('#^/api/scheduled/(\d+)$#', $route, $m)) {
        kp_admin(); $q = kp_db()->prepare("UPDATE scheduled SET status = 'dibatalkan' WHERE id = ? AND status = 'menunggu'"); $q->execute([(int)$m[1]]);
        if (!$q->rowCount()) kp_fail(404, 'jadwal tidak ditemukan atau sudah terkirim');
        kp_json(200, ['ok' => true, 'dibatalkan' => (int)$m[1]]);
    }
    /* ---------- masukan: rating & keluhan dari halaman Cabang ---------- */
    if ($method === 'POST' && $route === '/api/feedback') {
        if (!kp_rate('fb:' . kp_ip(), 10)) kp_fail(429, 'terlalu banyak kiriman, coba lagi sebentar lagi');
        [$kode, $hasil] = kp_fb_simpan(kp_body());
        if (is_string($hasil)) kp_fail($kode, $hasil);
        kp_json($kode, $hasil);
    }
    if ($method === 'GET' && $route === '/api/feedback') { kp_admin(); kp_json(200, ['masukan' => kp_fb_list($_GET), 'kategori' => KP_FB_KATEGORI, 'status' => KP_FB_STATUS]); }
    if ($method === 'GET' && $route === '/api/feedback/summary') { kp_admin(); kp_json(200, kp_fb_summary((int)($_GET['days'] ?? 90))); }
    if ($method === 'GET' && $route === '/api/feedback/export') {
        kp_admin(); [$nama, $rows] = kp_fb_export($_GET);
        header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="kito-' . $nama . '"');
        header('Access-Control-Expose-Headers: Content-Disposition'); header('Cache-Control: no-store');
        echo kp_csv($rows); exit;
    }
    if ($method === 'PUT' && preg_match('#^/api/feedback/(\d+)$#', $route, $m)) {
        kp_admin();
        if (!kp_fb_update((int)$m[1], kp_body())) kp_fail(404, 'masukan tidak ditemukan atau status tidak valid');
        kp_json(200, ['ok' => true]);
    }

    if (preg_match('#^/api/presence/devices/([A-Za-z0-9_-]{8,64})$#', $route, $m) && ($method === 'PUT' || $method === 'DELETE')) {
        kp_admin();
        if ($method === 'DELETE') { if (!kp_presence_delete($m[1])) kp_fail(404, 'perangkat tidak ditemukan'); kp_json(200, ['ok' => true, 'dihapus' => $m[1]]); }
        $b = kp_body();
        if (!kp_presence_label($m[1], kp_str($b['label'] ?? null, 80))) kp_fail(404, 'perangkat tidak ditemukan');
        kp_json(200, ['ok' => true]);
    }
    kp_fail(404, 'tidak ditemukan');
} catch (Throwable $e) {
    error_log('[KITO Push] ' . $e);
    kp_fail(500, 'kesalahan server');
}
