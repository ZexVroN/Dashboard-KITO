/* KITO Admin — halaman backend: Push Notifikasi & Update Data. Vanilla JS, tanpa dependensi. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDT = (s) => (s ? new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');
  const fmtB = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const PLAT = { android: 'Android', ios: 'iOS / iPadOS', desktop: 'Desktop' };
  const PRESET = [['/', 'Beranda dashboard'], ['/?tab=ranking', 'Ranking'], ['/?tab=region', 'Region'], ['/?tab=area', 'Area'], ['/?tab=cabang', 'Cabang'], ['', 'URL lain…']];
  let me = null, timerJob = null;

  /* ---------- util ---------- */
  function toast(t, err) { const e = $('#toast'); e.textContent = t; e.className = 'toast show' + (err ? ' err' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => (e.className = 'toast'), 3600); }
  async function api(path, opt = {}) {
    const o = { credentials: 'same-origin', ...opt, headers: { 'X-Requested-With': 'kito', ...(opt.json ? { 'Content-Type': 'application/json' } : {}), ...(opt.headers || {}) } };
    if (opt.json) { o.body = JSON.stringify(opt.json); o.method = o.method || 'POST'; }
    const r = await fetch('/api' + path, o);
    if (r.status === 401 && !path.includes('/login')) { showLogin(); throw new Error('Sesi berakhir, silakan login lagi'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    return j;
  }
  const confirmBox = (t) => window.confirm(t);

  /* ---------- login ---------- */
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#pw').value = ''; }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#loginMsg').textContent = '';
    try { await api('/admin/login', { json: { password: $('#pw').value } }); await boot(); }
    catch (x) { $('#loginMsg').textContent = x.message; }
  });
  $('#logout').addEventListener('click', async () => { await api('/admin/logout', { method: 'POST' }).catch(() => {}); location.reload(); });

  /* ---------- navigasi ---------- */
  const TABS = [['ringkasan', '📊 Ringkasan'], ['kirim', '📣 Kirim Notifikasi'], ['riwayat', '🕘 Riwayat'], ['perangkat', '📱 Perangkat'], ['data', '🗂 Update Data'], ['setelan', '⚙️ Pengaturan']];
  function go(tab) {
    clearTimeout(timerJob);
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    history.replaceState(null, '', '#' + tab);
    ({ ringkasan: vRingkasan, kirim: vKirim, riwayat: vRiwayat, perangkat: vPerangkat, data: vData, setelan: vSetelan }[tab] || vRingkasan)();
  }
  async function boot() {
    try { me = await api('/admin/me'); } catch { return showLogin(); }
    $('#login').hidden = true; $('#app').hidden = false;
    $('#envBadge').textContent = me.https ? 'HTTPS' : 'HTTP';
    $('#tabs').innerHTML = TABS.map(([k, t]) => `<button role="tab" data-t="${k}">${t}</button>`).join('');
    $('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) go(b.dataset.t); };
    go(TABS.some(([k]) => '#' + k === location.hash) ? location.hash.slice(1) : 'ringkasan');
  }

  /* ---------- Ringkasan ---------- */
  async function vRingkasan() {
    const v = $('#view'); v.innerHTML = '<div class="card">Memuat…</div>';
    const s = await api('/admin/stats');
    const bars = (obj, order) => {
      const keys = (order || Object.keys(obj)).filter((k) => obj[k] != null); const max = Math.max(1, ...keys.map((k) => obj[k]));
      return keys.length ? `<div class="bars">${keys.map((k) => `<div class="bar"><span>${esc(PLAT[k] || k)}</span><i><u style="width:${(obj[k] / max) * 100}%"></u></i><b>${obj[k]}</b></div>`).join('')}</div>` : '<p class="muted">Belum ada data.</p>';
    };
    const lk = s.kirimTerakhir;
    v.innerHTML = `<div class="grid g4">
      <div class="card kpi"><small>Perangkat berlangganan</small><b>${s.total}</b></div>
      <div class="card kpi"><small>Baru 7 hari terakhir</small><b>${s.baru7}</b></div>
      <div class="card kpi"><small>Terpasang di layar utama (PWA)</small><b>${s.standalone}</b></div>
      <div class="card kpi"><small>Terjadwal</small><b>${s.terjadwal}</b></div></div>
      <div class="grid g3">
        <div class="card"><h2>Per platform</h2>${bars(s.platform, ['android', 'ios', 'desktop'])}</div>
        <div class="card"><h2>Per fokus area</h2>${bars(s.area)}</div>
        <div class="card"><h2>Per browser</h2>${bars(s.browser)}</div></div>
      <div class="card"><h2>Pengiriman terakhir</h2>${lk ? `<dl class="kv"><dt>Judul</dt><dd>${esc(lk.title)}</dd><dt>Waktu</dt><dd>${fmtDT(lk.at)}</dd><dt>Hasil</dt><dd>${lk.sent}/${lk.total} terkirim · ${lk.failed} gagal · ${lk.removed} dihapus (tidak aktif)</dd></dl>` : '<p class="muted">Belum pernah mengirim notifikasi.</p>'}
        <div class="row tight" style="margin-top:12px"><button class="btn primary" data-go="kirim">Buat notifikasi</button><button class="btn" data-go="data">Update data</button></div></div>
      ${s.total === 0 ? `<div class="card"><h2>Mulai dari mana?</h2><p class="muted">Belum ada perangkat. Buka <a href="/" target="_blank" rel="noopener">dashboard</a> di HP/komputer, ketuk ikon 🔔 di header, lalu <b>Aktifkan notifikasi</b>. Di iPhone: Bagikan → Tambah ke Layar Utama dulu. Perangkat baru akan muncul di sini.</p></div>` : ''}`;
    $$('[data-go]', v).forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  }

  /* ---------- Kirim Notifikasi ---------- */
  let draft = null;
  async function vKirim() {
    const v = $('#view');
    const tpl = (await api('/admin/templates')).items;
    const d = draft || { title: '', body: '', preset: '/', url: '/', platforms: ['android', 'ios', 'desktop'], areas: [], ttl: 86400, urgency: 'normal', inApp: false, inAppDays: 3, tag: '', image: '', collapse: false, requireInteraction: false };
    v.innerHTML = `<div class="grid g2">
    <div class="card"><h2>Notifikasi baru</h2>
      <label>Template</label><div class="row"><select id="tpl"><option value="">— pilih template —</option>${tpl.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select><button class="btn small" id="tplDel" style="flex:none">Hapus template</button></div>
      <label for="f-title">Judul <span class="cnt" id="c-title">0/80</span></label><input id="f-title" maxlength="80" value="${esc(d.title)}" placeholder="mis. Data dashboard diperbarui">
      <label for="f-body">Isi pesan <span class="cnt" id="c-body">0/300</span></label><textarea id="f-body" maxlength="300" placeholder="Tulis pesan singkat dan jelas…">${esc(d.body)}</textarea>
      <label for="f-preset">Saat diketuk, buka</label><div class="row"><select id="f-preset">${PRESET.map(([u, t]) => `<option value="${esc(u)}" ${u === d.preset ? 'selected' : ''}>${t}</option>`).join('')}</select><input id="f-url" placeholder="https://… atau /?tab=area" value="${esc(d.url)}" ${d.preset === '' ? '' : 'hidden'}></div>
      <label>Kirim ke platform</label><div class="chips" id="f-plat">${Object.entries(PLAT).map(([k, t]) => `<label class="chip ${d.platforms.includes(k) ? 'on' : ''}"><input type="checkbox" value="${k}" ${d.platforms.includes(k) ? 'checked' : ''}>${t}</label>`).join('')}</div>
      <label>Fokus area <span class="muted" style="font-weight:500">(kosong = semua perangkat)</span></label><div class="chips" id="f-area">${me.areas.map((a) => `<label class="chip ${d.areas.includes(a) ? 'on' : ''}"><input type="checkbox" value="${esc(a)}" ${d.areas.includes(a) ? 'checked' : ''}>${esc(a)}</label>`).join('')}</div>
      <p class="muted" id="aud" style="margin-top:8px">Memeriksa penerima…</p>
      <details><summary>Opsi lanjutan</summary>
        <div class="row"><div><label for="f-ttl">Masa berlaku jika perangkat offline</label><select id="f-ttl">${[[3600, '1 jam'], [21600, '6 jam'], [86400, '1 hari'], [259200, '3 hari'], [604800, '7 hari']].map(([s, t]) => `<option value="${s}" ${s === d.ttl ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label for="f-urg">Prioritas</label><select id="f-urg">${[['normal', 'Normal'], ['high', 'Tinggi (segera)'], ['low', 'Rendah (hemat baterai)']].map(([k, t]) => `<option value="${k}" ${k === d.urgency ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
        <label for="f-tag">Tag (notifikasi dengan tag sama saling menggantikan)</label><input id="f-tag" maxlength="40" value="${esc(d.tag)}" placeholder="mis. data-baru">
        <label for="f-img">Gambar besar (URL, opsional — Android/Desktop)</label><input id="f-img" value="${esc(d.image)}" placeholder="/assets/images/…png atau https://…">
        <label class="chip" style="margin-top:10px"><input type="checkbox" id="f-ri" ${d.requireInteraction ? 'checked' : ''}> Tetap tampil sampai ditutup (Desktop)</label>
        <label class="chip" style="margin-top:6px"><input type="checkbox" id="f-col" ${d.collapse ? 'checked' : ''}> Ganti notifikasi lama yang belum dibaca (butuh tag)</label>
        <label class="chip" style="margin-top:6px"><input type="checkbox" id="f-inapp" ${d.inApp ? 'checked' : ''}> Tampilkan juga sebagai banner di dalam dashboard (Website)</label>
        <div id="f-inapp-d" ${d.inApp ? '' : 'hidden'}><label for="f-days">Banner tampil selama</label><select id="f-days">${[1, 2, 3, 7, 14, 30].map((n) => `<option value="${n}" ${n === d.inAppDays ? 'selected' : ''}>${n} hari</option>`).join('')}</select></div>
      </details>
      <label>Waktu kirim</label><div class="row"><select id="f-when"><option value="now">Kirim sekarang</option><option value="later">Jadwalkan…</option></select><input id="f-dt" type="datetime-local" hidden></div>
      <div class="row tight" style="margin-top:16px"><button class="btn primary" id="btnSend">Kirim notifikasi</button><button class="btn" id="btnTest">Kirim uji ke perangkat ini</button><button class="btn" id="btnTpl">Simpan sebagai template</button></div>
      <div class="msg" id="sendMsg" role="status"></div></div>
    <div class="card"><h2>Pratinjau</h2><div class="prev-tabs">${['android', 'ios', 'desktop'].map((k, i) => `<button class="btn small ${i ? '' : 'primary'}" data-pv="${k}">${PLAT[k]}</button>`).join('')}</div>
      <div class="stage"><div class="nt android" id="pv"><img src="/assets/images/ios/icon-192.png" alt=""><div class="b"><div class="h"><span>KITO · sekarang</span><span>⌄</span></div><div class="t" id="pv-t"></div><div class="m" id="pv-m"></div></div></div></div>
      <p class="muted" style="margin-top:12px">Tampilan asli mengikuti sistem operasi dan bisa sedikit berbeda. Judul dipotong otomatis bila terlalu panjang.</p>
      <div class="card" style="margin:14px 0 0;background:var(--bg)"><h3>Notifikasi di perangkat admin ini</h3><p class="muted" id="adminDev">Memeriksa…</p><button class="btn small" id="btnAdminSub">Aktifkan di perangkat ini</button></div></div></div>`;
    bindCompose(tpl);
  }

  function bindCompose(tpl) {
    const g = (id) => $('#' + id);
    const read = () => ({
      title: g('f-title').value, body: g('f-body').value, preset: g('f-preset').value, url: g('f-preset').value === '' ? g('f-url').value : g('f-preset').value,
      platforms: $$('#f-plat input:checked').map((i) => i.value), areas: $$('#f-area input:checked').map((i) => i.value),
      ttl: Number(g('f-ttl').value), urgency: g('f-urg').value, tag: g('f-tag').value.trim(), image: g('f-img').value.trim(), requireInteraction: g('f-ri').checked, collapse: g('f-col').checked,
      inApp: g('f-inapp').checked, inAppDays: Number(g('f-days').value),
    });
    const upd = () => {
      draft = read();
      g('c-title').textContent = draft.title.length + '/80'; g('c-body').textContent = draft.body.length + '/300';
      g('pv-t').textContent = draft.title || 'Judul notifikasi'; g('pv-m').textContent = draft.body || 'Isi pesan akan tampil di sini.';
      $$('.chip', g('f-plat')).forEach((c) => c.classList.toggle('on', $('input', c).checked)); $$('.chip', g('f-area')).forEach((c) => c.classList.toggle('on', $('input', c).checked));
      g('f-url').hidden = g('f-preset').value !== '';
      g('f-inapp-d').hidden = !g('f-inapp').checked;
      clearTimeout(upd.t); upd.t = setTimeout(audience, 250);
    };
    async function audience() {
      const q = new URLSearchParams({ platforms: draft.platforms.join(','), areas: draft.areas.join(',') });
      try { const r = await api('/admin/audience?' + q); g('aud').innerHTML = `Perkiraan penerima: <b>${r.count}</b> perangkat${draft.platforms.length === 0 ? ' (semua platform)' : ''}${draft.areas.length ? ' · hanya yang berfokus pada area terpilih' : ''}`; } catch (e) { g('aud').textContent = ''; }
    }
    $$('input,select,textarea', $('#view')).forEach((el) => { if (!['tpl', 'f-when', 'f-dt'].includes(el.id)) el.addEventListener('input', upd); el.addEventListener('change', upd); });
    g('f-when').addEventListener('change', () => { g('f-dt').hidden = g('f-when').value !== 'later'; g('btnSend').textContent = g('f-when').value === 'later' ? 'Jadwalkan' : 'Kirim notifikasi'; if (!g('f-dt').hidden && !g('f-dt').value) { const t = new Date(Date.now() + 3600e3); t.setMinutes(0, 0, 0); g('f-dt').value = new Date(t - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); } });
    $$('[data-pv]').forEach((b) => b.addEventListener('click', () => { $$('[data-pv]').forEach((x) => x.classList.toggle('primary', x === b)); g('pv').className = 'nt ' + b.dataset.pv; }));
    g('tpl').addEventListener('change', () => { const t = tpl.find((x) => x.id === g('tpl').value); if (!t) return; draft = { ...read(), title: t.title, body: t.body, tag: t.tag || '', preset: PRESET.some(([u]) => u === t.url) ? t.url : '', url: t.url }; vKirim(); });
    g('tplDel').addEventListener('click', async () => { const id = g('tpl').value; if (!id) return toast('Pilih template dulu', true); if (!confirmBox('Hapus template ini?')) return; await api('/admin/templates/' + id, { method: 'DELETE' }); toast('Template dihapus'); draft = read(); vKirim(); });
    g('btnTpl').addEventListener('click', async () => { const name = prompt('Nama template:'); if (!name) return; const d = read(); try { await api('/admin/templates', { json: { name, title: d.title, body: d.body, url: d.url, tag: d.tag } }); toast('Template disimpan ✓'); draft = d; vKirim(); } catch (e) { toast(e.message, true); } });
    g('btnSend').addEventListener('click', async () => {
      const d = read(), later = g('f-when').value === 'later';
      if (!d.title.trim() || !d.body.trim()) return setMsg('Judul dan isi wajib diisi', true);
      if (later && !g('f-dt').value) return setMsg('Pilih waktu jadwal', true);
      const n = (g('aud').textContent.match(/\d+/) || ['?'])[0];
      if (!confirmBox(later ? `Jadwalkan notifikasi "${d.title}" pada ${fmtDT(g('f-dt').value)}?` : `Kirim "${d.title}" ke ±${n} perangkat sekarang?`)) return;
      g('btnSend').disabled = true; setMsg('Mengirim…');
      try {
        const r = await api('/admin/push/send', { json: { ...d, when: later ? new Date(g('f-dt').value).toISOString() : undefined } });
        if (r.scheduled) setMsg('Terjadwal ✓ — ' + fmtDT(r.when), false); else setMsg(`Selesai: ${r.sent}/${r.total} terkirim, ${r.failed} gagal, ${r.removed} perangkat tidak aktif dihapus.`, false);
        toast(r.scheduled ? 'Notifikasi dijadwalkan' : 'Notifikasi terkirim');
      } catch (e) { setMsg(e.message, true); }
      g('btnSend').disabled = false;
    });
    function setMsg(t, err) { const m = g('sendMsg'); m.textContent = t; m.className = 'msg ' + (err ? 'err' : t.includes('✓') || t.startsWith('Selesai') ? 'ok' : ''); }
    g('btnTest').addEventListener('click', async () => {
      const s = await adminSub(); if (!s) return setMsg('Aktifkan notifikasi di perangkat ini dulu (tombol di kanan).', true);
      const d = read(); try { await api('/admin/push/test', { json: { endpoint: s.endpoint, title: d.title, body: d.body, url: d.url } }); setMsg('Uji terkirim ✓ — cek notifikasi di perangkat ini', false); } catch (e) { setMsg(e.message, true); }
    });
    g('btnAdminSub').addEventListener('click', async () => { try { await adminSubscribe(); } catch (e) { toast(e.message, true); } adminState(); });
    adminState(); upd();
  }

  /* perangkat admin sendiri (untuk uji kirim) */
  async function adminReg() { if (!('serviceWorker' in navigator && 'PushManager' in window)) return null; await navigator.serviceWorker.register('/sw.js'); return navigator.serviceWorker.ready; }
  async function adminSub() { const r = await adminReg().catch(() => null); return r ? r.pushManager.getSubscription() : null; }
  async function adminSubscribe() {
    const r = await adminReg(); if (!r) throw new Error('Browser ini tidak mendukung push (di iPhone: pasang dashboard ke Layar Utama dulu)');
    if ((await Notification.requestPermission()) !== 'granted') throw new Error('Izin notifikasi tidak diberikan');
    const k = (await (await fetch('/api/push/key')).json()).publicKey;
    const u8 = Uint8Array.from(atob((k + '='.repeat((4 - (k.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const s = (await r.pushManager.getSubscription()) || (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8 }));
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: s.toJSON(), area: '', touch: navigator.maxTouchPoints > 1, platform: ios ? 'ios' : undefined, standalone: matchMedia('(display-mode: standalone)').matches }) });
    toast('Perangkat admin terdaftar ✓');
  }
  async function adminState() {
    const el = $('#adminDev'); if (!el) return;
    if (!('PushManager' in window)) { el.textContent = 'Browser ini tidak mendukung push.'; return; }
    const s = await adminSub(); el.textContent = s ? 'Perangkat ini sudah terdaftar — tombol "Kirim uji" aktif.' : (Notification.permission === 'denied' ? 'Notifikasi diblokir di browser ini.' : 'Belum terdaftar.');
    const b = $('#btnAdminSub'); if (b) b.hidden = !!s;
  }

  /* ---------- Riwayat ---------- */
  async function vRiwayat() {
    const v = $('#view'); v.innerHTML = '<div class="card">Memuat…</div>';
    const { items, scheduled } = await api('/admin/history');
    v.innerHTML = `<div class="card"><h2>Terjadwal (${scheduled.length})</h2>${scheduled.length ? `<div class="tw"><table><tr><th>Kapan</th><th>Judul</th><th>Target</th><th></th></tr>${scheduled.map((s) => `<tr><td>${fmtDT(s.when)}</td><td class="wrap">${esc(s.msg.title)}</td><td>${esc(tgt(s.msg.targets))}</td><td><button class="btn small danger" data-cancel="${esc(s.id)}">Batalkan</button></td></tr>`).join('')}</table></div>` : '<p class="muted">Tidak ada notifikasi terjadwal.</p>'}</div>
    <div class="card"><h2>Riwayat pengiriman</h2>${items.length ? `<div class="tw"><table><tr><th>Waktu</th><th>Judul</th><th>Target</th><th>Terkirim</th><th>Gagal</th><th>Dihapus</th><th>Platform</th><th>Oleh</th></tr>${items.map((h) => `<tr><td>${fmtDT(h.at)}</td><td class="wrap"><b>${esc(h.title)}</b><br><span class="muted">${esc(h.body)}</span></td><td>${esc(tgt(h.targets))}</td><td><span class="pill ${h.sent === h.total && h.total ? 'ok' : 'wr'}">${h.sent}/${h.total}</span></td><td>${h.failed}</td><td>${h.removed}</td><td class="muted">${Object.entries(h.byPlatform || {}).map(([k, x]) => `${PLAT[k] || k}: ${x.sent}`).join(' · ') || '–'}</td><td>${esc(h.by)}</td></tr>`).join('')}</table></div>` : '<p class="muted">Belum ada riwayat.</p>'}</div>`;
    $$('[data-cancel]', v).forEach((b) => b.addEventListener('click', async () => { if (!confirmBox('Batalkan jadwal ini?')) return; await api('/admin/scheduled/' + b.dataset.cancel, { method: 'DELETE' }); toast('Jadwal dibatalkan'); vRiwayat(); }));
  }
  const tgt = (t = {}) => `${(t.platforms || []).length ? t.platforms.map((p) => PLAT[p] || p).join(', ') : 'Semua platform'}${(t.areas || []).length ? ' · ' + t.areas.join(', ') : ''}`;

  /* ---------- Perangkat ---------- */
  async function vPerangkat() {
    const v = $('#view'); v.innerHTML = '<div class="card">Memuat…</div>';
    const { items } = await api('/admin/subscribers');
    v.innerHTML = `<div class="card"><div class="row"><h2 style="flex:2;margin:0">Perangkat berlangganan (${items.length})</h2><select id="fp" style="flex:1"><option value="">Semua platform</option>${Object.entries(PLAT).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></div>
      <div class="tw" style="margin-top:12px"><table id="tb"><tr><th>Platform</th><th>Browser / OS</th><th>Area</th><th>Mode</th><th>Terdaftar</th><th>Terakhir aktif</th><th>Layanan</th><th></th></tr>${items.map((s) => `<tr data-p="${s.platform}"><td>${PLAT[s.platform] || s.platform}</td><td>${esc(s.browser)} · ${esc(s.os)}</td><td>${esc(s.area || 'Semua')}</td><td>${s.standalone ? '<span class="pill ok">PWA</span>' : '<span class="pill">Browser</span>'}</td><td>${fmtDT(s.createdAt)}</td><td>${fmtDT(s.lastSeen)}</td><td class="muted">${esc(s.host)}</td><td><button class="btn small danger" data-del="${esc(s.id)}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="8" class="muted">Belum ada perangkat.</td></tr>'}</table></div></div>`;
    $('#fp').addEventListener('change', (e) => $$('#tb tr[data-p]').forEach((r) => (r.hidden = e.target.value && r.dataset.p !== e.target.value)));
    $$('[data-del]', v).forEach((b) => b.addEventListener('click', async () => { if (!confirmBox('Hapus perangkat ini dari daftar?')) return; await api('/admin/subscribers/' + b.dataset.del, { method: 'DELETE' }); toast('Dihapus'); vPerangkat(); }));
  }

  /* ---------- Update Data ---------- */
  const pickedNow = new Set();
  async function vData() {
    const v = $('#view'); v.innerHTML = '<div class="card">Memuat…</div>';
    const st = await api('/admin/update/status');
    v.innerHTML = `<div class="card"><h2>Update data dari file Excel (export)</h2>
      <p class="muted">Unggah export terbaru, lalu proses. Hasil dibuat dulu di area staging (belum tayang) → periksa ringkasan → <b>Publikasikan</b>. Versi sebelumnya otomatis dibackup dan bisa dipulihkan. Pembaruan harian memakai <b>3 file bersama</b> (Antrian, O2O, NBDS); file yang pernah diunggah dipakai ulang bila tidak diganti.</p>
      <div class="grid g2" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${st.slots.map((s) => `<div class="slot ${s.file ? 'has' : ''}" data-slot="${s.slot}"><h3>${esc(s.label)} ${s.file ? '<span class="pill ok">siap</span>' : '<span class="pill wr">belum ada</span>'}</h3>
        <p class="muted" style="margin:0 0 8px">Contoh nama: ${esc(s.hint)}</p>
        ${s.file ? `<dl class="kv"><dt>File</dt><dd>${esc(s.file.name)}</dd><dt>Ukuran</dt><dd>${fmtB(s.file.size)}</dd><dt>Diunggah</dt><dd>${fmtDT(s.file.uploadedAt)}</dd></dl>` : ''}
        <input type="file" accept=".xlsx" data-up="${s.slot}" style="margin-top:10px"><div class="progress" hidden><i></i></div><div class="msg"></div>
        <label class="chip ${pickedNow.has(s.slot) ? 'on' : ''}" style="margin-top:8px"><input type="checkbox" data-pick="${s.slot}" ${pickedNow.has(s.slot) ? 'checked' : ''} ${s.file ? '' : 'disabled'}> Proses jenis data ini</label></div>`).join('')}</div>
      <div class="row tight" style="margin-top:14px"><button class="btn primary" id="btnRun" ${st.running ? 'disabled' : ''}>Proses &amp; buat pratinjau</button><a class="btn" href="/api/admin/update/export?job=live" id="btnExpLive">⬇ Export data yang tayang (.zip)</a></div>
      <div class="msg" id="runMsg">${st.running ? 'Ada proses yang sedang berjalan…' : ''}</div></div>
      <div id="jobBox"></div>
      <div class="grid g2" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
        <div class="card"><h2>Riwayat update</h2>${st.history.length ? `<div class="tw"><table><tr><th>Waktu</th><th>Berkas</th><th>Jenis</th></tr>${st.history.map((h) => `<tr><td>${fmtDT(h.at)}</td><td class="wrap">${esc((h.files || []).join(', '))}</td><td>${h.rollbackOf ? '<span class="pill wr">pemulihan</span>' : '<span class="pill ok">publikasi</span>'}</td></tr>`).join('')}</table></div>` : '<p class="muted">Belum ada.</p>'}</div>
        <div class="card"><h2>Backup (untuk pemulihan)</h2>${st.backups.length ? `<div class="tw"><table><tr><th>Backup</th><th>Berkas</th><th></th></tr>${st.backups.map((b) => `<tr><td>${esc(b.id)}</td><td class="wrap muted">${esc(b.files.join(', '))}</td><td><button class="btn small" data-rb="${esc(b.id)}">Pulihkan</button></td></tr>`).join('')}</table></div>` : '<p class="muted">Belum ada backup.</p>'}</div></div>`;
    $$('[data-up]', v).forEach((i) => i.addEventListener('change', () => upload(i)));
    $$('[data-pick]', v).forEach((c) => c.addEventListener('change', () => { c.checked ? pickedNow.add(c.dataset.pick) : pickedNow.delete(c.dataset.pick); c.closest('.chip').classList.toggle('on', c.checked); }));
    $('#btnRun').addEventListener('click', run);
    $$('[data-rb]', v).forEach((b) => b.addEventListener('click', async () => { if (!confirmBox(`Pulihkan data dari backup ${b.dataset.rb}? Data yang tayang sekarang akan diganti.`)) return; try { await api('/admin/update/rollback', { json: { id: b.dataset.rb } }); toast('Data dipulihkan ✓'); vData(); } catch (e) { toast(e.message, true); } }));
    if (st.running) pollJob(st.running);
  }
  function upload(input) {
    const f = input.files[0]; if (!f) return;
    const slot = input.dataset.up, box = input.closest('.slot'), bar = $('.progress', box), fill = $('i', bar), msg = $('.msg', box);
    if (!/\.xlsx$/i.test(f.name)) { msg.textContent = 'Pilih file .xlsx'; msg.className = 'msg err'; input.value = ''; return; }
    bar.hidden = false; fill.style.width = '0'; msg.className = 'msg'; msg.textContent = 'Mengunggah…';
    const x = new XMLHttpRequest();
    x.open('PUT', `/api/admin/update/upload/${slot}?filename=${encodeURIComponent(f.name)}`);
    x.setRequestHeader('X-Requested-With', 'kito');
    x.upload.onprogress = (e) => { if (e.lengthComputable) { fill.style.width = (e.loaded / e.total) * 100 + '%'; msg.textContent = `Mengunggah… ${Math.round((e.loaded / e.total) * 100)}% (${fmtB(e.loaded)} / ${fmtB(e.total)})`; } };
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} if (x.status === 200) { pickedNow.add(slot); toast('File diunggah ✓'); vData(); } else { msg.textContent = j.error || 'Gagal (HTTP ' + x.status + ')'; msg.className = 'msg err'; bar.hidden = true; } };
    x.onerror = () => { msg.textContent = 'Koneksi terputus saat mengunggah'; msg.className = 'msg err'; };
    x.send(f);
  }
  async function run() {
    const slots = $$('[data-pick]:checked').map((c) => c.dataset.pick);
    if (!slots.length) return ($('#runMsg').textContent = 'Centang minimal satu jenis data yang akan diproses.', ($('#runMsg').className = 'msg err'));
    $('#runMsg').className = 'msg'; $('#runMsg').textContent = 'Memulai…'; $('#btnRun').disabled = true;
    try { const { job } = await api('/admin/update/run', { json: { slots } }); $('#runMsg').textContent = 'Proses berjalan di server (bisa beberapa menit untuk file besar). Halaman ini boleh ditutup; buka lagi untuk melihat hasil.'; pollJob(job); }
    catch (e) { $('#runMsg').textContent = e.message; $('#runMsg').className = 'msg err'; $('#btnRun').disabled = false; }
  }
  async function pollJob(id, from = 0, acc = []) {
    const box = $('#jobBox'); if (!box) return;
    let j;
    try { j = await api(`/admin/update/jobs/${id}?from=${from}`); } catch (e) { box.innerHTML = `<div class="card"><div class="msg err">${esc(e.message)}</div></div>`; return; }
    acc = acc.concat(j.log);
    const badge = { running: '<span class="pill wr">berjalan…</span>', ready: '<span class="pill ok">siap dipublikasikan</span>', error: '<span class="pill bd">gagal</span>' }[j.status];
    box.innerHTML = `<div class="card"><h2>Hasil proses ${badge}</h2>
      <div class="steps">${j.steps.map((s) => `<span class="pill ${s.ok ? 'ok' : 'bd'}">${s.ok ? '✓' : '✗'} ${esc(s.judul)} · ${s.detik}d</span>`).join('')}</div>
      <div class="log" id="logBox">${esc(acc.slice(-400).join('\n'))}</div>
      ${j.status === 'ready' ? jobReady(j) : ''}</div>`;
    const lb = $('#logBox'); if (lb) lb.scrollTop = lb.scrollHeight;
    if (j.status === 'running') { timerJob = setTimeout(() => pollJob(id, j.logTotal, acc), 1500); return; }
    const rb = $('#btnRun'); if (rb) rb.disabled = false;
    if (j.status === 'ready' && !j.published) bindReady(j);
  }
  function jobReady(j) {
    const ch = j.changes, n = ch.filter((c) => c.status !== 'sama').length;
    const A = j.summary.antrian || {}, L = (j.live && j.live.antrian) || {};
    return `<h3 style="margin-top:14px">Ringkasan perubahan</h3>
      <dl class="kv"><dt>Tanggal laporan O2O/NBDS</dt><dd>${esc(L.tanggalLaporanO2O || '–')} → <b>${esc(A.tanggalLaporanO2O || '–')}</b></dd><dt>Tanggal antrian terakhir</dt><dd>${esc(L.tanggalTerakhir || '–')} → <b>${esc(A.tanggalTerakhir || '–')}</b></dd><dt>Jumlah cabang</dt><dd>${esc(L.jumlahCabang || '–')} → <b>${esc(A.jumlahCabang || '–')}</b></dd>${j.summary['infografis-data.js'] ? `<dt>Inbranch MTD</dt><dd>${esc(((j.live || {})['infografis-data.js'] || {}).tanggal || '–')} → <b>${esc(j.summary['infografis-data.js'].tanggal || '–')}</b> · ${esc(j.summary['infografis-data.js'].baris)} cabang</dd>` : ''}</dl>
      <div class="tw" style="margin-top:10px"><table><tr><th>Berkas</th><th>Status</th><th>Ukuran lama → baru</th></tr>${ch.map((c) => `<tr><td>${esc(c.file)}</td><td><span class="pill ${c.status === 'sama' ? '' : 'ok'}">${c.status}</span></td><td>${fmtB(c.oldSize)} → ${fmtB(c.size)}</td></tr>`).join('')}</table></div>
      ${n ? `<div class="card" style="margin:14px 0 0;background:var(--bg)"><label class="chip"><input type="checkbox" id="pubNotify"> Kirim notifikasi push ke pengguna setelah publikasi</label>
        <div id="pubN" hidden><label>Judul</label><input id="pubT" maxlength="80" value="Data dashboard diperbarui"><label>Isi</label><input id="pubB" maxlength="300" value="Data KITO terbaru${A.tanggalLaporanO2O ? ' per ' + esc(A.tanggalLaporanO2O) : ''} sudah tersedia."></div>
        <div class="row tight" style="margin-top:12px"><button class="btn primary" id="btnPub">Publikasikan ${n} berkas</button><a class="btn" href="/api/admin/update/export?job=${esc(j.id)}">⬇ Unduh hasil (.zip)</a></div></div>`
      : '<p class="muted" style="margin-top:12px">Tidak ada perbedaan dengan data yang tayang — tidak ada yang perlu dipublikasikan.</p>'}`;
  }
  function bindReady(j) {
    const nb = $('#pubNotify'); if (nb) nb.addEventListener('change', () => ($('#pubN').hidden = !nb.checked));
    const pb = $('#btnPub'); if (!pb) return;
    pb.addEventListener('click', async () => {
      if (!confirmBox('Publikasikan data ini ke dashboard? Versi sebelumnya akan dibackup otomatis.')) return;
      pb.disabled = true;
      try {
        const r = await api(`/admin/update/jobs/${j.id}/publish`, { json: { notify: $('#pubNotify').checked, title: $('#pubT').value, body: $('#pubB').value } });
        toast('Dipublikasikan ✓' + (r.notification ? ` · push ${r.notification.sent}/${r.notification.total}` : '')); vData();
      } catch (e) { toast(e.message, true); pb.disabled = false; }
    });
  }

  /* ---------- Pengaturan ---------- */
  async function vSetelan() {
    me = await api('/admin/me');
    const v = $('#view');
    v.innerHTML = `<div class="grid g2" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
    <div class="card"><h2>Status layanan</h2><dl class="kv"><dt>Koneksi</dt><dd>${me.https ? '<span class="pill ok">HTTPS</span>' : '<span class="pill wr">HTTP — push di perangkat sungguhan butuh HTTPS</span>'}</dd><dt>VAPID subject</dt><dd>${esc(me.subject)}</dd><dt>Python</dt><dd>${esc(me.python)}</dd><dt>VAPID public key</dt><dd style="font-family:monospace;font-size:11px">${esc(me.publicKey)}</dd></dl>
      <p class="muted" style="margin-top:12px"><b>iOS/iPadOS:</b> pengguna harus menambahkan dashboard ke Layar Utama (iOS ≥ 16.4) sebelum bisa menerima push. <b>Android &amp; Desktop:</b> cukup izinkan notifikasi di browser.</p></div>
    <div class="card"><h2>Ganti password admin</h2>${me.envPassword ? '<p class="muted">Password diatur lewat variabel lingkungan <code>KITO_ADMIN_PASSWORD</code>; ubah di sana lalu restart server.</p>' : `<label>Password saat ini</label><input id="pw0" type="password" autocomplete="current-password"><label>Password baru (min. 10 karakter)</label><input id="pw1" type="password" autocomplete="new-password"><button class="btn primary" id="btnPw" style="margin-top:12px">Simpan password</button><div class="msg" id="pwMsg"></div>`}</div></div>`;
    const b = $('#btnPw'); if (b) b.addEventListener('click', async () => { try { await api('/admin/password', { json: { current: $('#pw0').value, next: $('#pw1').value } }); $('#pwMsg').textContent = 'Password diganti ✓'; $('#pwMsg').className = 'msg ok'; } catch (e) { $('#pwMsg').textContent = e.message; $('#pwMsg').className = 'msg err'; } });
  }

  boot();
})();
