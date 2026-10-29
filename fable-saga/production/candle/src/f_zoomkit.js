  /* ================================================================ the endless zoom — the kit every layer uses (from Carry)
     The film is one continuous pull-back through seven layers of scale, each ZR = 8 times larger than the one inside it,
     and then it is back where it began (layer 7 is layer 0). Each layer is drawn in its own units: at its nominal size
     (u = 1) one unit is one screen pixel and its origin is the centre of the frame (240, 135). The layer inside it lives at
     its origin, 1/8 the size, and shows through its window (mask). */
  const ZR = 8, ZN = 4, ZD = 15;
  // how far out we are, in layers, at time t: One Candle draws BACK, one layer every 3.75 s, easing to a breath as each
  // layer arrives at its own size. zS(0) = 0, zS(15) = 4 ≡ 0.
  const zS = (t) => 4 * t / ZD - 0.55 * Math.sin(8 * PI * t / ZD) / (2 * PI);
  // a phase that comes back round exactly every 15 s (n turns per loop): use it for EVERY motion, so the loop is seamless
  const zP = (t, n) => 2 * PI * (n === undefined ? 1 : n) * t / ZD;
  const zMod = (k) => ((k % ZN) + ZN) % ZN;
  // the layers: ZL[k] = { name, draw(V, t), mask(x, y) -> 0..1 (optional; the window where the layer inside shows),
  //   maskBox: [x0, y0, x1, y1] (optional; the window's bounds, in this layer's units) }
  const ZL = [];
  // the default window: a soft-edged rectangle at the origin — full inside 60 × 34, fading out to 72 × 44
  const zRectMask = (x, y) => clamp((36 - Math.abs(x)) / 6, 0, 1) * clamp((22 - Math.abs(y)) / 5, 0, 1);
  const ZRECT_BOX = [-36, -22, 36, 22], ZRECT_HOLE = [-30, -17, 30, 17];   // (HOLE: where the mask is whole)

  /* the view a layer is drawn through. V.u: screen px per unit. V.X(x), V.Y(y): unit → screen; V.S(n): a length.
     V.lx(X), V.ly(Y): screen pixel → unit (pixel centre). V.box: the screen rect [X0, Y0, X1, Y1] (inclusive) where this
     layer's content is valid (|x|, |y| ≤ V.R units, default 420), clipped to the frame — keep your work inside it.
     V.each(x0, y0, x1, y1, fn): for every screen pixel whose centre falls in that box of units (and in V.box), calls
     fn(x, y, X, Y) with unit coords x, y and screen X, Y; return a palette index to paint it, or -1 to leave it.
     V.vis(x0, y0, x1, y1): does that box of units touch the frame at all (skip work when it doesn't).
     V.lod: a detail level (0 when the layer is tiny on screen, 1 at nominal size, > 1 when magnified).
     V.hole: a screen rect [X0, Y0, X1, Y1] that the layer inside will cover completely (or null) — skip it: V.each does. */
  function zView(u, R, clip, hole) {
    R = R || 420;
    const cx = 240, cy = 135, V = { u, cx, cy, R };
    V.X = (x) => cx + x * u; V.Y = (y) => cy + y * u; V.S = (n) => n * u;
    V.lx = (X) => (X + 0.5 - cx) / u; V.ly = (Y) => (Y + 0.5 - cy) / u;
    V.box = [Math.max(0, fl(cx - R * u)), Math.max(0, fl(cy - R * u)), Math.min(W - 1, Math.ceil(cx + R * u)), Math.min(H - 1, Math.ceil(cy + R * u))];
    // an inner layer only shows through the outer layer's window: the compositor passes that window's screen rect, and
    // per-pixel work outside it is skipped (V.clipped says so; a layer may also use V.box to skip its own loops)
    if (clip) { V.box[0] = Math.max(V.box[0], clip[0]); V.box[1] = Math.max(V.box[1], clip[1]); V.box[2] = Math.min(V.box[2], clip[2]); V.box[3] = Math.min(V.box[3], clip[3]); V.clipped = true; }
    V.hole = hole || null;
    V.vis = (x0, y0, x1, y1) => V.X(x1) >= 0 && V.X(x0) < W && V.Y(y1) >= 0 && V.Y(y0) < H;
    V.each = (x0, y0, x1, y1, fn) => {
      const X0 = Math.max(V.box[0], fl(V.X(x0))), X1 = Math.min(V.box[2], Math.ceil(V.X(x1))), Y0 = Math.max(V.box[1], fl(V.Y(y0))), Y1 = Math.min(V.box[3], Math.ceil(V.Y(y1)));
      const Hh = V.hole;
      for (let Y = Y0; Y <= Y1; Y++) { const y = (Y + 0.5 - cy) / u; if (y < y0 || y > y1) continue; const hr = Hh && Y >= Hh[1] && Y <= Hh[3]; for (let X = X0; X <= X1; X++) { if (hr && X >= Hh[0] && X <= Hh[2]) { X = Hh[2]; continue; } const x = (X + 0.5 - cx) / u; if (x < x0 || x > x1) continue; const c = fn(x, y, X, Y); if (c >= 0) BUF[Y * W + X] = c; } }
    };
    V.lod = clamp(Math.log(u * 8) / Math.log(8), 0, 2);
    return V;
  }
  // useful shapes, in a view's units
  const zDisc = (V, x, y, r, c) => { if (V.S(r) < 0.35) { if (V.S(r) > 0.12) P(V.X(x), V.Y(y), c); return; } discF(V.X(x), V.Y(y), V.S(r), c); };
  const zLine = (V, x0, y0, x1, y1, c) => lineP(V.X(x0), V.Y(y0), V.X(x1), V.Y(y1), c);
  const zGlow = (V, x, y, r, T, a) => glow(V.X(x), V.Y(y), V.S(r), T, a);
  // a field of stars over a box of units, the same on screen at every zoom: octaves of cells (each twice the last), each
  // cell's star fading in as the cell grows from P0 to 2·P0 screen pixels, so the sky holds `dens` stars per 1000 screen
  // pixels whatever the layer's size and never swims (L1's scheme). Twinkling on the loop. ok(x, y), if given: may a star be here?
  // (false: no; true: yes; or a palette ramp of its own for this star)
  function zStars(V, t, x0, y0, x1, y1, dens, seed, cols, ok) {
    cols = cols || [136, 19, 20, 21, 22];
    const u = V.u, P0 = Math.sqrt(340 / dens), Yt = Math.max(V.box[1], LB), Yb = Math.min(V.box[3], H - 1 - LB);
    const xa = Math.max(x0, V.lx(V.box[0] - 1)), xb = Math.min(x1, V.lx(V.box[2] + 1)), ya = Math.max(y0, V.ly(Yt - 1)), yb = Math.min(y1, V.ly(Yb + 1));
    if (xb < xa || yb < ya) return;
    for (let k = Math.ceil(Math.log2(P0 / u)); k < 40; k++) {
      const cs = Math.pow(2, k), pc = cs * u; if (cs > 4 * Math.max(x1 - x0, y1 - y0)) break;
      const fade = sstep(P0, 2 * P0, pc), sd = seed + (k + 64) * 17;
      const i0 = fl(xa / cs), i1 = fl(xb / cs), j0 = fl(ya / cs), j1 = fl(yb / cs);
      for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
        const h = ih(ii, jj, sd); if (h > fade) continue;
        const x = (ii + ih(ii, jj, sd + 1)) * cs, y = (jj + ih(ii, jj, sd + 2)) * cs; if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        const X = fl(V.X(x)), Y = fl(V.Y(y)); if (X < V.box[0] || X > V.box[2] || Y < Yt || Y > Yb) continue;
        if (V.hole && X >= V.hole[0] && X <= V.hole[2] && Y >= V.hole[1] && Y <= V.hole[3]) continue;
        const okv = ok ? ok(x, y) : true; if (!okv) continue; const cl = okv === true ? cols : okv;
        const b = ih(ii, jj, sd + 3), tw = 0.5 + 0.5 * Math.sin(zP(t, 1 + fl(ih(ii, jj, sd + 4) * 4)) + 6.28 * ih(ii, jj, sd + 5)), hue = ih(ii, jj, sd + 6);
        const lv = b * b * (0.55 + 0.45 * tw) * clamp((fade - h) / 0.35, 0.25, 1);
        let c = lv > 0.62 ? cl[4] : lv > 0.4 ? cl[3] : lv > 0.22 ? cl[2] : lv > 0.1 ? cl[1] : cl[0];
        if (lv > 0.22 && hue < 0.08) c = lv > 0.45 ? 16 : 15; else if (lv > 0.22 && hue > 0.9) c = lv > 0.45 ? 148 : 147;
        BUF[Y * W + X] = c;
        if (lv > 0.62 && b > 0.95) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = X + ox, yy = Y + oy; if (xx >= V.box[0] && xx <= V.box[2] && yy >= Yt && yy <= Yb) BUF[yy * W + xx] = cl[1]; }
      }
    }
  }
  // the aurora's rays: how bright a curtain is at `fold` along it (L2's units, already folded by the wind) and `h` above its
  // foot (L2's units): irregular rays of uneven height, leaning as they rise. Every layer that shows it (L2–L4) uses this.
  const zN1 = (z, s) => { const i = fl(z), f = z - i, w = f * f * (3 - 2 * f), a = ih(i, 7, s); return a + (ih(i + 1, 7, s) - a) * w; };   // 1-D value noise
  function zAur(fold, h) {
    const f = fold + 0.16 * h * Math.sin(fold / 60), r1 = zN1(f * 0.19, 2261), r2 = zN1(f * 0.53, 2262), r3 = zN1(f * 0.043, 2263);
    return 1.1 * clamp(0.08 + 0.8 * r1 * r1 + 0.45 * r2 * r2, 0, 1.3) * (0.5 + 0.65 * r3) * Math.exp(-h / (16 + 22 * r1 * r3));
  }
  // a hook for one layer to lend its look to another (L6 lends L5 the galaxy's light, so the seam between them vanishes)
  const ZSH = {};

  /* ---------------------------------------------------------------- the compositor (one shot, the whole film) */
  const ZSAVE = new Uint8Array(NP);
  const Z_FALL = [135, 140, 137, 143, 117, 78, 62];
  function zDraw(k, u, t, clip, hole) {
    const L = ZL[zMod(k)], V = zView(u, L && L.R, clip, hole);
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
    const plan = [[k + 1, uO, null]];
    for (let n = 0; n < 3; n++) {
      const kk = k - n, u = uO / ZR;
      if (u * 840 < 1.5) break;                                   // smaller than a pixel or two: nothing to see
      const Lo = ZL[zMod(kk + 1)], mb = (Lo && Lo.maskBox) || ZRECT_BOX;
      const clip = [Math.max(0, fl(240 + mb[0] * uO) - 1), Math.max(0, fl(135 + mb[1] * uO) - 1), Math.min(W - 1, Math.ceil(240 + mb[2] * uO) + 1), Math.min(H - 1, Math.ceil(135 + mb[3] * uO) + 1)];
      if (clip[2] < clip[0] || clip[3] < clip[1]) break;
      plan.push([kk, u, clip]); uO = u;
    }
    // each layer with one inside it may skip the part of the frame that layer will cover whole (a rect window's middle)
    for (let i = 0; i < plan.length; i++) {
      const [kk, u, clip] = plan[i], L = ZL[zMod(kk)], hb = i + 1 < plan.length && L ? (L.hole || (!L.mask ? ZRECT_HOLE : null)) : null;
      const hole = hb ? [Math.ceil(240 + hb[0] * u - 0.5) + 1, Math.ceil(135 + hb[1] * u - 0.5) + 1, fl(240 + hb[2] * u - 0.5) - 1, fl(135 + hb[3] * u - 0.5) - 1] : null;
      if (i > 0) ZSAVE.set(BUF);
      zDraw(kk, u, t, clip, hole && hole[2] > hole[0] && hole[3] > hole[1] ? hole : null);
      if (i > 0) zWindow(kk + 1, plan[i - 1][1]);
    }
  }
  if (typeof window !== 'undefined') window.__candle = { zS, zP, ZL, zView, zDraw, zFrame, ZR, ZN, ZD };
