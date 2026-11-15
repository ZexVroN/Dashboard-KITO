<?php
/* Kanal "dalam aplikasi": perangkat yang TIDAK bisa menerima Web Push tetap menerima notifikasi yang sama dari satu input admin.
   Siapa saja:
     - APK WebView (Android WebView tidak punya Push API / Notifications API),
     - iPhone/iPad yang membuka KITO di Safari (belum ditambahkan ke Layar Utama),
     - perangkat yang menolak izin notifikasi, dan browser lama.
   Cara kerja:
     1. Dashboard (assets/js/notif-otomatis.js) mendaftarkan perangkat ini: POST /api/inapp/register  (ID perangkat + topik, tanpa kunci push).
     2. Admin mengirim notifikasi seperti biasa (POST /api/notifications): kp_dispatch() mengirim Web Push ke perangkat push, dan menyimpan notifikasinya
        di tabel notifications (kolom payload) agar perangkat dalam-aplikasi bisa mengambilnya.
     3. Perangkat dalam-aplikasi mengambil yang baru lewat polling:  GET /api/inbox/poll?device_id=..&since_id=..   (alias /api/webview/poll untuk
        worker APK hasil build tools/android-webview-src), lalu menampilkannya sebagai banner di dalam aplikasi.
   Perangkat yang punya langganan Web Push tidak memakai kanal ini (satu perangkat = satu langganan), sehingga tidak ada notifikasi ganda.
   Riwayat: GET /api/inbox?device_id=.. mengembalikan notifikasi terbaru yang cocok dengan topik perangkat (untuk daftar "Notifikasi terbaru"). */
declare(strict_types=1);

const KP_INAPP_MAKS = 50000;          // batas jumlah perangkat dalam-aplikasi terdaftar
const KP_INBOX_JENDELA = '-3 days';   // notifikasi yang lebih lama dari ini tidak dikirim lewat polling
const KP_INBOX_PINDAI = 100;          // jumlah baris notifikasi yang diperiksa per polling
const KP_INBOX_BANNER = 10;           // maksimal notifikasi yang dikembalikan sekali polling (sisanya dihitung di 'lebih')
const KP_INBOX_JEDA = 60;             // saran jeda polling (detik) untuk klien

function kp_dev_id($v): ?string {
    $s = is_string($v) ? trim($v) : '';
    return preg_match('/^[A-Za-z0-9_-]{8,64}$/', $s) ? $s : null;
}

function kp_app_valid($v): ?string {
    return in_array($v, ['web', 'pwa', 'apk', 'twa'], true) ? $v : null;
}

/* Apakah notifikasi dengan target $t ditujukan ke perangkat $s? Aturan sama dengan kp_targets(): endpoints > all > topics, lalu filter platform. */
function kp_match(array $s, array $topics, array $t): bool {
    if (!empty($t['platforms']) && !in_array($s['platform'], (array)$t['platforms'], true)) return false;
    if (isset($t['endpoints'])) return in_array($s['endpoint'], (array)$t['endpoints'], true);
    if (!empty($t['all'])) return true;
    return (bool)array_intersect($topics, (array)($t['topics'] ?? []));
}

/* Baris notifications -> item untuk klien. null bila sudah kedaluwarsa (ttl), kecuali $abaikanTtl (riwayat). Nama id/title/body/url sesuai kontrak worker APK. */
function kp_inbox_item(array $r, bool $abaikanTtl = false): ?array {
    $p = json_decode((string)($r['payload'] ?? ''), true);
    if (!is_array($p) || !isset($p['title'])) $p = ['title' => (string)$r['title'], 'body' => (string)($r['body'] ?? ''), 'url' => ($r['url'] ?? '') ?: './'];
    $dibuat = strtotime((string)$r['created_at'] . ' UTC') ?: time();
    $ttl = isset($p['ttl']) ? (int)$p['ttl'] : 86400;
    if ($ttl <= 0) $ttl = 600;
    if (!$abaikanTtl && $dibuat + $ttl < time()) return null;
    $item = ['id' => (int)$r['id'], 'title' => (string)$p['title'], 'body' => (string)($p['body'] ?? ''), 'url' => (string)($p['url'] ?? './'), 'waktu' => gmdate('c', $dibuat)];
    foreach (['image', 'tag', 'urgensi', 'tetap', 'aksi'] as $k) if (isset($p[$k])) $item[$k] = $p[$k];
    return $item;
}

/* Perangkat (kanal apa pun) menurut ID perangkat, lengkap dengan topiknya. */
function kp_inbox_perangkat(string $dev, ?string $channel = null): ?array {
    $db = kp_db();
    $q = $db->prepare('SELECT * FROM subscriptions WHERE device_id = ?' . ($channel ? ' AND channel = ?' : '') . ' ORDER BY id DESC LIMIT 1');
    $q->execute($channel ? [$dev, $channel] : [$dev]);
    $s = $q->fetch(); if (!$s) return null;
    $t = $db->prepare('SELECT topic FROM subscription_topics WHERE subscription_id = ?'); $t->execute([$s['id']]);
    $s['topics'] = $t->fetchAll(PDO::FETCH_COLUMN);
    return $s;
}

function kp_inbox_terbaru(): int {
    return (int)kp_db()->query('SELECT COALESCE(MAX(id), 0) FROM notifications')->fetchColumn();
}

/* Daftarkan / perbarui perangkat dalam-aplikasi. Dipanggil lagi saat topik berubah (login, ganti cabang) atau setiap beberapa hari. */
function kp_inapp_register(array $b): array {
    $dev = kp_dev_id($b['deviceId'] ?? ($b['device_id'] ?? null));
    if (!$dev) kp_fail(400, 'deviceId tidak valid');
    $topics = kp_topics_or_default($b['topics'] ?? null);
    $db = kp_db(); $ep = 'inapp:' . $dev;
    $q = $db->prepare('SELECT id FROM subscriptions WHERE endpoint = ?'); $q->execute([$ep]);
    if (!$q->fetchColumn() && (int)$db->query("SELECT COUNT(*) FROM subscriptions WHERE channel = 'inapp'")->fetchColumn() >= KP_INAPP_MAKS) kp_fail(503, 'kapasitas perangkat penuh');
    $ua = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 400); [$pl, $br] = kp_detect($ua);
    $label = !empty($b['label']) ? mb_substr((string)$b['label'], 0, 120) : null;
    $terbaru = kp_inbox_terbaru();
    $db->beginTransaction();
    try {
        // perangkat baru mulai dari notifikasi terbaru (riwayat lama tidak dimunculkan sebagai banner); yang sudah ada mempertahankan kursornya
        $db->prepare("INSERT INTO subscriptions (endpoint, p256dh, auth, platform, browser, standalone, user_agent, label, channel, device_id, app, last_seen_at, cursor_id)
            VALUES (?, '', '', ?, ?, ?, ?, ?, 'inapp', ?, ?, datetime('now'), ?)
            ON CONFLICT(endpoint) DO UPDATE SET platform=excluded.platform, browser=excluded.browser, standalone=excluded.standalone, user_agent=excluded.user_agent,
              label=COALESCE(excluded.label, subscriptions.label), app=COALESCE(excluded.app, subscriptions.app), last_seen_at=datetime('now'), updated_at=datetime('now')")
           ->execute([$ep, $pl, $br, !empty($b['standalone']) ? 1 : 0, $ua, $label, $dev, kp_app_valid($b['app'] ?? null), $terbaru]);
        $q = $db->prepare('SELECT id FROM subscriptions WHERE endpoint = ?'); $q->execute([$ep]); $id = (int)$q->fetchColumn();
        kp_set_topics_id($id, $topics);
        // perangkat ini bukan (lagi) pelanggan push (izin dicabut / tidak tersedia): hapus langganan push lamanya agar tidak ganda atau mati
        $db->prepare("DELETE FROM subscriptions WHERE device_id = ? AND id <> ?")->execute([$dev, $id]);
        $db->commit();
    } catch (Throwable $e) { $db->rollBack(); throw $e; }
    return ['ok' => true, 'id' => $id, 'channel' => 'inapp', 'topics' => $topics, 'latestId' => $terbaru, 'jeda' => KP_INBOX_JEDA, 'platform' => $pl, 'browser' => $br];
}

/* Polling kanal dalam-aplikasi: notifikasi baru (id > since) yang cocok dengan topik perangkat. */
function kp_inapp_poll(string $dev, int $since): array {
    $db = kp_db();
    $s = kp_inbox_perangkat($dev, 'inapp');
    $terbaru = kp_inbox_terbaru();
    $kosong = ['ok' => true, 'terdaftar' => (bool)$s, 'notifications' => [], 'lebih' => 0, 'latestId' => $terbaru, 'jeda' => KP_INBOX_JEDA];
    if (!$s) return $kosong;            // belum terdaftar (atau sudah beralih ke push): klien mendaftar ulang bila perlu
    $since = max(0, $since);
    if ($since > $terbaru) $since = $terbaru;   // kursor klien melebihi server (database direset): mulai lagi dari sekarang
    $lihat = strtotime((string)($s['last_seen_at'] ?? '') . ' UTC') ?: 0;
    if ($terbaru <= $since) {
        if ($lihat < time() - 300) $db->prepare("UPDATE subscriptions SET last_seen_at = datetime('now') WHERE id = ?")->execute([$s['id']]);
        return $kosong;
    }
    $q = $db->prepare('SELECT id, title, body, url, target, payload, created_at FROM notifications WHERE id > ? AND created_at > datetime(\'now\', ?) ORDER BY id ASC LIMIT ' . KP_INBOX_PINDAI);
    $q->execute([$since, KP_INBOX_JENDELA]);
    $baris = $q->fetchAll();
    $cocok = []; $maks = $since;
    foreach ($baris as $r) {
        $maks = max($maks, (int)$r['id']);
        $t = json_decode((string)$r['target'], true);
        if (!is_array($t) || !kp_match($s, $s['topics'], $t)) continue;
        $item = kp_inbox_item($r);
        if ($item) $cocok[] = $item;
    }
    // baris yang tidak terjangkau karena batas pindai: kursor hanya maju sampai baris terakhir yang diperiksa
    $kursor = count($baris) >= KP_INBOX_PINDAI ? $maks : max($maks, $terbaru);
    if (!$baris) $kursor = $terbaru;   // semua baris di luar jendela waktu: lompat ke terbaru
    $lebih = max(0, count($cocok) - KP_INBOX_BANNER);
    $kirim = array_slice($cocok, -KP_INBOX_BANNER);
    // hitung sekali per notifikasi per perangkat (untuk kolom "terbaca" di admin)
    $baru = array_values(array_filter(array_map(function ($i) use ($s) { return $i['id'] > (int)$s['cursor_id'] ? $i['id'] : null; }, $kirim)));
    $db->beginTransaction();
    try {
        if ($baru) $db->exec('UPDATE notifications SET inapp_ok = inapp_ok + 1 WHERE id IN (' . implode(',', array_map('intval', $baru)) . ')');
        $db->prepare("UPDATE subscriptions SET cursor_id = MAX(cursor_id, ?), last_seen_at = datetime('now') WHERE id = ?")->execute([$kursor, $s['id']]);
        $db->commit();
    } catch (Throwable $e) { $db->rollBack(); throw $e; }
    return ['ok' => true, 'terdaftar' => true, 'notifications' => $kirim, 'lebih' => $lebih, 'latestId' => $kursor, 'jeda' => KP_INBOX_JEDA];
}

/* Riwayat: notifikasi terbaru (14 hari) yang cocok dengan topik perangkat, kanal apa pun. Tidak menggeser kursor dan tidak menghitung "terbaca". */
function kp_inbox_riwayat(string $dev, int $batas = 20): array {
    $s = kp_inbox_perangkat($dev);
    $kosong = ['ok' => true, 'terdaftar' => (bool)$s, 'riwayat' => [], 'latestId' => kp_inbox_terbaru()];
    if (!$s) return $kosong;
    $q = kp_db()->prepare('SELECT id, title, body, url, target, payload, created_at FROM notifications WHERE created_at > datetime(\'now\', \'-14 days\') ORDER BY id DESC LIMIT 150');
    $q->execute();
    $hasil = [];
    foreach ($q->fetchAll() as $r) {
        $t = json_decode((string)$r['target'], true);
        if (!is_array($t) || !kp_match($s, $s['topics'], $t)) continue;
        $it = kp_inbox_item($r, true);   // riwayat tetap menampilkan notifikasi yang masa berlaku bannernya sudah lewat
        if ($it) $hasil[] = $it;
        if (count($hasil) >= $batas) break;
    }
    return ['ok' => true, 'terdaftar' => true, 'riwayat' => $hasil, 'latestId' => $kosong['latestId']];
}
