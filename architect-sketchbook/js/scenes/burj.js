/* SHEET 2 — Burj Khalifa (graphite only: no colour) */
(window.SCENES = window.SCENES || []).push({
  name: 'Burj Khalifa', seed: 23, ink: '#2c2c31',
  build(P, n, t) {
    const S = Sketch, TAU = S.TAU, lerp = S.lerp;
    P.frame('BURJ KHALIFA', 'DUBAI  -  828 m TALL', n, t, { scale: 'SCALE  1 : 860', note: 'graphite, 2B + 4H, no colour' });
    const GY = 880, CX = 392, K = 800 / 828;             // ground line, tower axis, px per metre
    const Y = m => GY - m * K;
    const spanX = (poly, y) => {
      let lo = 1e9, hi = -1e9;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) { const x = a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]); lo = Math.min(lo, x); hi = Math.max(hi, x); }
      }
      return [lo, hi];
    };
    const spanY = (poly, x) => {
      let lo = 1e9, hi = -1e9;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x)) { const y = a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]); lo = Math.min(lo, y); hi = Math.max(hi, y); }
      }
      return [lo, hi];
    };

    /* ---- ground, reflecting pool & the height ruler ---- */
    P.line(60, GY, 1130, GY, { w: 2, rough: 0.6 });
    for (let x = 64; x < 1126; x += 7 + P.r(0, 5)) P.line(x, GY + 2, x - 9, GY + 11 + P.r(0, 6), { w: 0.6, a: 0.5, passes: 1, over: 0, rough: 0.4 });
    P.line(150, GY, 150, Y(828), { w: 0.9, a: 0.8, rough: 0.4 });
    for (let m = 0; m <= 840; m += 20) {
      const major = m % 100 === 0, mid = m % 50 === 0 && !major;
      P.line(150, Y(m), major ? 178 : mid ? 168 : 160, Y(m), { w: major ? 1.2 : 0.7, a: 0.85, passes: 1, over: 0, rough: 0.2 });
      if (major) P.text(String(m), 143, Y(m) + 5, { size: 15, align: 'right', font: S.HAND });
    }
    P.text('HEIGHT  (m)', 70, Y(828) - 14, { size: 15, font: S.HAND });
    [[124, 452], [148, 555]].forEach(([lv, m]) => { P.dashed(CX, Y(m), 182, Y(m), [6, 4], { w: 0.5, a: 0.5 }); });

    /* ---- tower silhouette: the 3 wings step back in a spiral ---- */
    const tiers = [[0, 35], [48, 32.5], [115, 29.5], [180, 26.5], [240, 23.5], [300, 21], [360, 18.5], [420, 16], [480, 13.5], [530, 11.5], [575, 9.5]];
    const top = 585;
    const side = (sgn, off) => {
      const pts = [];
      tiers.forEach(([h, hw], k) => {
        const h0 = k === 0 ? 0 : h + off, h1 = k + 1 < tiers.length ? tiers[k + 1][0] + off : top;
        pts.push([CX + sgn * hw, Y(h0)]); pts.push([CX + sgn * (hw - 0.8), Y(Math.min(h1, top))]);
      });
      return pts;
    };
    const Lp = side(-1, 0), Rp = side(1, 24);
    const spire = [[585, 5.2, 3.8], [640, 3.6, 2.8], [700, 2.6, 1.9], [760, 1.7, 1.1], [806, 0.9, 0.55], [828, 0.4, 0.4]];
    const spL = [], spR = [];
    spire.forEach(([h, a, b], k) => { const hn = k + 1 < spire.length ? spire[k + 1][0] : 828; spL.push([CX - a, Y(h)], [CX - b, Y(hn)]); spR.push([CX + a, Y(h)], [CX + b, Y(hn)]); });
    const outline = Lp.concat(spL, spR.slice().reverse(), Rp.slice().reverse());
    // trim duplicate spire ring points into a clean polygon
    P.erase(outline);
    P.pl(Lp, { w: 1.5, over: 0.2 }); P.pl(Rp, { w: 1.5, over: 0.2 });
    P.line(Lp[0][0], Lp[0][1], Rp[0][0], Rp[0][1], { w: 1.4 });
    P.pl(spL, { w: 1.2, over: 0.2 }); P.pl(spR, { w: 1.2, over: 0.2 });
    // horizontal steps and collars
    for (let k = 0; k + 1 < tiers.length; k++) {
      const yl = Y(tiers[k + 1][0]), yr = Y(tiers[k + 1][0] + 24);
      const hwK = tiers[k][1] - 0.8, hwN = tiers[k + 1][1];
      P.line(CX - hwK, yl, CX - hwN, yl, { w: 1.3, passes: 1, over: 0.3 });
      P.line(CX + hwK, yr, CX + hwN, yr, { w: 1.3, passes: 1, over: 0.3 });
    }
    spire.forEach(([h, a]) => P.line(CX - a - 1.4, Y(h), CX + a + 1.4, Y(h), { w: 1.2, passes: 1, over: 0.2, rough: 0.2 }));
    P.circle(CX, Y(828) - 2, 1.6, { w: 1, passes: 1 });
    P.line(CX, Y(828) - 3, CX, Y(828) - 12, { w: 0.9, passes: 1, over: 0 });

    // vertical facade rhythm: spine, wing edges & mullions
    P.line(CX, Y(585), CX, GY - 2, { w: 0.8, a: 0.7, rough: 0.4 });
    P.line(CX, Y(828), CX, Y(585), { w: 0.6, a: 0.6, rough: 0.3 });
    [-1, 1].forEach(sg => { for (let k = 0; k < tiers.length; k++) { const h0 = tiers[k][0] + (sg > 0 && k ? 24 : 0), h1 = k + 1 < tiers.length ? tiers[k + 1][0] + (sg > 0 ? 24 : 0) : top; const x = CX + sg * tiers[k][1] * 0.5; P.line(x, Y(Math.min(h1, top)) + 1, x, Y(h0) - 1, { w: 0.6, a: 0.6, passes: 1, over: 0, rough: 0.3 }); } });
    for (let i = -12; i <= 12; i++) {
      const x = CX + i * 2.9;
      const [y0, y1] = spanY(Lp.concat(Rp.slice().reverse()), x);
      if (y1 - y0 < 8) continue;
      P.line(x, y0 + 2, x, y1 - 2, { w: 0.4, a: 0.3, passes: 1, over: 0, rough: 0.25, step: 18 });
    }
    // curtain-wall floor lines, every 4 px
    const body = Lp.concat(Rp.slice().reverse());
    for (let y = Y(585) + 2; y < GY - 2; y += 4.2) {
      const [x0, x1] = spanX(body, y); if (x1 - x0 < 6) continue;
      P.line(x0 + 1.2, y, x1 - 1.2, y, { w: 0.4, a: 0.32, passes: 1, over: 0, rough: 0.2, step: 30 });
    }
    // mechanical floors (denser cross-hatched bands)
    [[320, 336], [415, 431], [500, 512], [560, 572]].forEach(([a, b]) => {
      const ya = Y(b), yb = Y(a); const [xa, xb] = spanX(body, (ya + yb) / 2);
      P.hatch([[xa, ya], [xb, ya], [xb, yb], [xa, yb]], { ang: 35, gap: 2.4, a: 0.5, w: 0.45, cross: 90, inset: 0.6 });
    });
    // shading, heavier on the wing facing away from the sun (right)
    P.hatch(outline, { ang: 82, gap: 2.5, a: 0.55, w: 0.55, fade: (x, y) => Math.max(0, Math.min(1, (x - CX + 6) / 26)), piece: 10 });
    P.hatch(outline, { ang: 70, gap: 5, a: 0.4, w: 0.45, fade: (x, y) => x < CX - 8 ? 0.35 : 0, piece: 12 });
    // podium / lobby & entrance
    P.rect(CX - 46, GY - 20, 92, 20, { w: 1.4, rough: 0.4 });
    P.rect(CX - 60, GY - 9, 120, 9, { w: 1.2, rough: 0.4 });
    for (let x = CX - 44; x < CX + 46; x += 6) P.line(x, GY - 19, x, GY - 2, { w: 0.5, a: 0.6, passes: 1, over: 0, rough: 0.2 });
    P.hatch([[CX + 10, GY - 20], [CX + 46, GY - 20], [CX + 46, GY], [CX + 10, GY]], { ang: 50, gap: 2.4, a: 0.6 });
    // observation balconies
    [[452, 24], [555, 21]].forEach(([m, w]) => { const y = Y(m); P.rect(CX - w, y - 2, w * 2, 4, { w: 1.1, rough: 0.2 }); P.line(CX - w - 3, y - 6, CX - w, y - 2, { w: 0.9, passes: 1, over: 0 }); P.line(CX + w + 3, y - 6, CX + w, y - 2, { w: 0.9, passes: 1, over: 0 }); });

    /* ---- pool & fountain jets ---- */
    P.curve([[CX + 70, GY + 1], [CX + 120, GY + 7], [CX + 200, GY + 9], [CX + 280, GY + 5], [CX + 300, GY + 1]], { w: 0.9, rough: 0.6 });
    for (let i = 0; i < 6; i++) P.curve([[CX + 82 + i * 6, GY + 7 + i * 0.4], [CX + 150 + i * 14, GY + 10 + i % 2], [CX + 230 + i * 8, GY + 8]], { w: 0.4, a: 0.35, rough: 1 });
    [[CX + 110, 34], [CX + 170, 52], [CX + 230, 40], [CX + 270, 24]].forEach(([x, h]) => {
      P.curve([[x, GY - 1], [x - 12, GY - h], [x - 26, GY - 3]], { w: 0.6, a: 0.6, rough: 0.5 });
      P.curve([[x, GY - 1], [x + 12, GY - h + 4], [x + 26, GY - 3]], { w: 0.6, a: 0.6, rough: 0.5 });
      P.line(x, GY - 1, x, GY - h * 0.95, { w: 0.5, a: 0.5, passes: 1, over: 0, rough: 0.5 });
    });
    P.text('LAKE  BURJ  KHALIFA', CX + 90, GY + 34, { size: 16 });

    /* ---- clouds (graphite outlines) & birds ---- */
    const cloud = (cx, cy, w, h) => {
      const bumps = [];
      const k = 6;
      for (let i = 0; i < k; i++) { const t = i / (k - 1); bumps.push([cx - w / 2 + t * w, cy - Math.sin(t * Math.PI) * h * (0.7 + 0.5 * P.r())]); }
      const pts = [[cx - w / 2 - 6, cy + 2]].concat(bumps, [[cx + w / 2 + 6, cy + 2]]);
      P.curve(pts, { w: 0.8, a: 0.7, rough: 0.9 });
      P.curve([[cx - w / 2 + 4, cy + 4], [cx, cy + 7], [cx + w / 2 - 4, cy + 4]], { w: 0.6, a: 0.5, rough: 0.7 });
      P.hatch([[cx - w / 2, cy + 3], [cx + w / 2, cy + 3], [cx + w / 2 - 12, cy + 9], [cx - w / 2 + 12, cy + 9]], { ang: -30, gap: 2.4, a: 0.32, w: 0.45 });
    };
    cloud(300, 120, 130, 22); cloud(270, 440, 90, 16); cloud(300, 700, 100, 16); cloud(640, 78, 120, 16);
    [[560, 66], [586, 80], [532, 84], [232, 250], [258, 264]].forEach(([x, y]) => { P.curve([[x - 8, y - 2], [x - 3, y - 6], [x, y]], { w: 0.8, rough: 0.2 }); P.curve([[x, y], [x + 3, y - 6], [x + 8, y - 2]], { w: 0.8, rough: 0.2 }); });

    /* ---- annotations on the tower ---- */
    const N = (lines, x, y, tx, ty, o = {}) => { P.note(lines[0], x, y, tx, ty, o); lines.slice(1).forEach((s, i) => P.text(s, x, y + 20 * (i + 1), { size: o.size ?? 19, a: 0.8 })); };
    N(['SPIRE  -  TELESCOPING STEEL', 'FROM LEVEL 156  (828 m)'], 470, Y(800), CX + 2, Y(800));
    N(['LEVEL 148  -  555 m', 'HIGHEST OBSERVATION DECK'], 470, Y(555) - 22, CX + 22, Y(555));
    N(['LEVEL 124  -  452 m', '"AT THE TOP" DECK'], 470, Y(452) - 8, CX + 26, Y(452));
    N(['MECHANICAL FLOORS', 'SEE CROSS-HATCHED BANDS'], 470, Y(330), CX + 18, Y(328));
    N(['HEXAGONAL CORE +', 'BUTTRESSED WINGS', 'HIGH-STRENGTH CONCRETE'], 470, Y(230), CX + 22, Y(230));
    N(['HOTEL & RESIDENCES', 'LEVELS 1 - 108'], 470, Y(105), CX + 28, Y(105));
    N(['SPIRAL SETBACKS', 'CONFUSE THE WIND'], 196, Y(505), CX - 14, Y(508));
    N(['LOBBY'], 198, GY - 34, CX - 44, GY - 10);
    P.dim(CX - 35, GY, CX + 35, GY, 'base c. 70 m', 42);

    /* ---- comparison towers (same scale) ---- */
    const cx0 = { sh: 770, es: 898, ei: 1035, st: 1130 };
    P.text('SAME SCALE  -  FOR COMPARISON', 690, Y(632) - 66, { size: 17 });
    // Shanghai Tower 632 m: twisting, tapering
    { const c = cx0.sh, H = 632 * K, half = h => 38 - 33 * Math.pow(h / 632, 1.3);
      const L = [], R = [];
      for (let m = 0; m <= 632; m += 40) { const tw = Math.sin(m / 632 * 2.2) * 3; L.push([c - half(m) + tw, Y(m)]); R.push([c + half(m) + tw, Y(m)]); }
      const poly = L.concat(R.slice().reverse());
      P.curve(L, { w: 1.4, rough: 0.5 }); P.curve(R, { w: 1.4, rough: 0.5 });
      P.line(L[0][0], Y(0), R[0][0], Y(0), { w: 1.2 }); P.line(L[L.length - 1][0], Y(632), R[R.length - 1][0], Y(632), { w: 1.1 });
      for (let m = 30; m < 632; m += 24) { const [a, b] = spanX(poly, Y(m)); if (b - a > 3) P.curve([[a + 1, Y(m)], [(a + b) / 2, Y(m) + 2.5], [b - 1, Y(m) - 1]], { w: 0.4, a: 0.4, rough: 0.3, passes: 1 }); }
      P.curve([[c - 14, Y(0)], [c - 8, Y(300)], [c + 1, Y(630)]], { w: 0.5, a: 0.55, rough: 0.4 });
      P.hatch(poly, { ang: 84, gap: 2.8, a: 0.5, fade: (x) => Math.max(0, (x - c + 3) / 26), piece: 12 });
      P.text('SHANGHAI TOWER', c, Y(632) - 24, { size: 14, align: 'center', font: S.HAND }); P.text('632 m', c, Y(632) - 8, { size: 14, align: 'center' });
    }
    // Empire State 443 m
    { const c = cx0.es, st = [[0, 62], [58, 62], [58, 46], [86, 46], [86, 32], [ 200, 32], [200, 26], [290, 26], [290, 21], [381 - 0, 21]];
      const L = [], R = [];
      st.forEach(([m, w], i) => { const y = Y(m); if (i) { L.push([c - w0(i), y]); R.push([c + w0(i), y]); } L.push([c - w, y]); R.push([c + w, y]); });
      function w0(i) { return st[i - 1][1]; }
      const crown = [[c - 21, Y(381)], [c - 12, Y(381)], [c - 12, Y(400)], [c - 6, Y(400)], [c - 6, Y(420)], [c - 2.2, Y(420)], [c - 1.5, Y(443)], [c + 1.5, Y(443)], [c + 2.2, Y(420)], [c + 6, Y(420)], [c + 6, Y(400)], [c + 12, Y(400)], [c + 12, Y(381)], [c + 21, Y(381)]];
      const poly = L.concat(crown.slice().reverse().length ? [] : [], R.slice().reverse());
      const full = L.concat([[c - 21, Y(381)]], crown, R.slice().reverse());
      P.pl([[c - 62, GY]].concat(L.slice(0)), { w: 1.4, over: 0.2 }); P.pl([[c + 62, GY]].concat(R), { w: 1.4, over: 0.2 });
      P.line(c - 62, GY, c + 62, GY, { w: 1.2 });
      P.pl(crown, { w: 1.2, over: 0.2 });
      for (let m = 6; m < 380; m += 5) { const y = Y(m); const w = m < 58 ? 62 : m < 86 ? 46 : m < 200 ? 32 : m < 290 ? 26 : 21; P.line(c - w + 1.5, y, c + w - 1.5, y, { w: 0.35, a: 0.3, passes: 1, over: 0, rough: 0.2, step: 30 }); }
      for (let x = -60; x <= 60; x += 4.5) { const w = x; const top = Math.abs(w) < 21 ? 381 : Math.abs(w) < 26 ? 290 : Math.abs(w) < 32 ? 200 : Math.abs(w) < 46 ? 86 : 58; P.line(c + w, Y(top) + 1, c + w, GY - 1, { w: 0.35, a: 0.28, passes: 1, over: 0, rough: 0.2, step: 20 }); }
      P.hatch(full, { ang: 80, gap: 2.6, a: 0.5, fade: x => Math.max(0, (x - c + 3) / 34), piece: 10 });
      P.text('EMPIRE STATE', c, Y(443) - 22, { size: 14, align: 'center', font: S.HAND }); P.text('443 m', c, Y(443) - 6, { size: 14, align: 'center' });
    }
    // Eiffel Tower 330 m: lattice
    { const c = cx0.ei, prof = [[0, 60], [30, 47], [57, 38], [90, 29], [115, 24], [170, 16], [230, 10], [276, 7], [305, 4], [330, 1.2]];
      const L = prof.map(([m, w]) => [c - w, Y(m)]), R = prof.map(([m, w]) => [c + w, Y(m)]);
      P.curve(L, { w: 1.4, rough: 0.5 }); P.curve(R, { w: 1.4, rough: 0.5 });
      const L2 = prof.map(([m, w]) => [c - w * 0.62, Y(m)]), R2 = prof.map(([m, w]) => [c + w * 0.62, Y(m)]);
      P.curve(L2.slice(0, 6), { w: 0.9, a: 0.8, rough: 0.4 }); P.curve(R2.slice(0, 6), { w: 0.9, a: 0.8, rough: 0.4 });
      [[57, 3.4], [115, 3], [276, 3]].forEach(([m, th]) => { const w = prof.find(p => p[0] === m)[1]; P.rect(c - w - 4, Y(m), (w + 4) * 2, th * 1.2, { w: 1, rough: 0.3 }); });
      P.arc(c, Y(0), 40, 44, Math.PI, TAU, { w: 1.1 }); P.arc(c, Y(0), 34, 36, Math.PI, TAU, { w: 0.6, a: 0.7 });
      const bands = [[57, 115], [115, 170], [170, 230], [230, 276]];
      prof.length;
      const wAt = m => { for (let i = 0; i + 1 < prof.length; i++) if (m >= prof[i][0] && m <= prof[i + 1][0]) return lerp(prof[i][1], prof[i + 1][1], (m - prof[i][0]) / (prof[i + 1][0] - prof[i][0])); return 1; };
      for (let m = 8; m < 300; m += 12) { const w0 = wAt(m), w1 = wAt(m + 12), s = Math.floor(m / 12) % 2 ? 1 : -1; P.line(c - w0 * s, Y(m), c + w1 * s, Y(m + 12), { w: 0.4, a: 0.45, passes: 1, over: 0, rough: 0.3 }); P.line(c + w0 * s, Y(m), c - w1 * s, Y(m + 12), { w: 0.4, a: 0.45, passes: 1, over: 0, rough: 0.3 }); }
      for (let m = 60; m < 300; m += 12) P.line(c - wAt(m), Y(m), c + wAt(m), Y(m), { w: 0.35, a: 0.35, passes: 1, over: 0, rough: 0.3 });
      P.line(c, Y(330), c, Y(345), { w: 0.9, passes: 1, over: 0 });
      P.text('EIFFEL TOWER', c, Y(330) - 26, { size: 14, align: 'center', font: S.HAND }); P.text('330 m', c, Y(330) - 10, { size: 14, align: 'center' });
    }
    // Statue of Liberty 93 m
    { const c = cx0.st;
      P.rect(c - 15, Y(0) - 6, 30, 6, { w: 1.1, rough: 0.3 }); P.rect(c - 11, Y(0) - 44, 22, 38, { w: 1.2, rough: 0.3 }); P.line(c - 13, Y(0) - 44, c + 13, Y(0) - 44, { w: 1.2, rough: 0.2 });
      P.hatch([[c + 2, Y(0) - 44], [c + 11, Y(0) - 44], [c + 11, Y(0) - 6], [c + 2, Y(0) - 6]], { ang: 60, gap: 2.2, a: 0.55 });
      const body = [[c - 8, Y(0) - 44], [c - 6, Y(0) - 66], [c - 4, Y(0) - 78], [c + 4, Y(0) - 78], [c + 5, Y(0) - 66], [c + 8, Y(0) - 44]];
      P.poly(body, { w: 1.1, rough: 0.3 }); P.circle(c, Y(0) - 82, 3.6, { w: 1, passes: 1 });
      for (let a = -3; a <= 3; a++) P.line(c + Math.sin(a * 0.42) * 4, Y(0) - 82 - Math.cos(a * 0.42) * 3.6, c + Math.sin(a * 0.42) * 9, Y(0) - 82 - Math.cos(a * 0.42) * 8.5, { w: 0.6, passes: 1, over: 0, rough: 0.1 });
      P.line(c + 4, Y(0) - 74, c + 10, Y(0) - 90, { w: 1, passes: 1, over: 0 }); P.pl([[c + 8, Y(0) - 90], [c + 10, Y(0) - 97], [c + 12, Y(0) - 90]], { w: 0.9, closed: true });
      P.rect(c - 9, Y(0) - 62, 5, 8, { w: 0.7, rough: 0.2 }); P.hatch(body, { ang: 70, gap: 2, a: 0.5, fade: x => (x > c ? 0.9 : 0.2), piece: 6 });
      P.text('STATUE OF LIBERTY 93 m', c + 12, Y(0) - 108, { size: 13, align: 'center', font: S.HAND });
    }
    // little people at the base for scale
    [[CX - 78, 1], [CX - 90, 1], [CX + 66, 0.9]].forEach(([x, s]) => { P.circle(x, GY - 9 * s, 1.2, { w: 0.7, passes: 1 }); P.line(x, GY - 8 * s, x, GY - 3 * s, { w: 0.8, passes: 1, over: 0 }); P.line(x, GY - 3 * s, x - 1, GY, { w: 0.7, passes: 1, over: 0 }); P.line(x, GY - 3 * s, x + 1, GY, { w: 0.7, passes: 1, over: 0 }); });

    /* ---- typical floor plans: the Y-shaped footprint ---- */
    const yplan = (cx, cy, r, label, sub) => {
      const dirs = [-90, 30, 150].map(d => d * Math.PI / 180);
      const to = (d, u, v) => [cx + Math.cos(d) * u - Math.sin(d) * v, cy + Math.sin(d) * u + Math.cos(d) * v];
      const wingPts = d => { const pts = []; [[0.2, 0.3], [0.55, 0.24], [0.88, 0.15]].forEach(([u, v]) => pts.push(to(d, u * r, v * r))); pts.push(to(d, r, 0.06 * r)); pts.push(to(d, r, -0.06 * r)); [[0.88, -0.15], [0.55, -0.24], [0.2, -0.3]].forEach(([u, v]) => pts.push(to(d, u * r, v * r))); return pts; };
      const wings = dirs.map(wingPts);
      dirs.forEach((d, i) => {
        const w = wings[i];
        P.pl(w, { w: 1.4, over: 0.3 });
        P.line(...to(d, 0.2 * r, 0), ...to(d, 0.96 * r, 0), { w: 0.5, a: 0.5, passes: 1, over: 0, rough: 0.3 });
        for (let u = 0.3; u < 0.95; u += 0.09) { const hw = lerp(0.29, 0.1, (u - 0.2) / 0.8); P.line(...to(d, u * r, hw * r), ...to(d, u * r, -hw * r), { w: 0.4, a: 0.42, passes: 1, over: 0, rough: 0.2 }); }
        P.circle(...to(d, 0.99 * r, 0), 0.05 * r, { w: 0.6, passes: 1 });
        [0.3, 0.55, 0.8].forEach(u => { [1, -1].forEach(sg => P.dot(...to(d, u * r, sg * lerp(0.27, 0.13, (u - 0.2) / 0.8) * r), 1.1, { a: 0.8 })); });
      });
      const hex = []; for (let i = 0; i < 6; i++) hex.push([cx + Math.cos(i * 1.047 + 0.52) * 0.3 * r, cy + Math.sin(i * 1.047 + 0.52) * 0.3 * r]);
      P.erase(hex); P.poly(hex, { w: 1.5 });
      const hex2 = hex.map(([x, y]) => [lerp(cx, x, 0.62), lerp(cy, y, 0.62)]); P.poly(hex2, { w: 0.9 });
      P.hatch(hex2, { ang: 45, gap: 2.4, a: 0.55, cross: 90 });
      hex.forEach((p, i) => P.line(p[0], p[1], hex2[i][0], hex2[i][1], { w: 0.5, a: 0.6, passes: 1, over: 0 }));
      wings.forEach((w, i) => P.hatch(w, { ang: 40 + i * 20, gap: 4.5, a: 0.25, w: 0.4, fade: () => 0.7, piece: 14 }));
      P.text(label, cx, cy + r + 22, { size: 16, align: 'center', font: S.HAND }); P.text(sub, cx, cy + r + 40, { size: 15, align: 'center' });
    };
    P.text('THE  "Y"  PLAN', 1200, 90, { size: 20, font: S.HAND });
    P.line(1200, 96, 1358, 96, { w: 0.9, rough: 0.4, passes: 1 });
    yplan(1350, 240, 104, 'TYPICAL FLOOR  -  LEVEL 20', 'THREE WINGS + HEX CORE');
    yplan(1300, 505, 72, 'LEVEL  100', 'ONE WING STEPS BACK');
    yplan(1470, 490, 44, 'LEVEL 150', '');
    yplan(1400, 700, 24, '', '');
    P.text('L 155', 1400, 738, { size: 14, align: 'center', font: S.HAND });
    // north point
    P.circle(1500, 120, 22, { w: 1, passes: 1 }); P.line(1500, 148, 1500, 92, { w: 1.1, passes: 1, over: 0 }); P.pl([[1493, 104], [1500, 88], [1507, 104]], { w: 1, over: 0 }); P.text('N', 1500, 84, { size: 16, align: 'center', font: S.HAND });
    // wind note
    P.text('THE STEPS "CONFUSE" THE WIND -', 1180, 800, { size: 16 }); P.text('VORTICES CANNOT ORGANISE UP THE HEIGHT', 1180, 822, { size: 16 });
    P.curve([[1440, 770], [1400, 752], [1360, 784], [1330, 768]], { w: 0.7, a: 0.6, rough: 1.2 });
  }
});
