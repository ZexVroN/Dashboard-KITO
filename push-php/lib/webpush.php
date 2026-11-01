<?php
/**
 * Web Push tanpa library luar (ekstensi openssl + curl bawaan PHP 7.4+).
 *  - VAPID (RFC 8292): JWT ES256
 *  - Enkripsi payload aes128gcm (RFC 8291 + RFC 8188)
 */
declare(strict_types=1);

function b64u_enc(string $b): string { return rtrim(strtr(base64_encode($b), '+/', '-_'), '='); }
function b64u_dec(string $s): string { $r = base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); return $r === false ? '' : $r; }

// kunci P-256 mentah -> PEM (struktur DER tetap untuk prime256v1)
function wp_pem_private(string $d, string $pub): string {
    $der = hex2bin('30770201010420') . $d . hex2bin('a00a06082a8648ce3d030107a144034200') . $pub;
    return "-----BEGIN EC PRIVATE KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END EC PRIVATE KEY-----\n";
}
function wp_pem_public(string $pub): string {
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $pub;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

/** Pasangan kunci baru: ['publicKey' => b64u(65 byte), 'privateKey' => b64u(32 byte)] */
function wp_generate_keys(): array {
    $k = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
    if (!$k) throw new RuntimeException('openssl_pkey_new gagal: ' . openssl_error_string());
    $ec = openssl_pkey_get_details($k)['ec'];
    $pad = function ($s) { return str_pad($s, 32, "\0", STR_PAD_LEFT); };
    return ['publicKey' => b64u_enc("\x04" . $pad($ec['x']) . $pad($ec['y'])), 'privateKey' => b64u_enc($pad($ec['d'])), '_key' => $k];
}

// tanda tangan DER ECDSA -> r||s 64 byte (format JWS)
function wp_der_to_raw(string $der): string {
    $pos = 2; if (ord($der[1]) & 0x80) $pos += ord($der[1]) & 0x7f;
    $out = '';
    for ($i = 0; $i < 2; $i++) {
        $pos++; $len = ord($der[$pos++]); $int = substr($der, $pos, $len); $pos += $len;
        $out .= str_pad(ltrim($int, "\0"), 32, "\0", STR_PAD_LEFT);
    }
    return $out;
}

function wp_vapid_jwt(string $audience, string $subject, string $pubB64, string $privB64, int $exp = 43200): string {
    $input = b64u_enc(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])) . '.' . b64u_enc(json_encode(['aud' => $audience, 'exp' => time() + $exp, 'sub' => $subject]));
    if (!openssl_sign($input, $sig, wp_pem_private(b64u_dec($privB64), b64u_dec($pubB64)), OPENSSL_ALGO_SHA256)) throw new RuntimeException('tanda tangan VAPID gagal');
    return $input . '.' . b64u_enc(wp_der_to_raw($sig));
}

const WP_RS = 4096;
const WP_MAX_PAYLOAD = 3993;

/** Enkripsi aes128gcm. $test = ['salt' => bin, 'asPriv' => bin(32)] hanya untuk pengujian. */
function wp_encrypt(string $payload, string $p256dhB64, string $authB64, array $test = []): string {
    $ua = b64u_dec($p256dhB64); $auth = b64u_dec($authB64);
    if (strlen($ua) !== 65 || $ua[0] !== "\x04") throw new InvalidArgumentException('p256dh tidak valid');
    if (strlen($auth) < 16) throw new InvalidArgumentException('auth tidak valid');
    if (strlen($payload) > WP_MAX_PAYLOAD) throw new InvalidArgumentException('payload terlalu besar');

    if (isset($test['asPriv'])) {
        // kunci server tetap (vektor uji): butuh kunci publiknya juga
        $asPub = $test['asPub']; $asKey = openssl_pkey_get_private(wp_pem_private($test['asPriv'], $asPub));
    } else {
        $g = wp_generate_keys(); $asKey = $g['_key']; $asPub = b64u_dec($g['publicKey']);
    }
    $secret = openssl_pkey_derive(openssl_pkey_get_public(wp_pem_public($ua)), $asKey, 32);
    if ($secret === false) throw new RuntimeException('ECDH gagal: ' . openssl_error_string());
    $salt = $test['salt'] ?? random_bytes(16);

    $ikm = hash_hkdf('sha256', $secret, 32, "WebPush: info\0" . $ua . $asPub, $auth);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
    $ct = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    return $salt . pack('N', WP_RS) . chr(strlen($asPub)) . $asPub . $ct . $tag;
}

/** Header + body untuk satu pengiriman. */
function wp_build_request(array $sub, ?string $payload, array $vapid, array $opt = []): array {
    $p = parse_url($sub['endpoint']);
    $aud = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
    $h = [
        'TTL: ' . max(0, min((int)($opt['ttl'] ?? 86400), 2419200)),
        'Urgency: ' . (in_array($opt['urgency'] ?? '', ['very-low', 'low', 'normal', 'high'], true) ? $opt['urgency'] : 'normal'),
        'Authorization: vapid t=' . wp_vapid_jwt($aud, $vapid['subject'], $vapid['publicKey'], $vapid['privateKey']) . ', k=' . $vapid['publicKey'],
    ];
    if (!empty($opt['topic'])) $h[] = 'Topic: ' . substr(preg_replace('/[^A-Za-z0-9_-]/', '', $opt['topic']), 0, 32);
    $body = '';
    if ($payload !== null) {
        $body = wp_encrypt($payload, $sub['p256dh'], $sub['auth']);
        $h[] = 'Content-Type: application/octet-stream';
        $h[] = 'Content-Encoding: aes128gcm';
    }
    $h[] = 'Content-Length: ' . strlen($body);
    return ['url' => $sub['endpoint'], 'headers' => $h, 'body' => $body];
}

/**
 * Kirim paralel (curl_multi). $jobs: [key => request]. Hasil: [key => ['status' => int, 'body' => str, 'error' => str|null, 'retryAfter' => int|null]]
 */
function wp_send_many(array $jobs, int $concurrency = 25, int $timeout = 15): array {
    $out = []; $queue = $jobs; $mh = curl_multi_init(); $active = [];
    $add = function () use (&$queue, &$active, $mh, $timeout) {
        if (!$queue) return false;
        $key = array_key_first($queue); $r = $queue[$key]; unset($queue[$key]);
        $ch = curl_init($r['url']);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $r['body'], CURLOPT_HTTPHEADER => $r['headers'],
            CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 8]);
        curl_multi_add_handle($mh, $ch); $active[(int)$ch] = [$key, $ch];
        return true;
    };
    for ($i = 0; $i < $concurrency && $add(); $i++);
    do {
        curl_multi_exec($mh, $running);
        while ($info = curl_multi_info_read($mh)) {
            $ch = $info['handle']; [$key] = $active[(int)$ch]; unset($active[(int)$ch]);
            $raw = (string)curl_multi_getcontent($ch); $hs = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $ra = null; if (preg_match('/^retry-after:\s*(\d+)/mi', substr($raw, 0, $hs), $m)) $ra = (int)$m[1];
            $out[$key] = ['status' => (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE), 'body' => substr(substr($raw, $hs), 0, 500),
                'error' => $info['result'] !== CURLE_OK ? curl_error($ch) : null, 'retryAfter' => $ra];
            curl_multi_remove_handle($mh, $ch); curl_close($ch);
            $add();
        }
        if ($running) curl_multi_select($mh, 1.0);
    } while ($running || $active);
    curl_multi_close($mh);
    return $out;
}
