<?php
/* Setup sekali klik: membuat kunci VAPID + token admin dan menyimpannya di data/config.php. */
declare(strict_types=1);
require __DIR__ . '/lib/app.php';
require __DIR__ . '/lib/page.php';

$base = kp_base_url();
kp_page_start('KITO Push · Setup');

if (kp_config() && empty($_GET['selesai'])) {
    echo '<div class="cd"><h2>Sudah disetel</h2><p class="ok">✔ Backend notifikasi sudah aktif.</p>
      <p><a class="btn" href="index.php/admin">Buka halaman admin</a> <a class="btn sec" href="status.php">Cek status</a></p>
      <p class="mu">Lupa token admin? Buka <code>data/config.php</code> lewat File Manager hosting, lihat nilai <code>admin_token</code>, atau <a href="reset-token.php">reset token</a>.<br>
      Jangan hapus <code>config.php</code> setelah ada pelanggan: kunci baru membuat semua langganan lama tidak berlaku.</p></div>';
    kp_page_end(); exit;
}

$checks = kp_env_checks();
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !kp_config()) {
    $email = trim((string)($_POST['email'] ?? ''));
    $origins = array_values(array_filter(array_map(function ($o) { return rtrim(trim($o), '/'); }, preg_split('/[\s,]+/', (string)($_POST['origins'] ?? '')))));
    $err = [];
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $err[] = 'Email pengelola tidak valid.';
    if (!$origins) $err[] = 'Isi alamat dashboard (mis. https://zexvron.github.io).';
    foreach ($origins as $o) if (!preg_match('#^https?://[^/]+$#', $o)) $err[] = "Alamat dashboard \"$o\" harus berbentuk https://domain tanpa garis miring/path.";
    if (!$err) {
        try {
            $k = wp_generate_keys();
            $token = b64u_enc(random_bytes(24));
            kp_save_config(['vapid_public' => $k['publicKey'], 'vapid_private' => $k['privateKey'], 'vapid_subject' => 'mailto:' . $email,
                'admin_token' => $token, 'cron_key' => b64u_enc(random_bytes(12)), 'allowed_origins' => $origins,
                'default_url' => '', 'default_icon' => '', 'dibuat' => gmdate('c')]);
            kp_db(); // buat database sekarang
            $c = kp_config();
            echo '<div class="cd"><h2>Berhasil</h2><p class="ok">✔ Backend notifikasi aktif.</p>
              <label>Token admin (simpan baik-baik, hanya ditampilkan sekali)</label><pre class="tok" id="tok">' . kp_h($token) . '</pre>
              <button type="button" onclick="navigator.clipboard.writeText(document.getElementById(\'tok\').textContent).then(()=>this.textContent=\'Tersalin ✔\')">Salin token</button></div>
              <div class="cd"><h2>Langkah berikutnya</h2><ol>
              <li>Di dashboard KITO, isi <code>assets/js/push-config.js</code>:<pre>window.KITO_PUSH = { api: \'' . kp_h($base) . '\' };</pre>
                  <small>Bila halaman admin di bawah tidak terbuka tanpa <code>index.php</code>, pakai <code>' . kp_h($base) . '/index.php</code>.</small></li>
              <li>Buka <a href="index.php/admin">halaman admin</a> dan masuk dengan token di atas.</li>
              <li>(Disarankan) Cron Job tiap 5 menit agar notifikasi terjadwal tepat waktu. Di Hostinger: hPanel › Advanced › Cron Jobs › Custom:
                  <pre>curl -s "' . kp_h($base) . '/cron.php?key=' . kp_h($c['cron_key']) . '" &gt;/dev/null</pre></li>
              <li>Buka <a href="status.php">status.php</a> › <b>Uji koneksi push service</b> untuk memastikan server bisa menghubungi Google, Apple, Mozilla, dan Microsoft.</li>
              <li>Uji dari HP: buka dashboard › 🔔 › Aktifkan › Kirim tes.</li></ol></div>';
            kp_page_end(); exit;
        } catch (Throwable $e) { $err[] = 'Gagal menyimpan: ' . $e->getMessage(); }
    }
    echo '<div class="cd"><p class="bad">' . implode('<br>', array_map('kp_h', $err)) . '</p></div>';
}

echo '<div class="cd"><h2>1. Pemeriksaan hosting</h2>';
$siap = kp_checklist($checks);
echo '</div>';
if (!$siap) { echo '<div class="cd"><p class="bad">Perbaiki butir bertanda ✖ di atas, lalu muat ulang halaman ini.</p></div>'; kp_page_end(); exit; }

$ref = '';
if (!empty($_SERVER['HTTP_REFERER'])) { $u = parse_url($_SERVER['HTTP_REFERER']); if (!empty($u['host']) && $u['host'] !== ($_SERVER['HTTP_HOST'] ?? '')) $ref = $u['scheme'] . '://' . $u['host']; }
echo '<div class="cd"><h2>2. Isi dua data ini</h2><form method="post">
  <label for="email">Email pengelola <small>(wajib menurut standar Web Push; tidak dikirim ke pengguna)</small></label>
  <input id="email" name="email" type="email" required placeholder="ops@domain.id" value="' . kp_h($_POST['email'] ?? '') . '">
  <label for="origins">Alamat dashboard KITO <small>(tempat tombol 🔔 berada; pisahkan koma bila lebih dari satu)</small></label>
  <input id="origins" name="origins" type="text" required placeholder="https://zexvron.github.io" value="' . kp_h($_POST['origins'] ?? $ref) . '">
  <p><button type="submit">Aktifkan backend notifikasi</button></p>
  <p class="mu">Kunci VAPID dan token admin dibuat otomatis lalu disimpan di <code>data/config.php</code> (tidak bisa dibuka dari browser).</p></form></div>';
kp_page_end();
