<?php
// Uji: vektor resmi RFC 8291 Lampiran A + JWT ES256 + kunci baru
require __DIR__ . '/../lib/webpush.php';
$ok = true;
$out = wp_encrypt(b64u_dec('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'),
  'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', 'BTBZMqHH6r4Tts7J_aSIgg',
  ['salt' => b64u_dec('DGv6ra1nlYgDCS1FRnbzlw'), 'asPriv' => b64u_dec('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),
   'asPub' => b64u_dec('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8')]);
$exp = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
echo 'RFC 8291 vektor uji: ', b64u_enc($out) === $exp ? 'COCOK' : 'TIDAK COCOK', "\n"; $ok = $ok && b64u_enc($out) === $exp;
$k = wp_generate_keys();
echo 'kunci baru: publik ', strlen(b64u_dec($k['publicKey'])), ' byte, privat ', strlen(b64u_dec($k['privateKey'])), " byte\n";
$jwt = wp_vapid_jwt('https://fcm.googleapis.com', 'mailto:a@b.c', $k['publicKey'], $k['privateKey']);
[$h, $c, $s] = explode('.', $jwt); $raw = b64u_dec($s);
// raw r||s -> DER untuk openssl_verify
$int = function ($x) { $x = ltrim($x, "\0"); if (ord($x[0]) & 0x80) $x = "\0" . $x; return "\x02" . chr(strlen($x)) . $x; };
$der = $int(substr($raw, 0, 32)) . $int(substr($raw, 32)); $der = "\x30" . chr(strlen($der)) . $der;
$v = openssl_verify("$h.$c", $der, wp_pem_public(b64u_dec($k['publicKey'])), OPENSSL_ALGO_SHA256);
echo 'JWT ES256 valid: ', $v === 1 ? 'ya' : 'TIDAK', ' ', json_encode(json_decode(b64u_dec($c))), "\n"; $ok = $ok && $v === 1;
exit($ok ? 0 : 1);
