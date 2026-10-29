  /* ================================================================ Carry: the endless zoom — the kit every layer uses
     The film is one continuous pull-back through seven layers of scale, each ZR = 8 times larger than the one inside it,
     and then it is back where it began (layer 7 is layer 0). Each layer is drawn in its own units: at its nominal size
     (u = 1) one unit is one screen pixel and its origin is the centre of the frame (240, 135). The layer inside it lives at
     its origin, 1/8 the size, and shows through its window (mask). */
  const ZR = 8, ZN = 7, ZD = 15;
  const ZA = 7 * 0.85 / (2 * PI);
  // how far out we are, in layers, at time t: slow at the loop's seam (the snail), fastest in deep space. zS(15) = 7 ≡ 0.
  const zS = (t) => 7 * t / ZD - ZA * Math.sin(2 * PI * t / ZD);
  // a phase that comes back round exactly every 15 s (n turns per loop): use it for EVERY motion, so the loop is seamless
  const zP = (t, n) => 2 * PI * (n === undefined ? 1 : n) * t / ZD;
  const zMod = (k) => ((k % ZN) + ZN) % ZN;
  // the layers: ZL[k] = { name, draw(V, t), mask(x, y) -> 0..1 (optional; the window where the layer inside shows),
  //   maskBox: [x0, y0, x1, y1] (optional; the window's bounds, in this layer's units) }
  const ZL = [];
  // the default window: a soft-edged rectangle at the origin — full inside 60 × 34, fading out to 72 × 44
  const zRectMask = (x, y) => clamp((36 - Math.abs(x)) / 6, 0, 1) * clamp((22 - Math.abs(y)) / 5, 0, 1);
  const ZRECT_BOX = [-36, -22, 36, 22];

  /* the view a layer is drawn through. V.u: screen px per unit. V.X(x), V.Y(y): unit → screen; V.S(n): a length.
     V.lx(X), V.ly(Y): screen pixel → unit (pixel centre). V.box: the screen rect [X0, Y0, X1, Y1] (inclusive) where this
     layer's content is valid (|x|, |y| ≤ V.R units, default 420), clipped to the frame — keep your work inside it.
     V.each(x0, y0, x1, y1, fn): for every screen pixel whose centre falls in that box of units (and in V.box), calls
     fn(x, y, X, Y) with unit coords x, y and screen X, Y; return a palette index to paint it, or -1 to leave it.
     V.vis(x0, y0, x1, y1): does that box of units touch the frame at all (skip work when it doesn't).
     V.lod: a detail level (0 when the layer is tiny on screen, 1 at nominal size, > 1 when magnified). */
  function zView(u, R, clip) {
    R = R || 420;
    const cx = 240, cy = 135, V = { u, cx, cy, R };
    V.X = (x) => cx + x * u; V.Y = (y) => cy + y * u; V.S = (n) => n * u;
    V.lx = (X) => (X + 0.5 - cx) / u; V.ly = (Y) => (Y + 0.5 - cy) / u;
    V.box = [Math.max(0, fl(cx - R * u)), Math.max(0, fl(cy - R * u)), Math.min(W - 1, Math.ceil(cx + R * u)), Math.min(H - 1, Math.ceil(cy + R * u))];
    // an inner layer only shows through the outer layer's window: the compositor passes that window's screen rect, and
    // per-pixel work outside it is skipped (V.clipped says so; a layer may also use V.box to skip its own loops)
    if (clip) { V.box[0] = Math.max(V.box[0], clip[0]); V.box[1] = Math.max(V.box[1], clip[1]); V.box[2] = Math.min(V.box[2], clip[2]); V.box[3] = Math.min(V.box[3], clip[3]); V.clipped = true; }
    V.vis = (x0, y0, x1, y1) => V.X(x1) >= 0 && V.X(x0) < W && V.Y(y1) >= 0 && V.Y(y0) < H;
    V.each = (x0, y0, x1, y1, fn) => {
      const X0 = Math.max(V.box[0], fl(V.X(x0))), X1 = Math.min(V.box[2], Math.ceil(V.X(x1))), Y0 = Math.max(V.box[1], fl(V.Y(y0))), Y1 = Math.min(V.box[3], Math.ceil(V.Y(y1)));
      for (let Y = Y0; Y <= Y1; Y++) { const y = (Y + 0.5 - cy) / u; if (y < y0 || y > y1) continue; for (let X = X0; X <= X1; X++) { const x = (X + 0.5 - cx) / u; if (x < x0 || x > x1) continue; const c = fn(x, y, X, Y); if (c >= 0) BUF[Y * W + X] = c; } }
    };
    V.lod = clamp(Math.log(u * 8) / Math.log(8), 0, 2);
    return V;
  }
  // useful shapes, in a view's units
  const zDisc = (V, x, y, r, c) => { if (V.S(r) < 0.35) { if (V.S(r) > 0.12) P(V.X(x), V.Y(y), c); return; } discF(V.X(x), V.Y(y), V.S(r), c); };
  const zLine = (V, x0, y0, x1, y1, c) => lineP(V.X(x0), V.Y(y0), V.X(x1), V.Y(y1), c);
  const zGlow = (V, x, y, r, T, a) => glow(V.X(x), V.Y(y), V.S(r), T, a);
  // a field of stars over a box of units: density per 1000 square units, twinkling on the loop
  function zStars(V, t, x0, y0, x1, y1, dens, seed, cols) {
    cols = cols || [19, 20, 21, 22];
    const n = Math.min(900, fl((x1 - x0) * (y1 - y0) / 1000 * dens));
    for (let k = 0; k < n; k++) {
      const x = lerp(x0, x1, ih(k, 1, seed)), y = lerp(y0, y1, ih(k, 2, seed)), X = V.X(x), Y = V.Y(y);
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const tw = 0.5 + 0.5 * Math.sin(zP(t, 1 + fl(ih(k, 3, seed) * 4)) + k), b = ih(k, 4, seed);
      const c = cols[clamp(fl(b * cols.length * (0.6 + 0.4 * tw)), 0, cols.length - 1)];
      P(X, Y, c);
      if (b > 0.97 && V.u > 0.7) { P(X - 1, Y, cols[0]); P(X + 1, Y, cols[0]); P(X, Y - 1, cols[0]); P(X, Y + 1, cols[0]); }
    }
  }

  /* ---------------------------------------------------------------- the compositor (one shot, the whole film) */
  const ZSAVE = new Uint8Array(NP);
  const Z_FALL = [135, 140, 137, 143, 117, 78, 62];
  function zDraw(k, u, t, clip) {
    const L = ZL[zMod(k)], V = zView(u, L && L.R, clip);
    if (L) { L.draw(V, t); return V; }
    // (a layer not written yet: a flat placeholder with its number)
    V.each(-420, -420, 420, 420, () => Z_FALL[zMod(k)]);
    if (V.u > 0.3) text(String(zMod(k)), V.X(0) - 6 * V.u, V.Y(0) - 10 * V.u, 22, Math.max(1, Math.round(4 * V.u)));
    return V;
  }
  // keep the inner layer (just drawn over everything) only inside the outer layer's window; elsewhere restore the outer
  function zWindow(kOut, uOut) {
    const L = ZL[zMod(kOut)], mask = (L && L.mask) || zRectMask, mb = (L && L.maskBox) || ZRECT_BOX;
    const X0 = fl(240 + mb[0] * uOut), X1 = Math.ceil(240 + mb[2] * uOut), Y0 = fl(135 + mb[1] * uOut), Y1 = Math.ceil(135 + mb[3] * uOut);
    for (let Y = 0; Y < H; Y++) {
      const o = Y * W;
      if (Y < Y0 || Y > Y1) { BUF.set(ZSAVE.subarray(o, o + W), o); continue; }
      const y = (Y + 0.5 - 135) / uOut;
      for (let X = 0; X < W; X++) {
        if (X < X0 || X > X1) { BUF[o + X] = ZSAVE[o + X]; continue; }
        const a = mask((X + 0.5 - 240) / uOut, y);
        if (a <= 0 || (a < 1 && bay(X, Y) >= a)) BUF[o + X] = ZSAVE[o + X];
      }
    }
  }
  function zFrame(t) {
    const s = zS(t), k = Math.floor(s + 1e-9), f = s - k;
    // the outermost layer first (magnified, filling the frame), then each layer inside it, in its window
    let uO = Math.pow(ZR, 1 - f);
    zDraw(k + 1, uO, t);
    for (let n = 0; n < 3; n++) {
      const kk = k - n, u = uO / ZR;
      if (u * 840 < 1.5) break;                                   // smaller than a pixel or two: nothing to see
      ZSAVE.set(BUF);
      const Lo = ZL[zMod(kk + 1)], mb = (Lo && Lo.maskBox) || ZRECT_BOX;
      const clip = [Math.max(0, fl(240 + mb[0] * uO) - 1), Math.max(0, fl(135 + mb[1] * uO) - 1), Math.min(W - 1, Math.ceil(240 + mb[2] * uO) + 1), Math.min(H - 1, Math.ceil(135 + mb[3] * uO) + 1)];
      if (clip[2] < clip[0] || clip[3] < clip[1]) break;
      zDraw(kk, u, t, clip);
      zWindow(kk + 1, uO);
      uO = u;
    }
  }
  if (typeof window !== 'undefined') window.__carry = { zS, zP, ZL, zView, zDraw, zFrame, ZR, ZN, ZD };
