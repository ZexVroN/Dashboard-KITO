<?php
/* Konfigurasi, database (SQLite via PDO), dan pengirim notifikasi. Dipakai index.php, setup.php, status.php, cron.php. */
declare(strict_types=1);
require_once __DIR__ . '/webpush.php';
if (!function_exists('mb_substr')) { function mb_substr($s, $start, $len = null) { return $len === null ? substr($s, $start) : substr($s, $start, $len); } } // hosting tanpa mbstring

const KP_DIR = __DIR__ . '/..';
const KP_DATA = KP_DIR . '/data';
const KP_CONFIG = KP_DATA . '/config.php';
const KP_PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', '*.push.apple.com', '*.notify.windows.com'];

$GLOBALS['kp_cfg_cache'] = false;
function kp_config(): ?array {
    if ($GLOBALS['kp_cfg_cache'] === false) $GLOBALS['kp_cfg_cache'] = is_file(KP_CONFIG) ? (require KP_CONFIG) : null;
    return is_array($GLOBALS['kp_cfg_cache']) ? $GLOBALS['kp_cfg_cache'] : null;
}

function kp_save_config(array $c): void {
    if (!is_dir(KP_DATA)) mkdir(KP_DATA, 0750, true);
    $php = "<?php\n// Dibuat oleh setup.php. JANGAN dibagikan. File ini tidak bisa dibuka dari browser.\nreturn " . var_export($c, true) . ";\n";
    $tmp = KP_CONFIG . '.tmp';
    if (file_put_contents($tmp, $php, LOCK_EX) === false || !rename($tmp, KP_CONFIG)) throw new RuntimeException('Tidak bisa menulis ' . KP_CONFIG . ' (periksa izin folder data/)');
    @chmod(KP_CONFIG, 0640);
    if (function_exists('opcache_invalidate')) @opcache_invalidate(KP_CONFIG, true);
    $GLOBALS['kp_cfg_cache'] = $c; // pakai nilai baru di permintaan yang sama
}

/* ---------- database ---------- */
function kp_db(): PDO {
    static $db = null;
    if ($db) return $db;
    if (!is_dir(KP_DATA)) mkdir(KP_DATA, 0750, true);
    $db = new PDO('sqlite:' . KP_DATA . '/push.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    // skema hanya dibuat / dimigrasi bila versinya belum terbaru (permintaan biasa, termasuk polling, tidak menjalankan DDL)
    if ((int)$db->query('PRAGMA user_version')->fetchColumn() < KP_SKEMA) kp_skema($db);
    return $db;
}

/* Versi skema. 2 = kanal "dalam aplikasi": subscriptions.channel/device_id/app/last_seen_at/cursor_id dan notifications.payload/inapp/inapp_ok. */
const KP_SKEMA = 2;

function kp_skema(PDO $db): void {
    $db->exec("
      CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
        platform TEXT, browser TEXT, standalone INTEGER DEFAULT 0, user_agent TEXT, label TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), last_success_at TEXT, fail_count INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS subscription_topics (subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE, topic TEXT NOT NULL, PRIMARY KEY (subscription_id, topic));
      CREATE INDEX IF NOT EXISTS idx_topic ON subscription_topics(topic);
      CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT, url TEXT, target TEXT NOT NULL,
        sent INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, removed INTEGER NOT NULL DEFAULT 0, source TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS scheduled (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, send_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'menunggu',
        notification_id INTEGER, result TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_sched ON scheduled(status, send_at);
      CREATE TABLE IF NOT EXISTS hits (k TEXT NOT NULL, t INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_hits ON hits(k, t);
    ");
    // kolom baru (database lama dimigrasi di tempat; dua proses yang menjalankan ini bersamaan aman: kolom yang sudah ada dilewati)
    $tambah = function (string $tabel, array $kolom) use ($db): void {
        foreach ($kolom as $nama => $def) {
            $ada = $db->query("PRAGMA table_info($tabel)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (in_array($nama, $ada, true)) continue;
            try { $db->exec("ALTER TABLE $tabel ADD COLUMN $nama $def"); }
            catch (Throwable $e) { if (!in_array($nama, $db->query("PRAGMA table_info($tabel)")->fetchAll(PDO::FETCH_COLUMN, 1), true)) throw $e; }
        }
    };
    $tambah('subscriptions', ['channel' => "TEXT NOT NULL DEFAULT 'push'", 'device_id' => 'TEXT', 'app' => 'TEXT', 'last_seen_at' => 'TEXT', 'cursor_id' => 'INTEGER NOT NULL DEFAULT 0']);
    $tambah('notifications', ['payload' => 'TEXT', 'inapp' => 'INTEGER NOT NULL DEFAULT 0', 'inapp_ok' => 'INTEGER NOT NULL DEFAULT 0']);
    $db->exec('CREATE INDEX IF NOT EXISTS idx_sub_dev ON subscriptions(device_id); CREATE INDEX IF NOT EXISTS idx_sub_ch ON subscriptions(channel)');
    $db->exec('PRAGMA user_version = ' . KP_SKEMA);
}

/* ---------- utilitas ---------- */
function kp_detect(string $ua): array {
    $p = 'lainnya';
    if (preg_match('/iPhone|iPad|iPod/', $ua) || (strpos($ua, 'Macintosh') !== false && strpos($ua, 'Mobile/') !== false)) $p = 'ios';
    elseif (strpos($ua, 'Android') !== false) $p = 'android';
    elseif (strpos($ua, 'Windows') !== false) $p = 'windows';
    elseif (preg_match('/Macintosh|Mac OS X/', $ua)) $p = 'macos';
    elseif (preg_match('/CrOS|Linux|X11/', $ua)) $p = 'linux';
    $b = 'lainnya';
    foreach (['edge' => '/Edg\//', 'samsung' => '/SamsungBrowser/', 'opera' => '/OPR\//', 'firefox' => '/Firefox\//', 'chrome' => '/Chrome\/|CriOS/', 'safari' => '/Safari\//'] as $k => $re) {
        if (preg_match($re, $ua)) { $b = $k; break; }
    }
    return [$p, $b];
}

function kp_topics($list, int $max = 30): ?array {
    if (!is_array($list)) return null;
    $out = [];
    foreach ($list as $t) {
        $s = preg_replace('/\s+/', ' ', strtolower(trim((string)$t)));
        if (!preg_match('/^[a-z0-9][a-z0-9:_.\- ]{0,63}$/', $s)) return null;
        $out[$s] = true;
    }
    return count($out) <= $max ? array_keys($out) : null;
}

function kp_host_allowed(string $endpoint): bool {
    $u = parse_url($endpoint); $c = kp_config();
    if (!$u || empty($u['host']) || empty($u['scheme'])) return false;
    $insecure = !empty($c['allow_insecure_push']);
    if ($u['scheme'] !== 'https' && !($insecure && $u['scheme'] === 'http')) return false;
    if ($insecure && in_array($u['host'], ['127.0.0.1', 'localhost'], true)) return true;
    foreach (KP_PUSH_HOSTS as $p) {
        if (strpos($p, '*.') === 0 ? substr($u['host'], -strlen(substr($p, 1))) === substr($p, 1) : $u['host'] === $p) return true;
    }
    return false;
}

/* IP klien. Header penerus (CF-Connecting-IP, X-Forwarded-For) hanya dipercaya bila permintaan benar-benar datang dari proxy tepercaya:
     1. jaringan internal hosting (IP privat/loopback),
     2. jaringan Cloudflare (daftar resmi di KP_CLOUDFLARE; Hostinger CDN dan banyak domain .co.id memakainya),
     3. alamat/CIDR yang didaftarkan di data/config.php: 'trusted_proxies' => ['203.0.113.7', '198.51.100.0/24'].
   Rantai X-Forwarded-For dibaca dari KANAN: alamat paling kanan yang BUKAN proxy tepercaya adalah klien. Alamat di kiri bisa dikarang
   penyerang, jadi tidak dipakai. Tanpa aturan ini penyerang bisa mengarang header untuk lolos dari batas percobaan login; dan tanpa
   daftar proxy yang benar, semua pengguna di balik CDN terlihat berasal dari satu IP (cek di status.php › Deteksi alamat IP). */
const KP_CLOUDFLARE = ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
    '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'];

function kp_ip_norm(string $ip): string {
    $b = @inet_pton($ip);
    if ($b === false) return $ip;
    if (strlen($b) === 16 && substr($b, 0, 12) === "\0\0\0\0\0\0\0\0\0\0\xff\xff") return inet_ntop(substr($b, 12)); // ::ffff:1.2.3.4 -> 1.2.3.4
    return (string)inet_ntop($b);
}

function kp_ip_dalam(string $ip, string $cidr): bool {
    $p = explode('/', $cidr, 2);
    $a = @inet_pton($ip); $b = @inet_pton($p[0]);
    if ($a === false || $b === false || strlen($a) !== strlen($b)) return false;
    $bit = isset($p[1]) ? (int)$p[1] : strlen($b) * 8;
    if ($bit < 0 || $bit > strlen($b) * 8) return false;
    $bytes = intdiv($bit, 8); $sisa = $bit % 8;
    if ($bytes && substr($a, 0, $bytes) !== substr($b, 0, $bytes)) return false;
    if ($sisa === 0) return true;
    $mask = (0xFF << (8 - $sisa)) & 0xFF;
    return (ord($a[$bytes]) & $mask) === (ord($b[$bytes]) & $mask);
}

function kp_ip_cloudflare(string $ip): bool {
    foreach (KP_CLOUDFLARE as $c) if (kp_ip_dalam($ip, $c)) return true;
    return false;
}

function kp_proxy_tepercaya(string $ip): bool {
    if (!filter_var($ip, FILTER_VALIDATE_IP)) return false;
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return true; // privat / loopback / reserved
    if (kp_ip_cloudflare($ip)) return true;
    $c = kp_config() ?: [];
    foreach ((array)($c['trusted_proxies'] ?? []) as $p) if (is_string($p) && kp_ip_dalam($ip, $p)) return true;
    return false;
}

function kp_ip(): string {
    $remote = (string)($_SERVER['REMOTE_ADDR'] ?? '?');
    if (!filter_var($remote, FILTER_VALIDATE_IP)) return $remote;
    $remote = kp_ip_norm($remote);
    if (!kp_proxy_tepercaya($remote)) return $remote;
    // Cloudflare: CF-Connecting-IP diisi Cloudflare sendiri (hanya dipercaya bila sambungan memang dari jaringan Cloudflare)
    $cf = trim((string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? ''));
    if ($cf !== '' && filter_var($cf, FILTER_VALIDATE_IP) && kp_ip_cloudflare($remote)) return kp_ip_norm($cf);
    $f = trim((string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
    if ($f === '') return $remote;
    $rantai = array_map('trim', explode(',', $f));
    for ($i = count($rantai) - 1; $i >= 0; $i--) {
        if (!filter_var($rantai[$i], FILTER_VALIDATE_IP)) return $remote;   // rantai rusak: jangan percaya
        $ip = kp_ip_norm($rantai[$i]);
        if (!kp_proxy_tepercaya($ip)) return $ip;
    }
    $kiri = $rantai[0];   // seluruh rantai adalah proxy internal: pakai yang paling kiri
    return (filter_var($kiri, FILTER_VALIDATE_IP) ? kp_ip_norm($kiri) : $remote);
}

function kp_rate(string $key, int $perMinute): bool {
    $db = kp_db(); $now = time();
    if (random_int(1, 50) === 1) $db->prepare('DELETE FROM hits WHERE t < ?')->execute([$now - 120]);
    $q = $db->prepare('SELECT COUNT(*) FROM hits WHERE k = ? AND t > ?'); $q->execute([$key, $now - 60]);
    if ((int)$q->fetchColumn() >= $perMinute) return false;
    $db->prepare('INSERT INTO hits (k, t) VALUES (?, ?)')->execute([$key, $now]);
    return true;
}

/* batas percobaan gagal (login akun / token admin): diperiksa SEBELUM kredensial dicek, sehingga setelah batas tercapai
   tebakan yang benar pun ditolak sementara (brute force tidak bisa membedakan benar/salah). */
function kp_gagal_lewat(array $batas): bool {
    $db = kp_db(); $now = time();
    $q = $db->prepare('SELECT COUNT(*) FROM hits WHERE k = ? AND t > ?');
    foreach ($batas as $k => $n) { $q->execute([$k, $now - 60]); if ((int)$q->fetchColumn() >= $n) return true; }
    return false;
}
function kp_gagal_catat(array $batas): void {
    $ins = kp_db()->prepare('INSERT INTO hits (k, t) VALUES (?, ?)');
    foreach (array_keys($batas) as $k) $ins->execute([$k, time()]);
}

function kp_now(): string { return gmdate('Y-m-d H:i:s'); }

/* ---------- langganan ---------- */
function kp_sub_get(string $endpoint): ?array {
    $q = kp_db()->prepare('SELECT * FROM subscriptions WHERE endpoint = ?'); $q->execute([$endpoint]);
    $s = $q->fetch(); if (!$s) return null;
    $t = kp_db()->prepare('SELECT topic FROM subscription_topics WHERE subscription_id = ? ORDER BY topic'); $t->execute([$s['id']]);
    $s['topics'] = $t->fetchAll(PDO::FETCH_COLUMN);
    return $s;
}

function kp_sub_save(array $s, array $topics): int {
    $db = kp_db(); $db->beginTransaction();
    try {
        $db->prepare("INSERT INTO subscriptions (endpoint, p256dh, auth, platform, browser, standalone, user_agent, label, channel, device_id, app, last_seen_at) VALUES (?,?,?,?,?,?,?,?,'push',?,?,datetime('now'))
          ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth, platform=excluded.platform, browser=excluded.browser,
          standalone=excluded.standalone, user_agent=excluded.user_agent, label=COALESCE(excluded.label, subscriptions.label), channel='push',
          device_id=COALESCE(excluded.device_id, subscriptions.device_id), app=COALESCE(excluded.app, subscriptions.app),
          last_seen_at=datetime('now'), updated_at=datetime('now'), fail_count=0")
           ->execute([$s['endpoint'], $s['p256dh'], $s['auth'], $s['platform'], $s['browser'], $s['standalone'] ? 1 : 0, $s['user_agent'], $s['label'], $s['device_id'] ?? null, $s['app'] ?? null]);
        $q = $db->prepare('SELECT id, device_id FROM subscriptions WHERE endpoint = ?'); $q->execute([$s['endpoint']]); $row = $q->fetch(); $id = (int)$row['id'];
        kp_set_topics_id($id, $topics);
        // satu perangkat = satu langganan: baris lain milik perangkat yang sama (kanal dalam-aplikasi, atau endpoint push lama) dihapus agar tidak dobel
        if (!empty($row['device_id'])) $db->prepare('DELETE FROM subscriptions WHERE device_id = ? AND id <> ?')->execute([$row['device_id'], $id]);
        $db->commit(); return $id;
    } catch (Throwable $e) { $db->rollBack(); throw $e; }
}

function kp_set_topics_id(int $id, array $topics): void {
    $db = kp_db();
    $db->prepare('DELETE FROM subscription_topics WHERE subscription_id = ?')->execute([$id]);
    $ins = $db->prepare('INSERT OR IGNORE INTO subscription_topics (subscription_id, topic) VALUES (?, ?)');
    foreach ($topics as $t) $ins->execute([$id, $t]);
}

function kp_targets(array $target): array {
    $db = kp_db();
    if (isset($target['endpoints'])) {
        $rows = [];
        foreach ($target['endpoints'] as $e) { $s = kp_sub_get((string)$e); if ($s) $rows[] = $s; }
    } elseif (!empty($target['all'])) {
        $rows = $db->query('SELECT * FROM subscriptions')->fetchAll();
    } else {
        $t = $target['topics'] ?? []; if (!$t) return [];
        $q = $db->prepare('SELECT DISTINCT s.* FROM subscriptions s JOIN subscription_topics st ON st.subscription_id = s.id WHERE st.topic IN (' . implode(',', array_fill(0, count($t), '?')) . ')');
        $q->execute($t); $rows = $q->fetchAll();
    }
    if (!empty($target['platforms'])) $rows = array_values(array_filter($rows, function ($r) use ($target) { return in_array($r['platform'], $target['platforms'], true); }));
    return $rows;
}

/* ---------- pengiriman ---------- */
function kp_payload(array $n): string {
    $c = kp_config();
    $p = ['title' => mb_substr($n['title'], 0, 120), 'body' => mb_substr((string)($n['body'] ?? ''), 0, 500), 'url' => $n['url'] ?: ($c['default_url'] ?? './'),
        'tag' => $n['tag'] ?? null, 'renotify' => !empty($n['tag']), 'requireInteraction' => !empty($n['requireInteraction']), 'ts' => (int)(microtime(true) * 1000)];
    if (!empty($c['default_icon']) || !empty($n['icon'])) $p['icon'] = $n['icon'] ?: $c['default_icon'];
    if (!empty($n['image'])) $p['image'] = $n['image'];
    $data = [];
    if (!empty($n['actions'])) {
        $p['actions'] = []; $data['actions'] = [];
        foreach (array_values($n['actions']) as $i => $a) { $p['actions'][] = ['action' => "a$i", 'title' => $a['title']]; $data['actions']["a$i"] = $a['url']; }
    }
    $p['data'] = (object)$data;
    return json_encode(array_filter($p, function ($v) { return $v !== null; }), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/* Isi notifikasi untuk kanal dalam-aplikasi (disimpan di notifications.payload; dibaca perangkat saat polling). */
function kp_inapp_payload(array $n): string {
    $c = kp_config();
    $p = ['title' => mb_substr($n['title'], 0, 120), 'body' => mb_substr((string)($n['body'] ?? ''), 0, 500), 'url' => ($n['url'] ?? null) ?: ($c['default_url'] ?? './'),
        'image' => $n['image'] ?? null, 'tag' => $n['tag'] ?? null, 'urgensi' => $n['urgency'] ?? 'normal', 'tetap' => !empty($n['requireInteraction']) ? true : null,
        'ttl' => (int)($n['ttl'] ?? 86400)];
    if (!empty($n['actions'])) $p['aksi'] = array_map(function ($a) { return ['title' => $a['title'], 'url' => $a['url']]; }, array_values($n['actions']));
    return json_encode(array_filter($p, function ($v) { return $v !== null; }), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/* SATU pintu pengiriman untuk semua kanal. Penerima dipilih dari tabel subscriptions (topik / semua / endpoint / platform):
     - channel 'push'  : Web Push (Chrome, Edge, Firefox, Safari PWA, aplikasi TWA) - dikirim sekarang, sampai walau aplikasi ditutup
     - channel 'inapp' : perangkat tanpa Web Push (APK WebView, iPhone di browser, izin ditolak) - notifikasi disimpan di tabel notifications
                         dan diambil perangkat saat polling (lihat lib/inbox.php), tampil sebagai banner di dalam aplikasi. */
function kp_dispatch(array $n, string $source = 'api'): array {
    $c = kp_config(); $db = kp_db();
    $vapid = ['publicKey' => $c['vapid_public'], 'privateKey' => $c['vapid_private'], 'subject' => $c['vapid_subject']];
    $semua = kp_targets($n['target']);
    $subs = array_values(array_filter($semua, function ($s) { return ($s['channel'] ?? 'push') !== 'inapp'; }));
    $nInapp = count($semua) - count($subs);
    $db->prepare('INSERT INTO notifications (title, body, url, target, source, payload, inapp) VALUES (?,?,?,?,?,?,?)')
       ->execute([$n['title'], $n['body'] ?? null, $n['url'] ?? null, json_encode($n['target']), $source, kp_inapp_payload($n), $nInapp]);
    $nid = (int)$db->lastInsertId();
    $payload = kp_payload($n); $res = ['id' => $nid, 'targets' => count($subs), 'sent' => 0, 'failed' => 0, 'removed' => 0, 'inapp' => $nInapp];
    $byId = []; $jobs = [];
    foreach ($subs as $s) {
        $byId[$s['id']] = $s;
        try { $jobs[$s['id']] = wp_build_request($s, $payload, $vapid, ['ttl' => $n['ttl'] ?? 86400, 'urgency' => $n['urgency'] ?? 'normal']); }
        catch (Throwable $e) { $res['failed']++; }
    }
    for ($attempt = 0; $attempt < 2 && $jobs; $attempt++) {
        $out = wp_send_many($jobs, 25); $retry = [];
        foreach ($out as $id => $r) {
            if ($r['status'] >= 200 && $r['status'] < 300) { $db->prepare("UPDATE subscriptions SET last_success_at = datetime('now'), fail_count = 0 WHERE id = ?")->execute([$id]); $res['sent']++; }
            elseif ($r['status'] === 404 || $r['status'] === 410) { $db->prepare('DELETE FROM subscriptions WHERE id = ?')->execute([$id]); $res['removed']++; }
            elseif ($attempt === 0 && ($r['status'] === 429 || $r['status'] >= 500 || $r['error'])) { $retry[$id] = $jobs[$id]; }
            else {
                $db->prepare('UPDATE subscriptions SET fail_count = fail_count + 1 WHERE id = ?')->execute([$id]);
                $f = $db->prepare('SELECT fail_count FROM subscriptions WHERE id = ?'); $f->execute([$id]);
                if ((int)$f->fetchColumn() >= 5) { $db->prepare('DELETE FROM subscriptions WHERE id = ?')->execute([$id]); $res['removed']++; } else $res['failed']++;
                error_log('[KITO Push] ' . ($r['error'] ?: 'HTTP ' . $r['status']) . ' ' . parse_url($byId[$id]['endpoint'], PHP_URL_HOST) . ' ' . substr($r['body'], 0, 160));
            }
        }
        $jobs = $retry; if ($jobs) sleep(1);
    }
    $db->prepare('UPDATE notifications SET sent = ?, failed = ?, removed = ? WHERE id = ?')->execute([$res['sent'], $res['failed'], $res['removed'], $nid]);
    return $res;
}

/* ---------- jadwal: dijalankan oleh cron.php dan sesekali oleh permintaan biasa ---------- */
function kp_run_due(): int {
    $db = kp_db(); $n = 0;
    if (random_int(1, 100) === 1) $db->exec("DELETE FROM subscriptions WHERE channel = 'inapp' AND COALESCE(last_seen_at, updated_at) < datetime('now', '-90 days')"); // APK/browser yang sudah tidak dipakai
    $db->exec("UPDATE scheduled SET status = 'menunggu' WHERE status = 'mengirim' AND created_at < datetime('now', '-15 minutes')"); // pulihkan yang terputus
    $now = gmdate('Y-m-d\TH:i:s.000\Z');
    $q = $db->prepare("SELECT * FROM scheduled WHERE status = 'menunggu' AND send_at <= ?"); $q->execute([$now]);
    foreach ($q->fetchAll() as $j) {
        $lock = $db->prepare("UPDATE scheduled SET status = 'mengirim' WHERE id = ? AND status = 'menunggu'"); $lock->execute([$j['id']]);
        if (!$lock->rowCount()) continue; // diambil proses lain
        try {
            $p = json_decode($j['payload'], true); $src = $p['source'] ?? 'admin'; unset($p['source']);
            $r = kp_dispatch($p, $src . ' (jadwal)');
            $db->prepare("UPDATE scheduled SET status = 'terkirim', notification_id = ?, result = ? WHERE id = ?")->execute([$r['id'], json_encode($r), $j['id']]);
        } catch (Throwable $e) {
            $db->prepare("UPDATE scheduled SET status = 'gagal', result = ? WHERE id = ?")->execute([json_encode(['error' => $e->getMessage()]), $j['id']]);
        }
        $n++;
    }
    return $n;
}

function kp_stats(): array {
    $db = kp_db();
    $n = function ($sql) use ($db) { return (int)$db->query($sql)->fetchColumn(); };
    $grup = function ($sql) use ($db) { return array_map(function ($r) { $r['n'] = (int)$r['n']; return $r; }, $db->query($sql)->fetchAll()); };
    return [
        'total' => $n('SELECT COUNT(*) FROM subscriptions'),                                                   // semua perangkat penerima (push + dalam-aplikasi)
        'push' => $n("SELECT COUNT(*) FROM subscriptions WHERE channel = 'push'"),                              // Web Push: browser, TWA, PWA
        'inapp' => $n("SELECT COUNT(*) FROM subscriptions WHERE channel = 'inapp'"),                            // dalam aplikasi: WebView, izin ditolak, tanpa Web Push
        'inappAktif' => $n("SELECT COUNT(*) FROM subscriptions WHERE channel = 'inapp' AND last_seen_at > datetime('now', '-2 days')"),
        'perPlatform' => $grup("SELECT COALESCE(platform,'lainnya') platform, COUNT(*) n FROM subscriptions GROUP BY 1 ORDER BY 2 DESC"),
        'perBrowser' => $grup("SELECT COALESCE(browser,'lainnya') browser, COUNT(*) n FROM subscriptions GROUP BY 1 ORDER BY 2 DESC"),
        'perApp' => $grup("SELECT COALESCE(app,'web') app, channel, COUNT(*) n FROM subscriptions GROUP BY 1, 2 ORDER BY 3 DESC"),
        'terpasang' => $n('SELECT COUNT(*) FROM subscriptions WHERE standalone = 1'),
        'perTopic' => $grup('SELECT topic, COUNT(*) n FROM subscription_topics GROUP BY topic ORDER BY 2 DESC LIMIT 200'),
        'notifikasi' => $n('SELECT COUNT(*) FROM notifications'),
    ];
}

/* ---------- diagnosis lingkungan (status.php & setup.php) ---------- */
function kp_env_checks(): array {
    $c = [];
    $c[] = ['PHP ' . PHP_VERSION, version_compare(PHP_VERSION, '7.4', '>='), 'butuh PHP 7.4 atau lebih baru (Hostinger: hPanel › Advanced › PHP Configuration)'];
    $c[] = ['ekstensi openssl', extension_loaded('openssl'), 'aktifkan ekstensi openssl'];
    $c[] = ['ekstensi curl', extension_loaded('curl'), 'aktifkan ekstensi curl'];
    $c[] = ['ekstensi pdo_sqlite', extension_loaded('pdo_sqlite'), 'aktifkan ekstensi pdo_sqlite'];
    $c[] = ['fungsi ECDH (openssl_pkey_derive)', function_exists('openssl_pkey_derive'), 'butuh PHP 7.3+ dengan OpenSSL 1.1+'];
    $w = is_dir(KP_DATA) ? is_writable(KP_DATA) : is_writable(KP_DIR);
    $c[] = ['folder data/ bisa ditulis', $w, 'beri izin tulis (755) pada folder data/ lewat File Manager'];
    $ec = false;
    if (extension_loaded('openssl')) { try { $k = wp_generate_keys(); $ec = strlen(b64u_dec($k['publicKey'])) === 65; } catch (Throwable $e) {} }
    $c[] = ['kunci P-256 bisa dibuat', $ec, 'OpenSSL server tidak mendukung kurva prime256v1'];
    return $c;
}
