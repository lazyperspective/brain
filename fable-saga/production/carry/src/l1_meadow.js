  /* ================================================================ Carry · L1 — the meadow at night
     We pull back from the snail and find it on the brow of a meadow hill, under the whole night. Its flower (L0) shows
     through the window at the origin; around it the brow runs almost level (y ≈ 19 by the window, 20 at the frame's edge,
     where the valley takes over) and the meadow falls away toward us in depth: forty-odd bands of grass, each 1.1× nearer
     and bigger than the one behind it, painted front to back through a depth buffer, with harebells, dandelion clocks,
     mushrooms and daisies standing among them, and fireflies at every depth, lighting what is near them. The band at the
     brow is L0's own grass, blade for blade (the same hashes, the same wind), and L0's own fireflies fly here too, so the
     seam under the snail cannot be seen. Above: the night deepening from 135 to 134, a soft glow along the horizon behind a
     line of far trees on the left, a faint aurora top left, the Milky Way rising on the right, and stars at every scale.
     Every motion turns on the 15 s loop (zP). */
  {
    // ---- the screen rect of this draw (the box, less the letterbox) and the depth buffer
    //   depth: 0 the sky, 1 the far trees, 2 the snail's stem, 3 + 5j the meadow's band j (things standing in band j sit
    //   between, at c1Zof(j)); 255 the window, which the inner layer covers
    const c1R0 = LB, c1R1 = H - 1 - LB;
    const c1Z = new Uint8Array(NP);
    let c1X0 = 0, c1X1 = 0, c1Y0 = 0, c1Y1 = 0;
    const c1Pow = (j) => Math.pow(1.1, j);
    const c1Zof = (j) => { const k = fl(j); return Math.min(254, 4 + 5 * k + Math.min(3, fl((j - k) * 4))); };
    const c1Rq = (R, v, X, Y, dw) => { const i = fl(v + 0.5 + (bay(X, Y) - 0.5) * dw); return R[i < 0 ? 0 : i >= R.length ? R.length - 1 : i]; };

    // ---- the ground. Band j's baseline (where its blades rise from) at x. The brow (band 0) is L0's meadow line, a gentle
    //   hill that sinks one unit by the frame's edge; the bands nearer us bunch a little under the window, so nothing of
    //   ours but L0's own grass stands inside its soft edge
    const c1Hill = (x) => { const a = Math.max(0, Math.abs(x) - 40) / 248; return a * a; };
    const c1Top0 = (x) => (153 + 1.7 * Math.sin(x * 0.648 + 1.3) + 1.2 * Math.sin(x * 1.84 + 0.4)) / 8 + c1Hill(x);
    function c1BaseS(j, s, x) {
      const raw = 10 + (9.125 + c1Hill(x)) * s, ax = Math.abs(x), m = j < 1 ? j : 1;
      let y = raw + 0.22 * s * Math.sin(x / s * 0.13 + j * 1.7) * m;
      if (ax < 84) y += 6 * (1 - sstep(36, 84, ax)) * Math.exp(-(raw - 19) / 6) * m;
      return j < 1 ? lerp(c1Top0(x), y, j) : y;
    }
    const c1Base = (j, x) => (j <= 0 ? c1Top0(x) : c1BaseS(j, c1Pow(j), x));

    // ---- small drawing helpers, all behind whatever is nearer (depth z)
    function c1Each(V, x0, y0, x1, y1, z, fn) {
      const u = V.u;
      const X0 = Math.max(c1X0, fl(240 + x0 * u)), X1 = Math.min(c1X1, Math.ceil(240 + x1 * u)), Y0 = Math.max(c1Y0, fl(135 + y0 * u)), Y1 = Math.min(c1Y1, Math.ceil(135 + y1 * u));
      for (let Y = Y0; Y <= Y1; Y++) {
        const y = (Y + 0.5 - 135) / u, o = Y * W;
        for (let X = X0; X <= X1; X++) {
          const i = o + X; if (c1Z[i] > z) continue;
          const c = fn((X + 0.5 - 240) / u, y, X, Y); if (c >= 0) { BUF[i] = c; c1Z[i] = z; }
        }
      }
    }
    function c1Dot(X, Y, r, z, c) {
      if (r < 0.75) { const x = fl(X), y = fl(Y); if (x < c1X0 || x > c1X1 || y < c1Y0 || y > c1Y1) return; const i = y * W + x; if (c1Z[i] <= z) { BUF[i] = c; c1Z[i] = z; } return; }
      const r2 = r * r, x0 = Math.max(c1X0, fl(X - r)), x1 = Math.min(c1X1, Math.ceil(X + r)), y0 = Math.max(c1Y0, fl(Y - r)), y1 = Math.min(c1Y1, Math.ceil(Y + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + 0.5 - X, dy = y + 0.5 - Y; if (dx * dx + dy * dy > r2) continue; const i = y * W + x; if (c1Z[i] <= z) { BUF[i] = c; c1Z[i] = z; } }
    }
    // a tapering stroke along the quadratic curve a → b (control c), radius r0 → r1 units; lit: the colour of its lit
    // (upper left) side when it is thick enough to have one
    function c1Stroke(V, ax, ay, cx, cy, bx, by, r0, r1, z, col, lit) {
      const u = V.u, L = (Math.hypot(cx - ax, cy - ay) + Math.hypot(bx - cx, by - cy)) * u, n = Math.max(2, Math.ceil(L * 1.3));
      if (L < 0.5) { c1Dot(240 + bx * u, 135 + by * u, 0.5, z, col); return; }
      for (let k = 0; k <= n; k++) {
        const q = k / n, a = (1 - q) * (1 - q), b = 2 * q * (1 - q), d = q * q;
        const X = 240 + (a * ax + b * cx + d * bx) * u, Y = 135 + (a * ay + b * cy + d * by) * u, r = Math.max(0.5, lerp(r0, r1, q) * u);
        c1Dot(X, Y, r, z, col);
        if (lit >= 0 && r >= 1.3) c1Dot(X - r * 0.38, Y - r * 0.2, r * 0.5, z, lit);
      }
    }
    // light that keeps its surface's hue: each colour lifted one step up its own ramp (L0's table, so the light agrees)
    const c1LIT = new Uint8Array(256);
    for (let i = 0; i < 256; i++) c1LIT[i] = i < NPAL ? T_WARM[2][i] : i;
    for (const R of [[124, 125, 126, 127, 128, 129], [130, 131, 132, 133, 15, 16, 108, 22], [134, 135, 136, 137, 138, 147, 148, 22], [1, 2, 3, 4, 5, 6, 7, 8, 56, 57, 22], [139, 140, 141, 142, 143, 50, 53], [0, 1], [23, 24, 25, 26, 49], [116, 117, 118, 119, 148], [19, 20, 21, 22], [144, 16, 22], [59, 60, 22], [58, 59], [44, 75, 22]])
      for (let k = 0; k + 1 < R.length; k++) c1LIT[R[k]] = R[k + 1];
    function c1Light(X, Y, r, a) {
      if (a <= 0.01 || r < 0.6) return;
      const x0 = Math.max(c1X0, fl(X - r)), x1 = Math.min(c1X1, Math.ceil(X + r)), y0 = Math.max(c1Y0, fl(Y - r)), y1 = Math.min(c1Y1, Math.ceil(Y + r)), ir = 1 / r;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx + 0.5 - X) * ir, dy = (yy + 0.5 - Y) * ir, d = dx * dx + dy * dy; if (d >= 1) continue;
        const f = a * (1 - Math.sqrt(d)), b = bay(xx, yy), i = yy * W + xx;
        if (b < f * f * 1.6) { BUF[i] = c1LIT[BUF[i]]; if (b < f * f * 0.5) BUF[i] = c1LIT[BUF[i]]; }
      }
    }

    /* ---------------------------------------------------------------- the grass, band by band */
    const C1NB = 44, C1SP = 0.2875;                                  // bands; blades 0.2875 s apart (L0's, 2.3 of its units)
    // ramps by distance: far off (hazed toward the night), the middle meadow, close to us (in shadow); and a cooler teal
    const C1GF = [134, 139, 23, 24, 25, 137], C1G = [1, 139, 140, 141, 142, 143], C1GN = [0, 1, 139, 140, 141, 142], C1T = [1, 23, 24, 25, 26, 143];
    // how much light a band's grass holds: the far meadow catches the sky, nearer it falls into shadow
    const c1Tone = (j) => 1.45 - 0.25 * sstep(4, 12, j) - 0.45 * sstep(15, 28, j);
    // tufts: a smooth, irregular height for the grass along each band (a periodic table, 128 band units round)
    const C1CL = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const a = i / 1024 * TAU; C1CL[i] = 0.42 + 0.78 * clamp(0.5 + 0.32 * Math.sin(a * 37) + 0.22 * Math.sin(a * 91 + 1.3) + 0.14 * Math.sin(a * 13 + 0.4), 0, 1); }
    const c1YA = new Float32Array(W), c1YB = new Float32Array(W), c1SWA = new Float32Array(W / 4 + 8);
    // band j (j ≥ 1) at depth scale s: yb its baseline per column, yn the band in front's (where our ground may stop)
    function c1Band(V, t, j, s, yb, yn) {
      const u = V.u, su = s * u, z = 3 + 5 * j, sl = sstep(5, 22, j), hm = 1 + 0.55 * sl, w0 = 0.085 + 0.05 * (1 - sl), mws = 0.5 / su;
      const tone = c1Tone(j), R0 = j < 6 ? C1GF : j < 18 ? C1G : C1GN, X0 = c1X0, X1 = c1X1, Y0 = c1Y0, Y1 = c1Y1;
      // the ground under the blades, in their shadow, streaked
      for (let X = X0; X <= X1; X++) {
        const b0 = yb[X], Ya = Math.max(Y0, Math.ceil(135 + b0 * u - 0.5)), Yb = yn ? Math.min(Y1, Math.ceil(135 + yn[X] * u) + 1) : Y1;
        if (Ya > Yb) continue;
        const st = (ih(fl((X + 0.5 - 240) / su * 4.7), j, 561) - 0.5) * 1.2 + tone - 0.7;
        for (let Y = Ya; Y <= Yb; Y++) { const i = Y * W + X; if (c1Z[i] >= z) continue; BUF[i] = c1Rq(R0, st - ((Y + 0.5 - 135) / u - b0) / s * 0.9, X, Y, 0.7); c1Z[i] = z; }
      }
      if (C1SP * su < 0.45) {                                          // too small for single blades: a ragged top
        for (let X = X0; X <= X1; X++) {
          const b0 = yb[X], xw = (X + 0.5 - 240) / su, hr = ih(fl(xw / C1SP), j, 1207);
          let top = b0 - s * (0.3 + 1.3 * hr * hr) * hm * C1CL[(fl(xw * 8) + j * 137) & 1023];
          if (xw * s > -46 && xw * s < 46) top = Math.max(top, Math.min(b0, 22.6));
          const Ya = Math.max(Y0, Math.ceil(135 + top * u - 0.5)), Yb = Math.min(Y1, Math.ceil(135 + b0 * u - 0.5) - 1);
          for (let Y = Ya; Y <= Yb; Y++) { const i = Y * W + X; if (c1Z[i] >= z) continue; BUF[i] = c1Rq(R0, tone + 0.6 + (bay(X + 3, Y + 1) - 0.5), X, Y, 0.6); c1Z[i] = z; }
        }
        return;
      }
      // the wind along the band (at the brow it is L0's), every 4 columns
      const p2 = zP(t, 2) + 0.35 * j, p3 = zP(t, 3) + 0.2 * j;
      for (let q = 0, X = X0; X <= X1 + 4; X += 4, q++) { const xw = (X + 2 - 240) / su; c1SWA[q] = 0.10 * Math.sin(p2 + 0.232 * xw) + 0.05 * Math.sin(p3 - 0.56 * xw); }
      const wide = w0 * su > 1.0, lean = 0.75 * (1 + 1.8 * sl), glowL = j < 16 ? 0.35 : 0.15, mg = (lean * 0.5 + 1) * su + 4, mk = Math.ceil(mg / (C1SP * su)) + 2;
      const k0 = fl(V.lx(X0) / s / C1SP) - mk, k1 = fl(V.lx(X1) / s / C1SP) + mk;
      for (let k = k0; k <= k1; k++) {
        const r1 = ih(k, j, 1201), r2 = ih(k, j, 1202), bx = (k + 0.5 + (r2 - 0.5) * 0.8) * C1SP, Xf = 240 + bx * su;
        if (Xf < X0 - mg || Xf > X1 + mg) continue;
        const xi = Xf < X0 ? X0 : Xf > X1 ? X1 : fl(Xf), b0 = yb[xi];
        let hb = (2.5 + r1 * r1 * 15 + (r1 > 0.94 ? 13 : 0)) / 8 * hm * C1CL[(fl(bx * 8) + j * 137) & 1023];
        const xu = bx * s; if (xu > -46 && xu < 46) hb = Math.min(hb, Math.max(0.12, (b0 - 22.6) / s));   // none of ours inside the window's edge
        const Yt = Math.max(Y0, Math.ceil(135 + (b0 - hb * s) * u - 0.5)), Ye = Math.min(Y1, fl(135 + b0 * u - 0.5));
        if (Yt > Ye) continue;
        const r3 = frac(r1 * 9.73 + r2 * 3.11), L = (r3 - 0.5) * lean, ms = c1SWA[(xi - X0) >> 2], R = r2 > 0.7 ? C1T : R0;
        const cv = (frac(r2 * 17.3 + r1 * 5.7) - 0.5) * 0.9 + tone + glowL * sstep(-40, -210, xu);
        for (let Y = Yt; Y <= Ye; Y++) {
          const hg = (b0 - (Y + 0.5 - 135) / u) / s, f = hg / hb, cx = bx + L * f * f + ms * hg, hw = Math.max(w0 * (1 - f) + 0.02, mws);
          let Xa = Math.ceil(240 + (cx - hw) * su - 0.5), Xe = fl(240 + (cx + hw) * su - 0.5);
          if (Xa > Xe) Xa = Xe = fl(240 + cx * su);
          if (Xa < X0) Xa = X0; if (Xe > X1) Xe = X1;
          const o = Y * W, v0 = cv + 1.5 * f * f;
          for (let X = Xa; X <= Xe; X++) {
            const i = o + X; if (c1Z[i] >= z) continue;
            let v = v0;
            if (wide) { const sd = ((X + 0.5 - 240) / su - cx) / hw; v -= 0.55 * sd; if (sd < -0.5 && f > 0.2) v += 0.9; }
            BUF[i] = c1Rq(R, v, X, Y, 0.6); c1Z[i] = z;
          }
        }
      }
    }
    // band 0: L0's own meadow (its blades, its wind, its shadows), in its units — so where the window's edge mixes the two
    // layers, both show the same grass
    const C1N0 = 4200, c1H0 = new Float32Array(C1N0), c1XB0 = new Float32Array(C1N0), c1L0 = new Float32Array(C1N0), c1C0 = new Uint8Array(C1N0), c1T0 = new Uint8Array(C1N0);
    function c1Band0(V, t, yn) {
      const u = V.u, u0 = u / 8, mw = 0.55 / u0, z = 3;
      const xa = V.lx(c1X0) * 8, xb = V.lx(c1X1) * 8, j0 = fl(xa / 2.3) - 4, n = fl(xb / 2.3) + 4 - j0 + 1, blades = n <= C1N0;
      if (blades) for (let i = 0; i < n; i++) {
        const jj = j0 + i, r1 = ih(jj, 1, 563), r2 = ih(jj, 2, 563), r3 = ih(jj, 3, 563);
        c1H0[i] = 2.5 + r1 * r1 * 15 + (r1 > 0.94 ? 15 : 0); c1XB0[i] = (jj + 0.5 + (r2 - 0.5) * 0.8) * 2.3; c1L0[i] = (r3 - 0.5) * 6;
        c1C0[i] = r2 < 0.45 ? 140 : 139; c1T0[i] = r3 > 0.72 && u0 > 0.3 ? 1 : 0;
      }
      const p2 = zP(t, 2), p3 = zP(t, 3);
      for (let X = c1X0; X <= c1X1; X++) {
        const x = (X + 0.5 - 240) / u, x0 = x * 8;
        const MF = 153 + 1.7 * Math.sin(x0 * 0.081 + 1.3) + 1.2 * Math.sin(x0 * 0.23 + 0.4) + 8 * c1Hill(x);
        const MS = 0.10 * Math.sin(p2 + x0 * 0.029) + 0.05 * Math.sin(p3 - x0 * 0.07), sx = 3 * Math.sin(x0 * 0.7);
        const Ya = Math.max(c1Y0, fl(135 + (MF - 34) / 8 * u)), Yb = Math.min(c1Y1, Math.ceil(135 + yn[X] * u) + 1);
        for (let Y = Ya; Y <= Yb; Y++) {
          const i = Y * W + X; if (c1Z[i] >= z) continue;
          const y0 = (Y + 0.5 - 135) / u * 8, hg = MF - y0;
          if (hg > 34) continue;
          let c = -1;
          if (hg <= 0) {
            const k = ih(fl(x0 / 1.7), fl((y0 + sx) / 4.5), 561), v = 1.55 + hg / 30 + (k - 0.5) * 1.3;
            c = v > 1.8 ? 140 : v > 0.5 ? 139 : 23;
          } else if (blades) {
            const xs = x0 - MS * hg, k = fl(xs / 2.3) - j0;
            for (let q = Math.max(0, k - 2), e = Math.min(n - 1, k + 2); q <= e; q++) {
              const hb = c1H0[q]; if (hg >= hb) continue;
              const f = hg / hb, bx = c1XB0[q] + c1L0[q] * f * f, wb = Math.max(1.2 * (1 - f) + 0.2, mw);
              if (Math.abs(xs - bx) < wb) { c = f > 0.66 && c1T0[q] ? 141 : c1C0[q]; break; }
            }
          } else if (hg < 2.5 + 15 * Math.pow(ih(X, 7, 1209), 2)) c = 139;
          if (c >= 0) { BUF[i] = c; c1Z[i] = z; }
        }
      }
    }
    function c1Meadow(V, t) {
      const u = V.u, ybot = V.ly(c1Y1) + 1;
      // the nearest band in view: its tallest blades reach up to about 10 + 3.2 s
      const jm = clamp(Math.ceil(Math.log(Math.max(1.01, (ybot - 10) / 3.2)) / Math.log(1.1)) + 1, 1, C1NB);
      let A = c1YA, B = c1YB;
      for (let j = jm; j >= 1; j--) {
        const s = c1Pow(j);
        for (let X = c1X0; X <= c1X1; X++) A[X] = c1BaseS(j, s, (X + 0.5 - 240) / u);
        c1Band(V, t, j, s, A, j === jm ? null : B);
        const T = A; A = B; B = T;
      }
      c1Band0(V, t, B);
      // the snail's flower stem (L0's), between the blades at the window's foot
      const u0 = u / 8, sh = Math.max(0.5 / u0, 3.5) / 8;
      c1Each(V, 3 - sh, 11, 3 + sh, 52.5, 2, (x, y) => { const q = (x - 3) / sh, dk = y > 19.5 ? 1 : 0; return q < -0.68 ? 140 : q < -0.2 ? 143 - dk : q < 0.36 ? 142 - dk : q < 0.7 ? 141 - dk : 140; });
    }

    /* ---------------------------------------------------------------- the flowers of the meadow */
    const C1BEL = [3, 4, 5, 6, 7, 8, 56, 57];                        // harebell blue-violet, shadow to the pale rim
    // a bell hanging from (ax, ay) along the angle ang (π/2: straight down), Lb units long
    function c1Bell(V, ax, ay, ang, Lb, z) {
      const u = V.u, ca = Math.cos(ang), sa = Math.sin(ang), Lp = Lb * u;
      if (Lp < 1.8) { c1Dot(V.X(ax + ca * Lb * 0.55), V.Y(ay + sa * Lb * 0.55), Math.max(0.5, Lp * 0.4), z, Lp < 1 ? 6 : 7); return; }
      const ex = ax + ca * Lb, ey = ay + sa * Lb, R = Lb * 0.56, ol = 0.85 / u;
      c1Each(V, Math.min(ax, ex) - R, Math.min(ay, ey) - R, Math.max(ax, ex) + R, Math.max(ay, ey) + R, z, (x, y, X, Y) => {
        const dx = x - ax, dy = y - ay, a = dx * ca + dy * sa, c = -dx * sa + dy * ca, q = a / Lb;
        if (q < -0.02 || q > 1.04) return -1;
        const qq = Math.max(0, q), fl7 = Math.max(0, q - 0.68), r = Lb * (0.12 + 0.27 * Math.pow(qq, 0.8) + 0.9 * fl7 * fl7);
        const ac = Math.abs(c); if (ac > r) return -1;
        const qe = 1 - 0.075 * (0.5 + 0.5 * Math.cos(c / (Lb * 0.42) * 7.2));   // the lip's five points, seen from the side
        if (q > qe) return -1;
        if (q < 0.1) return c > 0 ? 141 : 140;                           // the calyx
        const side = c / r;                                              // +1 the side toward the upper left (the light)
        let v = 2.3 + 1.25 * side + 0.9 * (1 - q) + 0.5 * Math.sin(c / Lb * 19) * (Lp > 6 ? 1 : 0);   // and faint ribs
        if (q > qe - 0.11) v = side > -0.2 ? 6.2 : 4.6;                  // the pale rim of the mouth
        else if (r - ac < ol) v -= 1.4;                                  // a crisp dark edge
        return c1Rq(C1BEL, v, X, Y, 0.55);
      });
    }
    function c1Harebell(V, t, P) {
      const s = c1Pow(P.j), z = c1Zof(P.j), bx = P.x, by = c1Base(P.j, P.x) + 0.3 * s, Hh = P.h * s, d = P.dir;
      const sw = (0.07 * Math.sin(zP(t, 2) + P.ph) + 0.035 * Math.sin(zP(t, 3) + P.ph * 1.7)) * Hh;
      const p1x = bx + d * 0.06 * Hh + sw * 0.5, p1y = by - 1.08 * Hh, p2x = bx + d * 0.4 * Hh + sw, p2y = by - 0.9 * Hh;
      if (!V.vis(Math.min(bx, p2x) - Hh * 0.3, by - Hh * 1.1, Math.max(bx, p2x) + Hh * 0.3, by)) return;
      const w = 0.045 * s * (P.th || 1);
      c1Stroke(V, bx, by, p1x, p1y, p2x, p2y, w, w * 0.6, z, P.sil ? 139 : 140, P.sil ? 140 : 141);
      const Lb = P.bs * s, ga = 0.12 * Math.sin(zP(t, 2) + P.ph + 0.6);
      c1Bell(V, p2x, p2y, PI / 2 + d * 0.32 + ga, Lb, z);
      for (let k = 1; k < P.nb; k++) {                                  // the side bells on their short stalks
        const q = 0.78 - k * 0.2, a = (1 - q) * (1 - q), b = 2 * q * (1 - q), e = q * q;
        const sx = a * bx + b * p1x + e * p2x, sy = a * by + b * p1y + e * p2y, o = (k % 2 ? -1 : 1) * d;
        const tx = sx + o * 0.16 * Hh + sw * 0.2, ty = sy - 0.03 * Hh;
        c1Stroke(V, sx, sy, sx + o * 0.1 * Hh, sy - 0.07 * Hh, tx, ty, w * 0.6, w * 0.5, z, 140, -1);
        c1Bell(V, tx, ty, PI / 2 + o * 0.42 + ga * 1.3, Lb * (0.86 - 0.08 * k), z);
      }
    }
    // a dandelion clock: a pale sphere of seeds on a hollow stalk, the light from the horizon behind it
    function c1Clock(V, t, P) {
      const u = V.u, s = c1Pow(P.j), z = c1Zof(P.j), bx = P.x, by = c1Base(P.j, P.x) + 0.3 * s, Hh = P.h * s;
      const sw = (0.04 * Math.sin(zP(t, 2) + P.ph) + 0.02 * Math.sin(zP(t, 3) + P.ph)) * Hh;
      const cx = bx + P.bow * Hh + sw, cy = by - Hh, R = P.R * s, Rp = R * u;
      P.cx = cx; P.cy = cy; P.s = s;
      if (!V.vis(cx - R * 1.2, cy - R * 1.2, Math.max(cx, bx) + R * 1.2, by)) return;
      c1Stroke(V, bx, by, bx + P.bow * 0.3 * Hh, cy + 0.55 * Hh, cx, cy + R * 0.2, 0.05 * s, 0.035 * s, z, 140, 142);
      if (Rp < 2.2) { c1Dot(V.X(cx), V.Y(cy), Math.max(0.5, Rp), z, Rp < 1 ? 19 : 20); return; }
      const nS = clamp(Math.round(TAU * Rp / 2.3), 10, 80), id = P.id, gp = P.gap || 0.08;
      c1Each(V, cx - R * 1.08, cy - R * 1.08, cx + R * 1.08, cy + R * 1.08, z, (x, y, X, Y) => {
        const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) / R;
        if (d > 1.07) return -1;
        if (d < 0.13) return d < 0.08 ? 17 : 18;                         // the bare seat at the heart
        const th = Math.atan2(dy, dx), a = (th / TAU + 0.5) * nS, si = fl(a), fa = a - si - 0.5;
        if (ih(si, id, 1501) < gp && d > 0.3) return d < 0.5 && Math.abs(fa) * TAU / nS * d * Rp < 0.5 ? 138 : -1;   // a seed already flown
        const lit = -dx / R * 0.62 - dy / R * 0.45;                       // backlit from the left, a little from above
        if (d > 0.7) {                                                   // the tufts round the rim, fuzzy and bright
          const den = (1 - Math.abs(d - 0.89) / 0.18) * (0.78 + 0.22 * ih(fl(x * 7 * u), fl(y * 7 * u), id));
          if (bay(X, Y) > den * 0.95) return Math.abs(fa) * TAU / nS * d * Rp < 0.45 ? 19 : -1;
          return lit > 0.3 ? 21 : lit > -0.25 ? 20 : 19;
        }
        if (Math.abs(fa) * TAU / nS * d * Rp < 0.5) return lit > 0.2 ? 20 : 19;   // the spokes, the seeds' long beaks
        return bay(X + 2, Y + 5) < 0.2 * (1 - d) + 0.06 ? (lit > 0 ? 20 : 19) : 138;   // the tufts that face us, and the haze
      });
    }
    // a mushroom: a brown cap lit from above, gills, a pale stem
    const C1CAP = [27, 28, 29, 30, 31, 66], C1STE = [68, 67, 66, 65];
    function c1Mush(V, t, P) {
      const u = V.u, s = c1Pow(P.j), z = c1Zof(P.j), bx = P.x, by = c1Base(P.j, P.x) + 0.25 * s, Hh = P.h * s, r = P.r * s;
      const cx = bx + P.tilt * Hh, cy = by - Hh, ol = 0.8 / u;
      if (r * u < 1.2) { c1Dot(V.X(cx), V.Y(cy), Math.max(0.5, r * u * 0.7), z, 30); return; }
      c1Each(V, cx - r * 1.05, cy - r * 0.64, Math.max(cx, bx) + r * 1.05, by, z, (x, y, X, Y) => {
        const dx = x - cx, dy = y - cy;
        if (dy <= 0.05 * r) {                                            // the cap
          const nx = dx / r, ny = dy / (0.6 * r), e = nx * nx + ny * ny; if (e > 1) return -1;
          const sp = ih(fl((dx / r + 2) * 4.2), fl((dy / r + 2) * 5), P.id);
          let v = 2.0 - 1.4 * nx * 0.6 - 1.6 * ny * 0.8 + (sp > 0.86 && e < 0.7 ? 2.0 : 0);
          if (e > 1 - 1.7 * ol / r) v -= 1.3;
          return c1Rq(C1CAP, v, X, Y, 0.6);
        }
        if (dy < 0.2 * r) {                                              // the gills, the cap's underside
          if (Math.abs(dx) > r * (0.98 - (dy / r - 0.05) * 2.2)) return -1;
          return frac(dx / r * 7 + 20) < 0.45 ? 68 : 69;
        }
        const q = (dy - 0.05 * r) / (Hh - 0.05 * r), sx = cx + (bx - cx) * q, hw = r * 0.2 * (1 + 0.35 * q);   // the stem
        const ds = (x - sx) / hw; if (ds > 1 || ds < -1 || q > 1) return -1;
        return c1Rq(C1STE, 1.6 - 1.2 * ds - 0.6 * q, X, Y, 0.6);
      });
    }
    // a grass stem gone to seed, standing up against the sky: spikelets hanging off its top
    function c1Panicle(V, t, P) {
      const u = V.u, s = c1Pow(P.j), z = c1Zof(P.j), bx = P.x, by = c1Base(P.j, P.x) + 0.3 * s, Hh = P.h * s, d = P.dir;
      const sw = (0.08 * Math.sin(zP(t, 2) + P.ph) + 0.04 * Math.sin(zP(t, 3) + P.ph * 1.3)) * Hh;
      const tx = bx + d * 0.2 * Hh + sw, ty = by - Hh, cx = bx + d * 0.02 * Hh + sw * 0.3, cy = by - 0.62 * Hh;
      if (!V.vis(Math.min(bx, tx) - 2 * s, ty - s, Math.max(bx, tx) + 2 * s, by)) return;
      c1Stroke(V, bx, by, cx, cy, tx, ty, 0.04 * s, 0.022 * s, z, 1, -1);
      const n = P.n;
      for (let k = 0; k < n; k++) {
        const q = 0.55 + 0.45 * k / (n - 1), a = (1 - q) * (1 - q), b = 2 * q * (1 - q), e = q * q;
        const px = a * bx + b * cx + e * tx, py = a * by + b * cy + e * ty, sd = k % 2 ? 1 : -1, L = (0.62 - 0.36 * (q - 0.55) / 0.45) * s * P.sz;
        const ex = px + (sd * 0.55 + d * 0.55) * L + sw * 0.12, ey = py + 0.6 * L;
        c1Stroke(V, px, py, (px + ex) / 2, py + 0.08 * L, ex, ey, 0.018 * s, 0.018 * s, z, 1, -1);
        const gx = ex + (sd * 0.2 + d * 0.3) * L * 0.5, gy = ey + 0.42 * L;
        c1Stroke(V, ex, ey, ex, ey, gx, gy, 0.075 * s * P.sz, 0.05 * s * P.sz, z, k % 3 ? 139 : 140, 141);
      }
    }
    // the meadow's small white flowers, far and near
    function c1Daisy(V, P) {
      const u = V.u, s = c1Pow(P.j), z = c1Zof(P.j), x = P.x, y = c1Base(P.j, P.x) - P.h * s, rp = 0.24 * s * u * P.sz;
      const X = V.X(x), Y = V.Y(y);
      if (X < c1X0 - 4 || X > c1X1 + 4 || Y < c1Y0 - 4 || Y > c1Y1 + 4) return;
      if (rp < 0.7) { c1Dot(X, Y, 0.5, z, P.c ? 20 : 19); return; }
      if (rp < 1.7) { c1Dot(X, Y, 0.5, z, 15); for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c1Dot(X + ox, Y + oy, 0.5, z, oy < 0 || ox < 0 ? 21 : 20); return; }
      const r = 0.24 * s * P.sz, sk = P.c ? 0.55 : 0.35;                // seen a little from above: squashed
      c1Each(V, x - r, y - r * sk, x + r, y + r * sk, z, (xx, yy, XX, YY) => {
        const dx = (xx - x) / r, dy = (yy - y) / (r * sk), d = Math.sqrt(dx * dx + dy * dy); if (d > 1) return -1;
        if (d < 0.32) return d < 0.18 ? 14 : 15;
        if (frac(Math.atan2(dy, dx) / TAU * 11 + 0.25) < 0.22) return -1;
        return dy < 0.1 ? 21 : 20;
      });
    }

    // ---- what stands in the meadow (x at nominal size; j its depth band; h its height in band units)
    const C1PROPS = [];
    const c1Add = (type, o) => C1PROPS.push(Object.assign({ type, ph: C1PROPS.length * 1.37 }, o));
    // on the brow, against the sky beside the window: what the zoom shows first
    c1Add('clock', { x: -43.6, j: 0.25, h: 7.6, R: 1.85, bow: -0.04, id: 1, gap: 0.12 });
    c1Add('pan', { x: -38.9, j: 0.3, h: 9.6, dir: -1, n: 9, sz: 1 });
    c1Add('pan', { x: -50.5, j: 0.35, h: 6.4, dir: 1, n: 7, sz: 0.85 });
    c1Add('pan', { x: -58.2, j: 0.2, h: 8.4, dir: -1, n: 8, sz: 0.9 });
    c1Add('bell', { x: -66, j: 0.3, h: 5.6, dir: -1, nb: 2, bs: 0.95 });
    c1Add('bell', { x: 41.4, j: 0.3, h: 6.6, dir: 1, nb: 3, bs: 1.0 });
    c1Add('pan', { x: 38.3, j: 0.25, h: 8.9, dir: 1, n: 8, sz: 0.95 });
    c1Add('pan', { x: 49.5, j: 0.35, h: 10.6, dir: 1, n: 10, sz: 1 });
    c1Add('clock', { x: 56.5, j: 0.3, h: 5.4, R: 1.3, bow: 0.05, id: 2, gap: 0.05 });
    c1Add('pan', { x: 64, j: 0.2, h: 7.4, dir: -1, n: 8, sz: 0.9 });
    c1Add('bell', { x: 72.5, j: 0.35, h: 4.8, dir: 1, nb: 2, bs: 0.9 });
    for (const [x, h, d] of [[-76, 6.2, 1], [-91, 8.6, -1], [-107, 5.8, 1], [-141, 7.6, -1], [-163, 6, 1], [-189, 8.1, -1], [-217, 6.5, 1], [-247, 7.2, -1], [-274, 5.6, 1],
      [86, 8.2, 1], [101, 6.1, -1], [121, 9.1, 1], [146, 6.6, -1], [172, 8.4, 1], [199, 6.2, -1], [231, 7.8, 1], [262, 6.4, -1]])
      c1Add('pan', { x, j: 0.2 + ih(x | 0, 1, 1601) * 0.4, h, dir: d, n: 7 + fl(ih(x | 0, 2, 1601) * 4), sz: 0.8 + 0.25 * ih(x | 0, 3, 1601) });
    for (const [x, h] of [[-122, 4.6], [-178, 5.2], [-232, 4.4], [112, 5], [158, 4.4], [214, 5.4], [248, 4.6]])
      c1Add('bell', { x, j: 0.4, h, dir: x < 0 ? -1 : 1, nb: 1 + fl(ih(x | 0, 4, 1601) * 3), bs: 0.9 });
    // the middle distance
    for (const [x, j, h, d, nb] of [[-71, 6.6, 4.6, -1, 3], [-80, 8.4, 5.4, 1, 2], [-93, 7.4, 4.2, -1, 3], [-113, 10, 5, 1, 2], [-129, 9, 4.2, -1, 1],
      [63, 5.8, 4.8, 1, 3], [79, 7.8, 4.4, -1, 2], [92, 6.4, 3.8, 1, 1], [-232, 11, 4.8, 1, 3], [238, 9.5, 4.6, -1, 2], [-262, 7, 4, 1, 2]])
      c1Add('bell', { x, j, h, dir: d, nb, bs: 0.95 });
    c1Add('clock', { x: 99, j: 9.6, h: 5.6, R: 1.5, bow: 0.06, id: 3, gap: 0.08 });
    c1Add('clock', { x: -139, j: 12.6, h: 4.9, R: 1.6, bow: -0.05, id: 4, gap: 0.1 });
    c1Add('clock', { x: 152, j: 13.2, h: 4.4, R: 1.4, bow: 0.04, id: 5, gap: 0.3 });
    c1Add('mush', { x: 126, j: 11, h: 1.25, r: 1.05, tilt: -0.08, id: 6 });
    c1Add('mush', { x: 131.8, j: 11.5, h: 0.78, r: 0.64, tilt: 0.12, id: 7 });
    c1Add('mush', { x: -57, j: 14.4, h: 0.95, r: 0.82, tilt: 0.06, id: 8 });
    // near us
    c1Add('clock', { x: -172, j: 19, h: 7.2, R: 2.35, bow: -0.05, id: 9, gap: 0.1 });
    c1Add('clock', { x: -214, j: 17.3, h: 5.6, R: 1.75, bow: 0.06, id: 10, gap: 0.42 });
    c1Add('bell', { x: 176, j: 21, h: 5.0, dir: -1, nb: 3, bs: 1.05, th: 1.2 });
    c1Add('bell', { x: 212, j: 22.6, h: 4.3, dir: 1, nb: 2, bs: 1.0, th: 1.2 });
    c1Add('bell', { x: 151, j: 23.6, h: 3.2, dir: 1, nb: 2, bs: 0.95, th: 1.2 });
    c1Add('mush', { x: -98, j: 20.2, h: 1.4, r: 1.15, tilt: -0.05, id: 11 });
    c1Add('mush', { x: -91.5, j: 20.5, h: 0.8, r: 0.66, tilt: 0.14, id: 12 });
    // daisies everywhere (never in front of the window)
    for (let k = 0, m = 0; k < 160 && m < 90; k++) {
      const j = 1 + ih(k, 1, 1611) * 17, x = (ih(k, 2, 1611) - 0.5) * 600;
      if (Math.abs(x) < 52 && c1Base(j, x) < 34) continue;
      c1Add('daisy', { x, j, h: 0.35 + 0.6 * ih(k, 3, 1611), sz: 0.8 + 0.4 * ih(k, 4, 1611), c: ih(k, 5, 1611) < 0.6 ? 1 : 0 }); m++;
    }
    C1PROPS.sort((a, b) => b.j - a.j);
    const C1CLOCKS = C1PROPS.filter((P) => P.type === 'clock');
    // dandelion seeds drifting off the clocks, up into the night: [clock id, turns per loop, phase, drift x, drift y]
    const C1SEEDS = [[9, 1, 0.1, 9, -7], [9, 1, 0.45, 12, -5], [9, 2, 0.7, 7, -9], [9, 1, 0.8, 14, -3], [10, 1, 0.3, 10, -6], [3, 1, 0.6, 8, -6], [1, 1, 0.2, -7, -5], [4, 1, 0.9, 9, -6]];
    function c1Props(V, t) {
      for (const P of C1PROPS) {
        if (P.type === 'daisy') c1Daisy(V, P);
        else if (P.type === 'bell') c1Harebell(V, t, P);
        else if (P.type === 'clock') c1Clock(V, t, P);
        else if (P.type === 'mush') c1Mush(V, t, P);
        else c1Panicle(V, t, P);
      }
    }
    function c1Seeds(V, t) {
      const u = V.u;
      for (const [id, n, ph, dx, dy] of C1SEEDS) {
        const C = C1CLOCKS.find((P) => P.id === id); if (!C || C.cx === undefined) continue;
        const p = frac(t * n / 15 + ph), s = C.s, a = sstep(0, 0.12, p) * (1 - sstep(0.7, 1, p));
        if (a < 0.05) continue;
        const x = C.cx + C.R * s * 0.8 + dx * s * p + 0.6 * s * Math.sin(zP(t, 3 * n) + ph * 9), y = C.cy - C.R * s * 0.4 + dy * s * p + 0.4 * s * Math.sin(zP(t, 2 * n) + ph * 5);
        const X = V.X(x), Y = V.Y(y), r = 0.32 * s * u, z = c1Zof(C.j);
        if (r < 1.2) { c1Dot(X, Y, 0.5, z, a > 0.5 ? 20 : 19); continue; }
        c1Dot(X, Y + r * 0.6, 0.5, z, 19);
        for (let k = -2; k <= 2; k++) { const an = -PI / 2 + k * 0.42; c1Dot(X + Math.cos(an) * r * 0.7, Y + Math.sin(an) * r * 0.7, 0.5, z, k === 0 ? 21 : 20); }
      }
    }

    /* ---------------------------------------------------------------- the far trees on the left horizon */
    // [x, trunk width, crowns [x, y, r] ...], standing behind the brow
    const C1TREES = [
      [-84.5, 0.55, [[-84.5, 13.4, 2.7], [-82.6, 14.7, 2.1], [-86.6, 14.9, 1.9]]],
      [-97.5, 0.4, [[-97.5, 16.1, 1.7], [-96.2, 16.8, 1.4]]],
      [-126, 0.7, [[-126, 12.6, 3.2], [-122.8, 14.1, 2.7], [-129.4, 14.3, 2.6], [-125.6, 10.7, 1.6]]],
      [-149, 0.5, [[-149, 14.6, 2.2], [-146.4, 15.6, 1.8]]],
      [-160.5, 0.6, [[-160.5, 13.2, 2.6], [-163.4, 14.6, 2.2], [-158, 15.2, 2]]],
      [-176, 0.5, [[-176, 15.3, 2], [-178.5, 16.4, 1.6]]],
      [-205, 0.5, [[-205, 11.6, 1.4], [-205.2, 13.4, 1.9], [-204.8, 15.6, 2.2]]],
      [-229, 0.45, [[-229, 15.6, 1.9], [-226.8, 16.6, 1.5]]],
    ];
    for (const T of C1TREES) { let x0 = 1e9, x1 = -1e9, y0 = 1e9; for (const [x, y, r] of T[2]) { x0 = Math.min(x0, x - r * 1.2); x1 = Math.max(x1, x + r * 1.2); y0 = Math.min(y0, y - r * 1.2); } T.push([x0, y0, x1]); }
    function c1Trees(V) {
      const u = V.u; if (u < 0.04) return;
      const fine = u > 1.6, ol = 0.9 / u;
      // a low hedge of bushes along the horizon between them
      c1Each(V, -236, 16.4, -79, 21.5, 1, (x, y, X, Y) => {
        const top = 18.2 - 1.3 * vn(x, 0, 2.4, 1621) - 0.7 * vn(x, 0, 0.8, 1622) + 1.6 * sstep(-90, -79, x) + 1.6 * sstep(-226, -236, x);
        if (y < top) return -1;
        return y < top + ol && bay(X, Y) < 0.6 ? 135 : 134;
      });
      for (const T of C1TREES) {
        const [tx, tw, cr, bb] = T;
        if (!V.vis(bb[0], bb[1], bb[2], 21)) continue;
        c1Each(V, bb[0], bb[1], bb[2], 21, 1, (x, y, X, Y) => {
          const n = vn(x, y, 1.1, 1631) * (fine ? 0.6 : 1) + (fine ? vn(x, y, 0.38, 1632) * 0.4 : 0);
          let best = 9;
          for (const [cx, cy, r] of cr) { const d = Math.hypot(x - cx, y - cy) / (r * (0.84 + 0.32 * n)); if (d < best) best = d; }
          if (best < 1) { const rm = (1 - best) * cr[0][2]; return rm < ol ? (bay(X, Y) < 0.55 ? 135 : 134) : rm < ol * 2.2 && y < cr[0][1] && x < tx && bay(X, Y) < 0.25 ? 135 : 134; }
          if (Math.abs(x - tx) < tw * 0.5 && y > cr[0][1]) return 134;
          return -1;
        });
      }
    }

    /* ---------------------------------------------------------------- the sky */
    // the Milky Way: a static map (2 units a cell) of its light and its hue, rising from the right horizon
    const C1MX0 = -60, C1MY0 = -240, C1MC = 2, C1MW = 190, C1MH = 132;
    const C1MWI = new Float32Array(C1MW * C1MH), C1MWH = new Uint8Array(C1MW * C1MH);
    {
      const ax = 226, ay = 14, bx = 30, by = -224, L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
      for (let jy = 0; jy < C1MH; jy++) for (let ix = 0; ix < C1MW; ix++) {
        const x = C1MX0 + ix * C1MC, y = C1MY0 + jy * C1MC, al = (x - ax) * ux + (y - ay) * uy, pp = -(x - ax) * uy + (y - ay) * ux;
        const wid = 21 + 9 * (vn(al, 0, 46, 1641) - 0.5);
        let I = Math.exp(-(pp / wid) * (pp / wid)) * (0.38 + 0.8 * fbm(x, y, 18, 3, 1651));
        const rc = 2 + 10 * (vn(al, 3, 34, 1661) - 0.5), rw = 3.2 + 2.6 * vn(al, 9, 22, 1671);
        I *= 1 - 0.8 * Math.exp(-((pp - rc) / rw) * ((pp - rc) / rw)) * sstep(12, 50, al);   // the dark rift of dust
        I *= sstep(-6, 34, al) * (1 - sstep(214, 248, x)) * sstep(14, -8, y) * (1 - sstep(-128, -176, y));
        C1MWI[jy * C1MW + ix] = clamp(I, 0, 1);
        C1MWH[jy * C1MW + ix] = fbm(x, y, 30, 2, 1681) > 0.56 ? 1 : 0;
      }
    }
    function c1MW(x, y) {
      const fx = (x - C1MX0) / C1MC, fy = (y - C1MY0) / C1MC;
      if (fx < 0 || fy < 0 || fx >= C1MW - 1 || fy >= C1MH - 1) return 0;
      const i = fl(fx), j = fl(fy), a = fx - i, b = fy - j, o = j * C1MW + i;
      return lerp(lerp(C1MWI[o], C1MWI[o + 1], a), lerp(C1MWI[o + C1MW], C1MWI[o + C1MW + 1], a), b);
    }
    const C1MWR = [-1, 136, 137, 138], C1MWV = [-1, 4, 5, 6];
    const C1AE = new Float32Array(W), C1AQ = new Float32Array(W), C1GX = new Float32Array(W);
    const C1AUG = [-1, 116, 124, 125, 48, 49], C1AUC = [-1, 116, 117, 137, 61, 147];   // (-1: the sky behind)
    function c1Sky(V, t) {
      const u = V.u;
      for (let X = c1X0; X <= c1X1; X++) {
        const x = (X + 0.5 - 240) / u;
        // the soft glow along the horizon: strongest far left (toward the sun, long set), faint on the right, none by the window
        C1GX[X] = 0.78 * sstep(-64, -180, x) * (1 - 0.35 * sstep(-220, -300, x)) + 0.36 * sstep(72, 200, x) * (1 - 0.3 * sstep(240, 300, x));
        const env = sstep(-282, -228, x) * (1 - sstep(-122, -56, x));
        if (env <= 0) { C1AQ[X] = 0; continue; }
        C1AE[X] = -44 - 0.21 * (x + 250) + 5 * Math.sin(x * 0.034 + zP(t, 1)) + 2.2 * Math.sin(x * 0.105 - zP(t, 2));
        const r = 0.5 + 0.5 * Math.sin(x * 0.2 + 2.1 * Math.sin(x * 0.041 + zP(t, 1)) + zP(t, 1)), r2 = 0.5 + 0.5 * Math.sin(x * 0.62 - 1.2 * Math.sin(x * 0.085 - zP(t, 2)) + zP(t, 3));
        C1AQ[X] = env * (0.5 + 0.32 * r + 0.18 * r2) * 0.62 * sstep(0.3, 0.75, u);   // (gone by the time L2's own aurora is in view)
      }
      const mx0 = C1MX0, mx1 = C1MX0 + (C1MW - 1) * C1MC;
      for (let Y = c1Y0; Y <= c1Y1; Y++) {
        const y = (Y + 0.5 - 135) / u, o = Y * W;
        if (y > 23) { for (let X = c1X0; X <= c1X1; X++) if (!c1Z[o + X]) BUF[o + X] = 139; continue; }   // (never: the ground is whole)
        const g = sstep(-26, -100, y), gy = y < 20 ? Math.exp(-(20 - y) / 13) : 1, af = 1 - sstep(-128, -168, y);
        const mwr = y >= C1MY0 && y < C1MY0 + (C1MH - 1) * C1MC;
        for (let X = c1X0; X <= c1X1; X++) {
          const i = o + X; if (c1Z[i]) continue;
          const b = bay(X, Y); let c = b < g ? 134 : 135;
          const G = C1GX[X] * gy;
          if (G > 0.02) { const k = fl(G * 3 + b); if (k > 0) c = k === 1 ? 136 : k === 2 ? 137 : 138; }
          const aq = C1AQ[X];
          if (aq > 0) {
            const d = C1AE[X] - y, p = d < 0 ? (d > -6 ? (1 + d / 6) * (1 + d / 6) : 0) : Math.exp(-d / 30) * Math.min(1, 0.45 + d * 0.12), A = p * aq * af;
            if (A > 0.04) { const R = bay(X + 4, Y + 2) < sstep(6, 40, d) ? C1AUC : C1AUG, k = fl(A * 5 + b); const cc = R[k > 5 ? 5 : k]; if (cc >= 0) c = cc; }
          }
          if (mwr) {
            const x = (X + 0.5 - 240) / u;
            if (x > mx0 && x < mx1) {
              const I = c1MW(x, y);
              if (I > 0.03) {
                const fx = fl((x - C1MX0) / C1MC), fy = fl((y - C1MY0) / C1MC), R = C1MWH[fy * C1MW + fx] ? C1MWV : C1MWR;
                const k = fl(I * 2.7 + bay(X + 5, Y + 3)), cc = R[k > 3 ? 3 : k]; if (cc >= 0) c = cc;
              }
            }
          }
          BUF[i] = c;
        }
      }
    }
    // stars at every scale: octaves of cells, each octave's stars fading in as their cells grow on screen, so the sky holds
    // about one star per 150 screen pixels at any zoom (L0's density) and never swims; the Milky Way holds more
    const C1BRIGHT = [[-205, -88, 1], [-148, -37, 0], [-62, -97, 2], [56, -71, 0], [151, -101, 1], [204, -27, 2], [-246, -150, 0], [121, -160, 2], [-21, -151, 1], [262, -122, 0], [-108, -131, 1], [-178, -60, 2], [88, -38, 1]];
    function c1Stars(V, t) {
      const u = V.u, xa = Math.max(-420, V.lx(c1X0)), xb = Math.min(420, V.lx(c1X1)), ya = Math.max(-420, V.ly(c1Y0)), yb = Math.min(V.ly(c1Y1), 22);
      if (yb < ya) return;
      for (let k = 0; k < 10; k++) {
        const cs = 1.875 * (1 << k), pc = cs * u; if (pc < 7) continue; if (cs > 1000) break;
        const fade = sstep(7, 14, pc), sd = 1700 + k * 17;
        const i0 = fl(xa / cs), i1 = fl(xb / cs), j0 = fl(ya / cs), j1 = fl(yb / cs);
        for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
          for (let m = 0; m < 3; m++) {
            const so = sd + m * 7, x = (ii + ih(ii, jj, so + 1)) * cs, y = (jj + ih(ii, jj, so + 2)) * cs;
            if (m === 0) { if (ih(ii, jj, so) > fade) continue; }
            else { const mw = c1MW(x, y); if (mw < 0.08 || ih(ii, jj, so) > fade * mw * 1.4) continue; }
            const X = fl(240 + x * u), Y = fl(135 + y * u); if (X < c1X0 || X > c1X1 || Y < c1Y0 || Y > c1Y1) continue;
            const i = Y * W + X; if (c1Z[i]) continue;
            const b = ih(ii, jj, so + 3) * (m ? 0.7 : 1), tw = 0.5 + 0.5 * Math.sin(zP(t, 1 + fl(ih(ii, jj, so + 4) * 4)) + 6.28 * ih(ii, jj, so + 5)), lv = b * b * (0.55 + 0.45 * tw), hue = ih(ii, jj, so + 6);
            let c = lv > 0.62 ? 22 : lv > 0.4 ? 21 : lv > 0.22 ? 20 : lv > 0.1 ? 19 : 138;
            if (lv > 0.22 && hue < 0.08) c = lv > 0.45 ? 16 : 15; else if (lv > 0.22 && hue > 0.9) c = lv > 0.45 ? 148 : 147;
            BUF[i] = c;
            if (lv > 0.62 && u >= 0.7) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = X + ox, yy = Y + oy; if (xx >= c1X0 && xx <= c1X1 && yy >= c1Y0 && yy <= c1Y1 && !c1Z[yy * W + xx]) BUF[yy * W + xx] = 19; }
          }
        }
      }
      // a few bright stars, with soft crosses of light
      for (const [x, y, hu] of C1BRIGHT) {
        const X = V.X(x), Y = V.Y(y); if (X < c1X0 || X > c1X1 || Y < c1Y0 || Y > c1Y1 || c1Z[fl(Y) * W + fl(X)]) continue;
        const tw = 0.5 + 0.5 * Math.sin(zP(t, 2 + (hu | 0)) + x);
        if (u < 0.3) { P(X, Y, 21); continue; }
        glow(X, Y, 5 + 3 * tw, hu === 1 ? T_GOLD : T_BL, 0.22);
        sparkle(X, Y, 1.6 + 2.2 * tw, 22, hu === 1 ? 15 : hu === 2 ? 147 : 20);
      }
    }

    /* ---------------------------------------------------------------- fireflies, at every depth */
    // ours: depth band j, x at nominal size, h height above the ground (band units), the loops they fly, their blinking
    const C1FF = [];
    for (let k = 0; k < 400 && C1FF.length < 96; k++) {
      const r = (n) => ih(k, n, 1801), g = r(1), j = g < 0.34 ? r(2) * 4.5 : g < 0.78 ? 4 + r(2) * 11 : 15 + r(2) * 15, s = c1Pow(j);
      const x = (r(3) - 0.5) * 2 * (290 + 4 * j), h = 0.6 + Math.pow(r(4), 1.6) * (j < 4.5 ? 26 : 9), ax = 0.4 + r(5) * 1.4, ay = 0.25 + r(6) * 0.8;
      const yb = c1Base(j, x), y = yb - h * s;
      if (y < -96 || y > 210) continue;
      if (Math.abs(x) < 46 + ax * s && y - ay * s < 27) continue;          // never in front of the window
      C1FF.push({ x, j, h, ax, ay, nx: 1 + fl(r(7) * 2), ny: 1 + fl(r(8) * 3), p1: r(9) * TAU, p2: r(10) * TAU, p3: r(11) * TAU, nb: 3 + fl(r(12) * 5), br: 0.6 + 0.4 * r(13) });
    }
    // and a few that keep company: by the mushrooms, by the brow's flowers, by the big clock
    for (const [x, j, h, ax, ay, nb] of [[127.5, 11.3, 2.9, 0.5, 0.3, 4], [-49, 0.6, 11, 1.2, 1.4, 5], [53, 0.5, 15, 1.4, 1.2, 3], [-96, 20.4, 2.6, 0.45, 0.25, 3], [-160, 19.3, 5.5, 0.9, 0.6, 4], [44, 0.4, 3.2, 0.5, 0.5, 6], [-46, 0.3, 4.5, 0.6, 0.4, 4]])
      C1FF.push({ x, j, h, ax, ay, nx: 1, ny: 2, p1: x, p2: j, p3: h, nb, br: 1 });
    // L0's own fireflies (in its units), flying here too so the window's edge cannot be seen
    const C1L0F = [];
    for (let k = 0; k < 16; k++) {
      const air = k < 5;
      C1L0F.push({ x: air ? [-196, -168, 204, 218, -222][k] : lerp(-226, 226, ih(k, 1, 591)), y: air ? [42, 96, 74, -12, -40][k] : lerp(132, 172, ih(k, 2, 591)),
        ax: 6 + 10 * ih(k, 3, 591), ay: 4 + 6 * ih(k, 4, 591), nx: 1 + fl(ih(k, 5, 591) * 2), ny: 2 + fl(ih(k, 6, 591) * 2), ph: ih(k, 7, 591) * TAU, nb: 3 + fl(ih(k, 8, 591) * 4) });
    }
    const C1CX = new Float32Array(160), C1CY = new Float32Array(160), C1CR = new Float32Array(160), C1CB = new Float32Array(160), C1CZ = new Uint8Array(160);
    function c1Flies(V, t) {
      const u = V.u; let n = 0;
      for (const F of C1FF) {
        const pulse = Math.sin(zP(t, F.nb) + F.p3); if (pulse <= 0.08) continue;
        const b = Math.pow(pulse, 1.5) * F.br, s = c1Pow(F.j);
        const x = F.x + F.ax * s * Math.sin(zP(t, F.nx) + F.p1), y = c1Base(F.j, x) - F.h * s + F.ay * s * Math.sin(zP(t, F.ny) + F.p2);
        const X = V.X(x), Y = V.Y(y), rl = Math.max(2.5, 1.15 * s * u);
        if (X < c1X0 - rl || X > c1X1 + rl || Y < c1Y0 - rl || Y > c1Y1 + rl) continue;
        c1Light(X, Y, rl, 0.62 * b);
        if (s * u > 2.2) glow(X, Y, 3 * s * u, T_GOLD, 0.2 * b);
        C1CX[n] = X; C1CY[n] = Y; C1CR[n] = 0.1 * s * u; C1CB[n] = b; C1CZ[n] = c1Zof(F.j); n++;
      }
      for (let k = 0; k < n; k++) {
        const X = C1CX[k], Y = C1CY[k], rc = C1CR[k], b = C1CB[k], z = C1CZ[k];
        if (rc < 0.8) { c1Dot(X, Y, 0.5, z, b > 0.55 ? 60 : b > 0.3 ? 59 : 58); continue; }
        c1Dot(X, Y, rc + 0.6, z, 58); c1Dot(X, Y, rc, z, 59); c1Dot(X - 0.25 * rc, Y - 0.25 * rc, rc * 0.55, z, 60);
        if (b > 0.6 && rc > 1.3) { const L = Math.round(rc * 1.6 + 2 * b); for (let q = 1; q <= L; q++) { const c = q < L * 0.5 ? 59 : 15; c1Dot(X + rc + q, Y, 0.5, z, c); c1Dot(X - rc - q, Y, 0.5, z, c); c1Dot(X, Y + rc + q, 0.5, z, c); c1Dot(X, Y - rc - q, 0.5, z, c); } }
      }
      if (u < 0.4) return;
      // L0's: the same lights, the same places (its units / 8)
      const u0 = u / 8;
      for (const f of C1L0F) {
        const x = f.x + f.ax * Math.sin(zP(t, f.nx) + f.ph), y = f.y + f.ay * Math.sin(zP(t, f.ny) + f.ph * 1.3), bb = 0.5 + 0.5 * Math.sin(zP(t, f.nb) + f.ph * 2.1), b = bb * bb;
        if (b <= 0.03) continue;
        const X = V.X(x / 8), Y = V.Y(y / 8);
        if (X < -24 || X > W + 24 || Y < c1R0 || Y > c1R1) continue;
        c1Light(X, Y, Math.max(2.5, 8 * u0), 0.6 * b);
        c1Dot(X, Y, 0.5, 254, b > 0.55 ? 60 : b > 0.3 ? 59 : 58);
      }
      // and L0's visitor, the firefly that comes to the snail's face (it starts just inside the window's edge)
      if (t > 1.1 && t < 3.6) {
        const p = (t - 1.1) / 2.5, x = lerp(238, 40, p) + 10 * Math.sin(p * 5.1), y = lerp(84, -30, p) + 8 * Math.sin(p * 9.4 + 0.6);
        const a = sstep(0, 0.13, p) * (1 - sstep(0.84, 1, p)), b = a * (0.72 + 0.28 * Math.sin(zP(t, 24)));
        if (b > 0.03) c1Light(V.X(x / 8), V.Y(y / 8), Math.max(2.5, 17 * u0), 0.95 * b);
      }
    }

    /* ---------------------------------------------------------------- the whole layer */
    function c1Draw(V, t) {
      const u = V.u, bx = V.box;
      c1X0 = bx[0]; c1X1 = bx[2]; c1Y0 = Math.max(bx[1], c1R0); c1Y1 = Math.min(bx[3], c1R1);
      if (c1X1 < c1X0 || c1Y1 < c1Y0) return;
      c1Z.fill(0, c1Y0 * W, (c1Y1 + 1) * W);
      // the window's full inside belongs to the snail (L0 always covers it while we are this big): leave it
      if (u >= 0.125) {
        const Xa = Math.max(c1X0, Math.ceil(240 - 29.95 * u - 0.5)), Xb = Math.min(c1X1, fl(240 + 29.95 * u - 0.5));
        const Ya = Math.max(c1Y0, Math.ceil(135 - 16.95 * u - 0.5)), Yb = Math.min(c1Y1, fl(135 + 16.95 * u - 0.5));
        if (Xb >= Xa) for (let Y = Ya; Y <= Yb; Y++) c1Z.fill(255, Y * W + Xa, Y * W + Xb + 1);
      }
      c1Props(V, t);
      c1Meadow(V, t);
      c1Trees(V);
      c1Sky(V, t);
      c1Stars(V, t);
      c1Seeds(V, t);
      c1Flies(V, t);
    }
    ZL[1] = { name: 'meadow', draw: c1Draw, zbuf: c1Z };
  }
