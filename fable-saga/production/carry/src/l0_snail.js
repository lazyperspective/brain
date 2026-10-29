  /* ================================================================ Carry · L0 — the snail (the face of the film)
     A close portrait at night. A small sea-glass snail sits in a night lotus and looks up at the sky. Its shell is the
     window: inside r < 64 about (-18, -8) the compositor shows the galaxy (L6), so here we paint everything around it — the
     amber horn of the shell's rim, ridged with growth lines and lit from inside by the galaxy; the snail's translucent body,
     its eyestalks and its face; the flower and its stem; the night sky with a soft aurora; the meadow far below and its
     fireflies. And the acting: a blink at 0.3 s, a shooting star at 0.6–1.3 s that the eyes follow, and a firefly that
     drifts past the face at 2 s and again at 13.5 s. Every motion comes round exactly once per 15 s loop (zP). */
  {
    // ---- geometry, in L0 units (one unit is one screen pixel at nominal size; the origin is the frame centre)
    const c0SX = -18, c0SY = -8;                                    // the shell's centre: the window is r < 64 around it
    const c0Mask = (x, y) => { const dx = x - c0SX, dy = y - c0SY, r = Math.sqrt(dx * dx + dy * dy); return r <= 63 ? 1 : r >= 65 ? 0 : (65 - r) * 0.5; };
    const c0ROW0 = LB, c0ROW1 = H - 1 - LB;                         // the rows the letterbox leaves (nothing else is ever seen)
    const C0AMB = [130, 131, 132, 133, 15, 16, 22];                  // amber horn, shadow to blaze
    const C0GRN = [124, 125, 126, 127, 128, 129];                    // sea glass
    const C0PIN = [134, 135, 136, 5, 6, 7, 8, 56, 57];               // a petal's inner face: deep blue at the heart to lilac
    const C0POU = [1, 134, 135, 136, 137, 138, 147];                 // a petal's outer face: cooler, bluer
    const C0LEAF = [139, 140, 141, 142, 143, 50];
    const C0AUG = [135, 116, 124, 125, 48, 49];                      // the aurora's lower, green fringe
    const C0AUC = [135, 116, 117, 137, 61, 147];                     // and its upper, cyan veil
    // an ordered-dither pick along a ramp: v in [0, n - 1]
    const c0Rp = (R, v, X, Y) => { const i = fl(v + bay(X, Y)); return R[i < 0 ? 0 : i >= R.length ? R.length - 1 : i]; };
    // the same with the dither held to a narrow seam between flat bands (dw < 1): crisper, more deliberate
    const c0Rq = (R, v, X, Y, dw) => { const i = fl(v + 0.5 + (bay(X, Y) - 0.5) * dw); return R[i < 0 ? 0 : i >= R.length ? R.length - 1 : i]; };
    // the screen columns [S0, S1] that fall inside the shell's window on the row at unit y (none: S0 > S1)
    const C0SK = [0, 0];
    function c0Skip(u, y, r) {
      const dy = y - c0SY, h2 = r * r - dy * dy;
      if (h2 <= 0) { C0SK[0] = 1e9; C0SK[1] = -1e9; return; }
      const h = Math.sqrt(h2); C0SK[0] = Math.ceil(240 + (c0SX - h) * u - 0.5); C0SK[1] = fl(240 + (c0SX + h) * u - 0.5);
    }
    // like V.each, but only over the rows the letterbox leaves, and skipping the inside of the shell (the galaxy goes there)
    function c0Each(V, x0, y0, x1, y1, fn) {
      const u = V.u, b = V.box;
      const X0 = Math.max(b[0], fl(V.X(x0))), X1 = Math.min(b[2], Math.ceil(V.X(x1)));
      const Y0 = Math.max(b[1], c0ROW0, fl(V.Y(y0))), Y1 = Math.min(b[3], c0ROW1, Math.ceil(V.Y(y1)));
      for (let Y = Y0; Y <= Y1; Y++) {
        const y = (Y + 0.5 - 135) / u; if (y < y0 || y > y1) continue;
        c0Skip(u, y, 62.4); const S0 = C0SK[0], S1 = C0SK[1], o = Y * W;
        for (let X = X0; X <= X1; X++) {
          if (X >= S0 && X <= S1) { X = S1; continue; }
          const x = (X + 0.5 - 240) / u; if (x < x0 || x > x1) continue;
          const c = fn(x, y, X, Y); if (c >= 0) BUF[o + X] = c;
        }
      }
    }
    // the same over a ring about the shell's centre (r0 < r < r1)
    function c0Ann(V, r0, r1, fn) {
      const u = V.u, b = V.box, Y0 = Math.max(b[1], c0ROW0, fl(V.Y(c0SY - r1))), Y1 = Math.min(b[3], c0ROW1, Math.ceil(V.Y(c0SY + r1)));
      for (let Y = Y0; Y <= Y1; Y++) {
        const y = (Y + 0.5 - 135) / u;
        c0Skip(u, y, r1); if (C0SK[0] > C0SK[1]) continue;
        const A0 = Math.max(b[0], C0SK[0]), A1 = Math.min(b[2], C0SK[1]);
        c0Skip(u, y, r0); const S0 = C0SK[0], S1 = C0SK[1], o = Y * W;
        for (let X = A0; X <= A1; X++) {
          if (X >= S0 && X <= S1) { X = S1; continue; }
          const c = fn((X + 0.5 - 240) / u, y, X, Y); if (c >= 0) BUF[o + X] = c;
        }
      }
    }

    /* ---------------------------------------------------------------- the acting: everything that moves, per frame */
    const C0S0 = [-238, -104], C0S1 = [104, -88];                    // the shooting star's path (top left to the right)
    const C0EA = [148, -72], C0EB = [176, -56];                      // the eyes, at rest
    const c0F = { EA: {}, EB: {} };
    // the firefly that comes to visit the face (twice a loop): [x, y, brightness], or null
    function c0Visitor(t) {
      let p, x, y;
      if (t > 1.1 && t < 3.6) { p = (t - 1.1) / 2.5; x = lerp(238, 40, p) + 10 * Math.sin(p * 5.1); y = lerp(84, -30, p) + 8 * Math.sin(p * 9.4 + 0.6); }
      else if (t > 12.35 && t < 14.75) { p = (t - 12.35) / 2.4; x = lerp(212, 92, p) + 8 * Math.sin(p * 6.3 + 1); y = lerp(100, -36, p) + 7 * Math.sin(p * 8.8); }
      else return null;
      return [x, y, sstep(0, 0.13, p) * (1 - sstep(0.84, 1, p))];
    }
    function c0Meteor(t) {
      const p = (t - 0.6) / 0.7; if (p <= 0 || p >= 1) return null;
      const e = 1 - Math.pow(1 - p, 1.3);
      return [lerp(C0S0[0], C0S1[0], e), lerp(C0S0[1], C0S1[1], e), Math.pow(Math.sin(PI * p), 0.6), p];
    }
    const c0Nrm = (x, y) => { const l = Math.sqrt(x * x + y * y) || 1; return [x / l, y / l]; };

    /* the body is a smooth union of tapered capsules (a signed distance field), kept per frame in C0PR, C0ST numbers each:
       ax ay bx by ra rb k(smooth join) part | bbox x0 y0 x1 y1 | u0 u1 (how far along an eyestalk).
       parts: 0 foot, 1 neck and chest, 2 head, 3 lower tentacle, 4 eyestalk, 5 eye A, 6 eye B */
    const C0ST = 18, C0PR = new Float64Array(40 * C0ST), C0BB = [0, 0, 0, 0], C0ACT = new Int32Array(40);
    let c0Np = 0, c0Sid = 0, c0Srl = 1, c0Sal = 0, c0Gx = 0, c0Gy = 0;
    function c0Prim(ax, ay, bx, by, ra, rb, k, id, u0, u1) {
      const m = c0F.mr; ra = Math.max(ra, m); rb = Math.max(rb, m);
      const o = c0Np++ * C0ST, R = Math.max(ra, rb) + k + 6.5;      // (the margin lets c0Snail skip ahead safely)
      C0PR[o] = ax; C0PR[o + 1] = ay; C0PR[o + 2] = bx; C0PR[o + 3] = by; C0PR[o + 4] = ra; C0PR[o + 5] = rb; C0PR[o + 6] = k; C0PR[o + 7] = id;
      C0PR[o + 8] = Math.min(ax, bx) - R; C0PR[o + 9] = Math.min(ay, by) - R; C0PR[o + 10] = Math.max(ax, bx) + R; C0PR[o + 11] = Math.max(ay, by) + R;
      C0PR[o + 12] = u0 || 0; C0PR[o + 13] = u1 || 0;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; C0PR[o + 14] = dx; C0PR[o + 15] = dy; C0PR[o + 16] = L2 > 0 ? 1 / L2 : 0; C0PR[o + 17] = rb - ra;
      C0BB[0] = Math.min(C0BB[0], C0PR[o + 8]); C0BB[1] = Math.min(C0BB[1], C0PR[o + 9]); C0BB[2] = Math.max(C0BB[2], C0PR[o + 10]); C0BB[3] = Math.max(C0BB[3], C0PR[o + 11]);
    }
    // the field at (x, y) over the na primitives active on this row; also its gradient (c0Gx, c0Gy: exact for this smooth
    // union, whose gradient is the same blend of the parts' gradients), and the nearest part, its radius, how far along it
    const C0AX0 = new Float64Array(40), C0AX1 = new Float64Array(40);   // each active primitive's span on the current row
    function c0Field(x, y, na) {
      let s = 1e9, gx = 0, gy = 0, best = 1e9, id = -1, rl = 1, al = 0;
      const P = C0PR;
      for (let a = 0; a < na; a++) {
        if (x < C0AX0[a] || x > C0AX1[a]) continue;
        const o = C0ACT[a], bx = P[o + 14], by = P[o + 15], px = x - P[o], py = y - P[o + 1];
        let h = (px * bx + py * by) * P[o + 16]; h = h < 0 ? 0 : h > 1 ? 1 : h;
        const dx = px - bx * h, dy = py - by * h, dl = Math.sqrt(dx * dx + dy * dy) + 1e-9, r = P[o + 4] + P[o + 17] * h, d = dl - r, idl = 1 / dl, ex = dx * idl, ey = dy * idl;
        if (d < best) { best = d; id = P[o + 7]; al = P[o + 12] + (P[o + 13] - P[o + 12]) * h; }
        if (s > 1e8) { s = d; gx = ex; gy = ey; rl = r; }
        else { const k = P[o + 6], g = 0.5 + 0.5 * (d - s) / k, q = g < 0 ? 0 : g > 1 ? 1 : g; s = d + (s - d) * q - k * q * (1 - q); gx = ex + (gx - ex) * q; gy = ey + (gy - ey) * q; rl = r + (rl - r) * q; }
      }
      if (y - 67.6 > s) { s = y - 67.6; gx = 0; gy = 1; }           // the sole rests flat on the flower
      c0Sid = id; c0Srl = rl; c0Sal = al; c0Gx = gx; c0Gy = gy;
      return s;
    }
    // a point on the quadratic curve a → b (control c) at u
    const c0Bz = (a, c, b, u) => [(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1]];

    function c0Frame(V, t) {
      const F = c0F, u = V.u;
      F.u = u; F.mr = 0.6 / u;
      F.ol = u >= 0.3 ? Math.max(0.8, 1 / u) : 0;                  // the ink line, in units (none when tiny)
      F.olf = clamp((u - 0.3) / 0.12, 0, 1);                        // ...dissolving out as it shrinks, so it never pops
      F.lod = u >= 1.15 ? 2 : u >= 0.55 ? 1 : 0;
      F.tex = sstep(0.85, 1.45, u);                                  // how much fine texture (it fades in as we come close)
      F.fk = 255 * sstep(0.95, 1.6, u);
      const br = Math.sin(zP(t, 4)); F.br = br;                    // breathing: four breaths a loop
      const hy = -0.8 * br, hr = 0.4 * br; F.hy = hy;
      // the blink (0.3 s)
      F.lid = t < 0.2 ? 0 : t < 0.29 ? sstep(0.2, 0.29, t) : t < 0.34 ? 1 : 1 - sstep(0.34, 0.47, t);
      // what the eyes are watching: the sky, the shooting star, the firefly
      const M = c0Meteor(t), Vf = c0Visitor(t); F.M = M; F.Vf = Vf;
      const wS = sstep(0.55, 0.8, t) * (1 - sstep(1.35, 1.95, t));
      const wF = Vf ? (t < 6 ? sstep(1.65, 2.05, t) * (1 - sstep(3.0, 3.5, t)) : sstep(12.75, 13.15, t) * (1 - sstep(14.15, 14.65, t))) : 0;
      const sp = M ? [M[0], M[1]] : t < 1 ? C0S0 : C0S1;
      F.wS = wS; F.wF = wF;
      F.mouth = t > 0.78 && t < 1.72 ? 1 : 0;                       // a small "oh" at the shooting star
      F.blush = 0.42 + 0.3 * wF;
      c0Np = 0; C0BB[0] = 1e9; C0BB[1] = 1e9; C0BB[2] = -1e9; C0BB[3] = -1e9;
      // the foot (a round tail to the front), the neck out of the shell's mouth, the chest rising into the round head
      c0Prim(-95, 61.4, -46, 59.8, 6.4, 9, 3, 0);
      c0Prim(-46, 59.8, 40, 58.4, 9, 10.2, 1, 0);
      c0Prim(40, 58.4, 124, 58.4, 10.2, 9.6, 1, 0);
      c0Prim(26, 45, 92, 36 + hy * 0.4, 12, 16.5, 8, 1);
      c0Prim(113, 56, 119, 38 + hy * 0.7, 16.5, 20 + hr, 8, 1);
      c0Prim(122, 31 + hy, 122, 31 + hy, 23.5 + hr, 23.5 + hr, 8, 2);
      // the lower tentacles, small, under the smile
      c0Prim(137, 50 + hy * 0.6, 145, 56.5 + 0.7 * Math.sin(zP(t, 3) + 1), 3.4, 2.8, 2.6, 3);
      c0Prim(141.5, 46.5 + hy * 0.6, 149.5, 51.5 + 0.6 * Math.sin(zP(t, 3) + 2.4), 2.9, 2.4, 2.4, 3);
      // the eyestalks: a gentle sway, and a lean toward whatever they're watching
      const stalk = (E, base, ctrl, sw1, sw2, ph, idE, EA) => {
        let gx = -0.45, gy = -0.89;
        const tx = E[0] + sw1 * Math.sin(zP(t, 2) + ph), ty = E[1] + sw2 * Math.sin(zP(t, 3) + ph * 1.7);
        if (wS > 0) { const [dx, dy] = c0Nrm(sp[0] - tx, sp[1] - ty); gx += (dx - gx) * wS; gy += (dy - gy) * wS; }
        if (wF > 0) { const [dx, dy] = c0Nrm(Vf[0] - tx, Vf[1] - ty); gx += (dx - gx) * wF; gy += (dy - gy) * wF; }
        const [nx, ny] = c0Nrm(gx, gy), lean = 5.5 * Math.max(wS, wF);
        const tip = [tx + nx * lean, ty + ny * lean + 0.6 * hy], b = [base[0], base[1] + hy], c = [ctrl[0] + nx * lean * 0.5, ctrl[1] + ny * lean * 0.5 + hy * 0.8];
        const N = 7;
        let p0 = b;
        for (let k = 1; k <= N; k++) {
          const p1 = c0Bz(b, c, tip, k / N * 0.88);
          c0Prim(p0[0], p0[1], p1[0], p1[1], lerp(5.7, 3.8, (k - 1) / N), lerp(5.7, 3.8, k / N), k === 1 ? 5 : 0.4, 4, (k - 1) / N, k / N);
          p0 = p1;
        }
        const rb = 10.6 + 0.5 * wS;
        c0Prim(tip[0], tip[1], tip[0], tip[1], rb, rb, 2.4, idE);
        EA.x = tip[0]; EA.y = tip[1]; EA.rb = Math.max(rb, F.mr); EA.re = 7.1 + 0.5 * wS;
        EA.ex = tip[0] + nx * 2.6; EA.ey = tip[1] + ny * 2.6;
      };
      stalk(C0EA, [112, 14], [118, -32], 2.4, 1.3, 0, 5, F.EA);
      stalk(C0EB, [130, 15], [152, -24], 2.1, 1.2, 1.1, 6, F.EB);
    }

    /* ---------------------------------------------------------------- the sky, the meadow, the stem */
    const C0AE = new Float32Array(W), C0AQ = new Float32Array(W), C0MF = new Float32Array(W), C0MS = new Float32Array(W);
    const C0GN = 400, C0GX = new Float32Array(C0GN), C0GH = new Float32Array(C0GN), C0GL = new Float32Array(C0GN), C0GC = new Uint8Array(C0GN), C0GT = new Uint8Array(C0GN);
    let c0Gj0 = 0;
    function c0Sky(V, t) {
      const u = V.u, b = V.box, X0 = b[0], X1 = b[2], Y0 = Math.max(b[1], c0ROW0), Y1 = Math.min(b[3], c0ROW1);
      // the night
      for (let Y = Y0; Y <= Y1; Y++) BUF.fill(135, Y * W + X0, Y * W + X1 + 1);
      // the aurora, column by column: where its lower hem hangs (C0AE) and how bright its rays are there (C0AQ)
      for (let X = X0; X <= X1; X++) {
        const x = (X + 0.5 - 240) / u, env = sstep(-236, -184, x) * (1 - sstep(-110, -30, x));   // (nothing of it reaches the seam)
        if (env <= 0) continue;
        const hem = -58 - 0.24 * (x + 220) + 6 * Math.sin(x * 0.021 + zP(t, 1)) + 2.5 * Math.sin(x * 0.067 - zP(t, 2));
        const r = 0.5 + 0.5 * Math.sin(x * 0.09 + 2.2 * Math.sin(x * 0.023 + zP(t, 1)) + zP(t, 1)), r2 = 0.5 + 0.5 * Math.sin(x * 0.31 - 1.3 * Math.sin(x * 0.05 - zP(t, 2)) + zP(t, 3));
        const aq = env * (0.42 + 0.38 * r + 0.2 * r2) * (0.78 + 0.22 * Math.sin(x * 0.7 + 3 * Math.sin(x * 0.05 + zP(t, 1)))) * 0.82;
        const Ye = Math.min(Y1, fl(V.Y(hem + 6)));
        for (let Y = Math.max(Y0, fl(V.Y(-150))); Y <= Ye; Y++) {
          const y = (Y + 0.5 - 135) / u, d = hem - y;
          const p = d < 0 ? (1 + d / 6) * (1 + d / 6) : Math.exp(-d / 30) * Math.min(1, 0.5 + d * 0.22), A = p * aq * sstep(-136, -98, y);
          if (A > 0.04) BUF[Y * W + X] = c0Rp(bay(X + 4, Y + 2) < sstep(6, 40, d) ? C0AUC : C0AUG, A * 5, X, Y);
        }
      }
      // the shell's glow on the sky around it
      c0Ann(V, 62.4, 90, (x, y, X, Y) => {
        if (BUF[Y * W + X] !== 135) return -1;
        const dx = x - c0SX, dy = y - c0SY, f = (90 - Math.sqrt(dx * dx + dy * dy)) / 20;
        return bay(X, Y) < 0.3 * f * f ? 136 : -1;
      });
      // the stem, straight down from the flower
      const sh = Math.max(0.5 / u, 3.5);
      c0Each(V, 24 - sh, 88, 24 + sh, 420, (x, y) => {
        const q = (x - 24) / sh, dk = y > 156 ? 1 : 0;
        return q < -0.68 ? 140 : q < -0.2 ? 143 - dk : q < 0.36 ? 142 - dk : q < 0.7 ? 141 - dk : 140;
      });
      // the meadow: per column its ragged top and the wind's lean; per blade its foot, height and curl
      if (V.Y(118) > Y1) return;
      for (let X = X0; X <= X1; X++) { const x = (X + 0.5 - 240) / u; C0MF[X] = 153 + 1.7 * Math.sin(x * 0.081 + 1.3) + 1.2 * Math.sin(x * 0.23 + 0.4); C0MS[X] = 0.10 * Math.sin(zP(t, 2) + x * 0.029) + 0.05 * Math.sin(zP(t, 3) - x * 0.07); }
      c0Gj0 = fl(Math.max(-420, V.lx(X0)) / 2.3) - 4;
      const jn = Math.min(C0GN, fl(Math.min(420, V.lx(X1)) / 2.3) + 4 - c0Gj0 + 1);
      for (let i = 0; i < jn; i++) {
        const j = c0Gj0 + i, r1 = ih(j, 1, 563), r2 = ih(j, 2, 563), r3 = ih(j, 3, 563);
        C0GH[i] = 2.5 + r1 * r1 * 15 + (r1 > 0.94 ? 15 : 0); C0GX[i] = (j + 0.5 + (r2 - 0.5) * 0.8) * 2.3; C0GL[i] = (r3 - 0.5) * 6;
        C0GC[i] = r2 < 0.45 ? 140 : 139; C0GT[i] = r3 > 0.72 && u > 0.3 ? 1 : 0;
      }
      const mw = 0.55 / u;
      c0Each(V, -420, 118, 420, 420, (x, y, X, Y) => {
        const hg = C0MF[X] - y;
        if (hg > 34) return -1;
        if (hg <= 0) {                                              // the meadow's depths: grass in shadow, streaked
          const k = ih(fl(x / 1.7), fl((y + 3 * Math.sin(x * 0.7)) / 4.5), 561), v = 1.55 + hg / 30 + (k - 0.5) * 1.3;
          return v > 1.8 ? 140 : v > 0.5 ? 139 : 23;
        }
        const xs = x - C0MS[X] * hg, k = fl(xs / 2.3) - c0Gj0;      // blades, leaning and swaying
        for (let i = Math.max(0, k - 2); i <= Math.min(jn - 1, k + 2); i++) {
          const hb = C0GH[i]; if (hg >= hb) continue;
          const f = hg / hb, bx = C0GX[i] + C0GL[i] * f * f, wb = Math.max(1.2 * (1 - f) + 0.2, mw);
          if (Math.abs(xs - bx) < wb) return f > 0.66 && C0GT[i] ? 141 : C0GC[i];
        }
        return -1;
      });
    }
    // flower silhouettes standing out of the grass: bellflowers, dandelion clocks, a bud
    const C0WEED = [[-188, 33, 0], [-136, 24, 1], [-96, 15, 2], [-46, 19, 0], [88, 27, 0], [124, 17, 2], [156, 37, 1], [204, 21, 0]];
    function c0Weeds(V, t) {
      const u = V.u; if (V.Y(110) > c0ROW1) return;
      const mw = Math.max(0.7, 0.55 / u);
      for (let k = 0; k < C0WEED.length; k++) {
        const [bx, h, kind] = C0WEED[k], top = 154 - h, sw = 1.6 * Math.sin(zP(t, 1) + k * 1.7) + 0.6 * Math.sin(zP(t, 3) + k), tx = bx + sw + (kind === 0 ? 3 : 0);
        const hr = kind === 1 ? 4.6 : kind === 0 ? 3.4 : 2.2;
        c0Each(V, Math.min(bx, tx) - hr - 1, top - hr - 1, Math.max(bx, tx) + hr + 1, 158, (x, y, X, Y) => {
          // the stem (curving over at the top for a bell)
          const q = clamp((156 - y) / (156 - top), 0, 1), sx = bx + (tx - bx) * q * q;
          if (y > top && Math.abs(x - sx) < mw) return 140;
          const dx = x - tx, dy = y - top;
          if (kind === 1) { const d2 = dx * dx + dy * dy; if (d2 < hr * hr) { if (d2 < 1.2) return 140; return bay(X, Y) < 0.34 * (1 - d2 / (hr * hr)) + 0.06 ? (d2 > hr * hr * 0.6 ? 19 : 138) : -1; } return -1; }
          if (kind === 0) { const ey = dy - 2.2; if (ey > -2.6 && ey < 2.8 && Math.abs(dx) < 2.2 + 0.5 * ey) return ey > 2 && c0Ev(x) ? 141 : 139; return -1; }
          const e2 = dx * dx / 2.2 + dy * dy / 9; return e2 < 1 ? (dx < -0.6 ? 141 : 139) : -1;
        });
      }
    }
    const c0Ev = (x) => (fl(x) & 1) === 0;
    function c0Stars(V, t) {
      const u = V.u, cs = 15, keep = u >= 1 ? 1 : u * u * 1.15, hx = 240 / u + cs, hy = 135 / u + cs;
      const i0 = Math.max(-28, fl(-hx / cs)), i1 = Math.min(28, Math.ceil(hx / cs)), j0 = Math.max(-28, fl(-hy / cs)), j1 = Math.min(10, Math.ceil(hy / cs));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (ih(i, j, 571) > keep) continue;
        const x = (i + ih(i, j, 572)) * cs, y = (j + ih(i, j, 573)) * cs;
        if (y > 136 || y < -420 || x < -420 || x > 420) continue;
        const dx = x - c0SX, dy = y - c0SY; if (dx * dx + dy * dy < 4900) continue;
        const X = fl(V.X(x)), Y = fl(V.Y(y)); if (X < 0 || X >= W || Y < c0ROW0 || Y > c0ROW1) continue;
        const b = ih(i, j, 574), tw = 0.5 + 0.5 * Math.sin(zP(t, 1 + fl(ih(i, j, 575) * 4)) + 6.28 * ih(i, j, 576)), lv = b * b * (0.55 + 0.45 * tw);
        P(X, Y, lv > 0.62 ? 22 : lv > 0.4 ? 21 : lv > 0.22 ? 20 : lv > 0.1 ? 19 : 138);
        if (lv > 0.62 && ih(i, j, 577) < sstep(0.5, 0.95, u)) { P(X - 1, Y, 19); P(X + 1, Y, 19); P(X, Y - 1, 19); P(X, Y + 1, 19); }
      }
    }
    function c0Shoot(V, M) {
      if (!M) return;
      const [hx, hy, b, p] = M, u = V.u, dx = C0S1[0] - C0S0[0], dy = C0S1[1] - C0S0[1], dl = Math.hypot(dx, dy), ux = dx / dl, uy = dy / dl;
      const Lt = 88 * b * Math.min(1, p * 4), n = Math.ceil(V.S(Lt) * 1.6);
      for (let k = n; k >= 0; k--) {
        const f = k / Math.max(1, n), X = fl(V.X(hx - ux * Lt * f)), Y = fl(V.Y(hy - uy * Lt * f)), lv = (1 - f) * b;
        if (Y < c0ROW0 || Y > c0ROW1 || bay(X, Y) > lv * 1.5 + 0.04) continue;
        P(X, Y, lv > 0.8 ? 22 : lv > 0.6 ? 21 : lv > 0.4 ? 20 : lv > 0.22 ? 147 : 138);
        if (u >= 0.8 && lv > 0.7) P(X, Y - 1, 147);
      }
      const X = V.X(hx), Y = V.Y(hy);
      glow(X, Y, Math.max(4, 11 * u), T_WH, 0.55 * b);
      if (b > 0.3) sparkle(X, Y, Math.max(1, 2.4 * u * b), 22, 147);
    }

    /* ---------------------------------------------------------------- the flower: a night lotus */
    // a petal's half-width along it (q: 0 at the base, 1 at the tip): round at the foot, broad, coming to a point
    const C0PF = new Float32Array(258);
    { let m = 0; for (let i = 0; i <= 256; i++) { const q = i / 256; C0PF[i] = Math.sqrt(q) * Math.pow(1 - q, 0.7); m = Math.max(m, C0PF[i]); } for (let i = 0; i <= 256; i++) C0PF[i] /= m; C0PF[257] = 0; }
    // petals: foot (bx, by), tip (tx, ty), half-width, bow, face (1 inner/lit, 0 outer), tone at the foot, gain to the tip, row
    const c0Pt = (bx, by, tx, ty, w, bend, inn, t0, tg, ph, row) => ({ bx, by, tx, ty, w, bend, inn, t0, tg, ph, row });
    const C0PETS = [
      // the back row: a crown of points rising behind the snail (past the tail, beside the shell, over the neck, past the face)
      c0Pt(6, 106, -116, 40, 17, 0.12, 1, 0.3, 2.9, 0.2, 0), c0Pt(12, 104, -94, 24, 16, 0.08, 1, 0.2, 2.8, 1.1, 0),
      c0Pt(40, 106, 172, 38, 17, -0.12, 1, 0.3, 2.9, 2.6, 0),
      // the great side petals that make the cup
      c0Pt(10, 110, -126, 64, 20, 0.14, 1, 0.6, 3.6, 2.9, 1), c0Pt(38, 110, 170, 64, 20, -0.14, 1, 0.6, 3.6, 3.7, 1),
      c0Pt(14, 110, -96, 58, 21, 0.08, 1, 0.5, 3.4, 4.4, 1), c0Pt(34, 110, 142, 58, 21, -0.08, 1, 0.5, 3.4, 5.2, 1),
      // the cup's inner petals, under the snail (they fill the flower's heart)
      c0Pt(18, 110, -46, 63, 22, 0.05, 1, 0.4, 3.0, 0.9, 1), c0Pt(30, 110, 98, 63, 22, -0.05, 1, 0.4, 3.0, 1.9, 1), c0Pt(24, 110, 26, 61, 24, 0, 1, 0.4, 3.0, 2.8, 1),
      // the outermost, lowest petals, opening out and down (we see their outer faces)
      c0Pt(16, 113, -70, 112, 9, -0.2, 0, 0.6, 2.8, 5.9, 2), c0Pt(32, 113, 118, 112, 9, 0.2, 0, 0.6, 2.8, 0.6, 2),
      // the front row, in front of the snail's foot (their points just over the sole)
      c0Pt(16, 114, -68, 63, 19, 0.07, 1, 1.1, 4.3, 1.6, 3), c0Pt(32, 114, 108, 63, 19, -0.07, 1, 1.1, 4.3, 4.0, 3),
      c0Pt(22, 115, -12, 61, 18, 0.03, 1, 1.3, 4.4, 2.4, 3), c0Pt(28, 115, 54, 61, 18, -0.03, 1, 1.3, 4.4, 3.1, 3),
    ];
    const C0LEAVES = [{ a: -0.33, L: 40, w: 5.5, bend: -0.1, bx: 26.5, by: 131, ph: 0.4 }, { a: -2.86, L: 34, w: 4.6, bend: 0.1, bx: 21.5, by: 145, ph: 2.1 }];
    function c0Petal(V, P, t) {
      const u = V.u, tx = P.tx + 1.3 * Math.sin(zP(t, 1) + P.ph), ty = P.ty + 0.9 * Math.sin(zP(t, 2) + P.ph * 1.3);
      const dx0 = tx - P.bx, dy0 = ty - P.by, L = Math.hypot(dx0, dy0), ca = dx0 / L, sa = dy0 / L, nx = -sa, ny = ca, w = P.w, bw = P.bend * L;
      const ol = u >= 0.3 ? Math.max(0.8, 1 / u) : 0, olf = clamp((u - 0.3) / 0.12, 0, 1), mw = 0.55 / u, lv = sstep(0.55, 0.95, u), R = P.inn ? C0PIN : C0POU, rim = P.inn ? 57 : 138, shade = P.row < 3;
      // its bounds: the bowed axis, widened by the half-width
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k <= 6; k++) { const q = k / 6, o = bw * (q * q - q), cx = P.bx + ca * L * q + nx * o, cy = P.by + sa * L * q + ny * o, ww = w * C0PF[fl(q * 256)] + 1; x0 = Math.min(x0, cx - ww); x1 = Math.max(x1, cx + ww); y0 = Math.min(y0, cy - ww); y1 = Math.max(y1, cy + ww); }
      c0Each(V, x0, y0, x1, y1, (x, y, X, Y) => {
        const px = x - P.bx, py = y - P.by, s = px * ca + py * sa; if (s <= 0 || s >= L) return -1;
        const q = s / L, v = px * nx + py * ny - bw * (q * q - q), f = Math.max(w * C0PF[fl(q * 256)], mw), av = Math.abs(v);
        if (av >= f) return -1;
        const ed = (f - av) * (1 - 0.4 * q * q);                     // how far in from the edge, roughly
        if (ed < ol && (olf >= 1 || bay(X, Y) < olf)) return q > 0.14 ? rim : R[1];   // the pale rim (it glows a little)
        const sc = v / f, gdx = x - c0SX, gdy = y - c0SY, ig = clamp(1 - (Math.sqrt(gdx * gdx + gdy * gdy) - 64) / 80, 0, 1);
        let tv = P.t0 + P.tg * q + 0.6 * (1 - sc * sc) + 1.5 * ig * ig;
        if (lv > 0 && q > 0.06 && q < 0.93) { const vs = sc * 3.5 + 3.5, fv = vs - fl(vs); if (fv < 0.12 || fv > 0.88) tv += (P.inn ? 0.75 : 0.5) * lv; }   // veins, fanning to the tip
        if (ed < ol + 1.8 && q > 0.2) tv += 1.0;                    // the rim's inner glow
        if (q > 0.86) tv += 0.6;
        if (shade && y > 62 && y < 86 && x > -100 && x < 140) tv -= 1.3 * (1 - (y - 62) / 24);   // the snail's shadow
        return c0Rq(R, tv, X, Y, 0.7);
      });
    }
    // the lotus's golden heart: stamens standing round the snail's sole, glinting between the front petals
    function c0Stamens(V, t) {
      const u = V.u; if (u < 0.5) return;
      for (let k = 0; k < 30; k++) {
        const x = -60 + k * 6.2 + 3 * ih(k, 1, 631), top = 65.5 + 4 * ih(k, 2, 631), lean = (ih(k, 3, 631) - 0.5) * 4 + 0.8 * Math.sin(zP(t, 2) + k);
        const X0 = V.X(x + lean * 0.6), Yb = V.Y(top + 3.2), Yt = V.Y(top), Xt = V.X(x + lean);
        if (Yt > c0ROW1) continue;
        if (u >= 0.8) lineP(X0, Yb, Xt, Yt, 131);
        const tw = 0.5 + 0.5 * Math.sin(zP(t, 1 + (k % 3)) + k * 2.1), c = tw > 0.75 ? 16 : tw > 0.35 ? 15 : 58;
        if (u >= 1.3) { discF(Xt, Yt, 0.9 * u, 58); discF(Xt - 0.2 * u, Yt - 0.2 * u, 0.55 * u, c); } else { P(Xt, Yt, c); if (u >= 0.9) P(Xt + 1, Yt, 58); }
      }
    }
    // dew on a front petal: a bead of light that twinkles now and then
    function c0Dew(V, Pt, t, k) {
      const u = V.u; if (u < 0.45) return;
      const tx = Pt.tx + 1.3 * Math.sin(zP(t, 1) + Pt.ph), ty = Pt.ty + 0.9 * Math.sin(zP(t, 2) + Pt.ph * 1.3);
      const dx0 = tx - Pt.bx, dy0 = ty - Pt.by, L = Math.hypot(dx0, dy0), ca = dx0 / L, sa = dy0 / L, bw = Pt.bend * L;
      for (let j = 0; j < 2; j++) {
        const q = 0.5 + 0.22 * ih(k, j, 611), sc = (ih(k, j, 612) - 0.5) * 0.9, sv = sc * Pt.w * C0PF[fl(q * 256)] + bw * (q * q - q);
        const x = Pt.bx + ca * L * q - sa * sv, y = Pt.by + sa * L * q + ca * sv, X = V.X(x), Y = V.Y(y);
        if (Y < c0ROW0 || Y > c0ROW1) continue;
        const tw = Math.max(0, Math.sin(zP(t, 2 + fl(ih(k, j, 613) * 3)) + ih(k, j, 614) * 6.28));
        if (u >= 1.1) { discF(X, Y, 0.9 * u, 147); discF(X - 0.2 * u, Y + 0.15 * u, 0.55 * u, 138); }
        P(X - (u >= 1.1 ? 0.35 * u : 0), Y - (u >= 1.1 ? 0.35 * u : 0), tw > 0.5 || u >= 1.1 ? 22 : 148);
        if (tw > 0.85) sparkle(X - 0.3 * u, Y - 0.3 * u, Math.max(1, 1.6 * u * (tw - 0.85) / 0.15), 22, 148);
      }
    }
    // pollen: golden motes lifting off the flower and drifting up, each on its own cycle (whole turns of the loop)
    function c0Pollen(V, t) {
      const u = V.u; if (u < 0.3) return;
      for (let k = 0; k < 11; k++) {
        const n = 1 + (k % 3 === 0 ? 1 : 0), ph = frac(t * n / ZD + ih(k, 1, 621)), b = Math.sin(PI * ph);
        const x = -70 + 190 * ih(k, 2, 621) + 9 * Math.sin(ph * 7 + k) + 14 * ph * (ih(k, 3, 621) - 0.5), y = 70 - 95 * ph;
        const dx = x - c0SX, dy = y - c0SY; if (dx * dx + dy * dy < 4900 || b < 0.15) continue;
        const X = V.X(x), Y = V.Y(y); if (Y < c0ROW0 || Y > c0ROW1) continue;
        P(X, Y, b > 0.7 ? 59 : b > 0.4 ? 15 : 131);
      }
    }
    function c0Leaf(V, P, t) {
      const u = V.u, a = P.a + 0.05 * Math.sin(zP(t, 1) + P.ph), ca = Math.cos(a), sa = Math.sin(a), L = P.L, w = P.w, bend = P.bend;
      const nx = -sa, ny = ca, ol = u >= 0.42 ? Math.max(0.8, 1 / u) : 0, mw = 0.55 / u;
      const tx = P.bx + ca * L + nx * bend * L, ty = P.by + sa * L + ny * bend * L;
      c0Each(V, Math.min(P.bx, tx) - w - 1, Math.min(P.by, ty) - w - 1, Math.max(P.bx, tx) + w + 1, Math.max(P.by, ty) + w + 1, (x, y, X, Y) => {
        const px = x - P.bx, py = y - P.by, s = px * ca + py * sa; if (s <= 0 || s >= L) return -1;
        const q = s / L, v = px * nx + py * ny - bend * s * q, wf = Math.max(w * 2.6 * Math.sqrt(q) * (1 - q), mw), av = Math.abs(v);
        if (av >= wf) return -1;
        if ((wf - av) * (1 - 0.35 * q) < ol) return 140;
        if (av < Math.max(0.45, 0.5 / u) && q < 0.9) return 141;
        return c0Rp(C0LEAF, (v < 0 ? 3.1 : 2.2) - q * 0.6 + (u >= 0.8 && ((s * 0.35 + av * 0.5) % 2.4) < 0.4 ? 0.6 : 0), X, Y);
      });
    }

    /* ---------------------------------------------------------------- the snail */
    // a tile (64 units, periodic, at half-unit steps) of soft mottling for the glass and of tiny bright flecks in it
    const C0TX = new Float32Array(128 * 128), C0FK = new Uint8Array(128 * 128);
    {
      const h = (p, q) => ih(p & 7, q & 7, 547);
      for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) {
        const gx = i / 16, gy = j / 16, a = fl(gx), b = fl(gy), fx = gx - a, fy = gy - b, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
        C0TX[j * 128 + i] = lerp(lerp(h(a, b), h(a + 1, b), ux), lerp(h(a, b + 1), h(a + 1, b + 1), ux), uy) - 0.5;
      }
      for (let cj = 0; cj < 20; cj++) for (let ci = 0; ci < 20; ci++) {
        if (ih(ci, cj, 551) < 0.94) continue;
        const fx = (ci + ih(ci, cj, 552)) * 6.4, fy = (cj + ih(ci, cj, 553)) * 6.4;
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (di * di + dj * dj <= 2) C0FK[((fl(fy) + dj) & 127) * 128 + ((fl(fx) + di) & 127)] = 1 + fl(ih(ci, cj, 554) * 253);
      }
    }
    function c0Skin(x, y, X, Y, s) {
      const F = c0F, depth = -s, id = c0Sid, rl = c0Srl, al = c0Sal;
      if (depth < F.ol && (F.olf >= 1 || bay(X, Y) < F.olf)) return 124;
      // the surface's lean, from the field's gradient
      const gl = Math.sqrt(c0Gx * c0Gx + c0Gy * c0Gy) || 1, rel = clamp(depth / rl, 0, 1), m = 1 - rel;
      const nx = c0Gx / gl * m, ny = c0Gy / gl * m, nz = Math.sqrt(Math.max(0, 1 - m * m));
      const lamS = Math.max(0, -0.25 * nx - 0.8 * ny + 0.55 * nz);   // the sky, from above
      const gdx = c0SX - x, gdy = c0SY - y, gd2 = gdx * gdx + gdy * gdy;
      let lamG = 0;                                                  // the galaxy in the shell
      if (gd2 < 16384) { const gd = Math.sqrt(gd2), ig = 1 - (gd - 64) / 64; lamG = Math.max(0, (gdx * nx + gdy * ny) / gd * 0.85 + 0.3 * nz) * ig * ig; }
      // sea glass: dim at the skin, glowing in its depths, lit from above and by the galaxy; its thin underside edge glows too
      let v = 0.6 + 1.35 * Math.sqrt(rel) + 1.45 * lamS + 2.0 * lamG + (rel > 0.62 ? (rel - 0.62) * 1.6 : 0);
      if (depth < F.ol + 1.5 && ny > 0.25 && id <= 2) v += 0.9;
      // the eyes
      if (id >= 5) {
        const E = id === 5 ? F.EA : F.EB, ex = x - E.ex, ey = y - E.ey, re = E.re, d2 = ex * ex + ey * ey, lidY = E.ey - re - 0.6 + F.lid * 2.4 * re;
        if (F.lid >= 0.6) { const ax = x - E.x, ay = y - (E.y - 0.5 * re), ad = Math.sqrt(ax * ax + ay * ay); if (ay > 0.2 * re && Math.abs(ad - re * 0.9) < Math.max(0.65, 0.7 / F.u)) return 124; }
        else if (F.lid > 0 && Math.abs(y - lidY) < Math.max(0.6, 0.7 / F.u) && d2 < (re + 0.9) * (re + 0.9)) return 124;
        if (F.lid < 0.6 && y > lidY && d2 < re * re) {
          if (F.u < 0.3) return 1;
          const de = Math.sqrt(d2) / re, cx = x - E.x, cy = y - E.y;
          const h1x = cx + 0.3 * re, h1y = cy + 0.36 * re, h1 = (h1x * h1x + h1y * h1y) / (re * re);
          if (h1 < 0.1) return h1 < 0.05 ? 22 : 21;                  // the catchlight (the sky)
          const h2x = cx - 0.36 * re, h2y = cy - 0.3 * re;
          if (h2x * h2x + h2y * h2y < Math.max(0.022 * re * re, 0.3 / (F.u * F.u))) return 21;
          const h3x = cx + 0.44 * re, h3y = cy - 0.28 * re;
          if (F.lod && h3x * h3x + h3y * h3y < 0.016 * re * re) return 15;   // a warm glint: the galaxy, reflected
          if (de > 0.87) return 124;
          const lo = ey / re;
          return lo > 0.15 ? c0Rp([1, 2, 3, 4, 5, 6], (lo - 0.15) * 5.5 * (1 - de * 0.5), X, Y) : de < 0.42 && F.lod > 1 ? 0 : 1;
        }
      }
      // the face: a small smile (or an "oh"), rosy cheeks
      if (id === 2 || id === 1) {
        const fy = y - F.hy, lw = Math.max(0.72, 0.6 / F.u);
        if (x > 126 && x < 146 && fy > 32 && fy < 50) {
          if (F.mouth) { const mx = x - 135.2, my = fy - 44.0, md = mx * mx * 1.2 + my * my * 0.8; if (md < 6.6) return md < 2.8 ? (my > 0.4 ? 125 : 1) : 124; }
          else { const mx = x - 134.8, my = fy - 40.2, md = Math.sqrt(mx * mx + my * my); if (my > 1.0 && Math.abs(md - 3.4) < lw) return 124; }
        }
        const bx = (x - 125.2) / 4.8, by = (fy - 40.0) / 2.7, b2 = bx * bx + by * by;
        if (b2 < 1 && F.u > 0.35) { const bb = bay(X, Y); if (b2 < 0.45 + 0.35 * (F.blush - 0.42)) return F.u > 0.7 ? 44 : 37; if (bb < 0.55 * (1.15 - b2)) return bb < 0.2 ? 44 : 37; }
      }
      if (id === 4) v += 0.3 * al;                                   // the stalks grow clearer toward the eyes
      // texture: a mottled glass, faint creases round the stalks, tiny bright flecks
      if (F.tex > 0 && id <= 4) {
        const ti = ((fl(y * 2) & 127) << 7) | (fl(x * 2) & 127);
        if (C0FK[ti] && C0FK[ti] < F.fk && rel > 0.15 && -0.14 * nx - 0.45 * ny + 0.88 * nz < 0.93) return 128;
        v += C0TX[ti] * 0.45 * F.tex;
        if (id === 4) { const r = al * 22, fr = r - fl(r); if (fr < 0.16 && rel < 0.85) v -= 0.5 * F.tex; }
      }
      // the foot's pale, softly scalloped skirt, and the shadow the shell lays on the body
      if (id === 0 && y > 65.3 + 0.5 * Math.sin(x * 0.55)) v = 2.6 + (F.lod && (((x * 0.2) % 1) + 1) % 1 < 0.12 ? -0.9 : 0);
      if (id <= 1) { const sdx = x - c0SX; if (Math.abs(sdx) < 74) { const dd = y - (c0SY + Math.sqrt(74 * 74 - sdx * sdx)); if (dd < 8) v -= 1.3 * (1 - Math.max(0, dd) / 8); } }
      // a wet gloss where it faces the sky, and the shell's warm light on the near edge
      const sp = -0.14 * nx - 0.45 * ny + 0.88 * nz;
      if (sp > 0.95 && rel > 0.05) { v += (sp - 0.95) * (id >= 2 ? 36 : 16); if (sp > 0.992 && id >= 2) return 129; }
      if (lamG > 0.4 && depth < F.ol + 1.4 && bay(X, Y) < lamG) return 144;
      return c0Rq(C0GRN, v, X, Y, 0.55);
    }
    function c0Snail(V) {
      const u = V.u, b = V.box, P = C0PR;
      const Y0 = Math.max(b[1], c0ROW0, fl(V.Y(C0BB[1]))), Y1 = Math.min(b[3], c0ROW1, Math.ceil(V.Y(C0BB[3])));
      for (let Y = Y0; Y <= Y1; Y++) {
        const y = (Y + 0.5 - 135) / u;
        // the primitives that reach this row, and the span they cover
        let na = 0, xa = 1e9, xb = -1e9;
        for (let i = 0, o = 0; i < c0Np; i++, o += C0ST) {
          if (y < P[o + 9] || y > P[o + 11]) continue;
          // the part of the segment within reach of this row, widened by the reach: a tighter span than the box
          const R = P[o + 10] - Math.max(P[o], P[o + 2]), ay = P[o + 1], dy = P[o + 15];
          let h0 = 0, h1 = 1;
          if (Math.abs(dy) > 1e-6) { const ha = (y - R - ay) / dy, hb = (y + R - ay) / dy; h0 = Math.max(0, Math.min(ha, hb)); h1 = Math.min(1, Math.max(ha, hb)); }
          const xa0 = P[o] + P[o + 14] * h0, xa1 = P[o] + P[o + 14] * h1;
          C0AX0[na] = Math.min(xa0, xa1) - R; C0AX1[na] = Math.max(xa0, xa1) + R; C0ACT[na] = o;
          if (C0AX0[na] < xa) xa = C0AX0[na]; if (C0AX1[na] > xb) xb = C0AX1[na]; na++;
        }
        if (!na) continue;
        c0Skip(u, y, 62.4); const S0 = C0SK[0], S1 = C0SK[1], o = Y * W;
        const X0 = Math.max(b[0], fl(V.X(xa))), X1 = Math.min(b[2], Math.ceil(V.X(xb)));
        for (let X = X0; X <= X1; X++) {
          if (X >= S0 && X <= S1) { X = S1; continue; }
          const x = (X + 0.5 - 240) / u, s = c0Field(x, y, na);
          // outside: the field never changes faster than distance, so nothing of the body is nearer than s (up to the margin)
          if (s >= 0) { const sk = fl((Math.min(s, 6) - 0.6) * u); if (sk > 0) X += sk; continue; }
          BUF[o + X] = c0Skin(x, y, X, Y, s);
        }
      }
    }

    /* ---------------------------------------------------------------- the shell's rim: amber horn */
    const C0THS = 0.22;                                              // where the suture meets the rim (just above the aperture)
    // by angle round the rim (2048 steps): the growth lines' wander, and the aperture's flare
    const C0RW = new Float32Array(2050), C0RF = new Float32Array(2050);
    for (let i = 0; i <= 2049; i++) { const th = i / 2048 * TAU - PI, g = (th - 0.72) / 0.5; C0RW[i] = 0.9 * Math.sin(th * 7 + 1.3) + 0.5 * Math.sin(th * 23); C0RF[i] = g > -1 && g < 1 ? (1 - g * g) * (1 - g * g) : 0; }
    function c0Rim(V) {
      const u = V.u, ol = Math.max(0.8, 1 / u), mw = 1.4 / u, nl = u >= 0.5 ? 180 : 0, na = sstep(0.5, 1.0, u), gl = 0.2 * sstep(1.2, 1.8, u), lw = Math.max(0.55, 0.6 / u);
      c0Ann(V, 62.4, 64 + 12.5 + ol + 1 + mw, (x, y, X, Y) => {
        const dx = x - c0SX, dy = y - c0SY, r = Math.sqrt(dx * dx + dy * dy), rho = r - 64, th = Math.atan2(dy, dx), cs = dx / r, sn = dy / r;
        let ph = C0THS - th; if (ph < 0) ph += TAU;                  // how far round the last whorl, from the suture
        const ti = fl((th + PI) * (2048 / TAU)), fa = C0RF[ti];          // the aperture's flared lip
        const wR = Math.max(6 + 2.2 * ph / TAU + 4.2 * fa, mw);
        if (rho > wR + ol) return -1;
        if (rho > wR) return 130;
        if (rho < 0.4) return rho < -0.5 ? 130 : 131;                // the groove where the horn meets the window
        // the horn's rounded cross-section: its normal turns from facing the galaxy (inner edge) to facing out
        const n = rho / wR, nr = clamp((n - 0.42) * 1.9, -1, 1), nz = Math.sqrt(1 - nr * nr);
        const glowG = Math.exp(-(rho - 0.4) / 2.1);                  // the galaxy shining through the horn's inner edge
        const lamS = Math.max(0, -0.3 * cs * nr - 0.85 * sn * nr + 0.42 * nz);   // the sky, from above
        const spec = Math.max(0, -0.17 * cs * nr - 0.48 * sn * nr + 0.86 * nz);  // its gloss (top left, and low right)
        let v = 0.75 + 3.3 * glowG + 1.15 * lamS - (sn > 0.3 ? (sn - 0.3) * 1.1 : 0);
        // the spiral bands of colour that run along the whorl
        if (n > 0.5 && n < 0.61) v -= 0.6; else if (n > 0.76 && n < 0.83) v += 0.35;
        // growth lines: fine ridges across the horn, irregularly spaced, every seventh a little stronger
        if (nl) { const w = th / TAU * nl + C0RW[ti] + n * 0.5, k = fl(w), f = w - k; if (f < 0.22) v -= (k % 7 === 0 ? 0.75 : 0.38) * (1 - glowG * 0.6) * na; else if (f > 0.5 && f < 0.64) v += 0.25 * na; }
        if (spec > 0.955) { v += (spec - 0.955) * 55; if (spec > 0.99 && ih(fl(th * 300), fl(n * 5), 583) > 1 - gl) return 22; }
        if (ph < 0.62) { const rs = 6 * Math.pow(1 - ph / 0.62, 1.4); if (Math.abs(rho - rs) < lw) return 130; if (rho > rs) v -= 0.8; }
        if (fa > 0.02) { const lip = wR - rho; if (lip < 3.8 * fa + 0.3) v = lip < 0.9 * fa + 0.3 ? 2.1 : 3.5 + 0.9 * fa + (lip < 2.2 * fa ? 0.6 : 0); }
        return c0Rp(C0AMB, v, X, Y);
      });
    }

    /* ---------------------------------------------------------------- fireflies */
    const C0FLY = [];
    for (let k = 0; k < 16; k++) {
      const air = k < 5;
      C0FLY.push({ x: air ? [-192, -166, 200, 210, -206][k] : lerp(-208, 208, ih(k, 1, 591)), y: air ? [42, 96, 74, -12, -40][k] : lerp(132, 172, ih(k, 2, 591)),
        ax: 6 + 10 * ih(k, 3, 591), ay: 4 + 6 * ih(k, 4, 591), nx: 1 + fl(ih(k, 5, 591) * 2), ny: 2 + fl(ih(k, 6, 591) * 2), ph: ih(k, 7, 591) * TAU, nb: 3 + fl(ih(k, 8, 591) * 4) });
    }
    // light that keeps its surface's hue: each colour lifted one step up its own ramp (warm, for what has no ramp here)
    const C0LIT = new Uint8Array(256);
    for (let i = 0; i < 256; i++) C0LIT[i] = i < NPAL ? T_WARM[2][i] : i;
    for (const R of [C0GRN, [130, 131, 132, 133, 15, 16, 108, 22], [134, 135, 136, 137, 138, 147, 148, 22], [1, 2, 3, 4, 5, 6, 7, 8, 56, 57, 22], [139, 140, 141, 142, 143, 50, 53], [0, 1], [23, 24, 25, 26, 49], [116, 117, 118, 119, 148], [19, 20, 21, 22], [144, 16, 22], [59, 60, 22], [58, 59], [44, 75, 22]])
      for (let k = 0; k + 1 < R.length; k++) C0LIT[R[k]] = R[k + 1];
    function c0Light(X, Y, r, a) {
      if (a <= 0.01 || r < 0.6) return;
      const x0 = Math.max(0, fl(X - r)), x1 = Math.min(W - 1, Math.ceil(X + r)), y0 = Math.max(c0ROW0, fl(Y - r)), y1 = Math.min(c0ROW1, Math.ceil(Y + r)), ir = 1 / r;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx + 0.5 - X) * ir, dy = (yy + 0.5 - Y) * ir, d = dx * dx + dy * dy; if (d >= 1) continue;
        const f = a * (1 - Math.sqrt(d)), b = bay(xx, yy), i = yy * W + xx;
        if (b < f * f * 1.6) { BUF[i] = C0LIT[BUF[i]]; if (b < f * f * 0.5) BUF[i] = C0LIT[BUF[i]]; }
      }
    }
    function c0Firefly(V, x, y, b, big) {
      if (b <= 0.03) return;
      const u = V.u, X = V.X(x), Y = V.Y(y);
      if (X < -24 || X > W + 24 || Y < c0ROW0 || Y > c0ROW1) return;
      c0Light(X, Y, Math.max(2.5, (big ? 17 : 8) * u), (big ? 0.95 : 0.6) * b);
      if (!big) { P(X, Y, b > 0.55 ? 60 : b > 0.3 ? 59 : 58); return; }
      // the visitor: a little lamp with a soft cross of light
      const rc = Math.max(0.8, 1.3 * u * (0.8 + 0.2 * b));
      if (u < 0.45) { P(X, Y, 60); return; }
      discF(X, Y, rc + Math.max(0.7, 0.6 * u), 58); discF(X, Y, rc, 59); discF(X - 0.25 * rc, Y - 0.25 * rc, rc * 0.6, 60);
      if (b > 0.35) { const L = Math.round((1.5 + 3 * b) * clamp(u, 0.3, 1.6)); for (let k = 1; k <= L; k++) { const c = k < L * 0.5 ? 59 : 15; P(X + rc + k, Y, c); P(X - rc - k, Y, c); P(X, Y + rc + k, c); P(X, Y - rc - k, c); } }
    }
    function c0Flies(V, t, near) {
      for (let k = 0; k < C0FLY.length; k++) {
        const f = C0FLY[k]; if ((k < 5) !== near) continue;
        const x = f.x + f.ax * Math.sin(zP(t, f.nx) + f.ph), y = f.y + f.ay * Math.sin(zP(t, f.ny) + f.ph * 1.3), b = 0.5 + 0.5 * Math.sin(zP(t, f.nb) + f.ph * 2.1);
        c0Firefly(V, x, y, b * b, false);
      }
      if (near && c0F.Vf) { const [x, y, a] = c0F.Vf; c0Firefly(V, x, y, a * (0.72 + 0.28 * Math.sin(zP(t, 24))), true); }
    }

    /* ---------------------------------------------------------------- the whole layer */
    function c0Draw(V, t) {
      const u = V.u, hx = 240 / u, hy = (135 - LB) / u;
      // magnified so far that the whole frame is inside the shell (the galaxy): nothing of ours shows
      let far = 0;
      for (const [cx, cy] of [[-hx, -hy], [hx, -hy], [-hx, hy], [hx, hy]]) far = Math.max(far, Math.hypot(cx - c0SX, cy - c0SY));
      if (far < 62) return;
      c0Frame(V, t);
      c0Sky(V, t);
      c0Stars(V, t);
      c0Weeds(V, t);
      c0Shoot(V, c0F.M);
      c0Flies(V, t, false);
      for (const P of C0LEAVES) c0Leaf(V, P, t);
      for (const P of C0PETS) if (P.row < 3) c0Petal(V, P, t);
      c0Stamens(V, t);
      c0Snail(V);
      c0Rim(V);
      for (let k = 0; k < C0PETS.length; k++) { const P = C0PETS[k]; if (P.row === 3) { c0Petal(V, P, t); c0Dew(V, P, t, k); } }
      c0Pollen(V, t);
      c0Flies(V, t, true);
    }
    ZL[0] = { name: 'snail', draw: c0Draw, mask: c0Mask, maskBox: [-84, -74, 48, 58] };
  }
