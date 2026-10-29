  /* ================================================================ the scene kit
     Keyframe tracks; painters that write scenery into G-buffer layers (snowy pines with boughs that droop under their
     snow, snow ground with drifts and sparkle seeds, bark, rock); the sky; snow falling in depth. */
  // keyframes: [{t, e (ease into this key: 'io' | 'o' | 'i' | 's' sine | 'l' | 'b' back), ...numbers}] → eased values
  const KE = { io: eio, o: eoc, i: eic, s: eis, l: (u) => u, b: eob, h: (u) => (u >= 1 ? 1 : 0) };
  function kt(keys, t, out) {
    out = out || {};
    let k = 0;
    while (k < keys.length - 1 && keys[k + 1].t <= t) k++;
    const A = keys[k], B = keys[k + 1];
    for (const f in A) if (f !== 't' && f !== 'e') out[f] = A[f];
    if (B && t > A.t) {
      const u = KE[B.e || 's'](clamp((t - A.t) / (B.t - A.t), 0, 1));
      for (const f in B) if (f !== 't' && f !== 'e' && typeof B[f] === 'number') { const a = typeof A[f] === 'number' ? A[f] : B[f]; out[f] = a + (B[f] - a) * u; }
    }
    return out;
  }
  // fill missing fields forward so every key carries every value
  function KF(...keys) { for (let i = 1; i < keys.length; i++) for (const f in keys[i - 1]) if (!(f in keys[i]) && f !== 'e') keys[i][f] = keys[i - 1][f]; return keys; }
  // a smooth bump: 0 → 1 → 0 over [a, b]
  const bump = (a, b, x) => (x <= a || x >= b ? 0 : Math.sin(PI * (x - a) / (b - a)));

  /* ---------------------------------------------------------------- sky (a direct-colour layer) */
  function paintSky(L, ramp, y0, y1, seed) {
    for (let y = 0; y < L.h; y++) {
      const f = clamp((y - y0) / (y1 - y0), 0, 0.9999) * (ramp.length - 1), k = fl(f), r = f - k;
      for (let x = 0; x < L.w; x++) {
        const n = (vn(x, y, 40, seed) - 0.5) * 0.35;
        const kk = clamp(fl(f + n + (bay(x, y) - 0.5) * 0.9 + 0.5), 0, ramp.length - 1);
        lputC(L, x, y, ramp[kk]);
      }
    }
  }
  // the same gradient drawn live, dithered in screen space (crisp at any zoom): layer rows y0 → y1 over the ramp
  function skyLive(ramp, y0, y1, ox, oy, z, seed) {
    const n = ramp.length - 1, iz = 1 / z;
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const ly = oy + (Y + 0.5 - 135) * iz, f0 = clamp((ly - y0) / (y1 - y0), 0, 0.9999) * n, o = Y * W;
      for (let X = 0; X < W; X++) {
        const lx = ox + (X + 0.5 - 240) * iz, nn = (vn(lx, ly, 40, seed) - 0.5) * 0.35;
        BUF[o + X] = ramp[clamp(fl(f0 + nn + (BAYF[((Y & 7) << 3) | (X & 7)] - 0.5) * 0.9 + 0.5), 0, n)];
      }
    }
  }
  function paintStars(L, n, yMax, seed, cols) {
    for (let k = 0; k < n; k++) {
      const x = fl(ih(k, 1, seed) * L.w), y = fl(ih(k, 2, seed) * yMax), b = ih(k, 3, seed);
      lputC(L, x, y, b > 0.93 ? cols[2] : b > 0.6 ? cols[1] : cols[0]);
      if (b > 0.97) { lputC(L, x + 1, y, cols[0]); lputC(L, x - 1, y, cols[0]); lputC(L, x, y + 1, cols[0]); lputC(L, x, y - 1, cols[0]); }
    }
  }
  // twinkling stars drawn live over the sky (they shimmer gently, never blink hard)
  function liveStars(t, n, seed, ox, oy, zoom, yMax, okc) {
    for (let k = 0; k < n; k++) {
      const wx = ih(k, 1, seed) * 900, wy = ih(k, 2, seed) * yMax;
      const X = fl(toSX(ox, zoom, wx)), Y = fl(toSY(oy, zoom, wy));
      if (X < 0 || X >= W || Y < ROW0 || Y > ROW1) continue;
      const i = Y * W + X; if (okc && !okc(BUF[i])) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.1 + ih(k, 3, seed) * 1.6) + ih(k, 4, seed) * 6.28), b = ih(k, 5, seed) * (0.55 + 0.45 * tw);
      BUF[i] = b > 0.8 ? 22 : b > 0.55 ? 194 : b > 0.3 ? 207 : 206;
      if (b > 0.86 && zoom > 0.9) { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (Y + dy) * W + X + dx; if (Y + dy >= ROW0 && Y + dy <= ROW1 && (!okc || okc(BUF[j]))) BUF[j] = 206; } }
    }
  }

  /* ---------------------------------------------------------------- snowy pines
     A fir loaded with snow: tiers of boughs, each a drooping fan whose upper face carries a cap of snow in soft clumps
     and whose tips hang under the weight; dark needles beneath with a ragged fringe; the trunk shows below the lowest
     tier. lod 0 (far silhouette) … 2 (near, every clump and needle). z: depth (layer units) at the base. */
  function paintPine(L, x, yb, h, w, seed, z, lod, o) {
    o = o || {};
    const top = yb - h, nT = Math.max(3, Math.round(h / (lod >= 2 ? 13 : lod ? 11 : 9))), trunkW = Math.max(1, w * 0.085);
    const snowAmt = o.snow === undefined ? 1 : o.snow, lean = o.lean || 0, pine = o.dark ? M_PINED : M_PINE;
    // trunk first (behind the boughs)
    const tTop = top + h * 0.15;
    for (let y = fl(tTop); y < yb + 2; y++) {
      const tw = trunkW * (1 + 0.5 * sstep(yb - 8, yb + 2, y));
      for (let dx = -Math.ceil(tw); dx <= Math.ceil(tw); dx++) {
        const q = dx / tw; if (Math.abs(q) > 1) continue;
        const gr = lod >= 1 ? (vn(dx * 3 + x, y * 0.35, 1.5, seed + 5) - 0.5) * 0.35 : 0;
        lput(L, x + dx + lean * (yb - y) / h, y, M_BARK, 0.32 - q * 0.22 + gr, z, q * 0.9, 0, 0);
      }
    }
    const TS = [], TSN = [];
    for (let i = 0; i < 8; i++) TS.push(ih(i, 31, seed));
    for (let i = 0; i < nT; i++) TSN.push(0.55 + 0.6 * ih(i, 33, seed));
    for (let i = 0; i < nT; i++) {
      const f0 = (i + 0.0) / nT, f1 = (i + 1) / nT;
      const yt = top + h * 0.92 * Math.pow(f0, 1.06), th = h * 0.92 * (Math.pow(f1, 1.06) - Math.pow(f0, 1.06)) * 1.55 + 3;
      const wi = w * (0.18 + 0.82 * Math.pow(f1, 0.9)) * (0.86 + 0.28 * ih(i, 1, seed));
      const cx = x + lean * (yb - yt) / h + (ih(i, 2, seed) - 0.5) * w * 0.08;
      const droop = th * (0.42 + 0.25 * ih(i, 3, seed));
      for (let dy = 0; dy < th + droop + 2; dy++) {
        const y = fl(yt + dy);
        for (let dx = -Math.ceil(wi) - 2; dx <= Math.ceil(wi) + 2; dx++) {
          const ax = Math.abs(dx) / wi, side = dx < 0 ? -1 : 1;
          if (ax > 1.12) continue;
          // the bough's outline: widening down from the tier's top; the underside hangs lower toward the tips
          const fr = lod >= 1 ? (ih(dx + x * 3, fl(dy / 2), seed + 7) - 0.5) * 0.16 + (vn(dx * 0.9, i * 7, 2.2, seed + 9) - 0.5) * 0.18 : 0;
          // the bough is a fan of branches: fingers out from the trunk, with gaps between them
          const fing = 0.5 + 0.5 * Math.sin(dx * (6.5 / Math.max(4, wi)) * PI * 0.5 + i * 2.1 + TS[i % 8] * 6), fg = lod ? fing : 0.6;
          const reach = Math.pow(clamp(dy / (th * 0.62), 0, 1), 0.62) * (1 + fr) * (0.86 + 0.16 * fg);
          if (ax > reach) continue;
          const yBot = th * (0.42 + 0.2 * fg) + droop * Math.pow(ax, 1.6) * (0.7 + 0.5 * fg) + (lod >= 1 ? (ih(dx * 5 + x, i, seed + 11) - 0.5) * 3.2 + (ih(fl((dx + 300) / 2), i, seed + 12) < 0.3 ? 2.5 : 0) : 0);
          if (dy > yBot) continue;
          // snow on the upper face: pillows along each branch, more on the windward side, thinning toward the tips
          const surf = Math.pow(ax / Math.max(0.05, reach), 2.0) * th * 0.18 - fg * 1.2;
          const sThick = (th * (0.24 - 0.1 * ax) * (0.45 + 0.85 * fg) + (lod >= 1 ? (vn(dx * 0.7 + x, i * 3.1, 2.6, seed + 13) - 0.42) * th * 0.4 : 0)) * snowAmt * TSN[i] * (side < 0 ? 1.08 : 0.86);
          const depthS = dy - surf;                                                     // below the face's top
          const onSnow = snowAmt > 0 && depthS < sThick && dy < yBot - 1.2;
          const ex = 1 - ax;
          if (onSnow) {
            // clumps: rounded lumps catching the sky from above-left; deeper snow is bluer, the edge lips over
            const lump = lod >= 1 ? vn(dx * 1.3 + x, dy * 1.6 + i * 9, 2.1, seed + 17) : 0.5;
            let s = 0.82 + 0.28 * (1 - depthS / Math.max(1, sThick)) - side * 0.08 + (lump - 0.5) * 0.35;
            if (depthS > sThick - 1.3) s -= 0.22;                                       // the shadowed lip
            const sp = lod >= 2 && ih(x + dx, y, seed + 19) < 0.05 ? 1 + fl(ih(x + dx, y, seed + 21) * 254) : 0;
            lput(L, cx + dx, y, M_SNOW, s, z - 1, side * ax * 0.45, -0.75, sp);
          } else {
            // needles: dark, darker inward and lower; a ragged lighter fringe at the very tips
            const nd = lod >= 1 ? (ih(fl((cx + dx) / 1), fl(y / 1), seed + 23) - 0.5) * 0.22 + (vn(dx * 2.2, dy * 1.3 + i * 5, 1.6, seed + 25) - 0.5) * 0.3 : 0;
            let s = 0.22 + 0.16 * ax - 0.12 * clamp((dy - th * 0.4) / th, 0, 1) + nd - side * 0.04;
            if (ax > reach - 0.08) s += 0.08;
            lput(L, cx + dx, y, pine, s, z, side * (0.35 + 0.5 * ax), 0.15, 0);
          }
        }
      }
    }
    // the very top: a snowy spire
    for (let dy = -3; dy < h * 0.06 + 2; dy++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) <= dy * 0.4 + 0.3) lput(L, x + dx + lean, top + dy, dy < 2 ? M_SNOW : pine, dy < 2 ? 0.95 : 0.3, z, dx * 0.3, -0.5, 0);
  }

  /* ---------------------------------------------------------------- the snow ground
     surf(x) → the surface row at layer column x; depth(y) → depth at a ground row. AO wells round tree feet (wells:
     [{x, r}]); drift ripples; sparkle seeds. */
  function paintGround(L, surf, depth, seed, o) {
    o = o || {};
    const wells = o.wells || [], y1 = o.y1 || L.h;
    for (let x = 0; x < L.w; x++) {
      const ys = surf(x), slope = surf(x + 1) - surf(x - 1);
      for (let y = Math.max(0, fl(ys)); y < y1; y++) {
        const dd = y - ys;
        // soft drifts: a large ripple field (wind-sculpted) and a fine crust
        const rip = vn(x * 0.5 + y * 0.9, y * 2.4, 9, seed) - 0.5, fine = (ih(x, y, seed + 1) - 0.5) * 0.06;
        let s = 0.5 + 0.16 * clamp(1 - dd / 30, 0, 1) - slope * 0.12 + rip * 0.2 + fine;
        if (dd < 1.2) s += 0.22;                                       // the lit crest of the bank
        let ao = 0;
        for (const wl of wells) { const d = Math.hypot((x - wl.x) / wl.r, (y - wl.y) / (wl.r * 0.35)); if (d < 1) ao = Math.max(ao, (1 - d) * (wl.a || 0.5)); }
        s -= ao;
        // long moon shadows of the trees, laid across the snow
        if (o.shadows) for (const sh of o.shadows) { const q = (x - sh.x - (y - sh.y) * sh.dx) / sh.w; if (y > sh.y - 2 && Math.abs(q) < 1) s -= sh.a * (1 - q * q) * clamp(1 - (y - sh.y) / 90, 0.3, 1); }
        const nx = 0, ny = -1;                                         // (ground: lit by the lamp from above)
        const sp = ih(x, y, seed + 3) < (o.spark === undefined ? 0.045 : o.spark) ? 1 + fl(ih(x, y, seed + 4) * 254) : 0;
        lput(L, x, y, M_SNOW, s, depth(y), nx, ny, sp);
      }
    }
  }

  /* ---------------------------------------------------------------- snow falling, in three depths
     Flakes fall and sway on loops of their own; par: how much each depth moves with the camera (cx, cy: camera in the
     main plane's pixels); near the lantern they catch its light and glitter. */
  const FLK_N = [70, 46, 18];
  function snowfall(t, cx, cy, zoom, o) {
    o = o || {};
    const dens = o.dens === undefined ? 1 : o.dens, wind = o.wind || 0;
    for (let d = 0; d < 3; d++) {
      const par = [0.45, 0.9, 1.6][d], n = Math.round(FLK_N[d] * dens), fall = [16, 26, 44][d] * (o.fall || 1), sz = d;
      for (let k = 0; k < n; k++) {
        const s = 1300 + d * 97, h1 = ih(k, 1, s), h2 = ih(k, 2, s), h3 = ih(k, 3, s);
        const sp = fall * (0.75 + 0.5 * h3);
        let x = h1 * 640 + Math.sin(t * (0.6 + h2) + k) * (3 + d * 2) + t * wind * (0.5 + d * 0.5) - cx * par;
        let y = h2 * 300 + t * sp - cy * par;
        x = ((x % 640) + 640) % 640 - 80; y = ((y % 300) + 300) % 300 - 20;
        const X = fl(240 + (x - 240) * (1 + (zoom - 1) * par * 0.6)), Y = fl(135 + (y - 135) * (1 + (zoom - 1) * par * 0.6));
        if (X < 0 || X >= W - 1 || Y < ROW0 || Y > ROW1 - 1) continue;
        let l = 0;
        if (LAMP.on) { const dx = X - LAMP.x, dy = Y - LAMP.y, q = (dx * dx + dy * dy) / (LAMP.R * LAMP.R * (d === 2 ? 2.2 : 1.4)); l = q < 4 ? LAMP.I / (1 + q * 2.2) : 0; }
        const tw = ih(k, fl(t * 6 + h1 * 10), s + 5);
        let c = d === 0 ? 168 : d === 1 ? 169 : 194;
        if (l > 0.15) c = l > 0.55 ? (tw < 0.3 ? 22 : 187) : l > 0.3 ? 188 : 189;
        if (o.cool && l <= 0.15) c = o.cool[d];
        const i = Y * W + X;
        if (sz === 0) BUF[i] = c;
        else if (sz === 1) { BUF[i] = c; if (h3 > 0.6) BUF[i + 1] = c; }
        else if (wind > 30) { BUF[i] = c; if (X > 1) BUF[i - 1] = l > 0.15 ? 189 : 168; if (X > 2 && h3 > 0.5) BUF[i - 2 + W] = l > 0.15 ? 190 : 167; BUF[i + W] = c; }
        else { BUF[i] = c; BUF[i + 1] = c; BUF[i + W] = c; BUF[i + W + 1] = l > 0.15 ? 189 : 168; }
      }
    }
  }
  // the camera's slow handheld drift (very gentle, smooth)
  const drift = (t, k, a) => a * (Math.sin(t * 0.53 + k) * 0.6 + Math.sin(t * 0.91 + k * 2.1) * 0.4);

  /* ---------------------------------------------------------------- the aurora
     Curtains of green light hanging in folds: a sinuous lower hem, vertical rays that drift along the curtain, brightest
     just above the hem (with a violet fringe below it) and fading upward. Drawn straight after the sky, before anything
     else. Curtains: [{y (hem, sky-layer units), amp, len (how far up it reaches), k (fold frequency), ph, x0, x1 (extent)}]. */
  const R_AUR = [230, 231, 232, 233, 234];
  function aurora(t, ox, oy, z, amt, curtains, yClip) {
    if (amt <= 0.01) return;
    const yc = yClip === undefined ? ROW1 : Math.min(ROW1, yClip);
    for (let X = 0; X < W; X++) {
      const wx = toLX(ox, z, X);
      for (const C of curtains) {
        const env = sstep(C.x0, C.x0 + 110, wx) * (1 - sstep(C.x1 - 110, C.x1, wx));
        if (env <= 0.01) continue;
        // the hem folds and drifts; the rays are thin bright streaks over a faint veil, sliding along the curtain
        const hem = C.y + C.amp * Math.sin(wx * C.k + t * 0.22 + C.ph) + C.amp * 0.35 * Math.sin(wx * C.k * 2.9 - t * 0.33 + C.ph * 2);
        const r1 = 0.5 + 0.5 * Math.sin(wx * 0.33 + 3.1 * Math.sin(wx * 0.017 + t * 0.21 + C.ph) + t * 0.55);
        const r2 = 0.5 + 0.5 * Math.sin(wx * 0.91 - 2.0 * Math.sin(wx * 0.041 - t * 0.37) + t * 1.1 + C.ph);
        const r3 = 0.5 + 0.5 * Math.sin(wx * 0.06 + t * 0.15 + C.ph * 2);
        const ray = 0.45 + 0.3 * sstep(0.45, 0.8, r1) + 0.18 * r2 + 0.22 * r3;   // fine rays in a soft veil
        const fold = 0.6 + 0.4 * Math.sin(wx * C.k * 1.7 + t * 0.3 + C.ph * 3);   // brighter where the curtain turns toward us
        const q = env * amt * ray * fold * (C.b || 1);
        const len = C.len;
        const Yh = toSY(oy, z, hem), Yt = toSY(oy, z, hem - len);
        const y0 = Math.max(ROW0, fl(Yt)), y1 = Math.min(yc, Math.ceil(Yh + 4 * z));
        for (let Y = y0; Y <= y1; Y++) {
          const d = (Yh - Y) / z, b = bay(X, Y), i = Y * W + X;
          if (d > 4 && ih(X, Y, 1777) > Math.exp(-d / len * 1.2) + 0.25) continue;   // the upper veil thins out unevenly
          if (d < 0) { const A = q * Math.exp(d / 1.4); if (A > 0.5 && b < (A - 0.5) * 2) BUF[i] = 192; continue; }
          const u = d / len, A = q * (d < 2.5 ? 0.75 + d * 0.1 : Math.exp(-u * 2.6) * (1 - u * u));
          const lv = A * 5 + (b - 0.5) * 1.2;
          if (lv < 0.4) continue;
          if (lv < 1.2) { if (b < (lv - 0.4) * 1.3) BUF[i] = 230; continue; }
          BUF[i] = R_AUR[clamp(fl(lv - 0.2), 0, 4)];
        }
      }
    }
  }
  /* the aurora, as curtains: a sinuous hem that folds (brightest where a fold turns edge-on to us), each curtain of
     uneven height along its length, its rays irregular (two octaves of noise) and leaning as they rise, a violet fringe
     under the hem, mint-white at the hem, green, then teal and thinning out above. */
  const R_AUL = [230, 231, 232, 233, 234], R_AUH = [124, 125, 230, 231, 232];
  function aurora2(t, ox, oy, z, amt, curtains) {
    if (amt <= 0.01) return;
    for (let X = 0; X < W; X++) {
      const wx = toLX(ox, z, X);
      for (let ci = 0; ci < curtains.length; ci++) {
        const C = curtains[ci], env = sstep(C.x0, C.x0 + 140, wx) * (1 - sstep(C.x1 - 140, C.x1, wx));
        if (env <= 0.01) continue;
        const a1 = wx * C.k + t * 0.22 + C.ph, a2 = wx * C.k * 2.9 - t * 0.33 + C.ph * 2;
        const hem = C.y + C.amp * Math.sin(a1) + C.amp * 0.35 * Math.sin(a2), slope = C.amp * C.k * (Math.cos(a1) + 1.015 * Math.cos(a2));
        const fold = 0.5 + 0.5 * Math.min(1, Math.abs(slope) * 1.6), q = env * amt * fold * (C.b || 1);
        const lenL = C.len * (0.6 + 0.55 * (0.5 + 0.5 * n1(wx * 0.011 + C.ph * 3 + t * 0.05, 7311)));
        const Yh = toSY(oy, z, hem), y0 = Math.max(ROW0, fl(toSY(oy, z, hem - lenL))), y1 = Math.min(ROW1, Math.ceil(Yh + 5 * z));
        const lean = 0.3 * Math.sin(wx * 0.006 + C.ph + t * 0.08);
        for (let Y = y0; Y <= y1; Y++) {
          const d = (Yh - Y) / z, b = BAYF[((Y & 7) << 3) | (X & 7)], i = Y * W + X;
          if (d < 0) { const A = q * Math.exp(d / 1.7) * 0.7; if (A > 0.28 + b * 0.5) BUF[i] = A > 0.62 ? 192 : 253; continue; }
          const u = d / lenL; if (u > 0.3 && ih(X, Y, 1777) > Math.exp(-(u - 0.3) * 1.2) + 0.42) continue;
          const rx = wx + d * lean, r1 = 0.5 + 0.5 * n1(rx * 0.05 + t * 0.3 + C.ph * 5, 7312), r2 = 0.5 + 0.5 * n1(rx * 0.21 - t * 0.7 + C.ph, 7313);
          const ray = 0.42 + 0.5 * r1 * r1 + 0.2 * r2 * r2, prof = d < 2 ? 0.72 + d * 0.14 : Math.exp(-u * 2.3) * (1 - u * u * 0.5);
          const lv = q * ray * prof * 5.4 + (b - 0.5) * 1.1;
          if (lv < 0.42) continue;
          BUF[i] = d < 2.5 && lv > 3.4 ? 234 : (u > 0.5 ? R_AUH : R_AUL)[clamp(fl(lv - 0.42), 0, 4)];
        }
      }
    }
  }
  // a dark trunk sweeping past the lens (a wipe): its centre x on screen, half-width hw
  function wipeTrunk(cxs, hw, t, lampLit) {
    const x0 = Math.max(0, fl(cxs - hw - 2)), x1 = Math.min(W - 1, Math.ceil(cxs + hw + 2));
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wob = 3 * Math.sin(Y * 0.02 + 1.3) + 2 * Math.sin(Y * 0.071);
      for (let X = x0; X <= x1; X++) {
        const q = (X + 0.5 - cxs - wob) / hw; if (Math.abs(q) > 1) continue;
        // furrowed bark: long vertical grooves wandering a little, plates between them; round, dark, out of focus
        const nc = Math.sqrt(1 - q * q), u = Math.asin(q) * 6.5 + n1(Y * 0.013, 9101) * 0.8;
        const fu = Math.abs(Math.sin(u * PI)), plate = vn(u * 3, Y * 0.03, 1.5, 9103);
        let v = 0.25 + 0.5 * nc - (fu < 0.18 ? 0.35 : 0) + (plate - 0.5) * 0.2 - q * 0.15;
        let c = v > 0.62 ? 217 : v > 0.42 ? 216 : v > 0.22 ? 215 : 195;
        if (q < -0.88) c = 217;                                          // cool rim
        if (q > 0.9 && lampLit > 0) c = bay(X, Y) < 0.5 ? 219 : 177;    // a thin warm edge from the lantern
        if (q < -0.3 && fu > 0.6 && vn(u, Y * 0.05, 2, 9102) > 0.78) c = 136;   // snow caught on the windward plates
        BUF[Y * W + X] = c;
      }
    }
  }
