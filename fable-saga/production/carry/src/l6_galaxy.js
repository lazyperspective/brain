  /* ================================================================ L6 — the galaxy (and the snail's shell)
     A face-on two-armed spiral, core at (−144, −64), its disc about 512 units in radius, so that 1/8 of it fills the snail's
     shell exactly. The sun is the warm star at (−26, +4), near the origin, on the outer edge of an arm. It turns one full
     turn every 15 s, rigidly, so the shell is a slowly turning wheel of stars.
     The galaxy's light is baked once into a texture in its own turning frame (light, arm, dust), sampled smoothly per pixel
     with dithering; stars are a fixed list (they turn with it) plus a finer field that appears as the camera comes in. */
  {
  const GX = -144, GY = -64, GR = 512, LN = 1 / Math.tan(0.30);
  // the field, at rest (rotation 0), relative to the core: [light, arm, dust]
  function c6Field(dx, dy) {
    const r = Math.sqrt(dx * dx + dy * dy) + 1e-6, q = r / GR, th = Math.atan2(dy, dx);
    const ph = 2 * th - Math.log(r / 14 + 1) * LN * 1.6, wob = (vn(th * 2 + 7, q * 7, 1, 6101) - 0.5) * 0.8;
    const c = Math.cos(ph + wob), arm = Math.pow(Math.max(0, c), 2.6) * sstep(0.05, 0.16, q);
    const dust = Math.pow(Math.max(0, Math.cos(ph + wob + 0.62)), 7) * sstep(0.07, 0.2, q) * (1 - sstep(0.6, 0.95, q));
    const bulge = Math.exp(-q * q / 0.0035), bar = Math.exp(-q * q / 0.02) * 0.35, disc = Math.exp(-q * 2.4) * (1 - sstep(0.8, 1.12, q));
    const clump = 0.55 + 0.9 * vn(dx * 0.05, dy * 0.05, 1, 6102) * vn(dx * 0.013, dy * 0.013, 1, 6104);
    const light = bulge * 1.2 + bar + disc * (0.2 + 1.0 * arm * clump) - dust * disc * 0.9;
    return [Math.max(0, light), arm, dust * Math.min(1, disc * 4)];
  }
  // bake: a 720 × 720 grid over ±640 units around the core
  const TN = 720, TS = 1280 / TN, TL = new Float32Array(TN * TN), TA = new Float32Array(TN * TN), TD = new Float32Array(TN * TN);
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) { const [l, a, d] = c6Field((i + 0.5) * TS - 640, (j + 0.5) * TS - 640), n = j * TN + i; TL[n] = l; TA[n] = a; TD[n] = d; }
  function c6Sample(A, gx, gy) {
    const fx = (gx + 640) / TS - 0.5, fy = (gy + 640) / TS - 0.5, i = fl(fx), j = fl(fy);
    if (i < 0 || j < 0 || i >= TN - 1 || j >= TN - 1) return 0;
    const ax = fx - i, ay = fy - j, n = j * TN + i;
    return (A[n] * (1 - ax) + A[n + 1] * ax) * (1 - ay) + (A[n + TN] * (1 - ax) + A[n + TN + 1] * ax) * ay;
  }
  // the stars: a fixed list in the galaxy's frame, thickest along the arms
  const STARS = [];
  for (let k = 0; STARS.length < 3600 && k < 60000; k++) {
    const q = Math.pow(ih(k, 1, 6110), 0.75) * 1.05, a = ih(k, 2, 6110) * TAU, r = q * GR, dx = Math.cos(a) * r, dy = Math.sin(a) * r, [, arm] = c6Field(dx, dy);
    if (ih(k, 3, 6110) > 0.08 + arm * 0.92 && q > 0.1) continue;
    STARS.push([dx, dy, ih(k, 4, 6110), arm > 0.45 && ih(k, 5, 6110) < 0.1 ? 1 : 0]);
  }
  const FAR = []; for (let k = 0; k < 10; k++) { const a = ih(k, 6, 6120) * TAU, d = 620 + ih(k, 7, 6120) * 160; FAR.push([GX + Math.cos(a) * d, GY + Math.sin(a) * d, 5 + ih(k, 3, 6120) * 9, ih(k, 4, 6120) * PI, 0.3 + ih(k, 5, 6120) * 0.5]); }
  const RAMP_B = [5, 62, 58, 15, 16, 108, 22], RAMP_A = [4, 5, 7, 47, 147, 148, 22], RAMP_H = [2, 3, 4, 55, 56, 57];
  function c6Draw(V, t) {
    const rot = zP(t, 1), cr = Math.cos(rot), sr = Math.sin(rot), u = V.u;
    const fine = u > 0.6, cs = u > 3 ? 3 : 10;                          // a finer star field as the camera comes in
    V.each(-720, -720, 720, 720, (x, y, X, Y) => {
      const dx = x - GX, dy = y - GY, gx = dx * cr + dy * sr, gy = -dx * sr + dy * cr;   // into the galaxy's turning frame
      const L = c6Sample(TL, gx, gy), b = bay(X, Y) - 0.5;
      let c;
      if (L < 0.05) {
        if (L > 0.012 && b + 0.5 < L * 14) c = 3;
        else { const n = vn(x * 0.004, y * 0.004, 1, 6103); c = n > 0.62 && b + 0.5 < (n - 0.62) * 1.5 ? 77 : n > 0.48 && b + 0.5 < (n - 0.48) * 0.5 ? 76 : 0; }
      } else {
        const A = c6Sample(TA, gx, gy), Dd = c6Sample(TD, gx, gy), q = Math.sqrt(gx * gx + gy * gy) / GR, lv = L + b * 0.11;
        if (q < 0.09 + b * 0.02) c = RAMP_B[clamp(fl(lv * 5.2), 0, 6)];
        else if (Dd > 0.3 + b * 0.2 && lv < 0.55) c = Dd > 0.65 ? 1 : 2;
        else if (A > 0.3 + b * 0.25) c = RAMP_A[clamp(fl(lv * 7), 0, 6)];
        else c = RAMP_H[clamp(fl(lv * 9), 0, 5)];
      }
      // the finer stars (anchored in the galaxy, turning with it): one per cell where it is bright enough
      if (fine) {
        const ci = fl(gx / cs), cj = fl(gy / cs), hx = (ci + ih(ci, cj, 6130)) * cs, hy = (cj + ih(ci, cj, 6131)) * cs, d = Math.hypot(gx - hx, gy - hy) * u;
        if (d < 0.6 && ih(ci, cj, 6132) < 0.15 + L * 1.2) c = ih(ci, cj, 6133) < 0.3 ? 22 : L > 0.3 ? 148 : 20;
      }
      return c;
    });
    // the glow of the core
    zGlow(V, GX, GY, 70, T_GOLD, 0.45); zGlow(V, GX, GY, 22, T_WH, 0.55);
    // the stars, turning with the galaxy
    const big = u > 0.5;
    for (const [sx0, sy0, m, knot] of STARS) {
      const x = GX + sx0 * cr - sy0 * sr, y = GY + sx0 * sr + sy0 * cr, X = V.X(x), Y = V.Y(y);
      if (X < -3 || X >= W + 3 || Y < -3 || Y >= H + 3) continue;
      if (knot) { const rr = 1.6 * u; if (rr > 1.1) { glow(X, Y, rr * 4, T_MAG, 0.3); discF(X, Y, rr, 73); discF(X, Y, rr * 0.5, 75); } else P(X, Y, u > 0.2 ? 74 : 56); continue; }
      const tw = 0.5 + 0.5 * Math.sin(zP(t, 2 + fl(m * 3)) + sx0);
      const c = m > 0.985 ? 22 : m > 0.92 ? (tw > 0.5 ? 22 : 148) : m > 0.65 ? 21 : m > 0.35 ? 20 : 19;
      P(X, Y, c);
      if (big && m > 0.965) { const Lr = Math.min(4, 1 + u * 0.7); for (let d = 1; d <= Lr; d++) { const cc = d > Lr * 0.6 ? 20 : 21; P(X - d, Y, cc); P(X + d, Y, cc); P(X, Y - d, cc); P(X, Y + d, cc); } }
    }
    // far galaxies, tiny tilted spirals in the dark
    for (const [x, y, r, a, tilt] of FAR) {
      if (!V.vis(x - r, y - r, x + r, y + r) || V.S(r) < 1.5) continue;
      const ca = Math.cos(a + rot * 0.3), sa = Math.sin(a + rot * 0.3);
      V.each(x - r, y - r, x + r, y + r, (px, py, X, Y) => { const dx = px - x, dy = py - y, ux = dx * ca + dy * sa, uy = (-dx * sa + dy * ca) / tilt, d = Math.hypot(ux, uy) / r; if (d > 1) return -1; const sp = Math.cos(Math.atan2(uy, ux) * 2 - Math.log(d * 8 + 0.1) * 2.6), l = (1 - d) * (0.35 + 0.65 * Math.max(0, sp)); return l > 0.7 ? 21 : l > 0.45 ? 57 : l > 0.25 ? 56 : bay(X, Y) < l * 2.5 ? 55 : -1; });
    }
    // the sun: a warm star by the origin
    const SX = V.X(-26.25), SY = V.Y(4.25);
    if (SX > -30 && SX < W + 30 && SY > -30 && SY < H + 30) {
      if (u > 0.2) zGlow(V, -26.25, 4.25, 5, T_WARM, 0.6);
      P(SX, SY, u > 0.4 ? 22 : 16);
      if (u > 1) { const Lr = Math.min(9, u * 2.2); for (let d = 1; d <= Lr; d++) { const c = d > Lr * 0.5 ? 15 : 16; P(SX - d, SY, c); P(SX + d, SY, c); P(SX, SY - d, c); P(SX, SY + d, c); } }
    }
  }
  ZL[6] = { name: 'galaxy', draw: c6Draw, R: 720 };
  }
