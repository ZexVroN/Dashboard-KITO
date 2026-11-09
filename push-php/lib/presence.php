<?php
/* Pemantauan perangkat (presence): siapa yang sedang membuka dashboard, dari perangkat apa, dan dari lokasi mana.
   - Dashboard (assets/js/pantau.js) mengirim heartbeat tiap 60 detik selama tab terlihat: POST /api/presence/ping
   - Lokasi diperkirakan dari alamat IP (kota/provinsi/negara/ISP) lewat layanan geolokasi IP, disimpan di cache ip_geo.
     Matikan dengan 'geo' => 'off' di data/config.php. Tidak memakai GPS, jadi tidak ada izin lokasi yang diminta ke pengguna.
   - Ringkasan untuk admin: GET /api/presence/summary · GET /api/presence/devices · DELETE /api/presence/devices/<id>
   Semua waktu disimpan UTC; pengelompokan per hari/jam memakai WIB (UTC+7). */
declare(strict_types=1);

const KP_PING_SEC = 60;        // interval heartbeat dari dashboard
const KP_AKTIF_SEC = 150;      // sesi dianggap aktif bila heartbeat terakhir <= 150 detik lalu
const KP_SIMPAN_HARI = 180;    // riwayat sesi disimpan 180 hari
const KP_WIB = '+7 hours';

function kp_presence_db(): PDO {
    static $siap = false;
    $db = kp_db();
    if ($siap) return $db;
    $db->exec("
      CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, platform TEXT, browser TEXT, app TEXT, user_agent TEXT, screen TEXT, lang TEXT, tz TEXT,
        label TEXT, jabatan TEXT, area TEXT, kode TEXT, cabang TEXT, page TEXT, ip TEXT,
        first_seen TEXT NOT NULL DEFAULT (datetime('now')), last_seen TEXT NOT NULL DEFAULT (datetime('now')), visits INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS idx_dev_seen ON devices(last_seen);
      CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE, ip TEXT,
        jabatan TEXT, area TEXT, kode TEXT, page TEXT, pages INTEGER NOT NULL DEFAULT 1, pings INTEGER NOT NULL DEFAULT 1, ended INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL DEFAULT (datetime('now')), last_seen TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_vis_seen ON visits(last_seen);
      CREATE INDEX IF NOT EXISTS idx_vis_dev ON visits(device_id);
      CREATE TABLE IF NOT EXISTS ip_geo (ip TEXT PRIMARY KEY, ok INTEGER NOT NULL DEFAULT 0, country TEXT, country_code TEXT, region TEXT, city TEXT,
        isp TEXT, lat REAL, lon REAL, fetched_at TEXT NOT NULL DEFAULT (datetime('now')));
    ");
    $siap = true;
    return $db;
}

function kp_str($v, int $max): ?string {
    if ($v === null || is_array($v) || is_object($v)) return null;
    $s = trim(preg_replace('/[\x00-\x1F\x7F]+/', ' ', (string)$v));
    return $s === '' ? null : mb_substr($s, 0, $max);
}

/* ---------- heartbeat dari dashboard ---------- */
function kp_presence_ping(array $b): array {
    $dev = (string)($b['d'] ?? ''); $ses = (string)($b['s'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{8,64}$/', $dev) || !preg_match('/^[A-Za-z0-9_-]{8,64}$/', $ses)) return ['ok' => false, 'error' => 'id perangkat tidak valid'];
    $ev = in_array($b['e'] ?? '', ['start', 'ping', 'end'], true) ? $b['e'] : 'ping';
    $ua = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 400); [$pl, $br] = kp_detect($ua);
    $app = in_array($b['app'] ?? '', ['web', 'pwa', 'apk'], true) ? $b['app'] : 'web';
    $ip = kp_ip();
    $f = ['jabatan' => kp_str($b['jabatan'] ?? null, 20), 'area' => kp_str($b['area'] ?? null, 80), 'kode' => kp_str($b['kode'] ?? null, 20),
          'cabang' => kp_str($b['cabang'] ?? null, 120), 'page' => kp_str($b['page'] ?? null, 40)];
    if ($f['jabatan'] !== null) $f['jabatan'] = strtoupper($f['jabatan']);
    $db = kp_presence_db(); $now = kp_now();
    $db->beginTransaction();
    try {
        $q = $db->prepare('SELECT id, page, ended FROM visits WHERE id = ? AND device_id = ?'); $q->execute([$ses, $dev]); $v = $q->fetch();
        $sesiBaru = !$v;
        $db->prepare("INSERT INTO devices (id, platform, browser, app, user_agent, screen, lang, tz, jabatan, area, kode, cabang, page, ip, first_seen, last_seen, visits)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET platform=excluded.platform, browser=excluded.browser, app=excluded.app, user_agent=excluded.user_agent,
            screen=COALESCE(excluded.screen, devices.screen), lang=COALESCE(excluded.lang, devices.lang), tz=COALESCE(excluded.tz, devices.tz),
            jabatan=COALESCE(excluded.jabatan, devices.jabatan), area=COALESCE(excluded.area, devices.area), kode=COALESCE(excluded.kode, devices.kode),
            cabang=COALESCE(excluded.cabang, devices.cabang), page=COALESCE(excluded.page, devices.page), ip=excluded.ip, last_seen=excluded.last_seen,
            visits=devices.visits + excluded.visits")
           ->execute([$dev, $pl, $br, $app, $ua, kp_str($b['scr'] ?? null, 20), kp_str($b['lang'] ?? null, 20), kp_str($b['tz'] ?? null, 50),
                      $f['jabatan'], $f['area'], $f['kode'], $f['cabang'], $f['page'], $ip, $now, $now, $sesiBaru ? 1 : 0]);
        if ($sesiBaru) {
            $db->prepare('INSERT INTO visits (id, device_id, ip, jabatan, area, kode, page, ended, started_at, last_seen) VALUES (?,?,?,?,?,?,?,?,?,?)')
               ->execute([$ses, $dev, $ip, $f['jabatan'], $f['area'], $f['kode'], $f['page'], $ev === 'end' ? 1 : 0, $now, $now]);
        } else {
            $pindah = $f['page'] !== null && $f['page'] !== $v['page'] ? 1 : 0;
            $db->prepare('UPDATE visits SET ip = ?, jabatan = COALESCE(?, jabatan), area = COALESCE(?, area), kode = COALESCE(?, kode), page = COALESCE(?, page),
                pages = pages + ?, pings = pings + 1, ended = ?, last_seen = ? WHERE id = ?')
               ->execute([$ip, $f['jabatan'], $f['area'], $f['kode'], $f['page'], $pindah, $ev === 'end' ? 1 : 0, $now, $ses]);
        }
        $db->commit();
    } catch (Throwable $e) { $db->rollBack(); throw $e; }
    if (random_int(1, 200) === 1) kp_presence_cleanup();
    return ['ok' => true, 'next' => KP_PING_SEC];
}

function kp_presence_cleanup(): void {
    $db = kp_presence_db();
    $db->prepare("DELETE FROM visits WHERE last_seen < datetime('now', ?)")->execute(['-' . KP_SIMPAN_HARI . ' days']);
    $db->prepare("DELETE FROM devices WHERE last_seen < datetime('now', ?)")->execute(['-' . KP_SIMPAN_HARI . ' days']);
    $db->exec('DELETE FROM ip_geo WHERE ip NOT IN (SELECT DISTINCT ip FROM visits WHERE ip IS NOT NULL)');
}

/* ---------- geolokasi IP (dengan cache) ---------- */
function kp_ip_private(string $ip): bool {
    return !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
}

/** Lengkapi lokasi untuk IP yang belum dikenal (atau cache > 30 hari). Dipanggil dari halaman admin dan cron.php. */
function kp_geo_resolve(int $max = 15): int {
    $c = kp_config();
    if (($c['geo'] ?? 'ipwho') === 'off' || !function_exists('curl_init')) return 0;
    $db = kp_presence_db();
    $q = $db->prepare("SELECT DISTINCT v.ip FROM visits v LEFT JOIN ip_geo g ON g.ip = v.ip
        WHERE v.ip IS NOT NULL AND (g.ip IS NULL OR g.fetched_at < datetime('now', '-30 days') OR (g.ok = 0 AND g.fetched_at < datetime('now', '-1 day')))
        ORDER BY v.last_seen DESC LIMIT ?");
    $q->bindValue(1, $max, PDO::PARAM_INT); $q->execute();
    $ips = $q->fetchAll(PDO::FETCH_COLUMN);
    if (!$ips) return 0;
    $simpan = $db->prepare('INSERT OR REPLACE INTO ip_geo (ip, ok, country, country_code, region, city, isp, lat, lon, fetched_at) VALUES (?,?,?,?,?,?,?,?,?,datetime(\'now\'))');
    $mh = curl_multi_init(); $hs = [];
    foreach ($ips as $ip) {
        if (kp_ip_private($ip)) { $simpan->execute([$ip, 1, 'Jaringan lokal', null, null, 'Jaringan lokal', null, null, null]); continue; }
        $h = curl_init('https://ipwho.is/' . rawurlencode($ip) . '?fields=success,country,country_code,region,city,latitude,longitude,connection');
        curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 4, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_USERAGENT => 'KITO-Dashboard/1.0']);
        curl_multi_add_handle($mh, $h); $hs[$ip] = $h;
    }
    do { $st = curl_multi_exec($mh, $jalan); if ($jalan) curl_multi_select($mh, 1.0); } while ($jalan && $st === CURLM_OK);
    $n = 0;
    foreach ($hs as $ip => $h) {
        $j = json_decode((string)curl_multi_getcontent($h), true);
        curl_multi_remove_handle($mh, $h); curl_close($h);
        if (is_array($j) && !empty($j['success'])) {
            $simpan->execute([$ip, 1, $j['country'] ?? null, $j['country_code'] ?? null, $j['region'] ?? null, $j['city'] ?? null,
                $j['connection']['isp'] ?? $j['connection']['org'] ?? null, $j['latitude'] ?? null, $j['longitude'] ?? null]);
            $n++;
        } else {
            $simpan->execute([$ip, 0, null, null, null, null, null, null, null]);   // dicoba lagi besok
        }
    }
    curl_multi_close($mh);
    return $n;
}

/* ---------- ringkasan untuk admin ---------- */
function kp_rows(PDOStatement $q): array {
    return array_map(function ($r) { foreach ($r as $k => $v) if (is_string($v) && preg_match('/^-?\d+$/', $v) && in_array($k, ['n', 'sesi', 'perangkat', 'detik', 'jam'], true)) $r[$k] = (int)$v; return $r; }, $q->fetchAll());
}

function kp_presence_summary(int $hari): array {
    $db = kp_presence_db();
    $hari = max(1, min(KP_SIMPAN_HARI, $hari));
    $sejak = gmdate('Y-m-d H:i:s', time() - $hari * 86400);
    $aktifBatas = gmdate('Y-m-d H:i:s', time() - KP_AKTIF_SEC);
    $hariIniWib = gmdate('Y-m-d', time() + 7 * 3600);

    $aktif = $db->prepare("SELECT v.device_id, v.id sesi_id, v.page, v.started_at, v.last_seen, v.ip, d.platform, d.browser, d.app, d.label,
            COALESCE(v.jabatan, d.jabatan) jabatan, COALESCE(v.area, d.area) area, COALESCE(v.kode, d.kode) kode, d.cabang,
            g.city, g.region, g.country, g.isp, CAST(strftime('%s', v.last_seen) - strftime('%s', v.started_at) AS INTEGER) detik
        FROM visits v JOIN devices d ON d.id = v.device_id LEFT JOIN ip_geo g ON g.ip = v.ip
        WHERE v.ended = 0 AND v.last_seen >= ? ORDER BY v.last_seen DESC LIMIT 500");
    $aktif->execute([$aktifBatas]); $aktif = kp_rows($aktif);
    // satu perangkat bisa membuka beberapa tab: hitung perangkat unik
    $aktifUnik = count(array_unique(array_column($aktif, 'device_id')));

    $angka = function (string $sql, array $p = []) use ($db) { $q = $db->prepare($sql); $q->execute($p); return (int)$q->fetchColumn(); };
    $kelompok = function (string $kolom, string $dari = 'devices d', string $saring = 'd.last_seen >= ?') use ($db, $sejak) {
        $q = $db->prepare("SELECT COALESCE($kolom, 'Tidak diketahui') nama, COUNT(DISTINCT d.id) n FROM $dari WHERE $saring GROUP BY 1 ORDER BY 2 DESC LIMIT 100");
        $q->execute([$sejak]); return kp_rows($q);
    };
    $geo = 'visits v JOIN devices d ON d.id = v.device_id LEFT JOIN ip_geo g ON g.ip = v.ip';

    $perHari = $db->prepare("SELECT date(started_at, '" . KP_WIB . "') tanggal, COUNT(DISTINCT device_id) perangkat, COUNT(*) sesi FROM visits WHERE started_at >= ? GROUP BY 1 ORDER BY 1");
    $perHari->execute([$sejak]);
    $perJam = $db->prepare("SELECT CAST(strftime('%H', started_at, '" . KP_WIB . "') AS INTEGER) jam, COUNT(*) sesi, COUNT(DISTINCT device_id) perangkat FROM visits WHERE started_at >= ? GROUP BY 1 ORDER BY 1");
    $perJam->execute([$sejak]);
    $titik = $db->prepare("SELECT g.city kota, g.region provinsi, g.lat, g.lon, COUNT(DISTINCT v.device_id) n FROM visits v JOIN ip_geo g ON g.ip = v.ip
        WHERE v.last_seen >= ? AND g.lat IS NOT NULL GROUP BY g.city, g.region ORDER BY n DESC LIMIT 300");
    $titik->execute([$sejak]);
    $durasi = $db->prepare("SELECT AVG(strftime('%s', last_seen) - strftime('%s', started_at)) FROM visits WHERE started_at >= ?"); $durasi->execute([$sejak]);

    return [
        'waktu' => gmdate('c'), 'hari' => $hari, 'aktifDetik' => KP_AKTIF_SEC, 'geo' => (kp_config()['geo'] ?? 'ipwho') !== 'off',
        'ringkas' => [
            'aktifSekarang' => $aktifUnik,
            'tabAktif' => count($aktif),
            'hariIni' => $angka("SELECT COUNT(DISTINCT device_id) FROM visits WHERE date(last_seen, '" . KP_WIB . "') = ?", [$hariIniWib]),
            'periode' => $angka('SELECT COUNT(*) FROM devices WHERE last_seen >= ?', [$sejak]),
            'baru' => $angka('SELECT COUNT(*) FROM devices WHERE first_seen >= ?', [$sejak]),
            'sesi' => $angka('SELECT COUNT(*) FROM visits WHERE started_at >= ?', [$sejak]),
            'totalPerangkat' => $angka('SELECT COUNT(*) FROM devices'),
            'rataDurasiDetik' => (int)round((float)$durasi->fetchColumn()),
        ],
        'aktif' => $aktif,
        'perPlatform' => $kelompok('d.platform'),
        'perBrowser' => $kelompok('d.browser'),
        'perAplikasi' => $kelompok('d.app'),
        'perJabatan' => $kelompok('d.jabatan'),
        'perArea' => $kelompok('d.area'),
        'perCabang' => $kelompok("d.kode || ' · ' || COALESCE(d.cabang, '')"),
        'perHalaman' => $kelompok('v.page', 'visits v JOIN devices d ON d.id = v.device_id', 'v.last_seen >= ?'),
        // lokasi akses (perkiraan dari IP): satu perangkat bisa muncul di beberapa kota bila berpindah jaringan
        'perNegara' => $kelompok('g.country', $geo, 'v.last_seen >= ?'),
        'perProvinsi' => $kelompok('g.region', $geo, 'v.last_seen >= ?'),
        'perKota' => $kelompok("g.city || ', ' || COALESCE(g.region, '')", $geo, 'v.last_seen >= ?'),
        'perISP' => $kelompok('g.isp', $geo, 'v.last_seen >= ?'),
        'titik' => $titik->fetchAll(),
        'perHari' => kp_rows($perHari),
        'perJam' => kp_rows($perJam),
    ];
}

function kp_presence_devices(int $hari, string $cari, int $limit): array {
    $db = kp_presence_db();
    $sejak = gmdate('Y-m-d H:i:s', time() - max(1, min(KP_SIMPAN_HARI, $hari)) * 86400);
    $sql = "SELECT d.id, d.platform, d.browser, d.app, d.label, d.jabatan, d.area, d.kode, d.cabang, d.page, d.ip, d.screen, d.lang, d.tz, d.user_agent,
            d.first_seen, d.last_seen, d.visits sesi, g.city, g.region, g.country, g.isp,
            (SELECT COUNT(DISTINCT ip) FROM visits WHERE device_id = d.id) jumlah_ip,
            (SELECT SUM(strftime('%s', last_seen) - strftime('%s', started_at)) FROM visits WHERE device_id = d.id AND started_at >= ?) detik,
            EXISTS (SELECT 1 FROM visits WHERE device_id = d.id AND ended = 0 AND last_seen >= ?) aktif
        FROM devices d LEFT JOIN ip_geo g ON g.ip = d.ip WHERE d.last_seen >= ?";
    $p = [$sejak, gmdate('Y-m-d H:i:s', time() - KP_AKTIF_SEC), $sejak];
    if ($cari !== '') {
        $sql .= " AND (d.id LIKE ? OR d.label LIKE ? OR d.jabatan LIKE ? OR d.area LIKE ? OR d.kode LIKE ? OR d.cabang LIKE ? OR d.ip LIKE ? OR g.city LIKE ? OR g.region LIKE ? OR d.platform LIKE ?)";
        $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $cari) . '%';
        $sql = str_replace(' LIKE ?', " LIKE ? ESCAPE '\\'", $sql);
        array_push($p, ...array_fill(0, 10, $like));
    }
    $sql .= ' ORDER BY d.last_seen DESC LIMIT ' . max(1, min(2000, $limit));
    $q = $db->prepare($sql); $q->execute($p);
    return array_map(function ($r) { $r['sesi'] = (int)$r['sesi']; $r['jumlah_ip'] = (int)$r['jumlah_ip']; $r['detik'] = (int)$r['detik']; $r['aktif'] = (bool)$r['aktif']; return $r; }, $q->fetchAll());
}

function kp_presence_label(string $id, ?string $label): bool {
    $q = kp_presence_db()->prepare('UPDATE devices SET label = ? WHERE id = ?'); $q->execute([$label, $id]);
    return $q->rowCount() > 0;
}

function kp_presence_delete(string $id): bool {
    $db = kp_presence_db();
    $db->prepare('DELETE FROM visits WHERE device_id = ?')->execute([$id]);
    $q = $db->prepare('DELETE FROM devices WHERE id = ?'); $q->execute([$id]);
    return $q->rowCount() > 0;
}
