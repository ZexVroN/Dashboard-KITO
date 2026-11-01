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
    return $db;
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

function kp_ip(): string {
    $f = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    return trim(explode(',', $f)[0]) ?: ($_SERVER['REMOTE_ADDR'] ?? '?');
}

function kp_rate(string $key, int $perMinute): bool {
    $db = kp_db(); $now = time();
    if (random_int(1, 50) === 1) $db->prepare('DELETE FROM hits WHERE t < ?')->execute([$now - 120]);
    $q = $db->prepare('SELECT COUNT(*) FROM hits WHERE k = ? AND t > ?'); $q->execute([$key, $now - 60]);
    if ((int)$q->fetchColumn() >= $perMinute) return false;
    $db->prepare('INSERT INTO hits (k, t) VALUES (?, ?)')->execute([$key, $now]);
    return true;
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
        $db->prepare("INSERT INTO subscriptions (endpoint, p256dh, auth, platform, browser, standalone, user_agent, label) VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth, platform=excluded.platform, browser=excluded.browser,
          standalone=excluded.standalone, user_agent=excluded.user_agent, label=COALESCE(excluded.label, subscriptions.label), updated_at=datetime('now'), fail_count=0")
           ->execute([$s['endpoint'], $s['p256dh'], $s['auth'], $s['platform'], $s['browser'], $s['standalone'] ? 1 : 0, $s['user_agent'], $s['label']]);
        $q = $db->prepare('SELECT id FROM subscriptions WHERE endpoint = ?'); $q->execute([$s['endpoint']]); $id = (int)$q->fetchColumn();
        kp_set_topics_id($id, $topics);
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

function kp_dispatch(array $n, string $source = 'api'): array {
    $c = kp_config(); $db = kp_db();
    $vapid = ['publicKey' => $c['vapid_public'], 'privateKey' => $c['vapid_private'], 'subject' => $c['vapid_subject']];
    $subs = kp_targets($n['target']);
    $db->prepare('INSERT INTO notifications (title, body, url, target, source) VALUES (?,?,?,?,?)')->execute([$n['title'], $n['body'] ?? null, $n['url'] ?? null, json_encode($n['target']), $source]);
    $nid = (int)$db->lastInsertId();
    $payload = kp_payload($n); $res = ['id' => $nid, 'targets' => count($subs), 'sent' => 0, 'failed' => 0, 'removed' => 0];
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
    return [
        'total' => (int)$db->query('SELECT COUNT(*) FROM subscriptions')->fetchColumn(),
        'perPlatform' => array_map(function ($r) { $r['n'] = (int)$r['n']; return $r; }, $db->query("SELECT COALESCE(platform,'lainnya') platform, COUNT(*) n FROM subscriptions GROUP BY 1 ORDER BY 2 DESC")->fetchAll()),
        'perBrowser' => array_map(function ($r) { $r['n'] = (int)$r['n']; return $r; }, $db->query("SELECT COALESCE(browser,'lainnya') browser, COUNT(*) n FROM subscriptions GROUP BY 1 ORDER BY 2 DESC")->fetchAll()),
        'terpasang' => (int)$db->query('SELECT COUNT(*) FROM subscriptions WHERE standalone = 1')->fetchColumn(),
        'perTopic' => array_map(function ($r) { $r['n'] = (int)$r['n']; return $r; }, $db->query('SELECT topic, COUNT(*) n FROM subscription_topics GROUP BY topic ORDER BY 2 DESC LIMIT 200')->fetchAll()),
        'notifikasi' => (int)$db->query('SELECT COUNT(*) FROM notifications')->fetchColumn(),
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
