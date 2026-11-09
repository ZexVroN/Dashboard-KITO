<?php
/* Diagnosis: lingkungan PHP, konfigurasi (tanpa nilai rahasia), database, dan uji koneksi ke push service. */
declare(strict_types=1);
require __DIR__ . '/lib/app.php';
require __DIR__ . '/lib/page.php';

kp_page_start('KITO Push · Status', 'status');
$cfg = kp_config();

echo '<div class="cd"><h2>Hosting</h2>'; kp_checklist(kp_env_checks()); echo '</div>';

echo '<div class="cd"><h2>Konfigurasi</h2>';
if (!$cfg) { echo '<p class="bad">Belum disetel.</p><p><a class="btn" href="setup.php">Buka setup</a></p></div>'; kp_page_end(); exit; }
$st = ['total' => '?', 'notifikasi' => '?']; $dbErr = null;
try { $st = kp_stats(); } catch (Throwable $e) { $dbErr = $e->getMessage(); }
$pend = $dbErr ? '?' : (int)kp_db()->query("SELECT COUNT(*) FROM scheduled WHERE status = 'menunggu'")->fetchColumn();
kp_checklist([
    ['Kunci VAPID tersimpan', strlen(b64u_dec($cfg['vapid_public'] ?? '')) === 65 && strlen(b64u_dec($cfg['vapid_private'] ?? '')) === 32, 'jalankan ulang setup'],
    ['Token admin tersimpan', strlen($cfg['admin_token'] ?? '') >= 24, 'jalankan ulang setup'],
    ['Alamat dashboard (CORS): ' . implode(', ', $cfg['allowed_origins'] ?? []), !empty($cfg['allowed_origins']), 'isi allowed_origins di data/config.php'],
    ['Database: ' . ($dbErr ? $dbErr : $st['total'] . ' perangkat berlangganan · ' . $st['notifikasi'] . ' notifikasi · ' . $pend . ' jadwal menunggu'), !$dbErr, 'periksa izin folder data/'],
]);
echo '</div>';

// cek rewrite .htaccess dari browser
echo '<div class="cd"><h2>Alamat API</h2><ul class="ck"><li id="rw1">… memeriksa <code>/api/health</code></li><li id="rw2">… memeriksa <code>/index.php/api/health</code></li></ul>
<p class="mu" id="rwk"></p></div>
<script>
(async()=>{const t=async(u,id,lbl)=>{try{const r=await fetch(u,{cache:"no-store"});const j=await r.json();const ok=r.ok&&j.ok;document.getElementById(id).innerHTML=(ok?"<span class=ok>✔</span> ":"<span class=bad>✖</span> ")+lbl;return ok;}catch(e){document.getElementById(id).innerHTML="<span class=bad>✖</span> "+lbl;return false;}};
const base=location.href.replace(/status\.php.*$/,"");
const a=await t(base+"api/health","rw1","<code>"+base+"api/health</code>"),b=await t(base+"index.php/api/health","rw2","<code>"+base+"index.php/api/health</code>");
document.getElementById("rwk").innerHTML=a?"Isi push-config.js dengan <code>api: \'"+base.replace(/\/$/,"")+"\'</code>":(b?"Rewrite .htaccess tidak aktif. Isi push-config.js dengan <code>api: \'"+base+"index.php\'</code>":"<span class=bad>API tidak menjawab; lihat error_log di folder ini.</span>");})();
</script>';

// uji koneksi keluar ke push service resmi
echo '<div class="cd"><h2>Koneksi ke push service</h2>';
if (($_SERVER['REQUEST_METHOD'] === 'POST') && isset($_POST['uji'])) {
    if (!kp_rate('uji:' . kp_ip(), 3)) { echo '<p class="bad">Tunggu satu menit sebelum menguji lagi.</p>'; }
    else {
        $id = bin2hex(random_bytes(8)); $v = ['publicKey' => $cfg['vapid_public'], 'privateKey' => $cfg['vapid_private'], 'subject' => $cfg['vapid_subject']];
        $t = ['Google (Chrome, Edge, Android)' => "https://fcm.googleapis.com/fcm/send/kito-cek-$id", 'Mozilla (Firefox)' => "https://updates.push.services.mozilla.com/wpush/v2/kito-cek-$id",
              'Apple (Safari, iPhone/iPad)' => "https://web.push.apple.com/kito-cek-$id", 'Microsoft (Windows)' => "https://wns2-par02p.notify.windows.com/w/?token=kito-cek-$id"];
        $jobs = []; foreach ($t as $n => $u) $jobs[$n] = wp_build_request(['endpoint' => $u], null, $v, ['ttl' => 60]);
        $res = wp_send_many($jobs, 4, 12); $hasil = [];
        foreach ($res as $n => $r) {
            if ($r['error'] || !$r['status']) $hasil[] = [$n . ': tidak terjangkau (' . ($r['error'] ?: 'tanpa jawaban') . ')', false, 'hosting memblokir koneksi keluar; hubungi dukungan hosting'];
            elseif (strpos($n, 'Google') === 0 && in_array($r['status'], [401, 403], true) && preg_match('/jwt|vapid|authori|crypto-key|signature/i', $r['body'])) $hasil[] = [$n . ': terhubung, tetapi JWT VAPID ditolak (HTTP ' . $r['status'] . ')', false, 'jalankan ulang setup untuk membuat kunci baru'];
            else $hasil[] = [$n . ': terhubung (HTTP ' . $r['status'] . ' untuk endpoint uji' . (strpos($n, 'Google') === 0 ? ', JWT tidak ditolak' : '') . ')', true, ''];
        }
        kp_checklist($hasil);
    }
}
echo '<form method="post"><p><button name="uji" value="1">Uji koneksi push service</button></p><p class="mu">Mengirim permintaan uji (tanpa isi) dari server ini ke Google, Mozilla, Apple, dan Microsoft. Hasil 4xx = terhubung.</p></form></div>';
echo '<p><a class="btn" href="index.php/admin">Halaman admin</a></p><p class="mu">Halaman ini tidak menampilkan kunci atau token.</p>';
kp_page_end();
