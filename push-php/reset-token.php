<?php
/* Reset token admin tanpa menyentuh kunci VAPID (langganan lama tetap berlaku).
   Pengaman: hanya jalan bila berkas data/RESET-TOKEN ada (dibuat lewat File Manager hosting);
   berkas itu dihapus otomatis setelah token baru dibuat, jadi tiap reset butuh akses hosting. */
declare(strict_types=1);
require __DIR__ . '/lib/app.php';
require __DIR__ . '/lib/page.php';

const KP_RESET_FLAG = KP_DATA . '/RESET-TOKEN';

kp_page_start('KITO Push · Reset token admin');
$cfg = kp_config();
if (!$cfg) {
    echo '<div class="cd"><p class="bad">Backend belum disetel.</p><p><a class="btn" href="setup.php">Buka setup</a></p></div>';
    kp_page_end(); exit;
}
if (!is_file(KP_RESET_FLAG)) {
    echo '<div class="cd"><h2>Reset token admin</h2>
      <p>Demi keamanan, reset hanya bisa dilakukan oleh pemilik hosting:</p><ol>
      <li>Buka File Manager hosting › folder <code>push/data/</code>.</li>
      <li>Buat berkas kosong bernama <code>RESET-TOKEN</code> (tanpa ekstensi).</li>
      <li>Muat ulang halaman ini, lalu klik <b>Buat token baru</b>.</li></ol>
      <p class="mu">Hanya token admin yang diganti. Kunci VAPID dan semua langganan tetap aman.</p></div>';
    kp_page_end(); exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $token = b64u_enc(random_bytes(24));
        $cfg['admin_token'] = $token;
        $cfg['token_direset'] = gmdate('c');
        kp_save_config($cfg);
        @unlink(KP_RESET_FLAG);
        $hapus = is_file(KP_RESET_FLAG) ? '<p class="bad">Berkas <code>data/RESET-TOKEN</code> gagal dihapus otomatis. Hapus manual lewat File Manager.</p>' : '';
        echo '<div class="cd"><h2>Berhasil</h2><p class="ok">✔ Token admin baru sudah aktif. Token lama tidak berlaku lagi.</p>
          <label>Token admin baru (simpan baik-baik, hanya ditampilkan sekali)</label><pre class="tok" id="tok">' . kp_h($token) . '</pre>
          <button type="button" onclick="navigator.clipboard.writeText(document.getElementById(\'tok\').textContent).then(()=>this.textContent=\'Tersalin ✔\')">Salin token</button>' . $hapus . '
          <p class="mu">Perbarui juga <code>KITO_PUSH_TOKEN</code> bila skrip update harian mengirim notifikasi otomatis.</p>
          <p><a class="btn" href="index.php/admin">Buka halaman admin</a></p></div>';
    } catch (Throwable $e) {
        echo '<div class="cd"><p class="bad">Gagal menyimpan: ' . kp_h($e->getMessage()) . '</p></div>';
    }
    kp_page_end(); exit;
}

echo '<div class="cd"><h2>Reset token admin</h2><p class="ok">✔ Berkas <code>data/RESET-TOKEN</code> ditemukan.</p>
  <form method="post"><p><button type="submit">Buat token baru</button></p></form>
  <p class="mu">Token lama langsung tidak berlaku. Kunci VAPID dan langganan tidak berubah.</p></div>';
kp_page_end();
