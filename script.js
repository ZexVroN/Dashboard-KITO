      const $ = (s) => document.querySelector(s);        
      const esc = (t) =>
        String(t ?? "").replace(
          /[&<>"]/g,
          (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
        );
      const f = (s) => {
        if (s == null) return "–";
        s = Math.round(s);
        return (
          String(Math.floor(s / 60)).padStart(2, "0") +
          ":" +
          String(s % 60).padStart(2, "0")
        );
      };
      const pc = (a, b) =>
        a == null || b == null || a + b === 0 ? null : a / (a + b);
      const P = (x) => (x == null ? "–" : Math.round(x * 100) + "%");
      const dl = (s) => {
        const [y, m, d] = s.split("-");
        return d + "/" + m;
      };
      const dlong = (s) =>
        new Date(s + "T00:00").toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      const mp = (s) =>
        s == null
          ? ["–", "n"]
          : s < 300
            ? ["Under 5 Menit", "ok"]
            : s < 600
              ? ["5 - 10 Menit", "mid"]
              : s < 900
                ? ["10 - 15 Menit", "warn"]
                : ["Over 15 Menit", "bad"];
      const club = (p) =>
        p == null
          ? ["–", "n"]
          : p < 0.7
            ? ["<70%", "bad"]
            : p <= 0.8
              ? ["70-80%", "warn"]
              : p <= 0.9
                ? [">80-90%", "mid"]
                : [">90-100%", "ok"];
      const chip = (t, c) => `<span class="chip ${c}">${esc(t)}</span>`;
      const ket = (k) =>
        chip(
          k === "Membaik"
            ? "▲ Membaik"
            : k === "Memburuk"
              ? "▼ Memburuk"
              : k || "Tetap",
          k === "Membaik" ? "ok" : k === "Memburuk" ? "bad" : "n",
        );
      let st = { a: "", b: 0, d: D.dates.length - 1 };
      try {
        const o = JSON.parse(localStorage.getItem("dbm") || "{}");
        if (o.b != null && D.B[o.b]) {
          st.b = o.b;
          st.a = D.B[o.b][2];
        }
      } catch (e) {}
      if (!st.a) st.a = D.B[0][2];
      const areas = [...new Set(D.B.map((b) => b[2]))].sort();

      function fill() {
        $("#sa").innerHTML = areas
          .map(
            (a) => `<option ${a === st.a ? "selected" : ""}>${esc(a)}</option>`,
          )
          .join("");
        const cs = D.B.map((b, i) => [b, i])
          .filter((x) => x[0][2] === st.a)
          .sort((x, y) => x[0][1].localeCompare(y[0][1]));
        if (!cs.some((x) => x[1] === st.b)) st.b = cs[0][1];
        $("#sc").innerHTML = cs
          .map(
            ([b, i]) =>
              `<option value="${i}" ${i === st.b ? "selected" : ""}>${esc(b[1])}</option>`,
          )
          .join("");
        $("#sd").innerHTML = D.dates
          .map(
            (d, i) =>
              `<option value="${i}" ${i === st.d ? "selected" : ""}>${dlong(d)}</option>`,
          )
          .join("");
      }
      function qcard(name, k) {
        const s = D.Q[st.b],
          cur = s[st.d]?.[k];
        let prev = null;
        for (let i = st.d - 1; i >= 0; i--)
          if (s[i]?.[k] != null) {
            prev = s[i][k];
            break;
          }
        const v = s
            .slice(0, st.d + 1)
            .map((x) => x?.[k])
            .filter((x) => x != null),
          mtd = v.length ? v.reduce((a, b) => a + b) / v.length : null;
        const dd = cur != null && prev != null ? Math.round(cur - prev) : null,
          [m, c] = mp(cur);
        const dh =
          dd == null
            ? ""
            : dd < 0
              ? `<span class="ok">▲ Membaik ${-dd} dtk</span>`
              : dd > 0
                ? `<span class="bad">▼ Memburuk ${dd} dtk</span>`
                : '<span class="mu">Tetap</span>';
        return `<div class="q"><div class="t">${name}</div><div class="v">${f(cur)}</div>${chip(m, c)}<div class="d">${dh}</div><div class="m">MtD ${f(mtd)}</div></div>`;
      }
      function chart() {
        const s = D.Q[st.b],
          W = 340,
          H = 190,
          L = 34,
          R = 10,
          T = 12,
          Bt = 26,
          col = ["var(--c1)", "var(--c2)", "var(--c3)"],
          nm = ["Teller", "CS", "Semua TRX"];
        const all = s.flat().filter((x) => x != null),
          mx = Math.max(60, ...all),
          top = Math.ceil(mx / 120) * 120 || 120;
        const X = (i) =>
            L +
            (D.dates.length < 2 ? 0 : (i * (W - L - R)) / (D.dates.length - 1)),
          Y = (v) => T + (H - T - Bt) * (1 - v / top);
        let g = "";
        for (let i = 0; i <= 3; i++) {
          const v = (top * i) / 3;
          g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--ln)"/><text x="${L - 4}" y="${Y(v) + 3}" font-size="9" text-anchor="end" fill="var(--mu)">${f(v)}</text>`;
        }
        D.dates.forEach(
          (d, i) =>
            (g += `<text x="${X(i)}" y="${H - 8}" font-size="9" text-anchor="middle" fill="${i === st.d ? "var(--tx)" : "var(--mu)"}" font-weight="${i === st.d ? 700 : 400}">${dl(d)}</text>`),
        );
        [0, 1, 2].forEach((k) => {
          const pts = s
            .map((x, i) => (x?.[k] == null ? null : [X(i), Y(x[k])]))
            .filter(Boolean);
          if (pts.length)
            g +=
              `<polyline fill="none" stroke="${col[k]}" stroke-width="2.4" stroke-linejoin="round" points="${pts.map((p) => p.join(",")).join(" ")}"/>` +
              pts
                .map(
                  (p) =>
                    `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${col[k]}"/>`,
                )
                .join("");
        });
        g += `<line x1="${X(st.d)}" x2="${X(st.d)}" y1="${T}" y2="${H - Bt}" stroke="var(--mu)" stroke-dasharray="3 3"/>`;
        return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren waktu antrian">${g}</svg><div class="lg">${nm.map((n, k) => `<span><i style="background:${col[k]}"></i>${n}</span>`).join("")}</div>`;
      }

        function chart1(k, nama, warna) {
        const s = D.Q[st.b],
          W = 340,
          H = 160,
          L = 34,
          R = 18,
          T = 22,
          Bt = 30;
        const vals = s.map((x) => x?.[k]).filter((x) => x != null);
        const top = Math.ceil(Math.max(60, ...vals) / 60) * 60;
        const X = (i) =>
            L + (D.dates.length < 2 ? 0 : (i * (W - L - R)) / (D.dates.length - 1)),
          Y = (v) => T + (H - T - Bt) * (1 - v / top);
        let g = "";
        for (let i = 0; i <= 2; i++) {
          const v = (top * i) / 2;
          g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--ln)"/><text x="${L - 4}" y="${Y(v) + 3}" font-size="9" text-anchor="end" fill="var(--mu)">${f(v)}</text>`;
        }
        D.dates.forEach((d, i) => {
          g += `<text x="${X(i)}" y="${H - 8}" font-size="9" text-anchor="middle" fill="${i === st.d ? "var(--tx)" : "var(--mu)"}" font-weight="${i === st.d ? 700 : 400}">${dl(d)}</text>`;
        });
        const pts = s
          .map((x, i) => (x?.[k] == null ? null : [X(i), Y(x[k]), x[k], i]))
          .filter(Boolean);
        if (pts.length) {
          g += `<polyline fill="none" stroke="${warna}" stroke-width="2.2" stroke-linejoin="round" points="${pts.map((p) => p[0] + "," + p[1]).join(" ")}"/>`;
          pts.forEach((p, j) => {
            // titik tetangga: kalau rata-rata tetangga lebih rendah di layar, angka ditaruh di atas
            const nb = [pts[j - 1], pts[j + 1]].filter(Boolean).map((q) => q[1]);
            const atas = nb.length ? nb.reduce((a, b) => a + b) / nb.length >= p[1] : true;
            const ly = atas ? p[1] - 7 : p[1] + 13;
            g +=
              `<circle cx="${p[0]}" cy="${p[1]}" r="${p[3] === st.d ? 4 : 2.8}" fill="${warna}"/>` +
              `<text x="${p[0]}" y="${ly}" font-size="8" font-weight="${p[3] === st.d ? 700 : 600}" text-anchor="middle" fill="var(--tx)" stroke="var(--cd)" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${f(p[2])}</text>`;
          });
        }
        return `<div class="u"><b>${nama}</b><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren ${nama}">${g}</svg></div>`;
      }


      function util(label, n, o) {
        const p = pc(n, o),
          [c, cc] = club(p);
        return `<div class="u"><div class="row" style="justify-content:space-between"><b>${label}</b>${chip(c, cc)}</div>
  <div class="bar"><b style="width:${(p || 0) * 100}%;background:var(--${cc === "n" ? "mu" : cc === "mid" ? "md" : cc === "warn" ? "wr" : cc === "bad" ? "bd" : "ok"})"></b></div>
  <div class="row sub" style="justify-content:space-between"><span>NBDS <b>${n ?? "–"}</b> · Old BDS <b>${o ?? "–"}</b></span><b>${P(p)}${p != null && p >= 0.98 ? " · ≥98%" : ""}</b></div></div>`;
      }
      function donut(a, b) {
        const t = a + b,
          p = t ? a / t : 0,
          r = 42,
          C = 2 * Math.PI * r;
        return `<svg viewBox="0 0 110 110" style="width:110px;flex:none"><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--ln)" stroke-width="14"/><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--c1)" stroke-width="14" stroke-dasharray="${p * C} ${C}" transform="rotate(-90 55 55)"/><text x="55" y="61" text-anchor="middle" font-size="19" font-weight="800" fill="var(--tx)">${P(p)}</text></svg>`;
      }
      function render() {
        const b = D.B[st.b],
          s = D.Q[st.b],
          m = D.M[st.b],
          ob = D.O.filter((x) => x[0] === st.b);
        const wa = b[5] ? "62" + b[5].replace(/\D/g, "").replace(/^0/, "") : "";
        let h = `<div class="cd hero"><h3>${esc(b[1])}</h3><div class="row sub"><span>${esc(b[2])}</span>${b[3] ? chip("Kelas " + b[3], "n") : ""}</div>
   ${b[4] || b[5] ? `<div class="row" style="margin-top:10px"><span class="sub">PIC: <b>${esc(b[4] || "–")}</b></span>${b[5] ? `<a class="btn" href="tel:${esc(b[5])}">Telepon</a><a class="btn w" href="https://wa.me/${wa}">WhatsApp</a>` : ""}</div>` : ""}</div>`;
        h += `<div class="cd"><h2>Waktu Antrian · ${dlong(D.dates[st.d])}</h2><div class="g3">${qcard("TELLER", 0)}${qcard("CS", 1)}${qcard("SEMUA TRX", 2)}</div></div>`;
        h += `<div class="cd"><h2>Tren Waktu Antrian</h2>${chart()}</div>`;
        h += `<div class="cd"><h2>Tren Per Kategori</h2>${chart1(0, "Teller", "var(--c1)")}${chart1(1, "Customer Service", "var(--c2)")}${chart1(2, "Semua TRX", "var(--c3)")}</div>`;

        h += `<div class="cd"><h2>Data Kelompok</h2>${[
          ["Teller", 6, 7, 8],
          ["Customer Service", 9, 10, 11],
        ]
          .map(
            ([n, i, j, k]) =>
              `<div class="kv"><span><b>${n}</b><div class="sub">${D.kl[0]}: ${b[i] ?? "–"} → ${D.kl[1]}: ${b[j] ?? "–"}</div></span>${ket(b[k])}</div>`,
          )
          .join("")}</div>`;
        if (m) {
          const [o2o, nb, csm, old, fpn, fpo, fnn, fno, nfn, nfo] = m,
            tot = o2o + nb,
            sh = tot + csm + old,
            abv = tot && o2o / tot > D.bw;
          h += `<div class="cd"><h2>Overall O2O · ${dlong(D.mdate)}</h2><div class="row">${donut(o2o, nb)}<div style="flex:1;min-width:150px">
     <div class="kv"><span>Livin O2O</span><b>${o2o}</b></div><div class="kv"><span>NBDS</span><b>${nb}</b></div><div class="kv"><span>Total</span><b>${tot}</b></div></div></div>
     <div class="note">Avg Bankwide ${P(D.bw)} · ${tot ? (abv ? '<b class="ok">⬆ Above Avg</b>' : '<b class="bad">⬇ Below Avg</b>') : ""}</div></div>`;
          h += `<div class="cd"><h2>Shifting Digital</h2><div class="row" style="justify-content:space-between"><div><div class="big">${sh ? P((o2o + csm) / sh) : "–"}</div><div class="sub">(O2O+CSM) / Total</div></div>
     <div class="sub" style="text-align:right">CSM <b>${csm}</b> · OBDS <b>${old}</b><br>Total Digital <b>${sh}</b></div></div></div>`;
          h += `<div class="cd"><h2>Utilisasi NBDS</h2>${util("Financial Perorangan", fpn, fpo)}${util("Financial Non Perorangan", fnn, fno)}${util("Non Financial", nfn, nfo)}</div>`;
        }
        
        // DETAIL DATA OLD BDS
        h += `<div class="cd"><h2>Detail Data Old BDS (${ob.length})</h2>${ob.length ? `<div class="tw"><table><tr><th>Transaksi</th><th>Nasabah</th><th>Kategori</th><th>User ID</th></tr>${ob.map((x) => `<tr><td>${esc(x[1])}</td><td>${esc(x[2])}</td><td>${chip(x[4] || "–", x[4] === "Finansial" ? "ok" : "n")}</td><td>${esc(x[3])}</td></tr>`).join("")}</table></div>` : '<div class="sub">Tidak ada transaksi Old BDS.</div>'}</div>`;
       
       

        // DETAIL WAKTU ANTRIAN
        h += `<div class="cd"><h2>Detail Waktu Antrian</h2><div class="tw"><table><tr><th>Tanggal</th><th>Teller</th><th>CS</th><th>Semua</th></tr>${D.dates
          .map((d, i) => [d, i])
          .reverse()
          .map(
            ([d, i]) =>
              `<tr data-d="${i}" class="${i === st.d ? "on" : ""}"><td>${dlong(d)}</td>${[
                0, 1, 2,
              ]
                .map((k) => {
                  const v = s[i]?.[k];
                  return `<td class="${mp(v)[1]}"><b>${f(v)}</b></td>`;
                })
                .join("")}</tr>`,
          )
          .join(
            "",
          )}</table></div><div class="note">Ketuk baris untuk ganti tanggal.</div></div>`;
        
          
       
       
          $("#app").innerHTML = h;
        try {
          localStorage.setItem("dbm", JSON.stringify({ b: st.b }));
        } catch (e) {}
      }
      $("#sa").addEventListener("change", (e) => {
        st.a = e.target.value;
        fill();
        render();
        scrollTo(0, 0);
      });
      $("#sc").addEventListener("change", (e) => {
        st.b = +e.target.value;
        render();
        scrollTo(0, 0);
      });
      $("#sd").addEventListener("change", (e) => {
        st.d = +e.target.value;
        render();
      });
      $("#app").addEventListener("click", (e) => {
        const r = e.target.closest("tr[data-d]");
        if (r) {
          st.d = +r.dataset.d;
          fill();
          render();
        }
      });

     const ft = $("#ft");
if (ft) {
  ft.innerHTML =
    "Antrian s.d. <b>" + dlong(D.dates[D.dates.length - 1]) +
    "</b> · Utilisasi per <b>" + dlong(D.mdate) +
    "</b><br>Dashboard Monitoring Inbranch · Region II";
}
      fill();
      render();
  