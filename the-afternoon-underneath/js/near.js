// near.js -- the skin of the water, and what grows at our feet: ripples, petals, the grass of the bank,
// flowers that open when the light goes, fireflies.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd, M = A.MED, P = A.P, vn = A.vn, ss = A.sstep, mix = A.mix, clamp = A.clamp, hx = A.hex, c = Wd.c;
  const YH = Wd.YH;
  const q4 = [0, 0, 0, 0];

  // fill a shape the way a hand does: parallel strokes, not quite reaching the edges, not quite parallel
  S.fillPoly = function (C, R, poly, o) {
    const ang = o.ang || 0, ca = Math.cos(-ang), sa = Math.sin(-ang), gap = o.gap || 1.6;
    const rp = poly.map(p => [p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca]);
    let y0 = 1e9, y1 = -1e9; for (const p of rp) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const cb = Math.cos(ang), sb = Math.sin(ang);
    for (let y = y0 + gap * 0.4; y < y1; y += gap * R.r(0.8, 1.2)) {
      const xs = [];
      for (let i = 0; i < rp.length; i++) { const a = rp[i], b = rp[(i + 1) % rp.length]; if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])); }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = xs[i] + R.r(-0.3, 0.5), xb = xs[i + 1] + R.r(-0.5, 0.3); if (xb - xa < 0.4) continue;
        const pts = [xa * cb - y * sb, xa * sb + y * cb, xb * cb - (y + R.g() * 0.15) * sb, xb * sb + (y + R.g() * 0.15) * cb];
        C.stroke(pts, { w: o.w || gap * 1.5, c: o.c, m: o.m || M.pastel, p: o.p === undefined ? 0.8 : o.p, ti: 0.1, to: 0.15, nodust: true, cj: o.cj === undefined ? 0.02 : o.cj });
      }
    }
  };

  // ------------------------------------------------------------------ the skin of the water
  // the finger, dragged sideways through the wet-looking places: reflections are soft
  S.soften = function (C, R) {
    C.clip(0, YH + 1, 1600, 900);
    for (let i = 0; i < 260; i++) {
      const y = YH + 12 + Math.pow(R(), 1.3) * 450, x = R.r(40, 1560), L = R.r(14, 46) * (1 + (y - YH) / 300);
      C.smudge([x - L, y, x + L, y + R.g() * 0.6], R.r(2, 4.2) * (1 + (y - YH) / 500), R.r(0.2, 0.42), { carry: 0.35 });
    }
    C.clip();
  };
  S.ripples = function (C, R) {
    C.clip(0, YH + 1, 1600, 900);
    // long ripple lines, close together far away, wide apart at our feet
    for (let i = 0; i < 620; i++) {
      const v = 3 + Math.pow(R(), 1.9) * 462, y = YH + v, x = R.r(-20, 1620), L = R.r(8, 30) * (1 + v / 70), m = Wd.mem(C, clamp(x, 0, 1599), y);
      let col, med = M.wax, p = R.r(0.25, 0.5);
      if (m > 0.5) {
        Wd.then(clamp(x, 0, 1599), y, q4);
        if (R.chance(0.6)) col = [Math.min(1, q4[0] + 0.22), Math.min(1, q4[1] + 0.2), Math.min(1, q4[2] + 0.14)];
        else { col = [q4[0] * 0.72, q4[1] * 0.78, q4[2] * 0.92]; med = M.pencil; p = R.r(0.3, 0.5); }
      } else {
        Wd.now(clamp(x, 0, 1599), y, q4);
        if (R.chance(0.55)) col = [Math.min(1, q4[0] * 1.25 + 0.14), Math.min(1, q4[1] * 1.15 + 0.08), Math.min(1, q4[2] * 1.1 + 0.1)];
        else { col = [q4[0] * 0.6, q4[1] * 0.6, q4[2] * 0.75]; med = M.pencil; }
      }
      const yb = y + R.g() * 0.4;
      C.stroke(P.spline([[x - L, y], [x - L * 0.3, y + R.r(-0.7, 0.7)], [x + L * 0.4, yb + R.r(-0.7, 0.7)], [x + L, yb]], 4), { w: R.r(0.7, 1.2) * (1 + v / 600), c: col, m: med, p, ti: 0.45, to: 0.5 });
    }
    // tonight creeping in over the afternoon: thin bars of the real sky's colour lying on the remembered one
    for (let i = 0; i < 300; i++) {
      const v = 16 + Math.pow(R(), 1.2) * 450, y = YH + v, x = R.r(0, 1600), m = Wd.mem(C, x, y);
      if (m < 0.3) continue; const edge = Math.max(Math.abs(x - 800) / 800, Math.abs(y - 716) / 264);
      if (R() > 0.07 + 0.93 * ss(0.55, 0.98, edge)) continue;
      Wd.now(x, y, q4); const L = R.r(10, 34) * (1 + v / 110);
      C.stroke(P.line(R, x - L, y, x + L, y + R.g() * 0.5, 0.5, 0.01, 5), { w: R.r(1.0, 2.6) * (1 + v / 500), c: [q4[0], q4[1], q4[2]], m: M.pastel, p: R.r(0.4, 0.7), ti: 0.4, to: 0.5, nodust: true });
    }
    // and the afternoon leaking out into tonight's water
    for (let i = 0; i < 160; i++) {
      const v = 16 + Math.pow(R(), 1.2) * 450, y = YH + v, x = R.r(0, 1600), m = Wd.mem(C, x, y);
      if (m > 0.5) continue; const d = Math.pow(Math.pow(Math.abs(x - 800) / 800, 3.2) + Math.pow(Math.abs(y - 716) / 264, 3.2), 0.3125); if (d > 1.22) continue;
      Wd.then(x, y, q4); const L = R.r(8, 26) * (1 + v / 130);
      C.stroke(P.line(R, x - L, y, x + L, y + R.g() * 0.5, 0.5, 0.01, 5), { w: R.r(0.9, 2.0) * (1 + v / 500), c: [q4[0], q4[1], q4[2]], m: M.pastel, p: R.r(0.35, 0.6), ti: 0.4, to: 0.5, nodust: true });
    }
    // glints: the little crosses of light
    for (let i = 0; i < 46; i++) {
      const x = R.r(120, 1480), y = R.r(470, 890); if (Wd.mem(C, x, y) < 0.9) continue;
      Wd.then(x, y, q4); if (q4[0] + q4[1] + q4[2] > 2.5) continue;
      const big = R.chance(0.2), r = big ? R.r(1.2, 1.8) : R.r(0.6, 1.0);
      C.dab(x, y, r, c.white, M.glow, 0.95);
      if (big) { const L = R.r(5, 11); C.stroke([x - L, y, x + L, y], { w: 0.8, c: c.white, m: M.glow, p: 0.7, ti: 0.5, to: 0.5 }); C.stroke([x, y - L * 0.8, x, y + L * 0.8], { w: 0.8, c: c.white, m: M.glow, p: 0.7, ti: 0.5, to: 0.5 }); }
      else C.stroke([x - R.r(2, 5), y, x + R.r(2, 5), y], { w: 0.8, c: c.white, m: M.glow, p: 0.6, ti: 0.5, to: 0.5 });
    }
    C.clip();
  };

  // small things lying on the water: petals, a leaf or two
  S.floaters = function (C, R) {
    for (let i = 0; i < 90; i++) {
      const v = 30 + Math.pow(R(), 1.5) * 430, y = YH + v, x = R.r(20, 1580), sc = 0.35 + v / 300, m = Wd.mem(C, x, y);
      const pet = R.chance(0.72), col = pet ? R.pick([hx('#ffd9e2'), hx('#fff0f0'), hx('#f9b8cc'), hx('#fff6c8')]) : R.pick([hx('#1f5a50'), hx('#2a7a5a'), hx('#173f4a')]);
      const w = (pet ? R.r(2.2, 3.6) : R.r(3, 5.5)) * sc, a = R.g() * 0.25;
      C.stroke([x - w, y - Math.sin(a) * w * 0.3, x + w, y + Math.sin(a) * w * 0.3], { w: w * 0.62, c: m > 0.5 ? col : mix(col, hx('#2a2060'), pet ? 0.25 : 0.5), m: M.pastel, p: 0.85, nodust: true, ti: 0.4, to: 0.4 });
      C.stroke([x - w * 0.9, y + w * 0.36, x + w * 0.9, y + w * 0.36], { w: 0.8, c: m > 0.5 ? hx('#1c3f9a') : hx('#120e36'), m: M.pencil, p: 0.5, ti: 0.4, to: 0.4 });
    }
    // a ball nobody came back for, low in the water by the seesaw
    const bx = 388, by = 548, r = 5.2;
    S.fillPoly(C, R, [[bx - r, by], [bx - r * 0.7, by - r * 0.62], [bx, by - r * 0.86], [bx + r * 0.7, by - r * 0.62], [bx + r, by]], { c: hx('#b47a9a'), gap: 1.2, w: 1.8, p: 0.8 });
    C.stroke(P.arc(R, bx, by, r, Math.PI, 2 * Math.PI, 0.03, 0.86), { w: 0.9, c: hx('#1c1440'), m: M.pencil, p: 0.7 });
    C.stroke(P.arc(R, bx, by - 0.5, r * 0.62, 3.5, 4.5, 0.03, 0.86), { w: 1.1, c: hx('#f0c0b0'), m: M.wax, p: 0.6 });
    S.ring(C, R, bx, by + 0.5, 9, 1);
  };

  // ------------------------------------------------------------------ the bank at our feet
  // one blade: from its root up to its tip, leaning. Returns the tip.
  function blade(C, R, x, y, h, lean, o) {
    const curl = R.r(0.15, 0.5) * (lean >= 0 ? 1 : -1), tx = x + lean * h + curl * h * 0.25, ty = y - h;
    const ctrl = [[x, y], [x + lean * h * 0.25, y - h * 0.42], [x + lean * h * 0.62 + curl * h * 0.05, y - h * 0.78], [tx, ty]];
    const pts = P.spline(ctrl, 4);
    C.stroke(pts, { w: o.w, c: o.c, m: o.m || M.conte, p: o.p || 0.85, ti: 0.02, to: 0.75, cj: 0.025, wv: 0.05 });
    if (o.rim) C.stroke(pts.slice(Math.floor(pts.length * R.r(0.15, 0.4) / 2) * 2), { w: Math.max(0.7, o.w * 0.3), c: o.rim, m: M.wax, p: R.r(0.4, 0.7), ti: 0.2, to: 0.6 });
    return [tx, ty, Math.atan2(ty - ctrl[2][1], tx - ctrl[2][0])];
  }
  S.bank = function (C, R, layer) {
    const darks = [hx('#0d1030'), hx('#121a40'), hx('#16264c'), hx('#1c1c50'), hx('#241a58'), hx('#12303e')];
    const tips = (S._tips = S._tips || []);
    // how high the bank's growth stands along the bottom edge: tall in both corners, low in the middle
    const hgt = x => 34 + 250 * Math.pow(ss(520, 30, x), 1.5) + 215 * Math.pow(ss(1120, 1570, x), 1.4) + 16 * vn(x / 37, 3.3, 77);
    const n = layer === 0 ? 520 : 760;
    for (let i = 0; i < n; i++) {
      let x = R() < 0.5 ? R.r(-20, 560) * R.r(0.3, 1) : 1620 - R.r(0, 560) * R.r(0.3, 1); if (R.chance(0.16)) x = R.r(0, 1600);
      const H = hgt(x) * R.r(0.35, 1.0) * (layer === 0 ? 1.05 : 0.8), y0 = 905 + R.r(0, 10), lean = R.g() * 0.16 + (x < 800 ? 0.07 : -0.07);
      // light: the afterglow from the left, the lamp from the right, and the afternoon shining up out of the water
      const tipY = y0 - H, m = tipY > YH ? Wd.mem(C, clamp(x + lean * H, 0, 1599), clamp(tipY, YH + 1, 899)) : 0;
      let rim = null; const rr = R();
      if (m > 0.5 && rr < 0.5) rim = R.pick([hx('#7fe0e6'), hx('#bff2e8'), hx('#fff3c0'), hx('#5fb6f0')]);
      else if (rr < 0.22) rim = x < 800 ? R.pick([hx('#e0568c'), hx('#ff8a7a'), hx('#b0489a')]) : R.pick([hx('#e9a070'), hx('#b0489a'), hx('#8a5ac0')]);
      const col = layer === 0 ? mix(R.pick(darks), hx('#2a2a70'), R.r(0, 0.5)) : R.pick(darks);
      const t = blade(C, R, x, y0, H, lean, { w: R.r(1.8, 3.6) * (layer === 0 ? 0.85 : 1.1), c: col, rim, p: R.r(0.75, 0.95) });
      if (H > 60 && R.chance(layer === 0 ? 0.16 : 0.22)) tips.push([t[0], t[1], t[2], x, layer]);
    }
  };
  // the very nearest growth: broad blades right under our chin, three big foxtails, four primroses close enough to count the petals
  S.nearest = function (C, R) {
    const darks = [hx('#0b0d2a'), hx('#101636'), hx('#141a44')];
    for (let i = 0; i < 70; i++) {
      const left = i % 2 === 0, x = left ? R.r(-30, 330) * R.r(0.4, 1) : 1630 - R.r(0, 300) * R.r(0.4, 1), H = R.r(110, 330) * (left ? ss(380, 0, x) : ss(1250, 1600, x)) + 40, lean = R.g() * 0.2 + (left ? 0.12 : -0.12);
      const rr = R(), rim = rr < 0.3 ? (left ? R.pick([hx('#e0568c'), hx('#ff8a7a'), hx('#7fe0e6')]) : R.pick([hx('#ffd9a0'), hx('#bff2e8'), hx('#b0489a')])) : null;
      blade(C, R, x, 912, H, lean, { w: R.r(4, 8), c: R.pick(darks), rim, p: 0.95, m: M.pastel });
    }
    // foxtails, big
    for (const f of [[86, 640, 0.5, 62], [214, 706, 0.9, 50], [330, 770, 1.2, 40], [24, 742, 0.3, 44]]) {
      const x0 = f[0] - 40 * f[2], y0 = 912; const stem = P.spline([[x0, y0], [x0 + 12 * f[2], (y0 + f[1]) / 2], [f[0] - 14, f[1] + 16], [f[0], f[1]]], 4);
      C.stroke(stem, { w: 2.0, c: hx('#141a44'), m: M.conte, p: 0.9, ti: 0, to: 0.2 }); C.stroke(stem, { w: 0.8, c: hx('#e0568c'), m: M.wax, p: 0.4, ti: 0.3, to: 0.2 });
      let px = f[0], py = f[1], aa = -0.86; const n = Math.round(f[3] / 1.6), m = Wd.mem(C, clamp(px, 0, 1599), clamp(py, YH + 1, 899)), spine = [px, py], br = [];
      for (let i = 0; i < n; i++) {
        const tt = i / n, wd = 4.6 * Math.sin(Math.PI * Math.min(1, tt * 1.05 + 0.12)) + 1.0;
        aa += 0.9 / n * (0.6 + 0.8 * tt); px += Math.cos(aa) * 1.6; py += Math.sin(aa) * 1.6; spine.push(px, py);
        for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) { const ha = aa + sd * R.r(0.4, 0.85), L = wd * R.r(1.2, 2.3); br.push([px, py, px + Math.cos(ha) * L, py + Math.sin(ha) * L]); }
      }
      const lit = m > 0.5 ? [hx('#fff3c0'), hx('#bff2e8'), hx('#ffd9a0')] : [hx('#ff8a8a'), hx('#ffb48a'), hx('#e0568c'), hx('#ffd0a0')];
      for (const q of br) C.stroke(q, { w: 0.8, c: R.chance(0.3) ? hx('#4a2c5c') : R.pick(lit), m: M.wax, p: R.r(0.4, 0.85), ti: 0, to: 0.6 });
      C.stroke(spine, { w: 2.4, c: hx('#5a3466'), m: M.pastel, p: 0.8, ti: 0.1, to: 0.5, nodust: true });
      C.stroke(spine, { w: 0.9, c: R.pick(lit), m: M.wax, p: 0.5, ti: 0.2, to: 0.5 });
    }
    // primroses, big
    for (const f of [[1452, 700, 19], [1548, 772, 23], [1368, 806, 16], [1500, 852, 17], [1586, 640, 15]]) {
      const x = f[0], y = f[1], r = f[2], sq = R.r(0.62, 0.9), a0 = R.r(0, 1.57);
      const stem = P.spline([[x + 30, 912], [x + 16, (912 + y) / 2 + 10], [x + 3, y + 22], [x, y + 4]], 4);
      C.stroke(stem, { w: 2.4, c: hx('#12203c'), m: M.conte, p: 0.9 }); C.stroke(stem, { w: 0.8, c: hx('#6fd0c8'), m: M.wax, p: 0.45, ti: 0.3, to: 0.3 });
      for (let k = 0; k < 3; k++) { const t = 0.3 + k * 0.2, i = Math.floor(t * (stem.length / 2 - 1)) * 2, sd = k % 2 ? 1 : -1; S.fillPoly(C, R, [[stem[i], stem[i + 1]], [stem[i] + sd * 16, stem[i + 1] - 9], [stem[i] + sd * 30, stem[i + 1] - 7], [stem[i] + sd * 15, stem[i + 1] - 1]], { c: hx('#162a48'), gap: 1.3, ang: sd * -0.3, p: 0.9, m: M.conte }); }
      C.veil(x - 70, y - 70, x + 70, y + 70, (xx, yy, col) => { const d = Math.hypot(xx - x, yy - y); col[0] = 1; col[1] = 0.97; col[2] = 0.62; return 0.30 * Math.exp(-d / (r * 0.9)); }, { g: 0.6, mode: 'lend' });
      for (let k = 0; k < 4; k++) {
        const a = a0 + k * 1.571 + R.g() * 0.07, E = (da, rr) => [x + Math.cos(a + da) * r * rr, y + Math.sin(a + da) * r * rr * sq];
        // a heart: narrow at the centre, two rounded lobes and a notch at the rim
        const poly = [E(0, 0.08), E(-0.42, 0.5), E(-0.56, 0.86), E(-0.36, 1.06), E(-0.12, 1.0), E(0, 0.84), E(0.12, 1.0), E(0.36, 1.06), E(0.56, 0.86), E(0.42, 0.5)];
        S.fillPoly(C, R, poly, { c: k % 2 ? hx('#fff6a6') : hx('#ffee86'), gap: 1.2, w: 2.0, ang: a, p: 0.95, m: M.glow });
        S.fillPoly(C, R, [E(0, 0.06), E(-0.3, 0.4), E(0, 0.55), E(0.3, 0.4)], { c: hx('#ffd24a'), gap: 1.4, w: 1.4, ang: a, p: 0.6 });
        C.stroke(P.spline(poly.concat([poly[0]]), 2), { w: 1.0, c: hx('#9a7a22'), m: M.pencil, p: 0.8 });
        for (const da of [-0.22, 0, 0.22]) C.stroke([E(da, 0.2)[0], E(da, 0.2)[1], E(da * 1.5, 0.78)[0], E(da * 1.5, 0.78)[1]], { w: 0.7, c: hx('#c8a038'), m: M.pencil, p: 0.5 });
      }
      for (let k = 0; k < 7; k++) { const a = R.r(0, 6.28), L = r * R.r(0.2, 0.36); C.stroke([x, y, x + Math.cos(a) * L, y + Math.sin(a) * L * sq], { w: 0.8, c: hx('#e8962a'), m: M.wax, p: 0.8 }); C.dab(x + Math.cos(a) * L, y + Math.sin(a) * L * sq, 0.9, hx('#fff8d0'), M.pastel, 0.9); }
      C.dab(x, y, 1.8, hx('#9ac850'), M.pastel, 0.9);
    }
  };
  // foxtails and evening primroses standing up out of the grass
  S.bankFlowers = function (C, R) {
    const tips = S._tips || [];
    let nf = 0, np = 0;
    for (const t of tips) {
      const x = t[0], y = t[1]; if (y < YH + 20 || y > 880) continue;
      if (t[3] < 800 || R.chance(0.3)) { // foxtail: a bristly head nodding at the end of its stem
        if (nf++ > 46) continue;
        const L = R.r(16, 30), a = t[2] + R.g() * 0.2, n = Math.round(L / 1.4), m = Wd.mem(C, clamp(x, 0, 1599), clamp(y, YH + 1, 899));
        const body = m > 0.5 ? R.pick([hx('#2a3a6a'), hx('#3a4a5c'), hx('#1c2a58')]) : R.pick([hx('#3a2458'), hx('#4a2a5c'), hx('#2a1c50')]);
        const hair = m > 0.5 ? R.pick([hx('#fff3c0'), hx('#bff2e8'), hx('#ffd9a0')]) : R.pick([hx('#ff8a8a'), hx('#e0568c'), hx('#ffb48a')]);
        let px = x, py = y, aa = a;
        for (let i = 0; i < n; i++) {
          const tt = i / n, wd = 3.6 * Math.sin(Math.PI * Math.min(1, tt * 1.15 + 0.08)) + 0.8;
          aa += 0.035 * (Math.cos(a) >= 0 ? 1 : -1) + 0.012; px += Math.cos(aa) * 1.4; py += Math.sin(aa) * 1.4;
          for (const sd of [-1, 1]) { const ha = aa + sd * R.r(0.7, 1.1); C.stroke([px, py, px + Math.cos(ha) * wd * R.r(0.8, 1.5), py + Math.sin(ha) * wd * R.r(0.8, 1.5)], { w: 0.8, c: R.chance(0.62) ? hair : body, m: M.wax, p: R.r(0.5, 0.85), ti: 0, to: 0.6 }); }
          if (i % 2) C.dab(px, py, wd * 0.3, body, M.conte, 0.7);
        }
      } else { // evening primrose: four pale petals, open for the night
        if (np++ > 26) continue;
        const r = R.r(5.5, 9), a0 = R.r(0, 1.57), sq = R.r(0.55, 0.95);
        C.veil(x - 26, y - 26, x + 26, y + 26, (xx, yy, col) => { const d = Math.hypot(xx - x, yy - y); col[0] = 1; col[1] = 0.97; col[2] = 0.62; return 0.22 * Math.exp(-d / 8); }, { g: 0.6, mode: 'lend' });
        for (let k = 0; k < 4; k++) {
          const a = a0 + k * 1.571 + R.g() * 0.08, cx = x + Math.cos(a) * r * 0.55, cy = y + Math.sin(a) * r * 0.55 * sq;
          const pa = a + 1.571, wdt = r * 0.44;
          const poly = [[x, y], [cx + Math.cos(pa) * wdt, cy + Math.sin(pa) * wdt * sq], [x + Math.cos(a) * r * 1.08, y + Math.sin(a) * r * 1.08 * sq], [cx - Math.cos(pa) * wdt, cy - Math.sin(pa) * wdt * sq]];
          S.fillPoly(C, R, poly, { c: k % 2 ? hx('#fff6a8') : hx('#ffee88'), gap: 1.1, w: 1.7, ang: a, p: 0.9, m: M.glow });
          C.stroke(P.spline(poly.concat([poly[0]]), 2), { w: 0.8, c: hx('#9a7a22'), m: M.pencil, p: 0.7 });
        }
        C.dab(x, y, 1.5, hx('#ffb84a'), M.pastel, 0.9); for (let k = 0; k < 4; k++) C.stroke([x, y, x + R.g() * 2.2, y + R.g() * 2.2 * sq], { w: 0.7, c: hx('#e89a2a'), m: M.wax, p: 0.7 });
        // a bud or two below it
        if (R.chance(0.7)) C.stroke([x + R.r(-7, 7), y + R.r(8, 16), x + R.r(-4, 4), y + R.r(2, 7)], { w: 2.2, c: hx('#d8d078'), m: M.pastel, p: 0.75, nodust: true, ti: 0, to: 0.6 });
      }
    }
  };
  // reeds standing further out in the water, with their short dark reflections
  S.reeds = function (C, R) {
    const clumps = [[150, 566, 16, 30], [230, 610, 20, 44], [52, 640, 22, 60], [1400, 548, 12, 20], [1490, 590, 20, 40], [1560, 650, 24, 66], [600, 520, 9, 14], [1140, 522, 7, 11], [470, 548, 8, 16]];
    for (const cl of clumps) {
      const n = cl[2];
      for (let i = 0; i < n; i++) {
        const x = cl[0] + R.g() * cl[3] * 0.5, y = cl[1] + R.g() * cl[3] * 0.08, h = cl[3] * R.r(0.45, 1.25), lean = R.g() * 0.14, m = Wd.mem(C, clamp(x, 0, 1599), y);
        // the reflection first: short, broken, pulled down
        const hr = h * R.r(0.55, 0.85);
        for (let k = 0; k < 3; k++) { const a = k / 3, b = a + R.r(0.2, 0.3); C.stroke([x + lean * hr * a + R.g() * 0.6, y + hr * a + 1, x + lean * hr * b + R.g() * 0.8, y + hr * b + 1], { w: R.r(1.0, 1.8), c: m > 0.5 ? hx('#1c3f9a') : hx('#141038'), m: M.pencil, p: R.r(0.35, 0.6), ti: 0.2, to: 0.4 }); }
        const rim = R.chance(0.3) ? (x < 800 ? hx('#ff8a7a') : hx('#e9a070')) : null;
        blade(C, R, x, y, h, lean, { w: R.r(1.0, 1.8) * (0.6 + cl[3] / 70), c: R.pick([hx('#0f1232'), hx('#161c46'), hx('#1c1c50')]), rim, p: 0.85 });
      }
      S.ring(C, R, cl[0], cl[1] + 1, cl[3] * 0.5, 0.8);
    }
  };
  S.fireflies = function (C, R) {
    const spots = [];
    for (let i = 0; i < 300 && spots.length < 23; i++) {
      const x = R() < 0.5 ? R.r(10, 520) : R.r(1090, 1590), y = R.r(640, 890);
      const hmax = 905 - (34 + 250 * Math.pow(ss(520, 30, x), 1.5) + 215 * Math.pow(ss(1120, 1570, x), 1.4)) - 30;
      if (y < hmax) continue; spots.push([x, y]);
    }
    spots.push([1012, 470], [1118, 486], [706, 462], [246, 520]);   // and a few that have wandered out over the water
    for (const s of spots) {
      const x = s[0], y = s[1], r = R.r(7, 13);
      C.veil(x - r * 3, y - r * 3, x + r * 3, y + r * 3, (xx, yy, col) => { const d = Math.hypot(xx - x, yy - y); col[0] = 0.86; col[1] = 1; col[2] = 0.5; return 0.5 * Math.exp(-d / (r * 0.42)); }, { g: 0.6, mode: 'lend' });
      C.dab(x, y, R.r(1.0, 1.6), hx('#f6ffc8'), M.glow, 1);
      if (R.chance(0.5)) { const a = R.r(0, 6.28), L = R.r(8, 20); C.stroke(P.spline([[x, y], [x + Math.cos(a) * L * 0.5 + R.g() * 2, y + Math.sin(a) * L * 0.5 + R.g() * 2], [x + Math.cos(a + 0.5) * L, y + Math.sin(a + 0.5) * L]], 3), { w: 1.0, c: hx('#d9f27a'), m: M.glow, p: 0.5, ti: 0.05, to: 0.8 }); }
    }
  };
  // one dragonfly, asleep on the tallest stem
  S.dragonfly = function (C, R) {
    const tips = (S._tips || []).filter(t => t[3] < 520 && t[1] > YH + 60 && t[1] < 760 && t[0] > 60);
    if (!tips.length) return; tips.sort((a, b) => a[1] - b[1]); const t = tips[Math.min(2, tips.length - 1)], x = t[0], y = t[1] - 2;
    const a = -0.5, k = 1.5; // body tilted up along the stem
    for (const wg of [[-1.9, 15], [-1.35, 14], [1.25, 14], [1.8, 13]]) {
      const wa = a + wg[0], bx = x + Math.cos(a) * 3, by = y + Math.sin(a) * 3, ex = bx + Math.cos(wa) * wg[1] * k, ey = by + Math.sin(wa) * wg[1] * k;
      C.stroke([bx, by, ex, ey], { w: 4.2, c: hx('#f4f6ff'), m: M.wax, p: 0.42, ti: 0.1, to: 0.3 });
      C.stroke([bx, by, ex, ey], { w: 0.8, c: hx('#fffdf0'), m: M.wax, p: 0.85, ti: 0.1, to: 0.2 });
    }
    C.stroke([x - Math.cos(a) * 4, y - Math.sin(a) * 4, x + Math.cos(a) * 20 * k, y + Math.sin(a) * 20 * k], { w: 2.0, c: hx('#f04a5e'), m: M.conte, p: 0.95, ti: 0.1, to: 0.3 });
    C.stroke([x - Math.cos(a) * 3, y - Math.sin(a) * 3 - 0.6, x + Math.cos(a) * 12 * k, y + Math.sin(a) * 12 * k - 0.6], { w: 0.7, c: hx('#ffb0a0'), m: M.wax, p: 0.7 });
    C.dab(x - Math.cos(a) * 6, y - Math.sin(a) * 6, 2.8, hx('#c82a4c'), M.conte, 0.95);
    C.dab(x - Math.cos(a) * 6.6, y - Math.sin(a) * 6 - 0.8, 0.9, hx('#ffd0c0'), M.wax, 0.9);
  };
})(typeof self !== 'undefined' ? self : globalThis);
